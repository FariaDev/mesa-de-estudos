import Base
import ../sessions.bend as S

# ---------------------------------------------------------------------------
# Contrato do núcleo de sessões. Prefixo `sess_`.
#
# String.ends_with / Nat.read / colapso numa String livre não reduzem: o
# casamento do caminho e os cortes 48/40 fecham em cenários concretos (os
# que o host exercita). Fatos Bool (jsonl, hoje/ontem, nova, valid) deixam
# as leis gerais reduzirem. O anexo da Conversa no JS é um bloco até a
# cerca; aqui é marcador-até-o-fim — no app o anexo vai no fim da mensagem.
# ---------------------------------------------------------------------------

# ---------- caminho: pi-(\d+)\.jsonl$ ----------

# Fato "não termina em .jsonl": timestamp 0, qualquer path.
law sess_path_nao_jsonl:
  for path: String
  {S.started.if(path, False{}) == 0n : Nat}

# Casamento concreto. O teste da Mesa usa `pi-1700000000000`; a lei usa
# um número pequeno porque Nat no checker é unário e o timestamp não reduz.
law sess_path_casa:
  {S.sessionStartedFromPath("/tmp/pi-12.jsonl") == 12n : Nat}

# Sem o prefixo pi- imediatamente antes dos dígitos.
law sess_path_sem_pi:
  {S.sessionStartedFromPath("/tmp/foo.jsonl") == 0n : Nat}

# Não termina em .jsonl.
law sess_path_sufixo:
  {S.sessionStartedFromPath("pi-12.jsonl.bak") == 0n : Nat}

# Sem dígitos (`\d+` falha).
law sess_path_sem_digito:
  {S.sessionStartedFromPath("pi-.jsonl") == 0n : Nat}

# Vazio.
law sess_path_vazio:
  {S.sessionStartedFromPath("") == 0n : Nat}

# Só o basename também casa.
law sess_path_basename:
  {S.sessionStartedFromPath("pi-12.jsonl") == 12n : Nat}

# ---------- preview: primeira user não vazia ----------

# Lista vazia → string vazia.
law sess_preview_vazio:
  for cuts: S.PreviewCuts
  {S.sessionPreview(Nil{}, cuts) == "" : String}

# Achado já feito se mantém até o fim (primeira mensagem vence).
law sess_preview_achado_mantem:
  for msgs: List<&2, S.SessionMsg>
  for cuts: S.PreviewCuts
  for v: String
  {S.preview.go(msgs, cuts, Some{v}) == Some{v} : Maybe<&2, String>}

# Primeira user vence a segunda.
law sess_preview_primeira:
  {S.sessionPreview(
    [
      S.SessionMsg{True{}, S.BodyString{"oi"}},
      S.SessionMsg{True{}, S.BodyString{"depois"}}
    ],
    S.chatCuts()
  ) == "oi" : String}

# Não-user é pulada.
law sess_preview_pula_nao_user:
  {S.sessionPreview(
    [
      S.SessionMsg{False{}, S.BodyString{"assistente"}},
      S.SessionMsg{True{}, S.BodyString{"user"}}
    ],
    S.chatCuts()
  ) == "user" : String}

# User vazia (depois do corte) é pulada.
law sess_preview_pula_vazia:
  {S.sessionPreview(
    [
      S.SessionMsg{True{}, S.BodyString{""}},
      S.SessionMsg{True{}, S.BodyString{"ok"}}
    ],
    S.chatCuts()
  ) == "ok" : String}

# Campo `text` (fallback do JSONL).
law sess_preview_campo_text:
  {S.sessionPreview(
    [S.SessionMsg{True{}, S.BodyField{"nota"}}],
    S.chatCuts()
  ) == "nota" : String}

# Partes de texto juntam com espaço (JS: join(' ')).
law sess_partes_junta:
  {S.contentText(S.BodyParts{["olá", "mundo"]}) == "olá mundo" : String}

law sess_preview_partes:
  {S.sessionPreview(
    [S.SessionMsg{True{}, S.BodyParts{["olá", "mundo"]}}],
    S.chatCuts()
  ) == "olá mundo" : String}

# ---------- marcadores ----------

# Conversa: corta `[Buscar na web]` até o fim (teste de chat/lib.cjs).
law sess_marcador_buscar:
  {S.sessionPreview(
    [S.SessionMsg{True{}, S.BodyString{"cotação do dólar\n\n[Buscar na web] use web_search"}}],
    S.chatCuts()
  ) == "cotação do dólar" : String}

# Conversa: corta anexo apenso no fim.
law sess_marcador_anexo:
  {S.sessionPreview(
    [S.SessionMsg{True{}, S.BodyString{"leia isto\n\n[Anexo: notas.md]\n```\ncorpo\n```"}}],
    S.chatCuts()
  ) == "leia isto" : String}

# Mesa: corta contexto da sessão.
law sess_marcador_contexto:
  {S.sessionPreview(
    [S.SessionMsg{True{}, S.BodyString{"quanto vale?\n\n[Contexto da sessão na Mesa: matéria: x.]"}}],
    S.mesaCuts()
  ) == "quanto vale?" : String}

# Mesa: corta referências.
law sess_marcador_refs:
  {S.sessionPreview(
    [S.SessionMsg{True{}, S.BodyString{"quanto vale o limite?\n\n[Referências abertas na mesa, indicadas pelo usuário como contexto: \"/tmp/a.pdf#page=1\"]."}}],
    S.mesaCuts()
  ) == "quanto vale o limite?" : String}

# Mesa: `/conferir` vira o rótulo (teste de desk/lib.cjs).
law sess_marcador_conferir:
  {S.sessionPreview(
    [S.SessionMsg{True{}, S.BodyString{"/conferir x"}}],
    S.mesaCuts()
  ) == "Conferir Xournal++" : String}

# Sem o fato conferir, o comando permanece (política da Conversa).
law sess_conferir_off:
  {S.sessionPreview(
    [S.SessionMsg{True{}, S.BodyString{"/conferir x"}}],
    S.chatCuts()
  ) == "/conferir x" : String}

# ---------- cortes 48 / 40 ----------

law sess_preview_corta_48:
  {S.sessionPreview(
    [S.SessionMsg{True{}, S.BodyString{"01234567890123456789012345678901234567890123456789"}}],
    S.chatCuts()
  ) == "012345678901234567890123456789012345678901234567" : String}

# O corte vem *depois* de limpar: espaços das pontas somem antes dos 48.
law sess_preview_limpa_antes_de_cortar:
  {S.sessionPreview(
    [S.SessionMsg{True{}, S.BodyString{"   " ++ String.from_list(List.replicate(Char, 60n, 'a')) ++ "   "}}],
    S.chatCuts()
  ) == String.from_list(List.replicate(Char, 48n, 'a')) : String}

law sess_nota_corta_40:
  {S.formatSessionLabel(
    "",
    "012345678901234567890123456789012345678901234",
    False{},
    True{},
    1n, 2n, 3n, 4n
  ) == "01/02, 03:04 · 0123456789012345678901234567890123456789" : String}

# ---------- helpers tail (accumulator) ----------

# Limpeza direta: espaços/tab/LF viram um espaço e as pontas somem (o colapso
# e o trim são passos separados; o preview usa `cleanText`).
law sess_colapso_espacos:
  {S.cleanText("  olá \t\n mundo  ") == "olá mundo" : String}

law sess_colapso_sem_espaco:
  {S.cleanText("abc") == "abc" : String}

# Corte de marcador direto: do `\n\n`+agulha até o fim.
law sess_corte_marcador:
  {S.cutOne("antes\n\n[Anexo: corpo", "[Anexo: ") == "antes" : String}

# Sem a agulha, a string passa inteira (inclusive com \n solto).
law sess_corte_sem_marcador:
  {S.cutOne("antes\ndepois", "[Anexo: ") == "antes\ndepois" : String}

# takeTrail: o último trecho de dígitos e o prefixo que o antecede.
law sess_take_trail:
  {S.started.from(S.takeTrail("dir/pi-42")) == 42n : Nat}

law sess_take_trail_sem_digito:
  {S.started.from(S.takeTrail("dir/pi-")) == 0n : Nat}

# ---------- rótulos ----------

# Título vence data, nota e "Nova conversa".
law sess_rotulo_titulo:
  for preview: String
  for nova: Bool
  for valid: Bool
  for day: Nat
  for month: Nat
  for hour: Nat
  for minute: Nat
  {S.formatSessionLabel("Limites", preview, nova, valid, day, month, hour, minute) == "Limites" : String}

law sess_rotulo_titulo_trim:
  {S.formatSessionLabel("  Limites  ", "olá", True{}, True{}, 1n, 1n, 1n, 1n) == "Limites" : String}

# Conversa vazia (fato nova): "Nova conversa".
law sess_rotulo_nova:
  {S.formatSessionLabel("", "", True{}, False{}, 0n, 0n, 0n, 0n) == "Nova conversa" : String}

# Sem nova e sem nota: "Conversa" se a data não vale (Mesa e Conversa).
law sess_rotulo_conversa:
  {S.formatSessionLabel("", "", False{}, False{}, 0n, 0n, 0n, 0n) == "Conversa" : String}

# Data inválida, com nota: "Conversa · nota".
law sess_rotulo_nota_sem_data:
  {S.formatSessionLabel("", "olá", False{}, False{}, 0n, 0n, 0n, 0n) == "Conversa · olá" : String}

# Data local `dd/mm, hh:mm` (zero à esquerda).
law sess_rotulo_data:
  {S.formatWhen(True{}, 17n, 9n, 14n, 5n) == "17/09, 14:05" : String}

law sess_rotulo_data_meia_noite:
  {S.formatWhen(True{}, 1n, 1n, 0n, 0n) == "01/01, 00:00" : String}

# Sem data válida o when é "Conversa", independente dos componentes.
law sess_rotulo_valid_false:
  for day: Nat
  for month: Nat
  for hour: Nat
  for minute: Nat
  {S.formatWhen(False{}, day, month, hour, minute) == "Conversa" : String}

law sess_rotulo_com_nota:
  {S.formatSessionLabel("", "olá mundo", False{}, True{}, 1n, 2n, 3n, 4n)
    == "01/02, 03:04 · olá mundo" : String}

# Colapso de espaços na nota.
law sess_rotulo_colapsa:
  {S.formatSessionLabel("", "olá\n\nmundo", False{}, True{}, 1n, 1n, 1n, 1n)
    == "01/01, 01:01 · olá mundo" : String}

# ---------- grupos ----------

# Hoje vence, mesmo se o fato ontem também vier True.
law sess_grupo_hoje:
  for yest: Bool
  {S.groupOf(True{}, yest) == S.GroupToday{} : S.SessionGroup}

law sess_grupo_ontem:
  {S.groupOf(False{}, True{}) == S.GroupYesterday{} : S.SessionGroup}

law sess_grupo_antes:
  {S.groupOf(False{}, False{}) == S.GroupOlder{} : S.SessionGroup}

law sess_grupo_rotulo_hoje:
  {S.groupLabel(S.GroupToday{}) == "Hoje" : String}

law sess_grupo_rotulo_ontem:
  {S.groupLabel(S.GroupYesterday{}) == "Ontem" : String}

law sess_grupo_rotulo_antes:
  {S.groupLabel(S.GroupOlder{}) == "Anteriores" : String}

# Entrada vazia → nenhum grupo.
law sess_grupo_vazio:
  {S.groupSessions(Nil{}, Nil{}, Nil{}) == Nil{} : List<&2, S.SessionBucket>}

# Só hoje: um grupo, rótulo Hoje, ordem preservada.
law sess_grupo_so_hoje:
  {S.groupSessions(["/a", "/b"], [True{}, True{}], [False{}, False{}])
    == [S.SessionBucket{S.GroupToday{}, "Hoje", ["/a", "/b"]}]
    : List<&2, S.SessionBucket>}

# Grupos vazios não saem; ordem Hoje, Ontem, Anteriores.
law sess_grupo_mistura:
  {S.groupSessions(
    ["/hoje", "/ontem", "/antes"],
    [True{}, False{}, False{}],
    [False{}, True{}, False{}]
  ) == [
    S.SessionBucket{S.GroupToday{}, "Hoje", ["/hoje"]},
    S.SessionBucket{S.GroupYesterday{}, "Ontem", ["/ontem"]},
    S.SessionBucket{S.GroupOlder{}, "Anteriores", ["/antes"]}
  ] : List<&2, S.SessionBucket>}

# Só anteriores: Hoje/Ontem não aparecem.
law sess_grupo_so_antes:
  {S.groupSessions(["/a"], [False{}], [False{}])
    == [S.SessionBucket{S.GroupOlder{}, "Anteriores", ["/a"]}]
    : List<&2, S.SessionBucket>}

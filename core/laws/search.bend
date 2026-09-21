import Base
import ../search.bend as S

# ---------------------------------------------------------------------------
# Contrato da busca no conteúdo das conversas.
#
# Fatos do host (Bool) deixam as leis gerais reduzirem. Cenários de acento/
# caixa são concretos e computam. O que ficou de fora (índice UTF-16, parser
# JSONL, colapso de espaços, NFD além de Latin-1) não tem lei — é host.
# ---------------------------------------------------------------------------

def hit(conv: String, title: String) -> S.SearchHit:
  S.SearchHit{conv, title, S.MsgUser{}, "x"}

# ---------- constantes ----------

law busca_min_query:
  {S.minQueryChars() == 2n : Nat}

law busca_default_30:
  {S.defaultLimit() == 30n : Nat}

law busca_teto_50:
  {S.maxLimit() == 50n : Nat}

law busca_teto_arquivos:
  {S.maxFiles() == 300n : Nat}

# ---------- casamento (strip de marcas, NÃO o NFD da Mesa) ----------

# --- fold em accumulator (correção #798; helpers cobertos) ---

law fold_vazio:
  {S.fold("") == "" : String}

law fold_acento:
  {S.fold("FORMULÁRIO") == "formulario" : String}

law fold_combinante:
  {S.fold("cafe\u{0301}") == "cafe" : String}

law fold_misto:
  {S.fold("Cálculo 🙂 ATENÇÃO") == "calculo 🙂 atencao" : String}

# O acumulador entra antes da dobra do restante.
law fold_go_acumula:
  {S.fold.go("abc", "Z") == "Zabc" : String}

# "formulario" acha "FORMULÁRIO" — marcas saem, caixa não importa.
law busca_formulario:
  {S.matches("FORMULÁRIO pronto", "formulario") == True{} : Bool}

# Agulha acentuada acha texto sem acento.
law busca_acao:
  {S.matches("Use acao direta no formulario.", "ação") == True{} : Bool}

# "atencao" acha "atenção".
law busca_atencao:
  {S.matches("Passo 2: atenção à constante", "atencao") == True{} : Bool}

# Ao contrário de fold.bend: "calculo" acha "Cálculo" (marcas removidas).
law busca_calculo:
  {S.matches("Cálculo I", "calculo") == True{} : Bool}

# Combinante solto (cafe + U+0301) some na dobra.
law busca_combinante:
  {S.matches("cafe\u{0301} com leite", "cafe") == True{} : Bool}

# Caixa não importa.
law busca_caixa:
  {S.matches("Alfa", "ALFA") == True{} : Bool}

# Agulha vazia (ou só espaço, depois do trim) não casa.
law busca_agulha_vazia:
  {S.matches("texto", "") == False{} : Bool}

law busca_agulha_espaco:
  {S.matches("texto", "   ") == False{} : Bool}

# Hay vazio não casa.
law busca_hay_vazio:
  {S.matches("", "alfa") == False{} : Bool}

# Sem ocorrência.
law busca_nao_casa:
  {S.matches("texto", "zzz") == False{} : Bool}

# ---------- trecho ----------

law trecho_inteiro:
  for s: String
  {S.snippet(False{}, False{}, s) == s : String}

law trecho_pontas:
  {S.snippet(True{}, True{}, "FORMULÁRIO") == "…FORMULÁRIO…" : String}

law trecho_so_comeco:
  {S.snippet(True{}, False{}, "Atenção no começo") == "…Atenção no começo" : String}

# ---------- clampLimit ----------

law limite_invalido:
  for overMax: Bool
  for n: Nat
  {S.clampLimit(True{}, overMax, n) == 30n : Nat}

law limite_teto:
  for n: Nat
  {S.clampLimit(False{}, True{}, n) == 50n : Nat}

law limite_pedido:
  for n: Nat
  {S.clampLimit(False{}, False{}, n) == n : Nat}

# ---------- papel ----------

law papel_outro:
  {S.keepRole(False{}, False{}) == None{} : Maybe<&2, S.MsgRole>}

law papel_user:
  {S.keepRole(True{}, False{}) == Some{S.MsgUser{}} : Maybe<&2, S.MsgRole>}

law papel_assistant:
  {S.keepRole(False{}, True{}) == Some{S.MsgAssistant{}} : Maybe<&2, S.MsgRole>}

# ---------- arquivo: cortado ⇒ parcial ----------

law arquivo_cheio_para:
  for timedOut: Bool
  for atFileCap: Bool
  for tooLarge: Bool
  {S.fileAct(True{}, timedOut, atFileCap, tooLarge) == S.ActStop{} : S.FileAct}

law arquivo_timeout_para:
  for atFileCap: Bool
  for tooLarge: Bool
  {S.fileAct(False{}, True{}, atFileCap, tooLarge) == S.ActStop{} : S.FileAct}

law arquivo_300_para:
  for tooLarge: Bool
  {S.fileAct(False{}, False{}, True{}, tooLarge) == S.ActStop{} : S.FileAct}

law arquivo_grande_pula:
  {S.fileAct(False{}, False{}, False{}, True{}) == S.ActSkip{} : S.FileAct}

law arquivo_livre_varre:
  {S.fileAct(False{}, False{}, False{}, False{}) == S.ActScan{} : S.FileAct}

# Cortado (teto de trechos) ⇒ parcial, qualquer que fosse o estado anterior.
law cortado_parcial:
  for was: Bool
  for timedOut: Bool
  for atFileCap: Bool
  for tooLarge: Bool
  {S.stepTruncated(was, True{}, timedOut, atFileCap, tooLarge) == True{} : Bool}

law timeout_parcial:
  for was: Bool
  for atFileCap: Bool
  for tooLarge: Bool
  {S.stepTruncated(was, False{}, True{}, atFileCap, tooLarge) == True{} : Bool}

# Pular arquivo grande NÃO marca parcial por si.
law grande_nao_corta:
  for was: Bool
  {S.stepTruncated(was, False{}, False{}, False{}, True{}) == was : Bool}

law scan_mantem_parcial:
  for was: Bool
  {S.stepTruncated(was, False{}, False{}, False{}, False{}) == was : Bool}

# ---------- teto da lista ----------

# Primeiro fato cheio: nenhum trecho sai.
law cap_primeiro:
  for h: S.SearchHit
  for t: List<&2, S.SearchHit>
  for fs: List<&2, Bool>
  {S.takeUntilFull(Con{h, t}, Con{True{}, fs}) == Nil{} : List<&2, S.SearchHit>}

# Primeiro fato cabe: a cabeça entra e a ordem se mantém.
law cap_cabeca:
  for h: S.SearchHit
  for t: List<&2, S.SearchHit>
  for fs: List<&2, Bool>
  {S.takeUntilFull(Con{h, t}, Con{False{}, fs}) == Con{h, S.takeUntilFull(t, fs)} : List<&2, S.SearchHit>}

# Sem nenhum cheio, a lista inteira passa (ordem estável).
law cap_identidade:
  for xs: List<&2, S.SearchHit>
  {S.takeUntilFull(xs, S.noneFull(xs)) == xs : List<&2, S.SearchHit>}

# Sem nenhum cheio, não é parcial.
law cap_nenhum_parcial:
  for xs: List<&2, S.SearchHit>
  {S.anyFull(S.noneFull(xs)) == False{} : Bool}

# Qualquer cheio na lista de fatos ⇒ resultado parcial.
law cheio_parcial:
  for xs: List<&2, S.SearchHit>
  for fs: List<&2, Bool>
  for h: {S.anyFull(fs) == True{} : Bool}
  {S.truncatedOf(S.searchOut(False{}, xs, fs)) == True{} : Bool}

# Consulta curta: vazio e NÃO parcial, ignore candidatos e teto.
law consulta_curta:
  for xs: List<&2, S.SearchHit>
  for fs: List<&2, Bool>
  {S.searchOut(True{}, xs, fs) == S.SearchOut{Nil{}, False{}} : S.SearchOut}

# ---------- agrupamento (ordem da lista = ordem das conversas) ----------

law grupo_vazio:
  {S.groupHits(Nil{}, Nil{}) == Nil{} : List<&2, S.SearchGroup>}

law grupo_um:
  {S.groupHits([hit("a", "A")], Nil{}) == [S.SearchGroup{"a", "A", [hit("a", "A")]}] : List<&2, S.SearchGroup>}

# Dois trechos da mesma conversa viram um grupo, na ordem em que vieram.
law grupo_mesma:
  {S.groupHits([hit("a", "A"), hit("a", "A")], [True{}]) == [S.SearchGroup{"a", "A", [hit("a", "A"), hit("a", "A")]}] : List<&2, S.SearchGroup>}

# Conversas diferentes não se misturam; a ordem dos grupos segue a da lista.
law grupo_separa:
  {S.groupHits([hit("b", "B"), hit("a", "A")], [False{}]) == [S.SearchGroup{"b", "B", [hit("b", "B")]}, S.SearchGroup{"a", "A", [hit("a", "A")]}] : List<&2, S.SearchGroup>}

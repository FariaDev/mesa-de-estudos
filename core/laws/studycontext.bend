import Base
import ../msg.bend as M
import ../studycontext.bend as S

# ---------------------------------------------------------------------------
# Contrato do bloco de contexto da Mesa. Prefixo `sc_`.
#
# Cenários concretos (as String reduzem) e fatos Bool recebidos como parâmetro.
# O que o contrato fixa:
#   - nada para dizer ⇒ nenhum bloco (não vai nem o cabeçalho);
#   - contexto inalterado e sem captura nova ⇒ não reenvia;
#   - captura nova sempre vai, mesmo com o resto inalterado;
#   - referência aberta é declarada como não lida;
#   - captura de outro exercício é marcada como tal.
#
# O que não saiu (e por quê):
#   - `render` numa String/lista livres: o cenário geral precisa de
#     `String.is_empty` e `String.append` sobre valores simbólicos, que o
#     reducer não fecha. As leis fixam a tabela concreta que o host produz.
#   - Ordem das linhas com campos livres: depende de `String.append` sobre
#     simbólico; a ordem fecha nos cenários abaixo (matéria → exercício →
#     rascunho → referências → captura).
# ---------------------------------------------------------------------------

# ---------- nada para dizer ----------

# Contexto vazio sem captura não gera bloco nenhum.
law sc_vazio:
  {S.render(S.StudyContext{"", "", "", False{}, S.NoCapture{}}, Nil{}, False{}) == "" : String}

# Nem quando o host marca que já mandou: segue vazio.
law sc_vazio_repetido:
  {S.render(S.StudyContext{"", "", "", False{}, S.NoCapture{}}, Nil{}, True{}) == "" : String}

# ---------- reenvio ----------

# Mesmo contexto, já mandado, sem captura nova: não vai.
law sc_repetido_nao_reenvia:
  {S.render(
    S.StudyContext{"Cálculo I", "Lista 3", "", True{}, S.NoCapture{}},
    ["limites.pdf#page=3"], True{}
  ) == "" : String}

# Mesmo contexto, primeira vez: vai completo.
law sc_primeiro_manda:
  {S.render(
    S.StudyContext{"Cálculo I", "Lista 3", "", True{}, S.NoCapture{}},
    ["limites.pdf#page=3"], False{}
  ) == String.append(
    String.append(
      String.append(M.msg("studyctx.header"), String.append("\n", M.msg1("studyctx.course", "course", "Cálculo I"))),
      String.append("\n", M.msg1("studyctx.exercise", "exercise", "Lista 3"))
    ),
    String.append(String.append("\n", M.msg("studyctx.refsHeader")), "\n  · limites.pdf#page=3")
  ) : String}

# Captura nova vai mesmo com o contexto já mandado.
law sc_captura_nova_reenvia:
  {String.contains(
    S.render(
      S.StudyContext{"Cálculo I", "Lista 3", "", True{}, S.Capture{"14:32", "Lista 3", True{}, "Xournal++"}},
      ["limites.pdf#page=3"], True{}
    ),
    M.msg2("studyctx.capture.xournal", "time", "14:32", "exercise", "Lista 3")
  ) == True{} : Bool}

# ---------- proveniência da referência ----------

# Referência aberta entra declarada como não lida.
law sc_referencia_nao_lida:
  {String.contains(
    S.render(S.StudyContext{"", "", "", True{}, S.NoCapture{}}, ["limites.pdf#page=3"], False{}),
    M.msg("studyctx.refsHeader")
  ) == True{} : Bool}

# Sem referência aberta, a seção não aparece.
law sc_sem_referencia:
  {S.render(S.StudyContext{"", "", "", False{}, S.NoCapture{}}, Nil{}, False{}) == "" : String}

# ---------- captura ----------

# Captura do exercício ativo: sem aviso.
law sc_captura_do_exercicio:
  {String.contains(
    S.render(S.StudyContext{"", "Lista 3", "", False{}, S.Capture{"14:32", "Lista 3", True{}, "Xournal++"}}, Nil{}, True{}),
    M.msg2("studyctx.captureStale.xournal", "time", "14:32", "exercise", "Lista 3")
  ) == False{} : Bool}

# Captura de outro exercício: avisada.
law sc_captura_outro_exercicio:
  {String.contains(
    S.render(S.StudyContext{"", "Lista 3", "", False{}, S.Capture{"14:32", "Lista 1", False{}, "Xournal++"}}, Nil{}, True{}),
    M.msg2("studyctx.captureStale.xournal", "time", "14:32", "exercise", "Lista 1")
  ) == True{} : Bool}

# ---------- fatos Bool do núcleo ----------

# Com captura presente, o fato responde True independente do resto.
law sc_fato_captura_presente:
  for t: String
  for e: String
  for m: Bool
  for a: String
  {S.capturePresent(S.Capture{t, e, m, a}) == True{} : Bool}

# Sem captura, responde False.
law sc_fato_captura_ausente:
  {S.capturePresent(S.NoCapture{}) == False{} : Bool}

# Lista vazia de referências: fato False.
law sc_fato_refs_vazio:
  {S.refsPresent(Nil{}) == False{} : Bool}

# Lista com uma referência: fato True.
law sc_fato_refs_um:
  {S.refsPresent(["limites.pdf#page=3"]) == True{} : Bool}

# ---------- de que janela é a captura (ticket #35) ----------

# Xournal++ (o padrão) e anexo sem nome de app mantêm a redação de sempre.
law sc_captura_xournal_mantem_a_redacao:
  {S.captureMatchesNote("Xournal++", "14:32", "Lista 3") == M.msg2("studyctx.capture.xournal", "time", "14:32", "exercise", "Lista 3") : String}

law sc_captura_sem_app_e_xournal:
  {S.captureMatchesNote("", "14:32", "Lista 3") == M.msg2("studyctx.capture.xournal", "time", "14:32", "exercise", "Lista 3") : String}

# Outro programa é nomeado: o tutor não recebe "Xournal++" para uma captura do OneNote.
law sc_captura_de_outro_programa_nomeia_o_app:
  {S.captureMatchesNote("OneNote", "14:32", "Lista 3") == M.msg3("studyctx.capture.app", "app", "OneNote", "time", "14:32", "exercise", "Lista 3") : String}

law sc_captura_de_outro_programa_no_bloco:
  {String.contains(
    S.render(S.StudyContext{"", "Lista 3", "", False{}, S.Capture{"14:32", "Lista 3", True{}, "OneNote"}}, Nil{}, True{}),
    M.msg3("studyctx.capture.app", "app", "OneNote", "time", "14:32", "exercise", "Lista 3")
  ) == True{} : Bool}

law sc_captura_de_outro_programa_nao_diz_xournal:
  {String.contains(
    S.render(S.StudyContext{"", "Lista 3", "", False{}, S.Capture{"14:32", "Lista 3", True{}, "OneNote"}}, Nil{}, True{}),
    "studyctx.capture.xournal"
  ) == False{} : Bool}

# Captura de outro exercício com outro programa: o aviso também nomeia o app.
law sc_captura_obsoleta_de_outro_programa:
  {S.captureStaleNote("OneNote", "14:32", "Lista 1") == M.msg3("studyctx.captureStale.app", "app", "OneNote", "time", "14:32", "exercise", "Lista 1") : String}

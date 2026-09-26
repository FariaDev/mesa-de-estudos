import Base
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
  ) == "[Contexto da Mesa]\n- matéria: Cálculo I\n- exercício ativo: Lista 3\n- referências abertas na mesa (abertas, não lidas por você):\n  · limites.pdf#page=3" : String}

# Captura nova vai mesmo com o contexto já mandado.
law sc_captura_nova_reenvia:
  {String.contains(
    S.render(
      S.StudyContext{"Cálculo I", "Lista 3", "", True{}, S.Capture{"14:32", "Lista 3", True{}}},
      ["limites.pdf#page=3"], True{}
    ),
    "captura desta mensagem"
  ) == True{} : Bool}

# ---------- proveniência da referência ----------

# Referência aberta entra declarada como não lida.
law sc_referencia_nao_lida:
  {String.contains(
    S.render(S.StudyContext{"", "", "", True{}, S.NoCapture{}}, ["limites.pdf#page=3"], False{}),
    "não lidas por você"
  ) == True{} : Bool}

# Sem referência aberta, a seção não aparece.
law sc_sem_referencia:
  {S.render(S.StudyContext{"", "", "", False{}, S.NoCapture{}}, Nil{}, False{}) == "" : String}

# ---------- captura ----------

# Captura do exercício ativo: sem aviso.
law sc_captura_do_exercicio:
  {String.contains(
    S.render(S.StudyContext{"", "Lista 3", "", False{}, S.Capture{"14:32", "Lista 3", True{}}}, Nil{}, True{}),
    "atenção"
  ) == False{} : Bool}

# Captura de outro exercício: avisada.
law sc_captura_outro_exercicio:
  {String.contains(
    S.render(S.StudyContext{"", "Lista 3", "", False{}, S.Capture{"14:32", "Lista 1", False{}}}, Nil{}, True{}),
    "não do ativo"
  ) == True{} : Bool}

# ---------- fatos Bool do núcleo ----------

# Com captura presente, o fato responde True independente do resto.
law sc_fato_captura_presente:
  for t: String
  for e: String
  for m: Bool
  {S.capturePresent(S.Capture{t, e, m}) == True{} : Bool}

# Sem captura, responde False.
law sc_fato_captura_ausente:
  {S.capturePresent(S.NoCapture{}) == False{} : Bool}

# Lista vazia de referências: fato False.
law sc_fato_refs_vazio:
  {S.refsPresent(Nil{}) == False{} : Bool}

# Lista com uma referência: fato True.
law sc_fato_refs_um:
  {S.refsPresent(["limites.pdf#page=3"]) == True{} : Bool}

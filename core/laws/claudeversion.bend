import Base
import ../msg.bend as M
import ../updatenotice.bend as U
import ../claudeversion.bend as C

# ---------------------------------------------------------------------------
# Contrato da faixa de versões do Claude Code (#51). Prefixo `cv_`.
#
# O que se garante, com o mínimo 2.1.296 e a testada 2.1.301 da tabela de hoje
# (os números são concretos porque a comparação fecha por computação):
#   1. o mínimo, a testada e o meio são aceitos, sem aviso;
#   2. depois da testada, na mesma série, é aceito com "mais nova que a
#      testada" — nunca recusa;
#   3. abaixo do mínimo recusa, inclusive a série anterior (2.0.x);
#   4. série nova (2.2.0, 3.0.0) recusa, mesmo acima do mínimo;
#   5. versão ilegível recusa;
#   6. a recusa traz a chave, a versão encontrada e a faixa ("2.1.296" a
#      "2.1.x"); a aceita não traz frase;
#   7. o conserto: abaixo do mínimo e ilegível atualizam o Claude Code; série
#      nova manda ao Sobre; outra chave não tem conserto.
#
# O que o enunciado NÃO prova: ler `X.Y.Z` da saída do `--version` (o host
# entrega `Ver`), que a tabela do repositório tem mínimo ≤ testada na mesma
# série (teste do host em `tests/claude-environment.test.mjs`) e a tradução da
# frase (catálogos `desk/locales/*.json`, com teste de paridade).
# ---------------------------------------------------------------------------

def minimo() -> U.Ver:
  U.Ver{2, 1, 296}

def testada() -> U.Ver:
  U.Ver{2, 1, 301}

def v(m: U32, n: U32, p: U32) -> U.Ver:
  U.Ver{m, n, p}

# ---------- aceita ----------

law cv_minimo_aceito:
  {C.fitOf(minimo(), minimo(), testada()) == C.FitTested{} : C.ClaudeFit}

law cv_testada_aceita:
  {C.fitOf(testada(), minimo(), testada()) == C.FitTested{} : C.ClaudeFit}

law cv_meio_da_faixa_aceito:
  {C.fitOf(v(2, 1, 299), minimo(), testada()) == C.FitTested{} : C.ClaudeFit}

law cv_aceita_e_aceita:
  {C.accepted(C.FitTested{}) == True{} : Bool}

law cv_testada_sem_aviso:
  {C.ahead(C.FitTested{}) == False{} : Bool}

# ---------- mais nova que a testada ----------

law cv_patch_depois_da_testada_avisa:
  {C.fitOf(v(2, 1, 302), minimo(), testada()) == C.FitAhead{} : C.ClaudeFit}

law cv_muito_depois_na_serie_avisa:
  {C.fitOf(v(2, 1, 999), minimo(), testada()) == C.FitAhead{} : C.ClaudeFit}

law cv_mais_nova_nunca_bloqueia:
  {C.accepted(C.FitAhead{}) == True{} : Bool}

law cv_mais_nova_e_aviso:
  {C.ahead(C.FitAhead{}) == True{} : Bool}

# ---------- abaixo do mínimo ----------

law cv_um_abaixo_do_minimo_recusa:
  {C.fitOf(v(2, 1, 295), minimo(), testada()) == C.FitBelow{} : C.ClaudeFit}

law cv_pin_antigo_recusa:
  {C.fitOf(v(2, 1, 246), minimo(), testada()) == C.FitBelow{} : C.ClaudeFit}

law cv_serie_anterior_e_abaixo:
  {C.fitOf(v(2, 0, 999), minimo(), testada()) == C.FitBelow{} : C.ClaudeFit}

law cv_abaixo_nao_aceita:
  {C.accepted(C.FitBelow{}) == False{} : Bool}

# ---------- série nova ----------

law cv_serie_nova_recusa:
  {C.fitOf(v(2, 2, 0), minimo(), testada()) == C.FitSeries{} : C.ClaudeFit}

law cv_major_novo_recusa:
  {C.fitOf(v(3, 0, 0), minimo(), testada()) == C.FitSeries{} : C.ClaudeFit}

law cv_serie_nova_nao_aceita:
  {C.accepted(C.FitSeries{}) == False{} : Bool}

# Sem testada legível não há série: nada passa.
law cv_sem_testada_recusa:
  {C.fitOf(testada(), minimo(), U.NoVer{}) == C.FitSeries{} : C.ClaudeFit}

# ---------- ilegível ----------

law cv_ilegivel_recusa:
  {C.fitOf(U.NoVer{}, minimo(), testada()) == C.FitUnreadable{} : C.ClaudeFit}

law cv_ilegivel_nao_aceita:
  {C.accepted(C.FitUnreadable{}) == False{} : Bool}

# ---------- a frase ----------

law cv_texto_da_versao:
  {C.verText(minimo()) == "2.1.296" : String}

law cv_texto_da_serie:
  {C.seriesText(testada()) == "2.1.x" : String}

law cv_frase_abaixo:
  {C.refusal(C.FitBelow{}, "2.1.246", minimo(), testada())
    == M.msg3("claude.version.below", "found", "2.1.246", "minimum", "2.1.296", "series", "2.1.x") : String}

law cv_frase_serie_nova:
  {C.refusal(C.FitSeries{}, "2.2.0", minimo(), testada())
    == M.msg3("claude.version.series", "found", "2.2.0", "minimum", "2.1.296", "series", "2.1.x") : String}

law cv_frase_ilegivel:
  {C.refusal(C.FitUnreadable{}, "?", minimo(), testada())
    == M.msg3("claude.version.unreadable", "found", "?", "minimum", "2.1.296", "series", "2.1.x") : String}

law cv_aceita_sem_frase:
  {C.refusal(C.FitTested{}, "2.1.301", minimo(), testada()) == "" : String}

law cv_mais_nova_sem_frase:
  {C.refusal(C.FitAhead{}, "2.1.400", minimo(), testada()) == "" : String}

# ---------- o conserto ----------

law cv_abaixo_atualiza:
  {C.fixFor("claude.version.below") == "update" : String}

law cv_ilegivel_atualiza:
  {C.fixFor("claude.version.unreadable") == "update" : String}

law cv_serie_nova_vai_ao_sobre:
  {C.fixFor("claude.version.series") == "about" : String}

law cv_outra_chave_sem_conserto:
  {C.fixFor("") == "" : String}

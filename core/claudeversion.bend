import Base
import msg.bend as M
import updatenotice.bend as U

# ---------------------------------------------------------------------------
# Faixa de versões do Claude Code que a Mesa aceita (#51). Módulo só da Mesa.
#
# A Mesa usa sempre o Claude Code que a pessoa instalou e mantém: não há mais
# binário de reserva (#32) nem versão exata (#28). O host entrega TRÊS versões
# já lidas — a encontrada (`claude --version`), o mínimo e a testada, as duas
# últimas de `desk/src/tested-versions.json` — e o núcleo decide:
#
#   - aceita: do mínimo até a testada, na série da testada;
#   - aceita, mais nova que a testada: mesma série, depois da testada (o Sobre
#     avisa, nunca bloqueia);
#   - recusa abaixo do mínimo: o protocolo que os testes cobrem começa ali;
#   - recusa série nova (major.minor diferente da testada, acima do mínimo):
#     é numa série nova que o protocolo do SDK pode mudar de verdade;
#   - recusa versão ilegível.
#
# A série é a `major.minor` da testada: subir a testada para outra série é
# decisão de release (docs/agents/release.md), não deste núcleo.
#
# Na recusa o núcleo devolve a frase (chave do catálogo + argumentos, como em
# `msg.bend`) e o conserto que a coluna do tutor oferece: "update" (Atualizar
# Claude Code), "about" (procurar versão nova da Mesa no Sobre) ou "" (nada).
# Ler o texto da versão é do host; o núcleo recebe `Ver`/`NoVer`.
# ---------------------------------------------------------------------------

type ClaudeFit is Data:
  FitTested{}
  FitAhead{}
  FitBelow{}
  FitSeries{}
  FitUnreadable{}

# ---------- a decisão ----------

def sameSeries(+fm: U32, +fn: U32, tested: U.Ver) -> Bool:
  match tested:
    case U.NoVer{}:
      False{}
    case U.Ver{tm, tn, _}:
      Bool.and(U32.is_eq(fm, tm), U32.is_eq(fn, tn))

def fitOf.ahead(ahead: Bool) -> ClaudeFit:
  match ahead:
    case True{}:
      FitAhead{}
    case False{}:
      FitTested{}

def fitOf.series(same: Bool, ahead: Bool) -> ClaudeFit:
  match same:
    case True{}:
      fitOf.ahead(ahead)
    case False{}:
      FitSeries{}

def fitOf.below(below: Bool, same: Bool, ahead: Bool) -> ClaudeFit:
  match below:
    case True{}:
      FitBelow{}
    case False{}:
      fitOf.series(same, ahead)

# A encontrada contra o mínimo e a testada. Abaixo do mínimo vence a série
# (2.0.x é "anterior", não "outra série").
def fitOf(+found: U.Ver, minimum: U.Ver, +tested: U.Ver) -> ClaudeFit:
  match found:
    case U.NoVer{}:
      FitUnreadable{}
    case U.Ver{+fm, +fn, fp}:
      fitOf.below(
        U.verNewer(minimum, U.Ver{fm, fn, fp}),
        sameSeries(fm, fn, tested),
        U.verNewer(U.Ver{fm, fn, fp}, tested)
      )

def accepted(fit: ClaudeFit) -> Bool:
  match fit:
    case FitTested{}:
      True{}
    case FitAhead{}:
      True{}
    case FitBelow{}:
      False{}
    case FitSeries{}:
      False{}
    case FitUnreadable{}:
      False{}

def ahead(fit: ClaudeFit) -> Bool:
  match fit:
    case FitAhead{}:
      True{}
    case FitTested{}:
      False{}
    case FitBelow{}:
      False{}
    case FitSeries{}:
      False{}
    case FitUnreadable{}:
      False{}

# ---------- texto da faixa ----------

def verText(v: U.Ver) -> String:
  match v:
    case U.NoVer{}:
      "?"
    case U.Ver{m, n, p}:
      U32.show(m) ++ "." ++ U32.show(n) ++ "." ++ U32.show(p)

# A série da testada, como a pessoa lê: "2.1.x".
def seriesText(v: U.Ver) -> String:
  match v:
    case U.NoVer{}:
      "?"
    case U.Ver{m, n, _}:
      U32.show(m) ++ "." ++ U32.show(n) ++ ".x"

# ---------- recusa: frase e conserto ----------

def refusalKey(fit: ClaudeFit) -> String:
  match fit:
    case FitBelow{}:
      "claude.version.below"
    case FitSeries{}:
      "claude.version.series"
    case FitUnreadable{}:
      "claude.version.unreadable"
    case FitTested{}:
      ""
    case FitAhead{}:
      ""

def refusal.when(blank: Bool, key: String, found: String, minimum: String, series: String) -> String:
  match blank:
    case True{}:
      ""
    case False{}:
      M.msg3(key, "found", found, "minimum", minimum, "series", series)

def refusal.pick(+key: String, found: String, minimum: String, series: String) -> String:
  refusal.when(String.is_empty(key), key, found, minimum, series)

# A frase da coluna do tutor (chave + versão encontrada + faixa); vazia quando
# a versão é aceita. `foundText` é o que o host leu, para a ilegível dizer o
# que viu ("?" quando nada).
def refusal(fit: ClaudeFit, foundText: String, minimum: U.Ver, +tested: U.Ver) -> String:
  refusal.pick(refusalKey(fit), foundText, verText(minimum), seriesText(tested))

# O conserto que a coluna oferece para cada chave de recusa: abaixo do mínimo
# ou ilegível, atualizar o Claude Code; série nova, procurar a Mesa nova no
# Sobre (atualizar o Claude Code não traria a série de volta). O host passa a
# chave que leu da mensagem; qualquer outra não tem conserto.
def fixFor.update(update: Bool) -> String:
  match update:
    case True{}:
      "update"
    case False{}:
      ""

def fixFor.series(series: Bool, +key: String) -> String:
  match series:
    case True{}:
      "about"
    case False{}:
      fixFor.update(Bool.or(String.eq(key, "claude.version.below"), String.eq(key, "claude.version.unreadable")))

def fixFor(+key: String) -> String:
  fixFor.series(String.eq(key, "claude.version.series"), key)


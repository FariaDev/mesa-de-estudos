import Base
import msg.bend as M

# ---------------------------------------------------------------------------
# Layout da Mesa: limites, presets e a decisão mínima da área de apoio.
#
# O layout é só VIEW: nada aqui abre documento, troca conversa, mexe no rascunho
# ou no contexto. O host captura os fatos vivos (chat, calculadora, divisor dos
# PDFs, leitores recolhidos e o painel de referências) e aplica o resultado.
#
# Unidades: pixels para chat/calculadora, permilagem (200..800 = 20%..80%) para
# o divisor dos leitores — os limites são os mesmos do `core/state.bend`
# (300..700, 72..900, .2...8), então o que um preset guarda o estado já aceita.
#
# Presets pessoais são um registro global por usuário (`state.layoutPresets`);
# os três embutidos (Leitura/Exercícios/Comparar) são atalhos de view e NÃO
# mexem nos defaults do autor: ninguém os aplica sozinho no boot.
#
# Regra da área de apoio: esconder o Formulário é semântica de PAINEL, não de
# chat lateral. O `auxi` (toggle de apoio) não entra aqui — o host aplica só o
# mínimo: mostrar = `selectTab('form')`; esconder = recolher SE o Formulário
# estiver à frente; com o chat lateral à frente, o Esc do layout não toca em
# nada (nada de trocar a aba do usuário por causa de um preset).
# ---------------------------------------------------------------------------

type LayoutView is Data:
  LayoutView{
    chatWidth: Nat,
    calcHeight: Nat,
    splitPct: Nat,
    chatCollapsed: Bool,
    calculatorCollapsed: Bool,
    referenceVisible: Bool,
    minimized: +List<&2, Bool>
  }

# ---------- limites ----------

def minChat() -> Nat:
  300n

def maxChat() -> Nat:
  700n

def minCalc() -> Nat:
  72n

def maxCalc() -> Nat:
  900n

def minSplit() -> Nat:
  200n

def maxSplit() -> Nat:
  800n

def maxName() -> Nat:
  60n

def maxPresets() -> Nat:
  24n

# ---------- clamp ----------

def clamp.over(value: Nat, hi: Nat, over: Bool) -> Nat:
  match over:
    case True{}:
      hi
    case False{}:
      value

def clamp.below(+value: Nat, lo: Nat, +hi: Nat, under: Bool) -> Nat:
  match under:
    case True{}:
      lo
    case False{}:
      clamp.over(value, hi, Nat.is_gt(value, hi))

def clamp(+value: Nat, +lo: Nat, hi: Nat) -> Nat:
  clamp.below(value, lo, hi, Nat.is_lt(value, lo))

# ---------- nome ----------

def cut.if(text: String, limit: Nat, over: Bool) -> String:
  match over:
    case True{}:
      String.take(text, limit)
    case False{}:
      text

def cut(+text: String, +limit: Nat) -> String:
  cut.if(text, limit, Nat.is_gt(String.length(text), limit))

def name(raw: String) -> String:
  cut(String.trim(raw), maxName())

# ---------- layout ----------

# No máximo dois leitores: o terceiro fato de `minimized` é descartado aqui
# (defesa do núcleo); a política de preset do host REJEITA uma lista maior que 2
# porque um preset torto não deve ser gravado pela metade.
def keepMinimized(xs: List<&2, Bool>) -> List<&2, Bool>:
  List.take(&2, Bool, xs, 2n)

def layout(chatWidth: Nat, calcHeight: Nat, splitPct: Nat, chatCollapsed: Bool, calculatorCollapsed: Bool, referenceVisible: Bool, minimized: List<&2, Bool>) -> LayoutView:
  LayoutView{
    clamp(chatWidth, minChat(), maxChat()),
    clamp(calcHeight, minCalc(), maxCalc()),
    clamp(splitPct, minSplit(), maxSplit()),
    chatCollapsed,
    calculatorCollapsed,
    referenceVisible,
    keepMinimized(minimized)
  }

# ---------- área de apoio (decisão mínima) ----------

def referenceShown(two: Bool, tabIsForm: Bool, open: Bool) -> Bool:
  Bool.and(two, Bool.and(tabIsForm, open))

def refAction.whenShown(visible: Bool) -> String:
  match visible:
    case True{}:
      "none"
    case False{}:
      "hide"

def refAction.whenHidden(visible: Bool) -> String:
  match visible:
    case True{}:
      "show"
    case False{}:
      "none"

def refAction.shown(shown: Bool, visible: Bool) -> String:
  match shown:
    case True{}:
      refAction.whenShown(visible)
    case False{}:
      refAction.whenHidden(visible)

def referenceAction.two(two: Bool, shown: Bool, visible: Bool) -> String:
  match two:
    case False{}:
      "none"
    case True{}:
      refAction.shown(shown, visible)

def referenceAction(+two: Bool, tabIsForm: Bool, open: Bool, visible: Bool) -> String:
  referenceAction.two(two, referenceShown(two, tabIsForm, open), visible)

# ---------- resumo para a lista de presets ----------

def oneIf(on: Bool) -> Nat:
  match on:
    case True{}:
      1n
    case False{}:
      0n

def miniCount.go(xs: List<&2, Bool>, acc: Nat) -> Nat:
  match xs:
    case Nil{}:
      acc
    case Con{h, t}:
      miniCount.go(t, Nat.add(acc, oneIf(h)))

def miniCount(xs: List<&2, Bool>) -> Nat:
  miniCount.go(xs, 0n)

def roundPercent(pct: Nat) -> Nat:
  Nat.div(Nat.add(pct, 5n), 10n)

# Os fatos do layout em texto de máquina (`tutor/calculadora/%pdf/leitores
# recolhidos/tutor recolhido`), para as leis olharem o layout já normalizado. A
# frase que o aluno lê ("Tutor 420 px · …") é do `summaryOf` em
# `src/layout-presets.mjs` (catálogo `layout.summary.*`, #41 fase 3).
def facts(l: LayoutView) -> String:
  match l:
    case LayoutView{chatWidth, calcHeight, splitPct, chatCollapsed, calculatorCollapsed, referenceVisible, minimized}:
      String.append(
        Nat.show(chatWidth),
        String.append("/", String.append(
          Nat.show(calcHeight),
          String.append("/", String.append(
            Nat.show(roundPercent(splitPct)),
            String.append("/", String.append(Nat.show(miniCount(minimized)), String.append("/", Nat.show(oneIf(chatCollapsed)))))
          ))
        ))
      )

# ---------- embutidos ----------

def leituraId() -> String:
  "mesa-leitura"

def exerciciosId() -> String:
  "mesa-exercicios"

def compararId() -> String:
  "mesa-comparar"

def leituraLayout() -> LayoutView:
  LayoutView{420n, 220n, 500n, False{}, False{}, False{}, Con{False{}, Con{False{}, Nil{}}}}

def exerciciosLayout() -> LayoutView:
  LayoutView{360n, 420n, 500n, False{}, False{}, True{}, Con{False{}, Con{False{}, Nil{}}}}

def compararLayout() -> LayoutView:
  LayoutView{330n, 220n, 500n, True{}, False{}, True{}, Con{False{}, Con{False{}, Nil{}}}}

def isExercicios(id: String) -> Bool:
  String.eq(id, exerciciosId())

def isComparar(id: String) -> Bool:
  String.eq(id, compararId())

def isBuiltin(+id: String) -> Bool:
  Bool.or(String.eq(id, leituraId()), Bool.or(isExercicios(id), isComparar(id)))

def builtinName.compare(compare: Bool) -> String:
  match compare:
    case True{}:
      M.msg("layout.builtin.compare")
    case False{}:
      M.msg("layout.builtin.reading")

def builtinName.exec(exec: Bool, compare: Bool) -> String:
  match exec:
    case True{}:
      M.msg("layout.builtin.exercises")
    case False{}:
      builtinName.compare(compare)

def builtinName(+id: String) -> String:
  builtinName.exec(isExercicios(id), isComparar(id))

def builtinLayout.compare(compare: Bool) -> Maybe<&2, LayoutView>:
  match compare:
    case True{}:
      Some{compararLayout()}
    case False{}:
      Some{leituraLayout()}

def builtinLayout.exec(exec: Bool, compare: Bool) -> Maybe<&2, LayoutView>:
  match exec:
    case True{}:
      Some{exerciciosLayout()}
    case False{}:
      builtinLayout.compare(compare)

def builtinLayout(+id: String) -> Maybe<&2, LayoutView>:
  builtinLayout.exec(isExercicios(id), isComparar(id))

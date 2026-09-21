import Base
import view.bend as V

# ---------------------------------------------------------------------------
# View da busca na conversa (⌘F, `.find-bar`) do app Conversa.
#
# O host entrega fatos já resolvidos — o `value` do campo, se há consulta
# (`hasQuery`), a posição do trecho atual (`index`, 0-based) e o total
# (`total`) — e este núcleo devolve a árvore da barra: casca, input, contador
# e os três botões (anterior/próximo/fechar). Nada aqui mede, foca, rola,
# realça ou fala com o DOM: o `TreeWalker`, o `Range`/`CSS.highlights`, a
# dobra com mapa de índices e o relógio do agendamento ficam no host (o
# aplicador é `chat/src/view-host.mjs`).
#
# Convenções (as mesmas de `core/view.bend`):
#   - o texto do campo vive no attr `value`, nunca como filho de texto;
#   - o contador é "N/M" (1-based) com resultado, "0 resultados" com
#     consulta e zero trechos e "0/0" sem consulta; a classe `none` marca o
#     caso "0 resultados" (CSS `.find-count.none`);
#   - anterior/próximo ficam `disabled` quando `total` é zero;
#   - a barra fica `hidden` quando fechada de vez, mas continua visível
#     durante a saída (`closing`, a classe que anima o fade).
# ---------------------------------------------------------------------------

# ---------- textos e fatos do contador ----------

def countEmpty() -> String:
  "0/0"

def countNone() -> String:
  "0 resultados"

def countLabel.zero(hasQuery: Bool) -> String:
  match hasQuery:
    case True{}:
      countNone()
    case False{}:
      countEmpty()

# "3/12" com resultado; com consulta e sem resultado, "0 resultados"; sem
# consulta (mesmo sem resultado), "0/0". O match é no `total` (parâmetro); o
# Bool já resolvido só decide o texto do zero.
def countLabel(hasQuery: Bool, index: Nat, total: Nat) -> String:
  match total:
    case 0n:
      countLabel.zero(hasQuery)
    case 1n+rest:
      Nat.show(Nat.add(index, 1n)) ++ "/" ++ Nat.show(total)

# A classe `none`: consulta digitada e nenhum trecho.
def noResults(hasQuery: Bool, total: Nat) -> Bool:
  match total:
    case 0n:
      hasQuery
    case 1n+rest:
      False{}

# Os botões de navegação: sem trechos não há para onde ir.
def dead(total: Nat) -> Bool:
  match total:
    case 0n:
      True{}
    case 1n+rest:
      False{}

# ---------- nós ----------

def inputNode(value: String) -> V.ViewNode:
  V.viewEl(
    "input",
    [ V.attrType("search")
    , V.attrClass("find-input")
    , V.attr("placeholder", "Buscar na conversa")
    , V.attrAria("label", "Buscar na conversa")
    , V.attr("autocomplete", "off")
    , V.attr("spellcheck", "false")
    , V.attr("value", value)
    , V.attrOn("input", "schedule")
    , V.attrOn("keydown", "key")
    ],
    Nil{}
  )

def countNode(+hasQuery: Bool, index: Nat, +total: Nat) -> V.ViewNode:
  V.viewEl(
    "span",
    [ V.classes([V.classOn("find-count", True{}), V.classOn("none", noResults(hasQuery, total))])
    , V.attrAria("live", "polite")
    , V.attrAria("atomic", "true")
    ],
    [V.viewText(countLabel(hasQuery, index, total))]
  )

def dirButton(+dir: String, title: String, label: String, disabled: Bool) -> V.ViewNode:
  V.viewEl(
    "button",
    V.attrConcat(
      [ V.attrType("button")
      , V.attrClass("find-btn")
      , V.attrData("dir", dir)
      , V.attrOn("click", dir)
      , V.attrTitle(title)
      , V.attrAria("label", label)
      ],
      V.attrWhen(disabled, V.attr("disabled", ""))
    ),
    Nil{}
  )

def prevNode(disabled: Bool) -> V.ViewNode:
  dirButton("prev", "Anterior (Shift+Enter)", "Anterior", disabled)

def nextNode(disabled: Bool) -> V.ViewNode:
  dirButton("next", "Próxima (Enter)", "Próxima", disabled)

def closeNode() -> V.ViewNode:
  V.viewEl(
    "button",
    [ V.attrType("button")
    , V.attrClass("find-btn")
    , V.attrOn("click", "close")
    , V.attrTitle("Fechar (Esc)")
    , V.attrAria("label", "Fechar busca")
    ],
    Nil{}
  )

# ---------- casca ----------

# Visível enquanto aberta ou saindo (a saída anima antes do `hidden`).
def barVisible(open: Bool, closing: Bool) -> Bool:
  Bool.or(open, closing)

def barClass(closing: Bool) -> V.ViewAttr:
  V.classes([V.classOn("find-bar", True{}), V.classOn("closing", closing)])

def barView(open: Bool, +closing: Bool, value: String, hasQuery: Bool, index: Nat, +total: Nat) -> V.ViewNode:
  V.viewEl(
    "div",
    V.attrConcat(
      [ barClass(closing)
      , V.attr("role", "search")
      , V.attrAria("label", "Buscar na conversa")
      ],
      V.attrWhen(Bool.not(barVisible(open, closing)), V.attr("hidden", ""))
    ),
    [inputNode(value), countNode(hasQuery, index, total), prevNode(dead(total)), nextNode(dead(total)), closeNode()]
  )

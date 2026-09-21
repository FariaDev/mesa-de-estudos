import Base
import view.bend as V

# View pura da paleta de comandos da Conversa. O host resolve ranking, dobra e
# segmentação; o núcleo escolhe a árvore, classes, ARIA e estados. Os nomes dos
# ícones ficam como texto dentro dos slots e o host os materializa com o SVG já
# existente (`icons.mjs`) antes de entregar a árvore ao aplicador de DOM.

type PaletteSegment is Data:
  PaletteSegment{text: String, matched: Bool}

type PaletteItem is Data:
  PaletteItem{id: String, icon: String, segments: +List<PaletteSegment>, kbd: String, check: Bool, when: String}

type PaletteSection is Data:
  PaletteSection{title: String, items: +List<PaletteItem>}

def segmentView(s: PaletteSegment) -> V.ViewNode:
  match s:
    case PaletteSegment{text, matched}:
      match matched:
        case True{}:
          V.viewEl("mark", Nil{}, [V.viewText(text)])
        case False{}:
          V.viewText(text)

def segmentViews(xs: List<&2, PaletteSegment>) -> List<&2, V.ViewNode>:
  V.viewMap(~PaletteSegment, ~segmentView, xs)

def iconSlot(name: String) -> V.ViewNode:
  V.viewEl("span", [V.attrClass("palette-item-icon")], [V.viewText(name)])

def labelNode(segments: List<&2, PaletteSegment>) -> V.ViewNode:
  V.viewEl("span", [V.attrClass("label")], segmentViews(segments))

def kbdNode(text: String) -> V.ViewNode:
  V.viewEl("kbd", Nil{}, [V.viewText(text)])

def checkNode() -> V.ViewNode:
  V.viewEl("span", [V.attrClass("palette-check")], [V.viewText("check")])

def whenNode(text: String) -> V.ViewNode:
  V.viewEl("span", [V.attrClass("palette-when")], [V.viewText(text)])

def trailingNode(+kbd: String, check: Bool) -> List<&2, V.ViewNode>:
  match check:
    case True{}:
      [checkNode()]
    case False{}:
      V.viewWhen(Bool.not(String.is_empty(kbd)), kbdNode(kbd))

def itemNode(i: PaletteItem, +activeId: String) -> V.ViewNode:
  match i:
    case PaletteItem{+id, icon, segments, kbd, check, +when}:
      +active = String.eq(id, activeId)
      V.viewEl(
        "div",
        [ V.classes([V.classOn("palette-item", True{}), V.classOn("active", active)])
        , V.attrId(id)
        , V.attr("role", "option")
        , V.attrAria("selected", V.boolStr(active))
        , V.attrOn("mousedown", "hold")
        , V.attrOn("click", "pick")
        ],
        V.viewConcat(
          [iconSlot(icon), labelNode(segments)],
          V.viewConcat(trailingNode(kbd, check), V.viewWhen(Bool.not(String.is_empty(when)), whenNode(when)))
        )
      )

def itemNodes.go(xs: List<&2, PaletteItem>, +activeId: String) -> List<&2, V.ViewNode>:
  match xs:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      Con{itemNode(h, activeId), itemNodes.go(t, activeId)}

def itemNodes(xs: List<&2, PaletteItem>, activeId: String) -> List<&2, V.ViewNode>:
  itemNodes.go(xs, activeId)

def sectionNode(title: String) -> V.ViewNode:
  V.viewEl("div", [V.attrClass("palette-section"), V.attr("role", "presentation")], [V.viewText(title)])

def sectionSpan(s: PaletteSection, activeId: String) -> List<&2, V.ViewNode>:
  match s:
    case PaletteSection{title, items}:
      match items:
        case Nil{}:
          Nil{}
        case Con{h, t}:
          Con{sectionNode(title), itemNodes(Con{h, t}, activeId)}

def sectionViews.go(xs: List<&2, PaletteSection>, +activeId: String) -> List<&2, V.ViewNode>:
  match xs:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      List.append(&2, V.ViewNode, sectionSpan(h, activeId), sectionViews.go(t, activeId))

def sectionViews(xs: List<&2, PaletteSection>, activeId: String) -> List<&2, V.ViewNode>:
  sectionViews.go(xs, activeId)

def itemCount(xs: List<&2, PaletteSection>) -> Nat:
  match xs:
    case Nil{}:
      0n
    case Con{h, t}:
      match h:
        case PaletteSection{title, items}:
          Nat.add(List.length(&2, PaletteItem, items), itemCount(t))

def emptyNode() -> V.ViewNode:
  V.viewEl("div", [V.attrClass("palette-empty")], [V.viewText("Nada encontrado.")])

def listKids.empty(rows: List<&2, V.ViewNode>, empty: Bool) -> List<&2, V.ViewNode>:
  match empty:
    case True{}:
      [emptyNode()]
    case False{}:
      rows

def listKids(+sections: List<&2, PaletteSection>, activeId: String) -> List<&2, V.ViewNode>:
  listKids.empty(sectionViews(sections, activeId), Nat.is_eq(itemCount(sections), 0n))

def hintNode() -> V.ViewNode:
  V.viewEl("div", [V.attrClass("palette-hint")], [V.viewText("↑↓ navegar · ⏎ abrir · Esc fechar")])

def inputNode(+activeId: String, query: String) -> V.ViewNode:
  V.viewEl(
    "input",
    V.attrConcat(
      [ V.attrType("text")
      , V.attrClass("palette-input")
      , V.attr("placeholder", "Buscar ou executar um comando…")
      , V.attrAria("label", "Buscar ou executar um comando")
      , V.attr("role", "combobox")
      , V.attrAria("expanded", "true")
      , V.attrAria("autocomplete", "list")
      , V.attrAria("controls", "palette-list")
      , V.attr("autocomplete", "off")
      , V.attr("spellcheck", "false")
      , V.attr("value", query)
      , V.attrOn("input", "filter")
      , V.attrOn("keydown", "key")
      ],
      V.attrWhen(Bool.not(String.is_empty(activeId)), V.attrAria("activedescendant", activeId))
    ),
    Nil{}
  )

def listNode(sections: List<&2, PaletteSection>, activeId: String) -> V.ViewNode:
  V.viewEl(
    "div",
    [ V.attrClass("palette-list")
    , V.attrId("palette-list")
    , V.attr("role", "listbox")
    , V.attrAria("label", "Comandos e conversas")
    ],
    listKids(sections, activeId)
  )

def paletteView(sections: List<&2, PaletteSection>, +activeId: String, query: String, tokens: List<&2, String>) -> V.ViewNode:
  V.viewEl(
    "div",
    [V.attrClass("palette-backdrop"), V.attr("hidden", ""), V.attrOn("mousedown", "dim")],
    [ V.viewEl(
        "div",
        [V.attrClass("palette"), V.attr("role", "dialog"), V.attrAria("modal", "true"), V.attrAria("label", "Paleta de comandos")],
        [inputNode(activeId, query), listNode(sections, activeId), hintNode()]
      )
    ]
  )

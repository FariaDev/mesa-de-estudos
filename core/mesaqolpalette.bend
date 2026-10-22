import Base
import view.bend as V
import msg.bend as M

# ---------------------------------------------------------------------------
# Paleta de ações da Mesa (⌘K). Núcleo puro, exclusivo deste app.
#
# Duas partes:
#   1. casamento/ranque — o texto chega JÁ DOBRADO (minúsculas e sem acento,
#      trabalho Unicode do host) e a consulta vira uma lista de palavras. Toda
#      palavra precisa aparecer (substring) e o Ranque é 0 quando alguma delas
#      começa o texto, 1 quando casa no meio e 2 quando não casa. Consulta
#      vazia (nenhuma palavra) casa tudo no Ranque 1.
#   2. árvore da paleta — o host resolve as ações, os ícones e a segmentação
#      `<mark>`; aqui saem as classes, ARIA, `disabled` (com o motivo) e a
#      ordem das seções. Sem DOM, sem medida, sem foco.
#
# As ações da Mesa são as existentes (abrir PDF, Conferir, busca, caderno,
# anotações, configurações, chat e layouts); nada destrutivo e nada automático
# mora aqui.
# ---------------------------------------------------------------------------

# ---------- casamento ----------

def starts.go(+hay: String, tokens: List<&2, String>, found: Bool) -> Bool:
  match tokens:
    case Nil{}:
      found
    case Con{h, t}:
      starts.go(hay, t, Bool.or(found, String.starts_with(hay, h)))

def starts(hay: String, tokens: List<&2, String>) -> Bool:
  starts.go(hay, tokens, False{})

def hit.go(+hay: String, tokens: List<&2, String>, ok: Bool) -> Bool:
  match tokens:
    case Nil{}:
      ok
    case Con{h, t}:
      hit.go(hay, t, Bool.and(ok, String.contains(hay, h)))

def hit(hay: String, tokens: List<&2, String>) -> Bool:
  hit.go(hay, tokens, True{})

def score.starts(startsNow: Bool) -> Nat:
  match startsNow:
    case True{}:
      0n
    case False{}:
      1n

def score.matched(hay: String, tokens: List<&2, String>, matched: Bool) -> Nat:
  match matched:
    case False{}:
      2n
    case True{}:
      score.starts(starts(hay, tokens))

def score(+hay: String, +tokens: List<&2, String>) -> Nat:
  score.matched(hay, tokens, hit(hay, tokens))

# ---------- fatos da árvore ----------

type PaletteSegment is Data:
  PaletteSegment{text: String, matched: Bool}

type PaletteItem is Data:
  PaletteItem{
    id: String,
    icon: String,
    segments: +List<&2, PaletteSegment>,
    kbd: String,
    check: Bool,
    when: String,
    disabled: Bool
  }

type PaletteSection is Data:
  PaletteSection{title: String, items: +List<&2, PaletteItem>}

# ---------- folhas ----------

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

def whenNode.text(text: String) -> V.ViewNode:
  V.viewEl("span", [V.attrClass("palette-when")], [V.viewText(text)])

def trailingNode(+kbd: String, check: Bool) -> List<&2, V.ViewNode>:
  match check:
    case True{}:
      [checkNode()]
    case False{}:
      V.viewWhen(Bool.not(String.is_empty(kbd)), kbdNode(kbd))

# ---------- item ----------

def mouseAttrs(disabled: Bool) -> List<&2, V.ViewAttr>:
  V.attrWhen(Bool.not(disabled), V.attrOn("mousedown", "hold"))

def clickAttrs(disabled: Bool) -> List<&2, V.ViewAttr>:
  V.attrWhen(Bool.not(disabled), V.attrOn("click", "pick"))

def itemAttrs(id: String, +active: Bool, +disabled: Bool, reason: String) -> List<&2, V.ViewAttr>:
  V.attrJoin([
    [ V.classes([
        V.classOn("palette-item", True{}),
        V.classOn("active", active),
        V.classOn("disabled", disabled)
      ])
    , V.attrId(id)
    , V.attr("role", "option")
    , V.attrAria("selected", V.boolStr(active))
    ]
  , V.attrWhen(disabled, V.attrAria("disabled", "true"))
  , V.attrWhen(disabled, V.attr("disabled", ""))
  , V.attrWhen(disabled, V.attrTitle(reason))
  , mouseAttrs(disabled)
  , clickAttrs(disabled)
  ])

def itemNode(i: PaletteItem, +activeId: String) -> V.ViewNode:
  match i:
    case PaletteItem{+id, icon, segments, kbd, check, +when, +disabled}:
      +active = String.eq(id, activeId)
      V.viewEl(
        "div",
        itemAttrs(id, active, disabled, when),
        V.viewConcat(
          [iconSlot(icon), labelNode(segments)],
          V.viewConcat(
            trailingNode(kbd, check),
            V.viewWhen(Bool.not(String.is_empty(when)), whenNode.text(when))
          )
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

# ---------- seção ----------

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
  V.viewEl("div", [V.attrClass("palette-empty")], [V.viewText(M.msg("palette.empty"))])

def listKids.empty(rows: List<&2, V.ViewNode>, empty: Bool) -> List<&2, V.ViewNode>:
  match empty:
    case True{}:
      [emptyNode()]
    case False{}:
      rows

def listKids(+sections: List<&2, PaletteSection>, activeId: String) -> List<&2, V.ViewNode>:
  listKids.empty(sectionViews(sections, activeId), Nat.is_eq(itemCount(sections), 0n))

# ---------- casca ----------

def hintNode() -> V.ViewNode:
  V.viewEl("div", [V.attrClass("palette-hint")], [V.viewText(M.msg("palette.hint"))])

def inputNode(+activeId: String, query: String) -> V.ViewNode:
  V.viewEl(
    "input",
    V.attrConcat(
      [ V.attrType("text")
      , V.attrClass("palette-input")
      , V.attr("placeholder", M.msg("palette.input.placeholder"))
      , V.attrAria("label", M.msg("palette.input.aria"))
      , V.attr("role", "combobox")
      , V.attrAria("expanded", "true")
      , V.attrAria("autocomplete", "list")
      , V.attrAria("controls", "command-palette-list")
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
    , V.attrId("command-palette-list")
    , V.attr("role", "listbox")
    , V.attrAria("label", M.msg("palette.list.aria"))
    ],
    listKids(sections, activeId)
  )

def paletteView(sections: List<&2, PaletteSection>, +activeId: String, query: String) -> V.ViewNode:
  V.viewEl(
    "div",
    [ V.attrId("command-palette")
    , V.attrClass("palette-backdrop")
    , V.attr("hidden", "")
    , V.attrOn("mousedown", "dim")
    ],
    [ V.viewEl(
        "div",
        [V.attrClass("palette"), V.attr("role", "dialog"), V.attrAria("modal", "true"), V.attrAria("label", M.msg("palette.dialog.aria"))],
        [inputNode(activeId, query), listNode(sections, activeId), hintNode()]
      )
    ]
  )

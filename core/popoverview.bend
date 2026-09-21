import Base
import view.bend as V

# ---------------------------------------------------------------------------
# Casca dos popovers do composer da Conversa (`chat/`) — R6/R11.
#
# Três consumidores:
#   1. seletor de modelo  — `#model-chip` + `#model-picker` (listbox `.mp-*`);
#   2. menu de esforço    — `#effort-chip` + `#effort-menu` (menu `.effort-*`);
#   3. histórico do prompt — sem DOM; só a máquina ↑/↓ que decide índice/texto.
#
# O host entrega fatos já resolvidos — aberto, item ativo, opções rotuladas
# (label/hint/desc), atual, fixado, vazio, dicas — e este núcleo devolve a
# árvore: nós, attrs, classes, ARIA e `on:<evento>`. Medida, posicionamento,
# foco, scroll, localStorage, relógio e IPC ficam no host
# (`chat/src/features/*.mjs`), que aplica a árvore com `chat/src/view-host.mjs`.
#
# Ícones: o núcleo só marca o slot (classe + nome do ícone). O host troca o
# slot pelo SVG de `icons.mjs` antes de aplicar — `.icon-slot` vira o próprio
# SVG (filho direto do chip e da estrela); os slots com moldura
# (`.mp-search-icon`, `.mp-check` e `.effort-check`) recebem o SVG por dentro.
#
# Convenções (as mesmas do DOM/`style.css` atuais):
#   `key` → `dataset.key` (linha do seletor de modelo);
#   `data-value` → valor do item de esforço;
#   `aria-expanded`/`aria-checked`/`aria-selected`/`aria-pressed` como Bool;
#   `on:click`/`on:mouseenter`/`on:input`/`on:keydown` → handlers do host.
# ---------------------------------------------------------------------------

# ---------- fatos ----------

# Opção de listbox: `label` (nome) e `hint` (provider) já vêm rotulados;
# `current` é o modelo em uso (`.current` + `aria-selected`), `active` é o
# realce do teclado e `pinned` a estrela (`aria-pressed`).
type PopOption is Data:
  PopOption{
    key: String,
    label: String,
    hint: String,
    current: Bool,
    active: Bool,
    pinned: Bool
  }

# Grupo do listbox: "Fixados", "Recentes" ou o provider, na ordem do host.
type PopGroup is Data:
  PopGroup{title: String, options: +List<PopOption>}

# Item do menu de esforço: `desc` vazio esconde a descrição; `checked` é o
# nível em uso (`aria-checked` + check) e `active` o realce do teclado/foco.
type EffortItem is Data:
  EffortItem{value: String, label: String, desc: String, checked: Bool, active: Bool}

# Passo do histórico do prompt: `at` é o índice (None = fora do histórico),
# `text` o que entra no campo e `store` o "guardar o rascunho antes de entrar".
type HistoryStep is Data:
  HistoryStep{at: Maybe<&2, Nat>, text: String, store: Bool}

# ---------- cópia (strings PT-BR do DOM atual) ----------

def modelEmptyText() -> String:
  "Nenhum modelo encontrado."

def modelFootText() -> String:
  "↑↓ navegar · ⏎ escolher · Esc fechar"

def effortHeadText() -> String:
  "Esforço de raciocínio"

def modelChipAria(full: String) -> String:
  String.append("Modelo: ", full)

def effortChipAria.given(label: String, empty: Bool) -> String:
  match empty:
    case True{}:
      "Esforço"
    case False{}:
      String.append("Esforço: ", label)

def effortChipAria(+label: String) -> String:
  effortChipAria.given(label, String.is_empty(label))

# ---------- casca reutilizável ----------

# Slot de ícone com moldura (o host injeta o SVG por dentro): `.mp-search-icon`,
# `.mp-check` e `.effort-check`.
def iconSlot(className: String, ariaHidden: Bool, name: String) -> V.ViewNode:
  V.viewEl(
    "span",
    V.attrConcat(
      [V.attrClass(className)],
      V.attrWhen(ariaHidden, V.attrAria("hidden", "true"))
    ),
    [V.viewText(name)]
  )

# Slot de ícone cru: o host troca o nó inteiro pelo SVG (filho direto do
# `button`), como o `chevronDown` dos chips e a estrela das linhas.
def iconNode(name: String) -> V.ViewNode:
  V.viewEl("span", [V.attrClass("icon-slot")], [V.viewText(name)])

def chevronNode() -> V.ViewNode:
  iconNode("chevronDown")

# Tecla avulsa (`<kbd>`), para dicas que precisem do desenho de tecla.
def kbdNode(text: String) -> V.ViewNode:
  V.viewEl("kbd", Nil{}, [V.viewText(text)])

# Título de seção/grupo (`role=presentation`): `.mp-section` e `.effort-head`.
def groupHead(className: String, title: String) -> V.ViewNode:
  V.viewEl(
    "div",
    [V.attrClass(className), V.attr("role", "presentation")],
    [V.viewText(title)]
  )

# Rodapé de dicas (`.mp-foot`) e estado vazio (`.mp-empty`).
def hintNode(className: String, text: String) -> V.ViewNode:
  V.viewEl("div", [V.attrClass(className)], [V.viewText(text)])

def emptyNode(className: String, text: String) -> V.ViewNode:
  V.viewEl("div", [V.attrClass(className)], [V.viewText(text)])

# Camada de fundo (usada por popovers que escurecem a tela; os três do
# composer são ancorados e não têm backdrop).
def backdropNode(className: String, dim: String, panel: V.ViewNode) -> V.ViewNode:
  V.viewEl(
    "div",
    [V.attrClass(className), V.attr("hidden", ""), V.attrOn("mousedown", dim)],
    [panel]
  )

# Painel do popover: id/classe + `hidden` do fato `open` (o host também liga e
# desliga o `hidden` direto no nó montado; aqui vale como estado inicial).
def panelAttrs(id: String, className: String, hidden: Bool) -> List<&2, V.ViewAttr>:
  V.attrConcat(
    [V.attrId(id), V.attrClass(className)],
    V.attrWhen(hidden, V.attr("hidden", ""))
  )

def panelNode(
  id: String,
  className: String,
  attrs: List<&2, V.ViewAttr>,
  hidden: Bool,
  kids: List<&2, V.ViewNode>
) -> V.ViewNode:
  V.viewEl("div", V.attrConcat(panelAttrs(id, className, hidden), attrs), kids)

# Chip de label (`#model-chip`/`#effort-chip`): `name` já rotulado, `title` e
# `ariaLabel` completos e `controls` vazio quando não há listbox controlado.
def chipView(
  id: String,
  nameClass: String,
  name: String,
  haspopup: String,
  +controls: String,
  title: String,
  ariaLabel: String,
  +keyHandler: String,
  expanded: Bool,
  disabled: Bool
) -> V.ViewNode:
  V.viewEl(
    "button",
    V.attrJoin(
      [
        [
          V.attrType("button"),
          V.attrId(id),
          V.attrClass("chip"),
          V.attr("aria-haspopup", haspopup),
          V.attrBool("aria-expanded", expanded),
          V.attrTitle(title),
          V.attrAria("label", ariaLabel),
          V.attrOn("click", "toggle")
        ],
        V.attrWhen(Bool.not(String.is_empty(controls)), V.attrAria("controls", controls)),
        V.attrWhen(Bool.not(String.is_empty(keyHandler)), V.attrOn("keydown", keyHandler)),
        V.attrWhen(disabled, V.attr("disabled", ""))
      ]
    ),
    [
      V.viewEl("span", [V.attrClass(nameClass)], [V.viewText(name)]),
      chevronNode()
    ]
  )

# ---------- índice (realce do teclado) ----------

# Próximo índice com volta: `at=None` entra na primeira ponta (0/último) e
# `at=Some{i}` anda uma casa. Usado pelo seletor de modelo e pelo menu.
def stepIndex.fresh(count: Nat, forward: Bool) -> Nat:
  match forward:
    case True{}:
      0n
    case False{}:
      Nat.sub(count, 1n)

def stepIndex.some(+count: Nat, i: Nat, forward: Bool) -> Nat:
  match forward:
    case True{}:
      Nat.mod(Nat.add(i, 1n), count)
    case False{}:
      Nat.mod(Nat.add(i, Nat.sub(count, 1n)), count)

def stepIndex(count: Nat, at: Maybe<&2, Nat>, forward: Bool) -> Nat:
  match at:
    case None{}:
      stepIndex.fresh(count, forward)
    case Some{i}:
      stepIndex.some(count, i, forward)

# ---------- histórico do prompt (↑/↓) ----------

def historyAt.go(xs: List<&2, String>, i: Nat) -> String:
  match xs i:
    case Nil{} _:
      ""
    case Con{h, t} 0n:
      h
    case Con{h, t} 1n+p:
      historyAt.go(t, p)

def historyAt(xs: List<&2, String>, i: Nat) -> String:
  historyAt.go(xs, i)

# ↑: fora do histórico só entra com o campo vazio (senão a digitação manda);
# ao entrar, `store` guarda o rascunho. O índice para no mais antigo.
def historyUp.some(history: List<&2, String>, i: Nat, +len: Nat) -> Maybe<&2, HistoryStep>:
  +j = Nat.min(Nat.add(i, 1n), Nat.sub(len, 1n))
  Some{HistoryStep{Some{j}, historyAt(history, j), False{}}}

def historyUp.blank(history: List<&2, String>, blank: Bool) -> Maybe<&2, HistoryStep>:
  match blank:
    case False{}:
      None{}
    case True{}:
      Some{HistoryStep{Some{0n}, historyAt(history, 0n), True{}}}

def historyUp.at(history: List<&2, String>, at: Maybe<&2, Nat>, text: String, +len: Nat) -> Maybe<&2, HistoryStep>:
  match at:
    case None{}:
      historyUp.blank(history, String.is_empty(String.trim(text)))
    case Some{i}:
      historyUp.some(history, i, len)

def historyUp.given(history: List<&2, String>, at: Maybe<&2, Nat>, text: String, empty: Bool, len: Nat) -> Maybe<&2, HistoryStep>:
  match empty:
    case True{}:
      None{}
    case False{}:
      historyUp.at(history, at, text, len)

def historyUp(+history: List<&2, String>, at: Maybe<&2, Nat>, text: String) -> Maybe<&2, HistoryStep>:
  historyUp.given(
    history,
    at,
    text,
    List.is_empty(&2, String, history),
    List.length(&2, String, history)
  )

# ↓: sai do mais antigo para o rascunho guardado; fora do histórico não anda.
def historyDown.step(history: List<&2, String>, i: Nat, draft: String, first: Bool) -> Maybe<&2, HistoryStep>:
  match first:
    case True{}:
      Some{HistoryStep{None{}, draft, False{}}}
    case False{}:
      +j = Nat.sub(i, 1n)
      Some{HistoryStep{Some{j}, historyAt(history, j), False{}}}

def historyDown(history: List<&2, String>, at: Maybe<&2, Nat>, draft: String) -> Maybe<&2, HistoryStep>:
  match at:
    case None{}:
      None{}
    case Some{+i}:
      historyDown.step(history, i, draft, Nat.is_eq(i, 0n))

# Decisão completa do ↑/↓: `forward` é o ↑; `text` o valor do campo e `draft` o
# rascunho guardado. Nada aqui lê o DOM: o host aplica o `text` e o índice.
def historyStep(forward: Bool, at: Maybe<&2, Nat>, history: List<&2, String>, text: String, draft: String) -> Maybe<&2, HistoryStep>:
  match forward:
    case True{}:
      historyUp(history, at, text)
    case False{}:
      historyDown(history, at, draft)

# ---------- seletor de modelo ----------

def starLabel(name: String, pinned: Bool) -> String:
  match pinned:
    case True{}:
      String.append("Desafixar ", name)
    case False{}:
      String.append("Fixar ", name)

def modelRowId(i: Nat) -> String:
  String.append("mp-opt-", Nat.show(i))

def modelCheckNode() -> V.ViewNode:
  iconSlot("mp-check", True{}, "check")

def modelStarNode(+star: String, pinned: Bool) -> V.ViewNode:
  V.viewEl(
    "button",
    [
      V.attrType("button"),
      V.attrClass("mp-star"),
      V.attrAria("pressed", V.boolStr(pinned)),
      V.attrAria("label", star),
      V.attrTitle(star),
      V.attrOn("click", "star")
    ],
    [iconNode("star")]
  )

def modelRowAt(i: Nat, o: PopOption) -> V.ViewNode:
  match o:
    case PopOption{key, +label, hint, +current, active, +pinned}:
      +star = starLabel(label, pinned)
      V.viewEl(
        "div",
        [
          V.classes(
            [
              V.classOn("mp-row", True{}),
              V.classOn("current", current),
              V.classOn("active", active)
            ]
          ),
          V.attr("role", "option"),
          V.attrKey(key),
          V.attrId(modelRowId(i)),
          V.attrAria("selected", V.boolStr(current)),
          V.attrOn("click", "pick"),
          V.attrOn("mouseenter", "hover")
        ],
        [
          V.viewEl("span", [V.attrClass("mp-name")], [V.viewText(label)]),
          V.viewEl("span", [V.attrClass("mp-provider")], [V.viewText(hint)]),
          modelCheckNode(),
          modelStarNode(star, pinned)
        ]
      )

def modelOptionNodes(options: List<&2, PopOption>, start: Nat) -> List<&2, V.ViewNode>:
  V.viewMapI.go(~PopOption, ~modelRowAt, options, start)

def modelGroupNode(+title: String, kids: List<&2, V.ViewNode>) -> V.ViewNode:
  V.viewEl(
    "div",
    [V.attrClass("mp-group"), V.attr("role", "group"), V.attrAria("label", title)],
    V.viewConcat([groupHead("mp-section", title)], kids)
  )

def modelOptionCount(xs: List<&2, PopGroup>) -> Nat:
  match xs:
    case Nil{}:
      0n
    case Con{h, t}:
      match h:
        case PopGroup{title, options}:
          Nat.add(List.length(&2, PopOption, options), modelOptionCount(t))

# Índice 0-based da primeira opção de cada grupo: a numeração dos ids
# (`mp-opt-N`) atravessa os grupos na ordem da tela.
def modelStarts.go(xs: List<&2, PopGroup>, +i: Nat) -> List<&2, Nat>:
  match xs:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      match h:
        case PopGroup{title, options}:
          Con{i, modelStarts.go(t, Nat.add(i, List.length(&2, PopOption, options)))}

def modelStarts(xs: List<&2, PopGroup>) -> List<&2, Nat>:
  modelStarts.go(xs, 0n)

def modelGroupAt(g: PopGroup, start: Nat) -> V.ViewNode:
  match g:
    case PopGroup{title, options}:
      modelGroupNode(title, modelOptionNodes(options, start))

def modelRows.go(groups: List<&2, PopGroup>, starts: List<&2, Nat>) -> List<&2, V.ViewNode>:
  match groups starts:
    case Nil{} _:
      Nil{}
    case Con{h, t} Con{s, ss}:
      Con{modelGroupAt(h, s), modelRows.go(t, ss)}
    case Con{_, _} _:
      Nil{}

def modelListKids.empty(rows: List<&2, V.ViewNode>, empty: Bool) -> List<&2, V.ViewNode>:
  match empty:
    case True{}:
      [emptyNode("mp-empty", modelEmptyText())]
    case False{}:
      rows

def modelListKids.given(+groups: List<&2, PopGroup>, empty: Bool) -> List<&2, V.ViewNode>:
  modelListKids.empty(modelRows.go(groups, modelStarts(groups)), empty)

def modelListKids(+groups: List<&2, PopGroup>) -> List<&2, V.ViewNode>:
  modelListKids.given(groups, Nat.is_eq(modelOptionCount(groups), 0n))

def modelSearchInput() -> V.ViewNode:
  V.viewEl(
    "input",
    [
      V.attrId("model-picker-search"),
      V.attrClass("mp-search"),
      V.attrType("search"),
      V.attr("placeholder", "Buscar modelo"),
      V.attrAria("label", "Buscar modelo"),
      V.attr("role", "combobox"),
      V.attrAria("autocomplete", "list"),
      V.attrBool("aria-expanded", True{}),
      V.attrAria("controls", "model-picker-list"),
      V.attr("autocomplete", "off"),
      V.attr("spellcheck", "false"),
      V.attrOn("input", "filter")
    ],
    Nil{}
  )

def modelSearchRow() -> V.ViewNode:
  V.viewEl(
    "div",
    [V.attrClass("mp-search-row")],
    [iconSlot("mp-search-icon", True{}, "search"), modelSearchInput()]
  )

def modelListNode() -> V.ViewNode:
  V.viewEl(
    "div",
    [
      V.attrId("model-picker-list"),
      V.attrClass("mp-list"),
      V.attr("role", "listbox"),
      V.attrAria("label", "Modelos")
    ],
    Nil{}
  )

# Casca montada uma vez pelo host: a lista nasce vazia e só os filhos dela
# trocam a cada busca/realce (o input e o foco nunca são recriados).
def modelPopView() -> V.ViewNode:
  panelNode(
    "model-picker",
    "mp-pop",
    [V.attrOn("keydown", "key")],
    True{},
    [modelSearchRow(), modelListNode(), hintNode("mp-foot", modelFootText())]
  )

def modelChipView(name: String, +title: String, expanded: Bool, disabled: Bool) -> V.ViewNode:
  chipView(
    "model-chip",
    "mp-chip-name",
    name,
    "listbox",
    "model-picker-list",
    title,
    modelChipAria(title),
    "",
    expanded,
    disabled
  )

# ---------- menu de esforço ----------

def effortTextKids(label: String, +desc: String) -> List<&2, V.ViewNode>:
  V.viewConcat(
    [V.viewEl("span", [V.attrClass("effort-label")], [V.viewText(label)])],
    V.viewWhen(
      Bool.not(String.is_empty(desc)),
      V.viewEl("span", [V.attrClass("effort-desc")], [V.viewText(desc)])
    )
  )

def effortItemNode(x: EffortItem) -> V.ViewNode:
  match x:
    case EffortItem{value, label, +desc, +checked, active}:
      V.viewEl(
        "button",
        [
          V.attrType("button"),
          V.classes([V.classOn("effort-item", True{}), V.classOn("active", active)]),
          V.attr("role", "menuitemradio"),
          V.attrBool("aria-checked", checked),
          V.attrData("value", value),
          V.attrOn("click", "pick"),
          V.attrOn("mouseenter", "hover")
        ],
        V.viewConcat(
          [V.viewEl("span", [V.attrClass("effort-text")], effortTextKids(label, desc))],
          V.viewWhen(checked, iconSlot("effort-check", False{}, "check"))
        )
      )

def effortMenuKids(items: List<&2, EffortItem>) -> List<&2, V.ViewNode>:
  V.viewConcat(
    [groupHead("effort-head", effortHeadText())],
    V.viewMap(~EffortItem, ~effortItemNode, items)
  )

def effortMenuView() -> V.ViewNode:
  panelNode(
    "effort-menu",
    "effort-menu",
    [
      V.attr("role", "menu"),
      V.attrAria("label", effortHeadText()),
      V.attr("contenteditable", "false"),
      V.attr("style", "position:fixed;z-index:50"),
      V.attrOn("keydown", "key")
    ],
    True{},
    Nil{}
  )

def effortChipView(+name: String, title: String, expanded: Bool, disabled: Bool) -> V.ViewNode:
  chipView(
    "effort-chip",
    "effort-name",
    name,
    "menu",
    "",
    title,
    effortChipAria(name),
    "key",
    expanded,
    disabled
  )

# ---------- amostras das leis ----------

def sampleOption(+key: String, current: Bool, active: Bool, pinned: Bool) -> PopOption:
  PopOption{key, String.append("Modelo ", key), "provedor", current, active, pinned}

def sampleGroup() -> PopGroup:
  PopGroup{
    "Fixados",
    Con{sampleOption("a/1", True{}, True{}, True{}), Nil{}}
  }

def sampleEffort() -> EffortItem:
  EffortItem{"low", "Baixo", "Raciocínio curto.", True{}, False{}}

def noMaybe() -> Maybe<&2, Nat>:
  None{}

def someAt(i: Nat) -> Maybe<&2, Nat>:
  Some{i}

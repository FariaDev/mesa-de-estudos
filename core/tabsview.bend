import Base
import view.bend as V

# ---------------------------------------------------------------------------
# View das abas de matéria e dos menus da Mesa (header).
#
# O host entrega fatos já resolvidos e este núcleo devolve a árvore de nós que
# o aplicador (`desk/src/view-host.mjs`) monta no DOM. Nada aqui lê o DOM,
# mede, foca ou fala com o Electron:
#   - matérias: id e rótulo (saída de `core/courses.bend`, já resolvida pelo
#     host), id da matéria ativa, se a aba GeoGebra está ligada e se os
#     botões estão desabilitados (conexão/troca).
#   - menus: fatos do bloco `desk` normalizado — 2 painéis? rótulo do toggle
#     do 2º painel, painel de referências visível, flags do Xournal++ e a
#     plataforma como Bool — mais o tema atual.
#
# Convenções (as mesmas de `core/view.bend`):
#   - `#course-tabs` = um `button[role=tab][data-id]` por matéria, na ordem da
#     lista; a matéria ativa ganha `.active` e `aria-selected="true"` (e nenhuma
#     fica ativa com o GeoGebra ligado); `span.tab-sep`; e o
#     `button[data-id=geogebra]` (`.ggb-tab`) por último; o tablist usa roving
#     tabindex (aba ativa `0`, demais `-1`; as setas são do host);
#   - `disabled` só entra na lista quando o fato é True (os botões da lista de
#     matérias e a aba GeoGebra desabilitam juntos; o "+" não);
#   - itens de menu = `button[role=menuitem]` com id estável; o rótulo do
#     `#reference-toggle` é o toggle do 2º painel (vazio cai em "Formulário") e
#     o item some com 1 painel; o `#xournal` some com a flag desligada ou no
#     Windows sem caminho; o tema vira "Tema: auto/claro/escuro" (valor
#     desconhecido cai em auto, como o `applyTheme` do app);
#   - `data-icon` é andaime para o host injetar o SVG (`desk/icons.mjs`) e
#     `data-icon-tight` diz "sem espaço antes do rótulo" (aba GeoGebra); o host
#     remove os dois ao aplicar, então o DOM final é o de antes.
# ---------------------------------------------------------------------------

# Matéria de uma aba: id (o `data-id`) e rótulo. O path não entra na view.
type Tab is Data:
  Tab{id: String, name: String}

# Fatos do header para os menus (o host monta a partir do `desk` normalizado).
type MenuFacts is Data:
  MenuFacts{
    twoPanels: Bool,
    toggle: String,
    refVisible: Bool,
    xournal: Bool,
    win32: Bool,
    hasXournalPath: Bool,
    theme: String,
    endDay: Bool,
    compact: Bool
  }

# ---------- tema ----------

def themeLabel.atDark(dark: Bool) -> String:
  match dark:
    case True{}:
      "Tema: escuro"
    case False{}:
      "Tema: auto"

def themeLabel.at(light: Bool, dark: Bool) -> String:
  match light:
    case True{}:
      "Tema: claro"
    case False{}:
      themeLabel.atDark(dark)

def themeLabel(+raw: String) -> String:
  themeLabel.at(String.eq(raw, "light"), String.eq(raw, "dark"))

# O ícone acompanha o estado (o autor pediu andaime de ícone no tema): auto =
# contraste (◍), claro = sol, escuro = lua. Mesmo mapa do `THEME_ICONS` do
# host (state.mjs) — o glifo é do desk/icons.mjs.
def themeIcon.atDark(dark: Bool) -> String:
  match dark:
    case True{}:
      "moon"
    case False{}:
      "contrast"

def themeIcon.at(light: Bool, dark: Bool) -> String:
  match light:
    case True{}:
      "sun"
    case False{}:
      themeIcon.atDark(dark)

def themeIcon(+raw: String) -> String:
  themeIcon.at(String.eq(raw, "light"), String.eq(raw, "dark"))

# ---------- rótulos ----------

# O `||` do host: string vazia cai no fallback.
def labelOr.if(s: String, fallback: String, empty: Bool) -> String:
  match empty:
    case True{}:
      fallback
    case False{}:
      s

def labelOr(+s: String, fallback: String) -> String:
  labelOr.if(s, fallback, String.is_empty(s))

def refToggleLabel(+toggle: String) -> String:
  labelOr(toggle, "Formulário")

# Xournal++ some com a flag desligada ou no Windows sem caminho configurado.
def xournalHidden(xournal: Bool, win32: Bool, hasPath: Bool) -> Bool:
  Bool.or(Bool.not(xournal), Bool.and(win32, Bool.not(hasPath)))

# ---------- abas ----------

# A matéria só fica ativa se for a ativa e o GeoGebra estiver desligado.
def tabActive(id: String, activeId: String, ggbActive: Bool) -> Bool:
  match ggbActive:
    case True{}:
      False{}
    case False{}:
      String.eq(id, activeId)

# Roving tabindex do tablist: a aba ativa entra na ordem de tabulação (0) e as
# demais ficam alcançáveis pelas setas do host (-1).
def rovingTabindex(active: Bool) -> String:
  match active:
    case True{}:
      "0"
    case False{}:
      "-1"

def tabAttrs(id: String, +active: Bool, disabled: Bool) -> List<&2, V.ViewAttr>:
  V.attrJoin([
    [ V.attrType("button")
    , V.classes([V.classOn("active", active)])
    , V.attrData("id", id)
    , V.attr("role", "tab")
    , V.attrAria("selected", V.boolStr(active))
    , V.attr("tabindex", rovingTabindex(active))
    ],
    V.attrWhen(disabled, V.attr("disabled", "")),
    [V.attrOn("click", "SelectCourse")]
  ])

def tabNode(id: String, name: String, active: Bool, disabled: Bool) -> V.ViewNode:
  V.viewEl("button", tabAttrs(id, active, disabled), [V.viewText(name)])

def tabNodeOf(+h: Tab, activeId: String, ggbActive: Bool, disabled: Bool) -> V.ViewNode:
  match h:
    case Tab{+id, name}:
      tabNode(id, name, tabActive(id, activeId, ggbActive), disabled)

def tabSep() -> V.ViewNode:
  V.viewEl("span", [V.attrClass("tab-sep")], Nil{})

def ggbAttrs(+active: Bool, disabled: Bool) -> List<&2, V.ViewAttr>:
  V.attrJoin([
    [ V.attrType("button")
    , V.classes([V.classOn("active", active), V.classOn("ggb-tab", True{})])
    , V.attrData("id", "geogebra")
    , V.attr("role", "tab")
    , V.attrAria("selected", V.boolStr(active))
    , V.attr("tabindex", rovingTabindex(active))
    , V.attrTitle("GeoGebra embutido (gráficos, geometria e CAS no applet da web)")
    , V.attrData("icon", "graph")
    , V.attrData("icon-tight", "")
    ],
    V.attrWhen(disabled, V.attr("disabled", "")),
    [V.attrOn("click", "OpenGeoGebra")]
  ])

def ggbTab(active: Bool, disabled: Bool) -> V.ViewNode:
  V.viewEl("button", ggbAttrs(active, disabled), [V.viewText("GeoGebra")])

# O "+" de nova matéria é irmão do `#course-tabs` (não entra na contagem de
# abas); o host troca o botão estático do index.html por este nó.
def newTab() -> V.ViewNode:
  V.viewEl(
    "button",
    [ V.attrType("button")
    , V.attrId("new-tab")
    , V.attrTitle("Nova matéria (abre as Configurações)")
    , V.attrAria("label", "Nova matéria (abre as Configurações)")
    , V.attrOn("click", "NewCourse")
    ],
    [V.viewText("+")]
  )

# Filhos do `#course-tabs`: matérias, separador e a aba GeoGebra.
def courseTabs(
  cs: List<&2, Tab>, +activeId: String, +ggbActive: Bool, +disabled: Bool
) -> List<&2, V.ViewNode>:
  match cs:
    case Nil{}:
      [tabSep(), ggbTab(ggbActive, disabled)]
    case Con{h, t}:
      Con{
        tabNodeOf(h, activeId, ggbActive, disabled),
        courseTabs(t, activeId, ggbActive, disabled)
      }

# ---------- itens de menu ----------

# Sem nome de ícone não entra andaime (o tema é texto puro, como no app).
def itemIcon.if(empty: Bool, icon: String) -> List<&2, V.ViewAttr>:
  match empty:
    case True{}:
      Nil{}
    case False{}:
      [V.attrData("icon", icon)]

def itemIcon(+icon: String) -> List<&2, V.ViewAttr>:
  itemIcon.if(String.is_empty(icon), icon)

def menuItemAttrs(
  id: String, handler: String, extra: List<&2, V.ViewAttr>, icon: String
) -> List<&2, V.ViewAttr>:
  V.attrJoin([
    [V.attrType("button"), V.attrId(id), V.attr("role", "menuitem")],
    extra,
    itemIcon(icon),
    [V.attrOn("click", handler)]
  ])

def menuItem(
  id: String, text: String, icon: String, handler: String, extra: List<&2, V.ViewAttr>
) -> V.ViewNode:
  V.viewEl("button", menuItemAttrs(id, handler, extra, icon), [V.viewText(text)])

def refToggleItem(twoPanels: Bool, +toggle: String, refVisible: Bool) -> V.ViewNode:
  menuItem(
    "reference-toggle",
    refToggleLabel(toggle),
    "columns",
    "ToggleReference",
    V.attrJoin([
      V.attrWhen(Bool.not(twoPanels), V.attr("hidden", "")),
      [V.attrAria("pressed", V.boolStr(refVisible))]
    ])
  )

def xournalItem(xournal: Bool, win32: Bool, hasPath: Bool) -> V.ViewNode:
  menuItem(
    "xournal",
    "Xournal++",
    "external",
    "OpenXournal",
    V.attrWhen(xournalHidden(xournal, win32, hasPath), V.attr("hidden", ""))
  )

def helpItem() -> V.ViewNode:
  menuItem("help", "Como usar", "help", "OpenHelp", Nil{})

def endDayItem(endDay: Bool) -> V.ViewNode:
  menuItem(
    "end-day",
    "Encerrar por hoje",
    "moon",
    "OpenEndDay",
    V.attrWhen(Bool.not(endDay), V.attr("hidden", ""))
  )

def reviewItem() -> V.ViewNode:
  menuItem("review-open", "Caderno de revisão", "book", "OpenReview", Nil{})

def densityLabel() -> String:
  "Modo compacto"

def densityIcon(compact: Bool) -> String:
  match compact:
    case True{}:
      "check"
    case False{}:
      "unfold"

def densityItem(+compact: Bool) -> V.ViewNode:
  menuItem(
    "density-cycle",
    densityLabel(),
    densityIcon(compact),
    "ToggleDensity",
    [V.attrAria("pressed", V.boolStr(compact))]
  )

def settingsItem() -> V.ViewNode:
  menuItem("settings", "Configurações", "settings", "OpenSettings", Nil{})

def themeItem(+theme: String) -> V.ViewNode:
  menuItem("theme-cycle", themeLabel(theme), themeIcon(theme), "CycleTheme", Nil{})

def aboutItem() -> V.ViewNode:
  menuItem("about", "Sobre", "help", "OpenAbout", Nil{})

# Filhos do `#study-pop` (ordem do index.html).
def studyItems(f: MenuFacts) -> List<&2, V.ViewNode>:
  match f:
    case MenuFacts{twoPanels, toggle, refVisible, xournal, win32, hasXournalPath, _, endDay, _}:
      [
        refToggleItem(twoPanels, toggle, refVisible),
        xournalItem(xournal, win32, hasXournalPath),
        reviewItem(),
        endDayItem(endDay)
      ]

# Filhos do `#mesa-pop` (ordem do index.html).
def mesaItems(f: MenuFacts) -> List<&2, V.ViewNode>:
  match f:
    case MenuFacts{_, _, _, _, _, _, theme, _, compact}:
      [helpItem(), settingsItem(), themeItem(theme), densityItem(compact), aboutItem()]

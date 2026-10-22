import Base
import msg.bend as M
import view.bend as V
import studytoolsview.bend as ST

# ---------------------------------------------------------------------------
# View das abas de matéria e dos menus da barra superior (header).
#
# O host entrega fatos já resolvidos e este núcleo devolve a árvore de nós que
# o aplicador (`desk/src/view-host.mjs`) monta no DOM. Nada aqui lê o DOM,
# mede, foca ou fala com o Electron:
#   - matérias: id e rótulo (saída de `core/courses.bend`, já resolvida pelo
#     host), id da matéria ativa, se a aba GeoGebra está ligada e se os
#     botões estão desabilitados (conexão/troca).
#   - menus: fatos do bloco `desk` normalizado — 2 painéis? rótulo do toggle
#     do 2º painel, painel de referências visível, flags do Xournal++ e a
#     plataforma como Bool.
#
# Convenções (as mesmas de `core/view.bend`):
#   - `#course-tabs` = um `button[role=tab][data-id]` por matéria, na ordem da
#     lista; a matéria ativa ganha `.active` e `aria-selected="true"` (e nenhuma
#     fica ativa com o GeoGebra ligado ou com o Caderno aberto); depois o "+"
#     de nova matéria, `span.tab-sep`, o `button#review-tab[data-id=review]`
#     (Caderno, com a contagem de revisar hoje) e o
#     `button[data-id=geogebra]` (`.ggb-tab`) por último; o tablist usa roving
#     tabindex (aba ativa `0`, demais `-1`; as setas são do host);
#   - o seletor único da janela estreita (`#course-pop`) lista as mesmas
#     matérias como `menuitem`, a ativa marcada;
#   - `disabled` só entra na lista quando o fato é True (os botões da lista de
#     matérias e a aba GeoGebra desabilitam juntos; o "+" não);
#   - itens de menu = `button[role=menuitem]` com id estável; as ferramentas de
#     estudo vêm de `core/studytoolsview.bend`; o rótulo do `#reference-toggle`
#     é o toggle do 2º painel (vazio cai em "Formulário") e o item some com 1
#     painel; o `#xournal` some com a flag desligada ou no Windows sem caminho;
#     o menu Ajustes reúne Configurações, Ajuda, Atalhos e Sobre;
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
    hasXournalPath: Bool
  }

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
  labelOr(toggle, M.msg("tabs.referenceToggle"))

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

# Trava durante a resposta (#42): a aba continua desligada — trocar de matéria
# no meio da resposta mistura contextos —, mas diz por quê. A dica entra só
# quando a aba está travada; o CSS deixa o rótulo legível (`--muted`, sem
# opacidade).
def lockHint() -> String:
  M.msg("tabs.locked")

def lockAttrs(disabled: Bool) -> List<&2, V.ViewAttr>:
  match disabled:
    case True{}:
      [V.attr("disabled", ""), V.attrTitle(lockHint())]
    case False{}:
      Nil{}

def tabAttrs(id: String, +active: Bool, disabled: Bool) -> List<&2, V.ViewAttr>:
  V.attrJoin([
    [ V.attrType("button")
    , V.classes([V.classOn("active", active)])
    , V.attrData("id", id)
    , V.attr("role", "tab")
    , V.attrAria("selected", V.boolStr(active))
    , V.attr("tabindex", rovingTabindex(active))
    ],
    lockAttrs(disabled),
    [V.attrOn("click", "SelectCourse")]
  ])

def tabNode(id: String, name: String, active: Bool, disabled: Bool) -> V.ViewNode:
  V.viewEl("button", tabAttrs(id, active, disabled), [V.viewText(name)])

# A matéria atual nunca trava (#42): voltar a ela do Caderno ou do GeoGebra
# durante a resposta não troca de contexto. As outras travam com o fato
# `locked` do host. `currentId` vazio = nenhuma matéria é a atual.
def tabLocked(+id: String, +currentId: String, locked: Bool) -> Bool:
  Bool.and(locked, Bool.not(Bool.and(Bool.not(String.is_empty(currentId)), String.eq(id, currentId))))

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
    , V.attrTitle(M.msg("tabs.ggbTitle"))
    , V.attrData("icon", "graph")
    , V.attrData("icon-tight", "")
    ],
    V.attrWhen(disabled, V.attr("disabled", "")),
    [V.attrOn("click", "OpenGeoGebra")]
  ])

def ggbTab(active: Bool, disabled: Bool) -> V.ViewNode:
  V.viewEl("button", ggbAttrs(active, disabled), [V.viewText("GeoGebra")])

# O "+" de nova matéria fica dentro do `#course-tabs`, logo depois da última
# matéria (o host não conta o botão como aba: não tem `role=tab`).
def newTab() -> V.ViewNode:
  V.viewEl(
    "button",
    [ V.attrType("button")
    , V.attrId("new-tab")
    , V.attrTitle(M.msg("tabs.newCourse"))
    , V.attrAria("label", M.msg("tabs.newCourse"))
    , V.attrOn("click", "NewCourse")
    ],
    [V.viewText("+")]
  )

# ---------- Caderno (aba com a contagem de revisar hoje) ----------

# `count` é o número já formatado pelo host ("0", "3"); o item só marca
# `has-items` quando há algo para revisar.
def reviewHasItems(+count: String) -> Bool:
  Bool.not(String.eq(count, "0"))

# Plural e "nenhum" ficam no catálogo (`tabs.review.title.none/one/other`): o
# núcleo só passa a contagem; a regra de plural é do idioma, e não daqui.
def reviewTitle.some(+count: String) -> String:
  M.msg1("tabs.review.title", "count", count)

def reviewTitle.if(empty: Bool, count: String) -> String:
  match empty:
    case True{}:
      M.msg("tabs.review.title.none")
    case False{}:
      reviewTitle.some(count)

def reviewTitle(+count: String) -> String:
  reviewTitle.if(String.eq(count, "0"), count)

def reviewAttrs(+count: String, +active: Bool) -> List<&2, V.ViewAttr>:
  [ V.attrType("button")
  , V.attrId("review-tab")
  , V.classes([V.classOn("active", active), V.classOn("has-items", reviewHasItems(count))])
  , V.attrData("id", "review")
  , V.attr("role", "tab")
  , V.attrAria("selected", V.boolStr(active))
  , V.attr("tabindex", rovingTabindex(active))
  , V.attrTitle(reviewTitle(count))
  , V.attrAria("label", reviewTitle(count))
  , V.attrOn("click", "OpenReview")
  ]

def reviewTab(+count: String, active: Bool) -> V.ViewNode:
  V.viewEl(
    "button",
    reviewAttrs(count, active),
    [ V.viewText(M.msg("tabs.review"))
    , V.viewText(" ")
    , V.viewEl("span", [V.attrId("review-count")], [V.viewText(count)])
    ]
  )

# Filhos do `#course-tabs`: matérias, "+", separador, Caderno e GeoGebra. O
# `activeId` "review" marca o Caderno aberto (nenhuma matéria fica ativa).
def courseTabs.tools(
  +reviewCount: String, +activeId: String, +ggbActive: Bool, +disabled: Bool
) -> List<&2, V.ViewNode>:
  [ newTab()
  , tabSep()
  , reviewTab(reviewCount, tabActive("review", activeId, ggbActive))
  , ggbTab(ggbActive, disabled)
  ]

def courseTabs(
  cs: List<&2, Tab>, +activeId: String, +ggbActive: Bool, +disabled: Bool, +reviewCount: String
) -> List<&2, V.ViewNode>:
  match cs:
    case Nil{}:
      courseTabs.tools(reviewCount, activeId, ggbActive, disabled)
    case Con{h, t}:
      Con{
        tabNodeOf(h, activeId, ggbActive, disabled),
        courseTabs(t, activeId, ggbActive, disabled, reviewCount)
      }

# As abas com a matéria atual conhecida (#42): ela fica livre durante a
# resposta, as outras travam com a dica. `courseTabs` é o caso sem matéria
# atual (todas travam juntas).
def tabNodeAt(+h: Tab, +activeId: String, +currentId: String, +ggbActive: Bool, locked: Bool) -> V.ViewNode:
  match h:
    case Tab{+id, name}:
      tabNode(id, name, tabActive(id, activeId, ggbActive), tabLocked(id, currentId, locked))

def courseTabsAt(
  cs: List<&2, Tab>, +activeId: String, +currentId: String, +ggbActive: Bool, +locked: Bool, +reviewCount: String
) -> List<&2, V.ViewNode>:
  match cs:
    case Nil{}:
      courseTabs.tools(reviewCount, activeId, ggbActive, locked)
    case Con{h, t}:
      Con{
        tabNodeAt(h, activeId, currentId, ggbActive, locked),
        courseTabsAt(t, activeId, currentId, ggbActive, locked, reviewCount)
      }

# ---------- itens de menu ----------

# Sem nome de ícone não entra andaime (a opção do seletor sem marca é texto puro).
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
  menuItem("help", M.msg("menu.help"), "help", "OpenHelp", Nil{})

def shortcutsItem() -> V.ViewNode:
  menuItem("shortcuts", M.msg("menu.shortcuts"), "keyboard", "OpenShortcuts", Nil{})

def settingsItem() -> V.ViewNode:
  menuItem("settings", M.msg("menu.settings"), "settings", "OpenSettings", Nil{})

def aboutItem() -> V.ViewNode:
  menuItem("about", M.msg("menu.about"), "help", "OpenAbout", Nil{})

# Filhos do `#study-pop`: as ferramentas de estudo (`core/studytoolsview.bend`),
# o Xournal++ e o toggle do 2º painel. O Encerrar por hoje mora em Mais opções
# do tutor (`core/tutorheader.bend`).
def studyItems(f: MenuFacts) -> List<&2, V.ViewNode>:
  match f:
    case MenuFacts{twoPanels, toggle, refVisible, xournal, win32, hasXournalPath}:
      List.append(
        &2,
        V.ViewNode,
        ST.tools(),
        [ xournalItem(xournal, win32, hasXournalPath)
        , refToggleItem(twoPanels, toggle, refVisible)
        ]
      )

# Filhos do `#settings-pop` (o botão Ajustes, no lugar do antigo menu "Mesa").
def settingsItems() -> List<&2, V.ViewNode>:
  [settingsItem(), helpItem(), shortcutsItem(), aboutItem()]

# ---------- seletor único (janela estreita) ----------

# Itens do `#course-pop`: uma matéria por linha, a ativa com `aria-pressed` e
# o glifo de marca (o host injeta o SVG). O clique é o mesmo das abas.
def courseOptionIcon(active: Bool) -> String:
  match active:
    case True{}:
      "check"
    case False{}:
      ""

def courseOption(+id: String, name: String, activeId: String, ggbActive: Bool, disabled: Bool) -> V.ViewNode:
  menuItem(
    String.append("course-option-", id),
    name,
    courseOptionIcon(tabActive(id, activeId, ggbActive)),
    "SelectCourse",
    V.attrJoin([
      [V.attrData("id", id)],
      lockAttrs(disabled)
    ])
  )

def courseOptionOf(+h: Tab, activeId: String, ggbActive: Bool, disabled: Bool) -> V.ViewNode:
  match h:
    case Tab{+id, name}:
      courseOption(id, name, activeId, ggbActive, disabled)

def courseMenuItems(
  cs: List<&2, Tab>, +activeId: String, +ggbActive: Bool, +disabled: Bool
) -> List<&2, V.ViewNode>:
  match cs:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      Con{
        courseOptionOf(h, activeId, ggbActive, disabled),
        courseMenuItems(t, activeId, ggbActive, disabled)
      }

def courseOptionAt(+h: Tab, +activeId: String, +currentId: String, +ggbActive: Bool, locked: Bool) -> V.ViewNode:
  match h:
    case Tab{+id, name}:
      courseOption(id, name, activeId, ggbActive, tabLocked(id, currentId, locked))

def courseMenuItemsAt(
  cs: List<&2, Tab>, +activeId: String, +currentId: String, +ggbActive: Bool, +locked: Bool
) -> List<&2, V.ViewNode>:
  match cs:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      Con{
        courseOptionAt(h, activeId, currentId, ggbActive, locked),
        courseMenuItemsAt(t, activeId, currentId, ggbActive, locked)
      }

import Base
import view.bend as V

# ---------------------------------------------------------------------------
# View da lista de conversas (`#chat-list`).
#
# O núcleo só desenha: recebe fatos já resolvidos pelo host (rótulo, `when`,
# ativo/fixado/arquivado/rascunho, grupos, busca). Data, preview e agrupamento
# civil ficam em `sessions.bend` / no adaptador. Sem I/O, Date ou DOM.
#
# Artefato: `chat/src/generated/chatlist.core.js`. O host aplica a árvore com
# `view-host.mjs` (on:<evento> → handlers; key → dataset.key).
# ---------------------------------------------------------------------------

# Uma linha da lista. `label` e `when` já vêm formatados; `title` é o tooltip.
type ChatRow is Data:
  ChatRow{
    path: String,
    label: String,
    when: String,
    title: String,
    active: Bool,
    pinned: Bool,
    archived: Bool,
    hasDraft: Bool
  }

type ChatGroup is Data:
  ChatGroup{key: String, label: String, items: +List<ChatRow>}

# `hasQuery` é o fato "a busca da sidebar não está vazia" (o host compara).
type ChatList is Data:
  ChatList{
    groups: +List<ChatGroup>,
    archived: +List<ChatRow>,
    archivedOpen: Bool,
    hasQuery: Bool,
    query: String
  }

# ---------- nomes de handler (o host consulta a tabela) ----------

def actOpen() -> String:
  "openRow"

def actPin() -> String:
  "pinRow"

def actMore() -> String:
  "moreRow"

def actKey() -> String:
  "rowKey"

def actArchived() -> String:
  "toggleArchived"

def actClear() -> String:
  "clearSearch"

def actDeep() -> String:
  "deepSearch"

# ---------- ícones (o host injeta o SVG; a view decide o desenho) ----------

# Nome do `data-icon` do ícone da linha: fixada usa o alfinete; solta, a bolha.
def rowIconName(pinned: Bool) -> String:
  match pinned:
    case True{}:
      "pin"
    case False{}:
      "message"

# ---------- cópia da view (strings PT-BR do DOM atual) ----------

def idleEmptyMsg() -> String:
  "Nenhuma conversa ainda. Escreva abaixo para começar."

def clearSearchLabel() -> String:
  "Limpar busca"

def archivedLabel() -> String:
  "Arquivadas"

def draftTitle() -> String:
  "Rascunho não enviado"

def moreTitle() -> String:
  "Mais"

def moreAria() -> String:
  "Mais ações da conversa"

def fallbackLabel() -> String:
  "Conversa"

def emptyQueryMsg(query: String) -> String:
  "Nada encontrado para “" ++ query ++ "”"

def deepSearchMsg(query: String) -> String:
  "Buscar «" ++ query ++ "» no conteúdo das conversas"

def pinTitle(pinned: Bool) -> String:
  match pinned:
    case True{}:
      "Desafixar"
    case False{}:
      "Fixar"

def pinAria(pinned: Bool) -> String:
  match pinned:
    case True{}:
      "Desafixar conversa"
    case False{}:
      "Fixar conversa"

def archivedAria(open: Bool, count: String) -> String:
  match open:
    case True{}:
      "Ocultar arquivadas, " ++ count
    case False{}:
      "Mostrar arquivadas, " ++ count

def shownLabel.empty(label: String, empty: Bool) -> String:
  match empty:
    case True{}:
      fallbackLabel()
    case False{}:
      label

def shownLabel(+label: String) -> String:
  shownLabel.empty(label, String.is_empty(label))

# Extra do aria-label da linha: as três marcas, nessa ordem, separadas por ", ".
def extraParts(pinned: Bool, archived: Bool, hasDraft: Bool) -> String:
  match pinned:
    case True{}:
      match archived:
        case True{}:
          match hasDraft:
            case True{}:
              "fixada, arquivada, rascunho não enviado"
            case False{}:
              "fixada, arquivada"
        case False{}:
          match hasDraft:
            case True{}:
              "fixada, rascunho não enviado"
            case False{}:
              "fixada"
    case False{}:
      match archived:
        case True{}:
          match hasDraft:
            case True{}:
              "arquivada, rascunho não enviado"
            case False{}:
              "arquivada"
        case False{}:
          match hasDraft:
            case True{}:
              "rascunho não enviado"
            case False{}:
              ""

def hasExtra(pinned: Bool, archived: Bool, hasDraft: Bool) -> Bool:
  Bool.or(pinned, Bool.or(archived, hasDraft))

def noneYet(noGroups: Bool, noArchived: Bool) -> Bool:
  match noGroups:
    case False{}:
      False{}
    case True{}:
      match noArchived:
        case False{}:
          False{}
        case True{}:
          True{}

def sectionId(key: String) -> String:
  String.append("sec-", key)

# ---------- linha ----------

def draftDot() -> V.ViewNode:
  V.viewEl(
    "span",
    [V.attrClass("draft-dot"), V.attrTitle(draftTitle()), V.attrAria("hidden", "true")],
    []
  )

def rowIcon(+pinned: Bool) -> V.ViewNode:
  V.viewEl(
    "span",
    [
      V.classes([V.classOn("row-icon", True{}), V.classOn("pinned", pinned)]),
      V.attrData("icon", rowIconName(pinned)),
      V.attrAria("hidden", "true")
    ],
    []
  )

def pinBtn(+pinned: Bool) -> V.ViewNode:
  V.viewEl(
    "button",
    [
      V.attrType("button"),
      V.attrClass("more"),
      V.attr("tabindex", "-1"),
      V.attrData("icon", "pin"),
      V.attrTitle(pinTitle(pinned)),
      V.attrAria("label", pinAria(pinned)),
      V.attrOn("click", actPin())
    ],
    []
  )

def moreBtn() -> V.ViewNode:
  V.viewEl(
    "button",
    [
      V.attrType("button"),
      V.attrClass("more"),
      V.attr("tabindex", "-1"),
      V.attrData("icon", "more"),
      V.attrTitle(moreTitle()),
      V.attrAria("label", moreAria()),
      V.attrAria("haspopup", "menu"),
      V.attrAria("expanded", "false"),
      V.attrOn("click", actMore())
    ],
    []
  )

def ops(pinned: Bool) -> V.ViewNode:
  V.viewEl("div", [V.attrClass("ops")], [pinBtn(pinned), moreBtn()])

def rowEnd(when: String, pinned: Bool) -> V.ViewNode:
  V.viewEl(
    "div",
    [V.attrClass("row-end")],
    [
      V.viewEl("span", [V.attrClass("when")], [V.viewText(when)]),
      ops(pinned)
    ]
  )

def openBtn(
  +shown: String, extra: String, active: Bool, hasDraft: Bool, hasEx: Bool
) -> V.ViewNode:
  V.viewEl(
    "button",
    V.attrJoin(
      [
        [
          V.attrType("button"),
          V.attrClass("chat-open"),
          V.attrOn("keydown", actKey())
        ],
        V.attrWhen(hasEx, V.attrAria("label", shown ++ ", " ++ extra)),
        V.attrWhen(active, V.attrAria("current", "true"))
      ]
    ),
    V.viewConcat(
      [V.viewEl("span", [V.attrClass("label")], [V.viewText(shown)])],
      V.viewWhen(hasDraft, draftDot())
    )
  )

def rowMeta(
  shown: String,
  title: String,
  extra: String,
  active: Bool,
  hasDraft: Bool,
  hasEx: Bool
) -> V.ViewNode:
  V.viewEl(
    "div",
    [V.attrClass("meta"), V.attrTitle(title)],
    [openBtn(shown, extra, active, hasDraft, hasEx)]
  )

def rowAttrs(
  path: String, +active: Bool, pinned: Bool, archived: Bool, hasDraft: Bool
) -> List<&2, V.ViewAttr>:
  V.attrJoin(
    [
      [
        V.classes(
          [
            V.classOn("chat-item", True{}),
            V.classOn("active", active),
            V.classOn("archived", archived),
            V.classOn("pinned", pinned),
            V.classOn("has-draft", hasDraft)
          ]
        ),
        V.attrData("path", path),
        V.attrOn("click", actOpen())
      ],
      V.attrWhen(active, V.attrAria("current", "true"))
    ]
  )

def rowKids(
  +label: String,
  when: String,
  title: String,
  active: Bool,
  +pinned: Bool,
  +archived: Bool,
  +hasDraft: Bool
) -> List<&2, V.ViewNode>:
  [
    rowIcon(pinned),
    rowMeta(
      shownLabel(label),
      title,
      extraParts(pinned, archived, hasDraft),
      active,
      hasDraft,
      hasExtra(pinned, archived, hasDraft)
    ),
    rowEnd(when, pinned)
  ]

def rowView(row: ChatRow) -> V.ViewNode:
  match row:
    case ChatRow{+path, +label, when, title, +active, +pinned, +archived, +hasDraft}:
      V.viewKey(
        "li",
        path,
        rowAttrs(path, active, pinned, archived, hasDraft),
        rowKids(label, when, title, active, pinned, archived, hasDraft)
      )

def rowViews(xs: List<&2, ChatRow>) -> List<&2, V.ViewNode>:
  match xs:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      Con{rowView(h), rowViews(t)}

# ---------- menu de operações da linha ----------
# View pura: itens, `key` e handler por tabela. O host monta o elemento no
# `.ops`, navega (↓↑/Home/End/Esc/←/Tab), fecha e devolve o foco.

type ChatOps is Data:
  ChatOps{pinned: Bool, archived: Bool}

def actMenuPin() -> String:
  "menuPin"

def actMenuRename() -> String:
  "menuRename"

def actMenuArchive() -> String:
  "menuArchive"

def actMenuKey() -> String:
  "menuKey"

def renameTitle() -> String:
  "Renomear"

def archiveTitle(archived: Bool) -> String:
  match archived:
    case True{}:
      "Desarquivar"
    case False{}:
      "Arquivar"

def menuItem(label: String, key: String, handler: String) -> V.ViewNode:
  V.viewKey(
    "button",
    key,
    [V.attrType("button"), V.attr("role", "menuitem"), V.attrOn("click", handler)],
    [V.viewText(label)]
  )

def menuKids(ops: ChatOps) -> List<&2, V.ViewNode>:
  match ops:
    case ChatOps{pinned, archived}:
      [
        menuItem(pinTitle(pinned), "ops-pin", actMenuPin()),
        menuItem(renameTitle(), "ops-rename", actMenuRename()),
        menuItem(archiveTitle(archived), "ops-archive", actMenuArchive())
      ]

def menuView(ops: ChatOps) -> V.ViewNode:
  V.viewEl(
    "div",
    [
      V.attrClass("ops-menu"),
      V.attr("role", "menu"),
      V.attrOn("keydown", actMenuKey())
    ],
    menuKids(ops)
  )

# ---------- seção de grupo ----------

def sectionView(g: ChatGroup) -> V.ViewNode:
  match g:
    case ChatGroup{+key, label, items}:
      +hid = sectionId(key)
      V.viewKey(
        "section",
        hid,
        [V.attrClass("side-section"), V.attrAria("labelledby", hid)],
        [
          V.viewEl(
            "h2",
            [V.attrClass("side-sec-head static"), V.attrId(hid)],
            [V.viewText(label)]
          ),
          V.viewEl("ul", [V.attrClass("side-sec-body")], rowViews(items))
        ]
      )

def groupViews(xs: List<&2, ChatGroup>) -> List<&2, V.ViewNode>:
  match xs:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      Con{sectionView(h), groupViews(t)}

# ---------- arquivadas ----------

def archivedHead(+open: Bool, +count: String) -> V.ViewNode:
  V.viewEl(
    "button",
    [
      V.attrType("button"),
      V.classes([V.classOn("side-sec-head", True{}), V.classOn("open", open)]),
      V.attrData("icon", "chevronRight"),
      V.attrBool("aria-expanded", open),
      V.attrAria("controls", "archived-list"),
      V.attrAria("label", archivedAria(open, count)),
      V.attrOn("click", actArchived())
    ],
    [
      V.viewEl("span", [], [V.viewText(archivedLabel())]),
      V.viewEl("span", [V.attrClass("count")], [V.viewText(count)])
    ]
  )

def archivedList(open: Bool, items: List<&2, ChatRow>) -> V.ViewNode:
  V.viewEl(
    "ul",
    V.attrJoin(
      [
        [V.attrId("archived-list"), V.attrClass("side-sec-body")],
        V.attrWhen(Bool.not(open), V.attr("hidden", "true"))
      ]
    ),
    rowViews(items)
  )

def archivedView(+items: List<&2, ChatRow>, +open: Bool) -> V.ViewNode:
  V.viewEl(
    "section",
    [V.attrClass("side-section")],
    [
      archivedHead(open, Nat.show(List.length(&2, ChatRow, items))),
      archivedList(open, items)
    ]
  )

# ---------- vazio / busca no conteúdo ----------

def emptyView(hasQuery: Bool, query: String) -> V.ViewNode:
  match hasQuery:
    case False{}:
      V.viewEl(
        "div",
        [V.attrClass("chat-empty"), V.attr("role", "status")],
        [V.viewText(idleEmptyMsg())]
      )
    case True{}:
      V.viewEl(
        "div",
        [V.attrClass("chat-empty"), V.attr("role", "status")],
        [
          V.viewEl("span", [], [V.viewText(emptyQueryMsg(query))]),
          V.viewEl(
            "button",
            [
              V.attrType("button"),
              V.attrClass("chat-empty-clear"),
              V.attrOn("click", actClear())
            ],
            [V.viewText(clearSearchLabel())]
          )
        ]
      )

def deepSearchView(query: String) -> V.ViewNode:
  V.viewEl(
    "button",
    [
      V.attrType("button"),
      V.attrClass("chat-content-search"),
      V.attrOn("click", actDeep())
    ],
    [V.viewText(deepSearchMsg(query))]
  )

# ---------- lista ----------

def listKids(
  +groups: List<&2, ChatGroup>,
  +archived: List<&2, ChatRow>,
  open: Bool,
  +hasQuery: Bool,
  +query: String
) -> List<&2, V.ViewNode>:
  +noGroups = List.is_empty(&2, ChatGroup, groups)
  +noArchived = List.is_empty(&2, ChatRow, archived)
  V.viewJoin(
    [
      groupViews(groups),
      V.viewWhenAll(Bool.not(noArchived), [archivedView(archived, open)]),
      V.viewWhen(noneYet(noGroups, noArchived), emptyView(hasQuery, query)),
      V.viewWhen(hasQuery, deepSearchView(query))
    ]
  )

def listView(list: ChatList) -> List<&2, V.ViewNode>:
  match list:
    case ChatList{groups, archived, archivedOpen, hasQuery, query}:
      listKids(groups, archived, archivedOpen, hasQuery, query)

# ---------- amostras das leis ----------

def sampleRow(
  active: Bool, pinned: Bool, archived: Bool, hasDraft: Bool
) -> ChatRow:
  ChatRow{"/p", "Oi", "1h", "prev", active, pinned, archived, hasDraft}

def sampleGroup() -> ChatGroup:
  ChatGroup{"today", "Hoje", Con{sampleRow(False{}, False{}, False{}, False{}), Nil{}}}

def sampleOps(archived: Bool) -> ChatOps:
  ChatOps{False{}, archived}

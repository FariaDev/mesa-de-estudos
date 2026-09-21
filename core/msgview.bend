import Base
import view.bend as V

# ---------------------------------------------------------------------------
# View pura do transcript da Conversa (R3/R4).
#
# O host entrega fatos prontos: HTML sanitizado de markdown/KaTeX, rótulos de
# hora/dia, flags de última mensagem, texto longo/expandido e destaque da
# busca. O primeiro filho textual de `.body` é deliberadamente um slot de HTML:
# `chat.mjs` o troca por `htmlNode(markup)` antes de chamar o aplicador.
# Medição, relógio, scroll, Selection/Range, clipboard e IPC não entram aqui.
# ---------------------------------------------------------------------------

type MsgRole is Data:
  MsgUser{}
  MsgAssistant{}

type MsgImage is Data:
  MsgImage{src: String, alt: String}

type MsgFacts is Data:
  MsgFacts{
    key: String,
    role: MsgRole,
    markup: String,
    timeIso: String,
    timeTitle: String,
    timeLabel: String,
    hasTime: Bool,
    isLast: Bool,
    isLong: Bool,
    expanded: Bool,
    grid: Bool,
    images: +List<MsgImage>,
    flash: Bool
  }

def roleName(role: MsgRole) -> String:
  match role:
    case MsgUser{}:
      "user"
    case MsgAssistant{}:
      "assistant"

def roleLabel(role: MsgRole) -> String:
  match role:
    case MsgUser{}:
      "Você"
    case MsgAssistant{}:
      "Pi"

def isUser(role: MsgRole) -> Bool:
  match role:
    case MsgUser{}:
      True{}
    case MsgAssistant{}:
      False{}

def collapsed(long: Bool, expanded: Bool) -> Bool:
  match long:
    case False{}:
      False{}
    case True{}:
      match expanded:
        case True{}:
          False{}
        case False{}:
          True{}

def articleClass(+role: MsgRole, flash: Bool) -> V.ViewAttr:
  V.classes([
    V.classOn("message", True{}),
    V.classOn(roleName(role), True{}),
    V.classOn("pc-hit", flash)
  ])

def bodyClass(isLong: Bool, expanded: Bool) -> V.ViewAttr:
  V.classes([
    V.classOn("body", True{}),
    V.classOn("collapsed", collapsed(isLong, expanded))
  ])

def roleView(role: MsgRole) -> V.ViewNode:
  V.viewEl("div", [V.attrClass("role")], [V.viewText(roleLabel(role))])

def shotView(image: MsgImage) -> V.ViewNode:
  match image:
    case MsgImage{src, alt}:
      V.viewEl(
        "img",
        [
          V.attrClass("shot"),
          V.attr("src", src),
          V.attr("alt", alt),
          V.attr("tabindex", "0"),
          V.attr("role", "button"),
          V.attrAria("label", "Ampliar imagem")
        ],
        []
      )

def shotViews(images: List<&2, MsgImage>) -> List<&2, V.ViewNode>:
  V.viewMap(~MsgImage, ~shotView, images)

def imageKids(images: List<&2, MsgImage>, grid: Bool) -> List<&2, V.ViewNode>:
  match grid:
    case True{}:
      [V.viewEl("div", [V.attrClass("shot-grid")], shotViews(images))]
    case False{}:
      shotViews(images)

# `markup` é HTML já sanitizado pelo host. O ViewText ocupa o slot; não é
# inserido como texto pelo adaptador do transcript.
def bodyView(markup: String, images: List<&2, MsgImage>, isLong: Bool, expanded: Bool, grid: Bool) -> V.ViewNode:
  V.viewEl(
    "div",
    [bodyClass(isLong, expanded)],
    V.viewConcat([V.viewText(markup)], imageKids(images, grid))
  )

def actionHidden(available: Bool) -> List<&2, V.ViewAttr>:
  match available:
    case True{}:
      Nil{}
    case False{}:
      [V.attr("hidden", "")]

def actionButton(+className: String, label: String, handler: String, available: Bool) -> V.ViewNode:
  V.viewEl(
    "button",
    V.attrConcat(
      [V.attrType("button"), V.attrClass(className), V.attrKey(className), V.attrOn("click", handler)],
      actionHidden(available)
    ),
    [V.viewText(label)]
  )

def copyButton() -> V.ViewNode:
  V.viewEl(
    "button",
    [
      V.attrType("button"),
      V.attrClass("msg-copy"),
      V.attrKey("msg-copy"),
      V.attrAria("haspopup", "menu"),
      V.attrAria("expanded", "false"),
      V.attrOn("click", "copy")
    ],
    [V.viewText("Copiar")]
  )

def actionsView(role: MsgRole, isLast: Bool) -> V.ViewNode:
  match role:
    case MsgUser{}:
      V.viewEl(
        "div",
        [V.attrClass("msg-actions")],
        [copyButton(), actionButton("msg-edit", "Editar", "edit", isLast)]
      )
    case MsgAssistant{}:
      V.viewEl(
        "div",
        [V.attrClass("msg-actions")],
        [copyButton(), actionButton("msg-regen", "Regenerar", "regen", isLast)]
      )

def moreView(expanded: Bool) -> V.ViewNode:
  match expanded:
    case True{}:
      V.viewEl(
        "button",
        [V.attrType("button"), V.attrClass("msg-more"), V.attrKey("msg-more"), V.attrAria("expanded", "true"), V.attrOn("click", "more")],
        [V.viewText("Mostrar menos")]
      )
    case False{}:
      V.viewEl(
        "button",
        [V.attrType("button"), V.attrClass("msg-more"), V.attrKey("msg-more"), V.attrAria("expanded", "false"), V.attrOn("click", "more")],
        [V.viewText("Mostrar tudo")]
      )

def timeView(iso: String, title: String, label: String) -> V.ViewNode:
  V.viewEl(
    "time",
    [V.attrClass("msg-time"), V.attr("datetime", iso), V.attrTitle(title)],
    [V.viewText(label)]
  )

def messageKids(
  +role: MsgRole,
  markup: String,
  images: List<&2, MsgImage>,
  hasTime: Bool,
  timeIso: String,
  timeTitle: String,
  timeLabel: String,
  isLast: Bool,
  +isLong: Bool,
  +expanded: Bool,
  grid: Bool
) -> List<&2, V.ViewNode>:
  V.viewJoin([
    [roleView(role), bodyView(markup, images, isLong, expanded, grid)],
    V.viewWhen(Bool.and(isUser(role), isLong), moreView(expanded)),
    V.viewWhen(hasTime, timeView(timeIso, timeTitle, timeLabel)),
    [actionsView(role, isLast)]
  ])

def messageView(facts: MsgFacts) -> V.ViewNode:
  match facts:
    case MsgFacts{key, +role, markup, timeIso, timeTitle, timeLabel, hasTime, isLast, isLong, expanded, grid, images, flash}:
      V.viewKey(
        "article",
        key,
        [articleClass(role, flash), V.attrData("role", roleName(role))],
        messageKids(role, markup, images, hasTime, timeIso, timeTitle, timeLabel, isLast, isLong, expanded, grid)
      )

def daySepView(label: String) -> V.ViewNode:
  V.viewEl(
    "div",
    [V.attrClass("day-sep")],
    [V.viewEl("span", [V.attrClass("day-sep-label")], [V.viewText(label)])]
  )

def copyMenuView() -> V.ViewNode:
  V.viewEl(
    "div",
    [V.attrClass("ops-menu msg-copy-menu"), V.attr("role", "menu"), V.attrOn("keydown", "copyMenuKey")],
    [
      V.viewEl("button", [V.attrType("button"), V.attr("role", "menuitem"), V.attrData("mode", "text"), V.attrOn("click", "copyMode")], [V.viewText("Copiar texto")]),
      V.viewEl("button", [V.attrType("button"), V.attr("role", "menuitem"), V.attrData("mode", "markdown"), V.attrOn("click", "copyMode")], [V.viewText("Copiar markdown")])
    ]
  )

# Construtores auxiliares do transcript. Citações recebem o texto já formatado;
# chips só são usados quando o host tiver um fato de ferramenta/pensamento fora
# do diário (o diário existente continua responsável pelo DOM `.work`).
def citationView(text: String) -> V.ViewNode:
  V.viewEl("blockquote", [V.attrClass("msg-citation")], [V.viewText(text)])

def toolChipView(label: String) -> V.ViewNode:
  V.viewEl("span", [V.attrClass("msg-chip tool")], [V.viewText(label)])

def thinkingChipView(label: String, live: Bool) -> V.ViewNode:
  V.viewEl(
    "span",
    [V.classes([V.classOn("msg-chip", True{}), V.classOn("thinking", True{}), V.classOn("pulse", live)])],
    [V.viewText(label)]
  )

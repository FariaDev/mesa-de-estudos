import Base
import ./view.bend as V
import ./worklog.bend as L

# ---------------------------------------------------------------------------
# Visão do diário de trabalho do turno. Pura: devolve `ViewNode` para o
# aplicador (`desk/src/view-host.mjs`). O modelo do log mora em `worklog.bend`;
# rótulos PT-BR, duração, JSON e domínio vêm como fatos do host (WorkRow).
#
# DOM 1:1 com o contrato do smoke:
#   article.work[data-live][data-expanded]
#     button.work-head[aria-expanded]
#       .work-mark, .work-title, .work-meta, .pulse.work-dots, .work-chevron
#     .work-steps > .work-step[data-kind][data-status][data-detail][key]
#       button.step-toggle[aria-expanded]
#         .step-icon, .step-main (.step-line, .step-preview [hidden aberto],
#         .step-detail), .step-status
# Ícones SVG e o relógio ficam no host. `hidden` só entra quando o fato é
# verdadeiro (atributo booleano: presença esconde, `hidden="false"` também).
# ---------------------------------------------------------------------------

type LinkRow is Data:
  LinkRow{title: String, url: String, domain: String}

type StepRow is Data:
  StepRow{
    id: String,
    kind: L.StepKind,
    status: L.Status,
    open: Bool,
    hasDetail: Bool,
    label: String,
    time: String,
    preview: String,
    text: String,
    links: +List<LinkRow>
  }

type WorkRow is Data:
  WorkRow{
    live: Bool,
    expanded: Bool,
    title: String,
    meta: String,
    steps: +List<StepRow>
  }

# ---------- nomes (data-kind / data-status) ----------

def kindName(kind: L.StepKind) -> String:
  match kind:
    case L.Thinking{}:
      "thinking"
    case L.Search{}:
      "search"
    case L.Reference{}:
      "reference"
    case L.Fetch{}:
      "fetch"
    case L.Tool{}:
      "tool"
    case L.ErrorKind{}:
      "error"

def statusName(status: L.Status) -> String:
  match status:
    case L.Status.Running{}:
      "running"
    case L.Status.Done{}:
      "done"
    case L.Status.Stopped{}:
      "stopped"
    case L.Status.Failed{}:
      "error"

def statusRunning(status: L.Status) -> Bool:
  match status:
    case L.Status.Running{}:
      True{}
    case _:
      False{}

def isOff(on: Bool) -> Bool:
  match on:
    case True{}:
      False{}
    case False{}:
      True{}

def both(a: Bool, b: Bool) -> Bool:
  match a:
    case False{}:
      False{}
    case True{}:
      b

# Detalhe fechado quando não há o que mostrar, ou o passo não está aberto.
def detailHidden(open: Bool, hasDetail: Bool) -> Bool:
  match hasDetail:
    case False{}:
      True{}
    case True{}:
      isOff(open)

# O preview (o resumo que "corre" enquanto o passo pensa) some quando o passo
# está aberto: aberto, quem manda é o texto completo, que cresce no lugar dele.
#
# Quem chama passa o mesmo `expandedOn` do botão, e não `open` cru: um passo SEM
# detalhe nunca mostra detalhe nenhum (`detailHidden`), mas `open` ainda pode
# estar verdadeiro. Com `open` cru, o resumo sumia e nada aparecia no lugar — o
# passo esvaziava enquanto o botão continuava dizendo "recolhido". Com
# `expandedOn`, sem detalhe o resumo fica (o clique vira inócuo em vez de
# apagar conteúdo); com detalhe, os dois valores coincidem e nada muda.
def previewHidden(open: Bool, previewEmpty: Bool) -> Bool:
  match open:
    case True{}:
      True{}
    case False{}:
      previewEmpty

def attrHidden() -> V.ViewAttr:
  V.ViewAttr{"hidden", ""}

def hrefOf.empty(url: String, empty: Bool) -> String:
  match empty:
    case True{}:
      "#"
    case False{}:
      url

def hrefOf(+url: String) -> String:
  hrefOf.empty(url, String.is_empty(url))

# ---------- attrs (separados dos kids para as leis reduzirem) ----------

def articleAttrs(live: Bool, expanded: Bool) -> List<&2, V.ViewAttr>:
  [V.attrClass("work"), V.attrData("live", V.boolStr(live)), V.attrData("expanded", V.boolStr(expanded))]

def headAttrs(expanded: Bool) -> List<&2, V.ViewAttr>:
  [V.attrType("button"), V.attrClass("work-head"), V.attrKey("work-head"), V.attrAria("expanded", V.boolStr(expanded)), V.attrOn("click", "toggleWork")]

def stepAttrs(kind: String, status: String, hasDetail: Bool) -> List<&2, V.ViewAttr>:
  [V.attrClass("work-step"), V.attrData("kind", kind), V.attrData("status", status), V.attrData("detail", V.boolStr(hasDetail))]

def toggleAttrs(id: String, open: Bool) -> List<&2, V.ViewAttr>:
  [V.attrType("button"), V.attrClass("step-toggle"), V.attrKey(String.join(["step-toggle-", id], "")), V.attrAria("expanded", V.boolStr(open)), V.attrOn("click", "toggleStep")]

def classHidden(className: String, hide: Bool) -> List<&2, V.ViewAttr>:
  V.attrConcat([V.attrClass(className)], V.attrWhen(hide, attrHidden()))

# ---------- links ----------

def domainKids.empty(domain: String, empty: Bool) -> List<&2, V.ViewNode>:
  match empty:
    case True{}:
      Nil{}
    case False{}:
      [V.viewText(" "), V.viewEl("span", [V.attrClass("step-domain")], [V.viewText(domain)])]

def domainKids(+domain: String) -> List<&2, V.ViewNode>:
  domainKids.empty(domain, String.is_empty(domain))

def linkNode.go(title: String, url: String, domain: String) -> V.ViewNode:
  V.viewEl(
    "a",
    [V.attrClass("step-link"), V.ViewAttr{"href", hrefOf(url)}, V.ViewAttr{"rel", "noreferrer"}],
    V.viewConcat([V.viewText(title)], domainKids(domain))
  )

def linkNode(link: LinkRow) -> V.ViewNode:
  match link:
    case LinkRow{title, url, domain}:
      linkNode.go(title, url, domain)

def linkKids(xs: +List<LinkRow>) -> List<&2, V.ViewNode>:
  match xs:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      Con{linkNode(h), linkKids(t)}

def linksEmpty(xs: +List<LinkRow>) -> Bool:
  match xs:
    case Nil{}:
      True{}
    case Con{_, _}:
      False{}

# ---------- passo ----------

def statusKids(running: Bool) -> List<&2, V.ViewNode>:
  match running:
    case True{}:
      [V.viewEl("span", [V.attrClass("step-spin"), V.attrAria("hidden", "true")], Nil{})]
    case False{}:
      Nil{}

def workStep.go(
  +id: String,
  kind: L.StepKind,
  +status: L.Status,
  +open: Bool,
  +hasDetail: Bool,
  label: String,
  time: String,
  +preview: String,
  +text: String,
  +links: +List<LinkRow>
) -> V.ViewNode:
  +expandedOn = both(hasDetail, open)
  V.viewKey(
    "div",
    id,
    stepAttrs(kindName(kind), statusName(status), hasDetail),
    [V.viewEl(
      "button",
      toggleAttrs(id, expandedOn),
      [
        V.viewEl("span", [V.attrClass("step-icon")], Nil{}),
        V.viewEl(
          "div",
          [V.attrClass("step-main")],
          [
            V.viewEl(
              "div",
              [V.attrClass("step-line")],
              [
                V.viewEl("span", [V.attrClass("step-label")], [V.viewText(label)]),
                V.viewEl("span", [V.attrClass("step-time")], [V.viewText(time)])
              ]
            ),
            V.viewEl("div", classHidden("step-preview", previewHidden(expandedOn, String.is_empty(preview))), [V.viewText(preview)]),
            V.viewEl(
              "div",
              classHidden("step-detail", detailHidden(open, hasDetail)),
              [
                V.viewEl("div", classHidden("step-links", linksEmpty(links)), linkKids(links)),
                V.viewEl("pre", classHidden("step-text", String.is_empty(text)), [V.viewText(text)])
              ]
            )
          ]
        ),
        V.viewEl("span", [V.attrClass("step-status")], statusKids(statusRunning(status)))
      ]
    )]
  )

def workStep(step: StepRow) -> V.ViewNode:
  match step:
    case StepRow{id, kind, status, open, hasDetail, label, time, preview, text, links}:
      workStep.go(id, kind, status, open, hasDetail, label, time, preview, text, links)

def stepKids(xs: +List<StepRow>) -> List<&2, V.ViewNode>:
  match xs:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      Con{workStep(h), stepKids(t)}

def workSteps(xs: +List<StepRow>) -> V.ViewNode:
  V.viewEl("div", [V.attrClass("work-steps")], stepKids(xs))

# ---------- cabeça ----------

def workHead.kids(live: Bool, title: String, meta: String) -> List<&2, V.ViewNode>:
  [
    V.viewEl("span", [V.attrClass("work-mark")], Nil{}),
    V.viewEl("span", [V.attrClass("work-title")], [V.viewText(title)]),
    V.viewEl("span", [V.attrClass("work-meta")], [V.viewText(meta)]),
    V.viewEl("span", classHidden("pulse work-dots", isOff(live)), Nil{}),
    V.viewEl("span", [V.attrClass("work-chevron")], Nil{})
  ]

def workHead(live: Bool, expanded: Bool, title: String, meta: String) -> V.ViewNode:
  V.viewEl("button", headAttrs(expanded), workHead.kids(live, title, meta))

# ---------- artigo ----------

def workKids(live: Bool, expanded: Bool, title: String, meta: String, steps: +List<StepRow>) -> List<&2, V.ViewNode>:
  [workHead(live, expanded, title, meta), workSteps(steps)]

def workLog.go(+live: Bool, +expanded: Bool, title: String, meta: String, steps: +List<StepRow>) -> V.ViewNode:
  V.viewEl("article", articleAttrs(live, expanded), workKids(live, expanded, title, meta, steps))

def workLog(row: WorkRow) -> V.ViewNode:
  match row:
    case WorkRow{live, expanded, title, meta, steps}:
      workLog.go(live, expanded, title, meta, steps)

import Base
import msg.bend as M
import view.bend as V

# ---------------------------------------------------------------------------
# Menus do cabeçalho do tutor (ticket #13 da spec de redesenho). Módulo só da
# Mesa: a Conversa tem outro cabeçalho e não importa daqui.
#
# O cabeçalho é uma linha só — título da sessão (abre a lista de sessões da
# matéria), botão do chat lateral, sessão nova e mais opções (`headIds`). O
# título e os três botões são nós vivos do `index.html`; este núcleo devolve os
# itens dos dois menus que abrem dali, e o aplicador (`desk/src/view-host.mjs`)
# monta no DOM:
#   - `newSessionItems`: o motor padrão e o Claude (experimental). Criar
#     uma sessão nunca troca o motor da que está aberta;
#   - `moreItems`: exportar em Markdown, Encerrar por hoje (some só pela flag
#     `desk.endDay`), o encaixe do uso de contexto, o interruptor da
#     compactação automática, Resumir agora e recolher o tutor;
#   - `indicator` e `popNote` (ticket #14): o indicador de modelo e esforço e
#     o aviso do popover que ele abre. Desde o #42 o indicador mora na fileira
#     da caixa de mensagem, à esquerda do Enviar (a ordem e o degrau em coluna
#     estreita são do `core/composerbox.bend`); o texto continua saindo daqui
#     (modelo e esforço em palavras curtas, ou o estado do tutor quando ele não
#     está ligado); o ponto de conexão, os dois `<select>` e o clique são do
#     host.
#
# Convenções (as de `core/view.bend` e `core/tabsview.bend`): item de menu =
# `button[role=menuitem]` com id estável, `data-icon` como andaime do SVG do
# host e `on:click` com o nome do handler. O estado vivo (medidor, interruptor
# ligado/desligado, rótulo do recolher) é fato do host e entra por atributo
# depois do render.
# ---------------------------------------------------------------------------

# Os controles do cabeçalho, da esquerda para a direita (#42: o indicador de
# modelo saiu daqui para a caixa de mensagem). O host não cria esses nós: o
# teste de janela confere que o cabeçalho é exatamente isto.
def headIds() -> List<&2, String>:
  ["session-title", "sidechat-toggle", "new-session", "chat-more"]

# Item de menu: papel, id, rótulo, glifo e handler. `extra` entra antes do
# ícone e do clique, na ordem dada.
def menuNode(
  id: String, role: String, text: String, icon: String, handler: String, extra: List<&2, V.ViewAttr>
) -> V.ViewNode:
  V.viewEl("button", V.attrJoin([
    [V.attrType("button"), V.attrId(id), V.attr("role", role)],
    extra,
    [V.attrData("icon", icon), V.attrOn("click", handler)]
  ]), [V.viewText(text)])

def item(id: String, text: String, icon: String, handler: String, extra: List<&2, V.ViewAttr>) -> V.ViewNode:
  menuNode(id, "menuitem", text, icon, handler, extra)

# ---------- sessão nova ----------

def newSessionDefault() -> V.ViewNode:
  item("new-session-default", M.msg("header.newSession"), "plus", "NewSession", Nil{})

def newSessionClaude() -> V.ViewNode:
  item(
    "new-session-claude",
    M.msg("header.newSessionClaude"),
    "plus",
    "NewSessionClaude",
    Nil{}
  )

# OpenCode (#57): motor com os modelos grátis do Zen.
def newSessionOpenCode() -> V.ViewNode:
  item(
    "new-session-opencode",
    M.msg("header.newSessionOpenCode"),
    "plus",
    "NewSessionOpenCode",
    Nil{}
  )

def newSessionItems() -> List<&2, V.ViewNode>:
  [newSessionDefault(), newSessionClaude(), newSessionOpenCode()]

# ---------- mais opções ----------

def exportItem() -> V.ViewNode:
  item("export-chat", M.msg("header.export"), "download", "ExportSession", Nil{})

def endDayItem(endDay: Bool) -> V.ViewNode:
  item(
    "end-day",
    M.msg("header.endDay"),
    "moon",
    "OpenEndDay",
    V.attrWhen(Bool.not(endDay), V.attr("hidden", ""))
  )

# O uso de contexto é leitura, não ação: uma linha com o encaixe onde o host
# põe o medidor vivo e o texto de "ainda sem medição".
def contextRow() -> V.ViewNode:
  V.viewEl("div", [
    V.attrId("more-context"), V.attrClass("more-row"), V.attr("role", "group"),
    V.attr("aria-label", M.msg("header.context"))
  ], [
    V.viewEl("span", [V.attrClass("more-row-label")], [V.viewText(M.msg("header.context"))]),
    V.viewEl("span", [V.attrId("more-context-slot"), V.attrClass("more-row-value")], []),
    V.viewEl("span", [
      V.attrId("more-context-empty"), V.attrClass("more-row-value more-row-fine")
    ], [V.viewText(M.msg("header.contextEmpty"))])
  ])

# Interruptor: o host liga `aria-checked`, `disabled` e o `title` pelo estado
# real do motor (a ação em si é a do botão `auto` do painel de ajustes).
def autoCompactItem() -> V.ViewNode:
  menuNode(
    "more-auto-compact",
    "menuitemcheckbox",
    M.msg("header.autoCompact"),
    "rotateCw",
    "ToggleAutoCompact",
    [V.attr("aria-checked", "false")]
  )

# Resumir o contexto agora: a ação manual que morava no painel "Contexto da
# sessão". O host liga `disabled` e o `title` pela capacidade `compact` do
# motor (o Claude Code experimental não expõe a compactação pela Mesa).
def compactNowItem() -> V.ViewNode:
  item("more-compact-now", M.msg("header.compactNow"), "rotateCw", "CompactNow", Nil{})

def collapseItem() -> V.ViewNode:
  item("chat-collapse", M.msg("header.collapse"), "chevronRight", "ToggleTutor", Nil{})

def moreItems(endDay: Bool) -> List<&2, V.ViewNode>:
  [
    exportItem(), endDayItem(endDay), contextRow(), autoCompactItem(),
    compactNowItem(), collapseItem()
  ]

# ---------- indicador de modelo e esforço (ticket #14) ----------
#
# Um botão na fileira da caixa de mensagem (#42; antes, no cabeçalho) diz o
# modelo e o esforço em uso e abre o popover onde se trocam. O ponto de conexão mora dentro dele (o host põe o `#status-dot`
# vivo antes do texto); aqui fica só o texto e os atributos.

def levelKey.if(hit: Bool, key: String, rest: String) -> String:
  match hit:
    case True{}:
      key
    case False{}:
      rest

# Esforço: a chave do catálogo da palavra curta ("level.medium" → "médio" /
# "medium"; o `<select>` usa os rótulos de lista). Um id que o núcleo não
# conhece segue como veio: `{level:key}` deixa passar o que não é chave.
def levelKey(+level: String) -> String:
  levelKey.if(String.eq(level, "default"), "level.default",
  levelKey.if(String.eq(level, "off"), "level.off",
  levelKey.if(String.eq(level, "minimal"), "level.minimal",
  levelKey.if(String.eq(level, "low"), "level.low",
  levelKey.if(String.eq(level, "medium"), "level.medium",
  levelKey.if(String.eq(level, "high"), "level.high",
  levelKey.if(String.eq(level, "xhigh"), "level.xhigh",
  levelKey.if(String.eq(level, "max"), "level.max", level))))))))

# O esforço como texto: a palavra no idioma da interface.
def levelWord(+level: String) -> String:
  M.msg1("indicator.level", "level", levelKey(level))

def modelWord.strip(strip: Bool, name: String) -> String:
  match strip:
    case True{}:
      String.trim(String.drop(name, 7n))
    case False{}:
      name

# O prefixo "Claude " é ruído no cabeçalho ("Sonnet 4.5", não "Claude Sonnet
# 4.5"); o provedor nunca entra (o host passa só o nome).
def modelWord(+name: String) -> String:
  modelWord.strip(String.starts_with(name, "Claude "), name)

def hasText(+text: String) -> Bool:
  Bool.not(String.is_empty(text))

# Modelo e esforço juntos ("Sonnet · médio"); só um deles, ele só; nenhum, vazio.
# `model` já vem sem o prefixo "Claude " (`modelWord`); `level` é o id do motor.
def pairText.pick(hasModel: Bool, hasLevel: Bool, model: String, level: String) -> String:
  match hasModel:
    case True{}:
      match hasLevel:
        case True{}:
          M.msg2("indicator.pair", "model", model, "level", levelKey(level))
        case False{}:
          model
    case False{}:
      match hasLevel:
        case True{}:
          levelWord(level)
        case False{}:
          ""

def pairText(+model: String, +level: String) -> String:
  pairText.pick(hasText(model), hasText(level), model, level)

# O rótulo do ponto de conexão quando o host não traz um (ligado × desligado):
# é a única fonte desses dois textos; o host só pergunta.
def linkLabel(online: Bool) -> String:
  match online:
    case True{}:
      M.msg("tutor.link.on")
    case False{}:
      M.msg("tutor.link.off")

def statusText.pick(empty: Bool, status: String) -> String:
  match empty:
    case True{}:
      linkLabel(False{})
    case False{}:
      status

def statusText(+status: String) -> String:
  statusText.pick(String.is_empty(status), status)

# Ligado e com modelo ou esforço conhecido: o indicador fala do modelo. Fora
# disso fala do estado do tutor (o rótulo que o host já usa no ponto).
def indicatorLive(+online: Bool, +model: String, +level: String) -> Bool:
  Bool.and(online, Bool.or(hasText(modelWord(model)), hasText(level)))

def indicatorLabel.pick(live: Bool, pair: String, status: String) -> String:
  match live:
    case True{}:
      pair
    case False{}:
      status

def indicatorLabel(+online: Bool, +status: String, +model: String, +level: String) -> String:
  indicatorLabel.pick(
    indicatorLive(online, model, level),
    pairText(modelWord(model), level),
    statusText(status)
  )

def indicatorState(online: Bool) -> String:
  match online:
    case True{}:
      "on"
    case False{}:
      "off"

# A dica (e o nome acessível) do indicador. Ligado: o par, ou o que houver dele;
# fora disso o estado do tutor. Cada forma é uma frase do catálogo, porque o
# modelo e o esforço entram no meio dela e o esforço se traduz sozinho.
def indicatorHint.live(hasModel: Bool, hasLevel: Bool, model: String, level: String) -> String:
  match hasModel:
    case True{}:
      match hasLevel:
        case True{}:
          M.msg2("indicator.hint.pair", "model", model, "level", levelKey(level))
        case False{}:
          M.msg1("indicator.hint.model", "model", model)
    case False{}:
      M.msg1("indicator.hint.level", "level", levelKey(level))

def indicatorHint.off(noStatus: Bool, status: String) -> String:
  match noStatus:
    case True{}:
      M.msg("indicator.hint.off")
    case False{}:
      M.msg1("indicator.hint.status", "status", status)

def indicatorHint.pick(live: Bool, +model: String, +level: String, +status: String) -> String:
  match live:
    case True{}:
      indicatorHint.live(hasText(model), hasText(level), model, level)
    case False{}:
      indicatorHint.off(String.is_empty(status), status)

def indicatorHint(+online: Bool, +status: String, +model: String, +level: String) -> String:
  indicatorHint.pick(indicatorLive(online, model, level), modelWord(model), level, status)

# O texto do indicador em duas partes (#27): o modelo e o esforço ("· médio").
# Sem espaço o esforço cai para a segunda linha do texto (que a folha de estilo
# recorta) e o nome do modelo fica inteiro — antes o par era cortado em "Pi de
# t…"; o rótulo acessível e a dica seguem com o par completo. Sem nome de
# modelo o esforço vira a parte do modelo, para nunca sobrar só o separador. O
# estado do tutor (desligado, sem resposta) é uma parte só, a do modelo.
def indicatorModelPart.pick(noModel: Bool, model: String, level: String) -> String:
  match noModel:
    case True{}:
      levelWord(level)
    case False{}:
      model

def indicatorModelPart(+model: String, +level: String) -> String:
  indicatorModelPart.pick(String.is_empty(modelWord(model)), modelWord(model), level)

def indicatorLevelPart.pick(none: Bool, level: String) -> List<&2, V.ViewNode>:
  match none:
    case True{}:
      Nil{}
    case False{}:
      [V.viewText(" · "), V.viewText(levelWord(level))]

def indicatorLevelPart(+model: String, +level: String) -> List<&2, V.ViewNode>:
  indicatorLevelPart.pick(
    Bool.or(String.is_empty(modelWord(model)), String.is_empty(level)),
    level
  )

def indicatorKids.pick(live: Bool, model: String, levelKids: List<&2, V.ViewNode>, status: String) -> List<&2, V.ViewNode>:
  match live:
    case True{}:
      [
        V.viewEl("span", [V.attrClass("mi-model")], [V.viewText(model)]),
        V.viewEl("span", [V.attrClass("mi-level")], levelKids)
      ]
    case False{}:
      [V.viewEl("span", [V.attrClass("mi-model")], [V.viewText(status)])]

def indicatorKids(+online: Bool, +status: String, +model: String, +level: String) -> List<&2, V.ViewNode>:
  indicatorKids.pick(
    indicatorLive(online, model, level),
    indicatorModelPart(model, level),
    indicatorLevelPart(model, level),
    statusText(status)
  )

def indicator(+online: Bool, +status: String, +model: String, +level: String) -> V.ViewNode:
  +hint = indicatorHint(online, status, model, level)
  V.viewEl("button", [
    V.attrType("button"), V.attrId("model-indicator"), V.attrClass("model-indicator"),
    V.attr("aria-haspopup", "dialog"), V.attrAria("controls", "model-pop"),
    V.attrAria("label", hint), V.attrData("tip", hint),
    V.attrData("state", indicatorState(online)), V.attrOn("click", "ToggleModelPop")
  ], [
    V.viewEl("span", [V.attrClass("mi-text")], indicatorKids(online, status, model, level))
  ])

# ---------- aviso do popover ----------
#
# Os dois campos (Modelo, Esforço) são nós vivos do host. Este aviso aparece
# no lugar deles quando não há o que escolher: tutor desligado (com o botão de
# chamar) ou motor que não troca nada. Ligado e escolhável, ele some.

def noteLead.pick(online: Bool, status: String) -> String:
  match online:
    case True{}:
      M.msg("popnote.fixed")
    case False{}:
      statusText(status)

def noteBody(online: Bool) -> String:
  match online:
    case True{}:
      M.msg("popnote.fixedBody")
    case False{}:
      M.msg("popnote.offBody")

def popNote(+online: Bool, +connecting: Bool, +canPick: Bool, +status: String) -> V.ViewNode:
  V.viewEl("div", V.attrJoin([
    [V.attrId("model-pop-note"), V.attrClass("model-pop-note")],
    V.attrWhen(Bool.and(online, canPick), V.attr("hidden", ""))
  ]), [
    V.viewEl("p", [V.attrClass("model-pop-lead")], [V.viewText(noteLead.pick(online, status))]),
    V.viewEl("p", [V.attrClass("fine")], [V.viewText(noteBody(online))]),
    V.viewEl("button", V.attrJoin([
      [V.attrType("button"), V.attrId("model-pop-connect"), V.attrOn("click", "ConnectTutor")],
      V.attrWhen(Bool.or(online, connecting), V.attr("hidden", ""))
    ]), [V.viewText(M.msg("tutor.connect"))])
  ])

# ---------- nome da sessão (#27) ----------
# O rótulo do host abre com a data ("10/10, 13:27 · assunto") e a lista já
# mostra a data na linha de meta; o nome mostra só o assunto. Sessão sem
# assunto levava o nome "Sessão" para todas e duas ficavam iguais: aí o nome
# traz a data e a hora dela ("Sessão de 10/10, 13:27"). O host separa o
# rótulo em assunto e data (fatos, a data já no formato do idioma) e o núcleo
# decide o texto.
def sessionName.dated(+when: String) -> String:
  M.msg1("session.dated", "when", when)

def sessionName.noSubject(noWhen: Bool, when: String) -> String:
  match noWhen:
    case True{}:
      M.msg("session.untitled")
    case False{}:
      sessionName.dated(when)

def sessionName.pick(empty: Bool, subject: String, +when: String) -> String:
  match empty:
    case False{}:
      subject
    case True{}:
      sessionName.noSubject(String.is_empty(when), when)

def sessionName(+subject: String, +when: String) -> String:
  sessionName.pick(String.is_empty(subject), subject, when)

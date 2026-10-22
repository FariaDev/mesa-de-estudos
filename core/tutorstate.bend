import Base
import msg.bend as M
import view.bend as V
import resume.bend as R

# ---------------------------------------------------------------------------
# Estados do tutor na coluna (ticket #17 da spec de redesenho). Módulo só da
# Mesa: a Conversa tem outro vazio (`core/welcomeview.bend`) e não importa
# daqui.
#
# Tutor desligado, ligando e sem resposta são CONTEÚDO da coluna do tutor, não
# diálogos nem texto solto. O host entrega os fatos já resolvidos e este núcleo
# devolve a árvore do bloco `#tutor-state`, que o `desk/src/tutor-state.mjs`
# monta (`src/view-host.mjs`) logo abaixo das mensagens:
#
#   - ligando: "Chamando o tutor" com Cancelar. Vale mesmo com retomada
#     guardada: chamar o tutor é o que está acontecendo;
#   - sem resposta: "O tutor não atendeu." e o motivo devolvido pelo motor em
#     uma frase, com Chamar de novo, Ver o log e Ajustes do Pi;
#   - sem resposta porque o Claude Code está fora da faixa aceita (#51): a
#     frase do catálogo (versão encontrada e faixa) e o conserto na frente —
#     Atualizar Claude Code ou Abrir o Sobre —, com Chamar de novo e Ver o log;
#   - desligado COM retomada guardada: onde a pessoa parou (linha em destaque)
#     e o próximo passo (linha menor e apagada), com Retomar, Sessão nova e
#     Esquecer. Ligado e com retomada guardada, o MESMO bloco segue à vista
#     (é o que o cartão da retomada já fazia: ela só some no Retomar/Esquecer);
#   - desligado SEM retomada: só o convite para chamar o tutor;
#   - ligado e sem retomada: nada (o bloco fica escondido).
#
# A casca é a mesma nos estados com ações — um `ts-text` (linha em destaque e,
# se houver, a linha de apoio) e um `ts-actions` —, de modo que a distância
# entre o texto e os botões e entre os botões e a caixa de mensagem é uma só,
# decidida no CSS. O nome do handler de cada botão é da tabela do host.
#
# O que não cabe aqui: conectar, cancelar, abrir o log ou os ajustes. Cada botão
# só nomeia o handler; o host decide o que acontece. O motivo chega já em uma
# frase (o host tira a primeira linha/frase da mensagem do motor); o núcleo só
# aplica o teto e a frase de reserva.
# ---------------------------------------------------------------------------

# ---------- motivo ----------

def maxReason() -> Nat:
  160n

def reasonFallback() -> String:
  M.msg("tutor.reason.fallback")

def reasonLine.pick(blank: Bool, text: String) -> String:
  match blank:
    case True{}:
      reasonFallback()
    case False{}:
      text

# O motor que sai com um código (`tutor.error.stopped`, com o número) não diz
# nada a quem estuda: a tela conta o que aconteceu e o número fica no log da
# Mesa (#27). Vale também para a queda no meio da sessão (`tutor.error.lost`).
# Desde a #41 o host entrega esses motivos como mensagem do catálogo: o núcleo
# os reconhece pela CHAVE, não por um trecho de frase que mudaria com o idioma.
def exitKey() -> String:
  "tutor.error.stopped"

def exitReason() -> String:
  M.msg("tutor.reason.exit")

def reasonLine.cut(+text: String) -> String:
  reasonLine.pick(String.is_empty(String.trim(text)), R.cutLine(String.trim(text), maxReason()))

# Mensagem do catálogo vai inteira (cortá-la partiria os argumentos); o resto é
# o texto do motor, aparado e cortado em `maxReason()`.
def reasonLine.plain(isMsg: Bool, +text: String) -> String:
  match isMsg:
    case True{}:
      text
    case False{}:
      reasonLine.cut(text)

def reasonLine.exit(isExit: Bool, +text: String) -> String:
  match isExit:
    case True{}:
      exitReason()
    case False{}:
      reasonLine.plain(M.isMsg(text), text)

# O motivo aparado e cortado em `maxReason()`; vazio cai na frase de reserva.
def reasonLine(+raw: String) -> String:
  reasonLine.exit(String.contains(raw, exitKey()), raw)

# O motor não foi achado (`tutor.error.piMissing`: "Tutor não encontrado. Rode
# npm run setup …"): chamar de novo não adianta antes de ajustar o caminho — é a
# mesma causa da primeira abertura sem o Pi, e a ação principal é a mesma (#27).
def piMissingKey() -> String:
  "tutor.error.piMissing"

def piMissing(+reason: String) -> Bool:
  String.contains(reason, piMissingKey())

# ---------- peças ----------

def button(id: String, kind: String, label: String, title: String, handler: String) -> V.ViewNode:
  V.viewEl("button", [
    V.attrType("button"), V.attrId(id), V.attrClass(kind), V.attrTitle(title),
    V.attrOn("click", handler)
  ], [V.viewText(label)])

def leadView(kids: List<&2, V.ViewNode>) -> V.ViewNode:
  V.viewEl("p", [V.attrClass("ts-lead")], kids)

def fineView(text: String) -> V.ViewNode:
  V.viewEl("p", [V.attrClass("ts-fine")], [V.viewText(text)])

def textView(lead: V.ViewNode, fine: List<&2, V.ViewNode>) -> V.ViewNode:
  V.viewEl("div", [V.attrClass("ts-text")], Con{lead, fine})

def actionsView(buttons: List<&2, V.ViewNode>) -> V.ViewNode:
  V.viewEl("div", [V.attrClass("ts-actions")], buttons)

def rootView(key: String, extra: List<&2, V.ViewAttr>, kids: List<&2, V.ViewNode>) -> V.ViewNode:
  V.viewEl("div", V.attrJoin([
    [V.attrId("tutor-state"), V.attrClass("tutor-state"), V.attrData("state", key)],
    extra
  ]), kids)

# Casca comum: o texto (destaque + apoio) e as ações.
def shell(key: String, extra: List<&2, V.ViewAttr>, lead: V.ViewNode, fine: List<&2, V.ViewNode>, buttons: List<&2, V.ViewNode>) -> V.ViewNode:
  rootView(key, extra, [textView(lead, fine), actionsView(buttons)])

def say(text: String) -> List<&2, V.ViewNode>:
  [V.viewText(text)]

# ---------- estados ----------

def inviteView() -> V.ViewNode:
  shell(
    "off",
    Nil{},
    leadView(say(M.msg("tutor.off.lead"))),
    [fineView(M.msg("tutor.off.fine"))],
    [button("connect", "ts-primary", M.msg("tutor.connect"), M.msg("tutor.connectTitle"), "Connect")]
  )

# Pontos que pulsam: o CSS anima; para leitor de tela é só o texto ao lado.
def dotsView() -> V.ViewNode:
  V.viewEl("span", [V.attrClass("ts-dots"), V.attrAria("hidden", "true")], [
    V.viewEl("span", Nil{}, Nil{}),
    V.viewEl("span", Nil{}, Nil{}),
    V.viewEl("span", Nil{}, Nil{})
  ])

def connectingView() -> V.ViewNode:
  shell(
    "connecting",
    [V.attr("role", "status")],
    leadView([dotsView(), V.viewText(M.msg("tutor.connecting"))]),
    Nil{},
    [button("connect-cancel", "ts-secondary", M.msg("tutor.cancel"), M.msg("tutor.cancelTitle"), "Cancel")]
  )

def failedActions(missing: Bool) -> List<&2, V.ViewNode>:
  match missing:
    case True{}:
      [
        button("state-pi", "ts-primary", M.msg("tutor.piSettings"), M.msg("tutor.piSettingsTitle"), "OpenPiSettings"),
        button("connect", "ts-secondary", M.msg("tutor.retry"), M.msg("tutor.retryTitle"), "Connect"),
        button("state-log", "ts-ghost", M.msg("tutor.log"), M.msg("tutor.logTitle"), "OpenLog")
      ]
    case False{}:
      [
        button("connect", "ts-primary", M.msg("tutor.retry"), M.msg("tutor.retryTitle"), "Connect"),
        button("state-log", "ts-secondary", M.msg("tutor.log"), M.msg("tutor.logTitle"), "OpenLog"),
        button("state-pi", "ts-ghost", M.msg("tutor.piSettings"), M.msg("tutor.piSettingsTitle"), "OpenPiSettings")
      ]

def failedView(+reason: String) -> V.ViewNode:
  shell(
    "error",
    Nil{},
    leadView(say(M.msg("tutor.failed.lead"))),
    [fineView(reasonLine(reason))],
    failedActions(piMissing(reason))
  )

# ---------- Claude Code fora da faixa (#51) ----------

# O conserto vem do núcleo `claudeversion.bend` (`fixFor`): "update" para
# versão anterior ao mínimo ou ilegível, "about" para série nova. O motivo
# chega como mensagem do catálogo (o host traduz) e entra inteiro: sem o corte
# de `reasonLine`, que partiria os argumentos.
def claudeFixButton(about: Bool) -> V.ViewNode:
  match about:
    case True{}:
      button("state-claude-about", "ts-primary", M.msg("tutor.claude.about"), M.msg("tutor.claude.aboutTitle"), "OpenAbout")
    case False{}:
      button("state-claude-update", "ts-primary", M.msg("tutor.claude.update"), M.msg("tutor.claude.updateTitle"), "UpdateClaude")

def claudeFixView(+fix: String, reason: String) -> V.ViewNode:
  shell(
    "error",
    [V.attrData("fix", fix)],
    leadView(say(M.msg("tutor.failed.lead"))),
    [fineView(reason)],
    [
      claudeFixButton(String.eq(fix, "about")),
      button("connect", "ts-secondary", M.msg("tutor.retry"), M.msg("tutor.retryTitle"), "Connect"),
      button("state-log", "ts-ghost", M.msg("tutor.log"), M.msg("tutor.logTitle"), "OpenLog")
    ]
  )

def errorView(noFix: Bool, +fix: String, +reason: String) -> V.ViewNode:
  match noFix:
    case True{}:
      failedView(reason)
    case False{}:
      claudeFixView(fix, reason)

def resumeView(exercise: String, stopped: String, next: String) -> V.ViewNode:
  shell(
    "resume",
    Nil{},
    leadView(R.resumeLeadKids(exercise, stopped)),
    [fineView(R.resumeNextLabel(next))],
    [
      button("resume-go", "ts-primary", R.resumeGoLabel(), R.resumeGoTitle(), "Resume"),
      button("resume-new", "ts-secondary", R.resumeNewLabel(), R.resumeNewTitle(), "NewSession"),
      button("resume-forget", "ts-ghost", R.resumeForgetLabel(), R.resumeForgetTitle(), "Forget")
    ]
  )

# Ligado e sem retomada: o bloco existe (o host o troca no lugar) e fica
# escondido, sem filhos.
def noneView() -> V.ViewNode:
  rootView("none", [V.attr("hidden", "")], Nil{})

# ---------- texto da caixa de mensagem por estado (#27) ----------

# O campo diz o que acontece se a pessoa escrever agora: desligado, o tutor liga
# para responder; ligando ou sem resposta, a mensagem fica guardada e vai assim
# que ele atender; ligado, a frase de sempre. Na primeira abertura (#64, tela
# cheia) a caixa fica atrás da tela de passos e não passa por aqui.
def hintOnline() -> String:
  M.msg("composer.hint.online")

def hintOff() -> String:
  M.msg("composer.hint.off")

def hintCalling() -> String:
  M.msg("composer.hint.calling")

def composerHint.online(online: Bool) -> String:
  match online:
    case True{}:
      hintOnline()
    case False{}:
      hintOff()

def composerHint.calling(calling: Bool, online: Bool) -> String:
  match calling:
    case True{}:
      hintCalling()
    case False{}:
      composerHint.online(online)

# O estado do ponto de conexão (`off`, `connecting`, `error` ou `online`;
# qualquer outro vale `off`).
def composerHint(+link: String) -> String:
  composerHint.calling(
    Bool.or(String.eq(link, "connecting"), String.eq(link, "error")),
    String.eq(link, "online")
  )

# ---------- escolha ----------

def offView(hasRecord: Bool, exercise: String, stopped: String, next: String) -> V.ViewNode:
  match hasRecord:
    case True{}:
      resumeView(exercise, stopped, next)
    case False{}:
      inviteView()

def onlineView(hasRecord: Bool, exercise: String, stopped: String, next: String) -> V.ViewNode:
  match hasRecord:
    case True{}:
      resumeView(exercise, stopped, next)
    case False{}:
      noneView()

def idleView(online: Bool, hasRecord: Bool, exercise: String, stopped: String, next: String) -> V.ViewNode:
  match online:
    case True{}:
      onlineView(hasRecord, exercise, stopped, next)
    case False{}:
      offView(hasRecord, exercise, stopped, next)

def stateView.failed(failed: Bool, online: Bool, reason: String, +fix: String, hasRecord: Bool, exercise: String, stopped: String, next: String) -> V.ViewNode:
  match failed:
    case True{}:
      errorView(String.is_empty(fix), fix, reason)
    case False{}:
      idleView(online, hasRecord, exercise, stopped, next)

def stateView.connecting(connecting: Bool, failed: Bool, online: Bool, reason: String, fix: String, hasRecord: Bool, exercise: String, stopped: String, next: String) -> V.ViewNode:
  match connecting:
    case True{}:
      connectingView()
    case False{}:
      stateView.failed(failed, online, reason, fix, hasRecord, exercise, stopped, next)

# O bloco da coluna para os fatos do host: o estado do ponto de conexão
# (`off`, `connecting`, `error` ou `online`; qualquer outro vale `off`), o
# motivo do erro, e a retomada guardada (se há, a questão, onde parou e o
# próximo passo). Ligando e sem resposta vêm antes da retomada.
def stateView(+link: String, reason: String, hasRecord: Bool, exercise: String, stopped: String, next: String) -> V.ViewNode:
  stateView.connecting(
    String.eq(link, "connecting"),
    String.eq(link, "error"),
    String.eq(link, "online"),
    reason, "", hasRecord, exercise, stopped, next
  )

# O mesmo bloco quando o motivo do erro tem conserto (`fix`, de
# `claudeversion.fixFor`: "update", "about" ou "" para nenhum). Vazio é
# exatamente `stateView`.
def stateViewFix(+link: String, reason: String, fix: String, hasRecord: Bool, exercise: String, stopped: String, next: String) -> V.ViewNode:
  stateView.connecting(
    String.eq(link, "connecting"),
    String.eq(link, "error"),
    String.eq(link, "online"),
    reason, fix, hasRecord, exercise, stopped, next
  )

import Base
import msg.bend as M
import view.bend as V

# ---------------------------------------------------------------------------
# Avisos de atualização do Pi e do Claude Code (ticket #45).
#
# O host entrega FATOS — as versões já lidas (`claude --version`, o pacote do
# Pi, o registry), a tabela "testada com esta Mesa", a memória do `desk.json` e
# o dia de hoje — e o núcleo decide o que aparece:
#   - a linha no topo do Sobre ("Pi 1.3.0 disponível");
#   - o ponto no ⚙ da barra superior;
#   - o "mais nova que a testada";
#   - o que "Lembrar depois" e "Ignorar esta versão" passam a lembrar.
#
# Versão é `Ver{major, minor, patch}` estrita (X.Y.Z); o que o host não leu ou
# não consegue ler (sem rede, prerelease, texto estranho) chega como `NoVer{}`.
# Sem rede NÃO é erro: `noticeOf` devolve `unreachable` e nada mais — o Sobre
# diz "não deu para conferir" e o ponto não acende.
#
# O dia é o número de dias desde 1970 (U32 cabe; milissegundos não): "Lembrar
# depois" guarda o dia em que o aviso volta.
# ---------------------------------------------------------------------------

type Ver is Data:
  Ver{major: U32, minor: U32, patch: U32}
  NoVer{}

def isVer(v: Ver) -> Bool:
  match v:
    case NoVer{}:
      False{}
    case Ver{_, _, _}:
      True{}

def tripleNewer(+am: U32, +an: U32, +ap: U32, +bm: U32, +bn: U32, +bp: U32) -> Bool:
  Bool.or(
    U32.is_gt(am, bm),
    Bool.and(
      U32.is_eq(am, bm),
      Bool.or(U32.is_gt(an, bn), Bool.and(U32.is_eq(an, bn), U32.is_gt(ap, bp)))
    )
  )

# a > b, estritamente; sem versão de um dos lados nunca é "mais nova".
def verNewer(a: Ver, b: Ver) -> Bool:
  match a:
    case NoVer{}:
      False{}
    case Ver{am, an, ap}:
      match b:
        case NoVer{}:
          False{}
        case Ver{bm, bn, bp}:
          tripleNewer(am, an, ap, bm, bn, bp)

def verPick(c: Bool, a: Ver, b: Ver) -> Ver:
  match c:
    case True{}:
      a
    case False{}:
      b

# Sem versão do lado de `a`, vence `b` (a memória vazia aprende a primeira).
def verMax(+a: Ver, +b: Ver) -> Ver:
  verPick(Bool.or(Bool.not(isVer(a)), verNewer(b, a)), b, a)

# ---------- memória (desk.json) ----------

# `seen`: a maior versão disponível que a pessoa já viu ao abrir o Sobre.
# `ignored`: a versão que ela mandou ignorar (vale para ela e para as menores).
# `remindDay`: o dia em que o "Lembrar depois" deixa de calar; 0 = nada.
type Memory is Data:
  Memory{seen: Ver, ignored: Ver, remindDay: U32}

def emptyMemory() -> Memory:
  Memory{NoVer{}, NoVer{}, 0}

# ---------- a decisão ----------

# available:   há versão mais nova que a instalada;
# unreachable: não deu para saber a versão mais nova (sem rede é normal);
# showLine:    a linha do Sobre aparece (disponível, nem ignorada nem adiada);
# showDot:     o ponto do ⚙ acende (linha visível e versão que ela ainda não viu);
# ahead:       a versão em jogo (a oferecida, ou a instalada) passa da testada.
type Notice is Data:
  Notice{available: Bool, unreachable: Bool, showLine: Bool, showDot: Bool, ahead: Bool}

def ignoredCovers(latest: Ver, +ignored: Ver) -> Bool:
  Bool.and(isVer(ignored), Bool.not(verNewer(latest, ignored)))

def newerThanSeen(+latest: Ver, +seen: Ver) -> Bool:
  Bool.or(Bool.not(isVer(seen)), verNewer(latest, seen))

def targetVersion(available: Bool, latest: Ver, installed: Ver) -> Ver:
  verPick(available, latest, installed)

def noticeFrom(+available: Bool, unreachable: Bool, +quiet: Bool, newer: Bool, ahead: Bool) -> Notice:
  Notice{
    available,
    unreachable,
    Bool.and(available, Bool.not(quiet)),
    Bool.and(Bool.and(available, Bool.not(quiet)), newer),
    ahead
  }

def noticeOf(+installed: Ver, +latest: Ver, tested: Ver, m: Memory, today: U32) -> Notice:
  match m:
    case Memory{seen, ignored, remindDay}:
      noticeFrom(
        verNewer(latest, installed),
        Bool.not(isVer(latest)),
        Bool.or(ignoredCovers(latest, ignored), U32.is_lt(today, remindDay)),
        newerThanSeen(latest, seen),
        verNewer(targetVersion(verNewer(latest, installed), latest, installed), tested)
      )

# ---------- o que a pessoa fez ----------

# Abrir o Sobre vê a versão disponível: o ponto só volta com uma mais nova.
def seenAfterOpen(+seen: Ver, +latest: Ver, available: Bool) -> Ver:
  verPick(available, verMax(seen, latest), seen)

def afterOpen(m: Memory, installed: Ver, +latest: Ver) -> Memory:
  match m:
    case Memory{seen, ignored, remindDay}:
      Memory{seenAfterOpen(seen, latest, verNewer(latest, installed)), ignored, remindDay}

# "Lembrar depois": some até amanhã e, quando voltar, volta como novidade
# (o `seen` é esquecido, então o ponto reacende).
def afterPostpone(m: Memory, today: U32) -> Memory:
  match m:
    case Memory{_, ignored, _}:
      Memory{NoVer{}, ignored, U32.add(today, 1)}

# "Ignorar esta versão": cala esta e as menores; uma mais nova acorda o aviso.
def afterIgnore(m: Memory, latest: Ver) -> Memory:
  match m:
    case Memory{seen, ignored, remindDay}:
      Memory{seen, verMax(ignored, latest), remindDay}

# ---------- texto ----------

def noticeText(name: String, version: String) -> String:
  M.msg2("update.noticeAvailable", "name", name, "version", version)

def aheadText() -> String:
  M.msg("update.ahead")

def offlineText() -> String:
  M.msg("update.offline")

def remindLabel() -> String:
  M.msg("update.remind")

def ignoreLabel() -> String:
  M.msg("update.ignore")

def updateLabel() -> String:
  M.msg("update.update")

def copyLabel() -> String:
  M.msg("common.copy")

def cancelLabel() -> String:
  M.msg("common.cancel")

def closeLabel() -> String:
  M.msg("common.close")

def waitHint() -> String:
  M.msg("update.waitHint")

def waitShort() -> String:
  M.msg("update.waitShort")

def settingsTitle(dot: Bool) -> String:
  match dot:
    case True{}:
      M.msg("chrome.settings.withUpdate")
    case False{}:
      M.msg("chrome.settings")

def aheadWarning(version: String, tested: String) -> String:
  M.msg2("update.aheadWarning", "version", version, "tested", tested)

def runningText() -> String:
  M.msg("update.running")

def willRunText() -> String:
  M.msg("update.willRun")

def relinkedText() -> String:
  M.msg("update.relinked")

# A frase do resultado, uma só. `after` sem versão (o host não conseguiu ler)
# nunca é chamada de sucesso; igual à de antes diz que nada mudou (o gerenciador
# pode ainda não ter a versão nova).
def doneSentence.same(name: String, before: String) -> String:
  M.msg2("update.sameVersion", "name", name, "version", before)

def doneSentence.changed(name: String, after: String, relinked: Bool) -> String:
  match relinked:
    case True{}:
      M.msg2("update.updatedRelinked", "name", name, "version", after)
    case False{}:
      M.msg2("update.updated", "name", name, "version", after)

def doneSentence.improved(name: String, before: String, after: String, relinked: Bool, improved: Bool) -> String:
  match improved:
    case True{}:
      doneSentence.changed(name, after, relinked)
    case False{}:
      doneSentence.same(name, before)

def doneSentence.known(name: String, before: String, after: String, relinked: Bool, known: Bool, improved: Bool) -> String:
  match known:
    case False{}:
      M.msg1("update.unreadable", "name", name)
    case True{}:
      doneSentence.improved(name, before, after, relinked, improved)

def doneSentence.ok(name: String, beforeV: Ver, +afterV: Ver, before: String, after: String, relinked: Bool) -> String:
  doneSentence.known(name, before, after, relinked, isVer(afterV), verNewer(afterV, beforeV))

def doneSentence(name: String, ok: Bool, beforeV: Ver, afterV: Ver, before: String, after: String, relinked: Bool) -> String:
  match ok:
    case True{}:
      doneSentence.ok(name, beforeV, afterV, before, after, relinked)
    case False{}:
      M.msg1("update.failedRun", "name", name)

# ---------- nós: a linha do topo do Sobre ----------

type NoticeLine is Data:
  NoticeLine{id: String, name: String, version: String, ahead: Bool}

def noticeIcon() -> V.ViewNode:
  V.viewEl("span", [
    V.attrClass("update-icon"),
    V.attrData("state", "new"),
    V.attrAria("hidden", "true")
  ], [V.viewText("↑")])

def noticeButton(id: String, handler: String, label: String) -> V.ViewNode:
  V.viewEl("button", [
    V.attrType("button"),
    V.attrClass("notice-btn"),
    V.attrData("id", id),
    V.attrOn("click", handler)
  ], [V.viewText(label)])

def noticeLineText(+name: String, +version: String, ahead: Bool) -> V.ViewNode:
  V.viewEl("p", [V.attrClass("update-text")], V.viewJoin([
    [V.viewEl("span", [V.attrClass("update-main")], [V.viewText(noticeText(name, version))])],
    V.viewWhen(ahead, V.viewEl("span", [V.attrClass("update-muted")], [V.viewText(" · "), V.viewText(aheadText())]))
  ]))

def noticeLineBody(+id: String, name: String, version: String, ahead: Bool, leading: List<&2, V.ViewNode>) -> V.ViewNode:
  V.viewEl("div", [V.attrClass("about-notice"), V.attrData("id", id)], V.viewJoin([
    [noticeIcon(), noticeLineText(name, version, ahead)],
    leading,
    [
      noticeButton(id, "PostponeNotice", remindLabel()),
      noticeButton(id, "IgnoreNotice", ignoreLabel())
    ]
  ]))

def noticeLineNode(l: NoticeLine) -> V.ViewNode:
  match l:
    case NoticeLine{id, name, version, ahead}:
      noticeLineBody(id, name, version, ahead, Nil{})

def noticeLines(ls: List<&2, NoticeLine>) -> List<&2, V.ViewNode>:
  match ls:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      Con{noticeLineNode(h), noticeLines(t)}

# ---------- onde a linha mora (ticket #52) ----------

# O ponto do ⚙ leva a quem abre o ⚙: o menu abre as Configurações e o Sobre.
# A linha mora nas DUAS superfícies — no Sobre como sempre; nas Configurações,
# no topo, com um "Ver no Sobre" que leva ao "Atualizar" (a ação mora na linha
# do componente, no Sobre). Abrir uma superfície que mostra a linha é "ver":
# o ponto se apaga (`afterOpen`) quando a linha fica visível, em qualquer uma.
type Surface is Data:
  About{}
  Settings{}

def showsNotice(s: Surface) -> Bool:
  match s:
    case About{}:
      True{}
    case Settings{}:
      True{}

# `lineVisible`: o host tem linha para mostrar (disponível, nem ignorada nem adiada).
def seesLine(s: Surface, lineVisible: Bool) -> Bool:
  Bool.and(showsNotice(s), lineVisible)

def seeAboutLabel() -> String:
  M.msg("update.seeAbout")

def seeAboutButton(+id: String) -> V.ViewNode:
  V.viewEl("button", [
    V.attrType("button"),
    V.attrClass("notice-btn"),
    V.attrData("id", id),
    V.attrOn("click", "OpenAboutFromNotice")
  ], [V.viewText(seeAboutLabel())])

def noticeLineFor(s: Surface, l: NoticeLine) -> V.ViewNode:
  match s:
    case About{}:
      noticeLineNode(l)
    case Settings{}:
      match l:
        case NoticeLine{+id, name, version, ahead}:
          noticeLineBody(id, name, version, ahead, [seeAboutButton(id)])

def noticeLinesFor(+s: Surface, ls: List<&2, NoticeLine>) -> List<&2, V.ViewNode>:
  match ls:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      Con{noticeLineFor(s, h), noticeLinesFor(s, t)}

# ---------- nós: a ação da linha de componente ----------

# ToolLocal: o Pi que a Mesa instalou (um botão, como sempre — o host reinicia
# a Mesa). ToolAsk: abre a confirmação com o comando exato. ToolWait: o tutor
# está respondendo, a ação fica desligada. ToolCopy: instalação que a Mesa não
# reconhece, só o comando.
type ToolAction is Data:
  ToolNone{}
  ToolLocal{}
  ToolAsk{command: String}
  ToolWait{command: String}
  ToolCopy{command: String}

def hasAction(a: ToolAction) -> Bool:
  match a:
    case ToolNone{}:
      False{}
    case ToolLocal{}:
      True{}
    case ToolAsk{_}:
      True{}
    case ToolWait{_}:
      True{}
    case ToolCopy{_}:
      True{}

def localButton() -> V.ViewNode:
  V.viewEl("button", [
    V.attrId("update-pi"),
    V.attrType("button"),
    V.attrClass("component-update"),
    V.attrOn("click", "UpdatePi")
  ], [V.viewText(M.msg("update.pi"))])

def askButton(command: String) -> V.ViewNode:
  V.viewEl("button", [
    V.attrType("button"),
    V.attrClass("component-update tool-ask"),
    V.attrData("command", command),
    V.attrOn("click", "AskUpdate")
  ], [V.viewText(updateLabel())])

def waitNodes() -> List<&2, V.ViewNode>:
  [ V.viewEl("button", [
      V.attrType("button"),
      V.attrClass("component-update tool-ask"),
      V.attr("disabled", ""),
      V.attr("title", waitHint()),
      V.attrAria("describedby", "tool-wait-hint")
    ], [V.viewText(updateLabel())])
  , V.viewEl("small", [V.attrClass("component-wait"), V.attrId("tool-wait-hint")], [V.viewText(waitShort())])
  ]

def copyButton(+command: String) -> V.ViewNode:
  V.viewEl("button", [
    V.attrType("button"),
    V.attrClass("component-update tool-copy"),
    V.attrData("command", command),
    V.attrAria("label", M.msg1("update.copyAria", "command", command)),
    V.attrOn("click", "CopyCommand")
  ], [V.viewText(copyLabel())])

def actionNodes(a: ToolAction) -> List<&2, V.ViewNode>:
  match a:
    case ToolNone{}:
      Nil{}
    case ToolLocal{}:
      [localButton()]
    case ToolAsk{command}:
      [askButton(command)]
    case ToolWait{_}:
      waitNodes()
    case ToolCopy{command}:
      [copyButton(command)]

# ---------- nós: a confirmação e a saída ----------

# RunConfirm: o comando exato (e, se a versão passa da testada, o aviso).
# RunBusy: rodando, com a saída que já chegou. RunDone: o resultado em uma frase
# e a saída inteira numa área rolável.
type ToolRun is Data:
  RunNone{}
  RunConfirm{command: String, warning: String}
  RunBusy{command: String, output: String}
  RunDone{ok: Bool, sentence: String, output: String}

def commandNode(command: String) -> V.ViewNode:
  V.viewEl("code", [V.attrClass("run-command")], [V.viewText(command)])

def runLine(label: String, command: String) -> V.ViewNode:
  V.viewEl("p", [V.attrClass("run-line")], [V.viewText(label), commandNode(command)])

def outputNode(+output: String) -> List<&2, V.ViewNode>:
  V.viewWhen(
    Bool.not(String.is_empty(output)),
    V.viewEl("pre", [
      V.attrClass("run-output"),
      V.attr("tabindex", "0"),
      V.attr("role", "log"),
      V.attrAria("label", M.msg("update.outputAria"))
    ], [V.viewText(output)])
  )

def runButton(label: String, handler: String, cls: String) -> V.ViewNode:
  V.viewEl("button", [
    V.attrType("button"),
    V.attrClass(cls),
    V.attrOn("click", handler)
  ], [V.viewText(label)])

def donePhase(ok: Bool) -> String:
  match ok:
    case True{}:
      "done"
    case False{}:
      "failed"

def runPanel(phase: String, kids: List<&2, V.ViewNode>) -> V.ViewNode:
  V.viewEl("div", [
    V.attrClass("component-run"),
    V.attrData("phase", phase),
    V.attr("role", "group")
  ], kids)

def confirmNodes(+command: String, +warning: String) -> V.ViewNode:
  runPanel("confirm", V.viewJoin([
    [runLine(willRunText(), command)],
    V.viewWhen(
      Bool.not(String.is_empty(warning)),
      V.viewEl("p", [V.attrClass("run-warn")], [V.viewText(warning)])
    ),
    [V.viewEl("div", [V.attrClass("run-actions")], [
      runButton(cancelLabel(), "CancelRun", "run-cancel"),
      runButton(updateLabel(), "ConfirmRun", "primary run-confirm")
    ])]
  ]))

def busyNodes(command: String, output: String) -> V.ViewNode:
  V.viewEl("div", [
    V.attrClass("component-run"),
    V.attrData("phase", "busy"),
    V.attr("role", "group"),
    V.attrAria("live", "polite")
  ], V.viewJoin([
    [runLine(runningText(), command)],
    outputNode(output)
  ]))

def doneNodes(ok: Bool, sentence: String, output: String) -> V.ViewNode:
  runPanel(donePhase(ok), V.viewJoin([
    [V.viewEl("p", [V.attrClass("run-line run-result"), V.attr("role", "status")], [V.viewText(sentence)])],
    outputNode(output),
    [V.viewEl("div", [V.attrClass("run-actions")], [runButton(closeLabel(), "CloseRun", "run-close")])]
  ]))

def runNodes(r: ToolRun) -> List<&2, V.ViewNode>:
  match r:
    case RunNone{}:
      Nil{}
    case RunConfirm{command, warning}:
      [confirmNodes(command, warning)]
    case RunBusy{command, output}:
      [busyNodes(command, output)]
    case RunDone{ok, sentence, output}:
      [doneNodes(ok, sentence, output)]

import Base
import msg.bend as M
import view.bend as V
import pdfnav.bend as N
import updatenotice.bend as U

# ---------------------------------------------------------------------------
# Os diálogos da Mesa: as partes dinâmicas dos `<dialog>` do `desk/index.html`.
#
# O casco (o `<dialog>` e o `<form method=dialog>`) continua no HTML estático;
# este núcleo devolve os nós/fatos que o aplicador (`desk/src/dialogs.mjs`)
# cola nos mesmos ids/classes/aria. Nada aqui lê DOM, foca, fala IPC ou
# renderiza markdown:
#   - `#pi-dialog`: título/mensagem como strings cruas (o `markupInline` do
#     chat continua no host), campos (texto/editor/seleção/checkbox) e o ok;
#   - `#end-day-dialog`: o miolo do formulário (rótulos, textareas com valor,
#     ações) — o `<form id="end-day-form">` é do HTML;
#   - `#image-dialog`: título pelo nome do arquivo e ações (copiar/abrir);
#   - `#help-dialog` / `#about-dialog`: versão como fato e os fatos de flag
#     que escondem os itens do texto;
#   - `#settings-dialog`: título/lead ("Bem-vindo" na primeira vez) e as
#     linhas de matéria (nome + pasta + remover/adicionar).
#
# Convenções de attr: as mesmas do `view.bend` (`on:<evento>` vira lookup na
# tabela de handlers do host; `class`/`id` vazios são pulados). Texto que vem
# do Pi entra cru e quem aplica é que resolve markdown/KaTeX.
# ---------------------------------------------------------------------------

# ---------- pi-dialog ----------

# Opção do campo de seleção: rótulo visível e valor enviado.
type DialogOption is Data:
  DialogOption{label: String, value: String}

# Campo do formulário do Pi. O DOM atual é só o controle (sem `<label>` em
# volta); o rótulo, quando existe, vira `aria-label`.
type DialogField is Data:
  FieldText{label: String, value: String, hint: String}
  FieldEditor{label: String, value: String, hint: String}
  FieldPick{label: String, value: String, options: +List<DialogOption>}
  FieldCheck{label: String, value: String, on: Bool}

# ---------- ajuda / sobre ----------

# Fatos do bloco `desk` + plataforma (os mesmos que o `applyDesk` resolve);
# `conferir` desliga também no win32 (o Conferir Xournal++ é só macOS).
type HelpFlags is Data:
  HelpFlags{studyContext: Bool, endDay: Bool, refsToggle: Bool, conferir: Bool}

# O que a ajuda mostra: versão formatada e quais itens do texto somem.
type HelpChrome is Data:
  HelpChrome{version: String, studyHidden: Bool, endDayHidden: Bool, refsHidden: Bool, conferirHidden: Bool}

# ---------- configurações ----------

# Linha de matéria da Configurações: id estável, nome exibido e pasta.
type SettingsCourse is Data:
  SettingsCourse{id: String, name: String, path: String}

# ---------- texto: fallback e nome de arquivo ----------

def textOr.if(raw: String, fallback: String, empty: Bool) -> String:
  match empty:
    case True{}:
      fallback
    case False{}:
      raw

def textOr(+raw: String, fallback: String) -> String:
  textOr.if(raw, fallback, String.is_empty(raw))

def lastPartFrom(m: Maybe<&2, String>) -> String:
  match m:
    case None{}:
      ""
    case Some{h}:
      h

def lastPart(xs: +List<String>) -> String:
  lastPartFrom(List.last(&2, String, xs))

# Segmento final de um caminho — as duas barras (Unix e Windows) separam.
def fileBase(path: String) -> String:
  lastPart(String.split(lastPart(String.split(path, '/')), '\\'))

# ---------- attrs opcionais ----------

def hintAttrs(+hint: String) -> List<&2, V.ViewAttr>:
  V.attrWhen(Bool.not(String.is_empty(hint)), V.ViewAttr{"placeholder", hint})

def valueAttr(+value: String) -> List<&2, V.ViewAttr>:
  V.attrWhen(Bool.not(String.is_empty(value)), V.ViewAttr{"value", value})

def labelAria(+label: String) -> List<&2, V.ViewAttr>:
  V.attrWhen(Bool.not(String.is_empty(label)), V.attrAria("label", label))

# Valor de textarea é o texto do nó — vazio não gera nó.
def textareaKids.if(value: String, empty: Bool) -> List<&2, V.ViewNode>:
  match empty:
    case True{}:
      Nil{}
    case False{}:
      Con{V.viewText(value), Nil{}}

def textareaKids(+value: String) -> List<&2, V.ViewNode>:
  textareaKids.if(value, String.is_empty(value))

# ---------- campos do pi-dialog ----------

def optionNode(selected: String, o: DialogOption) -> V.ViewNode:
  match o:
    case DialogOption{label, +value}:
      V.viewEl("option", V.attrJoin([
        [V.ViewAttr{"value", value}],
        V.attrWhen(String.eq(value, selected), V.ViewAttr{"selected", ""})
      ]), [V.viewText(label)])

def optionNodes.go(+selected: String, xs: List<&2, DialogOption>) -> List<&2, V.ViewNode>:
  match xs:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      Con{optionNode(selected, h), optionNodes.go(selected, t)}

def optionNodes(selected: String, xs: List<&2, DialogOption>) -> List<&2, V.ViewNode>:
  optionNodes.go(selected, xs)

def fieldControl(f: DialogField) -> V.ViewNode:
  match f:
    case FieldText{+label, +value, +hint}:
      V.viewEl("input", V.attrJoin([
        [V.attrId("dialog-value"), V.attrType("text")],
        labelAria(label),
        valueAttr(value),
        hintAttrs(hint)
      ]), Nil{})
    case FieldEditor{+label, +value, +hint}:
      V.viewEl("textarea", V.attrJoin([
        [V.attrId("dialog-value")],
        labelAria(label),
        hintAttrs(hint)
      ]), textareaKids(value))
    case FieldPick{+label, value, +options}:
      V.viewEl(
        "select",
        V.attrJoin([[V.attrId("dialog-value")], labelAria(label)]),
        optionNodes(value, options)
      )
    case FieldCheck{+label, +value, on}:
      V.viewEl("label", Nil{}, [
        V.viewEl("input", V.attrJoin([
          [V.attrId("dialog-value"), V.attrType("checkbox")],
          valueAttr(value),
          V.attrWhen(on, V.ViewAttr{"checked", ""})
        ]), Nil{}),
        V.viewText(label)
      ])

# Filhos do `#dialog-fields` (0 ou 1 campo na fila do Pi).
def piFields(fs: List<&2, DialogField>) -> List<&2, V.ViewNode>:
  match fs:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      Con{fieldControl(h), piFields(t)}

# Título do diálogo: vazio cai em "Tutor".
def piTitle(+raw: String) -> String:
  textOr(raw, M.msg("dialog.tutor"))

# A mensagem entra crua; o host resolve markdown/LaTeX.
def piMessage(raw: String) -> String:
  raw

def dialogOkLabel(+raw: String) -> String:
  textOr(raw, M.msg("dialog.continue"))

# Botão ok do `#pi-dialog`: fecha com `returnValue == "ok"`.
def piOkNode(label: String) -> V.ViewNode:
  V.viewEl("button", [
    V.attrId("dialog-ok"),
    V.attr("value", "ok"),
    V.attrClass("primary")
  ], [V.viewText(dialogOkLabel(label))])

# ---------- end-day-dialog ----------

def endDayTitle() -> String:
  M.msg("dialogs.endDay.title")

def endDayLead() -> String:
  M.msg("dialogs.endDay.lead")

def endDayWhereLabel() -> String:
  M.msg("dialogs.endDay.where")

def endDayNextLabel() -> String:
  M.msg("dialogs.endDay.next")

def endDayCancelLabel() -> String:
  M.msg("common.cancel")

def endDaySaveLabel() -> String:
  M.msg("dialogs.endDay.save")

# `<label>` com o rótulo e a textarea (o `<label>` em volta é o do HTML).
def endDayField(id: String, label: String, value: String) -> V.ViewNode:
  V.viewEl("label", Nil{}, [
    V.viewText(label),
    V.viewEl("textarea", [
      V.attrId(id),
      V.attr("rows", "2"),
      V.attr("required", "")
    ], textareaKids(value))
  ])

def endDayActions() -> V.ViewNode:
  V.viewEl("div", [V.attrClass("dialog-actions")], [
    V.viewEl("button", [
      V.attr("value", "cancel"),
      V.attr("formnovalidate", "")
    ], [V.viewText(endDayCancelLabel())]),
    V.viewEl("button", [
      V.attrId("end-day-save"),
      V.attr("value", "ok"),
      V.attrClass("primary")
    ], [V.viewText(endDaySaveLabel())])
  ])

# Filhos do `#end-day-form` (h2, lead, os dois campos e as ações).
def endDayChildren(whereText: String, nextText: String) -> List<&2, V.ViewNode>:
  [ V.viewEl("h2", Nil{}, [V.viewText(endDayTitle())])
  , V.viewEl("p", [V.attrClass("help-lead")], [V.viewText(endDayLead())])
  , endDayField("end-where", endDayWhereLabel(), whereText)
  , endDayField("end-next", endDayNextLabel(), nextText)
  , endDayActions()
  ]

# ---------- bookmark-dialog (favoritos do leitor) ----------

# O nome vem do host (o diálogo abre pré-preenchido com o que ele sugerir) e a
# dica é o documento com a página: "Limites.pdf, p. 12".
def bookmarkNameInput(value: String) -> V.ViewNode:
  V.viewEl("input", [
    V.attrId("bookmark-name"),
    V.attrType("text"),
    V.attr("value", value),
    V.attr("required", "")
  ], Nil{})

def bookmarkActions() -> V.ViewNode:
  V.viewEl("div", [V.attrClass("dialog-actions")], [
    V.viewEl("button", [
      V.attr("value", "cancel"),
      V.attr("formnovalidate", "")
    ], [V.viewText(N.bookmarkCancelLabel())]),
    V.viewEl("button", [
      V.attrId("bookmark-save"),
      V.attr("value", "ok"),
      V.attrClass("primary")
    ], [V.viewText(N.bookmarkSaveLabel())])
  ])

# Filhos do `#bookmark-form` (h2, dica, campo do nome e ações).
def bookmarkChildren(name: String, hint: String) -> List<&2, V.ViewNode>:
  [ V.viewEl("h2", Nil{}, [V.viewText(N.bookmarkDialogTitle())])
  , V.viewEl("p", [V.attrClass("help-lead")], [V.viewText(hint)])
  , V.viewEl("label", Nil{}, [V.viewText(N.bookmarkNameLabel()), bookmarkNameInput(name)])
  , bookmarkActions()
  ]

# ---------- image-dialog ----------

def imageFallback() -> String:
  M.msg("dialogs.image.fallback")

# Título pelo nome do arquivo; caminho vazio cai em "Imagem".
def imageTitle(file: String) -> String:
  textOr(fileBase(file), imageFallback())

def imageTitleNode(file: String) -> V.ViewNode:
  V.viewText(imageTitle(file))

def imageCopyLabel() -> String:
  M.msg("common.copy")

def imageOpenLabel() -> String:
  M.msg("dialogs.image.openPreview")

# Ações do `#image-dialog`: copiar e abrir no Preview (só com arquivo). Fechar
# é o × do cabeçalho (e o Esc): o rodapé não repete.
def imageActions(hasFile: Bool) -> List<&2, V.ViewNode>:
  [ V.viewEl("button", [
      V.attrType("button"),
      V.attrId("image-copy"),
      V.attrOn("click", "ImageCopy")
    ], [V.viewText(imageCopyLabel())])
  , V.viewEl("button", V.attrJoin([
      [V.attrType("button"), V.attrId("image-open"), V.attrOn("click", "ImageOpen")],
      V.attrWhen(Bool.not(hasFile), V.ViewAttr{"hidden", ""})
    ]), [V.viewText(imageOpenLabel())])
  ]

# ---------- help-dialog / about-dialog ----------

def helpVersion.if(version: String, missing: Bool) -> String:
  match missing:
    case True{}:
      ""
    case False{}:
      "Mesa de Estudos " ++ version

def helpVersion(+version: String) -> String:
  helpVersion.if(version, String.is_empty(version))

def helpVersionNode(version: String) -> V.ViewNode:
  V.viewText(helpVersion(version))

def helpFlags(studyContext: Bool, endDay: Bool, refsToggle: Bool, conferir: Bool) -> HelpFlags:
  HelpFlags{studyContext, endDay, refsToggle, conferir}

def helpChrome(version: String, flags: HelpFlags) -> HelpChrome:
  match flags:
    case HelpFlags{studyContext, endDay, refsToggle, conferir}:
      HelpChrome{
        helpVersion(version),
        Bool.not(studyContext),
        Bool.not(endDay),
        Bool.not(refsToggle),
        Bool.not(conferir)
      }

def aboutLead.if(version: String, missing: Bool) -> String:
  match missing:
    case True{}:
      ""
    case False{}:
      M.msg1("about.lead", "version", version)

# Sem versão devolve "" — o aplicador mantém o texto estático do HTML. O nome
# "Mesa de Estudos" é o título do diálogo; a linha só diz versão e licença.
def aboutLead(+version: String) -> String:
  aboutLead.if(version, String.is_empty(version))

def aboutLeadNode(version: String) -> V.ViewNode:
  V.viewText(aboutLead(version))

# ---------- settings-dialog ----------

def emptyCourse() -> SettingsCourse:
  SettingsCourse{"", "", ""}

# `data-id` vazio entra como "" (o `readSettingsForm` decide o id depois).
def courseRow(course: SettingsCourse) -> V.ViewNode:
  match course:
    case SettingsCourse{id, name, path}:
      V.viewEl("div", [V.attrClass("cfg-course"), V.attrData("id", id)], [
        V.viewEl("input", V.attrJoin([
          [V.attrClass("cfg-name"), V.attr("placeholder", M.msg("settings.course.nameColumn")), V.attrAria("label", M.msg("settings.course.nameLabel"))],
          valueAttr(name)
        ]), Nil{}),
        V.viewEl("input", V.attrJoin([
          [ V.attrClass("cfg-path")
          , V.attr("placeholder", M.msg("settings.course.folderColumn"))
          , V.attr("spellcheck", "false")
          , V.attrAria("label", M.msg("settings.course.folderLabel"))
          ],
          valueAttr(path)
        ]), Nil{}),
        V.viewEl("button", [
          V.attrType("button"),
          V.attrClass("cfg-browse"),
          V.attrOn("click", "BrowseCourse")
        ], [V.viewText(M.msg("settings.course.choose"))]),
        V.viewEl("button", [
          V.attrType("button"),
          V.attrClass("cfg-remove icon-btn"),
          V.attrAria("label", M.msg("settings.course.remove")),
          V.attrOn("click", "RemoveCourse")
        ], [V.viewText("×")])
      ])

# Cabeçalho das colunas do editor (#27 B9): "Nome" e "Pasta dos PDFs" uma vez,
# acima da primeira linha. É só rótulo visual — cada campo guarda o nome
# acessível dele — e nunca é uma linha (`.cfg-course`) para o `readSettingsForm`.
def courseHead() -> V.ViewNode:
  V.viewEl("div", [V.attrClass("cfg-course-head"), V.attrAria("hidden", "true")], [
    V.viewEl("span", Nil{}, [V.viewText(M.msg("settings.course.nameColumn"))]),
    V.viewEl("span", Nil{}, [V.viewText(M.msg("settings.course.folderColumn"))])
  ])

def courseRows.go(cs: List<&2, SettingsCourse>) -> List<&2, V.ViewNode>:
  match cs:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      Con{courseRow(h), courseRows.go(t)}

# Lista vazia vira uma linha em branco (o "+" do host acrescenta outras).
def courseRows(cs: List<&2, SettingsCourse>) -> List<&2, V.ViewNode>:
  match cs:
    case Nil{}:
      Con{courseRow(emptyCourse()), Nil{}}
    case Con{h, t}:
      Con{courseRow(h), courseRows.go(t)}

# ---------- about: linha de atualização (updater por clique) ----------

# A checagem é 1×/dia silenciosa + o botão manual do Sobre. `UpdateNone` traz a
# versão corrente; `UpdateReady` traz a versão nova, o corpo da Release (o "o
# que mudou" mostrado no app) e a URL das Release notes. Offline não é drama:
# `UpdateFailed` só oferece o botão de novo. `UpdateApplying` desliga a ação
# enquanto o pós-fechamento roda; na reabertura o resultado real é
# `UpdateDone` / `UpdateRecovered` / `UpdateIncomplete` (com "Ver o log" nos
# dois últimos). O "Atualizar e reiniciar" roda o script pós-fechamento —
# quem aplica é o host, aqui é só a linha.
type UpdateState is Data:
  UpdateIdle{}
  UpdateChecking{}
  UpdateNone{current: String, checked: String}
  UpdateReady{version: String, notes: String, url: String}
  UpdateFailed{}
  UpdateApplying{}
  UpdateDone{version: String}
  UpdateRecovered{version: String, reason: String}
  UpdateIncomplete{version: String, reason: String}

def checkUpdateLabel() -> String:
  M.msg("update.check")

def updateIdleText() -> String:
  M.msg("update.idle")

def updateCheckingText() -> String:
  M.msg("update.checking")

def updateNoneText() -> String:
  M.msg("update.none")

# O "Conferido hoje às 9:40." é fato do host (`checked`: "hoje às 9:40" ou
# "ontem às 21:05"); sem ele a frase diz a versão em que a Mesa está.
def updateNoneRest.if(current: String, noChecked: Bool, checked: String) -> String:
  match noChecked:
    case True{}:
      M.msg1("update.youAreOn", "version", current)
    case False{}:
      checked

def updateNoneRest(current: String, +checked: String) -> String:
  updateNoneRest.if(current, String.is_empty(checked), checked)

def updateFailedText() -> String:
  M.msg("update.failed")

def updateFailedRest() -> String:
  M.msg("update.failedRest")

def updateReadyText(version: String) -> String:
  M.msg1("update.ready", "version", version)

def updateNotesLabel() -> String:
  M.msg("update.notes")

def updateApplyLabel() -> String:
  M.msg("update.apply")

def updatePiLabel() -> String:
  M.msg("update.pi")

def updateApplyingText() -> String:
  M.msg("update.applying")

def updateDoneText(version: String) -> String:
  M.msg1("update.done", "version", version)

def updateRecoveredText.if(version: String, reason: String, emptyReason: Bool) -> String:
  match emptyReason:
    case True{}:
      M.msg1("update.recovered", "version", version)
    case False{}:
      M.msg2("update.recovered.reason", "version", version, "reason", reason)

def updateRecoveredText(+version: String, +reason: String) -> String:
  updateRecoveredText.if(version, reason, String.is_empty(reason))

def updateIncompleteText.if(version: String, reason: String, emptyReason: Bool) -> String:
  match emptyReason:
    case True{}:
      M.msg1("update.incomplete", "version", version)
    case False{}:
      M.msg2("update.incomplete.reason", "version", version, "reason", reason)

def updateIncompleteText(+version: String, +reason: String) -> String:
  updateIncompleteText.if(version, reason, String.is_empty(reason))

def updateLogLabel() -> String:
  M.msg("update.log")

# Ícone de estado da faixa (ok, new, busy, warn, idle): o glifo é decoração
# (`aria-hidden`); quem lê o estado é o texto ao lado.
def updateIcon(kind: String, glyph: String) -> V.ViewNode:
  V.viewEl("span", [
    V.attrClass("update-icon"),
    V.attrData("state", kind),
    V.attrAria("hidden", "true")
  ], [V.viewText(glyph)])

# Uma frase só (a parte forte); `updateLine2` junta a parte discreta.
def updateLineNode(text: String) -> V.ViewNode:
  V.viewEl("p", [V.attrClass("update-text")], [
    V.viewEl("span", [V.attrClass("update-main")], [V.viewText(text)])
  ])

def updateLine2(main: String, rest: String) -> V.ViewNode:
  V.viewEl("p", [V.attrClass("update-text")], [
    V.viewEl("span", [V.attrClass("update-main")], [V.viewText(main)]),
    V.viewEl("span", [V.attrClass("update-muted")], [V.viewText(" "), V.viewText(rest)])
  ])

# O clique de link (Notas da versão / página do Xournal++) cai no handler
# `OpenLink` do host com a URL em `data-url` (o Electron abre no navegador).
def releaseNotesButton(url: String) -> V.ViewNode:
  V.viewEl("button", [
    V.attrId("update-notes"),
    V.attrType("button"),
    V.attrOn("click", "OpenLink"),
    V.attrData("url", url)
  ], [V.viewText(updateNotesLabel())])

# O "Ver o log" abre o desk.log do runtime (o `OpenLog` é handler do host):
# resultado de update só se explica inteiro com o motivo de lá.
def updateLogButton() -> V.ViewNode:
  V.viewEl("button", [
    V.attrId("update-log"),
    V.attrType("button"),
    V.attrOn("click", "OpenLog")
  ], [V.viewText(updateLogLabel())])

def applyUpdateButton() -> V.ViewNode:
  V.viewEl("button", [
    V.attrId("update-apply"),
    V.attrType("button"),
    V.attrClass("primary"),
    V.attrOn("click", "ApplyUpdate")
  ], [V.viewText(updateApplyLabel())])

# Enquanto aplica o clique fica desligado: a mesma árvore do botão pronto,
# com `disabled` — dois pós-fechamentos simultâneos nunca saem daqui.
def applyingUpdateButton() -> V.ViewNode:
  V.viewEl("button", [
    V.attrId("update-apply"),
    V.attrType("button"),
    V.attrClass("primary"),
    V.attrOn("click", "ApplyUpdate"),
    V.attr("disabled", "")
  ], [V.viewText(updateApplyLabel())])

# Verificar é ícone ao lado do que verifica (padrão dos diálogos): o nome
# acessível e a dica dizem a ação inteira.
def checkUpdateButton() -> V.ViewNode:
  V.viewEl("button", [
    V.attrId("update-check"),
    V.attrType("button"),
    V.attrClass("icon-btn"),
    V.attrAria("label", checkUpdateLabel()),
    V.attr("title", checkUpdateLabel()),
    V.attrOn("click", "CheckUpdate")
  ], [V.viewText("↻")])

# A faixa pronta: "v0.5.1 disponível", o link "O que mudou" (só com URL: clique
# morto não entra na árvore) e a ação primária "Atualizar e reiniciar".
def updateReadyChildren(version: String, +url: String) -> List<&2, V.ViewNode>:
  V.viewJoin([
    [updateIcon("new", "↑")],
    [updateLineNode(updateReadyText(version))],
    V.viewWhen(Bool.not(String.is_empty(url)), releaseNotesButton(url)),
    [applyUpdateButton()]
  ])

# O corpo da Release (markdown cru; o host trunca e mostra como texto).
def updateNotesNode(notes: String) -> V.ViewNode:
  V.viewEl("p", [V.attrClass("update-notes")], [V.viewText(notes)])

def aboutUpdateChildren(s: UpdateState) -> List<&2, V.ViewNode>:
  match s:
    case UpdateIdle{}:
      [updateIcon("idle", "↻"), updateLineNode(updateIdleText()), checkUpdateButton()]
    case UpdateChecking{}:
      [updateIcon("busy", "…"), updateLineNode(updateCheckingText())]
    case UpdateNone{current, checked}:
      [
        updateIcon("ok", "✓"),
        updateLine2(updateNoneText(), updateNoneRest(current, checked)),
        checkUpdateButton()
      ]
    case UpdateReady{version, +notes, +url}:
      V.viewConcat(
        updateReadyChildren(version, url),
        V.viewWhen(Bool.not(String.is_empty(notes)), updateNotesNode(notes))
      )
    case UpdateFailed{}:
      [
        updateIcon("warn", "!"),
        updateLine2(updateFailedText(), updateFailedRest()),
        checkUpdateButton()
      ]
    case UpdateApplying{}:
      [updateIcon("busy", "…"), updateLineNode(updateApplyingText()), applyingUpdateButton()]
    case UpdateDone{version}:
      [updateIcon("ok", "✓"), updateLineNode(updateDoneText(version)), checkUpdateButton()]
    case UpdateRecovered{version, reason}:
      [
        updateIcon("warn", "!"),
        updateLineNode(updateRecoveredText(version, reason)),
        updateLogButton(),
        checkUpdateButton()
      ]
    case UpdateIncomplete{version, reason}:
      [
        updateIcon("warn", "!"),
        updateLineNode(updateIncompleteText(version, reason)),
        updateLogButton(),
        checkUpdateButton()
      ]

# ---------- about: painel "Componentes" ----------

# Pi, Claude Code, Node e Xournal++ com versão instalada e estado. A ação da
# linha é do `updatenotice.bend` (#45): o Pi local da Mesa tem o botão de
# sempre; Pi de Homebrew/npm e Claude Code abrem a confirmação com o comando
# exato; instalação não reconhecida só mostra o comando com "Copiar". Node e
# Xournal++ são informativos (dica/link), o app não os toca.
type ComponentState is Data:
  CompOk{}
  CompUnknown{}
  # Sem rede (ou sem resposta do registro): não é erro, é "não deu para conferir".
  CompOffline{}
  CompOutdated{latest: String}
  CompWarn{note: String}
  # Painel aberto antes de a checagem responder: a linha nasce "Verificando…"
  # (nunca vazia nem mentindo "desconhecido") e o estado chega em seguida.
  CompChecking{}

type ComponentRow is Data:
  ComponentRow{id: String, label: String, version: String, state: ComponentState, hint: String, link: String, linkLabel: String, action: U.ToolAction, ahead: Bool, run: U.ToolRun}

# A ordem do painel é decisão do núcleo: Pi, Claude Code, Node, Xournal++. A
# Mesa não é linha: a versão dela já está no cabeçalho e o estado dela na faixa
# de atualização acima ("O que a Mesa usa" lista o que ela usa, não ela mesma).
def componentIds() -> List<&2, String>:
  ["pi", "claude", "node", "xournal"]

def componentStateText(s: ComponentState) -> String:
  match s:
    case CompOk{}:
      M.msg("component.ok")
    case CompUnknown{}:
      M.msg("component.unknown")
    case CompOffline{}:
      U.offlineText()
    case CompOutdated{latest}:
      M.msg1("component.outdated", "latest", latest)
    case CompWarn{note}:
      note
    case CompChecking{}:
      M.msg("component.checking")

def componentVersionText(+version: String) -> String:
  textOr(version, "—")

def componentLinkLabel(+label: String) -> String:
  textOr(label, M.msg("component.openSite"))

# O Node mínimo vem do Pi (`engines: >=22.19.0`): abaixo disso o painel avisa.
def nodeTooOld(+major: U32, minor: U32) -> Bool:
  Bool.or(U32.is_lt(major, 22), Bool.and(U32.is_eq(major, 22), U32.is_lt(minor, 19)))

def nodeWarnText() -> String:
  M.msg("component.nodeTooOld")

def nodeState.if(old: Bool) -> ComponentState:
  match old:
    case True{}:
      CompWarn{nodeWarnText()}
    case False{}:
      CompOk{}

def nodeState(major: U32, minor: U32) -> ComponentState:
  nodeState.if(nodeTooOld(major, minor))

def updatePiButton() -> V.ViewNode:
  U.localButton()

def componentLinkButton(url: String, label: String) -> V.ViewNode:
  V.viewEl("button", [
    V.attrClass("component-link"),
    V.attrType("button"),
    V.attrOn("click", "OpenLink"),
    V.attrData("url", url)
  ], [V.viewText(componentLinkLabel(label))])

# Bolinha de 7px ao lado do estado: a cor vem de `data-state` (ok, new, warn,
# muted, busy) e o texto ao lado diz o mesmo — nunca só a cor.
def componentDot(s: ComponentState) -> String:
  match s:
    case CompOk{}:
      "ok"
    case CompUnknown{}:
      "muted"
    case CompOffline{}:
      "muted"
    case CompOutdated{_}:
      "new"
    case CompWarn{_}:
      "warn"
    case CompChecking{}:
      "busy"

# A dica do host (onde o Pi mora, o que fazer) só aparece quando o estado pede
# ação; em dia ou verificando, a linha diz apenas o que o componente é.
def componentShowsHint(s: ComponentState) -> Bool:
  match s:
    case CompOk{}:
      False{}
    case CompChecking{}:
      False{}
    case CompUnknown{}:
      True{}
    case CompOffline{}:
      True{}
    case CompOutdated{_}:
      True{}
    case CompWarn{_}:
      True{}

def componentDescription.xournal(isXournal: Bool) -> String:
  match isXournal:
    case True{}:
      M.msg("component.desc.xournal")
    case False{}:
      ""

def componentDescription.node(isNode: Bool, isXournal: Bool) -> String:
  match isNode:
    case True{}:
      M.msg("component.desc.node")
    case False{}:
      componentDescription.xournal(isXournal)

def componentDescription.claude(isClaude: Bool, isNode: Bool, isXournal: Bool) -> String:
  match isClaude:
    case True{}:
      M.msg("component.desc.claude")
    case False{}:
      componentDescription.node(isNode, isXournal)

def componentDescription.pick(isPi: Bool, isClaude: Bool, isNode: Bool, isXournal: Bool) -> String:
  match isPi:
    case True{}:
      M.msg("component.desc.pi")
    case False{}:
      componentDescription.claude(isClaude, isNode, isXournal)

def componentDescription(+id: String) -> String:
  componentDescription.pick(String.eq(id, "pi"), String.eq(id, "claude"), String.eq(id, "node"), String.eq(id, "xournal"))

def componentHintNode(parts: List<&2, V.ViewNode>) -> V.ViewNode:
  V.viewEl("small", [V.attrClass("component-hint")], parts)

# A nota de uma linha: o que o componente é, mais a dica do host quando o
# estado pede ação. São nós de texto separados (a descrição e a dica são
# mensagens traduzíveis; juntá-las numa cadeia só estragaria a tradução).
def componentNote(+desc: String, +hint: String, +show: Bool) -> List<&2, V.ViewNode>:
  V.viewJoin([
    V.viewWhen(Bool.not(String.is_empty(desc)), V.viewText(desc)),
    V.viewWhen(
      Bool.and(show, Bool.and(Bool.not(String.is_empty(desc)), Bool.not(String.is_empty(hint)))),
      V.viewText(" ")
    ),
    V.viewWhen(Bool.and(show, Bool.not(String.is_empty(hint))), V.viewText(hint))
  ])

def componentNoteNodes(+parts: List<&2, V.ViewNode>) -> List<&2, V.ViewNode>:
  match parts:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      [componentHintNode(Con{h, t})]

def componentActions(+link: String, label: String, action: U.ToolAction) -> V.ViewNode:
  V.viewEl("div", [V.attrClass("component-actions")], V.viewJoin([
    V.viewWhen(Bool.not(String.is_empty(link)), componentLinkButton(link, label)),
    U.actionNodes(action)
  ]))

# "mais nova que a testada": a versão em jogo passa da tabela desta Mesa.
def componentAheadNode() -> V.ViewNode:
  V.viewEl("span", [V.attrClass("component-ahead")], [V.viewText(U.aheadText())])

def componentHead(label: String, version: String, +state: ComponentState, ahead: Bool) -> V.ViewNode:
  V.viewEl("div", [V.attrClass("component-head")], V.viewJoin([
    [ V.viewEl("span", [V.attrClass("component-name")], [V.viewText(label)])
    , V.viewEl("span", [V.attrClass("component-version")], [V.viewText(componentVersionText(version))])
    , V.viewEl("span", [
        V.attrClass("component-dot"),
        V.attrData("state", componentDot(state)),
        V.attrAria("hidden", "true")
      ], Nil{})
    , V.viewEl("span", [V.attrClass("component-state")], [V.viewText(componentStateText(state))])
    ],
    V.viewWhen(ahead, componentAheadNode())
  ]))

# Linha: nome, versão, bolinha e estado; embaixo uma nota de uma linha (o que é
# o componente, mais a dica quando há o que fazer) e à direita a ação.
def componentRowNode(r: ComponentRow) -> V.ViewNode:
  match r:
    case ComponentRow{+id, label, version, +state, +hint, +link, +linkLabel, +action, ahead, run}:
      V.viewEl("div", [V.attrClass("component-row"), V.attrData("id", id)], V.viewJoin([
        [ V.viewEl("div", [V.attrClass("component-main")], V.viewJoin([
            [componentHead(label, version, state, ahead)],
            componentNoteNodes(componentNote(componentDescription(id), hint, componentShowsHint(state)))
          ]))
        ],
        V.viewWhen(
          Bool.or(Bool.not(String.is_empty(link)), U.hasAction(action)),
          componentActions(link, linkLabel, action)
        ),
        U.runNodes(run)
      ]))

def componentRows.go(rs: List<&2, ComponentRow>) -> List<&2, V.ViewNode>:
  match rs:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      Con{componentRowNode(h), componentRows.go(t)}

# Filhos do `#component-rows`: uma linha por componente, na ordem do host.
def componentRows(rs: List<&2, ComponentRow>) -> List<&2, V.ViewNode>:
  componentRows.go(rs)

# O editor inteiro: o cabeçalho das colunas e depois as linhas.
def courseList(cs: List<&2, SettingsCourse>) -> List<&2, V.ViewNode>:
  Con{courseHead(), courseRows(cs)}

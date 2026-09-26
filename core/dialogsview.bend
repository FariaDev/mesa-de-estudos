import Base
import view.bend as V
import pdfnav.bend as N

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

# Título do diálogo: vazio cai em "Pi" (como o `e.title||'Pi'` do chat).
def piTitle(+raw: String) -> String:
  textOr(raw, "Pi")

# A mensagem entra crua; o host resolve markdown/LaTeX.
def piMessage(raw: String) -> String:
  raw

def dialogOkLabel(+raw: String) -> String:
  textOr(raw, "Continuar")

# Botão ok do `#pi-dialog`: fecha com `returnValue == "ok"`.
def piOkNode(label: String) -> V.ViewNode:
  V.viewEl("button", [
    V.attrId("dialog-ok"),
    V.attr("value", "ok"),
    V.attrClass("primary")
  ], [V.viewText(dialogOkLabel(label))])

# ---------- end-day-dialog ----------

def endDayTitle() -> String:
  "Encerrar por hoje"

def endDayLead() -> String:
  "Salve na conversa um ponto curto para retomar depois."

def endDayWhereLabel() -> String:
  "Onde parei"

def endDayNextLabel() -> String:
  "Próximo passo"

def endDayCancelLabel() -> String:
  "Cancelar"

def endDaySaveLabel() -> String:
  "Salvar na conversa"

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
  "Imagem"

# Título pelo nome do arquivo; caminho vazio cai em "Imagem".
def imageTitle(file: String) -> String:
  textOr(fileBase(file), imageFallback())

def imageTitleNode(file: String) -> V.ViewNode:
  V.viewText(imageTitle(file))

def imageCopyLabel() -> String:
  "Copiar"

def imageOpenLabel() -> String:
  "Abrir no Preview"

def imageCloseLabel() -> String:
  "Fechar"

# Ações do `#image-dialog`: copiar, abrir no Preview (só com arquivo) e fechar.
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
  , V.viewEl("button", [
      V.attr("value", "cancel"),
      V.attrClass("primary")
    ], [V.viewText(imageCloseLabel())])
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
      "Mesa de Estudos " ++ version ++ " · licença MIT"

# Sem versão devolve "" — o aplicador mantém o texto estático do HTML.
def aboutLead(+version: String) -> String:
  aboutLead.if(version, String.is_empty(version))

def aboutLeadNode(version: String) -> V.ViewNode:
  V.viewText(aboutLead(version))

# ---------- settings-dialog ----------

def settingsTitle(first: Bool) -> String:
  match first:
    case True{}:
      "Bem-vindo à Mesa de Estudos"
    case False{}:
      "Configurações"

def settingsLead(first: Bool) -> String:
  match first:
    case True{}:
      "Escolha a pasta de dados e pelo menos uma matéria (nome + pasta de PDFs). O Pi pede as credenciais na primeira conexão."
    case False{}:
      "Caminhos e nomes desta mesa. As credenciais do modelo continuam no Pi."

def settingsTitleNode(first: Bool) -> V.ViewNode:
  V.viewText(settingsTitle(first))

def settingsLeadNode(first: Bool) -> V.ViewNode:
  V.viewText(settingsLead(first))

def emptyCourse() -> SettingsCourse:
  SettingsCourse{"", "", ""}

# `data-id` vazio entra como "" (o `readSettingsForm` decide o id depois).
def courseRow(course: SettingsCourse) -> V.ViewNode:
  match course:
    case SettingsCourse{id, name, path}:
      V.viewEl("div", [V.attrClass("cfg-course"), V.attrData("id", id)], [
        V.viewEl("input", V.attrJoin([
          [V.attrClass("cfg-name"), V.attr("placeholder", "Nome")],
          valueAttr(name)
        ]), Nil{}),
        V.viewEl("input", V.attrJoin([
          [ V.attrClass("cfg-path")
          , V.attr("placeholder", "Pasta dos PDFs")
          , V.attr("spellcheck", "false")
          ],
          valueAttr(path)
        ]), Nil{}),
        V.viewEl("button", [
          V.attrType("button"),
          V.attrClass("cfg-browse"),
          V.attrOn("click", "BrowseCourse")
        ], [V.viewText("Pasta")]),
        V.viewEl("button", [
          V.attrType("button"),
          V.attrClass("cfg-remove icon-btn"),
          V.attrAria("label", "Remover"),
          V.attrOn("click", "RemoveCourse")
        ], [V.viewText("×")])
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

# ---------- welcome-dialog (primeira abertura) ----------

# A boas-vindas da primeira abertura: 4 blocos (h3 + parágrafos) e as ações.
# A prosa dos parágrafos é DADO (`welcomeBlocks`) — editá-la não toca nas leis;
# o contrato provado é a estrutura (4 blocos + botão), os títulos, o
# renderizador genérico do bloco e a nota de workflow por plataforma.

type WelcomeBlock is Data:
  WelcomeBlock{title: String, paras: List<&2, String>}

def welcomeTitle() -> String:
  "Bem-vindo à Mesa de Estudos"

# Nota de workflow por plataforma: o macOS captura a janela pelo botão e o
# Windows também (Ctrl+Shift+C) — colar print (Ctrl+V) funciona nos dois.
def welcomeWorkflowNote(win32: Bool) -> String:
  match win32:
    case True{}:
      "No Windows, o Conferir Xournal++ captura a janela do Xournal++ (Ctrl+Shift+C) e você envia junto com a mensagem — prints colados com Ctrl+V também funcionam."
    case False{}:
      "No macOS, o Conferir Xournal++ anexa a captura da sua resolução no Xournal++ e você envia junto com a mensagem."

def welcomeBlocks(win32: Bool) -> List<&2, WelcomeBlock>:
  [ WelcomeBlock{"O que é a Mesa", Con{
      "A Mesa é a sua bancada de referências: os PDFs do enunciado e do formulário, uma calculadora e o Pi na mesma janela. A escrita à mão continua no Xournal++, do lado — a Mesa não é um canvas de tinta.",
      Con{"Coloque um app em cada monitor, ou os dois lado a lado.", Nil{}}}}
    , WelcomeBlock{"O Pi", Con{
      "O Pi é o motor da conversa: um agente que roda nesta máquina. As credenciais do modelo ficam no Pi, não neste app — ele pede na primeira conexão.",
      Con{"Cada matéria tem a sua conversa, guardada localmente; a Mesa conecta sozinha quando abre.", Nil{}}}}
    , WelcomeBlock{"Customização por agentes", Con{
      "Esta Mesa foi feita para ser customizada por agentes: o AGENTS.md é o contrato e o bloco desk do config.json decide os leitores, os rótulos, qual PDF abre primeiro e o que esconder (calculadora, Xournal++, Conferir, Encerrar).",
      Con{"Para ajustar o jeito de o Pi dar aula, copie os templates TUTOR.md e LEARNER.md para a sua pasta de dados e edite as CÓPIAS — os arquivos do repositório são só o molde.", Nil{}}}}
    , WelcomeBlock{"Dicas de uso", Con{
      "Encerrar por hoje registra onde você parou e o próximo passo; o diário do turno e os quizzes aparecem na conversa. O Como usar tem os atalhos todos.",
      Con{welcomeWorkflowNote(win32), Nil{}}}}
    ]

def paraNode(text: String) -> V.ViewNode:
  V.viewEl("p", Nil{}, [V.viewText(text)])

def paraNodes.go(ps: List<&2, String>) -> List<&2, V.ViewNode>:
  match ps:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      Con{paraNode(h), paraNodes.go(t)}

def paraNodes(ps: List<&2, String>) -> List<&2, V.ViewNode>:
  paraNodes.go(ps)

# Renderizador genérico do bloco: `section.welcome-block` com o h3 e um <p> por
# parágrafo. Vale para qualquer prosa — é isto que a lei fixa.
def blockNode(b: WelcomeBlock) -> V.ViewNode:
  match b:
    case WelcomeBlock{title, paras}:
      V.viewEl("section", [V.attrClass("welcome-block")], Con{
        V.viewEl("h3", Nil{}, [V.viewText(title)]),
        paraNodes(paras)
      })

def blockNodes.go(bs: List<&2, WelcomeBlock>) -> List<&2, V.ViewNode>:
  match bs:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      Con{blockNode(h), blockNodes.go(t)}

def blockNodes(bs: List<&2, WelcomeBlock>) -> List<&2, V.ViewNode>:
  blockNodes.go(bs)

def blockTitle(b: WelcomeBlock) -> String:
  match b:
    case WelcomeBlock{title, _}:
      title

def welcomeTitles.go(bs: List<&2, WelcomeBlock>) -> List<&2, String>:
  match bs:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      Con{blockTitle(h), welcomeTitles.go(t)}

# Os títulos são a estrutura (contagem e ordem) — as duas plataformas coincidem.
def welcomeTitles(win32: Bool) -> List<&2, String>:
  welcomeTitles.go(welcomeBlocks(win32))

# Ações: sair por agora (fecha como cancel) ou abrir as Configurações de
# primeira vez — o clique é o handler `WelcomeConfigure` do host.
def welcomeActions() -> V.ViewNode:
  V.viewEl("div", [V.attrClass("dialog-actions")], [
    V.viewEl("button", [V.attr("value", "cancel")], [V.viewText("Agora não")]),
    V.viewEl("button", [
      V.attrId("welcome-settings"),
      V.attrType("button"),
      V.attrClass("primary"),
      V.attrOn("click", "WelcomeConfigure")
    ], [V.viewText("Configurar agora")])
  ])

def welcomeBody(win32: Bool) -> V.ViewNode:
  V.viewEl("div", [V.attrClass("help-body")], blockNodes(welcomeBlocks(win32)))

# Filhos do `#welcome-form`: título, o corpo com os 4 blocos e as ações.
def welcomeChildren(win32: Bool) -> List<&2, V.ViewNode>:
  [ V.viewEl("h2", Nil{}, [V.viewText(welcomeTitle())])
  , welcomeBody(win32)
  , welcomeActions()
  ]

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
  UpdateNone{current: String}
  UpdateReady{version: String, notes: String, url: String}
  UpdateFailed{}
  UpdateApplying{}
  UpdateDone{version: String}
  UpdateRecovered{version: String, reason: String}
  UpdateIncomplete{version: String, reason: String}

def checkUpdateLabel() -> String:
  "Verificar atualizações"

def updateIdleText() -> String:
  "A Mesa verifica atualizações uma vez por dia, sem interromper. Você também pode verificar agora."

def updateCheckingText() -> String:
  "Verificando atualizações…"

def updateNoneText(current: String) -> String:
  "Você está na última versão (v" ++ current ++ ")."

def updateFailedText() -> String:
  "Não foi possível verificar agora. Tente de novo quando quiser."

def updateReadyPrefix.if(version: String, withoutUrl: Bool) -> String:
  match withoutUrl:
    case True{}:
      "v" ++ version ++ " disponível"
    case False{}:
      "v" ++ version ++ " disponível — o que mudou ("

# Com link das notas o parêntese fecha; sem link a frase termina antes dele.
def updateReadyPrefix(+version: String, url: String) -> String:
  updateReadyPrefix.if(version, String.is_empty(url))

def updateReadyJoin.if(withoutUrl: Bool) -> String:
  match withoutUrl:
    case True{}:
      " · "
    case False{}:
      ") · "

def updateReadyJoin(url: String) -> String:
  updateReadyJoin.if(String.is_empty(url))

def updateNotesLabel() -> String:
  "Notas da versão"

def updateApplyLabel() -> String:
  "Atualizar e reiniciar"

def updatePiLabel() -> String:
  "Atualizar Pi"

def updateApplyingText() -> String:
  "Aplicando a atualização — a Mesa fecha e reabre sozinha."

def updateDoneText(version: String) -> String:
  "Mesa atualizada para v" ++ version ++ "."

def updateRecoveredText.if(version: String, reason: String, emptyReason: Bool) -> String:
  match emptyReason:
    case True{}:
      "A atualização para v" ++ version ++ " falhou — a versão anterior voltou."
    case False{}:
      "A atualização para v" ++ version ++ " falhou — a versão anterior voltou (" ++ reason ++ ")."

def updateRecoveredText(+version: String, +reason: String) -> String:
  updateRecoveredText.if(version, reason, String.is_empty(reason))

def updateIncompleteText.if(version: String, reason: String, emptyReason: Bool) -> String:
  match emptyReason:
    case True{}:
      "A atualização para v" ++ version ++ " falhou e a recuperação ficou incompleta."
    case False{}:
      "A atualização para v" ++ version ++ " falhou e a recuperação ficou incompleta (" ++ reason ++ ")."

def updateIncompleteText(+version: String, +reason: String) -> String:
  updateIncompleteText.if(version, reason, String.is_empty(reason))

def updateLogLabel() -> String:
  "Ver o log"

def updateLineNode(text: String) -> V.ViewNode:
  V.viewEl("p", Nil{}, [V.viewText(text)])

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

def checkUpdateButton() -> V.ViewNode:
  V.viewEl("button", [
    V.attrId("update-check"),
    V.attrType("button"),
    V.attrOn("click", "CheckUpdate")
  ], [V.viewText(checkUpdateLabel())])

# A linha pronta, literal: "vX disponível — o que mudou (Notas da versão) ·
# Atualizar e reiniciar". Sem URL o botão de notas não existe (clique morto não
# entra na árvore) e a frase termina antes do parêntese.
def updateReadyLine(version: String, +url: String) -> V.ViewNode:
  V.viewEl("div", [V.attrClass("update-line")], V.viewJoin([
    [V.viewText(updateReadyPrefix(version, url))],
    V.viewWhen(Bool.not(String.is_empty(url)), releaseNotesButton(url)),
    [V.viewText(updateReadyJoin(url))],
    [applyUpdateButton()]
  ]))

# O corpo da Release (markdown cru; o host trunca e mostra como texto).
def updateNotesNode(notes: String) -> V.ViewNode:
  V.viewEl("p", [V.attrClass("update-notes")], [V.viewText(notes)])

def aboutUpdateChildren(s: UpdateState) -> List<&2, V.ViewNode>:
  match s:
    case UpdateIdle{}:
      [updateLineNode(updateIdleText()), checkUpdateButton()]
    case UpdateChecking{}:
      [updateLineNode(updateCheckingText())]
    case UpdateNone{current}:
      [updateLineNode(updateNoneText(current)), checkUpdateButton()]
    case UpdateReady{version, +notes, +url}:
      V.viewConcat(
        [updateReadyLine(version, url)],
        V.viewWhen(Bool.not(String.is_empty(notes)), updateNotesNode(notes))
      )
    case UpdateFailed{}:
      [updateLineNode(updateFailedText()), checkUpdateButton()]
    case UpdateApplying{}:
      [updateLineNode(updateApplyingText()), applyingUpdateButton()]
    case UpdateDone{version}:
      [updateLineNode(updateDoneText(version)), checkUpdateButton()]
    case UpdateRecovered{version, reason}:
      [
        updateLineNode(updateRecoveredText(version, reason)),
        updateLogButton(),
        checkUpdateButton()
      ]
    case UpdateIncomplete{version, reason}:
      [
        updateLineNode(updateIncompleteText(version, reason)),
        updateLogButton(),
        checkUpdateButton()
      ]

# ---------- about: painel "Componentes" ----------

# Mesa, Pi, Node e Xournal++ com versão instalada e estado. Só o Pi local tem
# botão de atualizar (roda `npm install` no pós-fechamento); Pi de PATH e
# Xournal++ são informativos (dica/link), o app não os toca.
type ComponentState is Data:
  CompOk{}
  CompUnknown{}
  CompOutdated{latest: String}
  CompWarn{note: String}
  # Painel aberto antes de a checagem responder: a linha nasce "Verificando…"
  # (nunca vazia nem mentindo "desconhecido") e o estado chega em seguida.
  CompChecking{}

type ComponentRow is Data:
  ComponentRow{id: String, label: String, version: String, state: ComponentState, hint: String, link: String, linkLabel: String, canUpdate: Bool}

# A ordem do painel é decisão do núcleo: Mesa, Pi, Node, Xournal++.
def componentIds() -> List<&2, String>:
  ["mesa", "pi", "node", "xournal"]

def componentStateText(s: ComponentState) -> String:
  match s:
    case CompOk{}:
      "✓"
    case CompUnknown{}:
      "desconhecido"
    case CompOutdated{latest}:
      "→ v" ++ latest ++ " disponível"
    case CompWarn{note}:
      note
    case CompChecking{}:
      "Verificando…"

def componentVersionText(+version: String) -> String:
  textOr(version, "—")

def componentLinkLabel(+label: String) -> String:
  textOr(label, "Ver página")

# O Node mínimo vem do Pi (`engines: >=22.19.0`): abaixo disso o painel avisa.
def nodeTooOld(+major: U32, minor: U32) -> Bool:
  Bool.or(U32.is_lt(major, 22), Bool.and(U32.is_eq(major, 22), U32.is_lt(minor, 19)))

def nodeWarnText() -> String:
  "abaixo de 22.19 — o Pi exige Node 22.19+"

def nodeState.if(old: Bool) -> ComponentState:
  match old:
    case True{}:
      CompWarn{nodeWarnText()}
    case False{}:
      CompOk{}

def nodeState(major: U32, minor: U32) -> ComponentState:
  nodeState.if(nodeTooOld(major, minor))

def updatePiButton() -> V.ViewNode:
  V.viewEl("button", [
    V.attrId("update-pi"),
    V.attrType("button"),
    V.attrClass("component-update"),
    V.attrOn("click", "UpdatePi")
  ], [V.viewText(updatePiLabel())])

def componentLinkButton(url: String, label: String) -> V.ViewNode:
  V.viewEl("button", [
    V.attrClass("component-link"),
    V.attrType("button"),
    V.attrOn("click", "OpenLink"),
    V.attrData("url", url)
  ], [V.viewText(componentLinkLabel(label))])

def componentHintNode(hint: String) -> V.ViewNode:
  V.viewEl("small", [V.attrClass("component-hint")], [V.viewText(hint)])

# Linha: nome, versão, estado + opcionais (dica, link, botão Atualizar Pi).
def componentRowNode(r: ComponentRow) -> V.ViewNode:
  match r:
    case ComponentRow{id, label, version, state, +hint, +link, +linkLabel, +canUpdate}:
      V.viewEl("div", [V.attrClass("component-row"), V.attrData("id", id)], V.viewJoin([
        [ V.viewEl("span", [V.attrClass("component-name")], [V.viewText(label)])
        , V.viewEl("span", [V.attrClass("component-version")], [V.viewText(componentVersionText(version))])
        , V.viewEl("span", [V.attrClass("component-state")], [V.viewText(componentStateText(state))])
        ],
        V.viewWhen(Bool.not(String.is_empty(hint)), componentHintNode(hint)),
        V.viewWhen(Bool.not(String.is_empty(link)), componentLinkButton(link, linkLabel)),
        V.viewWhen(canUpdate, updatePiButton())
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

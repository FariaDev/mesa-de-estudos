import Base
import msg.bend as M
import view.bend as V

# ---------------------------------------------------------------------------
# Conferir com outros programas além do Xournal++ (ticket #35). Módulo só da
# Mesa: a Conversa não tem Conferir e não importa daqui.
#
# O Conferir captura UMA janela. Quem decide qual é este núcleo; o host só
# lista as janelas abertas (macOS: `visual-check/windows`; Windows: PowerShell)
# e captura a que o núcleo apontou. A regra, em ordem:
#
#   1. Elegíveis: janelas de tamanho de janela de verdade (`usable`, fato do
#      host), que não são a própria Mesa (`self`, fato do host) nem do sistema
#      (lista `systemKey` abaixo) e que têm nome de app. A ORDEM é a do host:
#      da frente para trás.
#   2. Sem escolha salva, o app é o Xournal++ — o padrão de sempre — em
#      qualquer das grafias que as duas plataformas dão (`defaultKey`).
#   3. Com escolha salva, o app é o escolhido, comparado pela chave
#      (`key`: nome do app em minúsculas e aparado, que o host entrega pronta).
#      O id de janela NUNCA é guardado: muda a cada abertura.
#   4. Várias janelas do mesmo app: vale a da FRENTE (a primeira da lista).
#      Não existe "última usada": a ordem de frente para trás já a carrega
#      sem outro estado para guardar.
#   5. Nenhuma janela do app: `ConfAbsent`. O núcleo NUNCA devolve outra
#      janela no lugar, nem a tela inteira — quem quiser outra janela a
#      escolhe de propósito (e a escolha vira o app salvo).
#
# Onde a escolha aparece (ticket #38): nas Configurações → Pastas e programas,
# no campo "Programa de escrita" (`fieldView`) com a lista de janelas logo
# abaixo (`listView`); a caixa de mensagem só tem o botão Conferir. Quando o
# app faltou, a Mesa diz a frase e oferece "Escolher outro programa…"
# (`absentView`), que leva ao mesmo campo. A regra de decisão não mudou.
#
# O que não cabe aqui (e por quê): listar e capturar (mundo), medir a janela
# (comparação de número: o host entrega `usable`) e minúsculas/aparo do nome
# (o host entrega `key`; String.eq só compara literais).
# ---------------------------------------------------------------------------

# Uma janela aberta. `id` é o da janela no sistema (texto) e só vale nesta
# listagem. `app` é o nome para mostrar; `key` é a identidade do app.
type ConfWin is Data:
  ConfWin{id: String, app: String, key: String, title: String, usable: Bool, self: Bool}

# O app salvo como escolha: nome para mostrar e a chave de comparação.
type ConfChoice is Data:
  ConfChoice{app: String, key: String}

# O que o Conferir faz agora.
type ConfDecision is Data:
  ConfCapture{id: String, app: String, title: String}
  ConfAbsent{app: String, saved: Bool}

# ---------- textos ----------

def defaultApp() -> String:
  "Xournal++"

def shortLabel() -> String:
  M.msg("check.short")

def buttonLabel(app: String) -> String:
  M.msg1("check.label", "app", app)

# A dica do botão. O padrão mantém a redação de sempre.
def buttonHint.pick(isDefault: Bool, app: String, shortcut: String) -> String:
  match isDefault:
    case True{}:
      M.msg1("check.hint.default", "shortcut", shortcut)
    case False{}:
      M.msg2("check.hint.app", "app", app, "shortcut", shortcut)

def buttonHint(+app: String, shortcut: String) -> String:
  buttonHint.pick(String.eq(app, defaultApp()), app, shortcut)

# Durante a resposta o Conferir fica travado, como as abas de matéria (#42):
# o botão continua legível e a dica diz por quê, em vez de só apagar.
def busyHint() -> String:
  M.msg("check.busy")

def hintFor.pick(busy: Bool, app: String, shortcut: String) -> String:
  match busy:
    case True{}:
      busyHint()
    case False{}:
      buttonHint(app, shortcut)

def hintFor(busy: Bool, +app: String, shortcut: String) -> String:
  hintFor.pick(busy, app, shortcut)

def attachedText.pick(isDefault: Bool, app: String) -> String:
  match isDefault:
    case True{}:
      M.msg("check.attached.default")
    case False{}:
      M.msg1("check.attached.app", "app", app)

def attachedText(+app: String) -> String:
  attachedText.pick(String.eq(app, defaultApp()), app)

def pickLabel() -> String:
  M.msg("conferir.pick")

def fieldLabel() -> String:
  M.msg("conferir.fieldLabel")

def chooseLabel() -> String:
  M.msg("conferir.choose")

def chooseOtherLabel() -> String:
  M.msg("conferir.chooseOther")

def fieldHint() -> String:
  M.msg("conferir.fieldHint")

def unavailableHint() -> String:
  M.msg("conferir.unavailable")

def pickHint() -> String:
  M.msg("conferir.pickHint")

def backLabel() -> String:
  M.msg("conferir.back")

def listAria() -> String:
  M.msg("conferir.listAria")

def refreshLabel() -> String:
  M.msg("conferir.refresh")

def emptyText() -> String:
  M.msg("conferir.empty")

def untitledText() -> String:
  M.msg("conferir.untitled")

def noteAria() -> String:
  M.msg("check.noteAria")

# Título em branco (alguns apps não dão nome à janela) vira um rótulo, nunca
# uma linha vazia.
def titleOrUntitled.pick(blank: Bool, title: String) -> String:
  match blank:
    case True{}:
      untitledText()
    case False{}:
      title

def titleOrUntitled(+title: String) -> String:
  titleOrUntitled.pick(String.is_empty(String.trim(title)), String.trim(title))

# A frase de "o app não está aberto". Sem escolha salva é a mesma de sempre
# para o Xournal++; com escolha, nomeia o app escolhido.
def absentText.pick(saved: Bool, app: String) -> String:
  match saved:
    case False{}:
      M.msg("check.absent.default")
    case True{}:
      M.msg1("check.absent.app", "app", app)

def absentText(app: String, saved: Bool) -> String:
  absentText.pick(saved, app)

# A frase que a Mesa mostra quando o app faltou. A saída é o botão ao lado
# ("Escolher outro programa…"), não uma segunda frase.
def absentLead(app: String, saved: Bool) -> String:
  absentText(app, saved)

# ---------- identidade do app ----------

# Grafias do Xournal++: o nome do app no macOS ("Xournal++") e o do processo
# no Windows ("xournalpp"), já em minúsculas.
def defaultKey(+key: String) -> Bool:
  Bool.or(
    String.eq(key, "xournal++"),
    Bool.or(String.eq(key, "xournalpp"), String.eq(key, "xournal"))
  )

# Janelas do sistema que nunca são oferecidas.
def systemKey(+key: String) -> Bool:
  Bool.or(
    String.eq(key, "window server"),
    Bool.or(
      String.eq(key, "dock"),
      Bool.or(
        String.eq(key, "control center"),
        Bool.or(
          String.eq(key, "systemuiserver"),
          Bool.or(
            String.eq(key, "notification center"),
            Bool.or(
              String.eq(key, "spotlight"),
              Bool.or(
                String.eq(key, "loginwindow"),
                Bool.or(
                  String.eq(key, "windowmanager"),
                  Bool.or(
                    String.eq(key, "textinputhost"),
                    Bool.or(
                      String.eq(key, "shellexperiencehost"),
                      Bool.or(String.eq(key, "searchhost"), String.eq(key, "applicationframehost"))
                    )
                  )
                )
              )
            )
          )
        )
      )
    )
  )

# O nome para mostrar de um app: o Xournal++ tem um só, qualquer que seja a
# grafia da plataforma; os demais mostram o nome que o sistema deu.
def displayName.pick(isDefault: Bool, app: String) -> String:
  match isDefault:
    case True{}:
      defaultApp()
    case False{}:
      app

def displayName(app: String, +key: String) -> String:
  displayName.pick(defaultKey(key), app)

# ---------- elegíveis ----------

def eligible(w: ConfWin) -> Bool:
  match w:
    case ConfWin{id, app, +key, title, usable, self}:
      Bool.and(
        usable,
        Bool.and(
          Bool.not(self),
          Bool.and(Bool.not(String.is_empty(key)), Bool.not(systemKey(key)))
        )
      )

def keepIf(ok: Bool, w: ConfWin, rest: List<&2, ConfWin>) -> List<&2, ConfWin>:
  match ok:
    case True{}:
      Con{w, rest}
    case False{}:
      rest

def eligibleWins(xs: List<&2, ConfWin>) -> List<&2, ConfWin>:
  match xs:
    case Nil{}:
      Nil{}
    case Con{+h, t}:
      keepIf(eligible(h), h, eligibleWins(t))

# ---------- a decisão ----------

def keyOf(w: ConfWin) -> String:
  match w:
    case ConfWin{id, app, key, title, usable, self}:
      key

def choiceApp(c: ConfChoice) -> String:
  match c:
    case ConfChoice{app, key}:
      app

def choiceKey(c: ConfChoice) -> String:
  match c:
    case ConfChoice{app, key}:
      key

# A janela é do app procurado? Sem escolha, o Xournal++; com ela, a chave salva.
def wanted(w: ConfWin, choice: Maybe<&2, ConfChoice>) -> Bool:
  match choice:
    case None{}:
      defaultKey(keyOf(w))
    case Some{c}:
      String.eq(keyOf(w), choiceKey(c))

def wantedLabel(choice: Maybe<&2, ConfChoice>) -> String:
  match choice:
    case None{}:
      defaultApp()
    case Some{c}:
      choiceApp(c)

def isSaved(choice: Maybe<&2, ConfChoice>) -> Bool:
  match choice:
    case None{}:
      False{}
    case Some{c}:
      True{}

# As janelas do app procurado, na ordem do host (frente primeiro).
def matchingWins(xs: List<&2, ConfWin>, +choice: Maybe<&2, ConfChoice>) -> List<&2, ConfWin>:
  match xs:
    case Nil{}:
      Nil{}
    case Con{+h, t}:
      keepIf(wanted(h, choice), h, matchingWins(t, choice))

def captureOf(w: ConfWin) -> ConfDecision:
  match w:
    case ConfWin{id, +app, +key, title, usable, self}:
      ConfCapture{id, displayName(app, key), title}

def decideFirst(xs: List<&2, ConfWin>, +choice: Maybe<&2, ConfChoice>) -> ConfDecision:
  match xs:
    case Nil{}:
      ConfAbsent{wantedLabel(choice), isSaved(choice)}
    case Con{h, t}:
      captureOf(h)

# A decisão do Conferir: a lista como o host a listou (sem filtro) e a escolha
# salva (ou nada). Sem janela do app: `ConfAbsent`, nunca outra janela.
def decide(xs: List<&2, ConfWin>, +choice: Maybe<&2, ConfChoice>) -> ConfDecision:
  decideFirst(matchingWins(eligibleWins(xs), choice), choice)

# ---------- a escolha nas Configurações ----------

# Uma janela da lista: o app em cima, o título embaixo. `key` é o id da janela
# nesta listagem — o host o lê do elemento para saber qual foi escolhida.
def row(w: ConfWin) -> V.ViewNode:
  match w:
    case ConfWin{id, +app, +key, title, usable, self}:
      V.viewEl("li", [V.attrClass("check-item")], [
        V.viewEl("button", [
          V.attrType("button"),
          V.attrClass("check-row"),
          V.attrKey(id),
          V.attrOn("click", "Pick")
        ], [
          V.viewEl("span", [V.attrClass("check-row-app")], [V.viewText(displayName(app, key))]),
          V.viewEl("span", [V.attrClass("check-row-title")], [V.viewText(titleOrUntitled(title))])
        ])
      ])

def emptyItem() -> V.ViewNode:
  V.viewEl("li", [V.attrClass("check-empty")], [V.viewText(emptyText())])

def rowsOrEmpty(xs: List<&2, ConfWin>) -> List<&2, V.ViewNode>:
  match xs:
    case Nil{}:
      [emptyItem()]
    case Con{h, t}:
      V.viewMap(~ConfWin, ~row, Con{h, t})

# A lista que o "Escolher…" abre. `lead` é a explicação do topo. As ações
# nomeiam handlers do host: `Pick` (uma janela) e `Refresh`.
def listView(lead: String, xs: List<&2, ConfWin>) -> V.ViewNode:
  V.viewEl("div", [V.attrClass("cfg-conferir-list-body")], [
    V.viewEl("p", [V.attrClass("cfg-conferir-lead")], [V.viewText(lead)]),
    V.viewEl("ul", [V.attrClass("check-list"), V.attrAria("label", listAria())], rowsOrEmpty(eligibleWins(xs))),
    V.viewEl("div", [V.attrClass("cfg-conferir-foot")], [
      V.viewEl("button", [
        V.attrType("button"), V.attrClass("check-refresh"), V.attrOn("click", "Refresh")
      ], [V.viewText(refreshLabel())])
    ])
  ])

# O texto de ajuda do campo: o de sempre, ou o motivo de a captura não existir.
def fieldHintFor(available: Bool) -> String:
  match available:
    case True{}:
      fieldHint()
    case False{}:
      unavailableHint()

# O campo "Programa de escrita": o programa de agora, Escolher… e, quando há
# outro escolhido, o link "Voltar ao Xournal++". `app` já vem pronto
# (`displayName`). Handlers: `Choose` e `Back`.
def fieldView(app: String, canGoBack: Bool, +available: Bool) -> V.ViewNode:
  V.viewEl("div", [V.attrClass("cfg-conferir")], [
    V.viewEl("span", [V.attrClass("cfg-conferir-label"), V.attrId("cfg-conferir-label")], [V.viewText(fieldLabel())]),
    V.viewEl("span", [V.attrClass("path-row cfg-conferir-row")], [
      V.viewEl("output", [
        V.attrId("cfg-conferir-app"),
        V.attrClass("cfg-conferir-app"),
        V.attrAria("labelledby", "cfg-conferir-label")
      ], [V.viewText(app)]),
      V.viewEl("button", V.attrConcat(
        [V.attrType("button"), V.attrId("cfg-conferir-choose"), V.attrAria("expanded", "false"), V.attrOn("click", "Choose")],
        V.attrWhen(Bool.not(available), V.attr("disabled", ""))
      ), [V.viewText(chooseLabel())]),
      V.viewEl("button", V.attrConcat(
        [V.attrType("button"), V.attrId("cfg-conferir-back"), V.attrClass("cfg-conferir-back"), V.attrOn("click", "Back")],
        V.attrWhen(Bool.not(canGoBack), V.attr("hidden", ""))
      ), [V.viewText(backLabel())])
    ]),
    V.viewEl("p", [V.attrClass("cfg-conferir-hint"), V.attrId("cfg-conferir-hint")], [V.viewText(fieldHintFor(available))])
  ])

# ---------- o aviso de app ausente ----------

# A frase de "o app não está aberto" e a ação dela: `ChooseOther` leva às
# Configurações, no campo. Nada é capturado no lugar.
def absentView(app: String, saved: Bool) -> V.ViewNode:
  V.viewEl("div", [V.attrClass("check-note-body")], [
    V.viewEl("p", [V.attrClass("check-note-text")], [V.viewText(absentLead(app, saved))]),
    V.viewEl("button", [
      V.attrType("button"), V.attrClass("check-note-pick"), V.attrOn("click", "ChooseOther")
    ], [V.viewText(chooseOtherLabel())])
  ])

import Base
import msg.bend as M
import view.bend as V

# ---------------------------------------------------------------------------
# Folha "Lista 0" do leitor sem material (ticket #12 da spec de redesenho).
# Módulo só da Mesa: a Conversa não tem leitor e não importa daqui.
#
# Um leitor sem material não mostra um painel vazio: mostra uma folha branca
# que se lê como uma lista de exercícios — título, nome da matéria e quatro
# itens que explicam como pôr um material ali — e, abaixo, a área tracejada de
# soltar. É papel, como a página do PDF: o CSS a mantém branca com texto escuro
# nos dois temas e os links usam o tom de acento legível sobre branco.
#
# Puro: entra o nome da matéria (fato do host) e sai a árvore. O aplicador
# (`desk/src/pdf.mjs`) a monta no `.pdf-viewport` do leitor com os handlers da
# tabela dele; este núcleo só NOMEIA o que cada atalho faz:
#
#   OpenFile      — "Abrir PDF…": o seletor de arquivos do sistema;
#   RevealFolder  — "Mostrar a pasta": a pasta da matéria no sistema;
#   AskTutor      — "Pedir ao tutor": o pedido de PDF ao tutor.
#
# O primeiro caminho (arrastar) não tem botão: o quadro tracejado abaixo é o
# próprio atalho, e vale soltar em qualquer ponto do leitor.
#
# O que não cabe aqui: abrir arquivo, mostrar pasta, falar com o tutor e a
# sobreposição do arrasto (`core/pdfpageview.bend`, `dropHint`).
# ---------------------------------------------------------------------------

# ---------- textos ----------

def sheetTitle() -> String:
  M.msg("sheet.title")

def introText() -> String:
  M.msg("sheet.intro")

def dragText() -> String:
  M.msg("sheet.drag")

def openText() -> String:
  M.msg("sheet.open")

def folderText() -> String:
  M.msg("sheet.folder")

def tutorText() -> String:
  M.msg("sheet.tutor")

def openLabel() -> String:
  M.msg("sheet.openLabel")

def folderLabel() -> String:
  M.msg("sheet.folderLabel")

def tutorLabel() -> String:
  M.msg("sheet.tutorLabel")

def dropTitle() -> String:
  M.msg("sheet.dropTitle")

def dropHelp() -> String:
  M.msg("sheet.dropHelp")

def sheetAria(course: String) -> String:
  M.msg1("sheet.aria", "course", course)

# O nome da matéria seguido do convite. Matéria sem nome (não deveria chegar
# aqui: o host só monta a folha com uma matéria) fica só com o convite.
def courseLine.pick(blank: Bool, course: String) -> String:
  match blank:
    case True{}:
      M.msg("sheet.courseBlank")
    case False{}:
      M.msg1("sheet.course", "course", course)

def courseLine(+course: String) -> String:
  courseLine.pick(String.is_empty(String.trim(course)), String.trim(course))

# O pedido que "Pedir ao tutor" já deixa escrito no diálogo de PDF pelo tutor
# (o usuário confere e envia). Mesma regra de nome em branco.
def tutorSeed.pick(blank: Bool, course: String) -> String:
  match blank:
    case True{}:
      M.msg("sheet.seedBlank")
    case False{}:
      M.msg1("sheet.seed", "course", course)

def tutorSeed(+course: String) -> String:
  tutorSeed.pick(String.is_empty(String.trim(course)), String.trim(course))

# ---------- peças ----------

# Atalho no fim da linha do item: botão que só nomeia o handler.
def link(label: String, handler: String) -> V.ViewNode:
  V.viewEl("button", [
    V.attrType("button"), V.attrClass("sheet-link"), V.attrOn("click", handler)
  ], [V.viewText(label)])

# Item sem atalho: só o texto.
def plainItem(text: String) -> V.ViewNode:
  V.viewEl("li", [V.attrClass("sheet-item")], [V.viewText(text)])

# Item com atalho: o texto, um espaço e o botão (continuam na mesma linha).
def linkItem(text: String, label: String, handler: String) -> V.ViewNode:
  V.viewEl("li", [V.attrClass("sheet-item")], [
    V.viewText(text),
    V.viewText(" "),
    link(label, handler)
  ])

def items() -> List<&2, V.ViewNode>:
  [
    plainItem(dragText()),
    linkItem(openText(), openLabel(), "OpenFile"),
    linkItem(folderText(), folderLabel(), "RevealFolder"),
    linkItem(tutorText(), tutorLabel(), "AskTutor")
  ]

# Quadro tracejado: o ícone é andaime `data-icon` (o host põe o SVG).
def dropZone() -> V.ViewNode:
  V.viewEl("div", [V.attrClass("sheet-drop")], [
    V.viewEl("span", [V.attrClass("sheet-drop-icon"), V.attrData("icon", "download"), V.attrAria("hidden", "true")], Nil{}),
    V.viewEl("strong", Nil{}, [V.viewText(dropTitle())]),
    V.viewEl("small", Nil{}, [V.viewText(dropHelp())])
  ])

# ---------- a folha ----------

# A folha do leitor sem material de uma matéria com este nome.
def sheet(+course: String) -> V.ViewNode:
  V.viewEl("article", [
    V.attrClass("reader-sheet"), V.attrAria("label", sheetAria(course))
  ], [
    V.viewEl("h1", [V.attrClass("sheet-title")], [V.viewText(sheetTitle())]),
    V.viewEl("p", [V.attrClass("sheet-course")], [V.viewText(courseLine(course))]),
    V.viewEl("p", [V.attrClass("sheet-intro")], [V.viewText(introText())]),
    V.viewEl("ol", [V.attrClass("sheet-items")], items()),
    dropZone()
  ])

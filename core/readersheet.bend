import Base
import msg.bend as M
import view.bend as V

# ---------------------------------------------------------------------------
# Folha "Lista 0" do leitor sem material (ticket #12 da spec de redesenho).
# Módulo só da Mesa: a Conversa não tem leitor e não importa daqui.
#
# Um leitor sem material não mostra um painel vazio: mostra uma folha branca
# com a área tracejada "Solte um PDF aqui" e três links pequenos embaixo
# (Abrir · Pasta · Pedir ao tutor). É papel, como a página do PDF: o CSS a
# mantém branca com texto escuro nos dois temas e os links usam o tom de acento
# legível sobre branco.
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

def openLabel() -> String:
  M.msg("sheet.openLabel")

def folderLabel() -> String:
  M.msg("sheet.folderLabel")

def tutorLabel() -> String:
  M.msg("sheet.tutorLabel")

def dropTitle() -> String:
  M.msg("sheet.dropTitle")

def sheetAria(course: String) -> String:
  M.msg1("sheet.aria", "course", course)

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

# Atalho no fim da folha: botão que só nomeia o handler.
def link(label: String, handler: String) -> V.ViewNode:
  V.viewEl("button", [
    V.attrType("button"), V.attrClass("sheet-link"), V.attrOn("click", handler)
  ], [V.viewText(label)])

# Separador entre atalhos: um "·" visual, escondido do leitor de tela (cada
# botão já se anuncia sozinho).
def separator() -> V.ViewNode:
  V.viewEl("span", [V.attrClass("sheet-sep"), V.attrAria("hidden", "true")], [V.viewText("·")])

def spaced.go(items: List<&2, V.ViewNode>) -> List<&2, V.ViewNode>:
  match items:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      match t:
        case Nil{}:
          [h]
        case Con{_, _}:
          Con{h, Con{separator(), spaced.go(t)}}

# Os três atalhos pequenos embaixo da zona de soltar, separados por "·".
def items() -> List<&2, V.ViewNode>:
  spaced.go([link(openLabel(), "OpenFile"), link(folderLabel(), "RevealFolder"), link(tutorLabel(), "AskTutor")])

# Quadro tracejado: o ícone é andaime `data-icon` (o host põe o SVG).
def dropZone() -> V.ViewNode:
  V.viewEl("div", [V.attrClass("sheet-drop")], [
    V.viewEl("span", [V.attrClass("sheet-drop-icon"), V.attrData("icon", "download"), V.attrAria("hidden", "true")], Nil{}),
    V.viewEl("strong", Nil{}, [V.viewText(dropTitle())])
  ])

# ---------- a folha ----------

# A folha do leitor sem material de uma matéria com este nome.
def sheet(+course: String) -> V.ViewNode:
  V.viewEl("article", [
    V.attrClass("reader-sheet"), V.attrAria("label", sheetAria(course))
  ], [
    dropZone(),
    V.viewEl("div", [V.attrClass("sheet-links")], items())
  ])

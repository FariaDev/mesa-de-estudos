import Base
import view.bend as V

# ---------------------------------------------------------------------------
# Flags do bloco `desk` que o `applyDesk` escrevia em controles vivos do
# `index.html`: o botão de referências do composer (`#include-refs`), o
# contexto de estudo (`#study-context`), o Conferir Xournal++ (`#check`) e o
# divisor da calculadora (`#calc-divider`).
#
# O host normaliza o `desk` (só o `false` explícito desliga) e entrega os
# fatos como Bool. A única decisão que não é espelho de `hidden` é o
# `aria-pressed` do botão de referências: com a flag desligada o botão some e
# as referências ficam ligadas (`pressed` forçado em true, como no applyDesk
# antigo). O rótulo do `#reference-toggle`, o `#xournal`, o `#end-day` (que
# saiu do composer e virou item do menu Estudar) e o `#review-open` são do
# `core/tabsview.bend` — este núcleo não os toca.
#
# Os nós aqui são só de atributos (filhos `Nil`): os elementos do `index.html`
# têm texto, ícone injetado (`labelBtn`) e handlers próprios; o host aplica os
# atributos no nó vivo. Nada aqui lê DOM, mede ou fala IPC.
#
# O Conferir Xournal++ é de TODAS as plataformas suportadas (macOS e Windows
# capturam a janela do Xournal++ — o `capture-ready` do main.cjs escolhe o
# método): só a flag `conferir` decide o `hidden`, sem fato de plataforma.
# ---------------------------------------------------------------------------

# Fatos normalizados do `desk` + o estado corrente do botão de referências.
type DeskFlags is Data:
  DeskFlags{
    refsToggle: Bool,
    includeRefs: Bool,
    studyContext: Bool,
    conferir: Bool,
    calculator: Bool
  }

def hiddenAttrs(hidden: Bool) -> List<&2, V.ViewAttr>:
  V.attrWhen(hidden, V.ViewAttr{"hidden", ""})

# Com a flag desligada o botão não aparece e as referências seguem ligadas.
def refsPressed.if(refsToggle: Bool, includeRefs: Bool) -> Bool:
  match refsToggle:
    case True{}:
      includeRefs
    case False{}:
      True{}

def includeRefsButton(f: DeskFlags) -> V.ViewNode:
  match f:
    case DeskFlags{+refsToggle, includeRefs, _, _, _}:
      V.viewEl("button", V.attrJoin([
        [V.attrId("include-refs"), V.attrAria("pressed", V.boolStr(refsPressed.if(refsToggle, includeRefs)))],
        hiddenAttrs(Bool.not(refsToggle))
      ]), Nil{})

def studyContextRow(f: DeskFlags) -> V.ViewNode:
  match f:
    case DeskFlags{_, _, studyContext, _, _}:
      V.viewEl("div", V.attrJoin([
        [V.attrId("study-context")],
        hiddenAttrs(Bool.not(studyContext))
      ]), Nil{})

# Só a flag `conferir` desliga o botão: a captura existe no macOS e no
# Windows (métodos diferentes — screencapture × PowerShell — mesmo anexo).
def conferirButton(f: DeskFlags) -> V.ViewNode:
  match f:
    case DeskFlags{_, _, _, conferir, _}:
      V.viewEl("button", V.attrJoin([
        [V.attrId("check")],
        hiddenAttrs(Bool.not(conferir))
      ]), Nil{})

def calcDivider(f: DeskFlags) -> V.ViewNode:
  match f:
    case DeskFlags{_, _, _, _, calculator}:
      V.viewEl("div", V.attrJoin([
        [V.attrId("calc-divider")],
        hiddenAttrs(Bool.not(calculator))
      ]), Nil{})

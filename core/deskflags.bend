import Base
import view.bend as V

# ---------------------------------------------------------------------------
# Flags do bloco `desk` que o `applyDesk` escrevia em controles vivos do
# `index.html`: o botão de referências do composer (`#include-refs`), o
# Encerrar por hoje (`#end-day`), o contexto de estudo (`#study-context`), o
# Conferir Xournal++ (`#check`) e o divisor da calculadora (`#calc-divider`).
#
# O host normaliza o `desk` (só o `false` explícito desliga) e entrega os
# fatos como Bool. A única decisão que não é espelho de `hidden` é o
# `aria-pressed` do botão de referências: com a flag desligada o botão some e
# as referências ficam ligadas (`pressed` forçado em true, como no applyDesk
# antigo). O rótulo do `#reference-toggle` e o `#xournal` são do
# `core/tabsview.bend` — este núcleo não os toca.
#
# Os nós aqui são só de atributos (filhos `Nil`): os elementos do `index.html`
# têm texto, ícone injetado (`labelBtn`) e handlers próprios; o host aplica os
# atributos no nó vivo. Nada aqui lê DOM, mede ou fala IPC.
# ---------------------------------------------------------------------------

# Fatos normalizados do `desk` + o estado corrente do botão de referências +
# o fato `win32` (o Conferir Xournal++ é só macOS).
type DeskFlags is Data:
  DeskFlags{
    refsToggle: Bool,
    includeRefs: Bool,
    endDay: Bool,
    studyContext: Bool,
    conferir: Bool,
    calculator: Bool,
    win32: Bool
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
    case DeskFlags{+refsToggle, includeRefs, _, _, _, _, _}:
      V.viewEl("button", V.attrJoin([
        [V.attrId("include-refs"), V.attrAria("pressed", V.boolStr(refsPressed.if(refsToggle, includeRefs)))],
        hiddenAttrs(Bool.not(refsToggle))
      ]), Nil{})

def endDayButton(f: DeskFlags) -> V.ViewNode:
  match f:
    case DeskFlags{_, _, endDay, _, _, _, _}:
      V.viewEl("button", V.attrJoin([
        [V.attrId("end-day")],
        hiddenAttrs(Bool.not(endDay))
      ]), Nil{})

def studyContextRow(f: DeskFlags) -> V.ViewNode:
  match f:
    case DeskFlags{_, _, _, studyContext, _, _, _}:
      V.viewEl("div", V.attrJoin([
        [V.attrId("study-context")],
        hiddenAttrs(Bool.not(studyContext))
      ]), Nil{})

# No win32 o botão some mesmo com a flag ligada: a captura é só macOS.
def conferirButton(f: DeskFlags) -> V.ViewNode:
  match f:
    case DeskFlags{_, _, _, _, conferir, _, win32}:
      V.viewEl("button", V.attrJoin([
        [V.attrId("check")],
        hiddenAttrs(Bool.or(Bool.not(conferir), win32))
      ]), Nil{})

def calcDivider(f: DeskFlags) -> V.ViewNode:
  match f:
    case DeskFlags{_, _, _, _, _, calculator, _}:
      V.viewEl("div", V.attrJoin([
        [V.attrId("calc-divider")],
        hiddenAttrs(Bool.not(calculator))
      ]), Nil{})

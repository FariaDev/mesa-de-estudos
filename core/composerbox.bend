import Base
import msg.bend as M
import view.bend as V

# ---------------------------------------------------------------------------
# Caixa de mensagem única da coluna do tutor (ticket #15 da spec de
# redesenho). Módulo só da Mesa: a Conversa tem o seu próprio composer e não
# importa daqui (`composerview.bend` segue sendo o núcleo compartilhado da
# fila).
#
# Duas decisões moram aqui:
#
#   1. O resumo do contexto — o que seguirá com a próxima mensagem: a matéria,
#      o contexto de estudo (lista/questão ativa e o rascunho .xopp), e as
#      referências (materiais abertos e a página). Desde a #123 ele mora em
#      Mais opções → Contexto, não acima da caixa; o composer fica só com a
#      escrita. O host entrega fatos já resolvidos em texto (nome da matéria,
#      título da questão, nome do arquivo .xopp, "Limites.pdf p. 4") e a flag
#      `studyContext` normalizada; o núcleo decide o que entra, a ordem e a
#      redação. Referências desligadas aparecem como tal (nunca somem em
#      silêncio): o resumo reflete o alternador.
#
#   2. O encaixe Enviar/Parar: o mesmo lugar da fileira de ações guarda os dois
#      botões e nunca mostra os dois — ocioso, Enviar; durante a resposta,
#      Parar. Só atributos (como `core/deskflags.bend`): texto, ícone e
#      handlers são do index.html.
#
#   3. A fileira de ações (#42, #90): anexar (um menu), Referências (ícone com
#      estado), o indicador de modelo e esforço e, por último, Enviar/Parar —
#      como nos apps de chat, o indicador fica à esquerda do Enviar. Foto do
#      celular e a captura do Conferir moram no menu Anexar. Em caixa estreita
#      a fileira cede em degraus (`rowFit`): primeiro o esforço, depois o nome
#      do modelo (vira ícone; o nome acessível segue completo). O host mede se
#      cabe; o núcleo escolhe o degrau.
#
# Nada aqui lê DOM, mede ou fala IPC.
# ---------------------------------------------------------------------------

# Referência aberta: nome do arquivo e a página já formatada ("p.3"). O host
# resolve os dois fatos; o núcleo não fatia texto nem conhece o caminho.
type GoesRef is Data:
  GoesRef{name: String, page: String}

# ---------- resumo do contexto (Mais opções → Contexto) ----------

# Texto traduzível (#41): o prefixo, "só a mensagem" e "Referências desligadas"
# são mensagens do catálogo, cada uma num nó de texto próprio, para a linha
# inteira não virar uma frase que o núcleo teria de concatenar com texto
# já traduzido. O texto da linha é a soma dos nós.
def goesPrefix() -> String:
  M.msg("goes.prefix")

# Nada além do texto digitado vai com a mensagem.
def goesNothing() -> String:
  M.msg("goes.nothing")

def goesRefsOff() -> String:
  M.msg("goes.refsOff")

def refsSeparator() -> String:
  ", "

def present(+text: String) -> Bool:
  Bool.not(String.eq(text, ""))

def partNode(+text: String) -> V.ViewNode:
  V.viewText(text)

# ---------- pílulas (#90) ----------
# Cada item da linha é uma pílula: a matéria primeiro, depois questão, rascunho
# e uma por material aberto. O nome inteiro fica em `title` e `aria-label`; o
# CSS encurta só o `.goes-pill-name` com reticências.

def pillAttrs(+cls: String, +label: String) -> List<&2, V.ViewAttr>:
  [V.attrClass("goes-pill " ++ cls), V.attrTitle(label), V.attrAria("label", label)]

def pill(+cls: String, +label: String, kids: List<&2, V.ViewNode>) -> V.ViewNode:
  V.viewEl("span", pillAttrs(cls, label), kids)

def nameSpan(+text: String) -> V.ViewNode:
  V.viewEl("span", [V.attrClass("goes-pill-name")], [V.viewText(text)])

def pageSpan(+page: String) -> V.ViewNode:
  V.viewEl("span", [V.attrClass("goes-pill-page")], [V.viewText(page)])

def textPill(+text: String) -> V.ViewNode:
  pill("goes-rest", text, [nameSpan(text)])

def coursePill(+course: String) -> V.ViewNode:
  pill("goes-course", course, [nameSpan(course)])

# A pílula da referência guarda a página num nó que não encolhe (`p.N` sempre
# visível) enquanto o nome corta com reticências.
def refLabel(ref: GoesRef) -> String:
  match ref:
    case GoesRef{name, page}:
      name ++ " " ++ page

def refName(ref: GoesRef) -> String:
  match ref:
    case GoesRef{name, _}:
      name

def refPage(ref: GoesRef) -> String:
  match ref:
    case GoesRef{_, page}:
      page

def refPill(+ref: GoesRef) -> V.ViewNode:
  pill("goes-rest", refLabel(ref), [
    nameSpan(refName(ref)),
    pageSpan(" " ++ refPage(ref))
  ])

# Uma parte da linha: entra só quando a condição vale e o texto não é vazio.
def keepPart(keep: Bool, +text: String) -> List<&2, V.ViewNode>:
  match keep:
    case True{}:
      [textPill(text)]
    case False{}:
      Nil{}

def partIf(+on: Bool, +text: String) -> List<&2, V.ViewNode>:
  keepPart(Bool.and(on, present(text)), text)

# Referências ligadas listam os materiais abertos, um por pílula; nenhum
# aberto: nada a dizer. Desligadas, a linha diz que estão desligadas e não
# lista nada.
def refsParts.go(refs: +List<GoesRef>) -> List<&2, V.ViewNode>:
  match refs:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      Con{refPill(h), refsParts.go(t)}

def refsParts(refsOn: Bool, refs: +List<GoesRef>) -> List<&2, V.ViewNode>:
  match refsOn:
    case True{}:
      refsParts.go(refs)
    case False{}:
      [textPill(goesRefsOff())]

# O resumo como árvore, em pílulas. O `goes-lead` ("Contexto: ") fica no DOM
# para o nome acessível, mas o CSS o esconde quando há pílula: a matéria é a
# primeira coisa à vista. Sem nenhuma parte, a frase "só a mensagem" já traz o
# próprio prefixo.

def goesSpanText(+cls: String, +text: String) -> V.ViewNode:
  V.viewEl("span", [V.attrClass(cls)], [partNode(text)])

# O que vem depois da matéria: questão, rascunho e referências.
def afterCourseParts(+study: Bool, +title: String, +xopp: String, refsOn: Bool, refs: +List<GoesRef>) -> List<&2, V.ViewNode>:
  List.append(
    &2, V.ViewNode,
    List.append(&2, V.ViewNode, partIf(study, title), partIf(study, xopp)),
    refsParts(refsOn, refs)
  )

def goesWithCourse(+course: String, parts: List<&2, V.ViewNode>) -> List<&2, V.ViewNode>:
  List.append(
    &2, V.ViewNode,
    [goesSpanText("goes-lead", goesPrefix()), coursePill(course)],
    parts
  )

def goesWithoutCourse(parts: List<&2, V.ViewNode>) -> List<&2, V.ViewNode>:
  match parts:
    case Nil{}:
      [partNode(goesNothing())]
    case Con{_, _}:
      Con{goesSpanText("goes-lead", goesPrefix()), parts}

# `hasCourse`: a matéria vai junto (flag ligada e nome não vazio). Sem ela, as
# partes que restam são todas as que vão.
def goesTreeFrom(hasCourse: Bool, +course: String, rest: List<&2, V.ViewNode>) -> List<&2, V.ViewNode>:
  match hasCourse:
    case True{}:
      goesWithCourse(course, rest)
    case False{}:
      goesWithoutCourse(rest)

def goesTree(
  +study: Bool, +course: String, +title: String, +xopp: String, refsOn: Bool, refs: +List<GoesRef>
) -> List<&2, V.ViewNode>:
  goesTreeFrom(Bool.and(study, present(course)), course, afterCourseParts(study, title, xopp, refsOn, refs))

# ---------- nota do popover de edição ----------

# O popover de "Editar" repete, em frase, o que as referências mandam. A frase
# é do núcleo (como a linha), com o mesmo ramo desligadas / listadas / nenhum
# aberto; `capture` é o fato "Conferir existe": só então a nota lembra que a
# captura segue como imagem, à parte, e não como referência.

def noteRefsOff() -> String:
  M.msg("goes.note.off")

def noteRefsNone() -> String:
  M.msg("goes.note.none")

def noteRefsListed(+list: String, +capture: Bool) -> String:
  match capture:
    case True{}:
      M.msg("goes.note.listedCapture")
    case False{}:
      M.msg("goes.note.listed")

def refLabels.go(refs: +List<GoesRef>) -> List<&2, String>:
  match refs:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      Con{refLabel(h), refLabels.go(t)}

def refLabels(refs: +List<GoesRef>) -> List<&2, String>:
  refLabels.go(refs)

def refsNote(refsOn: Bool, refs: +List<GoesRef>, +capture: Bool) -> String:
  match refsOn:
    case True{}:
      match refs:
        case Nil{}:
          noteRefsNone()
        case Con{_, _}:
          noteRefsListed(String.join(refLabels(refs), refsSeparator()), capture)
    case False{}:
      noteRefsOff()

# ---------- Enviar / Parar ----------

def hiddenIf(hidden: Bool) -> List<&2, V.ViewAttr>:
  V.attrWhen(hidden, V.ViewAttr{"hidden", ""})

# Enviar existe enquanto o tutor está livre; durante a resposta o lugar é do
# Parar. `busy` é o fato do host (turno aberto). A classe `primary` (a ação
# principal, em cor de acento) viaja no nó porque o host aplica os atributos
# sobre o elemento vivo e o que o nó não traz sai de lá.
def sendButton(busy: Bool) -> V.ViewNode:
  V.viewEl("button", V.attrJoin([
    [V.attrId("send"), V.attrClass("primary")],
    hiddenIf(busy)
  ]), Nil{})

def stopButton(busy: Bool) -> V.ViewNode:
  V.viewEl("button", V.attrJoin([
    [V.attrId("stop")],
    hiddenIf(Bool.not(busy))
  ]), Nil{})

# ---------- a fileira de ações (#42) ----------

# Ordem da fileira, da esquerda para a direita. O host arruma os nós vivos do
# `index.html` nesta ordem; Enviar e Parar dividem o último lugar (um só
# aparece).
def actionIds() -> List<&2, String>:
  ["attach", "include-refs", "model-indicator", "stop", "send"]

# Degrau da fileira em caixa estreita (o host grava em `data-fit` da fileira):
#   ""       o par "modelo · esforço";
#   "model"  o esforço do indicador cede — fica só o modelo;
#   "icon"   o modelo vira só o ícone (o nome acessível segue completo).
# O host mede, do mais folgado ao mais apertado, se cada degrau cabe; o núcleo
# escolhe o primeiro que cabe. O esforço cede antes do modelo porque o modelo
# diz algo que nenhum outro lugar da fileira diz.
def rowFit(fullFits: Bool, modelFits: Bool) -> String:
  match fullFits:
    case True{}:
      ""
    case False{}:
      match modelFits:
        case True{}:
          "model"
        case False{}:
          "icon"

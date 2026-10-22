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
#   1. A linha "Vai junto: …" acima da caixa — o que seguirá com a próxima
#      mensagem: a matéria, o contexto de estudo (lista/questão ativa e o
#      rascunho .xopp), e as referências (materiais abertos e a página). O host
#      entrega fatos já resolvidos em texto (nome da matéria, título da
#      questão, nome do arquivo .xopp, "Limites.pdf p. 4") e a flag
#      `studyContext` normalizada; o núcleo decide o que entra, a ordem e a
#      redação. Referências desligadas aparecem como tal (nunca somem em
#      silêncio): a linha reflete o alternador.
#
#   2. O encaixe Enviar/Parar: o mesmo lugar da fileira de ações guarda os dois
#      botões e nunca mostra os dois — ocioso, Enviar; durante a resposta,
#      Parar. Só atributos (como `core/deskflags.bend`): texto, ícone e
#      handlers são do index.html.
#
#   3. A fileira de ações (#42): anexar, Referências, Conferir, o indicador de
#      modelo e esforço e, por último, Enviar/Parar — como nos apps de chat, o
#      indicador fica à esquerda do Enviar. Em caixa estreita a fileira cede
#      em degraus (`rowFit`): o rótulo de Referências, depois o esforço, por
#      fim o nome do modelo (vira ícone; o nome acessível segue completo). O
#      host mede se cabe; o núcleo escolhe o degrau.
#
# Nada aqui lê DOM, mede ou fala IPC.
# ---------------------------------------------------------------------------

# ---------- linha "Vai junto" ----------

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

def goesSeparator() -> String:
  " · "

def refsSeparator() -> String:
  ", "

def present(+text: String) -> Bool:
  Bool.not(String.eq(text, ""))

def partNode(+text: String) -> V.ViewNode:
  V.viewText(text)

# Uma parte da linha: entra só quando a condição vale e o texto não é vazio.
def keepPart(keep: Bool, +text: String) -> List<&2, V.ViewNode>:
  match keep:
    case True{}:
      [partNode(text)]
    case False{}:
      Nil{}

def partIf(+on: Bool, +text: String) -> List<&2, V.ViewNode>:
  keepPart(Bool.and(on, present(text)), text)

# Referências ligadas listam os materiais abertos (nenhum aberto: nada a
# dizer); desligadas, a linha diz que estão desligadas e não lista nada.
def refsParts(refsOn: Bool, refs: +List<String>) -> List<&2, V.ViewNode>:
  match refsOn:
    case True{}:
      match refs:
        case Nil{}:
          Nil{}
        case Con{h, t}:
          [partNode(String.join(Con{h, t}, refsSeparator()))]
    case False{}:
      [partNode(goesRefsOff())]

# As partes com o separador entre elas (nunca solto na ponta).
def interleave.tail(parts: List<&2, V.ViewNode>) -> List<&2, V.ViewNode>:
  match parts:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      Con{partNode(goesSeparator()), Con{h, interleave.tail(t)}}

def interleave(parts: List<&2, V.ViewNode>) -> List<&2, V.ViewNode>:
  match parts:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      Con{h, interleave.tail(t)}

# A mesma linha como árvore, para o CSS saber o que cortar primeiro quando
# falta espaço: o nome da matéria cede antes da lista/questão, do rascunho e
# da página.
#
#   <span class="goes-lead">Vai junto: </span>
#   <span class="goes-course">Cálculo I</span>
#   <span class="goes-sep"> · </span>
#   <span class="goes-rest">Lista 3 q.2 · rascunho.xopp · Limites.pdf p. 4</span>
#
# O separador depois da matéria é um nó à parte, que encolhe junto com ela: sem
# a matéria não sobra " · " pendurado. Sem matéria (ou com a flag
# `studyContext` desligada) não há `goes-course` nem `goes-sep`, e tudo o que
# vai fica em `goes-rest`. A flag `studyContext` liga e desliga por inteiro o
# contexto de estudo (a matéria vai junto dele).

def goesSpan(+cls: String, kids: List<&2, V.ViewNode>) -> V.ViewNode:
  V.viewEl("span", [V.attrClass(cls)], kids)

def goesSpanText(+cls: String, +text: String) -> V.ViewNode:
  goesSpan(cls, [partNode(text)])

# O que vem depois da matéria: questão, rascunho e referências.
def afterCourseParts(+study: Bool, +title: String, +xopp: String, refsOn: Bool, refs: +List<String>) -> List<&2, V.ViewNode>:
  List.append(
    &2, V.ViewNode,
    List.append(&2, V.ViewNode, partIf(study, title), partIf(study, xopp)),
    refsParts(refsOn, refs)
  )

def restNodes(parts: List<&2, V.ViewNode>) -> List<&2, V.ViewNode>:
  match parts:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      [goesSpan("goes-rest", interleave(Con{h, t}))]

def restAfterCourse(parts: List<&2, V.ViewNode>) -> List<&2, V.ViewNode>:
  match parts:
    case Nil{}:
      Nil{}
    case Con{h, t}:
      Con{goesSpanText("goes-sep", goesSeparator()), restNodes(Con{h, t})}

def goesWithCourse(+course: String, parts: List<&2, V.ViewNode>) -> List<&2, V.ViewNode>:
  List.append(
    &2, V.ViewNode,
    [goesSpanText("goes-lead", goesPrefix()), goesSpanText("goes-course", course)],
    restAfterCourse(parts)
  )

def goesWithoutCourse(parts: List<&2, V.ViewNode>) -> List<&2, V.ViewNode>:
  match parts:
    case Nil{}:
      [partNode(goesNothing())]
    case Con{h, t}:
      Con{goesSpanText("goes-lead", goesPrefix()), restNodes(Con{h, t})}

# `hasCourse`: a matéria vai junto (flag ligada e nome não vazio). Sem ela, as
# partes que restam são todas as que vão.
def goesTreeFrom(hasCourse: Bool, +course: String, rest: List<&2, V.ViewNode>) -> List<&2, V.ViewNode>:
  match hasCourse:
    case True{}:
      goesWithCourse(course, rest)
    case False{}:
      goesWithoutCourse(rest)

def goesTree(
  +study: Bool, +course: String, +title: String, +xopp: String, refsOn: Bool, refs: +List<String>
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
      M.msg1("goes.note.listedCapture", "list", list)
    case False{}:
      M.msg1("goes.note.listed", "list", list)

def refsNote(refsOn: Bool, refs: +List<String>, +capture: Bool) -> String:
  match refsOn:
    case True{}:
      match refs:
        case Nil{}:
          noteRefsNone()
        case Con{h, t}:
          noteRefsListed(String.join(Con{h, t}, refsSeparator()), capture)
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
  ["attach", "include-refs", "check", "model-indicator", "stop", "send"]

# Degrau da fileira em caixa estreita (o host grava em `data-fit` da fileira):
#   ""        tudo com rótulo: Referências escrito e o par "modelo · esforço";
#   "compact" Referências vira só o ícone (o estado ligado/desligado continua
#             na forma do botão);
#   "model"   o esforço do indicador cede — fica só o modelo;
#   "icon"    o modelo vira só o ícone (o nome acessível segue completo).
# O host mede, do mais folgado ao mais apertado, se cada degrau cabe; o núcleo
# escolhe o primeiro que cabe. O esforço cede antes do modelo, e o rótulo de
# Referências antes dos dois: o indicador diz algo que nenhum outro lugar
# da fileira diz.
def rowFit(fullFits: Bool, compactFits: Bool, modelFits: Bool) -> String:
  match fullFits:
    case True{}:
      ""
    case False{}:
      match compactFits:
        case True{}:
          "compact"
        case False{}:
          match modelFits:
            case True{}:
              "model"
            case False{}:
              "icon"

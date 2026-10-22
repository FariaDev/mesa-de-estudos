import Base
import msg.bend as M
import view.bend as V

# ---------------------------------------------------------------------------
# Guia da Mesa (o antigo "Como usar"): a ordem das seções, o "Próximo" e o
# "Anterior" de cada uma, a busca dentro do guia e os nós da lateral.
#
# O casco do `<dialog id="help-dialog">` e o corpo das seções (tópicos com
# trechos em negrito, `kbd`, itens que somem por flag) ficam no HTML estático;
# este núcleo decide o que não pode quebrar:
#   - a ordem da lateral é a ordem do Próximo/Anterior, e é uma só;
#   - a última seção não tem "Próximo"; a primeira não tem "Anterior";
#   - com uma busca, só as seções com resultado entram na lateral e na
#     sequência (o Próximo pula as escondidas);
#   - a seção ativa que some da busca cede a vez à primeira que sobrou.
#
# `vis` é a lista de ids visíveis em ordem canônica (`guideVisible`). O host
# conta os resultados no texto do DOM e só entrega quais seções casaram.
# Convenções de attr: as do `view.bend` (`on:click` vira lookup na tabela de
# handlers do host; o clique lê `data-section`).
# ---------------------------------------------------------------------------

def guideAll() -> List<&2, String>:
  Con{"comecar", Con{"tutor", Con{"leitores", Con{"lateral", Con{"revisao", Con{"calc", Con{"atalhos", Nil{}}}}}}}}

# ---------- texto de cada seção ----------

def guidePick(+hit: Bool, +found: String, +rest: String) -> String:
  match hit:
    case True{}:
      found
    case False{}:
      rest

def guideLabel(+id: String) -> String:
  guidePick(String.eq(id, "comecar"), M.msg("guide.label.comecar"),
  guidePick(String.eq(id, "tutor"), M.msg("guide.label.tutor"),
  guidePick(String.eq(id, "leitores"), M.msg("guide.label.leitores"),
  guidePick(String.eq(id, "lateral"), M.msg("guide.label.lateral"),
  guidePick(String.eq(id, "revisao"), M.msg("guide.label.revisao"),
  guidePick(String.eq(id, "calc"), M.msg("guide.label.calc"),
  guidePick(String.eq(id, "atalhos"), M.msg("guide.label.atalhos"), ""))))))) 

def guideTitle(+id: String) -> String:
  guidePick(String.eq(id, "comecar"), M.msg("guide.sectionTitle.comecar"),
  guidePick(String.eq(id, "tutor"), M.msg("guide.sectionTitle.tutor"),
  guidePick(String.eq(id, "leitores"), M.msg("guide.sectionTitle.leitores"),
  guidePick(String.eq(id, "lateral"), M.msg("guide.sectionTitle.lateral"),
  guidePick(String.eq(id, "revisao"), M.msg("guide.sectionTitle.revisao"),
  guidePick(String.eq(id, "calc"), M.msg("guide.sectionTitle.calc"),
  guidePick(String.eq(id, "atalhos"), M.msg("guide.label.atalhos"), ""))))))) 

def guideLead(+id: String) -> String:
  guidePick(String.eq(id, "comecar"), M.msg("guide.lead.comecar"),
  guidePick(String.eq(id, "tutor"), M.msg("guide.lead.tutor"),
  guidePick(String.eq(id, "leitores"), M.msg("guide.lead.leitores"),
  guidePick(String.eq(id, "lateral"), M.msg("guide.lead.lateral"),
  guidePick(String.eq(id, "revisao"), M.msg("guide.lead.revisao"),
  guidePick(String.eq(id, "calc"), M.msg("guide.lead.calc"),
  guidePick(String.eq(id, "atalhos"), M.msg("guide.lead.atalhos"), ""))))))) 

def guideCrumb(+id: String) -> String:
  guideLabel(id)

def guideSearchLabel() -> String:
  M.msg("guide.search")

def guideNoHits() -> String:
  M.msg("guide.noHits")

# ---------- a sequência ----------

def guideHas.step(+same: Bool, +rest: Bool) -> Bool:
  Bool.or(same, rest)

def guideHas(+xs: List<&2, String>, +id: String) -> Bool:
  match xs:
    case Nil{}:
      False{}
    case Con{+h, t}:
      guideHas.step(String.eq(h, id), guideHas(t, id))

# Mantém a ordem canônica: o que o host entrega (`hits`) só diz QUAIS seções.
def guideKeep.step(+hit: Bool, +h: String, +rest: List<&2, String>) -> List<&2, String>:
  match hit:
    case True{}:
      Con{h, rest}
    case False{}:
      rest

def guideKeep(+all: List<&2, String>, +hits: List<&2, String>) -> List<&2, String>:
  match all:
    case Nil{}:
      Nil{}
    case Con{+h, t}:
      guideKeep.step(guideHas(hits, h), h, guideKeep(t, hits))

# Sem busca o host entrega todas; com busca, as que casaram.
def guideVisible(+hits: List<&2, String>) -> List<&2, String>:
  guideKeep(guideAll(), hits)

def guideFirst(+xs: List<&2, String>) -> String:
  match xs:
    case Nil{}:
      ""
    case Con{h, t}:
      h

# A seção que aparece: a pedida, se ainda está na lista; senão a primeira.
def guideCurrent.pick(+member: Bool, +id: String, +first: String) -> String:
  match member:
    case True{}:
      id
    case False{}:
      first

def guideCurrent(+vis: List<&2, String>, +id: String) -> String:
  guideCurrent.pick(guideHas(vis, id), id, guideFirst(vis))

# O que vem depois de `id`; "" na última (ou quando `id` não está).
def guideNext.step(+same: Bool, +after: String, +rest: String) -> String:
  match same:
    case True{}:
      after
    case False{}:
      rest

def guideNext(+vis: List<&2, String>, +id: String) -> String:
  match vis:
    case Nil{}:
      ""
    case Con{+h, t}:
      guideNext.step(String.eq(h, id), guideFirst(t), guideNext(t, id))

# O que vem antes de `id`; "" na primeira (ou quando `id` não está).
def guidePrev.go(+vis: List<&2, String>, +id: String, +before: String) -> String:
  match vis:
    case Nil{}:
      ""
    case Con{+h, t}:
      guideNext.step(String.eq(h, id), before, guidePrev.go(t, id, h))

def guidePrev(+vis: List<&2, String>, +id: String) -> String:
  guidePrev.go(vis, id, "")

# ---------- rótulos do fim da seção ----------

def guideNextText.if(+next: String, +none: Bool) -> String:
  match none:
    case True{}:
      ""
    case False{}:
      M.msg1("guide.next", "section", "guide.label." ++ next)

def guideNextLabel(+vis: List<&2, String>, +id: String) -> String:
  guideNextText.if(guideNext(vis, id), String.is_empty(guideNext(vis, id)))

def guidePrevText.if(+none: Bool) -> String:
  match none:
    case True{}:
      ""
    case False{}:
      M.msg("guide.prev")

def guidePrevLabel(+vis: List<&2, String>, +id: String) -> String:
  guidePrevText.if(String.is_empty(guidePrev(vis, id)))

# ---------- nós ----------

def guideNavItem(+id: String, +cur: String) -> V.ViewNode:
  V.viewEl("button", [
    V.attrType("button"),
    V.attrClass("guide-nav-item"),
    V.attrData("section", id),
    V.attrAria("current", guidePick(String.eq(id, cur), "page", "false")),
    V.attrOn("click", "GuidePick")
  ], [V.viewText(guideLabel(id))])

def guideNavNodes(+vis: List<&2, String>, +cur: String) -> List<&2, V.ViewNode>:
  match vis:
    case Nil{}:
      Nil{}
    case Con{+h, t}:
      Con{guideNavItem(h, cur), guideNavNodes(t, cur)}

def guideStepNode(+kind: String, +target: String, +text: String) -> V.ViewNode:
  V.viewEl("button", [
    V.attrType("button"),
    V.attrClass(kind),
    V.attrData("section", target),
    V.attrOn("click", "GuidePick")
  ], [V.viewText(text)])

def guideStepWhen(+kind: String, +target: String, +text: String) -> List<&2, V.ViewNode>:
  V.viewWhen(Bool.not(String.is_empty(target)), guideStepNode(kind, target, text))

# "← Anterior" à esquerda e "Próximo: <seção> →" à direita; cada um só existe
# quando há para onde ir.
def guideFoot(+vis: List<&2, String>, +cur: String) -> List<&2, V.ViewNode>:
  V.viewConcat(
    guideStepWhen("guide-step guide-prev", guidePrev(vis, cur), guidePrevLabel(vis, cur)),
    guideStepWhen("guide-step guide-next", guideNext(vis, cur), guideNextLabel(vis, cur))
  )

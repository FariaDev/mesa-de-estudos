import Base
import view.bend as V

# ---------------------------------------------------------------------------
# View da fila de toasts e da faixa de atividade (app Mesa de Estudos).
#
# O host entrega fatos já resolvidos — o texto do aviso e se o item já está
# saindo (`closing`), o rótulo da atividade e se ele é o passo ao vivo — e este
# núcleo devolve a árvore de nós:
#   - `#toast[role=status]` com um `.toast-item` por aviso, na ordem (o mais
#     novo por último). O tom hoje é único; a variante do item é o estado de
#     saída, que entra no fim da lista de classes: `toast-item closing out`.
#   - `#activity[role=status][title]`: texto simples (`activityView`) ou o
#     passo ao vivo (`activityLiveView`) com `.pulse[aria-hidden]` +
#     `.activity-label`. Rótulo vazio deixa a faixa vazia (nem o ponto).
#
# Nada aqui cria elemento, mede, foca, lê relógio ou fala com o DOM; quem
# aplica a árvore é o `desk/src/view-host.mjs`. Quem controla os timers e a
# animação de saída (`.closing` no nó vivo + `transitionend`) é o host: o
# núcleo só diz *como* o item fica em cada estado. `#toast` e `#activity` são
# contêineres fixos do `desk/index.html` — os construtores de casca existem
# para as leis e para um mount de uma vez; no dia a dia o host troca só os
# filhos (ou anexa o item novo).
# ---------------------------------------------------------------------------

# Aviso da fila. `closing` = já está saindo (o host liga no fim do tempo).
type Toast is Data:
  Toast{text: String, closing: Bool}

# ---------- fila de toasts ----------

# Ordem das classes do item: `toast-item` sempre; `closing` e `out` entram
# juntas no fim da vida do aviso (é o que o CSS anima e o que `toastWait` lê).
def toastClasses(+closing: Bool) -> List<&2, V.ViewClass>:
  [V.classOn("toast-item", True{}), V.classOn("closing", closing), V.classOn("out", closing)]

def toastItem(t: Toast) -> V.ViewNode:
  match t:
    case Toast{text, closing}:
      V.viewEl("div", [V.classes(toastClasses(closing))], [V.viewText(text)])

# Lista na ordem de inserção (mais novo por último) — quem corta em 3 é o host.
def toastItems(ts: List<&2, Toast>) -> List<&2, V.ViewNode>:
  V.viewMap(~Toast, ~toastItem, ts)

def toastBox(ts: List<&2, Toast>) -> V.ViewNode:
  V.viewEl("div", [V.attrId("toast"), V.attr("role", "status")], toastItems(ts))

# ---------- faixa de atividade ----------

def pulseDot() -> V.ViewNode:
  V.viewEl("span", [V.attrClass("pulse"), V.attrAria("hidden", "true")], Nil{})

def activityLabel(text: String) -> V.ViewNode:
  V.viewEl("span", [V.attrClass("activity-label")], [V.viewText(text)])

def activityText.body(text: String, empty: Bool) -> List<&2, V.ViewNode>:
  match empty:
    case True{}:
      Nil{}
    case False{}:
      [V.viewText(text)]

def activityText(+text: String) -> List<&2, V.ViewNode>:
  activityText.body(text, String.is_empty(text))

def activityDot.body(label: String, empty: Bool) -> List<&2, V.ViewNode>:
  match empty:
    case True{}:
      Nil{}
    case False{}:
      [pulseDot(), activityLabel(label)]

def activityDot(+label: String) -> List<&2, V.ViewNode>:
  activityDot.body(label, String.is_empty(label))

# O `title` da faixa é o próprio rótulo (o tooltip do app lê daí).
def activityNode(title: String, kids: List<&2, V.ViewNode>) -> V.ViewNode:
  V.viewEl("div", [V.attrId("activity"), V.attr("role", "status"), V.attrTitle(title)], kids)

def activityView(+text: String) -> V.ViewNode:
  activityNode(text, activityText(text))

def activityLiveView(+text: String) -> V.ViewNode:
  activityNode(text, activityDot(text))

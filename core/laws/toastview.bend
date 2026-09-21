import Base
import ../view.bend as V
import ../toastview.bend as T

# ---------------------------------------------------------------------------
# Contrato da fila de toasts e da faixa de atividade. Prefixo `toast_` /
# `activity_`.
#
# O que reduz em geral: ordem/estado das classes do item, a casca `#toast`,
# o comprimento da lista e da faixa (com fatos já resolvidos). Texto livre não
# reduz (`String.eq` / `String.is_empty` são valor computado) — essas leis são
# os cenários concretos abaixo, no espírito de `laws/view.bend`.
# ---------------------------------------------------------------------------

# ---------- classes do item: aberto × saindo ----------

law toast_classes_aberto:
  {V.classValue(T.toastClasses(False{})) == "toast-item" : String}

# As duas de saída entram juntas e no fim (é o que o CSS anima).
law toast_classes_saindo:
  {V.classValue(T.toastClasses(True{})) == "toast-item closing out" : String}

# ---------- item ----------

law toast_item_tag:
  for t: T.Toast
  {V.tagOf(T.toastItem(t)) == "div" : String}

law toast_item_um_filho:
  for t: T.Toast
  {List.length(&2, V.ViewNode, V.kidsOf(T.toastItem(t))) == 1n : Nat}

# ---------- casca da fila ----------

law toast_box_id:
  for ts: List<&2, T.Toast>
  {V.attrGet(V.attrsOf(T.toastBox(ts)), "id") == Some{"toast"} : Maybe<&2, String>}

law toast_box_papel:
  for ts: List<&2, T.Toast>
  {V.attrGet(V.attrsOf(T.toastBox(ts)), "role") == Some{"status"} : Maybe<&2, String>}

law toast_items_len:
  for ts: List<&2, T.Toast>
  {List.length(&2, V.ViewNode, T.toastItems(ts)) == List.length(&2, T.Toast, ts) : Nat}

# ---------- faixa de atividade: texto × passo ao vivo ----------

law activity_texto_vazio:
  {T.activityText("") == Nil{} : List<&2, V.ViewNode>}

law activity_texto_um:
  {List.length(&2, V.ViewNode, T.activityText("oi")) == 1n : Nat}

law activity_dot_vazio:
  {T.activityDot("") == Nil{} : List<&2, V.ViewNode>}

# Ponto pulsante + rótulo, nesta ordem.
law activity_dot_dois:
  {List.length(&2, V.ViewNode, T.activityDot("oi")) == 2n : Nat}

law activity_pulse_escondido:
  {V.attrGet(V.attrsOf(T.pulseDot()), "aria-hidden") == Some{"true"} : Maybe<&2, String>}

law activity_label_classe:
  {V.attrGet(V.attrsOf(T.activityLabel("oi")), "class") == Some{"activity-label"} : Maybe<&2, String>}

law activity_view_titulo:
  {V.attrGet(V.attrsOf(T.activityView("oi")), "title") == Some{"oi"} : Maybe<&2, String>}

# Rótulo vazio ainda carrega o título vazio (o host limpa o balão).
law activity_view_titulo_vazio:
  {V.attrGet(V.attrsOf(T.activityView("")), "title") == Some{""} : Maybe<&2, String>}

law activity_live_titulo:
  {V.attrGet(V.attrsOf(T.activityLiveView("pensando")), "title") == Some{"pensando"} : Maybe<&2, String>}

# Ao vivo: ponto + rótulo (dois filhos); vazio não desenha nada.
law activity_live_dois_filhos:
  {List.length(&2, V.ViewNode, V.kidsOf(T.activityLiveView("pensando"))) == 2n : Nat}

law activity_live_vazio:
  {List.length(&2, V.ViewNode, V.kidsOf(T.activityLiveView(""))) == 0n : Nat}

import Base
import ../msg.bend as M
import ../composerview.bend as C
import ../view.bend as V

# ---------------------------------------------------------------------------
# Contrato da view da fila/faixas do composer. Prefixo `composer_`.
#
# Rótulo, classes e data-* casam em fatos Bool (many/sending/enabled/closing/
# visible). A árvore fecha em itens concretos — viewMap numa lista livre não
# reduz. String.eq do attrGet também pede nome concreto.
# ---------------------------------------------------------------------------

# ---------- rótulo da faixa ----------

law composer_label_um:
  for count: String
  {C.queueLabel(False{}, False{}, count) == M.msg("queue.queued") : String}

law composer_label_muitos:
  for count: String
  {C.queueLabel(False{}, True{}, count) == M.msg1("queue.queuedCount", "count", count) : String}

law composer_label_recuperadas_um:
  for count: String
  {C.queueLabel(True{}, False{}, count) == M.msg("queue.recovered") : String}

law composer_label_recuperadas_muitos:
  for count: String
  {C.queueLabel(True{}, True{}, count) == M.msg1("queue.recoveredCount", "count", count) : String}

# ---------- ações da faixa ----------

law composer_action_visible:
  {C.queueActionHidden(True{}) == Nil{} : List<&2, V.ViewAttr>}

law composer_action_hidden:
  {C.queueActionHidden(False{}) == Con{V.ViewAttr{"hidden", ""}, Nil{}} : List<&2, V.ViewAttr>}

law composer_send_now_class:
  {V.attrGet(V.attrsOf(C.queueSendNowBtn(True{})), "class") == Some{"queue-send-now"} : Maybe<&2, String>}

law composer_send_now_click:
  {V.attrGet(V.attrsOf(C.queueSendNowBtn(True{})), "on:click") == Some{"sendNow"} : Maybe<&2, String>}

law composer_send_now_hidden_attr:
  {V.attrGet(V.attrsOf(C.queueSendNowBtn(False{})), "hidden") == Some{""} : Maybe<&2, String>}

law composer_clear_class:
  {V.attrGet(V.attrsOf(C.queueClearBtn(True{})), "class") == Some{"queue-clear"} : Maybe<&2, String>}

law composer_clear_click:
  {V.attrGet(V.attrsOf(C.queueClearBtn(True{})), "on:click") == Some{"clear"} : Maybe<&2, String>}

law composer_clear_hidden_attr:
  {V.attrGet(V.attrsOf(C.queueClearBtn(False{})), "hidden") == Some{""} : Maybe<&2, String>}

# ---------- title do item ----------

law composer_title_sending:
  for text: String
  {C.queueItemTitle(text, True{}) == text : String}

law composer_title_idle:
  for text: String
  {C.queueItemTitle(text, False{}) == M.msg1("queue.editTitle", "text", text) : String}

# ---------- classes da faixa / do item ----------

law composer_strip_class_aberta:
  {C.queueStripClass(False{}) == V.ViewAttr{"class", "queue-strip"} : V.ViewAttr}

law composer_strip_class_fechando:
  {C.queueStripClass(True{}) == V.ViewAttr{"class", "queue-strip closing"} : V.ViewAttr}

law composer_item_class_idle:
  {C.queueItemClass(False{}) == V.ViewAttr{"class", "queue-item"} : V.ViewAttr}

law composer_item_class_sending:
  {C.queueItemClass(True{}) == V.ViewAttr{"class", "queue-item sending"} : V.ViewAttr}

# ---------- data-closing / aria-busy / disabled ----------

law composer_closing_off:
  {C.queueClosingData(False{}) == Nil{} : List<&2, V.ViewAttr>}

law composer_closing_on:
  {C.queueClosingData(True{}) == Con{V.ViewAttr{"data-closing", "1"}, Nil{}} : List<&2, V.ViewAttr>}

law composer_busy_off:
  {C.queueBusyAttr(False{}) == Nil{} : List<&2, V.ViewAttr>}

law composer_busy_on:
  {C.queueBusyAttr(True{}) == Con{V.ViewAttr{"aria-busy", "true"}, Nil{}} : List<&2, V.ViewAttr>}

law composer_disabled_off:
  {C.queueDisabledAttr(True{}) == Nil{} : List<&2, V.ViewAttr>}

law composer_disabled_on:
  {C.queueDisabledAttr(False{}) == Con{V.ViewAttr{"disabled", ""}, Nil{}} : List<&2, V.ViewAttr>}

# ---------- banner: hidden / closing ----------

law composer_banner_hidden:
  {C.editBannerHidden(False{}) == Con{V.ViewAttr{"hidden", ""}, Nil{}} : List<&2, V.ViewAttr>}

law composer_banner_visible:
  {C.editBannerHidden(True{}) == Nil{} : List<&2, V.ViewAttr>}

law composer_banner_class_idle:
  {C.editBannerClass(False{}) == V.ViewAttr{"class", ""} : V.ViewAttr}

law composer_banner_class_closing:
  {C.editBannerClass(True{}) == V.ViewAttr{"class", "closing"} : V.ViewAttr}

# ---------- árvore (cenários concretos) ----------

# A faixa monta [rótulo, itens…, Enviar agora, Limpar]: com a fila vazia, o
# primeiro e o segundo filhos são as ações.
def at(xs: List<&2, V.ViewNode>, i: Nat) -> V.ViewNode:
  match xs i:
    case Nil{} _:
      V.viewText("")
    case Con{h, t} 0n:
      h
    case Con{h, t} 1n+p:
      at(t, p)

def kid(n: V.ViewNode, i: Nat) -> V.ViewNode:
  at(V.kidsOf(n), i)

# O texto de dentro de um elemento (o botão é um ViewEl cujo filho é o ViewText).
def kidText(n: V.ViewNode, i: Nat) -> String:
  V.textOf(kid(n, i))

law composer_label_tag:
  for s: String
  {V.tagOf(C.queueLabelView(s)) == "div" : String}

law composer_label_class:
  for s: String
  {V.attrGet(V.attrsOf(C.queueLabelView(s)), "class") == Some{"queue-label"} : Maybe<&2, String>}

law composer_strip_tag:
  for closing: Bool
  for label: String
  {V.tagOf(C.queueStripView(closing, label, Nil{}, False{}, False{})) == "div" : String}

law composer_strip_live:
  for label: String
  {V.attrGet(V.attrsOf(C.queueStripView(False{}, label, Nil{}, False{}, False{})), "aria-live") == Some{"polite"} : Maybe<&2, String>}

law composer_strip_closing_data:
  {V.attrGet(V.attrsOf(C.queueStripView(True{}, M.msg("queue.queued"), Nil{}, False{}, False{})), "data-closing") == Some{"1"} : Maybe<&2, String>}

law composer_strip_open_data:
  {V.attrGet(V.attrsOf(C.queueStripView(False{}, M.msg("queue.queued"), Nil{}, False{}, False{})), "data-closing") == None{} : Maybe<&2, String>}

law composer_strip_actions_class:
  {V.attrGet(V.attrsOf(kid(C.queueStripView(False{}, M.msg("queue.queued"), Nil{}, True{}, True{}), 1n)), "class") == Some{"queue-actions"} : Maybe<&2, String>}

law composer_send_now_text:
  {kidText(C.queueSendNowBtn(True{}), 0n) == M.msg("queue.sendNow") : String}

law composer_clear_text:
  {kidText(C.queueClearBtn(True{}), 0n) == M.msg("queue.clear") : String}

law composer_item_tag:
  {V.tagOf(C.queueItemView(C.QueueRow{"a", "oi", False{}, True{}, False{}})) == "div" : String}

law composer_item_data_id:
  {V.attrGet(V.attrsOf(C.queueItemView(C.QueueRow{"fila-1", "oi", False{}, True{}, False{}})), "data-id") == Some{"fila-1"} : Maybe<&2, String>}

law composer_item_sending_class:
  {V.attrGet(V.attrsOf(C.queueItemView(C.QueueRow{"a", "oi", True{}, False{}, False{}})), "class") == Some{"queue-item sending"} : Maybe<&2, String>}

law composer_item_sending_busy:
  {V.attrGet(V.attrsOf(C.queueItemView(C.QueueRow{"a", "oi", True{}, False{}, False{}})), "aria-busy") == Some{"true"} : Maybe<&2, String>}

law composer_item_idle_busy:
  {V.attrGet(V.attrsOf(C.queueItemView(C.QueueRow{"a", "oi", False{}, True{}, False{}})), "aria-busy") == None{} : Maybe<&2, String>}

law composer_banner_tag:
  for visible: Bool
  for closing: Bool
  {V.tagOf(C.editBannerView(visible, closing)) == "div" : String}

law composer_banner_id:
  {V.attrGet(V.attrsOf(C.editBannerView(True{}, False{})), "id") == Some{"edit-banner"} : Maybe<&2, String>}

import Base
import ../worklogview.bend as W
import ../worklog.bend as L
import ../view.bend as V

# Contrato da visão do diário. Prefixo `worklogview_`. Fatos Bool e construtores
# de kind/status reduzem; lookup de attr usa nomes concretos.

# ---------- kind / status → data-* ----------

law worklogview_kind_thinking:
  {W.kindName(L.Thinking{}) == "thinking" : String}

law worklogview_kind_search:
  {W.kindName(L.Search{}) == "search" : String}

law worklogview_kind_reference:
  {W.kindName(L.Reference{}) == "reference" : String}

law worklogview_kind_fetch:
  {W.kindName(L.Fetch{}) == "fetch" : String}

law worklogview_kind_tool:
  {W.kindName(L.Tool{}) == "tool" : String}

law worklogview_kind_error:
  {W.kindName(L.ErrorKind{}) == "error" : String}

law worklogview_status_running:
  {W.statusName(L.Status.Running{}) == "running" : String}

law worklogview_status_done:
  {W.statusName(L.Status.Done{}) == "done" : String}

law worklogview_status_stopped:
  {W.statusName(L.Status.Stopped{}) == "stopped" : String}

law worklogview_status_error:
  {W.statusName(L.Status.Failed{}) == "error" : String}

law worklogview_running_yes:
  {W.statusRunning(L.Status.Running{}) == True{} : Bool}

law worklogview_running_no:
  {W.statusRunning(L.Status.Done{}) == False{} : Bool}

# ---------- fold do detalhe ----------

law worklogview_detail_sem:
  for open: Bool
  {W.detailHidden(open, False{}) == True{} : Bool}

law worklogview_detail_aberto:
  {W.detailHidden(True{}, True{}) == False{} : Bool}

law worklogview_detail_fechado:
  {W.detailHidden(False{}, True{}) == True{} : Bool}

# ---------- artigo / cabeça: tag e attrs ----------

law worklogview_tag:
  for row: W.WorkRow
  {V.tagOf(W.workLog(row)) == "article" : String}

law worklogview_head_tag:
  for live: Bool
  for expanded: Bool
  for title: String
  for meta: String
  {V.tagOf(W.workHead(live, expanded, title, meta)) == "button" : String}

law worklogview_steps_tag:
  for xs: +List<W.StepRow>
  {V.tagOf(W.workSteps(xs)) == "div" : String}

law worklogview_live_true:
  {V.attrGet(W.articleAttrs(True{}, False{}), "data-live") == Some{"true"} : Maybe<&2, String>}

law worklogview_live_false:
  {V.attrGet(W.articleAttrs(False{}, True{}), "data-live") == Some{"false"} : Maybe<&2, String>}

law worklogview_expanded_true:
  {V.attrGet(W.articleAttrs(False{}, True{}), "data-expanded") == Some{"true"} : Maybe<&2, String>}

law worklogview_expanded_false:
  {V.attrGet(W.articleAttrs(True{}, False{}), "data-expanded") == Some{"false"} : Maybe<&2, String>}

law worklogview_head_aria_true:
  {V.attrGet(W.headAttrs(True{}), "aria-expanded") == Some{"true"} : Maybe<&2, String>}

law worklogview_head_aria_false:
  {V.attrGet(W.headAttrs(False{}), "aria-expanded") == Some{"false"} : Maybe<&2, String>}

law worklogview_head_on_click:
  {V.attrGet(W.headAttrs(True{}), "on:click") == Some{"toggleWork"} : Maybe<&2, String>}

law worklogview_class_work:
  {V.attrGet(W.articleAttrs(True{}, True{}), "class") == Some{"work"} : Maybe<&2, String>}

# Passo: data-kind / data-status / data-detail concretos.
law worklogview_step_kind_attr:
  {V.attrGet(W.stepAttrs("thinking", "done", False{}), "data-kind") == Some{"thinking"} : Maybe<&2, String>}

law worklogview_step_status_attr:
  {V.attrGet(W.stepAttrs("search", "running", True{}), "data-status") == Some{"running"} : Maybe<&2, String>}

law worklogview_step_detail_true:
  {V.attrGet(W.stepAttrs("tool", "done", True{}), "data-detail") == Some{"true"} : Maybe<&2, String>}

law worklogview_step_detail_false:
  {V.attrGet(W.stepAttrs("tool", "done", False{}), "data-detail") == Some{"false"} : Maybe<&2, String>}

law worklogview_toggle_click:
  {V.attrGet(W.toggleAttrs("s1", False{}), "on:click") == Some{"toggleStep"} : Maybe<&2, String>}

# Identidade de foco (o host preserva foco por `key` durante o turno vivo):
law worklogview_head_key:
  {V.attrGet(W.headAttrs(True{}), "key") == Some{"work-head"} : Maybe<&2, String>}

law worklogview_toggle_key:
  {V.attrGet(W.toggleAttrs("s1", False{}), "key") == Some{"step-toggle-s1"} : Maybe<&2, String>}

# Kids do artigo: cabeça + passos, sempre dois.
law worklogview_dois_kids:
  for row: W.WorkRow
  {List.length(&2, V.ViewNode, V.kidsOf(W.workLog(row))) == 2n : Nat}

# Lista vazia de passos: work-steps sem filhos.
law worklogview_steps_vazio:
  {V.kidsOf(W.workSteps(Nil{})) == Nil{} : List<&2, V.ViewNode>}

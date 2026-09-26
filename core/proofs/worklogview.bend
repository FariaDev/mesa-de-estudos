import Base
import ../laws/worklogview.bend as Laws
import ../worklogview.bend as W
import ../view.bend as V

def Laws.worklogview_kind_thinking():
  {==}

def Laws.worklogview_kind_search():
  {==}

def Laws.worklogview_kind_reference():
  {==}

def Laws.worklogview_kind_fetch():
  {==}

def Laws.worklogview_kind_tool():
  {==}

def Laws.worklogview_kind_error():
  {==}

def Laws.worklogview_status_running():
  {==}

def Laws.worklogview_status_done():
  {==}

def Laws.worklogview_status_stopped():
  {==}

def Laws.worklogview_status_error():
  {==}

def Laws.worklogview_running_yes():
  {==}

def Laws.worklogview_running_no():
  {==}

def Laws.worklogview_detail_sem(open):
  {==}

def Laws.worklogview_detail_aberto():
  {==}

def Laws.worklogview_detail_fechado():
  {==}

def Laws.worklogview_preview_aberto():
  {==}

def Laws.worklogview_preview_fechado_com_preview():
  {==}

def Laws.worklogview_preview_fechado_vazio():
  {==}

def Laws.worklogview_tag(row):
  match row:
    case W.WorkRow{live, expanded, title, meta, steps}:
      {==}

def Laws.worklogview_head_tag(live, expanded, title, meta):
  {==}

def Laws.worklogview_steps_tag(xs):
  {==}

def Laws.worklogview_live_true():
  {==}

def Laws.worklogview_live_false():
  {==}

def Laws.worklogview_expanded_true():
  {==}

def Laws.worklogview_expanded_false():
  {==}

def Laws.worklogview_head_aria_true():
  {==}

def Laws.worklogview_head_aria_false():
  {==}

def Laws.worklogview_head_on_click():
  {==}

def Laws.worklogview_class_work():
  {==}

def Laws.worklogview_step_kind_attr():
  {==}

def Laws.worklogview_step_status_attr():
  {==}

def Laws.worklogview_step_detail_true():
  {==}

def Laws.worklogview_step_detail_false():
  {==}

def Laws.worklogview_toggle_click():
  {==}

def Laws.worklogview_head_key():
  {==}

def Laws.worklogview_toggle_key():
  {==}

def Laws.worklogview_dois_kids(row):
  match row:
    case W.WorkRow{live, expanded, title, meta, steps}:
      {==}

def Laws.worklogview_steps_vazio():
  {==}

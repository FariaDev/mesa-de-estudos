import Base
import ../laws/pdfpageview.bend as Laws
import ../pdfpageview.bend as G

# Provas do leitor de PDF (moldura, páginas, destaques).
# Aceitador: `bend proofs/pdfpageview.bend` deve imprimir "All terms check.".

# ---------- rótulos ----------

def Laws.pdfpage_empty_option():
  {==}

def Laws.pdfpage_find_placeholder():
  {==}

def Laws.pdfpage_find_label():
  {==}

def Laws.pdfpage_open_title():
  {==}

def Laws.pdfpage_shot_title():
  {==}

def Laws.pdfpage_fit_title():
  {==}

def Laws.pdfpage_invert_title():
  {==}

def Laws.pdfpage_invert_aria():
  {==}

def Laws.pdfpage_prev_aria():
  {==}

def Laws.pdfpage_next_aria():
  {==}

def Laws.pdfpage_out_aria():
  {==}

def Laws.pdfpage_in_aria():
  {==}

def Laws.pdfpage_divider_aria():
  {==}

def Laws.pdfpage_document_aria():
  {==}

def Laws.pdfpage_open_aria():
  {==}

def Laws.pdfpage_find_aria():
  {==}

def Laws.pdfpage_page_aria():
  {==}

# ---------- select da biblioteca ----------

def Laws.pdfpage_options_empty_concrete():
  {==}

def Laws.pdfpage_options_selected_concrete():
  {==}

def Laws.pdfpage_options_not_selected():
  {==}

def Laws.pdfpage_select_aria():
  {==}

def Laws.pdfpage_select_class():
  {==}

# ---------- cabeça do painel ----------

def Laws.pdfpage_title_tag():
  {==}

def Laws.pdfpage_title_class():
  {==}

def Laws.pdfpage_title_kids():
  {==}

def Laws.pdfpage_title_strong():
  {==}

def Laws.pdfpage_open_btn():
  {==}

def Laws.pdfpage_open_btn_icon():
  {==}

def Laws.pdfpage_open_btn_aria():
  {==}

def Laws.pdfpage_find_toggle_icon():
  {==}

def Laws.pdfpage_find_toggle_pressed():
  {==}

def Laws.pdfpage_shot_btn():
  {==}

def Laws.pdfpage_collapse_icon_up():
  {==}

def Laws.pdfpage_collapse_icon_down():
  {==}

def Laws.pdfpage_collapse_min():
  {==}

def Laws.pdfpage_collapse_title():
  {==}

# ---------- ferramentas ----------

def Laws.pdfpage_tools_kids():
  {==}

def Laws.pdfpage_tools_first():
  {==}

def Laws.pdfpage_tools_page_number():
  {==}

def Laws.pdfpage_tools_page_total():
  {==}

def Laws.pdfpage_page_input():
  {==}

def Laws.pdfpage_page_input_value():
  {==}

def Laws.pdfpage_fit_btn():
  {==}

def Laws.pdfpage_zoom_label_span():
  {==}

# ---------- palco, busca e divisor ----------

def Laws.pdfpage_stage_viewport():
  {==}

def Laws.pdfpage_stage_foot():
  {==}

def Laws.pdfpage_find_tag():
  {==}

def Laws.pdfpage_find_hidden():
  {==}

def Laws.pdfpage_find_submit():
  {==}

def Laws.pdfpage_find_input():
  {==}

def Laws.pdfpage_find_count_hidden():
  {==}

def Laws.pdfpage_find_button():
  {==}

def Laws.pdfpage_divider_role():
  {==}

def Laws.pdfpage_divider_tabindex():
  {==}

def Laws.pdfpage_divider_class():
  {==}

# ---------- painel ----------

def Laws.pdfpage_panel_tag():
  {==}

def Laws.pdfpage_panel_class():
  {==}

def Laws.pdfpage_panel_aria():
  {==}

def Laws.pdfpage_panel_kids():
  {==}

def Laws.pdfpage_panel_minimized_true():
  {==}

def Laws.pdfpage_panel_minimized_false():
  {==}

# ---------- páginas ----------

def Laws.pdfpage_page_class():
  {==}

def Laws.pdfpage_page_number():
  {==}

def Laws.pdfpage_page_style():
  {==}

def Laws.pdfpage_page_style_two():
  {==}

def Laws.pdfpage_pages_order():
  {==}

def Laws.pdfpage_doc_class():
  {==}

def Laws.pdfpage_doc_empty():
  {==}

# ---------- estados do miolo ----------

def Laws.pdfpage_viewport_empty():
  {==}

def Laws.pdfpage_viewport_ready(box):
  match box:
    case G.PdfPageBox{n, width, height}:
      {==}

def Laws.pdfpage_viewport_loading():
  {==}

def Laws.pdfpage_viewport_failed():
  {==}

# ---------- destaques da busca ----------

def Laws.pdfpage_hl_none():
  {==}

def Laws.pdfpage_hl_empty_term():
  {==}

def Laws.pdfpage_hl_two_hits():
  {==}

def Laws.pdfpage_hl_no_overlap():
  {==}

def Laws.pdfpage_hl_single_char():
  {==}

def Laws.pdfpage_hl_hit_is_original():
  {==}

def Laws.pdfpage_hl_node_tag():
  {==}

def Laws.pdfpage_hl_node_class():
  {==}

def Laws.pdfpage_hl_prefix():
  {==}

# ---------- handlers ----------

def Laws.pdfpage_open_click():
  {==}

def Laws.pdfpage_find_toggle_click():
  {==}

def Laws.pdfpage_shot_click():
  {==}

def Laws.pdfpage_collapse_click():
  {==}

def Laws.pdfpage_select_change():
  {==}

def Laws.pdfpage_page_input_change():
  {==}

def Laws.pdfpage_prev_click():
  {==}

def Laws.pdfpage_next_click():
  {==}

def Laws.pdfpage_out_click():
  {==}

def Laws.pdfpage_in_click():
  {==}

def Laws.pdfpage_fit_click():
  {==}

def Laws.pdfpage_invert_click():
  {==}

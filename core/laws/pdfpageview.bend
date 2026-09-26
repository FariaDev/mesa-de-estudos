import Base
import ../pdfpageview.bend as G
import ../pdfview.bend as P
import ../view.bend as V

# ---------------------------------------------------------------------------
# Contrato do leitor de PDF (moldura, páginas, destaques). Prefixo `pdfpage_`.
#
# Mesmo espírito do `pdfview`: os fatos chegam resolvidos (Bool/Nat/String) e
# as leis fecham em cenários concretos — `String.eq` e `String.is_empty` são
# valor computado, então rótulos e seleção só reduzem com nome/path concretos.
# O vocabulário auxiliar (`kidAt`, `hl`) fala do núcleo, não vai para o app.
# ---------------------------------------------------------------------------

# O n-ésimo filho de uma lista (0-based) para falar da ordem dos nós.
def kidAt(xs: List<&2, V.ViewNode>, n: Nat) -> V.ViewNode:
  match xs:
    case Nil{}:
      V.viewText("")
    case Con{h, t}:
      match n:
        case 0n:
          h
        case 1n+p:
          kidAt(t, p)

# O nó de destaque como o núcleo o desenha (para comparar com `hlSegments`).
def hl(text: String) -> V.ViewNode:
  V.viewEl("i", [V.attrClass("pdf-hl")], Con{V.viewText(text), Nil{}})

def shellConcrete() -> G.PdfShell:
  G.PdfShell{"Enunciado", [G.PdfOption{"Limites.pdf", "/x/Limites.pdf"}], "/x/Limites.pdf", False{}, False{}}

# ---------- rótulos ----------

law pdfpage_empty_option:
  {G.emptyOptionLabel() == "Escolha um PDF…" : String}

law pdfpage_find_placeholder:
  {G.findPlaceholder() == "Buscar neste PDF…" : String}

law pdfpage_find_label:
  {G.findButtonLabel() == "Buscar" : String}

law pdfpage_open_title:
  {G.openTitle() == "Abrir outro PDF" : String}

law pdfpage_shot_title:
  {G.shotTitle() == "Mandar esta página como imagem no chat" : String}

law pdfpage_fit_title:
  {G.fitTitle() == "Ajustar à largura" : String}

law pdfpage_invert_title:
  {G.invertTitle() == "Inverter cores da página (tema escuro)" : String}

law pdfpage_invert_aria:
  {G.invertAria() == "Inverter cores da página" : String}

law pdfpage_prev_aria:
  {G.prevAria() == "Página anterior" : String}

law pdfpage_next_aria:
  {G.nextAria() == "Próxima página" : String}

law pdfpage_out_aria:
  {G.outAria() == "Diminuir zoom" : String}

law pdfpage_in_aria:
  {G.inAria() == "Aumentar zoom" : String}

law pdfpage_divider_aria:
  {G.dividerAria() == "Redimensionar leitores de PDF" : String}

law pdfpage_document_aria:
  {G.documentAria("Enunciado") == "Documento de Enunciado" : String}

law pdfpage_open_aria:
  {G.openAria("Enunciado") == "Abrir PDF em Enunciado" : String}

law pdfpage_find_aria:
  {G.findAria("Enunciado") == "Buscar em Enunciado" : String}

law pdfpage_page_aria:
  {G.pageAria("Enunciado") == "Página de Enunciado" : String}

# ---------- select da biblioteca ----------

law pdfpage_options_empty_concrete:
  {G.optionNodes(Nil{}, "") == Con{V.viewEl("option", [V.ViewAttr{"value", ""}], Con{V.viewText("Escolha um PDF…"), Nil{}}), Nil{}} : List<&2, V.ViewNode>}

law pdfpage_options_selected_concrete:
  {G.optionNodes([G.PdfOption{"Limites.pdf", "/x/Limites.pdf"}], "/x/Limites.pdf")
    == Con{V.viewEl("option", [V.ViewAttr{"value", ""}], Con{V.viewText("Escolha um PDF…"), Nil{}}),
         Con{V.viewEl("option", [V.ViewAttr{"value", "/x/Limites.pdf"}, V.ViewAttr{"selected", ""}], Con{V.viewText("Limites.pdf"), Nil{}}), Nil{}}} : List<&2, V.ViewNode>}

law pdfpage_options_not_selected:
  {V.attrGet(V.attrsOf(kidAt(G.optionNodes([G.PdfOption{"Limites.pdf", "/x/Limites.pdf"}], "/y/Outro.pdf"), 1n)), "selected") == None{} : Maybe<&2, String>}

law pdfpage_select_aria:
  {V.attrGet(V.attrsOf(G.selectNode("Enunciado", Nil{}, "")), "aria-label") == Some{"Documento de Enunciado"} : Maybe<&2, String>}

law pdfpage_select_class:
  {V.attrGet(V.attrsOf(G.selectNode("Enunciado", Nil{}, "")), "class") == Some{"pdf-select"} : Maybe<&2, String>}

# ---------- cabeça do painel ----------

law pdfpage_title_tag:
  {V.tagOf(G.titleBar(shellConcrete())) == "div" : String}

law pdfpage_title_class:
  {V.attrGet(V.attrsOf(G.titleBar(shellConcrete())), "class") == Some{"pdf-title"} : Maybe<&2, String>}

law pdfpage_title_kids:
  {List.length(&2, V.ViewNode, V.kidsOf(G.titleBar(shellConcrete()))) == 8n : Nat}

law pdfpage_title_strong:
  {V.tagOf(kidAt(V.kidsOf(G.titleBar(shellConcrete())), 0n)) == "strong" : String}

# O Voltar nasce escondido e é do host (a pilha de páginas é dele).
law pdfpage_back_class:
  {V.attrGet(V.attrsOf(G.backBtn("Enunciado")), "class") == Some{"back icon-btn"} : Maybe<&2, String>}

law pdfpage_back_oculto:
  {V.attrGet(V.attrsOf(G.backBtn("Enunciado")), "hidden") == Some{""} : Maybe<&2, String>}

law pdfpage_back_clique:
  {V.attrGet(V.attrsOf(G.backBtn("Enunciado")), "on:click") == Some{"NavBack"} : Maybe<&2, String>}

law pdfpage_back_aria:
  {V.attrGet(V.attrsOf(G.backBtn("Enunciado")), "aria-label") == Some{"Voltar à página anterior de Enunciado"} : Maybe<&2, String>}

law pdfpage_back_rotulo:
  {String.eq(G.navBackTitle(), "Voltar à página anterior") == True{} : Bool}

# O Navegar (favoritos/sumário) nasce fechado e é do host.
law pdfpage_nav_class:
  {V.attrGet(V.attrsOf(G.navBtn("Enunciado")), "class") == Some{"nav icon-btn"} : Maybe<&2, String>}

law pdfpage_nav_icon:
  {V.attrGet(V.attrsOf(G.navBtn("Enunciado")), "data-icon") == Some{"book"} : Maybe<&2, String>}

law pdfpage_nav_titulo:
  {V.attrGet(V.attrsOf(G.navBtn("Enunciado")), "title") == Some{"Favoritos e sumário"} : Maybe<&2, String>}

law pdfpage_nav_aria:
  {V.attrGet(V.attrsOf(G.navBtn("Enunciado")), "aria-label") == Some{"Navegar em Enunciado"} : Maybe<&2, String>}

law pdfpage_nav_clique:
  {V.attrGet(V.attrsOf(G.navBtn("Enunciado")), "on:click") == Some{"ToggleNav"} : Maybe<&2, String>}

law pdfpage_nav_expandido:
  {V.attrGet(V.attrsOf(G.navBtn("Enunciado")), "aria-expanded") == Some{"false"} : Maybe<&2, String>}

law pdfpage_open_btn:
  {V.attrGet(V.attrsOf(G.openBtn("Enunciado")), "class") == Some{"open icon-btn"} : Maybe<&2, String>}

law pdfpage_open_btn_icon:
  {V.attrGet(V.attrsOf(G.openBtn("Enunciado")), "data-icon") == Some{"plus"} : Maybe<&2, String>}

law pdfpage_open_btn_aria:
  {V.attrGet(V.attrsOf(G.openBtn("Enunciado")), "aria-label") == Some{"Abrir PDF em Enunciado"} : Maybe<&2, String>}

law pdfpage_find_toggle_icon:
  {V.attrGet(V.attrsOf(G.findToggleBtn("Enunciado", False{})), "data-icon") == Some{"search"} : Maybe<&2, String>}

law pdfpage_find_toggle_pressed:
  {V.attrGet(V.attrsOf(G.findToggleBtn("Enunciado", True{})), "aria-pressed") == Some{"true"} : Maybe<&2, String>}

law pdfpage_shot_btn:
  {V.attrGet(V.attrsOf(G.shotBtn("Enunciado")), "class") == Some{"page-shot icon-btn"} : Maybe<&2, String>}

law pdfpage_collapse_icon_up:
  {G.collapseIcon(True{}) == "chevronUp" : String}

law pdfpage_collapse_icon_down:
  {G.collapseIcon(False{}) == "chevronDown" : String}

law pdfpage_collapse_min:
  {V.attrGet(V.attrsOf(G.collapseBtn(True{})), "aria-pressed") == Some{"true"} : Maybe<&2, String>}

law pdfpage_collapse_title:
  {V.attrGet(V.attrsOf(G.collapseBtn(False{})), "title") == Some{"Minimizar este leitor"} : Maybe<&2, String>}

# ---------- ferramentas ----------

law pdfpage_tools_kids:
  {List.length(&2, V.ViewNode, V.kidsOf(G.toolsBar("Enunciado"))) == 9n : Nat}

law pdfpage_tools_first:
  {V.attrGet(V.attrsOf(kidAt(V.kidsOf(G.toolsBar("Enunciado")), 0n)), "class") == Some{"prev icon-btn"} : Maybe<&2, String>}

law pdfpage_tools_page_number:
  {V.attrGet(V.attrsOf(kidAt(V.kidsOf(G.toolsBar("Enunciado")), 1n)), "class") == Some{"page-number"} : Maybe<&2, String>}

law pdfpage_tools_page_total:
  {V.attrGet(V.attrsOf(kidAt(V.kidsOf(G.toolsBar("Enunciado")), 2n)), "class") == Some{"page-total"} : Maybe<&2, String>}

law pdfpage_page_input:
  {V.attrGet(V.attrsOf(G.pageInput("Enunciado")), "aria-label") == Some{"Página de Enunciado"} : Maybe<&2, String>}

law pdfpage_page_input_value:
  {V.attrGet(V.attrsOf(G.pageInput("Enunciado")), "value") == Some{"1"} : Maybe<&2, String>}

law pdfpage_fit_btn:
  {V.attrGet(V.attrsOf(G.titleIconBtn("fit", "unfold", G.fitTitle(), G.fitTitle(), "Fit")), "data-icon") == Some{"unfold"} : Maybe<&2, String>}

law pdfpage_zoom_label_span:
  {V.attrGet(V.attrsOf(kidAt(V.kidsOf(G.toolsBar("Enunciado")), 5n)), "class") == Some{"zoom-label"} : Maybe<&2, String>}

# ---------- palco, busca e divisor ----------

law pdfpage_stage_viewport:
  {V.attrGet(V.attrsOf(kidAt(V.kidsOf(G.stage()), 0n)), "class") == Some{"pdf-viewport"} : Maybe<&2, String>}

law pdfpage_stage_foot:
  {V.attrGet(V.attrsOf(kidAt(V.kidsOf(G.stage()), 1n)), "class") == Some{"pdf-foot"} : Maybe<&2, String>}

law pdfpage_find_tag:
  {V.tagOf(G.findForm("Enunciado")) == "form" : String}

law pdfpage_find_hidden:
  {V.attrGet(V.attrsOf(G.findForm("Enunciado")), "hidden") == Some{""} : Maybe<&2, String>}

law pdfpage_find_submit:
  {V.attrGet(V.attrsOf(G.findForm("Enunciado")), "on:submit") == Some{"Find"} : Maybe<&2, String>}

law pdfpage_find_input:
  {V.attrGet(V.attrsOf(kidAt(V.kidsOf(G.findForm("Enunciado")), 0n)), "placeholder") == Some{"Buscar neste PDF…"} : Maybe<&2, String>}

law pdfpage_find_count_hidden:
  {V.attrGet(V.attrsOf(kidAt(V.kidsOf(G.findForm("Enunciado")), 1n)), "hidden") == Some{""} : Maybe<&2, String>}

law pdfpage_find_button:
  {V.kidsOf(kidAt(V.kidsOf(G.findForm("Enunciado")), 2n)) == Con{V.viewText("Buscar"), Nil{}} : List<&2, V.ViewNode>}

law pdfpage_divider_role:
  {V.attrGet(V.attrsOf(G.divider()), "role") == Some{"separator"} : Maybe<&2, String>}

law pdfpage_divider_tabindex:
  {V.attrGet(V.attrsOf(G.divider()), "tabindex") == Some{"0"} : Maybe<&2, String>}

law pdfpage_divider_class:
  {V.attrGet(V.attrsOf(G.divider()), "class") == Some{"pdf-divider"} : Maybe<&2, String>}

# ---------- painel ----------

law pdfpage_panel_tag:
  {V.tagOf(G.panelShell(shellConcrete())) == "section" : String}

law pdfpage_panel_class:
  {V.attrGet(V.attrsOf(G.panelShell(shellConcrete())), "class") == Some{"pdf-panel"} : Maybe<&2, String>}

law pdfpage_panel_aria:
  {V.attrGet(V.attrsOf(G.panelShell(shellConcrete())), "aria-label") == Some{"Enunciado"} : Maybe<&2, String>}

law pdfpage_panel_kids:
  {List.length(&2, V.ViewNode, V.kidsOf(G.panelShell(shellConcrete()))) == 4n : Nat}

law pdfpage_panel_minimized_true:
  {V.attrGet(V.attrsOf(G.panelShell(G.PdfShell{"Enunciado", Nil{}, "", True{}, False{}})), "class") == Some{"pdf-panel minimized"} : Maybe<&2, String>}

law pdfpage_panel_minimized_false:
  {V.attrGet(V.attrsOf(G.panelShell(G.PdfShell{"Enunciado", Nil{}, "", False{}, False{}})), "class") == Some{"pdf-panel"} : Maybe<&2, String>}

# ---------- páginas: âncoras medidas pelo host ----------

law pdfpage_page_class:
  {V.attrGet(V.attrsOf(G.pageNode(G.PdfPageBox{3n, "600px", "800px"})), "class") == Some{"pdf-page"} : Maybe<&2, String>}

law pdfpage_page_number:
  {V.attrGet(V.attrsOf(G.pageNode(G.PdfPageBox{3n, "600px", "800px"})), "data-page") == Some{"3"} : Maybe<&2, String>}

law pdfpage_page_style:
  {V.attrGet(V.attrsOf(G.pageNode(G.PdfPageBox{3n, "600px", "800px"})), "style") == Some{"width:600px;height:800px"} : Maybe<&2, String>}

law pdfpage_page_style_two:
  {G.pageStyle("612.5px", "792px") == "width:612.5px;height:792px" : String}

law pdfpage_pages_order:
  {V.attrGet(V.attrsOf(kidAt(V.kidsOf(G.docFrame([G.PdfPageBox{1n, "1px", "1px"}, G.PdfPageBox{2n, "2px", "2px"}])), 1n)), "data-page") == Some{"2"} : Maybe<&2, String>}

law pdfpage_doc_class:
  {V.attrGet(V.attrsOf(G.docFrame(Nil{})), "class") == Some{"pdf-document"} : Maybe<&2, String>}

law pdfpage_doc_empty:
  {V.kidsOf(G.docFrame(Nil{})) == Nil{} : List<&2, V.ViewNode>}

# ---------- estados do miolo ----------

law pdfpage_viewport_empty:
  {G.viewport(G.PdfEmpty{}, Nil{}) == Some{P.placeholder()} : Maybe<&2, V.ViewNode>}

law pdfpage_viewport_ready:
  for box: G.PdfPageBox
  {G.viewport(G.PdfReady{}, Con{box, Nil{}}) == Some{G.docFrame(Con{box, Nil{}})} : Maybe<&2, V.ViewNode>}

law pdfpage_viewport_loading:
  {G.viewport(G.PdfLoading{}, Nil{}) == None{} : Maybe<&2, V.ViewNode>}

law pdfpage_viewport_failed:
  {G.viewport(G.PdfFailed{}, Nil{}) == None{} : Maybe<&2, V.ViewNode>}

# ---------- destaques da busca ----------

law pdfpage_hl_none:
  {G.hlSegments("abc", "abc", "zz") == Con{V.viewText("abc"), Nil{}} : List<&2, V.ViewNode>}

law pdfpage_hl_empty_term:
  {G.hlSegments("abc", "abc", "") == Con{V.viewText("abc"), Nil{}} : List<&2, V.ViewNode>}

law pdfpage_hl_two_hits:
  {G.hlSegments("abcabc", "abcabc", "ab") == Con{hl("ab"), Con{V.viewText("c"), Con{hl("ab"), Con{V.viewText("c"), Nil{}}}}} : List<&2, V.ViewNode>}

law pdfpage_hl_no_overlap:
  {G.hlSegments("aaa", "aaa", "aa") == Con{hl("aa"), Con{V.viewText("a"), Nil{}}} : List<&2, V.ViewNode>}

law pdfpage_hl_single_char:
  {G.hlSegments("aba", "aba", "a") == Con{hl("a"), Con{V.viewText("b"), Con{hl("a"), Nil{}}}} : List<&2, V.ViewNode>}

law pdfpage_hl_hit_is_original:
  {G.hlSegments("Ação", "acao", "ca") == Con{V.viewText("A"), Con{hl("çã"), Con{V.viewText("o"), Nil{}}}} : List<&2, V.ViewNode>}

law pdfpage_hl_node_tag:
  {V.tagOf(kidAt(G.hlSegments("xax", "xax", "a"), 1n)) == "i" : String}

law pdfpage_hl_node_class:
  {V.attrGet(V.attrsOf(kidAt(G.hlSegments("xax", "xax", "a"), 1n)), "class") == Some{"pdf-hl"} : Maybe<&2, String>}

law pdfpage_hl_prefix:
  {G.hlSegments("ab", "ab", "a") == Con{hl("a"), Con{V.viewText("b"), Nil{}}} : List<&2, V.ViewNode>}

# ---------- handlers (a tabela do host no `pdf.mjs`) ----------

law pdfpage_open_click:
  {V.attrGet(V.attrsOf(G.openBtn("Enunciado")), "on:click") == Some{"OpenFile"} : Maybe<&2, String>}

law pdfpage_find_toggle_click:
  {V.attrGet(V.attrsOf(G.findToggleBtn("Enunciado", False{})), "on:click") == Some{"ToggleFind"} : Maybe<&2, String>}

law pdfpage_shot_click:
  {V.attrGet(V.attrsOf(G.shotBtn("Enunciado")), "on:click") == Some{"PageShot"} : Maybe<&2, String>}

law pdfpage_collapse_click:
  {V.attrGet(V.attrsOf(G.collapseBtn(False{})), "on:click") == Some{"ToggleCollapse"} : Maybe<&2, String>}

law pdfpage_select_change:
  {V.attrGet(V.attrsOf(G.selectNode("Enunciado", Nil{}, "")), "on:change") == Some{"OpenDoc"} : Maybe<&2, String>}

law pdfpage_page_input_change:
  {V.attrGet(V.attrsOf(G.pageInput("Enunciado")), "on:change") == Some{"GotoPage"} : Maybe<&2, String>}

law pdfpage_prev_click:
  {V.attrGet(V.attrsOf(kidAt(V.kidsOf(G.toolsBar("Enunciado")), 0n)), "on:click") == Some{"Prev"} : Maybe<&2, String>}

law pdfpage_next_click:
  {V.attrGet(V.attrsOf(kidAt(V.kidsOf(G.toolsBar("Enunciado")), 3n)), "on:click") == Some{"Next"} : Maybe<&2, String>}

law pdfpage_out_click:
  {V.attrGet(V.attrsOf(kidAt(V.kidsOf(G.toolsBar("Enunciado")), 4n)), "on:click") == Some{"ZoomOut"} : Maybe<&2, String>}

law pdfpage_in_click:
  {V.attrGet(V.attrsOf(kidAt(V.kidsOf(G.toolsBar("Enunciado")), 6n)), "on:click") == Some{"ZoomIn"} : Maybe<&2, String>}

law pdfpage_fit_click:
  {V.attrGet(V.attrsOf(kidAt(V.kidsOf(G.toolsBar("Enunciado")), 7n)), "on:click") == Some{"Fit"} : Maybe<&2, String>}

law pdfpage_invert_click:
  {V.attrGet(V.attrsOf(kidAt(V.kidsOf(G.toolsBar("Enunciado")), 8n)), "on:click") == Some{"ToggleInvert"} : Maybe<&2, String>}

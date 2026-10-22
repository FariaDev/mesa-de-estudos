import Base
import ../msg.bend as M
import ../pdfpageview.bend as G
import ../pdfview.bend as P
import ../readersheet.bend as RS
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
  G.PdfShell{"Enunciado", [G.PdfOption{"Limites.pdf", "/x/Limites.pdf"}], "/x/Limites.pdf", False{}, False{}, 0n}

# O n-ésimo nó da barra e do menu M.msg("pdf.view.more") (cenário concreto).
def titleKid(n: Nat) -> V.ViewNode:
  kidAt(V.kidsOf(G.titleBar(shellConcrete())), n)

def menuKid(n: Nat) -> V.ViewNode:
  kidAt(V.kidsOf(G.moreMenu("Enunciado", 0n, False{})), n)

def zoomKid(n: Nat) -> V.ViewNode:
  kidAt(V.kidsOf(kidAt(V.kidsOf(menuKid(2n)), 1n)), n)

def shellKid(n: Nat) -> V.ViewNode:
  kidAt(V.kidsOf(G.panelShell(shellConcrete())), n)

# ---------- rótulos ----------

law pdfpage_empty_option:
  {G.emptyOptionLabel() == M.msg("pdf.view.empty") : String}

law pdfpage_find_placeholder:
  {G.findPlaceholder() == M.msg("pdf.view.findPlaceholder") : String}

law pdfpage_find_label:
  {G.findButtonLabel() == M.msg("common.search") : String}

law pdfpage_open_title:
  {G.openTitle() == M.msg("pdf.view.open") : String}

law pdfpage_shot_title:
  {G.shotTitle() == M.msg("pdf.view.shot") : String}

law pdfpage_fit_title:
  {G.fitTitle() == M.msg("pdf.view.fit") : String}

law pdfpage_invert_title:
  {G.invertTitle() == M.msg("pdf.view.invertTitle") : String}

law pdfpage_invert_aria:
  {G.invertAria() == M.msg("pdf.view.invert") : String}

law pdfpage_prev_aria:
  {G.prevAria() == M.msg("pdf.view.prev") : String}

law pdfpage_next_aria:
  {G.nextAria() == M.msg("pdf.view.next") : String}

law pdfpage_out_aria:
  {G.outAria() == M.msg("pdf.view.zoomOut") : String}

law pdfpage_in_aria:
  {G.inAria() == M.msg("pdf.view.zoomIn") : String}

law pdfpage_divider_aria:
  {G.dividerAria() == M.msg("pdf.view.divider") : String}

law pdfpage_document_aria:
  {G.documentAria("Enunciado") == M.msg1("pdf.view.docAria", "label", "Enunciado") : String}

law pdfpage_open_aria:
  {G.openAria("Enunciado") == M.msg1("pdf.view.openAria", "label", "Enunciado") : String}

law pdfpage_find_aria:
  {G.findAria("Enunciado") == M.msg1("pdf.view.findAria", "label", "Enunciado") : String}

law pdfpage_page_aria:
  {G.pageAria("Enunciado") == M.msg1("pdf.view.pageAria", "label", "Enunciado") : String}

# ---------- rotação (ciclo de 90°) ----------

law pdfpage_rotation_step:
  {G.rotationStep() == 90n : Nat}

law pdfpage_rotation_next_0:
  {G.rotationNext(0n) == 90n : Nat}

law pdfpage_rotation_next_90:
  {G.rotationNext(90n) == 180n : Nat}

law pdfpage_rotation_next_180:
  {G.rotationNext(180n) == 270n : Nat}

law pdfpage_rotation_next_270:
  {G.rotationNext(270n) == 0n : Nat}

law pdfpage_rotation_valid_0:
  {G.rotationValid(0n) == True{} : Bool}

law pdfpage_rotation_valid_90:
  {G.rotationValid(90n) == True{} : Bool}

law pdfpage_rotation_valid_180:
  {G.rotationValid(180n) == True{} : Bool}

law pdfpage_rotation_valid_270:
  {G.rotationValid(270n) == True{} : Bool}

law pdfpage_rotation_valid_45:
  {G.rotationValid(45n) == False{} : Bool}

law pdfpage_rotation_valid_360:
  {G.rotationValid(360n) == False{} : Bool}

law pdfpage_rotation_normalize_valid:
  {G.rotationNormalize(270n) == 270n : Nat}

law pdfpage_rotation_normalize_invalid:
  {G.rotationNormalize(45n) == 0n : Nat}

law pdfpage_rotate_title_zero:
  {G.rotateTitle(0n) == M.msg1("pdf.view.rotateTitle", "deg", "0") : String}

law pdfpage_rotate_title_90:
  {G.rotateTitle(90n) == M.msg1("pdf.view.rotateTitle", "deg", "90") : String}

law pdfpage_rotate_aria:
  {G.rotateAria("Enunciado", 90n) == M.msg2("pdf.view.rotateAria", "label", "Enunciado", "deg", "90") : String}

law pdfpage_rotate_toast:
  {G.rotateToast(180n) == M.msg1("pdf.view.rotateToast", "deg", "180") : String}

law pdfpage_rotate_class:
  {V.attrGet(V.attrsOf(G.rotateBtn("Enunciado", 0n)), "class") == Some{"rotate more-item"} : Maybe<&2, String>}

law pdfpage_rotate_icon:
  {V.attrGet(V.attrsOf(G.rotateBtn("Enunciado", 0n)), "data-icon") == Some{"rotateCw"} : Maybe<&2, String>}

law pdfpage_rotate_title_attr:
  {V.attrGet(V.attrsOf(G.rotateBtn("Enunciado", 90n)), "title") == Some{M.msg1("pdf.view.rotateTitle", "deg", "90")} : Maybe<&2, String>}

law pdfpage_rotate_aria_attr:
  {V.attrGet(V.attrsOf(G.rotateBtn("Enunciado", 90n)), "aria-label") == Some{M.msg2("pdf.view.rotateAria", "label", "Enunciado", "deg", "90")} : Maybe<&2, String>}

law pdfpage_rotate_click:
  {V.attrGet(V.attrsOf(G.rotateBtn("Enunciado", 0n)), "on:click") == Some{"Rotate"} : Maybe<&2, String>}

# ---------- select da biblioteca ----------

law pdfpage_options_empty_concrete:
  {G.optionNodes(Nil{}, "") == Con{V.viewEl("option", [V.ViewAttr{"value", ""}], Con{V.viewText(M.msg("pdf.view.empty")), Nil{}}), Nil{}} : List<&2, V.ViewNode>}

law pdfpage_options_selected_concrete:
  {G.optionNodes([G.PdfOption{"Limites.pdf", "/x/Limites.pdf"}], "/x/Limites.pdf")
    == Con{V.viewEl("option", [V.ViewAttr{"value", ""}], Con{V.viewText(M.msg("pdf.view.empty")), Nil{}}),
         Con{V.viewEl("option", [V.ViewAttr{"value", "/x/Limites.pdf"}, V.ViewAttr{"selected", ""}], Con{V.viewText("Limites.pdf"), Nil{}}), Nil{}}} : List<&2, V.ViewNode>}

law pdfpage_options_not_selected:
  {V.attrGet(V.attrsOf(kidAt(G.optionNodes([G.PdfOption{"Limites.pdf", "/x/Limites.pdf"}], "/y/Outro.pdf"), 1n)), "selected") == None{} : Maybe<&2, String>}

law pdfpage_select_aria:
  {V.attrGet(V.attrsOf(G.selectNode("Enunciado", Nil{}, "")), "aria-label") == Some{M.msg1("pdf.view.docAria", "label", "Enunciado")} : Maybe<&2, String>}

law pdfpage_select_class:
  {V.attrGet(V.attrsOf(G.selectNode("Enunciado", Nil{}, "")), "class") == Some{"pdf-select"} : Maybe<&2, String>}

# ---------- cabeça do painel ----------

law pdfpage_title_tag:
  {V.tagOf(G.titleBar(shellConcrete())) == "div" : String}

law pdfpage_title_class:
  {V.attrGet(V.attrsOf(G.titleBar(shellConcrete())), "class") == Some{"pdf-title"} : Maybe<&2, String>}

law pdfpage_title_kids:
  {List.length(&2, V.ViewNode, V.kidsOf(G.titleBar(shellConcrete()))) == 10n : Nat}

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
  {V.attrGet(V.attrsOf(G.backBtn("Enunciado")), "aria-label") == Some{M.msg1("pdf.nav.backAria", "label", "Enunciado")} : Maybe<&2, String>}

law pdfpage_back_rotulo:
  {String.eq(G.navBackTitle(), M.msg("pdf.nav.backTitle")) == True{} : Bool}

# O Sumário e favoritos (favoritos + sumário) nasce fechado e é do host.
law pdfpage_nav_class:
  {V.attrGet(V.attrsOf(G.navBtn("Enunciado")), "class") == Some{"nav icon-btn"} : Maybe<&2, String>}

law pdfpage_nav_icon:
  {V.attrGet(V.attrsOf(G.navBtn("Enunciado")), "data-icon") == Some{"bookmark"} : Maybe<&2, String>}

law pdfpage_nav_titulo:
  {V.attrGet(V.attrsOf(G.navBtn("Enunciado")), "title") == Some{M.msg("pdf.nav.button")} : Maybe<&2, String>}

law pdfpage_nav_aria:
  {V.attrGet(V.attrsOf(G.navBtn("Enunciado")), "aria-label") == Some{M.msg1("pdf.nav.ariaOf", "label", "Enunciado")} : Maybe<&2, String>}

law pdfpage_nav_clique:
  {V.attrGet(V.attrsOf(G.navBtn("Enunciado")), "on:click") == Some{"ToggleNav"} : Maybe<&2, String>}

law pdfpage_nav_expandido:
  {V.attrGet(V.attrsOf(G.navBtn("Enunciado")), "aria-expanded") == Some{"false"} : Maybe<&2, String>}

law pdfpage_open_btn:
  {V.attrGet(V.attrsOf(G.openBtn("Enunciado")), "class") == Some{"open more-item"} : Maybe<&2, String>}

law pdfpage_open_btn_icon:
  {V.attrGet(V.attrsOf(G.openBtn("Enunciado")), "data-icon") == Some{"plus"} : Maybe<&2, String>}

law pdfpage_open_btn_aria:
  {V.attrGet(V.attrsOf(G.openBtn("Enunciado")), "aria-label") == Some{M.msg1("pdf.view.openAria", "label", "Enunciado")} : Maybe<&2, String>}

law pdfpage_find_toggle_icon:
  {V.attrGet(V.attrsOf(G.findToggleBtn("Enunciado", False{})), "data-icon") == Some{"search"} : Maybe<&2, String>}

law pdfpage_find_toggle_pressed:
  {V.attrGet(V.attrsOf(G.findToggleBtn("Enunciado", True{})), "aria-pressed") == Some{"true"} : Maybe<&2, String>}

law pdfpage_shot_btn:
  {V.attrGet(V.attrsOf(G.shotBtn("Enunciado")), "class") == Some{"page-shot more-item"} : Maybe<&2, String>}

law pdfpage_collapse_icon_up:
  {G.collapseIcon(True{}) == "chevronUp" : String}

law pdfpage_collapse_icon_down:
  {G.collapseIcon(False{}) == "chevronDown" : String}

law pdfpage_collapse_min:
  {V.attrGet(V.attrsOf(G.collapseBtn(True{})), "aria-pressed") == Some{"true"} : Maybe<&2, String>}

law pdfpage_collapse_title:
  {V.attrGet(V.attrsOf(G.collapseBtn(False{})), "title") == Some{M.msg("pdf.minimize")} : Maybe<&2, String>}

# ---------- ferramentas ----------

law pdfpage_page_input:
  {V.attrGet(V.attrsOf(G.pageInput("Enunciado")), "aria-label") == Some{M.msg1("pdf.view.pageAria", "label", "Enunciado")} : Maybe<&2, String>}

law pdfpage_page_input_value:
  {V.attrGet(V.attrsOf(G.pageInput("Enunciado")), "value") == Some{"1"} : Maybe<&2, String>}

law pdfpage_fit_btn:
  {V.attrGet(V.attrsOf(G.fitBtn()), "data-icon") == Some{"unfold"} : Maybe<&2, String>}

# ---------- barra única e menu M.msg("pdf.view.more") ----------

law pdfpage_bar_back_class:
  {V.attrGet(V.attrsOf(titleKid(2n)), "class") == Some{"back icon-btn"} : Maybe<&2, String>}

law pdfpage_bar_prev_class:
  {V.attrGet(V.attrsOf(titleKid(3n)), "class") == Some{"prev icon-btn"} : Maybe<&2, String>}

law pdfpage_bar_page_number:
  {V.attrGet(V.attrsOf(titleKid(4n)), "class") == Some{"page-number"} : Maybe<&2, String>}

law pdfpage_bar_page_total:
  {V.attrGet(V.attrsOf(titleKid(5n)), "class") == Some{"page-total"} : Maybe<&2, String>}

law pdfpage_bar_next_class:
  {V.attrGet(V.attrsOf(titleKid(6n)), "class") == Some{"next icon-btn"} : Maybe<&2, String>}

law pdfpage_bar_find_toggle:
  {V.attrGet(V.attrsOf(titleKid(7n)), "class") == Some{"find-toggle icon-btn"} : Maybe<&2, String>}

law pdfpage_bar_nav:
  {V.attrGet(V.attrsOf(titleKid(8n)), "class") == Some{"nav icon-btn"} : Maybe<&2, String>}

law pdfpage_bar_more:
  {V.attrGet(V.attrsOf(titleKid(9n)), "class") == Some{"more icon-btn"} : Maybe<&2, String>}

law pdfpage_prev_click:
  {V.attrGet(V.attrsOf(titleKid(3n)), "on:click") == Some{"Prev"} : Maybe<&2, String>}

law pdfpage_next_click:
  {V.attrGet(V.attrsOf(titleKid(6n)), "on:click") == Some{"Next"} : Maybe<&2, String>}

law pdfpage_more_icon:
  {V.attrGet(V.attrsOf(G.moreBtn("Enunciado")), "data-icon") == Some{"more"} : Maybe<&2, String>}

law pdfpage_more_click:
  {V.attrGet(V.attrsOf(G.moreBtn("Enunciado")), "on:click") == Some{"ToggleMore"} : Maybe<&2, String>}

law pdfpage_more_expandido:
  {V.attrGet(V.attrsOf(G.moreBtn("Enunciado")), "aria-expanded") == Some{"false"} : Maybe<&2, String>}

law pdfpage_more_aria:
  {V.attrGet(V.attrsOf(G.moreBtn("Enunciado")), "aria-label") == Some{M.msg1("pdf.view.moreAria", "label", "Enunciado")} : Maybe<&2, String>}

law pdfpage_more_titulo:
  {V.attrGet(V.attrsOf(G.moreBtn("Enunciado")), "title") == Some{M.msg("pdf.view.more")} : Maybe<&2, String>}

law pdfpage_menu_class:
  {V.attrGet(V.attrsOf(G.moreMenu("Enunciado", 0n, False{})), "class") == Some{"pdf-more-pop"} : Maybe<&2, String>}

law pdfpage_menu_oculto:
  {V.attrGet(V.attrsOf(G.moreMenu("Enunciado", 0n, False{})), "hidden") == Some{""} : Maybe<&2, String>}

law pdfpage_menu_aria:
  {V.attrGet(V.attrsOf(G.moreMenu("Enunciado", 0n, False{})), "aria-label") == Some{M.msg1("pdf.view.moreAria", "label", "Enunciado")} : Maybe<&2, String>}

law pdfpage_menu_kids:
  {List.length(&2, V.ViewNode, V.kidsOf(G.moreMenu("Enunciado", 0n, False{}))) == 7n : Nat}

law pdfpage_menu_open:
  {V.attrGet(V.attrsOf(menuKid(0n)), "class") == Some{"open more-item"} : Maybe<&2, String>}

law pdfpage_menu_shot:
  {V.attrGet(V.attrsOf(menuKid(1n)), "class") == Some{"page-shot more-item"} : Maybe<&2, String>}

law pdfpage_menu_shot_texto:
  {V.kidsOf(menuKid(1n)) == Con{V.viewText(M.msg("pdf.view.shotMenu")), Nil{}} : List<&2, V.ViewNode>}

law pdfpage_menu_zoom:
  {V.attrGet(V.attrsOf(menuKid(2n)), "class") == Some{"more-zoom"} : Maybe<&2, String>}

law pdfpage_menu_out_click:
  {V.attrGet(V.attrsOf(zoomKid(0n)), "on:click") == Some{"ZoomOut"} : Maybe<&2, String>}

law pdfpage_menu_zoom_label:
  {V.attrGet(V.attrsOf(zoomKid(1n)), "class") == Some{"zoom-label"} : Maybe<&2, String>}

law pdfpage_menu_in_click:
  {V.attrGet(V.attrsOf(zoomKid(2n)), "on:click") == Some{"ZoomIn"} : Maybe<&2, String>}

law pdfpage_menu_fit_click:
  {V.attrGet(V.attrsOf(menuKid(3n)), "on:click") == Some{"Fit"} : Maybe<&2, String>}

law pdfpage_menu_invert_click:
  {V.attrGet(V.attrsOf(menuKid(4n)), "on:click") == Some{"ToggleInvert"} : Maybe<&2, String>}

law pdfpage_menu_invert_texto:
  {V.kidsOf(menuKid(4n)) == Con{V.viewText(M.msg("pdf.view.invert")), Nil{}} : List<&2, V.ViewNode>}

law pdfpage_menu_rotate:
  {V.attrGet(V.attrsOf(menuKid(5n)), "class") == Some{"rotate more-item"} : Maybe<&2, String>}

law pdfpage_menu_rotate_title:
  {V.attrGet(V.attrsOf(kidAt(V.kidsOf(G.moreMenu("Enunciado", 90n, False{})), 5n)), "title") == Some{M.msg1("pdf.view.rotateTitle", "deg", "90")} : Maybe<&2, String>}

law pdfpage_menu_collapse:
  {V.attrGet(V.attrsOf(menuKid(6n)), "class") == Some{"collapse more-item"} : Maybe<&2, String>}

law pdfpage_menu_collapse_texto:
  {V.kidsOf(menuKid(6n)) == Con{V.viewText(M.msg("pdf.minimize")), Nil{}} : List<&2, V.ViewNode>}

law pdfpage_menu_collapse_restaurar:
  {V.kidsOf(kidAt(V.kidsOf(G.moreMenu("Enunciado", 0n, True{})), 6n)) == Con{V.viewText(M.msg("pdf.restore")), Nil{}} : List<&2, V.ViewNode>}

law pdfpage_restore_class:
  {V.attrGet(V.attrsOf(G.restoreBtn("Enunciado")), "class") == Some{"pdf-restore"} : Maybe<&2, String>}

law pdfpage_restore_click:
  {V.attrGet(V.attrsOf(G.restoreBtn("Enunciado")), "on:click") == Some{"ToggleCollapse"} : Maybe<&2, String>}

law pdfpage_restore_aria:
  {V.attrGet(V.attrsOf(G.restoreBtn("Enunciado")), "aria-label") == Some{M.msg1("pdf.view.restoreAria", "label", "Enunciado")} : Maybe<&2, String>}

law pdfpage_restore_rotulo:
  {V.kidsOf(kidAt(V.kidsOf(G.restoreBtn("Enunciado")), 1n)) == Con{V.viewText("Enunciado"), Nil{}} : List<&2, V.ViewNode>}

law pdfpage_panel_menu:
  {V.attrGet(V.attrsOf(shellKid(3n)), "class") == Some{"pdf-more-pop"} : Maybe<&2, String>}

law pdfpage_panel_restore:
  {V.attrGet(V.attrsOf(shellKid(4n)), "class") == Some{"pdf-restore"} : Maybe<&2, String>}

law pdfpage_printed_toggle_texto:
  {V.kidsOf(G.printedToggleBtn("Enunciado", False{})) == Con{V.viewText(M.msg("pdf.view.printedMenu")), Nil{}} : List<&2, V.ViewNode>}

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
  {V.attrGet(V.attrsOf(kidAt(V.kidsOf(G.findForm("Enunciado")), 0n)), "placeholder") == Some{M.msg("pdf.view.findPlaceholder")} : Maybe<&2, String>}

law pdfpage_find_count_hidden:
  {V.attrGet(V.attrsOf(kidAt(V.kidsOf(G.findForm("Enunciado")), 1n)), "hidden") == Some{""} : Maybe<&2, String>}

law pdfpage_find_button:
  {V.kidsOf(kidAt(V.kidsOf(G.findForm("Enunciado")), 2n)) == Con{V.viewText(M.msg("common.search")), Nil{}} : List<&2, V.ViewNode>}

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
  {List.length(&2, V.ViewNode, V.kidsOf(G.panelShell(shellConcrete()))) == 5n : Nat}

law pdfpage_panel_minimized_true:
  {V.attrGet(V.attrsOf(G.panelShell(G.PdfShell{"Enunciado", Nil{}, "", True{}, False{}, 0n})), "class") == Some{"pdf-panel minimized"} : Maybe<&2, String>}

law pdfpage_panel_minimized_false:
  {V.attrGet(V.attrsOf(G.panelShell(G.PdfShell{"Enunciado", Nil{}, "", False{}, False{}, 0n})), "class") == Some{"pdf-panel"} : Maybe<&2, String>}

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

# Sem material numa matéria: a folha "Lista 0" com o nome dela.
law pdfpage_viewport_folha:
  {G.viewport(G.PdfSheet{"Cálculo I"}, Nil{}) == Some{RS.sheet("Cálculo I")} : Maybe<&2, V.ViewNode>}

# A folha não depende das páginas medidas: o host não passa caixas para ela.
law pdfpage_viewport_folha_ignora_paginas:
  for box: G.PdfPageBox
  {G.viewport(G.PdfSheet{"Cálculo I"}, Con{box, Nil{}}) == Some{RS.sheet("Cálculo I")} : Maybe<&2, V.ViewNode>}

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

# O controle aparece com nome legivel, sem depender de hover.
law pdfpage_rotate_label:
  {V.kidsOf(G.rotateBtn("Enunciado", 0n)) == Con{V.viewText(M.msg("pdf.view.rotate")), Nil{}} : List<&2, V.ViewNode>}

# ---------- numeração impressa (rótulos do PDF e ajuste pessoal) ----------
# O vocabulário auxiliar fala do núcleo, não vai para o app.

def labels1(a: String) -> List<&2, String>:
  Con{a, Nil{}}

def labels2(a: String, b: String) -> List<&2, String>:
  Con{a, Con{b, Nil{}}}

def labels3(a: String, b: String, c: String) -> List<&2, String>:
  Con{a, Con{b, Con{c, Nil{}}}}

# ---------- rótulo impresso da página física ----------

law pdfpage_printed_auto_sem_rotulo:
  {G.printedLabel(Nil{}, G.OffsetAuto{}, 3n) == "" : String}

law pdfpage_printed_offset_positivo:
  {G.printedLabel(Nil{}, G.OffsetValue{False{}, 2n}, 1n) == "3" : String}

law pdfpage_printed_offset_negativo:
  {G.printedLabel(Nil{}, G.OffsetValue{True{}, 3n}, 5n) == "2" : String}

law pdfpage_printed_offset_front_matter:
  {G.printedLabel(Nil{}, G.OffsetValue{True{}, 3n}, 2n) == "" : String}

law pdfpage_printed_proprio_vence:
  {G.printedLabel(labels3("i", "ii", "1"), G.OffsetValue{False{}, 9n}, 3n) == "1" : String}

law pdfpage_printed_proprio_parcial_cai_no_offset:
  {G.printedLabel(labels1("i"), G.OffsetValue{False{}, 4n}, 2n) == "6" : String}

law pdfpage_printed_proprio_vazio_cai_no_offset:
  {G.printedLabel(labels2("", "ii"), G.OffsetAuto{}, 1n) == "" : String}

# ---------- resolver o que foi digitado no campo impresso ----------

law pdfpage_resolve_proprio_exato:
  {G.resolvePrinted(labels3("i", "ii", "1"), G.OffsetAuto{}, 10n, 1n, "ii") == Some{2n} : Maybe<&2, Nat>}

law pdfpage_resolve_proprio_caixa_ignorada:
  {G.resolvePrinted(labels1("IV"), G.OffsetAuto{}, 10n, 1n, "iv") == Some{1n} : Maybe<&2, Nat>}

# Rótulo repetido anda em ciclo: depois da atual; sem depois, volta à primeira.
law pdfpage_resolve_proprio_repetido_ciclo:
  {G.resolvePrinted(labels3("i", "ii", "i"), G.OffsetAuto{}, 10n, 1n, "i") == Some{3n} : Maybe<&2, Nat>}

law pdfpage_resolve_proprio_repetido_volta:
  {G.resolvePrinted(labels3("i", "ii", "i"), G.OffsetAuto{}, 10n, 3n, "i") == Some{1n} : Maybe<&2, Nat>}

law pdfpage_resolve_proprio_ausente:
  {G.resolvePrinted(labels1("i"), G.OffsetAuto{}, 10n, 1n, "zz") == None{} : Maybe<&2, Nat>}

law pdfpage_resolve_proprio_fora_do_total:
  {G.resolvePrinted(labels2("i", "ii"), G.OffsetAuto{}, 1n, 1n, "ii") == None{} : Maybe<&2, Nat>}

law pdfpage_resolve_sem_rotulo_e_fisica:
  {G.resolvePrinted(Nil{}, G.OffsetAuto{}, 10n, 1n, "5") == Some{5n} : Maybe<&2, Nat>}

law pdfpage_resolve_sem_rotulo_nao_numerico:
  {G.resolvePrinted(Nil{}, G.OffsetAuto{}, 10n, 1n, "abc") == None{} : Maybe<&2, Nat>}

law pdfpage_resolve_sem_rotulo_zero:
  {G.resolvePrinted(Nil{}, G.OffsetAuto{}, 10n, 1n, "0") == None{} : Maybe<&2, Nat>}

law pdfpage_resolve_offset_negativo:
  {G.resolvePrinted(Nil{}, G.OffsetValue{True{}, 3n}, 10n, 1n, "2") == Some{5n} : Maybe<&2, Nat>}

law pdfpage_resolve_offset_positivo:
  {G.resolvePrinted(Nil{}, G.OffsetValue{False{}, 2n}, 10n, 1n, "5") == Some{3n} : Maybe<&2, Nat>}

law pdfpage_resolve_offset_positivo_abaixo:
  {G.resolvePrinted(Nil{}, G.OffsetValue{False{}, 2n}, 10n, 1n, "1") == None{} : Maybe<&2, Nat>}

law pdfpage_resolve_espaco_ignorado:
  {G.resolvePrinted(Nil{}, G.OffsetAuto{}, 10n, 1n, "  4 ") == Some{4n} : Maybe<&2, Nat>}

law pdfpage_resolve_vazio:
  {G.resolvePrinted(labels1("i"), G.OffsetAuto{}, 10n, 1n, "   ") == None{} : Maybe<&2, Nat>}

# ---------- textos do controle ----------

law pdfpage_printed_status_auto:
  {G.printedStatusText(False{}, G.OffsetAuto{}) == M.msg("pdf.printed.noAdjust") : String}

law pdfpage_printed_status_pos:
  {G.printedStatusText(False{}, G.OffsetValue{False{}, 3n}) == M.msg1("pdf.printed.plus", "n", "3") : String}

law pdfpage_printed_status_neg:
  {G.printedStatusText(False{}, G.OffsetValue{True{}, 3n}) == M.msg1("pdf.printed.minus", "n", "3") : String}

law pdfpage_printed_status_proprio:
  {G.printedStatusText(True{}, G.OffsetValue{True{}, 3n}) == M.msg("pdf.printed.own") : String}

law pdfpage_printed_current_texto:
  {G.printedCurrentText("iv") == M.msg1("pdf.printed.current", "label", "iv") : String}

law pdfpage_printed_current_vazio:
  {G.printedCurrentText("") == M.msg("pdf.printed.noLabel") : String}

law pdfpage_printed_found_texto:
  {G.printedFoundText("iv", 7n) == M.msg2("pdf.printed.found", "text", "iv", "page", "7") : String}

law pdfpage_printed_not_found_texto:
  {G.printedNotFoundText() == M.msg("pdf.printed.notFound") : String}

law pdfpage_printed_bad_offset_texto:
  {G.printedBadOffsetText() == M.msg("pdf.printed.badOffset") : String}

law pdfpage_drop_hint_texto:
  {G.dropHintText("Enunciado") == M.msg1("pdf.drop.hint", "label", "Enunciado") : String}

law pdfpage_drop_invalid_texto:
  {G.dropInvalidText() == M.msg("pdf.drop.invalid") : String}

# ---------- nós do controle ----------

law pdfpage_printed_row_fechada:
  {V.attrGet(V.attrsOf(G.printedRow("Enunciado", False{})), "hidden") == Some{""} : Maybe<&2, String>}

law pdfpage_printed_row_aberta:
  {V.attrGet(V.attrsOf(G.printedRow("Enunciado", True{})), "hidden") == None{} : Maybe<&2, String>}

law pdfpage_printed_row_submit:
  {V.attrGet(V.attrsOf(G.printedRow("Enunciado", True{})), "on:submit") == Some{"GoPrinted"} : Maybe<&2, String>}

law pdfpage_printed_row_class:
  {V.attrGet(V.attrsOf(G.printedRow("Enunciado", True{})), "class") == Some{"pdf-printed"} : Maybe<&2, String>}

law pdfpage_printed_input_placeholder:
  {V.attrGet(V.attrsOf(G.printedInput("Enunciado")), "placeholder") == Some{M.msg("pdf.printed.placeholder")} : Maybe<&2, String>}

law pdfpage_printed_input_aria:
  {V.attrGet(V.attrsOf(G.printedInput("Enunciado")), "aria-label") == Some{M.msg1("pdf.printed.inputAria", "label", "Enunciado")} : Maybe<&2, String>}

law pdfpage_printed_go_label:
  {V.kidsOf(G.printedGoBtn()) == Con{V.viewText(M.msg("pdf.printed.go")), Nil{}} : List<&2, V.ViewNode>}

law pdfpage_printed_offset_limits:
  {V.attrGet(V.attrsOf(G.printedOffsetInput("Enunciado")), "max") == Some{"1000000"} : Maybe<&2, String>}

law pdfpage_printed_offset_save_click:
  {V.attrGet(V.attrsOf(G.printedOffsetSaveBtn()), "on:click") == Some{"PrintedOffsetSave"} : Maybe<&2, String>}

law pdfpage_printed_offset_auto_click:
  {V.attrGet(V.attrsOf(G.printedOffsetAutoBtn()), "on:click") == Some{"PrintedOffsetAuto"} : Maybe<&2, String>}

law pdfpage_printed_toggle_click:
  {V.attrGet(V.attrsOf(G.printedToggleBtn("Enunciado", False{})), "on:click") == Some{"TogglePrinted"} : Maybe<&2, String>}

law pdfpage_printed_toggle_icon:
  {V.attrGet(V.attrsOf(G.printedToggleBtn("Enunciado", False{})), "data-icon") == Some{"scan"} : Maybe<&2, String>}

law pdfpage_printed_toggle_aria:
  {V.attrGet(V.attrsOf(G.printedToggleBtn("Enunciado", False{})), "aria-expanded") == Some{"false"} : Maybe<&2, String>}

law pdfpage_drop_hint_class:
  {V.attrGet(V.attrsOf(G.dropHint("Enunciado")), "class") == Some{"pdf-drop-hint"} : Maybe<&2, String>}

law pdfpage_drop_hint_escondida:
  {V.attrGet(V.attrsOf(G.dropHint("Enunciado")), "hidden") == Some{""} : Maybe<&2, String>}

# O estado do controle é o modo do ajuste e o rótulo da página, cada um uma
# mensagem; o host os traduz e junta com " · " (#41).
law pdfpage_printed_status_sem_ajuste:
  {G.printedStatusText(False{}, G.OffsetAuto{}) == M.msg("pdf.printed.noAdjust") : String}

law pdfpage_printed_status_do_pdf:
  {G.printedStatusText(True{}, G.OffsetAuto{}) == M.msg("pdf.printed.own") : String}

law pdfpage_printed_saved_auto:
  {G.printedSavedOffsetText(G.OffsetAuto{}) == M.msg("pdf.printed.savedAuto") : String}

law pdfpage_printed_saved_pos:
  {G.printedSavedOffsetText(G.OffsetValue{False{}, 2n}) == M.msg1("pdf.printed.savedPlus", "n", "2") : String}

law pdfpage_printed_saved_neg:
  {G.printedSavedOffsetText(G.OffsetValue{True{}, 3n}) == M.msg1("pdf.printed.savedMinus", "n", "3") : String}

law pdfpage_drop_opening_texto:
  {G.dropOpeningText() == M.msg("pdf.drop.opening") : String}

law pdfpage_drop_opened_texto:
  {G.dropOpenedText("Extra.pdf", "Formulário") == M.msg2("pdf.drop.opened", "name", "Extra.pdf", "label", "Formulário") : String}

law pdfpage_drop_unavailable_texto:
  {G.dropUnavailableText() == M.msg("pdf.drop.unavailable") : String}

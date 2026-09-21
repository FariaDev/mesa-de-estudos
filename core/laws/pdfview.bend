import Base
import ../pdfview.bend as P
import ../view.bend as V

# ---------------------------------------------------------------------------
# Contrato do chrome do leitor de PDF. Prefixo `pdf_`.
#
# Grid/nav/collapse casam nos Bool (reduzem em geral). Rótulos com Nat.show
# e lookup de attr fecham em cenários concretos.
# ---------------------------------------------------------------------------

# ---------- grid ----------

law pdf_grid_nenhum:
  {P.gridFlags(False{}, False{}) == P.GridFlags{False{}, False{}, False{}} : P.GridFlags}

law pdf_grid_outro:
  {P.gridFlags(False{}, True{}) == P.GridFlags{True{}, True{}, False{}} : P.GridFlags}

law pdf_grid_este:
  {P.gridFlags(True{}, False{}) == P.GridFlags{False{}, True{}, True{}} : P.GridFlags}

law pdf_grid_ambos:
  {P.gridFlags(True{}, True{}) == P.GridFlags{False{}, True{}, False{}} : P.GridFlags}

law pdf_grid_class_este:
  {P.gridClass(True{}, False{}) == V.ViewAttr{"class", "has-min has-other-min"} : V.ViewAttr}

law pdf_grid_class_outro:
  {P.gridClass(False{}, True{}) == V.ViewAttr{"class", "other-min has-min"} : V.ViewAttr}

law pdf_grid_class_nenhum:
  {P.gridClass(False{}, False{}) == V.ViewAttr{"class", ""} : V.ViewAttr}

# ---------- painel ----------

law pdf_panel_flags:
  for minimized: Bool
  for pinned: Bool
  {P.panelFlags(minimized, pinned) == P.PanelFlags{minimized, pinned} : P.PanelFlags}

law pdf_panel_class_min_pin:
  {P.panelClass(True{}, True{}) == V.ViewAttr{"class", "pdf-panel minimized pinned"} : V.ViewAttr}

law pdf_panel_class_base:
  {P.panelClass(False{}, False{}) == V.ViewAttr{"class", "pdf-panel"} : V.ViewAttr}

# ---------- nav / collapse / disabled ----------

law pdf_nav_sem_doc:
  for atFirst: Bool
  for atLast: Bool
  {P.navChrome(False{}, atFirst, atLast) == P.NavChrome{True{}, True{}} : P.NavChrome}

law pdf_nav_com_doc:
  for atFirst: Bool
  for atLast: Bool
  {P.navChrome(True{}, atFirst, atLast) == P.NavChrome{atFirst, atLast} : P.NavChrome}

law pdf_collapse_min:
  {P.collapseTitle(True{}) == "Restaurar este leitor" : String}

law pdf_collapse_aberto:
  {P.collapseTitle(False{}) == "Minimizar este leitor" : String}

law pdf_disabled_on:
  {P.disabledAttr(True{}) == Con{V.attr("disabled", "disabled"), Nil{}} : List<&2, V.ViewAttr>}

law pdf_disabled_off:
  {P.disabledAttr(False{}) == Nil{} : List<&2, V.ViewAttr>}

# ---------- placeholder ----------

law pdf_placeholder_texto:
  {P.placeholderText() == "Escolha um PDF da biblioteca ou abra um arquivo local." : String}

law pdf_placeholder_tag:
  {V.tagOf(P.placeholder()) == "div" : String}

law pdf_placeholder_class:
  {V.attrGet(V.attrsOf(P.placeholder()), "class") == Some{"pdf-placeholder"} : Maybe<&2, String>}

law pdf_placeholder_kid:
  {V.kidsOf(P.placeholder()) == Con{V.viewText(P.placeholderText()), Nil{}} : List<&2, V.ViewNode>}

# ---------- página / zoom / rodapé ----------

law pdf_total_vazio:
  {P.pageTotalDash() == "/ —" : String}

law pdf_total_n:
  {P.pageTotalText(12n) == "/ 12" : String}

law pdf_page_value:
  {P.pageNumberValue(2n) == "2" : String}

law pdf_page_max:
  {P.pageNumberMax(10n) == "10" : String}

law pdf_zoom_100:
  {P.zoomLabelText(100n) == "100%" : String}

law pdf_foot_loading:
  {P.footLoadingText() == "Carregando…" : String}

law pdf_foot_error:
  {P.footErrorText() == "Não foi possível abrir o PDF." : String}

law pdf_foot_ready:
  {P.footReadyText(2n, 10n, P.modeContinuous(), "Limites.pdf")
    == "Página 2 de 10 · rolagem contínua · Limites.pdf" : String}

law pdf_foot_ready_node:
  {P.footReady(2n, 10n, P.modeContinuous(), "Limites.pdf")
    == V.viewText(P.footReadyText(2n, 10n, P.modeContinuous(), "Limites.pdf")) : V.ViewNode}

# ---------- find-count (fatos Hidden/Shown/All já resolvidos) ----------

law pdf_find_hidden:
  for shown: Bool
  for index: Nat
  for total: Nat
  {P.findCountChrome(True{}, shown, index, total) == P.CountChrome{True{}, ""} : P.CountChrome}

law pdf_find_all:
  {P.findCountChrome(False{}, False{}, 0n, 4n) == P.CountChrome{False{}, "4 ocorrências"} : P.CountChrome}

law pdf_find_shown:
  {P.findCountChrome(False{}, True{}, 1n, 3n) == P.CountChrome{False{}, "1/3"} : P.CountChrome}

law pdf_find_label_shown:
  {P.findCountLabel(P.CountChrome{False{}, "1/3"}) == V.viewText("1/3") : V.ViewNode}

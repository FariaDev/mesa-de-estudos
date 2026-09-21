import Base
import ../popoverview.bend as P
import ../view.bend as V

# ---------------------------------------------------------------------------
# Contrato da casca dos popovers do composer.
#
# Fatos concretos travam textos, ids, classes, ARIA e a ordem dos filhos; as
# contagens têm indução no comprimento das listas. O que ficou de fora (medida,
# posicionamento, foco, scroll, localStorage, IPC e a troca dos slots de ícone
# pelo SVG do host) é host.
# ---------------------------------------------------------------------------

def at(xs: List<&2, V.ViewNode>, i: Nat) -> V.ViewNode:
  match xs i:
    case Nil{} _:
      V.viewText("")
    case Con{h, t} 0n:
      h
    case Con{h, t} 1n+p:
      at(t, p)

def kind(n: V.ViewNode, i: Nat) -> V.ViewNode:
  at(V.kidsOf(n), i)

def attrOf(n: V.ViewNode, name: String) -> Maybe<&2, String>:
  V.attrGet(V.attrsOf(n), name)

def oneOption() -> P.PopOption:
  P.PopOption{"a/1", "Modelo A", "provedor", True{}, True{}, True{}}

def oneGroup() -> P.PopGroup:
  P.PopGroup{"Fixados", [oneOption()]}

def twoGroups() -> List<&2, P.PopGroup>:
  [
    P.PopGroup{"Fixados", [oneOption(), P.PopOption{"a/2", "Modelo B", "provedor", False{}, False{}, False{}}]},
    P.PopGroup{"Recentes", [P.PopOption{"b/1", "Modelo C", "outro", False{}, False{}, False{}}]}
  ]

def oneEffort(checked: Bool, active: Bool, desc: String) -> P.EffortItem:
  P.EffortItem{"low", "Baixo", desc, checked, active}

# ---------- textos ----------

law pv_vazio_texto:
  {P.modelEmptyText() == "Nenhum modelo encontrado." : String}

law pv_rodape_dica:
  {P.modelFootText() == "↑↓ navegar · ⏎ escolher · Esc fechar" : String}

law pv_esforco_titulo:
  {P.effortHeadText() == "Esforço de raciocínio" : String}

law pv_aria_modelo:
  {P.modelChipAria("Pi · provider") == "Modelo: Pi · provider" : String}

law pv_aria_esforco:
  {P.effortChipAria("Baixo") == "Esforço: Baixo" : String}

law pv_aria_esforco_vazio:
  {P.effortChipAria("") == "Esforço" : String}

law pv_estrela_fixar:
  {P.starLabel("Modelo", False{}) == "Fixar Modelo" : String}

law pv_estrela_desafixar:
  {P.starLabel("Modelo", True{}) == "Desafixar Modelo" : String}

# ---------- índice ----------

law pv_id_zero:
  {P.modelRowId(0n) == "mp-opt-0" : String}

law pv_id_dez:
  {P.modelRowId(9n) == "mp-opt-9" : String}

law pv_passo_none_sobe:
  {P.stepIndex(3n, None{}, True{}) == 0n : Nat}

law pv_passo_none_desce:
  {P.stepIndex(3n, None{}, False{}) == 2n : Nat}

law pv_passo_volta:
  {P.stepIndex(3n, Some{2n}, True{}) == 0n : Nat}

law pv_passo_antes:
  {P.stepIndex(3n, Some{0n}, False{}) == 2n : Nat}

law pv_passo_meio:
  {P.stepIndex(3n, Some{1n}, True{}) == 2n : Nat}

# ---------- histórico do prompt ----------

law pv_hist_vazio_sobe:
  {P.historyStep(True{}, None{}, Nil{}, "", "") == None{} : Maybe<&2, P.HistoryStep>}

law pv_hist_digitando:
  {P.historyStep(True{}, None{}, ["b", "a"], "rascunho", "") == None{} : Maybe<&2, P.HistoryStep>}

law pv_hist_digitando_espaco:
  {P.historyStep(True{}, None{}, ["b"], "   ", "") == Some{P.HistoryStep{Some{0n}, "b", True{}}} : Maybe<&2, P.HistoryStep>}

law pv_hist_entra:
  {P.historyStep(True{}, None{}, ["b", "a"], "", "") == Some{P.HistoryStep{Some{0n}, "b", True{}}} : Maybe<&2, P.HistoryStep>}

law pv_hist_sobe_um:
  {P.historyStep(True{}, Some{0n}, ["c", "b", "a"], "", "") == Some{P.HistoryStep{Some{1n}, "b", False{}}} : Maybe<&2, P.HistoryStep>}

law pv_hist_sobe_no_topo:
  {P.historyStep(True{}, Some{2n}, ["c", "b", "a"], "", "") == Some{P.HistoryStep{Some{2n}, "a", False{}}} : Maybe<&2, P.HistoryStep>}

law pv_hist_desce:
  {P.historyStep(False{}, Some{2n}, ["c", "b", "a"], "", "") == Some{P.HistoryStep{Some{1n}, "b", False{}}} : Maybe<&2, P.HistoryStep>}

law pv_hist_volta_rascunho:
  {P.historyStep(False{}, Some{0n}, ["c"], "", "rascunho") == Some{P.HistoryStep{None{}, "rascunho", False{}}} : Maybe<&2, P.HistoryStep>}

law pv_hist_fora_nao_desce:
  {P.historyStep(False{}, None{}, ["c"], "", "rascunho") == None{} : Maybe<&2, P.HistoryStep>}

law pv_hist_um_item_fecha:
  {P.historyStep(True{}, Some{0n}, ["c"], "", "") == Some{P.HistoryStep{Some{0n}, "c", False{}}} : Maybe<&2, P.HistoryStep>}

# ---------- linha do seletor ----------

law pv_linha_ativa:
  {attrOf(P.modelRowAt(0n, oneOption()), "class") == Some{"mp-row current active"} : Maybe<&2, String>}

law pv_linha_inativa:
  {attrOf(P.modelRowAt(0n, P.PopOption{"a/1", "M", "p", False{}, False{}, False{}}), "class") == Some{"mp-row"} : Maybe<&2, String>}

law pv_linha_papel:
  {attrOf(P.modelRowAt(0n, oneOption()), "role") == Some{"option"} : Maybe<&2, String>}

law pv_linha_id:
  {attrOf(P.modelRowAt(4n, oneOption()), "id") == Some{"mp-opt-4"} : Maybe<&2, String>}

law pv_linha_atual_selecionada:
  {attrOf(P.modelRowAt(0n, oneOption()), "aria-selected") == Some{"true"} : Maybe<&2, String>}

law pv_linha_key:
  {attrOf(P.modelRowAt(0n, oneOption()), "key") == Some{"a/1"} : Maybe<&2, String>}

law pv_linha_eventos:
  {attrOf(P.modelRowAt(0n, oneOption()), "on:click") == Some{"pick"} : Maybe<&2, String>}

law pv_linha_hover:
  {attrOf(P.modelRowAt(0n, oneOption()), "on:mouseenter") == Some{"hover"} : Maybe<&2, String>}

law pv_linha_nome:
  {attrOf(kind(P.modelRowAt(0n, oneOption()), 0n), "class") == Some{"mp-name"} : Maybe<&2, String>}

law pv_linha_provider:
  {attrOf(kind(P.modelRowAt(0n, oneOption()), 1n), "class") == Some{"mp-provider"} : Maybe<&2, String>}

law pv_linha_quatro_filhos:
  {List.length(&2, V.ViewNode, V.kidsOf(P.modelRowAt(0n, oneOption()))) == 4n : Nat}

# ---------- check e estrela ----------

law pv_check_slot:
  {attrOf(P.modelCheckNode(), "class") == Some{"mp-check"} : Maybe<&2, String>}

law pv_check_escondido:
  {attrOf(P.modelCheckNode(), "aria-hidden") == Some{"true"} : Maybe<&2, String>}

law pv_check_nome:
  {V.textOf(at(V.kidsOf(P.modelCheckNode()), 0n)) == "check" : String}

law pv_estrela_pressao_fixada:
  {attrOf(kind(P.modelRowAt(0n, oneOption()), 3n), "aria-pressed") == Some{"true"} : Maybe<&2, String>}

law pv_estrela_pressao_solta:
  {attrOf(kind(P.modelRowAt(0n, P.PopOption{"a/1", "M", "p", False{}, False{}, False{}}), 3n), "aria-pressed") == Some{"false"} : Maybe<&2, String>}

law pv_estrela_rotulo:
  {attrOf(kind(P.modelRowAt(0n, oneOption()), 3n), "aria-label") == Some{"Desafixar Modelo A"} : Maybe<&2, String>}

law pv_estrela_title:
  {attrOf(kind(P.modelRowAt(0n, oneOption()), 3n), "title") == Some{"Desafixar Modelo A"} : Maybe<&2, String>}

law pv_estrela_evento:
  {attrOf(kind(P.modelRowAt(0n, oneOption()), 3n), "on:click") == Some{"star"} : Maybe<&2, String>}

law pv_estrela_icone:
  {V.textOf(at(V.kidsOf(at(V.kidsOf(kind(P.modelRowAt(0n, oneOption()), 3n)), 0n)), 0n)) == "star" : String}

# ---------- grupo e lista ----------

law pv_grupo_rotulo:
  {attrOf(P.modelGroupNode("Fixados", Nil{}), "aria-label") == Some{"Fixados"} : Maybe<&2, String>}

law pv_grupo_papel:
  {attrOf(P.modelGroupNode("Fixados", Nil{}), "role") == Some{"group"} : Maybe<&2, String>}

law pv_grupo_cabeca:
  {attrOf(kind(P.modelGroupNode("Fixados", Nil{}), 0n), "class") == Some{"mp-section"} : Maybe<&2, String>}

law pv_grupo_cabeca_papel:
  {attrOf(kind(P.modelGroupNode("Fixados", Nil{}), 0n), "role") == Some{"presentation"} : Maybe<&2, String>}

law pv_grupo_cabeca_texto:
  {V.textOf(at(V.kidsOf(kind(P.modelGroupNode("Fixados", Nil{}), 0n)), 0n)) == "Fixados" : String}

law pv_lista_vazia:
  {attrOf(at(P.modelListKids(Nil{}), 0n), "class") == Some{"mp-empty"} : Maybe<&2, String>}

law pv_lista_vazia_texto:
  {V.textOf(at(V.kidsOf(at(P.modelListKids(Nil{}), 0n)), 0n)) == "Nenhum modelo encontrado." : String}

law pv_lista_um_grupo:
  {List.length(&2, V.ViewNode, P.modelListKids([oneGroup()])) == 1n : Nat}

law pv_lista_primeira_linha:
  {attrOf(kind(at(P.modelListKids([oneGroup()]), 0n), 1n), "id") == Some{"mp-opt-0"} : Maybe<&2, String>}

law pv_lista_dois_grupos:
  {List.length(&2, V.ViewNode, P.modelListKids(twoGroups())) == 2n : Nat}

law pv_lista_id_atravessa:
  {attrOf(kind(at(P.modelListKids(twoGroups()), 1n), 1n), "id") == Some{"mp-opt-2"} : Maybe<&2, String>}

law pv_lista_ordem_ids:
  {attrOf(kind(at(P.modelListKids([oneGroup(), oneGroup()]), 1n), 1n), "id") == Some{"mp-opt-1"} : Maybe<&2, String>}

law pv_starts:
  {P.modelStarts(twoGroups()) == [0n, 2n] : List<&2, Nat>}

# Cada opção vira exatamente uma linha contada.
law pv_contagem_opcoes:
  for options: List<&2, P.PopOption>
  {P.modelOptionCount([P.PopGroup{"g", options}]) == List.length(&2, P.PopOption, options) : Nat}

# ---------- casca do seletor ----------

law pv_casca_id:
  {attrOf(P.modelPopView(), "id") == Some{"model-picker"} : Maybe<&2, String>}

law pv_casca_classe:
  {attrOf(P.modelPopView(), "class") == Some{"mp-pop"} : Maybe<&2, String>}

law pv_casca_escondida:
  {attrOf(P.modelPopView(), "hidden") == Some{""} : Maybe<&2, String>}

law pv_casca_busca:
  {attrOf(kind(P.modelPopView(), 0n), "class") == Some{"mp-search-row"} : Maybe<&2, String>}

law pv_casca_icone_busca:
  {attrOf(at(V.kidsOf(kind(P.modelPopView(), 0n)), 0n), "class") == Some{"mp-search-icon"} : Maybe<&2, String>}

law pv_casca_lista_id:
  {attrOf(kind(P.modelPopView(), 1n), "id") == Some{"model-picker-list"} : Maybe<&2, String>}

law pv_casca_lista_papel:
  {attrOf(kind(P.modelPopView(), 1n), "role") == Some{"listbox"} : Maybe<&2, String>}

law pv_casca_lista_rotulo:
  {attrOf(kind(P.modelPopView(), 1n), "aria-label") == Some{"Modelos"} : Maybe<&2, String>}

law pv_casca_rodape:
  {attrOf(kind(P.modelPopView(), 2n), "class") == Some{"mp-foot"} : Maybe<&2, String>}

law pv_casca_rodape_texto:
  {V.textOf(at(V.kidsOf(kind(P.modelPopView(), 2n)), 0n)) == P.modelFootText() : String}

law pv_busca_id:
  {attrOf(P.modelSearchInput(), "id") == Some{"model-picker-search"} : Maybe<&2, String>}

law pv_busca_tipo:
  {attrOf(P.modelSearchInput(), "type") == Some{"search"} : Maybe<&2, String>}

law pv_busca_papel:
  {attrOf(P.modelSearchInput(), "role") == Some{"combobox"} : Maybe<&2, String>}

law pv_busca_controles:
  {attrOf(P.modelSearchInput(), "aria-controls") == Some{"model-picker-list"} : Maybe<&2, String>}

law pv_busca_rotulo:
  {attrOf(P.modelSearchInput(), "aria-label") == Some{"Buscar modelo"} : Maybe<&2, String>}

law pv_busca_evento:
  {attrOf(P.modelSearchInput(), "on:input") == Some{"filter"} : Maybe<&2, String>}

law pv_busca_placeholder:
  {attrOf(P.modelSearchInput(), "placeholder") == Some{"Buscar modelo"} : Maybe<&2, String>}

# ---------- chip ----------

law pv_chip_modelo:
  {attrOf(P.modelChipView("Pi", "Pi · provider", True{}, False{}), "id") == Some{"model-chip"} : Maybe<&2, String>}

law pv_chip_modelo_classe:
  {attrOf(P.modelChipView("Pi", "Pi · provider", True{}, False{}), "class") == Some{"chip"} : Maybe<&2, String>}

law pv_chip_modelo_papel:
  {attrOf(P.modelChipView("Pi", "Pi · provider", True{}, False{}), "aria-haspopup") == Some{"listbox"} : Maybe<&2, String>}

law pv_chip_modelo_controles:
  {attrOf(P.modelChipView("Pi", "Pi · provider", True{}, False{}), "aria-controls") == Some{"model-picker-list"} : Maybe<&2, String>}

law pv_chip_modelo_rotulo:
  {attrOf(P.modelChipView("Pi", "Pi · provider", True{}, False{}), "aria-label") == Some{"Modelo: Pi · provider"} : Maybe<&2, String>}

law pv_chip_fechado:
  {attrOf(P.modelChipView("Pi", "Pi", False{}, False{}), "aria-expanded") == Some{"false"} : Maybe<&2, String>}

law pv_chip_aberto:
  {attrOf(P.modelChipView("Pi", "Pi", True{}, False{}), "aria-expanded") == Some{"true"} : Maybe<&2, String>}

law pv_chip_ativo:
  {attrOf(P.modelChipView("Pi", "Pi", False{}, False{}), "disabled") == None{} : Maybe<&2, String>}

law pv_chip_desabilitado:
  {attrOf(P.modelChipView("Pi", "Pi", False{}, True{}), "disabled") == Some{""} : Maybe<&2, String>}

law pv_chip_nome:
  {V.textOf(at(V.kidsOf(kind(P.modelChipView("Pi", "Pi", False{}, False{}), 0n)), 0n)) == "Pi" : String}

law pv_chip_nome_classe:
  {attrOf(kind(P.modelChipView("Pi", "Pi", False{}, False{}), 0n), "class") == Some{"mp-chip-name"} : Maybe<&2, String>}

law pv_chip_chevron:
  {V.textOf(at(V.kidsOf(kind(P.modelChipView("Pi", "Pi", False{}, False{}), 1n)), 0n)) == "chevronDown" : String}

law pv_chip_chevron_slot:
  {attrOf(kind(P.modelChipView("Pi", "Pi", False{}, False{}), 1n), "class") == Some{"icon-slot"} : Maybe<&2, String>}

law pv_chip_esforco:
  {attrOf(P.effortChipView("Baixo", "Esforço: Baixo", False{}, False{}), "id") == Some{"effort-chip"} : Maybe<&2, String>}

law pv_chip_esforco_papel:
  {attrOf(P.effortChipView("Baixo", "Esforço: Baixo", False{}, False{}), "aria-haspopup") == Some{"menu"} : Maybe<&2, String>}

law pv_chip_esforco_sem_controles:
  {attrOf(P.effortChipView("Baixo", "Baixo", False{}, False{}), "aria-controls") == None{} : Maybe<&2, String>}

law pv_chip_esforco_rotulo:
  {attrOf(P.effortChipView("Baixo", "Esforço: Baixo", False{}, False{}), "aria-label") == Some{"Esforço: Baixo"} : Maybe<&2, String>}

law pv_chip_esforco_nome:
  {attrOf(kind(P.effortChipView("Baixo", "Baixo", False{}, False{}), 0n), "class") == Some{"effort-name"} : Maybe<&2, String>}

# ---------- menu de esforço ----------

law pv_menu_id:
  {attrOf(P.effortMenuView(), "id") == Some{"effort-menu"} : Maybe<&2, String>}

law pv_menu_papel:
  {attrOf(P.effortMenuView(), "role") == Some{"menu"} : Maybe<&2, String>}

law pv_menu_rotulo:
  {attrOf(P.effortMenuView(), "aria-label") == Some{"Esforço de raciocínio"} : Maybe<&2, String>}

law pv_menu_editavel:
  {attrOf(P.effortMenuView(), "contenteditable") == Some{"false"} : Maybe<&2, String>}

law pv_menu_escondido:
  {attrOf(P.effortMenuView(), "hidden") == Some{""} : Maybe<&2, String>}

law pv_menu_estilo:
  {attrOf(P.effortMenuView(), "style") == Some{"position:fixed;z-index:50"} : Maybe<&2, String>}

law pv_menu_cabeca:
  {attrOf(at(P.effortMenuKids(Nil{}), 0n), "class") == Some{"effort-head"} : Maybe<&2, String>}

law pv_menu_um_item:
  {List.length(&2, V.ViewNode, P.effortMenuKids([oneEffort(False{}, False{}, "")])) == 2n : Nat}

law pv_item_esforco_papel:
  {attrOf(P.effortItemNode(oneEffort(False{}, False{}, "")), "role") == Some{"menuitemradio"} : Maybe<&2, String>}

law pv_item_esforco_valor:
  {attrOf(P.effortItemNode(oneEffort(False{}, False{}, "")), "data-value") == Some{"low"} : Maybe<&2, String>}

law pv_item_esforco_marcado:
  {attrOf(P.effortItemNode(oneEffort(True{}, False{}, "")), "aria-checked") == Some{"true"} : Maybe<&2, String>}

law pv_item_esforco_solto:
  {attrOf(P.effortItemNode(oneEffort(False{}, False{}, "")), "aria-checked") == Some{"false"} : Maybe<&2, String>}

law pv_item_esforco_ativo:
  {attrOf(P.effortItemNode(oneEffort(False{}, True{}, "")), "class") == Some{"effort-item active"} : Maybe<&2, String>}

law pv_item_esforco_evento:
  {attrOf(P.effortItemNode(oneEffort(False{}, False{}, "")), "on:click") == Some{"pick"} : Maybe<&2, String>}

law pv_item_esforco_hover:
  {attrOf(P.effortItemNode(oneEffort(False{}, False{}, "")), "on:mouseenter") == Some{"hover"} : Maybe<&2, String>}

law pv_item_esforco_rotulo:
  {V.textOf(at(V.kidsOf(at(V.kidsOf(at(V.kidsOf(P.effortItemNode(oneEffort(False{}, False{}, ""))), 0n)), 0n)), 0n)) == "Baixo" : String}

law pv_item_esforco_desc:
  {attrOf(at(V.kidsOf(at(V.kidsOf(P.effortItemNode(oneEffort(False{}, False{}, "curto"))), 0n)), 1n), "class") == Some{"effort-desc"} : Maybe<&2, String>}

law pv_item_esforco_sem_desc:
  {List.length(&2, V.ViewNode, V.kidsOf(at(V.kidsOf(P.effortItemNode(oneEffort(False{}, False{}, ""))), 0n))) == 1n : Nat}

law pv_item_esforco_sem_check:
  {List.length(&2, V.ViewNode, V.kidsOf(P.effortItemNode(oneEffort(False{}, False{}, "")))) == 1n : Nat}

law pv_item_esforco_com_check:
  {attrOf(at(V.kidsOf(P.effortItemNode(oneEffort(True{}, False{}, ""))), 1n), "class") == Some{"effort-check"} : Maybe<&2, String>}

law pv_item_esforco_check_sem_ocultar:
  {attrOf(at(V.kidsOf(P.effortItemNode(oneEffort(True{}, False{}, ""))), 1n), "aria-hidden") == None{} : Maybe<&2, String>}

law pv_item_esforco_check_nome:
  {V.textOf(at(V.kidsOf(at(V.kidsOf(P.effortItemNode(oneEffort(True{}, False{}, ""))), 1n)), 0n)) == "check" : String}

# ---------- peças soltas da casca ----------

law pv_tecla:
  {V.textOf(at(V.kidsOf(P.kbdNode("⏎")), 0n)) == "⏎" : String}

law pv_tecla_tag:
  {V.tagOf(P.kbdNode("⏎")) == "kbd" : String}

law pv_dica:
  {attrOf(P.hintNode("mp-foot", "dica"), "class") == Some{"mp-foot"} : Maybe<&2, String>}

law pv_dica_texto:
  {V.textOf(at(V.kidsOf(P.hintNode("mp-foot", "dica")), 0n)) == "dica" : String}

law pv_vazio:
  {attrOf(P.emptyNode("mp-empty", "nada"), "class") == Some{"mp-empty"} : Maybe<&2, String>}

law pv_backdrop:
  {attrOf(P.backdropNode("palette-backdrop", "dim", P.modelPopView()), "class") == Some{"palette-backdrop"} : Maybe<&2, String>}

law pv_backdrop_escondido:
  {attrOf(P.backdropNode("palette-backdrop", "dim", P.modelPopView()), "hidden") == Some{""} : Maybe<&2, String>}

law pv_backdrop_evento:
  {attrOf(P.backdropNode("palette-backdrop", "dim", P.modelPopView()), "on:mousedown") == Some{"dim"} : Maybe<&2, String>}

law pv_backdrop_painel:
  {attrOf(at(V.kidsOf(P.backdropNode("palette-backdrop", "dim", P.modelPopView())), 0n), "id") == Some{"model-picker"} : Maybe<&2, String>}

law pv_painel:
  {attrOf(P.panelNode("ctx-pop", "ctx-pop", [V.attr("role", "dialog")], True{}, Nil{}), "role") == Some{"dialog"} : Maybe<&2, String>}

law pv_icone_slot_cru:
  {attrOf(P.iconNode("star"), "class") == Some{"icon-slot"} : Maybe<&2, String>}

law pv_chip_sem_keydown:
  {attrOf(P.modelChipView("Pi", "Pi", False{}, False{}), "on:keydown") == None{} : Maybe<&2, String>}

law pv_chip_esforco_keydown:
  {attrOf(P.effortChipView("Baixo", "Baixo", False{}, False{}), "on:keydown") == Some{"key"} : Maybe<&2, String>}

law pv_casca_keydown:
  {attrOf(P.modelPopView(), "on:keydown") == Some{"key"} : Maybe<&2, String>}

law pv_menu_keydown:
  {attrOf(P.effortMenuView(), "on:keydown") == Some{"key"} : Maybe<&2, String>}

law pv_chip_clique:
  {attrOf(P.modelChipView("Pi", "Pi", False{}, False{}), "on:click") == Some{"toggle"} : Maybe<&2, String>}

law pv_chip_esforco_clique:
  {attrOf(P.effortChipView("Baixo", "Baixo", False{}, False{}), "on:click") == Some{"toggle"} : Maybe<&2, String>}

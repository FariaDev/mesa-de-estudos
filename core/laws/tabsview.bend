import Base
import ../tabsview.bend as T
import ../view.bend as V

# ---------------------------------------------------------------------------
# Contrato das abas de matéria e dos menus da Mesa. Prefixo `tabs_`.
#
# O host monta os fatos (id/rótulo das matérias, flags do `desk`, tema) e o
# núcleo devolve a árvore; as leis fixam a forma que o smoke do app exercita:
#   - uma aba por matéria + separador + aba GeoGebra, na ordem;
#   - matéria ativa com `.active`/`aria-selected` (e nada ativo com o GeoGebra
#     ligado); `disabled` só com o fato True; roving tabindex (ativa `0`,
#     demais `-1`) para as setas do host;
#   - menu Estudar: `#reference-toggle` (rótulo = toggle do 2º painel, vazio
#     cai em "Formulário"; some com 1 painel) e `#xournal` (some com a flag
#     desligada ou no Windows sem caminho);
#   - menu Mesa: ajuda, configurações, tema e sobre, com o rótulo do tema
#     derivado de "auto"/"light"/"dark" (desconhecido cai em auto).
#
# `for` com `+` onde o termo usa o binder mais de uma vez. O que não saiu:
# igualdade genérica de listas com String livre (`String.eq` é valor
# computado); os cenários concretos fecham por computação.
# ---------------------------------------------------------------------------

# ---------- vocabulário auxiliar (só para falar do núcleo) ----------

def doisPaineis() -> T.MenuFacts:
  T.MenuFacts{True{}, "Formulário", True{}, True{}, False{}, False{}, "auto"}

def temaEscuro() -> T.MenuFacts:
  T.MenuFacts{True{}, "Formulário", True{}, True{}, False{}, False{}, "dark"}

# ---------- abas: forma e ordem ----------

# Uma aba por matéria, mais o separador e a aba GeoGebra.
law tabs_comprimento:
  for +cs: List<&2, T.Tab>
  for activeId: String
  for ggb: Bool
  for dis: Bool
  {List.length(&2, V.ViewNode, T.courseTabs(cs, activeId, ggb, dis))
    == Nat.add(List.length(&2, T.Tab, cs), 2n) : Nat}

# Ordem: matérias na ordem da lista, separador e GeoGebra no fim; a ativa é a
# primeira (o cenário do smoke com duas matérias).
law tabs_duas_materias_ordem:
  {T.courseTabs([T.Tab{"A", "Matéria A"}, T.Tab{"B", "Matéria B"}], "A", False{}, False{})
    == [ T.tabNode("A", "Matéria A", True{}, False{})
       , T.tabNode("B", "Matéria B", False{}, False{})
       , T.tabSep()
       , T.ggbTab(False{}, False{})
       ] : List<&2, V.ViewNode>}

# Sem matérias sobra o separador e a aba GeoGebra.
law tabs_sem_materias:
  {T.courseTabs(Nil{}, "A", False{}, False{})
    == [T.tabSep(), T.ggbTab(False{}, False{})] : List<&2, V.ViewNode>}

# ---------- abas: matéria ativa ----------

law tabs_ativa:
  {T.tabActive("A", "A", False{}) == True{} : Bool}

law tabs_outra_inativa:
  {T.tabActive("B", "A", False{}) == False{} : Bool}

# Roving tabindex do tablist: só a ativa é tabulável; as setas do host alcançam
# as demais (o índice -1 tira da ordem de tabulação sem tirar do foco).
law tabs_roving_ativa:
  {T.rovingTabindex(True{}) == "0" : String}

law tabs_roving_inativa:
  {T.rovingTabindex(False{}) == "-1" : String}

law tabs_ativa_tabindex:
  for id: String
  {V.attrGet(V.attrsOf(T.tabNode(id, "Matéria A", True{}, False{})), "tabindex")
    == Some{"0"} : Maybe<&2, String>}

law tabs_inativa_tabindex:
  for id: String
  {V.attrGet(V.attrsOf(T.tabNode(id, "Matéria A", False{}, False{})), "tabindex")
    == Some{"-1"} : Maybe<&2, String>}

# Com o GeoGebra ligado nenhuma matéria fica ativa, mesmo a corrente.
law tabs_ggb_desativa:
  for id: String
  {T.tabActive(id, id, True{}) == False{} : Bool}

law tabs_ativa_aria:
  for id: String
  {V.attrGet(V.attrsOf(T.tabNode(id, "Matéria A", True{}, False{})), "aria-selected")
    == Some{"true"} : Maybe<&2, String>}

law tabs_inativa_aria:
  for id: String
  {V.attrGet(V.attrsOf(T.tabNode(id, "Matéria A", False{}, False{})), "aria-selected")
    == Some{"false"} : Maybe<&2, String>}

law tabs_ativa_classe:
  for id: String
  {V.attrGet(V.attrsOf(T.tabNode(id, "Matéria A", True{}, False{})), "class")
    == Some{"active"} : Maybe<&2, String>}

law tabs_inativa_classe:
  for id: String
  {V.attrGet(V.attrsOf(T.tabNode(id, "Matéria A", False{}, False{})), "class")
    == Some{""} : Maybe<&2, String>}

law tabs_id:
  for id: String
  {V.attrGet(V.attrsOf(T.tabNode(id, "Matéria A", False{}, False{})), "data-id")
    == Some{id} : Maybe<&2, String>}

law tabs_papel:
  for id: String
  {V.attrGet(V.attrsOf(T.tabNode(id, "Matéria A", False{}, False{})), "role")
    == Some{"tab"} : Maybe<&2, String>}

law tabs_tag:
  for id: String
  {V.tagOf(T.tabNode(id, "Matéria A", False{}, False{})) == "button" : String}

law tabs_rotulo:
  for id: String
  for name: String
  {V.kidsOf(T.tabNode(id, name, False{}, False{})) == [V.viewText(name)] : List<&2, V.ViewNode>}

law tabs_clique:
  for id: String
  {V.attrGet(V.attrsOf(T.tabNode(id, "Matéria A", False{}, False{})), "on:click")
    == Some{"SelectCourse"} : Maybe<&2, String>}

# `disabled` só existe quando o fato é True.
law tabs_livre:
  for id: String
  {V.attrGet(V.attrsOf(T.tabNode(id, "Matéria A", False{}, False{})), "disabled")
    == None{} : Maybe<&2, String>}

law tabs_desabilitada:
  for id: String
  {V.attrGet(V.attrsOf(T.tabNode(id, "Matéria A", False{}, True{})), "disabled")
    == Some{""} : Maybe<&2, String>}

# ---------- aba GeoGebra ----------

law tabs_ggb_tag:
  {V.tagOf(T.ggbTab(False{}, False{})) == "button" : String}

law tabs_ggb_id:
  {V.attrGet(V.attrsOf(T.ggbTab(False{}, False{})), "data-id")
    == Some{"geogebra"} : Maybe<&2, String>}

law tabs_ggb_classe:
  {V.attrGet(V.attrsOf(T.ggbTab(False{}, False{})), "class")
    == Some{"ggb-tab"} : Maybe<&2, String>}

law tabs_ggb_ativa_classe:
  {V.attrGet(V.attrsOf(T.ggbTab(True{}, False{})), "class")
    == Some{"active ggb-tab"} : Maybe<&2, String>}

law tabs_ggb_ativa_aria:
  {V.attrGet(V.attrsOf(T.ggbTab(True{}, False{})), "aria-selected")
    == Some{"true"} : Maybe<&2, String>}

law tabs_ggb_ativa_tabindex:
  {V.attrGet(V.attrsOf(T.ggbTab(True{}, False{})), "tabindex")
    == Some{"0"} : Maybe<&2, String>}

law tabs_ggb_inativa_tabindex:
  {V.attrGet(V.attrsOf(T.ggbTab(False{}, False{})), "tabindex")
    == Some{"-1"} : Maybe<&2, String>}

law tabs_ggb_rotulo:
  {V.kidsOf(T.ggbTab(False{}, False{})) == [V.viewText("GeoGebra")] : List<&2, V.ViewNode>}

law tabs_ggb_clique:
  {V.attrGet(V.attrsOf(T.ggbTab(False{}, False{})), "on:click")
    == Some{"OpenGeoGebra"} : Maybe<&2, String>}

# ---------- separador e botão "+" ----------

law tabs_sep:
  {V.tagOf(T.tabSep()) == "span" : String}

law tabs_sep_classe:
  {V.attrGet(V.attrsOf(T.tabSep()), "class") == Some{"tab-sep"} : Maybe<&2, String>}

law tabs_nova_id:
  {V.attrGet(V.attrsOf(T.newTab()), "id") == Some{"new-tab"} : Maybe<&2, String>}

law tabs_nova_rotulo:
  {V.kidsOf(T.newTab()) == [V.viewText("+")] : List<&2, V.ViewNode>}

law tabs_nova_acessivel:
  {V.attrGet(V.attrsOf(T.newTab()), "aria-label")
    == Some{"Nova matéria (abre as Configurações)"} : Maybe<&2, String>}

law tabs_nova_clique:
  {V.attrGet(V.attrsOf(T.newTab()), "on:click") == Some{"NewCourse"} : Maybe<&2, String>}

# ---------- menu Estudar ----------

law tabs_menu_estudar:
  {T.studyItems(doisPaineis())
    == [ T.refToggleItem(True{}, "Formulário", True{})
       , T.xournalItem(True{}, False{}, False{})
       ] : List<&2, V.ViewNode>}

law tabs_ref_rotulo_vazio:
  {T.refToggleLabel("") == "Formulário" : String}

law tabs_ref_rotulo_toggle:
  {T.refToggleLabel("Tabela") == "Tabela" : String}

law tabs_ref_id:
  {V.attrGet(V.attrsOf(T.refToggleItem(True{}, "Formulário", True{})), "id")
    == Some{"reference-toggle"} : Maybe<&2, String>}

# Dois painéis: o item fica visível e ARIA conta se as referências vão ao Pi.
law tabs_ref_visivel:
  {V.attrGet(V.attrsOf(T.refToggleItem(True{}, "Formulário", False{})), "hidden")
    == None{} : Maybe<&2, String>}

law tabs_ref_aria:
  {V.attrGet(V.attrsOf(T.refToggleItem(True{}, "Formulário", True{})), "aria-pressed")
    == Some{"true"} : Maybe<&2, String>}

# Um painel só: o item some (como o `applyDesk` do app).
law tabs_ref_um_painel:
  {V.attrGet(V.attrsOf(T.refToggleItem(False{}, "Formulário", True{})), "hidden")
    == Some{""} : Maybe<&2, String>}

law tabs_xournal_flag_desligada:
  for win32: Bool
  for has: Bool
  {T.xournalHidden(False{}, win32, has) == True{} : Bool}

law tabs_xournal_win_sem_caminho:
  {T.xournalHidden(True{}, True{}, False{}) == True{} : Bool}

law tabs_xournal_win_com_caminho:
  {T.xournalHidden(True{}, True{}, True{}) == False{} : Bool}

law tabs_xournal_mac:
  for has: Bool
  {T.xournalHidden(True{}, False{}, has) == False{} : Bool}

law tabs_xournal_item_oculto:
  {V.attrGet(V.attrsOf(T.xournalItem(False{}, False{}, False{})), "hidden")
    == Some{""} : Maybe<&2, String>}

law tabs_xournal_item_visivel:
  {V.attrGet(V.attrsOf(T.xournalItem(True{}, False{}, False{})), "hidden")
    == None{} : Maybe<&2, String>}

law tabs_xournal_rotulo:
  {V.kidsOf(T.xournalItem(True{}, False{}, False{}))
    == [V.viewText("Xournal++")] : List<&2, V.ViewNode>}

# ---------- menu Mesa ----------

law tabs_menu_mesa:
  {T.mesaItems(temaEscuro())
    == [T.helpItem(), T.settingsItem(), T.themeItem("dark"), T.aboutItem()]
    : List<&2, V.ViewNode>}

law tabs_tema_auto:
  {T.themeLabel("auto") == "Tema: auto" : String}

law tabs_tema_claro:
  {T.themeLabel("light") == "Tema: claro" : String}

law tabs_tema_escuro:
  {T.themeLabel("dark") == "Tema: escuro" : String}

law tabs_tema_desconhecido:
  {T.themeLabel("rouge") == "Tema: auto" : String}

law tabs_ajuda_id:
  {V.attrGet(V.attrsOf(T.helpItem()), "id") == Some{"help"} : Maybe<&2, String>}

law tabs_config_id:
  {V.attrGet(V.attrsOf(T.settingsItem()), "id") == Some{"settings"} : Maybe<&2, String>}

law tabs_tema_id:
  {V.attrGet(V.attrsOf(T.themeItem("auto")), "id") == Some{"theme-cycle"} : Maybe<&2, String>}

law tabs_sobre_id:
  {V.attrGet(V.attrsOf(T.aboutItem()), "id") == Some{"about"} : Maybe<&2, String>}

law tabs_ajuda_rotulo:
  {V.kidsOf(T.helpItem()) == [V.viewText("Como usar")] : List<&2, V.ViewNode>}

law tabs_config_rotulo:
  {V.kidsOf(T.settingsItem()) == [V.viewText("Configurações")] : List<&2, V.ViewNode>}

law tabs_sobre_rotulo:
  {V.kidsOf(T.aboutItem()) == [V.viewText("Sobre")] : List<&2, V.ViewNode>}

law tabs_item_papel:
  {V.attrGet(V.attrsOf(T.helpItem()), "role") == Some{"menuitem"} : Maybe<&2, String>}

# ---------- andaime dos ícones (o host injeta o SVG e limpa os data-*) ----------

law tabs_icone_ajuda:
  {V.attrGet(V.attrsOf(T.helpItem()), "data-icon") == Some{"help"} : Maybe<&2, String>}

law tabs_icone_xournal:
  {V.attrGet(V.attrsOf(T.xournalItem(True{}, False{}, False{})), "data-icon")
    == Some{"external"} : Maybe<&2, String>}

# A aba GeoGebra usa o glifo `graph` (eixos + parábola — o autor escolheu no
# lugar do `shapes`); o SVG é do desk/icons.mjs.
law tabs_icone_ggb:
  {V.attrGet(V.attrsOf(T.ggbTab(False{}, False{})), "data-icon")
    == Some{"graph"} : Maybe<&2, String>}

# O tema tem andaime de ícone desde que o autor pediu (a lei era "texto puro"):
# o glifo acompanha o estado — auto = contraste, claro = sol, escuro = lua.
law tabs_icone_tema_auto:
  {V.attrGet(V.attrsOf(T.themeItem("auto")), "data-icon") == Some{"contrast"} : Maybe<&2, String>}

law tabs_icone_tema_claro:
  {V.attrGet(V.attrsOf(T.themeItem("light")), "data-icon") == Some{"sun"} : Maybe<&2, String>}

law tabs_icone_tema_escuro:
  {V.attrGet(V.attrsOf(T.themeItem("dark")), "data-icon") == Some{"moon"} : Maybe<&2, String>}

# O rótulo do tema é texto direto, não `<span>` de ícone.
law tabs_tema_rotulo_no:
  {V.kidsOf(T.themeItem("light")) == [V.viewText("Tema: claro")] : List<&2, V.ViewNode>}

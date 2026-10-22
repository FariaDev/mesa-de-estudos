import Base
import ../msg.bend as M
import ../tabsview.bend as T
import ../studytoolsview.bend as ST
import ../view.bend as V

# ---------------------------------------------------------------------------
# Contrato das abas de matéria e dos menus da barra superior. Prefixo `tabs_`.
#
# O host monta os fatos (id/rótulo das matérias, contagem do Caderno, flags do
# `desk`) e o núcleo devolve a árvore; as leis fixam a forma que o smoke do app
# exercita:
#   - uma aba por matéria + "+" + separador + Caderno + aba GeoGebra, na ordem;
#   - matéria ativa com `.active`/`aria-selected` (e nada ativo com o GeoGebra
#     ligado); `disabled` só com o fato True; roving tabindex (ativa `0`,
#     demais `-1`) para as setas do host;
#   - Caderno: `#review-tab` com a contagem de revisar hoje, `.has-items` só
#     quando há algo, ativo com o id `review`;
#   - menu Estudar: as sete ferramentas de `core/studytoolsview.bend`, depois
#     `#xournal` e `#reference-toggle` (cada um some pela sua flag; o
#     Encerrar por hoje mora em Mais opções do tutor, `core/tutorheader.bend`);
#   - menu Ajustes: Configurações, Ajuda, Atalhos e Sobre;
#   - seletor da janela estreita: uma opção por matéria, a ativa com o check.
#
# `for` com `+` onde o termo usa o binder mais de uma vez. O que não saiu:
# igualdade genérica de listas com String livre (`String.eq` é valor
# computado); os cenários concretos fecham por computação.
# ---------------------------------------------------------------------------

# ---------- vocabulário auxiliar (só para falar do núcleo) ----------

def doisPaineis() -> T.MenuFacts:
  T.MenuFacts{True{}, "Formulário", True{}, True{}, False{}, False{}}

# Tudo que o `config.json` pode desligar, desligado.
def desligado() -> T.MenuFacts:
  T.MenuFacts{False{}, "", False{}, False{}, False{}, False{}}

# ---------- abas: forma e ordem ----------

# Uma aba por matéria, mais o "+", o separador, o Caderno e a aba GeoGebra.
law tabs_comprimento:
  for +cs: List<&2, T.Tab>
  for activeId: String
  for ggb: Bool
  for dis: Bool
  for rc: String
  {List.length(&2, V.ViewNode, T.courseTabs(cs, activeId, ggb, dis, rc))
    == Nat.add(List.length(&2, T.Tab, cs), 4n) : Nat}

# Ordem: matérias na ordem da lista, "+", separador, Caderno e GeoGebra no fim;
# a ativa é a primeira (o cenário do smoke com duas matérias).
law tabs_duas_materias_ordem:
  {T.courseTabs([T.Tab{"A", "Matéria A"}, T.Tab{"B", "Matéria B"}], "A", False{}, False{}, "0")
    == [ T.tabNode("A", "Matéria A", True{}, False{})
       , T.tabNode("B", "Matéria B", False{}, False{})
       , T.newTab()
       , T.tabSep()
       , T.reviewTab("0", False{})
       , T.ggbTab(False{}, False{})
       ] : List<&2, V.ViewNode>}

# Sem matérias sobram o "+", o separador, o Caderno e a aba GeoGebra.
law tabs_sem_materias:
  {T.courseTabs(Nil{}, "A", False{}, False{}, "0")
    == [T.newTab(), T.tabSep(), T.reviewTab("0", False{}), T.ggbTab(False{}, False{})] : List<&2, V.ViewNode>}

# Com o Caderno aberto (`review` ativo) ele é a aba ativa e nenhuma matéria é.
law tabs_caderno_ativo:
  {T.courseTabs([T.Tab{"A", "Matéria A"}], "review", False{}, False{}, "3")
    == [ T.tabNode("A", "Matéria A", False{}, False{})
       , T.newTab()
       , T.tabSep()
       , T.reviewTab("3", True{})
       , T.ggbTab(False{}, False{})
       ] : List<&2, V.ViewNode>}

# Com o GeoGebra ligado nem o Caderno fica ativo.
law tabs_ggb_desativa_caderno:
  {T.courseTabs(Nil{}, "review", True{}, False{}, "0")
    == [T.newTab(), T.tabSep(), T.reviewTab("0", False{}), T.ggbTab(True{}, False{})] : List<&2, V.ViewNode>}

# Desabilitar (conexão/troca) vale para as matérias e o GeoGebra, não para o "+"
# nem para o Caderno (abre sem tocar na sessão).
law tabs_desabilitadas_juntas:
  {T.courseTabs([T.Tab{"A", "Matéria A"}], "A", False{}, True{}, "0")
    == [ T.tabNode("A", "Matéria A", True{}, True{})
       , T.newTab()
       , T.tabSep()
       , T.reviewTab("0", False{})
       , T.ggbTab(False{}, True{})
       ] : List<&2, V.ViewNode>}

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

# Travada durante a resposta (#42), a aba diz por quê; livre, não há dica.
law tabs_travada_dica:
  for id: String
  {V.attrGet(V.attrsOf(T.tabNode(id, "Matéria A", False{}, True{})), "title")
    == Some{M.msg("tabs.locked")} : Maybe<&2, String>}

law tabs_livre_sem_dica:
  for id: String
  {V.attrGet(V.attrsOf(T.tabNode(id, "Matéria A", False{}, False{})), "title")
    == None{} : Maybe<&2, String>}

# O seletor da janela estreita trava junto e com a mesma dica.
law tabs_seletor_travado_dica:
  {V.attrGet(V.attrsOf(T.courseOption("A", "Matéria A", "A", False{}, True{})), "title")
    == Some{M.msg("tabs.locked")} : Maybe<&2, String>}

# A matéria atual não trava (#42): do Caderno aberto durante a resposta dá
# para voltar a ela; as outras travam com a dica.
law tabs_atual_livre_na_resposta:
  {T.courseTabsAt([T.Tab{"A", "Matéria A"}, T.Tab{"B", "Matéria B"}], "review", "A", False{}, True{}, "0")
    == [ T.tabNode("A", "Matéria A", False{}, False{})
       , T.tabNode("B", "Matéria B", False{}, True{})
       , T.newTab()
       , T.tabSep()
       , T.reviewTab("0", True{})
       , T.ggbTab(False{}, True{})
       ] : List<&2, V.ViewNode>}

# Livre (sem resposta), nada trava, nem a atual nem as outras.
law tabs_at_livre:
  {T.courseTabsAt([T.Tab{"A", "Matéria A"}, T.Tab{"B", "Matéria B"}], "A", "A", False{}, False{}, "0")
    == T.courseTabs([T.Tab{"A", "Matéria A"}, T.Tab{"B", "Matéria B"}], "A", False{}, False{}, "0") : List<&2, V.ViewNode>}

# Sem matéria atual conhecida, todas travam juntas (o `courseTabs` de sempre).
law tabs_at_sem_atual:
  {T.courseTabsAt([T.Tab{"A", "Matéria A"}], "A", "", False{}, True{}, "0")
    == T.courseTabs([T.Tab{"A", "Matéria A"}], "A", False{}, True{}, "0") : List<&2, V.ViewNode>}

law tabs_travada_so_outras:
  for locked: Bool
  {T.tabLocked("A", "A", locked) == False{} : Bool}

law tabs_seletor_atual_livre:
  {T.courseMenuItemsAt([T.Tab{"A", "Matéria A"}, T.Tab{"B", "Matéria B"}], "review", "A", False{}, True{})
    == [T.courseOption("A", "Matéria A", "review", False{}, False{}), T.courseOption("B", "Matéria B", "review", False{}, True{})] : List<&2, V.ViewNode>}

law tabs_seletor_travado:
  {V.attrGet(V.attrsOf(T.courseOption("A", "Matéria A", "A", False{}, True{})), "disabled")
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
    == Some{M.msg("tabs.newCourse")} : Maybe<&2, String>}

law tabs_nova_clique:
  {V.attrGet(V.attrsOf(T.newTab()), "on:click") == Some{"NewCourse"} : Maybe<&2, String>}

# ---------- menu Estudar ----------

# Sete ferramentas, Xournal++ e toggle do 2º painel, nessa ordem.
law tabs_menu_estudar:
  {T.studyItems(doisPaineis())
    == List.append(
         &2,
         V.ViewNode,
         ST.tools(),
         [ T.xournalItem(True{}, False{}, False{})
         , T.refToggleItem(True{}, "Formulário", True{})
         ]
       ) : List<&2, V.ViewNode>}

law tabs_menu_estudar_comprimento:
  {List.length(&2, V.ViewNode, T.studyItems(doisPaineis())) == 9n : Nat}

# Com tudo desligado os itens continuam na árvore, mas `hidden` (o host só
# aplica; a flag do `config.json` é o único motivo para sumir).
law tabs_menu_estudar_desligado:
  {T.studyItems(desligado())
    == List.append(
         &2,
         V.ViewNode,
         ST.tools(),
         [ T.xournalItem(False{}, False{}, False{})
         , T.refToggleItem(False{}, "", False{})
         ]
       ) : List<&2, V.ViewNode>}

law tabs_ref_rotulo_vazio:
  {T.refToggleLabel("") == M.msg("tabs.referenceToggle") : String}

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

# ---------- Caderno (aba com a contagem de revisar hoje) ----------

law tabs_caderno_id:
  {V.attrGet(V.attrsOf(T.reviewTab("0", False{})), "id") == Some{"review-tab"} : Maybe<&2, String>}

law tabs_caderno_data_id:
  {V.attrGet(V.attrsOf(T.reviewTab("0", False{})), "data-id") == Some{"review"} : Maybe<&2, String>}

law tabs_caderno_papel:
  {V.attrGet(V.attrsOf(T.reviewTab("0", False{})), "role") == Some{"tab"} : Maybe<&2, String>}

law tabs_caderno_clique:
  {V.attrGet(V.attrsOf(T.reviewTab("0", False{})), "on:click")
    == Some{"OpenReview"} : Maybe<&2, String>}

# O rótulo é "Caderno", um espaço e o contador (`#review-count`) que o host atualiza.
law tabs_caderno_rotulo:
  {V.kidsOf(T.reviewTab("3", False{}))
    == [ V.viewText(M.msg("tabs.review"))
       , V.viewText(" ")
       , V.viewEl("span", [V.attrId("review-count")], [V.viewText("3")])
       ] : List<&2, V.ViewNode>}

law tabs_caderno_ativo_aria:
  {V.attrGet(V.attrsOf(T.reviewTab("0", True{})), "aria-selected")
    == Some{"true"} : Maybe<&2, String>}

law tabs_caderno_inativo_aria:
  {V.attrGet(V.attrsOf(T.reviewTab("0", False{})), "aria-selected")
    == Some{"false"} : Maybe<&2, String>}

law tabs_caderno_ativo_tabindex:
  {V.attrGet(V.attrsOf(T.reviewTab("0", True{})), "tabindex") == Some{"0"} : Maybe<&2, String>}

law tabs_caderno_inativo_tabindex:
  {V.attrGet(V.attrsOf(T.reviewTab("0", False{})), "tabindex") == Some{"-1"} : Maybe<&2, String>}

# `.has-items` só quando há algo para revisar hoje.
law tabs_caderno_vazio_classe:
  {V.attrGet(V.attrsOf(T.reviewTab("0", False{})), "class") == Some{""} : Maybe<&2, String>}

law tabs_caderno_com_itens_classe:
  {V.attrGet(V.attrsOf(T.reviewTab("3", False{})), "class")
    == Some{"has-items"} : Maybe<&2, String>}

law tabs_caderno_ativo_com_itens_classe:
  {V.attrGet(V.attrsOf(T.reviewTab("3", True{})), "class")
    == Some{"active has-items"} : Maybe<&2, String>}

law tabs_caderno_titulo_vazio:
  {T.reviewTitle("0") == M.msg("tabs.review.title.none") : String}

law tabs_caderno_titulo_um:
  {T.reviewTitle("1") == M.msg1("tabs.review.title", "count", "1") : String}

law tabs_caderno_titulo_varios:
  {T.reviewTitle("3") == M.msg1("tabs.review.title", "count", "3") : String}

law tabs_caderno_titulo_attr:
  {V.attrGet(V.attrsOf(T.reviewTab("3", False{})), "title")
    == Some{M.msg1("tabs.review.title", "count", "3")} : Maybe<&2, String>}

law tabs_caderno_aria_label:
  {V.attrGet(V.attrsOf(T.reviewTab("3", False{})), "aria-label")
    == Some{M.msg1("tabs.review.title", "count", "3")} : Maybe<&2, String>}

# ---------- menu Ajustes (no lugar do antigo menu Mesa) ----------

law tabs_menu_ajustes:
  {T.settingsItems()
    == [T.settingsItem(), T.helpItem(), T.shortcutsItem(), T.aboutItem()] : List<&2, V.ViewNode>}

law tabs_menu_ajustes_comprimento:
  {List.length(&2, V.ViewNode, T.settingsItems()) == 4n : Nat}

law tabs_atalhos_id:
  {V.attrGet(V.attrsOf(T.shortcutsItem()), "id") == Some{"shortcuts"} : Maybe<&2, String>}

law tabs_atalhos_rotulo:
  {V.kidsOf(T.shortcutsItem()) == [V.viewText(M.msg("menu.shortcuts"))] : List<&2, V.ViewNode>}

law tabs_atalhos_clique:
  {V.attrGet(V.attrsOf(T.shortcutsItem()), "on:click")
    == Some{"OpenShortcuts"} : Maybe<&2, String>}

law tabs_atalhos_icone:
  {V.attrGet(V.attrsOf(T.shortcutsItem()), "data-icon")
    == Some{"keyboard"} : Maybe<&2, String>}

law tabs_ajuda_id:
  {V.attrGet(V.attrsOf(T.helpItem()), "id") == Some{"help"} : Maybe<&2, String>}

law tabs_config_id:
  {V.attrGet(V.attrsOf(T.settingsItem()), "id") == Some{"settings"} : Maybe<&2, String>}

law tabs_sobre_id:
  {V.attrGet(V.attrsOf(T.aboutItem()), "id") == Some{"about"} : Maybe<&2, String>}

law tabs_ajuda_rotulo:
  {V.kidsOf(T.helpItem()) == [V.viewText(M.msg("menu.help"))] : List<&2, V.ViewNode>}

law tabs_config_rotulo:
  {V.kidsOf(T.settingsItem()) == [V.viewText(M.msg("menu.settings"))] : List<&2, V.ViewNode>}

law tabs_sobre_rotulo:
  {V.kidsOf(T.aboutItem()) == [V.viewText(M.msg("menu.about"))] : List<&2, V.ViewNode>}

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

# ---------- seletor único (janela estreita) ----------

law tabs_seletor_ordem:
  {T.courseMenuItems([T.Tab{"A", "Matéria A"}, T.Tab{"B", "Matéria B"}], "A", False{}, False{})
    == [ T.courseOption("A", "Matéria A", "A", False{}, False{})
       , T.courseOption("B", "Matéria B", "A", False{}, False{})
       ] : List<&2, V.ViewNode>}

law tabs_seletor_vazio:
  {T.courseMenuItems(Nil{}, "A", False{}, False{}) == Nil{} : List<&2, V.ViewNode>}

law tabs_seletor_comprimento:
  for +cs: List<&2, T.Tab>
  for activeId: String
  for ggb: Bool
  for dis: Bool
  {List.length(&2, V.ViewNode, T.courseMenuItems(cs, activeId, ggb, dis))
    == List.length(&2, T.Tab, cs) : Nat}

law tabs_opcao_id:
  {V.attrGet(V.attrsOf(T.courseOption("A", "Matéria A", "A", False{}, False{})), "id")
    == Some{"course-option-A"} : Maybe<&2, String>}

law tabs_opcao_data_id:
  {V.attrGet(V.attrsOf(T.courseOption("A", "Matéria A", "A", False{}, False{})), "data-id")
    == Some{"A"} : Maybe<&2, String>}

law tabs_opcao_papel:
  {V.attrGet(V.attrsOf(T.courseOption("A", "Matéria A", "A", False{}, False{})), "role")
    == Some{"menuitem"} : Maybe<&2, String>}

law tabs_opcao_clique:
  {V.attrGet(V.attrsOf(T.courseOption("A", "Matéria A", "A", False{}, False{})), "on:click")
    == Some{"SelectCourse"} : Maybe<&2, String>}

law tabs_opcao_rotulo:
  {V.kidsOf(T.courseOption("A", "Matéria A", "A", False{}, False{}))
    == [V.viewText("Matéria A")] : List<&2, V.ViewNode>}

# A ativa leva o check; a outra é texto puro (sem andaime de ícone).
law tabs_opcao_ativa_icone:
  {V.attrGet(V.attrsOf(T.courseOption("A", "Matéria A", "A", False{}, False{})), "data-icon")
    == Some{"check"} : Maybe<&2, String>}

law tabs_opcao_inativa_sem_icone:
  {V.attrGet(V.attrsOf(T.courseOption("B", "Matéria B", "A", False{}, False{})), "data-icon")
    == None{} : Maybe<&2, String>}

# Com o GeoGebra ligado nenhuma matéria leva o check (como nas abas).
law tabs_opcao_ggb_sem_icone:
  {V.attrGet(V.attrsOf(T.courseOption("A", "Matéria A", "A", True{}, False{})), "data-icon")
    == None{} : Maybe<&2, String>}

law tabs_opcao_livre:
  {V.attrGet(V.attrsOf(T.courseOption("A", "Matéria A", "A", False{}, False{})), "disabled")
    == None{} : Maybe<&2, String>}

law tabs_opcao_desabilitada:
  {V.attrGet(V.attrsOf(T.courseOption("A", "Matéria A", "A", False{}, True{})), "disabled")
    == Some{""} : Maybe<&2, String>}

import Base
import ../chatlist.bend as C
import ../view.bend as V

# ---------------------------------------------------------------------------
# Contrato da view da lista de conversas. Prefixo `chatlist_`.
#
# Join/when/fatos Bool reduzem em geral. Lookup de attr e classes-on com
# nome livre não: essas leis são cenários concretos (os que o host monta).
# Nada de Date/rótulo de sessão aqui — isso é `sessions.bend`.
# ---------------------------------------------------------------------------

# ---------- vazio / busca ----------

law chatlist_vazio_sem_busca:
  {C.listView(C.ChatList{Nil{}, Nil{}, False{}, False{}, ""}) == Con{C.emptyView(False{}, ""), Nil{}} : List<&2, V.ViewNode>}

law chatlist_vazio_com_busca:
  {C.listView(C.ChatList{Nil{}, Nil{}, False{}, True{}, "foo"}) == Con{C.emptyView(True{}, "foo"), Con{C.deepSearchView("foo"), Nil{}}} : List<&2, V.ViewNode>}

law chatlist_empty_idle:
  {C.emptyView(False{}, "") == V.viewEl("div", [V.attrClass("chat-empty"), V.attr("role", "status")], [V.viewText(C.idleEmptyMsg())]) : V.ViewNode}

law chatlist_noneYet_vazio:
  {C.noneYet(True{}, True{}) == True{} : Bool}

law chatlist_noneYet_grupo:
  {C.noneYet(False{}, True{}) == False{} : Bool}

law chatlist_noneYet_arquivo:
  {C.noneYet(True{}, False{}) == False{} : Bool}

# Com um grupo não sai o estado vazio (só a seção). Com busca, seção + deep.
law chatlist_um_grupo:
  {List.length(&2, V.ViewNode, C.listView(C.ChatList{Con{C.sampleGroup(), Nil{}}, Nil{}, False{}, False{}, ""})) == 1n : Nat}

law chatlist_grupo_e_busca:
  {List.length(&2, V.ViewNode, C.listView(C.ChatList{Con{C.sampleGroup(), Nil{}}, Nil{}, False{}, True{}, "x"})) == 2n : Nat}

# ---------- linha: classes, path, aria, handler ----------

law chatlist_row_class_inativo:
  {V.attrGet(V.attrsOf(C.rowView(C.sampleRow(False{}, False{}, False{}, False{}))), "class") == Some{"chat-item"} : Maybe<&2, String>}

law chatlist_row_class_ativo:
  {V.attrGet(V.attrsOf(C.rowView(C.sampleRow(True{}, False{}, False{}, False{}))), "class") == Some{"chat-item active"} : Maybe<&2, String>}

law chatlist_row_class_fixado:
  {V.attrGet(V.attrsOf(C.rowView(C.sampleRow(False{}, True{}, False{}, False{}))), "class") == Some{"chat-item pinned"} : Maybe<&2, String>}

law chatlist_row_class_arquivo:
  {V.attrGet(V.attrsOf(C.rowView(C.sampleRow(False{}, False{}, True{}, False{}))), "class") == Some{"chat-item archived"} : Maybe<&2, String>}

law chatlist_row_class_rascunho:
  {V.attrGet(V.attrsOf(C.rowView(C.sampleRow(False{}, False{}, False{}, True{}))), "class") == Some{"chat-item has-draft"} : Maybe<&2, String>}

law chatlist_row_path:
  {V.attrGet(V.attrsOf(C.rowView(C.sampleRow(False{}, False{}, False{}, False{}))), "data-path") == Some{"/p"} : Maybe<&2, String>}

law chatlist_row_key:
  {V.attrGet(V.attrsOf(C.rowView(C.sampleRow(False{}, False{}, False{}, False{}))), "key") == Some{"/p"} : Maybe<&2, String>}

law chatlist_row_abre:
  {V.attrGet(V.attrsOf(C.rowView(C.sampleRow(False{}, False{}, False{}, False{}))), "on:click") == Some{"openRow"} : Maybe<&2, String>}

law chatlist_row_aria_ativo:
  {V.attrGet(V.attrsOf(C.rowView(C.sampleRow(True{}, False{}, False{}, False{}))), "aria-current") == Some{"true"} : Maybe<&2, String>}

law chatlist_row_aria_inativo:
  {V.attrGet(V.attrsOf(C.rowView(C.sampleRow(False{}, False{}, False{}, False{}))), "aria-current") == None{} : Maybe<&2, String>}

# ---------- arquivadas: hidden só quando fechadas ----------

law chatlist_archived_fechado:
  {V.attrGet(V.attrsOf(C.archivedList(False{}, Nil{})), "hidden") == Some{"true"} : Maybe<&2, String>}

law chatlist_archived_aberto:
  {V.attrGet(V.attrsOf(C.archivedList(True{}, Nil{})), "hidden") == None{} : Maybe<&2, String>}

law chatlist_archived_id:
  {V.attrGet(V.attrsOf(C.archivedList(False{}, Nil{})), "id") == Some{"archived-list"} : Maybe<&2, String>}

# ---------- cópia ----------

law chatlist_pin_solto:
  {C.pinTitle(False{}) == "Fixar" : String}

law chatlist_pin_preso:
  {C.pinTitle(True{}) == "Desafixar" : String}

law chatlist_extra_vazio:
  {C.extraParts(False{}, False{}, False{}) == "" : String}

law chatlist_extra_marcas:
  {C.extraParts(True{}, True{}, True{}) == "fixada, arquivada, rascunho não enviado" : String}

# ---------- ícones: a view decide o desenho, o host injeta o SVG ----------

law chatlist_row_icone_fixado:
  {V.attrGet(V.attrsOf(C.rowIcon(True{})), "data-icon") == Some{"pin"} : Maybe<&2, String>}

law chatlist_row_icone_solto:
  {V.attrGet(V.attrsOf(C.rowIcon(False{})), "data-icon") == Some{"message"} : Maybe<&2, String>}

law chatlist_pin_icone:
  {V.attrGet(V.attrsOf(C.pinBtn(False{})), "data-icon") == Some{"pin"} : Maybe<&2, String>}

law chatlist_mais_icone:
  {V.attrGet(V.attrsOf(C.moreBtn()), "data-icon") == Some{"more"} : Maybe<&2, String>}

law chatlist_arquivadas_icone:
  {V.attrGet(V.attrsOf(C.archivedHead(False{}, "1")), "data-icon") == Some{"chevronRight"} : Maybe<&2, String>}

# ---------- menu de operações ----------

law chatlist_menu_classe:
  {V.attrGet(V.attrsOf(C.menuView(C.sampleOps(False{}))), "class") == Some{"ops-menu"} : Maybe<&2, String>}

law chatlist_menu_papel:
  {V.attrGet(V.attrsOf(C.menuView(C.sampleOps(False{}))), "role") == Some{"menu"} : Maybe<&2, String>}

law chatlist_menu_teclado:
  {V.attrGet(V.attrsOf(C.menuView(C.sampleOps(False{}))), "on:keydown") == Some{"menuKey"} : Maybe<&2, String>}

law chatlist_menu_tres_itens:
  {List.length(&2, V.ViewNode, C.menuKids(C.sampleOps(False{}))) == 3n : Nat}

law chatlist_menu_itens_ordem:
  {V.kidsOf(C.menuView(C.sampleOps(False{}))) == C.menuKids(C.sampleOps(False{})) : List<&2, V.ViewNode>}

law chatlist_menu_item_key:
  {V.attrGet(V.attrsOf(C.menuItem("Renomear", "ops-rename", "menuRename")), "key") == Some{"ops-rename"} : Maybe<&2, String>}

law chatlist_menu_item_acao:
  {V.attrGet(V.attrsOf(C.menuItem("Renomear", "ops-rename", "menuRename")), "on:click") == Some{"menuRename"} : Maybe<&2, String>}

law chatlist_menu_renomear:
  {C.renameTitle() == "Renomear" : String}

law chatlist_menu_arquivar:
  {C.archiveTitle(False{}) == "Arquivar" : String}

law chatlist_menu_desarquivar:
  {C.archiveTitle(True{}) == "Desarquivar" : String}

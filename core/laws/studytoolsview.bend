import Base
import ../msg.bend as M
import ../studytoolsview.bend as T
import ../view.bend as V

# Sete ferramentas no menu Estudar, na ordem que o usuário as encontra.
law tools_all_visible:
  {List.length(&2, V.ViewNode, T.tools()) == 7n : Nat}

law tools_do_not_submit:
  {V.attrGet(V.attrsOf(T.action("id", "texto", "search", "Open")), "type") == Some{"button"} : Maybe<&2, String>}

law tools_open_dialog:
  {V.attrGet(V.attrsOf(T.action("id", "texto", "search", "Open")), "aria-haspopup") == Some{"dialog"} : Maybe<&2, String>}

law tools_preserve_label:
  {V.kidsOf(T.action("id", M.msg("study.search"), "search", "Open")) == [V.viewText(M.msg("study.search"))] : List<&2, V.ViewNode>}

# Cada ferramenta é um item de menu, com o glifo do host em `data-icon`.
law tools_menu_item_role:
  {V.attrGet(V.attrsOf(T.action("id", "texto", "search", "Open")), "role") == Some{"menuitem"} : Maybe<&2, String>}

law tools_icon_scaffold:
  {V.attrGet(V.attrsOf(T.action("id", "texto", "search", "Open")), "data-icon") == Some{"search"} : Maybe<&2, String>}

law tools_click_handler:
  {V.attrGet(V.attrsOf(T.action("id", "texto", "search", "OpenStudySearch")), "on:click")
    == Some{"OpenStudySearch"} : Maybe<&2, String>}

# #27 B8: a busca de estudos mostra a tecla dela no fim da linha, sem mudar o
# nome, o handler nem o papel do item.
law tools_search_shows_shortcut:
  {V.kidsOf(T.actionKbd("id", M.msg("study.search"), "search", "Open", "study-search"))
    == [ V.viewText(M.msg("study.search"))
       , V.viewEl("span", [
           V.attrClass("menu-kbd"), V.attrData("shortcut", "study-search"), V.attrAria("hidden", "true")
         ], Nil{})
       ] : List<&2, V.ViewNode>}

law tools_search_keeps_item_shape:
  {V.attrGet(V.attrsOf(T.actionKbd("id", M.msg("study.search"), "search", "OpenStudySearch", "study-search")), "on:click")
    == Some{"OpenStudySearch"} : Maybe<&2, String>}

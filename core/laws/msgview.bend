import Base
import ../msgview.bend as M
import ../view.bend as V

law msg_role_user:
  {M.roleName(M.MsgUser{}) == "user" : String}

law msg_role_assistant:
  {M.roleName(M.MsgAssistant{}) == "assistant" : String}

law msg_collapse_short:
  for expanded: Bool
  {M.collapsed(False{}, expanded) == False{} : Bool}

law msg_collapse_long_closed:
  {M.collapsed(True{}, False{}) == True{} : Bool}

law msg_collapse_long_open:
  {M.collapsed(True{}, True{}) == False{} : Bool}

law msg_action_hidden:
  {M.actionHidden(False{}) == Con{V.ViewAttr{"hidden", ""}, Nil{}} : List<&2, V.ViewAttr>}

law msg_action_visible:
  {M.actionHidden(True{}) == Nil{} : List<&2, V.ViewAttr>}

# Identidade de foco dos botões da bolha (o host repinta a bolha inteira com
# `preserveFocus`; sem `key` o foco cairia para o body no "Mostrar tudo").
law msg_copy_key:
  {V.attrGet(V.attrsOf(M.copyButton()), "key") == Some{"msg-copy"} : Maybe<&2, String>}

law msg_action_key:
  {V.attrGet(V.attrsOf(M.actionButton("msg-edit", "Editar", "edit", True{})), "key") == Some{"msg-edit"} : Maybe<&2, String>}

law msg_more_key:
  {V.attrGet(V.attrsOf(M.moreView(False{})), "key") == Some{"msg-more"} : Maybe<&2, String>}

law msg_day_tag:
  for label: String
  {V.tagOf(M.daySepView(label)) == "div" : String}

law msg_day_class:
  {V.attrGet(V.attrsOf(M.daySepView("Hoje")), "class") == Some{"day-sep"} : Maybe<&2, String>}

law msg_copy_menu_role:
  {V.attrGet(V.attrsOf(M.copyMenuView()), "role") == Some{"menu"} : Maybe<&2, String>}

law msg_shot_aria:
  {V.attrGet(V.attrsOf(M.shotView(M.MsgImage{"x", "Imagem enviada"})), "aria-label") == Some{"Ampliar imagem"} : Maybe<&2, String>}

law msg_user_article_class:
  {M.articleClass(M.MsgUser{}, False{}) == V.ViewAttr{"class", "message user"} : V.ViewAttr}

law msg_flash_article_class:
  {M.articleClass(M.MsgAssistant{}, True{}) == V.ViewAttr{"class", "message assistant pc-hit"} : V.ViewAttr}

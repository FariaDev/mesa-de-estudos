import Base
import ../msg.bend as M
import ../talkview.bend as T
import ../view.bend as V

# Contrato verificável da conversa da Mesa. Prefixo `talk_` evita colisões no
# agregador de provas. Markdown/KaTeX entram como um ViewNode opaco; as leis
# fixam apenas a estrutura que o Bend de fato decide.

def at(xs: List<&2, V.ViewNode>, i: Nat) -> V.ViewNode:
  match xs i:
    case Nil{} _:
      V.viewText("")
    case Con{h, t} 0n:
      h
    case Con{h, t} 1n+p:
      at(t, p)

law talk_role_user:
  {T.roleName(True{}) == "user" : String}

law talk_role_assistant:
  {T.roleName(False{}) == "assistant" : String}

law talk_message_user_tag:
  for body: V.ViewNode
  {V.tagOf(T.message(True{}, body, Nil{}, True{}, False{}, False{})) == "article" : String}

law talk_message_user_class:
  for body: V.ViewNode
  {V.attrGet(V.attrsOf(T.message(True{}, body, Nil{}, True{}, False{}, False{})), "class")
    == Some{"message user"} : Maybe<&2, String>}

law talk_message_assistant_role:
  for body: V.ViewNode
  {V.attrGet(V.attrsOf(T.message(False{}, body, Nil{}, True{}, False{}, False{})), "data-role")
    == Some{"assistant"} : Maybe<&2, String>}

law talk_message_copy_handler:
  {V.attrGet(V.attrsOf(T.messageAction("msg-copy", M.msg("talk.copy"), "CopyMessage", "copy")), "on:click")
    == Some{"CopyMessage"} : Maybe<&2, String>}

# A ação é só ícone (#90): o nome acessível, o tooltip e o glifo do host.
law talk_message_copy_accessible:
  {V.attrGet(V.attrsOf(T.messageAction("msg-copy", M.msg("talk.copy"), "CopyMessage", "copy")), "aria-label")
    == Some{M.msg("talk.copy")} : Maybe<&2, String>}

law talk_message_copy_icon:
  {V.attrGet(V.attrsOf(T.messageAction("msg-copy", M.msg("talk.copy"), "CopyMessage", "copy")), "data-icon")
    == Some{"copy"} : Maybe<&2, String>}

law talk_message_actions_class:
  {V.attrGet(V.attrsOf(T.messageActions(True{}, False{}, False{})), "class")
    == Some{"message-actions"} : Maybe<&2, String>}

law talk_message_actions_bools:
  {V.kidsOf(T.messageActions(True{}, False{}, False{}))
    == [T.messageAction("msg-copy", M.msg("talk.copy"), "CopyMessage", "copy")] : List<&2, V.ViewNode>}

law talk_message_review_handler:
  {V.attrGet(V.attrsOf(T.messageAction("msg-review", M.msg("talk.review"), "SaveForReview", "bookmark")), "on:click")
    == Some{"SaveForReview"} : Maybe<&2, String>}

law talk_message_actions_review:
  {V.kidsOf(T.messageActions(False{}, False{}, True{}))
    == [T.messageAction("msg-review", M.msg("talk.review"), "SaveForReview", "bookmark")] : List<&2, V.ViewNode>}

law talk_shots_length:
  for +xs: List<&2, String>
  {List.length(&2, V.ViewNode, T.shotNodes(xs)) == List.length(&2, String, xs) : Nat}

law talk_shot_alt:
  for src: String
  {V.attrGet(V.attrsOf(T.shot(src)), "alt") == Some{M.msg("talk.imageSent")} : Maybe<&2, String>}

# ---------- assets do corpo (figura e bloco de código) ----------

law talk_asset_img_class:
  for src: String
  {V.attrGet(V.attrsOf(T.assetImg.go(src, "p", "a")), "class") == Some{"plot"} : Maybe<&2, String>}

law talk_asset_img_path:
  for path: String
  {V.attrGet(V.attrsOf(T.assetImg.go("s", path, "a")), "data-path") == Some{path} : Maybe<&2, String>}

law talk_asset_img_alt:
  for alt: String
  {V.attrGet(V.attrsOf(T.assetImg.go("s", "p", alt)), "alt") == Some{alt} : Maybe<&2, String>}

law talk_asset_kids_sem_legenda:
  {List.length(&2, V.ViewNode, T.assetKids.go("s", "p", "a", "")) == 1n : Nat}

law talk_asset_kids_com_legenda:
  {List.length(&2, V.ViewNode, T.assetKids.go("s", "p", "a", "legenda")) == 2n : Nat}

law talk_asset_figure_class:
  {V.attrGet(V.attrsOf(T.assetFigure.go("s", "p", "a", "")), "class") == Some{"asset"} : Maybe<&2, String>}

law talk_asset_fallback_tag:
  for source: String
  {V.tagOf(T.assetFallback(source)) == "code" : String}

law talk_code_copy_class:
  {V.attrGet(V.attrsOf(T.codeCopy()), "class") == Some{"code-copy"} : Maybe<&2, String>}

law talk_codeblock_sem_lang:
  {List.length(&2, V.ViewNode, V.kidsOf(T.codeBlock(V.viewText("x"), ""))) == 2n : Nat}

law talk_codeblock_com_lang:
  {List.length(&2, V.ViewNode, V.kidsOf(T.codeBlock(V.viewText("x"), "JS"))) == 2n : Nat}

law talk_codehead_class:
  {V.attrGet(V.attrsOf(T.codeHead("JS")), "class") == Some{"code-head"} : Maybe<&2, String>}

law talk_codehead_lang_class:
  {V.attrGet(V.attrsOf(at(V.kidsOf(T.codeHead("JS")), 0n)), "class") == Some{"code-lang"} : Maybe<&2, String>}

law talk_codehead_copy_class:
  {V.attrGet(V.attrsOf(at(V.kidsOf(T.codeHead("JS")), 1n)), "class") == Some{"code-copy"} : Maybe<&2, String>}

law talk_codehead_sem_lang_copia:
  {V.attrGet(V.attrsOf(at(V.kidsOf(T.codeHead("")), 0n)), "class") == Some{"code-copy"} : Maybe<&2, String>}

import Base
import ../talkview.bend as T
import ../view.bend as V

# Contrato verificável da conversa da Mesa. Prefixo `talk_` evita colisões no
# agregador de provas. Markdown/KaTeX entram como um ViewNode opaco; as leis
# fixam apenas a estrutura que o Bend de fato decide.

def optionOne() -> T.QuizOptionRow:
  T.QuizOptionRow{"x", "1", V.viewText("<x>"), False{}, False{}, False{}, False{}, False{}, ""}

def quizSimple() -> T.QuizRow:
  T.QuizRow{
    "tool-1", False{}, V.viewText("pergunta"), False{}, V.viewText(""),
    [optionOne()], False{}, False{}, True{}, False{}, "", False{}, V.viewText(""),
    False{}, V.viewText("")
  }

law talk_role_user:
  {T.roleName(True{}) == "user" : String}

law talk_role_assistant:
  {T.roleName(False{}) == "assistant" : String}

law talk_message_user_tag:
  for body: V.ViewNode
  {V.tagOf(T.message(True{}, body, Nil{}, True{}, False{})) == "article" : String}

law talk_message_user_class:
  for body: V.ViewNode
  {V.attrGet(V.attrsOf(T.message(True{}, body, Nil{}, True{}, False{})), "class")
    == Some{"message user"} : Maybe<&2, String>}

law talk_message_assistant_role:
  for body: V.ViewNode
  {V.attrGet(V.attrsOf(T.message(False{}, body, Nil{}, True{}, False{})), "data-role")
    == Some{"assistant"} : Maybe<&2, String>}

law talk_message_copy_handler:
  {V.attrGet(V.attrsOf(T.messageAction("msg-copy", "Copiar", "CopyMessage")), "on:click")
    == Some{"CopyMessage"} : Maybe<&2, String>}

law talk_message_actions_bools:
  {T.messageActions(True{}, False{})
    == [T.messageAction("msg-copy", "Copiar", "CopyMessage")] : List<&2, V.ViewNode>}

law talk_shots_length:
  for +xs: List<&2, String>
  {List.length(&2, V.ViewNode, T.shotNodes(xs)) == List.length(&2, String, xs) : Nat}

law talk_shot_alt:
  for src: String
  {V.attrGet(V.attrsOf(T.shot(src)), "alt") == Some{"Imagem enviada"} : Maybe<&2, String>}

law talk_citation_tag:
  for text: String
  {V.tagOf(T.citation(text)) == "blockquote" : String}

law talk_thinking_chip_kind:
  for label: String
  {V.attrGet(V.attrsOf(T.thinkingChip(label)), "data-kind")
    == Some{"thinking"} : Maybe<&2, String>}

law talk_tool_chip_class:
  for label: String
  {V.attrGet(V.attrsOf(T.toolChip(label)), "class")
    == Some{"talk-chip tool"} : Maybe<&2, String>}

law talk_empty_id:
  {V.attrGet(V.attrsOf(T.emptyState()), "id") == Some{"welcome"} : Maybe<&2, String>}

law talk_typing_role:
  for label: String
  {V.attrGet(V.attrsOf(T.typingState(label)), "data-role")
    == Some{"assistant"} : Maybe<&2, String>}

law talk_quiz_simple_class:
  {V.attrGet(V.attrsOf(T.quizCard(quizSimple())), "class")
    == Some{"message assistant quiz"} : Maybe<&2, String>}

law talk_quiz_simple_aria:
  {V.attrGet(V.attrsOf(T.quizCard(quizSimple())), "aria-label")
    == Some{"Pergunta de quiz"} : Maybe<&2, String>}

law talk_quiz_roles:
  {T.optionRole(True{}) == "checkbox" : String}

law talk_quiz_single_role:
  {T.optionsRole(False{}) == "radiogroup" : String}

law talk_quiz_option_handler:
  {V.attrGet(V.attrsOf(T.quizOption(optionOne(), False{})), "on:click")
    == Some{"SelectQuizOption"} : Maybe<&2, String>}

law talk_quiz_send_disabled:
  {V.attrGet(V.attrsOf(T.sendButton(True{})), "disabled") == Some{""} : Maybe<&2, String>}

law talk_quiz_send_enabled:
  {V.attrGet(V.attrsOf(T.sendButton(False{})), "disabled") == None{} : Maybe<&2, String>}

law talk_quiz_no_actions:
  {T.quizActions(False{}, False{}, False{}) == Nil{} : List<&2, V.ViewNode>}

law talk_quiz_verdict:
  {T.quizTail(True{}, "✓ Correta!", False{}, V.viewText(""), False{}, V.viewText(""))
    == [V.viewEl("div", [V.attrClass("quiz-verdict")], [V.viewText("✓ Correta!")])]
    : List<&2, V.ViewNode>}

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
  {List.length(&2, V.ViewNode, V.kidsOf(T.codeBlock(V.viewText("x"), "JS"))) == 3n : Nat}

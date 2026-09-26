import Base
import ../laws/talkview.bend as Laws
import ../talkview.bend as T
import ../view.bend as V

def Laws.talk_role_user():
  {==}

def Laws.talk_role_assistant():
  {==}

def Laws.talk_message_user_tag(body):
  {==}

def Laws.talk_message_user_class(body):
  {==}

def Laws.talk_message_assistant_role(body):
  {==}

def Laws.talk_message_copy_handler():
  {==}

def Laws.talk_message_actions_bools():
  {==}

def Laws.talk_shots_length(xs):
  match xs:
    case Nil{}:
      {==}
    case Con{h, t}:
      %Laws.talk_shots_length(t) : {1n+List.length(&2, V.ViewNode, T.shotNodes(t)) == 1n+_ : Nat}
      {==}

def Laws.talk_shot_alt(src):
  {==}

def Laws.talk_citation_tag(text):
  {==}

def Laws.talk_thinking_chip_kind(label):
  {==}

def Laws.talk_tool_chip_class(label):
  {==}

def Laws.talk_empty_id():
  {==}

def Laws.talk_typing_role(label):
  {==}

def Laws.talk_quiz_simple_class():
  {==}

def Laws.talk_quiz_simple_aria():
  {==}

def Laws.talk_quiz_roles():
  {==}

def Laws.talk_quiz_single_role():
  {==}

def Laws.talk_quiz_option_handler():
  {==}

def Laws.talk_quiz_send_disabled():
  {==}

def Laws.talk_quiz_send_enabled():
  {==}

def Laws.talk_quiz_no_actions():
  {==}

def Laws.talk_quiz_verdict():
  {==}

def Laws.talk_asset_img_class(src):
  {==}

def Laws.talk_asset_img_path(path):
  {==}

def Laws.talk_asset_img_alt(alt):
  {==}

def Laws.talk_asset_kids_sem_legenda():
  {==}

def Laws.talk_asset_kids_com_legenda():
  {==}

def Laws.talk_asset_figure_class():
  {==}

def Laws.talk_asset_fallback_tag(source):
  {==}

def Laws.talk_code_copy_class():
  {==}

def Laws.talk_codeblock_sem_lang():
  {==}

def Laws.talk_codeblock_com_lang():
  {==}

def Laws.talk_message_review_handler():
  {==}

def Laws.talk_message_actions_review():
  {==}

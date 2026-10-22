import Base
import ../chatlibraryview.bend as T
import ../msg.bend as M
import ../view.bend as V

law chat_favorite_label:
  {T.favoriteLabel(True{}) == M.msg("chatlib.favorite.on") : String}

law chat_action_never_submits:
  {V.attrGet(V.attrsOf(T.action("id", "Retomar", "ResumeChat")), "type") == Some{"button"} : Maybe<&2, String>}

law chat_action_identity:
  {V.attrGet(V.attrsOf(T.action("id", "Retomar", "ResumeChat")), "data-chat") == Some{"id"} : Maybe<&2, String>}

# A sessão em uso se chama Sessão (CONTEXT.md), não "conversa".
law chat_current_label:
  {T.currentLabel() == M.msg("chatlib.current") : String}

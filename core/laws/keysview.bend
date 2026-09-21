import Base
import ../keysview.bend as K
import ../view.bend as V

def editable(overridden: Bool) -> K.KeymapAction:
  K.KeymapAction{"new-session", "Nova conversa", "⌘N", False{}, overridden}

def fixed() -> K.KeymapAction:
  K.KeymapAction{"steer", "Interromper e enviar agora", "⌘⏎", True{}, False{}}

def first(xs: List<&2, V.ViewNode>) -> V.ViewNode:
  match xs:
    case Nil{}:
      V.viewText("")
    case Con{h, t}:
      h

def fourth(xs: List<&2, V.ViewNode>) -> V.ViewNode:
  match xs:
    case Con{a, Con{b, Con{c, Con{d, t}}}}:
      d
    case _:
      V.viewText("")

law keys_row_key:
  {V.attrGet(V.attrsOf(K.kv_row(editable(False{}), "")), "key") == Some{"new-session"} : Maybe<&2, String>}

law keys_row_recording:
  {V.attrGet(V.attrsOf(K.kv_row(editable(False{}), "new-session")), "class") == Some{"keys-row recording"} : Maybe<&2, String>}

law keys_fixed_class:
  {V.attrGet(V.attrsOf(K.kv_row(fixed(), "")), "class") == Some{"keys-row is-fixed"} : Maybe<&2, String>}

law keys_fixed_has_note:
  {List.length(&2, V.ViewNode, V.kidsOf(K.kv_row(fixed(), ""))) == 3n : Nat}

law keys_reset_hidden:
  {V.attrGet(V.attrsOf(fourth(V.kidsOf(K.kv_row(editable(False{}), "")))), "hidden") == Some{""} : Maybe<&2, String>}

law keys_reset_visible:
  {V.attrGet(V.attrsOf(fourth(V.kidsOf(K.kv_row(editable(True{}), "")))), "hidden") == None{} : Maybe<&2, String>}

law keys_reset_all_disabled:
  {V.attrGet(V.attrsOf(first(V.kidsOf(K.kv_footer(False{})))), "disabled") == Some{""} : Maybe<&2, String>}

law keys_dialog_closed:
  {V.attrGet(V.attrsOf(K.keysDialog([], "", "", "info", False{}, False{})), "open") == None{} : Maybe<&2, String>}

law keys_dialog_open:
  {V.attrGet(V.attrsOf(K.keysDialog([], "", "", "info", True{}, False{})), "open") == Some{""} : Maybe<&2, String>}

law keys_empty_label:
  {K.kv_keyLabel("") == "Sem atalho" : String}

law keys_record_aria:
  {K.kv_recordAria("Nova conversa", True{}) == "Gravando atalho de Nova conversa; Esc cancela" : String}

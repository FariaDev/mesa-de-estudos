import Base
import ../comfortview.bend as C
import ../view.bend as V

def first(xs: List<&2, V.ViewNode>) -> V.ViewNode:
  match xs:
    case Nil{}:
      V.viewText("")
    case Con{h, t}:
      h

law comfort_hysteresis_liga:
  {C.hysteresis(False{}, True{}, False{}) == True{} : Bool}

law comfort_hysteresis_espera:
  {C.hysteresis(False{}, False{}, True{}) == False{} : Bool}

law comfort_hysteresis_mantem:
  {C.hysteresis(True{}, False{}, True{}) == True{} : Bool}

law comfort_hysteresis_desliga:
  {C.hysteresis(True{}, True{}, False{}) == False{} : Bool}

law comfort_fades:
  {C.messageClasses(True{}, False{}) == "fade-top" : String}

law comfort_density_id:
  {V.attrGet(V.attrsOf(C.densitySelect("compacta")), "id") == Some{"density-mode"} : Maybe<&2, String>}

law comfort_density_event:
  {V.attrGet(V.attrsOf(C.densitySelect("padrao")), "on:change") == Some{"density"} : Maybe<&2, String>}

law comfort_reading_id:
  {V.attrGet(V.attrsOf(C.readingSelect("16")), "id") == Some{"reading-size"} : Maybe<&2, String>}

law comfort_reading_options:
  {List.length(&2, V.ViewNode, V.kidsOf(C.readingSelect("14"))) == 4n : Nat}

law comfort_jump_hidden:
  {V.attrGet(V.attrsOf(C.jumpLatestView(False{})), "hidden") == Some{""} : Maybe<&2, String>}

law comfort_jump_visible:
  {V.attrGet(V.attrsOf(C.jumpLatestView(True{})), "hidden") == None{} : Maybe<&2, String>}

law comfort_jump_label:
  {V.attrGet(V.attrsOf(C.jumpLatestView(True{})), "aria-label") == Some{"Rolar até o fim da conversa"} : Maybe<&2, String>}

law comfort_jump_icon:
  {V.attrGet(V.attrsOf(first(V.kidsOf(C.jumpLatestView(True{})))), "class") == Some{"icon-slot"} : Maybe<&2, String>}

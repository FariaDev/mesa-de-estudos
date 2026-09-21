import Base
import ../paletteview.bend as P
import ../view.bend as V

def pieces() -> List<&2, P.PaletteSegment>:
  [P.PaletteSegment{"Nova ", False{}}, P.PaletteSegment{"conversa", True{}}]

def item(id: String, check: Bool, when: String) -> P.PaletteItem:
  P.PaletteItem{id, "plus", pieces(), "⌘N", check, when}

def sections() -> List<&2, P.PaletteSection>:
  [P.PaletteSection{"Comandos", [item("palette-item-1", False{}, "")]}, P.PaletteSection{"Conversas", [item("palette-item-2", True{}, "agora")]}]

def first(xs: List<&2, V.ViewNode>) -> V.ViewNode:
  match xs:
    case Nil{}:
      V.viewText("")
    case Con{h, t}:
      h

law pv_segmento_marcado:
  {V.tagOf(P.segmentView(P.PaletteSegment{"nova", True{}})) == "mark" : String}

law pv_segmento_texto:
  {V.isText(P.segmentView(P.PaletteSegment{"nova", False{}})) == True{} : Bool}

law pv_conta_itens:
  {P.itemCount(sections()) == 2n : Nat}

law pv_item_ativo:
  {V.attrGet(V.attrsOf(P.itemNode(item("palette-item-1", False{}, ""), "palette-item-1")), "class") == Some{"palette-item active"} : Maybe<&2, String>}

law pv_item_inativo:
  {V.attrGet(V.attrsOf(P.itemNode(item("palette-item-1", False{}, ""), "palette-item-2")), "aria-selected") == Some{"false"} : Maybe<&2, String>}

law pv_item_id:
  {V.attrGet(V.attrsOf(P.itemNode(item("palette-item-1", False{}, ""), "")), "id") == Some{"palette-item-1"} : Maybe<&2, String>}

# Só a tag do filho do `<mark>`: ele embrulha o texto direto (tag ""), não um
# `<span class="label">`. A composição pública do rótulo (`labelNode` →
# `span.label` → `segmentViews`) não é inspecionada por esta lei.
law pv_mark_filho_texto:
  {V.tagOf(first(V.kidsOf(P.segmentView(P.PaletteSegment{"conversa", True{}})))) == "" : String}

law pv_check_substitui_kbd:
  {V.attrGet(V.attrsOf(first(P.trailingNode("⌘N", True{}))), "class") == Some{"palette-check"} : Maybe<&2, String>}

law pv_kbd_sem_check:
  {V.tagOf(first(P.trailingNode("⌘N", False{}))) == "kbd" : String}

law pv_quando_opcional:
  {List.length(&2, V.ViewNode, V.kidsOf(P.itemNode(item("palette-item-1", False{}, "agora"), ""))) == 4n : Nat}

law pv_secao_vazia_some:
  {P.sectionSpan(P.PaletteSection{"Vazia", []}, "") == Nil{} : List<&2, V.ViewNode>}

law pv_lista_vazia:
  {V.attrGet(V.attrsOf(first(P.listKids([], ""))), "class") == Some{"palette-empty"} : Maybe<&2, String>}

law pv_backdrop:
  {V.attrGet(V.attrsOf(P.paletteView(sections(), "palette-item-1", "nova", ["nova"])), "hidden") == Some{""} : Maybe<&2, String>}

law pv_lista_id:
  {V.attrGet(V.attrsOf(P.listNode(sections(), "palette-item-1")), "id") == Some{"palette-list"} : Maybe<&2, String>}

law pv_input_ativo:
  {V.attrGet(V.attrsOf(P.inputNode("palette-item-2", "nova")), "aria-activedescendant") == Some{"palette-item-2"} : Maybe<&2, String>}

law pv_input_sem_ativo:
  {V.attrGet(V.attrsOf(P.inputNode("", "")), "aria-activedescendant") == None{} : Maybe<&2, String>}

law pv_dica:
  {V.textOf(first(V.kidsOf(P.hintNode()))) == "↑↓ navegar · ⏎ abrir · Esc fechar" : String}

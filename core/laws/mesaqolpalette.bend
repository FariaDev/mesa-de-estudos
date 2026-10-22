import Base
import ../msg.bend as M
import ../mesaqolpalette.bend as P
import ../view.bend as V

# ---------------------------------------------------------------------------
# Contrato da paleta da Mesa. Prefixo `palette_`.
#
# As leis fecham em valores concretos: casamento/ranque com textos já dobrados
# e a árvore da casca/item (classe, id, ARIA, `disabled` e motivo).
# ---------------------------------------------------------------------------

def tokens2(a: String, b: String) -> List<&2, String>:
  Con{a, Con{b, Nil{}}}

def tokens1(a: String) -> List<&2, String>:
  Con{a, Nil{}}

def item1(+disabled: Bool, +reason: String, +kbd: String) -> P.PaletteItem:
  P.PaletteItem{
    "palette-item-1",
    "search",
    Con{P.PaletteSegment{"Abrir PDF", False{}}, Nil{}},
    kbd,
    False{},
    reason,
    disabled
  }

def section1(+disabled: Bool) -> P.PaletteSection:
  P.PaletteSection{"Comandos", Con{item1(disabled, "", ""), Nil{}}}

# ---------- casamento ----------

law palette_hit_starts:
  {P.hit("abrir pdf", tokens1("abrir")) == True{} : Bool}

law palette_hit_middle:
  {P.hit("abrir pdf", tokens1("pdf")) == True{} : Bool}

law palette_hit_miss:
  {P.hit("abrir pdf", tokens1("xyz")) == False{} : Bool}

law palette_hit_all_tokens:
  {P.hit("abrir pdf", tokens2("abrir", "pdf")) == True{} : Bool}

law palette_hit_one_token_missing:
  {P.hit("abrir pdf", tokens2("abrir", "xyz")) == False{} : Bool}

law palette_hit_empty_query:
  {P.hit("qualquer", Nil{}) == True{} : Bool}

# ---------- ranque ----------

law palette_score_starts:
  {P.score("abrir pdf", tokens1("abrir")) == 0n : Nat}

law palette_score_middle:
  {P.score("abrir pdf", tokens1("pdf")) == 1n : Nat}

law palette_score_miss:
  {P.score("abrir pdf", tokens1("xyz")) == 2n : Nat}

law palette_score_first_token_basta:
  {P.score("abrir pdf", tokens2("pdf", "abrir")) == 0n : Nat}

law palette_score_empty_query:
  {P.score("abrir pdf", Nil{}) == 1n : Nat}

# ---------- contagem e vazio ----------

law palette_item_count:
  {P.itemCount(Con{section1(False{}), Nil{}}) == 1n : Nat}

law palette_item_count_empty:
  {P.itemCount(Nil{}) == 0n : Nat}

law palette_empty_list:
  {List.length(&2, V.ViewNode, P.listKids(Nil{}, "")) == 1n : Nat}

law palette_list_rows:
  {List.length(&2, V.ViewNode, P.listKids(Con{section1(False{}), Nil{}}, "")) == 2n : Nat}

# ---------- casca ----------

law palette_backdrop_tag:
  {V.tagOf(P.paletteView(Nil{}, "", "")) == "div" : String}

law palette_backdrop_id:
  {V.attrGet(V.attrsOf(P.paletteView(Nil{}, "", "")), "id") == Some{"command-palette"} : Maybe<&2, String>}

law palette_backdrop_class:
  {V.attrGet(V.attrsOf(P.paletteView(Nil{}, "", "")), "class") == Some{"palette-backdrop"} : Maybe<&2, String>}

law palette_backdrop_hidden:
  {V.attrGet(V.attrsOf(P.paletteView(Nil{}, "", "")), "hidden") == Some{""} : Maybe<&2, String>}

law palette_list_label:
  {V.attrGet(V.attrsOf(P.listNode(Nil{}, "")), "aria-label") == Some{M.msg("palette.list.aria")} : Maybe<&2, String>}

# ---------- item ----------

law palette_item_class:
  {V.attrGet(V.attrsOf(P.itemNode(item1(False{}, "", ""), "")), "class") == Some{"palette-item"} : Maybe<&2, String>}

law palette_item_active_class:
  {V.attrGet(V.attrsOf(P.itemNode(item1(False{}, "", ""), "palette-item-1")), "class") == Some{"palette-item active"} : Maybe<&2, String>}

law palette_item_role:
  {V.attrGet(V.attrsOf(P.itemNode(item1(False{}, "", ""), "")), "role") == Some{"option"} : Maybe<&2, String>}

law palette_item_disabled_attr:
  {V.attrGet(V.attrsOf(P.itemNode(item1(True{}, "Indisponível agora", ""), "")), "disabled") == Some{""} : Maybe<&2, String>}

law palette_item_disabled_class:
  {V.attrGet(V.attrsOf(P.itemNode(item1(True{}, "Indisponível agora", ""), "")), "class") == Some{"palette-item disabled"} : Maybe<&2, String>}

law palette_item_disabled_reason:
  {V.attrGet(V.attrsOf(P.itemNode(item1(True{}, "Indisponível agora", ""), "")), "title") == Some{"Indisponível agora"} : Maybe<&2, String>}

law palette_item_enabled_no_title:
  {V.attrGet(V.attrsOf(P.itemNode(item1(False{}, "motivo", ""), "")), "title") == None{} : Maybe<&2, String>}

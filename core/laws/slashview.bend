import Base
import ../slashview.bend as SV
import ../view.bend as V

# ---------------------------------------------------------------------------
# Contrato do menu slash (Mesa + Conversa): casca, cabeça/rodapé, lista e
# linhas com classe/ARIA/handlers/ids/`key`/slots.
#
# Cenários concretos: `String.eq`/`is_empty`/`append`/`Nat.show` não reduzem
# genericamente, então cada lei fixa as entradas e o checker normaliza os dois
# lados. Ficam de fora (host): consulta/gatilho, filtro, índice ativo com wrap,
# inserção no prompt, abertura/fechamento, posição, foco/scroll e a troca do
# slot `.slash-check` pelo SVG de `icons.mjs`.
# ---------------------------------------------------------------------------

def at(xs: List<&2, V.ViewNode>, i: Nat) -> V.ViewNode:
  match xs i:
    case Nil{} _:
      V.viewText("")
    case Con{h, t} 0n:
      h
    case Con{h, t} 1n+p:
      at(t, p)

def kind(n: V.ViewNode, i: Nat) -> V.ViewNode:
  at(V.kidsOf(n), i)

def attrOf(n: V.ViewNode, name: String) -> Maybe<&2, String>:
  V.attrGet(V.attrsOf(n), name)

# .slash-text > .slash-name
def nameKid(row: V.ViewNode) -> V.ViewNode:
  kind(kind(row, 0n), 0n)

# .slash-name > .slash-arg
def nameArgKid(row: V.ViewNode) -> V.ViewNode:
  kind(kind(kind(row, 0n), 0n), 1n)

# .slash-text > .slash-desc
def descKid(row: V.ViewNode) -> V.ViewNode:
  kind(kind(row, 0n), 1n)

# .slash-check
def checkKid(row: V.ViewNode) -> V.ViewNode:
  kind(row, 1n)

def itemCompact() -> SV.SlashItem:
  SV.SlashItem{"compact", "compact", "[instruções]", "Resumir a conversa"}

def itemHelp() -> SV.SlashItem:
  SV.SlashItem{"help", "help", "", "Mostrar os comandos"}

def itemBare() -> SV.SlashItem:
  SV.SlashItem{"status", "status", "", ""}

def twoItems() -> List<&2, SV.SlashItem>:
  [itemCompact(), itemHelp()]

def firstRow(items: List<&2, SV.SlashItem>, activeKey: String) -> V.ViewNode:
  at(SV.slashItemViews(items, activeKey), 0n)

def secondRow(items: List<&2, SV.SlashItem>, activeKey: String) -> V.ViewNode:
  at(SV.slashItemViews(items, activeKey), 1n)

# ---------- textos ----------

law slashview_head_text:
  {SV.slashHeadText() == "Comandos" : String}

law slashview_list_label:
  {SV.slashListLabel() == "Comandos do Pi" : String}

law slashview_foot_text:
  {SV.slashFootText() == "↑↓ navegar · ⏎ inserir · Esc fechar" : String}

# ---------- id da linha ----------

law slashview_id_zero:
  {SV.slashItemId(0n) == "slash-opt-0" : String}

law slashview_id_nine:
  {SV.slashItemId(9n) == "slash-opt-9" : String}

# ---------- casca ----------

law slashview_menu_id:
  {attrOf(SV.slashMenuView(True{}, Nil{}, ""), "id") == Some{"slash-menu"} : Maybe<&2, String>}

law slashview_menu_class:
  {attrOf(SV.slashMenuView(True{}, Nil{}, ""), "class") == Some{"slash-pop"} : Maybe<&2, String>}

# O CSS não carrega o fixo/z-index; eles vão no `style` como antes.
law slashview_menu_style:
  {attrOf(SV.slashMenuView(True{}, Nil{}, ""), "style") == Some{"position:fixed;z-index:105"} : Maybe<&2, String>}

law slashview_menu_open:
  {attrOf(SV.slashMenuView(True{}, Nil{}, ""), "hidden") == None{} : Maybe<&2, String>}

law slashview_menu_hidden:
  {attrOf(SV.slashMenuView(False{}, Nil{}, ""), "hidden") == Some{""} : Maybe<&2, String>}

law slashview_menu_kids:
  {List.length(&2, V.ViewNode, V.kidsOf(SV.slashMenuView(True{}, twoItems(), "compact"))) == 3n : Nat}

law slashview_head_class:
  {attrOf(kind(SV.slashMenuView(True{}, Nil{}, ""), 0n), "class") == Some{"slash-head"} : Maybe<&2, String>}

law slashview_head_role:
  {attrOf(kind(SV.slashMenuView(True{}, Nil{}, ""), 0n), "role") == Some{"presentation"} : Maybe<&2, String>}

law slashview_head_text_kid:
  {V.textOf(kind(kind(SV.slashMenuView(True{}, Nil{}, ""), 0n), 0n)) == "Comandos" : String}

law slashview_foot_class:
  {attrOf(kind(SV.slashMenuView(True{}, Nil{}, ""), 2n), "class") == Some{"slash-foot"} : Maybe<&2, String>}

law slashview_foot_role:
  {attrOf(kind(SV.slashMenuView(True{}, Nil{}, ""), 2n), "role") == Some{"presentation"} : Maybe<&2, String>}

law slashview_foot_text_kid:
  {V.textOf(kind(kind(SV.slashMenuView(True{}, Nil{}, ""), 2n), 0n)) == "↑↓ navegar · ⏎ inserir · Esc fechar" : String}

# ---------- lista ----------

law slashview_list_id:
  {attrOf(kind(SV.slashMenuView(True{}, Nil{}, ""), 1n), "id") == Some{"slash-list"} : Maybe<&2, String>}

law slashview_list_class:
  {attrOf(kind(SV.slashMenuView(True{}, Nil{}, ""), 1n), "class") == Some{"slash-list"} : Maybe<&2, String>}

law slashview_list_role:
  {attrOf(kind(SV.slashMenuView(True{}, Nil{}, ""), 1n), "role") == Some{"listbox"} : Maybe<&2, String>}

law slashview_list_aria:
  {attrOf(kind(SV.slashMenuView(True{}, Nil{}, ""), 1n), "aria-label") == Some{"Comandos do Pi"} : Maybe<&2, String>}

law slashview_list_kids:
  {List.length(&2, V.ViewNode, V.kidsOf(kind(SV.slashMenuView(True{}, twoItems(), "help"), 1n))) == 2n : Nat}

# ---------- linha: destaque, identidade e handlers ----------

law slashview_row_active_class:
  {attrOf(firstRow(twoItems(), "compact"), "class") == Some{"slash-item active"} : Maybe<&2, String>}

law slashview_row_idle_class:
  {attrOf(firstRow(twoItems(), "help"), "class") == Some{"slash-item"} : Maybe<&2, String>}

# Sem ativo (lista recém-aberta antes de pintar) nenhuma linha acende.
law slashview_row_none_class:
  {attrOf(firstRow(twoItems(), ""), "class") == Some{"slash-item"} : Maybe<&2, String>}

law slashview_row_role:
  {attrOf(firstRow(twoItems(), "compact"), "role") == Some{"option"} : Maybe<&2, String>}

law slashview_row_selected:
  {attrOf(firstRow(twoItems(), "compact"), "aria-selected") == Some{"true"} : Maybe<&2, String>}

law slashview_row_unselected:
  {attrOf(secondRow(twoItems(), "compact"), "aria-selected") == Some{"false"} : Maybe<&2, String>}

law slashview_row_id_first:
  {attrOf(firstRow(twoItems(), "compact"), "id") == Some{"slash-opt-0"} : Maybe<&2, String>}

law slashview_row_id_second:
  {attrOf(secondRow(twoItems(), "compact"), "id") == Some{"slash-opt-1"} : Maybe<&2, String>}

law slashview_row_key:
  {attrOf(secondRow(twoItems(), "compact"), "key") == Some{"help"} : Maybe<&2, String>}

law slashview_row_hold:
  {attrOf(firstRow(twoItems(), ""), "on:mousedown") == Some{"hold"} : Maybe<&2, String>}

law slashview_row_hover:
  {attrOf(firstRow(twoItems(), ""), "on:mouseenter") == Some{"hover"} : Maybe<&2, String>}

law slashview_row_pick:
  {attrOf(firstRow(twoItems(), ""), "on:click") == Some{"pick"} : Maybe<&2, String>}

# ---------- linha: texto, dica, descrição e check ----------

law slashview_row_kids:
  {List.length(&2, V.ViewNode, V.kidsOf(firstRow(twoItems(), "compact"))) == 2n : Nat}

law slashview_row_name:
  {V.textOf(kind(nameKid(firstRow(twoItems(), "compact")), 0n)) == "/compact" : String}

law slashview_row_name_with_hint:
  {List.length(&2, V.ViewNode, V.kidsOf(nameKid(firstRow(twoItems(), "compact")))) == 2n : Nat}

law slashview_row_name_without_hint:
  {List.length(&2, V.ViewNode, V.kidsOf(nameKid(secondRow(twoItems(), "compact")))) == 1n : Nat}

law slashview_row_hint_class:
  {attrOf(nameArgKid(firstRow(twoItems(), "compact")), "class") == Some{"slash-arg"} : Maybe<&2, String>}

law slashview_row_hint_text:
  {V.textOf(kind(nameArgKid(firstRow(twoItems(), "compact")), 0n)) == "[instruções]" : String}

law slashview_row_desc_class:
  {attrOf(descKid(firstRow(twoItems(), "compact")), "class") == Some{"slash-desc"} : Maybe<&2, String>}

law slashview_row_desc_text:
  {V.textOf(kind(descKid(firstRow(twoItems(), "compact")), 0n)) == "Resumir a conversa" : String}

law slashview_row_without_desc:
  {List.length(&2, V.ViewNode, V.kidsOf(kind(firstRow([itemBare()], ""), 0n))) == 1n : Nat}

# O check nasce em toda linha, mesmo sem dica/descrição.
law slashview_check_class:
  {attrOf(checkKid(firstRow([itemBare()], "")), "class") == Some{"slash-check"} : Maybe<&2, String>}

law slashview_check_aria:
  {attrOf(checkKid(firstRow([itemBare()], "")), "aria-hidden") == Some{"true"} : Maybe<&2, String>}

law slashview_check_text:
  {V.textOf(kind(checkKid(firstRow([itemBare()], "")), 0n)) == "check" : String}

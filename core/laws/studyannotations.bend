import Base
import ../msg.bend as M
import ../studyannotations.bend as N

# ---------------------------------------------------------------------------
# Contrato das anotações de página. Prefixo `pn_`.
#
# Itens concretos moram aqui em cima: igualdade de Data e listas só reduzem
# com valores concretos. O que ficou de fora (I/O, ids opacos, relógio,
# índice de arquivo, teto de bytes) é host.
# ---------------------------------------------------------------------------

def itemA() -> N.NoteItem:
  N.NoteItem{
    "n-1",
    N.NoteNote{},
    "trecho selecionado",
    "observação",
    N.NoteRef{"Limites.pdf", "Limites.pdf", "/p/Limites.pdf", 3n}
  }

def itemB() -> N.NoteItem:
  N.NoteItem{
    "n-2",
    N.NoteDoubt{},
    "",
    "não vi a fatoração",
    N.NoteRef{"", "", "", 0n}
  }

# Sem trecho e sem observação: não vale guardar.
def itemC() -> N.NoteItem:
  N.NoteItem{"n-3", N.NoteNote{}, "   ", "   ", N.NoteRef{"", "", "", 0n}}

def itemsTwo() -> List<&2, N.NoteItem>:
  [itemA(), itemB()]

# Item novo de verdade (nem A nem B): entra na frente e a lista cresce.
def itemD() -> N.NoteItem:
  N.NoteItem{"n-4", N.NoteNote{}, "outro trecho", "", N.NoteRef{"", "", "", 0n}}

def firstNote(xs: List<&2, N.NoteItem>) -> N.NoteItem:
  match xs:
    case Nil{}:
      itemC()
    case Con{h, t}:
      h

def idOf(item: N.NoteItem) -> String:
  match item:
    case N.NoteItem{+id, _, _, _, _}:
      id

def quoteOf(item: N.NoteItem) -> String:
  match item:
    case N.NoteItem{_, _, +quote, _, _}:
      quote

def noteOf(item: N.NoteItem) -> String:
  match item:
    case N.NoteItem{_, _, _, +note, _}:
      note

def refOf(item: N.NoteItem) -> N.NoteRef:
  match item:
    case N.NoteItem{_, _, _, _, +ref}:
      ref

def pageOf(item: N.NoteItem) -> Nat:
  match item:
    case N.NoteItem{_, _, _, _, ref}:
      match ref:
        case N.NoteRef{_, _, _, +page}:
          page

def nameOf(item: N.NoteItem) -> String:
  match item:
    case N.NoteItem{_, _, _, _, ref}:
      match ref:
        case N.NoteRef{+name, _, _, _}:
          name

# ---------- tetos ----------

law pn_max_id:
  {N.maxId() == 80n : Nat}

law pn_max_quote:
  {N.maxQuote() == 2000n : Nat}

law pn_max_note:
  {N.maxNote() == 2000n : Nat}

law pn_max_name:
  {N.maxName() == 120n : Nat}

law pn_max_rel:
  {N.maxRel() == 1024n : Nat}

law pn_max_path:
  {N.maxPath() == 4096n : Nat}

law pn_max_items:
  {N.maxItems() == 500n : Nat}

# ---------- aparar antes de cortar ----------

law pn_quote_trim:
  {N.fitQuote("  trecho selecionado  ") == "trecho selecionado" : String}

law pn_note_trim:
  {N.fitNote("  observação  ") == "observação" : String}

law pn_name_trim:
  {N.fitName(" Limites.pdf ") == "Limites.pdf" : String}

law pn_cut_longo:
  {N.cut("limites", 3n) == "lim" : String}

law pn_cut_curto:
  {N.cut("li", 3n) == "li" : String}

# ---------- página ----------

law pn_page_floor:
  {N.pageFloor(0n) == 1n : Nat}

law pn_page_keeps:
  {N.pageFloor(3n) == 3n : Nat}

# ---------- escopo ----------

law pn_scope_livre:
  {N.scopeOf(True{}, "Calculo", "sess-1") == "free:sess-1" : String}

law pn_scope_materia:
  {N.scopeOf(False{}, "Calculo", "sess-1") == "Calculo" : String}

# ---------- espécie ----------

law pn_kind_duvida:
  {N.kindOf(True{}) == N.NoteDoubt{} : N.NoteKind}

law pn_kind_nota:
  {N.kindOf(False{}) == N.NoteNote{} : N.NoteKind}

law pn_kind_key:
  {N.kindKey(N.NoteNote{}) == "nota" : String}

law pn_kind_label:
  {N.kindLabel(N.NoteDoubt{}) == M.msg("annot.kind.doubt") : String}

# ---------- item novo ----------

law pn_new_item_apara:
  {N.newItem("  n-1 ", False{}, "  trecho ", " obs ", " Limites.pdf ", " Limites.pdf ", " /p/L.pdf ", 0n)
    == N.NoteItem{
      "n-1",
      N.NoteNote{},
      "trecho",
      "obs",
      N.NoteRef{"Limites.pdf", "Limites.pdf", "/p/L.pdf", 1n}
    } : N.NoteItem}

law pn_new_item_duvida:
  {N.kindOf(True{}) == N.NoteDoubt{} : N.NoteKind}

# ---------- vale guardar ----------

law pn_keep_vazio:
  {N.keep(itemC()) == False{} : Bool}

law pn_keep_quote:
  {N.keep(itemA()) == True{} : Bool}

law pn_keep_note_only:
  {N.keep(itemB()) == True{} : Bool}

# ---------- identidade ----------

law pn_same_id_mesmo:
  {N.sameId(itemA(), itemA()) == True{} : Bool}

law pn_same_id_outro:
  {N.sameId(itemA(), itemB()) == False{} : Bool}

# ---------- lista ----------

law pn_add_primeiro:
  {idOf(firstNote(N.addItem(itemsTwo(), itemB()))) == "n-2" : String}

law pn_add_dedupe:
  {List.length(&2, N.NoteItem, N.addItem(itemsTwo(), itemB())) == 2n : Nat}

law pn_add_novo:
  {List.length(&2, N.NoteItem, N.addItem(itemsTwo(), itemA())) == 2n : Nat}

law pn_add_terceiro:
  {List.length(&2, N.NoteItem, N.addItem(itemsTwo(), itemD())) == 3n : Nat}

law pn_add_terceiro_frente:
  {idOf(firstNote(N.addItem(itemsTwo(), itemD()))) == "n-4" : String}

# Editar pela ID mantém a posição: o primeiro continua o primeiro.
law pn_replace_posicao:
  {idOf(firstNote(N.replaceSame(itemsTwo(), itemA(), itemB()))) == "n-2" : String}

law pn_replace_mantem_cabeca:
  {idOf(firstNote(N.replaceSame(itemsTwo(), itemB(), itemC()))) == "n-1" : String}

law pn_replace_comprimento:
  {List.length(&2, N.NoteItem, N.replaceSame(itemsTwo(), itemA(), itemC())) == 2n : Nat}

# Chave que não está mais na lista não mexe em nada.
law pn_replace_ausente:
  {idOf(firstNote(N.replaceSame(itemsTwo(), itemC(), itemA()))) == "n-1" : String}

law pn_remove_tira_um:
  {List.length(&2, N.NoteItem, N.removeSame(itemsTwo(), itemB())) == 1n : Nat}

law pn_remove_mantem_cabeca:
  {idOf(firstNote(N.removeSame(itemsTwo(), itemB()))) == "n-1" : String}

law pn_remove_ausente:
  {List.length(&2, N.NoteItem, N.removeSame(itemsTwo(), itemC())) == 2n : Nat}

# ---------- página do item ----------

law pn_page_do_item:
  {pageOf(itemA()) == 3n : Nat}

law pn_on_page_sim:
  {N.onPage(refOf(itemA()), 3n) == True{} : Bool}

law pn_on_page_nao:
  {N.onPage(refOf(itemA()), 4n) == False{} : Bool}

# ---------- referência portátil ----------

law pn_ref_name:
  {nameOf(itemA()) == "Limites.pdf" : String}

law pn_ref_line:
  {N.refLine("Limites.pdf", 3n) == M.msg2("common.refNamed", "name", "Limites.pdf", "page", "3") : String}

law pn_ref_line_sem_nome:
  {N.refLine("", 3n) == M.msg1("common.pageShort", "page", "3") : String}

# ---------- rótulos ----------

law pn_contagem_singular:
  {N.countText(1n) == M.msg1("annot.count", "count", "1") : String}

law pn_contagem_plural:
  {N.countText(3n) == M.msg1("annot.count", "count", "3") : String}

law pn_pagina:
  {N.pageLabel(7n) == M.msg1("common.pageShort", "page", "7") : String}

law pn_vazio:
  {N.emptyText() == M.msg("annot.empty") : String}

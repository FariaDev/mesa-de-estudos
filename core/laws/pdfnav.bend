import Base
import ../pdfnav.bend as N
import ../view.bend as V

# ---------------------------------------------------------------------------
# Contrato da navegação do leitor (favoritos, sumário, popover). Prefixo
# `pdfnav_`.
#
# Os fatos chegam resolvidos (`Bookmark`/`OutlineEntry` concretos) e as leis
# fecham em cenários concretos: `String.eq` é valor computado, então rótulo,
# classe `current` e profundidade só reduzem com nome/path concretos.
# ---------------------------------------------------------------------------

def kidAt(xs: List<&2, V.ViewNode>, n: Nat) -> V.ViewNode:
  match xs:
    case Nil{}:
      V.viewText("")
    case Con{h, t}:
      match n:
        case 0n:
          h
        case 1n+p:
          kidAt(t, p)

def first(xs: List<&2, V.ViewNode>) -> V.ViewNode:
  match xs:
    case Nil{}:
      V.viewText("")
    case Con{h, t}:
      h

# O favorito do documento aberto (o path é o mesmo do painel).
def bookHere() -> N.Bookmark:
  N.Bookmark{"Revisão", "/p/Limites.pdf", 12n}

# O favorito de outro documento da mesma matéria.
def bookThere() -> N.Bookmark:
  N.Bookmark{"Derivadas", "/p/Outro.pdf", 3n}

def booksTwo() -> List<&2, N.Bookmark>:
  [bookHere(), bookThere()]

# Profundidade acima do teto (o pdf.js aninha o que quiser).
def outDeep() -> N.OutlineEntry:
  N.OutlineEntry{"Limites", 5n, 9n}

def rowHere() -> V.ViewNode:
  N.bookmarkRow(0n, bookHere(), "/p/Limites.pdf")

def rowThere() -> V.ViewNode:
  N.bookmarkRow(1n, bookThere(), "/p/Limites.pdf")

def rowOpen() -> V.ViewNode:
  kidAt(V.kidsOf(rowHere()), 0n)

def rowRemoveBtn() -> V.ViewNode:
  kidAt(V.kidsOf(rowHere()), 1n)

def rowsOpen() -> V.ViewNode:
  kidAt(N.bookmarkRows(booksTwo(), "/p/Limites.pdf"), 1n)

def rowsOpenBtn() -> V.ViewNode:
  kidAt(V.kidsOf(rowsOpen()), 0n)

def popEmpty() -> V.ViewNode:
  N.navPopover(True{}, Nil{}, Nil{}, "/p/Limites.pdf")

def popHidden() -> V.ViewNode:
  N.navPopover(False{}, Nil{}, Nil{}, "/p/Limites.pdf")

# ---------- tetos ----------

law pdfnav_max_name:
  {N.maxName() == 60n : Nat}

law pdfnav_max_path:
  {N.maxPath() == 1024n : Nat}

law pdfnav_max_bookmarks:
  {N.maxBookmarks() == 200n : Nat}

law pdfnav_max_outline:
  {N.maxOutline() == 40n : Nat}

law pdfnav_max_depth:
  {N.maxDepth() == 3n : Nat}

# ---------- nomes dos favoritos ----------

law pdfnav_fit_name:
  {N.fitName("  Revisão  ") == "Revisão" : String}

law pdfnav_cut_short:
  {N.cutName("abc", 5n) == "abc" : String}

law pdfnav_cut_long:
  {N.cutName("abcdef", 3n) == "abc" : String}

law pdfnav_keep_blank:
  {N.keepName("   ") == False{} : Bool}

law pdfnav_keep_name:
  {N.keepName(" Revisão ") == True{} : Bool}

law pdfnav_page_label:
  {N.pageLabel(12n) == "p. 12" : String}

# ---------- botões ----------

law pdfnav_nav_label:
  {N.navButtonLabel() == "Navegar" : String}

law pdfnav_nav_title:
  {N.navButtonTitle() == "Favoritos e sumário" : String}

law pdfnav_nav_aria:
  {N.navAria("Enunciado") == "Navegar em Enunciado" : String}

law pdfnav_back_label:
  {N.navBackLabel() == "Voltar" : String}

law pdfnav_back_title:
  {N.navBackTitle() == "Voltar à página anterior" : String}

law pdfnav_back_aria:
  {N.navBackAria("Enunciado") == "Voltar à página anterior de Enunciado" : String}

law pdfnav_save_label:
  {N.saveLabel() == "Guardar esta página…" : String}

law pdfnav_save_title:
  {N.saveTitle() == "Guardar a página aberta como favorito" : String}

# ---------- diálogo do favorito ----------

law pdfnav_dialog_title:
  {N.bookmarkDialogTitle() == "Guardar esta página" : String}

law pdfnav_dialog_name_label:
  {N.bookmarkNameLabel() == "Nome do favorito" : String}

law pdfnav_dialog_hint:
  {N.bookmarkDialogHint("Revisão", 12n) == "Revisão, p. 12" : String}

law pdfnav_dialog_save:
  {N.bookmarkSaveLabel() == "Salvar" : String}

law pdfnav_dialog_cancel:
  {N.bookmarkCancelLabel() == "Cancelar" : String}

def firstOf(xs: List<&2, N.Bookmark>) -> N.Bookmark:
  match xs:
    case Nil{}:
      N.Bookmark{"", "", 1n}
    case Con{h, t}:
      h

def bookName(bm: N.Bookmark) -> String:
  match bm:
    case N.Bookmark{+name, _, _}:
      name

def bookPage(bm: N.Bookmark) -> Nat:
  match bm:
    case N.Bookmark{_, _, page}:
      page

# ---------- favorito novo ----------

law pdfnav_page_floor:
  {N.pageFloor(0n) == 1n : Nat}

law pdfnav_page_keep:
  {N.pageFloor(7n) == 7n : Nat}

law pdfnav_fit_path:
  {N.fitPath("  /p/Limites.pdf  ") == "/p/Limites.pdf" : String}

law pdfnav_new_name:
  {bookName(N.newBookmark("  Revisão  ", "/p/Limites.pdf", 12n)) == "Revisão" : String}

law pdfnav_new_page:
  {bookPage(N.newBookmark("Revisão", "/p/Limites.pdf", 0n)) == 1n : Nat}

law pdfnav_keep_bookmark:
  {N.keepBookmark(N.newBookmark("Revisão", "/p/Limites.pdf", 12n)) == True{} : Bool}

law pdfnav_keep_no_name:
  {N.keepBookmark(N.newBookmark("   ", "/p/Limites.pdf", 12n)) == False{} : Bool}

law pdfnav_keep_no_path:
  {N.keepBookmark(N.newBookmark("Revisão", "   ", 12n)) == False{} : Bool}

law pdfnav_same_bookmark:
  {N.sameBookmark(bookHere(), bookHere()) == True{} : Bool}

law pdfnav_same_other:
  {N.sameBookmark(bookHere(), bookThere()) == False{} : Bool}

law pdfnav_add_first:
  {bookName(firstOf(N.addBookmark(Nil{}, bookThere()))) == "Derivadas" : String}

# Guardar o mesmo favorito de novo renomeia: a lista não cresce.
law pdfnav_add_dedup:
  {List.length(&2, N.Bookmark, N.addBookmark(booksTwo(), bookHere())) == 2n : Nat}

law pdfnav_add_grows:
  {List.length(&2, N.Bookmark, N.addBookmark(booksTwo(), N.Bookmark{"Nova", "/p/Terceiro.pdf", 4n})) == 3n : Nat}

law pdfnav_remove_same:
  {bookName(firstOf(N.removeBookmark(booksTwo(), bookHere()))) == "Derivadas" : String}

law pdfnav_remove_len:
  {List.length(&2, N.Bookmark, N.removeBookmark(booksTwo(), bookThere())) == 1n : Nat}

law pdfnav_remove_empty:
  {List.length(&2, N.Bookmark, N.removeBookmark(Nil{}, bookHere())) == 0n : Nat}

# A identidade manda, não a posição: remover o SEGUNDO da lista deixa o
# primeiro — com a lista da tela filtrada, a posição não serve para remover.
law pdfnav_remove_ignores_position:
  {bookName(firstOf(N.removeBookmark(booksTwo(), bookThere()))) == "Revisão" : String}

# Mesmo documento com outro nome é outro favorito: remover um não leva o outro.
law pdfnav_remove_keeps_other_name:
  {List.length(&2, N.Bookmark, N.removeBookmark(booksTwo(), N.Bookmark{"Outro nome", "/p/Outro.pdf", 3n})) == 2n : Nat}

# ---------- linhas de favorito ----------

law pdfnav_row_tag:
  {V.tagOf(rowHere()) == "div" : String}

law pdfnav_row_class:
  {V.attrGet(V.attrsOf(rowHere()), "class") == Some{"nav-row"} : Maybe<&2, String>}

law pdfnav_row_kids:
  {List.length(&2, V.ViewNode, V.kidsOf(rowHere())) == 2n : Nat}

law pdfnav_row_book_class:
  {V.attrGet(V.attrsOf(rowOpen()), "class") == Some{"nav-bookmark current"} : Maybe<&2, String>}

law pdfnav_row_other_class:
  {V.attrGet(V.attrsOf(kidAt(V.kidsOf(rowThere()), 0n)), "class") == Some{"nav-bookmark"} : Maybe<&2, String>}

law pdfnav_row_data_id:
  {V.attrGet(V.attrsOf(rowOpen()), "data-id") == Some{"0"} : Maybe<&2, String>}

law pdfnav_row_data_page:
  {V.attrGet(V.attrsOf(rowOpen()), "data-page") == Some{"12"} : Maybe<&2, String>}

law pdfnav_row_data_path:
  {V.attrGet(V.attrsOf(rowOpen()), "data-path") == Some{"/p/Limites.pdf"} : Maybe<&2, String>}

law pdfnav_row_title:
  {V.attrGet(V.attrsOf(rowOpen()), "title") == Some{"Abrir Revisão na p. 12"} : Maybe<&2, String>}

law pdfnav_row_aria:
  {V.attrGet(V.attrsOf(rowOpen()), "aria-label") == Some{"Abrir o favorito Revisão, p. 12"} : Maybe<&2, String>}

law pdfnav_row_click:
  {V.attrGet(V.attrsOf(rowOpen()), "on:click") == Some{"OpenBookmark"} : Maybe<&2, String>}

law pdfnav_row_name_text:
  {V.textOf(first(V.kidsOf(first(V.kidsOf(rowOpen()))))) == "Revisão" : String}

law pdfnav_row_page_text:
  {V.textOf(first(V.kidsOf(kidAt(V.kidsOf(rowOpen()), 1n)))) == "p. 12" : String}

law pdfnav_remove_class:
  {V.attrGet(V.attrsOf(rowRemoveBtn()), "class") == Some{"icon-btn nav-bookmark-remove"} : Maybe<&2, String>}

law pdfnav_remove_icon:
  {V.attrGet(V.attrsOf(rowRemoveBtn()), "data-icon") == Some{"minus"} : Maybe<&2, String>}

law pdfnav_remove_id:
  {V.attrGet(V.attrsOf(rowRemoveBtn()), "data-id") == Some{"0"} : Maybe<&2, String>}

law pdfnav_remove_title:
  {V.attrGet(V.attrsOf(rowRemoveBtn()), "title") == Some{"Remover o favorito Revisão"} : Maybe<&2, String>}

law pdfnav_remove_click:
  {V.attrGet(V.attrsOf(rowRemoveBtn()), "on:click") == Some{"RemoveBookmark"} : Maybe<&2, String>}

# ---------- lista de favoritos ----------

law pdfnav_rows_len:
  {List.length(&2, V.ViewNode, N.bookmarkRows(booksTwo(), "/p/Limites.pdf")) == 2n : Nat}

law pdfnav_rows_empty:
  {List.length(&2, V.ViewNode, N.bookmarkRows(Nil{}, "/p/Limites.pdf")) == 0n : Nat}

# A posição na lista é o id: o segundo favorito abre e remove pelo data-id 1.
law pdfnav_rows_id:
  {V.attrGet(V.attrsOf(rowsOpenBtn()), "data-id") == Some{"1"} : Maybe<&2, String>}

law pdfnav_empty_books:
  {N.emptyBooks(Nil{}) == True{} : Bool}

law pdfnav_not_empty_books:
  {N.emptyBooks(booksTwo()) == False{} : Bool}

# ---------- sumário ----------

law pdfnav_outline_title:
  {N.outlineTitle() == "Sumário deste PDF" : String}

law pdfnav_outline_empty_text:
  {N.outlineEmpty() == "Este PDF não tem sumário." : String}

law pdfnav_outline_depth_cap:
  {N.outlineDepth(9n) == "3" : String}

law pdfnav_outline_depth:
  {N.outlineDepth(2n) == "2" : String}

law pdfnav_outline_label:
  {N.outlineLabel("Limites", 5n) == "Ir para a p. 5: Limites" : String}

law pdfnav_outline_tag:
  {V.tagOf(N.outlineRow(outDeep())) == "button" : String}

law pdfnav_outline_class:
  {V.attrGet(V.attrsOf(N.outlineRow(outDeep())), "class") == Some{"nav-outline"} : Maybe<&2, String>}

law pdfnav_outline_depth_attr:
  {V.attrGet(V.attrsOf(N.outlineRow(outDeep())), "data-depth") == Some{"3"} : Maybe<&2, String>}

law pdfnav_outline_page:
  {V.attrGet(V.attrsOf(N.outlineRow(outDeep())), "data-page") == Some{"5"} : Maybe<&2, String>}

law pdfnav_outline_click:
  {V.attrGet(V.attrsOf(N.outlineRow(outDeep())), "on:click") == Some{"OpenOutline"} : Maybe<&2, String>}

law pdfnav_outline_text:
  {V.textOf(first(V.kidsOf(N.outlineRow(outDeep())))) == "Limites" : String}

law pdfnav_outline_rows_len:
  {List.length(&2, V.ViewNode, N.outlineRows([outDeep()])) == 1n : Nat}

law pdfnav_empty_outline:
  {N.emptyOutline(Nil{}) == True{} : Bool}

# ---------- popover ----------

law pdfnav_pop_class:
  {V.attrGet(V.attrsOf(popEmpty()), "class") == Some{"pdf-nav-pop"} : Maybe<&2, String>}

law pdfnav_pop_open:
  {V.attrGet(V.attrsOf(popEmpty()), "hidden") == None{} : Maybe<&2, String>}

law pdfnav_pop_hidden:
  {V.attrGet(V.attrsOf(popHidden()), "hidden") == Some{""} : Maybe<&2, String>}

law pdfnav_pop_kids:
  {List.length(&2, V.ViewNode, V.kidsOf(popEmpty())) == 3n : Nat}

law pdfnav_pop_save_class:
  {V.attrGet(V.attrsOf(first(V.kidsOf(popEmpty()))), "class") == Some{"nav-save"} : Maybe<&2, String>}

law pdfnav_pop_save_text:
  {V.textOf(first(V.kidsOf(first(V.kidsOf(popEmpty()))))) == "Guardar esta página…" : String}

law pdfnav_pop_save_click:
  {V.attrGet(V.attrsOf(first(V.kidsOf(popEmpty()))), "on:click") == Some{"SaveBookmark"} : Maybe<&2, String>}

# Sem favoritos, a seção é o cabeçalho + a nota de vazio.
law pdfnav_pop_empty_section:
  {List.length(&2, V.ViewNode, V.kidsOf(kidAt(V.kidsOf(popEmpty()), 1n))) == 2n : Nat}

law pdfnav_pop_section_title:
  {V.textOf(first(V.kidsOf(first(V.kidsOf(kidAt(V.kidsOf(popEmpty()), 1n)))))) == "Favoritos desta matéria" : String}

law pdfnav_pop_empty_note:
  {V.textOf(first(V.kidsOf(kidAt(V.kidsOf(kidAt(V.kidsOf(popEmpty()), 1n)), 1n)))) == "Nenhum favorito nesta matéria." : String}

law pdfnav_pop_outline_title:
  {V.textOf(first(V.kidsOf(first(V.kidsOf(kidAt(V.kidsOf(popEmpty()), 2n)))))) == "Sumário deste PDF" : String}

law pdfnav_pop_outline_note:
  {V.textOf(first(V.kidsOf(kidAt(V.kidsOf(kidAt(V.kidsOf(popEmpty()), 2n)), 1n)))) == "Este PDF não tem sumário." : String}

import Base
import ../review.bend as N
import ../view.bend as V

# ---------------------------------------------------------------------------
# Contrato do caderno de revisão. Prefixo `review_`.
#
# Os fatos chegam resolvidos (`ReviewItem` concreto) e as leis fecham em
# cenários concretos: `String.eq` e as listas só reduzem com valores concretos,
# então os itens de exemplo moram aqui em cima.
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

# A questão escrita na linha (o texto do botão de abrir).
def rowText(row: V.ViewNode) -> String:
  V.textOf(first(V.kidsOf(first(V.kidsOf(row)))))

# O item completo: questão, tentativa, dificuldade e referência.
def itemHere() -> N.ReviewItem:
  N.ReviewItem{
    "Limites no infinito",
    "dividi por x²",
    "não vi a fatoração",
    N.ReviewRef{"Limites.pdf", 3n, "/p/Limites.pdf"}
  }

# O item magro: só a questão.
def itemThin() -> N.ReviewItem:
  N.ReviewItem{"Derivadas", "", "", N.ReviewRef{"", 0n, ""}}

# O item sem questão (o host recusa guardar assim).
def itemBlank() -> N.ReviewItem:
  N.ReviewItem{"   ", "", "", N.ReviewRef{"", 0n, ""}}

def itemOther() -> N.ReviewItem:
  N.ReviewItem{
    "Continuidade",
    "tentei o limite",
    "",
    N.ReviewRef{"Limites.pdf", 7n, "/p/Limites.pdf"}
  }

# Mesma questão, outro material.
def itemElsewhere() -> N.ReviewItem:
  N.ReviewItem{
    "Limites no infinito",
    "",
    "",
    N.ReviewRef{"Limites.pdf", 3n, "/p/Outro.pdf"}
  }

def itemsTwo() -> List<&2, N.ReviewItem>:
  [itemHere(), itemOther()]

def rowHere() -> V.ViewNode:
  N.reviewRow(0n, itemHere())

def rowThin() -> V.ViewNode:
  N.reviewRow(0n, itemThin())

def barTwo() -> V.ViewNode:
  N.reviewBar(2n)

def itemHereRef() -> N.ReviewRef:
  N.ReviewRef{"Limites.pdf", 3n, "/p/Limites.pdf"}

def dialogHere() -> List<&2, V.ViewNode>:
  N.reviewDialogChildren("limites", "dividi", "travei", N.refHint(itemHereRef()))

# ---------- tetos ----------

law review_max_question:
  {N.maxQuestion() == 400n : Nat}

law review_max_attempt:
  {N.maxAttempt() == 400n : Nat}

law review_max_difficulty:
  {N.maxDifficulty() == 240n : Nat}

law review_max_name:
  {N.maxName() == 60n : Nat}

law review_max_path:
  {N.maxPath() == 1024n : Nat}

law review_max_items:
  {N.maxItems() == 200n : Nat}

# ---------- aparar ----------

law review_fit_question_trims:
  {N.fitQuestion("  limites no infinito  ") == "limites no infinito" : String}

law review_cut_long:
  {N.cutReview("limites", 3n) == "lim" : String}

law review_cut_short:
  {N.cutReview("li", 3n) == "li" : String}

law review_fit_name_trims:
  {N.fitName("  Limites.pdf ") == "Limites.pdf" : String}

law review_page_floor:
  {N.pageFloor(0n) == 1n : Nat}

law review_page_keeps:
  {N.pageFloor(3n) == 3n : Nat}

# ---------- vale guardar ----------

law review_keep_question_blank:
  {V.boolStr(N.keepQuestion("   ")) == "false" : String}

law review_keep_question_text:
  {V.boolStr(N.keepQuestion("Limites")) == "true" : String}

law review_keep_item_uses_question:
  {V.boolStr(N.keepItem(itemBlank())) == "false" : String}

# ---------- lista ----------

law review_same_item_same:
  {V.boolStr(N.sameItem(itemHere(), itemHere())) == "true" : String}

law review_same_item_other:
  {V.boolStr(N.sameItem(itemHere(), itemOther())) == "false" : String}

law review_same_item_other_ref:
  {V.boolStr(N.sameItem(itemHere(), itemElsewhere())) == "false" : String}

law review_add_item_first:
  {V.textOf(first(V.kidsOf(first(V.kidsOf(first(N.reviewRows(N.addItem(itemsTwo(), itemOther())))))))) == "Continuidade" : String}

law review_add_item_dedupes:
  {List.length(&2, N.ReviewItem, N.addItem(itemsTwo(), itemOther())) == 2n : Nat}

# ---------- editar e remover: pela identidade, nunca pela posição ----------

law review_replace_same_head:
  {rowText(first(N.reviewRows(N.replaceSame(itemsTwo(), itemHere(), itemOther())))) == "Continuidade" : String}

# O item da chave está na posição 1 e ainda assim é ele que sai: a posição da
# linha não é identidade (na tela a lista é filtrada).
law review_replace_same_tail:
  {rowText(kidAt(N.reviewRows(N.replaceSame(itemsTwo(), itemOther(), itemThin())), 1n)) == "Derivadas" : String}

law review_replace_same_tail_keeps_head:
  {rowText(first(N.reviewRows(N.replaceSame(itemsTwo(), itemOther(), itemThin())))) == "Limites no infinito" : String}

law review_replace_keeps_length:
  {List.length(&2, N.ReviewItem, N.replaceSame(itemsTwo(), itemHere(), itemOther())) == 2n : Nat}

# Chave que não está mais na lista não mexe em nada (a tela pode ter envelhecido
# entre o clique e o Salvar).
law review_replace_absent_keeps_head:
  {rowText(first(N.reviewRows(N.replaceSame(itemsTwo(), itemThin(), itemOther())))) == "Limites no infinito" : String}

law review_remove_same_len:
  {List.length(&2, N.ReviewItem, N.removeSame(itemsTwo(), itemHere())) == 1n : Nat}

# Removendo o SEGUNDO, o primeiro fica — de novo, a posição não manda.
law review_remove_keeps_head:
  {rowText(first(N.reviewRows(N.removeSame(itemsTwo(), itemOther())))) == "Limites no infinito" : String}

law review_remove_absent:
  {List.length(&2, N.ReviewItem, N.removeSame(itemsTwo(), itemThin())) == 2n : Nat}

# ---------- contagem e referência ----------

law review_count_singular:
  {N.countText(1n) == "1 item" : String}

law review_count_plural:
  {N.countText(3n) == "3 itens" : String}

law review_ref_line:
  {N.refLine("Limites.pdf", 3n) == "Limites.pdf, p. 3" : String}

law review_ref_line_no_name:
  {N.refLine("", 3n) == "p. 3" : String}

law review_ref_hint_line:
  {N.refHint(itemHereRef()) == "Referência: Limites.pdf, p. 3" : String}

law review_ref_hint_none:
  {N.refHint(N.ReviewRef{"", 0n, ""}) == "Referência: sem referência" : String}

# ---------- a linha ----------

law review_row_kids:
  {List.length(&2, V.ViewNode, V.kidsOf(rowHere())) == 5n : Nat}

law review_row_kids_thin:
  {List.length(&2, V.ViewNode, V.kidsOf(rowThin())) == 2n : Nat}

law review_row_first_id:
  {V.attrGet(V.attrsOf(first(V.kidsOf(first(N.reviewRows(itemsTwo()))))), "data-id") == Some{"0"} : Maybe<&2, String>}

law review_row_open_handler:
  {V.attrGet(V.attrsOf(first(V.kidsOf(rowHere()))), "on:click") == Some{"EditReview"} : Maybe<&2, String>}

law review_row_ref_page:
  {V.attrGet(V.attrsOf(kidAt(V.kidsOf(rowHere()), 3n)), "data-page") == Some{"3"} : Maybe<&2, String>}

law review_row_similar_handler:
  {V.attrGet(V.attrsOf(first(V.kidsOf(kidAt(V.kidsOf(rowHere()), 4n)))), "on:click") == Some{"SimilarReview"} : Maybe<&2, String>}

law review_row_remove_handler:
  {V.attrGet(V.attrsOf(kidAt(V.kidsOf(kidAt(V.kidsOf(rowHere()), 4n)), 2n)), "on:click") == Some{"RemoveReview"} : Maybe<&2, String>}

law review_trouble_empty_is_nil:
  {List.length(&2, V.ViewNode, N.troubleNode("   ")) == 0n : Nat}

law review_trouble_text:
  {V.textOf(first(V.kidsOf(first(N.troubleNode("travei"))))) == "travei" : String}

law review_attempt_empty_is_nil:
  {List.length(&2, V.ViewNode, N.attemptNode("")) == 0n : Nat}

# ---------- a barra ----------

law review_bar_kids:
  {List.length(&2, V.ViewNode, V.kidsOf(barTwo())) == 3n : Nat}

law review_bar_title:
  {V.textOf(first(V.kidsOf(first(V.kidsOf(barTwo()))))) == "Caderno de revisão" : String}

law review_bar_count:
  {V.textOf(first(V.kidsOf(kidAt(V.kidsOf(barTwo()), 1n)))) == "2 itens" : String}

law review_bar_close_handler:
  {V.attrGet(V.attrsOf(kidAt(V.kidsOf(barTwo()), 2n)), "on:click") == Some{"CloseReview"} : Maybe<&2, String>}

# ---------- o diálogo ----------

law review_dialog_kids:
  {List.length(&2, V.ViewNode, dialogHere()) == 6n : Nat}

law review_dialog_question_id:
  {V.attrGet(V.attrsOf(kidAt(V.kidsOf(kidAt(dialogHere(), 2n)), 1n)), "id") == Some{"review-question"} : Maybe<&2, String>}

law review_dialog_save_id:
  {V.attrGet(V.attrsOf(kidAt(V.kidsOf(kidAt(dialogHere(), 5n)), 1n)), "id") == Some{"review-save"} : Maybe<&2, String>}

law review_dialog_ref_hint:
  {V.textOf(first(V.kidsOf(kidAt(dialogHere(), 1n)))) == "Referência: Limites.pdf, p. 3" : String}

# ---------- os dois prompts ----------

law review_similar_prompt:
  {N.similarPrompt(itemHere()) == "Quero um exercício semelhante a este, com outros números:\nLimites no infinito\nOnde eu travei: não vi a fatoração\nReferência: Limites.pdf, p. 3" : String}

law review_similar_prompt_no_trouble:
  {N.similarPrompt(itemThin()) == "Quero um exercício semelhante a este, com outros números:\nDerivadas" : String}

law review_redo_prompt:
  {N.redoPrompt(itemHere()) == "Vou refazer este exercício:\nLimites no infinito\nO que eu tentei: dividi por x²\nOnde eu travei: não vi a fatoração\nReferência: Limites.pdf, p. 3" : String}

law review_ref_suffix_empty:
  {N.refSuffix(N.ReviewRef{"", 0n, ""}) == "" : String}

law review_save_action_label:
  {N.saveActionLabel() == "Guardar para revisar" : String}

import Base
import ../msg.bend as M
import ../review.bend as N
import ../view.bend as V
import ../reviewschedule.bend as R

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

# A questão do primeiro item da lista (a ordem é a identidade que a tela vê).
def firstQuestion(xs: List<&2, N.ReviewItem>) -> String:
  match xs:
    case Nil{}:
      ""
    case Con{h, t}:
      match h:
        case N.ReviewItem{q, _, _, _}:
          q

def secondQuestion(xs: List<&2, N.ReviewItem>) -> String:
  match xs:
    case Nil{}:
      ""
    case Con{h, t}:
      firstQuestion(t)

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
  {firstQuestion(N.addItem(itemsTwo(), itemOther())) == "Continuidade" : String}

law review_add_item_dedupes:
  {List.length(&2, N.ReviewItem, N.addItem(itemsTwo(), itemOther())) == 2n : Nat}

# ---------- editar e remover: pela identidade, nunca pela posição ----------

law review_replace_same_head:
  {firstQuestion(N.replaceSame(itemsTwo(), itemHere(), itemOther())) == "Continuidade" : String}

# O item da chave está na posição 1 e ainda assim é ele que sai: a posição da
# linha não é identidade (na tela a lista é filtrada).
law review_replace_same_tail:
  {secondQuestion(N.replaceSame(itemsTwo(), itemOther(), itemThin())) == "Derivadas" : String}

law review_replace_same_tail_keeps_head:
  {firstQuestion(N.replaceSame(itemsTwo(), itemOther(), itemThin())) == "Limites no infinito" : String}

law review_replace_keeps_length:
  {List.length(&2, N.ReviewItem, N.replaceSame(itemsTwo(), itemHere(), itemOther())) == 2n : Nat}

# Chave que não está mais na lista não mexe em nada (a tela pode ter envelhecido
# entre o clique e o Salvar).
law review_replace_absent_keeps_head:
  {firstQuestion(N.replaceSame(itemsTwo(), itemThin(), itemOther())) == "Limites no infinito" : String}

law review_remove_same_len:
  {List.length(&2, N.ReviewItem, N.removeSame(itemsTwo(), itemHere())) == 1n : Nat}

# Removendo o SEGUNDO, o primeiro fica — de novo, a posição não manda.
law review_remove_keeps_head:
  {firstQuestion(N.removeSame(itemsTwo(), itemOther())) == "Limites no infinito" : String}

law review_remove_absent:
  {List.length(&2, N.ReviewItem, N.removeSame(itemsTwo(), itemThin())) == 2n : Nat}

# ---------- contagem e referência ----------

law review_count_singular:
  {N.countText(1n) == M.msg1("review.count", "count", "1") : String}

law review_count_plural:
  {N.countText(3n) == M.msg1("review.count", "count", "3") : String}

law review_ref_line:
  {N.refLine("Limites.pdf", 3n) == M.msg2("review.ref.named", "name", "Limites.pdf", "page", "3") : String}

law review_ref_line_no_name:
  {N.refLine("", 3n) == M.msg1("review.ref.page", "page", "3") : String}

law review_ref_hint_line:
  {N.refHint(itemHereRef()) == M.msg2("review.refHint.named", "name", "Limites.pdf", "page", "3") : String}

law review_ref_hint_none:
  {N.refHint(N.ReviewRef{"", 0n, ""}) == M.msg("review.refHint.none") : String}

# ---------- os itens da tela (fatos já resolvidos pelo host) ----------

def entryA() -> N.ReviewEntry:
  N.ReviewEntry{"a1", "Limites no infinito", "dividi por x²", "não vi a fatoração", itemHereRef(), True{}, M.msg("review.when.today"), "9 out", 3n, ""}

def entryB() -> N.ReviewEntry:
  N.ReviewEntry{"b2", "Continuidade", "", "", N.ReviewRef{"Limites.pdf", 7n, "/p/Limites.pdf"}, True{}, M.msg("review.when.today"), "10 out", 1n, ""}

def entryC() -> N.ReviewEntry:
  N.ReviewEntry{"c3", "Derivadas", "", "", N.ReviewRef{"", 0n, ""}, False{}, M.msg1("review.when.inDays", "count", "4"), "", 4n, ""}

def entryWarn() -> N.ReviewEntry:
  N.ReviewEntry{"w4", "Integrais", "", "", itemHereRef(), True{}, M.msg("review.when.today"), "", 0n, M.msg("review.warn.missing")}

def entriesAll() -> List<&2, N.ReviewEntry>:
  [entryA(), entryB(), entryC()]

def entriesLater() -> List<&2, N.ReviewEntry>:
  [entryC()]

def boardAll() -> List<&2, V.ViewNode>:
  N.reviewBoard(entriesAll(), "b2", 1n, True{})

def boardNoGrades() -> List<&2, V.ViewNode>:
  N.reviewBoard(entriesAll(), "", 0n, False{})

def mainAll() -> V.ViewNode:
  first(boardAll())

def asideAll() -> V.ViewNode:
  kidAt(boardAll(), 1n)

def cardAll() -> V.ViewNode:
  kidAt(V.kidsOf(mainAll()), 1n)

def gradesAll() -> V.ViewNode:
  kidAt(V.kidsOf(mainAll()), 2n)

def gradeRowAll() -> V.ViewNode:
  kidAt(V.kidsOf(gradesAll()), 1n)

def barDue() -> V.ViewNode:
  N.reviewBar("Cálculo I", 2n, 3n, True{})

def barBare() -> V.ViewNode:
  N.reviewBar("", 0n, 5n, False{})

# ---------- a contagem da barra ----------

law review_count_line_due:
  {N.countLine(3n, 7n, True{}) == M.msg2("review.countLine.some", "due", "3", "total", "7") : String}

law review_count_line_none_due:
  {N.countLine(0n, 7n, True{}) == M.msg1("review.countLine.none", "total", "7") : String}

law review_count_line_empty:
  {N.countLine(0n, 0n, True{}) == M.msg1("review.count", "count", "0") : String}

law review_count_line_unknown:
  {N.countLine(0n, 5n, False{}) == M.msg1("review.count", "count", "5") : String}

law review_count_line_unknown_one:
  {N.countLine(0n, 1n, False{}) == M.msg1("review.count", "count", "1") : String}

# ---------- o progresso do dia ----------

law review_progress_text:
  {N.progressText(1n, 3n) == M.msg2("review.progress", "shown", "1", "total", "3") : String}

# Quem já marcou um item continua a contar: 1 feito + o 1º dos 2 que sobram
# é o "2 de 3", não "1 de 2".
law review_progress_shown_after_done:
  {N.progressShown(1n, 1n) == 2n : Nat}

law review_progress_total_after_done:
  {N.progressTotal(1n, 2n) == 3n : Nat}

# ---------- separar o que vence hoje ----------

law review_due_count:
  {N.countEntries(N.dueEntries(entriesAll())) == 2n : Nat}

law review_later_count:
  {N.countEntries(N.laterEntries(entriesAll())) == 1n : Nat}

law review_position_second:
  {N.positionOf(entriesAll(), "b2") == 2n : Nat}

law review_position_absent:
  {N.positionOf(entriesAll(), "zz") == 0n : Nat}

# ---------- qual item aparece à esquerda ----------

law review_current_chosen:
  {N.currentId(N.currentEntry(entriesAll(), "b2")) == "b2" : String}

law review_current_chosen_later:
  {N.currentId(N.currentEntry(entriesAll(), "c3")) == "c3" : String}

# O escolhido sumiu (acabou de ser avaliado): vai para o primeiro que vence.
law review_current_vanished_goes_first_due:
  {N.currentId(N.currentEntry(entriesAll(), "zz")) == "a1" : String}

# Nada vence hoje: sobra o primeiro da lista.
law review_current_nothing_due_first:
  {N.currentId(N.currentEntry(entriesLater(), "")) == "c3" : String}

law review_current_empty:
  {N.currentId(N.currentEntry(Nil{}, "")) == "" : String}

# ---------- "Como foi?": quando volta ----------

law review_grade_errei_tomorrow:
  {N.gradeWhen(4n, R.ResultErrei{}) == M.msg("review.returns.tomorrow") : String}

law review_grade_first_facil:
  {N.gradeWhen(0n, R.ResultFacil{}) == M.msg1("review.returns.inDays", "count", "3") : String}

law review_grade_bom_grows:
  {N.gradeWhen(4n, R.ResultBom{}) == M.msg1("review.returns.inDays", "count", "10") : String}

law review_grade_facil_grows:
  {N.gradeWhen(4n, R.ResultFacil{}) == M.msg1("review.returns.inDays", "count", "14") : String}

law review_grade_dificil_grows:
  {N.gradeWhen(10n, R.ResultDificil{}) == M.msg1("review.returns.inDays", "count", "12") : String}

law review_grades_row_buttons:
  {List.length(&2, V.ViewNode, V.kidsOf(gradeRowAll())) == 4n : Nat}

law review_grade_button_result:
  {V.attrGet(V.attrsOf(kidAt(V.kidsOf(gradeRowAll()), 2n)), "data-result") == Some{"bom"} : Maybe<&2, String>}

law review_grade_button_id:
  {V.attrGet(V.attrsOf(first(V.kidsOf(gradeRowAll()))), "data-id") == Some{"b2"} : Maybe<&2, String>}

# ---------- a tela ----------

law review_board_empty_one_block:
  {List.length(&2, V.ViewNode, N.reviewBoard(Nil{}, "", 0n, False{})) == 1n : Nat}

law review_board_empty_class:
  {V.attrGet(V.attrsOf(first(N.reviewBoard(Nil{}, "", 0n, False{}))), "class") == Some{"review-empty-block"} : Maybe<&2, String>}

law review_board_two_columns:
  {List.length(&2, V.ViewNode, boardAll()) == 2n : Nat}

law review_board_main_id:
  {V.attrGet(V.attrsOf(mainAll()), "id") == Some{"review-today"} : Maybe<&2, String>}

law review_board_aside_id:
  {V.attrGet(V.attrsOf(asideAll()), "id") == Some{"review-list"} : Maybe<&2, String>}

law review_main_with_grades:
  {List.length(&2, V.ViewNode, V.kidsOf(mainAll())) == 3n : Nat}

# Sem o aluno ter aberto o "Como foi?", a coluna é só progresso e cartão.
law review_main_without_grades:
  {List.length(&2, V.ViewNode, V.kidsOf(first(boardNoGrades()))) == 2n : Nat}

law review_card_id:
  {V.attrGet(V.attrsOf(cardAll()), "data-id") == Some{"b2"} : Maybe<&2, String>}

law review_card_question:
  {V.textOf(first(V.kidsOf(kidAt(V.kidsOf(cardAll()), 1n)))) == "Continuidade" : String}

# O cartão do item com tentativa e dificuldade: meta, questão, notas e ações.
law review_card_parts_full:
  {List.length(&2, V.ViewNode, V.kidsOf(N.reviewCard(entryA()))) == 4n : Nat}

# Sem tentativa nem dificuldade, as notas somem (não sobra vão).
law review_card_parts_thin:
  {List.length(&2, V.ViewNode, V.kidsOf(N.reviewCard(entryB()))) == 3n : Nat}

# Com aviso da referência há uma linha a mais, e o botão da citação fica
# desativado.
law review_card_parts_warn:
  {List.length(&2, V.ViewNode, V.kidsOf(N.reviewCard(entryWarn()))) == 4n : Nat}

law review_card_ref_disabled_on_warn:
  {V.attrGet(V.attrsOf(first(V.kidsOf(first(V.kidsOf(N.reviewCard(entryWarn())))))), "disabled") == Some{""} : Maybe<&2, String>}

law review_card_ref_page:
  {V.attrGet(V.attrsOf(first(V.kidsOf(first(V.kidsOf(N.reviewCard(entryA())))))), "data-page") == Some{"3"} : Maybe<&2, String>}

law review_card_ref_text:
  {V.textOf(first(V.kidsOf(first(V.kidsOf(first(V.kidsOf(N.reviewCard(entryA())))))))) == M.msg2("review.ref.named", "name", "Limites.pdf", "page", "3") : String}

# ---------- a lista "Todos os itens" ----------

law review_aside_count:
  {V.textOf(first(V.kidsOf(first(V.kidsOf(first(V.kidsOf(asideAll()))))))) == M.msg("review.all.title") : String}

# Dois grupos quando há o que vence hoje e o que vem depois.
law review_aside_groups:
  {List.length(&2, V.ViewNode, V.kidsOf(kidAt(V.kidsOf(asideAll()), 1n))) == 2n : Nat}

# Só o que vence hoje: um grupo.
law review_aside_one_group:
  {List.length(&2, V.ViewNode, V.kidsOf(kidAt(V.kidsOf(N.reviewAside(entriesLater(), "c3")), 1n))) == 1n : Nat}

law review_aside_group_title:
  {V.textOf(first(V.kidsOf(first(V.kidsOf(first(V.kidsOf(kidAt(V.kidsOf(asideAll()), 1n)))))))) == M.msg("review.group.due") : String}

law review_aside_current_marked:
  {V.attrGet(V.attrsOf(kidAt(V.kidsOf(first(V.kidsOf(kidAt(V.kidsOf(asideAll()), 1n)))), 2n)), "aria-current") == Some{"true"} : Maybe<&2, String>}

law review_aside_other_not_marked:
  {V.attrGet(V.attrsOf(kidAt(V.kidsOf(first(V.kidsOf(kidAt(V.kidsOf(asideAll()), 1n)))), 1n)), "aria-current") == None{} : Maybe<&2, String>}

# ---------- a barra ----------

law review_bar_kids_course:
  {List.length(&2, V.ViewNode, V.kidsOf(barDue())) == 4n : Nat}

law review_bar_kids_bare:
  {List.length(&2, V.ViewNode, V.kidsOf(barBare())) == 3n : Nat}

law review_bar_title:
  {V.textOf(first(V.kidsOf(first(V.kidsOf(barDue()))))) == M.msg("review.title") : String}

law review_bar_course:
  {V.textOf(first(V.kidsOf(kidAt(V.kidsOf(barDue()), 1n)))) == "Cálculo I" : String}

law review_bar_count:
  {V.textOf(first(V.kidsOf(kidAt(V.kidsOf(barDue()), 2n)))) == M.msg2("review.countLine.some", "due", "2", "total", "3") : String}

law review_bar_close_handler:
  {V.attrGet(V.attrsOf(kidAt(V.kidsOf(barDue()), 3n)), "on:click") == Some{"CloseReview"} : Maybe<&2, String>}

law review_bar_close_label:
  {V.attrGet(V.attrsOf(kidAt(V.kidsOf(barDue()), 3n)), "aria-label") == Some{M.msg("review.close")} : Maybe<&2, String>}

# ---------- o diálogo ----------

law review_dialog_kids:
  {List.length(&2, V.ViewNode, dialogHere()) == 6n : Nat}

law review_dialog_question_id:
  {V.attrGet(V.attrsOf(kidAt(V.kidsOf(kidAt(dialogHere(), 2n)), 1n)), "id") == Some{"review-question"} : Maybe<&2, String>}

law review_dialog_save_id:
  {V.attrGet(V.attrsOf(kidAt(V.kidsOf(kidAt(dialogHere(), 5n)), 1n)), "id") == Some{"review-save"} : Maybe<&2, String>}

law review_dialog_ref_hint:
  {V.textOf(first(V.kidsOf(kidAt(dialogHere(), 1n)))) == M.msg2("review.refHint.named", "name", "Limites.pdf", "page", "3") : String}

law review_save_action_label:
  {N.saveActionLabel() == M.msg("review.saveForReview") : String}

law review_draft_fill:
  {N.canFillDraft(True{}, True{}, True{}) == True{} : Bool}
law review_draft_closed:
  {N.canFillDraft(False{}, True{}, True{}) == False{} : Bool}
law review_draft_stale:
  {N.canFillDraft(True{}, False{}, True{}) == False{} : Bool}
law review_draft_edited:
  {N.canFillDraft(True{}, True{}, False{}) == False{} : Bool}

# O caderno guarda trechos da resposta do tutor (CONTEXT.md).
law review_empty_title:
  {N.emptyTitle() == M.msg("review.empty.title") : String}

law review_empty_lead:
  {N.emptyLead() == M.msg("review.empty.lead") : String}

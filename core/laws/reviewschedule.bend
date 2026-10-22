import Base
import ../msg.bend as M
import ../reviewschedule.bend as N
import ../view.bend as V

# ---------------------------------------------------------------------------
# Contrato da agenda do caderno de revisão (Mesa). Prefixo `sched_`.
#
# Os fatos chegam resolvidos (dia civil local, estado guardado, resultado
# marcado) e as leis fecham em valores concretos: o que se prova é a REGRA que
# não pode quebrar — intervalo simples e explicável, próxima data em dias
# inteiros, item vencido nunca escondido, histórico no teto e a referência fora
# da biblioteca como estado visível (não como sumiço). I/O, JSON, migração e
# calendário ficam no host.
# ---------------------------------------------------------------------------

def logErrei30() -> N.ReviewLog:
  N.ReviewLog{30n, N.ResultErrei{}}

def logBom31() -> N.ReviewLog:
  N.ReviewLog{31n, N.ResultBom{}}

# ---------- constantes ----------

law sched_history_cap:
  {N.historyCap() == 50n : Nat}

law sched_max_interval:
  {N.maxIntervalDays() == 365n : Nat}

law sched_result_count:
  {N.resultCount() == 4n : Nat}

# ---------- resultado ----------

law sched_tag_errei:
  {N.resultTag(N.ResultErrei{}) == "errei" : String}

law sched_tag_dificil:
  {N.resultTag(N.ResultDificil{}) == "dificil" : String}

law sched_tag_bom:
  {N.resultTag(N.ResultBom{}) == "bom" : String}

law sched_tag_facil:
  {N.resultTag(N.ResultFacil{}) == "facil" : String}

law sched_label_errei:
  {N.resultLabel(N.ResultErrei{}) == M.msg("review.result.missed") : String}

law sched_label_dificil:
  {N.resultLabel(N.ResultDificil{}) == M.msg("review.result.hard") : String}

law sched_label_bom:
  {N.resultLabel(N.ResultBom{}) == M.msg("review.result.good") : String}

law sched_label_facil:
  {N.resultLabel(N.ResultFacil{}) == M.msg("review.result.easy") : String}

law sched_tag_matches:
  {V.boolStr(N.tagMatches(N.ResultBom{}, "bom")) == "true" : String}

law sched_tag_rejects_other:
  {V.boolStr(N.tagMatches(N.ResultBom{}, "errei")) == "false" : String}

law sched_tag_rejects_empty:
  {V.boolStr(N.tagMatches(N.ResultBom{}, "")) == "false" : String}

law sched_order_length:
  {List.length(&2, N.ReviewResult, N.resultsOrder()) == 4n : Nat}

law sched_order_first:
  {List.get(&2, N.ReviewResult, N.resultsOrder(), 0n) == Some{N.ResultErrei{}} : Maybe<&2, N.ReviewResult>}

law sched_order_last:
  {List.get(&2, N.ReviewResult, N.resultsOrder(), 3n) == Some{N.ResultFacil{}} : Maybe<&2, N.ReviewResult>}

# ---------- primeiro intervalo ----------

law sched_first_errei:
  {N.firstInterval(N.ResultErrei{}) == 1n : Nat}

law sched_first_dificil:
  {N.firstInterval(N.ResultDificil{}) == 1n : Nat}

law sched_first_bom:
  {N.firstInterval(N.ResultBom{}) == 1n : Nat}

law sched_first_facil:
  {N.firstInterval(N.ResultFacil{}) == 3n : Nat}

# ---------- crescimento ----------

law sched_grow_errei_resets:
  {N.growInterval(30n, N.ResultErrei{}) == 1n : Nat}

law sched_grow_dificil_slow:
  {N.growInterval(10n, N.ResultDificil{}) == 12n : Nat}

law sched_grow_dificil_floor:
  {N.growInterval(1n, N.ResultDificil{}) == 1n : Nat}

law sched_grow_bom_doubles:
  {N.growInterval(10n, N.ResultBom{}) == 25n : Nat}

law sched_grow_bom_floor:
  {N.growInterval(1n, N.ResultBom{}) == 2n : Nat}

law sched_grow_facil_fast:
  {N.growInterval(10n, N.ResultFacil{}) == 35n : Nat}

law sched_grow_facil_floor:
  {N.growInterval(1n, N.ResultFacil{}) == 3n : Nat}

law sched_grow_capped:
  {N.growInterval(365n, N.ResultBom{}) == 365n : Nat}

law sched_grow_capped_facil:
  {N.growInterval(365n, N.ResultFacil{}) == 365n : Nat}

# ---------- próximo intervalo e próxima data ----------

law sched_next_first_uses_result:
  {N.nextInterval(0n, N.ResultFacil{}) == 3n : Nat}

law sched_next_grows:
  {N.nextInterval(10n, N.ResultBom{}) == 25n : Nat}

law sched_due_from_today:
  {N.nextDue(100n, 0n, N.ResultBom{}) == 101n : Nat}

law sched_due_from_today_facil:
  {N.nextDue(100n, 0n, N.ResultFacil{}) == 103n : Nat}

law sched_due_from_interval:
  {N.nextDue(100n, 10n, N.ResultBom{}) == 125n : Nat}

# Vencido inclui o atrasado: nunca é escondido atrás de número negativo.
law sched_due_today:
  {V.boolStr(N.isDue(100n, 100n)) == "true" : String}

law sched_due_overdue:
  {V.boolStr(N.isDue(99n, 100n)) == "true" : String}

law sched_due_future:
  {V.boolStr(N.isDue(101n, 100n)) == "false" : String}

law sched_interval_label_one:
  {N.intervalLabel(1n) == M.msg1("review.interval", "count", "1") : String}

law sched_interval_label_many:
  {N.intervalLabel(3n) == M.msg1("review.interval", "count", "3") : String}

# O 1 dia é "amanhã"; nunca "em 1 dia".
law sched_return_label_tomorrow:
  {N.returnLabel(1n) == M.msg("review.when.tomorrow") : String}

law sched_return_label_many:
  {N.returnLabel(3n) == M.msg1("review.when.inDays", "count", "3") : String}

law sched_return_label_week:
  {N.returnLabel(14n) == M.msg1("review.when.inDays", "count", "14") : String}

# ---------- transição ----------

law sched_state_bom:
  {N.stateAfter(100n, N.ScheduleState{10n, 3n, 1n, 100n}, N.ResultBom{}) == N.ScheduleState{25n, 4n, 1n, 125n} : N.ScheduleState}

law sched_state_errei_resets_reps:
  {N.stateAfter(100n, N.ScheduleState{10n, 3n, 1n, 100n}, N.ResultErrei{}) == N.ScheduleState{1n, 0n, 2n, 101n} : N.ScheduleState}

law sched_state_facil:
  {N.stateAfter(100n, N.ScheduleState{10n, 3n, 1n, 100n}, N.ResultFacil{}) == N.ScheduleState{35n, 4n, 1n, 135n} : N.ScheduleState}

law sched_migrated_due_today:
  {N.migratedState(100n) == N.ScheduleState{0n, 0n, 0n, 100n} : N.ScheduleState}

# ---------- histórico ----------

law sched_history_empty_starts:
  {N.pushHistory(Nil{}, logBom31()) == [logBom31()] : List<&2, N.ReviewLog>}

law sched_history_new_first:
  {List.get(&2, N.ReviewLog, N.pushHistory([logErrei30()], logBom31()), 0n) == Some{logBom31()} : Maybe<&2, N.ReviewLog>}

law sched_history_keeps_old:
  {List.get(&2, N.ReviewLog, N.pushHistory([logErrei30()], logBom31()), 1n) == Some{logErrei30()} : Maybe<&2, N.ReviewLog>}

law sched_history_caps:
  {List.length(&2, N.ReviewLog, N.pushHistory(List.replicate(N.ReviewLog, 50n, logErrei30()), logBom31())) == 50n : Nat}

law sched_history_cap_drops_oldest:
  {List.get(&2, N.ReviewLog, N.pushHistory(List.replicate(N.ReviewLog, 50n, logErrei30()), logBom31()), 49n) == Some{logErrei30()} : Maybe<&2, N.ReviewLog>}

# ---------- identidade ----------

law sched_key_source:
  {N.keySource("  Limites  ", " Limites.pdf ", 3n, " /p/L.pdf ") == "Limites|Limites.pdf|3|/p/L.pdf" : String}

law sched_same_id:
  {V.boolStr(N.sameId("ab", "ab")) == "true" : String}

law sched_same_id_other:
  {V.boolStr(N.sameId("ab", "ac")) == "false" : String}

# ---------- referência visível ----------

law sched_ref_without_path:
  {N.refState(False{}, True{}, False{}) == N.RefOk{} : N.RefState}

law sched_ref_inside_library:
  {N.refState(True{}, False{}, True{}) == N.RefOk{} : N.RefState}

law sched_ref_outside_library:
  {N.refState(True{}, False{}, False{}) == N.RefOutside{} : N.RefState}

law sched_ref_missing_file:
  {N.refState(True{}, True{}, True{}) == N.RefMissing{} : N.RefState}

law sched_ref_missing_wins:
  {N.refState(True{}, True{}, False{}) == N.RefMissing{} : N.RefState}

law sched_ref_note_ok:
  {N.refNote(N.RefOk{}) == "" : String}

law sched_ref_note_missing:
  {N.refNote(N.RefMissing{}) == M.msg("review.refNote.missing") : String}

law sched_ref_note_outside:
  {N.refNote(N.RefOutside{}) == M.msg("review.refNote.outside") : String}

# ---------- explicação ----------

law sched_explain_first:
  {N.explain(0n, N.ResultErrei{}) == M.msg("review.explain.first.missed") : String}

law sched_explain_first_facil:
  {N.explain(0n, N.ResultFacil{}) == M.msg("review.explain.first.easy") : String}

law sched_explain_errei:
  {N.explain(10n, N.ResultErrei{}) == M.msg("review.explain.grow.missed") : String}

law sched_explain_bom:
  {N.explain(10n, N.ResultBom{}) == M.msg1("review.explain.grow.good", "count", "25") : String}

law sched_explain_dificil:
  {N.explain(10n, N.ResultDificil{}) == M.msg1("review.explain.grow.hard", "count", "12") : String}

law sched_explain_facil:
  {N.explain(10n, N.ResultFacil{}) == M.msg1("review.explain.grow.easy", "count", "35") : String}

# ---------- rótulos ----------

law sched_next_label_today:
  {N.nextLabel(100n, 100n) == M.msg("review.when.today") : String}

law sched_next_label_overdue_is_today:
  {N.nextLabel(99n, 100n) == M.msg("review.when.today") : String}

law sched_next_label_tomorrow:
  {N.nextLabel(101n, 100n) == M.msg("review.when.tomorrow") : String}

law sched_next_label_days:
  {N.nextLabel(103n, 100n) == M.msg1("review.when.inDays", "count", "3") : String}

law sched_next_label_one_day:
  {N.nextLabel(101n, 100n) == M.msg("review.when.tomorrow") : String}

law sched_due_count_zero:
  {N.dueCount(0n) == M.msg("review.dueCount.none") : String}

law sched_due_count_one:
  {N.dueCount(1n) == M.msg1("review.dueCount", "count", "1") : String}

law sched_due_count_many:
  {N.dueCount(3n) == M.msg1("review.dueCount", "count", "3") : String}

law sched_today_title:
  {N.reviewTodayTitle() == M.msg("review.today.title") : String}

law sched_no_due_text:
  {N.noDueText() == M.msg("review.noDue") : String}

law sched_history_title:
  {N.historyTitle() == M.msg("review.history.title") : String}

law sched_history_empty:
  {N.historyEmpty() == M.msg("review.history.empty") : String}

law sched_all_courses:
  {N.allCoursesLabel() == M.msg("common.allCourses") : String}

law sched_not_in_notebook:
  {N.notInNotebook() == M.msg("review.notInNotebook") : String}

law sched_grade_note_errei:
  {N.gradeNote(N.ResultErrei{}) == M.msg("review.gradeNote.missed") : String}

law sched_grade_note_facil:
  {N.gradeNote(N.ResultFacil{}) == M.msg("review.gradeNote.easy") : String}

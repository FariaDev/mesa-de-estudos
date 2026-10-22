import Base
import msg.bend as M

# ---------------------------------------------------------------------------
# Caderno de revisão — agenda (Mesa).
#
# O host entrega fatos já resolvidos (o dia civil local, o estado guardado do
# item, o resultado que o aluno marcou, se o arquivo de referência ainda existe
# e se ele está na biblioteca da matéria) e este núcleo decide as REGRAS que não
# podem quebrar:
#   - resultado: quatro rótulos fechados (Errei/Difícil/Bom/Fácil) casados por
#     tag; nada fora dessa lista entra;
#   - intervalo: simples e explicável — Errei volta para 1 dia; Difícil cresce
#     devagar (1,2×); Bom dobra; Fácil cresce mais rápido (3,5×); item novo tem
#     o primeiro intervalo por resultado (1/1/1/3); teto de 365 dias;
#   - próxima revisão: dia local + intervalo (a data sai em dias inteiros, sem
#     horário — o fuso já veio resolvido pelo host);
#   - vencido: `due <= hoje` (o passado também está vencido, nunca é escondido);
#   - Errei zera a sequência de acertos e soma uma lapso; os outros somam um
#     acerto;
#   - histórico: mais novo primeiro, no teto de 50;
#   - identidade: a chave estável nasce de questão + nome + página + caminho,
#     aparados — reabrir o caderno nunca duplica o mesmo item;
#   - referência: fora da biblioteca ou não encontrada NÃO é sumir com o item —
#     é um estado visível (`RefOutside`/`RefMissing`) com aviso próprio.
#
# I/O, JSON, migração do schema antigo e datas de calendário ficam no host
# (`desk/src/study-data/review-schedule.cjs`). Sem referência para frente:
# helpers vêm antes de quem chama. Um match de Bool por def: o checker recusa
# Bool aninhado em Bool.
# ---------------------------------------------------------------------------

type ReviewResult is Data:
  ResultErrei{}
  ResultDificil{}
  ResultBom{}
  ResultFacil{}

type ScheduleState is Data:
  ScheduleState{interval: Nat, reps: Nat, lapses: Nat, due: Nat}

type ReviewLog is Data:
  ReviewLog{day: Nat, result: ReviewResult}

type RefState is Data:
  RefOk{}
  RefMissing{}
  RefOutside{}

# ---------- constantes ----------

def historyCap() -> Nat:
  50n

def maxIntervalDays() -> Nat:
  365n

def resultCount() -> Nat:
  4n

# ---------- resultado ----------

def resultTag(result: ReviewResult) -> String:
  match result:
    case ResultErrei{}:
      "errei"
    case ResultDificil{}:
      "dificil"
    case ResultBom{}:
      "bom"
    case ResultFacil{}:
      "facil"

def resultLabel(result: ReviewResult) -> String:
  match result:
    case ResultErrei{}:
      M.msg("review.result.missed")
    case ResultDificil{}:
      M.msg("review.result.hard")
    case ResultBom{}:
      M.msg("review.result.good")
    case ResultFacil{}:
      M.msg("review.result.easy")

# A ordem dos botões de resultado (o host casa a tag contra cada um).
def resultsOrder() -> List<&2, ReviewResult>:
  [ResultErrei{}, ResultDificil{}, ResultBom{}, ResultFacil{}]

# Validação por tag: só as quatro tags fechadas casam.
def tagMatches(result: ReviewResult, tag: String) -> Bool:
  String.eq(resultTag(result), tag)

# ---------- intervalo ----------

def firstInterval(result: ReviewResult) -> Nat:
  match result:
    case ResultErrei{}:
      1n
    case ResultDificil{}:
      1n
    case ResultBom{}:
      1n
    case ResultFacil{}:
      3n

# Crescimento por resultado, piso 1 e teto de 365.
# Difícil 1,2× = 6/5; Bom 2,5× = 5/2; Fácil 3,5× = 7/2.
def growInterval(prev: Nat, result: ReviewResult) -> Nat:
  match result:
    case ResultErrei{}:
      1n
    case ResultDificil{}:
      Nat.min(Nat.div(Nat.mul(prev, 6n), 5n), maxIntervalDays())
    case ResultBom{}:
      Nat.min(Nat.div(Nat.mul(prev, 5n), 2n), maxIntervalDays())
    case ResultFacil{}:
      Nat.min(Nat.div(Nat.mul(prev, 7n), 2n), maxIntervalDays())

def intervalZero(prev: Nat, result: ReviewResult, zero: Bool) -> Nat:
  match zero:
    case True{}:
      firstInterval(result)
    case False{}:
      growInterval(prev, result)

def nextInterval(+prev: Nat, result: ReviewResult) -> Nat:
  intervalZero(prev, result, Nat.is_eq(prev, 0n))

def nextDue(today: Nat, prev: Nat, result: ReviewResult) -> Nat:
  Nat.add(today, nextInterval(prev, result))

def isDue(due: Nat, today: Nat) -> Bool:
  Nat.is_le(due, today)

def intervalLabel(+days: Nat) -> String:
  M.msg1("review.interval", "count", Nat.show(days))

# Quando o item volta, na fala do aluno: "amanhã" ou "em N dias" (o 1 dia
# é amanhã; nunca "em 1 dia").
def returnLabel.if(days: Nat, tomorrow: Bool) -> String:
  match tomorrow:
    case True{}:
      M.msg("review.when.tomorrow")
    case False{}:
      M.msg1("review.when.inDays", "count", Nat.show(days))

def returnLabel(+days: Nat) -> String:
  returnLabel.if(days, Nat.is_le(days, 1n))

# A mesma fala já com o verbo: "volta amanhã" / "volta em N dias".
def returnsLabel.if(days: Nat, tomorrow: Bool) -> String:
  match tomorrow:
    case True{}:
      M.msg("review.returns.tomorrow")
    case False{}:
      M.msg1("review.returns.inDays", "count", Nat.show(days))

def returnsLabel(+days: Nat) -> String:
  returnsLabel.if(days, Nat.is_le(days, 1n))

# ---------- estado (transição) ----------

def nextReps(reps: Nat, result: ReviewResult) -> Nat:
  match result:
    case ResultErrei{}:
      0n
    case ResultDificil{}:
      Nat.add(reps, 1n)
    case ResultBom{}:
      Nat.add(reps, 1n)
    case ResultFacil{}:
      Nat.add(reps, 1n)

def nextLapses(lapses: Nat, result: ReviewResult) -> Nat:
  match result:
    case ResultErrei{}:
      Nat.add(lapses, 1n)
    case ResultDificil{}:
      lapses
    case ResultBom{}:
      lapses
    case ResultFacil{}:
      lapses

def stateAfter(today: Nat, state: ScheduleState, +result: ReviewResult) -> ScheduleState:
  match state:
    case ScheduleState{+interval, reps, lapses, _}:
      ScheduleState{
        nextInterval(interval, result),
        nextReps(reps, result),
        nextLapses(lapses, result),
        nextDue(today, interval, result)
      }

# Item antigo (schema sem agenda) entra vencendo hoje, sem intervalo e sem
# histórico — o registro do aluno nunca fica escondido esperando uma data.
def migratedState(today: Nat) -> ScheduleState:
  ScheduleState{0n, 0n, 0n, today}

# ---------- histórico ----------

def pushHistory(history: List<&2, ReviewLog>, log: ReviewLog) -> List<&2, ReviewLog>:
  List.take(&2, ReviewLog, Con{log, history}, historyCap())

# ---------- identidade estável ----------

# A chave nasce de questão + nome + página + caminho, aparados; o host faz o
# resumo (hash) e guarda só ele. Reabrir o caderno com o mesmo item dá a mesma
# chave; editar a questão dá uma chave nova (e o histórico do antigo fica).
def keySource(question: String, name: String, page: Nat, path: String) -> String:
  String.append(
    String.trim(question),
    String.append(
      "|",
      String.append(
        String.trim(name),
        String.append("|", String.append(Nat.show(page), String.append("|", String.trim(path))))
      )
    )
  )

def sameId(a: String, b: String) -> Bool:
  String.eq(a, b)

# ---------- referência (visível, nunca escondida) ----------

def refState.lib(inLibrary: Bool) -> RefState:
  match inLibrary:
    case True{}:
      RefOk{}
    case False{}:
      RefOutside{}

def refState.missing(missing: Bool, inLibrary: Bool) -> RefState:
  match missing:
    case True{}:
      RefMissing{}
    case False{}:
      refState.lib(inLibrary)

# Sem caminho não há o que checar: nada falta. Com caminho, o host diz se o
# arquivo não existe e se está fora da biblioteca da matéria.
def refState(hasPath: Bool, missing: Bool, inLibrary: Bool) -> RefState:
  match hasPath:
    case False{}:
      RefOk{}
    case True{}:
      refState.missing(missing, inLibrary)

def refNote(state: RefState) -> String:
  match state:
    case RefOk{}:
      ""
    case RefMissing{}:
      M.msg("review.refNote.missing")
    case RefOutside{}:
      M.msg("review.refNote.outside")

# ---------- explicação e rótulos ----------

def explainFirst(result: ReviewResult) -> String:
  match result:
    case ResultErrei{}:
      M.msg("review.explain.first.missed")
    case ResultDificil{}:
      M.msg("review.explain.first.hard")
    case ResultBom{}:
      M.msg("review.explain.first.good")
    case ResultFacil{}:
      M.msg("review.explain.first.easy")

def explainGrow(result: ReviewResult, next: Nat) -> String:
  match result:
    case ResultErrei{}:
      M.msg("review.explain.grow.missed")
    case ResultDificil{}:
      M.msg1("review.explain.grow.hard", "count", Nat.show(next))
    case ResultBom{}:
      M.msg1("review.explain.grow.good", "count", Nat.show(next))
    case ResultFacil{}:
      M.msg1("review.explain.grow.easy", "count", Nat.show(next))

def explainFrom(prev: Nat, result: ReviewResult, next: Nat, first: Bool) -> String:
  match first:
    case True{}:
      explainFirst(result)
    case False{}:
      explainGrow(result, next)

def explain(+prev: Nat, +result: ReviewResult) -> String:
  explainFrom(prev, result, nextInterval(prev, result), Nat.is_eq(prev, 0n))

# Quanto falta: hoje, amanhã ou em N dias. O vencido é "hoje" (nunca fica
# escondido atrás de um número negativo).
def dayDiff(due: Nat, today: Nat) -> Nat:
  Nat.sub(due, today)

def nextLabel.tomorrow(due: Nat, today: Nat, tomorrow: Bool) -> String:
  match tomorrow:
    case True{}:
      M.msg("review.when.tomorrow")
    case False{}:
      M.msg1("review.when.inDays", "count", Nat.show(dayDiff(due, today)))

def nextLabel.due(+due: Nat, +today: Nat, now: Bool) -> String:
  match now:
    case True{}:
      M.msg("review.when.today")
    case False{}:
      nextLabel.tomorrow(due, today, Nat.is_eq(dayDiff(due, today), 1n))

def nextLabel(+due: Nat, +today: Nat) -> String:
  nextLabel.due(due, today, Nat.is_le(due, today))

def reviewTodayTitle() -> String:
  M.msg("review.today.title")

def filterLabel() -> String:
  M.msg("review.filter")

def allCoursesLabel() -> String:
  M.msg("common.allCourses")

def dueCount.some(+n: Nat) -> String:
  M.msg1("review.dueCount", "count", Nat.show(n))

def dueCount.zero(+n: Nat, zero: Bool) -> String:
  match zero:
    case True{}:
      M.msg("review.dueCount.none")
    case False{}:
      dueCount.some(n)

def dueCount(+n: Nat) -> String:
  dueCount.zero(n, Nat.is_eq(n, 0n))

def noDueText() -> String:
  M.msg("review.noDue")

def historyTitle() -> String:
  M.msg("review.history.title")

def historyEmpty() -> String:
  M.msg("review.history.empty")

def nextReviewPrefix() -> String:
  M.msg("review.next.prefix")

def notInNotebook() -> String:
  M.msg("review.notInNotebook")

def gradeNote(result: ReviewResult) -> String:
  match result:
    case ResultErrei{}:
      M.msg("review.gradeNote.missed")
    case ResultDificil{}:
      M.msg("review.gradeNote.hard")
    case ResultBom{}:
      M.msg("review.gradeNote.good")
    case ResultFacil{}:
      M.msg("review.gradeNote.easy")

import Base
import msg.bend as M

# ---------------------------------------------------------------------------
# Estatísticas locais de estudo (Mesa).
#
# O host entrega fatos já resolvidos (o relógio, a visibilidade da janela, o
# congelamento do sistema, o fuso, o resultado do provedor) e este núcleo
# decide as REGRAS que não podem quebrar:
#   - tempo ativo: só conta batimento com a sessão rodando, a janela visível e
#     o sistema acordado, e só quando o intervalo entre batimentos cabe no teto
#     (`maxGap`). Intervalo maior = evidência perdida (app parado, suspenso ou
#     batimento atrasado): NÃO inventa segundos;
#   - dia/fuso: o dia civil local sai de época + deslocamento (leste/oeste,
#     magnitudes separadas porque `Nat.sub` satura);
#   - período: janela de 7/30 dias ou tudo, com o mesmo dia de corte;
#   - prompts: só a mensagem do usuário ACEITA e não duplicada conta;
#   - tokens: `input`, `output` e `cache` separados; o provedor que não informa
#     fica `indisponível` e a soma nunca transforma falta em zero comprovado;
#   - sessão só entra com tempo ativo maior que zero.
#
# I/O, JSON, ordenação e o agrupamento por matéria ficam no host
# (`desk/src/study-data/statistics.cjs`). Sem referência para frente: helpers
# vêm antes de quem chama.
# ---------------------------------------------------------------------------

type StatPeriod is Data:
  PeriodWeek{}
  PeriodMonth{}
  PeriodAll{}

# Um contador de token com a marca de disponibilidade. `available=False` é
# "o provedor não informou", não "zero".
type TokenCount is Data:
  TokenCount{available: Bool, count: Nat}

type StatsUsage is Data:
  StatsUsage{input: TokenCount, output: TokenCount, cache: TokenCount}

# ---------- constantes ----------

# Cadência do batimento do host (segundos).
def heartbeatInterval() -> Nat:
  30n

# Teto do intervalo entre batimentos: acima disso a janela pode ter ficado
# parada/suspensa sem evento — o intervalo não vira tempo de estudo.
def maxGap() -> Nat:
  90n

def secondsPerMinute() -> Nat:
  60n

def secondsPerHour() -> Nat:
  3600n

def secondsPerDay() -> Nat:
  86400n

# Teto de exibição das barras (o host recorta o período antes).
def maxHistoryDays() -> Nat:
  366n

# ---------- tempo ativo ----------

def gapSeconds(prev: Nat, now: Nat) -> Nat:
  Nat.sub(now, prev)

def gapOk(+prev: Nat, +now: Nat) -> Bool:
  Bool.and(Nat.is_gt(now, prev), Nat.is_le(Nat.sub(now, prev), maxGap()))

def gapSeconds.if(prev: Nat, now: Nat, ok: Bool) -> Nat:
  match ok:
    case True{}:
      gapSeconds(prev, now)
    case False{}:
      0n

def gapSeconds.checked(+prev: Nat, +now: Nat) -> Nat:
  gapSeconds.if(prev, now, gapOk(prev, now))

# A sessão precisa estar rodando (timer explícito) para o batimento valer.
def activeEvidence(prev: Nat, now: Nat, running: Bool) -> Nat:
  match running:
    case False{}:
      0n
    case True{}:
      gapSeconds.checked(prev, now)

# Um match de Bool por def (o checker recusa matches de Bool aninhados); a
# cascata é a mesma decisão: visível E acordado para o batimento valer.
def activeFrozen(prev: Nat, now: Nat, running: Bool, frozen: Bool) -> Nat:
  match frozen:
    case True{}:
      0n
    case False{}:
      activeEvidence(prev, now, running)

# Visível e acordado são evidências do host; faltando uma, o intervalo não
# conta — sem "modo escuro" que estime tempo sem prova.
def activeVisible(prev: Nat, now: Nat, running: Bool, frozen: Bool, visible: Bool) -> Nat:
  match visible:
    case False{}:
      0n
    case True{}:
      activeFrozen(prev, now, running, frozen)

def activeSeconds(prev: Nat, now: Nat, running: Bool, frozen: Bool, visible: Bool) -> Nat:
  activeVisible(prev, now, running, frozen, visible)

def qualifiesSession(seconds: Nat) -> Bool:
  Nat.is_gt(seconds, 0n)

# ---------- dia civil no fuso ----------

def offsetSeconds(minutes: Nat) -> Nat:
  Nat.mul(minutes, secondsPerMinute())

# UTC-3 vira (180, west=True); UTC+2 vira (120, west=False). A magnitude é
# separada do sinal porque `Nat.sub` satura em zero.
def localSeconds(seconds: Nat, offsetMinutes: Nat, west: Bool) -> Nat:
  match west:
    case True{}:
      Nat.sub(seconds, offsetSeconds(offsetMinutes))
    case False{}:
      Nat.add(seconds, offsetSeconds(offsetMinutes))

def dayNumber(seconds: Nat, offsetMinutes: Nat, west: Bool) -> Nat:
  Nat.div(localSeconds(seconds, offsetMinutes, west), secondsPerDay())

# ---------- período ----------

def periodDays(period: StatPeriod) -> Nat:
  match period:
    case PeriodWeek{}:
      7n
    case PeriodMonth{}:
      30n
    case PeriodAll{}:
      0n

def periodAll(period: StatPeriod) -> Bool:
  match period:
    case PeriodAll{}:
      True{}
    case PeriodWeek{}:
      False{}
    case PeriodMonth{}:
      False{}

def startFrom(today: Nat, days: Nat, all: Bool) -> Nat:
  match all:
    case True{}:
      0n
    case False{}:
      Nat.sub(today, Nat.sub(days, 1n))

# Primeiro dia da janela (7 dias incluem hoje: hoje-6 .. hoje).
def windowStart(today: Nat, +period: StatPeriod) -> Nat:
  startFrom(today, periodDays(period), periodAll(period))

def inWindow(+day: Nat, start: Nat, today: Nat) -> Bool:
  Bool.and(Nat.is_ge(day, start), Nat.is_le(day, today))

def inPeriod(day: Nat, +today: Nat, +period: StatPeriod) -> Bool:
  inWindow(day, windowStart(today, period), today)

# ---------- contadores de token ----------

def token(has: Bool, count: Nat) -> TokenCount:
  match has:
    case False{}:
      TokenCount{False{}, 0n}
    case True{}:
      TokenCount{True{}, count}

# Falta + número = número: o número veio do provedor e continua sendo
# evidência; falta + falta = falta. Nunca vira zero comprovado.
def tokenAdd(a: TokenCount, b: TokenCount) -> TokenCount:
  match a:
    case TokenCount{available, count}:
      match b:
        case TokenCount{available2, count2}:
          TokenCount{Bool.or(available, available2), Nat.add(count, count2)}

def tokenLabel(tc: TokenCount) -> String:
  match tc:
    case TokenCount{available, count}:
      match available:
        case True{}:
          Nat.show(count)
        case False{}:
          M.msg("stats.unavailable")

def unavailableLabel() -> String:
  M.msg("stats.unavailable")

def usageEmpty() -> StatsUsage:
  StatsUsage{token(False{}, 0n), token(False{}, 0n), token(False{}, 0n)}

def usageAdd(a: StatsUsage, b: StatsUsage) -> StatsUsage:
  match a:
    case StatsUsage{+input, +output, +cache}:
      match b:
        case StatsUsage{+input2, +output2, +cache2}:
          StatsUsage{tokenAdd(input, input2), tokenAdd(output, output2), tokenAdd(cache, cache2)}

# ---------- prompts ----------

# Só mensagem do usuário ACEITA e que não é repetição entra na conta. Recusa
# (o motor não aceitou o envio) e reenvio duplicado ficam fora.
def addsPrompt(accepted: Bool, duplicate: Bool) -> Bool:
  match accepted:
    case False{}:
      False{}
    case True{}:
      Bool.not(duplicate)

# ---------- percentual (barras e legendas) ----------

def percent.if(part: Nat, total: Nat, zero: Bool) -> Nat:
  match zero:
    case True{}:
      0n
    case False{}:
      Nat.div(Nat.mul(part, 100n), total)

def percent(part: Nat, +total: Nat) -> Nat:
  percent.if(part, total, Nat.is_eq(total, 0n))

# ---------- formatação ----------

def pad2.if(n: Nat, small: Bool) -> String:
  match small:
    case True{}:
      String.append("0", Nat.show(n))
    case False{}:
      Nat.show(n)

def pad2(+n: Nat) -> String:
  pad2.if(n, Nat.is_lt(n, 10n))

def minutesOf(seconds: Nat) -> Nat:
  Nat.div(Nat.mod(seconds, secondsPerHour()), secondsPerMinute())

def hoursOf(seconds: Nat) -> Nat:
  Nat.div(seconds, secondsPerHour())

# 0 → "0 min"; 1..59 → "menos de 1 min"; 60..3599 → "N min";
# hora cheia → "N h"; senão → "N h MM min". Mensagens do catálogo (#41): o
# texto e a unidade são do idioma, a conta é daqui.
def durationHour(+seconds: Nat, exactHour: Bool) -> String:
  match exactHour:
    case True{}:
      M.msg1("stats.duration.hours", "hours", Nat.show(hoursOf(seconds)))
    case False{}:
      M.msg2("stats.duration.hoursMinutes", "hours", Nat.show(hoursOf(seconds)), "minutes", pad2(minutesOf(seconds)))

def durationHasHour(+seconds: Nat, hasHour: Bool) -> String:
  match hasHour:
    case False{}:
      M.msg1("stats.duration.minutes", "minutes", Nat.show(minutesOf(seconds)))
    case True{}:
      durationHour(seconds, Nat.is_eq(minutesOf(seconds), 0n))

def durationUnder(+seconds: Nat, under: Bool) -> String:
  match under:
    case True{}:
      M.msg("stats.duration.under")
    case False{}:
      durationHasHour(seconds, Nat.is_ge(seconds, secondsPerHour()))

def durationLabel.if(+seconds: Nat, zero: Bool) -> String:
  match zero:
    case True{}:
      M.msg("stats.duration.zero")
    case False{}:
      durationUnder(seconds, Nat.is_lt(seconds, secondsPerMinute()))

def durationLabel(+seconds: Nat) -> String:
  durationLabel.if(seconds, Nat.is_eq(seconds, 0n))

def weekdayLabel(index: Nat) -> String:
  match index:
    case 0n:
      M.msg("stats.weekday.short.sun")
    case 1n:
      M.msg("stats.weekday.short.mon")
    case 2n:
      M.msg("stats.weekday.short.tue")
    case 3n:
      M.msg("stats.weekday.short.wed")
    case 4n:
      M.msg("stats.weekday.short.thu")
    case 5n:
      M.msg("stats.weekday.short.fri")
    case 6n:
      M.msg("stats.weekday.short.sat")
    case _:
      ""

# ---------- rótulos ----------

def periodTitle(period: StatPeriod) -> String:
  match period:
    case PeriodWeek{}:
      M.msg("stats.periodTitle.week")
    case PeriodMonth{}:
      M.msg("stats.periodTitle.month")
    case PeriodAll{}:
      M.msg("stats.periodTitle.all")

def countLabel(n: Nat) -> String:
  Nat.show(n)

# ---------- o botão do cronômetro ----------

# O que o host recebe quando o aluno aperta a ação: pausar o que roda; retomar
# a sessão que existe; ou começar, quando nunca houve uma.
def timerVerb.idle(hasSession: Bool) -> String:
  match hasSession:
    case True{}:
      "resume"
    case False{}:
      "start"

def timerVerb(running: Bool, hasSession: Bool) -> String:
  match running:
    case True{}:
      "pause"
    case False{}:
      timerVerb.idle(hasSession)

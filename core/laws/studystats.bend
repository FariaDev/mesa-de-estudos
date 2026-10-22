import Base
import ../studystats.bend as N
import ../msg.bend as M
import ../view.bend as V

# ---------------------------------------------------------------------------
# Contrato das estatísticas locais de estudo (Mesa). Prefixo `stats_`.
#
# Os fatos chegam resolvidos (batimentos, fuso em magnitude + lado, tokens do
# provedor) e as leis fecham em valores concretos: o que se prova é a REGRA que
# não pode quebrar — o que conta como tempo ativo, como época vira dia civil no
# fuso, o que entra em cada período, como tokens ausentes não viram zero e como
# os rótulos saem. O arquivo, a soma por matéria e a ordenação ficam no host.
# ---------------------------------------------------------------------------

# ---------- tetos ----------

law stats_heartbeat_interval:
  {N.heartbeatInterval() == 30n : Nat}

law stats_max_gap:
  {N.maxGap() == 90n : Nat}

law stats_seconds_per_day:
  {N.secondsPerDay() == 86400n : Nat}

law stats_max_history_days:
  {N.maxHistoryDays() == 366n : Nat}

# ---------- tempo ativo: só com evidência ----------

law stats_gap_ok:
  {N.gapSeconds.checked(100n, 130n) == 30n : Nat}

law stats_gap_exact_cap:
  {N.gapSeconds.checked(100n, 190n) == 90n : Nat}

law stats_gap_over_cap_is_zero:
  {N.gapSeconds.checked(100n, 191n) == 0n : Nat}

law stats_gap_zero_is_zero:
  {N.gapSeconds.checked(100n, 100n) == 0n : Nat}

law stats_gap_backwards_is_zero:
  {N.gapSeconds.checked(130n, 100n) == 0n : Nat}

law stats_active_counts_gap:
  {N.activeSeconds(100n, 130n, True{}, False{}, True{}) == 30n : Nat}

law stats_active_not_running:
  {N.activeSeconds(100n, 130n, False{}, False{}, True{}) == 0n : Nat}

law stats_active_frozen:
  {N.activeSeconds(100n, 130n, True{}, True{}, True{}) == 0n : Nat}

law stats_active_hidden:
  {N.activeSeconds(100n, 130n, True{}, False{}, False{}) == 0n : Nat}

law stats_active_hidden_frozen:
  {N.activeSeconds(100n, 130n, True{}, True{}, False{}) == 0n : Nat}

law stats_active_gap_over_cap:
  {N.activeSeconds(100n, 1000n, True{}, False{}, True{}) == 0n : Nat}

law stats_session_zero_does_not_count:
  {V.boolStr(N.qualifiesSession(0n)) == "false" : String}

law stats_session_positive_counts:
  {V.boolStr(N.qualifiesSession(1n)) == "true" : String}

# ---------- dia civil no fuso ----------

law stats_day_utc_start:
  {N.dayNumber(0n, 0n, False{}) == 0n : Nat}

law stats_day_utc_end:
  {N.dayNumber(86399n, 0n, False{}) == 0n : Nat}

law stats_day_utc_rolls:
  {N.dayNumber(86400n, 0n, False{}) == 1n : Nat}

# UTC-3 (oeste, 180): 01:00 UTC ainda é o dia anterior.
law stats_day_west_before_midnight:
  {N.dayNumber(3600n, 180n, True{}) == 0n : Nat}

law stats_day_west_midnight:
  {N.dayNumber(10800n, 180n, True{}) == 0n : Nat}

law stats_day_west_next_day:
  {N.dayNumber(97200n, 180n, True{}) == 1n : Nat}

# UTC+2 (leste, 120): 23:00 UTC já é o dia seguinte.
law stats_day_east_rolls:
  {N.dayNumber(82800n, 120n, False{}) == 1n : Nat}

law stats_day_east_just_before:
  {N.dayNumber(79199n, 120n, False{}) == 0n : Nat}

# A época antes do primeiro dia oeste satura em zero em vez de estourar.
law stats_day_west_saturates:
  {N.dayNumber(60n, 180n, True{}) == 0n : Nat}

# ---------- período ----------

law stats_period_days_week:
  {N.periodDays(N.PeriodWeek{}) == 7n : Nat}

law stats_period_days_month:
  {N.periodDays(N.PeriodMonth{}) == 30n : Nat}

law stats_period_days_all:
  {N.periodDays(N.PeriodAll{}) == 0n : Nat}

law stats_window_week_includes_today:
  {N.windowStart(100n, N.PeriodWeek{}) == 94n : Nat}

law stats_window_month:
  {N.windowStart(100n, N.PeriodMonth{}) == 71n : Nat}

law stats_window_all:
  {N.windowStart(100n, N.PeriodAll{}) == 0n : Nat}

law stats_window_saturates:
  {N.windowStart(3n, N.PeriodWeek{}) == 0n : Nat}

law stats_in_period_start:
  {V.boolStr(N.inPeriod(94n, 100n, N.PeriodWeek{})) == "true" : String}

law stats_in_period_before_start:
  {V.boolStr(N.inPeriod(93n, 100n, N.PeriodWeek{})) == "false" : String}

law stats_in_period_future_is_out:
  {V.boolStr(N.inPeriod(101n, 100n, N.PeriodWeek{})) == "false" : String}

law stats_in_period_all_takes_old:
  {V.boolStr(N.inPeriod(0n, 100n, N.PeriodAll{})) == "true" : String}

law stats_in_period_all_still_rejects_future:
  {V.boolStr(N.inPeriod(101n, 100n, N.PeriodAll{})) == "false" : String}

# ---------- tokens ----------

law stats_token_missing:
  {N.token(False{}, 5n) == N.TokenCount{False{}, 0n} : N.TokenCount}

law stats_token_present:
  {N.token(True{}, 5n) == N.TokenCount{True{}, 5n} : N.TokenCount}

law stats_token_add_fills_missing:
  {N.tokenAdd(N.token(False{}, 0n), N.token(True{}, 5n)) == N.TokenCount{True{}, 5n} : N.TokenCount}

law stats_token_add_keeps_number:
  {N.tokenAdd(N.token(True{}, 5n), N.token(False{}, 0n)) == N.TokenCount{True{}, 5n} : N.TokenCount}

law stats_token_add_both_missing:
  {N.tokenAdd(N.token(False{}, 0n), N.token(False{}, 0n)) == N.TokenCount{False{}, 0n} : N.TokenCount}

law stats_token_add_sums:
  {N.tokenAdd(N.token(True{}, 5n), N.token(True{}, 7n)) == N.TokenCount{True{}, 12n} : N.TokenCount}

law stats_token_label_number:
  {N.tokenLabel(N.TokenCount{True{}, 7n}) == "7" : String}

law stats_token_label_missing:
  {N.tokenLabel(N.TokenCount{False{}, 0n}) == M.msg("stats.unavailable") : String}

law stats_usage_empty_is_missing:
  {N.usageEmpty() == N.StatsUsage{N.TokenCount{False{}, 0n}, N.TokenCount{False{}, 0n}, N.TokenCount{False{}, 0n}} : N.StatsUsage}

law stats_usage_add_per_field:
  {N.usageAdd(
    N.StatsUsage{N.token(True{}, 10n), N.token(False{}, 0n), N.token(True{}, 2n)},
    N.StatsUsage{N.token(True{}, 5n), N.token(True{}, 3n), N.token(False{}, 0n)}
  ) == N.StatsUsage{N.TokenCount{True{}, 15n}, N.TokenCount{True{}, 3n}, N.TokenCount{True{}, 2n}} : N.StatsUsage}

# ---------- prompts ----------

law stats_prompt_refused:
  {V.boolStr(N.addsPrompt(False{}, False{})) == "false" : String}

law stats_prompt_duplicate:
  {V.boolStr(N.addsPrompt(True{}, True{})) == "false" : String}

law stats_prompt_accepted:
  {V.boolStr(N.addsPrompt(True{}, False{})) == "true" : String}

# ---------- percentual ----------

law stats_percent_half:
  {N.percent(1n, 2n) == 50n : Nat}

law stats_percent_third_floors:
  {N.percent(1n, 3n) == 33n : Nat}

law stats_percent_full:
  {N.percent(4n, 4n) == 100n : Nat}

law stats_percent_zero_total:
  {N.percent(5n, 0n) == 0n : Nat}

# ---------- duração ----------

law stats_duration_zero:
  {N.durationLabel(0n) == M.msg("stats.duration.zero") : String}

law stats_duration_under_minute:
  {N.durationLabel(59n) == M.msg("stats.duration.under") : String}

law stats_duration_minute:
  {N.durationLabel(60n) == M.msg1("stats.duration.minutes", "minutes", "1") : String}

law stats_duration_minutes:
  {N.durationLabel(3599n) == M.msg1("stats.duration.minutes", "minutes", "59") : String}

law stats_duration_exact_hour:
  {N.durationLabel(3600n) == M.msg1("stats.duration.hours", "hours", "1") : String}

law stats_duration_hour_minutes:
  {N.durationLabel(3660n) == M.msg2("stats.duration.hoursMinutes", "hours", "1", "minutes", "01") : String}

law stats_duration_two_hours:
  {N.durationLabel(7325n) == M.msg2("stats.duration.hoursMinutes", "hours", "2", "minutes", "02") : String}

# ---------- dia da semana ----------

law stats_weekday_sunday:
  {N.weekdayLabel(0n) == M.msg("stats.weekday.short.sun") : String}

law stats_weekday_saturday:
  {N.weekdayLabel(6n) == M.msg("stats.weekday.short.sat") : String}

law stats_weekday_out_of_range:
  {N.weekdayLabel(9n) == "" : String}

# ---------- rótulos ----------

law stats_period_week_label:
  {N.periodTitle(N.PeriodWeek{}) == M.msg("stats.periodTitle.week") : String}

law stats_unavailable_label:
  {N.unavailableLabel() == M.msg("stats.unavailable") : String}

law stats_count_label:
  {N.countLabel(3n) == "3" : String}

# ---------- a tela em linguagem de gente (#34) ----------

def usageBig() -> N.StatsUsage:
  N.StatsUsage{N.TokenCount{True{}, 139400n}, N.TokenCount{True{}, 17000n}, N.TokenCount{True{}, 573200n}}

def usageNoCache() -> N.StatsUsage:
  N.StatsUsage{N.TokenCount{True{}, 120n}, N.TokenCount{True{}, 30n}, N.TokenCount{False{}, 0n}}

law stats_timer_verb_pause:
  {N.timerVerb(True{}, True{}) == "pause" : String}

law stats_timer_verb_resume:
  {N.timerVerb(False{}, True{}) == "resume" : String}

# Nunca houve sessão: "Retomar" começa uma (a ação do host é `start`).
law stats_timer_verb_start:
  {N.timerVerb(False{}, False{}) == "start" : String}

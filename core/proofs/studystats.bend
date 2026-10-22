# Provas do contrato das estatísticas locais de estudo (tempo ativo por
# evidência, dia civil no fuso, janela do período, tokens ausentes, prompts
# aceitos, percentual, duração e rótulos).
# Uma prova por lei; o cenário concreto é o cenário concreto do módulo.

import Base
import ../laws/studystats.bend as Laws
import ../studystats.bend as N


def Laws.stats_heartbeat_interval():
  {==}

def Laws.stats_max_gap():
  {==}

def Laws.stats_seconds_per_day():
  {==}

def Laws.stats_max_history_days():
  {==}

def Laws.stats_gap_ok():
  {==}

def Laws.stats_gap_exact_cap():
  {==}

def Laws.stats_gap_over_cap_is_zero():
  {==}

def Laws.stats_gap_zero_is_zero():
  {==}

def Laws.stats_gap_backwards_is_zero():
  {==}

def Laws.stats_active_counts_gap():
  {==}

def Laws.stats_active_not_running():
  {==}

def Laws.stats_active_frozen():
  {==}

def Laws.stats_active_hidden():
  {==}

def Laws.stats_active_hidden_frozen():
  {==}

def Laws.stats_active_gap_over_cap():
  {==}

def Laws.stats_session_zero_does_not_count():
  {==}

def Laws.stats_session_positive_counts():
  {==}

def Laws.stats_day_utc_start():
  {==}

def Laws.stats_day_utc_end():
  {==}

def Laws.stats_day_utc_rolls():
  {==}

def Laws.stats_day_west_before_midnight():
  {==}

def Laws.stats_day_west_midnight():
  {==}

def Laws.stats_day_west_next_day():
  {==}

def Laws.stats_day_east_rolls():
  {==}

def Laws.stats_day_east_just_before():
  {==}

def Laws.stats_day_west_saturates():
  {==}

def Laws.stats_period_days_week():
  {==}

def Laws.stats_period_days_month():
  {==}

def Laws.stats_period_days_all():
  {==}

def Laws.stats_window_week_includes_today():
  {==}

def Laws.stats_window_month():
  {==}

def Laws.stats_window_all():
  {==}

def Laws.stats_window_saturates():
  {==}

def Laws.stats_in_period_start():
  {==}

def Laws.stats_in_period_before_start():
  {==}

def Laws.stats_in_period_future_is_out():
  {==}

def Laws.stats_in_period_all_takes_old():
  {==}

def Laws.stats_in_period_all_still_rejects_future():
  {==}

def Laws.stats_token_missing():
  {==}

def Laws.stats_token_present():
  {==}

def Laws.stats_token_add_fills_missing():
  {==}

def Laws.stats_token_add_keeps_number():
  {==}

def Laws.stats_token_add_both_missing():
  {==}

def Laws.stats_token_add_sums():
  {==}

def Laws.stats_token_label_number():
  {==}

def Laws.stats_token_label_missing():
  {==}

def Laws.stats_usage_empty_is_missing():
  {==}

def Laws.stats_usage_add_per_field():
  {==}

def Laws.stats_prompt_refused():
  {==}

def Laws.stats_prompt_duplicate():
  {==}

def Laws.stats_prompt_accepted():
  {==}

def Laws.stats_percent_half():
  {==}

def Laws.stats_percent_third_floors():
  {==}

def Laws.stats_percent_full():
  {==}

def Laws.stats_percent_zero_total():
  {==}

def Laws.stats_duration_zero():
  {==}

def Laws.stats_duration_under_minute():
  {==}

def Laws.stats_duration_minute():
  {==}

def Laws.stats_duration_minutes():
  {==}

def Laws.stats_duration_exact_hour():
  {==}

def Laws.stats_duration_hour_minutes():
  {==}

def Laws.stats_duration_two_hours():
  {==}

def Laws.stats_weekday_sunday():
  {==}

def Laws.stats_weekday_saturday():
  {==}

def Laws.stats_weekday_out_of_range():
  {==}

def Laws.stats_period_week_label():
  {==}

def Laws.stats_unavailable_label():
  {==}

def Laws.stats_count_label():
  {==}

def Laws.stats_timer_verb_pause():
  {==}

def Laws.stats_timer_verb_resume():
  {==}

def Laws.stats_timer_verb_start():
  {==}

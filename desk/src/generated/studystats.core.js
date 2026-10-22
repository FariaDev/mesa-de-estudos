// GERADO de core/studystats.bend por `bun core/build.mjs` — não editar à mão.
// core/studystats.bend
function cmp_new(a, b) {
  return { $: a < b ? "LT" : a === b ? "EQ" : "GT" };
}
function nat_divmod(a, b) {
  return b === 0 ? { $: "Tuple", fst: 0, snd: a } : { $: "Tuple", fst: Math.trunc(a / b), snd: a % b };
}
function nat_chk(n) {
  if (n > 281474976710655) {
    throw "bend: a Nat past the largest immediate 2^48-1";
  }
  return n;
}
function nat_in(n) {
  return Number.isInteger(n) && n >= 0 && n <= 2 ** 53 ? n : nat_chk(1 / 0);
}
var char_new = function char_new(c) {
  return c < 55296 || c >= 57344 && c <= 1114111 ? String.fromCodePoint(c) : String.fromCharCode(56320, c >>> 22, c >>> 11 & 2047, c & 2047);
};
function char_len(s) {
  return s[0] === "\uDC00" ? 4 : s.codePointAt(0) > 65535 ? 2 : 1;
}
function char_code(s) {
  return s.length < 4 ? s.codePointAt(0) : (s.charCodeAt(1) << 22 | s.charCodeAt(2) << 11 | s.charCodeAt(3)) >>> 0;
}
function str_out(s) {
  return s.replace(/\uDC00[^]{3}/gu, "�");
}
function str_in(s) {
  return s.replace(/\p{Cs}/gu, "�");
}
function run_loop(r) {
  while (r !== null && typeof r === "object" && r.$ === "$JMP") {
    r = r.f(r.x);
  }
  return r;
}
function run_lib(f, n) {
  return (...a) => a.length < n ? run_lib((...b) => f(...a, ...b), n - a.length) : run_loop(f(...a));
}
var $0eff = Object.create(null);
function $msg_mark() {
  return "";
}
function $msg_sep() {
  return "";
}
function $msg_pack(_parts_0) {
  const _x_0 = $msg_mark();
  const _x_1 = $String_join(_parts_0, $msg_sep());
  return _x_0 + _x_1;
}
function $msg_msg(_key_0) {
  return $msg_pack({ $: "Con", head: _key_0, tail: { $: "Nil" } });
}
function $msg_msg1(_key_0, _n1_0, _v1_0) {
  return $msg_pack({ $: "Con", head: _key_0, tail: { $: "Con", head: _n1_0, tail: { $: "Con", head: _v1_0, tail: { $: "Nil" } } } });
}
function $msg_msg2(_key_0, _n1_0, _v1_0, _n2_0, _v2_0) {
  return $msg_pack({ $: "Con", head: _key_0, tail: { $: "Con", head: _n1_0, tail: { $: "Con", head: _v1_0, tail: { $: "Con", head: _n2_0, tail: { $: "Con", head: _v2_0, tail: { $: "Nil" } } } } } });
}
function $msg_msg3(_key_0, _n1_0, _v1_0, _n2_0, _v2_0, _n3_0, _v3_0) {
  return $msg_pack({ $: "Con", head: _key_0, tail: { $: "Con", head: _n1_0, tail: { $: "Con", head: _v1_0, tail: { $: "Con", head: _n2_0, tail: { $: "Con", head: _v2_0, tail: { $: "Con", head: _n3_0, tail: { $: "Con", head: _v3_0, tail: { $: "Nil" } } } } } } } });
}
function $msg_msg4(_key_0, _n1_0, _v1_0, _n2_0, _v2_0, _n3_0, _v3_0, _n4_0, _v4_0) {
  return $msg_pack({ $: "Con", head: _key_0, tail: { $: "Con", head: _n1_0, tail: { $: "Con", head: _v1_0, tail: { $: "Con", head: _n2_0, tail: { $: "Con", head: _v2_0, tail: { $: "Con", head: _n3_0, tail: { $: "Con", head: _v3_0, tail: { $: "Con", head: _n4_0, tail: { $: "Con", head: _v4_0, tail: { $: "Nil" } } } } } } } } } });
}
function $msg_isMsg(_s_0) {
  return $String_starts_with(_s_0, $msg_mark());
}
function $heartbeatInterval() {
  return 30;
}
function $maxGap() {
  return 90;
}
function $secondsPerMinute() {
  return 60;
}
function $secondsPerHour() {
  return 3600;
}
function $secondsPerDay() {
  return 86400;
}
function $maxHistoryDays() {
  return 366;
}
function $gapSeconds(_prev_0, _now_0) {
  return _now_0 < _prev_0 ? 0 : _now_0 - _prev_0;
}
function $gapOk(_prev_0, _now_0) {
  return $Bool_and($Nat_is_gt(_now_0, _prev_0), $Nat_is_le(_now_0 < _prev_0 ? 0 : _now_0 - _prev_0, $maxGap()));
}
function $gapSeconds_if(_prev_0, _now_0, _ok_0) {
  if (_ok_0) {
    return $gapSeconds(_prev_0, _now_0);
  } else {
    return 0;
  }
}
function $gapSeconds_checked(_prev_0, _now_0) {
  return $gapSeconds_if(_prev_0, _now_0, $gapOk(_prev_0, _now_0));
}
function $activeEvidence(_prev_0, _now_0, _running_0) {
  if (!_running_0) {
    return 0;
  } else {
    return $gapSeconds_checked(_prev_0, _now_0);
  }
}
function $activeFrozen(_prev_0, _now_0, _running_0, _frozen_0) {
  if (_frozen_0) {
    return 0;
  } else {
    return $activeEvidence(_prev_0, _now_0, _running_0);
  }
}
function $activeVisible(_prev_0, _now_0, _running_0, _frozen_0, _visible_0) {
  if (!_visible_0) {
    return 0;
  } else {
    return $activeFrozen(_prev_0, _now_0, _running_0, _frozen_0);
  }
}
function $activeSeconds(_prev_0, _now_0, _running_0, _frozen_0, _visible_0) {
  return $activeVisible(_prev_0, _now_0, _running_0, _frozen_0, _visible_0);
}
function $qualifiesSession(_seconds_0) {
  return $Nat_is_gt(_seconds_0, 0);
}
function $offsetSeconds(_minutes_0) {
  const _x_0 = $secondsPerMinute();
  return nat_chk(_minutes_0 * _x_0);
}
function $localSeconds(_seconds_0, _offsetMinutes_0, _west_0) {
  if (_west_0) {
    const _x_0 = $offsetSeconds(_offsetMinutes_0);
    return _seconds_0 < _x_0 ? 0 : _seconds_0 - _x_0;
  } else {
    const _x_1 = $offsetSeconds(_offsetMinutes_0);
    return nat_chk(_seconds_0 + _x_1);
  }
}
function $dayNumber(_seconds_0, _offsetMinutes_0, _west_0) {
  return $Nat_div($localSeconds(_seconds_0, _offsetMinutes_0, _west_0), $secondsPerDay());
}
function $periodDays(_period_0) {
  if (_period_0.$ === "PeriodWeek") {
    return 7;
  } else if (_period_0.$ === "PeriodMonth") {
    return 30;
  } else {
    return 0;
  }
}
function $periodAll(_period_0) {
  if (_period_0.$ === "PeriodAll") {
    return true;
  } else if (_period_0.$ === "PeriodWeek") {
    return false;
  } else {
    return false;
  }
}
function $startFrom(_today_0, _days_0, _all_0) {
  if (_all_0) {
    return 0;
  } else {
    const _x_0 = _days_0 < 1 ? 0 : _days_0 - 1;
    return _today_0 < _x_0 ? 0 : _today_0 - _x_0;
  }
}
function $windowStart(_today_0, _period_0) {
  return $startFrom(_today_0, $periodDays(_period_0), $periodAll(_period_0));
}
function $inWindow(_day_0, _start_0, _today_0) {
  return $Bool_and($Nat_is_ge(_day_0, _start_0), $Nat_is_le(_day_0, _today_0));
}
function $inPeriod(_day_0, _today_0, _period_0) {
  return $inWindow(_day_0, $windowStart(_today_0, _period_0), _today_0);
}
function $token(_has_0, _count_0) {
  if (!_has_0) {
    return { $: "TokenCount", available: false, count: 0 };
  } else {
    return { $: "TokenCount", available: true, count: _count_0 };
  }
}
function $tokenAdd(_a_0, _b_0) {
  const _available_0 = _a_0["available"];
  const _count_0 = _a_0["count"];
  const _available2_0 = _b_0["available"];
  const _count2_0 = _b_0["count"];
  return { $: "TokenCount", available: _available_0 || _available2_0, count: nat_chk(_count_0 + _count2_0) };
}
function $tokenLabel(_tc_0) {
  const _t_0 = _tc_0["available"];
  if (_t_0) {
    const _count_0 = _tc_0["count"];
    return $Nat_show(_count_0);
  } else {
    return $msg_msg("stats.unavailable");
  }
}
function $unavailableLabel() {
  return $msg_msg("stats.unavailable");
}
function $usageEmpty() {
  return { $: "StatsUsage", input: $token(false, 0), output: $token(false, 0), cache: $token(false, 0) };
}
function $usageAdd(_a_0, _b_0) {
  const _input_0 = _a_0["input"];
  const _output_0 = _a_0["output"];
  const _cache_0 = _a_0["cache"];
  const _input2_0 = _b_0["input"];
  const _output2_0 = _b_0["output"];
  const _cache2_0 = _b_0["cache"];
  return { $: "StatsUsage", input: $tokenAdd(_input_0, _input2_0), output: $tokenAdd(_output_0, _output2_0), cache: $tokenAdd(_cache_0, _cache2_0) };
}
function $addsPrompt(_accepted_0, _duplicate_0) {
  if (!_accepted_0) {
    return false;
  } else {
    return $Bool_not(_duplicate_0);
  }
}
function $percent_if(_part_0, _total_0, _zero_0) {
  if (_zero_0) {
    return 0;
  } else {
    return $Nat_div(nat_chk(_part_0 * 100), _total_0);
  }
}
function $percent(_part_0, _total_0) {
  return $percent_if(_part_0, _total_0, $Nat_is_eq(_total_0, 0));
}
function $pad2_if(_n_0, _small_0) {
  if (_small_0) {
    const _x_0 = $Nat_show(_n_0);
    return "0" + _x_0;
  } else {
    return $Nat_show(_n_0);
  }
}
function $pad2(_n_0) {
  return $pad2_if(_n_0, _n_0 < 10);
}
function $minutesOf(_seconds_0) {
  return $Nat_div($Nat_mod(_seconds_0, $secondsPerHour()), $secondsPerMinute());
}
function $hoursOf(_seconds_0) {
  return $Nat_div(_seconds_0, $secondsPerHour());
}
function $durationHour(_seconds_0, _exactHour_0) {
  if (_exactHour_0) {
    return $msg_msg1("stats.duration.hours", "hours", $Nat_show($hoursOf(_seconds_0)));
  } else {
    return $msg_msg2("stats.duration.hoursMinutes", "hours", $Nat_show($hoursOf(_seconds_0)), "minutes", $pad2($minutesOf(_seconds_0)));
  }
}
function $durationHasHour(_seconds_0, _hasHour_0) {
  if (!_hasHour_0) {
    return $msg_msg1("stats.duration.minutes", "minutes", $Nat_show($minutesOf(_seconds_0)));
  } else {
    return $durationHour(_seconds_0, $Nat_is_eq($minutesOf(_seconds_0), 0));
  }
}
function $durationUnder(_seconds_0, _under_0) {
  if (_under_0) {
    return $msg_msg("stats.duration.under");
  } else {
    return $durationHasHour(_seconds_0, $Nat_is_ge(_seconds_0, $secondsPerHour()));
  }
}
function $durationLabel_if(_seconds_0, _zero_0) {
  if (_zero_0) {
    return $msg_msg("stats.duration.zero");
  } else {
    const _x_0 = $secondsPerMinute();
    return $durationUnder(_seconds_0, _seconds_0 < _x_0);
  }
}
function $durationLabel(_seconds_0) {
  return $durationLabel_if(_seconds_0, $Nat_is_eq(_seconds_0, 0));
}
function $weekdayLabel(_index_0) {
  if (_index_0 === 0) {
    return $msg_msg("stats.weekday.short.sun");
  } else if (_index_0 === 1) {
    return $msg_msg("stats.weekday.short.mon");
  } else if (_index_0 === 2) {
    return $msg_msg("stats.weekday.short.tue");
  } else if (_index_0 === 3) {
    return $msg_msg("stats.weekday.short.wed");
  } else if (_index_0 === 4) {
    return $msg_msg("stats.weekday.short.thu");
  } else if (_index_0 === 5) {
    return $msg_msg("stats.weekday.short.fri");
  } else if (_index_0 === 6) {
    return $msg_msg("stats.weekday.short.sat");
  } else {
    return "";
  }
}
function $periodTitle(_period_0) {
  if (_period_0.$ === "PeriodWeek") {
    return $msg_msg("stats.periodTitle.week");
  } else if (_period_0.$ === "PeriodMonth") {
    return $msg_msg("stats.periodTitle.month");
  } else {
    return $msg_msg("stats.periodTitle.all");
  }
}
function $countLabel(_n_0) {
  return $Nat_show(_n_0);
}
function $timerVerb_idle(_hasSession_0) {
  if (_hasSession_0) {
    return "resume";
  } else {
    return "start";
  }
}
function $timerVerb(_running_0, _hasSession_0) {
  if (_running_0) {
    return "pause";
  } else {
    return $timerVerb_idle(_hasSession_0);
  }
}
function $String_join(_xs_0, _sep_0) {
  if (_xs_0.$ === "Nil") {
    return "";
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return $String_join_go(_t_0, _h_0, _sep_0);
  }
}
function $String_starts_with($0, $1, $2) {
  let $pc = 0;
  for (;; )
    switch ($pc) {
      case 0: {
        const _s_0 = $0;
        const _p_0 = $1;
        if (_s_0 === "") {
          if (_p_0 === "") {
            return true;
          } else {
            return false;
          }
        } else {
          const _h_1 = _s_0.slice(0, char_len(_s_0));
          const _t_1 = _s_0.slice(char_len(_s_0));
          if (_p_0 === "") {
            return true;
          } else {
            const _y_0 = _p_0.slice(0, char_len(_p_0));
            const _yt_0 = _p_0.slice(char_len(_p_0));
            $0 = _t_1;
            $1 = _yt_0;
            $2 = $Char_is_eq(_h_1, _y_0);
            $pc = 1;
            continue;
          }
        }
      }
      case 1: {
        const _t_0 = $0;
        const _pt_0 = $1;
        const _same_0 = $2;
        if (!_same_0) {
          return false;
        } else {
          $0 = _t_0;
          $1 = _pt_0;
          $pc = 0;
          continue;
        }
      }
    }
}
function $Bool_and(_a_0, _b_0) {
  if (!_a_0) {
    return false;
  } else {
    return _b_0;
  }
}
function $Nat_is_gt(_a_0, _b_0) {
  return $Cmp_is_gt(cmp_new(_a_0, _b_0));
}
function $Nat_is_le(_a_0, _b_0) {
  return $Cmp_is_le(cmp_new(_a_0, _b_0));
}
function $Nat_div(_a_0, _b_0) {
  return $Pair_fst(nat_divmod(_a_0, _b_0));
}
function $Nat_is_ge(_a_0, _b_0) {
  return $Cmp_is_ge(cmp_new(_a_0, _b_0));
}
function $Nat_show(_n_0) {
  const _m_0 = _n_0;
  return $Nat_show_fin(_m_0, "", $Nat_show_put(nat_divmod(_m_0, 10)));
}
function $Bool_not(_b_0) {
  if (!_b_0) {
    return true;
  } else {
    return false;
  }
}
function $Nat_is_eq(_a_0, _b_0) {
  return $Cmp_is_eq(cmp_new(_a_0, _b_0));
}
function $Nat_mod(_a_0, _b_0) {
  return $Pair_snd(nat_divmod(_a_0, _b_0));
}
function $String_join_go(_xs_0, _h_0, _sep_0) {
  if (_xs_0.$ === "Nil") {
    return _h_0;
  } else {
    const _h2_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    const _x_0 = $String_join_go(_t_0, _h2_0, _sep_0);
    const _x_1 = _sep_0 + _x_0;
    return _h_0 + _x_1;
  }
}
function $Char_is_eq(_a_0, _b_0) {
  const _x_0 = char_code(_a_0);
  const _x_1 = char_code(_b_0);
  return _x_0 === _x_1;
}
function $Cmp_is_gt(_c_0) {
  if (_c_0.$ === "GT") {
    return true;
  } else {
    return false;
  }
}
function $Cmp_is_le(_c_0) {
  if (_c_0.$ === "GT") {
    return false;
  } else {
    return true;
  }
}
function $Pair_fst(_p_0) {
  const _a_0 = _p_0["fst"];
  return _a_0;
}
function $Cmp_is_ge(_c_0) {
  if (_c_0.$ === "LT") {
    return false;
  } else {
    return true;
  }
}
function $Nat_show_fin($0, $1, $2) {
  let $pc = 0;
  for (;; )
    switch ($pc) {
      case 0: {
        const _g_0 = $0;
        const _acc_0 = $1;
        const _dq_0 = $2;
        const _d_0 = _dq_0["fst"];
        const _t_0 = _dq_0["snd"];
        if (_t_0 === 0) {
          return _d_0 + _acc_0;
        } else {
          const _p_0 = _t_0 - 1;
          $0 = _g_0;
          $1 = nat_chk(_p_0 + 1);
          $2 = _d_0 + _acc_0;
          $pc = 1;
          continue;
        }
      }
      case 1: {
        const _f_0 = $0;
        const _n_0 = $1;
        const _acc_0 = $2;
        if (_f_0 === 0) {
          return _acc_0;
        } else {
          const _g_0 = _f_0 - 1;
          $0 = _g_0;
          $1 = _acc_0;
          $2 = $Nat_show_put(nat_divmod(_n_0, 10));
          $pc = 0;
          continue;
        }
      }
    }
}
function $Nat_show_put(_qr_0) {
  const _q_0 = _qr_0["fst"];
  const _r_0 = _qr_0["snd"];
  const _x_0 = nat_chk(48 + _r_0);
  return { $: "Tuple", fst: char_new(_x_0 >>> 0), snd: _q_0 };
}
function $Cmp_is_eq(_c_0) {
  if (_c_0.$ === "EQ") {
    return true;
  } else {
    return false;
  }
}
function $Pair_snd(_p_0) {
  const _b_0 = _p_0["snd"];
  return _b_0;
}
var studystats_default = {
  "msg.mark": run_lib(() => str_out(run_loop($msg_mark())), 0),
  "msg.sep": run_lib(() => str_out(run_loop($msg_sep())), 0),
  "msg.pack": run_lib((a0) => str_out(run_loop($msg_pack(a0))), 1),
  "msg.msg": run_lib((a0) => str_out(run_loop($msg_msg(str_in(a0)))), 1),
  "msg.msg1": run_lib((a0, a1, a2) => str_out(run_loop($msg_msg1(str_in(a0), str_in(a1), str_in(a2)))), 3),
  "msg.msg2": run_lib((a0, a1, a2, a3, a4) => str_out(run_loop($msg_msg2(str_in(a0), str_in(a1), str_in(a2), str_in(a3), str_in(a4)))), 5),
  "msg.msg3": run_lib((a0, a1, a2, a3, a4, a5, a6) => str_out(run_loop($msg_msg3(str_in(a0), str_in(a1), str_in(a2), str_in(a3), str_in(a4), str_in(a5), str_in(a6)))), 7),
  "msg.msg4": run_lib((a0, a1, a2, a3, a4, a5, a6, a7, a8) => str_out(run_loop($msg_msg4(str_in(a0), str_in(a1), str_in(a2), str_in(a3), str_in(a4), str_in(a5), str_in(a6), str_in(a7), str_in(a8)))), 9),
  "msg.isMsg": run_lib((a0) => run_loop($msg_isMsg(str_in(a0))), 1),
  heartbeatInterval: run_lib(() => run_loop($heartbeatInterval()), 0),
  maxGap: run_lib(() => run_loop($maxGap()), 0),
  secondsPerMinute: run_lib(() => run_loop($secondsPerMinute()), 0),
  secondsPerHour: run_lib(() => run_loop($secondsPerHour()), 0),
  secondsPerDay: run_lib(() => run_loop($secondsPerDay()), 0),
  maxHistoryDays: run_lib(() => run_loop($maxHistoryDays()), 0),
  gapSeconds: run_lib((a0, a1) => run_loop($gapSeconds(nat_in(a0), nat_in(a1))), 2),
  gapOk: run_lib((a0, a1) => run_loop($gapOk(nat_in(a0), nat_in(a1))), 2),
  "gapSeconds.if": run_lib((a0, a1, a2) => run_loop($gapSeconds_if(nat_in(a0), nat_in(a1), a2)), 3),
  "gapSeconds.checked": run_lib((a0, a1) => run_loop($gapSeconds_checked(nat_in(a0), nat_in(a1))), 2),
  activeEvidence: run_lib((a0, a1, a2) => run_loop($activeEvidence(nat_in(a0), nat_in(a1), a2)), 3),
  activeFrozen: run_lib((a0, a1, a2, a3) => run_loop($activeFrozen(nat_in(a0), nat_in(a1), a2, a3)), 4),
  activeVisible: run_lib((a0, a1, a2, a3, a4) => run_loop($activeVisible(nat_in(a0), nat_in(a1), a2, a3, a4)), 5),
  activeSeconds: run_lib((a0, a1, a2, a3, a4) => run_loop($activeSeconds(nat_in(a0), nat_in(a1), a2, a3, a4)), 5),
  qualifiesSession: run_lib((a0) => run_loop($qualifiesSession(nat_in(a0))), 1),
  offsetSeconds: run_lib((a0) => run_loop($offsetSeconds(nat_in(a0))), 1),
  localSeconds: run_lib((a0, a1, a2) => run_loop($localSeconds(nat_in(a0), nat_in(a1), a2)), 3),
  dayNumber: run_lib((a0, a1, a2) => run_loop($dayNumber(nat_in(a0), nat_in(a1), a2)), 3),
  periodDays: run_lib((a0) => run_loop($periodDays(a0)), 1),
  periodAll: run_lib((a0) => run_loop($periodAll(a0)), 1),
  startFrom: run_lib((a0, a1, a2) => run_loop($startFrom(nat_in(a0), nat_in(a1), a2)), 3),
  windowStart: run_lib((a0, a1) => run_loop($windowStart(nat_in(a0), a1)), 2),
  inWindow: run_lib((a0, a1, a2) => run_loop($inWindow(nat_in(a0), nat_in(a1), nat_in(a2))), 3),
  inPeriod: run_lib((a0, a1, a2) => run_loop($inPeriod(nat_in(a0), nat_in(a1), a2)), 3),
  token: run_lib((a0, a1) => run_loop($token(a0, nat_in(a1))), 2),
  tokenAdd: run_lib((a0, a1) => run_loop($tokenAdd(a0, a1)), 2),
  tokenLabel: run_lib((a0) => str_out(run_loop($tokenLabel(a0))), 1),
  unavailableLabel: run_lib(() => str_out(run_loop($unavailableLabel())), 0),
  usageEmpty: run_lib(() => run_loop($usageEmpty()), 0),
  usageAdd: run_lib((a0, a1) => run_loop($usageAdd(a0, a1)), 2),
  addsPrompt: run_lib((a0, a1) => run_loop($addsPrompt(a0, a1)), 2),
  "percent.if": run_lib((a0, a1, a2) => run_loop($percent_if(nat_in(a0), nat_in(a1), a2)), 3),
  percent: run_lib((a0, a1) => run_loop($percent(nat_in(a0), nat_in(a1))), 2),
  "pad2.if": run_lib((a0, a1) => str_out(run_loop($pad2_if(nat_in(a0), a1))), 2),
  pad2: run_lib((a0) => str_out(run_loop($pad2(nat_in(a0)))), 1),
  minutesOf: run_lib((a0) => run_loop($minutesOf(nat_in(a0))), 1),
  hoursOf: run_lib((a0) => run_loop($hoursOf(nat_in(a0))), 1),
  durationHour: run_lib((a0, a1) => str_out(run_loop($durationHour(nat_in(a0), a1))), 2),
  durationHasHour: run_lib((a0, a1) => str_out(run_loop($durationHasHour(nat_in(a0), a1))), 2),
  durationUnder: run_lib((a0, a1) => str_out(run_loop($durationUnder(nat_in(a0), a1))), 2),
  "durationLabel.if": run_lib((a0, a1) => str_out(run_loop($durationLabel_if(nat_in(a0), a1))), 2),
  durationLabel: run_lib((a0) => str_out(run_loop($durationLabel(nat_in(a0)))), 1),
  weekdayLabel: run_lib((a0) => str_out(run_loop($weekdayLabel(nat_in(a0)))), 1),
  periodTitle: run_lib((a0) => str_out(run_loop($periodTitle(a0))), 1),
  countLabel: run_lib((a0) => str_out(run_loop($countLabel(nat_in(a0)))), 1),
  "timerVerb.idle": run_lib((a0) => str_out(run_loop($timerVerb_idle(a0))), 1),
  timerVerb: run_lib((a0, a1) => str_out(run_loop($timerVerb(a0, a1))), 2)
};
export {
  studystats_default as default
};

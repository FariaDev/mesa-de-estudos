// GERADO de core/reviewschedule.bend por `bun core/build.mjs` — não editar à mão.
// core/reviewschedule.bend
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
function $historyCap() {
  return 50;
}
function $maxIntervalDays() {
  return 365;
}
function $resultCount() {
  return 4;
}
function $resultTag(_result_0) {
  if (_result_0.$ === "ResultErrei") {
    return "errei";
  } else if (_result_0.$ === "ResultDificil") {
    return "dificil";
  } else if (_result_0.$ === "ResultBom") {
    return "bom";
  } else {
    return "facil";
  }
}
function $resultLabel(_result_0) {
  if (_result_0.$ === "ResultErrei") {
    return $msg_msg("review.result.missed");
  } else if (_result_0.$ === "ResultDificil") {
    return $msg_msg("review.result.hard");
  } else if (_result_0.$ === "ResultBom") {
    return $msg_msg("review.result.good");
  } else {
    return $msg_msg("review.result.easy");
  }
}
function $resultsOrder() {
  return { $: "Con", head: { $: "ResultErrei" }, tail: { $: "Con", head: { $: "ResultDificil" }, tail: { $: "Con", head: { $: "ResultBom" }, tail: { $: "Con", head: { $: "ResultFacil" }, tail: { $: "Nil" } } } } };
}
function $tagMatches(_result_0, _tag_0) {
  return $String_eq($resultTag(_result_0), _tag_0);
}
function $firstInterval(_result_0) {
  if (_result_0.$ === "ResultErrei") {
    return 1;
  } else if (_result_0.$ === "ResultDificil") {
    return 1;
  } else if (_result_0.$ === "ResultBom") {
    return 1;
  } else {
    return 3;
  }
}
function $growInterval(_prev_0, _result_0) {
  if (_result_0.$ === "ResultErrei") {
    return 1;
  } else if (_result_0.$ === "ResultDificil") {
    const _x_0 = $Nat_div(nat_chk(_prev_0 * 6), 5);
    const _x_1 = $maxIntervalDays();
    return _x_0 < _x_1 ? _x_0 : _x_1;
  } else if (_result_0.$ === "ResultBom") {
    const _x_2 = $Nat_div(nat_chk(_prev_0 * 5), 2);
    const _x_3 = $maxIntervalDays();
    return _x_2 < _x_3 ? _x_2 : _x_3;
  } else {
    const _x_4 = $Nat_div(nat_chk(_prev_0 * 7), 2);
    const _x_5 = $maxIntervalDays();
    return _x_4 < _x_5 ? _x_4 : _x_5;
  }
}
function $intervalZero(_prev_0, _result_0, _zero_0) {
  if (_zero_0) {
    return $firstInterval(_result_0);
  } else {
    return $growInterval(_prev_0, _result_0);
  }
}
function $nextInterval(_prev_0, _result_0) {
  return $intervalZero(_prev_0, _result_0, $Nat_is_eq(_prev_0, 0));
}
function $nextDue(_today_0, _prev_0, _result_0) {
  const _x_0 = $nextInterval(_prev_0, _result_0);
  return nat_chk(_today_0 + _x_0);
}
function $isDue(_due_0, _today_0) {
  return $Nat_is_le(_due_0, _today_0);
}
function $intervalLabel(_days_0) {
  return $msg_msg1("review.interval", "count", $Nat_show(_days_0));
}
function $returnLabel_if(_days_0, _tomorrow_0) {
  if (_tomorrow_0) {
    return $msg_msg("review.when.tomorrow");
  } else {
    return $msg_msg1("review.when.inDays", "count", $Nat_show(_days_0));
  }
}
function $returnLabel(_days_0) {
  return $returnLabel_if(_days_0, $Nat_is_le(_days_0, 1));
}
function $returnsLabel_if(_days_0, _tomorrow_0) {
  if (_tomorrow_0) {
    return $msg_msg("review.returns.tomorrow");
  } else {
    return $msg_msg1("review.returns.inDays", "count", $Nat_show(_days_0));
  }
}
function $returnsLabel(_days_0) {
  return $returnsLabel_if(_days_0, $Nat_is_le(_days_0, 1));
}
function $nextReps(_reps_0, _result_0) {
  if (_result_0.$ === "ResultErrei") {
    return 0;
  } else if (_result_0.$ === "ResultDificil") {
    return nat_chk(_reps_0 + 1);
  } else if (_result_0.$ === "ResultBom") {
    return nat_chk(_reps_0 + 1);
  } else {
    return nat_chk(_reps_0 + 1);
  }
}
function $nextLapses(_lapses_0, _result_0) {
  if (_result_0.$ === "ResultErrei") {
    return nat_chk(_lapses_0 + 1);
  } else if (_result_0.$ === "ResultDificil") {
    return _lapses_0;
  } else if (_result_0.$ === "ResultBom") {
    return _lapses_0;
  } else {
    return _lapses_0;
  }
}
function $stateAfter(_today_0, _state_0, _result_0) {
  const _interval_0 = _state_0["interval"];
  const _reps_0 = _state_0["reps"];
  const _lapses_0 = _state_0["lapses"];
  return { $: "ScheduleState", interval: $nextInterval(_interval_0, _result_0), reps: $nextReps(_reps_0, _result_0), lapses: $nextLapses(_lapses_0, _result_0), due: $nextDue(_today_0, _interval_0, _result_0) };
}
function $migratedState(_today_0) {
  return { $: "ScheduleState", interval: 0, reps: 0, lapses: 0, due: _today_0 };
}
function $pushHistory(_history_0, _log_0) {
  return $List_take({ $: "Con", head: _log_0, tail: _history_0 }, $historyCap());
}
function $keySource(_question_0, _name_0, _page_0, _path_0) {
  const _x_0 = $String_trim(_path_0);
  const _x_1 = $Nat_show(_page_0);
  const _x_2 = "|" + _x_0;
  const _x_3 = _x_1 + _x_2;
  const _x_4 = $String_trim(_name_0);
  const _x_5 = "|" + _x_3;
  const _x_6 = _x_4 + _x_5;
  const _x_7 = $String_trim(_question_0);
  const _x_8 = "|" + _x_6;
  return _x_7 + _x_8;
}
function $sameId(_a_0, _b_0) {
  return $String_eq(_a_0, _b_0);
}
function $refState_lib(_inLibrary_0) {
  if (_inLibrary_0) {
    return { $: "RefOk" };
  } else {
    return { $: "RefOutside" };
  }
}
function $refState_missing(_missing_0, _inLibrary_0) {
  if (_missing_0) {
    return { $: "RefMissing" };
  } else {
    return $refState_lib(_inLibrary_0);
  }
}
function $refState(_hasPath_0, _missing_0, _inLibrary_0) {
  if (!_hasPath_0) {
    return { $: "RefOk" };
  } else {
    return $refState_missing(_missing_0, _inLibrary_0);
  }
}
function $refNote(_state_0) {
  if (_state_0.$ === "RefOk") {
    return "";
  } else if (_state_0.$ === "RefMissing") {
    return $msg_msg("review.refNote.missing");
  } else {
    return $msg_msg("review.refNote.outside");
  }
}
function $explainFirst(_result_0) {
  if (_result_0.$ === "ResultErrei") {
    return $msg_msg("review.explain.first.missed");
  } else if (_result_0.$ === "ResultDificil") {
    return $msg_msg("review.explain.first.hard");
  } else if (_result_0.$ === "ResultBom") {
    return $msg_msg("review.explain.first.good");
  } else {
    return $msg_msg("review.explain.first.easy");
  }
}
function $explainGrow(_result_0, _next_0) {
  if (_result_0.$ === "ResultErrei") {
    return $msg_msg("review.explain.grow.missed");
  } else if (_result_0.$ === "ResultDificil") {
    return $msg_msg1("review.explain.grow.hard", "count", $Nat_show(_next_0));
  } else if (_result_0.$ === "ResultBom") {
    return $msg_msg1("review.explain.grow.good", "count", $Nat_show(_next_0));
  } else {
    return $msg_msg1("review.explain.grow.easy", "count", $Nat_show(_next_0));
  }
}
function $explainFrom(_prev_0, _result_0, _next_0, _first_0) {
  if (_first_0) {
    return $explainFirst(_result_0);
  } else {
    return $explainGrow(_result_0, _next_0);
  }
}
function $explain(_prev_0, _result_0) {
  return $explainFrom(_prev_0, _result_0, $nextInterval(_prev_0, _result_0), $Nat_is_eq(_prev_0, 0));
}
function $dayDiff(_due_0, _today_0) {
  return _due_0 < _today_0 ? 0 : _due_0 - _today_0;
}
function $nextLabel_tomorrow(_due_0, _today_0, _tomorrow_0) {
  if (_tomorrow_0) {
    return $msg_msg("review.when.tomorrow");
  } else {
    return $msg_msg1("review.when.inDays", "count", $Nat_show($dayDiff(_due_0, _today_0)));
  }
}
function $nextLabel_due(_due_0, _today_0, _now_0) {
  if (_now_0) {
    return $msg_msg("review.when.today");
  } else {
    return $nextLabel_tomorrow(_due_0, _today_0, $Nat_is_eq($dayDiff(_due_0, _today_0), 1));
  }
}
function $nextLabel(_due_0, _today_0) {
  return $nextLabel_due(_due_0, _today_0, $Nat_is_le(_due_0, _today_0));
}
function $reviewTodayTitle() {
  return $msg_msg("review.today.title");
}
function $filterLabel() {
  return $msg_msg("review.filter");
}
function $allCoursesLabel() {
  return $msg_msg("common.allCourses");
}
function $dueCount_some(_n_0) {
  return $msg_msg1("review.dueCount", "count", $Nat_show(_n_0));
}
function $dueCount_zero(_n_0, _zero_0) {
  if (_zero_0) {
    return $msg_msg("review.dueCount.none");
  } else {
    return $dueCount_some(_n_0);
  }
}
function $dueCount(_n_0) {
  return $dueCount_zero(_n_0, $Nat_is_eq(_n_0, 0));
}
function $noDueText() {
  return $msg_msg("review.noDue");
}
function $historyTitle() {
  return $msg_msg("review.history.title");
}
function $historyEmpty() {
  return $msg_msg("review.history.empty");
}
function $nextReviewPrefix() {
  return $msg_msg("review.next.prefix");
}
function $notInNotebook() {
  return $msg_msg("review.notInNotebook");
}
function $gradeNote(_result_0) {
  if (_result_0.$ === "ResultErrei") {
    return $msg_msg("review.gradeNote.missed");
  } else if (_result_0.$ === "ResultDificil") {
    return $msg_msg("review.gradeNote.hard");
  } else if (_result_0.$ === "ResultBom") {
    return $msg_msg("review.gradeNote.good");
  } else {
    return $msg_msg("review.gradeNote.easy");
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
function $String_eq(_a_0, _b_0) {
  return $Cmp_is_eq($String_order(_a_0, _b_0));
}
function $Nat_div(_a_0, _b_0) {
  return $Pair_fst(nat_divmod(_a_0, _b_0));
}
function $Nat_is_eq(_a_0, _b_0) {
  return $Cmp_is_eq(cmp_new(_a_0, _b_0));
}
function $Nat_is_le(_a_0, _b_0) {
  return $Cmp_is_le(cmp_new(_a_0, _b_0));
}
function $Nat_show(_n_0) {
  const _m_0 = _n_0;
  return $Nat_show_fin(_m_0, "", $Nat_show_put(nat_divmod(_m_0, 10)));
}
function $List_take(_xs_0, _n_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    if (_n_0 === 0) {
      return { $: "Nil" };
    } else {
      const _p_0 = _n_0 - 1;
      return { $: "Con", head: _h_0, tail: $List_take(_t_0, _p_0) };
    }
  }
}
function $String_trim(_s_0) {
  return $String_trim_end($String_trim_start(_s_0));
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
function $Cmp_is_eq(_c_0) {
  if (_c_0.$ === "EQ") {
    return true;
  } else {
    return false;
  }
}
function $String_order(_a_0, _b_0) {
  return $String_order_go(_a_0, _b_0, { $: "EQ" });
}
function $Pair_fst(_p_0) {
  const _a_0 = _p_0["fst"];
  return _a_0;
}
function $Cmp_is_le(_c_0) {
  if (_c_0.$ === "GT") {
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
function $String_trim_end(_s_0) {
  return $String_reverse($String_trim_start($String_reverse(_s_0)));
}
function $String_trim_start($0, $1, $2) {
  let $pc = 0;
  for (;; )
    switch ($pc) {
      case 0: {
        const _s_0 = $0;
        if (_s_0 === "") {
          return "";
        } else {
          const _h_0 = _s_0.slice(0, char_len(_s_0));
          const _t_0 = _s_0.slice(char_len(_s_0));
          $0 = _t_0;
          $1 = _h_0;
          $2 = $Char_is_space(_h_0);
          $pc = 1;
          continue;
        }
      }
      case 1: {
        const _t_0 = $0;
        const _h_0 = $1;
        const _space_0 = $2;
        if (!_space_0) {
          return _h_0 + _t_0;
        } else {
          $0 = _t_0;
          $pc = 0;
          continue;
        }
      }
    }
}
function $String_order_go($0, $1, $2) {
  for (;; ) {
    {
      const _a_0 = $0;
      const _b_0 = $1;
      const _c_0 = $2;
      if (_a_0 === "") {
        if (_b_0 !== "") {
          if (_c_0.$ === "EQ") {
            return { $: "LT" };
          } else {
            return _c_0;
          }
        } else {
          return _c_0;
        }
      } else {
        const _t_1 = _a_0.slice(0, char_len(_a_0));
        const _t_2 = _a_0.slice(char_len(_a_0));
        if (_b_0 === "") {
          if (_c_0.$ === "EQ") {
            return { $: "GT" };
          } else {
            return _c_0;
          }
        } else {
          const _t_3 = _b_0.slice(0, char_len(_b_0));
          const _t2_0 = _b_0.slice(char_len(_b_0));
          if (_c_0.$ === "EQ") {
            const _x_0 = char_code(_t_1);
            const _x_1 = char_code(_t_3);
            $0 = _t_2;
            $1 = _t2_0;
            $2 = cmp_new(_x_0, _x_1);
            continue;
          } else {
            return _c_0;
          }
        }
      }
    }
  }
}
function $String_reverse(_s_0) {
  return $String_reverse_go(_s_0, "");
}
function $Char_is_space(_c_0) {
  const _x_0 = char_code(_c_0);
  const _x_1 = char_code(_c_0);
  const _x_2 = char_code(_c_0);
  const _x_3 = _x_0 === 32;
  const _x_4 = $Bool_and(_x_1 >= 9, _x_2 <= 13);
  return _x_3 || _x_4;
}
function $String_reverse_go($0, $1) {
  for (;; ) {
    {
      const _s_0 = $0;
      const _acc_0 = $1;
      if (_s_0 === "") {
        return _acc_0;
      } else {
        const _h_0 = _s_0.slice(0, char_len(_s_0));
        const _t_0 = _s_0.slice(char_len(_s_0));
        $0 = _t_0;
        $1 = _h_0 + _acc_0;
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
var reviewschedule_default = {
  "msg.mark": run_lib(() => str_out(run_loop($msg_mark())), 0),
  "msg.sep": run_lib(() => str_out(run_loop($msg_sep())), 0),
  "msg.pack": run_lib((a0) => str_out(run_loop($msg_pack(a0))), 1),
  "msg.msg": run_lib((a0) => str_out(run_loop($msg_msg(str_in(a0)))), 1),
  "msg.msg1": run_lib((a0, a1, a2) => str_out(run_loop($msg_msg1(str_in(a0), str_in(a1), str_in(a2)))), 3),
  "msg.msg2": run_lib((a0, a1, a2, a3, a4) => str_out(run_loop($msg_msg2(str_in(a0), str_in(a1), str_in(a2), str_in(a3), str_in(a4)))), 5),
  "msg.msg3": run_lib((a0, a1, a2, a3, a4, a5, a6) => str_out(run_loop($msg_msg3(str_in(a0), str_in(a1), str_in(a2), str_in(a3), str_in(a4), str_in(a5), str_in(a6)))), 7),
  "msg.msg4": run_lib((a0, a1, a2, a3, a4, a5, a6, a7, a8) => str_out(run_loop($msg_msg4(str_in(a0), str_in(a1), str_in(a2), str_in(a3), str_in(a4), str_in(a5), str_in(a6), str_in(a7), str_in(a8)))), 9),
  "msg.isMsg": run_lib((a0) => run_loop($msg_isMsg(str_in(a0))), 1),
  historyCap: run_lib(() => run_loop($historyCap()), 0),
  maxIntervalDays: run_lib(() => run_loop($maxIntervalDays()), 0),
  resultCount: run_lib(() => run_loop($resultCount()), 0),
  resultTag: run_lib((a0) => str_out(run_loop($resultTag(a0))), 1),
  resultLabel: run_lib((a0) => str_out(run_loop($resultLabel(a0))), 1),
  resultsOrder: run_lib(() => run_loop($resultsOrder()), 0),
  tagMatches: run_lib((a0, a1) => run_loop($tagMatches(a0, str_in(a1))), 2),
  firstInterval: run_lib((a0) => run_loop($firstInterval(a0)), 1),
  growInterval: run_lib((a0, a1) => run_loop($growInterval(nat_in(a0), a1)), 2),
  intervalZero: run_lib((a0, a1, a2) => run_loop($intervalZero(nat_in(a0), a1, a2)), 3),
  nextInterval: run_lib((a0, a1) => run_loop($nextInterval(nat_in(a0), a1)), 2),
  nextDue: run_lib((a0, a1, a2) => run_loop($nextDue(nat_in(a0), nat_in(a1), a2)), 3),
  isDue: run_lib((a0, a1) => run_loop($isDue(nat_in(a0), nat_in(a1))), 2),
  intervalLabel: run_lib((a0) => str_out(run_loop($intervalLabel(nat_in(a0)))), 1),
  "returnLabel.if": run_lib((a0, a1) => str_out(run_loop($returnLabel_if(nat_in(a0), a1))), 2),
  returnLabel: run_lib((a0) => str_out(run_loop($returnLabel(nat_in(a0)))), 1),
  "returnsLabel.if": run_lib((a0, a1) => str_out(run_loop($returnsLabel_if(nat_in(a0), a1))), 2),
  returnsLabel: run_lib((a0) => str_out(run_loop($returnsLabel(nat_in(a0)))), 1),
  nextReps: run_lib((a0, a1) => run_loop($nextReps(nat_in(a0), a1)), 2),
  nextLapses: run_lib((a0, a1) => run_loop($nextLapses(nat_in(a0), a1)), 2),
  stateAfter: run_lib((a0, a1, a2) => run_loop($stateAfter(nat_in(a0), a1, a2)), 3),
  migratedState: run_lib((a0) => run_loop($migratedState(nat_in(a0))), 1),
  pushHistory: run_lib((a0, a1) => run_loop($pushHistory(a0, a1)), 2),
  keySource: run_lib((a0, a1, a2, a3) => str_out(run_loop($keySource(str_in(a0), str_in(a1), nat_in(a2), str_in(a3)))), 4),
  sameId: run_lib((a0, a1) => run_loop($sameId(str_in(a0), str_in(a1))), 2),
  "refState.lib": run_lib((a0) => run_loop($refState_lib(a0)), 1),
  "refState.missing": run_lib((a0, a1) => run_loop($refState_missing(a0, a1)), 2),
  refState: run_lib((a0, a1, a2) => run_loop($refState(a0, a1, a2)), 3),
  refNote: run_lib((a0) => str_out(run_loop($refNote(a0))), 1),
  explainFirst: run_lib((a0) => str_out(run_loop($explainFirst(a0))), 1),
  explainGrow: run_lib((a0, a1) => str_out(run_loop($explainGrow(a0, nat_in(a1)))), 2),
  explainFrom: run_lib((a0, a1, a2, a3) => str_out(run_loop($explainFrom(nat_in(a0), a1, nat_in(a2), a3))), 4),
  explain: run_lib((a0, a1) => str_out(run_loop($explain(nat_in(a0), a1))), 2),
  dayDiff: run_lib((a0, a1) => run_loop($dayDiff(nat_in(a0), nat_in(a1))), 2),
  "nextLabel.tomorrow": run_lib((a0, a1, a2) => str_out(run_loop($nextLabel_tomorrow(nat_in(a0), nat_in(a1), a2))), 3),
  "nextLabel.due": run_lib((a0, a1, a2) => str_out(run_loop($nextLabel_due(nat_in(a0), nat_in(a1), a2))), 3),
  nextLabel: run_lib((a0, a1) => str_out(run_loop($nextLabel(nat_in(a0), nat_in(a1)))), 2),
  reviewTodayTitle: run_lib(() => str_out(run_loop($reviewTodayTitle())), 0),
  filterLabel: run_lib(() => str_out(run_loop($filterLabel())), 0),
  allCoursesLabel: run_lib(() => str_out(run_loop($allCoursesLabel())), 0),
  "dueCount.some": run_lib((a0) => str_out(run_loop($dueCount_some(nat_in(a0)))), 1),
  "dueCount.zero": run_lib((a0, a1) => str_out(run_loop($dueCount_zero(nat_in(a0), a1))), 2),
  dueCount: run_lib((a0) => str_out(run_loop($dueCount(nat_in(a0)))), 1),
  noDueText: run_lib(() => str_out(run_loop($noDueText())), 0),
  historyTitle: run_lib(() => str_out(run_loop($historyTitle())), 0),
  historyEmpty: run_lib(() => str_out(run_loop($historyEmpty())), 0),
  nextReviewPrefix: run_lib(() => str_out(run_loop($nextReviewPrefix())), 0),
  notInNotebook: run_lib(() => str_out(run_loop($notInNotebook())), 0),
  gradeNote: run_lib((a0) => str_out(run_loop($gradeNote(a0))), 1)
};
export {
  reviewschedule_default as default
};

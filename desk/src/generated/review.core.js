// GERADO de core/review.bend por `bun core/build.mjs` — não editar à mão.
// core/review.bend
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
function $view_attr(_name_0, _value_0) {
  return { $: "ViewAttr", name: _name_0, value: _value_0 };
}
function $view_classOn(_name_0, _on_0) {
  return { $: "ViewClass", name: _name_0, on: _on_0 };
}
function $view_viewEl(_tag_0, _attrs_0, _kids_0) {
  return { $: "ViewEl", tag: _tag_0, attrs: _attrs_0, kids: _kids_0 };
}
function $view_viewText(_s_0) {
  return { $: "ViewText", text: _s_0 };
}
function $view_viewKey(_tag_0, _key_0, _attrs_0, _kids_0) {
  return $view_viewEl(_tag_0, { $: "Con", head: { $: "ViewAttr", name: "key", value: _key_0 }, tail: _attrs_0 }, _kids_0);
}
function $view_tagOf(_n_0) {
  if (_n_0.$ === "ViewEl") {
    const _tag_0 = _n_0["tag"];
    return _tag_0;
  } else {
    return "";
  }
}
function $view_attrsOf(_n_0) {
  if (_n_0.$ === "ViewEl") {
    const _attrs_0 = _n_0["attrs"];
    return _attrs_0;
  } else {
    return { $: "Nil" };
  }
}
function $view_kidsOf(_n_0) {
  if (_n_0.$ === "ViewEl") {
    const _kids_0 = _n_0["kids"];
    return _kids_0;
  } else {
    return { $: "Nil" };
  }
}
function $view_textOf(_n_0) {
  if (_n_0.$ === "ViewEl") {
    return "";
  } else {
    const _text_0 = _n_0["text"];
    return _text_0;
  }
}
function $view_isText(_n_0) {
  if (_n_0.$ === "ViewEl") {
    return false;
  } else {
    return true;
  }
}
function $view_attrGet_choose(_av_0, _rest_0, _same_0) {
  if (_same_0) {
    return { $: "Some", value: _av_0 };
  } else {
    return _rest_0;
  }
}
function $view_attrGet_go(_attrs_0, _name_0) {
  if (_attrs_0.$ === "Nil") {
    return { $: "None" };
  } else {
    const _t_0 = _attrs_0["head"];
    const _an_0 = _t_0["name"];
    const _av_0 = _t_0["value"];
    const _t_1 = _attrs_0["tail"];
    return $view_attrGet_choose(_av_0, $view_attrGet_go(_t_1, _name_0), $String_eq(_an_0, _name_0));
  }
}
function $view_attrGet(_attrs_0, _name_0) {
  return $view_attrGet_go(_attrs_0, _name_0);
}
function $view_attrWhen(_cond_0, _a_0) {
  if (_cond_0) {
    return { $: "Con", head: _a_0, tail: { $: "Nil" } };
  } else {
    return { $: "Nil" };
  }
}
function $view_attrConcat(_xs_0, _ys_0) {
  return $List_append(_xs_0, _ys_0);
}
function $view_attrJoin(_xss_0) {
  return $List_concat(_xss_0);
}
function $view_attrId(_value_0) {
  return { $: "ViewAttr", name: "id", value: _value_0 };
}
function $view_attrClass(_value_0) {
  return { $: "ViewAttr", name: "class", value: _value_0 };
}
function $view_attrType(_value_0) {
  return { $: "ViewAttr", name: "type", value: _value_0 };
}
function $view_attrTitle(_value_0) {
  return { $: "ViewAttr", name: "title", value: _value_0 };
}
function $view_attrKey(_value_0) {
  return { $: "ViewAttr", name: "key", value: _value_0 };
}
function $view_attrOn(_event_0, _handler_0) {
  return { $: "ViewAttr", name: "on:" + _event_0, value: _handler_0 };
}
function $view_attrData(_name_0, _value_0) {
  return { $: "ViewAttr", name: "data-" + _name_0, value: _value_0 };
}
function $view_attrAria(_name_0, _value_0) {
  return { $: "ViewAttr", name: "aria-" + _name_0, value: _value_0 };
}
function $view_boolStr(_on_0) {
  if (_on_0) {
    return "true";
  } else {
    return "false";
  }
}
function $view_attrBool(_name_0, _on_0) {
  return { $: "ViewAttr", name: _name_0, value: $view_boolStr(_on_0) };
}
function $view_classAppend_empty(_acc_0, _name_0, _empty_0) {
  if (_empty_0) {
    return _name_0;
  } else {
    const _x_0 = " " + _name_0;
    return _acc_0 + _x_0;
  }
}
function $view_classAppend(_acc_0, _name_0) {
  return $view_classAppend_empty(_acc_0, _name_0, $String_is_empty(_acc_0));
}
function $view_classNext_emptyName(_name_0, _acc_0, _emptyName_0) {
  if (_emptyName_0) {
    return _acc_0;
  } else {
    return $view_classAppend(_acc_0, _name_0);
  }
}
function $view_classNext_on(_name_0, _on_0, _acc_0) {
  if (!_on_0) {
    return _acc_0;
  } else {
    return $view_classNext_emptyName(_name_0, _acc_0, $String_is_empty(_name_0));
  }
}
function $view_classValue_go($0, $1) {
  for (;; ) {
    {
      const _xs_0 = $0;
      const _acc_0 = $1;
      if (_xs_0.$ === "Nil") {
        return _acc_0;
      } else {
        const _t_0 = _xs_0["head"];
        const _name_0 = _t_0["name"];
        const _on_0 = _t_0["on"];
        const _t_1 = _xs_0["tail"];
        $0 = _t_1;
        $1 = $view_classNext_on(_name_0, _on_0, _acc_0);
        continue;
      }
    }
  }
}
function $view_classValue(_xs_0) {
  return $view_classValue_go(_xs_0, "");
}
function $view_classes(_xs_0) {
  return { $: "ViewAttr", name: "class", value: $view_classValue(_xs_0) };
}
function $view_viewWhen(_cond_0, _node_0) {
  if (_cond_0) {
    return { $: "Con", head: _node_0, tail: { $: "Nil" } };
  } else {
    return { $: "Nil" };
  }
}
function $view_viewWhenAll(_cond_0, _nodes_0) {
  if (_cond_0) {
    return _nodes_0;
  } else {
    return { $: "Nil" };
  }
}
function $view_viewConcat(_xs_0, _ys_0) {
  return $List_append(_xs_0, _ys_0);
}
function $view_viewJoin(_xss_0) {
  return $List_concat(_xss_0);
}
function $view_viewMapText(_xs_0) {
  return $view_viewMap_0(_xs_0);
}
function $view_asTextI(_i_0, _s_0) {
  return $view_viewText(_s_0);
}
function $view_viewMapTextI_go(_xs_0, _i_0) {
  return $view_viewMapI_go_0(_xs_0, _i_0);
}
function $view_viewMapTextI(_xs_0) {
  return $view_viewMapTextI_go(_xs_0, 0);
}
function $reviewschedule_historyCap() {
  return 50;
}
function $reviewschedule_maxIntervalDays() {
  return 365;
}
function $reviewschedule_resultCount() {
  return 4;
}
function $reviewschedule_resultTag(_result_0) {
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
function $reviewschedule_resultLabel(_result_0) {
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
function $reviewschedule_resultsOrder() {
  return { $: "Con", head: { $: "ResultErrei" }, tail: { $: "Con", head: { $: "ResultDificil" }, tail: { $: "Con", head: { $: "ResultBom" }, tail: { $: "Con", head: { $: "ResultFacil" }, tail: { $: "Nil" } } } } };
}
function $reviewschedule_tagMatches(_result_0, _tag_0) {
  return $String_eq($reviewschedule_resultTag(_result_0), _tag_0);
}
function $reviewschedule_firstInterval(_result_0) {
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
function $reviewschedule_growInterval(_prev_0, _result_0) {
  if (_result_0.$ === "ResultErrei") {
    return 1;
  } else if (_result_0.$ === "ResultDificil") {
    const _x_0 = $Nat_div(nat_chk(_prev_0 * 6), 5);
    const _x_1 = $reviewschedule_maxIntervalDays();
    return _x_0 < _x_1 ? _x_0 : _x_1;
  } else if (_result_0.$ === "ResultBom") {
    const _x_2 = $Nat_div(nat_chk(_prev_0 * 5), 2);
    const _x_3 = $reviewschedule_maxIntervalDays();
    return _x_2 < _x_3 ? _x_2 : _x_3;
  } else {
    const _x_4 = $Nat_div(nat_chk(_prev_0 * 7), 2);
    const _x_5 = $reviewschedule_maxIntervalDays();
    return _x_4 < _x_5 ? _x_4 : _x_5;
  }
}
function $reviewschedule_intervalZero(_prev_0, _result_0, _zero_0) {
  if (_zero_0) {
    return $reviewschedule_firstInterval(_result_0);
  } else {
    return $reviewschedule_growInterval(_prev_0, _result_0);
  }
}
function $reviewschedule_nextInterval(_prev_0, _result_0) {
  return $reviewschedule_intervalZero(_prev_0, _result_0, $Nat_is_eq(_prev_0, 0));
}
function $reviewschedule_nextDue(_today_0, _prev_0, _result_0) {
  const _x_0 = $reviewschedule_nextInterval(_prev_0, _result_0);
  return nat_chk(_today_0 + _x_0);
}
function $reviewschedule_isDue(_due_0, _today_0) {
  return $Nat_is_le(_due_0, _today_0);
}
function $reviewschedule_intervalLabel(_days_0) {
  return $msg_msg1("review.interval", "count", $Nat_show(_days_0));
}
function $reviewschedule_returnLabel_if(_days_0, _tomorrow_0) {
  if (_tomorrow_0) {
    return $msg_msg("review.when.tomorrow");
  } else {
    return $msg_msg1("review.when.inDays", "count", $Nat_show(_days_0));
  }
}
function $reviewschedule_returnLabel(_days_0) {
  return $reviewschedule_returnLabel_if(_days_0, $Nat_is_le(_days_0, 1));
}
function $reviewschedule_returnsLabel_if(_days_0, _tomorrow_0) {
  if (_tomorrow_0) {
    return $msg_msg("review.returns.tomorrow");
  } else {
    return $msg_msg1("review.returns.inDays", "count", $Nat_show(_days_0));
  }
}
function $reviewschedule_returnsLabel(_days_0) {
  return $reviewschedule_returnsLabel_if(_days_0, $Nat_is_le(_days_0, 1));
}
function $reviewschedule_nextReps(_reps_0, _result_0) {
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
function $reviewschedule_nextLapses(_lapses_0, _result_0) {
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
function $reviewschedule_stateAfter(_today_0, _state_0, _result_0) {
  const _interval_0 = _state_0["interval"];
  const _reps_0 = _state_0["reps"];
  const _lapses_0 = _state_0["lapses"];
  return { $: "ScheduleState", interval: $reviewschedule_nextInterval(_interval_0, _result_0), reps: $reviewschedule_nextReps(_reps_0, _result_0), lapses: $reviewschedule_nextLapses(_lapses_0, _result_0), due: $reviewschedule_nextDue(_today_0, _interval_0, _result_0) };
}
function $reviewschedule_migratedState(_today_0) {
  return { $: "ScheduleState", interval: 0, reps: 0, lapses: 0, due: _today_0 };
}
function $reviewschedule_pushHistory(_history_0, _log_0) {
  return $List_take({ $: "Con", head: _log_0, tail: _history_0 }, $reviewschedule_historyCap());
}
function $reviewschedule_keySource(_question_0, _name_0, _page_0, _path_0) {
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
function $reviewschedule_sameId(_a_0, _b_0) {
  return $String_eq(_a_0, _b_0);
}
function $reviewschedule_refState_lib(_inLibrary_0) {
  if (_inLibrary_0) {
    return { $: "RefOk" };
  } else {
    return { $: "RefOutside" };
  }
}
function $reviewschedule_refState_missing(_missing_0, _inLibrary_0) {
  if (_missing_0) {
    return { $: "RefMissing" };
  } else {
    return $reviewschedule_refState_lib(_inLibrary_0);
  }
}
function $reviewschedule_refState(_hasPath_0, _missing_0, _inLibrary_0) {
  if (!_hasPath_0) {
    return { $: "RefOk" };
  } else {
    return $reviewschedule_refState_missing(_missing_0, _inLibrary_0);
  }
}
function $reviewschedule_refNote(_state_0) {
  if (_state_0.$ === "RefOk") {
    return "";
  } else if (_state_0.$ === "RefMissing") {
    return $msg_msg("review.refNote.missing");
  } else {
    return $msg_msg("review.refNote.outside");
  }
}
function $reviewschedule_explainFirst(_result_0) {
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
function $reviewschedule_explainGrow(_result_0, _next_0) {
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
function $reviewschedule_explainFrom(_prev_0, _result_0, _next_0, _first_0) {
  if (_first_0) {
    return $reviewschedule_explainFirst(_result_0);
  } else {
    return $reviewschedule_explainGrow(_result_0, _next_0);
  }
}
function $reviewschedule_explain(_prev_0, _result_0) {
  return $reviewschedule_explainFrom(_prev_0, _result_0, $reviewschedule_nextInterval(_prev_0, _result_0), $Nat_is_eq(_prev_0, 0));
}
function $reviewschedule_dayDiff(_due_0, _today_0) {
  return _due_0 < _today_0 ? 0 : _due_0 - _today_0;
}
function $reviewschedule_nextLabel_tomorrow(_due_0, _today_0, _tomorrow_0) {
  if (_tomorrow_0) {
    return $msg_msg("review.when.tomorrow");
  } else {
    return $msg_msg1("review.when.inDays", "count", $Nat_show($reviewschedule_dayDiff(_due_0, _today_0)));
  }
}
function $reviewschedule_nextLabel_due(_due_0, _today_0, _now_0) {
  if (_now_0) {
    return $msg_msg("review.when.today");
  } else {
    return $reviewschedule_nextLabel_tomorrow(_due_0, _today_0, $Nat_is_eq($reviewschedule_dayDiff(_due_0, _today_0), 1));
  }
}
function $reviewschedule_nextLabel(_due_0, _today_0) {
  return $reviewschedule_nextLabel_due(_due_0, _today_0, $Nat_is_le(_due_0, _today_0));
}
function $reviewschedule_reviewTodayTitle() {
  return $msg_msg("review.today.title");
}
function $reviewschedule_filterLabel() {
  return $msg_msg("review.filter");
}
function $reviewschedule_allCoursesLabel() {
  return $msg_msg("common.allCourses");
}
function $reviewschedule_dueCount_some(_n_0) {
  return $msg_msg1("review.dueCount", "count", $Nat_show(_n_0));
}
function $reviewschedule_dueCount_zero(_n_0, _zero_0) {
  if (_zero_0) {
    return $msg_msg("review.dueCount.none");
  } else {
    return $reviewschedule_dueCount_some(_n_0);
  }
}
function $reviewschedule_dueCount(_n_0) {
  return $reviewschedule_dueCount_zero(_n_0, $Nat_is_eq(_n_0, 0));
}
function $reviewschedule_noDueText() {
  return $msg_msg("review.noDue");
}
function $reviewschedule_historyTitle() {
  return $msg_msg("review.history.title");
}
function $reviewschedule_historyEmpty() {
  return $msg_msg("review.history.empty");
}
function $reviewschedule_nextReviewPrefix() {
  return $msg_msg("review.next.prefix");
}
function $reviewschedule_notInNotebook() {
  return $msg_msg("review.notInNotebook");
}
function $reviewschedule_gradeNote(_result_0) {
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
function $maxQuestion() {
  return 400;
}
function $maxAttempt() {
  return 400;
}
function $maxDifficulty() {
  return 240;
}
function $maxName() {
  return 60;
}
function $maxPath() {
  return 1024;
}
function $maxItems() {
  return 200;
}
function $cutReview_if(_text_0, _limit_0, _over_0) {
  if (!_over_0) {
    return _text_0;
  } else {
    return $String_take(_text_0, _limit_0);
  }
}
function $cutReview(_text_0, _limit_0) {
  return $cutReview_if(_text_0, _limit_0, $Nat_is_gt([...str_out(_text_0)].length, _limit_0));
}
function $clip(_text_0, _limit_0) {
  return $cutReview($String_trim(_text_0), _limit_0);
}
function $fitQuestion(_text_0) {
  return $clip(_text_0, $maxQuestion());
}
function $fitAttempt(_text_0) {
  return $clip(_text_0, $maxAttempt());
}
function $fitDifficulty(_text_0) {
  return $clip(_text_0, $maxDifficulty());
}
function $fitName(_text_0) {
  return $clip(_text_0, $maxName());
}
function $fitPath(_text_0) {
  return $clip(_text_0, $maxPath());
}
function $pageFloor_if(_page_0, _low_0) {
  if (_low_0) {
    return 1;
  } else {
    return _page_0;
  }
}
function $pageFloor(_page_0) {
  return $pageFloor_if(_page_0, _page_0 < 1);
}
function $newRef(_name_0, _page_0, _path_0) {
  return { $: "ReviewRef", name: $fitName(_name_0), page: $pageFloor(_page_0), path: $fitPath(_path_0) };
}
function $newItem(_question_0, _attempt_0, _difficulty_0, _name_0, _page_0, _path_0) {
  return { $: "ReviewItem", question: $fitQuestion(_question_0), attempt: $fitAttempt(_attempt_0), difficulty: $fitDifficulty(_difficulty_0), ref: $newRef(_name_0, _page_0, _path_0) };
}
function $keepQuestion_blank(_blank_0) {
  if (_blank_0) {
    return false;
  } else {
    return true;
  }
}
function $keepQuestion(_question_0) {
  return $keepQuestion_blank($String_is_empty($String_trim(_question_0)));
}
function $keepItem(_item_0) {
  const _question_0 = _item_0["question"];
  return $keepQuestion(_question_0);
}
function $sameRef(_a_0, _b_0) {
  const _name_0 = _a_0["name"];
  const _page_0 = _a_0["page"];
  const _path_0 = _a_0["path"];
  const _name2_0 = _b_0["name"];
  const _page2_0 = _b_0["page"];
  const _path2_0 = _b_0["path"];
  return $Bool_and($Bool_and($String_eq(_name_0, _name2_0), $Nat_is_eq(_page_0, _page2_0)), $String_eq(_path_0, _path2_0));
}
function $sameItem(_a_0, _b_0) {
  const _question_0 = _a_0["question"];
  const _ref_0 = _a_0["ref"];
  const _question2_0 = _b_0["question"];
  const _ref2_0 = _b_0["ref"];
  return $Bool_and($String_eq(_question_0, _question2_0), $sameRef(_ref_0, _ref2_0));
}
function $dropSame_head(_h_0, _rest_0, _same_0) {
  if (_same_0) {
    return _rest_0;
  } else {
    return { $: "Con", head: _h_0, tail: _rest_0 };
  }
}
function $dropSame_go(_items_0, _item_0) {
  if (_items_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _items_0["head"];
    const _t_0 = _items_0["tail"];
    return $dropSame_head(_h_0, $dropSame_go(_t_0, _item_0), $sameItem(_h_0, _item_0));
  }
}
function $takeItems_go(_xs_0, _n_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    if (_n_0 === 0) {
      return { $: "Nil" };
    } else {
      const _p_0 = _n_0 - 1;
      return { $: "Con", head: _h_0, tail: $takeItems_go(_t_0, _p_0) };
    }
  }
}
function $addItem(_items_0, _item_0) {
  return $takeItems_go({ $: "Con", head: _item_0, tail: $dropSame_go(_items_0, _item_0) }, $maxItems());
}
function $replaceSame_head(_h_0, _rest_0, _item_0, _same_0) {
  if (_same_0) {
    return { $: "Con", head: _item_0, tail: _rest_0 };
  } else {
    return { $: "Con", head: _h_0, tail: _rest_0 };
  }
}
function $replaceSame_go(_xs_0, _key_0, _item_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return $replaceSame_head(_h_0, $replaceSame_go(_t_0, _key_0, _item_0), _item_0, $sameItem(_h_0, _key_0));
  }
}
function $replaceSame(_items_0, _key_0, _item_0) {
  return $replaceSame_go(_items_0, _key_0, _item_0);
}
function $removeSame(_items_0, _key_0) {
  return $dropSame_go(_items_0, _key_0);
}
function $reviewTitle() {
  return $msg_msg("review.title");
}
function $closeLabel() {
  return $msg_msg("review.close");
}
function $emptyTitle() {
  return $msg_msg("review.empty.title");
}
function $emptyLead() {
  return $msg_msg("review.empty.lead");
}
function $emptyTail() {
  return $msg_msg("review.empty.tail");
}
function $countText(_n_0) {
  return $msg_msg1("review.count", "count", $Nat_show(_n_0));
}
function $countLine_none(_total_0) {
  return $msg_msg1("review.countLine.none", "total", $Nat_show(_total_0));
}
function $countLine_some(_due_0, _total_0, _noDue_0) {
  if (_noDue_0) {
    return $countLine_none(_total_0);
  } else {
    return $msg_msg2("review.countLine.some", "due", $Nat_show(_due_0), "total", $Nat_show(_total_0));
  }
}
function $countLine_known(_due_0, _total_0, _empty_0) {
  if (_empty_0) {
    return $countText(0);
  } else {
    return $countLine_some(_due_0, _total_0, $Nat_is_eq(_due_0, 0));
  }
}
function $countLine_pick(_due_0, _total_0, _known_0) {
  if (!_known_0) {
    return $countText(_total_0);
  } else {
    return $countLine_known(_due_0, _total_0, $Nat_is_eq(_total_0, 0));
  }
}
function $countLine(_due_0, _total_0, _known_0) {
  return $countLine_pick(_due_0, _total_0, _known_0);
}
function $pageLabel(_page_0) {
  return $msg_msg1("review.ref.page", "page", $Nat_show(_page_0));
}
function $refLine_if(_name_0, _page_0, _unnamed_0) {
  if (_unnamed_0) {
    return $pageLabel(_page_0);
  } else {
    return $msg_msg2("review.ref.named", "name", _name_0, "page", $Nat_show(_page_0));
  }
}
function $refLine(_name_0, _page_0) {
  return $refLine_if(_name_0, _page_0, $String_is_empty($String_trim(_name_0)));
}
function $refOpen_if(_name_0, _page_0, _unnamed_0) {
  if (_unnamed_0) {
    return $msg_msg1("review.ref.open.page", "page", $Nat_show(_page_0));
  } else {
    return $msg_msg2("review.ref.open.named", "name", _name_0, "page", $Nat_show(_page_0));
  }
}
function $refOpen(_name_0, _page_0) {
  return $refOpen_if(_name_0, _page_0, $String_is_empty($String_trim(_name_0)));
}
function $questionLabel() {
  return $msg_msg("review.question");
}
function $attemptLabel() {
  return $msg_msg("review.attempt");
}
function $difficultyLabel() {
  return $msg_msg("review.difficulty");
}
function $dialogTitle() {
  return $msg_msg("review.saveForReview");
}
function $saveLabel() {
  return $msg_msg("common.save");
}
function $cancelLabel() {
  return $msg_msg("common.cancel");
}
function $similarLabel() {
  return $msg_msg("review.similar");
}
function $similarTitle() {
  return $msg_msg("review.similar.title");
}
function $redoLabel() {
  return $msg_msg("review.redo");
}
function $redoTitle() {
  return $msg_msg("review.redo.title");
}
function $editLabel() {
  return $msg_msg("common.edit");
}
function $editTitle() {
  return $msg_msg("review.edit.title");
}
function $removeLabel() {
  return $msg_msg("common.remove");
}
function $removeTitle() {
  return $msg_msg("review.remove.title");
}
function $saveActionLabel() {
  return $msg_msg("review.saveForReview");
}
function $saveActionTitle() {
  return $msg_msg("review.saveAction.title");
}
function $gradesTitle() {
  return $msg_msg("review.grades.title");
}
function $allTitle() {
  return $msg_msg("review.all.title");
}
function $dueGroupTitle() {
  return $msg_msg("review.group.due");
}
function $laterGroupTitle() {
  return $msg_msg("review.group.later");
}
function $todayKicker() {
  return $msg_msg("review.kicker.today");
}
function $allDoneKicker() {
  return $msg_msg("review.kicker.done");
}
function $aheadKicker() {
  return $msg_msg("review.kicker.ahead");
}
function $refMissingWarn() {
  return $msg_msg("review.warn.missing");
}
function $refOutsideWarn() {
  return $msg_msg("review.warn.outside");
}
function $entryId(_e_0) {
  const _id_0 = _e_0["id"];
  return _id_0;
}
function $entryDue(_e_0) {
  const _due_0 = _e_0["due"];
  return _due_0;
}
function $keepEntry(_h_0, _rest_0, _keep_0) {
  if (_keep_0) {
    return { $: "Con", head: _h_0, tail: _rest_0 };
  } else {
    return _rest_0;
  }
}
function $dueEntries(_xs_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return $keepEntry(_h_0, $dueEntries(_t_0), $entryDue(_h_0));
  }
}
function $laterEntries(_xs_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return $keepEntry(_h_0, $laterEntries(_t_0), $Bool_not($entryDue(_h_0)));
  }
}
function $countEntries(_xs_0) {
  if (_xs_0.$ === "Nil") {
    return 0;
  } else {
    const _t_0 = _xs_0["tail"];
    const _x_0 = $countEntries(_t_0);
    return nat_chk(1 + _x_0);
  }
}
function $firstEntry(_xs_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "None" };
  } else {
    const _h_0 = _xs_0["head"];
    return { $: "Some", value: _h_0 };
  }
}
function $findEntry_step(_h_0, _rest_0, _same_0) {
  if (_same_0) {
    return { $: "Some", value: _h_0 };
  } else {
    return _rest_0;
  }
}
function $findEntry(_xs_0, _id_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "None" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return $findEntry_step(_h_0, $findEntry(_t_0, _id_0), $String_eq($entryId(_h_0), _id_0));
  }
}
function $preferEntry(_a_0, _b_0) {
  if (_a_0.$ === "Some") {
    const _x_0 = _a_0["value"];
    return { $: "Some", value: _x_0 };
  } else {
    return _b_0;
  }
}
function $currentEntry(_xs_0, _id_0) {
  return $preferEntry($findEntry(_xs_0, _id_0), $preferEntry($firstEntry($dueEntries(_xs_0)), $firstEntry(_xs_0)));
}
function $positionOf_step(_found_0, _here_0, _rest_0) {
  if (_found_0) {
    return _here_0;
  } else {
    return _rest_0;
  }
}
function $positionOf_go(_xs_0, _id_0, _i_0) {
  if (_xs_0.$ === "Nil") {
    return 0;
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return $positionOf_step($String_eq($entryId(_h_0), _id_0), nat_chk(_i_0 + 1), $positionOf_go(_t_0, _id_0, nat_chk(_i_0 + 1)));
  }
}
function $positionOf(_xs_0, _id_0) {
  return $positionOf_go(_xs_0, _id_0, 0);
}
function $progressShown(_done_0, _position_0) {
  return nat_chk(_done_0 + _position_0);
}
function $progressTotal(_done_0, _due_0) {
  return nat_chk(_done_0 + _due_0);
}
function $progressText(_shown_0, _total_0) {
  return $msg_msg2("review.progress", "shown", $Nat_show(_shown_0), "total", $Nat_show(_total_0));
}
function $gradeWhen(_interval_0, _result_0) {
  return $reviewschedule_returnsLabel($reviewschedule_nextInterval(_interval_0, _result_0));
}
function $gradeButton(_id_0, _interval_0, _result_0) {
  return $view_viewEl("button", { $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_attrClass("review-grade"), tail: { $: "Con", head: $view_attrData("id", _id_0), tail: { $: "Con", head: $view_attrData("result", $reviewschedule_resultTag(_result_0)), tail: { $: "Con", head: $view_attrTitle($reviewschedule_gradeNote(_result_0)), tail: { $: "Nil" } } } } } }, { $: "Con", head: $view_viewEl("span", { $: "Con", head: $view_attrClass("review-grade-name"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText($reviewschedule_resultLabel(_result_0)), tail: { $: "Nil" } }), tail: { $: "Con", head: $view_viewEl("span", { $: "Con", head: $view_attrClass("review-grade-when"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText($gradeWhen(_interval_0, _result_0)), tail: { $: "Nil" } }), tail: { $: "Nil" } } });
}
function $gradesRow(_id_0, _interval_0) {
  return $view_viewEl("section", { $: "Con", head: $view_attrClass("review-grades"), tail: { $: "Con", head: $view_attrAria("label", $gradesTitle()), tail: { $: "Nil" } } }, { $: "Con", head: $view_viewEl("h3", { $: "Con", head: $view_attrClass("review-grades-title"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText($gradesTitle()), tail: { $: "Nil" } }), tail: { $: "Con", head: $view_viewEl("div", { $: "Con", head: $view_attrClass("review-grade-row"), tail: { $: "Nil" } }, { $: "Con", head: $gradeButton(_id_0, _interval_0, { $: "ResultErrei" }), tail: { $: "Con", head: $gradeButton(_id_0, _interval_0, { $: "ResultDificil" }), tail: { $: "Con", head: $gradeButton(_id_0, _interval_0, { $: "ResultBom" }), tail: { $: "Con", head: $gradeButton(_id_0, _interval_0, { $: "ResultFacil" }), tail: { $: "Nil" } } } } }), tail: { $: "Nil" } } });
}
function $blank(_text_0) {
  return $String_is_empty($String_trim(_text_0));
}
function $refNodeFrom(_name_0, _page_0, _path_0, _warn_0) {
  return $view_viewEl("button", $view_attrJoin({ $: "Con", head: { $: "Con", head: $view_attrType("button"), tail: { $: "Nil" } }, tail: { $: "Con", head: { $: "Con", head: $view_attrClass("review-ref"), tail: { $: "Nil" } }, tail: { $: "Con", head: { $: "Con", head: $view_attrData("page", $Nat_show(_page_0)), tail: { $: "Nil" } }, tail: { $: "Con", head: { $: "Con", head: $view_attrData("path", _path_0), tail: { $: "Nil" } }, tail: { $: "Con", head: { $: "Con", head: $view_attrData("name", _name_0), tail: { $: "Nil" } }, tail: { $: "Con", head: $view_attrWhen($blank(_warn_0), $view_attrTitle($refOpen(_name_0, _page_0))), tail: { $: "Con", head: $view_attrWhen($Bool_not($blank(_warn_0)), $view_attrTitle(_warn_0)), tail: { $: "Con", head: $view_attrWhen($Bool_not($blank(_warn_0)), $view_attr("disabled", "")), tail: { $: "Con", head: { $: "Con", head: $view_attrAria("label", $refOpen(_name_0, _page_0)), tail: { $: "Nil" } }, tail: { $: "Nil" } } } } } } } } } }), { $: "Con", head: $view_viewText($refLine(_name_0, _page_0)), tail: { $: "Nil" } });
}
function $refNodeWhen(_ref_0, _warn_0) {
  const _name_0 = _ref_0["name"];
  const _page_0 = _ref_0["page"];
  const _path_0 = _ref_0["path"];
  return $view_viewWhen($Bool_not($blank(_path_0)), $refNodeFrom(_name_0, _page_0, _path_0, _warn_0));
}
function $savedNode(_saved_0) {
  return $view_viewWhen($Bool_not($blank(_saved_0)), $view_viewEl("span", { $: "Con", head: $view_attrClass("review-saved"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText($msg_msg1("review.savedOn", "date", _saved_0)), tail: { $: "Nil" } }));
}
function $metaRow(_ref_0, _saved_0, _warn_0) {
  return $view_viewEl("div", { $: "Con", head: $view_attrClass("review-meta"), tail: { $: "Nil" } }, $view_viewJoin({ $: "Con", head: $refNodeWhen(_ref_0, _warn_0), tail: { $: "Con", head: $savedNode(_saved_0), tail: { $: "Nil" } } }));
}
function $warnNode(_warn_0) {
  return $view_viewWhen($Bool_not($blank(_warn_0)), $view_viewEl("p", { $: "Con", head: $view_attrClass("review-reference-warning"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText(_warn_0), tail: { $: "Nil" } }));
}
function $noteNode(_cls_0, _label_0, _text_0) {
  return $view_viewWhen($Bool_not($blank(_text_0)), $view_viewEl("div", { $: "Con", head: $view_attrClass("review-note"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewEl("span", { $: "Con", head: $view_attrClass("review-note-label"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText(_label_0), tail: { $: "Nil" } }), tail: { $: "Con", head: $view_viewEl("p", { $: "Con", head: $view_attrClass(_cls_0), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText(_text_0), tail: { $: "Nil" } }), tail: { $: "Nil" } } }));
}
function $notesNode(_attempt_0, _difficulty_0) {
  const _x_0 = $Bool_not($blank(_attempt_0));
  const _x_1 = $Bool_not($blank(_difficulty_0));
  return $view_viewWhen(_x_0 || _x_1, $view_viewEl("div", { $: "Con", head: $view_attrClass("review-notes"), tail: { $: "Nil" } }, $view_viewJoin({ $: "Con", head: $noteNode("review-attempt", $attemptLabel(), _attempt_0), tail: { $: "Con", head: $noteNode("review-trouble", $difficultyLabel(), _difficulty_0), tail: { $: "Nil" } } })));
}
function $cardButton(_id_0, _cls_0, _label_0, _title_0) {
  return $view_viewEl("button", { $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_attrClass(_cls_0), tail: { $: "Con", head: $view_attrData("id", _id_0), tail: { $: "Con", head: $view_attrTitle(_title_0), tail: { $: "Con", head: $view_attrAria("label", _title_0), tail: { $: "Nil" } } } } } }, { $: "Con", head: $view_viewText(_label_0), tail: { $: "Nil" } });
}
function $cardActions(_id_0) {
  return $view_viewEl("div", { $: "Con", head: $view_attrClass("review-actions"), tail: { $: "Nil" } }, { $: "Con", head: $cardButton(_id_0, "review-redo primary", $redoLabel(), $redoTitle()), tail: { $: "Con", head: $cardButton(_id_0, "review-similar", $similarLabel(), $similarTitle()), tail: { $: "Con", head: $view_viewEl("span", { $: "Con", head: $view_attrClass("review-spacer"), tail: { $: "Nil" } }, { $: "Nil" }), tail: { $: "Con", head: $cardButton(_id_0, "review-edit", $editLabel(), $editTitle()), tail: { $: "Con", head: $cardButton(_id_0, "review-remove", $removeLabel(), $removeTitle()), tail: { $: "Nil" } } } } } });
}
function $reviewCard(_e_0) {
  const _id_0 = _e_0["id"];
  const _question_0 = _e_0["question"];
  const _attempt_0 = _e_0["attempt"];
  const _difficulty_0 = _e_0["difficulty"];
  const _ref_0 = _e_0["ref"];
  const _saved_0 = _e_0["saved"];
  const _warn_0 = _e_0["warn"];
  return $view_viewEl("article", $view_attrJoin({ $: "Con", head: { $: "Con", head: $view_attrClass("review-item review-card"), tail: { $: "Nil" } }, tail: { $: "Con", head: { $: "Con", head: $view_attrData("id", _id_0), tail: { $: "Nil" } }, tail: { $: "Nil" } } }), $view_viewJoin({ $: "Con", head: { $: "Con", head: $metaRow(_ref_0, _saved_0, _warn_0), tail: { $: "Nil" } }, tail: { $: "Con", head: { $: "Con", head: $view_viewEl("h3", { $: "Con", head: $view_attrClass("review-question"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText(_question_0), tail: { $: "Nil" } }), tail: { $: "Nil" } }, tail: { $: "Con", head: $warnNode(_warn_0), tail: { $: "Con", head: $notesNode(_attempt_0, _difficulty_0), tail: { $: "Con", head: { $: "Con", head: $cardActions(_id_0), tail: { $: "Nil" } }, tail: { $: "Nil" } } } } } }));
}
function $progressNode(_shown_0, _total_0) {
  return $view_viewEl("div", { $: "Con", head: $view_attrClass("review-progress"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewEl("span", { $: "Con", head: $view_attrClass("review-kicker"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText($todayKicker()), tail: { $: "Nil" } }), tail: { $: "Con", head: $view_viewEl("span", { $: "Con", head: $view_attrClass("review-position"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText($progressText(_shown_0, _total_0)), tail: { $: "Nil" } }), tail: { $: "Con", head: $view_viewEl("progress", { $: "Con", head: $view_attrClass("review-bar-track"), tail: { $: "Con", head: $view_attr("max", $Nat_show(_total_0)), tail: { $: "Con", head: $view_attr("value", $Nat_show(_shown_0)), tail: { $: "Con", head: $view_attrAria("label", $progressText(_shown_0, _total_0)), tail: { $: "Nil" } } } } }, { $: "Nil" }), tail: { $: "Nil" } } } });
}
function $aheadNode(_kicker_0, _when_0) {
  return $view_viewEl("div", { $: "Con", head: $view_attrClass("review-progress"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewEl("span", { $: "Con", head: $view_attrClass("review-kicker"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText(_kicker_0), tail: { $: "Nil" } }), tail: { $: "Con", head: $view_viewEl("span", { $: "Con", head: $view_attrClass("review-position"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText($msg_msg("review.returnsWord")), tail: { $: "Con", head: $view_viewText(" "), tail: { $: "Con", head: $view_viewText(_when_0), tail: { $: "Nil" } } } }), tail: { $: "Nil" } } });
}
function $aheadKickerFor_pick(_someDue_0) {
  if (_someDue_0) {
    return $aheadKicker();
  } else {
    return $allDoneKicker();
  }
}
function $headerFor_pick(_due_0, _when_0, _id_0, _xs_0, _done_0) {
  if (_due_0) {
    return $progressNode($progressShown(_done_0, $positionOf($dueEntries(_xs_0), _id_0)), $progressTotal(_done_0, $countEntries($dueEntries(_xs_0))));
  } else {
    return $aheadNode($aheadKickerFor_pick($Bool_not($Nat_is_eq($countEntries($dueEntries(_xs_0)), 0))), _when_0);
  }
}
function $headerFor(_e_0, _xs_0, _done_0) {
  const _id_0 = _e_0["id"];
  const _due_0 = _e_0["due"];
  const _when_0 = _e_0["when"];
  return $headerFor_pick(_due_0, _when_0, _id_0, _xs_0, _done_0);
}
function $entryInterval(_e_0) {
  const _interval_0 = _e_0["interval"];
  return _interval_0;
}
function $gradesWhen(_e_0, _grades_0) {
  return $view_viewWhen(_grades_0, $gradesRow($entryId(_e_0), $entryInterval(_e_0)));
}
function $reviewMain_with(_e_0, _xs_0, _done_0, _grades_0) {
  return $view_viewEl("section", { $: "Con", head: $view_attrId("review-today"), tail: { $: "Con", head: $view_attrClass("review-main"), tail: { $: "Con", head: $view_attrAria("label", $msg_msg("review.today.title")), tail: { $: "Nil" } } } }, $view_viewJoin({ $: "Con", head: { $: "Con", head: $headerFor(_e_0, _xs_0, _done_0), tail: { $: "Nil" } }, tail: { $: "Con", head: { $: "Con", head: $reviewCard(_e_0), tail: { $: "Nil" } }, tail: { $: "Con", head: $gradesWhen(_e_0, _grades_0), tail: { $: "Nil" } } } }));
}
function $reviewMain_pick(_m_0, _xs_0, _done_0, _grades_0) {
  if (_m_0.$ === "Some") {
    const _e_0 = _m_0["value"];
    return $reviewMain_with(_e_0, _xs_0, _done_0, _grades_0);
  } else {
    return $view_viewEl("section", { $: "Con", head: $view_attrId("review-today"), tail: { $: "Con", head: $view_attrClass("review-main"), tail: { $: "Nil" } } }, { $: "Nil" });
  }
}
function $rowSrc_pick(_noPath_0, _name_0, _page_0) {
  if (_noPath_0) {
    return "";
  } else {
    return $refLine(_name_0, _page_0);
  }
}
function $rowSrc(_name_0, _page_0, _path_0) {
  return $rowSrc_pick($blank(_path_0), _name_0, _page_0);
}
function $rowNode(_current_0, _e_0) {
  const _id_0 = _e_0["id"];
  const _question_0 = _e_0["question"];
  const _t_0 = _e_0["ref"];
  const _name_0 = _t_0["name"];
  const _page_0 = _t_0["page"];
  const _path_0 = _t_0["path"];
  const _when_0 = _e_0["when"];
  return $view_viewEl("button", $view_attrJoin({ $: "Con", head: { $: "Con", head: $view_attrType("button"), tail: { $: "Nil" } }, tail: { $: "Con", head: { $: "Con", head: $view_attrClass("review-row"), tail: { $: "Nil" } }, tail: { $: "Con", head: { $: "Con", head: $view_attrData("id", _id_0), tail: { $: "Nil" } }, tail: { $: "Con", head: $view_attrWhen($String_eq(_id_0, _current_0), $view_attrAria("current", "true")), tail: { $: "Nil" } } } } }), { $: "Con", head: $view_viewEl("span", { $: "Con", head: $view_attrClass("review-row-title"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText(_question_0), tail: { $: "Nil" } }), tail: { $: "Con", head: $view_viewEl("span", { $: "Con", head: $view_attrClass("review-row-meta"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewEl("span", { $: "Con", head: $view_attrClass("review-row-src"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText($rowSrc(_name_0, _page_0, _path_0)), tail: { $: "Nil" } }), tail: { $: "Con", head: $view_viewEl("span", { $: "Con", head: $view_attrClass("review-row-when"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText(_when_0), tail: { $: "Nil" } }), tail: { $: "Nil" } } }), tail: { $: "Nil" } } });
}
function $rowNodes(_current_0, _xs_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return { $: "Con", head: $rowNode(_current_0, _h_0), tail: $rowNodes(_current_0, _t_0) };
  }
}
function $groupNode(_title_0, _current_0, _xs_0) {
  return $view_viewWhen($Bool_not($Nat_is_eq($countEntries(_xs_0), 0)), $view_viewEl("div", { $: "Con", head: $view_attrClass("review-group"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewEl("h4", { $: "Con", head: $view_attrClass("review-group-title"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText(_title_0), tail: { $: "Nil" } }), tail: $rowNodes(_current_0, _xs_0) }));
}
function $reviewAside(_xs_0, _current_0) {
  return $view_viewEl("aside", { $: "Con", head: $view_attrId("review-list"), tail: { $: "Con", head: $view_attrClass("review-all"), tail: { $: "Con", head: $view_attrAria("label", $allTitle()), tail: { $: "Nil" } } } }, { $: "Con", head: $view_viewEl("div", { $: "Con", head: $view_attrClass("review-all-head"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewEl("h3", { $: "Nil" }, { $: "Con", head: $view_viewText($allTitle()), tail: { $: "Nil" } }), tail: { $: "Con", head: $view_viewEl("span", { $: "Con", head: $view_attrClass("review-all-count"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText($Nat_show($countEntries(_xs_0))), tail: { $: "Nil" } }), tail: { $: "Nil" } } }), tail: { $: "Con", head: $view_viewEl("div", { $: "Con", head: $view_attrClass("review-all-body"), tail: { $: "Nil" } }, $view_viewJoin({ $: "Con", head: $groupNode($dueGroupTitle(), _current_0, $dueEntries(_xs_0)), tail: { $: "Con", head: $groupNode($laterGroupTitle(), _current_0, $laterEntries(_xs_0)), tail: { $: "Nil" } } })), tail: { $: "Nil" } } });
}
function $currentId(_m_0) {
  if (_m_0.$ === "Some") {
    const _e_0 = _m_0["value"];
    return $entryId(_e_0);
  } else {
    return "";
  }
}
function $reviewEmpty() {
  return $view_viewEl("div", { $: "Con", head: $view_attrClass("review-empty-block"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewEl("h3", { $: "Con", head: $view_attrClass("review-empty-title"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText($emptyTitle()), tail: { $: "Nil" } }), tail: { $: "Con", head: $view_viewEl("p", { $: "Con", head: $view_attrClass("review-empty"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText($emptyLead()), tail: { $: "Con", head: $view_viewEl("strong", { $: "Nil" }, { $: "Con", head: $view_viewText($saveActionLabel()), tail: { $: "Nil" } }), tail: { $: "Con", head: $view_viewText($emptyTail()), tail: { $: "Nil" } } } }), tail: { $: "Con", head: $view_viewEl("div", { $: "Con", head: $view_attrClass("review-empty-sample"), tail: { $: "Con", head: $view_attrAria("hidden", "true"), tail: { $: "Nil" } } }, { $: "Con", head: $view_viewEl("span", { $: "Nil" }, { $: "Con", head: $view_viewText("Copiar"), tail: { $: "Nil" } }), tail: { $: "Con", head: $view_viewEl("span", { $: "Con", head: $view_attrClass("review-empty-dot"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText("·"), tail: { $: "Nil" } }), tail: { $: "Con", head: $view_viewEl("span", { $: "Nil" }, { $: "Con", head: $view_viewText("Citar"), tail: { $: "Nil" } }), tail: { $: "Con", head: $view_viewEl("span", { $: "Con", head: $view_attrClass("review-empty-dot"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText("·"), tail: { $: "Nil" } }), tail: { $: "Con", head: $view_viewEl("span", { $: "Con", head: $view_attrClass("review-empty-save"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText($saveActionLabel()), tail: { $: "Nil" } }), tail: { $: "Nil" } } } } } }), tail: { $: "Nil" } } } });
}
function $reviewBoard_full(_xs_0, _m_0, _done_0, _grades_0) {
  return { $: "Con", head: $reviewMain_pick(_m_0, _xs_0, _done_0, _grades_0), tail: { $: "Con", head: $reviewAside(_xs_0, $currentId(_m_0)), tail: { $: "Nil" } } };
}
function $reviewBoard_pick(_xs_0, _id_0, _done_0, _grades_0, _empty_0) {
  if (_empty_0) {
    return { $: "Con", head: $reviewEmpty(), tail: { $: "Nil" } };
  } else {
    return $reviewBoard_full(_xs_0, $currentEntry(_xs_0, _id_0), _done_0, _grades_0);
  }
}
function $reviewBoard(_xs_0, _id_0, _done_0, _grades_0) {
  return $reviewBoard_pick(_xs_0, _id_0, _done_0, _grades_0, $Nat_is_eq($countEntries(_xs_0), 0));
}
function $courseNode(_course_0) {
  return $view_viewWhen($Bool_not($blank(_course_0)), $view_viewEl("span", { $: "Con", head: $view_attrClass("review-course"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText($String_trim(_course_0)), tail: { $: "Nil" } }));
}
function $reviewBar(_course_0, _due_0, _total_0, _known_0) {
  return $view_viewEl("div", { $: "Con", head: $view_attrClass("review-head"), tail: { $: "Nil" } }, $view_viewJoin({ $: "Con", head: { $: "Con", head: $view_viewEl("h2", { $: "Nil" }, { $: "Con", head: $view_viewText($reviewTitle()), tail: { $: "Nil" } }), tail: { $: "Nil" } }, tail: { $: "Con", head: $courseNode(_course_0), tail: { $: "Con", head: { $: "Con", head: $view_viewEl("span", { $: "Con", head: $view_attrClass("review-count"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText($countLine(_due_0, _total_0, _known_0)), tail: { $: "Nil" } }), tail: { $: "Nil" } }, tail: { $: "Con", head: { $: "Con", head: $view_viewEl("button", { $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_attrClass("review-close"), tail: { $: "Con", head: $view_attrTitle($closeLabel()), tail: { $: "Con", head: $view_attrAria("label", $closeLabel()), tail: { $: "Con", head: $view_attrOn("click", "CloseReview"), tail: { $: "Nil" } } } } } }, { $: "Con", head: $view_viewText($closeLabel()), tail: { $: "Nil" } }), tail: { $: "Nil" } }, tail: { $: "Nil" } } } } }));
}
function $reviewQuestionField(_value_0) {
  return $view_viewEl("label", { $: "Nil" }, { $: "Con", head: $view_viewText($questionLabel()), tail: { $: "Con", head: $view_viewEl("textarea", { $: "Con", head: $view_attrId("review-question"), tail: { $: "Con", head: $view_attr("rows", "3"), tail: { $: "Con", head: $view_attr("required", ""), tail: { $: "Nil" } } } }, { $: "Con", head: $view_viewText(_value_0), tail: { $: "Nil" } }), tail: { $: "Nil" } } });
}
function $reviewAttemptField(_value_0) {
  return $view_viewEl("label", { $: "Nil" }, { $: "Con", head: $view_viewText($attemptLabel()), tail: { $: "Con", head: $view_viewEl("textarea", { $: "Con", head: $view_attrId("review-attempt"), tail: { $: "Con", head: $view_attr("rows", "3"), tail: { $: "Nil" } } }, { $: "Con", head: $view_viewText(_value_0), tail: { $: "Nil" } }), tail: { $: "Nil" } } });
}
function $reviewDifficultyField(_value_0) {
  return $view_viewEl("label", { $: "Nil" }, { $: "Con", head: $view_viewText($difficultyLabel()), tail: { $: "Con", head: $view_viewEl("input", { $: "Con", head: $view_attrId("review-difficulty"), tail: { $: "Con", head: $view_attrType("text"), tail: { $: "Con", head: $view_attr("value", _value_0), tail: { $: "Nil" } } } }, { $: "Nil" }), tail: { $: "Nil" } } });
}
function $refHint_named(_name_0, _page_0, _unnamed_0) {
  if (_unnamed_0) {
    return $msg_msg1("review.refHint.page", "page", $Nat_show(_page_0));
  } else {
    return $msg_msg2("review.refHint.named", "name", _name_0, "page", $Nat_show(_page_0));
  }
}
function $refHint_if(_name_0, _page_0, _noPath_0) {
  if (_noPath_0) {
    return $msg_msg("review.refHint.none");
  } else {
    return $refHint_named(_name_0, _page_0, $String_is_empty($String_trim(_name_0)));
  }
}
function $refHint(_ref_0) {
  const _name_0 = _ref_0["name"];
  const _page_0 = _ref_0["page"];
  const _path_0 = _ref_0["path"];
  return $refHint_if(_name_0, _page_0, $String_is_empty($String_trim(_path_0)));
}
function $reviewDialogActions() {
  return $view_viewEl("div", { $: "Con", head: $view_attrClass("dialog-actions"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewEl("button", { $: "Con", head: $view_attr("value", "cancel"), tail: { $: "Con", head: $view_attr("formnovalidate", ""), tail: { $: "Nil" } } }, { $: "Con", head: $view_viewText($cancelLabel()), tail: { $: "Nil" } }), tail: { $: "Con", head: $view_viewEl("button", { $: "Con", head: $view_attrId("review-save"), tail: { $: "Con", head: $view_attr("value", "ok"), tail: { $: "Con", head: $view_attrClass("primary"), tail: { $: "Nil" } } } }, { $: "Con", head: $view_viewText($saveLabel()), tail: { $: "Nil" } }), tail: { $: "Nil" } } });
}
function $reviewDialogChildren(_question_0, _attempt_0, _difficulty_0, _hint_0) {
  return { $: "Con", head: $view_viewEl("h2", { $: "Nil" }, { $: "Con", head: $view_viewText($dialogTitle()), tail: { $: "Nil" } }), tail: { $: "Con", head: $view_viewEl("p", $view_attrJoin({ $: "Con", head: { $: "Con", head: $view_attrId("review-ref"), tail: { $: "Nil" } }, tail: { $: "Con", head: { $: "Con", head: $view_attrClass("help-lead"), tail: { $: "Nil" } }, tail: { $: "Nil" } } }), { $: "Con", head: $view_viewText(_hint_0), tail: { $: "Nil" } }), tail: { $: "Con", head: $reviewQuestionField(_question_0), tail: { $: "Con", head: $reviewAttemptField(_attempt_0), tail: { $: "Con", head: $reviewDifficultyField(_difficulty_0), tail: { $: "Con", head: $reviewDialogActions(), tail: { $: "Nil" } } } } } } };
}
function $canFillDraft(_open_0, _current_0, _untouched_0) {
  if (!_open_0) {
    return false;
  } else {
    if (!_current_0) {
      return false;
    } else {
      return _untouched_0;
    }
  }
}
function $draftStatus(_text_0) {
  return $view_viewEl("p", { $: "Con", head: $view_attrId("review-draft-status"), tail: { $: "Con", head: $view_attr("role", "status"), tail: { $: "Nil" } } }, { $: "Con", head: $view_viewText(_text_0), tail: { $: "Nil" } });
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
function $List_append(_xs_0, _ys_0) {
  if (_xs_0.$ === "Nil") {
    return _ys_0;
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return { $: "Con", head: _h_0, tail: $List_append(_t_0, _ys_0) };
  }
}
function $List_concat(_xss_0) {
  if (_xss_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xss_0["head"];
    const _t_0 = _xss_0["tail"];
    return $List_append(_h_0, $List_concat(_t_0));
  }
}
function $String_is_empty(_s_0) {
  if (_s_0 === "") {
    return true;
  } else {
    return false;
  }
}
function $view_viewMap_0(_xs_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return { $: "Con", head: $view_viewText(_h_0), tail: $view_viewMap_0(_t_0) };
  }
}
function $view_viewMapI_go_0(_xs_0, _i_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return { $: "Con", head: $view_asTextI(_i_0, _h_0), tail: $view_viewMapI_go_0(_t_0, nat_chk(_i_0 + 1)) };
  }
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
function $String_take(_s_0, _n_0) {
  if (_s_0 === "") {
    return "";
  } else {
    const _h_0 = _s_0.slice(0, char_len(_s_0));
    const _t_0 = _s_0.slice(char_len(_s_0));
    if (_n_0 === 0) {
      return "";
    } else {
      const _p_0 = _n_0 - 1;
      return _h_0 + $String_take(_t_0, _p_0);
    }
  }
}
function $Nat_is_gt(_a_0, _b_0) {
  return $Cmp_is_gt(cmp_new(_a_0, _b_0));
}
function $Bool_and(_a_0, _b_0) {
  if (!_a_0) {
    return false;
  } else {
    return _b_0;
  }
}
function $Bool_not(_b_0) {
  if (!_b_0) {
    return true;
  } else {
    return false;
  }
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
function $Cmp_is_gt(_c_0) {
  if (_c_0.$ === "GT") {
    return true;
  } else {
    return false;
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
var review_default = {
  "msg.mark": run_lib(() => str_out(run_loop($msg_mark())), 0),
  "msg.sep": run_lib(() => str_out(run_loop($msg_sep())), 0),
  "msg.pack": run_lib((a0) => str_out(run_loop($msg_pack(a0))), 1),
  "msg.msg": run_lib((a0) => str_out(run_loop($msg_msg(str_in(a0)))), 1),
  "msg.msg1": run_lib((a0, a1, a2) => str_out(run_loop($msg_msg1(str_in(a0), str_in(a1), str_in(a2)))), 3),
  "msg.msg2": run_lib((a0, a1, a2, a3, a4) => str_out(run_loop($msg_msg2(str_in(a0), str_in(a1), str_in(a2), str_in(a3), str_in(a4)))), 5),
  "msg.msg3": run_lib((a0, a1, a2, a3, a4, a5, a6) => str_out(run_loop($msg_msg3(str_in(a0), str_in(a1), str_in(a2), str_in(a3), str_in(a4), str_in(a5), str_in(a6)))), 7),
  "msg.msg4": run_lib((a0, a1, a2, a3, a4, a5, a6, a7, a8) => str_out(run_loop($msg_msg4(str_in(a0), str_in(a1), str_in(a2), str_in(a3), str_in(a4), str_in(a5), str_in(a6), str_in(a7), str_in(a8)))), 9),
  "msg.isMsg": run_lib((a0) => run_loop($msg_isMsg(str_in(a0))), 1),
  "view.attr": run_lib((a0, a1) => run_loop($view_attr(str_in(a0), str_in(a1))), 2),
  "view.classOn": run_lib((a0, a1) => run_loop($view_classOn(str_in(a0), a1)), 2),
  "view.viewEl": run_lib((a0, a1, a2) => run_loop($view_viewEl(str_in(a0), a1, a2)), 3),
  "view.viewText": run_lib((a0) => run_loop($view_viewText(str_in(a0))), 1),
  "view.viewKey": run_lib((a0, a1, a2, a3) => run_loop($view_viewKey(str_in(a0), str_in(a1), a2, a3)), 4),
  "view.tagOf": run_lib((a0) => str_out(run_loop($view_tagOf(a0))), 1),
  "view.attrsOf": run_lib((a0) => run_loop($view_attrsOf(a0)), 1),
  "view.kidsOf": run_lib((a0) => run_loop($view_kidsOf(a0)), 1),
  "view.textOf": run_lib((a0) => str_out(run_loop($view_textOf(a0))), 1),
  "view.isText": run_lib((a0) => run_loop($view_isText(a0)), 1),
  "view.attrGet.choose": run_lib((a0, a1, a2) => run_loop($view_attrGet_choose(str_in(a0), a1, a2)), 3),
  "view.attrGet.go": run_lib((a0, a1) => run_loop($view_attrGet_go(a0, str_in(a1))), 2),
  "view.attrGet": run_lib((a0, a1) => run_loop($view_attrGet(a0, str_in(a1))), 2),
  "view.attrWhen": run_lib((a0, a1) => run_loop($view_attrWhen(a0, a1)), 2),
  "view.attrConcat": run_lib((a0, a1) => run_loop($view_attrConcat(a0, a1)), 2),
  "view.attrJoin": run_lib((a0) => run_loop($view_attrJoin(a0)), 1),
  "view.attrId": run_lib((a0) => run_loop($view_attrId(str_in(a0))), 1),
  "view.attrClass": run_lib((a0) => run_loop($view_attrClass(str_in(a0))), 1),
  "view.attrType": run_lib((a0) => run_loop($view_attrType(str_in(a0))), 1),
  "view.attrTitle": run_lib((a0) => run_loop($view_attrTitle(str_in(a0))), 1),
  "view.attrKey": run_lib((a0) => run_loop($view_attrKey(str_in(a0))), 1),
  "view.attrOn": run_lib((a0, a1) => run_loop($view_attrOn(str_in(a0), str_in(a1))), 2),
  "view.attrData": run_lib((a0, a1) => run_loop($view_attrData(str_in(a0), str_in(a1))), 2),
  "view.attrAria": run_lib((a0, a1) => run_loop($view_attrAria(str_in(a0), str_in(a1))), 2),
  "view.boolStr": run_lib((a0) => str_out(run_loop($view_boolStr(a0))), 1),
  "view.attrBool": run_lib((a0, a1) => run_loop($view_attrBool(str_in(a0), a1)), 2),
  "view.classAppend.empty": run_lib((a0, a1, a2) => str_out(run_loop($view_classAppend_empty(str_in(a0), str_in(a1), a2))), 3),
  "view.classAppend": run_lib((a0, a1) => str_out(run_loop($view_classAppend(str_in(a0), str_in(a1)))), 2),
  "view.classNext.emptyName": run_lib((a0, a1, a2) => str_out(run_loop($view_classNext_emptyName(str_in(a0), str_in(a1), a2))), 3),
  "view.classNext.on": run_lib((a0, a1, a2) => str_out(run_loop($view_classNext_on(str_in(a0), a1, str_in(a2)))), 3),
  "view.classValue.go": run_lib((a0, a1) => str_out(run_loop($view_classValue_go(a0, str_in(a1)))), 2),
  "view.classValue": run_lib((a0) => str_out(run_loop($view_classValue(a0))), 1),
  "view.classes": run_lib((a0) => run_loop($view_classes(a0)), 1),
  "view.viewWhen": run_lib((a0, a1) => run_loop($view_viewWhen(a0, a1)), 2),
  "view.viewWhenAll": run_lib((a0, a1) => run_loop($view_viewWhenAll(a0, a1)), 2),
  "view.viewConcat": run_lib((a0, a1) => run_loop($view_viewConcat(a0, a1)), 2),
  "view.viewJoin": run_lib((a0) => run_loop($view_viewJoin(a0)), 1),
  "view.viewMapText": run_lib((a0) => run_loop($view_viewMapText(a0)), 1),
  "view.asTextI": run_lib((a0, a1) => run_loop($view_asTextI(nat_in(a0), str_in(a1))), 2),
  "view.viewMapTextI.go": run_lib((a0, a1) => run_loop($view_viewMapTextI_go(a0, nat_in(a1))), 2),
  "view.viewMapTextI": run_lib((a0) => run_loop($view_viewMapTextI(a0)), 1),
  "reviewschedule.historyCap": run_lib(() => run_loop($reviewschedule_historyCap()), 0),
  "reviewschedule.maxIntervalDays": run_lib(() => run_loop($reviewschedule_maxIntervalDays()), 0),
  "reviewschedule.resultCount": run_lib(() => run_loop($reviewschedule_resultCount()), 0),
  "reviewschedule.resultTag": run_lib((a0) => str_out(run_loop($reviewschedule_resultTag(a0))), 1),
  "reviewschedule.resultLabel": run_lib((a0) => str_out(run_loop($reviewschedule_resultLabel(a0))), 1),
  "reviewschedule.resultsOrder": run_lib(() => run_loop($reviewschedule_resultsOrder()), 0),
  "reviewschedule.tagMatches": run_lib((a0, a1) => run_loop($reviewschedule_tagMatches(a0, str_in(a1))), 2),
  "reviewschedule.firstInterval": run_lib((a0) => run_loop($reviewschedule_firstInterval(a0)), 1),
  "reviewschedule.growInterval": run_lib((a0, a1) => run_loop($reviewschedule_growInterval(nat_in(a0), a1)), 2),
  "reviewschedule.intervalZero": run_lib((a0, a1, a2) => run_loop($reviewschedule_intervalZero(nat_in(a0), a1, a2)), 3),
  "reviewschedule.nextInterval": run_lib((a0, a1) => run_loop($reviewschedule_nextInterval(nat_in(a0), a1)), 2),
  "reviewschedule.nextDue": run_lib((a0, a1, a2) => run_loop($reviewschedule_nextDue(nat_in(a0), nat_in(a1), a2)), 3),
  "reviewschedule.isDue": run_lib((a0, a1) => run_loop($reviewschedule_isDue(nat_in(a0), nat_in(a1))), 2),
  "reviewschedule.intervalLabel": run_lib((a0) => str_out(run_loop($reviewschedule_intervalLabel(nat_in(a0)))), 1),
  "reviewschedule.returnLabel.if": run_lib((a0, a1) => str_out(run_loop($reviewschedule_returnLabel_if(nat_in(a0), a1))), 2),
  "reviewschedule.returnLabel": run_lib((a0) => str_out(run_loop($reviewschedule_returnLabel(nat_in(a0)))), 1),
  "reviewschedule.returnsLabel.if": run_lib((a0, a1) => str_out(run_loop($reviewschedule_returnsLabel_if(nat_in(a0), a1))), 2),
  "reviewschedule.returnsLabel": run_lib((a0) => str_out(run_loop($reviewschedule_returnsLabel(nat_in(a0)))), 1),
  "reviewschedule.nextReps": run_lib((a0, a1) => run_loop($reviewschedule_nextReps(nat_in(a0), a1)), 2),
  "reviewschedule.nextLapses": run_lib((a0, a1) => run_loop($reviewschedule_nextLapses(nat_in(a0), a1)), 2),
  "reviewschedule.stateAfter": run_lib((a0, a1, a2) => run_loop($reviewschedule_stateAfter(nat_in(a0), a1, a2)), 3),
  "reviewschedule.migratedState": run_lib((a0) => run_loop($reviewschedule_migratedState(nat_in(a0))), 1),
  "reviewschedule.pushHistory": run_lib((a0, a1) => run_loop($reviewschedule_pushHistory(a0, a1)), 2),
  "reviewschedule.keySource": run_lib((a0, a1, a2, a3) => str_out(run_loop($reviewschedule_keySource(str_in(a0), str_in(a1), nat_in(a2), str_in(a3)))), 4),
  "reviewschedule.sameId": run_lib((a0, a1) => run_loop($reviewschedule_sameId(str_in(a0), str_in(a1))), 2),
  "reviewschedule.refState.lib": run_lib((a0) => run_loop($reviewschedule_refState_lib(a0)), 1),
  "reviewschedule.refState.missing": run_lib((a0, a1) => run_loop($reviewschedule_refState_missing(a0, a1)), 2),
  "reviewschedule.refState": run_lib((a0, a1, a2) => run_loop($reviewschedule_refState(a0, a1, a2)), 3),
  "reviewschedule.refNote": run_lib((a0) => str_out(run_loop($reviewschedule_refNote(a0))), 1),
  "reviewschedule.explainFirst": run_lib((a0) => str_out(run_loop($reviewschedule_explainFirst(a0))), 1),
  "reviewschedule.explainGrow": run_lib((a0, a1) => str_out(run_loop($reviewschedule_explainGrow(a0, nat_in(a1)))), 2),
  "reviewschedule.explainFrom": run_lib((a0, a1, a2, a3) => str_out(run_loop($reviewschedule_explainFrom(nat_in(a0), a1, nat_in(a2), a3))), 4),
  "reviewschedule.explain": run_lib((a0, a1) => str_out(run_loop($reviewschedule_explain(nat_in(a0), a1))), 2),
  "reviewschedule.dayDiff": run_lib((a0, a1) => run_loop($reviewschedule_dayDiff(nat_in(a0), nat_in(a1))), 2),
  "reviewschedule.nextLabel.tomorrow": run_lib((a0, a1, a2) => str_out(run_loop($reviewschedule_nextLabel_tomorrow(nat_in(a0), nat_in(a1), a2))), 3),
  "reviewschedule.nextLabel.due": run_lib((a0, a1, a2) => str_out(run_loop($reviewschedule_nextLabel_due(nat_in(a0), nat_in(a1), a2))), 3),
  "reviewschedule.nextLabel": run_lib((a0, a1) => str_out(run_loop($reviewschedule_nextLabel(nat_in(a0), nat_in(a1)))), 2),
  "reviewschedule.reviewTodayTitle": run_lib(() => str_out(run_loop($reviewschedule_reviewTodayTitle())), 0),
  "reviewschedule.filterLabel": run_lib(() => str_out(run_loop($reviewschedule_filterLabel())), 0),
  "reviewschedule.allCoursesLabel": run_lib(() => str_out(run_loop($reviewschedule_allCoursesLabel())), 0),
  "reviewschedule.dueCount.some": run_lib((a0) => str_out(run_loop($reviewschedule_dueCount_some(nat_in(a0)))), 1),
  "reviewschedule.dueCount.zero": run_lib((a0, a1) => str_out(run_loop($reviewschedule_dueCount_zero(nat_in(a0), a1))), 2),
  "reviewschedule.dueCount": run_lib((a0) => str_out(run_loop($reviewschedule_dueCount(nat_in(a0)))), 1),
  "reviewschedule.noDueText": run_lib(() => str_out(run_loop($reviewschedule_noDueText())), 0),
  "reviewschedule.historyTitle": run_lib(() => str_out(run_loop($reviewschedule_historyTitle())), 0),
  "reviewschedule.historyEmpty": run_lib(() => str_out(run_loop($reviewschedule_historyEmpty())), 0),
  "reviewschedule.nextReviewPrefix": run_lib(() => str_out(run_loop($reviewschedule_nextReviewPrefix())), 0),
  "reviewschedule.notInNotebook": run_lib(() => str_out(run_loop($reviewschedule_notInNotebook())), 0),
  "reviewschedule.gradeNote": run_lib((a0) => str_out(run_loop($reviewschedule_gradeNote(a0))), 1),
  maxQuestion: run_lib(() => run_loop($maxQuestion()), 0),
  maxAttempt: run_lib(() => run_loop($maxAttempt()), 0),
  maxDifficulty: run_lib(() => run_loop($maxDifficulty()), 0),
  maxName: run_lib(() => run_loop($maxName()), 0),
  maxPath: run_lib(() => run_loop($maxPath()), 0),
  maxItems: run_lib(() => run_loop($maxItems()), 0),
  "cutReview.if": run_lib((a0, a1, a2) => str_out(run_loop($cutReview_if(str_in(a0), nat_in(a1), a2))), 3),
  cutReview: run_lib((a0, a1) => str_out(run_loop($cutReview(str_in(a0), nat_in(a1)))), 2),
  clip: run_lib((a0, a1) => str_out(run_loop($clip(str_in(a0), nat_in(a1)))), 2),
  fitQuestion: run_lib((a0) => str_out(run_loop($fitQuestion(str_in(a0)))), 1),
  fitAttempt: run_lib((a0) => str_out(run_loop($fitAttempt(str_in(a0)))), 1),
  fitDifficulty: run_lib((a0) => str_out(run_loop($fitDifficulty(str_in(a0)))), 1),
  fitName: run_lib((a0) => str_out(run_loop($fitName(str_in(a0)))), 1),
  fitPath: run_lib((a0) => str_out(run_loop($fitPath(str_in(a0)))), 1),
  "pageFloor.if": run_lib((a0, a1) => run_loop($pageFloor_if(nat_in(a0), a1)), 2),
  pageFloor: run_lib((a0) => run_loop($pageFloor(nat_in(a0))), 1),
  newRef: run_lib((a0, a1, a2) => run_loop($newRef(str_in(a0), nat_in(a1), str_in(a2))), 3),
  newItem: run_lib((a0, a1, a2, a3, a4, a5) => run_loop($newItem(str_in(a0), str_in(a1), str_in(a2), str_in(a3), nat_in(a4), str_in(a5))), 6),
  "keepQuestion.blank": run_lib((a0) => run_loop($keepQuestion_blank(a0)), 1),
  keepQuestion: run_lib((a0) => run_loop($keepQuestion(str_in(a0))), 1),
  keepItem: run_lib((a0) => run_loop($keepItem(a0)), 1),
  sameRef: run_lib((a0, a1) => run_loop($sameRef(a0, a1)), 2),
  sameItem: run_lib((a0, a1) => run_loop($sameItem(a0, a1)), 2),
  "dropSame.head": run_lib((a0, a1, a2) => run_loop($dropSame_head(a0, a1, a2)), 3),
  "dropSame.go": run_lib((a0, a1) => run_loop($dropSame_go(a0, a1)), 2),
  "takeItems.go": run_lib((a0, a1) => run_loop($takeItems_go(a0, nat_in(a1))), 2),
  addItem: run_lib((a0, a1) => run_loop($addItem(a0, a1)), 2),
  "replaceSame.head": run_lib((a0, a1, a2, a3) => run_loop($replaceSame_head(a0, a1, a2, a3)), 4),
  "replaceSame.go": run_lib((a0, a1, a2) => run_loop($replaceSame_go(a0, a1, a2)), 3),
  replaceSame: run_lib((a0, a1, a2) => run_loop($replaceSame(a0, a1, a2)), 3),
  removeSame: run_lib((a0, a1) => run_loop($removeSame(a0, a1)), 2),
  reviewTitle: run_lib(() => str_out(run_loop($reviewTitle())), 0),
  closeLabel: run_lib(() => str_out(run_loop($closeLabel())), 0),
  emptyTitle: run_lib(() => str_out(run_loop($emptyTitle())), 0),
  emptyLead: run_lib(() => str_out(run_loop($emptyLead())), 0),
  emptyTail: run_lib(() => str_out(run_loop($emptyTail())), 0),
  countText: run_lib((a0) => str_out(run_loop($countText(nat_in(a0)))), 1),
  "countLine.none": run_lib((a0) => str_out(run_loop($countLine_none(nat_in(a0)))), 1),
  "countLine.some": run_lib((a0, a1, a2) => str_out(run_loop($countLine_some(nat_in(a0), nat_in(a1), a2))), 3),
  "countLine.known": run_lib((a0, a1, a2) => str_out(run_loop($countLine_known(nat_in(a0), nat_in(a1), a2))), 3),
  "countLine.pick": run_lib((a0, a1, a2) => str_out(run_loop($countLine_pick(nat_in(a0), nat_in(a1), a2))), 3),
  countLine: run_lib((a0, a1, a2) => str_out(run_loop($countLine(nat_in(a0), nat_in(a1), a2))), 3),
  pageLabel: run_lib((a0) => str_out(run_loop($pageLabel(nat_in(a0)))), 1),
  "refLine.if": run_lib((a0, a1, a2) => str_out(run_loop($refLine_if(str_in(a0), nat_in(a1), a2))), 3),
  refLine: run_lib((a0, a1) => str_out(run_loop($refLine(str_in(a0), nat_in(a1)))), 2),
  "refOpen.if": run_lib((a0, a1, a2) => str_out(run_loop($refOpen_if(str_in(a0), nat_in(a1), a2))), 3),
  refOpen: run_lib((a0, a1) => str_out(run_loop($refOpen(str_in(a0), nat_in(a1)))), 2),
  questionLabel: run_lib(() => str_out(run_loop($questionLabel())), 0),
  attemptLabel: run_lib(() => str_out(run_loop($attemptLabel())), 0),
  difficultyLabel: run_lib(() => str_out(run_loop($difficultyLabel())), 0),
  dialogTitle: run_lib(() => str_out(run_loop($dialogTitle())), 0),
  saveLabel: run_lib(() => str_out(run_loop($saveLabel())), 0),
  cancelLabel: run_lib(() => str_out(run_loop($cancelLabel())), 0),
  similarLabel: run_lib(() => str_out(run_loop($similarLabel())), 0),
  similarTitle: run_lib(() => str_out(run_loop($similarTitle())), 0),
  redoLabel: run_lib(() => str_out(run_loop($redoLabel())), 0),
  redoTitle: run_lib(() => str_out(run_loop($redoTitle())), 0),
  editLabel: run_lib(() => str_out(run_loop($editLabel())), 0),
  editTitle: run_lib(() => str_out(run_loop($editTitle())), 0),
  removeLabel: run_lib(() => str_out(run_loop($removeLabel())), 0),
  removeTitle: run_lib(() => str_out(run_loop($removeTitle())), 0),
  saveActionLabel: run_lib(() => str_out(run_loop($saveActionLabel())), 0),
  saveActionTitle: run_lib(() => str_out(run_loop($saveActionTitle())), 0),
  gradesTitle: run_lib(() => str_out(run_loop($gradesTitle())), 0),
  allTitle: run_lib(() => str_out(run_loop($allTitle())), 0),
  dueGroupTitle: run_lib(() => str_out(run_loop($dueGroupTitle())), 0),
  laterGroupTitle: run_lib(() => str_out(run_loop($laterGroupTitle())), 0),
  todayKicker: run_lib(() => str_out(run_loop($todayKicker())), 0),
  allDoneKicker: run_lib(() => str_out(run_loop($allDoneKicker())), 0),
  aheadKicker: run_lib(() => str_out(run_loop($aheadKicker())), 0),
  refMissingWarn: run_lib(() => str_out(run_loop($refMissingWarn())), 0),
  refOutsideWarn: run_lib(() => str_out(run_loop($refOutsideWarn())), 0),
  entryId: run_lib((a0) => str_out(run_loop($entryId(a0))), 1),
  entryDue: run_lib((a0) => run_loop($entryDue(a0)), 1),
  keepEntry: run_lib((a0, a1, a2) => run_loop($keepEntry(a0, a1, a2)), 3),
  dueEntries: run_lib((a0) => run_loop($dueEntries(a0)), 1),
  laterEntries: run_lib((a0) => run_loop($laterEntries(a0)), 1),
  countEntries: run_lib((a0) => run_loop($countEntries(a0)), 1),
  firstEntry: run_lib((a0) => run_loop($firstEntry(a0)), 1),
  "findEntry.step": run_lib((a0, a1, a2) => run_loop($findEntry_step(a0, a1, a2)), 3),
  findEntry: run_lib((a0, a1) => run_loop($findEntry(a0, str_in(a1))), 2),
  preferEntry: run_lib((a0, a1) => run_loop($preferEntry(a0, a1)), 2),
  currentEntry: run_lib((a0, a1) => run_loop($currentEntry(a0, str_in(a1))), 2),
  "positionOf.step": run_lib((a0, a1, a2) => run_loop($positionOf_step(a0, nat_in(a1), nat_in(a2))), 3),
  "positionOf.go": run_lib((a0, a1, a2) => run_loop($positionOf_go(a0, str_in(a1), nat_in(a2))), 3),
  positionOf: run_lib((a0, a1) => run_loop($positionOf(a0, str_in(a1))), 2),
  progressShown: run_lib((a0, a1) => run_loop($progressShown(nat_in(a0), nat_in(a1))), 2),
  progressTotal: run_lib((a0, a1) => run_loop($progressTotal(nat_in(a0), nat_in(a1))), 2),
  progressText: run_lib((a0, a1) => str_out(run_loop($progressText(nat_in(a0), nat_in(a1)))), 2),
  gradeWhen: run_lib((a0, a1) => str_out(run_loop($gradeWhen(nat_in(a0), a1))), 2),
  gradeButton: run_lib((a0, a1, a2) => run_loop($gradeButton(str_in(a0), nat_in(a1), a2)), 3),
  gradesRow: run_lib((a0, a1) => run_loop($gradesRow(str_in(a0), nat_in(a1))), 2),
  blank: run_lib((a0) => run_loop($blank(str_in(a0))), 1),
  refNodeFrom: run_lib((a0, a1, a2, a3) => run_loop($refNodeFrom(str_in(a0), nat_in(a1), str_in(a2), str_in(a3))), 4),
  refNodeWhen: run_lib((a0, a1) => run_loop($refNodeWhen(a0, str_in(a1))), 2),
  savedNode: run_lib((a0) => run_loop($savedNode(str_in(a0))), 1),
  metaRow: run_lib((a0, a1, a2) => run_loop($metaRow(a0, str_in(a1), str_in(a2))), 3),
  warnNode: run_lib((a0) => run_loop($warnNode(str_in(a0))), 1),
  noteNode: run_lib((a0, a1, a2) => run_loop($noteNode(str_in(a0), str_in(a1), str_in(a2))), 3),
  notesNode: run_lib((a0, a1) => run_loop($notesNode(str_in(a0), str_in(a1))), 2),
  cardButton: run_lib((a0, a1, a2, a3) => run_loop($cardButton(str_in(a0), str_in(a1), str_in(a2), str_in(a3))), 4),
  cardActions: run_lib((a0) => run_loop($cardActions(str_in(a0))), 1),
  reviewCard: run_lib((a0) => run_loop($reviewCard(a0)), 1),
  progressNode: run_lib((a0, a1) => run_loop($progressNode(nat_in(a0), nat_in(a1))), 2),
  aheadNode: run_lib((a0, a1) => run_loop($aheadNode(str_in(a0), str_in(a1))), 2),
  "aheadKickerFor.pick": run_lib((a0) => str_out(run_loop($aheadKickerFor_pick(a0))), 1),
  "headerFor.pick": run_lib((a0, a1, a2, a3, a4) => run_loop($headerFor_pick(a0, str_in(a1), str_in(a2), a3, nat_in(a4))), 5),
  headerFor: run_lib((a0, a1, a2) => run_loop($headerFor(a0, a1, nat_in(a2))), 3),
  entryInterval: run_lib((a0) => run_loop($entryInterval(a0)), 1),
  gradesWhen: run_lib((a0, a1) => run_loop($gradesWhen(a0, a1)), 2),
  "reviewMain.with": run_lib((a0, a1, a2, a3) => run_loop($reviewMain_with(a0, a1, nat_in(a2), a3)), 4),
  "reviewMain.pick": run_lib((a0, a1, a2, a3) => run_loop($reviewMain_pick(a0, a1, nat_in(a2), a3)), 4),
  "rowSrc.pick": run_lib((a0, a1, a2) => str_out(run_loop($rowSrc_pick(a0, str_in(a1), nat_in(a2)))), 3),
  rowSrc: run_lib((a0, a1, a2) => str_out(run_loop($rowSrc(str_in(a0), nat_in(a1), str_in(a2)))), 3),
  rowNode: run_lib((a0, a1) => run_loop($rowNode(str_in(a0), a1)), 2),
  rowNodes: run_lib((a0, a1) => run_loop($rowNodes(str_in(a0), a1)), 2),
  groupNode: run_lib((a0, a1, a2) => run_loop($groupNode(str_in(a0), str_in(a1), a2)), 3),
  reviewAside: run_lib((a0, a1) => run_loop($reviewAside(a0, str_in(a1))), 2),
  currentId: run_lib((a0) => str_out(run_loop($currentId(a0))), 1),
  reviewEmpty: run_lib(() => run_loop($reviewEmpty()), 0),
  "reviewBoard.full": run_lib((a0, a1, a2, a3) => run_loop($reviewBoard_full(a0, a1, nat_in(a2), a3)), 4),
  "reviewBoard.pick": run_lib((a0, a1, a2, a3, a4) => run_loop($reviewBoard_pick(a0, str_in(a1), nat_in(a2), a3, a4)), 5),
  reviewBoard: run_lib((a0, a1, a2, a3) => run_loop($reviewBoard(a0, str_in(a1), nat_in(a2), a3)), 4),
  courseNode: run_lib((a0) => run_loop($courseNode(str_in(a0))), 1),
  reviewBar: run_lib((a0, a1, a2, a3) => run_loop($reviewBar(str_in(a0), nat_in(a1), nat_in(a2), a3)), 4),
  reviewQuestionField: run_lib((a0) => run_loop($reviewQuestionField(str_in(a0))), 1),
  reviewAttemptField: run_lib((a0) => run_loop($reviewAttemptField(str_in(a0))), 1),
  reviewDifficultyField: run_lib((a0) => run_loop($reviewDifficultyField(str_in(a0))), 1),
  "refHint.named": run_lib((a0, a1, a2) => str_out(run_loop($refHint_named(str_in(a0), nat_in(a1), a2))), 3),
  "refHint.if": run_lib((a0, a1, a2) => str_out(run_loop($refHint_if(str_in(a0), nat_in(a1), a2))), 3),
  refHint: run_lib((a0) => str_out(run_loop($refHint(a0))), 1),
  reviewDialogActions: run_lib(() => run_loop($reviewDialogActions()), 0),
  reviewDialogChildren: run_lib((a0, a1, a2, a3) => run_loop($reviewDialogChildren(str_in(a0), str_in(a1), str_in(a2), str_in(a3))), 4),
  canFillDraft: run_lib((a0, a1, a2) => run_loop($canFillDraft(a0, a1, a2)), 3),
  draftStatus: run_lib((a0) => run_loop($draftStatus(str_in(a0))), 1)
};
export {
  review_default as default
};

// GERADO de core/studycontext.bend por `bun core/build.mjs` — não editar à mão.
// core/studycontext.bend
function cmp_new(a, b) {
  return { $: a < b ? "LT" : a === b ? "EQ" : "GT" };
}
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
function $header() {
  return $msg_msg("studyctx.header");
}
function $seg(_text_0) {
  return `
` + _text_0;
}
function $courseLine(_course_0) {
  return $msg_msg1("studyctx.course", "course", _course_0);
}
function $exerciseLine(_exercise_0) {
  return $msg_msg1("studyctx.exercise", "exercise", _exercise_0);
}
function $draftLine(_draft_0) {
  return $msg_msg1("studyctx.draft", "draft", _draft_0);
}
function $optional(_content_0, _prefix_0, _empty_0) {
  if (_empty_0) {
    return "";
  } else {
    return $seg(_prefix_0 + _content_0);
  }
}
function $refsHeader() {
  return $msg_msg("studyctx.refsHeader");
}
function $refLine(_ref_0) {
  return "  · " + _ref_0;
}
function $refLines(_refs_0) {
  if (_refs_0.$ === "Nil") {
    return "";
  } else {
    const _h_0 = _refs_0["head"];
    const _t_0 = _refs_0["tail"];
    const _x_0 = $seg($refLine(_h_0));
    const _x_1 = $refLines(_t_0);
    return _x_0 + _x_1;
  }
}
function $refsPresent(_refs_0) {
  if (_refs_0.$ === "Nil") {
    return false;
  } else {
    return true;
  }
}
function $refsBlock(_refs_0) {
  if (_refs_0.$ === "Nil") {
    return "";
  } else {
    const _h_0 = _refs_0["head"];
    const _t_0 = _refs_0["tail"];
    const _x_0 = $seg($refsHeader());
    const _x_1 = $refLines({ $: "Con", head: _h_0, tail: _t_0 });
    return _x_0 + _x_1;
  }
}
function $isXournal(_app_0) {
  const _x_0 = $String_is_empty(_app_0);
  const _x_1 = $String_eq(_app_0, "Xournal++");
  return _x_0 || _x_1;
}
function $captureMatches_pick(_isDefault_0, _app_0, _time_0, _exercise_0) {
  if (_isDefault_0) {
    return $msg_msg2("studyctx.capture.xournal", "time", _time_0, "exercise", _exercise_0);
  } else {
    return $msg_msg3("studyctx.capture.app", "app", _app_0, "time", _time_0, "exercise", _exercise_0);
  }
}
function $captureMatchesNote(_app_0, _time_0, _exercise_0) {
  return $captureMatches_pick($isXournal(_app_0), _app_0, _time_0, _exercise_0);
}
function $captureStale_pick(_isDefault_0, _app_0, _time_0, _exercise_0) {
  if (_isDefault_0) {
    return $msg_msg2("studyctx.captureStale.xournal", "time", _time_0, "exercise", _exercise_0);
  } else {
    return $msg_msg3("studyctx.captureStale.app", "app", _app_0, "time", _time_0, "exercise", _exercise_0);
  }
}
function $captureStaleNote(_app_0, _time_0, _exercise_0) {
  return $captureStale_pick($isXournal(_app_0), _app_0, _time_0, _exercise_0);
}
function $captureNoteGiven(_app_0, _time_0, _exercise_0, _matches_0) {
  if (_matches_0) {
    return $captureMatchesNote(_app_0, _time_0, _exercise_0);
  } else {
    return $captureStaleNote(_app_0, _time_0, _exercise_0);
  }
}
function $captureNote(_capture_0) {
  if (_capture_0.$ === "NoCapture") {
    return "";
  } else {
    const _time_0 = _capture_0["time"];
    const _exercise_0 = _capture_0["exercise"];
    const _matches_0 = _capture_0["matches"];
    const _app_0 = _capture_0["app"];
    return $seg($captureNoteGiven(_app_0, _time_0, _exercise_0, _matches_0));
  }
}
function $capturePresent(_capture_0) {
  if (_capture_0.$ === "NoCapture") {
    return false;
  } else {
    return true;
  }
}
function $body(_course_0, _exercise_0, _draft_0, _refs_0, _capture_0) {
  const _x_0 = $optional($courseLine(_course_0), "", $String_is_empty(_course_0));
  const _x_1 = $optional($exerciseLine(_exercise_0), "", $String_is_empty(_exercise_0));
  const _x_2 = _x_0 + _x_1;
  const _x_3 = $optional($draftLine(_draft_0), "", $String_is_empty(_draft_0));
  const _x_4 = $refsBlock(_refs_0);
  const _x_5 = $captureNote(_capture_0);
  const _x_6 = _x_2 + _x_3;
  const _x_7 = _x_4 + _x_5;
  return _x_6 + _x_7;
}
function $hasAnything(_refsPresentFact_0, _course_0, _exercise_0, _draft_0, _capture_0) {
  const _x_0 = $Bool_not($String_is_empty(_course_0));
  const _x_1 = $Bool_not($String_is_empty(_exercise_0));
  const _x_2 = $Bool_not($String_is_empty(_draft_0));
  const _x_3 = _x_2 || _refsPresentFact_0;
  const _x_4 = $capturePresent(_capture_0);
  const _x_5 = _x_0 || _x_1;
  const _x_6 = _x_3 || _x_4;
  return _x_5 || _x_6;
}
function $compose(_inner_0, _presentFact_0) {
  if (_presentFact_0) {
    const _x_0 = $header();
    return _x_0 + _inner_0;
  } else {
    return "";
  }
}
function $renderRepeat(_repeatFact_0, _course_0, _exercise_0, _draft_0, _refs_0, _capture_0) {
  if (_repeatFact_0) {
    return "";
  } else {
    return $compose($body(_course_0, _exercise_0, _draft_0, _refs_0, _capture_0), true);
  }
}
function $renderCapture(_capPresent_0, _course_0, _exercise_0, _draft_0, _refs_0, _capture_0, _repeat_0) {
  if (_capPresent_0) {
    return $compose($body(_course_0, _exercise_0, _draft_0, _refs_0, _capture_0), true);
  } else {
    return $renderRepeat(_repeat_0, _course_0, _exercise_0, _draft_0, _refs_0, _capture_0);
  }
}
function $renderPresent(_presentFact_0, _course_0, _exercise_0, _draft_0, _refs_0, _capture_0, _repeat_0) {
  if (!_presentFact_0) {
    return "";
  } else {
    return $renderCapture($capturePresent(_capture_0), _course_0, _exercise_0, _draft_0, _refs_0, _capture_0, _repeat_0);
  }
}
function $render(_ctx_0, _refs_0, _repeat_0) {
  const _course_0 = _ctx_0["course"];
  const _exercise_0 = _ctx_0["exercise"];
  const _draft_0 = _ctx_0["draft"];
  const _hasRefs_0 = _ctx_0["hasRefs"];
  const _capture_0 = _ctx_0["capture"];
  return $renderPresent($hasAnything(_hasRefs_0, _course_0, _exercise_0, _draft_0, _capture_0), _course_0, _exercise_0, _draft_0, _refs_0, _capture_0, _repeat_0);
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
function $String_is_empty(_s_0) {
  if (_s_0 === "") {
    return true;
  } else {
    return false;
  }
}
function $String_eq(_a_0, _b_0) {
  return $Cmp_is_eq($String_order(_a_0, _b_0));
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
var studycontext_default = {
  "msg.mark": run_lib(() => str_out(run_loop($msg_mark())), 0),
  "msg.sep": run_lib(() => str_out(run_loop($msg_sep())), 0),
  "msg.pack": run_lib((a0) => str_out(run_loop($msg_pack(a0))), 1),
  "msg.msg": run_lib((a0) => str_out(run_loop($msg_msg(str_in(a0)))), 1),
  "msg.msg1": run_lib((a0, a1, a2) => str_out(run_loop($msg_msg1(str_in(a0), str_in(a1), str_in(a2)))), 3),
  "msg.msg2": run_lib((a0, a1, a2, a3, a4) => str_out(run_loop($msg_msg2(str_in(a0), str_in(a1), str_in(a2), str_in(a3), str_in(a4)))), 5),
  "msg.msg3": run_lib((a0, a1, a2, a3, a4, a5, a6) => str_out(run_loop($msg_msg3(str_in(a0), str_in(a1), str_in(a2), str_in(a3), str_in(a4), str_in(a5), str_in(a6)))), 7),
  "msg.msg4": run_lib((a0, a1, a2, a3, a4, a5, a6, a7, a8) => str_out(run_loop($msg_msg4(str_in(a0), str_in(a1), str_in(a2), str_in(a3), str_in(a4), str_in(a5), str_in(a6), str_in(a7), str_in(a8)))), 9),
  "msg.isMsg": run_lib((a0) => run_loop($msg_isMsg(str_in(a0))), 1),
  header: run_lib(() => str_out(run_loop($header())), 0),
  seg: run_lib((a0) => str_out(run_loop($seg(str_in(a0)))), 1),
  courseLine: run_lib((a0) => str_out(run_loop($courseLine(str_in(a0)))), 1),
  exerciseLine: run_lib((a0) => str_out(run_loop($exerciseLine(str_in(a0)))), 1),
  draftLine: run_lib((a0) => str_out(run_loop($draftLine(str_in(a0)))), 1),
  optional: run_lib((a0, a1, a2) => str_out(run_loop($optional(str_in(a0), str_in(a1), a2))), 3),
  refsHeader: run_lib(() => str_out(run_loop($refsHeader())), 0),
  refLine: run_lib((a0) => str_out(run_loop($refLine(str_in(a0)))), 1),
  refLines: run_lib((a0) => str_out(run_loop($refLines(a0))), 1),
  refsPresent: run_lib((a0) => run_loop($refsPresent(a0)), 1),
  refsBlock: run_lib((a0) => str_out(run_loop($refsBlock(a0))), 1),
  isXournal: run_lib((a0) => run_loop($isXournal(str_in(a0))), 1),
  "captureMatches.pick": run_lib((a0, a1, a2, a3) => str_out(run_loop($captureMatches_pick(a0, str_in(a1), str_in(a2), str_in(a3)))), 4),
  captureMatchesNote: run_lib((a0, a1, a2) => str_out(run_loop($captureMatchesNote(str_in(a0), str_in(a1), str_in(a2)))), 3),
  "captureStale.pick": run_lib((a0, a1, a2, a3) => str_out(run_loop($captureStale_pick(a0, str_in(a1), str_in(a2), str_in(a3)))), 4),
  captureStaleNote: run_lib((a0, a1, a2) => str_out(run_loop($captureStaleNote(str_in(a0), str_in(a1), str_in(a2)))), 3),
  captureNoteGiven: run_lib((a0, a1, a2, a3) => str_out(run_loop($captureNoteGiven(str_in(a0), str_in(a1), str_in(a2), a3))), 4),
  captureNote: run_lib((a0) => str_out(run_loop($captureNote(a0))), 1),
  capturePresent: run_lib((a0) => run_loop($capturePresent(a0)), 1),
  body: run_lib((a0, a1, a2, a3, a4) => str_out(run_loop($body(str_in(a0), str_in(a1), str_in(a2), a3, a4))), 5),
  hasAnything: run_lib((a0, a1, a2, a3, a4) => run_loop($hasAnything(a0, str_in(a1), str_in(a2), str_in(a3), a4)), 5),
  compose: run_lib((a0, a1) => str_out(run_loop($compose(str_in(a0), a1))), 2),
  renderRepeat: run_lib((a0, a1, a2, a3, a4, a5) => str_out(run_loop($renderRepeat(a0, str_in(a1), str_in(a2), str_in(a3), a4, a5))), 6),
  renderCapture: run_lib((a0, a1, a2, a3, a4, a5, a6) => str_out(run_loop($renderCapture(a0, str_in(a1), str_in(a2), str_in(a3), a4, a5, a6))), 7),
  renderPresent: run_lib((a0, a1, a2, a3, a4, a5, a6) => str_out(run_loop($renderPresent(a0, str_in(a1), str_in(a2), str_in(a3), a4, a5, a6))), 7),
  render: run_lib((a0, a1, a2) => str_out(run_loop($render(a0, a1, a2))), 3)
};
export {
  studycontext_default as default
};

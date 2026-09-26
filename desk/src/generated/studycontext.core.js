// GERADO de core/studycontext.bend por `bun core/build.mjs` — não editar à mão.
// core/studycontext.bend
function run_jump(f, x) {
  return { $: "$JMP", f, x };
}
function run_loop(r) {
  while (r !== null && typeof r === "object" && r.$ === "$JMP") {
    r = r.f(...r.x);
  }
  return r;
}
function run_lib(f, n) {
  return (...a) => a.length < n ? run_lib((...b) => f(...a, ...b), n - a.length) : run_loop(f(...a));
}
function $header$() {
  return "[Contexto da Mesa]";
}
function $seg$(_text_0) {
  return `
` + _text_0;
}
function $courseLine$(_course_0) {
  return "- matéria: " + _course_0;
}
function $exerciseLine$(_exercise_0) {
  return "- exercício ativo: " + _exercise_0;
}
function $draftLine$(_draft_0) {
  return "- rascunho Xournal++ aberto: " + _draft_0;
}
function $optional$(_content_0, _prefix_0, _empty_0) {
  if (_empty_0) {
    return "";
  } else {
    return run_jump($seg$, [_prefix_0 + _content_0]);
  }
}
function $refsHeader$() {
  return "- referências abertas na mesa (abertas, não lidas por você):";
}
function $refLine$(_ref_0) {
  return "  · " + _ref_0;
}
function $refLines$(_refs_0) {
  if (_refs_0.$ === "Nil") {
    return "";
  } else {
    const _h_0 = _refs_0["head"];
    const _t_0 = _refs_0["tail"];
    const _x_0 = run_loop($seg$(run_loop($refLine$(_h_0))));
    const _x_1 = run_loop($refLines$(_t_0));
    return _x_0 + _x_1;
  }
}
function $refsPresent$(_refs_0) {
  if (_refs_0.$ === "Nil") {
    return false;
  } else {
    const _h_0 = _refs_0["head"];
    const _t_0 = _refs_0["tail"];
    return true;
  }
}
function $refsBlock$(_refs_0) {
  if (_refs_0.$ === "Nil") {
    return "";
  } else {
    const _h_0 = _refs_0["head"];
    const _t_0 = _refs_0["tail"];
    const _x_0 = run_loop($seg$(run_loop($refsHeader$())));
    const _x_1 = run_loop($refLines$({ $: "Con", ["head"]: _h_0, ["tail"]: _t_0 }));
    return _x_0 + _x_1;
  }
}
function $captureMatchesNote$(_time_0, _exercise_0) {
  const _x_0 = "captura desta mensagem: janela do Xournal++ às " + _time_0;
  const _x_1 = _x_0 + ", do exercício ";
  return _x_1 + _exercise_0;
}
function $captureStaleNote$(_time_0, _exercise_0) {
  const _x_0 = "captura desta mensagem: janela do Xournal++ às " + _time_0;
  const _x_1 = _x_0 + ", do exercício ";
  const _x_2 = _exercise_0 + " — atenção: a captura é de outro exercício, não do ativo";
  return _x_1 + _x_2;
}
function $captureNoteGiven$(_time_0, _exercise_0, _matches_0) {
  if (_matches_0) {
    return run_jump($captureMatchesNote$, [_time_0, _exercise_0]);
  } else {
    return run_jump($captureStaleNote$, [_time_0, _exercise_0]);
  }
}
function $captureNote$(_capture_0) {
  if (_capture_0.$ === "NoCapture") {
    return "";
  } else {
    const _time_0 = _capture_0["time"];
    const _exercise_0 = _capture_0["exercise"];
    const _matches_0 = _capture_0["matches"];
    return run_jump($seg$, [run_loop($captureNoteGiven$(_time_0, _exercise_0, _matches_0))]);
  }
}
function $capturePresent$(_capture_0) {
  if (_capture_0.$ === "NoCapture") {
    return false;
  } else {
    const _time_0 = _capture_0["time"];
    const _exercise_0 = _capture_0["exercise"];
    const _matches_0 = _capture_0["matches"];
    return true;
  }
}
function $body$(_course_0, _exercise_0, _draft_0, _refs_0, _capture_0) {
  const _x_0 = run_loop($optional$(run_loop($courseLine$(_course_0)), "", run_loop($String$is_empty$(_course_0))));
  const _x_1 = run_loop($optional$(run_loop($exerciseLine$(_exercise_0)), "", run_loop($String$is_empty$(_exercise_0))));
  const _x_2 = _x_0 + _x_1;
  const _x_3 = run_loop($optional$(run_loop($draftLine$(_draft_0)), "", run_loop($String$is_empty$(_draft_0))));
  const _x_4 = run_loop($refsBlock$(_refs_0));
  const _x_5 = run_loop($captureNote$(_capture_0));
  const _x_6 = _x_2 + _x_3;
  const _x_7 = _x_4 + _x_5;
  return _x_6 + _x_7;
}
function $hasAnything$(_refsPresentFact_0, _course_0, _exercise_0, _draft_0, _capture_0) {
  const _x_0 = run_loop($Bool$not$(run_loop($String$is_empty$(_course_0))));
  const _x_1 = run_loop($Bool$not$(run_loop($String$is_empty$(_exercise_0))));
  const _x_2 = run_loop($Bool$not$(run_loop($String$is_empty$(_draft_0))));
  const _x_3 = _x_2 || _refsPresentFact_0;
  const _x_4 = run_loop($capturePresent$(_capture_0));
  const _x_5 = _x_0 || _x_1;
  const _x_6 = _x_3 || _x_4;
  return _x_5 || _x_6;
}
function $compose$(_inner_0, _presentFact_0) {
  if (_presentFact_0) {
    const _x_0 = run_loop($header$());
    return _x_0 + _inner_0;
  } else {
    return "";
  }
}
function $renderRepeat$(_repeatFact_0, _course_0, _exercise_0, _draft_0, _refs_0, _capture_0) {
  if (_repeatFact_0) {
    return "";
  } else {
    return run_jump($compose$, [run_loop($body$(_course_0, _exercise_0, _draft_0, _refs_0, _capture_0)), true]);
  }
}
function $renderCapture$(_capPresent_0, _course_0, _exercise_0, _draft_0, _refs_0, _capture_0, _repeat_0) {
  if (_capPresent_0) {
    return run_jump($compose$, [run_loop($body$(_course_0, _exercise_0, _draft_0, _refs_0, _capture_0)), true]);
  } else {
    return run_jump($renderRepeat$, [_repeat_0, _course_0, _exercise_0, _draft_0, _refs_0, _capture_0]);
  }
}
function $renderPresent$(_presentFact_0, _course_0, _exercise_0, _draft_0, _refs_0, _capture_0, _repeat_0) {
  if (!_presentFact_0) {
    return "";
  } else {
    return run_jump($renderCapture$, [run_loop($capturePresent$(_capture_0)), _course_0, _exercise_0, _draft_0, _refs_0, _capture_0, _repeat_0]);
  }
}
function $render$(_ctx_0, _refs_0, _repeat_0) {
  const _course_0 = _ctx_0["course"];
  const _exercise_0 = _ctx_0["exercise"];
  const _draft_0 = _ctx_0["draft"];
  const _hasRefs_0 = _ctx_0["hasRefs"];
  const _capture_0 = _ctx_0["capture"];
  return run_jump($renderPresent$, [run_loop($hasAnything$(_hasRefs_0, _course_0, _exercise_0, _draft_0, _capture_0)), _course_0, _exercise_0, _draft_0, _refs_0, _capture_0, _repeat_0]);
}
function $String$is_empty$(_s_0) {
  if (_s_0 === "") {
    return true;
  } else {
    const _h_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(0, 2) : _s_0[0];
    const _t_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(2) : _s_0.slice(1);
    return false;
  }
}
function $Bool$not$(_b_0) {
  if (!_b_0) {
    return true;
  } else {
    return false;
  }
}
var studycontext_default = {
  header: run_lib($header$, 0),
  seg: run_lib($seg$, 1),
  courseLine: run_lib($courseLine$, 1),
  exerciseLine: run_lib($exerciseLine$, 1),
  draftLine: run_lib($draftLine$, 1),
  optional: run_lib($optional$, 3),
  refsHeader: run_lib($refsHeader$, 0),
  refLine: run_lib($refLine$, 1),
  refLines: run_lib($refLines$, 1),
  refsPresent: run_lib($refsPresent$, 1),
  refsBlock: run_lib($refsBlock$, 1),
  captureMatchesNote: run_lib($captureMatchesNote$, 2),
  captureStaleNote: run_lib($captureStaleNote$, 2),
  captureNoteGiven: run_lib($captureNoteGiven$, 3),
  captureNote: run_lib($captureNote$, 1),
  capturePresent: run_lib($capturePresent$, 1),
  body: run_lib($body$, 5),
  hasAnything: run_lib($hasAnything$, 5),
  compose: run_lib($compose$, 2),
  renderRepeat: run_lib($renderRepeat$, 6),
  renderCapture: run_lib($renderCapture$, 7),
  renderPresent: run_lib($renderPresent$, 7),
  render: run_lib($render$, 3)
};
export {
  studycontext_default as default
};

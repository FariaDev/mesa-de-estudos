// GERADO de core/framing.bend por `bun core/build.mjs` — não editar à mão.
// core/framing.bend
function cmp_new(a, b) {
  return { $: a < b ? "LT" : a === b ? "EQ" : "GT" };
}
function nat_chk(n) {
  if (n > 281474976710655n) {
    throw "bend: a Nat past the largest immediate 2^48-1";
  }
  return n;
}
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
function $prependLine$(_h_0, _more_0) {
  const _lines_0 = _more_0["lines"];
  const _rest_0 = _more_0["rest"];
  const _overflow_0 = _more_0["overflow"];
  return { $: "Frame", ["lines"]: { $: "Con", ["head"]: _h_0, ["tail"]: _lines_0 }, ["rest"]: _rest_0, ["overflow"]: _overflow_0 };
}
function $peel$go$(_t_0, _h_0) {
  if (_t_0.$ === "Nil") {
    return { $: "Frame", ["lines"]: { $: "Nil" }, ["rest"]: _h_0, ["overflow"]: false };
  } else {
    const _h2_0 = _t_0["head"];
    const _t2_0 = _t_0["tail"];
    return run_jump($prependLine$, [_h_0, run_loop($peel$go$(_t2_0, _h2_0))]);
  }
}
function $peel$(_xs_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Frame", ["lines"]: { $: "Nil" }, ["rest"]: "", ["overflow"]: false };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return run_jump($peel$go$, [_t_0, _h_0]);
  }
}
function $split$step$(_h_0, _st_0, _cut_0) {
  const _cur_0 = _st_0["fst"];
  const _acc_0 = _st_0["snd"];
  if (_cut_0) {
    return { $: "Tuple", ["fst"]: "", ["snd"]: { $: "Con", ["head"]: run_loop($String$reverse$(_cur_0)), ["tail"]: _acc_0 } };
  } else {
    return { $: "Tuple", ["fst"]: _h_0 + _cur_0, ["snd"]: _acc_0 };
  }
}
function $split$fin$(_cur_0, _acc_0) {
  return { $: "Frame", ["lines"]: run_loop($List$reverse$(_acc_0)), ["rest"]: run_loop($String$reverse$(_cur_0)), ["overflow"]: false };
}
function $split$go$(_s_0, _st_0) {
  if (_s_0 === "") {
    const _cur_0 = _st_0["fst"];
    const _acc_0 = _st_0["snd"];
    return run_jump($split$fin$, [_cur_0, _acc_0]);
  } else {
    const _h_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(0, 2) : _s_0[0];
    const _t_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(2) : _s_0.slice(1);
    return run_jump($split$go$, [_t_0, run_loop($split$step$(_h_0, _st_0, run_loop($Char$is_eq$(_h_0, `
`))))]);
  }
}
function $split$(_s_0) {
  return run_jump($split$go$, [_s_0, { $: "Tuple", ["fst"]: "", ["snd"]: { $: "Nil" } }]);
}
function $strLength$go$(_s_0, _acc_0) {
  if (_s_0 === "") {
    return _acc_0;
  } else {
    const _h_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(0, 2) : _s_0[0];
    const _t_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(2) : _s_0.slice(1);
    return run_jump($strLength$go$, [_t_0, nat_chk(_acc_0 + 1n)]);
  }
}
function $strLength$(_s_0) {
  return run_jump($strLength$go$, [_s_0, 0n]);
}
function $feed$over$(_joined_0, _over_0) {
  if (_over_0) {
    return { $: "Frame", ["lines"]: { $: "Nil" }, ["rest"]: "", ["overflow"]: true };
  } else {
    return run_jump($split$, [_joined_0]);
  }
}
function $feed$(_buffer_0, _chunk_0, _limit_0) {
  const _joined_0 = _buffer_0 + _chunk_0;
  return run_jump($feed$over$, [_joined_0, run_loop($Nat$is_gt$(run_loop($strLength$(_joined_0)), _limit_0))]);
}
function $rejoin$(_lines_0, _rest_0) {
  if (_lines_0.$ === "Nil") {
    return _rest_0;
  } else {
    const _h_0 = _lines_0["head"];
    const _t_0 = _lines_0["tail"];
    const _x_0 = run_loop($rejoin$(_t_0, _rest_0));
    const _x_1 = `
` + _x_0;
    return _h_0 + _x_1;
  }
}
function $rejoinFrame$(_f_0) {
  const _lines_0 = _f_0["lines"];
  const _rest_0 = _f_0["rest"];
  const _overflow_0 = _f_0["overflow"];
  return run_jump($rejoin$, [_lines_0, _rest_0]);
}
function $overflowOf$(_f_0) {
  const _lines_0 = _f_0["lines"];
  const _rest_0 = _f_0["rest"];
  const _overflow_0 = _f_0["overflow"];
  return _overflow_0;
}
function $String$reverse$(_s_0) {
  return run_jump($String$reverse$go$, [_s_0, ""]);
}
function $List$reverse$(_xs_0) {
  return run_jump($List$reverse$go$, [_xs_0, { $: "Nil" }]);
}
function $Char$is_eq$(_a_0, _b_0) {
  const _x_0 = _a_0.codePointAt(0);
  const _y_0 = _b_0.codePointAt(0);
  return _x_0 === _y_0;
}
function $Nat$is_gt$(_a_0, _b_0) {
  return run_jump($Cmp$is_gt$, [cmp_new(_a_0, _b_0)]);
}
function $String$reverse$go$(_s_0, _acc_0) {
  if (_s_0 === "") {
    return _acc_0;
  } else {
    const _h_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(0, 2) : _s_0[0];
    const _t_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(2) : _s_0.slice(1);
    return run_jump($String$reverse$go$, [_t_0, _h_0 + _acc_0]);
  }
}
function $List$reverse$go$(_xs_0, _acc_0) {
  if (_xs_0.$ === "Nil") {
    return _acc_0;
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return run_jump($List$reverse$go$, [_t_0, { $: "Con", ["head"]: _h_0, ["tail"]: _acc_0 }]);
  }
}
function $Cmp$is_gt$(_c_0) {
  if (_c_0.$ === "LT") {
    return false;
  } else if (_c_0.$ === "EQ") {
    return false;
  } else {
    return true;
  }
}
var framing_default = {
  prependLine: run_lib($prependLine$, 2),
  "peel.go": run_lib($peel$go$, 2),
  peel: run_lib($peel$, 1),
  "split.step": run_lib($split$step$, 3),
  "split.fin": run_lib($split$fin$, 2),
  "split.go": run_lib($split$go$, 2),
  split: run_lib($split$, 1),
  "strLength.go": run_lib($strLength$go$, 2),
  strLength: run_lib($strLength$, 1),
  "feed.over": run_lib($feed$over$, 2),
  feed: run_lib($feed$, 3),
  rejoin: run_lib($rejoin$, 2),
  rejoinFrame: run_lib($rejoinFrame$, 1),
  overflowOf: run_lib($overflowOf$, 1)
};
export {
  framing_default as default
};

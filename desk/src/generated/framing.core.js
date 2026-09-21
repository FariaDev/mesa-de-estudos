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
function $prependLine$(h_0, more_0) {
  const lines_0 = more_0.lines;
  const rest_0 = more_0.rest;
  const overflow_0 = more_0.overflow;
  return { $: "Frame", ["lines"]: { $: "Con", ["head"]: h_0, ["tail"]: lines_0 }, ["rest"]: rest_0, ["overflow"]: overflow_0 };
}
function $peel$go$(t_0, h_0) {
  if (t_0.$ === "Nil") {
    return { $: "Frame", ["lines"]: { $: "Nil" }, ["rest"]: h_0, ["overflow"]: false };
  } else {
    const h2_0 = t_0.head;
    const t2_0 = t_0.tail;
    return run_jump($prependLine$, [h_0, run_loop($peel$go$(t2_0, h2_0))]);
  }
}
function $peel$(xs_0) {
  if (xs_0.$ === "Nil") {
    return { $: "Frame", ["lines"]: { $: "Nil" }, ["rest"]: "", ["overflow"]: false };
  } else {
    const h_0 = xs_0.head;
    const t_0 = xs_0.tail;
    return run_jump($peel$go$, [t_0, h_0]);
  }
}
function $split$step$(h_0, st_0, cut_0) {
  const cur_0 = st_0.fst;
  const acc_0 = st_0.snd;
  if (cut_0) {
    return { $: "Tuple", ["fst"]: "", ["snd"]: { $: "Con", ["head"]: run_loop($String$reverse$(cur_0)), ["tail"]: acc_0 } };
  } else {
    return { $: "Tuple", ["fst"]: h_0 + cur_0, ["snd"]: acc_0 };
  }
}
function $split$fin$(cur_0, acc_0) {
  return { $: "Frame", ["lines"]: run_loop($List$reverse$(acc_0)), ["rest"]: run_loop($String$reverse$(cur_0)), ["overflow"]: false };
}
function $split$go$(s_0, st_0) {
  if (s_0 === "") {
    const cur_0 = st_0.fst;
    const acc_0 = st_0.snd;
    return run_jump($split$fin$, [cur_0, acc_0]);
  } else {
    const h_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(0, 2) : s_0[0];
    const t_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(2) : s_0.slice(1);
    const h_1 = h_0;
    return run_jump($split$go$, [t_0, run_loop($split$step$(h_1, st_0, run_loop($Char$is_eq$(h_1, `
`))))]);
  }
}
function $split$(s_0) {
  return run_jump($split$go$, [s_0, { $: "Tuple", ["fst"]: "", ["snd"]: { $: "Nil" } }]);
}
function $strLength$go$(s_0, acc_0) {
  if (s_0 === "") {
    return acc_0;
  } else {
    const h_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(0, 2) : s_0[0];
    const t_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(2) : s_0.slice(1);
    return run_jump($strLength$go$, [t_0, nat_chk(acc_0 + 1n)]);
  }
}
function $strLength$(s_0) {
  return run_jump($strLength$go$, [s_0, 0n]);
}
function $feed$over$(joined_0, over_0) {
  if (over_0) {
    return { $: "Frame", ["lines"]: { $: "Nil" }, ["rest"]: "", ["overflow"]: true };
  } else {
    return run_jump($split$, [joined_0]);
  }
}
function $feed$(buffer_0, chunk_0, limit_0) {
  const joined_0 = buffer_0 + chunk_0;
  return run_jump($feed$over$, [joined_0, run_loop($Nat$is_gt$(run_loop($strLength$(joined_0)), limit_0))]);
}
function $rejoin$(lines_0, rest_0) {
  if (lines_0.$ === "Nil") {
    return rest_0;
  } else {
    const h_0 = lines_0.head;
    const t_0 = lines_0.tail;
    const x_0 = run_loop($rejoin$(t_0, rest_0));
    const x_1 = `
` + x_0;
    return h_0 + x_1;
  }
}
function $rejoinFrame$(f_0) {
  const lines_0 = f_0.lines;
  const rest_0 = f_0.rest;
  const overflow_0 = f_0.overflow;
  return run_jump($rejoin$, [lines_0, rest_0]);
}
function $overflowOf$(f_0) {
  const lines_0 = f_0.lines;
  const rest_0 = f_0.rest;
  const overflow_0 = f_0.overflow;
  return overflow_0;
}
function $String$reverse$(s_0) {
  return run_jump($String$reverse$go$, [s_0, ""]);
}
function $List$reverse$(xs_0) {
  return run_jump($List$reverse$go$, [xs_0, { $: "Nil" }]);
}
function $Char$is_eq$(a_0, b_0) {
  const x_0 = a_0.codePointAt(0);
  const y_0 = b_0.codePointAt(0);
  return x_0 === y_0;
}
function $Nat$is_gt$(a_0, b_0) {
  return run_jump($Cmp$is_gt$, [cmp_new(a_0, b_0)]);
}
function $String$reverse$go$(s_0, acc_0) {
  if (s_0 === "") {
    return acc_0;
  } else {
    const h_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(0, 2) : s_0[0];
    const t_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(2) : s_0.slice(1);
    return run_jump($String$reverse$go$, [t_0, h_0 + acc_0]);
  }
}
function $List$reverse$go$(xs_0, acc_0) {
  if (xs_0.$ === "Nil") {
    return acc_0;
  } else {
    const h_0 = xs_0.head;
    const t_0 = xs_0.tail;
    return run_jump($List$reverse$go$, [t_0, { $: "Con", ["head"]: h_0, ["tail"]: acc_0 }]);
  }
}
function $Cmp$is_gt$(c_0) {
  if (c_0.$ === "LT") {
    return false;
  } else if (c_0.$ === "EQ") {
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

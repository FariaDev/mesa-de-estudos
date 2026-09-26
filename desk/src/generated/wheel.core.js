// GERADO de core/wheel.bend por `bun core/build.mjs` — não editar à mão.
// core/wheel.bend
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
function $pageTurn$under$(_under_0, _next_0) {
  if (_under_0) {
    return { $: "Spin", ["accum"]: 0, ["turn"]: { $: "Prev" } };
  } else {
    return { $: "Spin", ["accum"]: _next_0, ["turn"]: { $: "Stay" } };
  }
}
function $pageTurn$turn$(_over_0, _under_0, _next_0) {
  if (_over_0) {
    return { $: "Spin", ["accum"]: 0, ["turn"]: { $: "Next" } };
  } else {
    return run_jump($pageTurn$under$, [_under_0, _next_0]);
  }
}
function $pageTurn$dir$(_towardNext_0, _towardPrev_0, _over_0, _under_0, _accum_0, _next_0) {
  if (_towardNext_0) {
    return run_jump($pageTurn$turn$, [_over_0, _under_0, _next_0]);
  } else {
    if (_towardPrev_0) {
      return run_jump($pageTurn$turn$, [_over_0, _under_0, _next_0]);
    } else {
      return { $: "Spin", ["accum"]: _accum_0, ["turn"]: { $: "Stay" } };
    }
  }
}
function $pageTurn$edge$(_towardNext_0, _towardPrev_0, _atTop_0, _atBottom_0, _over_0, _under_0, _accum_0, _next_0) {
  if (_towardNext_0) {
    if (_atBottom_0) {
      return run_jump($pageTurn$dir$, [true, _towardPrev_0, _over_0, _under_0, _accum_0, _next_0]);
    } else {
      return { $: "Spin", ["accum"]: 0, ["turn"]: { $: "Stay" } };
    }
  } else {
    if (_towardPrev_0) {
      if (_atTop_0) {
        return run_jump($pageTurn$dir$, [false, true, _over_0, _under_0, _accum_0, _next_0]);
      } else {
        return { $: "Spin", ["accum"]: 0, ["turn"]: { $: "Stay" } };
      }
    } else {
      return run_jump($pageTurn$dir$, [false, false, _over_0, _under_0, _accum_0, _next_0]);
    }
  }
}
function $pageTurn$open$(_fits_0, _towardNext_0, _towardPrev_0, _atTop_0, _atBottom_0, _over_0, _under_0, _accum_0, _next_0) {
  if (_fits_0) {
    return run_jump($pageTurn$dir$, [_towardNext_0, _towardPrev_0, _over_0, _under_0, _accum_0, _next_0]);
  } else {
    return run_jump($pageTurn$edge$, [_towardNext_0, _towardPrev_0, _atTop_0, _atBottom_0, _over_0, _under_0, _accum_0, _next_0]);
  }
}
function $pageTurn$(_blocked_0, _fits_0, _towardNext_0, _towardPrev_0, _atTop_0, _atBottom_0, _over_0, _under_0, _accum_0, _next_0) {
  if (_blocked_0) {
    return { $: "Spin", ["accum"]: 0, ["turn"]: { $: "Stay" } };
  } else {
    return run_jump($pageTurn$open$, [_fits_0, _towardNext_0, _towardPrev_0, _atTop_0, _atBottom_0, _over_0, _under_0, _accum_0, _next_0]);
  }
}
var wheel_default = {
  "pageTurn.under": run_lib($pageTurn$under$, 2),
  "pageTurn.turn": run_lib($pageTurn$turn$, 3),
  "pageTurn.dir": run_lib($pageTurn$dir$, 6),
  "pageTurn.edge": run_lib($pageTurn$edge$, 8),
  "pageTurn.open": run_lib($pageTurn$open$, 9),
  pageTurn: run_lib($pageTurn$, 10)
};
export {
  wheel_default as default
};

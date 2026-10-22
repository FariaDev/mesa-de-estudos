// GERADO de core/wheel.bend por `bun core/build.mjs` — não editar à mão.
// core/wheel.bend
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
function $pageTurn_under(_under_0, _next_0) {
  if (_under_0) {
    return { $: "Spin", accum: 0, turn: { $: "Prev" } };
  } else {
    return { $: "Spin", accum: _next_0, turn: { $: "Stay" } };
  }
}
function $pageTurn_turn(_over_0, _under_0, _next_0) {
  if (_over_0) {
    return { $: "Spin", accum: 0, turn: { $: "Next" } };
  } else {
    return $pageTurn_under(_under_0, _next_0);
  }
}
function $pageTurn_dir(_towardNext_0, _towardPrev_0, _over_0, _under_0, _accum_0, _next_0) {
  if (_towardNext_0) {
    return $pageTurn_turn(_over_0, _under_0, _next_0);
  } else {
    if (_towardPrev_0) {
      return $pageTurn_turn(_over_0, _under_0, _next_0);
    } else {
      return { $: "Spin", accum: _accum_0, turn: { $: "Stay" } };
    }
  }
}
function $pageTurn_edge(_towardNext_0, _towardPrev_0, _atTop_0, _atBottom_0, _over_0, _under_0, _accum_0, _next_0) {
  if (_towardNext_0) {
    if (_atBottom_0) {
      return $pageTurn_dir(true, _towardPrev_0, _over_0, _under_0, _accum_0, _next_0);
    } else {
      return { $: "Spin", accum: 0, turn: { $: "Stay" } };
    }
  } else {
    if (_towardPrev_0) {
      if (_atTop_0) {
        return $pageTurn_dir(false, true, _over_0, _under_0, _accum_0, _next_0);
      } else {
        return { $: "Spin", accum: 0, turn: { $: "Stay" } };
      }
    } else {
      return $pageTurn_dir(false, false, _over_0, _under_0, _accum_0, _next_0);
    }
  }
}
function $pageTurn_open(_fits_0, _towardNext_0, _towardPrev_0, _atTop_0, _atBottom_0, _over_0, _under_0, _accum_0, _next_0) {
  if (_fits_0) {
    return $pageTurn_dir(_towardNext_0, _towardPrev_0, _over_0, _under_0, _accum_0, _next_0);
  } else {
    return $pageTurn_edge(_towardNext_0, _towardPrev_0, _atTop_0, _atBottom_0, _over_0, _under_0, _accum_0, _next_0);
  }
}
function $pageTurn(_blocked_0, _fits_0, _towardNext_0, _towardPrev_0, _atTop_0, _atBottom_0, _over_0, _under_0, _accum_0, _next_0) {
  if (_blocked_0) {
    return { $: "Spin", accum: 0, turn: { $: "Stay" } };
  } else {
    return $pageTurn_open(_fits_0, _towardNext_0, _towardPrev_0, _atTop_0, _atBottom_0, _over_0, _under_0, _accum_0, _next_0);
  }
}
var wheel_default = {
  "pageTurn.under": run_lib((a0, a1) => run_loop($pageTurn_under(a0, Math.fround(a1))), 2),
  "pageTurn.turn": run_lib((a0, a1, a2) => run_loop($pageTurn_turn(a0, a1, Math.fround(a2))), 3),
  "pageTurn.dir": run_lib((a0, a1, a2, a3, a4, a5) => run_loop($pageTurn_dir(a0, a1, a2, a3, Math.fround(a4), Math.fround(a5))), 6),
  "pageTurn.edge": run_lib((a0, a1, a2, a3, a4, a5, a6, a7) => run_loop($pageTurn_edge(a0, a1, a2, a3, a4, a5, Math.fround(a6), Math.fround(a7))), 8),
  "pageTurn.open": run_lib((a0, a1, a2, a3, a4, a5, a6, a7, a8) => run_loop($pageTurn_open(a0, a1, a2, a3, a4, a5, a6, Math.fround(a7), Math.fround(a8))), 9),
  pageTurn: run_lib((a0, a1, a2, a3, a4, a5, a6, a7, a8, a9) => run_loop($pageTurn(a0, a1, a2, a3, a4, a5, a6, a7, Math.fround(a8), Math.fround(a9))), 10)
};
export {
  wheel_default as default
};

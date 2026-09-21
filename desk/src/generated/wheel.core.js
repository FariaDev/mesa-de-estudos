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
function $pageTurn$under$(under_0, next_0) {
  if (under_0) {
    return { $: "Spin", ["accum"]: 0, ["turn"]: { $: "Prev" } };
  } else {
    return { $: "Spin", ["accum"]: next_0, ["turn"]: { $: "Stay" } };
  }
}
function $pageTurn$turn$(over_0, under_0, next_0) {
  if (over_0) {
    return { $: "Spin", ["accum"]: 0, ["turn"]: { $: "Next" } };
  } else {
    return run_jump($pageTurn$under$, [under_0, next_0]);
  }
}
function $pageTurn$dir$(towardNext_0, towardPrev_0, over_0, under_0, accum_0, next_0) {
  if (towardNext_0) {
    return run_jump($pageTurn$turn$, [over_0, under_0, next_0]);
  } else {
    if (towardPrev_0) {
      return run_jump($pageTurn$turn$, [over_0, under_0, next_0]);
    } else {
      return { $: "Spin", ["accum"]: accum_0, ["turn"]: { $: "Stay" } };
    }
  }
}
function $pageTurn$edge$(towardNext_0, towardPrev_0, atTop_0, atBottom_0, over_0, under_0, accum_0, next_0) {
  if (towardNext_0) {
    if (atBottom_0) {
      return run_jump($pageTurn$dir$, [true, towardPrev_0, over_0, under_0, accum_0, next_0]);
    } else {
      return { $: "Spin", ["accum"]: 0, ["turn"]: { $: "Stay" } };
    }
  } else {
    if (towardPrev_0) {
      if (atTop_0) {
        return run_jump($pageTurn$dir$, [false, true, over_0, under_0, accum_0, next_0]);
      } else {
        return { $: "Spin", ["accum"]: 0, ["turn"]: { $: "Stay" } };
      }
    } else {
      return run_jump($pageTurn$dir$, [false, false, over_0, under_0, accum_0, next_0]);
    }
  }
}
function $pageTurn$open$(fits_0, towardNext_0, towardPrev_0, atTop_0, atBottom_0, over_0, under_0, accum_0, next_0) {
  if (fits_0) {
    return run_jump($pageTurn$dir$, [towardNext_0, towardPrev_0, over_0, under_0, accum_0, next_0]);
  } else {
    return run_jump($pageTurn$edge$, [towardNext_0, towardPrev_0, atTop_0, atBottom_0, over_0, under_0, accum_0, next_0]);
  }
}
function $pageTurn$(blocked_0, fits_0, towardNext_0, towardPrev_0, atTop_0, atBottom_0, over_0, under_0, accum_0, next_0) {
  if (blocked_0) {
    return { $: "Spin", ["accum"]: 0, ["turn"]: { $: "Stay" } };
  } else {
    return run_jump($pageTurn$open$, [fits_0, towardNext_0, towardPrev_0, atTop_0, atBottom_0, over_0, under_0, accum_0, next_0]);
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

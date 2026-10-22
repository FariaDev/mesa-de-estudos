// GERADO de core/overlay.bend por `bun core/build.mjs` — não editar à mão.
// core/overlay.bend
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
function $viewStateClear(_clear_0) {
  if (_clear_0) {
    return { $: "ViewShown" };
  } else {
    return { $: "ViewCovered" };
  }
}
function $viewState(_active_0, _overlays_0) {
  if (!_active_0) {
    return { $: "ViewOff" };
  } else {
    return $viewStateClear(_overlays_0 === 0);
  }
}
var overlay_default = {
  viewStateClear: run_lib((a0) => run_loop($viewStateClear(a0)), 1),
  viewState: run_lib((a0, a1) => run_loop($viewState(a0, a1)), 2)
};
export {
  overlay_default as default
};

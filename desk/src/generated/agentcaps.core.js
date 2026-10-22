// GERADO de core/agentcaps.bend por `bun core/build.mjs` — não editar à mão.
// core/agentcaps.bend
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
function $piCaps() {
  return { $: "Caps", images: true, permissions: true, steer: true, compact: true, autoCompaction: true, modelSelection: true, effort: true, reviewDraft: true, commands: true, geogebra: true, quiz: true, contextUsage: true };
}
function $claudeCaps() {
  return { $: "Caps", images: true, permissions: true, steer: true, compact: true, autoCompaction: false, modelSelection: false, effort: false, reviewDraft: true, commands: true, geogebra: true, quiz: true, contextUsage: true };
}
function $claudeControlCaps(_catalogReady_0, _effortSupported_0) {
  if (!_catalogReady_0) {
    return $claudeCaps();
  } else {
    return { $: "Caps", images: true, permissions: true, steer: true, compact: true, autoCompaction: false, modelSelection: true, effort: _effortSupported_0, reviewDraft: true, commands: true, geogebra: true, quiz: true, contextUsage: true };
  }
}
function $opencodeCaps() {
  return { $: "Caps", images: true, permissions: true, steer: true, compact: true, autoCompaction: false, modelSelection: false, effort: false, reviewDraft: false, commands: true, geogebra: true, quiz: true, contextUsage: true };
}
function $opencodeControlCaps(_catalogReady_0, _effortSupported_0) {
  if (!_catalogReady_0) {
    return $opencodeCaps();
  } else {
    return { $: "Caps", images: true, permissions: true, steer: true, compact: true, autoCompaction: false, modelSelection: true, effort: _effortSupported_0, reviewDraft: false, commands: true, geogebra: true, quiz: true, contextUsage: true };
  }
}
function $unknownCaps() {
  return { $: "Caps", images: false, permissions: false, steer: false, compact: false, autoCompaction: false, modelSelection: false, effort: false, reviewDraft: false, commands: false, geogebra: false, quiz: false, contextUsage: false };
}
function $imagesAllowed(_images_0, _hasImages_0) {
  if (_hasImages_0) {
    return _images_0;
  } else {
    return true;
  }
}
function $canSteer(_caps_0, _busy_0) {
  const _steer_0 = _caps_0["steer"];
  return $Bool_and(_steer_0, _busy_0);
}
function $canSend(_caps_0, _busy_0, _hasImages_0) {
  const _images_0 = _caps_0["images"];
  const _steer_0 = _caps_0["steer"];
  const _x_0 = $Bool_not(_busy_0);
  return $Bool_and($imagesAllowed(_images_0, _hasImages_0), _x_0 || _steer_0);
}
function $controlVisible(_caps_0, _control_0) {
  const _images_0 = _caps_0["images"];
  const __0 = _caps_0["permissions"];
  const __1 = _caps_0["steer"];
  const __2 = _caps_0["compact"];
  const __3 = _caps_0["autoCompaction"];
  const __4 = _caps_0["modelSelection"];
  const __5 = _caps_0["effort"];
  const __6 = _caps_0["reviewDraft"];
  const __7 = _caps_0["commands"];
  const __8 = _caps_0["geogebra"];
  const __9 = _caps_0["quiz"];
  const __10 = _caps_0["contextUsage"];
  if (_control_0.$ === "ControlImages") {
    return _images_0;
  } else if (_control_0.$ === "ControlPermissions") {
    return __0;
  } else if (_control_0.$ === "ControlSteer") {
    return __1;
  } else if (_control_0.$ === "ControlCompact") {
    return __2;
  } else if (_control_0.$ === "ControlAutoCompaction") {
    return __3;
  } else if (_control_0.$ === "ControlModelSelection") {
    return __4;
  } else if (_control_0.$ === "ControlEffort") {
    return __5;
  } else if (_control_0.$ === "ControlReviewDraft") {
    return __6;
  } else if (_control_0.$ === "ControlCommands") {
    return __7;
  } else if (_control_0.$ === "ControlGeogebra") {
    return __8;
  } else if (_control_0.$ === "ControlQuiz") {
    return __9;
  } else {
    return __10;
  }
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
var agentcaps_default = {
  piCaps: run_lib(() => run_loop($piCaps()), 0),
  claudeCaps: run_lib(() => run_loop($claudeCaps()), 0),
  claudeControlCaps: run_lib((a0, a1) => run_loop($claudeControlCaps(a0, a1)), 2),
  opencodeCaps: run_lib(() => run_loop($opencodeCaps()), 0),
  opencodeControlCaps: run_lib((a0, a1) => run_loop($opencodeControlCaps(a0, a1)), 2),
  unknownCaps: run_lib(() => run_loop($unknownCaps()), 0),
  imagesAllowed: run_lib((a0, a1) => run_loop($imagesAllowed(a0, a1)), 2),
  canSteer: run_lib((a0, a1) => run_loop($canSteer(a0, a1)), 2),
  canSend: run_lib((a0, a1, a2) => run_loop($canSend(a0, a1, a2)), 3),
  controlVisible: run_lib((a0, a1) => run_loop($controlVisible(a0, a1)), 2)
};
export {
  agentcaps_default as default
};

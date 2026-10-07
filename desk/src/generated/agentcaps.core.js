// GERADO de core/agentcaps.bend por `bun core/build.mjs` — não editar à mão.
// core/agentcaps.bend
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
function $piCaps$() {
  return { $: "Caps", ["images"]: true, ["permissions"]: true, ["steer"]: true, ["compact"]: true, ["autoCompaction"]: true, ["modelSelection"]: true, ["effort"]: true, ["reviewDraft"]: true, ["handoff"]: true, ["commands"]: true, ["geogebra"]: true, ["quiz"]: true, ["contextUsage"]: true };
}
function $claudeCaps$() {
  return { $: "Caps", ["images"]: true, ["permissions"]: true, ["steer"]: false, ["compact"]: false, ["autoCompaction"]: false, ["modelSelection"]: false, ["effort"]: false, ["reviewDraft"]: false, ["handoff"]: false, ["commands"]: false, ["geogebra"]: false, ["quiz"]: false, ["contextUsage"]: false };
}
function $claudeControlCaps$(_catalogReady_0, _effortSupported_0) {
  if (!_catalogReady_0) {
    return run_jump($claudeCaps$, []);
  } else {
    return { $: "Caps", ["images"]: true, ["permissions"]: true, ["steer"]: false, ["compact"]: false, ["autoCompaction"]: false, ["modelSelection"]: true, ["effort"]: _effortSupported_0, ["reviewDraft"]: false, ["handoff"]: false, ["commands"]: false, ["geogebra"]: false, ["quiz"]: false, ["contextUsage"]: false };
  }
}
function $imagesAllowed$(_images_0, _hasImages_0) {
  if (_hasImages_0) {
    return _images_0;
  } else {
    return true;
  }
}
function $canSteer$(_caps_0, _busy_0) {
  const __0 = _caps_0["images"];
  const __1 = _caps_0["permissions"];
  const _steer_0 = _caps_0["steer"];
  const __2 = _caps_0["compact"];
  const __3 = _caps_0["autoCompaction"];
  const __4 = _caps_0["modelSelection"];
  const __5 = _caps_0["effort"];
  const __6 = _caps_0["reviewDraft"];
  const __7 = _caps_0["handoff"];
  const __8 = _caps_0["commands"];
  const __9 = _caps_0["geogebra"];
  const __10 = _caps_0["quiz"];
  const __11 = _caps_0["contextUsage"];
  return run_jump($Bool$and$, [_steer_0, _busy_0]);
}
function $canSend$(_caps_0, _busy_0, _hasImages_0) {
  const _images_0 = _caps_0["images"];
  const __0 = _caps_0["permissions"];
  const _steer_0 = _caps_0["steer"];
  const __1 = _caps_0["compact"];
  const __2 = _caps_0["autoCompaction"];
  const __3 = _caps_0["modelSelection"];
  const __4 = _caps_0["effort"];
  const __5 = _caps_0["reviewDraft"];
  const __6 = _caps_0["handoff"];
  const __7 = _caps_0["commands"];
  const __8 = _caps_0["geogebra"];
  const __9 = _caps_0["quiz"];
  const __10 = _caps_0["contextUsage"];
  const _x_0 = run_loop($Bool$not$(_busy_0));
  return run_jump($Bool$and$, [run_loop($imagesAllowed$(_images_0, _hasImages_0)), _x_0 || _steer_0]);
}
function $controlVisible$(_caps_0, _control_0) {
  const _images_0 = _caps_0["images"];
  const __0 = _caps_0["permissions"];
  const __1 = _caps_0["steer"];
  const __2 = _caps_0["compact"];
  const __3 = _caps_0["autoCompaction"];
  const __4 = _caps_0["modelSelection"];
  const __5 = _caps_0["effort"];
  const __6 = _caps_0["reviewDraft"];
  const __7 = _caps_0["handoff"];
  const __8 = _caps_0["commands"];
  const __9 = _caps_0["geogebra"];
  const __10 = _caps_0["quiz"];
  const __11 = _caps_0["contextUsage"];
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
  } else if (_control_0.$ === "ControlHandoff") {
    return __7;
  } else if (_control_0.$ === "ControlCommands") {
    return __8;
  } else if (_control_0.$ === "ControlGeogebra") {
    return __9;
  } else if (_control_0.$ === "ControlQuiz") {
    return __10;
  } else {
    return __11;
  }
}
function $Bool$and$(_a_0, _b_0) {
  if (!_a_0) {
    return false;
  } else {
    return _b_0;
  }
}
function $Bool$not$(_b_0) {
  if (!_b_0) {
    return true;
  } else {
    return false;
  }
}
var agentcaps_default = {
  piCaps: run_lib($piCaps$, 0),
  claudeCaps: run_lib($claudeCaps$, 0),
  claudeControlCaps: run_lib($claudeControlCaps$, 2),
  imagesAllowed: run_lib($imagesAllowed$, 2),
  canSteer: run_lib($canSteer$, 2),
  canSend: run_lib($canSend$, 3),
  controlVisible: run_lib($controlVisible$, 2)
};
export {
  agentcaps_default as default
};

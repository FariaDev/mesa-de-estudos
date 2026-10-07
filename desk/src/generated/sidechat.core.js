// GERADO de core/sidechat.bend por `bun core/build.mjs` — não editar à mão.
// core/sidechat.bend
function cmp_new(a, b) {
  return { $: a < b ? "LT" : a === b ? "EQ" : "GT" };
}
function char_new(code) {
  if (code > 1114111 || code >= 55296 && code <= 57343) {
    throw "bend: " + code + " is not a Unicode scalar value";
  }
  return String.fromCodePoint(code);
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
function $scoped$(_descriptorSession_0, _currentSession_0, _descriptorCourse_0, _currentCourse_0) {
  return run_jump($Bool$and$, [run_loop($String$eq$(_descriptorSession_0, _currentSession_0)), run_loop($String$eq$(_descriptorCourse_0, _currentCourse_0))]);
}
function $eventAllowed$(_eventId_0, _activeId_0) {
  return run_jump($String$eq$, [_eventId_0, _activeId_0]);
}
function $recoversTo$(_status_0) {
  if (_status_0.$ === "SidechatStatus.Idle") {
    return { $: "SidechatStatus.Idle" };
  } else if (_status_0.$ === "SidechatStatus.Transmitting") {
    return { $: "SidechatStatus.Uncertain" };
  } else if (_status_0.$ === "SidechatStatus.Accepted") {
    return { $: "SidechatStatus.Accepted" };
  } else if (_status_0.$ === "SidechatStatus.Settled") {
    return { $: "SidechatStatus.Settled" };
  } else if (_status_0.$ === "SidechatStatus.Refused") {
    return { $: "SidechatStatus.Refused" };
  } else {
    return { $: "SidechatStatus.Uncertain" };
  }
}
function $autoResend$(_status_0) {
  if (_status_0.$ === "SidechatStatus.Idle") {
    return false;
  } else if (_status_0.$ === "SidechatStatus.Transmitting") {
    return false;
  } else if (_status_0.$ === "SidechatStatus.Accepted") {
    return false;
  } else if (_status_0.$ === "SidechatStatus.Settled") {
    return false;
  } else if (_status_0.$ === "SidechatStatus.Refused") {
    return false;
  } else {
    return false;
  }
}
function $canPrompt$(_busy_0, _deliveryInFlight_0) {
  return run_jump($Bool$and$, [run_loop($Bool$not$(_busy_0)), run_loop($Bool$not$(_deliveryInFlight_0))]);
}
function $contextChanged$(_deliveredKey_0, _currentKey_0) {
  return run_jump($Bool$not$, [run_loop($String$eq$(_deliveredKey_0, _currentKey_0))]);
}
function $Bool$and$(_a_0, _b_0) {
  if (!_a_0) {
    return false;
  } else {
    return _b_0;
  }
}
function $String$eq$(_a_0, _b_0) {
  return run_jump($String$eq$fin$, [run_loop($String$cmp$(_a_0, _b_0))]);
}
function $Bool$not$(_b_0) {
  if (!_b_0) {
    return true;
  } else {
    return false;
  }
}
function $String$eq$fin$(_r_0) {
  const _t_0 = _r_0["fst"];
  const _a2_0 = _t_0["fst"];
  const _b2_0 = _t_0["snd"];
  const _c_0 = _r_0["snd"];
  return run_jump($Cmp$is_eq$, [_c_0]);
}
function $String$cmp$(_a_0, _b_0) {
  if (_a_0 === "") {
    if (_b_0 === "") {
      return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: "", ["snd"]: "" }, ["snd"]: { $: "EQ" } };
    } else {
      const _h_0 = _b_0.codePointAt(0) > 65535 ? _b_0.slice(0, 2) : _b_0[0];
      const _t_0 = _b_0.codePointAt(0) > 65535 ? _b_0.slice(2) : _b_0.slice(1);
      return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: "", ["snd"]: _h_0 + _t_0 }, ["snd"]: { $: "LT" } };
    }
  } else {
    const _h_1 = _a_0.codePointAt(0) > 65535 ? _a_0.slice(0, 2) : _a_0[0];
    const _t_1 = _a_0.codePointAt(0) > 65535 ? _a_0.slice(2) : _a_0.slice(1);
    if (_b_0 === "") {
      return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: _h_1 + _t_1, ["snd"]: "" }, ["snd"]: { $: "GT" } };
    } else {
      const _h2_0 = _b_0.codePointAt(0) > 65535 ? _b_0.slice(0, 2) : _b_0[0];
      const _t2_0 = _b_0.codePointAt(0) > 65535 ? _b_0.slice(2) : _b_0.slice(1);
      return run_jump($String$cmp$fin$, [_t_1, _t2_0, run_loop($Char$cmp$(_h_1, _h2_0))]);
    }
  }
}
function $Cmp$is_eq$(_c_0) {
  if (_c_0.$ === "LT") {
    return false;
  } else if (_c_0.$ === "EQ") {
    return true;
  } else {
    return false;
  }
}
function $String$cmp$fin$(_t1_0, _t2_0, _hc_0) {
  const _t_0 = _hc_0["fst"];
  const _h1b_0 = _t_0["fst"];
  const _h2b_0 = _t_0["snd"];
  const _t_1 = _hc_0["snd"];
  if (_t_1.$ === "LT") {
    return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: _h1b_0 + _t1_0, ["snd"]: _h2b_0 + _t2_0 }, ["snd"]: { $: "LT" } };
  } else if (_t_1.$ === "EQ") {
    return run_jump($String$cmp$rec$, [_h1b_0, _h2b_0, run_loop($String$cmp$(_t1_0, _t2_0))]);
  } else {
    return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: _h1b_0 + _t1_0, ["snd"]: _h2b_0 + _t2_0 }, ["snd"]: { $: "GT" } };
  }
}
function $Char$cmp$(_a_0, _b_0) {
  const _x_0 = _a_0.codePointAt(0);
  const _y_0 = _b_0.codePointAt(0);
  return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: char_new(_x_0), ["snd"]: char_new(_y_0) }, ["snd"]: cmp_new(_x_0, _y_0) };
}
function $String$cmp$rec$(_h1b_0, _h2b_0, _rr_0) {
  const _t_0 = _rr_0["fst"];
  const _t1b_0 = _t_0["fst"];
  const _t2b_0 = _t_0["snd"];
  const _r_0 = _rr_0["snd"];
  return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: _h1b_0 + _t1b_0, ["snd"]: _h2b_0 + _t2b_0 }, ["snd"]: _r_0 };
}
var sidechat_default = {
  scoped: run_lib($scoped$, 4),
  eventAllowed: run_lib($eventAllowed$, 2),
  recoversTo: run_lib($recoversTo$, 1),
  autoResend: run_lib($autoResend$, 1),
  canPrompt: run_lib($canPrompt$, 2),
  contextChanged: run_lib($contextChanged$, 2)
};
export {
  sidechat_default as default
};

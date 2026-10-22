// GERADO de core/agentdelivery.bend por `bun core/build.mjs` — não editar à mão.
// core/agentdelivery.bend
function cmp_new(a, b) {
  return { $: a < b ? "LT" : a === b ? "EQ" : "GT" };
}
function char_len(s) {
  return s[0] === "\uDC00" ? 4 : s.codePointAt(0) > 65535 ? 2 : 1;
}
function char_code(s) {
  return s.length < 4 ? s.codePointAt(0) : (s.charCodeAt(1) << 22 | s.charCodeAt(2) << 11 | s.charCodeAt(3)) >>> 0;
}
function str_in(s) {
  return s.replace(/\p{Cs}/gu, "�");
}
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
function $outcome(_accepted_0, _mayHaveSent_0) {
  if (_accepted_0) {
    return { $: "DeliveryOutcome.Accepted" };
  } else {
    if (_mayHaveSent_0) {
      return { $: "DeliveryOutcome.Uncertain" };
    } else {
      return { $: "DeliveryOutcome.Refused" };
    }
  }
}
function $mayRetry(_state_0) {
  if (_state_0.$ === "DeliveryOutcome.Refused") {
    return true;
  } else if (_state_0.$ === "DeliveryOutcome.Accepted") {
    return false;
  } else {
    return false;
  }
}
function $mayAdvanceQueue(_busy_0, _permissionPending_0, _uncertain_0, _cancelled_0) {
  return $Bool_and($Bool_not(_busy_0), $Bool_and($Bool_not(_permissionPending_0), $Bool_and($Bool_not(_uncertain_0), $Bool_not(_cancelled_0))));
}
function $canBegin(_busy_0, _uncertain_0) {
  return $Bool_and($Bool_not(_busy_0), $Bool_not(_uncertain_0));
}
function $sameNativeIdentity(_existing_0, _requested_0) {
  return $String_eq(_existing_0, _requested_0);
}
function $canChangeControls(_busy_0, _hasTurn_0, _permissionPending_0, _uncertain_0) {
  return $Bool_and($canBegin(_busy_0, _uncertain_0), $Bool_and($Bool_not(_hasTurn_0), $Bool_not(_permissionPending_0)));
}
function $canSteer(_turnInFlight_0, _sending_0, _configuring_0, _uncertain_0) {
  return $Bool_and(_turnInFlight_0, $Bool_and($Bool_not(_sending_0), $Bool_and($Bool_not(_configuring_0), $Bool_not(_uncertain_0))));
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
function $String_eq(_a_0, _b_0) {
  return $Cmp_is_eq($String_order(_a_0, _b_0));
}
function $Cmp_is_eq(_c_0) {
  if (_c_0.$ === "EQ") {
    return true;
  } else {
    return false;
  }
}
function $String_order(_a_0, _b_0) {
  return $String_order_go(_a_0, _b_0, { $: "EQ" });
}
function $String_order_go($0, $1, $2) {
  for (;; ) {
    {
      const _a_0 = $0;
      const _b_0 = $1;
      const _c_0 = $2;
      if (_a_0 === "") {
        if (_b_0 !== "") {
          if (_c_0.$ === "EQ") {
            return { $: "LT" };
          } else {
            return _c_0;
          }
        } else {
          return _c_0;
        }
      } else {
        const _t_1 = _a_0.slice(0, char_len(_a_0));
        const _t_2 = _a_0.slice(char_len(_a_0));
        if (_b_0 === "") {
          if (_c_0.$ === "EQ") {
            return { $: "GT" };
          } else {
            return _c_0;
          }
        } else {
          const _t_3 = _b_0.slice(0, char_len(_b_0));
          const _t2_0 = _b_0.slice(char_len(_b_0));
          if (_c_0.$ === "EQ") {
            const _x_0 = char_code(_t_1);
            const _x_1 = char_code(_t_3);
            $0 = _t_2;
            $1 = _t2_0;
            $2 = cmp_new(_x_0, _x_1);
            continue;
          } else {
            return _c_0;
          }
        }
      }
    }
  }
}
var agentdelivery_default = {
  outcome: run_lib((a0, a1) => run_loop($outcome(a0, a1)), 2),
  mayRetry: run_lib((a0) => run_loop($mayRetry(a0)), 1),
  mayAdvanceQueue: run_lib((a0, a1, a2, a3) => run_loop($mayAdvanceQueue(a0, a1, a2, a3)), 4),
  canBegin: run_lib((a0, a1) => run_loop($canBegin(a0, a1)), 2),
  sameNativeIdentity: run_lib((a0, a1) => run_loop($sameNativeIdentity(str_in(a0), str_in(a1))), 2),
  canChangeControls: run_lib((a0, a1, a2, a3) => run_loop($canChangeControls(a0, a1, a2, a3)), 4),
  canSteer: run_lib((a0, a1, a2, a3) => run_loop($canSteer(a0, a1, a2, a3)), 4)
};
export {
  agentdelivery_default as default
};

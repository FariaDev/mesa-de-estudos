// GERADO de core/sessionhandoff.bend por `bun core/build.mjs` — não editar à mão.
// core/sessionhandoff.bend
function cmp_new(a, b) {
  return { $: a < b ? "LT" : a === b ? "EQ" : "GT" };
}
function nat_in(n) {
  if (!Number.isInteger(n) || n < 0 || n > 2 ** 53) {
    throw "bend: expected a Nat host number: an integer from 0 to 2^53";
  }
  return n;
}
function char_len(s, at = 0) {
  return s[at] === "\uDC00" ? 4 : s.codePointAt(at) > 65535 ? 2 : 1;
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
var io_file_append = new Set;
function $canSwitch(_sourceSettled_0, _sourceUncertain_0, _targetReady_0, _sameCourse_0) {
  return $Bool_and(_sourceSettled_0, $$Bool_and($$Bool_not(_sourceUncertain_0), $$Bool_and(_targetReady_0, _sameCourse_0)));
}
function $handoffCap() {
  return 50000;
}
function $withinCap(_length_0) {
  return $Bool_not($$Nat_is_gt(_length_0, $$handoffCap()));
}
function $add(_has_0, _section_0, _acc_0) {
  if (_has_0) {
    return $List_append(_acc_0, { $: "Con", head: _section_0, tail: { $: "Nil" } });
  } else {
    return _acc_0;
  }
}
function $sectionsWithCourse(_hasExercise_0, _hasMaterials_0, _hasTurns_0) {
  const _withExercise_0 = $$add(_hasExercise_0, { $: "HandoffSection.Exercise" }, { $: "Con", head: { $: "HandoffSection.Course" }, tail: { $: "Nil" } });
  const _withMaterials_0 = $$add(_hasMaterials_0, { $: "HandoffSection.Materials" }, _withExercise_0);
  return $add(_hasTurns_0, { $: "HandoffSection.Turns" }, _withMaterials_0);
}
function $handoffSections(_hasCourse_0, _hasExercise_0, _hasMaterials_0, _hasTurns_0) {
  if (!_hasCourse_0) {
    return { $: "Nil" };
  } else {
    return $sectionsWithCourse(_hasExercise_0, _hasMaterials_0, _hasTurns_0);
  }
}
function $knownEngine(_engine_0) {
  const _x_0 = $$String_eq(_engine_0, "claude");
  const _x_1 = $$String_eq(_engine_0, "opencode");
  const _x_2 = $$String_eq(_engine_0, "pi");
  const _x_3 = _x_0 || _x_1;
  return _x_2 || _x_3;
}
function $canContinueLegacy(_engine_0, _visible_0, _native_0) {
  const _x_0 = $$Bool_not(_native_0);
  const _x_1 = $$Bool_not(_visible_0);
  return $Bool_and($$knownEngine(_engine_0), _x_0 || _x_1);
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
function $Nat_is_gt(_a_0, _b_0) {
  return $Cmp_is_gt(cmp_new(_a_0, _b_0));
}
function $List_append(_xs_0, _ys_0) {
  if (_xs_0.$ === "Nil") {
    return _ys_0;
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return { $: "Con", head: _h_0, tail: $$List_append(_t_0, _ys_0) };
  }
}
function $String_eq(_a_0, _b_0) {
  return $Cmp_is_eq($$String_order(_a_0, _b_0));
}
function $Cmp_is_gt(_c_0) {
  if (_c_0.$ === "GT") {
    return true;
  } else {
    return false;
  }
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
        const _x_0 = char_code(_t_1);
        const _t_2 = _a_0.slice(char_len(_a_0));
        if (_b_0 === "") {
          if (_c_0.$ === "EQ") {
            return { $: "GT" };
          } else {
            return _c_0;
          }
        } else {
          const _t_3 = _b_0.slice(0, char_len(_b_0));
          const _y_0 = char_code(_t_3);
          const _t2_0 = _b_0.slice(char_len(_b_0));
          if (_c_0.$ === "EQ") {
            $0 = _t_2;
            $1 = _t2_0;
            $2 = cmp_new(_x_0, _y_0);
            continue;
          } else {
            return _c_0;
          }
        }
      }
    }
  }
}
var $$Bool_not = $Bool_not;
var $$Bool_and = $Bool_and;
var $$handoffCap = $handoffCap;
var $$Nat_is_gt = $Nat_is_gt;
var $$add = $add;
var $$String_eq = $String_eq;
var $$knownEngine = $knownEngine;
var $$List_append = $List_append;
var $$String_order = $String_order;
var sessionhandoff_default = {
  canSwitch: run_lib((a0, a1, a2, a3) => run_loop($canSwitch(a0, a1, a2, a3)), 4),
  handoffCap: run_lib(() => run_loop($handoffCap()), 0),
  withinCap: run_lib((a0) => run_loop($withinCap(nat_in(a0))), 1),
  add: run_lib((a0, a1, a2) => run_loop($add(a0, a1, a2)), 3),
  sectionsWithCourse: run_lib((a0, a1, a2) => run_loop($sectionsWithCourse(a0, a1, a2)), 3),
  handoffSections: run_lib((a0, a1, a2, a3) => run_loop($handoffSections(a0, a1, a2, a3)), 4),
  knownEngine: run_lib((a0) => run_loop($knownEngine(str_in(a0))), 1),
  canContinueLegacy: run_lib((a0, a1, a2) => run_loop($canContinueLegacy(str_in(a0), a1, a2)), 3)
};
export {
  sessionhandoff_default as default
};

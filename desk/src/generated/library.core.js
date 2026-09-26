// GERADO de core/library.bend por `bun core/build.mjs` — não editar à mão.
// core/library.bend
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
function $usedAt$(_used_0, _i_0) {
  if (_used_0.$ === "Nil") {
    return false;
  } else {
    const _u_0 = _used_0["head"];
    const _t_0 = _used_0["tail"];
    if (_i_0 === 0n) {
      return _u_0;
    } else {
      const _p_0 = _i_0 - 1n;
      return run_jump($usedAt$, [_t_0, _p_0]);
    }
  }
}
function $markAt$(_used_0, _i_0) {
  if (_used_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _u_0 = _used_0["head"];
    const _t_0 = _used_0["tail"];
    if (_i_0 === 0n) {
      return { $: "Con", ["head"]: true, ["tail"]: _t_0 };
    } else {
      const _p_0 = _i_0 - 1n;
      return { $: "Con", ["head"]: _u_0, ["tail"]: run_loop($markAt$(_t_0, _p_0)) };
    }
  }
}
function $inRange$(_used_0, _i_0) {
  if (_used_0.$ === "Nil") {
    return false;
  } else {
    const _u_0 = _used_0["head"];
    const _t_0 = _used_0["tail"];
    if (_i_0 === 0n) {
      return true;
    } else {
      const _p_0 = _i_0 - 1n;
      return run_jump($inRange$, [_t_0, _p_0]);
    }
  }
}
function $bump$(_m_0) {
  if (_m_0.$ === "None") {
    return { $: "None" };
  } else {
    const _i_0 = _m_0["value"];
    return { $: "Some", ["value"]: nat_chk(_i_0 + 1n) };
  }
}
function $selfOf$(_x_0) {
  const _s_0 = _x_0["self"];
  const _o_0 = _x_0["other"];
  return _s_0;
}
function $otherOf$(_x_0) {
  const _s_0 = _x_0["self"];
  const _o_0 = _x_0["other"];
  return _o_0;
}
function $selfAt$(_xs_0, _i_0) {
  if (_xs_0.$ === "Nil") {
    return false;
  } else {
    const _x_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    if (_i_0 === 0n) {
      return run_jump($selfOf$, [_x_0]);
    } else {
      const _p_0 = _i_0 - 1n;
      return run_jump($selfAt$, [_t_0, _p_0]);
    }
  }
}
function $otherAt$(_xs_0, _i_0) {
  if (_xs_0.$ === "Nil") {
    return false;
  } else {
    const _x_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    if (_i_0 === 0n) {
      return run_jump($otherOf$, [_x_0]);
    } else {
      const _p_0 = _i_0 - 1n;
      return run_jump($otherAt$, [_t_0, _p_0]);
    }
  }
}
function $hasFreeSelf$(_xs_0, _used_0) {
  if (_xs_0.$ === "Nil") {
    return false;
  } else {
    const __0 = _xs_0["head"];
    const __1 = _xs_0["tail"];
    if (_used_0.$ === "Nil") {
      return false;
    } else {
      const _u_0 = _used_0["head"];
      const _ut_0 = _used_0["tail"];
      const _x_0 = run_loop($Bool$and$(run_loop($Bool$not$(_u_0)), run_loop($selfOf$(__0))));
      const _x_1 = run_loop($hasFreeSelf$(__1, _ut_0));
      return _x_0 || _x_1;
    }
  }
}
function $hasFreeOther$(_xs_0, _used_0) {
  if (_xs_0.$ === "Nil") {
    return false;
  } else {
    const __0 = _xs_0["head"];
    const __1 = _xs_0["tail"];
    if (_used_0.$ === "Nil") {
      return false;
    } else {
      const _u_0 = _used_0["head"];
      const _ut_0 = _used_0["tail"];
      const _x_0 = run_loop($Bool$and$(run_loop($Bool$not$(_u_0)), run_loop($Bool$not$(run_loop($otherOf$(__0))))));
      const _x_1 = run_loop($hasFreeOther$(__1, _ut_0));
      return _x_0 || _x_1;
    }
  }
}
function $hasFree$(_xs_0, _used_0) {
  if (_xs_0.$ === "Nil") {
    return false;
  } else {
    const __0 = _xs_0["head"];
    const __1 = _xs_0["tail"];
    if (_used_0.$ === "Nil") {
      return false;
    } else {
      const _u_0 = _used_0["head"];
      const _ut_0 = _used_0["tail"];
      const _x_0 = run_loop($Bool$not$(_u_0));
      const _x_1 = run_loop($hasFree$(__1, _ut_0));
      return _x_0 || _x_1;
    }
  }
}
function $pickSelf$(_xs_0, _used_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "None" };
  } else {
    const _t_0 = _xs_0["head"];
    const _t_1 = _t_0["self"];
    if (_t_1) {
      const _o_0 = _t_0["other"];
      const _t_2 = _xs_0["tail"];
      if (_used_0.$ === "Nil") {
        return { $: "None" };
      } else {
        const _t_3 = _used_0["head"];
        if (_t_3) {
          const _ut_0 = _used_0["tail"];
          return run_jump($bump$, [run_loop($pickSelf$(_t_2, _ut_0))]);
        } else {
          const _ut_1 = _used_0["tail"];
          return { $: "Some", ["value"]: 0n };
        }
      }
    } else {
      const _o_1 = _t_0["other"];
      const _t_4 = _xs_0["tail"];
      if (_used_0.$ === "Nil") {
        return { $: "None" };
      } else {
        const _u_0 = _used_0["head"];
        const _ut_2 = _used_0["tail"];
        return run_jump($bump$, [run_loop($pickSelf$(_t_4, _ut_2))]);
      }
    }
  }
}
function $pickOther$(_xs_0, _used_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "None" };
  } else {
    const _t_0 = _xs_0["head"];
    const _s_0 = _t_0["self"];
    const _t_1 = _t_0["other"];
    if (!_t_1) {
      const _t_2 = _xs_0["tail"];
      if (_used_0.$ === "Nil") {
        return { $: "None" };
      } else {
        const _t_3 = _used_0["head"];
        if (_t_3) {
          const _ut_0 = _used_0["tail"];
          return run_jump($bump$, [run_loop($pickOther$(_t_2, _ut_0))]);
        } else {
          const _ut_1 = _used_0["tail"];
          return { $: "Some", ["value"]: 0n };
        }
      }
    } else {
      const _t_4 = _xs_0["tail"];
      if (_used_0.$ === "Nil") {
        return { $: "None" };
      } else {
        const _u_0 = _used_0["head"];
        const _ut_2 = _used_0["tail"];
        return run_jump($bump$, [run_loop($pickOther$(_t_4, _ut_2))]);
      }
    }
  }
}
function $pickFree$(_xs_0, _used_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "None" };
  } else {
    const _x_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    if (_used_0.$ === "Nil") {
      return { $: "None" };
    } else {
      const _t_1 = _used_0["head"];
      if (_t_1) {
        const _ut_0 = _used_0["tail"];
        return run_jump($bump$, [run_loop($pickFree$(_t_0, _ut_0))]);
      } else {
        const _ut_1 = _used_0["tail"];
        return { $: "Some", ["value"]: 0n };
      }
    }
  }
}
function $pickStep$choice$after$(_other_0, _free_0) {
  if (_other_0.$ === "Some") {
    const _i_0 = _other_0["value"];
    return { $: "Some", ["value"]: _i_0 };
  } else {
    return _free_0;
  }
}
function $pickStep$choice$(_self_0, _other_0, _free_0) {
  if (_self_0.$ === "Some") {
    const _i_0 = _self_0["value"];
    return { $: "Some", ["value"]: _i_0 };
  } else {
    return run_jump($pickStep$choice$after$, [_other_0, _free_0]);
  }
}
function $pickStep$after$(_at_0, _used_0) {
  if (_at_0.$ === "None") {
    return { $: "Step", ["at"]: { $: "None" }, ["used"]: _used_0 };
  } else {
    const _i_0 = _at_0["value"];
    return { $: "Step", ["at"]: { $: "Some", ["value"]: _i_0 }, ["used"]: run_loop($markAt$(_used_0, _i_0)) };
  }
}
function $pickStep$(_xs_0, _used_0) {
  return run_jump($pickStep$after$, [run_loop($pickStep$choice$(run_loop($pickSelf$(_xs_0, _used_0)), run_loop($pickOther$(_xs_0, _used_0)), run_loop($pickFree$(_xs_0, _used_0)))), _used_0]);
}
function $stepAcc$after$(_step_0, _acc_0) {
  const _at_0 = _step_0["at"];
  const _used1_0 = _step_0["used"];
  return { $: "Acc", ["used"]: _used1_0, ["at"]: { $: "Con", ["head"]: _at_0, ["tail"]: _acc_0 } };
}
function $stepAcc$(_panel_0, _st_0) {
  const _used_0 = _st_0["used"];
  const _at_0 = _st_0["at"];
  return run_jump($stepAcc$after$, [run_loop($pickStep$(_panel_0, _used_0)), _at_0]);
}
function $pickAll$rev$(_st_0) {
  const _used_0 = _st_0["used"];
  const _at_0 = _st_0["at"];
  return { $: "Picks", ["at"]: run_loop($List$reverse$(_at_0)), ["used"]: _used_0 };
}
function $pickAll$go$(_panels_0, _st_0) {
  if (_panels_0.$ === "Nil") {
    return _st_0;
  } else {
    const _p_0 = _panels_0["head"];
    const _rest_0 = _panels_0["tail"];
    return run_jump($pickAll$go$, [_rest_0, run_loop($stepAcc$(_p_0, _st_0))]);
  }
}
function $pickAll$(_panels_0, _used_0) {
  return run_jump($pickAll$rev$, [run_loop($pickAll$go$(_panels_0, { $: "Acc", ["used"]: _used_0, ["at"]: { $: "Nil" } }))]);
}
function $emptyMask$(_n_0) {
  return run_jump($List$replicate$, [_n_0, false]);
}
function $pickFresh$(_panels_0, _n_0) {
  return run_jump($pickAll$, [_panels_0, run_loop($emptyMask$(_n_0))]);
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
function $List$reverse$(_xs_0) {
  return run_jump($List$reverse$go$, [_xs_0, { $: "Nil" }]);
}
function $List$replicate$(_n_0, _x_0) {
  if (_n_0 === 0n) {
    return { $: "Nil" };
  } else {
    const _p_0 = _n_0 - 1n;
    return { $: "Con", ["head"]: _x_0, ["tail"]: run_loop($List$replicate$(_p_0, _x_0)) };
  }
}
function $List$reverse$go$(_xs_0, _acc_0) {
  if (_xs_0.$ === "Nil") {
    return _acc_0;
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return run_jump($List$reverse$go$, [_t_0, { $: "Con", ["head"]: _h_0, ["tail"]: _acc_0 }]);
  }
}
var library_default = {
  usedAt: run_lib($usedAt$, 2),
  markAt: run_lib($markAt$, 2),
  inRange: run_lib($inRange$, 2),
  bump: run_lib($bump$, 1),
  selfOf: run_lib($selfOf$, 1),
  otherOf: run_lib($otherOf$, 1),
  selfAt: run_lib($selfAt$, 2),
  otherAt: run_lib($otherAt$, 2),
  hasFreeSelf: run_lib($hasFreeSelf$, 2),
  hasFreeOther: run_lib($hasFreeOther$, 2),
  hasFree: run_lib($hasFree$, 2),
  pickSelf: run_lib($pickSelf$, 2),
  pickOther: run_lib($pickOther$, 2),
  pickFree: run_lib($pickFree$, 2),
  "pickStep.choice.after": run_lib($pickStep$choice$after$, 2),
  "pickStep.choice": run_lib($pickStep$choice$, 3),
  "pickStep.after": run_lib($pickStep$after$, 2),
  pickStep: run_lib($pickStep$, 2),
  "stepAcc.after": run_lib($stepAcc$after$, 2),
  stepAcc: run_lib($stepAcc$, 2),
  "pickAll.rev": run_lib($pickAll$rev$, 1),
  "pickAll.go": run_lib($pickAll$go$, 2),
  pickAll: run_lib($pickAll$, 2),
  emptyMask: run_lib($emptyMask$, 1),
  pickFresh: run_lib($pickFresh$, 2)
};
export {
  library_default as default
};

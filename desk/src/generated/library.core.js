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
function $usedAt$(used_0, i_0) {
  if (used_0.$ === "Nil") {
    return false;
  } else {
    const u_0 = used_0.head;
    const t_0 = used_0.tail;
    if (i_0 === 0n) {
      return u_0;
    } else {
      const p_0 = i_0 - 1n;
      return run_jump($usedAt$, [t_0, p_0]);
    }
  }
}
function $markAt$(used_0, i_0) {
  if (used_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const u_0 = used_0.head;
    const t_0 = used_0.tail;
    if (i_0 === 0n) {
      return { $: "Con", ["head"]: true, ["tail"]: t_0 };
    } else {
      const p_0 = i_0 - 1n;
      return { $: "Con", ["head"]: u_0, ["tail"]: run_loop($markAt$(t_0, p_0)) };
    }
  }
}
function $inRange$(used_0, i_0) {
  if (used_0.$ === "Nil") {
    return false;
  } else {
    const u_0 = used_0.head;
    const t_0 = used_0.tail;
    if (i_0 === 0n) {
      return true;
    } else {
      const p_0 = i_0 - 1n;
      return run_jump($inRange$, [t_0, p_0]);
    }
  }
}
function $bump$(m_0) {
  if (m_0.$ === "None") {
    return { $: "None" };
  } else {
    const i_0 = m_0.value;
    return { $: "Some", ["value"]: nat_chk(i_0 + 1n) };
  }
}
function $selfOf$(x_0) {
  const s_0 = x_0.self;
  const o_0 = x_0.other;
  return s_0;
}
function $otherOf$(x_0) {
  const s_0 = x_0.self;
  const o_0 = x_0.other;
  return o_0;
}
function $selfAt$(xs_0, i_0) {
  if (xs_0.$ === "Nil") {
    return false;
  } else {
    const x_0 = xs_0.head;
    const t_0 = xs_0.tail;
    if (i_0 === 0n) {
      return run_jump($selfOf$, [x_0]);
    } else {
      const p_0 = i_0 - 1n;
      return run_jump($selfAt$, [t_0, p_0]);
    }
  }
}
function $otherAt$(xs_0, i_0) {
  if (xs_0.$ === "Nil") {
    return false;
  } else {
    const x_0 = xs_0.head;
    const t_0 = xs_0.tail;
    if (i_0 === 0n) {
      return run_jump($otherOf$, [x_0]);
    } else {
      const p_0 = i_0 - 1n;
      return run_jump($otherAt$, [t_0, p_0]);
    }
  }
}
function $hasFreeSelf$(xs_0, used_0) {
  if (xs_0.$ === "Nil") {
    return false;
  } else {
    const __0 = xs_0.head;
    const __1 = xs_0.tail;
    if (used_0.$ === "Nil") {
      return false;
    } else {
      const u_0 = used_0.head;
      const ut_0 = used_0.tail;
      const x_0 = run_loop($Bool$and$(run_loop($Bool$not$(u_0)), run_loop($selfOf$(__0))));
      const x_1 = run_loop($hasFreeSelf$(__1, ut_0));
      return x_0 || x_1;
    }
  }
}
function $hasFreeOther$(xs_0, used_0) {
  if (xs_0.$ === "Nil") {
    return false;
  } else {
    const __0 = xs_0.head;
    const __1 = xs_0.tail;
    if (used_0.$ === "Nil") {
      return false;
    } else {
      const u_0 = used_0.head;
      const ut_0 = used_0.tail;
      const x_0 = run_loop($Bool$and$(run_loop($Bool$not$(u_0)), run_loop($Bool$not$(run_loop($otherOf$(__0))))));
      const x_1 = run_loop($hasFreeOther$(__1, ut_0));
      return x_0 || x_1;
    }
  }
}
function $hasFree$(xs_0, used_0) {
  if (xs_0.$ === "Nil") {
    return false;
  } else {
    const __0 = xs_0.head;
    const __1 = xs_0.tail;
    if (used_0.$ === "Nil") {
      return false;
    } else {
      const u_0 = used_0.head;
      const ut_0 = used_0.tail;
      const x_0 = run_loop($Bool$not$(u_0));
      const x_1 = run_loop($hasFree$(__1, ut_0));
      return x_0 || x_1;
    }
  }
}
function $pickSelf$(xs_0, used_0) {
  if (xs_0.$ === "Nil") {
    return { $: "None" };
  } else {
    const _t_0 = xs_0.head;
    const _t_1 = _t_0.self;
    if (_t_1) {
      const o_0 = _t_0.other;
      const t_0 = xs_0.tail;
      if (used_0.$ === "Nil") {
        return { $: "None" };
      } else {
        const _t_2 = used_0.head;
        if (_t_2) {
          const ut_0 = used_0.tail;
          return run_jump($bump$, [run_loop($pickSelf$(t_0, ut_0))]);
        } else {
          const ut_1 = used_0.tail;
          return { $: "Some", ["value"]: 0n };
        }
      }
    } else {
      const o_1 = _t_0.other;
      const t_1 = xs_0.tail;
      if (used_0.$ === "Nil") {
        return { $: "None" };
      } else {
        const u_0 = used_0.head;
        const ut_2 = used_0.tail;
        return run_jump($bump$, [run_loop($pickSelf$(t_1, ut_2))]);
      }
    }
  }
}
function $pickOther$(xs_0, used_0) {
  if (xs_0.$ === "Nil") {
    return { $: "None" };
  } else {
    const _t_0 = xs_0.head;
    const s_0 = _t_0.self;
    const _t_1 = _t_0.other;
    if (!_t_1) {
      const t_0 = xs_0.tail;
      if (used_0.$ === "Nil") {
        return { $: "None" };
      } else {
        const _t_2 = used_0.head;
        if (_t_2) {
          const ut_0 = used_0.tail;
          return run_jump($bump$, [run_loop($pickOther$(t_0, ut_0))]);
        } else {
          const ut_1 = used_0.tail;
          return { $: "Some", ["value"]: 0n };
        }
      }
    } else {
      const t_1 = xs_0.tail;
      if (used_0.$ === "Nil") {
        return { $: "None" };
      } else {
        const u_0 = used_0.head;
        const ut_2 = used_0.tail;
        return run_jump($bump$, [run_loop($pickOther$(t_1, ut_2))]);
      }
    }
  }
}
function $pickFree$(xs_0, used_0) {
  if (xs_0.$ === "Nil") {
    return { $: "None" };
  } else {
    const x_0 = xs_0.head;
    const t_0 = xs_0.tail;
    if (used_0.$ === "Nil") {
      return { $: "None" };
    } else {
      const _t_0 = used_0.head;
      if (_t_0) {
        const ut_0 = used_0.tail;
        return run_jump($bump$, [run_loop($pickFree$(t_0, ut_0))]);
      } else {
        const ut_1 = used_0.tail;
        return { $: "Some", ["value"]: 0n };
      }
    }
  }
}
function $pickStep$choice$after$(other_0, free_0) {
  if (other_0.$ === "Some") {
    const i_0 = other_0.value;
    return { $: "Some", ["value"]: i_0 };
  } else {
    return free_0;
  }
}
function $pickStep$choice$(self_0, other_0, free_0) {
  if (self_0.$ === "Some") {
    const i_0 = self_0.value;
    return { $: "Some", ["value"]: i_0 };
  } else {
    return run_jump($pickStep$choice$after$, [other_0, free_0]);
  }
}
function $pickStep$after$(at_0, used_0) {
  if (at_0.$ === "None") {
    return { $: "Step", ["at"]: { $: "None" }, ["used"]: used_0 };
  } else {
    const i_0 = at_0.value;
    return { $: "Step", ["at"]: { $: "Some", ["value"]: i_0 }, ["used"]: run_loop($markAt$(used_0, i_0)) };
  }
}
function $pickStep$(xs_0, used_0) {
  return run_jump($pickStep$after$, [run_loop($pickStep$choice$(run_loop($pickSelf$(xs_0, used_0)), run_loop($pickOther$(xs_0, used_0)), run_loop($pickFree$(xs_0, used_0)))), used_0]);
}
function $stepAcc$after$(step_0, acc_0) {
  const at_0 = step_0.at;
  const used1_0 = step_0.used;
  return { $: "Acc", ["used"]: used1_0, ["at"]: { $: "Con", ["head"]: at_0, ["tail"]: acc_0 } };
}
function $stepAcc$(panel_0, st_0) {
  const used_0 = st_0.used;
  const at_0 = st_0.at;
  return run_jump($stepAcc$after$, [run_loop($pickStep$(panel_0, used_0)), at_0]);
}
function $pickAll$rev$(st_0) {
  const used_0 = st_0.used;
  const at_0 = st_0.at;
  return { $: "Picks", ["at"]: run_loop($List$reverse$(at_0)), ["used"]: used_0 };
}
function $pickAll$go$(panels_0, st_0) {
  if (panels_0.$ === "Nil") {
    return st_0;
  } else {
    const p_0 = panels_0.head;
    const rest_0 = panels_0.tail;
    return run_jump($pickAll$go$, [rest_0, run_loop($stepAcc$(p_0, st_0))]);
  }
}
function $pickAll$(panels_0, used_0) {
  return run_jump($pickAll$rev$, [run_loop($pickAll$go$(panels_0, { $: "Acc", ["used"]: used_0, ["at"]: { $: "Nil" } }))]);
}
function $emptyMask$(n_0) {
  return run_jump($List$replicate$, [n_0, false]);
}
function $pickFresh$(panels_0, n_0) {
  return run_jump($pickAll$, [panels_0, run_loop($emptyMask$(n_0))]);
}
function $Bool$and$(a_0, b_0) {
  if (!a_0) {
    return false;
  } else {
    return b_0;
  }
}
function $Bool$not$(b_0) {
  if (!b_0) {
    return true;
  } else {
    return false;
  }
}
function $List$reverse$(xs_0) {
  return run_jump($List$reverse$go$, [xs_0, { $: "Nil" }]);
}
function $List$replicate$(n_0, x_0) {
  if (n_0 === 0n) {
    return { $: "Nil" };
  } else {
    const p_0 = n_0 - 1n;
    return { $: "Con", ["head"]: x_0, ["tail"]: run_loop($List$replicate$(p_0, x_0)) };
  }
}
function $List$reverse$go$(xs_0, acc_0) {
  if (xs_0.$ === "Nil") {
    return acc_0;
  } else {
    const h_0 = xs_0.head;
    const t_0 = xs_0.tail;
    return run_jump($List$reverse$go$, [t_0, { $: "Con", ["head"]: h_0, ["tail"]: acc_0 }]);
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

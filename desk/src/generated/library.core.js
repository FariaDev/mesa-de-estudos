// GERADO de core/library.bend por `bun core/build.mjs` — não editar à mão.
// core/library.bend
function nat_chk(n) {
  if (n > 281474976710655) {
    throw "bend: a Nat past the largest immediate 2^48-1";
  }
  return n;
}
function nat_in(n) {
  return Number.isInteger(n) && n >= 0 && n <= 2 ** 53 ? n : nat_chk(1 / 0);
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
function $usedAt($0, $1) {
  for (;; ) {
    {
      const _used_0 = $0;
      const _i_0 = $1;
      if (_used_0.$ === "Nil") {
        return false;
      } else {
        const _u_0 = _used_0["head"];
        const _t_0 = _used_0["tail"];
        if (_i_0 === 0) {
          return _u_0;
        } else {
          const _p_0 = _i_0 - 1;
          $0 = _t_0;
          $1 = _p_0;
          continue;
        }
      }
    }
  }
}
function $markAt(_used_0, _i_0) {
  if (_used_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _u_0 = _used_0["head"];
    const _t_0 = _used_0["tail"];
    if (_i_0 === 0) {
      return { $: "Con", head: true, tail: _t_0 };
    } else {
      const _p_0 = _i_0 - 1;
      return { $: "Con", head: _u_0, tail: $markAt(_t_0, _p_0) };
    }
  }
}
function $inRange($0, $1) {
  for (;; ) {
    {
      const _used_0 = $0;
      const _i_0 = $1;
      if (_used_0.$ === "Nil") {
        return false;
      } else {
        const _t_0 = _used_0["tail"];
        if (_i_0 === 0) {
          return true;
        } else {
          const _p_0 = _i_0 - 1;
          $0 = _t_0;
          $1 = _p_0;
          continue;
        }
      }
    }
  }
}
function $bump(_m_0) {
  if (_m_0.$ === "None") {
    return { $: "None" };
  } else {
    const _i_0 = _m_0["value"];
    return { $: "Some", value: nat_chk(_i_0 + 1) };
  }
}
function $selfOf(_x_0) {
  const _s_0 = _x_0["self"];
  return _s_0;
}
function $otherOf(_x_0) {
  const _o_0 = _x_0["other"];
  return _o_0;
}
function $selfAt($0, $1) {
  for (;; ) {
    {
      const _xs_0 = $0;
      const _i_0 = $1;
      if (_xs_0.$ === "Nil") {
        return false;
      } else {
        const _x_0 = _xs_0["head"];
        const _t_0 = _xs_0["tail"];
        if (_i_0 === 0) {
          return $selfOf(_x_0);
        } else {
          const _p_0 = _i_0 - 1;
          $0 = _t_0;
          $1 = _p_0;
          continue;
        }
      }
    }
  }
}
function $otherAt($0, $1) {
  for (;; ) {
    {
      const _xs_0 = $0;
      const _i_0 = $1;
      if (_xs_0.$ === "Nil") {
        return false;
      } else {
        const _x_0 = _xs_0["head"];
        const _t_0 = _xs_0["tail"];
        if (_i_0 === 0) {
          return $otherOf(_x_0);
        } else {
          const _p_0 = _i_0 - 1;
          $0 = _t_0;
          $1 = _p_0;
          continue;
        }
      }
    }
  }
}
function $hasFreeSelf(_xs_0, _used_0) {
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
      const _x_0 = $Bool_and($Bool_not(_u_0), $selfOf(__0));
      const _x_1 = $hasFreeSelf(__1, _ut_0);
      return _x_0 || _x_1;
    }
  }
}
function $hasFreeOther(_xs_0, _used_0) {
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
      const _x_0 = $Bool_and($Bool_not(_u_0), $Bool_not($otherOf(__0)));
      const _x_1 = $hasFreeOther(__1, _ut_0);
      return _x_0 || _x_1;
    }
  }
}
function $hasFree(_xs_0, _used_0) {
  if (_xs_0.$ === "Nil") {
    return false;
  } else {
    const __1 = _xs_0["tail"];
    if (_used_0.$ === "Nil") {
      return false;
    } else {
      const _u_0 = _used_0["head"];
      const _ut_0 = _used_0["tail"];
      const _x_0 = $Bool_not(_u_0);
      const _x_1 = $hasFree(__1, _ut_0);
      return _x_0 || _x_1;
    }
  }
}
function $pickSelf(_xs_0, _used_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "None" };
  } else {
    const _t_0 = _xs_0["head"];
    const _t_1 = _t_0["self"];
    if (_t_1) {
      const _t_2 = _xs_0["tail"];
      if (_used_0.$ === "Nil") {
        return { $: "None" };
      } else {
        const _t_3 = _used_0["head"];
        if (_t_3) {
          const _ut_0 = _used_0["tail"];
          return $bump($pickSelf(_t_2, _ut_0));
        } else {
          return { $: "Some", value: 0 };
        }
      }
    } else {
      const _t_4 = _xs_0["tail"];
      if (_used_0.$ === "Nil") {
        return { $: "None" };
      } else {
        const _ut_2 = _used_0["tail"];
        return $bump($pickSelf(_t_4, _ut_2));
      }
    }
  }
}
function $pickOther(_xs_0, _used_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "None" };
  } else {
    const _t_0 = _xs_0["head"];
    const _t_1 = _t_0["other"];
    if (!_t_1) {
      const _t_2 = _xs_0["tail"];
      if (_used_0.$ === "Nil") {
        return { $: "None" };
      } else {
        const _t_3 = _used_0["head"];
        if (_t_3) {
          const _ut_0 = _used_0["tail"];
          return $bump($pickOther(_t_2, _ut_0));
        } else {
          return { $: "Some", value: 0 };
        }
      }
    } else {
      const _t_4 = _xs_0["tail"];
      if (_used_0.$ === "Nil") {
        return { $: "None" };
      } else {
        const _ut_2 = _used_0["tail"];
        return $bump($pickOther(_t_4, _ut_2));
      }
    }
  }
}
function $pickFree(_xs_0, _used_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "None" };
  } else {
    const _t_0 = _xs_0["tail"];
    if (_used_0.$ === "Nil") {
      return { $: "None" };
    } else {
      const _t_1 = _used_0["head"];
      if (_t_1) {
        const _ut_0 = _used_0["tail"];
        return $bump($pickFree(_t_0, _ut_0));
      } else {
        return { $: "Some", value: 0 };
      }
    }
  }
}
function $pickStep_choice_after(_other_0, _free_0) {
  if (_other_0.$ === "Some") {
    const _i_0 = _other_0["value"];
    return { $: "Some", value: _i_0 };
  } else {
    return _free_0;
  }
}
function $pickStep_choice(_self_0, _other_0, _free_0) {
  if (_self_0.$ === "Some") {
    const _i_0 = _self_0["value"];
    return { $: "Some", value: _i_0 };
  } else {
    return $pickStep_choice_after(_other_0, _free_0);
  }
}
function $pickStep_after(_at_0, _used_0) {
  if (_at_0.$ === "None") {
    return { $: "Step", at: { $: "None" }, used: _used_0 };
  } else {
    const _i_0 = _at_0["value"];
    return { $: "Step", at: { $: "Some", value: _i_0 }, used: $markAt(_used_0, _i_0) };
  }
}
function $pickStep(_xs_0, _used_0) {
  return $pickStep_after($pickStep_choice($pickSelf(_xs_0, _used_0), $pickOther(_xs_0, _used_0), $pickFree(_xs_0, _used_0)), _used_0);
}
function $stepAcc_after(_step_0, _acc_0) {
  const _at_0 = _step_0["at"];
  const _used1_0 = _step_0["used"];
  return { $: "Acc", used: _used1_0, at: { $: "Con", head: _at_0, tail: _acc_0 } };
}
function $stepAcc(_panel_0, _st_0) {
  const _used_0 = _st_0["used"];
  const _at_0 = _st_0["at"];
  return $stepAcc_after($pickStep(_panel_0, _used_0), _at_0);
}
function $pickAll_rev(_st_0) {
  const _used_0 = _st_0["used"];
  const _at_0 = _st_0["at"];
  return { $: "Picks", at: $List_reverse(_at_0), used: _used_0 };
}
function $pickAll_go($0, $1) {
  for (;; ) {
    {
      const _panels_0 = $0;
      const _st_0 = $1;
      if (_panels_0.$ === "Nil") {
        return _st_0;
      } else {
        const _p_0 = _panels_0["head"];
        const _rest_0 = _panels_0["tail"];
        $0 = _rest_0;
        $1 = $stepAcc(_p_0, _st_0);
        continue;
      }
    }
  }
}
function $pickAll(_panels_0, _used_0) {
  return $pickAll_rev($pickAll_go(_panels_0, { $: "Acc", used: _used_0, at: { $: "Nil" } }));
}
function $emptyMask(_n_0) {
  return $List_replicate(_n_0, false);
}
function $pickFresh(_panels_0, _n_0) {
  return $pickAll(_panels_0, $emptyMask(_n_0));
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
function $List_reverse(_xs_0) {
  return $List_reverse_go(_xs_0, { $: "Nil" });
}
function $List_replicate(_n_0, _x_0) {
  if (_n_0 === 0) {
    return { $: "Nil" };
  } else {
    const _p_0 = _n_0 - 1;
    return { $: "Con", head: _x_0, tail: $List_replicate(_p_0, _x_0) };
  }
}
function $List_reverse_go($0, $1) {
  for (;; ) {
    {
      const _xs_0 = $0;
      const _acc_0 = $1;
      if (_xs_0.$ === "Nil") {
        return _acc_0;
      } else {
        const _h_0 = _xs_0["head"];
        const _t_0 = _xs_0["tail"];
        $0 = _t_0;
        $1 = { $: "Con", head: _h_0, tail: _acc_0 };
        continue;
      }
    }
  }
}
var library_default = {
  usedAt: run_lib((a0, a1) => run_loop($usedAt(a0, nat_in(a1))), 2),
  markAt: run_lib((a0, a1) => run_loop($markAt(a0, nat_in(a1))), 2),
  inRange: run_lib((a0, a1) => run_loop($inRange(a0, nat_in(a1))), 2),
  bump: run_lib((a0) => run_loop($bump(a0)), 1),
  selfOf: run_lib((a0) => run_loop($selfOf(a0)), 1),
  otherOf: run_lib((a0) => run_loop($otherOf(a0)), 1),
  selfAt: run_lib((a0, a1) => run_loop($selfAt(a0, nat_in(a1))), 2),
  otherAt: run_lib((a0, a1) => run_loop($otherAt(a0, nat_in(a1))), 2),
  hasFreeSelf: run_lib((a0, a1) => run_loop($hasFreeSelf(a0, a1)), 2),
  hasFreeOther: run_lib((a0, a1) => run_loop($hasFreeOther(a0, a1)), 2),
  hasFree: run_lib((a0, a1) => run_loop($hasFree(a0, a1)), 2),
  pickSelf: run_lib((a0, a1) => run_loop($pickSelf(a0, a1)), 2),
  pickOther: run_lib((a0, a1) => run_loop($pickOther(a0, a1)), 2),
  pickFree: run_lib((a0, a1) => run_loop($pickFree(a0, a1)), 2),
  "pickStep.choice.after": run_lib((a0, a1) => run_loop($pickStep_choice_after(a0, a1)), 2),
  "pickStep.choice": run_lib((a0, a1, a2) => run_loop($pickStep_choice(a0, a1, a2)), 3),
  "pickStep.after": run_lib((a0, a1) => run_loop($pickStep_after(a0, a1)), 2),
  pickStep: run_lib((a0, a1) => run_loop($pickStep(a0, a1)), 2),
  "stepAcc.after": run_lib((a0, a1) => run_loop($stepAcc_after(a0, a1)), 2),
  stepAcc: run_lib((a0, a1) => run_loop($stepAcc(a0, a1)), 2),
  "pickAll.rev": run_lib((a0) => run_loop($pickAll_rev(a0)), 1),
  "pickAll.go": run_lib((a0, a1) => run_loop($pickAll_go(a0, a1)), 2),
  pickAll: run_lib((a0, a1) => run_loop($pickAll(a0, a1)), 2),
  emptyMask: run_lib((a0) => run_loop($emptyMask(nat_in(a0))), 1),
  pickFresh: run_lib((a0, a1) => run_loop($pickFresh(a0, nat_in(a1))), 2)
};
export {
  library_default as default
};

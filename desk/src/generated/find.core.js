// GERADO de core/find.bend por `bun core/build.mjs` — não editar à mão.
// core/find.bend
function cmp_new(a, b) {
  return { $: a < b ? "LT" : a === b ? "EQ" : "GT" };
}
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
function $pageOf(_h_0) {
  const _page_0 = _h_0["page"];
  return _page_0;
}
function $countOf(_h_0) {
  const _count_0 = _h_0["count"];
  return _count_0;
}
function $firstHit(_pages_0) {
  if (_pages_0.$ === "Nil") {
    return { $: "None" };
  } else {
    const _h_0 = _pages_0["head"];
    return { $: "Some", value: $pageOf(_h_0) };
  }
}
function $setFound_bump(_page_0, _after_0) {
  if (_after_0) {
    return { $: "Some", value: _page_0 };
  } else {
    return { $: "None" };
  }
}
function $setFound(_found_0, _page_0, _after_0) {
  if (_found_0.$ === "Some") {
    const _v_0 = _found_0["value"];
    return { $: "Some", value: _v_0 };
  } else {
    return $setFound_bump(_page_0, _after_0);
  }
}
function $walkFound($0, $1, $2) {
  for (;; ) {
    {
      const _pages_0 = $0;
      const _facts_0 = $1;
      const _found_0 = $2;
      if (_pages_0.$ === "Nil") {
        return _found_0;
      } else {
        const _h_0 = _pages_0["head"];
        const _t_0 = _pages_0["tail"];
        if (_facts_0.$ === "Nil") {
          return _found_0;
        } else {
          const _f_0 = _facts_0["head"];
          const _fs_0 = _facts_0["tail"];
          $0 = _t_0;
          $1 = _fs_0;
          $2 = $setFound(_found_0, $pageOf(_h_0), _f_0);
          continue;
        }
      }
    }
  }
}
function $finishWalk(_found_0, _first_0) {
  if (_found_0.$ === "Some") {
    const _p_0 = _found_0["value"];
    return { $: "Some", value: _p_0 };
  } else {
    return _first_0;
  }
}
function $nextHitFacts(_pages_0, _facts_0) {
  return $finishWalk($walkFound(_pages_0, _facts_0, { $: "None" }), $firstHit(_pages_0));
}
function $afterFacts(_pages_0, _current_0) {
  if (_pages_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _t_0 = _pages_0["head"];
    const _page_0 = _t_0["page"];
    const _t_1 = _pages_0["tail"];
    return { $: "Con", head: $Nat_is_gt(_page_0, _current_0), tail: $afterFacts(_t_1, _current_0) };
  }
}
function $nextHit(_pages_0, _current_0) {
  return $nextHitFacts(_pages_0, $afterFacts(_pages_0, _current_0));
}
function $cycleTarget(_cycle_0, _pages_0, _current_0) {
  if (_cycle_0) {
    return $nextHit(_pages_0, _current_0);
  } else {
    return $firstHit(_pages_0);
  }
}
function $totalHits(_pages_0) {
  if (_pages_0.$ === "Nil") {
    return 0;
  } else {
    const _t_0 = _pages_0["head"];
    const _count_0 = _t_0["count"];
    const _t_1 = _pages_0["tail"];
    const _x_0 = $totalHits(_t_1);
    return nat_chk(_count_0 + _x_0);
  }
}
function $scanStep_look(_before_0, _count_0, _same_0) {
  if (_same_0) {
    return { $: "Got", before: _before_0 };
  } else {
    return { $: "Looking", before: nat_chk(_before_0 + _count_0) };
  }
}
function $scanStep(_s_0, _count_0, _same_0) {
  if (_s_0.$ === "Got") {
    const _before_0 = _s_0["before"];
    return { $: "Got", before: _before_0 };
  } else {
    const _before_1 = _s_0["before"];
    return $scanStep_look(_before_1, _count_0, _same_0);
  }
}
function $finishScan(_s_0, _total_0) {
  if (_s_0.$ === "Looking") {
    return { $: "All", total: _total_0 };
  } else {
    const _before_1 = _s_0["before"];
    return { $: "Shown", index: nat_chk(_before_1 + 1), total: _total_0 };
  }
}
function $countFacts($0, $1, $2, $3) {
  for (;; ) {
    {
      const _pages_0 = $0;
      const _facts_0 = $1;
      const _total_0 = $2;
      const _s_0 = $3;
      if (_pages_0.$ === "Nil") {
        return $finishScan(_s_0, _total_0);
      } else {
        const _h_0 = _pages_0["head"];
        const _t_0 = _pages_0["tail"];
        if (_facts_0.$ === "Nil") {
          return $finishScan(_s_0, _total_0);
        } else {
          const _f_0 = _facts_0["head"];
          const _fs_0 = _facts_0["tail"];
          $0 = _t_0;
          $1 = _fs_0;
          $2 = _total_0;
          $3 = $scanStep(_s_0, $countOf(_h_0), _f_0);
          continue;
        }
      }
    }
  }
}
function $sameFacts(_pages_0, _current_0) {
  if (_pages_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _t_0 = _pages_0["head"];
    const _page_0 = _t_0["page"];
    const _t_1 = _pages_0["tail"];
    return { $: "Con", head: $Nat_is_eq(_page_0, _current_0), tail: $sameFacts(_t_1, _current_0) };
  }
}
function $findCount(_pages_0, _current_0) {
  if (_pages_0.$ === "Nil") {
    return { $: "Hidden" };
  } else {
    const _h_0 = _pages_0["head"];
    const _t_0 = _pages_0["tail"];
    return $countFacts({ $: "Con", head: _h_0, tail: _t_0 }, $sameFacts({ $: "Con", head: _h_0, tail: _t_0 }, _current_0), $totalHits({ $: "Con", head: _h_0, tail: _t_0 }), { $: "Looking", before: 0 });
  }
}
function $Nat_is_gt(_a_0, _b_0) {
  return $Cmp_is_gt(cmp_new(_a_0, _b_0));
}
function $Nat_is_eq(_a_0, _b_0) {
  return $Cmp_is_eq(cmp_new(_a_0, _b_0));
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
var find_default = {
  pageOf: run_lib((a0) => run_loop($pageOf(a0)), 1),
  countOf: run_lib((a0) => run_loop($countOf(a0)), 1),
  firstHit: run_lib((a0) => run_loop($firstHit(a0)), 1),
  "setFound.bump": run_lib((a0, a1) => run_loop($setFound_bump(nat_in(a0), a1)), 2),
  setFound: run_lib((a0, a1, a2) => run_loop($setFound(a0, nat_in(a1), a2)), 3),
  walkFound: run_lib((a0, a1, a2) => run_loop($walkFound(a0, a1, a2)), 3),
  finishWalk: run_lib((a0, a1) => run_loop($finishWalk(a0, a1)), 2),
  nextHitFacts: run_lib((a0, a1) => run_loop($nextHitFacts(a0, a1)), 2),
  afterFacts: run_lib((a0, a1) => run_loop($afterFacts(a0, nat_in(a1))), 2),
  nextHit: run_lib((a0, a1) => run_loop($nextHit(a0, nat_in(a1))), 2),
  cycleTarget: run_lib((a0, a1, a2) => run_loop($cycleTarget(a0, a1, nat_in(a2))), 3),
  totalHits: run_lib((a0) => run_loop($totalHits(a0)), 1),
  "scanStep.look": run_lib((a0, a1, a2) => run_loop($scanStep_look(nat_in(a0), nat_in(a1), a2)), 3),
  scanStep: run_lib((a0, a1, a2) => run_loop($scanStep(a0, nat_in(a1), a2)), 3),
  finishScan: run_lib((a0, a1) => run_loop($finishScan(a0, nat_in(a1))), 2),
  countFacts: run_lib((a0, a1, a2, a3) => run_loop($countFacts(a0, a1, nat_in(a2), a3)), 4),
  sameFacts: run_lib((a0, a1) => run_loop($sameFacts(a0, nat_in(a1))), 2),
  findCount: run_lib((a0, a1) => run_loop($findCount(a0, nat_in(a1))), 2)
};
export {
  find_default as default
};

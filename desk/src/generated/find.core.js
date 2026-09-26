// GERADO de core/find.bend por `bun core/build.mjs` — não editar à mão.
// core/find.bend
function cmp_new(a, b) {
  return { $: a < b ? "LT" : a === b ? "EQ" : "GT" };
}
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
function $pageOf$(_h_0) {
  const _page_0 = _h_0["page"];
  const _count_0 = _h_0["count"];
  return _page_0;
}
function $countOf$(_h_0) {
  const _page_0 = _h_0["page"];
  const _count_0 = _h_0["count"];
  return _count_0;
}
function $firstHit$(_pages_0) {
  if (_pages_0.$ === "Nil") {
    return { $: "None" };
  } else {
    const _h_0 = _pages_0["head"];
    const _t_0 = _pages_0["tail"];
    return { $: "Some", ["value"]: run_loop($pageOf$(_h_0)) };
  }
}
function $setFound$bump$(_page_0, _after_0) {
  if (_after_0) {
    return { $: "Some", ["value"]: _page_0 };
  } else {
    return { $: "None" };
  }
}
function $setFound$(_found_0, _page_0, _after_0) {
  if (_found_0.$ === "Some") {
    const _v_0 = _found_0["value"];
    return { $: "Some", ["value"]: _v_0 };
  } else {
    return run_jump($setFound$bump$, [_page_0, _after_0]);
  }
}
function $walkFound$(_pages_0, _facts_0, _found_0) {
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
      return run_jump($walkFound$, [_t_0, _fs_0, run_loop($setFound$(_found_0, run_loop($pageOf$(_h_0)), _f_0))]);
    }
  }
}
function $finishWalk$(_found_0, _first_0) {
  if (_found_0.$ === "Some") {
    const _p_0 = _found_0["value"];
    return { $: "Some", ["value"]: _p_0 };
  } else {
    return _first_0;
  }
}
function $nextHitFacts$(_pages_0, _facts_0) {
  return run_jump($finishWalk$, [run_loop($walkFound$(_pages_0, _facts_0, { $: "None" })), run_loop($firstHit$(_pages_0))]);
}
function $afterFacts$(_pages_0, _current_0) {
  if (_pages_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _t_0 = _pages_0["head"];
    const _page_0 = _t_0["page"];
    const _count_0 = _t_0["count"];
    const _t_1 = _pages_0["tail"];
    return { $: "Con", ["head"]: run_loop($Nat$is_gt$(_page_0, _current_0)), ["tail"]: run_loop($afterFacts$(_t_1, _current_0)) };
  }
}
function $nextHit$(_pages_0, _current_0) {
  return run_jump($nextHitFacts$, [_pages_0, run_loop($afterFacts$(_pages_0, _current_0))]);
}
function $cycleTarget$(_cycle_0, _pages_0, _current_0) {
  if (_cycle_0) {
    return run_jump($nextHit$, [_pages_0, _current_0]);
  } else {
    return run_jump($firstHit$, [_pages_0]);
  }
}
function $totalHits$(_pages_0) {
  if (_pages_0.$ === "Nil") {
    return 0n;
  } else {
    const _t_0 = _pages_0["head"];
    const _page_0 = _t_0["page"];
    const _count_0 = _t_0["count"];
    const _t_1 = _pages_0["tail"];
    const _x_0 = run_loop($totalHits$(_t_1));
    return nat_chk(_count_0 + _x_0);
  }
}
function $scanStep$look$(_before_0, _count_0, _same_0) {
  if (_same_0) {
    return { $: "Got", ["before"]: _before_0 };
  } else {
    return { $: "Looking", ["before"]: nat_chk(_before_0 + _count_0) };
  }
}
function $scanStep$(_s_0, _count_0, _same_0) {
  if (_s_0.$ === "Got") {
    const _before_0 = _s_0["before"];
    return { $: "Got", ["before"]: _before_0 };
  } else {
    const _before_1 = _s_0["before"];
    return run_jump($scanStep$look$, [_before_1, _count_0, _same_0]);
  }
}
function $finishScan$(_s_0, _total_0) {
  if (_s_0.$ === "Looking") {
    const _before_0 = _s_0["before"];
    return { $: "All", ["total"]: _total_0 };
  } else {
    const _before_1 = _s_0["before"];
    return { $: "Shown", ["index"]: nat_chk(_before_1 + 1n), ["total"]: _total_0 };
  }
}
function $countFacts$(_pages_0, _facts_0, _total_0, _s_0) {
  if (_pages_0.$ === "Nil") {
    return run_jump($finishScan$, [_s_0, _total_0]);
  } else {
    const _h_0 = _pages_0["head"];
    const _t_0 = _pages_0["tail"];
    if (_facts_0.$ === "Nil") {
      return run_jump($finishScan$, [_s_0, _total_0]);
    } else {
      const _f_0 = _facts_0["head"];
      const _fs_0 = _facts_0["tail"];
      return run_jump($countFacts$, [_t_0, _fs_0, _total_0, run_loop($scanStep$(_s_0, run_loop($countOf$(_h_0)), _f_0))]);
    }
  }
}
function $sameFacts$(_pages_0, _current_0) {
  if (_pages_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _t_0 = _pages_0["head"];
    const _page_0 = _t_0["page"];
    const _count_0 = _t_0["count"];
    const _t_1 = _pages_0["tail"];
    return { $: "Con", ["head"]: run_loop($Nat$is_eq$(_page_0, _current_0)), ["tail"]: run_loop($sameFacts$(_t_1, _current_0)) };
  }
}
function $findCount$(_pages_0, _current_0) {
  if (_pages_0.$ === "Nil") {
    return { $: "Hidden" };
  } else {
    const _h_0 = _pages_0["head"];
    const _t_0 = _pages_0["tail"];
    return run_jump($countFacts$, [{ $: "Con", ["head"]: _h_0, ["tail"]: _t_0 }, run_loop($sameFacts$({ $: "Con", ["head"]: _h_0, ["tail"]: _t_0 }, _current_0)), run_loop($totalHits$({ $: "Con", ["head"]: _h_0, ["tail"]: _t_0 })), { $: "Looking", ["before"]: 0n }]);
  }
}
function $Nat$is_gt$(_a_0, _b_0) {
  return run_jump($Cmp$is_gt$, [cmp_new(_a_0, _b_0)]);
}
function $Nat$is_eq$(_a_0, _b_0) {
  return run_jump($Cmp$is_eq$, [cmp_new(_a_0, _b_0)]);
}
function $Cmp$is_gt$(_c_0) {
  if (_c_0.$ === "LT") {
    return false;
  } else if (_c_0.$ === "EQ") {
    return false;
  } else {
    return true;
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
var find_default = {
  pageOf: run_lib($pageOf$, 1),
  countOf: run_lib($countOf$, 1),
  firstHit: run_lib($firstHit$, 1),
  "setFound.bump": run_lib($setFound$bump$, 2),
  setFound: run_lib($setFound$, 3),
  walkFound: run_lib($walkFound$, 3),
  finishWalk: run_lib($finishWalk$, 2),
  nextHitFacts: run_lib($nextHitFacts$, 2),
  afterFacts: run_lib($afterFacts$, 2),
  nextHit: run_lib($nextHit$, 2),
  cycleTarget: run_lib($cycleTarget$, 3),
  totalHits: run_lib($totalHits$, 1),
  "scanStep.look": run_lib($scanStep$look$, 3),
  scanStep: run_lib($scanStep$, 3),
  finishScan: run_lib($finishScan$, 2),
  countFacts: run_lib($countFacts$, 4),
  sameFacts: run_lib($sameFacts$, 2),
  findCount: run_lib($findCount$, 2)
};
export {
  find_default as default
};

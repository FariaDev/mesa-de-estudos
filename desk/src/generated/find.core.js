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
function $pageOf$(h_0) {
  const page_0 = h_0.page;
  const count_0 = h_0.count;
  return page_0;
}
function $countOf$(h_0) {
  const page_0 = h_0.page;
  const count_0 = h_0.count;
  return count_0;
}
function $firstHit$(pages_0) {
  if (pages_0.$ === "Nil") {
    return { $: "None" };
  } else {
    const h_0 = pages_0.head;
    const t_0 = pages_0.tail;
    return { $: "Some", ["value"]: run_loop($pageOf$(h_0)) };
  }
}
function $setFound$bump$(page_0, after_0) {
  if (after_0) {
    return { $: "Some", ["value"]: page_0 };
  } else {
    return { $: "None" };
  }
}
function $setFound$(found_0, page_0, after_0) {
  if (found_0.$ === "Some") {
    const v_0 = found_0.value;
    return { $: "Some", ["value"]: v_0 };
  } else {
    return run_jump($setFound$bump$, [page_0, after_0]);
  }
}
function $walkFound$(pages_0, facts_0, found_0) {
  if (pages_0.$ === "Nil") {
    return found_0;
  } else {
    const h_0 = pages_0.head;
    const t_0 = pages_0.tail;
    if (facts_0.$ === "Nil") {
      return found_0;
    } else {
      const f_0 = facts_0.head;
      const fs_0 = facts_0.tail;
      return run_jump($walkFound$, [t_0, fs_0, run_loop($setFound$(found_0, run_loop($pageOf$(h_0)), f_0))]);
    }
  }
}
function $finishWalk$(found_0, first_0) {
  if (found_0.$ === "Some") {
    const p_0 = found_0.value;
    return { $: "Some", ["value"]: p_0 };
  } else {
    return first_0;
  }
}
function $nextHitFacts$(pages_0, facts_0) {
  return run_jump($finishWalk$, [run_loop($walkFound$(pages_0, facts_0, { $: "None" })), run_loop($firstHit$(pages_0))]);
}
function $afterFacts$(pages_0, current_0) {
  if (pages_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _t_0 = pages_0.head;
    const page_0 = _t_0.page;
    const count_0 = _t_0.count;
    const t_0 = pages_0.tail;
    return { $: "Con", ["head"]: run_loop($Nat$is_gt$(page_0, current_0)), ["tail"]: run_loop($afterFacts$(t_0, current_0)) };
  }
}
function $nextHit$(pages_0, current_0) {
  return run_jump($nextHitFacts$, [pages_0, run_loop($afterFacts$(pages_0, current_0))]);
}
function $cycleTarget$(cycle_0, pages_0, current_0) {
  if (cycle_0) {
    return run_jump($nextHit$, [pages_0, current_0]);
  } else {
    return run_jump($firstHit$, [pages_0]);
  }
}
function $totalHits$(pages_0) {
  if (pages_0.$ === "Nil") {
    return 0n;
  } else {
    const _t_0 = pages_0.head;
    const page_0 = _t_0.page;
    const count_0 = _t_0.count;
    const t_0 = pages_0.tail;
    const x_0 = run_loop($totalHits$(t_0));
    return nat_chk(count_0 + x_0);
  }
}
function $scanStep$look$(before_0, count_0, same_0) {
  if (same_0) {
    return { $: "Got", ["before"]: before_0 };
  } else {
    return { $: "Looking", ["before"]: nat_chk(before_0 + count_0) };
  }
}
function $scanStep$(s_0, count_0, same_0) {
  if (s_0.$ === "Got") {
    const before_0 = s_0.before;
    return { $: "Got", ["before"]: before_0 };
  } else {
    const before_1 = s_0.before;
    return run_jump($scanStep$look$, [before_1, count_0, same_0]);
  }
}
function $finishScan$(s_0, total_0) {
  if (s_0.$ === "Looking") {
    const before_0 = s_0.before;
    return { $: "All", ["total"]: total_0 };
  } else {
    const before_1 = s_0.before;
    return { $: "Shown", ["index"]: nat_chk(before_1 + 1n), ["total"]: total_0 };
  }
}
function $countFacts$(pages_0, facts_0, total_0, s_0) {
  if (pages_0.$ === "Nil") {
    return run_jump($finishScan$, [s_0, total_0]);
  } else {
    const h_0 = pages_0.head;
    const t_0 = pages_0.tail;
    if (facts_0.$ === "Nil") {
      return run_jump($finishScan$, [s_0, total_0]);
    } else {
      const f_0 = facts_0.head;
      const fs_0 = facts_0.tail;
      return run_jump($countFacts$, [t_0, fs_0, total_0, run_loop($scanStep$(s_0, run_loop($countOf$(h_0)), f_0))]);
    }
  }
}
function $sameFacts$(pages_0, current_0) {
  if (pages_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _t_0 = pages_0.head;
    const page_0 = _t_0.page;
    const count_0 = _t_0.count;
    const t_0 = pages_0.tail;
    return { $: "Con", ["head"]: run_loop($Nat$is_eq$(page_0, current_0)), ["tail"]: run_loop($sameFacts$(t_0, current_0)) };
  }
}
function $findCount$(pages_0, current_0) {
  if (pages_0.$ === "Nil") {
    return { $: "Hidden" };
  } else {
    const h_0 = pages_0.head;
    const t_0 = pages_0.tail;
    return run_jump($countFacts$, [{ $: "Con", ["head"]: h_0, ["tail"]: t_0 }, run_loop($sameFacts$({ $: "Con", ["head"]: h_0, ["tail"]: t_0 }, current_0)), run_loop($totalHits$({ $: "Con", ["head"]: h_0, ["tail"]: t_0 })), { $: "Looking", ["before"]: 0n }]);
  }
}
function $Nat$is_gt$(a_0, b_0) {
  return run_jump($Cmp$is_gt$, [cmp_new(a_0, b_0)]);
}
function $Nat$is_eq$(a_0, b_0) {
  return run_jump($Cmp$is_eq$, [cmp_new(a_0, b_0)]);
}
function $Cmp$is_gt$(c_0) {
  if (c_0.$ === "LT") {
    return false;
  } else if (c_0.$ === "EQ") {
    return false;
  } else {
    return true;
  }
}
function $Cmp$is_eq$(c_0) {
  if (c_0.$ === "LT") {
    return false;
  } else if (c_0.$ === "EQ") {
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

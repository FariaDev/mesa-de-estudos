// GERADO de core/rpcstate.bend por `bun core/build.mjs` — não editar à mão.
// core/rpcstate.bend
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
function $emitUnless$(stopped_0) {
  if (stopped_0) {
    return false;
  } else {
    return true;
  }
}
function $keep$(alive_0, stopped_0, pending_0, seq_0) {
  return { $: "RpcOut", ["alive"]: alive_0, ["stopped"]: stopped_0, ["pending"]: pending_0, ["seq"]: seq_0, ["act"]: { $: "ActNone" }, ["emit"]: false };
}
function $downKill$(stopped_0, seq_0) {
  return { $: "RpcOut", ["alive"]: false, ["stopped"]: stopped_0, ["pending"]: 0n, ["seq"]: seq_0, ["act"]: { $: "ActKill" }, ["emit"]: run_loop($emitUnless$(stopped_0)) };
}
function $downExit$(stopped_0, seq_0) {
  return { $: "RpcOut", ["alive"]: false, ["stopped"]: stopped_0, ["pending"]: 0n, ["seq"]: seq_0, ["act"]: { $: "ActExit" }, ["emit"]: run_loop($emitUnless$(stopped_0)) };
}
function $downStop$(seq_0) {
  return { $: "RpcOut", ["alive"]: false, ["stopped"]: true, ["pending"]: 0n, ["seq"]: seq_0, ["act"]: { $: "ActStop" }, ["emit"]: false };
}
function $pred$(n_0) {
  if (n_0 === 0n) {
    return 0n;
  } else {
    const p_0 = n_0 - 1n;
    return p_0;
  }
}
function $settle$(success_0) {
  if (success_0) {
    return { $: "ActResolve" };
  } else {
    return { $: "ActRefuse" };
  }
}
function $onStart$pi$(pending_0, seq_0) {
  return { $: "RpcOut", ["alive"]: true, ["stopped"]: false, ["pending"]: pending_0, ["seq"]: seq_0, ["act"]: { $: "ActSpawn" }, ["emit"]: false };
}
function $onStart$noPi$(seq_0) {
  return { $: "RpcOut", ["alive"]: false, ["stopped"]: false, ["pending"]: 0n, ["seq"]: seq_0, ["act"]: { $: "ActFail" }, ["emit"]: true };
}
function $onStart$fresh$(hasPi_0, pending_0, seq_0) {
  if (hasPi_0) {
    return run_jump($onStart$pi$, [pending_0, seq_0]);
  } else {
    return run_jump($onStart$noPi$, [seq_0]);
  }
}
function $onStart$(alive_0, hasPi_0, stopped_0, pending_0, seq_0) {
  if (alive_0) {
    return run_jump($keep$, [true, stopped_0, pending_0, seq_0]);
  } else {
    return run_jump($onStart$fresh$, [hasPi_0, pending_0, seq_0]);
  }
}
function $onRequest$(alive_0, stopped_0, pending_0, seq_0) {
  if (!alive_0) {
    return { $: "RpcOut", ["alive"]: false, ["stopped"]: stopped_0, ["pending"]: pending_0, ["seq"]: seq_0, ["act"]: { $: "ActReject" }, ["emit"]: false };
  } else {
    return { $: "RpcOut", ["alive"]: true, ["stopped"]: stopped_0, ["pending"]: nat_chk(pending_0 + 1n), ["seq"]: nat_chk(seq_0 + 1n), ["act"]: { $: "ActEnqueue" }, ["emit"]: false };
  }
}
function $onReply$known$(alive_0, stopped_0, pending_0, seq_0, success_0) {
  return { $: "RpcOut", ["alive"]: alive_0, ["stopped"]: stopped_0, ["pending"]: run_loop($pred$(pending_0)), ["seq"]: seq_0, ["act"]: run_loop($settle$(success_0)), ["emit"]: false };
}
function $onReply$(known_0, alive_0, stopped_0, pending_0, seq_0, success_0) {
  if (!known_0) {
    return run_jump($keep$, [alive_0, stopped_0, pending_0, seq_0]);
  } else {
    return run_jump($onReply$known$, [alive_0, stopped_0, pending_0, seq_0, success_0]);
  }
}
function $onRespond$(alive_0, stopped_0, pending_0, seq_0) {
  if (!alive_0) {
    return run_jump($keep$, [false, stopped_0, pending_0, seq_0]);
  } else {
    return { $: "RpcOut", ["alive"]: true, ["stopped"]: stopped_0, ["pending"]: pending_0, ["seq"]: seq_0, ["act"]: { $: "ActWrite" }, ["emit"]: false };
  }
}
function $onBreak$(should_0, alive_0, stopped_0, pending_0, seq_0) {
  if (!should_0) {
    return run_jump($keep$, [alive_0, stopped_0, pending_0, seq_0]);
  } else {
    return run_jump($downKill$, [stopped_0, seq_0]);
  }
}
function $onTimeout$(known_0, alive_0, stopped_0, pending_0, seq_0) {
  if (!known_0) {
    return run_jump($keep$, [alive_0, stopped_0, pending_0, seq_0]);
  } else {
    return { $: "RpcOut", ["alive"]: alive_0, ["stopped"]: stopped_0, ["pending"]: run_loop($pred$(pending_0)), ["seq"]: seq_0, ["act"]: { $: "ActRefuse" }, ["emit"]: false };
  }
}
function $onError$(isCurrent_0, alive_0, stopped_0, pending_0, seq_0) {
  return run_jump($onBreak$, [isCurrent_0, alive_0, stopped_0, pending_0, seq_0]);
}
function $onExit$(isCurrent_0, alive_0, stopped_0, pending_0, seq_0) {
  if (!isCurrent_0) {
    return run_jump($keep$, [alive_0, stopped_0, pending_0, seq_0]);
  } else {
    return run_jump($downExit$, [stopped_0, seq_0]);
  }
}
function $onStop$(alive_0, pending_0, seq_0) {
  return run_jump($downStop$, [seq_0]);
}
function $step$(alive_0, stopped_0, pending_0, seq_0, e_0) {
  if (e_0.$ === "EvStart") {
    const hasPi_0 = e_0.hasPi;
    return run_jump($onStart$, [alive_0, hasPi_0, stopped_0, pending_0, seq_0]);
  } else if (e_0.$ === "EvRequest") {
    return run_jump($onRequest$, [alive_0, stopped_0, pending_0, seq_0]);
  } else if (e_0.$ === "EvReply") {
    const known_0 = e_0.known;
    const success_0 = e_0.success;
    return run_jump($onReply$, [known_0, alive_0, stopped_0, pending_0, seq_0, success_0]);
  } else if (e_0.$ === "EvTimeout") {
    const known_1 = e_0.known;
    return run_jump($onTimeout$, [known_1, alive_0, stopped_0, pending_0, seq_0]);
  } else if (e_0.$ === "EvError") {
    const isCurrent_0 = e_0.isCurrent;
    return run_jump($onError$, [isCurrent_0, alive_0, stopped_0, pending_0, seq_0]);
  } else if (e_0.$ === "EvExit") {
    const isCurrent_1 = e_0.isCurrent;
    return run_jump($onExit$, [isCurrent_1, alive_0, stopped_0, pending_0, seq_0]);
  } else if (e_0.$ === "EvStop") {
    return run_jump($onStop$, [alive_0, pending_0, seq_0]);
  } else {
    return run_jump($onRespond$, [alive_0, stopped_0, pending_0, seq_0]);
  }
}
function $aliveOf$(o_0) {
  const alive_0 = o_0.alive;
  const __0 = o_0.stopped;
  const __1 = o_0.pending;
  const __2 = o_0.seq;
  const __3 = o_0.act;
  const __4 = o_0.emit;
  return alive_0;
}
function $stoppedOf$(o_0) {
  const __0 = o_0.alive;
  const stopped_0 = o_0.stopped;
  const __1 = o_0.pending;
  const __2 = o_0.seq;
  const __3 = o_0.act;
  const __4 = o_0.emit;
  return stopped_0;
}
function $pendingOf$(o_0) {
  const __0 = o_0.alive;
  const __1 = o_0.stopped;
  const pending_0 = o_0.pending;
  const __2 = o_0.seq;
  const __3 = o_0.act;
  const __4 = o_0.emit;
  return pending_0;
}
function $seqOf$(o_0) {
  const __0 = o_0.alive;
  const __1 = o_0.stopped;
  const __2 = o_0.pending;
  const seq_0 = o_0.seq;
  const __3 = o_0.act;
  const __4 = o_0.emit;
  return seq_0;
}
function $actOf$(o_0) {
  const __0 = o_0.alive;
  const __1 = o_0.stopped;
  const __2 = o_0.pending;
  const __3 = o_0.seq;
  const act_0 = o_0.act;
  const __4 = o_0.emit;
  return act_0;
}
function $emitOf$(o_0) {
  const __0 = o_0.alive;
  const __1 = o_0.stopped;
  const __2 = o_0.pending;
  const __3 = o_0.seq;
  const __4 = o_0.act;
  const emit_0 = o_0.emit;
  return emit_0;
}
function $boot$() {
  return { $: "RpcOut", ["alive"]: false, ["stopped"]: false, ["pending"]: 0n, ["seq"]: 0n, ["act"]: { $: "ActNone" }, ["emit"]: false };
}
var rpcstate_default = {
  emitUnless: run_lib($emitUnless$, 1),
  keep: run_lib($keep$, 4),
  downKill: run_lib($downKill$, 2),
  downExit: run_lib($downExit$, 2),
  downStop: run_lib($downStop$, 1),
  pred: run_lib($pred$, 1),
  settle: run_lib($settle$, 1),
  "onStart.pi": run_lib($onStart$pi$, 2),
  "onStart.noPi": run_lib($onStart$noPi$, 1),
  "onStart.fresh": run_lib($onStart$fresh$, 3),
  onStart: run_lib($onStart$, 5),
  onRequest: run_lib($onRequest$, 4),
  "onReply.known": run_lib($onReply$known$, 5),
  onReply: run_lib($onReply$, 6),
  onRespond: run_lib($onRespond$, 4),
  onBreak: run_lib($onBreak$, 5),
  onTimeout: run_lib($onTimeout$, 5),
  onError: run_lib($onError$, 5),
  onExit: run_lib($onExit$, 5),
  onStop: run_lib($onStop$, 3),
  step: run_lib($step$, 5),
  aliveOf: run_lib($aliveOf$, 1),
  stoppedOf: run_lib($stoppedOf$, 1),
  pendingOf: run_lib($pendingOf$, 1),
  seqOf: run_lib($seqOf$, 1),
  actOf: run_lib($actOf$, 1),
  emitOf: run_lib($emitOf$, 1),
  boot: run_lib($boot$, 0)
};
export {
  rpcstate_default as default
};

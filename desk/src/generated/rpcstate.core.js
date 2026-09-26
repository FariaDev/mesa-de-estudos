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
function $emitUnless$(_stopped_0) {
  if (_stopped_0) {
    return false;
  } else {
    return true;
  }
}
function $keep$(_alive_0, _stopped_0, _pending_0, _seq_0) {
  return { $: "RpcOut", ["alive"]: _alive_0, ["stopped"]: _stopped_0, ["pending"]: _pending_0, ["seq"]: _seq_0, ["act"]: { $: "ActNone" }, ["emit"]: false };
}
function $downKill$(_stopped_0, _seq_0) {
  return { $: "RpcOut", ["alive"]: false, ["stopped"]: _stopped_0, ["pending"]: 0n, ["seq"]: _seq_0, ["act"]: { $: "ActKill" }, ["emit"]: run_loop($emitUnless$(_stopped_0)) };
}
function $downExit$(_stopped_0, _seq_0) {
  return { $: "RpcOut", ["alive"]: false, ["stopped"]: _stopped_0, ["pending"]: 0n, ["seq"]: _seq_0, ["act"]: { $: "ActExit" }, ["emit"]: run_loop($emitUnless$(_stopped_0)) };
}
function $downStop$(_seq_0) {
  return { $: "RpcOut", ["alive"]: false, ["stopped"]: true, ["pending"]: 0n, ["seq"]: _seq_0, ["act"]: { $: "ActStop" }, ["emit"]: false };
}
function $pred$(_n_0) {
  if (_n_0 === 0n) {
    return 0n;
  } else {
    const _p_0 = _n_0 - 1n;
    return _p_0;
  }
}
function $settle$(_success_0) {
  if (_success_0) {
    return { $: "ActResolve" };
  } else {
    return { $: "ActRefuse" };
  }
}
function $onStart$pi$(_pending_0, _seq_0) {
  return { $: "RpcOut", ["alive"]: true, ["stopped"]: false, ["pending"]: _pending_0, ["seq"]: _seq_0, ["act"]: { $: "ActSpawn" }, ["emit"]: false };
}
function $onStart$noPi$(_seq_0) {
  return { $: "RpcOut", ["alive"]: false, ["stopped"]: false, ["pending"]: 0n, ["seq"]: _seq_0, ["act"]: { $: "ActFail" }, ["emit"]: true };
}
function $onStart$fresh$(_hasPi_0, _pending_0, _seq_0) {
  if (_hasPi_0) {
    return run_jump($onStart$pi$, [_pending_0, _seq_0]);
  } else {
    return run_jump($onStart$noPi$, [_seq_0]);
  }
}
function $onStart$(_alive_0, _hasPi_0, _stopped_0, _pending_0, _seq_0) {
  if (_alive_0) {
    return run_jump($keep$, [true, _stopped_0, _pending_0, _seq_0]);
  } else {
    return run_jump($onStart$fresh$, [_hasPi_0, _pending_0, _seq_0]);
  }
}
function $onRequest$(_alive_0, _stopped_0, _pending_0, _seq_0) {
  if (!_alive_0) {
    return { $: "RpcOut", ["alive"]: false, ["stopped"]: _stopped_0, ["pending"]: _pending_0, ["seq"]: _seq_0, ["act"]: { $: "ActReject" }, ["emit"]: false };
  } else {
    return { $: "RpcOut", ["alive"]: true, ["stopped"]: _stopped_0, ["pending"]: nat_chk(_pending_0 + 1n), ["seq"]: nat_chk(_seq_0 + 1n), ["act"]: { $: "ActEnqueue" }, ["emit"]: false };
  }
}
function $onReply$known$(_alive_0, _stopped_0, _pending_0, _seq_0, _success_0) {
  return { $: "RpcOut", ["alive"]: _alive_0, ["stopped"]: _stopped_0, ["pending"]: run_loop($pred$(_pending_0)), ["seq"]: _seq_0, ["act"]: run_loop($settle$(_success_0)), ["emit"]: false };
}
function $onReply$(_known_0, _alive_0, _stopped_0, _pending_0, _seq_0, _success_0) {
  if (!_known_0) {
    return run_jump($keep$, [_alive_0, _stopped_0, _pending_0, _seq_0]);
  } else {
    return run_jump($onReply$known$, [_alive_0, _stopped_0, _pending_0, _seq_0, _success_0]);
  }
}
function $onRespond$(_alive_0, _stopped_0, _pending_0, _seq_0) {
  if (!_alive_0) {
    return run_jump($keep$, [false, _stopped_0, _pending_0, _seq_0]);
  } else {
    return { $: "RpcOut", ["alive"]: true, ["stopped"]: _stopped_0, ["pending"]: _pending_0, ["seq"]: _seq_0, ["act"]: { $: "ActWrite" }, ["emit"]: false };
  }
}
function $onBreak$(_should_0, _alive_0, _stopped_0, _pending_0, _seq_0) {
  if (!_should_0) {
    return run_jump($keep$, [_alive_0, _stopped_0, _pending_0, _seq_0]);
  } else {
    return run_jump($downKill$, [_stopped_0, _seq_0]);
  }
}
function $onTimeout$(_known_0, _alive_0, _stopped_0, _pending_0, _seq_0) {
  if (!_known_0) {
    return run_jump($keep$, [_alive_0, _stopped_0, _pending_0, _seq_0]);
  } else {
    return { $: "RpcOut", ["alive"]: _alive_0, ["stopped"]: _stopped_0, ["pending"]: run_loop($pred$(_pending_0)), ["seq"]: _seq_0, ["act"]: { $: "ActRefuse" }, ["emit"]: false };
  }
}
function $onError$(_isCurrent_0, _alive_0, _stopped_0, _pending_0, _seq_0) {
  return run_jump($onBreak$, [_isCurrent_0, _alive_0, _stopped_0, _pending_0, _seq_0]);
}
function $onExit$(_isCurrent_0, _alive_0, _stopped_0, _pending_0, _seq_0) {
  if (!_isCurrent_0) {
    return run_jump($keep$, [_alive_0, _stopped_0, _pending_0, _seq_0]);
  } else {
    return run_jump($downExit$, [_stopped_0, _seq_0]);
  }
}
function $onStop$(_alive_0, _pending_0, _seq_0) {
  return run_jump($downStop$, [_seq_0]);
}
function $onGarbage$(_alive_0, _stopped_0, _pending_0, _seq_0) {
  return run_jump($keep$, [_alive_0, _stopped_0, _pending_0, _seq_0]);
}
function $step$(_alive_0, _stopped_0, _pending_0, _seq_0, _e_0) {
  if (_e_0.$ === "EvStart") {
    const _hasPi_0 = _e_0["hasPi"];
    return run_jump($onStart$, [_alive_0, _hasPi_0, _stopped_0, _pending_0, _seq_0]);
  } else if (_e_0.$ === "EvRequest") {
    return run_jump($onRequest$, [_alive_0, _stopped_0, _pending_0, _seq_0]);
  } else if (_e_0.$ === "EvReply") {
    const _known_0 = _e_0["known"];
    const _success_0 = _e_0["success"];
    return run_jump($onReply$, [_known_0, _alive_0, _stopped_0, _pending_0, _seq_0, _success_0]);
  } else if (_e_0.$ === "EvTimeout") {
    const _known_1 = _e_0["known"];
    return run_jump($onTimeout$, [_known_1, _alive_0, _stopped_0, _pending_0, _seq_0]);
  } else if (_e_0.$ === "EvError") {
    const _isCurrent_0 = _e_0["isCurrent"];
    return run_jump($onError$, [_isCurrent_0, _alive_0, _stopped_0, _pending_0, _seq_0]);
  } else if (_e_0.$ === "EvExit") {
    const _isCurrent_1 = _e_0["isCurrent"];
    return run_jump($onExit$, [_isCurrent_1, _alive_0, _stopped_0, _pending_0, _seq_0]);
  } else if (_e_0.$ === "EvStop") {
    return run_jump($onStop$, [_alive_0, _pending_0, _seq_0]);
  } else if (_e_0.$ === "EvRespond") {
    return run_jump($onRespond$, [_alive_0, _stopped_0, _pending_0, _seq_0]);
  } else {
    return run_jump($onGarbage$, [_alive_0, _stopped_0, _pending_0, _seq_0]);
  }
}
function $aliveOf$(_o_0) {
  const _alive_0 = _o_0["alive"];
  const __0 = _o_0["stopped"];
  const __1 = _o_0["pending"];
  const __2 = _o_0["seq"];
  const __3 = _o_0["act"];
  const __4 = _o_0["emit"];
  return _alive_0;
}
function $stoppedOf$(_o_0) {
  const __0 = _o_0["alive"];
  const _stopped_0 = _o_0["stopped"];
  const __1 = _o_0["pending"];
  const __2 = _o_0["seq"];
  const __3 = _o_0["act"];
  const __4 = _o_0["emit"];
  return _stopped_0;
}
function $pendingOf$(_o_0) {
  const __0 = _o_0["alive"];
  const __1 = _o_0["stopped"];
  const _pending_0 = _o_0["pending"];
  const __2 = _o_0["seq"];
  const __3 = _o_0["act"];
  const __4 = _o_0["emit"];
  return _pending_0;
}
function $seqOf$(_o_0) {
  const __0 = _o_0["alive"];
  const __1 = _o_0["stopped"];
  const __2 = _o_0["pending"];
  const _seq_0 = _o_0["seq"];
  const __3 = _o_0["act"];
  const __4 = _o_0["emit"];
  return _seq_0;
}
function $actOf$(_o_0) {
  const __0 = _o_0["alive"];
  const __1 = _o_0["stopped"];
  const __2 = _o_0["pending"];
  const __3 = _o_0["seq"];
  const _act_0 = _o_0["act"];
  const __4 = _o_0["emit"];
  return _act_0;
}
function $emitOf$(_o_0) {
  const __0 = _o_0["alive"];
  const __1 = _o_0["stopped"];
  const __2 = _o_0["pending"];
  const __3 = _o_0["seq"];
  const __4 = _o_0["act"];
  const _emit_0 = _o_0["emit"];
  return _emit_0;
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
  onGarbage: run_lib($onGarbage$, 4),
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

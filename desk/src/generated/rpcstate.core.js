// GERADO de core/rpcstate.bend por `bun core/build.mjs` — não editar à mão.
// core/rpcstate.bend
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
function $emitUnless(_stopped_0) {
  if (_stopped_0) {
    return false;
  } else {
    return true;
  }
}
function $keep(_alive_0, _stopped_0, _pending_0, _seq_0) {
  return { $: "RpcOut", alive: _alive_0, stopped: _stopped_0, pending: _pending_0, seq: _seq_0, act: { $: "ActNone" }, emit: false };
}
function $downKill(_stopped_0, _seq_0) {
  return { $: "RpcOut", alive: false, stopped: _stopped_0, pending: 0, seq: _seq_0, act: { $: "ActKill" }, emit: $emitUnless(_stopped_0) };
}
function $downExit(_stopped_0, _seq_0) {
  return { $: "RpcOut", alive: false, stopped: _stopped_0, pending: 0, seq: _seq_0, act: { $: "ActExit" }, emit: $emitUnless(_stopped_0) };
}
function $downStop(_seq_0) {
  return { $: "RpcOut", alive: false, stopped: true, pending: 0, seq: _seq_0, act: { $: "ActStop" }, emit: false };
}
function $pred(_n_0) {
  if (_n_0 === 0) {
    return 0;
  } else {
    const _p_0 = _n_0 - 1;
    return _p_0;
  }
}
function $settle(_success_0) {
  if (_success_0) {
    return { $: "ActResolve" };
  } else {
    return { $: "ActRefuse" };
  }
}
function $onStart_pi(_pending_0, _seq_0) {
  return { $: "RpcOut", alive: true, stopped: false, pending: _pending_0, seq: _seq_0, act: { $: "ActSpawn" }, emit: false };
}
function $onStart_noPi(_seq_0) {
  return { $: "RpcOut", alive: false, stopped: false, pending: 0, seq: _seq_0, act: { $: "ActFail" }, emit: true };
}
function $onStart_fresh(_hasPi_0, _pending_0, _seq_0) {
  if (_hasPi_0) {
    return $onStart_pi(_pending_0, _seq_0);
  } else {
    return $onStart_noPi(_seq_0);
  }
}
function $onStart(_alive_0, _hasPi_0, _stopped_0, _pending_0, _seq_0) {
  if (_alive_0) {
    return $keep(true, _stopped_0, _pending_0, _seq_0);
  } else {
    return $onStart_fresh(_hasPi_0, _pending_0, _seq_0);
  }
}
function $onRequest(_alive_0, _stopped_0, _pending_0, _seq_0) {
  if (!_alive_0) {
    return { $: "RpcOut", alive: false, stopped: _stopped_0, pending: _pending_0, seq: _seq_0, act: { $: "ActReject" }, emit: false };
  } else {
    return { $: "RpcOut", alive: true, stopped: _stopped_0, pending: nat_chk(_pending_0 + 1), seq: nat_chk(_seq_0 + 1), act: { $: "ActEnqueue" }, emit: false };
  }
}
function $onReply_known(_alive_0, _stopped_0, _pending_0, _seq_0, _success_0) {
  return { $: "RpcOut", alive: _alive_0, stopped: _stopped_0, pending: $pred(_pending_0), seq: _seq_0, act: $settle(_success_0), emit: false };
}
function $onReply(_known_0, _alive_0, _stopped_0, _pending_0, _seq_0, _success_0) {
  if (!_known_0) {
    return $keep(_alive_0, _stopped_0, _pending_0, _seq_0);
  } else {
    return $onReply_known(_alive_0, _stopped_0, _pending_0, _seq_0, _success_0);
  }
}
function $onRespond(_alive_0, _stopped_0, _pending_0, _seq_0) {
  if (!_alive_0) {
    return $keep(false, _stopped_0, _pending_0, _seq_0);
  } else {
    return { $: "RpcOut", alive: true, stopped: _stopped_0, pending: _pending_0, seq: _seq_0, act: { $: "ActWrite" }, emit: false };
  }
}
function $onBreak(_should_0, _alive_0, _stopped_0, _pending_0, _seq_0) {
  if (!_should_0) {
    return $keep(_alive_0, _stopped_0, _pending_0, _seq_0);
  } else {
    return $downKill(_stopped_0, _seq_0);
  }
}
function $onTimeout(_known_0, _alive_0, _stopped_0, _pending_0, _seq_0) {
  if (!_known_0) {
    return $keep(_alive_0, _stopped_0, _pending_0, _seq_0);
  } else {
    return { $: "RpcOut", alive: _alive_0, stopped: _stopped_0, pending: $pred(_pending_0), seq: _seq_0, act: { $: "ActRefuse" }, emit: false };
  }
}
function $onError(_isCurrent_0, _alive_0, _stopped_0, _pending_0, _seq_0) {
  return $onBreak(_isCurrent_0, _alive_0, _stopped_0, _pending_0, _seq_0);
}
function $onExit(_isCurrent_0, _alive_0, _stopped_0, _pending_0, _seq_0) {
  if (!_isCurrent_0) {
    return $keep(_alive_0, _stopped_0, _pending_0, _seq_0);
  } else {
    return $downExit(_stopped_0, _seq_0);
  }
}
function $onStop(_alive_0, _pending_0, _seq_0) {
  return $downStop(_seq_0);
}
function $onGarbage(_alive_0, _stopped_0, _pending_0, _seq_0) {
  return $keep(_alive_0, _stopped_0, _pending_0, _seq_0);
}
function $step(_alive_0, _stopped_0, _pending_0, _seq_0, _e_0) {
  if (_e_0.$ === "EvStart") {
    const _hasPi_0 = _e_0["hasPi"];
    return $onStart(_alive_0, _hasPi_0, _stopped_0, _pending_0, _seq_0);
  } else if (_e_0.$ === "EvRequest") {
    return $onRequest(_alive_0, _stopped_0, _pending_0, _seq_0);
  } else if (_e_0.$ === "EvReply") {
    const _known_0 = _e_0["known"];
    const _success_0 = _e_0["success"];
    return $onReply(_known_0, _alive_0, _stopped_0, _pending_0, _seq_0, _success_0);
  } else if (_e_0.$ === "EvTimeout") {
    const _known_1 = _e_0["known"];
    return $onTimeout(_known_1, _alive_0, _stopped_0, _pending_0, _seq_0);
  } else if (_e_0.$ === "EvError") {
    const _isCurrent_0 = _e_0["isCurrent"];
    return $onError(_isCurrent_0, _alive_0, _stopped_0, _pending_0, _seq_0);
  } else if (_e_0.$ === "EvExit") {
    const _isCurrent_1 = _e_0["isCurrent"];
    return $onExit(_isCurrent_1, _alive_0, _stopped_0, _pending_0, _seq_0);
  } else if (_e_0.$ === "EvStop") {
    return $onStop(_alive_0, _pending_0, _seq_0);
  } else if (_e_0.$ === "EvRespond") {
    return $onRespond(_alive_0, _stopped_0, _pending_0, _seq_0);
  } else {
    return $onGarbage(_alive_0, _stopped_0, _pending_0, _seq_0);
  }
}
function $aliveOf(_o_0) {
  const _alive_0 = _o_0["alive"];
  return _alive_0;
}
function $pendingOf(_o_0) {
  const _pending_0 = _o_0["pending"];
  return _pending_0;
}
function $seqOf(_o_0) {
  const _seq_0 = _o_0["seq"];
  return _seq_0;
}
function $emitOf(_o_0) {
  const _emit_0 = _o_0["emit"];
  return _emit_0;
}
function $boot() {
  return { $: "RpcOut", alive: false, stopped: false, pending: 0, seq: 0, act: { $: "ActNone" }, emit: false };
}
function $runAfterEvent(_active_0, _starts_0, _settled_0) {
  if (_settled_0) {
    return false;
  } else {
    return _active_0 || _starts_0;
  }
}
function $runAfterAcceptance(_active_0, _accepted_0, _sameSettlement_0) {
  const _x_0 = $Bool_and(_accepted_0, _sameSettlement_0);
  return _active_0 || _x_0;
}
function $runBusy(_active_0, _streaming_0, _compacting_0, _queued_0) {
  const _x_0 = _compacting_0 || _queued_0;
  const _x_1 = _streaming_0 || _x_0;
  return _active_0 || _x_1;
}
function $Bool_and(_a_0, _b_0) {
  if (!_a_0) {
    return false;
  } else {
    return _b_0;
  }
}
var rpcstate_default = {
  emitUnless: run_lib((a0) => run_loop($emitUnless(a0)), 1),
  keep: run_lib((a0, a1, a2, a3) => run_loop($keep(a0, a1, nat_in(a2), nat_in(a3))), 4),
  downKill: run_lib((a0, a1) => run_loop($downKill(a0, nat_in(a1))), 2),
  downExit: run_lib((a0, a1) => run_loop($downExit(a0, nat_in(a1))), 2),
  downStop: run_lib((a0) => run_loop($downStop(nat_in(a0))), 1),
  pred: run_lib((a0) => run_loop($pred(nat_in(a0))), 1),
  settle: run_lib((a0) => run_loop($settle(a0)), 1),
  "onStart.pi": run_lib((a0, a1) => run_loop($onStart_pi(nat_in(a0), nat_in(a1))), 2),
  "onStart.noPi": run_lib((a0) => run_loop($onStart_noPi(nat_in(a0))), 1),
  "onStart.fresh": run_lib((a0, a1, a2) => run_loop($onStart_fresh(a0, nat_in(a1), nat_in(a2))), 3),
  onStart: run_lib((a0, a1, a2, a3, a4) => run_loop($onStart(a0, a1, a2, nat_in(a3), nat_in(a4))), 5),
  onRequest: run_lib((a0, a1, a2, a3) => run_loop($onRequest(a0, a1, nat_in(a2), nat_in(a3))), 4),
  "onReply.known": run_lib((a0, a1, a2, a3, a4) => run_loop($onReply_known(a0, a1, nat_in(a2), nat_in(a3), a4)), 5),
  onReply: run_lib((a0, a1, a2, a3, a4, a5) => run_loop($onReply(a0, a1, a2, nat_in(a3), nat_in(a4), a5)), 6),
  onRespond: run_lib((a0, a1, a2, a3) => run_loop($onRespond(a0, a1, nat_in(a2), nat_in(a3))), 4),
  onBreak: run_lib((a0, a1, a2, a3, a4) => run_loop($onBreak(a0, a1, a2, nat_in(a3), nat_in(a4))), 5),
  onTimeout: run_lib((a0, a1, a2, a3, a4) => run_loop($onTimeout(a0, a1, a2, nat_in(a3), nat_in(a4))), 5),
  onError: run_lib((a0, a1, a2, a3, a4) => run_loop($onError(a0, a1, a2, nat_in(a3), nat_in(a4))), 5),
  onExit: run_lib((a0, a1, a2, a3, a4) => run_loop($onExit(a0, a1, a2, nat_in(a3), nat_in(a4))), 5),
  onStop: run_lib((a0, a1, a2) => run_loop($onStop(a0, nat_in(a1), nat_in(a2))), 3),
  onGarbage: run_lib((a0, a1, a2, a3) => run_loop($onGarbage(a0, a1, nat_in(a2), nat_in(a3))), 4),
  step: run_lib((a0, a1, a2, a3, a4) => run_loop($step(a0, a1, nat_in(a2), nat_in(a3), a4)), 5),
  aliveOf: run_lib((a0) => run_loop($aliveOf(a0)), 1),
  pendingOf: run_lib((a0) => run_loop($pendingOf(a0)), 1),
  seqOf: run_lib((a0) => run_loop($seqOf(a0)), 1),
  emitOf: run_lib((a0) => run_loop($emitOf(a0)), 1),
  boot: run_lib(() => run_loop($boot()), 0),
  runAfterEvent: run_lib((a0, a1, a2) => run_loop($runAfterEvent(a0, a1, a2)), 3),
  runAfterAcceptance: run_lib((a0, a1, a2) => run_loop($runAfterAcceptance(a0, a1, a2)), 3),
  runBusy: run_lib((a0, a1, a2, a3) => run_loop($runBusy(a0, a1, a2, a3)), 4)
};
export {
  rpcstate_default as default
};

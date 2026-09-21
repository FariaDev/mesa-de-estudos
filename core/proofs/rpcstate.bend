import Base
import ../laws/rpcstate.bend as Laws

# Fatos Bool e contadores Nat: as leis reduzem por computação.

def Laws.rpc_start_alive_noop(hasPi, stopped, pending, seq):
  {==}

def Laws.rpc_start_pi(stopped, pending, seq):
  {==}

def Laws.rpc_start_no_pi(stopped, pending, seq):
  {==}

def Laws.rpc_request_seq(stopped, pending, seq):
  {==}

def Laws.rpc_request_no_child(stopped, pending, seq):
  {==}

def Laws.rpc_timeout_refuses(alive, stopped, pending, seq):
  {==}

def Laws.rpc_timeout_pending_pred(alive, stopped, pending, seq):
  {==}

def Laws.rpc_timeout_alive(alive, stopped, pending, seq):
  {==}

def Laws.rpc_timeout_seq_kept(pending, seq):
  {==}

def Laws.rpc_timeout_stale(alive, stopped, pending, seq):
  {==}

def Laws.rpc_error_kills(pending, seq):
  {==}

def Laws.rpc_error_pending_zero(pending, seq):
  {==}

def Laws.rpc_reply_unknown(alive, stopped, pending, seq, success):
  {==}

def Laws.rpc_reply_after_down(seq, success):
  {==}

def Laws.rpc_reply_ok(alive, stopped, p, seq):
  {==}

def Laws.rpc_reply_err(alive, stopped, p, seq):
  {==}

def Laws.rpc_stop_clears(alive, pending, seq):
  {==}

def Laws.rpc_stop_no_emit(alive, pending, seq):
  {==}

def Laws.rpc_stop_pending_zero(alive, pending, seq):
  {==}

def Laws.rpc_stop_silent_after(seq, success):
  {==}

def Laws.rpc_exit_clears(pending, seq):
  {==}

def Laws.rpc_exit_pending_zero(pending, seq):
  {==}

def Laws.rpc_exit_stale(alive, stopped, pending, seq):
  {==}

def Laws.rpc_respond_alive(stopped, pending, seq):
  {==}

def Laws.rpc_respond_dead(stopped, pending, seq):
  {==}

def Laws.rpc_step_timeout(known, alive, stopped, pending, seq):
  {==}

def Laws.rpc_step_stop(alive, stopped, pending, seq):
  {==}

def Laws.rpc_step_error(flag, alive, stopped, pending, seq):
  {==}

def Laws.rpc_boot():
  {==}

import Base
import ../rpcstate.bend as R

# ---------------------------------------------------------------------------
# Contrato da máquina RPC. Prefixo `rpc_`.
#
# O host entrega fatos Bool (alive, known, hasPi, isCurrent, success) e
# contadores Nat (pending, seq). Leis casam nesses construtores — por isso
# reduzem. O que não saiu: igualdade de ids (String) e o Map de promessas;
# o host compara `pending.has(id)` e manda `known`.
# ---------------------------------------------------------------------------

# LAW: start não duplica ponte — vivo, ignora hasPi e não reseta stopped.
law rpc_start_alive_noop:
  for hasPi: Bool
  for stopped: Bool
  for pending: Nat
  for seq: Nat
  {R.onStart(True{}, hasPi, stopped, pending, seq)
    == R.RpcOut{True{}, stopped, pending, seq, R.ActNone{}, False{}} : R.RpcOut}

# LAW: sem filho e com pi, spawna e reabre (stopped=false).
law rpc_start_pi:
  for stopped: Bool
  for pending: Nat
  for seq: Nat
  {R.onStart(False{}, True{}, stopped, pending, seq)
    == R.RpcOut{True{}, False{}, pending, seq, R.ActSpawn{}, False{}} : R.RpcOut}

# LAW: sem filho e sem pi, zera pendentes e emite (start já reabriu stopped).
law rpc_start_no_pi:
  for stopped: Bool
  for pending: Nat
  for seq: Nat
  {R.onStart(False{}, False{}, stopped, pending, seq)
    == R.RpcOut{False{}, False{}, 0n, seq, R.ActFail{}, True{}} : R.RpcOut}

# LAW: request nunca reusa id — seq cresce e pending acompanha.
law rpc_request_seq:
  for stopped: Bool
  for pending: Nat
  for seq: Nat
  {R.onRequest(True{}, stopped, pending, seq)
    == R.RpcOut{True{}, stopped, Nat.add(pending, 1n), Nat.add(seq, 1n), R.ActEnqueue{}, False{}} : R.RpcOut}

# LAW: request sem filho rejeita só este pedido; seq não mexe.
law rpc_request_no_child:
  for stopped: Bool
  for pending: Nat
  for seq: Nat
  {R.onRequest(False{}, stopped, pending, seq)
    == R.RpcOut{False{}, stopped, pending, seq, R.ActReject{}, False{}} : R.RpcOut}

# LAW: timeout (id ainda pendente) recusa só o pedido; a ponte fica viva.
law rpc_timeout_refuses:
  for alive: Bool
  for stopped: Bool
  for pending: Nat
  for seq: Nat
  {R.onTimeout(True{}, alive, stopped, pending, seq)
    == R.RpcOut{alive, stopped, R.pred(pending), seq, R.ActRefuse{}, False{}} : R.RpcOut}

# LAW: pending cai exatamente um no timeout (os demais pedidos ficam).
law rpc_timeout_pending_pred:
  for alive: Bool
  for stopped: Bool
  for pending: Nat
  for seq: Nat
  {R.pendingOf(R.onTimeout(True{}, alive, stopped, pending, seq)) == R.pred(pending) : Nat}

# LAW: timeout não mata a ponte (quem detecta um Pi morto é o health).
law rpc_timeout_alive:
  for alive: Bool
  for stopped: Bool
  for pending: Nat
  for seq: Nat
  {R.aliveOf(R.onTimeout(True{}, alive, stopped, pending, seq)) == alive : Bool}

# seq não regride no timeout (o próximo request é que cresce).
law rpc_timeout_seq_kept:
  for pending: Nat
  for seq: Nat
  {R.seqOf(R.onTimeout(True{}, True{}, False{}, pending, seq)) == seq : Nat}

# Timeout de id já resolvido: ignora.
law rpc_timeout_stale:
  for alive: Bool
  for stopped: Bool
  for pending: Nat
  for seq: Nat
  {R.onTimeout(False{}, alive, stopped, pending, seq)
    == R.RpcOut{alive, stopped, pending, seq, R.ActNone{}, False{}} : R.RpcOut}

# LAW: erro do stdin/filho derruba — diferente do timeout, que só recusa.
law rpc_error_kills:
  for pending: Nat
  for seq: Nat
  {R.onError(True{}, True{}, False{}, pending, seq)
    == R.RpcOut{False{}, False{}, 0n, seq, R.ActKill{}, True{}} : R.RpcOut}

law rpc_error_pending_zero:
  for pending: Nat
  for seq: Nat
  {R.pendingOf(R.onError(True{}, True{}, False{}, pending, seq)) == 0n : Nat}

# LAW: resposta depois de derrubar é ignorada (host manda known=False).
law rpc_reply_unknown:
  for alive: Bool
  for stopped: Bool
  for pending: Nat
  for seq: Nat
  for success: Bool
  {R.onReply(False{}, alive, stopped, pending, seq, success)
    == R.RpcOut{alive, stopped, pending, seq, R.ActNone{}, False{}} : R.RpcOut}

# Estado concreto pós-kill: alive=false, pending=0.
law rpc_reply_after_down:
  for seq: Nat
  for success: Bool
  {R.onReply(False{}, False{}, False{}, 0n, seq, success)
    == R.RpcOut{False{}, False{}, 0n, seq, R.ActNone{}, False{}} : R.RpcOut}

# Resposta conhecida: pending encolhe (1n+p para o pred reduzir).
law rpc_reply_ok:
  for alive: Bool
  for stopped: Bool
  for p: Nat
  for seq: Nat
  {R.onReply(True{}, alive, stopped, 1n+p, seq, True{})
    == R.RpcOut{alive, stopped, p, seq, R.ActResolve{}, False{}} : R.RpcOut}

law rpc_reply_err:
  for alive: Bool
  for stopped: Bool
  for p: Nat
  for seq: Nat
  {R.onReply(True{}, alive, stopped, 1n+p, seq, False{})
    == R.RpcOut{alive, stopped, p, seq, R.ActRefuse{}, False{}} : R.RpcOut}

# LAW: stop rejeita todos, pending zero, não emite mais.
law rpc_stop_clears:
  for alive: Bool
  for pending: Nat
  for seq: Nat
  {R.onStop(alive, pending, seq)
    == R.RpcOut{False{}, True{}, 0n, seq, R.ActStop{}, False{}} : R.RpcOut}

law rpc_stop_no_emit:
  for alive: Bool
  for pending: Nat
  for seq: Nat
  {R.emitOf(R.onStop(alive, pending, seq)) == False{} : Bool}

law rpc_stop_pending_zero:
  for alive: Bool
  for pending: Nat
  for seq: Nat
  {R.pendingOf(R.onStop(alive, pending, seq)) == 0n : Nat}

law rpc_stop_silent_after:
  for seq: Nat
  for success: Bool
  {R.emitOf(R.onReply(False{}, False{}, True{}, 0n, seq, success)) == False{} : Bool}

# Exit do filho corrente: pending zero, sem kill (já morreu).
law rpc_exit_clears:
  for pending: Nat
  for seq: Nat
  {R.onExit(True{}, True{}, False{}, pending, seq)
    == R.RpcOut{False{}, False{}, 0n, seq, R.ActExit{}, True{}} : R.RpcOut}

law rpc_exit_pending_zero:
  for pending: Nat
  for seq: Nat
  {R.pendingOf(R.onExit(True{}, True{}, False{}, pending, seq)) == 0n : Nat}

law rpc_exit_stale:
  for alive: Bool
  for stopped: Bool
  for pending: Nat
  for seq: Nat
  {R.onExit(False{}, alive, stopped, pending, seq)
    == R.RpcOut{alive, stopped, pending, seq, R.ActNone{}, False{}} : R.RpcOut}

# Respond: só escreve se a ponte está viva.
law rpc_respond_alive:
  for stopped: Bool
  for pending: Nat
  for seq: Nat
  {R.onRespond(True{}, stopped, pending, seq)
    == R.RpcOut{True{}, stopped, pending, seq, R.ActWrite{}, False{}} : R.RpcOut}

law rpc_respond_dead:
  for stopped: Bool
  for pending: Nat
  for seq: Nat
  {R.onRespond(False{}, stopped, pending, seq)
    == R.RpcOut{False{}, stopped, pending, seq, R.ActNone{}, False{}} : R.RpcOut}

# LAW: linha ilegível no stdout não mexe na ponte — não derruba, não resolve
# nem rejeita pendente (o aviso ao usuário é do host).
law rpc_garbage_keeps:
  for alive: Bool
  for stopped: Bool
  for pending: Nat
  for seq: Nat
  {R.onGarbage(alive, stopped, pending, seq)
    == R.RpcOut{alive, stopped, pending, seq, R.ActNone{}, False{}} : R.RpcOut}

# O pendente que estava na fila continua pendente (a linha torta não o consome
# nem o recusa).
law rpc_garbage_pending_kept:
  for alive: Bool
  for stopped: Bool
  for pending: Nat
  for seq: Nat
  {R.pendingOf(R.onGarbage(alive, stopped, pending, seq)) == pending : Nat}

# A ponte continua viva: lixo no stdout não é o mesmo golpe de um erro de escrita.
law rpc_garbage_alive:
  for alive: Bool
  for stopped: Bool
  for pending: Nat
  for seq: Nat
  {R.aliveOf(R.onGarbage(alive, stopped, pending, seq)) == alive : Bool}

law rpc_step_garbage:
  for alive: Bool
  for stopped: Bool
  for pending: Nat
  for seq: Nat
  {R.step(alive, stopped, pending, seq, R.EvGarbage{})
    == R.onGarbage(alive, stopped, pending, seq) : R.RpcOut}

# Despacho: step é a tabela dos on*.
law rpc_step_timeout:
  for known: Bool
  for alive: Bool
  for stopped: Bool
  for pending: Nat
  for seq: Nat
  {R.step(alive, stopped, pending, seq, R.EvTimeout{known})
    == R.onTimeout(known, alive, stopped, pending, seq) : R.RpcOut}

law rpc_step_stop:
  for alive: Bool
  for stopped: Bool
  for pending: Nat
  for seq: Nat
  {R.step(alive, stopped, pending, seq, R.EvStop{})
    == R.onStop(alive, pending, seq) : R.RpcOut}

law rpc_step_error:
  for flag: Bool
  for alive: Bool
  for stopped: Bool
  for pending: Nat
  for seq: Nat
  {R.step(alive, stopped, pending, seq, R.EvError{flag})
    == R.onError(flag, alive, stopped, pending, seq) : R.RpcOut}

law rpc_boot:
  {R.boot() == R.RpcOut{False{}, False{}, 0n, 0n, R.ActNone{}, False{}} : R.RpcOut}

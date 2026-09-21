import Base

# ---------------------------------------------------------------------------
# Máquina de estados da ponte RPC com o Pi.
#
# Framing das linhas JSON-RPC: `framing.bend` (não repetir). O host mantém o
# processo filho, stdin/stdout, timers, o Map de promessas e o EventEmitter.
# O núcleo decide só o que fazer com cada evento e o estado resultante.
#
# Fatos (o host compara; o núcleo só vê Bool / Nat):
#   alive     — this.child != null
#   stopped   — this.stopped
#   pending   — this.pending.size
#   seq       — this.seq (nunca reusa id: só cresce no enqueue)
#   hasPi     — Boolean(this.pi)
#   known     — this.pending.has(id)
#   isCurrent — this.child === child (listener desta geração)
#   success   — e.success na linha `response`
#
# Ações (o host executa):
#   ActNone     — ignorar
#   ActSpawn    — spawn; stopped vira false; alive vira true
#   ActFail     — sem pi: zerar pendentes, emitir erro (start já reabriu)
#   ActEnqueue  — seq+1, pending+1, escrever pedido, armar timer
#   ActReject   — rejeitar ESTE pedido (não há filho depois do start)
#   ActResolve  — resolver o id conhecido (success)
#   ActRefuse   — rejeitar o id conhecido (response sem sucesso)
#   ActKill     — matar filho, falhar TODOS os pendentes, emitir se !stopped
#   ActExit     — filho já morreu: falhar todos, emitir se !stopped (sem kill)
#   ActStop     — stopped=true, matar, falhar todos, NÃO emitir
#   ActWrite    — escrever extension_ui_response
#
# Overflow do framing e erro de write no stdin caem em ActKill; o timeout de um
# pedido recusa só ele (ActRefuse) e a ponte segue viva — quem detecta um Pi
# morto depois é o health. Helpers primeiro: Bend não tem referência para frente.
# ---------------------------------------------------------------------------

type RpcAct is Data:
  ActNone{}
  ActSpawn{}
  ActFail{}
  ActEnqueue{}
  ActReject{}
  ActResolve{}
  ActRefuse{}
  ActKill{}
  ActExit{}
  ActStop{}
  ActWrite{}

type RpcEvt is Data:
  EvStart{hasPi: Bool}
  EvRequest{}
  EvReply{known: Bool, success: Bool}
  EvTimeout{known: Bool}
  EvError{isCurrent: Bool}
  EvExit{isCurrent: Bool}
  EvStop{}
  EvRespond{}

type RpcOut is Data:
  RpcOut{
    alive: Bool,
    stopped: Bool,
    pending: Nat,
    seq: Nat,
    act: RpcAct,
    emit: Bool
  }

# ---------- peças ----------

def emitUnless(stopped: Bool) -> Bool:
  match stopped:
    case True{}:
      False{}
    case False{}:
      True{}

def keep(alive: Bool, stopped: Bool, pending: Nat, seq: Nat) -> RpcOut:
  RpcOut{alive, stopped, pending, seq, ActNone{}, False{}}

def downKill(+stopped: Bool, seq: Nat) -> RpcOut:
  RpcOut{False{}, stopped, 0n, seq, ActKill{}, emitUnless(stopped)}

def downExit(+stopped: Bool, seq: Nat) -> RpcOut:
  RpcOut{False{}, stopped, 0n, seq, ActExit{}, emitUnless(stopped)}

def downStop(seq: Nat) -> RpcOut:
  RpcOut{False{}, True{}, 0n, seq, ActStop{}, False{}}

def pred(n: Nat) -> Nat:
  match n:
    case 0n:
      0n
    case 1n+p:
      p

def settle(success: Bool) -> RpcAct:
  match success:
    case True{}:
      ActResolve{}
    case False{}:
      ActRefuse{}

# ---------- start ----------

def onStart.pi(pending: Nat, seq: Nat) -> RpcOut:
  RpcOut{True{}, False{}, pending, seq, ActSpawn{}, False{}}

def onStart.noPi(seq: Nat) -> RpcOut:
  RpcOut{False{}, False{}, 0n, seq, ActFail{}, True{}}

def onStart.fresh(hasPi: Bool, pending: Nat, seq: Nat) -> RpcOut:
  match hasPi:
    case True{}:
      onStart.pi(pending, seq)
    case False{}:
      onStart.noPi(seq)

# Ponte já viva: não duplica (nem reseta stopped).
def onStart(alive: Bool, hasPi: Bool, stopped: Bool, pending: Nat, seq: Nat) -> RpcOut:
  match alive:
    case True{}:
      keep(True{}, stopped, pending, seq)
    case False{}:
      onStart.fresh(hasPi, pending, seq)

# ---------- request / reply / respond ----------

def onRequest(alive: Bool, stopped: Bool, pending: Nat, seq: Nat) -> RpcOut:
  match alive:
    case False{}:
      RpcOut{False{}, stopped, pending, seq, ActReject{}, False{}}
    case True{}:
      RpcOut{True{}, stopped, Nat.add(pending, 1n), Nat.add(seq, 1n), ActEnqueue{}, False{}}

def onReply.known(alive: Bool, stopped: Bool, pending: Nat, seq: Nat, success: Bool) -> RpcOut:
  RpcOut{alive, stopped, pred(pending), seq, settle(success), False{}}

def onReply(known: Bool, alive: Bool, stopped: Bool, pending: Nat, seq: Nat, success: Bool) -> RpcOut:
  match known:
    case False{}:
      keep(alive, stopped, pending, seq)
    case True{}:
      onReply.known(alive, stopped, pending, seq, success)

def onRespond(alive: Bool, stopped: Bool, pending: Nat, seq: Nat) -> RpcOut:
  match alive:
    case False{}:
      keep(False{}, stopped, pending, seq)
    case True{}:
      RpcOut{True{}, stopped, pending, seq, ActWrite{}, False{}}

# ---------- derrubar: timeout, erro de stdin/filho, exit, stop ----------

# Timeout e erro do stdin/filho NÃO são o mesmo golpe: o erro derruba (o
# processo quebrou de verdade); o timeout recusa só o pedido e mantém a ponte.
def onBreak(should: Bool, alive: Bool, stopped: Bool, pending: Nat, seq: Nat) -> RpcOut:
  match should:
    case False{}:
      keep(alive, stopped, pending, seq)
    case True{}:
      downKill(stopped, seq)

def onTimeout(known: Bool, alive: Bool, stopped: Bool, pending: Nat, seq: Nat) -> RpcOut:
  match known:
    case False{}:
      keep(alive, stopped, pending, seq)
    case True{}:
      RpcOut{alive, stopped, pred(pending), seq, ActRefuse{}, False{}}

def onError(isCurrent: Bool, alive: Bool, stopped: Bool, pending: Nat, seq: Nat) -> RpcOut:
  onBreak(isCurrent, alive, stopped, pending, seq)

def onExit(isCurrent: Bool, alive: Bool, stopped: Bool, pending: Nat, seq: Nat) -> RpcOut:
  match isCurrent:
    case False{}:
      keep(alive, stopped, pending, seq)
    case True{}:
      downExit(stopped, seq)

def onStop(alive: Bool, pending: Nat, seq: Nat) -> RpcOut:
  downStop(seq)

# ---------- despacho ----------

def step(alive: Bool, stopped: Bool, pending: Nat, seq: Nat, e: RpcEvt) -> RpcOut:
  match e:
    case EvStart{hasPi}:
      onStart(alive, hasPi, stopped, pending, seq)
    case EvRequest{}:
      onRequest(alive, stopped, pending, seq)
    case EvReply{known, success}:
      onReply(known, alive, stopped, pending, seq, success)
    case EvTimeout{known}:
      onTimeout(known, alive, stopped, pending, seq)
    case EvError{isCurrent}:
      onError(isCurrent, alive, stopped, pending, seq)
    case EvExit{isCurrent}:
      onExit(isCurrent, alive, stopped, pending, seq)
    case EvStop{}:
      onStop(alive, pending, seq)
    case EvRespond{}:
      onRespond(alive, stopped, pending, seq)

# ---------- projeções (leis falam do campo, não casam no RpcOut computado) ----------

def aliveOf(o: RpcOut) -> Bool:
  match o:
    case RpcOut{alive, _, _, _, _, _}:
      alive

def stoppedOf(o: RpcOut) -> Bool:
  match o:
    case RpcOut{_, stopped, _, _, _, _}:
      stopped

def pendingOf(o: RpcOut) -> Nat:
  match o:
    case RpcOut{_, _, pending, _, _, _}:
      pending

def seqOf(o: RpcOut) -> Nat:
  match o:
    case RpcOut{_, _, _, seq, _, _}:
      seq

def actOf(o: RpcOut) -> RpcAct:
  match o:
    case RpcOut{_, _, _, _, act, _}:
      act

def emitOf(o: RpcOut) -> Bool:
  match o:
    case RpcOut{_, _, _, _, _, emit}:
      emit

def boot() -> RpcOut:
  RpcOut{False{}, False{}, 0n, 0n, ActNone{}, False{}}

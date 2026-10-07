import Base

# ---------------------------------------------------------------------------
# Regras do chat lateral (segundo chat da Mesa).
#
# O host mede os fatos (I/O, ids, relógio) e o núcleo decide o que nunca pode
# variar entre host, testes e futuro:
#
#   1. ESCOPO: um chat lateral pertence a UMA conversa principal e a UMA
#      matéria; id de outra conversa nunca é atendido (os arquivos antigos
#      continuam preservados no disco — recusar o IPC não apaga nada).
#   2. EVENTO: só o canal ativo daquela conversa entrega evento; canal antigo
#      (troca de sessão/matéria ou recriação) é descartado.
#   3. RECUPERAÇÃO: envio marcado como iniciado (`Transmitting`) que não teve
#      desfecho persistido vira `Uncertain` na recuperação — a mensagem pode ter
#      chegado e reenviar sozinho duplicaria contexto.
#   4. REENVIO AUTOMÁTICO: nunca, em nenhum estado. Só um envio explícito novo
#      sai da fila/incerteza.
#   5. PROMPT: só sem envio em voo e (quando o motor exige um turno por vez, como
#      o Claude) sem turno em andamento.
#   6. CONTEXTO: o bloco do chat principal só é reenviado quando a chave mudou
#      (abertura/atualização explícita/recuperação) — contexto igual já está no
#      histórico do canal.
#
# Os estados de entrega espelham `agentdelivery.bend`; aqui o escopo é o canal
# lateral persistido, não a fila do chat principal.
# ---------------------------------------------------------------------------

type SidechatStatus is Data:
  SidechatStatus.Idle{}
  SidechatStatus.Transmitting{}
  SidechatStatus.Accepted{}
  SidechatStatus.Settled{}
  SidechatStatus.Refused{}
  SidechatStatus.Uncertain{}

# Um fato de escopo: mesma conversa principal E mesma matéria.
def scoped(
  descriptorSession: String,
  currentSession: String,
  descriptorCourse: String,
  currentCourse: String
) -> Bool:
  Bool.and(
    String.eq(descriptorSession, currentSession),
    String.eq(descriptorCourse, currentCourse)
  )

# O id do evento tem de ser o do canal ativo agora; qualquer outro é passado.
def eventAllowed(eventId: String, activeId: String) -> Bool:
  String.eq(eventId, activeId)

# Recuperação: o que estava em voo sem desfecho vira incerto; todo o resto fica
# como está (aceito não regride, recusa continua recusável, incerto é pegajoso).
def recoversTo(status: SidechatStatus) -> SidechatStatus:
  match status:
    case SidechatStatus.Idle{}:
      SidechatStatus.Idle{}
    case SidechatStatus.Transmitting{}:
      SidechatStatus.Uncertain{}
    case SidechatStatus.Accepted{}:
      SidechatStatus.Accepted{}
    case SidechatStatus.Settled{}:
      SidechatStatus.Settled{}
    case SidechatStatus.Refused{}:
      SidechatStatus.Refused{}
    case SidechatStatus.Uncertain{}:
      SidechatStatus.Uncertain{}

# Reenviar automaticamente: nunca. A assinatura existe para a lei; o host não
# tem caminho de reenvio automático.
def autoResend(status: SidechatStatus) -> Bool:
  match status:
    case SidechatStatus.Idle{}:
      False{}
    case SidechatStatus.Transmitting{}:
      False{}
    case SidechatStatus.Accepted{}:
      False{}
    case SidechatStatus.Settled{}:
      False{}
    case SidechatStatus.Refused{}:
      False{}
    case SidechatStatus.Uncertain{}:
      False{}

# Começar um envio novo: sem envio em voo nem turno em andamento.
# O chat lateral não enfileira follow-ups; busy é o fato medido pelo motor.
def canPrompt(busy: Bool, deliveryInFlight: Bool) -> Bool:
  Bool.and(Bool.not(busy), Bool.not(deliveryInFlight))

# O bloco de contexto vai quando a chave entregue difere da chave atual.
def contextChanged(deliveredKey: String, currentKey: String) -> Bool:
  Bool.not(String.eq(deliveredKey, currentKey))

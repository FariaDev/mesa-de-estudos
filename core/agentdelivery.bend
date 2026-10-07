import Base

# ---------------------------------------------------------------------------
# Entrega de mensagem do motor: aceite, recusa e incerteza — e quando a fila
# pode andar. O host entrega os fatos; o núcleo decide o estado.
#
# Escopo: o núcleo NÃO observa I/O e não prova transporte. `outcome` recebe o
# veredito já medido pelo host:
#   - `accepted`: aceite comprovado (evidência nativa de init/aceite);
#   - `mayHaveSent`: a escrita/transmissão pode ter chegado sem confirmação.
# Fim de texto, `message_end` e mensagem renderizada NÃO são aceite — render é
# exibição, não liquidação. Sem dedupe nativo prometido pela porta, uma
# entrega incerta nunca é reenviada sozinha e segura a fila até conferência.
#
# `mayRetry` só em recusa comprovada; `mayAdvanceQueue` exige tudo livre
# (sem execução, permissão pendente, incerteza ou cancelamento); `canBegin`
# exige ocioso e sem incerteza. O host aplica; a decisão é a mesma nos dois.
# ---------------------------------------------------------------------------

# Veredito da entrega. `Accepted` domina `mayHaveSent` (aceite comprovado não
# vira incerto); sem aceite, `mayHaveSent` distingue incerto de recusa.
type DeliveryOutcome is Data:
  DeliveryOutcome.Accepted{}
  DeliveryOutcome.Refused{}
  DeliveryOutcome.Uncertain{}

def outcome(accepted: Bool, mayHaveSent: Bool) -> DeliveryOutcome:
  match accepted:
    case True{}:
      DeliveryOutcome.Accepted{}
    case False{}:
      match mayHaveSent:
        case True{}:
          DeliveryOutcome.Uncertain{}
        case False{}:
          DeliveryOutcome.Refused{}

# Reenviar: só a recusa comprovada. Incerto segura para conferência; aceito
# não se repete.
def mayRetry(state: DeliveryOutcome) -> Bool:
  match state:
    case DeliveryOutcome.Refused{}:
      True{}
    case DeliveryOutcome.Accepted{}:
      False{}
    case DeliveryOutcome.Uncertain{}:
      False{}

# A fila avança só com tudo livre: sem execução, sem permissão pendente, sem
# entrega incerta e sem cancelamento em confirmação.
def mayAdvanceQueue(
  busy: Bool, permissionPending: Bool, uncertain: Bool, cancelled: Bool
) -> Bool:
  Bool.and(
    Bool.not(busy),
    Bool.and(
      Bool.not(permissionPending),
      Bool.and(Bool.not(uncertain), Bool.not(cancelled))
    )
  )

# Começar um envio novo (independente da fila): ocioso e sem incerteza.
def canBegin(busy: Bool, uncertain: Bool) -> Bool:
  Bool.and(Bool.not(busy), Bool.not(uncertain))

# Um patch de entrega não pode redirecionar uma conversa a outra sessão nativa.
# Forma UUID e I/O ficam no host; igualdade da identidade fica no núcleo.
def sameNativeIdentity(existing: String, requested: String) -> Bool:
  String.eq(existing, requested)

# Um controle não pode mudar configuração enquanto envio, turno, diálogo ou
# entrega incerta ainda pertencem à configuração atual.
def canChangeControls(busy: Bool, hasTurn: Bool, permissionPending: Bool, uncertain: Bool) -> Bool:
  Bool.and(canBegin(busy, uncertain), Bool.and(Bool.not(hasTurn), Bool.not(permissionPending)))

import Base

# ---------------------------------------------------------------------------
# Cartões `quiz` e `perguntar` da Mesa (#92): o estado que NÃO pode quebrar.
#
# A ferramenta mostra o cartão e volta NA HORA; o aluno responde no ritmo dele
# e a Mesa envia o resultado ao tutor numa mensagem nova. Duas garantias são de
# domínio e moram aqui:
#
#   - a resposta certa (e a explicação, que a revela) só aparece DEPOIS da
#     resposta do aluno (`revealAllowed`);
#   - o resultado é enviado NO MÁXIMO uma vez: `concludeCard` reserva o envio
#     (`Sending`); `confirmSend` fecha; `abortSend` só volta para `NotSent`
#     quando o host PROVOU que nada saiu; reserva ou envio confirmado nunca
#     reabrem (`Already`).
#
# O host guarda o cartão, mede o acerto e faz o I/O; aqui ficam só as decisões.
# ---------------------------------------------------------------------------

type SendState is Data:
  SendState.NotSent{}
  SendState.Sending{}
  SendState.Sent{}

type Card is Data:
  Card{
    answered: Bool,
    correct: Bool,
    dismissed: Bool,
    send: SendState,
    choice: String
  }

type ConcludeResult is Data:
  Conclude.Start{card: Card}
  Conclude.NeedsAnswer{}
  Conclude.Dismissed{}
  Conclude.Already{}

def newCard() -> Card:
  Card{False{}, False{}, False{}, SendState.NotSent{}, ""}

# ---------- leitura ----------

def sendIsSent(send: SendState) -> Bool:
  match send:
    case SendState.Sent{}:
      True{}
    case SendState.Sending{}:
      True{}
    case SendState.NotSent{}:
      False{}

def revealAllowed(card: Card) -> Bool:
  match card:
    case Card{answered, _, _, _, _}:
      answered

def isSent(card: Card) -> Bool:
  match card:
    case Card{_, _, _, send, _}:
      sendIsSent(send)

def sendNameOf(send: SendState) -> String:
  match send:
    case SendState.NotSent{}:
      "notSent"
    case SendState.Sending{}:
      "sending"
    case SendState.Sent{}:
      "sent"

def sendName(card: Card) -> String:
  match card:
    case Card{_, _, _, send, _}:
      sendNameOf(send)

# ---------- resposta ----------

def answerBySend(
  send: SendState, answered: Bool, correctOld: Bool, dismissed: Bool, choiceOld: String,
  +choice: String, +correct: Bool
) -> Card:
  match send:
    case SendState.Sent{}:
      Card{answered, correctOld, dismissed, SendState.Sent{}, choiceOld}
    case SendState.Sending{}:
      Card{answered, correctOld, dismissed, SendState.Sending{}, choiceOld}
    case SendState.NotSent{}:
      match answered:
        case True{}:
          Card{True{}, correctOld, dismissed, SendState.NotSent{}, choiceOld}
        case False{}:
          Card{True{}, correct, dismissed, SendState.NotSent{}, choice}

# Responder uma vez. Cartão já reservado/enviado não muda mais: a resposta vira
# prova do que o tutor recebeu.
def answerCard(card: Card, +choice: String, +correct: Bool) -> Card:
  match card:
    case Card{answered, correctOld, dismissed, send, choiceOld}:
      answerBySend(send, answered, correctOld, dismissed, choiceOld, choice, correct)

# ---------- envio ----------

def concludeIfFree(
  correct: Bool, choice: String, dismissed: Bool, answered: Bool
) -> ConcludeResult:
  match dismissed:
    case True{}:
      Conclude.Dismissed{}
    case False{}:
      match answered:
        case False{}:
          Conclude.NeedsAnswer{}
        case True{}:
          Conclude.Start{Card{True{}, correct, False{}, SendState.Sending{}, choice}}

def concludeBySend(
  send: SendState, correct: Bool, choice: String, dismissed: Bool, answered: Bool
) -> ConcludeResult:
  match send:
    case SendState.Sent{}:
      Conclude.Already{}
    case SendState.Sending{}:
      Conclude.Already{}
    case SendState.NotSent{}:
      concludeIfFree(correct, choice, dismissed, answered)

def concludeCard(card: Card) -> ConcludeResult:
  match card:
    case Card{answered, correct, dismissed, send, choice}:
      concludeBySend(send, correct, choice, dismissed, answered)

def confirmBySend(send: SendState, answered: Bool, correct: Bool, dismissed: Bool, choice: String) -> Card:
  match send:
    case SendState.Sending{}:
      Card{answered, correct, dismissed, SendState.Sent{}, choice}
    case SendState.Sent{}:
      Card{answered, correct, dismissed, SendState.Sent{}, choice}
    case SendState.NotSent{}:
      Card{answered, correct, dismissed, SendState.NotSent{}, choice}

def confirmSend(card: Card) -> Card:
  match card:
    case Card{answered, correct, dismissed, send, choice}:
      confirmBySend(send, answered, correct, dismissed, choice)

def abortIfProven(answered: Bool, correct: Bool, dismissed: Bool, choice: String, provenNotSent: Bool) -> Card:
  match provenNotSent:
    case True{}:
      Card{answered, correct, dismissed, SendState.NotSent{}, choice}
    case False{}:
      Card{answered, correct, dismissed, SendState.Sending{}, choice}

def abortBySend(
  send: SendState, answered: Bool, correct: Bool, dismissed: Bool, choice: String, provenNotSent: Bool
) -> Card:
  match send:
    case SendState.Sending{}:
      abortIfProven(answered, correct, dismissed, choice, provenNotSent)
    case SendState.Sent{}:
      Card{answered, correct, dismissed, SendState.Sent{}, choice}
    case SendState.NotSent{}:
      Card{answered, correct, dismissed, SendState.NotSent{}, choice}

# Recusa comprovada (nada saiu) devolve a reserva; incerteza mantém `Sending`
# (nunca reenvia sozinho).
def abortSend(card: Card, provenNotSent: Bool) -> Card:
  match card:
    case Card{answered, correct, dismissed, send, choice}:
      abortBySend(send, answered, correct, dismissed, choice, provenNotSent)

# ---------- dispensar ----------

def dismissCard(card: Card) -> Card:
  match card:
    case Card{answered, correct, dismissed, send, choice}:
      Card{answered, correct, True{}, send, choice}

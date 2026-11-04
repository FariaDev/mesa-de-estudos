import Base
import ../quizcard.bend as Q

# ---------------------------------------------------------------------------
# Contrato dos cartões `quiz` e `perguntar` (#92). Prefixo `qc_`.
#
# As leis fixam os dois invariantes de domínio:
#   1. a resposta certa e a explicação só aparecem depois da resposta
#      (`revealAllowed`);
#   2. o resultado é enviado no máximo uma vez: `concludeCard` reserva, o
#      envio confirmado fecha e a reserva/confirmação nunca reabrem. `abortSend`
#      só volta a `NotSent` com recusa comprovada.
#
# O que não cabe aqui: leitura/escrita do cartão em disco, cálculo do acerto a
# partir das opções, texto do resultado e a interface.
# ---------------------------------------------------------------------------

def open() -> Q.Card:
  Q.newCard()

def answered() -> Q.Card:
  Q.answerCard(Q.newCard(), "b", True{})

def wrong() -> Q.Card:
  Q.answerCard(Q.newCard(), "a", False{})

def startedOf(r: Q.ConcludeResult) -> Q.Card:
  match r:
    case Q.Conclude.Start{+card}:
      card
    case _:
      Q.newCard()

def started() -> Q.Card:
  startedOf(Q.concludeCard(answered()))

def sent() -> Q.Card:
  Q.confirmSend(started())

def resultName(r: Q.ConcludeResult) -> String:
  match r:
    case Q.Conclude.Start{_}:
      "start"
    case Q.Conclude.NeedsAnswer{}:
      "needs"
    case Q.Conclude.Dismissed{}:
      "dismissed"
    case Q.Conclude.Already{}:
      "already"

# ---------- resposta certa escondida ----------

law qc_open_hides:
  {Q.revealAllowed(open()) == False{} : Bool}

law qc_answered_reveals:
  {Q.revealAllowed(answered()) == True{} : Bool}

law qc_wrong_also_reveals:
  {Q.revealAllowed(wrong()) == True{} : Bool}

def choiceOf(card: Q.Card) -> String:
  match card:
    case Q.Card{_, _, _, _, +choice}:
      choice

def correctOf(card: Q.Card) -> Bool:
  match card:
    case Q.Card{_, +correct, _, _, _}:
      correct

law qc_answer_keeps_choice:
  {choiceOf(Q.answerCard(open(), "x", False{})) == "x" : String}

# ---------- envio no máximo uma vez ----------

law qc_conclude_open_needs_answer:
  {resultName(Q.concludeCard(open())) == "needs" : String}

law qc_conclude_answered_starts:
  {resultName(Q.concludeCard(answered())) == "start" : String}

law qc_start_is_sending:
  {Q.sendName(started()) == "sending" : String}

law qc_conclude_sending_already:
  {resultName(Q.concludeCard(started())) == "already" : String}

law qc_confirm_sends:
  {Q.sendName(Q.confirmSend(started())) == "sent" : String}

law qc_conclude_sent_already:
  {resultName(Q.concludeCard(sent())) == "already" : String}

law qc_confirm_sent_keeps:
  {Q.sendName(Q.confirmSend(sent())) == "sent" : String}

law qc_abort_proven_returns:
  {Q.sendName(Q.abortSend(started(), True{})) == "notSent" : String}

law qc_abort_unproven_keeps:
  {Q.sendName(Q.abortSend(started(), False{})) == "sending" : String}

law qc_abort_sent_keeps:
  {Q.sendName(Q.abortSend(sent(), True{})) == "sent" : String}

law qc_confirm_after_abort_keeps:
  {Q.sendName(Q.confirmSend(Q.abortSend(started(), True{}))) == "notSent" : String}

# ---------- dispensar e resposta travada ----------

law qc_dismiss_blocks_result:
  {resultName(Q.concludeCard(Q.dismissCard(answered()))) == "dismissed" : String}

law qc_dismiss_sent_keeps_send:
  {Q.sendName(Q.dismissCard(sent())) == "sent" : String}

law qc_answer_after_sent_keeps:
  {choiceOf(Q.answerCard(sent(), "a", False{})) == "b" : String}

law qc_answered_stays_correct:
  {correctOf(Q.answerCard(answered(), "a", False{})) == True{} : Bool}

// GERADO de core/quizcard.bend por `bun core/build.mjs` — não editar à mão.
// core/quizcard.bend
function str_out(s) {
  return s.replace(/\uDC00[^]{3}/gu, "�");
}
function str_in(s) {
  return s.replace(/\p{Cs}/gu, "�");
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
var io_file_append = new Set;
function $newCard() {
  return { $: "Card", answered: false, correct: false, dismissed: false, send: { $: "SendState.NotSent" }, choice: "" };
}
function $sendIsSent(_send_0) {
  if (_send_0.$ === "SendState.Sent") {
    return true;
  } else if (_send_0.$ === "SendState.Sending") {
    return true;
  } else {
    return false;
  }
}
function $revealAllowed(_card_0) {
  const _answered_0 = _card_0["answered"];
  return _answered_0;
}
function $isSent(_card_0) {
  const _send_0 = _card_0["send"];
  return $sendIsSent(_send_0);
}
function $sendNameOf(_send_0) {
  if (_send_0.$ === "SendState.NotSent") {
    return "notSent";
  } else if (_send_0.$ === "SendState.Sending") {
    return "sending";
  } else {
    return "sent";
  }
}
function $sendName(_card_0) {
  const _send_0 = _card_0["send"];
  return $sendNameOf(_send_0);
}
function $answerBySend(_send_0, _answered_0, _correctOld_0, _dismissed_0, _choiceOld_0, _choice_0, _correct_0) {
  if (_send_0.$ === "SendState.Sent") {
    return { $: "Card", answered: _answered_0, correct: _correctOld_0, dismissed: _dismissed_0, send: { $: "SendState.Sent" }, choice: _choiceOld_0 };
  } else if (_send_0.$ === "SendState.Sending") {
    return { $: "Card", answered: _answered_0, correct: _correctOld_0, dismissed: _dismissed_0, send: { $: "SendState.Sending" }, choice: _choiceOld_0 };
  } else {
    if (_answered_0) {
      return { $: "Card", answered: true, correct: _correctOld_0, dismissed: _dismissed_0, send: { $: "SendState.NotSent" }, choice: _choiceOld_0 };
    } else {
      return { $: "Card", answered: true, correct: _correct_0, dismissed: _dismissed_0, send: { $: "SendState.NotSent" }, choice: _choice_0 };
    }
  }
}
function $answerCard(_card_0, _choice_0, _correct_0) {
  const _answered_0 = _card_0["answered"];
  const _correctOld_0 = _card_0["correct"];
  const _dismissed_0 = _card_0["dismissed"];
  const _send_0 = _card_0["send"];
  const _choiceOld_0 = _card_0["choice"];
  return $answerBySend(_send_0, _answered_0, _correctOld_0, _dismissed_0, _choiceOld_0, _choice_0, _correct_0);
}
function $concludeIfFree(_correct_0, _choice_0, _dismissed_0, _answered_0) {
  if (_dismissed_0) {
    return { $: "Conclude.Dismissed" };
  } else {
    if (!_answered_0) {
      return { $: "Conclude.NeedsAnswer" };
    } else {
      return { $: "Conclude.Start", card: { $: "Card", answered: true, correct: _correct_0, dismissed: false, send: { $: "SendState.Sending" }, choice: _choice_0 } };
    }
  }
}
function $concludeBySend(_send_0, _correct_0, _choice_0, _dismissed_0, _answered_0) {
  if (_send_0.$ === "SendState.Sent") {
    return { $: "Conclude.Already" };
  } else if (_send_0.$ === "SendState.Sending") {
    return { $: "Conclude.Already" };
  } else {
    return $concludeIfFree(_correct_0, _choice_0, _dismissed_0, _answered_0);
  }
}
function $concludeCard(_card_0) {
  const _answered_0 = _card_0["answered"];
  const _correct_0 = _card_0["correct"];
  const _dismissed_0 = _card_0["dismissed"];
  const _send_0 = _card_0["send"];
  const _choice_0 = _card_0["choice"];
  return $concludeBySend(_send_0, _correct_0, _choice_0, _dismissed_0, _answered_0);
}
function $confirmBySend(_send_0, _answered_0, _correct_0, _dismissed_0, _choice_0) {
  if (_send_0.$ === "SendState.Sending") {
    return { $: "Card", answered: _answered_0, correct: _correct_0, dismissed: _dismissed_0, send: { $: "SendState.Sent" }, choice: _choice_0 };
  } else if (_send_0.$ === "SendState.Sent") {
    return { $: "Card", answered: _answered_0, correct: _correct_0, dismissed: _dismissed_0, send: { $: "SendState.Sent" }, choice: _choice_0 };
  } else {
    return { $: "Card", answered: _answered_0, correct: _correct_0, dismissed: _dismissed_0, send: { $: "SendState.NotSent" }, choice: _choice_0 };
  }
}
function $confirmSend(_card_0) {
  const _answered_0 = _card_0["answered"];
  const _correct_0 = _card_0["correct"];
  const _dismissed_0 = _card_0["dismissed"];
  const _send_0 = _card_0["send"];
  const _choice_0 = _card_0["choice"];
  return $confirmBySend(_send_0, _answered_0, _correct_0, _dismissed_0, _choice_0);
}
function $abortIfProven(_answered_0, _correct_0, _dismissed_0, _choice_0, _provenNotSent_0) {
  if (_provenNotSent_0) {
    return { $: "Card", answered: _answered_0, correct: _correct_0, dismissed: _dismissed_0, send: { $: "SendState.NotSent" }, choice: _choice_0 };
  } else {
    return { $: "Card", answered: _answered_0, correct: _correct_0, dismissed: _dismissed_0, send: { $: "SendState.Sending" }, choice: _choice_0 };
  }
}
function $abortBySend(_send_0, _answered_0, _correct_0, _dismissed_0, _choice_0, _provenNotSent_0) {
  if (_send_0.$ === "SendState.Sending") {
    return $abortIfProven(_answered_0, _correct_0, _dismissed_0, _choice_0, _provenNotSent_0);
  } else if (_send_0.$ === "SendState.Sent") {
    return { $: "Card", answered: _answered_0, correct: _correct_0, dismissed: _dismissed_0, send: { $: "SendState.Sent" }, choice: _choice_0 };
  } else {
    return { $: "Card", answered: _answered_0, correct: _correct_0, dismissed: _dismissed_0, send: { $: "SendState.NotSent" }, choice: _choice_0 };
  }
}
function $abortSend(_card_0, _provenNotSent_0) {
  const _answered_0 = _card_0["answered"];
  const _correct_0 = _card_0["correct"];
  const _dismissed_0 = _card_0["dismissed"];
  const _send_0 = _card_0["send"];
  const _choice_0 = _card_0["choice"];
  return $abortBySend(_send_0, _answered_0, _correct_0, _dismissed_0, _choice_0, _provenNotSent_0);
}
function $dismissCard(_card_0) {
  const _answered_0 = _card_0["answered"];
  const _correct_0 = _card_0["correct"];
  const _send_0 = _card_0["send"];
  const _choice_0 = _card_0["choice"];
  return { $: "Card", answered: _answered_0, correct: _correct_0, dismissed: true, send: _send_0, choice: _choice_0 };
}
var quizcard_default = {
  newCard: run_lib(() => run_loop($newCard()), 0),
  sendIsSent: run_lib((a0) => run_loop($sendIsSent(a0)), 1),
  revealAllowed: run_lib((a0) => run_loop($revealAllowed(a0)), 1),
  isSent: run_lib((a0) => run_loop($isSent(a0)), 1),
  sendNameOf: run_lib((a0) => str_out(run_loop($sendNameOf(a0))), 1),
  sendName: run_lib((a0) => str_out(run_loop($sendName(a0))), 1),
  answerBySend: run_lib((a0, a1, a2, a3, a4, a5, a6) => run_loop($answerBySend(a0, a1, a2, a3, str_in(a4), str_in(a5), a6)), 7),
  answerCard: run_lib((a0, a1, a2) => run_loop($answerCard(a0, str_in(a1), a2)), 3),
  concludeIfFree: run_lib((a0, a1, a2, a3) => run_loop($concludeIfFree(a0, str_in(a1), a2, a3)), 4),
  concludeBySend: run_lib((a0, a1, a2, a3, a4) => run_loop($concludeBySend(a0, a1, str_in(a2), a3, a4)), 5),
  concludeCard: run_lib((a0) => run_loop($concludeCard(a0)), 1),
  confirmBySend: run_lib((a0, a1, a2, a3, a4) => run_loop($confirmBySend(a0, a1, a2, a3, str_in(a4))), 5),
  confirmSend: run_lib((a0) => run_loop($confirmSend(a0)), 1),
  abortIfProven: run_lib((a0, a1, a2, a3, a4) => run_loop($abortIfProven(a0, a1, a2, str_in(a3), a4)), 5),
  abortBySend: run_lib((a0, a1, a2, a3, a4, a5) => run_loop($abortBySend(a0, a1, a2, a3, str_in(a4), a5)), 6),
  abortSend: run_lib((a0, a1) => run_loop($abortSend(a0, a1)), 2),
  dismissCard: run_lib((a0) => run_loop($dismissCard(a0)), 1)
};
export {
  quizcard_default as default
};

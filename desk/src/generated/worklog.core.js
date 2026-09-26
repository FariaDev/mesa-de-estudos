// GERADO de core/worklog.bend por `bun core/build.mjs` — não editar à mão.
// core/worklog.bend
function nat_divmod(a, b) {
  return b === 0n ? { $: "Tuple", fst: 0n, snd: a } : { $: "Tuple", fst: a / b, snd: a % b };
}
function nat_chk(n) {
  if (n > 281474976710655n) {
    throw "bend: a Nat past the largest immediate 2^48-1";
  }
  return n;
}
function char_new(code) {
  if (code > 1114111 || code >= 55296 && code <= 57343) {
    throw "bend: " + code + " is not a Unicode scalar value";
  }
  return String.fromCodePoint(code);
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
function $emptyPayload$() {
  return { $: "Payload", ["text"]: "", ["toolName"]: "", ["argsJson"]: "", ["query"]: "", ["url"]: "", ["domain"]: "", ["pageTitle"]: "", ["hits"]: { $: "Nil" }, ["resultText"]: "", ["error"]: "" };
}
function $withText$(_p_0, _delta_0) {
  const _text_0 = _p_0["text"];
  const _toolName_0 = _p_0["toolName"];
  const _argsJson_0 = _p_0["argsJson"];
  const _query_0 = _p_0["query"];
  const _url_0 = _p_0["url"];
  const _domain_0 = _p_0["domain"];
  const _pageTitle_0 = _p_0["pageTitle"];
  const _hits_0 = _p_0["hits"];
  const _resultText_0 = _p_0["resultText"];
  const _error_0 = _p_0["error"];
  return { $: "Payload", ["text"]: _text_0 + _delta_0, ["toolName"]: _toolName_0, ["argsJson"]: _argsJson_0, ["query"]: _query_0, ["url"]: _url_0, ["domain"]: _domain_0, ["pageTitle"]: _pageTitle_0, ["hits"]: _hits_0, ["resultText"]: _resultText_0, ["error"]: _error_0 };
}
function $newThinking$(_id_0, _now_0, _delta_0) {
  return { $: "Step", ["id"]: _id_0, ["status"]: { $: "Status.Running" }, ["kind"]: { $: "Thinking" }, ["startedAt"]: _now_0, ["endedAt"]: 0n, ["payload"]: run_loop($withText$(run_loop($emptyPayload$()), _delta_0)) };
}
function $thinkId$(_n_0) {
  const _x_0 = run_loop($Nat$show$(nat_chk(_n_0 + 1n)));
  return "pensar-" + _x_0;
}
function $headHere$(_s_0, _needle_0) {
  if (_s_0 === "") {
    return false;
  } else {
    const _h_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(0, 2) : _s_0[0];
    const _t_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(2) : _s_0.slice(1);
    return run_jump($String$starts_with$, [_h_0 + _t_0, _needle_0]);
  }
}
function $hasNeedle$go$(_s_0, _here_0, _needle_0) {
  if (_s_0 === "") {
    return run_jump($String$is_empty$, [_needle_0]);
  } else {
    const _h_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(0, 2) : _s_0[0];
    const _t_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(2) : _s_0.slice(1);
    if (_here_0) {
      return true;
    } else {
      return run_jump($hasNeedle$go$, [_t_0, run_loop($headHere$(_t_0, _needle_0)), _needle_0]);
    }
  }
}
function $hasNeedle$(_s_0, _needle_0) {
  return run_jump($hasNeedle$go$, [_s_0, run_loop($headHere$(_s_0, _needle_0)), _needle_0]);
}
function $toLower$go$(_s_0, _acc_0) {
  if (_s_0 === "") {
    return run_jump($String$reverse$, [_acc_0]);
  } else {
    const _h_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(0, 2) : _s_0[0];
    const _t_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(2) : _s_0.slice(1);
    return run_jump($toLower$go$, [_t_0, run_loop($Char$to_lower$(_h_0)) + _acc_0]);
  }
}
function $toLower$(_s_0) {
  return run_jump($toLower$go$, [_s_0, ""]);
}
function $anyContains$go$(_n_0, _needles_0, _found_0) {
  if (_needles_0.$ === "Nil") {
    return _found_0;
  } else {
    const _h_0 = _needles_0["head"];
    const _t_0 = _needles_0["tail"];
    const _x_0 = run_loop($hasNeedle$(_n_0, _h_0));
    return run_jump($anyContains$go$, [_n_0, _t_0, _found_0 || _x_0]);
  }
}
function $anyContains$(_n_0, _needles_0) {
  return run_jump($anyContains$go$, [_n_0, _needles_0, false]);
}
function $toolKind$fetch$if$(_n_0, _fetch_0) {
  if (_fetch_0) {
    return { $: "Fetch" };
  } else {
    return { $: "Tool" };
  }
}
function $toolKind$fetch$(_n_0) {
  return run_jump($toolKind$fetch$if$, [_n_0, run_loop($anyContains$(_n_0, { $: "Con", ["head"]: "fetch", ["tail"]: { $: "Con", ["head"]: "reader", ["tail"]: { $: "Con", ["head"]: "http", ["tail"]: { $: "Con", ["head"]: "url", ["tail"]: { $: "Con", ["head"]: "page", ["tail"]: { $: "Nil" } } } } } }))]);
}
function $toolKind$search$if$(_n_0, _search_0) {
  if (_search_0) {
    return { $: "Search" };
  } else {
    return run_jump($toolKind$fetch$, [_n_0]);
  }
}
function $toolKind$search$(_n_0) {
  return run_jump($toolKind$search$if$, [_n_0, run_loop($anyContains$(_n_0, { $: "Con", ["head"]: "search", ["tail"]: { $: "Con", ["head"]: "busca", ["tail"]: { $: "Nil" } } }))]);
}
function $toolKind$ref$(_n_0, _ref_0) {
  if (_ref_0) {
    return { $: "Reference" };
  } else {
    return run_jump($toolKind$search$, [_n_0]);
  }
}
function $toolKind$(_name_0) {
  const _n_0 = run_loop($toLower$(_name_0));
  return run_jump($toolKind$ref$, [_n_0, run_loop($anyContains$(_n_0, { $: "Con", ["head"]: "reference", ["tail"]: { $: "Nil" } }))]);
}
function $createLog$(_now_0) {
  return { $: "Log", ["startedAt"]: _now_0, ["endedAt"]: 0n, ["reason"]: "", ["text"]: "", ["steps"]: { $: "Nil" } };
}
function $burst$last$(_h_0, _delta_0, _now_0, _n_0) {
  const _id_0 = _h_0["id"];
  const _t_0 = _h_0["status"];
  if (_t_0.$ === "Status.Running") {
    const _t_1 = _h_0["kind"];
    if (_t_1.$ === "Thinking") {
      const _startedAt_0 = _h_0["startedAt"];
      const _endedAt_0 = _h_0["endedAt"];
      const _payload_0 = _h_0["payload"];
      return { $: "Con", ["head"]: { $: "Step", ["id"]: _id_0, ["status"]: { $: "Status.Running" }, ["kind"]: { $: "Thinking" }, ["startedAt"]: _startedAt_0, ["endedAt"]: _endedAt_0, ["payload"]: run_loop($withText$(_payload_0, _delta_0)) }, ["tail"]: { $: "Nil" } };
    } else {
      const _startedAt_1 = _h_0["startedAt"];
      const _endedAt_1 = _h_0["endedAt"];
      const _payload_1 = _h_0["payload"];
      return { $: "Con", ["head"]: { $: "Step", ["id"]: _id_0, ["status"]: { $: "Status.Running" }, ["kind"]: _t_1, ["startedAt"]: _startedAt_1, ["endedAt"]: _endedAt_1, ["payload"]: _payload_1 }, ["tail"]: { $: "Con", ["head"]: run_loop($newThinking$(run_loop($thinkId$(_n_0)), _now_0, _delta_0)), ["tail"]: { $: "Nil" } } };
    }
  } else {
    const _kind_0 = _h_0["kind"];
    const _startedAt_2 = _h_0["startedAt"];
    const _endedAt_2 = _h_0["endedAt"];
    const _payload_2 = _h_0["payload"];
    return { $: "Con", ["head"]: { $: "Step", ["id"]: _id_0, ["status"]: _t_0, ["kind"]: _kind_0, ["startedAt"]: _startedAt_2, ["endedAt"]: _endedAt_2, ["payload"]: _payload_2 }, ["tail"]: { $: "Con", ["head"]: run_loop($newThinking$(run_loop($thinkId$(_n_0)), _now_0, _delta_0)), ["tail"]: { $: "Nil" } } };
  }
}
function $burst$(_xs_0, _delta_0, _now_0, _n_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Con", ["head"]: run_loop($newThinking$(run_loop($thinkId$(_n_0)), _now_0, _delta_0)), ["tail"]: { $: "Nil" } };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    if (_t_0.$ === "Nil") {
      return run_jump($burst$last$, [_h_0, _delta_0, _now_0, _n_0]);
    } else {
      const __0 = _t_0["head"];
      const __1 = _t_0["tail"];
      return { $: "Con", ["head"]: _h_0, ["tail"]: run_loop($burst$({ $: "Con", ["head"]: __0, ["tail"]: __1 }, _delta_0, _now_0, _n_0)) };
    }
  }
}
function $thinkingDelta$go$(_log_0, _delta_0, _now_0) {
  const _startedAt_0 = _log_0["startedAt"];
  const _endedAt_0 = _log_0["endedAt"];
  const _reason_0 = _log_0["reason"];
  const _text_0 = _log_0["text"];
  const _steps_0 = _log_0["steps"];
  const _n_0 = run_loop($List$length$(_steps_0));
  return { $: "Log", ["startedAt"]: _startedAt_0, ["endedAt"]: _endedAt_0, ["reason"]: _reason_0, ["text"]: _text_0, ["steps"]: run_loop($burst$(_steps_0, _delta_0, _now_0, _n_0)) };
}
function $thinkingDelta$if$(_log_0, _delta_0, _now_0, _empty_0) {
  if (_empty_0) {
    return _log_0;
  } else {
    return run_jump($thinkingDelta$go$, [_log_0, _delta_0, _now_0]);
  }
}
function $thinkingDelta$(_log_0, _delta_0, _now_0) {
  const _d_0 = _delta_0;
  return run_jump($thinkingDelta$if$, [_log_0, _d_0, _now_0, run_loop($String$is_empty$(_d_0))]);
}
function $closeStep$running$(_id_0, _kind_0, _startedAt_0, _endedAt_0, _payload_0, _now_0) {
  if (_kind_0.$ === "Thinking") {
    return { $: "Step", ["id"]: _id_0, ["status"]: { $: "Status.Done" }, ["kind"]: { $: "Thinking" }, ["startedAt"]: _startedAt_0, ["endedAt"]: _now_0, ["payload"]: _payload_0 };
  } else {
    return { $: "Step", ["id"]: _id_0, ["status"]: { $: "Status.Running" }, ["kind"]: _kind_0, ["startedAt"]: _startedAt_0, ["endedAt"]: _endedAt_0, ["payload"]: _payload_0 };
  }
}
function $closeStep$status$(_id_0, _status_0, _kind_0, _startedAt_0, _endedAt_0, _payload_0, _now_0) {
  if (_status_0.$ === "Status.Running") {
    return run_jump($closeStep$running$, [_id_0, _kind_0, _startedAt_0, _endedAt_0, _payload_0, _now_0]);
  } else {
    return { $: "Step", ["id"]: _id_0, ["status"]: _status_0, ["kind"]: _kind_0, ["startedAt"]: _startedAt_0, ["endedAt"]: _endedAt_0, ["payload"]: _payload_0 };
  }
}
function $closeStep$(_s_0, _now_0) {
  const _id_0 = _s_0["id"];
  const _status_0 = _s_0["status"];
  const _kind_0 = _s_0["kind"];
  const _startedAt_0 = _s_0["startedAt"];
  const _endedAt_0 = _s_0["endedAt"];
  const _payload_0 = _s_0["payload"];
  return run_jump($closeStep$status$, [_id_0, _status_0, _kind_0, _startedAt_0, _endedAt_0, _payload_0, _now_0]);
}
function $closeEach$(_xs_0, _now_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return { $: "Con", ["head"]: run_loop($closeStep$(_h_0, _now_0)), ["tail"]: run_loop($closeEach$(_t_0, _now_0)) };
  }
}
function $closeThinking$(_log_0, _now_0) {
  const _startedAt_0 = _log_0["startedAt"];
  const _endedAt_0 = _log_0["endedAt"];
  const _reason_0 = _log_0["reason"];
  const _text_0 = _log_0["text"];
  const _steps_0 = _log_0["steps"];
  return { $: "Log", ["startedAt"]: _startedAt_0, ["endedAt"]: _endedAt_0, ["reason"]: _reason_0, ["text"]: _text_0, ["steps"]: run_loop($closeEach$(_steps_0, _now_0)) };
}
function $finishStep$running$(_id_0, _kind_0, _startedAt_0, _endedAt_0, _payload_0, _now_0) {
  if (_kind_0.$ === "Thinking") {
    return { $: "Step", ["id"]: _id_0, ["status"]: { $: "Status.Done" }, ["kind"]: { $: "Thinking" }, ["startedAt"]: _startedAt_0, ["endedAt"]: _now_0, ["payload"]: _payload_0 };
  } else {
    return { $: "Step", ["id"]: _id_0, ["status"]: { $: "Status.Stopped" }, ["kind"]: _kind_0, ["startedAt"]: _startedAt_0, ["endedAt"]: _now_0, ["payload"]: _payload_0 };
  }
}
function $finishStep$status$(_id_0, _status_0, _kind_0, _startedAt_0, _endedAt_0, _payload_0, _now_0) {
  if (_status_0.$ === "Status.Running") {
    return run_jump($finishStep$running$, [_id_0, _kind_0, _startedAt_0, _endedAt_0, _payload_0, _now_0]);
  } else {
    return { $: "Step", ["id"]: _id_0, ["status"]: _status_0, ["kind"]: _kind_0, ["startedAt"]: _startedAt_0, ["endedAt"]: _endedAt_0, ["payload"]: _payload_0 };
  }
}
function $finishStep$(_s_0, _now_0) {
  const _id_0 = _s_0["id"];
  const _status_0 = _s_0["status"];
  const _kind_0 = _s_0["kind"];
  const _startedAt_0 = _s_0["startedAt"];
  const _endedAt_0 = _s_0["endedAt"];
  const _payload_0 = _s_0["payload"];
  return run_jump($finishStep$status$, [_id_0, _status_0, _kind_0, _startedAt_0, _endedAt_0, _payload_0, _now_0]);
}
function $finishEach$(_xs_0, _now_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return { $: "Con", ["head"]: run_loop($finishStep$(_h_0, _now_0)), ["tail"]: run_loop($finishEach$(_t_0, _now_0)) };
  }
}
function $finishLog$(_log_0, _now_0, _reason_0) {
  const _startedAt_0 = _log_0["startedAt"];
  const _endedAt_0 = _log_0["endedAt"];
  const __0 = _log_0["reason"];
  const _text_0 = _log_0["text"];
  const _steps_0 = _log_0["steps"];
  const _n_0 = _now_0;
  return { $: "Log", ["startedAt"]: _startedAt_0, ["endedAt"]: _n_0, ["reason"]: _reason_0, ["text"]: _text_0, ["steps"]: run_loop($finishEach$(_steps_0, _n_0)) };
}
function $isRunningThinking$kind$(_kind_0) {
  if (_kind_0.$ === "Thinking") {
    return true;
  } else {
    return false;
  }
}
function $isRunningThinking$check$(_kind_0, _status_0) {
  if (_status_0.$ === "Status.Running") {
    return run_jump($isRunningThinking$kind$, [_kind_0]);
  } else {
    return false;
  }
}
function $isRunningThinking$(_s_0) {
  const _id_0 = _s_0["id"];
  const _status_0 = _s_0["status"];
  const _kind_0 = _s_0["kind"];
  const _startedAt_0 = _s_0["startedAt"];
  const _endedAt_0 = _s_0["endedAt"];
  const _payload_0 = _s_0["payload"];
  return run_jump($isRunningThinking$check$, [_kind_0, _status_0]);
}
function $isRunning$status$(_status_0) {
  if (_status_0.$ === "Status.Running") {
    return true;
  } else {
    return false;
  }
}
function $isRunning$(_s_0) {
  const _id_0 = _s_0["id"];
  const _status_0 = _s_0["status"];
  const _kind_0 = _s_0["kind"];
  const _startedAt_0 = _s_0["startedAt"];
  const _endedAt_0 = _s_0["endedAt"];
  const _payload_0 = _s_0["payload"];
  return run_jump($isRunning$status$, [_status_0]);
}
function $noRunningThinking$and$(_running_0, _rest_0) {
  if (_running_0) {
    return false;
  } else {
    return _rest_0;
  }
}
function $noRunningThinking$(_xs_0) {
  if (_xs_0.$ === "Nil") {
    return true;
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return run_jump($noRunningThinking$and$, [run_loop($isRunningThinking$(_h_0)), run_loop($noRunningThinking$(_t_0))]);
  }
}
function $Nat$show$(_n_0) {
  const _m_0 = _n_0;
  return run_jump($Nat$show$fin$, [_m_0, "", run_loop($Nat$show$put$(nat_divmod(_m_0, 10n)))]);
}
function $String$starts_with$(_s_0, _p_0) {
  if (_s_0 === "") {
    if (_p_0 === "") {
      return true;
    } else {
      const _h_0 = _p_0.codePointAt(0) > 65535 ? _p_0.slice(0, 2) : _p_0[0];
      const _t_0 = _p_0.codePointAt(0) > 65535 ? _p_0.slice(2) : _p_0.slice(1);
      return false;
    }
  } else {
    const _h_1 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(0, 2) : _s_0[0];
    const _t_1 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(2) : _s_0.slice(1);
    if (_p_0 === "") {
      return true;
    } else {
      const _y_0 = _p_0.codePointAt(0) > 65535 ? _p_0.slice(0, 2) : _p_0[0];
      const _yt_0 = _p_0.codePointAt(0) > 65535 ? _p_0.slice(2) : _p_0.slice(1);
      return run_jump($String$starts_with$if$, [_t_1, _yt_0, run_loop($Char$is_eq$(_h_1, _y_0))]);
    }
  }
}
function $String$is_empty$(_s_0) {
  if (_s_0 === "") {
    return true;
  } else {
    const _h_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(0, 2) : _s_0[0];
    const _t_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(2) : _s_0.slice(1);
    return false;
  }
}
function $String$reverse$(_s_0) {
  return run_jump($String$reverse$go$, [_s_0, ""]);
}
function $Char$to_lower$(_c_0) {
  const _x_0 = run_loop($Bool$to_u32$(run_loop($Char$is_upper$(_c_0))));
  const _x_1 = run_loop($Char$to_u32$(_c_0));
  const _x_2 = Math.imul(_x_0, 32) >>> 0;
  return char_new(_x_1 + _x_2 >>> 0);
}
function $List$length$(_xs_0) {
  if (_xs_0.$ === "Nil") {
    return 0n;
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return nat_chk(run_loop($List$length$(_t_0)) + 1n);
  }
}
function $Nat$show$fin$(_g_0, _acc_0, _dq_0) {
  const _d_0 = _dq_0["fst"];
  const _t_0 = _dq_0["snd"];
  if (_t_0 === 0n) {
    return _d_0 + _acc_0;
  } else {
    const _p_0 = _t_0 - 1n;
    return run_jump($Nat$show$go$, [_g_0, nat_chk(_p_0 + 1n), _d_0 + _acc_0]);
  }
}
function $Nat$show$put$(_qr_0) {
  const _q_0 = _qr_0["fst"];
  const _r_0 = _qr_0["snd"];
  const _x_0 = nat_chk(48n + _r_0);
  return { $: "Tuple", ["fst"]: char_new(Number(_x_0 & 0xFFFFFFFFn)), ["snd"]: _q_0 };
}
function $String$starts_with$if$(_t_0, _pt_0, _same_0) {
  if (!_same_0) {
    return false;
  } else {
    return run_jump($String$starts_with$, [_t_0, _pt_0]);
  }
}
function $Char$is_eq$(_a_0, _b_0) {
  const _x_0 = _a_0.codePointAt(0);
  const _y_0 = _b_0.codePointAt(0);
  return _x_0 === _y_0;
}
function $String$reverse$go$(_s_0, _acc_0) {
  if (_s_0 === "") {
    return _acc_0;
  } else {
    const _h_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(0, 2) : _s_0[0];
    const _t_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(2) : _s_0.slice(1);
    return run_jump($String$reverse$go$, [_t_0, _h_0 + _acc_0]);
  }
}
function $Char$to_u32$(_c_0) {
  const _x_0 = _c_0.codePointAt(0);
  return _x_0;
}
function $Bool$to_u32$(_b_0) {
  if (!_b_0) {
    return 0;
  } else {
    return 1;
  }
}
function $Char$is_upper$(_c_0) {
  const _x_0 = _c_0.codePointAt(0);
  return run_jump($Bool$and$, [_x_0 >= 65, _x_0 <= 90]);
}
function $Nat$show$go$(_f_0, _n_0, _acc_0) {
  if (_f_0 === 0n) {
    return _acc_0;
  } else {
    const _g_0 = _f_0 - 1n;
    return run_jump($Nat$show$fin$, [_g_0, _acc_0, run_loop($Nat$show$put$(nat_divmod(_n_0, 10n)))]);
  }
}
function $Bool$and$(_a_0, _b_0) {
  if (!_a_0) {
    return false;
  } else {
    return _b_0;
  }
}
var worklog_default = {
  emptyPayload: run_lib($emptyPayload$, 0),
  withText: run_lib($withText$, 2),
  newThinking: run_lib($newThinking$, 3),
  thinkId: run_lib($thinkId$, 1),
  headHere: run_lib($headHere$, 2),
  "hasNeedle.go": run_lib($hasNeedle$go$, 3),
  hasNeedle: run_lib($hasNeedle$, 2),
  "toLower.go": run_lib($toLower$go$, 2),
  toLower: run_lib($toLower$, 1),
  "anyContains.go": run_lib($anyContains$go$, 3),
  anyContains: run_lib($anyContains$, 2),
  "toolKind.fetch.if": run_lib($toolKind$fetch$if$, 2),
  "toolKind.fetch": run_lib($toolKind$fetch$, 1),
  "toolKind.search.if": run_lib($toolKind$search$if$, 2),
  "toolKind.search": run_lib($toolKind$search$, 1),
  "toolKind.ref": run_lib($toolKind$ref$, 2),
  toolKind: run_lib($toolKind$, 1),
  createLog: run_lib($createLog$, 1),
  "burst.last": run_lib($burst$last$, 4),
  burst: run_lib($burst$, 4),
  "thinkingDelta.go": run_lib($thinkingDelta$go$, 3),
  "thinkingDelta.if": run_lib($thinkingDelta$if$, 4),
  thinkingDelta: run_lib($thinkingDelta$, 3),
  "closeStep.running": run_lib($closeStep$running$, 6),
  "closeStep.status": run_lib($closeStep$status$, 7),
  closeStep: run_lib($closeStep$, 2),
  closeEach: run_lib($closeEach$, 2),
  closeThinking: run_lib($closeThinking$, 2),
  "finishStep.running": run_lib($finishStep$running$, 6),
  "finishStep.status": run_lib($finishStep$status$, 7),
  finishStep: run_lib($finishStep$, 2),
  finishEach: run_lib($finishEach$, 2),
  finishLog: run_lib($finishLog$, 3),
  "isRunningThinking.kind": run_lib($isRunningThinking$kind$, 1),
  "isRunningThinking.check": run_lib($isRunningThinking$check$, 2),
  isRunningThinking: run_lib($isRunningThinking$, 1),
  "isRunning.status": run_lib($isRunning$status$, 1),
  isRunning: run_lib($isRunning$, 1),
  "noRunningThinking.and": run_lib($noRunningThinking$and$, 2),
  noRunningThinking: run_lib($noRunningThinking$, 1)
};
export {
  worklog_default as default
};

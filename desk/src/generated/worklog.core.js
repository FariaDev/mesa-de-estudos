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
function $withText$(p_0, delta_0) {
  const text_0 = p_0.text;
  const toolName_0 = p_0.toolName;
  const argsJson_0 = p_0.argsJson;
  const query_0 = p_0.query;
  const url_0 = p_0.url;
  const domain_0 = p_0.domain;
  const pageTitle_0 = p_0.pageTitle;
  const hits_0 = p_0.hits;
  const resultText_0 = p_0.resultText;
  const error_0 = p_0.error;
  return { $: "Payload", ["text"]: text_0 + delta_0, ["toolName"]: toolName_0, ["argsJson"]: argsJson_0, ["query"]: query_0, ["url"]: url_0, ["domain"]: domain_0, ["pageTitle"]: pageTitle_0, ["hits"]: hits_0, ["resultText"]: resultText_0, ["error"]: error_0 };
}
function $newThinking$(id_0, now_0, delta_0) {
  return { $: "Step", ["id"]: id_0, ["status"]: { $: "Status.Running" }, ["kind"]: { $: "Thinking" }, ["startedAt"]: now_0, ["endedAt"]: 0n, ["payload"]: run_loop($withText$(run_loop($emptyPayload$()), delta_0)) };
}
function $thinkId$(n_0) {
  const x_0 = run_loop($Nat$show$(nat_chk(n_0 + 1n)));
  return "pensar-" + x_0;
}
function $headHere$(s_0, needle_0) {
  if (s_0 === "") {
    return false;
  } else {
    const h_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(0, 2) : s_0[0];
    const t_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(2) : s_0.slice(1);
    return run_jump($String$starts_with$, [h_0 + t_0, needle_0]);
  }
}
function $hasNeedle$go$(s_0, here_0, needle_0) {
  if (s_0 === "") {
    return run_jump($String$is_empty$, [needle_0]);
  } else {
    const h_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(0, 2) : s_0[0];
    const t_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(2) : s_0.slice(1);
    if (here_0) {
      return true;
    } else {
      const t_1 = t_0;
      return run_jump($hasNeedle$go$, [t_1, run_loop($headHere$(t_1, needle_0)), needle_0]);
    }
  }
}
function $hasNeedle$(s_0, needle_0) {
  return run_jump($hasNeedle$go$, [s_0, run_loop($headHere$(s_0, needle_0)), needle_0]);
}
function $toLower$go$(s_0, acc_0) {
  if (s_0 === "") {
    return run_jump($String$reverse$, [acc_0]);
  } else {
    const h_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(0, 2) : s_0[0];
    const t_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(2) : s_0.slice(1);
    return run_jump($toLower$go$, [t_0, run_loop($Char$to_lower$(h_0)) + acc_0]);
  }
}
function $toLower$(s_0) {
  return run_jump($toLower$go$, [s_0, ""]);
}
function $anyContains$go$(n_0, needles_0, found_0) {
  if (needles_0.$ === "Nil") {
    return found_0;
  } else {
    const h_0 = needles_0.head;
    const t_0 = needles_0.tail;
    const x_0 = run_loop($hasNeedle$(n_0, h_0));
    return run_jump($anyContains$go$, [n_0, t_0, found_0 || x_0]);
  }
}
function $anyContains$(n_0, needles_0) {
  return run_jump($anyContains$go$, [n_0, needles_0, false]);
}
function $toolKind$fetch$if$(n_0, fetch_0) {
  if (fetch_0) {
    return { $: "Fetch" };
  } else {
    return { $: "Tool" };
  }
}
function $toolKind$fetch$(n_0) {
  return run_jump($toolKind$fetch$if$, [n_0, run_loop($anyContains$(n_0, { $: "Con", ["head"]: "fetch", ["tail"]: { $: "Con", ["head"]: "reader", ["tail"]: { $: "Con", ["head"]: "http", ["tail"]: { $: "Con", ["head"]: "url", ["tail"]: { $: "Con", ["head"]: "page", ["tail"]: { $: "Nil" } } } } } }))]);
}
function $toolKind$search$if$(n_0, search_0) {
  if (search_0) {
    return { $: "Search" };
  } else {
    return run_jump($toolKind$fetch$, [n_0]);
  }
}
function $toolKind$search$(n_0) {
  return run_jump($toolKind$search$if$, [n_0, run_loop($anyContains$(n_0, { $: "Con", ["head"]: "search", ["tail"]: { $: "Con", ["head"]: "busca", ["tail"]: { $: "Nil" } } }))]);
}
function $toolKind$ref$(n_0, ref_0) {
  if (ref_0) {
    return { $: "Reference" };
  } else {
    return run_jump($toolKind$search$, [n_0]);
  }
}
function $toolKind$(name_0) {
  const n_0 = run_loop($toLower$(name_0));
  return run_jump($toolKind$ref$, [n_0, run_loop($anyContains$(n_0, { $: "Con", ["head"]: "reference", ["tail"]: { $: "Nil" } }))]);
}
function $createLog$(now_0) {
  return { $: "Log", ["startedAt"]: now_0, ["endedAt"]: 0n, ["reason"]: "", ["text"]: "", ["steps"]: { $: "Nil" } };
}
function $burst$last$(h_0, delta_0, now_0, n_0) {
  const id_0 = h_0.id;
  const _t_0 = h_0.status;
  if (_t_0.$ === "Status.Running") {
    const _t_1 = h_0.kind;
    if (_t_1.$ === "Thinking") {
      const startedAt_0 = h_0.startedAt;
      const endedAt_0 = h_0.endedAt;
      const payload_0 = h_0.payload;
      return { $: "Con", ["head"]: { $: "Step", ["id"]: id_0, ["status"]: { $: "Status.Running" }, ["kind"]: { $: "Thinking" }, ["startedAt"]: startedAt_0, ["endedAt"]: endedAt_0, ["payload"]: run_loop($withText$(payload_0, delta_0)) }, ["tail"]: { $: "Nil" } };
    } else {
      const startedAt_1 = h_0.startedAt;
      const endedAt_1 = h_0.endedAt;
      const payload_1 = h_0.payload;
      return { $: "Con", ["head"]: { $: "Step", ["id"]: id_0, ["status"]: { $: "Status.Running" }, ["kind"]: _t_1, ["startedAt"]: startedAt_1, ["endedAt"]: endedAt_1, ["payload"]: payload_1 }, ["tail"]: { $: "Con", ["head"]: run_loop($newThinking$(run_loop($thinkId$(n_0)), now_0, delta_0)), ["tail"]: { $: "Nil" } } };
    }
  } else {
    const kind_0 = h_0.kind;
    const startedAt_2 = h_0.startedAt;
    const endedAt_2 = h_0.endedAt;
    const payload_2 = h_0.payload;
    return { $: "Con", ["head"]: { $: "Step", ["id"]: id_0, ["status"]: _t_0, ["kind"]: kind_0, ["startedAt"]: startedAt_2, ["endedAt"]: endedAt_2, ["payload"]: payload_2 }, ["tail"]: { $: "Con", ["head"]: run_loop($newThinking$(run_loop($thinkId$(n_0)), now_0, delta_0)), ["tail"]: { $: "Nil" } } };
  }
}
function $burst$(xs_0, delta_0, now_0, n_0) {
  if (xs_0.$ === "Nil") {
    return { $: "Con", ["head"]: run_loop($newThinking$(run_loop($thinkId$(n_0)), now_0, delta_0)), ["tail"]: { $: "Nil" } };
  } else {
    const h_0 = xs_0.head;
    const _t_0 = xs_0.tail;
    if (_t_0.$ === "Nil") {
      return run_jump($burst$last$, [h_0, delta_0, now_0, n_0]);
    } else {
      const __0 = _t_0.head;
      const __1 = _t_0.tail;
      return { $: "Con", ["head"]: h_0, ["tail"]: run_loop($burst$({ $: "Con", ["head"]: __0, ["tail"]: __1 }, delta_0, now_0, n_0)) };
    }
  }
}
function $thinkingDelta$go$(log_0, delta_0, now_0) {
  const startedAt_0 = log_0.startedAt;
  const endedAt_0 = log_0.endedAt;
  const reason_0 = log_0.reason;
  const text_0 = log_0.text;
  const steps_0 = log_0.steps;
  const steps_1 = steps_0;
  const n_0 = run_loop($List$length$(steps_1));
  return { $: "Log", ["startedAt"]: startedAt_0, ["endedAt"]: endedAt_0, ["reason"]: reason_0, ["text"]: text_0, ["steps"]: run_loop($burst$(steps_1, delta_0, now_0, n_0)) };
}
function $thinkingDelta$if$(log_0, delta_0, now_0, empty_0) {
  if (empty_0) {
    return log_0;
  } else {
    return run_jump($thinkingDelta$go$, [log_0, delta_0, now_0]);
  }
}
function $thinkingDelta$(log_0, delta_0, now_0) {
  const d_0 = delta_0;
  return run_jump($thinkingDelta$if$, [log_0, d_0, now_0, run_loop($String$is_empty$(d_0))]);
}
function $closeStep$running$(id_0, kind_0, startedAt_0, endedAt_0, payload_0, now_0) {
  if (kind_0.$ === "Thinking") {
    return { $: "Step", ["id"]: id_0, ["status"]: { $: "Status.Done" }, ["kind"]: { $: "Thinking" }, ["startedAt"]: startedAt_0, ["endedAt"]: now_0, ["payload"]: payload_0 };
  } else {
    return { $: "Step", ["id"]: id_0, ["status"]: { $: "Status.Running" }, ["kind"]: kind_0, ["startedAt"]: startedAt_0, ["endedAt"]: endedAt_0, ["payload"]: payload_0 };
  }
}
function $closeStep$status$(id_0, status_0, kind_0, startedAt_0, endedAt_0, payload_0, now_0) {
  if (status_0.$ === "Status.Running") {
    return run_jump($closeStep$running$, [id_0, kind_0, startedAt_0, endedAt_0, payload_0, now_0]);
  } else {
    return { $: "Step", ["id"]: id_0, ["status"]: status_0, ["kind"]: kind_0, ["startedAt"]: startedAt_0, ["endedAt"]: endedAt_0, ["payload"]: payload_0 };
  }
}
function $closeStep$(s_0, now_0) {
  const id_0 = s_0.id;
  const status_0 = s_0.status;
  const kind_0 = s_0.kind;
  const startedAt_0 = s_0.startedAt;
  const endedAt_0 = s_0.endedAt;
  const payload_0 = s_0.payload;
  return run_jump($closeStep$status$, [id_0, status_0, kind_0, startedAt_0, endedAt_0, payload_0, now_0]);
}
function $closeEach$(xs_0, now_0) {
  if (xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const h_0 = xs_0.head;
    const t_0 = xs_0.tail;
    return { $: "Con", ["head"]: run_loop($closeStep$(h_0, now_0)), ["tail"]: run_loop($closeEach$(t_0, now_0)) };
  }
}
function $closeThinking$(log_0, now_0) {
  const startedAt_0 = log_0.startedAt;
  const endedAt_0 = log_0.endedAt;
  const reason_0 = log_0.reason;
  const text_0 = log_0.text;
  const steps_0 = log_0.steps;
  return { $: "Log", ["startedAt"]: startedAt_0, ["endedAt"]: endedAt_0, ["reason"]: reason_0, ["text"]: text_0, ["steps"]: run_loop($closeEach$(steps_0, now_0)) };
}
function $finishStep$running$(id_0, kind_0, startedAt_0, endedAt_0, payload_0, now_0) {
  if (kind_0.$ === "Thinking") {
    return { $: "Step", ["id"]: id_0, ["status"]: { $: "Status.Done" }, ["kind"]: { $: "Thinking" }, ["startedAt"]: startedAt_0, ["endedAt"]: now_0, ["payload"]: payload_0 };
  } else {
    return { $: "Step", ["id"]: id_0, ["status"]: { $: "Status.Stopped" }, ["kind"]: kind_0, ["startedAt"]: startedAt_0, ["endedAt"]: now_0, ["payload"]: payload_0 };
  }
}
function $finishStep$status$(id_0, status_0, kind_0, startedAt_0, endedAt_0, payload_0, now_0) {
  if (status_0.$ === "Status.Running") {
    return run_jump($finishStep$running$, [id_0, kind_0, startedAt_0, endedAt_0, payload_0, now_0]);
  } else {
    return { $: "Step", ["id"]: id_0, ["status"]: status_0, ["kind"]: kind_0, ["startedAt"]: startedAt_0, ["endedAt"]: endedAt_0, ["payload"]: payload_0 };
  }
}
function $finishStep$(s_0, now_0) {
  const id_0 = s_0.id;
  const status_0 = s_0.status;
  const kind_0 = s_0.kind;
  const startedAt_0 = s_0.startedAt;
  const endedAt_0 = s_0.endedAt;
  const payload_0 = s_0.payload;
  return run_jump($finishStep$status$, [id_0, status_0, kind_0, startedAt_0, endedAt_0, payload_0, now_0]);
}
function $finishEach$(xs_0, now_0) {
  if (xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const h_0 = xs_0.head;
    const t_0 = xs_0.tail;
    return { $: "Con", ["head"]: run_loop($finishStep$(h_0, now_0)), ["tail"]: run_loop($finishEach$(t_0, now_0)) };
  }
}
function $finishLog$(log_0, now_0, reason_0) {
  const startedAt_0 = log_0.startedAt;
  const endedAt_0 = log_0.endedAt;
  const __0 = log_0.reason;
  const text_0 = log_0.text;
  const steps_0 = log_0.steps;
  const n_0 = now_0;
  return { $: "Log", ["startedAt"]: startedAt_0, ["endedAt"]: n_0, ["reason"]: reason_0, ["text"]: text_0, ["steps"]: run_loop($finishEach$(steps_0, n_0)) };
}
function $isRunningThinking$kind$(kind_0) {
  if (kind_0.$ === "Thinking") {
    return true;
  } else {
    return false;
  }
}
function $isRunningThinking$check$(kind_0, status_0) {
  if (status_0.$ === "Status.Running") {
    return run_jump($isRunningThinking$kind$, [kind_0]);
  } else {
    return false;
  }
}
function $isRunningThinking$(s_0) {
  const id_0 = s_0.id;
  const status_0 = s_0.status;
  const kind_0 = s_0.kind;
  const startedAt_0 = s_0.startedAt;
  const endedAt_0 = s_0.endedAt;
  const payload_0 = s_0.payload;
  return run_jump($isRunningThinking$check$, [kind_0, status_0]);
}
function $isRunning$status$(status_0) {
  if (status_0.$ === "Status.Running") {
    return true;
  } else {
    return false;
  }
}
function $isRunning$(s_0) {
  const id_0 = s_0.id;
  const status_0 = s_0.status;
  const kind_0 = s_0.kind;
  const startedAt_0 = s_0.startedAt;
  const endedAt_0 = s_0.endedAt;
  const payload_0 = s_0.payload;
  return run_jump($isRunning$status$, [status_0]);
}
function $noRunningThinking$and$(running_0, rest_0) {
  if (running_0) {
    return false;
  } else {
    return rest_0;
  }
}
function $noRunningThinking$(xs_0) {
  if (xs_0.$ === "Nil") {
    return true;
  } else {
    const h_0 = xs_0.head;
    const t_0 = xs_0.tail;
    return run_jump($noRunningThinking$and$, [run_loop($isRunningThinking$(h_0)), run_loop($noRunningThinking$(t_0))]);
  }
}
function $Nat$show$(n_0) {
  const m_0 = n_0;
  return run_jump($Nat$show$fin$, [m_0, "", run_loop($Nat$show$put$(nat_divmod(m_0, 10n)))]);
}
function $String$starts_with$(s_0, p_0) {
  if (s_0 === "") {
    if (p_0 === "") {
      return true;
    } else {
      const h_0 = p_0.codePointAt(0) > 65535 ? p_0.slice(0, 2) : p_0[0];
      const t_0 = p_0.codePointAt(0) > 65535 ? p_0.slice(2) : p_0.slice(1);
      return false;
    }
  } else {
    const h_1 = s_0.codePointAt(0) > 65535 ? s_0.slice(0, 2) : s_0[0];
    const t_1 = s_0.codePointAt(0) > 65535 ? s_0.slice(2) : s_0.slice(1);
    if (p_0 === "") {
      return true;
    } else {
      const y_0 = p_0.codePointAt(0) > 65535 ? p_0.slice(0, 2) : p_0[0];
      const yt_0 = p_0.codePointAt(0) > 65535 ? p_0.slice(2) : p_0.slice(1);
      return run_jump($String$starts_with$if$, [t_1, yt_0, run_loop($Char$is_eq$(h_1, y_0))]);
    }
  }
}
function $String$is_empty$(s_0) {
  if (s_0 === "") {
    return true;
  } else {
    const h_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(0, 2) : s_0[0];
    const t_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(2) : s_0.slice(1);
    return false;
  }
}
function $String$reverse$(s_0) {
  return run_jump($String$reverse$go$, [s_0, ""]);
}
function $Char$to_lower$(c_0) {
  const x_0 = run_loop($Bool$to_u32$(run_loop($Char$is_upper$(c_0))));
  const x_1 = run_loop($Char$to_u32$(c_0));
  const x_2 = Math.imul(x_0, 32) >>> 0;
  return char_new(x_1 + x_2 >>> 0);
}
function $List$length$(xs_0) {
  if (xs_0.$ === "Nil") {
    return 0n;
  } else {
    const h_0 = xs_0.head;
    const t_0 = xs_0.tail;
    return nat_chk(run_loop($List$length$(t_0)) + 1n);
  }
}
function $Nat$show$fin$(g_0, acc_0, dq_0) {
  const d_0 = dq_0.fst;
  const _t_0 = dq_0.snd;
  if (_t_0 === 0n) {
    return d_0 + acc_0;
  } else {
    const p_0 = _t_0 - 1n;
    return run_jump($Nat$show$go$, [g_0, nat_chk(p_0 + 1n), d_0 + acc_0]);
  }
}
function $Nat$show$put$(qr_0) {
  const q_0 = qr_0.fst;
  const r_0 = qr_0.snd;
  const x_0 = nat_chk(48n + r_0);
  return { $: "Tuple", ["fst"]: char_new(Number(x_0 & 0xFFFFFFFFn)), ["snd"]: q_0 };
}
function $String$starts_with$if$(t_0, pt_0, same_0) {
  if (!same_0) {
    return false;
  } else {
    return run_jump($String$starts_with$, [t_0, pt_0]);
  }
}
function $Char$is_eq$(a_0, b_0) {
  const x_0 = a_0.codePointAt(0);
  const y_0 = b_0.codePointAt(0);
  return x_0 === y_0;
}
function $String$reverse$go$(s_0, acc_0) {
  if (s_0 === "") {
    return acc_0;
  } else {
    const h_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(0, 2) : s_0[0];
    const t_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(2) : s_0.slice(1);
    return run_jump($String$reverse$go$, [t_0, h_0 + acc_0]);
  }
}
function $Char$to_u32$(c_0) {
  const x_0 = c_0.codePointAt(0);
  return x_0;
}
function $Bool$to_u32$(b_0) {
  if (!b_0) {
    return 0;
  } else {
    return 1;
  }
}
function $Char$is_upper$(c_0) {
  const x_0 = c_0.codePointAt(0);
  const x_1 = x_0;
  return run_jump($Bool$and$, [x_1 >= 65, x_1 <= 90]);
}
function $Nat$show$go$(f_0, n_0, acc_0) {
  if (f_0 === 0n) {
    return acc_0;
  } else {
    const g_0 = f_0 - 1n;
    return run_jump($Nat$show$fin$, [g_0, acc_0, run_loop($Nat$show$put$(nat_divmod(n_0, 10n)))]);
  }
}
function $Bool$and$(a_0, b_0) {
  if (!a_0) {
    return false;
  } else {
    return b_0;
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

// GERADO de core/worklogview.bend por `bun core/build.mjs` — não editar à mão.
// core/worklogview.bend
function cmp_new(a, b) {
  return { $: a < b ? "LT" : a === b ? "EQ" : "GT" };
}
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
function $view$attr$(name_0, value_0) {
  return { $: "ViewAttr", ["name"]: name_0, ["value"]: value_0 };
}
function $view$classOn$(name_0, on_0) {
  return { $: "ViewClass", ["name"]: name_0, ["on"]: on_0 };
}
function $view$viewEl$(tag_0, attrs_0, kids_0) {
  return { $: "ViewEl", ["tag"]: tag_0, ["attrs"]: attrs_0, ["kids"]: kids_0 };
}
function $view$viewText$(s_0) {
  return { $: "ViewText", ["text"]: s_0 };
}
function $view$viewKey$(tag_0, key_0, attrs_0, kids_0) {
  return run_jump($view$viewEl$, [tag_0, { $: "Con", ["head"]: { $: "ViewAttr", ["name"]: "key", ["value"]: key_0 }, ["tail"]: attrs_0 }, kids_0]);
}
function $view$tagOf$(n_0) {
  if (n_0.$ === "ViewEl") {
    const tag_0 = n_0.tag;
    const attrs_0 = n_0.attrs;
    const kids_0 = n_0.kids;
    return tag_0;
  } else {
    const text_0 = n_0.text;
    return "";
  }
}
function $view$attrsOf$(n_0) {
  if (n_0.$ === "ViewEl") {
    const tag_0 = n_0.tag;
    const attrs_0 = n_0.attrs;
    const kids_0 = n_0.kids;
    return attrs_0;
  } else {
    const text_0 = n_0.text;
    return { $: "Nil" };
  }
}
function $view$kidsOf$(n_0) {
  if (n_0.$ === "ViewEl") {
    const tag_0 = n_0.tag;
    const attrs_0 = n_0.attrs;
    const kids_0 = n_0.kids;
    return kids_0;
  } else {
    const text_0 = n_0.text;
    return { $: "Nil" };
  }
}
function $view$textOf$(n_0) {
  if (n_0.$ === "ViewEl") {
    const tag_0 = n_0.tag;
    const attrs_0 = n_0.attrs;
    const kids_0 = n_0.kids;
    return "";
  } else {
    const text_0 = n_0.text;
    return text_0;
  }
}
function $view$isEl$(n_0) {
  if (n_0.$ === "ViewEl") {
    const tag_0 = n_0.tag;
    const attrs_0 = n_0.attrs;
    const kids_0 = n_0.kids;
    return true;
  } else {
    const text_0 = n_0.text;
    return false;
  }
}
function $view$isText$(n_0) {
  if (n_0.$ === "ViewEl") {
    const tag_0 = n_0.tag;
    const attrs_0 = n_0.attrs;
    const kids_0 = n_0.kids;
    return false;
  } else {
    const text_0 = n_0.text;
    return true;
  }
}
function $view$attrGet$choose$(av_0, rest_0, same_0) {
  if (same_0) {
    return { $: "Some", ["value"]: av_0 };
  } else {
    return rest_0;
  }
}
function $view$attrGet$go$(attrs_0, name_0) {
  if (attrs_0.$ === "Nil") {
    return { $: "None" };
  } else {
    const _t_0 = attrs_0.head;
    const an_0 = _t_0.name;
    const av_0 = _t_0.value;
    const t_0 = attrs_0.tail;
    return run_jump($view$attrGet$choose$, [av_0, run_loop($view$attrGet$go$(t_0, name_0)), run_loop($String$eq$(an_0, name_0))]);
  }
}
function $view$attrGet$(attrs_0, name_0) {
  return run_jump($view$attrGet$go$, [attrs_0, name_0]);
}
function $view$attrWhen$(cond_0, a_0) {
  if (cond_0) {
    return { $: "Con", ["head"]: a_0, ["tail"]: { $: "Nil" } };
  } else {
    return { $: "Nil" };
  }
}
function $view$attrConcat$(xs_0, ys_0) {
  return run_jump($List$append$, [xs_0, ys_0]);
}
function $view$attrJoin$(xss_0) {
  return run_jump($List$concat$, [xss_0]);
}
function $view$attrId$(value_0) {
  return { $: "ViewAttr", ["name"]: "id", ["value"]: value_0 };
}
function $view$attrClass$(value_0) {
  return { $: "ViewAttr", ["name"]: "class", ["value"]: value_0 };
}
function $view$attrType$(value_0) {
  return { $: "ViewAttr", ["name"]: "type", ["value"]: value_0 };
}
function $view$attrTitle$(value_0) {
  return { $: "ViewAttr", ["name"]: "title", ["value"]: value_0 };
}
function $view$attrKey$(value_0) {
  return { $: "ViewAttr", ["name"]: "key", ["value"]: value_0 };
}
function $view$attrOn$(event_0, handler_0) {
  return { $: "ViewAttr", ["name"]: "on:" + event_0, ["value"]: handler_0 };
}
function $view$attrData$(name_0, value_0) {
  return { $: "ViewAttr", ["name"]: "data-" + name_0, ["value"]: value_0 };
}
function $view$attrAria$(name_0, value_0) {
  return { $: "ViewAttr", ["name"]: "aria-" + name_0, ["value"]: value_0 };
}
function $view$boolStr$(on_0) {
  if (on_0) {
    return "true";
  } else {
    return "false";
  }
}
function $view$attrBool$(name_0, on_0) {
  return { $: "ViewAttr", ["name"]: name_0, ["value"]: run_loop($view$boolStr$(on_0)) };
}
function $view$classAppend$empty$(acc_0, name_0, empty_0) {
  if (empty_0) {
    return name_0;
  } else {
    const x_0 = " " + name_0;
    return acc_0 + x_0;
  }
}
function $view$classAppend$(acc_0, name_0) {
  return run_jump($view$classAppend$empty$, [acc_0, name_0, run_loop($String$is_empty$(acc_0))]);
}
function $view$classNext$emptyName$(name_0, acc_0, emptyName_0) {
  if (emptyName_0) {
    return acc_0;
  } else {
    return run_jump($view$classAppend$, [acc_0, name_0]);
  }
}
function $view$classNext$on$(name_0, on_0, acc_0) {
  if (!on_0) {
    return acc_0;
  } else {
    return run_jump($view$classNext$emptyName$, [name_0, acc_0, run_loop($String$is_empty$(name_0))]);
  }
}
function $view$classValue$go$(xs_0, acc_0) {
  if (xs_0.$ === "Nil") {
    return acc_0;
  } else {
    const _t_0 = xs_0.head;
    const name_0 = _t_0.name;
    const on_0 = _t_0.on;
    const t_0 = xs_0.tail;
    return run_jump($view$classValue$go$, [t_0, run_loop($view$classNext$on$(name_0, on_0, acc_0))]);
  }
}
function $view$classValue$(xs_0) {
  return run_jump($view$classValue$go$, [xs_0, ""]);
}
function $view$classes$(xs_0) {
  return { $: "ViewAttr", ["name"]: "class", ["value"]: run_loop($view$classValue$(xs_0)) };
}
function $view$viewWhen$(cond_0, node_0) {
  if (cond_0) {
    return { $: "Con", ["head"]: node_0, ["tail"]: { $: "Nil" } };
  } else {
    return { $: "Nil" };
  }
}
function $view$viewWhenAll$(cond_0, nodes_0) {
  if (cond_0) {
    return nodes_0;
  } else {
    return { $: "Nil" };
  }
}
function $view$viewConcat$(xs_0, ys_0) {
  return run_jump($List$append$, [xs_0, ys_0]);
}
function $view$viewJoin$(xss_0) {
  return run_jump($List$concat$, [xss_0]);
}
function $view$viewMap$0$(xs_0) {
  if (xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const h_0 = xs_0.head;
    const t_0 = xs_0.tail;
    return { $: "Con", ["head"]: run_loop($view$viewText$(h_0)), ["tail"]: run_loop($view$viewMap$0$(t_0)) };
  }
}
function $view$viewMapText$(xs_0) {
  return run_jump($view$viewMap$0$, [xs_0]);
}
function $view$asTextI$(i_0, s_0) {
  return run_jump($view$viewText$, [s_0]);
}
function $view$viewMapI$go$0$(xs_0, i_0) {
  if (xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const h_0 = xs_0.head;
    const t_0 = xs_0.tail;
    return { $: "Con", ["head"]: run_loop($view$asTextI$(i_0, h_0)), ["tail"]: run_loop($view$viewMapI$go$0$(t_0, nat_chk(i_0 + 1n))) };
  }
}
function $view$viewMapTextI$go$(xs_0, i_0) {
  return run_jump($view$viewMapI$go$0$, [xs_0, i_0]);
}
function $view$viewMapTextI$(xs_0) {
  return run_jump($view$viewMapTextI$go$, [xs_0, 0n]);
}
function $worklog$emptyPayload$() {
  return { $: "Payload", ["text"]: "", ["toolName"]: "", ["argsJson"]: "", ["query"]: "", ["url"]: "", ["domain"]: "", ["pageTitle"]: "", ["hits"]: { $: "Nil" }, ["resultText"]: "", ["error"]: "" };
}
function $worklog$withText$(p_0, delta_0) {
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
function $worklog$newThinking$(id_0, now_0, delta_0) {
  return { $: "Step", ["id"]: id_0, ["status"]: { $: "Status.Running" }, ["kind"]: { $: "Thinking" }, ["startedAt"]: now_0, ["endedAt"]: 0n, ["payload"]: run_loop($worklog$withText$(run_loop($worklog$emptyPayload$()), delta_0)) };
}
function $worklog$thinkId$(n_0) {
  const x_0 = run_loop($Nat$show$(nat_chk(n_0 + 1n)));
  return "pensar-" + x_0;
}
function $worklog$headHere$(s_0, needle_0) {
  if (s_0 === "") {
    return false;
  } else {
    const h_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(0, 2) : s_0[0];
    const t_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(2) : s_0.slice(1);
    return run_jump($String$starts_with$, [h_0 + t_0, needle_0]);
  }
}
function $worklog$hasNeedle$go$(s_0, here_0, needle_0) {
  if (s_0 === "") {
    return run_jump($String$is_empty$, [needle_0]);
  } else {
    const h_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(0, 2) : s_0[0];
    const t_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(2) : s_0.slice(1);
    if (here_0) {
      return true;
    } else {
      const t_1 = t_0;
      return run_jump($worklog$hasNeedle$go$, [t_1, run_loop($worklog$headHere$(t_1, needle_0)), needle_0]);
    }
  }
}
function $worklog$hasNeedle$(s_0, needle_0) {
  return run_jump($worklog$hasNeedle$go$, [s_0, run_loop($worklog$headHere$(s_0, needle_0)), needle_0]);
}
function $worklog$toLower$go$(s_0, acc_0) {
  if (s_0 === "") {
    return run_jump($String$reverse$, [acc_0]);
  } else {
    const h_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(0, 2) : s_0[0];
    const t_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(2) : s_0.slice(1);
    return run_jump($worklog$toLower$go$, [t_0, run_loop($Char$to_lower$(h_0)) + acc_0]);
  }
}
function $worklog$toLower$(s_0) {
  return run_jump($worklog$toLower$go$, [s_0, ""]);
}
function $worklog$anyContains$go$(n_0, needles_0, found_0) {
  if (needles_0.$ === "Nil") {
    return found_0;
  } else {
    const h_0 = needles_0.head;
    const t_0 = needles_0.tail;
    const x_0 = run_loop($worklog$hasNeedle$(n_0, h_0));
    return run_jump($worklog$anyContains$go$, [n_0, t_0, found_0 || x_0]);
  }
}
function $worklog$anyContains$(n_0, needles_0) {
  return run_jump($worklog$anyContains$go$, [n_0, needles_0, false]);
}
function $worklog$toolKind$fetch$if$(n_0, fetch_0) {
  if (fetch_0) {
    return { $: "Fetch" };
  } else {
    return { $: "Tool" };
  }
}
function $worklog$toolKind$fetch$(n_0) {
  return run_jump($worklog$toolKind$fetch$if$, [n_0, run_loop($worklog$anyContains$(n_0, { $: "Con", ["head"]: "fetch", ["tail"]: { $: "Con", ["head"]: "reader", ["tail"]: { $: "Con", ["head"]: "http", ["tail"]: { $: "Con", ["head"]: "url", ["tail"]: { $: "Con", ["head"]: "page", ["tail"]: { $: "Nil" } } } } } }))]);
}
function $worklog$toolKind$search$if$(n_0, search_0) {
  if (search_0) {
    return { $: "Search" };
  } else {
    return run_jump($worklog$toolKind$fetch$, [n_0]);
  }
}
function $worklog$toolKind$search$(n_0) {
  return run_jump($worklog$toolKind$search$if$, [n_0, run_loop($worklog$anyContains$(n_0, { $: "Con", ["head"]: "search", ["tail"]: { $: "Con", ["head"]: "busca", ["tail"]: { $: "Nil" } } }))]);
}
function $worklog$toolKind$ref$(n_0, ref_0) {
  if (ref_0) {
    return { $: "Reference" };
  } else {
    return run_jump($worklog$toolKind$search$, [n_0]);
  }
}
function $worklog$toolKind$(name_0) {
  const n_0 = run_loop($worklog$toLower$(name_0));
  return run_jump($worklog$toolKind$ref$, [n_0, run_loop($worklog$anyContains$(n_0, { $: "Con", ["head"]: "reference", ["tail"]: { $: "Nil" } }))]);
}
function $worklog$createLog$(now_0) {
  return { $: "Log", ["startedAt"]: now_0, ["endedAt"]: 0n, ["reason"]: "", ["text"]: "", ["steps"]: { $: "Nil" } };
}
function $worklog$burst$last$(h_0, delta_0, now_0, n_0) {
  const id_0 = h_0.id;
  const _t_0 = h_0.status;
  if (_t_0.$ === "Status.Running") {
    const _t_1 = h_0.kind;
    if (_t_1.$ === "Thinking") {
      const startedAt_0 = h_0.startedAt;
      const endedAt_0 = h_0.endedAt;
      const payload_0 = h_0.payload;
      return { $: "Con", ["head"]: { $: "Step", ["id"]: id_0, ["status"]: { $: "Status.Running" }, ["kind"]: { $: "Thinking" }, ["startedAt"]: startedAt_0, ["endedAt"]: endedAt_0, ["payload"]: run_loop($worklog$withText$(payload_0, delta_0)) }, ["tail"]: { $: "Nil" } };
    } else {
      const startedAt_1 = h_0.startedAt;
      const endedAt_1 = h_0.endedAt;
      const payload_1 = h_0.payload;
      return { $: "Con", ["head"]: { $: "Step", ["id"]: id_0, ["status"]: { $: "Status.Running" }, ["kind"]: _t_1, ["startedAt"]: startedAt_1, ["endedAt"]: endedAt_1, ["payload"]: payload_1 }, ["tail"]: { $: "Con", ["head"]: run_loop($worklog$newThinking$(run_loop($worklog$thinkId$(n_0)), now_0, delta_0)), ["tail"]: { $: "Nil" } } };
    }
  } else {
    const kind_0 = h_0.kind;
    const startedAt_2 = h_0.startedAt;
    const endedAt_2 = h_0.endedAt;
    const payload_2 = h_0.payload;
    return { $: "Con", ["head"]: { $: "Step", ["id"]: id_0, ["status"]: _t_0, ["kind"]: kind_0, ["startedAt"]: startedAt_2, ["endedAt"]: endedAt_2, ["payload"]: payload_2 }, ["tail"]: { $: "Con", ["head"]: run_loop($worklog$newThinking$(run_loop($worklog$thinkId$(n_0)), now_0, delta_0)), ["tail"]: { $: "Nil" } } };
  }
}
function $worklog$burst$(xs_0, delta_0, now_0, n_0) {
  if (xs_0.$ === "Nil") {
    return { $: "Con", ["head"]: run_loop($worklog$newThinking$(run_loop($worklog$thinkId$(n_0)), now_0, delta_0)), ["tail"]: { $: "Nil" } };
  } else {
    const h_0 = xs_0.head;
    const _t_0 = xs_0.tail;
    if (_t_0.$ === "Nil") {
      return run_jump($worklog$burst$last$, [h_0, delta_0, now_0, n_0]);
    } else {
      const __0 = _t_0.head;
      const __1 = _t_0.tail;
      return { $: "Con", ["head"]: h_0, ["tail"]: run_loop($worklog$burst$({ $: "Con", ["head"]: __0, ["tail"]: __1 }, delta_0, now_0, n_0)) };
    }
  }
}
function $worklog$thinkingDelta$go$(log_0, delta_0, now_0) {
  const startedAt_0 = log_0.startedAt;
  const endedAt_0 = log_0.endedAt;
  const reason_0 = log_0.reason;
  const text_0 = log_0.text;
  const steps_0 = log_0.steps;
  const steps_1 = steps_0;
  const n_0 = run_loop($List$length$(steps_1));
  return { $: "Log", ["startedAt"]: startedAt_0, ["endedAt"]: endedAt_0, ["reason"]: reason_0, ["text"]: text_0, ["steps"]: run_loop($worklog$burst$(steps_1, delta_0, now_0, n_0)) };
}
function $worklog$thinkingDelta$if$(log_0, delta_0, now_0, empty_0) {
  if (empty_0) {
    return log_0;
  } else {
    return run_jump($worklog$thinkingDelta$go$, [log_0, delta_0, now_0]);
  }
}
function $worklog$thinkingDelta$(log_0, delta_0, now_0) {
  const d_0 = delta_0;
  return run_jump($worklog$thinkingDelta$if$, [log_0, d_0, now_0, run_loop($String$is_empty$(d_0))]);
}
function $worklog$closeStep$running$(id_0, kind_0, startedAt_0, endedAt_0, payload_0, now_0) {
  if (kind_0.$ === "Thinking") {
    return { $: "Step", ["id"]: id_0, ["status"]: { $: "Status.Done" }, ["kind"]: { $: "Thinking" }, ["startedAt"]: startedAt_0, ["endedAt"]: now_0, ["payload"]: payload_0 };
  } else {
    return { $: "Step", ["id"]: id_0, ["status"]: { $: "Status.Running" }, ["kind"]: kind_0, ["startedAt"]: startedAt_0, ["endedAt"]: endedAt_0, ["payload"]: payload_0 };
  }
}
function $worklog$closeStep$status$(id_0, status_0, kind_0, startedAt_0, endedAt_0, payload_0, now_0) {
  if (status_0.$ === "Status.Running") {
    return run_jump($worklog$closeStep$running$, [id_0, kind_0, startedAt_0, endedAt_0, payload_0, now_0]);
  } else {
    return { $: "Step", ["id"]: id_0, ["status"]: status_0, ["kind"]: kind_0, ["startedAt"]: startedAt_0, ["endedAt"]: endedAt_0, ["payload"]: payload_0 };
  }
}
function $worklog$closeStep$(s_0, now_0) {
  const id_0 = s_0.id;
  const status_0 = s_0.status;
  const kind_0 = s_0.kind;
  const startedAt_0 = s_0.startedAt;
  const endedAt_0 = s_0.endedAt;
  const payload_0 = s_0.payload;
  return run_jump($worklog$closeStep$status$, [id_0, status_0, kind_0, startedAt_0, endedAt_0, payload_0, now_0]);
}
function $worklog$closeEach$(xs_0, now_0) {
  if (xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const h_0 = xs_0.head;
    const t_0 = xs_0.tail;
    return { $: "Con", ["head"]: run_loop($worklog$closeStep$(h_0, now_0)), ["tail"]: run_loop($worklog$closeEach$(t_0, now_0)) };
  }
}
function $worklog$closeThinking$(log_0, now_0) {
  const startedAt_0 = log_0.startedAt;
  const endedAt_0 = log_0.endedAt;
  const reason_0 = log_0.reason;
  const text_0 = log_0.text;
  const steps_0 = log_0.steps;
  return { $: "Log", ["startedAt"]: startedAt_0, ["endedAt"]: endedAt_0, ["reason"]: reason_0, ["text"]: text_0, ["steps"]: run_loop($worklog$closeEach$(steps_0, now_0)) };
}
function $worklog$finishStep$running$(id_0, kind_0, startedAt_0, endedAt_0, payload_0, now_0) {
  if (kind_0.$ === "Thinking") {
    return { $: "Step", ["id"]: id_0, ["status"]: { $: "Status.Done" }, ["kind"]: { $: "Thinking" }, ["startedAt"]: startedAt_0, ["endedAt"]: now_0, ["payload"]: payload_0 };
  } else {
    return { $: "Step", ["id"]: id_0, ["status"]: { $: "Status.Stopped" }, ["kind"]: kind_0, ["startedAt"]: startedAt_0, ["endedAt"]: now_0, ["payload"]: payload_0 };
  }
}
function $worklog$finishStep$status$(id_0, status_0, kind_0, startedAt_0, endedAt_0, payload_0, now_0) {
  if (status_0.$ === "Status.Running") {
    return run_jump($worklog$finishStep$running$, [id_0, kind_0, startedAt_0, endedAt_0, payload_0, now_0]);
  } else {
    return { $: "Step", ["id"]: id_0, ["status"]: status_0, ["kind"]: kind_0, ["startedAt"]: startedAt_0, ["endedAt"]: endedAt_0, ["payload"]: payload_0 };
  }
}
function $worklog$finishStep$(s_0, now_0) {
  const id_0 = s_0.id;
  const status_0 = s_0.status;
  const kind_0 = s_0.kind;
  const startedAt_0 = s_0.startedAt;
  const endedAt_0 = s_0.endedAt;
  const payload_0 = s_0.payload;
  return run_jump($worklog$finishStep$status$, [id_0, status_0, kind_0, startedAt_0, endedAt_0, payload_0, now_0]);
}
function $worklog$finishEach$(xs_0, now_0) {
  if (xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const h_0 = xs_0.head;
    const t_0 = xs_0.tail;
    return { $: "Con", ["head"]: run_loop($worklog$finishStep$(h_0, now_0)), ["tail"]: run_loop($worklog$finishEach$(t_0, now_0)) };
  }
}
function $worklog$finishLog$(log_0, now_0, reason_0) {
  const startedAt_0 = log_0.startedAt;
  const endedAt_0 = log_0.endedAt;
  const __0 = log_0.reason;
  const text_0 = log_0.text;
  const steps_0 = log_0.steps;
  const n_0 = now_0;
  return { $: "Log", ["startedAt"]: startedAt_0, ["endedAt"]: n_0, ["reason"]: reason_0, ["text"]: text_0, ["steps"]: run_loop($worklog$finishEach$(steps_0, n_0)) };
}
function $worklog$isRunningThinking$kind$(kind_0) {
  if (kind_0.$ === "Thinking") {
    return true;
  } else {
    return false;
  }
}
function $worklog$isRunningThinking$check$(kind_0, status_0) {
  if (status_0.$ === "Status.Running") {
    return run_jump($worklog$isRunningThinking$kind$, [kind_0]);
  } else {
    return false;
  }
}
function $worklog$isRunningThinking$(s_0) {
  const id_0 = s_0.id;
  const status_0 = s_0.status;
  const kind_0 = s_0.kind;
  const startedAt_0 = s_0.startedAt;
  const endedAt_0 = s_0.endedAt;
  const payload_0 = s_0.payload;
  return run_jump($worklog$isRunningThinking$check$, [kind_0, status_0]);
}
function $worklog$isRunning$status$(status_0) {
  if (status_0.$ === "Status.Running") {
    return true;
  } else {
    return false;
  }
}
function $worklog$isRunning$(s_0) {
  const id_0 = s_0.id;
  const status_0 = s_0.status;
  const kind_0 = s_0.kind;
  const startedAt_0 = s_0.startedAt;
  const endedAt_0 = s_0.endedAt;
  const payload_0 = s_0.payload;
  return run_jump($worklog$isRunning$status$, [status_0]);
}
function $worklog$noRunningThinking$and$(running_0, rest_0) {
  if (running_0) {
    return false;
  } else {
    return rest_0;
  }
}
function $worklog$noRunningThinking$(xs_0) {
  if (xs_0.$ === "Nil") {
    return true;
  } else {
    const h_0 = xs_0.head;
    const t_0 = xs_0.tail;
    return run_jump($worklog$noRunningThinking$and$, [run_loop($worklog$isRunningThinking$(h_0)), run_loop($worklog$noRunningThinking$(t_0))]);
  }
}
function $kindName$(kind_0) {
  if (kind_0.$ === "Thinking") {
    return "thinking";
  } else if (kind_0.$ === "Search") {
    return "search";
  } else if (kind_0.$ === "Reference") {
    return "reference";
  } else if (kind_0.$ === "Fetch") {
    return "fetch";
  } else if (kind_0.$ === "Tool") {
    return "tool";
  } else {
    return "error";
  }
}
function $statusName$(status_0) {
  if (status_0.$ === "Status.Running") {
    return "running";
  } else if (status_0.$ === "Status.Done") {
    return "done";
  } else if (status_0.$ === "Status.Stopped") {
    return "stopped";
  } else {
    return "error";
  }
}
function $statusRunning$(status_0) {
  if (status_0.$ === "Status.Running") {
    return true;
  } else {
    return false;
  }
}
function $isOff$(on_0) {
  if (on_0) {
    return false;
  } else {
    return true;
  }
}
function $both$(a_0, b_0) {
  if (!a_0) {
    return false;
  } else {
    return b_0;
  }
}
function $detailHidden$(open_0, hasDetail_0) {
  if (!hasDetail_0) {
    return true;
  } else {
    return run_jump($isOff$, [open_0]);
  }
}
function $attrHidden$() {
  return { $: "ViewAttr", ["name"]: "hidden", ["value"]: "" };
}
function $hrefOf$empty$(url_0, empty_0) {
  if (empty_0) {
    return "#";
  } else {
    return url_0;
  }
}
function $hrefOf$(url_0) {
  return run_jump($hrefOf$empty$, [url_0, run_loop($String$is_empty$(url_0))]);
}
function $articleAttrs$(live_0, expanded_0) {
  return { $: "Con", ["head"]: run_loop($view$attrClass$("work")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("live", run_loop($view$boolStr$(live_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("expanded", run_loop($view$boolStr$(expanded_0)))), ["tail"]: { $: "Nil" } } } };
}
function $headAttrs$(expanded_0) {
  return { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrClass$("work-head")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrKey$("work-head")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("expanded", run_loop($view$boolStr$(expanded_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "toggleWork")), ["tail"]: { $: "Nil" } } } } } };
}
function $stepAttrs$(kind_0, status_0, hasDetail_0) {
  return { $: "Con", ["head"]: run_loop($view$attrClass$("work-step")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("kind", kind_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("status", status_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("detail", run_loop($view$boolStr$(hasDetail_0)))), ["tail"]: { $: "Nil" } } } } };
}
function $toggleAttrs$(id_0, open_0) {
  return { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrClass$("step-toggle")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrKey$(run_loop($String$join$({ $: "Con", ["head"]: "step-toggle-", ["tail"]: { $: "Con", ["head"]: id_0, ["tail"]: { $: "Nil" } } }, "")))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("expanded", run_loop($view$boolStr$(open_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "toggleStep")), ["tail"]: { $: "Nil" } } } } } };
}
function $classHidden$(className_0, hide_0) {
  return run_jump($view$attrConcat$, [{ $: "Con", ["head"]: run_loop($view$attrClass$(className_0)), ["tail"]: { $: "Nil" } }, run_loop($view$attrWhen$(hide_0, run_loop($attrHidden$())))]);
}
function $domainKids$empty$(domain_0, empty_0) {
  if (empty_0) {
    return { $: "Nil" };
  } else {
    return { $: "Con", ["head"]: run_loop($view$viewText$(" ")), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("span", { $: "Con", ["head"]: run_loop($view$attrClass$("step-domain")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$(domain_0)), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Nil" } } };
  }
}
function $domainKids$(domain_0) {
  return run_jump($domainKids$empty$, [domain_0, run_loop($String$is_empty$(domain_0))]);
}
function $linkNode$go$(title_0, url_0, domain_0) {
  return run_jump($view$viewEl$, ["a", { $: "Con", ["head"]: run_loop($view$attrClass$("step-link")), ["tail"]: { $: "Con", ["head"]: { $: "ViewAttr", ["name"]: "href", ["value"]: run_loop($hrefOf$(url_0)) }, ["tail"]: { $: "Con", ["head"]: { $: "ViewAttr", ["name"]: "rel", ["value"]: "noreferrer" }, ["tail"]: { $: "Nil" } } } }, run_loop($view$viewConcat$({ $: "Con", ["head"]: run_loop($view$viewText$(title_0)), ["tail"]: { $: "Nil" } }, run_loop($domainKids$(domain_0))))]);
}
function $linkNode$(link_0) {
  const title_0 = link_0.title;
  const url_0 = link_0.url;
  const domain_0 = link_0.domain;
  return run_jump($linkNode$go$, [title_0, url_0, domain_0]);
}
function $linkKids$(xs_0) {
  if (xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const h_0 = xs_0.head;
    const t_0 = xs_0.tail;
    return { $: "Con", ["head"]: run_loop($linkNode$(h_0)), ["tail"]: run_loop($linkKids$(t_0)) };
  }
}
function $linksEmpty$(xs_0) {
  if (xs_0.$ === "Nil") {
    return true;
  } else {
    const __0 = xs_0.head;
    const __1 = xs_0.tail;
    return false;
  }
}
function $statusKids$(running_0) {
  if (running_0) {
    return { $: "Con", ["head"]: run_loop($view$viewEl$("span", { $: "Con", ["head"]: run_loop($view$attrClass$("step-spin")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("hidden", "true")), ["tail"]: { $: "Nil" } } }, { $: "Nil" })), ["tail"]: { $: "Nil" } };
  } else {
    return { $: "Nil" };
  }
}
function $workStep$go$(id_0, kind_0, status_0, open_0, hasDetail_0, label_0, time_0, preview_0, text_0, links_0) {
  const expandedOn_0 = run_loop($both$(hasDetail_0, open_0));
  return run_jump($view$viewKey$, ["div", id_0, run_loop($stepAttrs$(run_loop($kindName$(kind_0)), run_loop($statusName$(status_0)), hasDetail_0)), { $: "Con", ["head"]: run_loop($view$viewEl$("button", run_loop($toggleAttrs$(id_0, expandedOn_0)), { $: "Con", ["head"]: run_loop($view$viewEl$("span", { $: "Con", ["head"]: run_loop($view$attrClass$("step-icon")), ["tail"]: { $: "Nil" } }, { $: "Nil" })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("div", { $: "Con", ["head"]: run_loop($view$attrClass$("step-main")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewEl$("div", { $: "Con", ["head"]: run_loop($view$attrClass$("step-line")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewEl$("span", { $: "Con", ["head"]: run_loop($view$attrClass$("step-label")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$(label_0)), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("span", { $: "Con", ["head"]: run_loop($view$attrClass$("step-time")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$(time_0)), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Nil" } } })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("div", run_loop($classHidden$("step-preview", run_loop($String$is_empty$(preview_0)))), { $: "Con", ["head"]: run_loop($view$viewText$(preview_0)), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("div", run_loop($classHidden$("step-detail", run_loop($detailHidden$(open_0, hasDetail_0)))), { $: "Con", ["head"]: run_loop($view$viewEl$("div", run_loop($classHidden$("step-links", run_loop($linksEmpty$(links_0)))), run_loop($linkKids$(links_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("pre", run_loop($classHidden$("step-text", run_loop($String$is_empty$(text_0)))), { $: "Con", ["head"]: run_loop($view$viewText$(text_0)), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Nil" } } })), ["tail"]: { $: "Nil" } } } })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("span", { $: "Con", ["head"]: run_loop($view$attrClass$("step-status")), ["tail"]: { $: "Nil" } }, run_loop($statusKids$(run_loop($statusRunning$(status_0)))))), ["tail"]: { $: "Nil" } } } })), ["tail"]: { $: "Nil" } }]);
}
function $workStep$(step_0) {
  const id_0 = step_0.id;
  const kind_0 = step_0.kind;
  const status_0 = step_0.status;
  const open_0 = step_0.open;
  const hasDetail_0 = step_0.hasDetail;
  const label_0 = step_0.label;
  const time_0 = step_0.time;
  const preview_0 = step_0.preview;
  const text_0 = step_0.text;
  const links_0 = step_0.links;
  return run_jump($workStep$go$, [id_0, kind_0, status_0, open_0, hasDetail_0, label_0, time_0, preview_0, text_0, links_0]);
}
function $stepKids$(xs_0) {
  if (xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const h_0 = xs_0.head;
    const t_0 = xs_0.tail;
    return { $: "Con", ["head"]: run_loop($workStep$(h_0)), ["tail"]: run_loop($stepKids$(t_0)) };
  }
}
function $workSteps$(xs_0) {
  return run_jump($view$viewEl$, ["div", { $: "Con", ["head"]: run_loop($view$attrClass$("work-steps")), ["tail"]: { $: "Nil" } }, run_loop($stepKids$(xs_0))]);
}
function $workHead$kids$(live_0, title_0, meta_0) {
  return { $: "Con", ["head"]: run_loop($view$viewEl$("span", { $: "Con", ["head"]: run_loop($view$attrClass$("work-mark")), ["tail"]: { $: "Nil" } }, { $: "Nil" })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("span", { $: "Con", ["head"]: run_loop($view$attrClass$("work-title")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$(title_0)), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("span", { $: "Con", ["head"]: run_loop($view$attrClass$("work-meta")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$(meta_0)), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("span", run_loop($classHidden$("pulse work-dots", run_loop($isOff$(live_0)))), { $: "Nil" })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("span", { $: "Con", ["head"]: run_loop($view$attrClass$("work-chevron")), ["tail"]: { $: "Nil" } }, { $: "Nil" })), ["tail"]: { $: "Nil" } } } } } };
}
function $workHead$(live_0, expanded_0, title_0, meta_0) {
  return run_jump($view$viewEl$, ["button", run_loop($headAttrs$(expanded_0)), run_loop($workHead$kids$(live_0, title_0, meta_0))]);
}
function $workKids$(live_0, expanded_0, title_0, meta_0, steps_0) {
  return { $: "Con", ["head"]: run_loop($workHead$(live_0, expanded_0, title_0, meta_0)), ["tail"]: { $: "Con", ["head"]: run_loop($workSteps$(steps_0)), ["tail"]: { $: "Nil" } } };
}
function $workLog$go$(live_0, expanded_0, title_0, meta_0, steps_0) {
  return run_jump($view$viewEl$, ["article", run_loop($articleAttrs$(live_0, expanded_0)), run_loop($workKids$(live_0, expanded_0, title_0, meta_0, steps_0))]);
}
function $workLog$(row_0) {
  const live_0 = row_0.live;
  const expanded_0 = row_0.expanded;
  const title_0 = row_0.title;
  const meta_0 = row_0.meta;
  const steps_0 = row_0.steps;
  return run_jump($workLog$go$, [live_0, expanded_0, title_0, meta_0, steps_0]);
}
function $String$eq$(a_0, b_0) {
  return run_jump($String$eq$fin$, [run_loop($String$cmp$(a_0, b_0))]);
}
function $List$append$(xs_0, ys_0) {
  if (xs_0.$ === "Nil") {
    return ys_0;
  } else {
    const h_0 = xs_0.head;
    const t_0 = xs_0.tail;
    return { $: "Con", ["head"]: h_0, ["tail"]: run_loop($List$append$(t_0, ys_0)) };
  }
}
function $List$concat$(xss_0) {
  if (xss_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const h_0 = xss_0.head;
    const t_0 = xss_0.tail;
    return run_jump($List$append$, [h_0, run_loop($List$concat$(t_0))]);
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
function $String$join$(xs_0, sep_0) {
  if (xs_0.$ === "Nil") {
    return "";
  } else {
    const h_0 = xs_0.head;
    const t_0 = xs_0.tail;
    return run_jump($String$join$go$, [t_0, h_0, sep_0]);
  }
}
function $String$eq$fin$(r_0) {
  const _t_0 = r_0.fst;
  const a2_0 = _t_0.fst;
  const b2_0 = _t_0.snd;
  const c_0 = r_0.snd;
  return run_jump($Cmp$is_eq$, [c_0]);
}
function $String$cmp$(a_0, b_0) {
  if (a_0 === "") {
    if (b_0 === "") {
      return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: "", ["snd"]: "" }, ["snd"]: { $: "EQ" } };
    } else {
      const h_0 = b_0.codePointAt(0) > 65535 ? b_0.slice(0, 2) : b_0[0];
      const t_0 = b_0.codePointAt(0) > 65535 ? b_0.slice(2) : b_0.slice(1);
      return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: "", ["snd"]: h_0 + t_0 }, ["snd"]: { $: "LT" } };
    }
  } else {
    const h_1 = a_0.codePointAt(0) > 65535 ? a_0.slice(0, 2) : a_0[0];
    const t_1 = a_0.codePointAt(0) > 65535 ? a_0.slice(2) : a_0.slice(1);
    if (b_0 === "") {
      return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: h_1 + t_1, ["snd"]: "" }, ["snd"]: { $: "GT" } };
    } else {
      const h2_0 = b_0.codePointAt(0) > 65535 ? b_0.slice(0, 2) : b_0[0];
      const t2_0 = b_0.codePointAt(0) > 65535 ? b_0.slice(2) : b_0.slice(1);
      return run_jump($String$cmp$fin$, [t_1, t2_0, run_loop($Char$cmp$(h_1, h2_0))]);
    }
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
function $String$join$go$(xs_0, h_0, sep_0) {
  if (xs_0.$ === "Nil") {
    return h_0;
  } else {
    const h2_0 = xs_0.head;
    const t_0 = xs_0.tail;
    const x_0 = run_loop($String$join$go$(t_0, h2_0, sep_0));
    const x_1 = sep_0 + x_0;
    return h_0 + x_1;
  }
}
function $Cmp$is_eq$(c_0) {
  if (c_0.$ === "LT") {
    return false;
  } else if (c_0.$ === "EQ") {
    return true;
  } else {
    return false;
  }
}
function $String$cmp$fin$(t1_0, t2_0, hc_0) {
  const _t_0 = hc_0.fst;
  const h1b_0 = _t_0.fst;
  const h2b_0 = _t_0.snd;
  const _t_1 = hc_0.snd;
  if (_t_1.$ === "LT") {
    return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: h1b_0 + t1_0, ["snd"]: h2b_0 + t2_0 }, ["snd"]: { $: "LT" } };
  } else if (_t_1.$ === "EQ") {
    return run_jump($String$cmp$rec$, [h1b_0, h2b_0, run_loop($String$cmp$(t1_0, t2_0))]);
  } else {
    return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: h1b_0 + t1_0, ["snd"]: h2b_0 + t2_0 }, ["snd"]: { $: "GT" } };
  }
}
function $Char$cmp$(a_0, b_0) {
  const x_0 = a_0.codePointAt(0);
  const y_0 = b_0.codePointAt(0);
  const x_1 = x_0;
  const y_1 = y_0;
  return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: char_new(x_1), ["snd"]: char_new(y_1) }, ["snd"]: cmp_new(x_1, y_1) };
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
function $String$cmp$rec$(h1b_0, h2b_0, rr_0) {
  const _t_0 = rr_0.fst;
  const t1b_0 = _t_0.fst;
  const t2b_0 = _t_0.snd;
  const r_0 = rr_0.snd;
  return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: h1b_0 + t1b_0, ["snd"]: h2b_0 + t2b_0 }, ["snd"]: r_0 };
}
var worklogview_default = {
  "view.attr": run_lib($view$attr$, 2),
  "view.classOn": run_lib($view$classOn$, 2),
  "view.viewEl": run_lib($view$viewEl$, 3),
  "view.viewText": run_lib($view$viewText$, 1),
  "view.viewKey": run_lib($view$viewKey$, 4),
  "view.tagOf": run_lib($view$tagOf$, 1),
  "view.attrsOf": run_lib($view$attrsOf$, 1),
  "view.kidsOf": run_lib($view$kidsOf$, 1),
  "view.textOf": run_lib($view$textOf$, 1),
  "view.isEl": run_lib($view$isEl$, 1),
  "view.isText": run_lib($view$isText$, 1),
  "view.attrGet.choose": run_lib($view$attrGet$choose$, 3),
  "view.attrGet.go": run_lib($view$attrGet$go$, 2),
  "view.attrGet": run_lib($view$attrGet$, 2),
  "view.attrWhen": run_lib($view$attrWhen$, 2),
  "view.attrConcat": run_lib($view$attrConcat$, 2),
  "view.attrJoin": run_lib($view$attrJoin$, 1),
  "view.attrId": run_lib($view$attrId$, 1),
  "view.attrClass": run_lib($view$attrClass$, 1),
  "view.attrType": run_lib($view$attrType$, 1),
  "view.attrTitle": run_lib($view$attrTitle$, 1),
  "view.attrKey": run_lib($view$attrKey$, 1),
  "view.attrOn": run_lib($view$attrOn$, 2),
  "view.attrData": run_lib($view$attrData$, 2),
  "view.attrAria": run_lib($view$attrAria$, 2),
  "view.boolStr": run_lib($view$boolStr$, 1),
  "view.attrBool": run_lib($view$attrBool$, 2),
  "view.classAppend.empty": run_lib($view$classAppend$empty$, 3),
  "view.classAppend": run_lib($view$classAppend$, 2),
  "view.classNext.emptyName": run_lib($view$classNext$emptyName$, 3),
  "view.classNext.on": run_lib($view$classNext$on$, 3),
  "view.classValue.go": run_lib($view$classValue$go$, 2),
  "view.classValue": run_lib($view$classValue$, 1),
  "view.classes": run_lib($view$classes$, 1),
  "view.viewWhen": run_lib($view$viewWhen$, 2),
  "view.viewWhenAll": run_lib($view$viewWhenAll$, 2),
  "view.viewConcat": run_lib($view$viewConcat$, 2),
  "view.viewJoin": run_lib($view$viewJoin$, 1),
  "view.viewMap~0": run_lib($view$viewMap$0$, 1),
  "view.viewMapText": run_lib($view$viewMapText$, 1),
  "view.asTextI": run_lib($view$asTextI$, 2),
  "view.viewMapI.go~0": run_lib($view$viewMapI$go$0$, 2),
  "view.viewMapTextI.go": run_lib($view$viewMapTextI$go$, 2),
  "view.viewMapTextI": run_lib($view$viewMapTextI$, 1),
  "worklog.emptyPayload": run_lib($worklog$emptyPayload$, 0),
  "worklog.withText": run_lib($worklog$withText$, 2),
  "worklog.newThinking": run_lib($worklog$newThinking$, 3),
  "worklog.thinkId": run_lib($worklog$thinkId$, 1),
  "worklog.headHere": run_lib($worklog$headHere$, 2),
  "worklog.hasNeedle.go": run_lib($worklog$hasNeedle$go$, 3),
  "worklog.hasNeedle": run_lib($worklog$hasNeedle$, 2),
  "worklog.toLower.go": run_lib($worklog$toLower$go$, 2),
  "worklog.toLower": run_lib($worklog$toLower$, 1),
  "worklog.anyContains.go": run_lib($worklog$anyContains$go$, 3),
  "worklog.anyContains": run_lib($worklog$anyContains$, 2),
  "worklog.toolKind.fetch.if": run_lib($worklog$toolKind$fetch$if$, 2),
  "worklog.toolKind.fetch": run_lib($worklog$toolKind$fetch$, 1),
  "worklog.toolKind.search.if": run_lib($worklog$toolKind$search$if$, 2),
  "worklog.toolKind.search": run_lib($worklog$toolKind$search$, 1),
  "worklog.toolKind.ref": run_lib($worklog$toolKind$ref$, 2),
  "worklog.toolKind": run_lib($worklog$toolKind$, 1),
  "worklog.createLog": run_lib($worklog$createLog$, 1),
  "worklog.burst.last": run_lib($worklog$burst$last$, 4),
  "worklog.burst": run_lib($worklog$burst$, 4),
  "worklog.thinkingDelta.go": run_lib($worklog$thinkingDelta$go$, 3),
  "worklog.thinkingDelta.if": run_lib($worklog$thinkingDelta$if$, 4),
  "worklog.thinkingDelta": run_lib($worklog$thinkingDelta$, 3),
  "worklog.closeStep.running": run_lib($worklog$closeStep$running$, 6),
  "worklog.closeStep.status": run_lib($worklog$closeStep$status$, 7),
  "worklog.closeStep": run_lib($worklog$closeStep$, 2),
  "worklog.closeEach": run_lib($worklog$closeEach$, 2),
  "worklog.closeThinking": run_lib($worklog$closeThinking$, 2),
  "worklog.finishStep.running": run_lib($worklog$finishStep$running$, 6),
  "worklog.finishStep.status": run_lib($worklog$finishStep$status$, 7),
  "worklog.finishStep": run_lib($worklog$finishStep$, 2),
  "worklog.finishEach": run_lib($worklog$finishEach$, 2),
  "worklog.finishLog": run_lib($worklog$finishLog$, 3),
  "worklog.isRunningThinking.kind": run_lib($worklog$isRunningThinking$kind$, 1),
  "worklog.isRunningThinking.check": run_lib($worklog$isRunningThinking$check$, 2),
  "worklog.isRunningThinking": run_lib($worklog$isRunningThinking$, 1),
  "worklog.isRunning.status": run_lib($worklog$isRunning$status$, 1),
  "worklog.isRunning": run_lib($worklog$isRunning$, 1),
  "worklog.noRunningThinking.and": run_lib($worklog$noRunningThinking$and$, 2),
  "worklog.noRunningThinking": run_lib($worklog$noRunningThinking$, 1),
  kindName: run_lib($kindName$, 1),
  statusName: run_lib($statusName$, 1),
  statusRunning: run_lib($statusRunning$, 1),
  isOff: run_lib($isOff$, 1),
  both: run_lib($both$, 2),
  detailHidden: run_lib($detailHidden$, 2),
  attrHidden: run_lib($attrHidden$, 0),
  "hrefOf.empty": run_lib($hrefOf$empty$, 2),
  hrefOf: run_lib($hrefOf$, 1),
  articleAttrs: run_lib($articleAttrs$, 2),
  headAttrs: run_lib($headAttrs$, 1),
  stepAttrs: run_lib($stepAttrs$, 3),
  toggleAttrs: run_lib($toggleAttrs$, 2),
  classHidden: run_lib($classHidden$, 2),
  "domainKids.empty": run_lib($domainKids$empty$, 2),
  domainKids: run_lib($domainKids$, 1),
  "linkNode.go": run_lib($linkNode$go$, 3),
  linkNode: run_lib($linkNode$, 1),
  linkKids: run_lib($linkKids$, 1),
  linksEmpty: run_lib($linksEmpty$, 1),
  statusKids: run_lib($statusKids$, 1),
  "workStep.go": run_lib($workStep$go$, 10),
  workStep: run_lib($workStep$, 1),
  stepKids: run_lib($stepKids$, 1),
  workSteps: run_lib($workSteps$, 1),
  "workHead.kids": run_lib($workHead$kids$, 3),
  workHead: run_lib($workHead$, 4),
  workKids: run_lib($workKids$, 5),
  "workLog.go": run_lib($workLog$go$, 5),
  workLog: run_lib($workLog$, 1)
};
export {
  worklogview_default as default
};

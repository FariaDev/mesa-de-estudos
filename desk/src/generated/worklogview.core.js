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
function $view$attr$(_name_0, _value_0) {
  return { $: "ViewAttr", ["name"]: _name_0, ["value"]: _value_0 };
}
function $view$classOn$(_name_0, _on_0) {
  return { $: "ViewClass", ["name"]: _name_0, ["on"]: _on_0 };
}
function $view$viewEl$(_tag_0, _attrs_0, _kids_0) {
  return { $: "ViewEl", ["tag"]: _tag_0, ["attrs"]: _attrs_0, ["kids"]: _kids_0 };
}
function $view$viewText$(_s_0) {
  return { $: "ViewText", ["text"]: _s_0 };
}
function $view$viewKey$(_tag_0, _key_0, _attrs_0, _kids_0) {
  return run_jump($view$viewEl$, [_tag_0, { $: "Con", ["head"]: { $: "ViewAttr", ["name"]: "key", ["value"]: _key_0 }, ["tail"]: _attrs_0 }, _kids_0]);
}
function $view$tagOf$(_n_0) {
  if (_n_0.$ === "ViewEl") {
    const _tag_0 = _n_0["tag"];
    const _attrs_0 = _n_0["attrs"];
    const _kids_0 = _n_0["kids"];
    return _tag_0;
  } else {
    const _text_0 = _n_0["text"];
    return "";
  }
}
function $view$attrsOf$(_n_0) {
  if (_n_0.$ === "ViewEl") {
    const _tag_0 = _n_0["tag"];
    const _attrs_0 = _n_0["attrs"];
    const _kids_0 = _n_0["kids"];
    return _attrs_0;
  } else {
    const _text_0 = _n_0["text"];
    return { $: "Nil" };
  }
}
function $view$kidsOf$(_n_0) {
  if (_n_0.$ === "ViewEl") {
    const _tag_0 = _n_0["tag"];
    const _attrs_0 = _n_0["attrs"];
    const _kids_0 = _n_0["kids"];
    return _kids_0;
  } else {
    const _text_0 = _n_0["text"];
    return { $: "Nil" };
  }
}
function $view$textOf$(_n_0) {
  if (_n_0.$ === "ViewEl") {
    const _tag_0 = _n_0["tag"];
    const _attrs_0 = _n_0["attrs"];
    const _kids_0 = _n_0["kids"];
    return "";
  } else {
    const _text_0 = _n_0["text"];
    return _text_0;
  }
}
function $view$isEl$(_n_0) {
  if (_n_0.$ === "ViewEl") {
    const _tag_0 = _n_0["tag"];
    const _attrs_0 = _n_0["attrs"];
    const _kids_0 = _n_0["kids"];
    return true;
  } else {
    const _text_0 = _n_0["text"];
    return false;
  }
}
function $view$isText$(_n_0) {
  if (_n_0.$ === "ViewEl") {
    const _tag_0 = _n_0["tag"];
    const _attrs_0 = _n_0["attrs"];
    const _kids_0 = _n_0["kids"];
    return false;
  } else {
    const _text_0 = _n_0["text"];
    return true;
  }
}
function $view$attrGet$choose$(_av_0, _rest_0, _same_0) {
  if (_same_0) {
    return { $: "Some", ["value"]: _av_0 };
  } else {
    return _rest_0;
  }
}
function $view$attrGet$go$(_attrs_0, _name_0) {
  if (_attrs_0.$ === "Nil") {
    return { $: "None" };
  } else {
    const _t_0 = _attrs_0["head"];
    const _an_0 = _t_0["name"];
    const _av_0 = _t_0["value"];
    const _t_1 = _attrs_0["tail"];
    return run_jump($view$attrGet$choose$, [_av_0, run_loop($view$attrGet$go$(_t_1, _name_0)), run_loop($String$eq$(_an_0, _name_0))]);
  }
}
function $view$attrGet$(_attrs_0, _name_0) {
  return run_jump($view$attrGet$go$, [_attrs_0, _name_0]);
}
function $view$attrWhen$(_cond_0, _a_0) {
  if (_cond_0) {
    return { $: "Con", ["head"]: _a_0, ["tail"]: { $: "Nil" } };
  } else {
    return { $: "Nil" };
  }
}
function $view$attrConcat$(_xs_0, _ys_0) {
  return run_jump($List$append$, [_xs_0, _ys_0]);
}
function $view$attrJoin$(_xss_0) {
  return run_jump($List$concat$, [_xss_0]);
}
function $view$attrId$(_value_0) {
  return { $: "ViewAttr", ["name"]: "id", ["value"]: _value_0 };
}
function $view$attrClass$(_value_0) {
  return { $: "ViewAttr", ["name"]: "class", ["value"]: _value_0 };
}
function $view$attrType$(_value_0) {
  return { $: "ViewAttr", ["name"]: "type", ["value"]: _value_0 };
}
function $view$attrTitle$(_value_0) {
  return { $: "ViewAttr", ["name"]: "title", ["value"]: _value_0 };
}
function $view$attrKey$(_value_0) {
  return { $: "ViewAttr", ["name"]: "key", ["value"]: _value_0 };
}
function $view$attrOn$(_event_0, _handler_0) {
  return { $: "ViewAttr", ["name"]: "on:" + _event_0, ["value"]: _handler_0 };
}
function $view$attrData$(_name_0, _value_0) {
  return { $: "ViewAttr", ["name"]: "data-" + _name_0, ["value"]: _value_0 };
}
function $view$attrAria$(_name_0, _value_0) {
  return { $: "ViewAttr", ["name"]: "aria-" + _name_0, ["value"]: _value_0 };
}
function $view$boolStr$(_on_0) {
  if (_on_0) {
    return "true";
  } else {
    return "false";
  }
}
function $view$attrBool$(_name_0, _on_0) {
  return { $: "ViewAttr", ["name"]: _name_0, ["value"]: run_loop($view$boolStr$(_on_0)) };
}
function $view$classAppend$empty$(_acc_0, _name_0, _empty_0) {
  if (_empty_0) {
    return _name_0;
  } else {
    const _x_0 = " " + _name_0;
    return _acc_0 + _x_0;
  }
}
function $view$classAppend$(_acc_0, _name_0) {
  return run_jump($view$classAppend$empty$, [_acc_0, _name_0, run_loop($String$is_empty$(_acc_0))]);
}
function $view$classNext$emptyName$(_name_0, _acc_0, _emptyName_0) {
  if (_emptyName_0) {
    return _acc_0;
  } else {
    return run_jump($view$classAppend$, [_acc_0, _name_0]);
  }
}
function $view$classNext$on$(_name_0, _on_0, _acc_0) {
  if (!_on_0) {
    return _acc_0;
  } else {
    return run_jump($view$classNext$emptyName$, [_name_0, _acc_0, run_loop($String$is_empty$(_name_0))]);
  }
}
function $view$classValue$go$(_xs_0, _acc_0) {
  if (_xs_0.$ === "Nil") {
    return _acc_0;
  } else {
    const _t_0 = _xs_0["head"];
    const _name_0 = _t_0["name"];
    const _on_0 = _t_0["on"];
    const _t_1 = _xs_0["tail"];
    return run_jump($view$classValue$go$, [_t_1, run_loop($view$classNext$on$(_name_0, _on_0, _acc_0))]);
  }
}
function $view$classValue$(_xs_0) {
  return run_jump($view$classValue$go$, [_xs_0, ""]);
}
function $view$classes$(_xs_0) {
  return { $: "ViewAttr", ["name"]: "class", ["value"]: run_loop($view$classValue$(_xs_0)) };
}
function $view$viewWhen$(_cond_0, _node_0) {
  if (_cond_0) {
    return { $: "Con", ["head"]: _node_0, ["tail"]: { $: "Nil" } };
  } else {
    return { $: "Nil" };
  }
}
function $view$viewWhenAll$(_cond_0, _nodes_0) {
  if (_cond_0) {
    return _nodes_0;
  } else {
    return { $: "Nil" };
  }
}
function $view$viewConcat$(_xs_0, _ys_0) {
  return run_jump($List$append$, [_xs_0, _ys_0]);
}
function $view$viewJoin$(_xss_0) {
  return run_jump($List$concat$, [_xss_0]);
}
function $view$viewMapText$(_xs_0) {
  return run_jump($view$viewMap$0$, [_xs_0]);
}
function $view$asTextI$(_i_0, _s_0) {
  return run_jump($view$viewText$, [_s_0]);
}
function $view$viewMapTextI$go$(_xs_0, _i_0) {
  return run_jump($view$viewMapI$go$0$, [_xs_0, _i_0]);
}
function $view$viewMapTextI$(_xs_0) {
  return run_jump($view$viewMapTextI$go$, [_xs_0, 0n]);
}
function $worklog$emptyPayload$() {
  return { $: "Payload", ["text"]: "", ["toolName"]: "", ["argsJson"]: "", ["query"]: "", ["url"]: "", ["domain"]: "", ["pageTitle"]: "", ["hits"]: { $: "Nil" }, ["resultText"]: "", ["error"]: "" };
}
function $worklog$withText$(_p_0, _delta_0) {
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
function $worklog$newThinking$(_id_0, _now_0, _delta_0) {
  return { $: "Step", ["id"]: _id_0, ["status"]: { $: "Status.Running" }, ["kind"]: { $: "Thinking" }, ["startedAt"]: _now_0, ["endedAt"]: 0n, ["payload"]: run_loop($worklog$withText$(run_loop($worklog$emptyPayload$()), _delta_0)) };
}
function $worklog$thinkId$(_n_0) {
  const _x_0 = run_loop($Nat$show$(nat_chk(_n_0 + 1n)));
  return "pensar-" + _x_0;
}
function $worklog$headHere$(_s_0, _needle_0) {
  if (_s_0 === "") {
    return false;
  } else {
    const _h_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(0, 2) : _s_0[0];
    const _t_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(2) : _s_0.slice(1);
    return run_jump($String$starts_with$, [_h_0 + _t_0, _needle_0]);
  }
}
function $worklog$hasNeedle$go$(_s_0, _here_0, _needle_0) {
  if (_s_0 === "") {
    return run_jump($String$is_empty$, [_needle_0]);
  } else {
    const _h_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(0, 2) : _s_0[0];
    const _t_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(2) : _s_0.slice(1);
    if (_here_0) {
      return true;
    } else {
      return run_jump($worklog$hasNeedle$go$, [_t_0, run_loop($worklog$headHere$(_t_0, _needle_0)), _needle_0]);
    }
  }
}
function $worklog$hasNeedle$(_s_0, _needle_0) {
  return run_jump($worklog$hasNeedle$go$, [_s_0, run_loop($worklog$headHere$(_s_0, _needle_0)), _needle_0]);
}
function $worklog$toLower$go$(_s_0, _acc_0) {
  if (_s_0 === "") {
    return run_jump($String$reverse$, [_acc_0]);
  } else {
    const _h_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(0, 2) : _s_0[0];
    const _t_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(2) : _s_0.slice(1);
    return run_jump($worklog$toLower$go$, [_t_0, run_loop($Char$to_lower$(_h_0)) + _acc_0]);
  }
}
function $worklog$toLower$(_s_0) {
  return run_jump($worklog$toLower$go$, [_s_0, ""]);
}
function $worklog$anyContains$go$(_n_0, _needles_0, _found_0) {
  if (_needles_0.$ === "Nil") {
    return _found_0;
  } else {
    const _h_0 = _needles_0["head"];
    const _t_0 = _needles_0["tail"];
    const _x_0 = run_loop($worklog$hasNeedle$(_n_0, _h_0));
    return run_jump($worklog$anyContains$go$, [_n_0, _t_0, _found_0 || _x_0]);
  }
}
function $worklog$anyContains$(_n_0, _needles_0) {
  return run_jump($worklog$anyContains$go$, [_n_0, _needles_0, false]);
}
function $worklog$toolKind$fetch$if$(_n_0, _fetch_0) {
  if (_fetch_0) {
    return { $: "Fetch" };
  } else {
    return { $: "Tool" };
  }
}
function $worklog$toolKind$fetch$(_n_0) {
  return run_jump($worklog$toolKind$fetch$if$, [_n_0, run_loop($worklog$anyContains$(_n_0, { $: "Con", ["head"]: "fetch", ["tail"]: { $: "Con", ["head"]: "reader", ["tail"]: { $: "Con", ["head"]: "http", ["tail"]: { $: "Con", ["head"]: "url", ["tail"]: { $: "Con", ["head"]: "page", ["tail"]: { $: "Nil" } } } } } }))]);
}
function $worklog$toolKind$search$if$(_n_0, _search_0) {
  if (_search_0) {
    return { $: "Search" };
  } else {
    return run_jump($worklog$toolKind$fetch$, [_n_0]);
  }
}
function $worklog$toolKind$search$(_n_0) {
  return run_jump($worklog$toolKind$search$if$, [_n_0, run_loop($worklog$anyContains$(_n_0, { $: "Con", ["head"]: "search", ["tail"]: { $: "Con", ["head"]: "busca", ["tail"]: { $: "Nil" } } }))]);
}
function $worklog$toolKind$ref$(_n_0, _ref_0) {
  if (_ref_0) {
    return { $: "Reference" };
  } else {
    return run_jump($worklog$toolKind$search$, [_n_0]);
  }
}
function $worklog$toolKind$(_name_0) {
  const _n_0 = run_loop($worklog$toLower$(_name_0));
  return run_jump($worklog$toolKind$ref$, [_n_0, run_loop($worklog$anyContains$(_n_0, { $: "Con", ["head"]: "reference", ["tail"]: { $: "Nil" } }))]);
}
function $worklog$createLog$(_now_0) {
  return { $: "Log", ["startedAt"]: _now_0, ["endedAt"]: 0n, ["reason"]: "", ["text"]: "", ["steps"]: { $: "Nil" } };
}
function $worklog$burst$last$(_h_0, _delta_0, _now_0, _n_0) {
  const _id_0 = _h_0["id"];
  const _t_0 = _h_0["status"];
  if (_t_0.$ === "Status.Running") {
    const _t_1 = _h_0["kind"];
    if (_t_1.$ === "Thinking") {
      const _startedAt_0 = _h_0["startedAt"];
      const _endedAt_0 = _h_0["endedAt"];
      const _payload_0 = _h_0["payload"];
      return { $: "Con", ["head"]: { $: "Step", ["id"]: _id_0, ["status"]: { $: "Status.Running" }, ["kind"]: { $: "Thinking" }, ["startedAt"]: _startedAt_0, ["endedAt"]: _endedAt_0, ["payload"]: run_loop($worklog$withText$(_payload_0, _delta_0)) }, ["tail"]: { $: "Nil" } };
    } else {
      const _startedAt_1 = _h_0["startedAt"];
      const _endedAt_1 = _h_0["endedAt"];
      const _payload_1 = _h_0["payload"];
      return { $: "Con", ["head"]: { $: "Step", ["id"]: _id_0, ["status"]: { $: "Status.Running" }, ["kind"]: _t_1, ["startedAt"]: _startedAt_1, ["endedAt"]: _endedAt_1, ["payload"]: _payload_1 }, ["tail"]: { $: "Con", ["head"]: run_loop($worklog$newThinking$(run_loop($worklog$thinkId$(_n_0)), _now_0, _delta_0)), ["tail"]: { $: "Nil" } } };
    }
  } else {
    const _kind_0 = _h_0["kind"];
    const _startedAt_2 = _h_0["startedAt"];
    const _endedAt_2 = _h_0["endedAt"];
    const _payload_2 = _h_0["payload"];
    return { $: "Con", ["head"]: { $: "Step", ["id"]: _id_0, ["status"]: _t_0, ["kind"]: _kind_0, ["startedAt"]: _startedAt_2, ["endedAt"]: _endedAt_2, ["payload"]: _payload_2 }, ["tail"]: { $: "Con", ["head"]: run_loop($worklog$newThinking$(run_loop($worklog$thinkId$(_n_0)), _now_0, _delta_0)), ["tail"]: { $: "Nil" } } };
  }
}
function $worklog$burst$(_xs_0, _delta_0, _now_0, _n_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Con", ["head"]: run_loop($worklog$newThinking$(run_loop($worklog$thinkId$(_n_0)), _now_0, _delta_0)), ["tail"]: { $: "Nil" } };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    if (_t_0.$ === "Nil") {
      return run_jump($worklog$burst$last$, [_h_0, _delta_0, _now_0, _n_0]);
    } else {
      const __0 = _t_0["head"];
      const __1 = _t_0["tail"];
      return { $: "Con", ["head"]: _h_0, ["tail"]: run_loop($worklog$burst$({ $: "Con", ["head"]: __0, ["tail"]: __1 }, _delta_0, _now_0, _n_0)) };
    }
  }
}
function $worklog$thinkingDelta$go$(_log_0, _delta_0, _now_0) {
  const _startedAt_0 = _log_0["startedAt"];
  const _endedAt_0 = _log_0["endedAt"];
  const _reason_0 = _log_0["reason"];
  const _text_0 = _log_0["text"];
  const _steps_0 = _log_0["steps"];
  const _n_0 = run_loop($List$length$(_steps_0));
  return { $: "Log", ["startedAt"]: _startedAt_0, ["endedAt"]: _endedAt_0, ["reason"]: _reason_0, ["text"]: _text_0, ["steps"]: run_loop($worklog$burst$(_steps_0, _delta_0, _now_0, _n_0)) };
}
function $worklog$thinkingDelta$if$(_log_0, _delta_0, _now_0, _empty_0) {
  if (_empty_0) {
    return _log_0;
  } else {
    return run_jump($worklog$thinkingDelta$go$, [_log_0, _delta_0, _now_0]);
  }
}
function $worklog$thinkingDelta$(_log_0, _delta_0, _now_0) {
  const _d_0 = _delta_0;
  return run_jump($worklog$thinkingDelta$if$, [_log_0, _d_0, _now_0, run_loop($String$is_empty$(_d_0))]);
}
function $worklog$closeStep$running$(_id_0, _kind_0, _startedAt_0, _endedAt_0, _payload_0, _now_0) {
  if (_kind_0.$ === "Thinking") {
    return { $: "Step", ["id"]: _id_0, ["status"]: { $: "Status.Done" }, ["kind"]: { $: "Thinking" }, ["startedAt"]: _startedAt_0, ["endedAt"]: _now_0, ["payload"]: _payload_0 };
  } else {
    return { $: "Step", ["id"]: _id_0, ["status"]: { $: "Status.Running" }, ["kind"]: _kind_0, ["startedAt"]: _startedAt_0, ["endedAt"]: _endedAt_0, ["payload"]: _payload_0 };
  }
}
function $worklog$closeStep$status$(_id_0, _status_0, _kind_0, _startedAt_0, _endedAt_0, _payload_0, _now_0) {
  if (_status_0.$ === "Status.Running") {
    return run_jump($worklog$closeStep$running$, [_id_0, _kind_0, _startedAt_0, _endedAt_0, _payload_0, _now_0]);
  } else {
    return { $: "Step", ["id"]: _id_0, ["status"]: _status_0, ["kind"]: _kind_0, ["startedAt"]: _startedAt_0, ["endedAt"]: _endedAt_0, ["payload"]: _payload_0 };
  }
}
function $worklog$closeStep$(_s_0, _now_0) {
  const _id_0 = _s_0["id"];
  const _status_0 = _s_0["status"];
  const _kind_0 = _s_0["kind"];
  const _startedAt_0 = _s_0["startedAt"];
  const _endedAt_0 = _s_0["endedAt"];
  const _payload_0 = _s_0["payload"];
  return run_jump($worklog$closeStep$status$, [_id_0, _status_0, _kind_0, _startedAt_0, _endedAt_0, _payload_0, _now_0]);
}
function $worklog$closeEach$(_xs_0, _now_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return { $: "Con", ["head"]: run_loop($worklog$closeStep$(_h_0, _now_0)), ["tail"]: run_loop($worklog$closeEach$(_t_0, _now_0)) };
  }
}
function $worklog$closeThinking$(_log_0, _now_0) {
  const _startedAt_0 = _log_0["startedAt"];
  const _endedAt_0 = _log_0["endedAt"];
  const _reason_0 = _log_0["reason"];
  const _text_0 = _log_0["text"];
  const _steps_0 = _log_0["steps"];
  return { $: "Log", ["startedAt"]: _startedAt_0, ["endedAt"]: _endedAt_0, ["reason"]: _reason_0, ["text"]: _text_0, ["steps"]: run_loop($worklog$closeEach$(_steps_0, _now_0)) };
}
function $worklog$finishStep$running$(_id_0, _kind_0, _startedAt_0, _endedAt_0, _payload_0, _now_0) {
  if (_kind_0.$ === "Thinking") {
    return { $: "Step", ["id"]: _id_0, ["status"]: { $: "Status.Done" }, ["kind"]: { $: "Thinking" }, ["startedAt"]: _startedAt_0, ["endedAt"]: _now_0, ["payload"]: _payload_0 };
  } else {
    return { $: "Step", ["id"]: _id_0, ["status"]: { $: "Status.Stopped" }, ["kind"]: _kind_0, ["startedAt"]: _startedAt_0, ["endedAt"]: _now_0, ["payload"]: _payload_0 };
  }
}
function $worklog$finishStep$status$(_id_0, _status_0, _kind_0, _startedAt_0, _endedAt_0, _payload_0, _now_0) {
  if (_status_0.$ === "Status.Running") {
    return run_jump($worklog$finishStep$running$, [_id_0, _kind_0, _startedAt_0, _endedAt_0, _payload_0, _now_0]);
  } else {
    return { $: "Step", ["id"]: _id_0, ["status"]: _status_0, ["kind"]: _kind_0, ["startedAt"]: _startedAt_0, ["endedAt"]: _endedAt_0, ["payload"]: _payload_0 };
  }
}
function $worklog$finishStep$(_s_0, _now_0) {
  const _id_0 = _s_0["id"];
  const _status_0 = _s_0["status"];
  const _kind_0 = _s_0["kind"];
  const _startedAt_0 = _s_0["startedAt"];
  const _endedAt_0 = _s_0["endedAt"];
  const _payload_0 = _s_0["payload"];
  return run_jump($worklog$finishStep$status$, [_id_0, _status_0, _kind_0, _startedAt_0, _endedAt_0, _payload_0, _now_0]);
}
function $worklog$finishEach$(_xs_0, _now_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return { $: "Con", ["head"]: run_loop($worklog$finishStep$(_h_0, _now_0)), ["tail"]: run_loop($worklog$finishEach$(_t_0, _now_0)) };
  }
}
function $worklog$finishLog$(_log_0, _now_0, _reason_0) {
  const _startedAt_0 = _log_0["startedAt"];
  const _endedAt_0 = _log_0["endedAt"];
  const __0 = _log_0["reason"];
  const _text_0 = _log_0["text"];
  const _steps_0 = _log_0["steps"];
  const _n_0 = _now_0;
  return { $: "Log", ["startedAt"]: _startedAt_0, ["endedAt"]: _n_0, ["reason"]: _reason_0, ["text"]: _text_0, ["steps"]: run_loop($worklog$finishEach$(_steps_0, _n_0)) };
}
function $worklog$isRunningThinking$kind$(_kind_0) {
  if (_kind_0.$ === "Thinking") {
    return true;
  } else {
    return false;
  }
}
function $worklog$isRunningThinking$check$(_kind_0, _status_0) {
  if (_status_0.$ === "Status.Running") {
    return run_jump($worklog$isRunningThinking$kind$, [_kind_0]);
  } else {
    return false;
  }
}
function $worklog$isRunningThinking$(_s_0) {
  const _id_0 = _s_0["id"];
  const _status_0 = _s_0["status"];
  const _kind_0 = _s_0["kind"];
  const _startedAt_0 = _s_0["startedAt"];
  const _endedAt_0 = _s_0["endedAt"];
  const _payload_0 = _s_0["payload"];
  return run_jump($worklog$isRunningThinking$check$, [_kind_0, _status_0]);
}
function $worklog$isRunning$status$(_status_0) {
  if (_status_0.$ === "Status.Running") {
    return true;
  } else {
    return false;
  }
}
function $worklog$isRunning$(_s_0) {
  const _id_0 = _s_0["id"];
  const _status_0 = _s_0["status"];
  const _kind_0 = _s_0["kind"];
  const _startedAt_0 = _s_0["startedAt"];
  const _endedAt_0 = _s_0["endedAt"];
  const _payload_0 = _s_0["payload"];
  return run_jump($worklog$isRunning$status$, [_status_0]);
}
function $worklog$noRunningThinking$and$(_running_0, _rest_0) {
  if (_running_0) {
    return false;
  } else {
    return _rest_0;
  }
}
function $worklog$noRunningThinking$(_xs_0) {
  if (_xs_0.$ === "Nil") {
    return true;
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return run_jump($worklog$noRunningThinking$and$, [run_loop($worklog$isRunningThinking$(_h_0)), run_loop($worklog$noRunningThinking$(_t_0))]);
  }
}
function $kindName$(_kind_0) {
  if (_kind_0.$ === "Thinking") {
    return "thinking";
  } else if (_kind_0.$ === "Search") {
    return "search";
  } else if (_kind_0.$ === "Reference") {
    return "reference";
  } else if (_kind_0.$ === "Fetch") {
    return "fetch";
  } else if (_kind_0.$ === "Tool") {
    return "tool";
  } else {
    return "error";
  }
}
function $statusName$(_status_0) {
  if (_status_0.$ === "Status.Running") {
    return "running";
  } else if (_status_0.$ === "Status.Done") {
    return "done";
  } else if (_status_0.$ === "Status.Stopped") {
    return "stopped";
  } else {
    return "error";
  }
}
function $statusRunning$(_status_0) {
  if (_status_0.$ === "Status.Running") {
    return true;
  } else {
    return false;
  }
}
function $isOff$(_on_0) {
  if (_on_0) {
    return false;
  } else {
    return true;
  }
}
function $both$(_a_0, _b_0) {
  if (!_a_0) {
    return false;
  } else {
    return _b_0;
  }
}
function $detailHidden$(_open_0, _hasDetail_0) {
  if (!_hasDetail_0) {
    return true;
  } else {
    return run_jump($isOff$, [_open_0]);
  }
}
function $previewHidden$(_open_0, _previewEmpty_0) {
  if (_open_0) {
    return true;
  } else {
    return _previewEmpty_0;
  }
}
function $attrHidden$() {
  return { $: "ViewAttr", ["name"]: "hidden", ["value"]: "" };
}
function $hrefOf$empty$(_url_0, _empty_0) {
  if (_empty_0) {
    return "#";
  } else {
    return _url_0;
  }
}
function $hrefOf$(_url_0) {
  return run_jump($hrefOf$empty$, [_url_0, run_loop($String$is_empty$(_url_0))]);
}
function $articleAttrs$(_live_0, _expanded_0) {
  return { $: "Con", ["head"]: run_loop($view$attrClass$("work")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("live", run_loop($view$boolStr$(_live_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("expanded", run_loop($view$boolStr$(_expanded_0)))), ["tail"]: { $: "Nil" } } } };
}
function $headAttrs$(_expanded_0) {
  return { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrClass$("work-head")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrKey$("work-head")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("expanded", run_loop($view$boolStr$(_expanded_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "toggleWork")), ["tail"]: { $: "Nil" } } } } } };
}
function $stepAttrs$(_kind_0, _status_0, _hasDetail_0) {
  return { $: "Con", ["head"]: run_loop($view$attrClass$("work-step")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("kind", _kind_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("status", _status_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("detail", run_loop($view$boolStr$(_hasDetail_0)))), ["tail"]: { $: "Nil" } } } } };
}
function $toggleAttrs$(_id_0, _open_0) {
  return { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrClass$("step-toggle")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrKey$(run_loop($String$join$({ $: "Con", ["head"]: "step-toggle-", ["tail"]: { $: "Con", ["head"]: _id_0, ["tail"]: { $: "Nil" } } }, "")))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("expanded", run_loop($view$boolStr$(_open_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "toggleStep")), ["tail"]: { $: "Nil" } } } } } };
}
function $classHidden$(_className_0, _hide_0) {
  return run_jump($view$attrConcat$, [{ $: "Con", ["head"]: run_loop($view$attrClass$(_className_0)), ["tail"]: { $: "Nil" } }, run_loop($view$attrWhen$(_hide_0, run_loop($attrHidden$())))]);
}
function $domainKids$empty$(_domain_0, _empty_0) {
  if (_empty_0) {
    return { $: "Nil" };
  } else {
    return { $: "Con", ["head"]: run_loop($view$viewText$(" ")), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("span", { $: "Con", ["head"]: run_loop($view$attrClass$("step-domain")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$(_domain_0)), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Nil" } } };
  }
}
function $domainKids$(_domain_0) {
  return run_jump($domainKids$empty$, [_domain_0, run_loop($String$is_empty$(_domain_0))]);
}
function $linkNode$go$(_title_0, _url_0, _domain_0) {
  return run_jump($view$viewEl$, ["a", { $: "Con", ["head"]: run_loop($view$attrClass$("step-link")), ["tail"]: { $: "Con", ["head"]: { $: "ViewAttr", ["name"]: "href", ["value"]: run_loop($hrefOf$(_url_0)) }, ["tail"]: { $: "Con", ["head"]: { $: "ViewAttr", ["name"]: "rel", ["value"]: "noreferrer" }, ["tail"]: { $: "Nil" } } } }, run_loop($view$viewConcat$({ $: "Con", ["head"]: run_loop($view$viewText$(_title_0)), ["tail"]: { $: "Nil" } }, run_loop($domainKids$(_domain_0))))]);
}
function $linkNode$(_link_0) {
  const _title_0 = _link_0["title"];
  const _url_0 = _link_0["url"];
  const _domain_0 = _link_0["domain"];
  return run_jump($linkNode$go$, [_title_0, _url_0, _domain_0]);
}
function $linkKids$(_xs_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return { $: "Con", ["head"]: run_loop($linkNode$(_h_0)), ["tail"]: run_loop($linkKids$(_t_0)) };
  }
}
function $linksEmpty$(_xs_0) {
  if (_xs_0.$ === "Nil") {
    return true;
  } else {
    const __0 = _xs_0["head"];
    const __1 = _xs_0["tail"];
    return false;
  }
}
function $statusKids$(_running_0) {
  if (_running_0) {
    return { $: "Con", ["head"]: run_loop($view$viewEl$("span", { $: "Con", ["head"]: run_loop($view$attrClass$("step-spin")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("hidden", "true")), ["tail"]: { $: "Nil" } } }, { $: "Nil" })), ["tail"]: { $: "Nil" } };
  } else {
    return { $: "Nil" };
  }
}
function $workStep$go$(_id_0, _kind_0, _status_0, _open_0, _hasDetail_0, _label_0, _time_0, _preview_0, _text_0, _links_0) {
  const _expandedOn_0 = run_loop($both$(_hasDetail_0, _open_0));
  return run_jump($view$viewKey$, ["div", _id_0, run_loop($stepAttrs$(run_loop($kindName$(_kind_0)), run_loop($statusName$(_status_0)), _hasDetail_0)), { $: "Con", ["head"]: run_loop($view$viewEl$("button", run_loop($toggleAttrs$(_id_0, _expandedOn_0)), { $: "Con", ["head"]: run_loop($view$viewEl$("span", { $: "Con", ["head"]: run_loop($view$attrClass$("step-icon")), ["tail"]: { $: "Nil" } }, { $: "Nil" })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("div", { $: "Con", ["head"]: run_loop($view$attrClass$("step-main")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewEl$("div", { $: "Con", ["head"]: run_loop($view$attrClass$("step-line")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewEl$("span", { $: "Con", ["head"]: run_loop($view$attrClass$("step-label")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$(_label_0)), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("span", { $: "Con", ["head"]: run_loop($view$attrClass$("step-time")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$(_time_0)), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Nil" } } })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("div", run_loop($classHidden$("step-preview", run_loop($previewHidden$(_expandedOn_0, run_loop($String$is_empty$(_preview_0)))))), { $: "Con", ["head"]: run_loop($view$viewText$(_preview_0)), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("div", run_loop($classHidden$("step-detail", run_loop($detailHidden$(_open_0, _hasDetail_0)))), { $: "Con", ["head"]: run_loop($view$viewEl$("div", run_loop($classHidden$("step-links", run_loop($linksEmpty$(_links_0)))), run_loop($linkKids$(_links_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("pre", run_loop($classHidden$("step-text", run_loop($String$is_empty$(_text_0)))), { $: "Con", ["head"]: run_loop($view$viewText$(_text_0)), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Nil" } } })), ["tail"]: { $: "Nil" } } } })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("span", { $: "Con", ["head"]: run_loop($view$attrClass$("step-status")), ["tail"]: { $: "Nil" } }, run_loop($statusKids$(run_loop($statusRunning$(_status_0)))))), ["tail"]: { $: "Nil" } } } })), ["tail"]: { $: "Nil" } }]);
}
function $workStep$(_step_0) {
  const _id_0 = _step_0["id"];
  const _kind_0 = _step_0["kind"];
  const _status_0 = _step_0["status"];
  const _open_0 = _step_0["open"];
  const _hasDetail_0 = _step_0["hasDetail"];
  const _label_0 = _step_0["label"];
  const _time_0 = _step_0["time"];
  const _preview_0 = _step_0["preview"];
  const _text_0 = _step_0["text"];
  const _links_0 = _step_0["links"];
  return run_jump($workStep$go$, [_id_0, _kind_0, _status_0, _open_0, _hasDetail_0, _label_0, _time_0, _preview_0, _text_0, _links_0]);
}
function $stepKids$(_xs_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return { $: "Con", ["head"]: run_loop($workStep$(_h_0)), ["tail"]: run_loop($stepKids$(_t_0)) };
  }
}
function $workSteps$(_xs_0) {
  return run_jump($view$viewEl$, ["div", { $: "Con", ["head"]: run_loop($view$attrClass$("work-steps")), ["tail"]: { $: "Nil" } }, run_loop($stepKids$(_xs_0))]);
}
function $workHead$kids$(_live_0, _title_0, _meta_0) {
  return { $: "Con", ["head"]: run_loop($view$viewEl$("span", { $: "Con", ["head"]: run_loop($view$attrClass$("work-mark")), ["tail"]: { $: "Nil" } }, { $: "Nil" })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("span", { $: "Con", ["head"]: run_loop($view$attrClass$("work-title")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$(_title_0)), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("span", { $: "Con", ["head"]: run_loop($view$attrClass$("work-meta")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$(_meta_0)), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("span", run_loop($classHidden$("pulse work-dots", run_loop($isOff$(_live_0)))), { $: "Nil" })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("span", { $: "Con", ["head"]: run_loop($view$attrClass$("work-chevron")), ["tail"]: { $: "Nil" } }, { $: "Nil" })), ["tail"]: { $: "Nil" } } } } } };
}
function $workHead$(_live_0, _expanded_0, _title_0, _meta_0) {
  return run_jump($view$viewEl$, ["button", run_loop($headAttrs$(_expanded_0)), run_loop($workHead$kids$(_live_0, _title_0, _meta_0))]);
}
function $workKids$(_live_0, _expanded_0, _title_0, _meta_0, _steps_0) {
  return { $: "Con", ["head"]: run_loop($workHead$(_live_0, _expanded_0, _title_0, _meta_0)), ["tail"]: { $: "Con", ["head"]: run_loop($workSteps$(_steps_0)), ["tail"]: { $: "Nil" } } };
}
function $workLog$go$(_live_0, _expanded_0, _title_0, _meta_0, _steps_0) {
  return run_jump($view$viewEl$, ["article", run_loop($articleAttrs$(_live_0, _expanded_0)), run_loop($workKids$(_live_0, _expanded_0, _title_0, _meta_0, _steps_0))]);
}
function $workLog$(_row_0) {
  const _live_0 = _row_0["live"];
  const _expanded_0 = _row_0["expanded"];
  const _title_0 = _row_0["title"];
  const _meta_0 = _row_0["meta"];
  const _steps_0 = _row_0["steps"];
  return run_jump($workLog$go$, [_live_0, _expanded_0, _title_0, _meta_0, _steps_0]);
}
function $String$eq$(_a_0, _b_0) {
  return run_jump($String$eq$fin$, [run_loop($String$cmp$(_a_0, _b_0))]);
}
function $List$append$(_xs_0, _ys_0) {
  if (_xs_0.$ === "Nil") {
    return _ys_0;
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return { $: "Con", ["head"]: _h_0, ["tail"]: run_loop($List$append$(_t_0, _ys_0)) };
  }
}
function $List$concat$(_xss_0) {
  if (_xss_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xss_0["head"];
    const _t_0 = _xss_0["tail"];
    return run_jump($List$append$, [_h_0, run_loop($List$concat$(_t_0))]);
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
function $view$viewMap$0$(_xs_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return { $: "Con", ["head"]: run_loop($view$viewText$(_h_0)), ["tail"]: run_loop($view$viewMap$0$(_t_0)) };
  }
}
function $view$viewMapI$go$0$(_xs_0, _i_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return { $: "Con", ["head"]: run_loop($view$asTextI$(_i_0, _h_0)), ["tail"]: run_loop($view$viewMapI$go$0$(_t_0, nat_chk(_i_0 + 1n))) };
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
function $String$join$(_xs_0, _sep_0) {
  if (_xs_0.$ === "Nil") {
    return "";
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return run_jump($String$join$go$, [_t_0, _h_0, _sep_0]);
  }
}
function $String$eq$fin$(_r_0) {
  const _t_0 = _r_0["fst"];
  const _a2_0 = _t_0["fst"];
  const _b2_0 = _t_0["snd"];
  const _c_0 = _r_0["snd"];
  return run_jump($Cmp$is_eq$, [_c_0]);
}
function $String$cmp$(_a_0, _b_0) {
  if (_a_0 === "") {
    if (_b_0 === "") {
      return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: "", ["snd"]: "" }, ["snd"]: { $: "EQ" } };
    } else {
      const _h_0 = _b_0.codePointAt(0) > 65535 ? _b_0.slice(0, 2) : _b_0[0];
      const _t_0 = _b_0.codePointAt(0) > 65535 ? _b_0.slice(2) : _b_0.slice(1);
      return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: "", ["snd"]: _h_0 + _t_0 }, ["snd"]: { $: "LT" } };
    }
  } else {
    const _h_1 = _a_0.codePointAt(0) > 65535 ? _a_0.slice(0, 2) : _a_0[0];
    const _t_1 = _a_0.codePointAt(0) > 65535 ? _a_0.slice(2) : _a_0.slice(1);
    if (_b_0 === "") {
      return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: _h_1 + _t_1, ["snd"]: "" }, ["snd"]: { $: "GT" } };
    } else {
      const _h2_0 = _b_0.codePointAt(0) > 65535 ? _b_0.slice(0, 2) : _b_0[0];
      const _t2_0 = _b_0.codePointAt(0) > 65535 ? _b_0.slice(2) : _b_0.slice(1);
      return run_jump($String$cmp$fin$, [_t_1, _t2_0, run_loop($Char$cmp$(_h_1, _h2_0))]);
    }
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
function $String$join$go$(_xs_0, _h_0, _sep_0) {
  if (_xs_0.$ === "Nil") {
    return _h_0;
  } else {
    const _h2_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    const _x_0 = run_loop($String$join$go$(_t_0, _h2_0, _sep_0));
    const _x_1 = _sep_0 + _x_0;
    return _h_0 + _x_1;
  }
}
function $Cmp$is_eq$(_c_0) {
  if (_c_0.$ === "LT") {
    return false;
  } else if (_c_0.$ === "EQ") {
    return true;
  } else {
    return false;
  }
}
function $String$cmp$fin$(_t1_0, _t2_0, _hc_0) {
  const _t_0 = _hc_0["fst"];
  const _h1b_0 = _t_0["fst"];
  const _h2b_0 = _t_0["snd"];
  const _t_1 = _hc_0["snd"];
  if (_t_1.$ === "LT") {
    return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: _h1b_0 + _t1_0, ["snd"]: _h2b_0 + _t2_0 }, ["snd"]: { $: "LT" } };
  } else if (_t_1.$ === "EQ") {
    return run_jump($String$cmp$rec$, [_h1b_0, _h2b_0, run_loop($String$cmp$(_t1_0, _t2_0))]);
  } else {
    return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: _h1b_0 + _t1_0, ["snd"]: _h2b_0 + _t2_0 }, ["snd"]: { $: "GT" } };
  }
}
function $Char$cmp$(_a_0, _b_0) {
  const _x_0 = _a_0.codePointAt(0);
  const _y_0 = _b_0.codePointAt(0);
  return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: char_new(_x_0), ["snd"]: char_new(_y_0) }, ["snd"]: cmp_new(_x_0, _y_0) };
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
function $String$cmp$rec$(_h1b_0, _h2b_0, _rr_0) {
  const _t_0 = _rr_0["fst"];
  const _t1b_0 = _t_0["fst"];
  const _t2b_0 = _t_0["snd"];
  const _r_0 = _rr_0["snd"];
  return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: _h1b_0 + _t1b_0, ["snd"]: _h2b_0 + _t2b_0 }, ["snd"]: _r_0 };
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
  "view.viewMapText": run_lib($view$viewMapText$, 1),
  "view.asTextI": run_lib($view$asTextI$, 2),
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
  previewHidden: run_lib($previewHidden$, 2),
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

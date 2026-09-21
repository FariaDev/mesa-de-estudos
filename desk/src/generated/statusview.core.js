// GERADO de core/statusview.bend por `bun core/build.mjs` — não editar à mão.
// core/statusview.bend
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
function $tipAttrs$if$(tip_0, empty_0) {
  if (empty_0) {
    return { $: "Nil" };
  } else {
    return { $: "Con", ["head"]: run_loop($view$attrData$("tip", tip_0)), ["tail"]: { $: "Nil" } };
  }
}
function $tipAttrs$(tip_0) {
  const t_0 = tip_0;
  return run_jump($tipAttrs$if$, [t_0, run_loop($String$is_empty$(t_0))]);
}
function $fallbackLabel$if$(tip_0, fallback_0, empty_0) {
  if (empty_0) {
    return fallback_0;
  } else {
    return tip_0;
  }
}
function $fallbackLabel$(tip_0, fallback_0) {
  const t_0 = tip_0;
  return run_jump($fallbackLabel$if$, [t_0, fallback_0, run_loop($String$is_empty$(t_0))]);
}
function $footItem$(text_0, cls_0) {
  return run_jump($view$viewEl$, ["span", { $: "Con", ["head"]: run_loop($view$attrClass$("fs-item " + cls_0)), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$(text_0)), ["tail"]: { $: "Nil" } }]);
}
function $footSep$() {
  return run_jump($view$viewEl$, ["span", { $: "Con", ["head"]: run_loop($view$attrClass$("fs-sep")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrBool$("aria-hidden", true)), ["tail"]: { $: "Nil" } } }, { $: "Con", ["head"]: run_loop($view$viewText$("·")), ["tail"]: { $: "Nil" } }]);
}
function $footPush$add$(acc_0, text_0, cls_0) {
  if (acc_0.$ === "Nil") {
    return { $: "Con", ["head"]: run_loop($footItem$(text_0, cls_0)), ["tail"]: { $: "Nil" } };
  } else {
    const __0 = acc_0.head;
    const __1 = acc_0.tail;
    return { $: "Con", ["head"]: run_loop($footItem$(text_0, cls_0)), ["tail"]: { $: "Con", ["head"]: run_loop($footSep$()), ["tail"]: { $: "Con", ["head"]: __0, ["tail"]: __1 } } };
  }
}
function $footPush$if$(acc_0, text_0, cls_0, empty_0) {
  if (empty_0) {
    return acc_0;
  } else {
    return run_jump($footPush$add$, [acc_0, text_0, cls_0]);
  }
}
function $footPush$(acc_0, text_0, cls_0) {
  const t_0 = text_0;
  return run_jump($footPush$if$, [acc_0, t_0, cls_0, run_loop($String$is_empty$(t_0))]);
}
function $footItems$(model_0, level_0, context_0) {
  const a_0 = run_loop($footPush$({ $: "Nil" }, model_0, "fs-model"));
  const b_0 = run_loop($footPush$(a_0, level_0, "fs-eff"));
  const c_0 = run_loop($footPush$(b_0, context_0, "fs-ctx"));
  return run_jump($List$reverse$, [c_0]);
}
function $footAllEmpty$(modelEmpty_0, levelEmpty_0, contextEmpty_0) {
  return run_jump($Bool$and$, [modelEmpty_0, run_loop($Bool$and$(levelEmpty_0, contextEmpty_0))]);
}
function $footHasItems$(model_0, level_0, context_0) {
  return run_jump($Bool$not$, [run_loop($footAllEmpty$(run_loop($String$is_empty$(model_0)), run_loop($String$is_empty$(level_0)), run_loop($String$is_empty$(context_0))))]);
}
function $footTextPart$(text_0, empty_0) {
  if (empty_0) {
    return { $: "Nil" };
  } else {
    return { $: "Con", ["head"]: text_0, ["tail"]: { $: "Nil" } };
  }
}
function $footContextPart$if$(context_0, detail_0, empty_0) {
  if (empty_0) {
    return context_0;
  } else {
    return detail_0;
  }
}
function $footContextPart$(context_0, detail_0) {
  const d_0 = detail_0;
  return run_jump($footContextPart$if$, [context_0, d_0, run_loop($String$is_empty$(d_0))]);
}
function $footTip$if$(model_0, level_0, context_0, detail_0, override_0, empty_0) {
  if (empty_0) {
    const mo_0 = model_0;
    const le_0 = level_0;
    const co_0 = context_0;
    const m_0 = run_loop($footTextPart$(mo_0, run_loop($String$is_empty$(mo_0))));
    const l_0 = run_loop($footTextPart$(le_0, run_loop($String$is_empty$(le_0))));
    const c_0 = run_loop($footTextPart$(run_loop($footContextPart$(co_0, detail_0)), run_loop($String$is_empty$(co_0))));
    const ml_0 = run_loop($List$append$(m_0, l_0));
    return run_jump($String$join$, [run_loop($List$append$(ml_0, c_0)), " · "]);
  } else {
    return override_0;
  }
}
function $footTip$(model_0, level_0, context_0, detail_0, override_0) {
  return run_jump($footTip$if$, [model_0, level_0, context_0, detail_0, override_0, run_loop($String$is_empty$(override_0))]);
}
function $footAttrs$(tip_0, hidden_0) {
  const t_0 = tip_0;
  return run_jump($view$attrJoin$, [{ $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrId$("foot-status")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrClass$("foot-status")), ["tail"]: { $: "Nil" } } } }, ["tail"]: { $: "Con", ["head"]: run_loop($view$attrWhen$(hidden_0, { $: "ViewAttr", ["name"]: "hidden", ["value"]: "" })), ["tail"]: { $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "toggleMeterTip")), ["tail"]: { $: "Nil" } }, ["tail"]: { $: "Con", ["head"]: run_loop($tipAttrs$(t_0)), ["tail"]: { $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrAria$("label", run_loop($fallbackLabel$(t_0, "Status do modelo")))), ["tail"]: { $: "Nil" } }, ["tail"]: { $: "Nil" } } } } } }]);
}
function $footStatus$(model_0, level_0, context_0, detail_0, override_0) {
  const mo_0 = model_0;
  const le_0 = level_0;
  const co_0 = context_0;
  const tip_0 = run_loop($footTip$(mo_0, le_0, co_0, detail_0, override_0));
  const hidden_0 = run_loop($Bool$not$(run_loop($footHasItems$(mo_0, le_0, co_0))));
  return run_jump($view$viewEl$, ["button", run_loop($footAttrs$(tip_0, hidden_0)), run_loop($footItems$(mo_0, le_0, co_0))]);
}
function $meterWarn$(pct_0) {
  const p_0 = pct_0;
  return run_jump($Bool$and$, [run_loop($Nat$is_ge$(p_0, 60n)), p_0 < 85n]);
}
function $meterHot$(pct_0) {
  return run_jump($Nat$is_ge$, [pct_0, 85n]);
}
function $meterText$(pct_0) {
  const x_0 = run_loop($Nat$show$(pct_0));
  return x_0 + "%";
}
function $meterWidth$(pct_0) {
  const x_0 = run_loop($meterText$(pct_0));
  return "width:" + x_0;
}
function $ctxMeter$(visible_0, pct_0) {
  const p_0 = pct_0;
  return run_jump($view$viewEl$, ["span", run_loop($view$attrJoin$({ $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrId$("ctx-meter")), ["tail"]: { $: "Con", ["head"]: { $: "ViewAttr", ["name"]: "data-no-tip", ["value"]: "" }, ["tail"]: { $: "Nil" } } }, ["tail"]: { $: "Con", ["head"]: run_loop($view$attrWhen$(run_loop($Bool$not$(visible_0)), { $: "ViewAttr", ["name"]: "hidden", ["value"]: "" })), ["tail"]: { $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$classes$({ $: "Con", ["head"]: run_loop($view$classOn$("warn", run_loop($meterWarn$(p_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$classOn$("hot", run_loop($meterHot$(p_0)))), ["tail"]: { $: "Nil" } } })), ["tail"]: { $: "Nil" } }, ["tail"]: { $: "Nil" } } } })), { $: "Con", ["head"]: run_loop($view$viewEl$("span", { $: "Con", ["head"]: run_loop($view$attrClass$("bar")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewEl$("i", { $: "Con", ["head"]: { $: "ViewAttr", ["name"]: "style", ["value"]: run_loop($meterWidth$(p_0)) }, ["tail"]: { $: "Nil" } }, { $: "Nil" })), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("em", { $: "Nil" }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($meterText$(p_0)))), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Nil" } } }]);
}
function $ctxTip$(text_0, hidden_0) {
  return run_jump($view$viewEl$, ["span", run_loop($view$attrJoin$({ $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrId$("ctx-tip")), ["tail"]: { $: "Nil" } }, ["tail"]: { $: "Con", ["head"]: run_loop($view$attrWhen$(hidden_0, { $: "ViewAttr", ["name"]: "hidden", ["value"]: "" })), ["tail"]: { $: "Nil" } } })), { $: "Con", ["head"]: run_loop($view$viewText$(text_0)), ["tail"]: { $: "Nil" } }]);
}
function $connClass$(state_0) {
  if (state_0.$ === "ConnOff") {
    return "";
  } else if (state_0.$ === "ConnConnecting") {
    return "connecting";
  } else if (state_0.$ === "ConnOnline") {
    return "online";
  } else {
    return "error";
  }
}
function $statusDot$(state_0, label_0) {
  const l_0 = label_0;
  return run_jump($view$viewEl$, ["span", run_loop($view$attrJoin$({ $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrId$("status-dot")), ["tail"]: { $: "Con", ["head"]: { $: "ViewAttr", ["name"]: "role", ["value"]: "img" }, ["tail"]: { $: "Con", ["head"]: run_loop($view$attrClass$(run_loop($connClass$(state_0)))), ["tail"]: { $: "Nil" } } } }, ["tail"]: { $: "Con", ["head"]: run_loop($tipAttrs$(l_0)), ["tail"]: { $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrAria$("label", run_loop($fallbackLabel$(l_0, "Pi desconectado")))), ["tail"]: { $: "Nil" } }, ["tail"]: { $: "Nil" } } } })), { $: "Nil" }]);
}
function $autoCompact$(connected_0, enabled_0, tip_0) {
  const en_0 = enabled_0;
  return run_jump($view$viewEl$, ["button", run_loop($view$attrJoin$({ $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrId$("auto-compact")), ["tail"]: { $: "Nil" } } }, ["tail"]: { $: "Con", ["head"]: run_loop($view$attrWhen$(run_loop($Bool$not$(connected_0)), { $: "ViewAttr", ["name"]: "hidden", ["value"]: "" })), ["tail"]: { $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrBool$("aria-pressed", en_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$classes$({ $: "Con", ["head"]: run_loop($view$classOn$("on", en_0)), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Nil" } } }, ["tail"]: { $: "Con", ["head"]: run_loop($tipAttrs$(tip_0)), ["tail"]: { $: "Nil" } } } } })), { $: "Con", ["head"]: run_loop($view$viewText$("auto")), ["tail"]: { $: "Nil" } }]);
}
function $piLabel$(text_0) {
  return run_jump($view$viewEl$, ["span", { $: "Con", ["head"]: run_loop($view$attrId$("pi-label")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$(text_0)), ["tail"]: { $: "Nil" } }]);
}
function $sessionOption$(current_0, choice_0) {
  const label_0 = choice_0.label;
  const path_0 = choice_0.path;
  const path_1 = path_0;
  return run_jump($view$viewEl$, ["option", run_loop($view$attrJoin$({ $: "Con", ["head"]: { $: "Con", ["head"]: { $: "ViewAttr", ["name"]: "value", ["value"]: path_1 }, ["tail"]: { $: "Nil" } }, ["tail"]: { $: "Con", ["head"]: run_loop($view$attrWhen$(run_loop($String$eq$(path_1, current_0)), { $: "ViewAttr", ["name"]: "selected", ["value"]: "" })), ["tail"]: { $: "Nil" } } })), { $: "Con", ["head"]: run_loop($view$viewText$(label_0)), ["tail"]: { $: "Nil" } }]);
}
function $sessionOptions$go$(current_0, xs_0) {
  if (xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const h_0 = xs_0.head;
    const t_0 = xs_0.tail;
    return { $: "Con", ["head"]: run_loop($sessionOption$(current_0, h_0)), ["tail"]: run_loop($sessionOptions$go$(current_0, t_0)) };
  }
}
function $sessionOptions$(current_0, xs_0) {
  return run_jump($sessionOptions$go$, [current_0, xs_0]);
}
function $sessionSelect$(current_0, disabled_0, xs_0) {
  return run_jump($view$viewEl$, ["select", run_loop($view$attrJoin$({ $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrId$("session-select")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("label", "Conversa")), ["tail"]: { $: "Nil" } } }, ["tail"]: { $: "Con", ["head"]: run_loop($view$attrWhen$(disabled_0, { $: "ViewAttr", ["name"]: "disabled", ["value"]: "" })), ["tail"]: { $: "Nil" } } })), run_loop($sessionOptions$(current_0, xs_0))]);
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
function $List$reverse$(xs_0) {
  return run_jump($List$reverse$go$, [xs_0, { $: "Nil" }]);
}
function $Bool$and$(a_0, b_0) {
  if (!a_0) {
    return false;
  } else {
    return b_0;
  }
}
function $Bool$not$(b_0) {
  if (!b_0) {
    return true;
  } else {
    return false;
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
function $Nat$is_ge$(a_0, b_0) {
  return run_jump($Cmp$is_ge$, [cmp_new(a_0, b_0)]);
}
function $Nat$show$(n_0) {
  const m_0 = n_0;
  return run_jump($Nat$show$fin$, [m_0, "", run_loop($Nat$show$put$(nat_divmod(m_0, 10n)))]);
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
function $List$reverse$go$(xs_0, acc_0) {
  if (xs_0.$ === "Nil") {
    return acc_0;
  } else {
    const h_0 = xs_0.head;
    const t_0 = xs_0.tail;
    return run_jump($List$reverse$go$, [t_0, { $: "Con", ["head"]: h_0, ["tail"]: acc_0 }]);
  }
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
function $Cmp$is_ge$(c_0) {
  if (c_0.$ === "LT") {
    return false;
  } else if (c_0.$ === "EQ") {
    return true;
  } else {
    return true;
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
function $String$cmp$rec$(h1b_0, h2b_0, rr_0) {
  const _t_0 = rr_0.fst;
  const t1b_0 = _t_0.fst;
  const t2b_0 = _t_0.snd;
  const r_0 = rr_0.snd;
  return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: h1b_0 + t1b_0, ["snd"]: h2b_0 + t2b_0 }, ["snd"]: r_0 };
}
var statusview_default = {
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
  "tipAttrs.if": run_lib($tipAttrs$if$, 2),
  tipAttrs: run_lib($tipAttrs$, 1),
  "fallbackLabel.if": run_lib($fallbackLabel$if$, 3),
  fallbackLabel: run_lib($fallbackLabel$, 2),
  footItem: run_lib($footItem$, 2),
  footSep: run_lib($footSep$, 0),
  "footPush.add": run_lib($footPush$add$, 3),
  "footPush.if": run_lib($footPush$if$, 4),
  footPush: run_lib($footPush$, 3),
  footItems: run_lib($footItems$, 3),
  footAllEmpty: run_lib($footAllEmpty$, 3),
  footHasItems: run_lib($footHasItems$, 3),
  footTextPart: run_lib($footTextPart$, 2),
  "footContextPart.if": run_lib($footContextPart$if$, 3),
  footContextPart: run_lib($footContextPart$, 2),
  "footTip.if": run_lib($footTip$if$, 6),
  footTip: run_lib($footTip$, 5),
  footAttrs: run_lib($footAttrs$, 2),
  footStatus: run_lib($footStatus$, 5),
  meterWarn: run_lib($meterWarn$, 1),
  meterHot: run_lib($meterHot$, 1),
  meterText: run_lib($meterText$, 1),
  meterWidth: run_lib($meterWidth$, 1),
  ctxMeter: run_lib($ctxMeter$, 2),
  ctxTip: run_lib($ctxTip$, 2),
  connClass: run_lib($connClass$, 1),
  statusDot: run_lib($statusDot$, 2),
  autoCompact: run_lib($autoCompact$, 3),
  piLabel: run_lib($piLabel$, 1),
  sessionOption: run_lib($sessionOption$, 2),
  "sessionOptions.go": run_lib($sessionOptions$go$, 2),
  sessionOptions: run_lib($sessionOptions$, 2),
  sessionSelect: run_lib($sessionSelect$, 3)
};
export {
  statusview_default as default
};

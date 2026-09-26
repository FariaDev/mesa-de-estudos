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
function $tipAttrs$if$(_tip_0, _empty_0) {
  if (_empty_0) {
    return { $: "Nil" };
  } else {
    return { $: "Con", ["head"]: run_loop($view$attrData$("tip", _tip_0)), ["tail"]: { $: "Nil" } };
  }
}
function $tipAttrs$(_tip_0) {
  const _t_0 = _tip_0;
  return run_jump($tipAttrs$if$, [_t_0, run_loop($String$is_empty$(_t_0))]);
}
function $fallbackLabel$if$(_tip_0, _fallback_0, _empty_0) {
  if (_empty_0) {
    return _fallback_0;
  } else {
    return _tip_0;
  }
}
function $fallbackLabel$(_tip_0, _fallback_0) {
  const _t_0 = _tip_0;
  return run_jump($fallbackLabel$if$, [_t_0, _fallback_0, run_loop($String$is_empty$(_t_0))]);
}
function $footItem$(_text_0, _cls_0) {
  return run_jump($view$viewEl$, ["span", { $: "Con", ["head"]: run_loop($view$attrClass$("fs-item " + _cls_0)), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$(_text_0)), ["tail"]: { $: "Nil" } }]);
}
function $footSep$() {
  return run_jump($view$viewEl$, ["span", { $: "Con", ["head"]: run_loop($view$attrClass$("fs-sep")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrBool$("aria-hidden", true)), ["tail"]: { $: "Nil" } } }, { $: "Con", ["head"]: run_loop($view$viewText$("·")), ["tail"]: { $: "Nil" } }]);
}
function $footPush$add$(_acc_0, _text_0, _cls_0) {
  if (_acc_0.$ === "Nil") {
    return { $: "Con", ["head"]: run_loop($footItem$(_text_0, _cls_0)), ["tail"]: { $: "Nil" } };
  } else {
    const __0 = _acc_0["head"];
    const __1 = _acc_0["tail"];
    return { $: "Con", ["head"]: run_loop($footItem$(_text_0, _cls_0)), ["tail"]: { $: "Con", ["head"]: run_loop($footSep$()), ["tail"]: { $: "Con", ["head"]: __0, ["tail"]: __1 } } };
  }
}
function $footPush$if$(_acc_0, _text_0, _cls_0, _empty_0) {
  if (_empty_0) {
    return _acc_0;
  } else {
    return run_jump($footPush$add$, [_acc_0, _text_0, _cls_0]);
  }
}
function $footPush$(_acc_0, _text_0, _cls_0) {
  const _t_0 = _text_0;
  return run_jump($footPush$if$, [_acc_0, _t_0, _cls_0, run_loop($String$is_empty$(_t_0))]);
}
function $footItems$(_model_0, _level_0, _context_0) {
  const _a_0 = run_loop($footPush$({ $: "Nil" }, _model_0, "fs-model"));
  const _b_0 = run_loop($footPush$(_a_0, _level_0, "fs-eff"));
  const _c_0 = run_loop($footPush$(_b_0, _context_0, "fs-ctx"));
  return run_jump($List$reverse$, [_c_0]);
}
function $footAllEmpty$(_modelEmpty_0, _levelEmpty_0, _contextEmpty_0) {
  return run_jump($Bool$and$, [_modelEmpty_0, run_loop($Bool$and$(_levelEmpty_0, _contextEmpty_0))]);
}
function $footHasItems$(_model_0, _level_0, _context_0) {
  return run_jump($Bool$not$, [run_loop($footAllEmpty$(run_loop($String$is_empty$(_model_0)), run_loop($String$is_empty$(_level_0)), run_loop($String$is_empty$(_context_0))))]);
}
function $footTextPart$(_text_0, _empty_0) {
  if (_empty_0) {
    return { $: "Nil" };
  } else {
    return { $: "Con", ["head"]: _text_0, ["tail"]: { $: "Nil" } };
  }
}
function $footContextPart$if$(_context_0, _detail_0, _empty_0) {
  if (_empty_0) {
    return _context_0;
  } else {
    return _detail_0;
  }
}
function $footContextPart$(_context_0, _detail_0) {
  const _d_0 = _detail_0;
  return run_jump($footContextPart$if$, [_context_0, _d_0, run_loop($String$is_empty$(_d_0))]);
}
function $footTip$if$(_model_0, _level_0, _context_0, _detail_0, _override_0, _empty_0) {
  if (_empty_0) {
    const _mo_0 = _model_0;
    const _le_0 = _level_0;
    const _co_0 = _context_0;
    const _m_0 = run_loop($footTextPart$(_mo_0, run_loop($String$is_empty$(_mo_0))));
    const _l_0 = run_loop($footTextPart$(_le_0, run_loop($String$is_empty$(_le_0))));
    const _c_0 = run_loop($footTextPart$(run_loop($footContextPart$(_co_0, _detail_0)), run_loop($String$is_empty$(_co_0))));
    const _ml_0 = run_loop($List$append$(_m_0, _l_0));
    return run_jump($String$join$, [run_loop($List$append$(_ml_0, _c_0)), " · "]);
  } else {
    return _override_0;
  }
}
function $footTip$(_model_0, _level_0, _context_0, _detail_0, _override_0) {
  return run_jump($footTip$if$, [_model_0, _level_0, _context_0, _detail_0, _override_0, run_loop($String$is_empty$(_override_0))]);
}
function $footAttrs$(_tip_0, _hidden_0) {
  const _t_0 = _tip_0;
  return run_jump($view$attrJoin$, [{ $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrId$("foot-status")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrClass$("foot-status")), ["tail"]: { $: "Nil" } } } }, ["tail"]: { $: "Con", ["head"]: run_loop($view$attrWhen$(_hidden_0, { $: "ViewAttr", ["name"]: "hidden", ["value"]: "" })), ["tail"]: { $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "toggleMeterTip")), ["tail"]: { $: "Nil" } }, ["tail"]: { $: "Con", ["head"]: run_loop($tipAttrs$(_t_0)), ["tail"]: { $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrAria$("label", run_loop($fallbackLabel$(_t_0, "Status do modelo")))), ["tail"]: { $: "Nil" } }, ["tail"]: { $: "Nil" } } } } } }]);
}
function $footStatus$(_model_0, _level_0, _context_0, _detail_0, _override_0) {
  const _mo_0 = _model_0;
  const _le_0 = _level_0;
  const _co_0 = _context_0;
  const _tip_0 = run_loop($footTip$(_mo_0, _le_0, _co_0, _detail_0, _override_0));
  const _hidden_0 = run_loop($Bool$not$(run_loop($footHasItems$(_mo_0, _le_0, _co_0))));
  return run_jump($view$viewEl$, ["button", run_loop($footAttrs$(_tip_0, _hidden_0)), run_loop($footItems$(_mo_0, _le_0, _co_0))]);
}
function $meterWarn$(_pct_0) {
  const _p_0 = _pct_0;
  return run_jump($Bool$and$, [run_loop($Nat$is_ge$(_p_0, 60n)), _p_0 < 85n]);
}
function $meterHot$(_pct_0) {
  return run_jump($Nat$is_ge$, [_pct_0, 85n]);
}
function $meterText$(_pct_0) {
  const _x_0 = run_loop($Nat$show$(_pct_0));
  return _x_0 + "%";
}
function $meterWidth$(_pct_0) {
  const _x_0 = run_loop($meterText$(_pct_0));
  return "width:" + _x_0;
}
function $ctxMeter$(_visible_0, _pct_0) {
  const _p_0 = _pct_0;
  return run_jump($view$viewEl$, ["span", run_loop($view$attrJoin$({ $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrId$("ctx-meter")), ["tail"]: { $: "Con", ["head"]: { $: "ViewAttr", ["name"]: "data-no-tip", ["value"]: "" }, ["tail"]: { $: "Nil" } } }, ["tail"]: { $: "Con", ["head"]: run_loop($view$attrWhen$(run_loop($Bool$not$(_visible_0)), { $: "ViewAttr", ["name"]: "hidden", ["value"]: "" })), ["tail"]: { $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$classes$({ $: "Con", ["head"]: run_loop($view$classOn$("warn", run_loop($meterWarn$(_p_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$classOn$("hot", run_loop($meterHot$(_p_0)))), ["tail"]: { $: "Nil" } } })), ["tail"]: { $: "Nil" } }, ["tail"]: { $: "Nil" } } } })), { $: "Con", ["head"]: run_loop($view$viewEl$("span", { $: "Con", ["head"]: run_loop($view$attrClass$("bar")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewEl$("i", { $: "Con", ["head"]: { $: "ViewAttr", ["name"]: "style", ["value"]: run_loop($meterWidth$(_p_0)) }, ["tail"]: { $: "Nil" } }, { $: "Nil" })), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("em", { $: "Nil" }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($meterText$(_p_0)))), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Nil" } } }]);
}
function $ctxTip$(_text_0, _hidden_0) {
  return run_jump($view$viewEl$, ["span", run_loop($view$attrJoin$({ $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrId$("ctx-tip")), ["tail"]: { $: "Nil" } }, ["tail"]: { $: "Con", ["head"]: run_loop($view$attrWhen$(_hidden_0, { $: "ViewAttr", ["name"]: "hidden", ["value"]: "" })), ["tail"]: { $: "Nil" } } })), { $: "Con", ["head"]: run_loop($view$viewText$(_text_0)), ["tail"]: { $: "Nil" } }]);
}
function $connClass$(_state_0) {
  if (_state_0.$ === "ConnOff") {
    return "";
  } else if (_state_0.$ === "ConnConnecting") {
    return "connecting";
  } else if (_state_0.$ === "ConnOnline") {
    return "online";
  } else {
    return "error";
  }
}
function $statusDot$(_state_0, _label_0) {
  const _l_0 = _label_0;
  return run_jump($view$viewEl$, ["span", run_loop($view$attrJoin$({ $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrId$("status-dot")), ["tail"]: { $: "Con", ["head"]: { $: "ViewAttr", ["name"]: "role", ["value"]: "img" }, ["tail"]: { $: "Con", ["head"]: run_loop($view$attrClass$(run_loop($connClass$(_state_0)))), ["tail"]: { $: "Nil" } } } }, ["tail"]: { $: "Con", ["head"]: run_loop($tipAttrs$(_l_0)), ["tail"]: { $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrAria$("label", run_loop($fallbackLabel$(_l_0, "Pi desconectado")))), ["tail"]: { $: "Nil" } }, ["tail"]: { $: "Nil" } } } })), { $: "Nil" }]);
}
function $autoCompact$(_connected_0, _enabled_0, _tip_0) {
  const _en_0 = _enabled_0;
  return run_jump($view$viewEl$, ["button", run_loop($view$attrJoin$({ $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrId$("auto-compact")), ["tail"]: { $: "Nil" } } }, ["tail"]: { $: "Con", ["head"]: run_loop($view$attrWhen$(run_loop($Bool$not$(_connected_0)), { $: "ViewAttr", ["name"]: "hidden", ["value"]: "" })), ["tail"]: { $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrBool$("aria-pressed", _en_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$classes$({ $: "Con", ["head"]: run_loop($view$classOn$("on", _en_0)), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Nil" } } }, ["tail"]: { $: "Con", ["head"]: run_loop($tipAttrs$(_tip_0)), ["tail"]: { $: "Nil" } } } } })), { $: "Con", ["head"]: run_loop($view$viewText$("auto")), ["tail"]: { $: "Nil" } }]);
}
function $piLabel$(_text_0) {
  return run_jump($view$viewEl$, ["span", { $: "Con", ["head"]: run_loop($view$attrId$("pi-label")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$(_text_0)), ["tail"]: { $: "Nil" } }]);
}
function $sessionOption$(_current_0, _choice_0) {
  const _label_0 = _choice_0["label"];
  const _path_0 = _choice_0["path"];
  return run_jump($view$viewEl$, ["option", run_loop($view$attrJoin$({ $: "Con", ["head"]: { $: "Con", ["head"]: { $: "ViewAttr", ["name"]: "value", ["value"]: _path_0 }, ["tail"]: { $: "Nil" } }, ["tail"]: { $: "Con", ["head"]: run_loop($view$attrWhen$(run_loop($String$eq$(_path_0, _current_0)), { $: "ViewAttr", ["name"]: "selected", ["value"]: "" })), ["tail"]: { $: "Nil" } } })), { $: "Con", ["head"]: run_loop($view$viewText$(_label_0)), ["tail"]: { $: "Nil" } }]);
}
function $sessionOptions$go$(_current_0, _xs_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return { $: "Con", ["head"]: run_loop($sessionOption$(_current_0, _h_0)), ["tail"]: run_loop($sessionOptions$go$(_current_0, _t_0)) };
  }
}
function $sessionOptions$(_current_0, _xs_0) {
  return run_jump($sessionOptions$go$, [_current_0, _xs_0]);
}
function $sessionSelect$(_current_0, _disabled_0, _xs_0) {
  return run_jump($view$viewEl$, ["select", run_loop($view$attrJoin$({ $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrId$("session-select")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("label", "Conversa")), ["tail"]: { $: "Nil" } } }, ["tail"]: { $: "Con", ["head"]: run_loop($view$attrWhen$(_disabled_0, { $: "ViewAttr", ["name"]: "disabled", ["value"]: "" })), ["tail"]: { $: "Nil" } } })), run_loop($sessionOptions$(_current_0, _xs_0))]);
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
function $List$reverse$(_xs_0) {
  return run_jump($List$reverse$go$, [_xs_0, { $: "Nil" }]);
}
function $Bool$and$(_a_0, _b_0) {
  if (!_a_0) {
    return false;
  } else {
    return _b_0;
  }
}
function $Bool$not$(_b_0) {
  if (!_b_0) {
    return true;
  } else {
    return false;
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
function $Nat$is_ge$(_a_0, _b_0) {
  return run_jump($Cmp$is_ge$, [cmp_new(_a_0, _b_0)]);
}
function $Nat$show$(_n_0) {
  const _m_0 = _n_0;
  return run_jump($Nat$show$fin$, [_m_0, "", run_loop($Nat$show$put$(nat_divmod(_m_0, 10n)))]);
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
function $List$reverse$go$(_xs_0, _acc_0) {
  if (_xs_0.$ === "Nil") {
    return _acc_0;
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return run_jump($List$reverse$go$, [_t_0, { $: "Con", ["head"]: _h_0, ["tail"]: _acc_0 }]);
  }
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
function $Cmp$is_ge$(_c_0) {
  if (_c_0.$ === "LT") {
    return false;
  } else if (_c_0.$ === "EQ") {
    return true;
  } else {
    return true;
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
function $String$cmp$rec$(_h1b_0, _h2b_0, _rr_0) {
  const _t_0 = _rr_0["fst"];
  const _t1b_0 = _t_0["fst"];
  const _t2b_0 = _t_0["snd"];
  const _r_0 = _rr_0["snd"];
  return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: _h1b_0 + _t1b_0, ["snd"]: _h2b_0 + _t2b_0 }, ["snd"]: _r_0 };
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
  "view.viewMapText": run_lib($view$viewMapText$, 1),
  "view.asTextI": run_lib($view$asTextI$, 2),
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

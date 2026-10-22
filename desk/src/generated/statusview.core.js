// GERADO de core/statusview.bend por `bun core/build.mjs` — não editar à mão.
// core/statusview.bend
function cmp_new(a, b) {
  return { $: a < b ? "LT" : a === b ? "EQ" : "GT" };
}
function nat_divmod(a, b) {
  return b === 0 ? { $: "Tuple", fst: 0, snd: a } : { $: "Tuple", fst: Math.trunc(a / b), snd: a % b };
}
function nat_chk(n) {
  if (n > 281474976710655) {
    throw "bend: a Nat past the largest immediate 2^48-1";
  }
  return n;
}
function nat_in(n) {
  return Number.isInteger(n) && n >= 0 && n <= 2 ** 53 ? n : nat_chk(1 / 0);
}
var char_new = function char_new(c) {
  return c < 55296 || c >= 57344 && c <= 1114111 ? String.fromCodePoint(c) : String.fromCharCode(56320, c >>> 22, c >>> 11 & 2047, c & 2047);
};
function char_len(s) {
  return s[0] === "\uDC00" ? 4 : s.codePointAt(0) > 65535 ? 2 : 1;
}
function char_code(s) {
  return s.length < 4 ? s.codePointAt(0) : (s.charCodeAt(1) << 22 | s.charCodeAt(2) << 11 | s.charCodeAt(3)) >>> 0;
}
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
function $msg_mark() {
  return "";
}
function $msg_sep() {
  return "";
}
function $msg_pack(_parts_0) {
  const _x_0 = $msg_mark();
  const _x_1 = $String_join(_parts_0, $msg_sep());
  return _x_0 + _x_1;
}
function $msg_msg(_key_0) {
  return $msg_pack({ $: "Con", head: _key_0, tail: { $: "Nil" } });
}
function $msg_msg1(_key_0, _n1_0, _v1_0) {
  return $msg_pack({ $: "Con", head: _key_0, tail: { $: "Con", head: _n1_0, tail: { $: "Con", head: _v1_0, tail: { $: "Nil" } } } });
}
function $msg_msg2(_key_0, _n1_0, _v1_0, _n2_0, _v2_0) {
  return $msg_pack({ $: "Con", head: _key_0, tail: { $: "Con", head: _n1_0, tail: { $: "Con", head: _v1_0, tail: { $: "Con", head: _n2_0, tail: { $: "Con", head: _v2_0, tail: { $: "Nil" } } } } } });
}
function $msg_msg3(_key_0, _n1_0, _v1_0, _n2_0, _v2_0, _n3_0, _v3_0) {
  return $msg_pack({ $: "Con", head: _key_0, tail: { $: "Con", head: _n1_0, tail: { $: "Con", head: _v1_0, tail: { $: "Con", head: _n2_0, tail: { $: "Con", head: _v2_0, tail: { $: "Con", head: _n3_0, tail: { $: "Con", head: _v3_0, tail: { $: "Nil" } } } } } } } });
}
function $msg_msg4(_key_0, _n1_0, _v1_0, _n2_0, _v2_0, _n3_0, _v3_0, _n4_0, _v4_0) {
  return $msg_pack({ $: "Con", head: _key_0, tail: { $: "Con", head: _n1_0, tail: { $: "Con", head: _v1_0, tail: { $: "Con", head: _n2_0, tail: { $: "Con", head: _v2_0, tail: { $: "Con", head: _n3_0, tail: { $: "Con", head: _v3_0, tail: { $: "Con", head: _n4_0, tail: { $: "Con", head: _v4_0, tail: { $: "Nil" } } } } } } } } } });
}
function $msg_isMsg(_s_0) {
  return $String_starts_with(_s_0, $msg_mark());
}
function $view_attr(_name_0, _value_0) {
  return { $: "ViewAttr", name: _name_0, value: _value_0 };
}
function $view_classOn(_name_0, _on_0) {
  return { $: "ViewClass", name: _name_0, on: _on_0 };
}
function $view_viewEl(_tag_0, _attrs_0, _kids_0) {
  return { $: "ViewEl", tag: _tag_0, attrs: _attrs_0, kids: _kids_0 };
}
function $view_viewText(_s_0) {
  return { $: "ViewText", text: _s_0 };
}
function $view_viewKey(_tag_0, _key_0, _attrs_0, _kids_0) {
  return $view_viewEl(_tag_0, { $: "Con", head: { $: "ViewAttr", name: "key", value: _key_0 }, tail: _attrs_0 }, _kids_0);
}
function $view_tagOf(_n_0) {
  if (_n_0.$ === "ViewEl") {
    const _tag_0 = _n_0["tag"];
    return _tag_0;
  } else {
    return "";
  }
}
function $view_attrsOf(_n_0) {
  if (_n_0.$ === "ViewEl") {
    const _attrs_0 = _n_0["attrs"];
    return _attrs_0;
  } else {
    return { $: "Nil" };
  }
}
function $view_kidsOf(_n_0) {
  if (_n_0.$ === "ViewEl") {
    const _kids_0 = _n_0["kids"];
    return _kids_0;
  } else {
    return { $: "Nil" };
  }
}
function $view_textOf(_n_0) {
  if (_n_0.$ === "ViewEl") {
    return "";
  } else {
    const _text_0 = _n_0["text"];
    return _text_0;
  }
}
function $view_isText(_n_0) {
  if (_n_0.$ === "ViewEl") {
    return false;
  } else {
    return true;
  }
}
function $view_attrGet_choose(_av_0, _rest_0, _same_0) {
  if (_same_0) {
    return { $: "Some", value: _av_0 };
  } else {
    return _rest_0;
  }
}
function $view_attrGet_go(_attrs_0, _name_0) {
  if (_attrs_0.$ === "Nil") {
    return { $: "None" };
  } else {
    const _t_0 = _attrs_0["head"];
    const _an_0 = _t_0["name"];
    const _av_0 = _t_0["value"];
    const _t_1 = _attrs_0["tail"];
    return $view_attrGet_choose(_av_0, $view_attrGet_go(_t_1, _name_0), $String_eq(_an_0, _name_0));
  }
}
function $view_attrGet(_attrs_0, _name_0) {
  return $view_attrGet_go(_attrs_0, _name_0);
}
function $view_attrWhen(_cond_0, _a_0) {
  if (_cond_0) {
    return { $: "Con", head: _a_0, tail: { $: "Nil" } };
  } else {
    return { $: "Nil" };
  }
}
function $view_attrConcat(_xs_0, _ys_0) {
  return $List_append(_xs_0, _ys_0);
}
function $view_attrJoin(_xss_0) {
  return $List_concat(_xss_0);
}
function $view_attrId(_value_0) {
  return { $: "ViewAttr", name: "id", value: _value_0 };
}
function $view_attrClass(_value_0) {
  return { $: "ViewAttr", name: "class", value: _value_0 };
}
function $view_attrType(_value_0) {
  return { $: "ViewAttr", name: "type", value: _value_0 };
}
function $view_attrTitle(_value_0) {
  return { $: "ViewAttr", name: "title", value: _value_0 };
}
function $view_attrKey(_value_0) {
  return { $: "ViewAttr", name: "key", value: _value_0 };
}
function $view_attrOn(_event_0, _handler_0) {
  return { $: "ViewAttr", name: "on:" + _event_0, value: _handler_0 };
}
function $view_attrData(_name_0, _value_0) {
  return { $: "ViewAttr", name: "data-" + _name_0, value: _value_0 };
}
function $view_attrAria(_name_0, _value_0) {
  return { $: "ViewAttr", name: "aria-" + _name_0, value: _value_0 };
}
function $view_boolStr(_on_0) {
  if (_on_0) {
    return "true";
  } else {
    return "false";
  }
}
function $view_attrBool(_name_0, _on_0) {
  return { $: "ViewAttr", name: _name_0, value: $view_boolStr(_on_0) };
}
function $view_classAppend_empty(_acc_0, _name_0, _empty_0) {
  if (_empty_0) {
    return _name_0;
  } else {
    const _x_0 = " " + _name_0;
    return _acc_0 + _x_0;
  }
}
function $view_classAppend(_acc_0, _name_0) {
  return $view_classAppend_empty(_acc_0, _name_0, $String_is_empty(_acc_0));
}
function $view_classNext_emptyName(_name_0, _acc_0, _emptyName_0) {
  if (_emptyName_0) {
    return _acc_0;
  } else {
    return $view_classAppend(_acc_0, _name_0);
  }
}
function $view_classNext_on(_name_0, _on_0, _acc_0) {
  if (!_on_0) {
    return _acc_0;
  } else {
    return $view_classNext_emptyName(_name_0, _acc_0, $String_is_empty(_name_0));
  }
}
function $view_classValue_go($0, $1) {
  for (;; ) {
    {
      const _xs_0 = $0;
      const _acc_0 = $1;
      if (_xs_0.$ === "Nil") {
        return _acc_0;
      } else {
        const _t_0 = _xs_0["head"];
        const _name_0 = _t_0["name"];
        const _on_0 = _t_0["on"];
        const _t_1 = _xs_0["tail"];
        $0 = _t_1;
        $1 = $view_classNext_on(_name_0, _on_0, _acc_0);
        continue;
      }
    }
  }
}
function $view_classValue(_xs_0) {
  return $view_classValue_go(_xs_0, "");
}
function $view_classes(_xs_0) {
  return { $: "ViewAttr", name: "class", value: $view_classValue(_xs_0) };
}
function $view_viewWhen(_cond_0, _node_0) {
  if (_cond_0) {
    return { $: "Con", head: _node_0, tail: { $: "Nil" } };
  } else {
    return { $: "Nil" };
  }
}
function $view_viewWhenAll(_cond_0, _nodes_0) {
  if (_cond_0) {
    return _nodes_0;
  } else {
    return { $: "Nil" };
  }
}
function $view_viewConcat(_xs_0, _ys_0) {
  return $List_append(_xs_0, _ys_0);
}
function $view_viewJoin(_xss_0) {
  return $List_concat(_xss_0);
}
function $view_viewMapText(_xs_0) {
  return $view_viewMap_0(_xs_0);
}
function $view_asTextI(_i_0, _s_0) {
  return $view_viewText(_s_0);
}
function $view_viewMapTextI_go(_xs_0, _i_0) {
  return $view_viewMapI_go_0(_xs_0, _i_0);
}
function $view_viewMapTextI(_xs_0) {
  return $view_viewMapTextI_go(_xs_0, 0);
}
function $tipAttrs_if(_tip_0, _empty_0) {
  if (_empty_0) {
    return { $: "Nil" };
  } else {
    return { $: "Con", head: $view_attrData("tip", _tip_0), tail: { $: "Nil" } };
  }
}
function $tipAttrs(_tip_0) {
  const _t_0 = _tip_0;
  return $tipAttrs_if(_t_0, $String_is_empty(_t_0));
}
function $fallbackLabel_if(_tip_0, _fallback_0, _empty_0) {
  if (_empty_0) {
    return _fallback_0;
  } else {
    return _tip_0;
  }
}
function $fallbackLabel(_tip_0, _fallback_0) {
  const _t_0 = _tip_0;
  return $fallbackLabel_if(_t_0, _fallback_0, $String_is_empty(_t_0));
}
function $footItem(_text_0, _cls_0) {
  return $view_viewEl("span", { $: "Con", head: $view_attrClass("fs-item " + _cls_0), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText(_text_0), tail: { $: "Nil" } });
}
function $footSep() {
  return $view_viewEl("span", { $: "Con", head: $view_attrClass("fs-sep"), tail: { $: "Con", head: $view_attrBool("aria-hidden", true), tail: { $: "Nil" } } }, { $: "Con", head: $view_viewText("·"), tail: { $: "Nil" } });
}
function $footPush_add(_acc_0, _text_0, _cls_0) {
  if (_acc_0.$ === "Nil") {
    return { $: "Con", head: $footItem(_text_0, _cls_0), tail: { $: "Nil" } };
  } else {
    const __0 = _acc_0["head"];
    const __1 = _acc_0["tail"];
    return { $: "Con", head: $footItem(_text_0, _cls_0), tail: { $: "Con", head: $footSep(), tail: { $: "Con", head: __0, tail: __1 } } };
  }
}
function $footPush_if(_acc_0, _text_0, _cls_0, _empty_0) {
  if (_empty_0) {
    return _acc_0;
  } else {
    return $footPush_add(_acc_0, _text_0, _cls_0);
  }
}
function $footPush(_acc_0, _text_0, _cls_0) {
  const _t_0 = _text_0;
  return $footPush_if(_acc_0, _t_0, _cls_0, $String_is_empty(_t_0));
}
function $footItems(_model_0, _level_0, _context_0) {
  const _a_0 = $footPush({ $: "Nil" }, _model_0, "fs-model");
  const _b_0 = $footPush(_a_0, _level_0, "fs-eff");
  const _c_0 = $footPush(_b_0, _context_0, "fs-ctx");
  return $List_reverse(_c_0);
}
function $footAllEmpty(_modelEmpty_0, _levelEmpty_0, _contextEmpty_0) {
  return $Bool_and(_modelEmpty_0, $Bool_and(_levelEmpty_0, _contextEmpty_0));
}
function $footHasItems(_model_0, _level_0, _context_0) {
  return $Bool_not($footAllEmpty($String_is_empty(_model_0), $String_is_empty(_level_0), $String_is_empty(_context_0)));
}
function $footTextPart(_text_0, _empty_0) {
  if (_empty_0) {
    return { $: "Nil" };
  } else {
    return { $: "Con", head: _text_0, tail: { $: "Nil" } };
  }
}
function $footContextPart_if(_context_0, _detail_0, _empty_0) {
  if (_empty_0) {
    return _context_0;
  } else {
    return _detail_0;
  }
}
function $footContextPart(_context_0, _detail_0) {
  const _d_0 = _detail_0;
  return $footContextPart_if(_context_0, _d_0, $String_is_empty(_d_0));
}
function $footTip_if(_model_0, _level_0, _context_0, _detail_0, _override_0, _empty_0) {
  if (_empty_0) {
    const _mo_0 = _model_0;
    const _le_0 = _level_0;
    const _co_0 = _context_0;
    const _m_0 = $footTextPart(_mo_0, $String_is_empty(_mo_0));
    const _l_0 = $footTextPart(_le_0, $String_is_empty(_le_0));
    const _c_0 = $footTextPart($footContextPart(_co_0, _detail_0), $String_is_empty(_co_0));
    const _ml_0 = $List_append(_m_0, _l_0);
    return $String_join($List_append(_ml_0, _c_0), " · ");
  } else {
    return _override_0;
  }
}
function $footTip(_model_0, _level_0, _context_0, _detail_0, _override_0) {
  return $footTip_if(_model_0, _level_0, _context_0, _detail_0, _override_0, $String_is_empty(_override_0));
}
function $footAttrs(_tip_0, _hidden_0) {
  const _t_0 = _tip_0;
  return $view_attrJoin({ $: "Con", head: { $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_attrId("foot-status"), tail: { $: "Con", head: $view_attrClass("foot-status"), tail: { $: "Nil" } } } }, tail: { $: "Con", head: $view_attrWhen(_hidden_0, { $: "ViewAttr", name: "hidden", value: "" }), tail: { $: "Con", head: { $: "Con", head: $view_attrOn("click", "toggleMeterTip"), tail: { $: "Nil" } }, tail: { $: "Con", head: $tipAttrs(_t_0), tail: { $: "Con", head: { $: "Con", head: $view_attrAria("label", $fallbackLabel(_t_0, $msg_msg("status.model"))), tail: { $: "Nil" } }, tail: { $: "Nil" } } } } } });
}
function $footStatus(_model_0, _level_0, _context_0, _detail_0, _override_0) {
  const _mo_0 = _model_0;
  const _le_0 = _level_0;
  const _co_0 = _context_0;
  const _tip_0 = $footTip(_mo_0, _le_0, _co_0, _detail_0, _override_0);
  const _hidden_0 = $Bool_not($footHasItems(_mo_0, _le_0, _co_0));
  return $view_viewEl("button", $footAttrs(_tip_0, _hidden_0), $footItems(_mo_0, _le_0, _co_0));
}
function $meterWarn(_pct_0) {
  const _p_0 = _pct_0;
  return $Bool_and($Nat_is_ge(_p_0, 60), _p_0 < 85);
}
function $meterHot(_pct_0) {
  return $Nat_is_ge(_pct_0, 85);
}
function $meterText(_pct_0) {
  const _x_0 = $Nat_show(_pct_0);
  return _x_0 + "%";
}
function $meterFill(_pct_0) {
  const _x_0 = $meterText(_pct_0);
  return "--meter:" + _x_0;
}
function $ctxMeter(_visible_0, _pct_0) {
  const _p_0 = _pct_0;
  return $view_viewEl("span", $view_attrJoin({ $: "Con", head: { $: "Con", head: $view_attrId("ctx-meter"), tail: { $: "Con", head: { $: "ViewAttr", name: "data-no-tip", value: "" }, tail: { $: "Nil" } } }, tail: { $: "Con", head: $view_attrWhen($Bool_not(_visible_0), { $: "ViewAttr", name: "hidden", value: "" }), tail: { $: "Con", head: { $: "Con", head: $view_classes({ $: "Con", head: $view_classOn("warn", $meterWarn(_p_0)), tail: { $: "Con", head: $view_classOn("hot", $meterHot(_p_0)), tail: { $: "Nil" } } }), tail: { $: "Nil" } }, tail: { $: "Nil" } } } }), { $: "Con", head: $view_viewEl("span", { $: "Con", head: $view_attrClass("bar"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewEl("i", { $: "Con", head: { $: "ViewAttr", name: "style", value: $meterFill(_p_0) }, tail: { $: "Nil" } }, { $: "Nil" }), tail: { $: "Nil" } }), tail: { $: "Con", head: $view_viewEl("em", { $: "Nil" }, { $: "Con", head: $view_viewText($meterText(_p_0)), tail: { $: "Nil" } }), tail: { $: "Nil" } } });
}
function $ctxTip(_text_0, _hidden_0) {
  return $view_viewEl("span", $view_attrJoin({ $: "Con", head: { $: "Con", head: $view_attrId("ctx-tip"), tail: { $: "Nil" } }, tail: { $: "Con", head: $view_attrWhen(_hidden_0, { $: "ViewAttr", name: "hidden", value: "" }), tail: { $: "Nil" } } }), { $: "Con", head: $view_viewText(_text_0), tail: { $: "Nil" } });
}
function $connClass(_state_0) {
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
function $statusDot(_state_0, _label_0) {
  const _l_0 = _label_0;
  return $view_viewEl("span", $view_attrJoin({ $: "Con", head: { $: "Con", head: $view_attrId("status-dot"), tail: { $: "Con", head: { $: "ViewAttr", name: "role", value: "img" }, tail: { $: "Con", head: $view_attrClass($connClass(_state_0)), tail: { $: "Nil" } } } }, tail: { $: "Con", head: $tipAttrs(_l_0), tail: { $: "Con", head: { $: "Con", head: $view_attrAria("label", $fallbackLabel(_l_0, $msg_msg("status.piOff"))), tail: { $: "Nil" } }, tail: { $: "Nil" } } } }), { $: "Nil" });
}
function $autoCompact(_connected_0, _enabled_0, _tip_0) {
  const _en_0 = _enabled_0;
  return $view_viewEl("button", $view_attrJoin({ $: "Con", head: { $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_attrId("auto-compact"), tail: { $: "Nil" } } }, tail: { $: "Con", head: $view_attrWhen($Bool_not(_connected_0), { $: "ViewAttr", name: "hidden", value: "" }), tail: { $: "Con", head: { $: "Con", head: $view_attrBool("aria-pressed", _en_0), tail: { $: "Con", head: $view_classes({ $: "Con", head: $view_classOn("on", _en_0), tail: { $: "Nil" } }), tail: { $: "Nil" } } }, tail: { $: "Con", head: $tipAttrs(_tip_0), tail: { $: "Nil" } } } } }), { $: "Con", head: $view_viewText("auto"), tail: { $: "Nil" } });
}
function $piLabel(_text_0) {
  return $view_viewEl("span", { $: "Con", head: $view_attrId("pi-label"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText(_text_0), tail: { $: "Nil" } });
}
function $sessionOption(_current_0, _choice_0) {
  const _label_0 = _choice_0["label"];
  const _path_0 = _choice_0["path"];
  return $view_viewEl("option", $view_attrJoin({ $: "Con", head: { $: "Con", head: { $: "ViewAttr", name: "value", value: _path_0 }, tail: { $: "Nil" } }, tail: { $: "Con", head: $view_attrWhen($String_eq(_path_0, _current_0), { $: "ViewAttr", name: "selected", value: "" }), tail: { $: "Nil" } } }), { $: "Con", head: $view_viewText(_label_0), tail: { $: "Nil" } });
}
function $sessionOptions_go(_current_0, _xs_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return { $: "Con", head: $sessionOption(_current_0, _h_0), tail: $sessionOptions_go(_current_0, _t_0) };
  }
}
function $sessionOptions(_current_0, _xs_0) {
  return $sessionOptions_go(_current_0, _xs_0);
}
function $sessionSelect(_current_0, _disabled_0, _xs_0) {
  return $view_viewEl("select", $view_attrJoin({ $: "Con", head: { $: "Con", head: $view_attrId("session-select"), tail: { $: "Con", head: $view_attrAria("label", "Conversa"), tail: { $: "Nil" } } }, tail: { $: "Con", head: $view_attrWhen(_disabled_0, { $: "ViewAttr", name: "disabled", value: "" }), tail: { $: "Nil" } } }), $sessionOptions(_current_0, _xs_0));
}
function $String_join(_xs_0, _sep_0) {
  if (_xs_0.$ === "Nil") {
    return "";
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return $String_join_go(_t_0, _h_0, _sep_0);
  }
}
function $String_starts_with($0, $1, $2) {
  let $pc = 0;
  for (;; )
    switch ($pc) {
      case 0: {
        const _s_0 = $0;
        const _p_0 = $1;
        if (_s_0 === "") {
          if (_p_0 === "") {
            return true;
          } else {
            return false;
          }
        } else {
          const _h_1 = _s_0.slice(0, char_len(_s_0));
          const _t_1 = _s_0.slice(char_len(_s_0));
          if (_p_0 === "") {
            return true;
          } else {
            const _y_0 = _p_0.slice(0, char_len(_p_0));
            const _yt_0 = _p_0.slice(char_len(_p_0));
            $0 = _t_1;
            $1 = _yt_0;
            $2 = $Char_is_eq(_h_1, _y_0);
            $pc = 1;
            continue;
          }
        }
      }
      case 1: {
        const _t_0 = $0;
        const _pt_0 = $1;
        const _same_0 = $2;
        if (!_same_0) {
          return false;
        } else {
          $0 = _t_0;
          $1 = _pt_0;
          $pc = 0;
          continue;
        }
      }
    }
}
function $String_eq(_a_0, _b_0) {
  return $Cmp_is_eq($String_order(_a_0, _b_0));
}
function $List_append(_xs_0, _ys_0) {
  if (_xs_0.$ === "Nil") {
    return _ys_0;
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return { $: "Con", head: _h_0, tail: $List_append(_t_0, _ys_0) };
  }
}
function $List_concat(_xss_0) {
  if (_xss_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xss_0["head"];
    const _t_0 = _xss_0["tail"];
    return $List_append(_h_0, $List_concat(_t_0));
  }
}
function $String_is_empty(_s_0) {
  if (_s_0 === "") {
    return true;
  } else {
    return false;
  }
}
function $view_viewMap_0(_xs_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return { $: "Con", head: $view_viewText(_h_0), tail: $view_viewMap_0(_t_0) };
  }
}
function $view_viewMapI_go_0(_xs_0, _i_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return { $: "Con", head: $view_asTextI(_i_0, _h_0), tail: $view_viewMapI_go_0(_t_0, nat_chk(_i_0 + 1)) };
  }
}
function $List_reverse(_xs_0) {
  return $List_reverse_go(_xs_0, { $: "Nil" });
}
function $Bool_and(_a_0, _b_0) {
  if (!_a_0) {
    return false;
  } else {
    return _b_0;
  }
}
function $Bool_not(_b_0) {
  if (!_b_0) {
    return true;
  } else {
    return false;
  }
}
function $Nat_is_ge(_a_0, _b_0) {
  return $Cmp_is_ge(cmp_new(_a_0, _b_0));
}
function $Nat_show(_n_0) {
  const _m_0 = _n_0;
  return $Nat_show_fin(_m_0, "", $Nat_show_put(nat_divmod(_m_0, 10)));
}
function $String_join_go(_xs_0, _h_0, _sep_0) {
  if (_xs_0.$ === "Nil") {
    return _h_0;
  } else {
    const _h2_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    const _x_0 = $String_join_go(_t_0, _h2_0, _sep_0);
    const _x_1 = _sep_0 + _x_0;
    return _h_0 + _x_1;
  }
}
function $Char_is_eq(_a_0, _b_0) {
  const _x_0 = char_code(_a_0);
  const _x_1 = char_code(_b_0);
  return _x_0 === _x_1;
}
function $Cmp_is_eq(_c_0) {
  if (_c_0.$ === "EQ") {
    return true;
  } else {
    return false;
  }
}
function $String_order(_a_0, _b_0) {
  return $String_order_go(_a_0, _b_0, { $: "EQ" });
}
function $List_reverse_go($0, $1) {
  for (;; ) {
    {
      const _xs_0 = $0;
      const _acc_0 = $1;
      if (_xs_0.$ === "Nil") {
        return _acc_0;
      } else {
        const _h_0 = _xs_0["head"];
        const _t_0 = _xs_0["tail"];
        $0 = _t_0;
        $1 = { $: "Con", head: _h_0, tail: _acc_0 };
        continue;
      }
    }
  }
}
function $Cmp_is_ge(_c_0) {
  if (_c_0.$ === "LT") {
    return false;
  } else {
    return true;
  }
}
function $Nat_show_fin($0, $1, $2) {
  let $pc = 0;
  for (;; )
    switch ($pc) {
      case 0: {
        const _g_0 = $0;
        const _acc_0 = $1;
        const _dq_0 = $2;
        const _d_0 = _dq_0["fst"];
        const _t_0 = _dq_0["snd"];
        if (_t_0 === 0) {
          return _d_0 + _acc_0;
        } else {
          const _p_0 = _t_0 - 1;
          $0 = _g_0;
          $1 = nat_chk(_p_0 + 1);
          $2 = _d_0 + _acc_0;
          $pc = 1;
          continue;
        }
      }
      case 1: {
        const _f_0 = $0;
        const _n_0 = $1;
        const _acc_0 = $2;
        if (_f_0 === 0) {
          return _acc_0;
        } else {
          const _g_0 = _f_0 - 1;
          $0 = _g_0;
          $1 = _acc_0;
          $2 = $Nat_show_put(nat_divmod(_n_0, 10));
          $pc = 0;
          continue;
        }
      }
    }
}
function $Nat_show_put(_qr_0) {
  const _q_0 = _qr_0["fst"];
  const _r_0 = _qr_0["snd"];
  const _x_0 = nat_chk(48 + _r_0);
  return { $: "Tuple", fst: char_new(_x_0 >>> 0), snd: _q_0 };
}
function $String_order_go($0, $1, $2) {
  for (;; ) {
    {
      const _a_0 = $0;
      const _b_0 = $1;
      const _c_0 = $2;
      if (_a_0 === "") {
        if (_b_0 !== "") {
          if (_c_0.$ === "EQ") {
            return { $: "LT" };
          } else {
            return _c_0;
          }
        } else {
          return _c_0;
        }
      } else {
        const _t_1 = _a_0.slice(0, char_len(_a_0));
        const _t_2 = _a_0.slice(char_len(_a_0));
        if (_b_0 === "") {
          if (_c_0.$ === "EQ") {
            return { $: "GT" };
          } else {
            return _c_0;
          }
        } else {
          const _t_3 = _b_0.slice(0, char_len(_b_0));
          const _t2_0 = _b_0.slice(char_len(_b_0));
          if (_c_0.$ === "EQ") {
            const _x_0 = char_code(_t_1);
            const _x_1 = char_code(_t_3);
            $0 = _t_2;
            $1 = _t2_0;
            $2 = cmp_new(_x_0, _x_1);
            continue;
          } else {
            return _c_0;
          }
        }
      }
    }
  }
}
var statusview_default = {
  "msg.mark": run_lib(() => str_out(run_loop($msg_mark())), 0),
  "msg.sep": run_lib(() => str_out(run_loop($msg_sep())), 0),
  "msg.pack": run_lib((a0) => str_out(run_loop($msg_pack(a0))), 1),
  "msg.msg": run_lib((a0) => str_out(run_loop($msg_msg(str_in(a0)))), 1),
  "msg.msg1": run_lib((a0, a1, a2) => str_out(run_loop($msg_msg1(str_in(a0), str_in(a1), str_in(a2)))), 3),
  "msg.msg2": run_lib((a0, a1, a2, a3, a4) => str_out(run_loop($msg_msg2(str_in(a0), str_in(a1), str_in(a2), str_in(a3), str_in(a4)))), 5),
  "msg.msg3": run_lib((a0, a1, a2, a3, a4, a5, a6) => str_out(run_loop($msg_msg3(str_in(a0), str_in(a1), str_in(a2), str_in(a3), str_in(a4), str_in(a5), str_in(a6)))), 7),
  "msg.msg4": run_lib((a0, a1, a2, a3, a4, a5, a6, a7, a8) => str_out(run_loop($msg_msg4(str_in(a0), str_in(a1), str_in(a2), str_in(a3), str_in(a4), str_in(a5), str_in(a6), str_in(a7), str_in(a8)))), 9),
  "msg.isMsg": run_lib((a0) => run_loop($msg_isMsg(str_in(a0))), 1),
  "view.attr": run_lib((a0, a1) => run_loop($view_attr(str_in(a0), str_in(a1))), 2),
  "view.classOn": run_lib((a0, a1) => run_loop($view_classOn(str_in(a0), a1)), 2),
  "view.viewEl": run_lib((a0, a1, a2) => run_loop($view_viewEl(str_in(a0), a1, a2)), 3),
  "view.viewText": run_lib((a0) => run_loop($view_viewText(str_in(a0))), 1),
  "view.viewKey": run_lib((a0, a1, a2, a3) => run_loop($view_viewKey(str_in(a0), str_in(a1), a2, a3)), 4),
  "view.tagOf": run_lib((a0) => str_out(run_loop($view_tagOf(a0))), 1),
  "view.attrsOf": run_lib((a0) => run_loop($view_attrsOf(a0)), 1),
  "view.kidsOf": run_lib((a0) => run_loop($view_kidsOf(a0)), 1),
  "view.textOf": run_lib((a0) => str_out(run_loop($view_textOf(a0))), 1),
  "view.isText": run_lib((a0) => run_loop($view_isText(a0)), 1),
  "view.attrGet.choose": run_lib((a0, a1, a2) => run_loop($view_attrGet_choose(str_in(a0), a1, a2)), 3),
  "view.attrGet.go": run_lib((a0, a1) => run_loop($view_attrGet_go(a0, str_in(a1))), 2),
  "view.attrGet": run_lib((a0, a1) => run_loop($view_attrGet(a0, str_in(a1))), 2),
  "view.attrWhen": run_lib((a0, a1) => run_loop($view_attrWhen(a0, a1)), 2),
  "view.attrConcat": run_lib((a0, a1) => run_loop($view_attrConcat(a0, a1)), 2),
  "view.attrJoin": run_lib((a0) => run_loop($view_attrJoin(a0)), 1),
  "view.attrId": run_lib((a0) => run_loop($view_attrId(str_in(a0))), 1),
  "view.attrClass": run_lib((a0) => run_loop($view_attrClass(str_in(a0))), 1),
  "view.attrType": run_lib((a0) => run_loop($view_attrType(str_in(a0))), 1),
  "view.attrTitle": run_lib((a0) => run_loop($view_attrTitle(str_in(a0))), 1),
  "view.attrKey": run_lib((a0) => run_loop($view_attrKey(str_in(a0))), 1),
  "view.attrOn": run_lib((a0, a1) => run_loop($view_attrOn(str_in(a0), str_in(a1))), 2),
  "view.attrData": run_lib((a0, a1) => run_loop($view_attrData(str_in(a0), str_in(a1))), 2),
  "view.attrAria": run_lib((a0, a1) => run_loop($view_attrAria(str_in(a0), str_in(a1))), 2),
  "view.boolStr": run_lib((a0) => str_out(run_loop($view_boolStr(a0))), 1),
  "view.attrBool": run_lib((a0, a1) => run_loop($view_attrBool(str_in(a0), a1)), 2),
  "view.classAppend.empty": run_lib((a0, a1, a2) => str_out(run_loop($view_classAppend_empty(str_in(a0), str_in(a1), a2))), 3),
  "view.classAppend": run_lib((a0, a1) => str_out(run_loop($view_classAppend(str_in(a0), str_in(a1)))), 2),
  "view.classNext.emptyName": run_lib((a0, a1, a2) => str_out(run_loop($view_classNext_emptyName(str_in(a0), str_in(a1), a2))), 3),
  "view.classNext.on": run_lib((a0, a1, a2) => str_out(run_loop($view_classNext_on(str_in(a0), a1, str_in(a2)))), 3),
  "view.classValue.go": run_lib((a0, a1) => str_out(run_loop($view_classValue_go(a0, str_in(a1)))), 2),
  "view.classValue": run_lib((a0) => str_out(run_loop($view_classValue(a0))), 1),
  "view.classes": run_lib((a0) => run_loop($view_classes(a0)), 1),
  "view.viewWhen": run_lib((a0, a1) => run_loop($view_viewWhen(a0, a1)), 2),
  "view.viewWhenAll": run_lib((a0, a1) => run_loop($view_viewWhenAll(a0, a1)), 2),
  "view.viewConcat": run_lib((a0, a1) => run_loop($view_viewConcat(a0, a1)), 2),
  "view.viewJoin": run_lib((a0) => run_loop($view_viewJoin(a0)), 1),
  "view.viewMapText": run_lib((a0) => run_loop($view_viewMapText(a0)), 1),
  "view.asTextI": run_lib((a0, a1) => run_loop($view_asTextI(nat_in(a0), str_in(a1))), 2),
  "view.viewMapTextI.go": run_lib((a0, a1) => run_loop($view_viewMapTextI_go(a0, nat_in(a1))), 2),
  "view.viewMapTextI": run_lib((a0) => run_loop($view_viewMapTextI(a0)), 1),
  "tipAttrs.if": run_lib((a0, a1) => run_loop($tipAttrs_if(str_in(a0), a1)), 2),
  tipAttrs: run_lib((a0) => run_loop($tipAttrs(str_in(a0))), 1),
  "fallbackLabel.if": run_lib((a0, a1, a2) => str_out(run_loop($fallbackLabel_if(str_in(a0), str_in(a1), a2))), 3),
  fallbackLabel: run_lib((a0, a1) => str_out(run_loop($fallbackLabel(str_in(a0), str_in(a1)))), 2),
  footItem: run_lib((a0, a1) => run_loop($footItem(str_in(a0), str_in(a1))), 2),
  footSep: run_lib(() => run_loop($footSep()), 0),
  "footPush.add": run_lib((a0, a1, a2) => run_loop($footPush_add(a0, str_in(a1), str_in(a2))), 3),
  "footPush.if": run_lib((a0, a1, a2, a3) => run_loop($footPush_if(a0, str_in(a1), str_in(a2), a3)), 4),
  footPush: run_lib((a0, a1, a2) => run_loop($footPush(a0, str_in(a1), str_in(a2))), 3),
  footItems: run_lib((a0, a1, a2) => run_loop($footItems(str_in(a0), str_in(a1), str_in(a2))), 3),
  footAllEmpty: run_lib((a0, a1, a2) => run_loop($footAllEmpty(a0, a1, a2)), 3),
  footHasItems: run_lib((a0, a1, a2) => run_loop($footHasItems(str_in(a0), str_in(a1), str_in(a2))), 3),
  footTextPart: run_lib((a0, a1) => run_loop($footTextPart(str_in(a0), a1)), 2),
  "footContextPart.if": run_lib((a0, a1, a2) => str_out(run_loop($footContextPart_if(str_in(a0), str_in(a1), a2))), 3),
  footContextPart: run_lib((a0, a1) => str_out(run_loop($footContextPart(str_in(a0), str_in(a1)))), 2),
  "footTip.if": run_lib((a0, a1, a2, a3, a4, a5) => str_out(run_loop($footTip_if(str_in(a0), str_in(a1), str_in(a2), str_in(a3), str_in(a4), a5))), 6),
  footTip: run_lib((a0, a1, a2, a3, a4) => str_out(run_loop($footTip(str_in(a0), str_in(a1), str_in(a2), str_in(a3), str_in(a4)))), 5),
  footAttrs: run_lib((a0, a1) => run_loop($footAttrs(str_in(a0), a1)), 2),
  footStatus: run_lib((a0, a1, a2, a3, a4) => run_loop($footStatus(str_in(a0), str_in(a1), str_in(a2), str_in(a3), str_in(a4))), 5),
  meterWarn: run_lib((a0) => run_loop($meterWarn(nat_in(a0))), 1),
  meterHot: run_lib((a0) => run_loop($meterHot(nat_in(a0))), 1),
  meterText: run_lib((a0) => str_out(run_loop($meterText(nat_in(a0)))), 1),
  meterFill: run_lib((a0) => str_out(run_loop($meterFill(nat_in(a0)))), 1),
  ctxMeter: run_lib((a0, a1) => run_loop($ctxMeter(a0, nat_in(a1))), 2),
  ctxTip: run_lib((a0, a1) => run_loop($ctxTip(str_in(a0), a1)), 2),
  connClass: run_lib((a0) => str_out(run_loop($connClass(a0))), 1),
  statusDot: run_lib((a0, a1) => run_loop($statusDot(a0, str_in(a1))), 2),
  autoCompact: run_lib((a0, a1, a2) => run_loop($autoCompact(a0, a1, str_in(a2))), 3),
  piLabel: run_lib((a0) => run_loop($piLabel(str_in(a0))), 1),
  sessionOption: run_lib((a0, a1) => run_loop($sessionOption(str_in(a0), a1)), 2),
  "sessionOptions.go": run_lib((a0, a1) => run_loop($sessionOptions_go(str_in(a0), a1)), 2),
  sessionOptions: run_lib((a0, a1) => run_loop($sessionOptions(str_in(a0), a1)), 2),
  sessionSelect: run_lib((a0, a1, a2) => run_loop($sessionSelect(str_in(a0), a1, a2)), 3)
};
export {
  statusview_default as default
};

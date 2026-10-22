// GERADO de core/calcview.bend por `bun core/build.mjs` — não editar à mão.
// core/calcview.bend
function cmp_new(a, b) {
  return { $: a < b ? "LT" : a === b ? "EQ" : "GT" };
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
function $calcTitle() {
  return $msg_msg("calc.title");
}
function $angleAria() {
  return $msg_msg("calc.angleAria");
}
function $angleLabelText() {
  return $msg_msg("calc.angleLabel");
}
function $expandLabel() {
  return $msg_msg("calc.expand");
}
function $collapseLabel() {
  return $msg_msg("calc.collapse");
}
function $expressionPlaceholder() {
  return "sqrt(16) + sin(pi/2)";
}
function $expressionAria() {
  return $msg_msg("calc.expressionAria");
}
function $equalsAria() {
  return $msg_msg("calc.equalsAria");
}
function $equalsText() {
  return "=";
}
function $historyTitleText() {
  return $msg_msg("calc.historyTitle");
}
function $clearText() {
  return $msg_msg("calc.clear");
}
function $historyEmptyText() {
  return $msg_msg("calc.historyEmpty");
}
function $guideSummaryText() {
  return $msg_msg("calc.guideSummary");
}
function $guideLeadText() {
  return $msg_msg("calc.guideLead");
}
function $codeNode(_txt_0) {
  return $view_viewEl("code", { $: "Nil" }, { $: "Con", head: $view_viewText(_txt_0), tail: { $: "Nil" } });
}
function $chips(_names_0) {
  return $view_viewMap_1(_names_0);
}
function $opNames() {
  return { $: "Con", head: "+", tail: { $: "Con", head: "-", tail: { $: "Con", head: "*", tail: { $: "Con", head: "/", tail: { $: "Con", head: "^", tail: { $: "Con", head: "( )", tail: { $: "Nil" } } } } } } };
}
function $fnNames() {
  return { $: "Con", head: "sqrt", tail: { $: "Con", head: "abs", tail: { $: "Con", head: "exp", tail: { $: "Con", head: "ln", tail: { $: "Con", head: "log", tail: { $: "Nil" } } } } } };
}
function $trigNames() {
  return { $: "Con", head: "sin", tail: { $: "Con", head: "cos", tail: { $: "Con", head: "tan", tail: { $: "Con", head: "sec", tail: { $: "Con", head: "csc", tail: { $: "Con", head: "cot", tail: { $: "Con", head: "asin", tail: { $: "Con", head: "acos", tail: { $: "Con", head: "atan", tail: { $: "Nil" } } } } } } } } } };
}
function $constNames() {
  return { $: "Con", head: "pi", tail: { $: "Con", head: "e", tail: { $: "Nil" } } };
}
function $guideGroup(_title_0, _names_0) {
  return { $: "Con", head: $view_viewEl("dt", { $: "Nil" }, { $: "Con", head: $view_viewText(_title_0), tail: { $: "Nil" } }), tail: { $: "Con", head: $view_viewEl("dd", { $: "Nil" }, $chips(_names_0)), tail: { $: "Nil" } } };
}
function $guideGroups() {
  return $view_viewEl("dl", { $: "Con", head: $view_attrClass("calc-groups"), tail: { $: "Nil" } }, $view_viewJoin({ $: "Con", head: $guideGroup($msg_msg("calc.group.ops"), $opNames()), tail: { $: "Con", head: $guideGroup($msg_msg("calc.group.fns"), $fnNames()), tail: { $: "Con", head: $guideGroup($msg_msg("calc.group.trig"), $trigNames()), tail: { $: "Con", head: $guideGroup($msg_msg("calc.group.consts"), $constNames()), tail: { $: "Nil" } } } } }));
}
function $guideLead() {
  return $view_viewEl("p", { $: "Con", head: $view_attrClass("calc-guide-lead"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText($guideLeadText()), tail: { $: "Nil" } });
}
function $guideTip1() {
  return $view_viewEl("li", { $: "Nil" }, { $: "Con", head: $view_viewText($msg_msg("calc.tip1.a")), tail: { $: "Con", head: $codeNode("2*pi"), tail: { $: "Con", head: $view_viewText($msg_msg("calc.tip1.b")), tail: { $: "Con", head: $codeNode("2pi"), tail: { $: "Con", head: $view_viewText($msg_msg("calc.tip1.c")), tail: { $: "Con", head: $codeNode("2,5"), tail: { $: "Con", head: $view_viewText("."), tail: { $: "Nil" } } } } } } } });
}
function $guideTip2() {
  return $view_viewEl("li", { $: "Nil" }, { $: "Con", head: $codeNode("log"), tail: { $: "Con", head: $view_viewText($msg_msg("calc.tip2.a")), tail: { $: "Con", head: $codeNode("ln"), tail: { $: "Con", head: $view_viewText($msg_msg("calc.tip2.b")), tail: { $: "Nil" } } } } });
}
function $guideTip3() {
  return $view_viewEl("li", { $: "Nil" }, { $: "Con", head: $view_viewText($msg_msg("calc.tip3.a")), tail: { $: "Con", head: $codeNode("sin(pi/2)"), tail: { $: "Con", head: $view_viewText($msg_msg("calc.tip3.b")), tail: { $: "Con", head: $codeNode("sin(90)"), tail: { $: "Con", head: $view_viewText($msg_msg("calc.tip3.c")), tail: { $: "Con", head: $codeNode("asin(0.5)"), tail: { $: "Con", head: $view_viewText($msg_msg("calc.tip3.d")), tail: { $: "Nil" } } } } } } } });
}
function $guideTip4() {
  return $view_viewEl("li", { $: "Nil" }, { $: "Con", head: $view_viewText($msg_msg("calc.tip4.a")), tail: { $: "Con", head: $codeNode("cos(90)"), tail: { $: "Con", head: $view_viewText($msg_msg("calc.tip4.b")), tail: { $: "Con", head: $codeNode("tan(90)"), tail: { $: "Con", head: $view_viewText($msg_msg("calc.tip4.c")), tail: { $: "Nil" } } } } } });
}
function $guideTip5() {
  return $view_viewEl("li", { $: "Nil" }, { $: "Con", head: $view_viewText($msg_msg("calc.tip5")), tail: { $: "Nil" } });
}
function $guideTips() {
  return $view_viewEl("ul", { $: "Con", head: $view_attrClass("calc-tips"), tail: { $: "Nil" } }, { $: "Con", head: $guideTip1(), tail: { $: "Con", head: $guideTip2(), tail: { $: "Con", head: $guideTip3(), tail: { $: "Con", head: $guideTip4(), tail: { $: "Con", head: $guideTip5(), tail: { $: "Nil" } } } } } });
}
function $calcGuide(_open_0) {
  return $view_viewEl("details", $view_attrJoin({ $: "Con", head: { $: "Con", head: $view_attrId("calc-guide"), tail: { $: "Nil" } }, tail: { $: "Con", head: $view_attrWhen(_open_0, { $: "ViewAttr", name: "open", value: "" }), tail: { $: "Nil" } } }), { $: "Con", head: $view_viewEl("summary", { $: "Nil" }, { $: "Con", head: $view_viewText($guideSummaryText()), tail: { $: "Nil" } }), tail: { $: "Con", head: $guideLead(), tail: { $: "Con", head: $guideGroups(), tail: { $: "Con", head: $guideTips(), tail: { $: "Nil" } } } } });
}
function $isDegrees(_angle_0) {
  return $String_eq(_angle_0, "deg");
}
function $unitText(_deg_0) {
  if (_deg_0) {
    return $msg_msg("calc.unit.deg");
  } else {
    return "RAD";
  }
}
function $unitLabel(_angle_0) {
  return $unitText($isDegrees(_angle_0));
}
function $calcUnit(_angle_0) {
  return $view_viewEl("span", { $: "Con", head: $view_attrClass("calc-unit"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText($unitLabel(_angle_0)), tail: { $: "Nil" } });
}
function $angleButton(_value_0, _label_0, _angle_0) {
  return $view_viewEl("button", { $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_attrKey("angle-" + _value_0), tail: { $: "Con", head: $view_attrData("angle", _value_0), tail: { $: "Con", head: $view_attrAria("pressed", $view_boolStr($String_eq(_value_0, _angle_0))), tail: { $: "Con", head: $view_attrOn("click", "SetAngle"), tail: { $: "Nil" } } } } } }, { $: "Con", head: $view_viewText(_label_0), tail: { $: "Nil" } });
}
function $angleGroup(_angle_0) {
  return $view_viewEl("div", { $: "Con", head: $view_attrId("angle"), tail: { $: "Con", head: { $: "ViewAttr", name: "role", value: "group" }, tail: { $: "Con", head: $view_attrClass("calc-seg"), tail: { $: "Con", head: $view_attrAria("label", $angleAria()), tail: { $: "Nil" } } } } }, { $: "Con", head: $angleButton("rad", "RAD", _angle_0), tail: { $: "Con", head: $angleButton("deg", $msg_msg("calc.unit.deg"), _angle_0), tail: { $: "Nil" } } });
}
function $hintText(_deg_0) {
  if (_deg_0) {
    return $msg_msg("calc.hint.deg");
  } else {
    return $msg_msg("calc.hint.rad");
  }
}
function $angleHint(_angle_0) {
  return $view_viewEl("span", { $: "Con", head: $view_attrClass("calc-hint"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText($hintText($isDegrees(_angle_0))), tail: { $: "Nil" } });
}
function $angleRow(_angle_0) {
  return $view_viewEl("div", { $: "Con", head: $view_attrClass("calc-angle"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewEl("span", { $: "Con", head: $view_attrClass("calc-angle-label"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText($angleLabelText()), tail: { $: "Nil" } }), tail: { $: "Con", head: $angleGroup(_angle_0), tail: { $: "Con", head: $angleHint(_angle_0), tail: { $: "Nil" } } } });
}
function $calcIcon() {
  return $view_viewEl("span", { $: "Con", head: $view_attrClass("calc-icon"), tail: { $: "Con", head: $view_attrAria("hidden", "true"), tail: { $: "Nil" } } }, { $: "Nil" });
}
function $toggleLabel(_collapsed_0) {
  if (_collapsed_0) {
    return $expandLabel();
  } else {
    return $collapseLabel();
  }
}
function $calcToggle(_collapsed_0) {
  return $view_viewEl("button", { $: "Con", head: $view_attrId("calc-toggle"), tail: { $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_attrClass("icon-btn"), tail: { $: "Con", head: $view_attrAria("expanded", $view_boolStr($Bool_not(_collapsed_0))), tail: { $: "Con", head: $view_attrAria("controls", "calc-body"), tail: { $: "Con", head: $view_attrAria("label", $toggleLabel(_collapsed_0)), tail: { $: "Con", head: $view_attrTitle($toggleLabel(_collapsed_0)), tail: { $: "Con", head: $view_attrOn("click", "ToggleCalc"), tail: { $: "Nil" } } } } } } } } }, { $: "Nil" });
}
function $expressionValue(_value_0) {
  return $view_attrWhen($Bool_not($String_is_empty(_value_0)), { $: "ViewAttr", name: "value", value: _value_0 });
}
function $calcForm(_expression_0) {
  return $view_viewEl("form", { $: "Con", head: $view_attrId("calc-form"), tail: { $: "Con", head: $view_attrOn("submit", "Eval"), tail: { $: "Nil" } } }, { $: "Con", head: $view_viewEl("input", $view_attrJoin({ $: "Con", head: { $: "Con", head: $view_attrId("expression"), tail: { $: "Con", head: { $: "ViewAttr", name: "autocomplete", value: "off" }, tail: { $: "Con", head: { $: "ViewAttr", name: "placeholder", value: $expressionPlaceholder() }, tail: { $: "Con", head: $view_attrAria("label", $expressionAria()), tail: { $: "Nil" } } } } }, tail: { $: "Con", head: $expressionValue(_expression_0), tail: { $: "Nil" } } }), { $: "Nil" }), tail: { $: "Con", head: $view_viewEl("button", { $: "Con", head: $view_attrType("submit"), tail: { $: "Con", head: $view_attrClass("icon-btn"), tail: { $: "Con", head: $view_attrAria("label", $equalsAria()), tail: { $: "Nil" } } } }, { $: "Con", head: $view_viewText($equalsText()), tail: { $: "Nil" } }), tail: { $: "Nil" } } });
}
function $calcResult(_value_0) {
  return $view_viewEl("output", { $: "Con", head: $view_attrId("result"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText(_value_0), tail: { $: "Nil" } });
}
function $histLabel(_expr_0, _result_0) {
  const _x_0 = " = " + _result_0;
  return _expr_0 + _x_0;
}
function $histEq(_result_0) {
  return "= " + _result_0;
}
function $histButton(_e_0) {
  const _expr_0 = _e_0["expr"];
  const _result_0 = _e_0["result"];
  return $view_viewEl("button", { $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_attrData("expr", _expr_0), tail: { $: "Con", head: $view_attrTitle(_expr_0), tail: { $: "Con", head: $view_attrAria("label", $histLabel(_expr_0, _result_0)), tail: { $: "Con", head: $view_attrOn("click", "Reuse"), tail: { $: "Nil" } } } } } }, { $: "Con", head: $view_viewEl("span", { $: "Con", head: $view_attrClass("calc-hist-expr"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText(_expr_0), tail: { $: "Nil" } }), tail: { $: "Con", head: $view_viewEl("span", { $: "Con", head: $view_attrClass("calc-hist-res"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText($histEq(_result_0)), tail: { $: "Nil" } }), tail: { $: "Nil" } } });
}
function $histItems(_hs_0) {
  return $view_viewMap_2(_hs_0);
}
function $calcHistory(_hs_0) {
  return $view_viewEl("div", { $: "Con", head: $view_attrId("calc-history"), tail: { $: "Nil" } }, $histItems(_hs_0));
}
function $clearButton(_empty_0) {
  return $view_viewEl("button", $view_attrJoin({ $: "Con", head: { $: "Con", head: $view_attrId("calc-clear"), tail: { $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_attrOn("click", "ClearHistory"), tail: { $: "Nil" } } } }, tail: { $: "Con", head: $view_attrWhen(_empty_0, { $: "ViewAttr", name: "disabled", value: "" }), tail: { $: "Nil" } } }), { $: "Con", head: $view_viewText($clearText()), tail: { $: "Nil" } });
}
function $historyHead(_empty_0) {
  return $view_viewEl("div", { $: "Con", head: $view_attrClass("calc-hist-head"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewEl("h3", { $: "Nil" }, { $: "Con", head: $view_viewText($historyTitleText()), tail: { $: "Nil" } }), tail: { $: "Con", head: $clearButton(_empty_0), tail: { $: "Nil" } } });
}
function $historyEmpty() {
  return $view_viewEl("p", { $: "Con", head: $view_attrClass("calc-hist-empty"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText($historyEmptyText()), tail: { $: "Nil" } });
}
function $historyBlock(_hs_0) {
  const _empty_0 = $List_is_empty(_hs_0);
  return $view_viewEl("div", { $: "Con", head: $view_attrId("calc-hist"), tail: { $: "Nil" } }, $view_viewJoin({ $: "Con", head: { $: "Con", head: $historyHead(_empty_0), tail: { $: "Nil" } }, tail: { $: "Con", head: $view_viewWhen(_empty_0, $historyEmpty()), tail: { $: "Con", head: { $: "Con", head: $calcHistory(_hs_0), tail: { $: "Nil" } }, tail: { $: "Nil" } } } }));
}
function $calcBar(_collapsed_0, _angle_0, _expression_0, _result_0) {
  return $view_viewEl("div", { $: "Con", head: $view_attrId("calc-bar"), tail: { $: "Con", head: { $: "ViewAttr", name: "role", value: "group" }, tail: { $: "Con", head: $view_attrAria("label", $calcTitle()), tail: { $: "Nil" } } } }, { $: "Con", head: $calcIcon(), tail: { $: "Con", head: $calcForm(_expression_0), tail: { $: "Con", head: $calcResult(_result_0), tail: { $: "Con", head: $calcUnit(_angle_0), tail: { $: "Con", head: $calcToggle(_collapsed_0), tail: { $: "Nil" } } } } } });
}
function $calcBody(_collapsed_0, _angle_0, _history_0, _guideOpen_0) {
  return $view_viewEl("div", $view_attrJoin({ $: "Con", head: { $: "Con", head: $view_attrId("calc-body"), tail: { $: "Nil" } }, tail: { $: "Con", head: $view_attrWhen(_collapsed_0, { $: "ViewAttr", name: "hidden", value: "" }), tail: { $: "Nil" } } }), { $: "Con", head: $angleRow(_angle_0), tail: { $: "Con", head: $historyBlock(_history_0), tail: { $: "Con", head: $calcGuide(_guideOpen_0), tail: { $: "Nil" } } } });
}
function $calculator(_visible_0, _collapsed_0, _angle_0, _expression_0, _result_0, _history_0, _guideOpen_0) {
  return $view_viewEl("section", $view_attrJoin({ $: "Con", head: { $: "Con", head: $view_attrId("calculator"), tail: { $: "Nil" } }, tail: { $: "Con", head: $view_attrWhen($Bool_not(_visible_0), { $: "ViewAttr", name: "hidden", value: "" }), tail: { $: "Con", head: { $: "Con", head: $view_classes({ $: "Con", head: $view_classOn("collapsed", _collapsed_0), tail: { $: "Nil" } }), tail: { $: "Nil" } }, tail: { $: "Nil" } } } }), { $: "Con", head: $calcBar(_collapsed_0, _angle_0, _expression_0, _result_0), tail: { $: "Con", head: $calcBody(_collapsed_0, _angle_0, _history_0, _guideOpen_0), tail: { $: "Nil" } } });
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
function $view_viewMap_1(_xs_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return { $: "Con", head: $codeNode(_h_0), tail: $view_viewMap_1(_t_0) };
  }
}
function $Bool_not(_b_0) {
  if (!_b_0) {
    return true;
  } else {
    return false;
  }
}
function $view_viewMap_2(_xs_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return { $: "Con", head: $histButton(_h_0), tail: $view_viewMap_2(_t_0) };
  }
}
function $List_is_empty(_xs_0) {
  if (_xs_0.$ === "Nil") {
    return true;
  } else {
    return false;
  }
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
var calcview_default = {
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
  calcTitle: run_lib(() => str_out(run_loop($calcTitle())), 0),
  angleAria: run_lib(() => str_out(run_loop($angleAria())), 0),
  angleLabelText: run_lib(() => str_out(run_loop($angleLabelText())), 0),
  expandLabel: run_lib(() => str_out(run_loop($expandLabel())), 0),
  collapseLabel: run_lib(() => str_out(run_loop($collapseLabel())), 0),
  expressionPlaceholder: run_lib(() => str_out(run_loop($expressionPlaceholder())), 0),
  expressionAria: run_lib(() => str_out(run_loop($expressionAria())), 0),
  equalsAria: run_lib(() => str_out(run_loop($equalsAria())), 0),
  equalsText: run_lib(() => str_out(run_loop($equalsText())), 0),
  historyTitleText: run_lib(() => str_out(run_loop($historyTitleText())), 0),
  clearText: run_lib(() => str_out(run_loop($clearText())), 0),
  historyEmptyText: run_lib(() => str_out(run_loop($historyEmptyText())), 0),
  guideSummaryText: run_lib(() => str_out(run_loop($guideSummaryText())), 0),
  guideLeadText: run_lib(() => str_out(run_loop($guideLeadText())), 0),
  codeNode: run_lib((a0) => run_loop($codeNode(str_in(a0))), 1),
  chips: run_lib((a0) => run_loop($chips(a0)), 1),
  opNames: run_lib(() => run_loop($opNames()), 0),
  fnNames: run_lib(() => run_loop($fnNames()), 0),
  trigNames: run_lib(() => run_loop($trigNames()), 0),
  constNames: run_lib(() => run_loop($constNames()), 0),
  guideGroup: run_lib((a0, a1) => run_loop($guideGroup(str_in(a0), a1)), 2),
  guideGroups: run_lib(() => run_loop($guideGroups()), 0),
  guideLead: run_lib(() => run_loop($guideLead()), 0),
  guideTip1: run_lib(() => run_loop($guideTip1()), 0),
  guideTip2: run_lib(() => run_loop($guideTip2()), 0),
  guideTip3: run_lib(() => run_loop($guideTip3()), 0),
  guideTip4: run_lib(() => run_loop($guideTip4()), 0),
  guideTip5: run_lib(() => run_loop($guideTip5()), 0),
  guideTips: run_lib(() => run_loop($guideTips()), 0),
  calcGuide: run_lib((a0) => run_loop($calcGuide(a0)), 1),
  isDegrees: run_lib((a0) => run_loop($isDegrees(str_in(a0))), 1),
  unitText: run_lib((a0) => str_out(run_loop($unitText(a0))), 1),
  unitLabel: run_lib((a0) => str_out(run_loop($unitLabel(str_in(a0)))), 1),
  calcUnit: run_lib((a0) => run_loop($calcUnit(str_in(a0))), 1),
  angleButton: run_lib((a0, a1, a2) => run_loop($angleButton(str_in(a0), str_in(a1), str_in(a2))), 3),
  angleGroup: run_lib((a0) => run_loop($angleGroup(str_in(a0))), 1),
  hintText: run_lib((a0) => str_out(run_loop($hintText(a0))), 1),
  angleHint: run_lib((a0) => run_loop($angleHint(str_in(a0))), 1),
  angleRow: run_lib((a0) => run_loop($angleRow(str_in(a0))), 1),
  calcIcon: run_lib(() => run_loop($calcIcon()), 0),
  toggleLabel: run_lib((a0) => str_out(run_loop($toggleLabel(a0))), 1),
  calcToggle: run_lib((a0) => run_loop($calcToggle(a0)), 1),
  expressionValue: run_lib((a0) => run_loop($expressionValue(str_in(a0))), 1),
  calcForm: run_lib((a0) => run_loop($calcForm(str_in(a0))), 1),
  calcResult: run_lib((a0) => run_loop($calcResult(str_in(a0))), 1),
  histLabel: run_lib((a0, a1) => str_out(run_loop($histLabel(str_in(a0), str_in(a1)))), 2),
  histEq: run_lib((a0) => str_out(run_loop($histEq(str_in(a0)))), 1),
  histButton: run_lib((a0) => run_loop($histButton(a0)), 1),
  histItems: run_lib((a0) => run_loop($histItems(a0)), 1),
  calcHistory: run_lib((a0) => run_loop($calcHistory(a0)), 1),
  clearButton: run_lib((a0) => run_loop($clearButton(a0)), 1),
  historyHead: run_lib((a0) => run_loop($historyHead(a0)), 1),
  historyEmpty: run_lib(() => run_loop($historyEmpty()), 0),
  historyBlock: run_lib((a0) => run_loop($historyBlock(a0)), 1),
  calcBar: run_lib((a0, a1, a2, a3) => run_loop($calcBar(a0, str_in(a1), str_in(a2), str_in(a3))), 4),
  calcBody: run_lib((a0, a1, a2, a3) => run_loop($calcBody(a0, str_in(a1), a2, a3)), 4),
  calculator: run_lib((a0, a1, a2, a3, a4, a5, a6) => run_loop($calculator(a0, a1, str_in(a2), str_in(a3), str_in(a4), a5, a6)), 7)
};
export {
  calcview_default as default
};

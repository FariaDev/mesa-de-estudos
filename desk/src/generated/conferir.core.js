// GERADO de core/conferir.bend por `bun core/build.mjs` — não editar à mão.
// core/conferir.bend
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
function $defaultApp() {
  return "Xournal++";
}
function $shortLabel() {
  return $msg_msg("check.short");
}
function $buttonLabel(_app_0) {
  return $msg_msg1("check.label", "app", _app_0);
}
function $buttonHint_pick(_isDefault_0, _app_0, _shortcut_0) {
  if (_isDefault_0) {
    return $msg_msg1("check.hint.default", "shortcut", _shortcut_0);
  } else {
    return $msg_msg2("check.hint.app", "app", _app_0, "shortcut", _shortcut_0);
  }
}
function $buttonHint(_app_0, _shortcut_0) {
  return $buttonHint_pick($String_eq(_app_0, $defaultApp()), _app_0, _shortcut_0);
}
function $busyHint() {
  return $msg_msg("check.busy");
}
function $hintFor_pick(_busy_0, _app_0, _shortcut_0) {
  if (_busy_0) {
    return $busyHint();
  } else {
    return $buttonHint(_app_0, _shortcut_0);
  }
}
function $hintFor(_busy_0, _app_0, _shortcut_0) {
  return $hintFor_pick(_busy_0, _app_0, _shortcut_0);
}
function $attachedText_pick(_isDefault_0, _app_0) {
  if (_isDefault_0) {
    return $msg_msg("check.attached.default");
  } else {
    return $msg_msg1("check.attached.app", "app", _app_0);
  }
}
function $attachedText(_app_0) {
  return $attachedText_pick($String_eq(_app_0, $defaultApp()), _app_0);
}
function $pickLabel() {
  return $msg_msg("conferir.pick");
}
function $fieldLabel() {
  return $msg_msg("conferir.fieldLabel");
}
function $chooseLabel() {
  return $msg_msg("conferir.choose");
}
function $chooseOtherLabel() {
  return $msg_msg("conferir.chooseOther");
}
function $fieldHint() {
  return $msg_msg("conferir.fieldHint");
}
function $unavailableHint() {
  return $msg_msg("conferir.unavailable");
}
function $pickHint() {
  return $msg_msg("conferir.pickHint");
}
function $backLabel() {
  return $msg_msg("conferir.back");
}
function $listAria() {
  return $msg_msg("conferir.listAria");
}
function $refreshLabel() {
  return $msg_msg("conferir.refresh");
}
function $emptyText() {
  return $msg_msg("conferir.empty");
}
function $untitledText() {
  return $msg_msg("conferir.untitled");
}
function $noteAria() {
  return $msg_msg("check.noteAria");
}
function $titleOrUntitled_pick(_blank_0, _title_0) {
  if (_blank_0) {
    return $untitledText();
  } else {
    return _title_0;
  }
}
function $titleOrUntitled(_title_0) {
  return $titleOrUntitled_pick($String_is_empty($String_trim(_title_0)), $String_trim(_title_0));
}
function $absentText_pick(_saved_0, _app_0) {
  if (!_saved_0) {
    return $msg_msg("check.absent.default");
  } else {
    return $msg_msg1("check.absent.app", "app", _app_0);
  }
}
function $absentText(_app_0, _saved_0) {
  return $absentText_pick(_saved_0, _app_0);
}
function $absentLead(_app_0, _saved_0) {
  return $absentText(_app_0, _saved_0);
}
function $defaultKey(_key_0) {
  const _x_0 = $String_eq(_key_0, "xournalpp");
  const _x_1 = $String_eq(_key_0, "xournal");
  const _x_2 = $String_eq(_key_0, "xournal++");
  const _x_3 = _x_0 || _x_1;
  return _x_2 || _x_3;
}
function $systemKey(_key_0) {
  const _x_0 = $String_eq(_key_0, "searchhost");
  const _x_1 = $String_eq(_key_0, "applicationframehost");
  const _x_2 = $String_eq(_key_0, "shellexperiencehost");
  const _x_3 = _x_0 || _x_1;
  const _x_4 = $String_eq(_key_0, "textinputhost");
  const _x_5 = _x_2 || _x_3;
  const _x_6 = $String_eq(_key_0, "windowmanager");
  const _x_7 = _x_4 || _x_5;
  const _x_8 = $String_eq(_key_0, "loginwindow");
  const _x_9 = _x_6 || _x_7;
  const _x_10 = $String_eq(_key_0, "spotlight");
  const _x_11 = _x_8 || _x_9;
  const _x_12 = $String_eq(_key_0, "notification center");
  const _x_13 = _x_10 || _x_11;
  const _x_14 = $String_eq(_key_0, "systemuiserver");
  const _x_15 = _x_12 || _x_13;
  const _x_16 = $String_eq(_key_0, "control center");
  const _x_17 = _x_14 || _x_15;
  const _x_18 = $String_eq(_key_0, "dock");
  const _x_19 = _x_16 || _x_17;
  const _x_20 = $String_eq(_key_0, "window server");
  const _x_21 = _x_18 || _x_19;
  return _x_20 || _x_21;
}
function $displayName_pick(_isDefault_0, _app_0) {
  if (_isDefault_0) {
    return $defaultApp();
  } else {
    return _app_0;
  }
}
function $displayName(_app_0, _key_0) {
  return $displayName_pick($defaultKey(_key_0), _app_0);
}
function $eligible(_w_0) {
  const _key_0 = _w_0["key"];
  const _usable_0 = _w_0["usable"];
  const _self_0 = _w_0["self"];
  return $Bool_and(_usable_0, $Bool_and($Bool_not(_self_0), $Bool_and($Bool_not($String_is_empty(_key_0)), $Bool_not($systemKey(_key_0)))));
}
function $keepIf(_ok_0, _w_0, _rest_0) {
  if (_ok_0) {
    return { $: "Con", head: _w_0, tail: _rest_0 };
  } else {
    return _rest_0;
  }
}
function $eligibleWins(_xs_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return $keepIf($eligible(_h_0), _h_0, $eligibleWins(_t_0));
  }
}
function $keyOf(_w_0) {
  const _key_0 = _w_0["key"];
  return _key_0;
}
function $choiceApp(_c_0) {
  const _app_0 = _c_0["app"];
  return _app_0;
}
function $choiceKey(_c_0) {
  const _key_0 = _c_0["key"];
  return _key_0;
}
function $wanted(_w_0, _choice_0) {
  if (_choice_0.$ === "None") {
    return $defaultKey($keyOf(_w_0));
  } else {
    const _c_0 = _choice_0["value"];
    return $String_eq($keyOf(_w_0), $choiceKey(_c_0));
  }
}
function $wantedLabel(_choice_0) {
  if (_choice_0.$ === "None") {
    return $defaultApp();
  } else {
    const _c_0 = _choice_0["value"];
    return $choiceApp(_c_0);
  }
}
function $isSaved(_choice_0) {
  if (_choice_0.$ === "None") {
    return false;
  } else {
    return true;
  }
}
function $matchingWins(_xs_0, _choice_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return $keepIf($wanted(_h_0, _choice_0), _h_0, $matchingWins(_t_0, _choice_0));
  }
}
function $captureOf(_w_0) {
  const _id_0 = _w_0["id"];
  const _app_0 = _w_0["app"];
  const _key_0 = _w_0["key"];
  const _title_0 = _w_0["title"];
  return { $: "ConfCapture", id: _id_0, app: $displayName(_app_0, _key_0), title: _title_0 };
}
function $decideFirst(_xs_0, _choice_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "ConfAbsent", app: $wantedLabel(_choice_0), saved: $isSaved(_choice_0) };
  } else {
    const _h_0 = _xs_0["head"];
    return $captureOf(_h_0);
  }
}
function $decide(_xs_0, _choice_0) {
  return $decideFirst($matchingWins($eligibleWins(_xs_0), _choice_0), _choice_0);
}
function $row(_w_0) {
  const _id_0 = _w_0["id"];
  const _app_0 = _w_0["app"];
  const _key_0 = _w_0["key"];
  const _title_0 = _w_0["title"];
  return $view_viewEl("li", { $: "Con", head: $view_attrClass("check-item"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewEl("button", { $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_attrClass("check-row"), tail: { $: "Con", head: $view_attrKey(_id_0), tail: { $: "Con", head: $view_attrOn("click", "Pick"), tail: { $: "Nil" } } } } }, { $: "Con", head: $view_viewEl("span", { $: "Con", head: $view_attrClass("check-row-app"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText($displayName(_app_0, _key_0)), tail: { $: "Nil" } }), tail: { $: "Con", head: $view_viewEl("span", { $: "Con", head: $view_attrClass("check-row-title"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText($titleOrUntitled(_title_0)), tail: { $: "Nil" } }), tail: { $: "Nil" } } }), tail: { $: "Nil" } });
}
function $emptyItem() {
  return $view_viewEl("li", { $: "Con", head: $view_attrClass("check-empty"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText($emptyText()), tail: { $: "Nil" } });
}
function $rowsOrEmpty(_xs_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Con", head: $emptyItem(), tail: { $: "Nil" } };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return $view_viewMap_1({ $: "Con", head: _h_0, tail: _t_0 });
  }
}
function $listView(_lead_0, _xs_0) {
  return $view_viewEl("div", { $: "Con", head: $view_attrClass("cfg-conferir-list-body"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewEl("p", { $: "Con", head: $view_attrClass("cfg-conferir-lead"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText(_lead_0), tail: { $: "Nil" } }), tail: { $: "Con", head: $view_viewEl("ul", { $: "Con", head: $view_attrClass("check-list"), tail: { $: "Con", head: $view_attrAria("label", $listAria()), tail: { $: "Nil" } } }, $rowsOrEmpty($eligibleWins(_xs_0))), tail: { $: "Con", head: $view_viewEl("div", { $: "Con", head: $view_attrClass("cfg-conferir-foot"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewEl("button", { $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_attrClass("check-refresh"), tail: { $: "Con", head: $view_attrOn("click", "Refresh"), tail: { $: "Nil" } } } }, { $: "Con", head: $view_viewText($refreshLabel()), tail: { $: "Nil" } }), tail: { $: "Nil" } }), tail: { $: "Nil" } } } });
}
function $fieldHintFor(_available_0) {
  if (_available_0) {
    return $fieldHint();
  } else {
    return $unavailableHint();
  }
}
function $fieldView(_app_0, _canGoBack_0, _available_0) {
  return $view_viewEl("div", { $: "Con", head: $view_attrClass("cfg-conferir"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewEl("span", { $: "Con", head: $view_attrClass("cfg-conferir-label"), tail: { $: "Con", head: $view_attrId("cfg-conferir-label"), tail: { $: "Nil" } } }, { $: "Con", head: $view_viewText($fieldLabel()), tail: { $: "Nil" } }), tail: { $: "Con", head: $view_viewEl("span", { $: "Con", head: $view_attrClass("path-row cfg-conferir-row"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewEl("output", { $: "Con", head: $view_attrId("cfg-conferir-app"), tail: { $: "Con", head: $view_attrClass("cfg-conferir-app"), tail: { $: "Con", head: $view_attrAria("labelledby", "cfg-conferir-label"), tail: { $: "Nil" } } } }, { $: "Con", head: $view_viewText(_app_0), tail: { $: "Nil" } }), tail: { $: "Con", head: $view_viewEl("button", $view_attrConcat({ $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_attrId("cfg-conferir-choose"), tail: { $: "Con", head: $view_attrAria("expanded", "false"), tail: { $: "Con", head: $view_attrOn("click", "Choose"), tail: { $: "Nil" } } } } }, $view_attrWhen($Bool_not(_available_0), $view_attr("disabled", ""))), { $: "Con", head: $view_viewText($chooseLabel()), tail: { $: "Nil" } }), tail: { $: "Con", head: $view_viewEl("button", $view_attrConcat({ $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_attrId("cfg-conferir-back"), tail: { $: "Con", head: $view_attrClass("cfg-conferir-back"), tail: { $: "Con", head: $view_attrOn("click", "Back"), tail: { $: "Nil" } } } } }, $view_attrWhen($Bool_not(_canGoBack_0), $view_attr("hidden", ""))), { $: "Con", head: $view_viewText($backLabel()), tail: { $: "Nil" } }), tail: { $: "Nil" } } } }), tail: { $: "Con", head: $view_viewEl("p", { $: "Con", head: $view_attrClass("cfg-conferir-hint"), tail: { $: "Con", head: $view_attrId("cfg-conferir-hint"), tail: { $: "Nil" } } }, { $: "Con", head: $view_viewText($fieldHintFor(_available_0)), tail: { $: "Nil" } }), tail: { $: "Nil" } } } });
}
function $absentView(_app_0, _saved_0) {
  return $view_viewEl("div", { $: "Con", head: $view_attrClass("check-note-body"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewEl("p", { $: "Con", head: $view_attrClass("check-note-text"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText($absentLead(_app_0, _saved_0)), tail: { $: "Nil" } }), tail: { $: "Con", head: $view_viewEl("button", { $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_attrClass("check-note-pick"), tail: { $: "Con", head: $view_attrOn("click", "ChooseOther"), tail: { $: "Nil" } } } }, { $: "Con", head: $view_viewText($chooseOtherLabel()), tail: { $: "Nil" } }), tail: { $: "Nil" } } });
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
function $String_trim(_s_0) {
  return $String_trim_end($String_trim_start(_s_0));
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
function $view_viewMap_1(_xs_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return { $: "Con", head: $row(_h_0), tail: $view_viewMap_1(_t_0) };
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
function $String_trim_end(_s_0) {
  return $String_reverse($String_trim_start($String_reverse(_s_0)));
}
function $String_trim_start($0, $1, $2) {
  let $pc = 0;
  for (;; )
    switch ($pc) {
      case 0: {
        const _s_0 = $0;
        if (_s_0 === "") {
          return "";
        } else {
          const _h_0 = _s_0.slice(0, char_len(_s_0));
          const _t_0 = _s_0.slice(char_len(_s_0));
          $0 = _t_0;
          $1 = _h_0;
          $2 = $Char_is_space(_h_0);
          $pc = 1;
          continue;
        }
      }
      case 1: {
        const _t_0 = $0;
        const _h_0 = $1;
        const _space_0 = $2;
        if (!_space_0) {
          return _h_0 + _t_0;
        } else {
          $0 = _t_0;
          $pc = 0;
          continue;
        }
      }
    }
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
function $String_reverse(_s_0) {
  return $String_reverse_go(_s_0, "");
}
function $Char_is_space(_c_0) {
  const _x_0 = char_code(_c_0);
  const _x_1 = char_code(_c_0);
  const _x_2 = char_code(_c_0);
  const _x_3 = _x_0 === 32;
  const _x_4 = $Bool_and(_x_1 >= 9, _x_2 <= 13);
  return _x_3 || _x_4;
}
function $String_reverse_go($0, $1) {
  for (;; ) {
    {
      const _s_0 = $0;
      const _acc_0 = $1;
      if (_s_0 === "") {
        return _acc_0;
      } else {
        const _h_0 = _s_0.slice(0, char_len(_s_0));
        const _t_0 = _s_0.slice(char_len(_s_0));
        $0 = _t_0;
        $1 = _h_0 + _acc_0;
        continue;
      }
    }
  }
}
var conferir_default = {
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
  defaultApp: run_lib(() => str_out(run_loop($defaultApp())), 0),
  shortLabel: run_lib(() => str_out(run_loop($shortLabel())), 0),
  buttonLabel: run_lib((a0) => str_out(run_loop($buttonLabel(str_in(a0)))), 1),
  "buttonHint.pick": run_lib((a0, a1, a2) => str_out(run_loop($buttonHint_pick(a0, str_in(a1), str_in(a2)))), 3),
  buttonHint: run_lib((a0, a1) => str_out(run_loop($buttonHint(str_in(a0), str_in(a1)))), 2),
  busyHint: run_lib(() => str_out(run_loop($busyHint())), 0),
  "hintFor.pick": run_lib((a0, a1, a2) => str_out(run_loop($hintFor_pick(a0, str_in(a1), str_in(a2)))), 3),
  hintFor: run_lib((a0, a1, a2) => str_out(run_loop($hintFor(a0, str_in(a1), str_in(a2)))), 3),
  "attachedText.pick": run_lib((a0, a1) => str_out(run_loop($attachedText_pick(a0, str_in(a1)))), 2),
  attachedText: run_lib((a0) => str_out(run_loop($attachedText(str_in(a0)))), 1),
  pickLabel: run_lib(() => str_out(run_loop($pickLabel())), 0),
  fieldLabel: run_lib(() => str_out(run_loop($fieldLabel())), 0),
  chooseLabel: run_lib(() => str_out(run_loop($chooseLabel())), 0),
  chooseOtherLabel: run_lib(() => str_out(run_loop($chooseOtherLabel())), 0),
  fieldHint: run_lib(() => str_out(run_loop($fieldHint())), 0),
  unavailableHint: run_lib(() => str_out(run_loop($unavailableHint())), 0),
  pickHint: run_lib(() => str_out(run_loop($pickHint())), 0),
  backLabel: run_lib(() => str_out(run_loop($backLabel())), 0),
  listAria: run_lib(() => str_out(run_loop($listAria())), 0),
  refreshLabel: run_lib(() => str_out(run_loop($refreshLabel())), 0),
  emptyText: run_lib(() => str_out(run_loop($emptyText())), 0),
  untitledText: run_lib(() => str_out(run_loop($untitledText())), 0),
  noteAria: run_lib(() => str_out(run_loop($noteAria())), 0),
  "titleOrUntitled.pick": run_lib((a0, a1) => str_out(run_loop($titleOrUntitled_pick(a0, str_in(a1)))), 2),
  titleOrUntitled: run_lib((a0) => str_out(run_loop($titleOrUntitled(str_in(a0)))), 1),
  "absentText.pick": run_lib((a0, a1) => str_out(run_loop($absentText_pick(a0, str_in(a1)))), 2),
  absentText: run_lib((a0, a1) => str_out(run_loop($absentText(str_in(a0), a1))), 2),
  absentLead: run_lib((a0, a1) => str_out(run_loop($absentLead(str_in(a0), a1))), 2),
  defaultKey: run_lib((a0) => run_loop($defaultKey(str_in(a0))), 1),
  systemKey: run_lib((a0) => run_loop($systemKey(str_in(a0))), 1),
  "displayName.pick": run_lib((a0, a1) => str_out(run_loop($displayName_pick(a0, str_in(a1)))), 2),
  displayName: run_lib((a0, a1) => str_out(run_loop($displayName(str_in(a0), str_in(a1)))), 2),
  eligible: run_lib((a0) => run_loop($eligible(a0)), 1),
  keepIf: run_lib((a0, a1, a2) => run_loop($keepIf(a0, a1, a2)), 3),
  eligibleWins: run_lib((a0) => run_loop($eligibleWins(a0)), 1),
  keyOf: run_lib((a0) => str_out(run_loop($keyOf(a0))), 1),
  choiceApp: run_lib((a0) => str_out(run_loop($choiceApp(a0))), 1),
  choiceKey: run_lib((a0) => str_out(run_loop($choiceKey(a0))), 1),
  wanted: run_lib((a0, a1) => run_loop($wanted(a0, a1)), 2),
  wantedLabel: run_lib((a0) => str_out(run_loop($wantedLabel(a0))), 1),
  isSaved: run_lib((a0) => run_loop($isSaved(a0)), 1),
  matchingWins: run_lib((a0, a1) => run_loop($matchingWins(a0, a1)), 2),
  captureOf: run_lib((a0) => run_loop($captureOf(a0)), 1),
  decideFirst: run_lib((a0, a1) => run_loop($decideFirst(a0, a1)), 2),
  decide: run_lib((a0, a1) => run_loop($decide(a0, a1)), 2),
  row: run_lib((a0) => run_loop($row(a0)), 1),
  emptyItem: run_lib(() => run_loop($emptyItem()), 0),
  rowsOrEmpty: run_lib((a0) => run_loop($rowsOrEmpty(a0)), 1),
  listView: run_lib((a0, a1) => run_loop($listView(str_in(a0), a1)), 2),
  fieldHintFor: run_lib((a0) => str_out(run_loop($fieldHintFor(a0))), 1),
  fieldView: run_lib((a0, a1, a2) => run_loop($fieldView(str_in(a0), a1, a2)), 3),
  absentView: run_lib((a0, a1) => run_loop($absentView(str_in(a0), a1)), 2)
};
export {
  conferir_default as default
};

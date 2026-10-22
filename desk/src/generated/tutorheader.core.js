// GERADO de core/tutorheader.bend por `bun core/build.mjs` — não editar à mão.
// core/tutorheader.bend
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
function $headIds() {
  return { $: "Con", head: "session-title", tail: { $: "Con", head: "sidechat-toggle", tail: { $: "Con", head: "new-session", tail: { $: "Con", head: "chat-more", tail: { $: "Nil" } } } } };
}
function $menuNode(_id_0, _role_0, _text_0, _icon_0, _handler_0, _extra_0) {
  return $view_viewEl("button", $view_attrJoin({ $: "Con", head: { $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_attrId(_id_0), tail: { $: "Con", head: $view_attr("role", _role_0), tail: { $: "Nil" } } } }, tail: { $: "Con", head: _extra_0, tail: { $: "Con", head: { $: "Con", head: $view_attrData("icon", _icon_0), tail: { $: "Con", head: $view_attrOn("click", _handler_0), tail: { $: "Nil" } } }, tail: { $: "Nil" } } } }), { $: "Con", head: $view_viewText(_text_0), tail: { $: "Nil" } });
}
function $item(_id_0, _text_0, _icon_0, _handler_0, _extra_0) {
  return $menuNode(_id_0, "menuitem", _text_0, _icon_0, _handler_0, _extra_0);
}
function $newSessionDefault() {
  return $item("new-session-default", $msg_msg("header.newSession"), "plus", "NewSession", { $: "Nil" });
}
function $newSessionClaude() {
  return $item("new-session-claude", $msg_msg("header.newSessionClaude"), "plus", "NewSessionClaude", { $: "Nil" });
}
function $newSessionOpenCode() {
  return $item("new-session-opencode", $msg_msg("header.newSessionOpenCode"), "plus", "NewSessionOpenCode", { $: "Nil" });
}
function $newSessionItems() {
  return { $: "Con", head: $newSessionDefault(), tail: { $: "Con", head: $newSessionClaude(), tail: { $: "Con", head: $newSessionOpenCode(), tail: { $: "Nil" } } } };
}
function $exportItem() {
  return $item("export-chat", $msg_msg("header.export"), "download", "ExportSession", { $: "Nil" });
}
function $endDayItem(_endDay_0) {
  return $item("end-day", $msg_msg("header.endDay"), "moon", "OpenEndDay", $view_attrWhen($Bool_not(_endDay_0), $view_attr("hidden", "")));
}
function $contextRow() {
  return $view_viewEl("div", { $: "Con", head: $view_attrId("more-context"), tail: { $: "Con", head: $view_attrClass("more-row"), tail: { $: "Con", head: $view_attr("role", "group"), tail: { $: "Con", head: $view_attr("aria-label", $msg_msg("header.context")), tail: { $: "Nil" } } } } }, { $: "Con", head: $view_viewEl("span", { $: "Con", head: $view_attrClass("more-row-label"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText($msg_msg("header.context")), tail: { $: "Nil" } }), tail: { $: "Con", head: $view_viewEl("span", { $: "Con", head: $view_attrId("more-context-slot"), tail: { $: "Con", head: $view_attrClass("more-row-value"), tail: { $: "Nil" } } }, { $: "Nil" }), tail: { $: "Con", head: $view_viewEl("span", { $: "Con", head: $view_attrId("more-context-empty"), tail: { $: "Con", head: $view_attrClass("more-row-value more-row-fine"), tail: { $: "Nil" } } }, { $: "Con", head: $view_viewText($msg_msg("header.contextEmpty")), tail: { $: "Nil" } }), tail: { $: "Nil" } } } });
}
function $autoCompactItem() {
  return $menuNode("more-auto-compact", "menuitemcheckbox", $msg_msg("header.autoCompact"), "rotateCw", "ToggleAutoCompact", { $: "Con", head: $view_attr("aria-checked", "false"), tail: { $: "Nil" } });
}
function $compactNowItem() {
  return $item("more-compact-now", $msg_msg("header.compactNow"), "rotateCw", "CompactNow", { $: "Nil" });
}
function $collapseItem() {
  return $item("chat-collapse", $msg_msg("header.collapse"), "chevronRight", "ToggleTutor", { $: "Nil" });
}
function $moreItems(_endDay_0) {
  return { $: "Con", head: $exportItem(), tail: { $: "Con", head: $endDayItem(_endDay_0), tail: { $: "Con", head: $contextRow(), tail: { $: "Con", head: $autoCompactItem(), tail: { $: "Con", head: $compactNowItem(), tail: { $: "Con", head: $collapseItem(), tail: { $: "Nil" } } } } } } };
}
function $levelKey_if(_hit_0, _key_0, _rest_0) {
  if (_hit_0) {
    return _key_0;
  } else {
    return _rest_0;
  }
}
function $levelKey(_level_0) {
  return $levelKey_if($String_eq(_level_0, "default"), "level.default", $levelKey_if($String_eq(_level_0, "off"), "level.off", $levelKey_if($String_eq(_level_0, "minimal"), "level.minimal", $levelKey_if($String_eq(_level_0, "low"), "level.low", $levelKey_if($String_eq(_level_0, "medium"), "level.medium", $levelKey_if($String_eq(_level_0, "high"), "level.high", $levelKey_if($String_eq(_level_0, "xhigh"), "level.xhigh", $levelKey_if($String_eq(_level_0, "max"), "level.max", _level_0))))))));
}
function $levelWord(_level_0) {
  return $msg_msg1("indicator.level", "level", $levelKey(_level_0));
}
function $modelWord_strip(_strip_0, _name_0) {
  if (_strip_0) {
    return $String_trim($String_drop(_name_0, 7));
  } else {
    return _name_0;
  }
}
function $modelWord(_name_0) {
  return $modelWord_strip($String_starts_with(_name_0, "Claude "), _name_0);
}
function $hasText(_text_0) {
  return $Bool_not($String_is_empty(_text_0));
}
function $pairText_pick(_hasModel_0, _hasLevel_0, _model_0, _level_0) {
  if (_hasModel_0) {
    if (_hasLevel_0) {
      return $msg_msg2("indicator.pair", "model", _model_0, "level", $levelKey(_level_0));
    } else {
      return _model_0;
    }
  } else {
    if (_hasLevel_0) {
      return $levelWord(_level_0);
    } else {
      return "";
    }
  }
}
function $pairText(_model_0, _level_0) {
  return $pairText_pick($hasText(_model_0), $hasText(_level_0), _model_0, _level_0);
}
function $linkLabel(_online_0) {
  if (_online_0) {
    return $msg_msg("tutor.link.on");
  } else {
    return $msg_msg("tutor.link.off");
  }
}
function $statusText_pick(_empty_0, _status_0) {
  if (_empty_0) {
    return $linkLabel(false);
  } else {
    return _status_0;
  }
}
function $statusText(_status_0) {
  return $statusText_pick($String_is_empty(_status_0), _status_0);
}
function $indicatorLive(_online_0, _model_0, _level_0) {
  const _x_0 = $hasText($modelWord(_model_0));
  const _x_1 = $hasText(_level_0);
  return $Bool_and(_online_0, _x_0 || _x_1);
}
function $indicatorLabel_pick(_live_0, _pair_0, _status_0) {
  if (_live_0) {
    return _pair_0;
  } else {
    return _status_0;
  }
}
function $indicatorLabel(_online_0, _status_0, _model_0, _level_0) {
  return $indicatorLabel_pick($indicatorLive(_online_0, _model_0, _level_0), $pairText($modelWord(_model_0), _level_0), $statusText(_status_0));
}
function $indicatorState(_online_0) {
  if (_online_0) {
    return "on";
  } else {
    return "off";
  }
}
function $indicatorHint_live(_hasModel_0, _hasLevel_0, _model_0, _level_0) {
  if (_hasModel_0) {
    if (_hasLevel_0) {
      return $msg_msg2("indicator.hint.pair", "model", _model_0, "level", $levelKey(_level_0));
    } else {
      return $msg_msg1("indicator.hint.model", "model", _model_0);
    }
  } else {
    return $msg_msg1("indicator.hint.level", "level", $levelKey(_level_0));
  }
}
function $indicatorHint_off(_noStatus_0, _status_0) {
  if (_noStatus_0) {
    return $msg_msg("indicator.hint.off");
  } else {
    return $msg_msg1("indicator.hint.status", "status", _status_0);
  }
}
function $indicatorHint_pick(_live_0, _model_0, _level_0, _status_0) {
  if (_live_0) {
    return $indicatorHint_live($hasText(_model_0), $hasText(_level_0), _model_0, _level_0);
  } else {
    return $indicatorHint_off($String_is_empty(_status_0), _status_0);
  }
}
function $indicatorHint(_online_0, _status_0, _model_0, _level_0) {
  return $indicatorHint_pick($indicatorLive(_online_0, _model_0, _level_0), $modelWord(_model_0), _level_0, _status_0);
}
function $indicatorModelPart_pick(_noModel_0, _model_0, _level_0) {
  if (_noModel_0) {
    return $levelWord(_level_0);
  } else {
    return _model_0;
  }
}
function $indicatorModelPart(_model_0, _level_0) {
  return $indicatorModelPart_pick($String_is_empty($modelWord(_model_0)), $modelWord(_model_0), _level_0);
}
function $indicatorLevelPart_pick(_none_0, _level_0) {
  if (_none_0) {
    return { $: "Nil" };
  } else {
    return { $: "Con", head: $view_viewText(" · "), tail: { $: "Con", head: $view_viewText($levelWord(_level_0)), tail: { $: "Nil" } } };
  }
}
function $indicatorLevelPart(_model_0, _level_0) {
  const _x_0 = $String_is_empty($modelWord(_model_0));
  const _x_1 = $String_is_empty(_level_0);
  return $indicatorLevelPart_pick(_x_0 || _x_1, _level_0);
}
function $indicatorKids_pick(_live_0, _model_0, _levelKids_0, _status_0) {
  if (_live_0) {
    return { $: "Con", head: $view_viewEl("span", { $: "Con", head: $view_attrClass("mi-model"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText(_model_0), tail: { $: "Nil" } }), tail: { $: "Con", head: $view_viewEl("span", { $: "Con", head: $view_attrClass("mi-level"), tail: { $: "Nil" } }, _levelKids_0), tail: { $: "Nil" } } };
  } else {
    return { $: "Con", head: $view_viewEl("span", { $: "Con", head: $view_attrClass("mi-model"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText(_status_0), tail: { $: "Nil" } }), tail: { $: "Nil" } };
  }
}
function $indicatorKids(_online_0, _status_0, _model_0, _level_0) {
  return $indicatorKids_pick($indicatorLive(_online_0, _model_0, _level_0), $indicatorModelPart(_model_0, _level_0), $indicatorLevelPart(_model_0, _level_0), $statusText(_status_0));
}
function $indicator(_online_0, _status_0, _model_0, _level_0) {
  const _hint_0 = $indicatorHint(_online_0, _status_0, _model_0, _level_0);
  return $view_viewEl("button", { $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_attrId("model-indicator"), tail: { $: "Con", head: $view_attrClass("model-indicator"), tail: { $: "Con", head: $view_attr("aria-haspopup", "dialog"), tail: { $: "Con", head: $view_attrAria("controls", "model-pop"), tail: { $: "Con", head: $view_attrAria("label", _hint_0), tail: { $: "Con", head: $view_attrData("tip", _hint_0), tail: { $: "Con", head: $view_attrData("state", $indicatorState(_online_0)), tail: { $: "Con", head: $view_attrOn("click", "ToggleModelPop"), tail: { $: "Nil" } } } } } } } } } }, { $: "Con", head: $view_viewEl("span", { $: "Con", head: $view_attrClass("mi-text"), tail: { $: "Nil" } }, $indicatorKids(_online_0, _status_0, _model_0, _level_0)), tail: { $: "Nil" } });
}
function $noteLead_pick(_online_0, _status_0) {
  if (_online_0) {
    return $msg_msg("popnote.fixed");
  } else {
    return $statusText(_status_0);
  }
}
function $noteBody(_online_0) {
  if (_online_0) {
    return $msg_msg("popnote.fixedBody");
  } else {
    return $msg_msg("popnote.offBody");
  }
}
function $popNote(_online_0, _connecting_0, _canPick_0, _status_0) {
  return $view_viewEl("div", $view_attrJoin({ $: "Con", head: { $: "Con", head: $view_attrId("model-pop-note"), tail: { $: "Con", head: $view_attrClass("model-pop-note"), tail: { $: "Nil" } } }, tail: { $: "Con", head: $view_attrWhen($Bool_and(_online_0, _canPick_0), $view_attr("hidden", "")), tail: { $: "Nil" } } }), { $: "Con", head: $view_viewEl("p", { $: "Con", head: $view_attrClass("model-pop-lead"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText($noteLead_pick(_online_0, _status_0)), tail: { $: "Nil" } }), tail: { $: "Con", head: $view_viewEl("p", { $: "Con", head: $view_attrClass("fine"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText($noteBody(_online_0)), tail: { $: "Nil" } }), tail: { $: "Con", head: $view_viewEl("button", $view_attrJoin({ $: "Con", head: { $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_attrId("model-pop-connect"), tail: { $: "Con", head: $view_attrOn("click", "ConnectTutor"), tail: { $: "Nil" } } } }, tail: { $: "Con", head: $view_attrWhen(_online_0 || _connecting_0, $view_attr("hidden", "")), tail: { $: "Nil" } } }), { $: "Con", head: $view_viewText($msg_msg("tutor.connect")), tail: { $: "Nil" } }), tail: { $: "Nil" } } } });
}
function $sessionName_dated(_when_0) {
  return $msg_msg1("session.dated", "when", _when_0);
}
function $sessionName_noSubject(_noWhen_0, _when_0) {
  if (_noWhen_0) {
    return $msg_msg("session.untitled");
  } else {
    return $sessionName_dated(_when_0);
  }
}
function $sessionName_pick(_empty_0, _subject_0, _when_0) {
  if (!_empty_0) {
    return _subject_0;
  } else {
    return $sessionName_noSubject($String_is_empty(_when_0), _when_0);
  }
}
function $sessionName(_subject_0, _when_0) {
  return $sessionName_pick($String_is_empty(_subject_0), _subject_0, _when_0);
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
function $Bool_not(_b_0) {
  if (!_b_0) {
    return true;
  } else {
    return false;
  }
}
function $String_trim(_s_0) {
  return $String_trim_end($String_trim_start(_s_0));
}
function $String_drop($0, $1) {
  for (;; ) {
    {
      const _s_0 = $0;
      const _n_0 = $1;
      if (_s_0 === "") {
        return "";
      } else {
        const _h_0 = _s_0.slice(0, char_len(_s_0));
        const _t_0 = _s_0.slice(char_len(_s_0));
        if (_n_0 === 0) {
          return _h_0 + _t_0;
        } else {
          const _p_0 = _n_0 - 1;
          $0 = _t_0;
          $1 = _p_0;
          continue;
        }
      }
    }
  }
}
function $Bool_and(_a_0, _b_0) {
  if (!_a_0) {
    return false;
  } else {
    return _b_0;
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
var tutorheader_default = {
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
  headIds: run_lib(() => run_loop($headIds()), 0),
  menuNode: run_lib((a0, a1, a2, a3, a4, a5) => run_loop($menuNode(str_in(a0), str_in(a1), str_in(a2), str_in(a3), str_in(a4), a5)), 6),
  item: run_lib((a0, a1, a2, a3, a4) => run_loop($item(str_in(a0), str_in(a1), str_in(a2), str_in(a3), a4)), 5),
  newSessionDefault: run_lib(() => run_loop($newSessionDefault()), 0),
  newSessionClaude: run_lib(() => run_loop($newSessionClaude()), 0),
  newSessionOpenCode: run_lib(() => run_loop($newSessionOpenCode()), 0),
  newSessionItems: run_lib(() => run_loop($newSessionItems()), 0),
  exportItem: run_lib(() => run_loop($exportItem()), 0),
  endDayItem: run_lib((a0) => run_loop($endDayItem(a0)), 1),
  contextRow: run_lib(() => run_loop($contextRow()), 0),
  autoCompactItem: run_lib(() => run_loop($autoCompactItem()), 0),
  compactNowItem: run_lib(() => run_loop($compactNowItem()), 0),
  collapseItem: run_lib(() => run_loop($collapseItem()), 0),
  moreItems: run_lib((a0) => run_loop($moreItems(a0)), 1),
  "levelKey.if": run_lib((a0, a1, a2) => str_out(run_loop($levelKey_if(a0, str_in(a1), str_in(a2)))), 3),
  levelKey: run_lib((a0) => str_out(run_loop($levelKey(str_in(a0)))), 1),
  levelWord: run_lib((a0) => str_out(run_loop($levelWord(str_in(a0)))), 1),
  "modelWord.strip": run_lib((a0, a1) => str_out(run_loop($modelWord_strip(a0, str_in(a1)))), 2),
  modelWord: run_lib((a0) => str_out(run_loop($modelWord(str_in(a0)))), 1),
  hasText: run_lib((a0) => run_loop($hasText(str_in(a0))), 1),
  "pairText.pick": run_lib((a0, a1, a2, a3) => str_out(run_loop($pairText_pick(a0, a1, str_in(a2), str_in(a3)))), 4),
  pairText: run_lib((a0, a1) => str_out(run_loop($pairText(str_in(a0), str_in(a1)))), 2),
  linkLabel: run_lib((a0) => str_out(run_loop($linkLabel(a0))), 1),
  "statusText.pick": run_lib((a0, a1) => str_out(run_loop($statusText_pick(a0, str_in(a1)))), 2),
  statusText: run_lib((a0) => str_out(run_loop($statusText(str_in(a0)))), 1),
  indicatorLive: run_lib((a0, a1, a2) => run_loop($indicatorLive(a0, str_in(a1), str_in(a2))), 3),
  "indicatorLabel.pick": run_lib((a0, a1, a2) => str_out(run_loop($indicatorLabel_pick(a0, str_in(a1), str_in(a2)))), 3),
  indicatorLabel: run_lib((a0, a1, a2, a3) => str_out(run_loop($indicatorLabel(a0, str_in(a1), str_in(a2), str_in(a3)))), 4),
  indicatorState: run_lib((a0) => str_out(run_loop($indicatorState(a0))), 1),
  "indicatorHint.live": run_lib((a0, a1, a2, a3) => str_out(run_loop($indicatorHint_live(a0, a1, str_in(a2), str_in(a3)))), 4),
  "indicatorHint.off": run_lib((a0, a1) => str_out(run_loop($indicatorHint_off(a0, str_in(a1)))), 2),
  "indicatorHint.pick": run_lib((a0, a1, a2, a3) => str_out(run_loop($indicatorHint_pick(a0, str_in(a1), str_in(a2), str_in(a3)))), 4),
  indicatorHint: run_lib((a0, a1, a2, a3) => str_out(run_loop($indicatorHint(a0, str_in(a1), str_in(a2), str_in(a3)))), 4),
  "indicatorModelPart.pick": run_lib((a0, a1, a2) => str_out(run_loop($indicatorModelPart_pick(a0, str_in(a1), str_in(a2)))), 3),
  indicatorModelPart: run_lib((a0, a1) => str_out(run_loop($indicatorModelPart(str_in(a0), str_in(a1)))), 2),
  "indicatorLevelPart.pick": run_lib((a0, a1) => run_loop($indicatorLevelPart_pick(a0, str_in(a1))), 2),
  indicatorLevelPart: run_lib((a0, a1) => run_loop($indicatorLevelPart(str_in(a0), str_in(a1))), 2),
  "indicatorKids.pick": run_lib((a0, a1, a2, a3) => run_loop($indicatorKids_pick(a0, str_in(a1), a2, str_in(a3))), 4),
  indicatorKids: run_lib((a0, a1, a2, a3) => run_loop($indicatorKids(a0, str_in(a1), str_in(a2), str_in(a3))), 4),
  indicator: run_lib((a0, a1, a2, a3) => run_loop($indicator(a0, str_in(a1), str_in(a2), str_in(a3))), 4),
  "noteLead.pick": run_lib((a0, a1) => str_out(run_loop($noteLead_pick(a0, str_in(a1)))), 2),
  noteBody: run_lib((a0) => str_out(run_loop($noteBody(a0))), 1),
  popNote: run_lib((a0, a1, a2, a3) => run_loop($popNote(a0, a1, a2, str_in(a3))), 4),
  "sessionName.dated": run_lib((a0) => str_out(run_loop($sessionName_dated(str_in(a0)))), 1),
  "sessionName.noSubject": run_lib((a0, a1) => str_out(run_loop($sessionName_noSubject(a0, str_in(a1)))), 2),
  "sessionName.pick": run_lib((a0, a1, a2) => str_out(run_loop($sessionName_pick(a0, str_in(a1), str_in(a2)))), 3),
  sessionName: run_lib((a0, a1) => str_out(run_loop($sessionName(str_in(a0), str_in(a1)))), 2)
};
export {
  tutorheader_default as default
};

// GERADO de core/claudeversion.bend por `bun core/build.mjs` — não editar à mão.
// core/claudeversion.bend
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
function $updatenotice_isVer(_v_0) {
  if (_v_0.$ === "NoVer") {
    return false;
  } else {
    return true;
  }
}
function $updatenotice_tripleNewer(_am_0, _an_0, _ap_0, _bm_0, _bn_0, _bp_0) {
  const _x_0 = _an_0 > _bn_0;
  const _x_1 = $Bool_and(_an_0 === _bn_0, _ap_0 > _bp_0);
  const _x_2 = _am_0 > _bm_0;
  const _x_3 = $Bool_and(_am_0 === _bm_0, _x_0 || _x_1);
  return _x_2 || _x_3;
}
function $updatenotice_verNewer(_a_0, _b_0) {
  if (_a_0.$ === "NoVer") {
    return false;
  } else {
    const _am_0 = _a_0["major"];
    const _an_0 = _a_0["minor"];
    const _ap_0 = _a_0["patch"];
    if (_b_0.$ === "NoVer") {
      return false;
    } else {
      const _bm_0 = _b_0["major"];
      const _bn_0 = _b_0["minor"];
      const _bp_0 = _b_0["patch"];
      return $updatenotice_tripleNewer(_am_0, _an_0, _ap_0, _bm_0, _bn_0, _bp_0);
    }
  }
}
function $updatenotice_verPick(_c_0, _a_0, _b_0) {
  if (_c_0) {
    return _a_0;
  } else {
    return _b_0;
  }
}
function $updatenotice_verMax(_a_0, _b_0) {
  const _x_0 = $Bool_not($updatenotice_isVer(_a_0));
  const _x_1 = $updatenotice_verNewer(_b_0, _a_0);
  return $updatenotice_verPick(_x_0 || _x_1, _b_0, _a_0);
}
function $updatenotice_emptyMemory() {
  return { $: "Memory", seen: { $: "NoVer" }, ignored: { $: "NoVer" }, remindDay: 0 };
}
function $updatenotice_ignoredCovers(_latest_0, _ignored_0) {
  return $Bool_and($updatenotice_isVer(_ignored_0), $Bool_not($updatenotice_verNewer(_latest_0, _ignored_0)));
}
function $updatenotice_newerThanSeen(_latest_0, _seen_0) {
  const _x_0 = $Bool_not($updatenotice_isVer(_seen_0));
  const _x_1 = $updatenotice_verNewer(_latest_0, _seen_0);
  return _x_0 || _x_1;
}
function $updatenotice_targetVersion(_available_0, _latest_0, _installed_0) {
  return $updatenotice_verPick(_available_0, _latest_0, _installed_0);
}
function $updatenotice_noticeFrom(_available_0, _unreachable_0, _quiet_0, _newer_0, _ahead_0) {
  return { $: "Notice", available: _available_0, unreachable: _unreachable_0, showLine: $Bool_and(_available_0, $Bool_not(_quiet_0)), showDot: $Bool_and($Bool_and(_available_0, $Bool_not(_quiet_0)), _newer_0), ahead: _ahead_0 };
}
function $updatenotice_noticeOf(_installed_0, _latest_0, _tested_0, _m_0, _today_0) {
  const _seen_0 = _m_0["seen"];
  const _ignored_0 = _m_0["ignored"];
  const _remindDay_0 = _m_0["remindDay"];
  const _x_0 = $updatenotice_ignoredCovers(_latest_0, _ignored_0);
  const _x_1 = _today_0 < _remindDay_0;
  return $updatenotice_noticeFrom($updatenotice_verNewer(_latest_0, _installed_0), $Bool_not($updatenotice_isVer(_latest_0)), _x_0 || _x_1, $updatenotice_newerThanSeen(_latest_0, _seen_0), $updatenotice_verNewer($updatenotice_targetVersion($updatenotice_verNewer(_latest_0, _installed_0), _latest_0, _installed_0), _tested_0));
}
function $updatenotice_seenAfterOpen(_seen_0, _latest_0, _available_0) {
  return $updatenotice_verPick(_available_0, $updatenotice_verMax(_seen_0, _latest_0), _seen_0);
}
function $updatenotice_afterOpen(_m_0, _installed_0, _latest_0) {
  const _seen_0 = _m_0["seen"];
  const _ignored_0 = _m_0["ignored"];
  const _remindDay_0 = _m_0["remindDay"];
  return { $: "Memory", seen: $updatenotice_seenAfterOpen(_seen_0, _latest_0, $updatenotice_verNewer(_latest_0, _installed_0)), ignored: _ignored_0, remindDay: _remindDay_0 };
}
function $updatenotice_afterPostpone(_m_0, _today_0) {
  const _ignored_0 = _m_0["ignored"];
  return { $: "Memory", seen: { $: "NoVer" }, ignored: _ignored_0, remindDay: _today_0 + 1 >>> 0 };
}
function $updatenotice_afterIgnore(_m_0, _latest_0) {
  const _seen_0 = _m_0["seen"];
  const _ignored_0 = _m_0["ignored"];
  const _remindDay_0 = _m_0["remindDay"];
  return { $: "Memory", seen: _seen_0, ignored: $updatenotice_verMax(_ignored_0, _latest_0), remindDay: _remindDay_0 };
}
function $updatenotice_noticeText(_name_0, _version_0) {
  return $msg_msg2("update.noticeAvailable", "name", _name_0, "version", _version_0);
}
function $updatenotice_aheadText() {
  return $msg_msg("update.ahead");
}
function $updatenotice_offlineText() {
  return $msg_msg("update.offline");
}
function $updatenotice_remindLabel() {
  return $msg_msg("update.remind");
}
function $updatenotice_ignoreLabel() {
  return $msg_msg("update.ignore");
}
function $updatenotice_updateLabel() {
  return $msg_msg("update.update");
}
function $updatenotice_copyLabel() {
  return $msg_msg("common.copy");
}
function $updatenotice_cancelLabel() {
  return $msg_msg("common.cancel");
}
function $updatenotice_closeLabel() {
  return $msg_msg("common.close");
}
function $updatenotice_waitHint() {
  return $msg_msg("update.waitHint");
}
function $updatenotice_waitShort() {
  return $msg_msg("update.waitShort");
}
function $updatenotice_settingsTitle(_dot_0) {
  if (_dot_0) {
    return $msg_msg("chrome.settings.withUpdate");
  } else {
    return $msg_msg("chrome.settings");
  }
}
function $updatenotice_aheadWarning(_version_0, _tested_0) {
  return $msg_msg2("update.aheadWarning", "version", _version_0, "tested", _tested_0);
}
function $updatenotice_runningText() {
  return $msg_msg("update.running");
}
function $updatenotice_willRunText() {
  return $msg_msg("update.willRun");
}
function $updatenotice_relinkedText() {
  return $msg_msg("update.relinked");
}
function $updatenotice_doneSentence_same(_name_0, _before_0) {
  return $msg_msg2("update.sameVersion", "name", _name_0, "version", _before_0);
}
function $updatenotice_doneSentence_changed(_name_0, _after_0, _relinked_0) {
  if (_relinked_0) {
    return $msg_msg2("update.updatedRelinked", "name", _name_0, "version", _after_0);
  } else {
    return $msg_msg2("update.updated", "name", _name_0, "version", _after_0);
  }
}
function $updatenotice_doneSentence_improved(_name_0, _before_0, _after_0, _relinked_0, _improved_0) {
  if (_improved_0) {
    return $updatenotice_doneSentence_changed(_name_0, _after_0, _relinked_0);
  } else {
    return $updatenotice_doneSentence_same(_name_0, _before_0);
  }
}
function $updatenotice_doneSentence_known(_name_0, _before_0, _after_0, _relinked_0, _known_0, _improved_0) {
  if (!_known_0) {
    return $msg_msg1("update.unreadable", "name", _name_0);
  } else {
    return $updatenotice_doneSentence_improved(_name_0, _before_0, _after_0, _relinked_0, _improved_0);
  }
}
function $updatenotice_doneSentence_ok(_name_0, _beforeV_0, _afterV_0, _before_0, _after_0, _relinked_0) {
  return $updatenotice_doneSentence_known(_name_0, _before_0, _after_0, _relinked_0, $updatenotice_isVer(_afterV_0), $updatenotice_verNewer(_afterV_0, _beforeV_0));
}
function $updatenotice_doneSentence(_name_0, _ok_0, _beforeV_0, _afterV_0, _before_0, _after_0, _relinked_0) {
  if (_ok_0) {
    return $updatenotice_doneSentence_ok(_name_0, _beforeV_0, _afterV_0, _before_0, _after_0, _relinked_0);
  } else {
    return $msg_msg1("update.failedRun", "name", _name_0);
  }
}
function $updatenotice_noticeIcon() {
  return $view_viewEl("span", { $: "Con", head: $view_attrClass("update-icon"), tail: { $: "Con", head: $view_attrData("state", "new"), tail: { $: "Con", head: $view_attrAria("hidden", "true"), tail: { $: "Nil" } } } }, { $: "Con", head: $view_viewText("↑"), tail: { $: "Nil" } });
}
function $updatenotice_noticeButton(_id_0, _handler_0, _label_0) {
  return $view_viewEl("button", { $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_attrClass("notice-btn"), tail: { $: "Con", head: $view_attrData("id", _id_0), tail: { $: "Con", head: $view_attrOn("click", _handler_0), tail: { $: "Nil" } } } } }, { $: "Con", head: $view_viewText(_label_0), tail: { $: "Nil" } });
}
function $updatenotice_noticeLineText(_name_0, _version_0, _ahead_0) {
  return $view_viewEl("p", { $: "Con", head: $view_attrClass("update-text"), tail: { $: "Nil" } }, $view_viewJoin({ $: "Con", head: { $: "Con", head: $view_viewEl("span", { $: "Con", head: $view_attrClass("update-main"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText($updatenotice_noticeText(_name_0, _version_0)), tail: { $: "Nil" } }), tail: { $: "Nil" } }, tail: { $: "Con", head: $view_viewWhen(_ahead_0, $view_viewEl("span", { $: "Con", head: $view_attrClass("update-muted"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText(" · "), tail: { $: "Con", head: $view_viewText($updatenotice_aheadText()), tail: { $: "Nil" } } })), tail: { $: "Nil" } } }));
}
function $updatenotice_noticeLineBody(_id_0, _name_0, _version_0, _ahead_0, _leading_0) {
  return $view_viewEl("div", { $: "Con", head: $view_attrClass("about-notice"), tail: { $: "Con", head: $view_attrData("id", _id_0), tail: { $: "Nil" } } }, $view_viewJoin({ $: "Con", head: { $: "Con", head: $updatenotice_noticeIcon(), tail: { $: "Con", head: $updatenotice_noticeLineText(_name_0, _version_0, _ahead_0), tail: { $: "Nil" } } }, tail: { $: "Con", head: _leading_0, tail: { $: "Con", head: { $: "Con", head: $updatenotice_noticeButton(_id_0, "PostponeNotice", $updatenotice_remindLabel()), tail: { $: "Con", head: $updatenotice_noticeButton(_id_0, "IgnoreNotice", $updatenotice_ignoreLabel()), tail: { $: "Nil" } } }, tail: { $: "Nil" } } } }));
}
function $updatenotice_noticeLineNode(_l_0) {
  const _id_0 = _l_0["id"];
  const _name_0 = _l_0["name"];
  const _version_0 = _l_0["version"];
  const _ahead_0 = _l_0["ahead"];
  return $updatenotice_noticeLineBody(_id_0, _name_0, _version_0, _ahead_0, { $: "Nil" });
}
function $updatenotice_noticeLines(_ls_0) {
  if (_ls_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _ls_0["head"];
    const _t_0 = _ls_0["tail"];
    return { $: "Con", head: $updatenotice_noticeLineNode(_h_0), tail: $updatenotice_noticeLines(_t_0) };
  }
}
function $updatenotice_showsNotice(_s_0) {
  if (_s_0.$ === "About") {
    return true;
  } else {
    return true;
  }
}
function $updatenotice_seesLine(_s_0, _lineVisible_0) {
  return $Bool_and($updatenotice_showsNotice(_s_0), _lineVisible_0);
}
function $updatenotice_seeAboutLabel() {
  return $msg_msg("update.seeAbout");
}
function $updatenotice_seeAboutButton(_id_0) {
  return $view_viewEl("button", { $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_attrClass("notice-btn"), tail: { $: "Con", head: $view_attrData("id", _id_0), tail: { $: "Con", head: $view_attrOn("click", "OpenAboutFromNotice"), tail: { $: "Nil" } } } } }, { $: "Con", head: $view_viewText($updatenotice_seeAboutLabel()), tail: { $: "Nil" } });
}
function $updatenotice_noticeLineFor(_s_0, _l_0) {
  if (_s_0.$ === "About") {
    return $updatenotice_noticeLineNode(_l_0);
  } else {
    const _id_0 = _l_0["id"];
    const _name_0 = _l_0["name"];
    const _version_0 = _l_0["version"];
    const _ahead_0 = _l_0["ahead"];
    return $updatenotice_noticeLineBody(_id_0, _name_0, _version_0, _ahead_0, { $: "Con", head: $updatenotice_seeAboutButton(_id_0), tail: { $: "Nil" } });
  }
}
function $updatenotice_noticeLinesFor(_s_0, _ls_0) {
  if (_ls_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _ls_0["head"];
    const _t_0 = _ls_0["tail"];
    return { $: "Con", head: $updatenotice_noticeLineFor(_s_0, _h_0), tail: $updatenotice_noticeLinesFor(_s_0, _t_0) };
  }
}
function $updatenotice_hasAction(_a_0) {
  if (_a_0.$ === "ToolNone") {
    return false;
  } else if (_a_0.$ === "ToolLocal") {
    return true;
  } else if (_a_0.$ === "ToolAsk") {
    return true;
  } else if (_a_0.$ === "ToolWait") {
    return true;
  } else {
    return true;
  }
}
function $updatenotice_localButton() {
  return $view_viewEl("button", { $: "Con", head: $view_attrId("update-pi"), tail: { $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_attrClass("component-update"), tail: { $: "Con", head: $view_attrOn("click", "UpdatePi"), tail: { $: "Nil" } } } } }, { $: "Con", head: $view_viewText($msg_msg("update.pi")), tail: { $: "Nil" } });
}
function $updatenotice_askButton(_command_0) {
  return $view_viewEl("button", { $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_attrClass("component-update tool-ask"), tail: { $: "Con", head: $view_attrData("command", _command_0), tail: { $: "Con", head: $view_attrOn("click", "AskUpdate"), tail: { $: "Nil" } } } } }, { $: "Con", head: $view_viewText($updatenotice_updateLabel()), tail: { $: "Nil" } });
}
function $updatenotice_waitNodes() {
  return { $: "Con", head: $view_viewEl("button", { $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_attrClass("component-update tool-ask"), tail: { $: "Con", head: $view_attr("disabled", ""), tail: { $: "Con", head: $view_attr("title", $updatenotice_waitHint()), tail: { $: "Con", head: $view_attrAria("describedby", "tool-wait-hint"), tail: { $: "Nil" } } } } } }, { $: "Con", head: $view_viewText($updatenotice_updateLabel()), tail: { $: "Nil" } }), tail: { $: "Con", head: $view_viewEl("small", { $: "Con", head: $view_attrClass("component-wait"), tail: { $: "Con", head: $view_attrId("tool-wait-hint"), tail: { $: "Nil" } } }, { $: "Con", head: $view_viewText($updatenotice_waitShort()), tail: { $: "Nil" } }), tail: { $: "Nil" } } };
}
function $updatenotice_copyButton(_command_0) {
  return $view_viewEl("button", { $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_attrClass("component-update tool-copy"), tail: { $: "Con", head: $view_attrData("command", _command_0), tail: { $: "Con", head: $view_attrAria("label", $msg_msg1("update.copyAria", "command", _command_0)), tail: { $: "Con", head: $view_attrOn("click", "CopyCommand"), tail: { $: "Nil" } } } } } }, { $: "Con", head: $view_viewText($updatenotice_copyLabel()), tail: { $: "Nil" } });
}
function $updatenotice_actionNodes(_a_0) {
  if (_a_0.$ === "ToolNone") {
    return { $: "Nil" };
  } else if (_a_0.$ === "ToolLocal") {
    return { $: "Con", head: $updatenotice_localButton(), tail: { $: "Nil" } };
  } else if (_a_0.$ === "ToolAsk") {
    const _command_0 = _a_0["command"];
    return { $: "Con", head: $updatenotice_askButton(_command_0), tail: { $: "Nil" } };
  } else if (_a_0.$ === "ToolWait") {
    return $updatenotice_waitNodes();
  } else {
    const _command_1 = _a_0["command"];
    return { $: "Con", head: $updatenotice_copyButton(_command_1), tail: { $: "Nil" } };
  }
}
function $updatenotice_commandNode(_command_0) {
  return $view_viewEl("code", { $: "Con", head: $view_attrClass("run-command"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText(_command_0), tail: { $: "Nil" } });
}
function $updatenotice_runLine(_label_0, _command_0) {
  return $view_viewEl("p", { $: "Con", head: $view_attrClass("run-line"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText(_label_0), tail: { $: "Con", head: $updatenotice_commandNode(_command_0), tail: { $: "Nil" } } });
}
function $updatenotice_outputNode(_output_0) {
  return $view_viewWhen($Bool_not($String_is_empty(_output_0)), $view_viewEl("pre", { $: "Con", head: $view_attrClass("run-output"), tail: { $: "Con", head: $view_attr("tabindex", "0"), tail: { $: "Con", head: $view_attr("role", "log"), tail: { $: "Con", head: $view_attrAria("label", $msg_msg("update.outputAria")), tail: { $: "Nil" } } } } }, { $: "Con", head: $view_viewText(_output_0), tail: { $: "Nil" } }));
}
function $updatenotice_runButton(_label_0, _handler_0, _cls_0) {
  return $view_viewEl("button", { $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_attrClass(_cls_0), tail: { $: "Con", head: $view_attrOn("click", _handler_0), tail: { $: "Nil" } } } }, { $: "Con", head: $view_viewText(_label_0), tail: { $: "Nil" } });
}
function $updatenotice_donePhase(_ok_0) {
  if (_ok_0) {
    return "done";
  } else {
    return "failed";
  }
}
function $updatenotice_runPanel(_phase_0, _kids_0) {
  return $view_viewEl("div", { $: "Con", head: $view_attrClass("component-run"), tail: { $: "Con", head: $view_attrData("phase", _phase_0), tail: { $: "Con", head: $view_attr("role", "group"), tail: { $: "Nil" } } } }, _kids_0);
}
function $updatenotice_confirmNodes(_command_0, _warning_0) {
  return $updatenotice_runPanel("confirm", $view_viewJoin({ $: "Con", head: { $: "Con", head: $updatenotice_runLine($updatenotice_willRunText(), _command_0), tail: { $: "Nil" } }, tail: { $: "Con", head: $view_viewWhen($Bool_not($String_is_empty(_warning_0)), $view_viewEl("p", { $: "Con", head: $view_attrClass("run-warn"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText(_warning_0), tail: { $: "Nil" } })), tail: { $: "Con", head: { $: "Con", head: $view_viewEl("div", { $: "Con", head: $view_attrClass("run-actions"), tail: { $: "Nil" } }, { $: "Con", head: $updatenotice_runButton($updatenotice_cancelLabel(), "CancelRun", "run-cancel"), tail: { $: "Con", head: $updatenotice_runButton($updatenotice_updateLabel(), "ConfirmRun", "primary run-confirm"), tail: { $: "Nil" } } }), tail: { $: "Nil" } }, tail: { $: "Nil" } } } }));
}
function $updatenotice_busyNodes(_command_0, _output_0) {
  return $view_viewEl("div", { $: "Con", head: $view_attrClass("component-run"), tail: { $: "Con", head: $view_attrData("phase", "busy"), tail: { $: "Con", head: $view_attr("role", "group"), tail: { $: "Con", head: $view_attrAria("live", "polite"), tail: { $: "Nil" } } } } }, $view_viewJoin({ $: "Con", head: { $: "Con", head: $updatenotice_runLine($updatenotice_runningText(), _command_0), tail: { $: "Nil" } }, tail: { $: "Con", head: $updatenotice_outputNode(_output_0), tail: { $: "Nil" } } }));
}
function $updatenotice_doneNodes(_ok_0, _sentence_0, _output_0) {
  return $updatenotice_runPanel($updatenotice_donePhase(_ok_0), $view_viewJoin({ $: "Con", head: { $: "Con", head: $view_viewEl("p", { $: "Con", head: $view_attrClass("run-line run-result"), tail: { $: "Con", head: $view_attr("role", "status"), tail: { $: "Nil" } } }, { $: "Con", head: $view_viewText(_sentence_0), tail: { $: "Nil" } }), tail: { $: "Nil" } }, tail: { $: "Con", head: $updatenotice_outputNode(_output_0), tail: { $: "Con", head: { $: "Con", head: $view_viewEl("div", { $: "Con", head: $view_attrClass("run-actions"), tail: { $: "Nil" } }, { $: "Con", head: $updatenotice_runButton($updatenotice_closeLabel(), "CloseRun", "run-close"), tail: { $: "Nil" } }), tail: { $: "Nil" } }, tail: { $: "Nil" } } } }));
}
function $updatenotice_runNodes(_r_0) {
  if (_r_0.$ === "RunNone") {
    return { $: "Nil" };
  } else if (_r_0.$ === "RunConfirm") {
    const _command_0 = _r_0["command"];
    const _warning_0 = _r_0["warning"];
    return { $: "Con", head: $updatenotice_confirmNodes(_command_0, _warning_0), tail: { $: "Nil" } };
  } else if (_r_0.$ === "RunBusy") {
    const _command_1 = _r_0["command"];
    const _output_0 = _r_0["output"];
    return { $: "Con", head: $updatenotice_busyNodes(_command_1, _output_0), tail: { $: "Nil" } };
  } else {
    const _ok_0 = _r_0["ok"];
    const _sentence_0 = _r_0["sentence"];
    const _output_1 = _r_0["output"];
    return { $: "Con", head: $updatenotice_doneNodes(_ok_0, _sentence_0, _output_1), tail: { $: "Nil" } };
  }
}
function $sameSeries(_fm_0, _fn_0, _tested_0) {
  if (_tested_0.$ === "NoVer") {
    return false;
  } else {
    const _tm_0 = _tested_0["major"];
    const _tn_0 = _tested_0["minor"];
    return $Bool_and(_fm_0 === _tm_0, _fn_0 === _tn_0);
  }
}
function $fitOf_ahead(_ahead_0) {
  if (_ahead_0) {
    return { $: "FitAhead" };
  } else {
    return { $: "FitTested" };
  }
}
function $fitOf_series(_same_0, _ahead_0) {
  if (_same_0) {
    return $fitOf_ahead(_ahead_0);
  } else {
    return { $: "FitSeries" };
  }
}
function $fitOf_below(_below_0, _same_0, _ahead_0) {
  if (_below_0) {
    return { $: "FitBelow" };
  } else {
    return $fitOf_series(_same_0, _ahead_0);
  }
}
function $fitOf(_found_0, _minimum_0, _tested_0) {
  if (_found_0.$ === "NoVer") {
    return { $: "FitUnreadable" };
  } else {
    const _fm_0 = _found_0["major"];
    const _fn_0 = _found_0["minor"];
    const _fp_0 = _found_0["patch"];
    return $fitOf_below($updatenotice_verNewer(_minimum_0, { $: "Ver", major: _fm_0, minor: _fn_0, patch: _fp_0 }), $sameSeries(_fm_0, _fn_0, _tested_0), $updatenotice_verNewer({ $: "Ver", major: _fm_0, minor: _fn_0, patch: _fp_0 }, _tested_0));
  }
}
function $accepted(_fit_0) {
  if (_fit_0.$ === "FitTested") {
    return true;
  } else if (_fit_0.$ === "FitAhead") {
    return true;
  } else if (_fit_0.$ === "FitBelow") {
    return false;
  } else if (_fit_0.$ === "FitSeries") {
    return false;
  } else {
    return false;
  }
}
function $ahead(_fit_0) {
  if (_fit_0.$ === "FitAhead") {
    return true;
  } else if (_fit_0.$ === "FitTested") {
    return false;
  } else if (_fit_0.$ === "FitBelow") {
    return false;
  } else if (_fit_0.$ === "FitSeries") {
    return false;
  } else {
    return false;
  }
}
function $verText(_v_0) {
  if (_v_0.$ === "NoVer") {
    return "?";
  } else {
    const _m_0 = _v_0["major"];
    const _n_0 = _v_0["minor"];
    const _p_0 = _v_0["patch"];
    const _x_0 = $U32_show(_p_0);
    const _x_1 = $U32_show(_n_0);
    const _x_2 = "." + _x_0;
    const _x_3 = _x_1 + _x_2;
    const _x_4 = $U32_show(_m_0);
    const _x_5 = "." + _x_3;
    return _x_4 + _x_5;
  }
}
function $seriesText(_v_0) {
  if (_v_0.$ === "NoVer") {
    return "?";
  } else {
    const _m_0 = _v_0["major"];
    const _n_0 = _v_0["minor"];
    const _x_0 = $U32_show(_n_0);
    const _x_1 = _x_0 + ".x";
    const _x_2 = $U32_show(_m_0);
    const _x_3 = "." + _x_1;
    return _x_2 + _x_3;
  }
}
function $refusalKey(_fit_0) {
  if (_fit_0.$ === "FitBelow") {
    return "claude.version.below";
  } else if (_fit_0.$ === "FitSeries") {
    return "claude.version.series";
  } else if (_fit_0.$ === "FitUnreadable") {
    return "claude.version.unreadable";
  } else if (_fit_0.$ === "FitTested") {
    return "";
  } else {
    return "";
  }
}
function $refusal_when(_blank_0, _key_0, _found_0, _minimum_0, _series_0) {
  if (_blank_0) {
    return "";
  } else {
    return $msg_msg3(_key_0, "found", _found_0, "minimum", _minimum_0, "series", _series_0);
  }
}
function $refusal_pick(_key_0, _found_0, _minimum_0, _series_0) {
  return $refusal_when($String_is_empty(_key_0), _key_0, _found_0, _minimum_0, _series_0);
}
function $refusal(_fit_0, _foundText_0, _minimum_0, _tested_0) {
  return $refusal_pick($refusalKey(_fit_0), _foundText_0, $verText(_minimum_0), $seriesText(_tested_0));
}
function $fixFor_update(_update_0) {
  if (_update_0) {
    return "update";
  } else {
    return "";
  }
}
function $fixFor_series(_series_0, _key_0) {
  if (_series_0) {
    return "about";
  } else {
    const _x_0 = $String_eq(_key_0, "claude.version.below");
    const _x_1 = $String_eq(_key_0, "claude.version.unreadable");
    return $fixFor_update(_x_0 || _x_1);
  }
}
function $fixFor(_key_0) {
  return $fixFor_series($String_eq(_key_0, "claude.version.series"), _key_0);
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
function $U32_show(_a_0) {
  const _b_0 = _a_0;
  return $U32_show_if(_b_0, _b_0 === 0);
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
function $U32_show_if(_a_0, _z_0) {
  if (_z_0) {
    return "0";
  } else {
    return $U32_show_go(10, _a_0, "");
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
function $U32_show_go($0, $1, $2, $3) {
  let $pc = 0;
  for (;; )
    switch ($pc) {
      case 0: {
        const _f_0 = $0;
        const _n_0 = $1;
        const _acc_0 = $2;
        if (_f_0 === 0) {
          return _acc_0;
        } else {
          const _g_0 = _f_0 - 1;
          $0 = _g_0;
          $1 = _acc_0;
          $2 = _n_0;
          $3 = _n_0 === 0;
          $pc = 1;
          continue;
        }
      }
      case 1: {
        const _g_0 = $0;
        const _acc_0 = $1;
        const _n_0 = $2;
        const _z_0 = $3;
        if (_z_0) {
          return _acc_0;
        } else {
          const _x_0 = _n_0 % 10;
          $0 = _g_0;
          $1 = _n_0 / 10 >>> 0;
          $2 = char_new(48 + _x_0 >>> 0) + _acc_0;
          $pc = 0;
          continue;
        }
      }
    }
}
var claudeversion_default = {
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
  "updatenotice.isVer": run_lib((a0) => run_loop($updatenotice_isVer(a0)), 1),
  "updatenotice.tripleNewer": run_lib((a0, a1, a2, a3, a4, a5) => run_loop($updatenotice_tripleNewer(a0, a1, a2, a3, a4, a5)), 6),
  "updatenotice.verNewer": run_lib((a0, a1) => run_loop($updatenotice_verNewer(a0, a1)), 2),
  "updatenotice.verPick": run_lib((a0, a1, a2) => run_loop($updatenotice_verPick(a0, a1, a2)), 3),
  "updatenotice.verMax": run_lib((a0, a1) => run_loop($updatenotice_verMax(a0, a1)), 2),
  "updatenotice.emptyMemory": run_lib(() => run_loop($updatenotice_emptyMemory()), 0),
  "updatenotice.ignoredCovers": run_lib((a0, a1) => run_loop($updatenotice_ignoredCovers(a0, a1)), 2),
  "updatenotice.newerThanSeen": run_lib((a0, a1) => run_loop($updatenotice_newerThanSeen(a0, a1)), 2),
  "updatenotice.targetVersion": run_lib((a0, a1, a2) => run_loop($updatenotice_targetVersion(a0, a1, a2)), 3),
  "updatenotice.noticeFrom": run_lib((a0, a1, a2, a3, a4) => run_loop($updatenotice_noticeFrom(a0, a1, a2, a3, a4)), 5),
  "updatenotice.noticeOf": run_lib((a0, a1, a2, a3, a4) => run_loop($updatenotice_noticeOf(a0, a1, a2, a3, a4)), 5),
  "updatenotice.seenAfterOpen": run_lib((a0, a1, a2) => run_loop($updatenotice_seenAfterOpen(a0, a1, a2)), 3),
  "updatenotice.afterOpen": run_lib((a0, a1, a2) => run_loop($updatenotice_afterOpen(a0, a1, a2)), 3),
  "updatenotice.afterPostpone": run_lib((a0, a1) => run_loop($updatenotice_afterPostpone(a0, a1)), 2),
  "updatenotice.afterIgnore": run_lib((a0, a1) => run_loop($updatenotice_afterIgnore(a0, a1)), 2),
  "updatenotice.noticeText": run_lib((a0, a1) => str_out(run_loop($updatenotice_noticeText(str_in(a0), str_in(a1)))), 2),
  "updatenotice.aheadText": run_lib(() => str_out(run_loop($updatenotice_aheadText())), 0),
  "updatenotice.offlineText": run_lib(() => str_out(run_loop($updatenotice_offlineText())), 0),
  "updatenotice.remindLabel": run_lib(() => str_out(run_loop($updatenotice_remindLabel())), 0),
  "updatenotice.ignoreLabel": run_lib(() => str_out(run_loop($updatenotice_ignoreLabel())), 0),
  "updatenotice.updateLabel": run_lib(() => str_out(run_loop($updatenotice_updateLabel())), 0),
  "updatenotice.copyLabel": run_lib(() => str_out(run_loop($updatenotice_copyLabel())), 0),
  "updatenotice.cancelLabel": run_lib(() => str_out(run_loop($updatenotice_cancelLabel())), 0),
  "updatenotice.closeLabel": run_lib(() => str_out(run_loop($updatenotice_closeLabel())), 0),
  "updatenotice.waitHint": run_lib(() => str_out(run_loop($updatenotice_waitHint())), 0),
  "updatenotice.waitShort": run_lib(() => str_out(run_loop($updatenotice_waitShort())), 0),
  "updatenotice.settingsTitle": run_lib((a0) => str_out(run_loop($updatenotice_settingsTitle(a0))), 1),
  "updatenotice.aheadWarning": run_lib((a0, a1) => str_out(run_loop($updatenotice_aheadWarning(str_in(a0), str_in(a1)))), 2),
  "updatenotice.runningText": run_lib(() => str_out(run_loop($updatenotice_runningText())), 0),
  "updatenotice.willRunText": run_lib(() => str_out(run_loop($updatenotice_willRunText())), 0),
  "updatenotice.relinkedText": run_lib(() => str_out(run_loop($updatenotice_relinkedText())), 0),
  "updatenotice.doneSentence.same": run_lib((a0, a1) => str_out(run_loop($updatenotice_doneSentence_same(str_in(a0), str_in(a1)))), 2),
  "updatenotice.doneSentence.changed": run_lib((a0, a1, a2) => str_out(run_loop($updatenotice_doneSentence_changed(str_in(a0), str_in(a1), a2))), 3),
  "updatenotice.doneSentence.improved": run_lib((a0, a1, a2, a3, a4) => str_out(run_loop($updatenotice_doneSentence_improved(str_in(a0), str_in(a1), str_in(a2), a3, a4))), 5),
  "updatenotice.doneSentence.known": run_lib((a0, a1, a2, a3, a4, a5) => str_out(run_loop($updatenotice_doneSentence_known(str_in(a0), str_in(a1), str_in(a2), a3, a4, a5))), 6),
  "updatenotice.doneSentence.ok": run_lib((a0, a1, a2, a3, a4, a5) => str_out(run_loop($updatenotice_doneSentence_ok(str_in(a0), a1, a2, str_in(a3), str_in(a4), a5))), 6),
  "updatenotice.doneSentence": run_lib((a0, a1, a2, a3, a4, a5, a6) => str_out(run_loop($updatenotice_doneSentence(str_in(a0), a1, a2, a3, str_in(a4), str_in(a5), a6))), 7),
  "updatenotice.noticeIcon": run_lib(() => run_loop($updatenotice_noticeIcon()), 0),
  "updatenotice.noticeButton": run_lib((a0, a1, a2) => run_loop($updatenotice_noticeButton(str_in(a0), str_in(a1), str_in(a2))), 3),
  "updatenotice.noticeLineText": run_lib((a0, a1, a2) => run_loop($updatenotice_noticeLineText(str_in(a0), str_in(a1), a2)), 3),
  "updatenotice.noticeLineBody": run_lib((a0, a1, a2, a3, a4) => run_loop($updatenotice_noticeLineBody(str_in(a0), str_in(a1), str_in(a2), a3, a4)), 5),
  "updatenotice.noticeLineNode": run_lib((a0) => run_loop($updatenotice_noticeLineNode(a0)), 1),
  "updatenotice.noticeLines": run_lib((a0) => run_loop($updatenotice_noticeLines(a0)), 1),
  "updatenotice.showsNotice": run_lib((a0) => run_loop($updatenotice_showsNotice(a0)), 1),
  "updatenotice.seesLine": run_lib((a0, a1) => run_loop($updatenotice_seesLine(a0, a1)), 2),
  "updatenotice.seeAboutLabel": run_lib(() => str_out(run_loop($updatenotice_seeAboutLabel())), 0),
  "updatenotice.seeAboutButton": run_lib((a0) => run_loop($updatenotice_seeAboutButton(str_in(a0))), 1),
  "updatenotice.noticeLineFor": run_lib((a0, a1) => run_loop($updatenotice_noticeLineFor(a0, a1)), 2),
  "updatenotice.noticeLinesFor": run_lib((a0, a1) => run_loop($updatenotice_noticeLinesFor(a0, a1)), 2),
  "updatenotice.hasAction": run_lib((a0) => run_loop($updatenotice_hasAction(a0)), 1),
  "updatenotice.localButton": run_lib(() => run_loop($updatenotice_localButton()), 0),
  "updatenotice.askButton": run_lib((a0) => run_loop($updatenotice_askButton(str_in(a0))), 1),
  "updatenotice.waitNodes": run_lib(() => run_loop($updatenotice_waitNodes()), 0),
  "updatenotice.copyButton": run_lib((a0) => run_loop($updatenotice_copyButton(str_in(a0))), 1),
  "updatenotice.actionNodes": run_lib((a0) => run_loop($updatenotice_actionNodes(a0)), 1),
  "updatenotice.commandNode": run_lib((a0) => run_loop($updatenotice_commandNode(str_in(a0))), 1),
  "updatenotice.runLine": run_lib((a0, a1) => run_loop($updatenotice_runLine(str_in(a0), str_in(a1))), 2),
  "updatenotice.outputNode": run_lib((a0) => run_loop($updatenotice_outputNode(str_in(a0))), 1),
  "updatenotice.runButton": run_lib((a0, a1, a2) => run_loop($updatenotice_runButton(str_in(a0), str_in(a1), str_in(a2))), 3),
  "updatenotice.donePhase": run_lib((a0) => str_out(run_loop($updatenotice_donePhase(a0))), 1),
  "updatenotice.runPanel": run_lib((a0, a1) => run_loop($updatenotice_runPanel(str_in(a0), a1)), 2),
  "updatenotice.confirmNodes": run_lib((a0, a1) => run_loop($updatenotice_confirmNodes(str_in(a0), str_in(a1))), 2),
  "updatenotice.busyNodes": run_lib((a0, a1) => run_loop($updatenotice_busyNodes(str_in(a0), str_in(a1))), 2),
  "updatenotice.doneNodes": run_lib((a0, a1, a2) => run_loop($updatenotice_doneNodes(a0, str_in(a1), str_in(a2))), 3),
  "updatenotice.runNodes": run_lib((a0) => run_loop($updatenotice_runNodes(a0)), 1),
  sameSeries: run_lib((a0, a1, a2) => run_loop($sameSeries(a0, a1, a2)), 3),
  "fitOf.ahead": run_lib((a0) => run_loop($fitOf_ahead(a0)), 1),
  "fitOf.series": run_lib((a0, a1) => run_loop($fitOf_series(a0, a1)), 2),
  "fitOf.below": run_lib((a0, a1, a2) => run_loop($fitOf_below(a0, a1, a2)), 3),
  fitOf: run_lib((a0, a1, a2) => run_loop($fitOf(a0, a1, a2)), 3),
  accepted: run_lib((a0) => run_loop($accepted(a0)), 1),
  ahead: run_lib((a0) => run_loop($ahead(a0)), 1),
  verText: run_lib((a0) => str_out(run_loop($verText(a0))), 1),
  seriesText: run_lib((a0) => str_out(run_loop($seriesText(a0))), 1),
  refusalKey: run_lib((a0) => str_out(run_loop($refusalKey(a0))), 1),
  "refusal.when": run_lib((a0, a1, a2, a3, a4) => str_out(run_loop($refusal_when(a0, str_in(a1), str_in(a2), str_in(a3), str_in(a4)))), 5),
  "refusal.pick": run_lib((a0, a1, a2, a3) => str_out(run_loop($refusal_pick(str_in(a0), str_in(a1), str_in(a2), str_in(a3)))), 4),
  refusal: run_lib((a0, a1, a2, a3) => str_out(run_loop($refusal(a0, str_in(a1), a2, a3))), 4),
  "fixFor.update": run_lib((a0) => str_out(run_loop($fixFor_update(a0))), 1),
  "fixFor.series": run_lib((a0, a1) => str_out(run_loop($fixFor_series(a0, str_in(a1)))), 2),
  fixFor: run_lib((a0) => str_out(run_loop($fixFor(str_in(a0)))), 1)
};
export {
  claudeversion_default as default
};

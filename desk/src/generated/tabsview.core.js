// GERADO de core/tabsview.bend por `bun core/build.mjs` — não editar à mão.
// core/tabsview.bend
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
function $studytoolsview_action(_id_0, _label_0, _icon_0, _handler_0) {
  return $view_viewEl("button", { $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_attrId(_id_0), tail: { $: "Con", head: $view_attr("role", "menuitem"), tail: { $: "Con", head: $view_attrData("icon", _icon_0), tail: { $: "Con", head: $view_attr("aria-haspopup", "dialog"), tail: { $: "Con", head: $view_attrOn("click", _handler_0), tail: { $: "Nil" } } } } } } }, { $: "Con", head: $view_viewText(_label_0), tail: { $: "Nil" } });
}
function $studytoolsview_actionKbd(_id_0, _label_0, _icon_0, _handler_0, _shortcut_0) {
  return $view_viewEl("button", { $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_attrId(_id_0), tail: { $: "Con", head: $view_attr("role", "menuitem"), tail: { $: "Con", head: $view_attrData("icon", _icon_0), tail: { $: "Con", head: $view_attr("aria-haspopup", "dialog"), tail: { $: "Con", head: $view_attrOn("click", _handler_0), tail: { $: "Nil" } } } } } } }, { $: "Con", head: $view_viewText(_label_0), tail: { $: "Con", head: $view_viewEl("span", { $: "Con", head: $view_attrClass("menu-kbd"), tail: { $: "Con", head: $view_attrData("shortcut", _shortcut_0), tail: { $: "Con", head: $view_attrAria("hidden", "true"), tail: { $: "Nil" } } } }, { $: "Nil" }), tail: { $: "Nil" } } });
}
function $studytoolsview_tools() {
  return { $: "Con", head: $studytoolsview_actionKbd("study-search-open", $msg_msg("study.search"), "search", "OpenStudySearch", "study-search"), tail: { $: "Con", head: $studytoolsview_action("study-review-today", $msg_msg("study.reviewToday"), "rotateCw", "OpenReviewToday"), tail: { $: "Con", head: $studytoolsview_action("study-notes-open", $msg_msg("study.notes"), "textQuote", "OpenPdfNotes"), tail: { $: "Con", head: $studytoolsview_action("study-stats-open", $msg_msg("study.stats"), "graph", "OpenStudyStats"), tail: { $: "Con", head: $studytoolsview_action("study-backup-open", $msg_msg("study.backup"), "download", "OpenStudyBackup"), tail: { $: "Con", head: $studytoolsview_action("study-share-open", $msg_msg("study.share"), "upload", "OpenStudyShare"), tail: { $: "Con", head: $studytoolsview_action("study-tutor-pdf", $msg_msg("study.tutorPdf"), "sparkles", "OpenTutorPdf"), tail: { $: "Nil" } } } } } } } };
}
function $labelOr_if(_s_0, _fallback_0, _empty_0) {
  if (_empty_0) {
    return _fallback_0;
  } else {
    return _s_0;
  }
}
function $labelOr(_s_0, _fallback_0) {
  return $labelOr_if(_s_0, _fallback_0, $String_is_empty(_s_0));
}
function $refToggleLabel(_toggle_0) {
  return $labelOr(_toggle_0, $msg_msg("tabs.referenceToggle"));
}
function $xournalHidden(_xournal_0, _win32_0, _hasPath_0) {
  const _x_0 = $Bool_not(_xournal_0);
  const _x_1 = $Bool_and(_win32_0, $Bool_not(_hasPath_0));
  return _x_0 || _x_1;
}
function $tabActive(_id_0, _activeId_0, _ggbActive_0) {
  if (_ggbActive_0) {
    return false;
  } else {
    return $String_eq(_id_0, _activeId_0);
  }
}
function $rovingTabindex(_active_0) {
  if (_active_0) {
    return "0";
  } else {
    return "-1";
  }
}
function $lockHint() {
  return $msg_msg("tabs.locked");
}
function $lockAttrs(_disabled_0) {
  if (_disabled_0) {
    return { $: "Con", head: $view_attr("disabled", ""), tail: { $: "Con", head: $view_attrTitle($lockHint()), tail: { $: "Nil" } } };
  } else {
    return { $: "Nil" };
  }
}
function $tabAttrs(_id_0, _active_0, _disabled_0) {
  return $view_attrJoin({ $: "Con", head: { $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_classes({ $: "Con", head: $view_classOn("active", _active_0), tail: { $: "Nil" } }), tail: { $: "Con", head: $view_attrData("id", _id_0), tail: { $: "Con", head: $view_attr("role", "tab"), tail: { $: "Con", head: $view_attrAria("selected", $view_boolStr(_active_0)), tail: { $: "Con", head: $view_attr("tabindex", $rovingTabindex(_active_0)), tail: { $: "Nil" } } } } } } }, tail: { $: "Con", head: $lockAttrs(_disabled_0), tail: { $: "Con", head: { $: "Con", head: $view_attrOn("click", "SelectCourse"), tail: { $: "Nil" } }, tail: { $: "Nil" } } } });
}
function $tabNode(_id_0, _name_0, _active_0, _disabled_0) {
  return $view_viewEl("button", $tabAttrs(_id_0, _active_0, _disabled_0), { $: "Con", head: $view_viewText(_name_0), tail: { $: "Nil" } });
}
function $tabLocked(_id_0, _currentId_0, _locked_0) {
  return $Bool_and(_locked_0, $Bool_not($Bool_and($Bool_not($String_is_empty(_currentId_0)), $String_eq(_id_0, _currentId_0))));
}
function $tabNodeOf(_h_0, _activeId_0, _ggbActive_0, _disabled_0) {
  const _id_0 = _h_0["id"];
  const _name_0 = _h_0["name"];
  return $tabNode(_id_0, _name_0, $tabActive(_id_0, _activeId_0, _ggbActive_0), _disabled_0);
}
function $tabSep() {
  return $view_viewEl("span", { $: "Con", head: $view_attrClass("tab-sep"), tail: { $: "Nil" } }, { $: "Nil" });
}
function $ggbAttrs(_active_0, _disabled_0) {
  return $view_attrJoin({ $: "Con", head: { $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_classes({ $: "Con", head: $view_classOn("active", _active_0), tail: { $: "Con", head: $view_classOn("ggb-tab", true), tail: { $: "Nil" } } }), tail: { $: "Con", head: $view_attrData("id", "geogebra"), tail: { $: "Con", head: $view_attr("role", "tab"), tail: { $: "Con", head: $view_attrAria("selected", $view_boolStr(_active_0)), tail: { $: "Con", head: $view_attr("tabindex", $rovingTabindex(_active_0)), tail: { $: "Con", head: $view_attrTitle($msg_msg("tabs.ggbTitle")), tail: { $: "Con", head: $view_attrData("icon", "graph"), tail: { $: "Con", head: $view_attrData("icon-tight", ""), tail: { $: "Nil" } } } } } } } } } }, tail: { $: "Con", head: $view_attrWhen(_disabled_0, $view_attr("disabled", "")), tail: { $: "Con", head: { $: "Con", head: $view_attrOn("click", "OpenGeoGebra"), tail: { $: "Nil" } }, tail: { $: "Nil" } } } });
}
function $ggbTab(_active_0, _disabled_0) {
  return $view_viewEl("button", $ggbAttrs(_active_0, _disabled_0), { $: "Con", head: $view_viewText("GeoGebra"), tail: { $: "Nil" } });
}
function $newTab() {
  return $view_viewEl("button", { $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_attrId("new-tab"), tail: { $: "Con", head: $view_attrTitle($msg_msg("tabs.newCourse")), tail: { $: "Con", head: $view_attrAria("label", $msg_msg("tabs.newCourse")), tail: { $: "Con", head: $view_attrOn("click", "NewCourse"), tail: { $: "Nil" } } } } } }, { $: "Con", head: $view_viewText("+"), tail: { $: "Nil" } });
}
function $reviewHasItems(_count_0) {
  return $Bool_not($String_eq(_count_0, "0"));
}
function $reviewTitle_some(_count_0) {
  return $msg_msg1("tabs.review.title", "count", _count_0);
}
function $reviewTitle_if(_empty_0, _count_0) {
  if (_empty_0) {
    return $msg_msg("tabs.review.title.none");
  } else {
    return $reviewTitle_some(_count_0);
  }
}
function $reviewTitle(_count_0) {
  return $reviewTitle_if($String_eq(_count_0, "0"), _count_0);
}
function $reviewAttrs(_count_0, _active_0) {
  return { $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_attrId("review-tab"), tail: { $: "Con", head: $view_classes({ $: "Con", head: $view_classOn("active", _active_0), tail: { $: "Con", head: $view_classOn("has-items", $reviewHasItems(_count_0)), tail: { $: "Nil" } } }), tail: { $: "Con", head: $view_attrData("id", "review"), tail: { $: "Con", head: $view_attr("role", "tab"), tail: { $: "Con", head: $view_attrAria("selected", $view_boolStr(_active_0)), tail: { $: "Con", head: $view_attr("tabindex", $rovingTabindex(_active_0)), tail: { $: "Con", head: $view_attrTitle($reviewTitle(_count_0)), tail: { $: "Con", head: $view_attrAria("label", $reviewTitle(_count_0)), tail: { $: "Con", head: $view_attrOn("click", "OpenReview"), tail: { $: "Nil" } } } } } } } } } } };
}
function $reviewTab(_count_0, _active_0) {
  return $view_viewEl("button", $reviewAttrs(_count_0, _active_0), { $: "Con", head: $view_viewText($msg_msg("tabs.review")), tail: { $: "Con", head: $view_viewText(" "), tail: { $: "Con", head: $view_viewEl("span", { $: "Con", head: $view_attrId("review-count"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText(_count_0), tail: { $: "Nil" } }), tail: { $: "Nil" } } } });
}
function $courseTabs_tools(_reviewCount_0, _activeId_0, _ggbActive_0, _disabled_0) {
  return { $: "Con", head: $newTab(), tail: { $: "Con", head: $tabSep(), tail: { $: "Con", head: $reviewTab(_reviewCount_0, $tabActive("review", _activeId_0, _ggbActive_0)), tail: { $: "Con", head: $ggbTab(_ggbActive_0, _disabled_0), tail: { $: "Nil" } } } } };
}
function $courseTabs(_cs_0, _activeId_0, _ggbActive_0, _disabled_0, _reviewCount_0) {
  if (_cs_0.$ === "Nil") {
    return $courseTabs_tools(_reviewCount_0, _activeId_0, _ggbActive_0, _disabled_0);
  } else {
    const _h_0 = _cs_0["head"];
    const _t_0 = _cs_0["tail"];
    return { $: "Con", head: $tabNodeOf(_h_0, _activeId_0, _ggbActive_0, _disabled_0), tail: $courseTabs(_t_0, _activeId_0, _ggbActive_0, _disabled_0, _reviewCount_0) };
  }
}
function $tabNodeAt(_h_0, _activeId_0, _currentId_0, _ggbActive_0, _locked_0) {
  const _id_0 = _h_0["id"];
  const _name_0 = _h_0["name"];
  return $tabNode(_id_0, _name_0, $tabActive(_id_0, _activeId_0, _ggbActive_0), $tabLocked(_id_0, _currentId_0, _locked_0));
}
function $courseTabsAt(_cs_0, _activeId_0, _currentId_0, _ggbActive_0, _locked_0, _reviewCount_0) {
  if (_cs_0.$ === "Nil") {
    return $courseTabs_tools(_reviewCount_0, _activeId_0, _ggbActive_0, _locked_0);
  } else {
    const _h_0 = _cs_0["head"];
    const _t_0 = _cs_0["tail"];
    return { $: "Con", head: $tabNodeAt(_h_0, _activeId_0, _currentId_0, _ggbActive_0, _locked_0), tail: $courseTabsAt(_t_0, _activeId_0, _currentId_0, _ggbActive_0, _locked_0, _reviewCount_0) };
  }
}
function $itemIcon_if(_empty_0, _icon_0) {
  if (_empty_0) {
    return { $: "Nil" };
  } else {
    return { $: "Con", head: $view_attrData("icon", _icon_0), tail: { $: "Nil" } };
  }
}
function $itemIcon(_icon_0) {
  return $itemIcon_if($String_is_empty(_icon_0), _icon_0);
}
function $menuItemAttrs(_id_0, _handler_0, _extra_0, _icon_0) {
  return $view_attrJoin({ $: "Con", head: { $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_attrId(_id_0), tail: { $: "Con", head: $view_attr("role", "menuitem"), tail: { $: "Nil" } } } }, tail: { $: "Con", head: _extra_0, tail: { $: "Con", head: $itemIcon(_icon_0), tail: { $: "Con", head: { $: "Con", head: $view_attrOn("click", _handler_0), tail: { $: "Nil" } }, tail: { $: "Nil" } } } } });
}
function $menuItem(_id_0, _text_0, _icon_0, _handler_0, _extra_0) {
  return $view_viewEl("button", $menuItemAttrs(_id_0, _handler_0, _extra_0, _icon_0), { $: "Con", head: $view_viewText(_text_0), tail: { $: "Nil" } });
}
function $refToggleItem(_twoPanels_0, _toggle_0, _refVisible_0) {
  return $menuItem("reference-toggle", $refToggleLabel(_toggle_0), "columns", "ToggleReference", $view_attrJoin({ $: "Con", head: $view_attrWhen($Bool_not(_twoPanels_0), $view_attr("hidden", "")), tail: { $: "Con", head: { $: "Con", head: $view_attrAria("pressed", $view_boolStr(_refVisible_0)), tail: { $: "Nil" } }, tail: { $: "Nil" } } }));
}
function $xournalItem(_xournal_0, _win32_0, _hasPath_0) {
  return $menuItem("xournal", "Xournal++", "external", "OpenXournal", $view_attrWhen($xournalHidden(_xournal_0, _win32_0, _hasPath_0), $view_attr("hidden", "")));
}
function $helpItem() {
  return $menuItem("help", $msg_msg("menu.help"), "help", "OpenHelp", { $: "Nil" });
}
function $shortcutsItem() {
  return $menuItem("shortcuts", $msg_msg("menu.shortcuts"), "keyboard", "OpenShortcuts", { $: "Nil" });
}
function $settingsItem() {
  return $menuItem("settings", $msg_msg("menu.settings"), "settings", "OpenSettings", { $: "Nil" });
}
function $aboutItem() {
  return $menuItem("about", $msg_msg("menu.about"), "help", "OpenAbout", { $: "Nil" });
}
function $studyItems(_f_0) {
  const _twoPanels_0 = _f_0["twoPanels"];
  const _toggle_0 = _f_0["toggle"];
  const _refVisible_0 = _f_0["refVisible"];
  const _xournal_0 = _f_0["xournal"];
  const _win32_0 = _f_0["win32"];
  const _hasXournalPath_0 = _f_0["hasXournalPath"];
  return $List_append($studytoolsview_tools(), { $: "Con", head: $xournalItem(_xournal_0, _win32_0, _hasXournalPath_0), tail: { $: "Con", head: $refToggleItem(_twoPanels_0, _toggle_0, _refVisible_0), tail: { $: "Nil" } } });
}
function $settingsItems() {
  return { $: "Con", head: $settingsItem(), tail: { $: "Con", head: $helpItem(), tail: { $: "Con", head: $shortcutsItem(), tail: { $: "Con", head: $aboutItem(), tail: { $: "Nil" } } } } };
}
function $courseOptionIcon(_active_0) {
  if (_active_0) {
    return "check";
  } else {
    return "";
  }
}
function $courseOption(_id_0, _name_0, _activeId_0, _ggbActive_0, _disabled_0) {
  return $menuItem("course-option-" + _id_0, _name_0, $courseOptionIcon($tabActive(_id_0, _activeId_0, _ggbActive_0)), "SelectCourse", $view_attrJoin({ $: "Con", head: { $: "Con", head: $view_attrData("id", _id_0), tail: { $: "Nil" } }, tail: { $: "Con", head: $lockAttrs(_disabled_0), tail: { $: "Nil" } } }));
}
function $courseOptionOf(_h_0, _activeId_0, _ggbActive_0, _disabled_0) {
  const _id_0 = _h_0["id"];
  const _name_0 = _h_0["name"];
  return $courseOption(_id_0, _name_0, _activeId_0, _ggbActive_0, _disabled_0);
}
function $courseMenuItems(_cs_0, _activeId_0, _ggbActive_0, _disabled_0) {
  if (_cs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _cs_0["head"];
    const _t_0 = _cs_0["tail"];
    return { $: "Con", head: $courseOptionOf(_h_0, _activeId_0, _ggbActive_0, _disabled_0), tail: $courseMenuItems(_t_0, _activeId_0, _ggbActive_0, _disabled_0) };
  }
}
function $courseOptionAt(_h_0, _activeId_0, _currentId_0, _ggbActive_0, _locked_0) {
  const _id_0 = _h_0["id"];
  const _name_0 = _h_0["name"];
  return $courseOption(_id_0, _name_0, _activeId_0, _ggbActive_0, $tabLocked(_id_0, _currentId_0, _locked_0));
}
function $courseMenuItemsAt(_cs_0, _activeId_0, _currentId_0, _ggbActive_0, _locked_0) {
  if (_cs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _cs_0["head"];
    const _t_0 = _cs_0["tail"];
    return { $: "Con", head: $courseOptionAt(_h_0, _activeId_0, _currentId_0, _ggbActive_0, _locked_0), tail: $courseMenuItemsAt(_t_0, _activeId_0, _currentId_0, _ggbActive_0, _locked_0) };
  }
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
var tabsview_default = {
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
  "studytoolsview.action": run_lib((a0, a1, a2, a3) => run_loop($studytoolsview_action(str_in(a0), str_in(a1), str_in(a2), str_in(a3))), 4),
  "studytoolsview.actionKbd": run_lib((a0, a1, a2, a3, a4) => run_loop($studytoolsview_actionKbd(str_in(a0), str_in(a1), str_in(a2), str_in(a3), str_in(a4))), 5),
  "studytoolsview.tools": run_lib(() => run_loop($studytoolsview_tools()), 0),
  "labelOr.if": run_lib((a0, a1, a2) => str_out(run_loop($labelOr_if(str_in(a0), str_in(a1), a2))), 3),
  labelOr: run_lib((a0, a1) => str_out(run_loop($labelOr(str_in(a0), str_in(a1)))), 2),
  refToggleLabel: run_lib((a0) => str_out(run_loop($refToggleLabel(str_in(a0)))), 1),
  xournalHidden: run_lib((a0, a1, a2) => run_loop($xournalHidden(a0, a1, a2)), 3),
  tabActive: run_lib((a0, a1, a2) => run_loop($tabActive(str_in(a0), str_in(a1), a2)), 3),
  rovingTabindex: run_lib((a0) => str_out(run_loop($rovingTabindex(a0))), 1),
  lockHint: run_lib(() => str_out(run_loop($lockHint())), 0),
  lockAttrs: run_lib((a0) => run_loop($lockAttrs(a0)), 1),
  tabAttrs: run_lib((a0, a1, a2) => run_loop($tabAttrs(str_in(a0), a1, a2)), 3),
  tabNode: run_lib((a0, a1, a2, a3) => run_loop($tabNode(str_in(a0), str_in(a1), a2, a3)), 4),
  tabLocked: run_lib((a0, a1, a2) => run_loop($tabLocked(str_in(a0), str_in(a1), a2)), 3),
  tabNodeOf: run_lib((a0, a1, a2, a3) => run_loop($tabNodeOf(a0, str_in(a1), a2, a3)), 4),
  tabSep: run_lib(() => run_loop($tabSep()), 0),
  ggbAttrs: run_lib((a0, a1) => run_loop($ggbAttrs(a0, a1)), 2),
  ggbTab: run_lib((a0, a1) => run_loop($ggbTab(a0, a1)), 2),
  newTab: run_lib(() => run_loop($newTab()), 0),
  reviewHasItems: run_lib((a0) => run_loop($reviewHasItems(str_in(a0))), 1),
  "reviewTitle.some": run_lib((a0) => str_out(run_loop($reviewTitle_some(str_in(a0)))), 1),
  "reviewTitle.if": run_lib((a0, a1) => str_out(run_loop($reviewTitle_if(a0, str_in(a1)))), 2),
  reviewTitle: run_lib((a0) => str_out(run_loop($reviewTitle(str_in(a0)))), 1),
  reviewAttrs: run_lib((a0, a1) => run_loop($reviewAttrs(str_in(a0), a1)), 2),
  reviewTab: run_lib((a0, a1) => run_loop($reviewTab(str_in(a0), a1)), 2),
  "courseTabs.tools": run_lib((a0, a1, a2, a3) => run_loop($courseTabs_tools(str_in(a0), str_in(a1), a2, a3)), 4),
  courseTabs: run_lib((a0, a1, a2, a3, a4) => run_loop($courseTabs(a0, str_in(a1), a2, a3, str_in(a4))), 5),
  tabNodeAt: run_lib((a0, a1, a2, a3, a4) => run_loop($tabNodeAt(a0, str_in(a1), str_in(a2), a3, a4)), 5),
  courseTabsAt: run_lib((a0, a1, a2, a3, a4, a5) => run_loop($courseTabsAt(a0, str_in(a1), str_in(a2), a3, a4, str_in(a5))), 6),
  "itemIcon.if": run_lib((a0, a1) => run_loop($itemIcon_if(a0, str_in(a1))), 2),
  itemIcon: run_lib((a0) => run_loop($itemIcon(str_in(a0))), 1),
  menuItemAttrs: run_lib((a0, a1, a2, a3) => run_loop($menuItemAttrs(str_in(a0), str_in(a1), a2, str_in(a3))), 4),
  menuItem: run_lib((a0, a1, a2, a3, a4) => run_loop($menuItem(str_in(a0), str_in(a1), str_in(a2), str_in(a3), a4)), 5),
  refToggleItem: run_lib((a0, a1, a2) => run_loop($refToggleItem(a0, str_in(a1), a2)), 3),
  xournalItem: run_lib((a0, a1, a2) => run_loop($xournalItem(a0, a1, a2)), 3),
  helpItem: run_lib(() => run_loop($helpItem()), 0),
  shortcutsItem: run_lib(() => run_loop($shortcutsItem()), 0),
  settingsItem: run_lib(() => run_loop($settingsItem()), 0),
  aboutItem: run_lib(() => run_loop($aboutItem()), 0),
  studyItems: run_lib((a0) => run_loop($studyItems(a0)), 1),
  settingsItems: run_lib(() => run_loop($settingsItems()), 0),
  courseOptionIcon: run_lib((a0) => str_out(run_loop($courseOptionIcon(a0))), 1),
  courseOption: run_lib((a0, a1, a2, a3, a4) => run_loop($courseOption(str_in(a0), str_in(a1), str_in(a2), a3, a4)), 5),
  courseOptionOf: run_lib((a0, a1, a2, a3) => run_loop($courseOptionOf(a0, str_in(a1), a2, a3)), 4),
  courseMenuItems: run_lib((a0, a1, a2, a3) => run_loop($courseMenuItems(a0, str_in(a1), a2, a3)), 4),
  courseOptionAt: run_lib((a0, a1, a2, a3, a4) => run_loop($courseOptionAt(a0, str_in(a1), str_in(a2), a3, a4)), 5),
  courseMenuItemsAt: run_lib((a0, a1, a2, a3, a4) => run_loop($courseMenuItemsAt(a0, str_in(a1), str_in(a2), a3, a4)), 5)
};
export {
  tabsview_default as default
};

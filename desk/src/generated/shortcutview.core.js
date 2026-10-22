// GERADO de core/shortcutview.bend por `bun core/build.mjs` — não editar à mão.
// core/shortcutview.bend
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
function $skRow(_id_0, _label_0, _effective_0, _fixed_0, _note_0, _overridden_0) {
  return { $: "ShortcutRowFact", id: _id_0, label: _label_0, effective: _effective_0, fixed: _fixed_0, note: _note_0, overridden: _overridden_0 };
}
function $skSection(_id_0, _title_0, _rows_0) {
  return { $: "ShortcutSectionFact", id: _id_0, title: _title_0, rows: _rows_0 };
}
function $skDialog(_open_0, _capturing_0, _conflict_0, _status_0, _statusKind_0, _hasOverrides_0, _sections_0) {
  return { $: "ShortcutDialogFact", open: _open_0, capturing: _capturing_0, conflict: _conflict_0, status: _status_0, statusKind: _statusKind_0, hasOverrides: _hasOverrides_0, sections: _sections_0 };
}
function $skTextOr_if(_raw_0, _fallback_0, _empty_0) {
  if (_empty_0) {
    return _fallback_0;
  } else {
    return _raw_0;
  }
}
function $skTextOr(_raw_0, _fallback_0) {
  return $skTextOr_if(_raw_0, _fallback_0, $String_is_empty(_raw_0));
}
function $skKbdText(_effective_0, _recording_0) {
  if (_recording_0) {
    return $msg_msg("keys.recording");
  } else {
    return $skTextOr(_effective_0, $msg_msg("keys.none"));
  }
}
function $skKbdEmpty(_effective_0, _recording_0) {
  if (_recording_0) {
    return false;
  } else {
    return $String_is_empty(_effective_0);
  }
}
function $skKbdAria_if(_effective_0, _empty_0) {
  if (_empty_0) {
    return $msg_msg("keys.none");
  } else {
    return $msg_msg1("keys.currentAria", "shortcut", _effective_0);
  }
}
function $skKbdAria(_label_0, _effective_0, _recording_0) {
  if (_recording_0) {
    return $msg_msg1("keys.recordingAria", "action", _label_0);
  } else {
    return $skKbdAria_if(_effective_0, $String_is_empty(_effective_0));
  }
}
function $skLabelNode(_id_0, _label_0) {
  return $view_viewEl("span", { $: "Con", head: $view_attrClass("keys-label"), tail: { $: "Con", head: $view_attrId("keys-label-" + _id_0), tail: { $: "Nil" } } }, { $: "Con", head: $view_viewText(_label_0), tail: { $: "Nil" } });
}
function $skKbdNode(_label_0, _effective_0, _recording_0) {
  return $view_viewEl("kbd", { $: "Con", head: $view_classes({ $: "Con", head: $view_classOn("keys-kbd", true), tail: { $: "Con", head: $view_classOn("empty", $skKbdEmpty(_effective_0, _recording_0)), tail: { $: "Nil" } } }), tail: { $: "Con", head: $view_attrAria("label", $skKbdAria(_label_0, _effective_0, _recording_0)), tail: { $: "Nil" } } }, { $: "Con", head: $view_viewText($skKbdText(_effective_0, _recording_0)), tail: { $: "Nil" } });
}
function $skNoteNode(_note_0) {
  return $view_viewEl("span", { $: "Con", head: $view_attrClass("keys-note"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText($skTextOr(_note_0, $msg_msg("keys.fixed"))), tail: { $: "Nil" } });
}
function $skRecordLabel(_recording_0) {
  if (_recording_0) {
    return $msg_msg("common.cancel");
  } else {
    return $msg_msg("keys.record");
  }
}
function $skRecordAria(_label_0, _recording_0) {
  if (_recording_0) {
    return $msg_msg1("keys.cancelAria", "action", _label_0);
  } else {
    return $msg_msg1("keys.recordAria", "action", _label_0);
  }
}
function $skRecordNode(_id_0, _label_0, _recording_0) {
  return $view_viewEl("button", { $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_attrClass("keys-rec"), tail: { $: "Con", head: $view_attrData("role", "rec"), tail: { $: "Con", head: $view_attrKey("keys-rec-" + _id_0), tail: { $: "Con", head: $view_attrAria("pressed", $view_boolStr(_recording_0)), tail: { $: "Con", head: $view_attrAria("label", $skRecordAria(_label_0, _recording_0)), tail: { $: "Con", head: $view_attrOn("click", "Record"), tail: { $: "Nil" } } } } } } } }, { $: "Con", head: $view_viewText($skRecordLabel(_recording_0)), tail: { $: "Nil" } });
}
function $skResetNode(_id_0, _overridden_0) {
  return $view_viewEl("button", $view_attrJoin({ $: "Con", head: { $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_attrClass("keys-reset"), tail: { $: "Con", head: $view_attrData("role", "reset"), tail: { $: "Con", head: $view_attrKey("keys-reset-" + _id_0), tail: { $: "Con", head: $view_attrOn("click", "Reset"), tail: { $: "Nil" } } } } } }, tail: { $: "Con", head: $view_attrWhen($Bool_not(_overridden_0), $view_attr("hidden", "")), tail: { $: "Nil" } } }), { $: "Con", head: $view_viewText($msg_msg("keys.reset")), tail: { $: "Nil" } });
}
function $skRowKids_editable(_id_0, _label_0, _effective_0, _note_0, _overridden_0, _recording_0, _fixed_0) {
  if (_fixed_0) {
    return { $: "Con", head: $skLabelNode(_id_0, _label_0), tail: { $: "Con", head: $skKbdNode(_label_0, _effective_0, _recording_0), tail: { $: "Con", head: $skNoteNode(_note_0), tail: { $: "Nil" } } } };
  } else {
    return { $: "Con", head: $skLabelNode(_id_0, _label_0), tail: { $: "Con", head: $skKbdNode(_label_0, _effective_0, _recording_0), tail: { $: "Con", head: $skRecordNode(_id_0, _label_0, _recording_0), tail: { $: "Con", head: $skResetNode(_id_0, _overridden_0), tail: { $: "Nil" } } } } };
  }
}
function $skRowNode_record(_row_0, _recording_0) {
  const _id_0 = _row_0["id"];
  const _label_0 = _row_0["label"];
  const _effective_0 = _row_0["effective"];
  const _fixed_0 = _row_0["fixed"];
  const _note_0 = _row_0["note"];
  const _overridden_0 = _row_0["overridden"];
  return $view_viewKey("div", _id_0, { $: "Con", head: $view_classes({ $: "Con", head: $view_classOn("keys-row", true), tail: { $: "Con", head: $view_classOn("recording", _recording_0), tail: { $: "Con", head: $view_classOn("is-fixed", _fixed_0), tail: { $: "Nil" } } } }), tail: { $: "Con", head: $view_attrData("action", _id_0), tail: { $: "Con", head: $view_attr("role", "group"), tail: { $: "Con", head: $view_attrAria("labelledby", "keys-label-" + _id_0), tail: { $: "Nil" } } } } }, $skRowKids_editable(_id_0, _label_0, _effective_0, _note_0, _overridden_0, _recording_0, _fixed_0));
}
function $skRowNode(_row_0, _capturing_0) {
  const _id_0 = _row_0["id"];
  const _label_0 = _row_0["label"];
  const _effective_0 = _row_0["effective"];
  const _fixed_0 = _row_0["fixed"];
  const _note_0 = _row_0["note"];
  const _overridden_0 = _row_0["overridden"];
  return $skRowNode_record({ $: "ShortcutRowFact", id: _id_0, label: _label_0, effective: _effective_0, fixed: _fixed_0, note: _note_0, overridden: _overridden_0 }, $String_eq(_id_0, _capturing_0));
}
function $skRowNodes_go(_xs_0, _capturing_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return { $: "Con", head: $skRowNode(_h_0, _capturing_0), tail: $skRowNodes_go(_t_0, _capturing_0) };
  }
}
function $skRowNodes(_xs_0, _capturing_0) {
  return $skRowNodes_go(_xs_0, _capturing_0);
}
function $skSectionNode(_section_0, _capturing_0) {
  const _id_0 = _section_0["id"];
  const _title_0 = _section_0["title"];
  const _rows_0 = _section_0["rows"];
  return $view_viewEl("section", { $: "Con", head: $view_attrClass("keys-group"), tail: { $: "Con", head: $view_attrAria("labelledby", _id_0), tail: { $: "Nil" } } }, { $: "Con", head: $view_viewEl("h3", { $: "Con", head: $view_attrId(_id_0), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText(_title_0), tail: { $: "Nil" } }), tail: $skRowNodes(_rows_0, _capturing_0) });
}
function $skSectionNodes_go(_xs_0, _capturing_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return { $: "Con", head: $skSectionNode(_h_0, _capturing_0), tail: $skSectionNodes_go(_t_0, _capturing_0) };
  }
}
function $skSectionNodes(_xs_0, _capturing_0) {
  return $skSectionNodes_go(_xs_0, _capturing_0);
}
function $skCloseNode() {
  return $view_viewEl("button", { $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_attrId("keys-done"), tail: { $: "Con", head: $view_attrKey("keys-done"), tail: { $: "Con", head: $view_attrClass("icon-btn dialog-close"), tail: { $: "Con", head: $view_attrAria("label", $msg_msg("keys.closeAria")), tail: { $: "Con", head: $view_attrTitle($msg_msg("common.close")), tail: { $: "Con", head: $view_attrOn("click", "Done"), tail: { $: "Nil" } } } } } } } }, { $: "Con", head: $view_viewText("×"), tail: { $: "Nil" } });
}
function $skHeadNode() {
  return $view_viewEl("div", { $: "Con", head: $view_attrClass("keys-head"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewEl("h2", { $: "Con", head: $view_attrId("keys-title"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText($msg_msg("keys.title")), tail: { $: "Nil" } }), tail: { $: "Con", head: $skCloseNode(), tail: { $: "Con", head: $view_viewEl("p", { $: "Con", head: $view_attrClass("keys-sub"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText($msg_msg("keys.lead")), tail: { $: "Nil" } }), tail: { $: "Nil" } } } });
}
function $skGroupsNode(_sections_0, _capturing_0) {
  return $view_viewEl("div", { $: "Con", head: $view_attrClass("keys-groups"), tail: { $: "Nil" } }, $skSectionNodes(_sections_0, _capturing_0));
}
function $skStatusKind(_kind_0, _conflict_0) {
  if (_conflict_0) {
    return "error";
  } else {
    return $skTextOr(_kind_0, "info");
  }
}
function $skStatusNode(_status_0, _kind_0, _conflict_0) {
  return $view_viewEl("p", { $: "Con", head: $view_attrClass("keys-status"), tail: { $: "Con", head: $view_attrId("keys-status"), tail: { $: "Con", head: $view_attr("role", "status"), tail: { $: "Con", head: $view_attrAria("live", "polite"), tail: { $: "Con", head: $view_attrData("kind", $skStatusKind(_kind_0, _conflict_0)), tail: { $: "Nil" } } } } } }, $view_viewWhen($Bool_not($String_is_empty(_status_0)), $view_viewText(_status_0)));
}
function $skFooterNode(_hasOverrides_0) {
  return $view_viewEl("menu", { $: "Nil" }, { $: "Con", head: $view_viewEl("button", $view_attrJoin({ $: "Con", head: { $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_attrId("keys-reset-all"), tail: { $: "Con", head: $view_attrKey("keys-reset-all"), tail: { $: "Con", head: $view_attrOn("click", "ResetAll"), tail: { $: "Nil" } } } } }, tail: { $: "Con", head: $view_attrWhen($Bool_not(_hasOverrides_0), $view_attr("disabled", "")), tail: { $: "Nil" } } }), { $: "Con", head: $view_viewText($msg_msg("keys.resetAll")), tail: { $: "Nil" } }), tail: { $: "Nil" } });
}
function $skDialogChildren(_fact_0) {
  const _capturing_0 = _fact_0["capturing"];
  const _conflict_0 = _fact_0["conflict"];
  const _status_0 = _fact_0["status"];
  const _statusKind_0 = _fact_0["statusKind"];
  const _hasOverrides_0 = _fact_0["hasOverrides"];
  const _sections_0 = _fact_0["sections"];
  return { $: "Con", head: $skHeadNode(), tail: { $: "Con", head: $skGroupsNode(_sections_0, _capturing_0), tail: { $: "Con", head: $skStatusNode(_status_0, _statusKind_0, _conflict_0), tail: { $: "Con", head: $skFooterNode(_hasOverrides_0), tail: { $: "Nil" } } } } };
}
function $shortcutDialog(_fact_0) {
  const _open_0 = _fact_0["open"];
  const _capturing_0 = _fact_0["capturing"];
  const _conflict_0 = _fact_0["conflict"];
  const _status_0 = _fact_0["status"];
  const _statusKind_0 = _fact_0["statusKind"];
  const _hasOverrides_0 = _fact_0["hasOverrides"];
  const _sections_0 = _fact_0["sections"];
  return $view_viewEl("dialog", $view_attrConcat({ $: "Con", head: $view_attrId("keys-dialog"), tail: { $: "Con", head: $view_attrAria("labelledby", "keys-title"), tail: { $: "Nil" } } }, $view_attrWhen(_open_0, $view_attr("open", ""))), $skDialogChildren({ $: "ShortcutDialogFact", open: _open_0, capturing: _capturing_0, conflict: _conflict_0, status: _status_0, statusKind: _statusKind_0, hasOverrides: _hasOverrides_0, sections: _sections_0 }));
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
var shortcutview_default = {
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
  skRow: run_lib((a0, a1, a2, a3, a4, a5) => run_loop($skRow(str_in(a0), str_in(a1), str_in(a2), a3, str_in(a4), a5)), 6),
  skSection: run_lib((a0, a1, a2) => run_loop($skSection(str_in(a0), str_in(a1), a2)), 3),
  skDialog: run_lib((a0, a1, a2, a3, a4, a5, a6) => run_loop($skDialog(a0, str_in(a1), a2, str_in(a3), str_in(a4), a5, a6)), 7),
  "skTextOr.if": run_lib((a0, a1, a2) => str_out(run_loop($skTextOr_if(str_in(a0), str_in(a1), a2))), 3),
  skTextOr: run_lib((a0, a1) => str_out(run_loop($skTextOr(str_in(a0), str_in(a1)))), 2),
  skKbdText: run_lib((a0, a1) => str_out(run_loop($skKbdText(str_in(a0), a1))), 2),
  skKbdEmpty: run_lib((a0, a1) => run_loop($skKbdEmpty(str_in(a0), a1)), 2),
  "skKbdAria.if": run_lib((a0, a1) => str_out(run_loop($skKbdAria_if(str_in(a0), a1))), 2),
  skKbdAria: run_lib((a0, a1, a2) => str_out(run_loop($skKbdAria(str_in(a0), str_in(a1), a2))), 3),
  skLabelNode: run_lib((a0, a1) => run_loop($skLabelNode(str_in(a0), str_in(a1))), 2),
  skKbdNode: run_lib((a0, a1, a2) => run_loop($skKbdNode(str_in(a0), str_in(a1), a2)), 3),
  skNoteNode: run_lib((a0) => run_loop($skNoteNode(str_in(a0))), 1),
  skRecordLabel: run_lib((a0) => str_out(run_loop($skRecordLabel(a0))), 1),
  skRecordAria: run_lib((a0, a1) => str_out(run_loop($skRecordAria(str_in(a0), a1))), 2),
  skRecordNode: run_lib((a0, a1, a2) => run_loop($skRecordNode(str_in(a0), str_in(a1), a2)), 3),
  skResetNode: run_lib((a0, a1) => run_loop($skResetNode(str_in(a0), a1)), 2),
  "skRowKids.editable": run_lib((a0, a1, a2, a3, a4, a5, a6) => run_loop($skRowKids_editable(str_in(a0), str_in(a1), str_in(a2), str_in(a3), a4, a5, a6)), 7),
  "skRowNode.record": run_lib((a0, a1) => run_loop($skRowNode_record(a0, a1)), 2),
  skRowNode: run_lib((a0, a1) => run_loop($skRowNode(a0, str_in(a1))), 2),
  "skRowNodes.go": run_lib((a0, a1) => run_loop($skRowNodes_go(a0, str_in(a1))), 2),
  skRowNodes: run_lib((a0, a1) => run_loop($skRowNodes(a0, str_in(a1))), 2),
  skSectionNode: run_lib((a0, a1) => run_loop($skSectionNode(a0, str_in(a1))), 2),
  "skSectionNodes.go": run_lib((a0, a1) => run_loop($skSectionNodes_go(a0, str_in(a1))), 2),
  skSectionNodes: run_lib((a0, a1) => run_loop($skSectionNodes(a0, str_in(a1))), 2),
  skCloseNode: run_lib(() => run_loop($skCloseNode()), 0),
  skHeadNode: run_lib(() => run_loop($skHeadNode()), 0),
  skGroupsNode: run_lib((a0, a1) => run_loop($skGroupsNode(a0, str_in(a1))), 2),
  skStatusKind: run_lib((a0, a1) => str_out(run_loop($skStatusKind(str_in(a0), a1))), 2),
  skStatusNode: run_lib((a0, a1, a2) => run_loop($skStatusNode(str_in(a0), str_in(a1), a2)), 3),
  skFooterNode: run_lib((a0) => run_loop($skFooterNode(a0)), 1),
  skDialogChildren: run_lib((a0) => run_loop($skDialogChildren(a0)), 1),
  shortcutDialog: run_lib((a0) => run_loop($shortcutDialog(a0)), 1)
};
export {
  shortcutview_default as default
};

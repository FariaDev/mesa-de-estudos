// GERADO de core/composerview.bend por `bun core/build.mjs` — não editar à mão.
// core/composerview.bend
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
function $queueQueuedLabel(_many_0, _count_0) {
  if (!_many_0) {
    return $msg_msg("queue.queued");
  } else {
    return $msg_msg1("queue.queuedCount", "count", _count_0);
  }
}
function $queueRecoveredLabel(_many_0, _count_0) {
  if (!_many_0) {
    return $msg_msg("queue.recovered");
  } else {
    return $msg_msg1("queue.recoveredCount", "count", _count_0);
  }
}
function $queueLabel(_recovered_0, _many_0, _count_0) {
  if (!_recovered_0) {
    return $queueQueuedLabel(_many_0, _count_0);
  } else {
    return $queueRecoveredLabel(_many_0, _count_0);
  }
}
function $queueSendNowLabel() {
  return $msg_msg("queue.sendNow");
}
function $queueSendNowTitle() {
  return $msg_msg("queue.sendNowTitle");
}
function $queueClearLabel() {
  return $msg_msg("queue.clear");
}
function $queueClearTitle() {
  return $msg_msg("queue.clearTitle");
}
function $queueItemTitle(_text_0, _sending_0) {
  if (_sending_0) {
    return _text_0;
  } else {
    return $msg_msg1("queue.editTitle", "text", _text_0);
  }
}
function $editBannerText() {
  return $msg_msg("queue.editBanner");
}
function $queueStripClass(_closing_0) {
  return $view_classes({ $: "Con", head: $view_classOn("queue-strip", true), tail: { $: "Con", head: $view_classOn("closing", _closing_0), tail: { $: "Nil" } } });
}
function $queueItemClass(_sending_0) {
  return $view_classes({ $: "Con", head: $view_classOn("queue-item", true), tail: { $: "Con", head: $view_classOn("sending", _sending_0), tail: { $: "Nil" } } });
}
function $queueClosingData(_closing_0) {
  return $view_attrWhen(_closing_0, $view_attrData("closing", "1"));
}
function $queueBusyAttr(_sending_0) {
  return $view_attrWhen(_sending_0, $view_attrAria("busy", "true"));
}
function $queueDisabledAttr(_enabled_0) {
  if (_enabled_0) {
    return { $: "Nil" };
  } else {
    return { $: "Con", head: $view_attr("disabled", ""), tail: { $: "Nil" } };
  }
}
function $editBannerHidden(_visible_0) {
  if (_visible_0) {
    return { $: "Nil" };
  } else {
    return { $: "Con", head: $view_attr("hidden", ""), tail: { $: "Nil" } };
  }
}
function $editBannerClass(_closing_0) {
  return $view_classes({ $: "Con", head: $view_classOn("closing", _closing_0), tail: { $: "Nil" } });
}
function $queueLabelView(_text_0) {
  return $view_viewEl("div", { $: "Con", head: $view_attrClass("queue-label"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText(_text_0), tail: { $: "Nil" } });
}
function $queueTextEnabled(_title_0) {
  return { $: "Con", head: $view_attrTitle(_title_0), tail: { $: "Con", head: $view_attr("tabindex", "0"), tail: { $: "Con", head: $view_attr("role", "button"), tail: { $: "Con", head: $view_attrAria("label", $msg_msg("queue.editItem")), tail: { $: "Con", head: $view_attrOn("click", "edit"), tail: { $: "Con", head: $view_attrOn("keydown", "editKey"), tail: { $: "Nil" } } } } } } };
}
function $queueTextIdle(_title_0) {
  return { $: "Con", head: $view_attrTitle(_title_0), tail: { $: "Nil" } };
}
function $queueTextAttrs(_enabled_0, _title_0) {
  if (_enabled_0) {
    return $queueTextEnabled(_title_0);
  } else {
    return $queueTextIdle(_title_0);
  }
}
function $queueTextSpan(_text_0, _sending_0, _enabled_0) {
  return $view_viewEl("span", $queueTextAttrs(_enabled_0, $queueItemTitle(_text_0, _sending_0)), { $: "Con", head: $view_viewText(_text_0), tail: { $: "Nil" } });
}
function $queueRemoveAttrs(_enabled_0) {
  return $view_attrConcat({ $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_attrTitle($msg_msg("queue.remove")), tail: { $: "Con", head: $view_attrAria("label", $msg_msg("queue.remove")), tail: { $: "Con", head: $view_attrOn("click", "remove"), tail: { $: "Nil" } } } } }, $queueDisabledAttr(_enabled_0));
}
function $queueRemoveBtn(_enabled_0) {
  return $view_viewEl("button", $queueRemoveAttrs(_enabled_0), { $: "Con", head: $view_viewText("×"), tail: { $: "Nil" } });
}
function $queueEditInput(_text_0) {
  return $view_viewEl("input", { $: "Con", head: $view_attrType("text"), tail: { $: "Con", head: $view_attrClass("queue-edit"), tail: { $: "Con", head: $view_attr("value", _text_0), tail: { $: "Con", head: $view_attrAria("label", $msg_msg("queue.editItem")), tail: { $: "Con", head: $view_attrKey("queue-edit"), tail: { $: "Con", head: $view_attrOn("keydown", "editInput"), tail: { $: "Con", head: $view_attrOn("blur", "editBlur"), tail: { $: "Nil" } } } } } } } }, { $: "Nil" });
}
function $queueItemAttrs(_id_0, _sending_0) {
  return $view_attrConcat({ $: "Con", head: $queueItemClass(_sending_0), tail: { $: "Con", head: $view_attrData("id", _id_0), tail: { $: "Nil" } } }, $queueBusyAttr(_sending_0));
}
function $queueItemKids(_text_0, _sending_0, _enabled_0, _editing_0) {
  if (_editing_0) {
    return { $: "Con", head: $queueEditInput(_text_0), tail: { $: "Con", head: $queueRemoveBtn(_enabled_0), tail: { $: "Nil" } } };
  } else {
    return { $: "Con", head: $queueTextSpan(_text_0, _sending_0, _enabled_0), tail: { $: "Con", head: $queueRemoveBtn(_enabled_0), tail: { $: "Nil" } } };
  }
}
function $queueItem_body(_id_0, _text_0, _sending_0, _enabled_0, _editing_0) {
  return $view_viewEl("div", $queueItemAttrs(_id_0, _sending_0), $queueItemKids(_text_0, _sending_0, _enabled_0, _editing_0));
}
function $queueItemView(_row_0) {
  const _id_0 = _row_0["id"];
  const _text_0 = _row_0["text"];
  const _sending_0 = _row_0["sending"];
  const _enabled_0 = _row_0["enabled"];
  const _editing_0 = _row_0["editing"];
  return $queueItem_body(_id_0, _text_0, _sending_0, _enabled_0, _editing_0);
}
function $queueItemViews(_items_0) {
  return $view_viewMap_1(_items_0);
}
function $queueStripAttrs(_closing_0) {
  return $view_attrConcat({ $: "Con", head: $queueStripClass(_closing_0), tail: { $: "Con", head: $view_attrAria("live", "polite"), tail: { $: "Nil" } } }, $queueClosingData(_closing_0));
}
function $queueActionHidden(_visible_0) {
  if (_visible_0) {
    return { $: "Nil" };
  } else {
    return { $: "Con", head: $view_attr("hidden", ""), tail: { $: "Nil" } };
  }
}
function $queueSendNowAttrs(_canSendNow_0) {
  return $view_attrConcat({ $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_attrClass("queue-send-now"), tail: { $: "Con", head: $view_attrTitle($queueSendNowTitle()), tail: { $: "Con", head: $view_attrOn("click", "sendNow"), tail: { $: "Nil" } } } } }, $queueActionHidden(_canSendNow_0));
}
function $queueSendNowBtn(_canSendNow_0) {
  return $view_viewEl("button", $queueSendNowAttrs(_canSendNow_0), { $: "Con", head: $view_viewText($queueSendNowLabel()), tail: { $: "Nil" } });
}
function $queueClearAttrs(_canClear_0) {
  return $view_attrConcat({ $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_attrClass("queue-clear"), tail: { $: "Con", head: $view_attrTitle($queueClearTitle()), tail: { $: "Con", head: $view_attrOn("click", "clear"), tail: { $: "Nil" } } } } }, $queueActionHidden(_canClear_0));
}
function $queueClearBtn(_canClear_0) {
  return $view_viewEl("button", $queueClearAttrs(_canClear_0), { $: "Con", head: $view_viewText($queueClearLabel()), tail: { $: "Nil" } });
}
function $queueActionViews(_canSendNow_0, _canClear_0) {
  return $view_viewConcat({ $: "Con", head: $queueSendNowBtn(_canSendNow_0), tail: { $: "Nil" } }, { $: "Con", head: $queueClearBtn(_canClear_0), tail: { $: "Nil" } });
}
function $queueActionsView(_canSendNow_0, _canClear_0) {
  return $view_viewEl("div", { $: "Con", head: $view_attrClass("queue-actions"), tail: { $: "Nil" } }, $queueActionViews(_canSendNow_0, _canClear_0));
}
function $queueStripKids(_label_0, _items_0, _canSendNow_0, _canClear_0) {
  return $view_viewConcat({ $: "Con", head: $queueLabelView(_label_0), tail: { $: "Nil" } }, $view_viewConcat($queueItemViews(_items_0), { $: "Con", head: $queueActionsView(_canSendNow_0, _canClear_0), tail: { $: "Nil" } }));
}
function $queueStripView(_closing_0, _label_0, _items_0, _canSendNow_0, _canClear_0) {
  return $view_viewEl("div", $queueStripAttrs(_closing_0), $queueStripKids(_label_0, _items_0, _canSendNow_0, _canClear_0));
}
function $editBannerAttrs(_visible_0, _closing_0) {
  return $view_attrConcat({ $: "Con", head: $view_attrId("edit-banner"), tail: { $: "Con", head: $editBannerClass(_closing_0), tail: { $: "Nil" } } }, $editBannerHidden(_visible_0));
}
function $editBannerView(_visible_0, _closing_0) {
  return $view_viewEl("div", $editBannerAttrs(_visible_0, _closing_0), { $: "Con", head: $view_viewEl("span", { $: "Nil" }, { $: "Con", head: $view_viewText($editBannerText()), tail: { $: "Nil" } }), tail: { $: "Con", head: $view_viewEl("button", { $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_attrId("edit-cancel"), tail: { $: "Con", head: $view_attrOn("click", "editCancel"), tail: { $: "Nil" } } } }, { $: "Con", head: $view_viewText($msg_msg("common.cancel")), tail: { $: "Nil" } }), tail: { $: "Nil" } } });
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
    return { $: "Con", head: $queueItemView(_h_0), tail: $view_viewMap_1(_t_0) };
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
var composerview_default = {
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
  queueQueuedLabel: run_lib((a0, a1) => str_out(run_loop($queueQueuedLabel(a0, str_in(a1)))), 2),
  queueRecoveredLabel: run_lib((a0, a1) => str_out(run_loop($queueRecoveredLabel(a0, str_in(a1)))), 2),
  queueLabel: run_lib((a0, a1, a2) => str_out(run_loop($queueLabel(a0, a1, str_in(a2)))), 3),
  queueSendNowLabel: run_lib(() => str_out(run_loop($queueSendNowLabel())), 0),
  queueSendNowTitle: run_lib(() => str_out(run_loop($queueSendNowTitle())), 0),
  queueClearLabel: run_lib(() => str_out(run_loop($queueClearLabel())), 0),
  queueClearTitle: run_lib(() => str_out(run_loop($queueClearTitle())), 0),
  queueItemTitle: run_lib((a0, a1) => str_out(run_loop($queueItemTitle(str_in(a0), a1))), 2),
  editBannerText: run_lib(() => str_out(run_loop($editBannerText())), 0),
  queueStripClass: run_lib((a0) => run_loop($queueStripClass(a0)), 1),
  queueItemClass: run_lib((a0) => run_loop($queueItemClass(a0)), 1),
  queueClosingData: run_lib((a0) => run_loop($queueClosingData(a0)), 1),
  queueBusyAttr: run_lib((a0) => run_loop($queueBusyAttr(a0)), 1),
  queueDisabledAttr: run_lib((a0) => run_loop($queueDisabledAttr(a0)), 1),
  editBannerHidden: run_lib((a0) => run_loop($editBannerHidden(a0)), 1),
  editBannerClass: run_lib((a0) => run_loop($editBannerClass(a0)), 1),
  queueLabelView: run_lib((a0) => run_loop($queueLabelView(str_in(a0))), 1),
  queueTextEnabled: run_lib((a0) => run_loop($queueTextEnabled(str_in(a0))), 1),
  queueTextIdle: run_lib((a0) => run_loop($queueTextIdle(str_in(a0))), 1),
  queueTextAttrs: run_lib((a0, a1) => run_loop($queueTextAttrs(a0, str_in(a1))), 2),
  queueTextSpan: run_lib((a0, a1, a2) => run_loop($queueTextSpan(str_in(a0), a1, a2)), 3),
  queueRemoveAttrs: run_lib((a0) => run_loop($queueRemoveAttrs(a0)), 1),
  queueRemoveBtn: run_lib((a0) => run_loop($queueRemoveBtn(a0)), 1),
  queueEditInput: run_lib((a0) => run_loop($queueEditInput(str_in(a0))), 1),
  queueItemAttrs: run_lib((a0, a1) => run_loop($queueItemAttrs(str_in(a0), a1)), 2),
  queueItemKids: run_lib((a0, a1, a2, a3) => run_loop($queueItemKids(str_in(a0), a1, a2, a3)), 4),
  "queueItem.body": run_lib((a0, a1, a2, a3, a4) => run_loop($queueItem_body(str_in(a0), str_in(a1), a2, a3, a4)), 5),
  queueItemView: run_lib((a0) => run_loop($queueItemView(a0)), 1),
  queueItemViews: run_lib((a0) => run_loop($queueItemViews(a0)), 1),
  queueStripAttrs: run_lib((a0) => run_loop($queueStripAttrs(a0)), 1),
  queueActionHidden: run_lib((a0) => run_loop($queueActionHidden(a0)), 1),
  queueSendNowAttrs: run_lib((a0) => run_loop($queueSendNowAttrs(a0)), 1),
  queueSendNowBtn: run_lib((a0) => run_loop($queueSendNowBtn(a0)), 1),
  queueClearAttrs: run_lib((a0) => run_loop($queueClearAttrs(a0)), 1),
  queueClearBtn: run_lib((a0) => run_loop($queueClearBtn(a0)), 1),
  queueActionViews: run_lib((a0, a1) => run_loop($queueActionViews(a0, a1)), 2),
  queueActionsView: run_lib((a0, a1) => run_loop($queueActionsView(a0, a1)), 2),
  queueStripKids: run_lib((a0, a1, a2, a3) => run_loop($queueStripKids(str_in(a0), a1, a2, a3)), 4),
  queueStripView: run_lib((a0, a1, a2, a3, a4) => run_loop($queueStripView(a0, str_in(a1), a2, a3, a4)), 5),
  editBannerAttrs: run_lib((a0, a1) => run_loop($editBannerAttrs(a0, a1)), 2),
  editBannerView: run_lib((a0, a1) => run_loop($editBannerView(a0, a1)), 2)
};
export {
  composerview_default as default
};

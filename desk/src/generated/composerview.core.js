// GERADO de core/composerview.bend por `bun core/build.mjs` — não editar à mão.
// core/composerview.bend
function cmp_new(a, b) {
  return { $: a < b ? "LT" : a === b ? "EQ" : "GT" };
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
function $queueQueuedLabel$(_many_0, _count_0) {
  if (!_many_0) {
    return "Na fila";
  } else {
    return "Na fila · " + _count_0;
  }
}
function $queueRecoveredLabel$(_many_0, _count_0) {
  if (!_many_0) {
    return "Recuperadas";
  } else {
    return "Recuperadas · " + _count_0;
  }
}
function $queueLabel$(_recovered_0, _many_0, _count_0) {
  if (!_recovered_0) {
    return run_jump($queueQueuedLabel$, [_many_0, _count_0]);
  } else {
    return run_jump($queueRecoveredLabel$, [_many_0, _count_0]);
  }
}
function $queueSendNowLabel$() {
  return "Enviar agora";
}
function $queueSendNowTitle$() {
  return "Enviar a fila agora, sem esperar o fim do turno";
}
function $queueClearLabel$() {
  return "Limpar";
}
function $queueClearTitle$() {
  return "Limpar a fila (as mensagens pendentes são descartadas)";
}
function $queueEditHint$() {
  return " — clique para editar";
}
function $queueItemTitle$(_text_0, _sending_0) {
  if (_sending_0) {
    return _text_0;
  } else {
    const _x_0 = run_loop($queueEditHint$());
    return _text_0 + _x_0;
  }
}
function $editBannerText$() {
  return "Editando a última pergunta — envia como mensagem nova. O histórico anterior permanece.";
}
function $queueStripClass$(_closing_0) {
  return run_jump($view$classes$, [{ $: "Con", ["head"]: run_loop($view$classOn$("queue-strip", true)), ["tail"]: { $: "Con", ["head"]: run_loop($view$classOn$("closing", _closing_0)), ["tail"]: { $: "Nil" } } }]);
}
function $queueItemClass$(_sending_0) {
  return run_jump($view$classes$, [{ $: "Con", ["head"]: run_loop($view$classOn$("queue-item", true)), ["tail"]: { $: "Con", ["head"]: run_loop($view$classOn$("sending", _sending_0)), ["tail"]: { $: "Nil" } } }]);
}
function $queueClosingData$(_closing_0) {
  return run_jump($view$attrWhen$, [_closing_0, run_loop($view$attrData$("closing", "1"))]);
}
function $queueBusyAttr$(_sending_0) {
  return run_jump($view$attrWhen$, [_sending_0, run_loop($view$attrAria$("busy", "true"))]);
}
function $queueDisabledAttr$(_enabled_0) {
  if (_enabled_0) {
    return { $: "Nil" };
  } else {
    return { $: "Con", ["head"]: run_loop($view$attr$("disabled", "")), ["tail"]: { $: "Nil" } };
  }
}
function $editBannerHidden$(_visible_0) {
  if (_visible_0) {
    return { $: "Nil" };
  } else {
    return { $: "Con", ["head"]: run_loop($view$attr$("hidden", "")), ["tail"]: { $: "Nil" } };
  }
}
function $editBannerClass$(_closing_0) {
  return run_jump($view$classes$, [{ $: "Con", ["head"]: run_loop($view$classOn$("closing", _closing_0)), ["tail"]: { $: "Nil" } }]);
}
function $queueLabelView$(_text_0) {
  return run_jump($view$viewEl$, ["div", { $: "Con", ["head"]: run_loop($view$attrClass$("queue-label")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$(_text_0)), ["tail"]: { $: "Nil" } }]);
}
function $queueTextEnabled$(_title_0) {
  return { $: "Con", ["head"]: run_loop($view$attrTitle$(_title_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$attr$("tabindex", "0")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attr$("role", "button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("label", "Editar item da fila")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "edit")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("keydown", "editKey")), ["tail"]: { $: "Nil" } } } } } } };
}
function $queueTextIdle$(_title_0) {
  return { $: "Con", ["head"]: run_loop($view$attrTitle$(_title_0)), ["tail"]: { $: "Nil" } };
}
function $queueTextAttrs$(_enabled_0, _title_0) {
  if (_enabled_0) {
    return run_jump($queueTextEnabled$, [_title_0]);
  } else {
    return run_jump($queueTextIdle$, [_title_0]);
  }
}
function $queueTextSpan$(_text_0, _sending_0, _enabled_0) {
  return run_jump($view$viewEl$, ["span", run_loop($queueTextAttrs$(_enabled_0, run_loop($queueItemTitle$(_text_0, _sending_0)))), { $: "Con", ["head"]: run_loop($view$viewText$(_text_0)), ["tail"]: { $: "Nil" } }]);
}
function $queueRemoveAttrs$(_enabled_0) {
  return run_jump($view$attrConcat$, [{ $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrTitle$("Remover da fila")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("label", "Remover da fila")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "remove")), ["tail"]: { $: "Nil" } } } } }, run_loop($queueDisabledAttr$(_enabled_0))]);
}
function $queueRemoveBtn$(_enabled_0) {
  return run_jump($view$viewEl$, ["button", run_loop($queueRemoveAttrs$(_enabled_0)), { $: "Con", ["head"]: run_loop($view$viewText$("×")), ["tail"]: { $: "Nil" } }]);
}
function $queueEditInput$(_text_0) {
  return run_jump($view$viewEl$, ["input", { $: "Con", ["head"]: run_loop($view$attrType$("text")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrClass$("queue-edit")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attr$("value", _text_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("label", "Editar item da fila")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrKey$("queue-edit")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("keydown", "editInput")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("blur", "editBlur")), ["tail"]: { $: "Nil" } } } } } } } }, { $: "Nil" }]);
}
function $queueItemAttrs$(_id_0, _sending_0) {
  return run_jump($view$attrConcat$, [{ $: "Con", ["head"]: run_loop($queueItemClass$(_sending_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("id", _id_0)), ["tail"]: { $: "Nil" } } }, run_loop($queueBusyAttr$(_sending_0))]);
}
function $queueItemKids$(_text_0, _sending_0, _enabled_0, _editing_0) {
  if (_editing_0) {
    return { $: "Con", ["head"]: run_loop($queueEditInput$(_text_0)), ["tail"]: { $: "Con", ["head"]: run_loop($queueRemoveBtn$(_enabled_0)), ["tail"]: { $: "Nil" } } };
  } else {
    return { $: "Con", ["head"]: run_loop($queueTextSpan$(_text_0, _sending_0, _enabled_0)), ["tail"]: { $: "Con", ["head"]: run_loop($queueRemoveBtn$(_enabled_0)), ["tail"]: { $: "Nil" } } };
  }
}
function $queueItem$body$(_id_0, _text_0, _sending_0, _enabled_0, _editing_0) {
  return run_jump($view$viewEl$, ["div", run_loop($queueItemAttrs$(_id_0, _sending_0)), run_loop($queueItemKids$(_text_0, _sending_0, _enabled_0, _editing_0))]);
}
function $queueItemView$(_row_0) {
  const _id_0 = _row_0["id"];
  const _text_0 = _row_0["text"];
  const _sending_0 = _row_0["sending"];
  const _enabled_0 = _row_0["enabled"];
  const _editing_0 = _row_0["editing"];
  return run_jump($queueItem$body$, [_id_0, _text_0, _sending_0, _enabled_0, _editing_0]);
}
function $queueItemViews$(_items_0) {
  return run_jump($view$viewMap$1$, [_items_0]);
}
function $queueStripAttrs$(_closing_0) {
  return run_jump($view$attrConcat$, [{ $: "Con", ["head"]: run_loop($queueStripClass$(_closing_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("live", "polite")), ["tail"]: { $: "Nil" } } }, run_loop($queueClosingData$(_closing_0))]);
}
function $queueActionHidden$(_visible_0) {
  if (_visible_0) {
    return { $: "Nil" };
  } else {
    return { $: "Con", ["head"]: run_loop($view$attr$("hidden", "")), ["tail"]: { $: "Nil" } };
  }
}
function $queueSendNowAttrs$(_canSendNow_0) {
  return run_jump($view$attrConcat$, [{ $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrClass$("queue-send-now")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrTitle$(run_loop($queueSendNowTitle$()))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "sendNow")), ["tail"]: { $: "Nil" } } } } }, run_loop($queueActionHidden$(_canSendNow_0))]);
}
function $queueSendNowBtn$(_canSendNow_0) {
  return run_jump($view$viewEl$, ["button", run_loop($queueSendNowAttrs$(_canSendNow_0)), { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($queueSendNowLabel$()))), ["tail"]: { $: "Nil" } }]);
}
function $queueClearAttrs$(_canClear_0) {
  return run_jump($view$attrConcat$, [{ $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrClass$("queue-clear")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrTitle$(run_loop($queueClearTitle$()))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "clear")), ["tail"]: { $: "Nil" } } } } }, run_loop($queueActionHidden$(_canClear_0))]);
}
function $queueClearBtn$(_canClear_0) {
  return run_jump($view$viewEl$, ["button", run_loop($queueClearAttrs$(_canClear_0)), { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($queueClearLabel$()))), ["tail"]: { $: "Nil" } }]);
}
function $queueActionViews$(_canSendNow_0, _canClear_0) {
  return run_jump($view$viewConcat$, [{ $: "Con", ["head"]: run_loop($queueSendNowBtn$(_canSendNow_0)), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($queueClearBtn$(_canClear_0)), ["tail"]: { $: "Nil" } }]);
}
function $queueActionsView$(_canSendNow_0, _canClear_0) {
  return run_jump($view$viewEl$, ["div", { $: "Con", ["head"]: run_loop($view$attrClass$("queue-actions")), ["tail"]: { $: "Nil" } }, run_loop($queueActionViews$(_canSendNow_0, _canClear_0))]);
}
function $queueStripKids$(_label_0, _items_0, _canSendNow_0, _canClear_0) {
  return run_jump($view$viewConcat$, [{ $: "Con", ["head"]: run_loop($queueLabelView$(_label_0)), ["tail"]: { $: "Nil" } }, run_loop($view$viewConcat$(run_loop($queueItemViews$(_items_0)), { $: "Con", ["head"]: run_loop($queueActionsView$(_canSendNow_0, _canClear_0)), ["tail"]: { $: "Nil" } }))]);
}
function $queueStripView$(_closing_0, _label_0, _items_0, _canSendNow_0, _canClear_0) {
  return run_jump($view$viewEl$, ["div", run_loop($queueStripAttrs$(_closing_0)), run_loop($queueStripKids$(_label_0, _items_0, _canSendNow_0, _canClear_0))]);
}
function $editBannerAttrs$(_visible_0, _closing_0) {
  return run_jump($view$attrConcat$, [{ $: "Con", ["head"]: run_loop($view$attrId$("edit-banner")), ["tail"]: { $: "Con", ["head"]: run_loop($editBannerClass$(_closing_0)), ["tail"]: { $: "Nil" } } }, run_loop($editBannerHidden$(_visible_0))]);
}
function $editBannerView$(_visible_0, _closing_0) {
  return run_jump($view$viewEl$, ["div", run_loop($editBannerAttrs$(_visible_0, _closing_0)), { $: "Con", ["head"]: run_loop($view$viewEl$("span", { $: "Nil" }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($editBannerText$()))), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("button", { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrId$("edit-cancel")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "editCancel")), ["tail"]: { $: "Nil" } } } }, { $: "Con", ["head"]: run_loop($view$viewText$("Cancelar")), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Nil" } } }]);
}
function $settingsPanelLabel$() {
  return "Ajustes";
}
function $settingsPanelTitle$() {
  return "Modelo, esforço e compactação automática";
}
function $settingsPanelBodyId$() {
  return "pi-settings-body";
}
function $settingsToggleClass$(_open_0) {
  return run_jump($view$classes$, [{ $: "Con", ["head"]: run_loop($view$classOn$("settings-toggle", true)), ["tail"]: { $: "Con", ["head"]: run_loop($view$classOn$("open", _open_0)), ["tail"]: { $: "Nil" } } }]);
}
function $settingsPanelHidden$(_open_0) {
  if (_open_0) {
    return { $: "Nil" };
  } else {
    return { $: "Con", ["head"]: run_loop($view$attr$("hidden", "")), ["tail"]: { $: "Nil" } };
  }
}
function $settingsToggleAttrs$(_open_0) {
  return run_jump($view$attrJoin$, [{ $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrId$("settings-toggle")), ["tail"]: { $: "Nil" } } }, ["tail"]: { $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($settingsToggleClass$(_open_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("expanded", run_loop($view$boolStr$(_open_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("controls", run_loop($settingsPanelBodyId$()))), ["tail"]: { $: "Nil" } } } }, ["tail"]: { $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "ToggleSettings")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrTitle$(run_loop($settingsPanelTitle$()))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("icon", "unfold")), ["tail"]: { $: "Nil" } } } }, ["tail"]: { $: "Nil" } } } }]);
}
function $settingsToggleBtn$(_open_0) {
  return run_jump($view$viewEl$, ["button", run_loop($settingsToggleAttrs$(_open_0)), { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($settingsPanelLabel$()))), ["tail"]: { $: "Nil" } }]);
}
function $settingsPanelBody$(_open_0) {
  return run_jump($view$viewEl$, ["div", run_loop($view$attrJoin$({ $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrId$(run_loop($settingsPanelBodyId$()))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrClass$("settings-body")), ["tail"]: { $: "Nil" } } }, ["tail"]: { $: "Con", ["head"]: run_loop($settingsPanelHidden$(_open_0)), ["tail"]: { $: "Nil" } } })), { $: "Nil" }]);
}
function $settingsPanel$(_open_0) {
  return run_jump($view$viewEl$, ["div", { $: "Con", ["head"]: run_loop($view$attrId$("pi-settings-panel")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrClass$("settings-panel")), ["tail"]: { $: "Nil" } } }, { $: "Con", ["head"]: run_loop($settingsToggleBtn$(_open_0)), ["tail"]: { $: "Con", ["head"]: run_loop($settingsPanelBody$(_open_0)), ["tail"]: { $: "Nil" } } }]);
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
function $view$viewMap$1$(_xs_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return { $: "Con", ["head"]: run_loop($queueItemView$(_h_0)), ["tail"]: run_loop($view$viewMap$1$(_t_0)) };
  }
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
function $String$cmp$rec$(_h1b_0, _h2b_0, _rr_0) {
  const _t_0 = _rr_0["fst"];
  const _t1b_0 = _t_0["fst"];
  const _t2b_0 = _t_0["snd"];
  const _r_0 = _rr_0["snd"];
  return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: _h1b_0 + _t1b_0, ["snd"]: _h2b_0 + _t2b_0 }, ["snd"]: _r_0 };
}
var composerview_default = {
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
  queueQueuedLabel: run_lib($queueQueuedLabel$, 2),
  queueRecoveredLabel: run_lib($queueRecoveredLabel$, 2),
  queueLabel: run_lib($queueLabel$, 3),
  queueSendNowLabel: run_lib($queueSendNowLabel$, 0),
  queueSendNowTitle: run_lib($queueSendNowTitle$, 0),
  queueClearLabel: run_lib($queueClearLabel$, 0),
  queueClearTitle: run_lib($queueClearTitle$, 0),
  queueEditHint: run_lib($queueEditHint$, 0),
  queueItemTitle: run_lib($queueItemTitle$, 2),
  editBannerText: run_lib($editBannerText$, 0),
  queueStripClass: run_lib($queueStripClass$, 1),
  queueItemClass: run_lib($queueItemClass$, 1),
  queueClosingData: run_lib($queueClosingData$, 1),
  queueBusyAttr: run_lib($queueBusyAttr$, 1),
  queueDisabledAttr: run_lib($queueDisabledAttr$, 1),
  editBannerHidden: run_lib($editBannerHidden$, 1),
  editBannerClass: run_lib($editBannerClass$, 1),
  queueLabelView: run_lib($queueLabelView$, 1),
  queueTextEnabled: run_lib($queueTextEnabled$, 1),
  queueTextIdle: run_lib($queueTextIdle$, 1),
  queueTextAttrs: run_lib($queueTextAttrs$, 2),
  queueTextSpan: run_lib($queueTextSpan$, 3),
  queueRemoveAttrs: run_lib($queueRemoveAttrs$, 1),
  queueRemoveBtn: run_lib($queueRemoveBtn$, 1),
  queueEditInput: run_lib($queueEditInput$, 1),
  queueItemAttrs: run_lib($queueItemAttrs$, 2),
  queueItemKids: run_lib($queueItemKids$, 4),
  "queueItem.body": run_lib($queueItem$body$, 5),
  queueItemView: run_lib($queueItemView$, 1),
  queueItemViews: run_lib($queueItemViews$, 1),
  queueStripAttrs: run_lib($queueStripAttrs$, 1),
  queueActionHidden: run_lib($queueActionHidden$, 1),
  queueSendNowAttrs: run_lib($queueSendNowAttrs$, 1),
  queueSendNowBtn: run_lib($queueSendNowBtn$, 1),
  queueClearAttrs: run_lib($queueClearAttrs$, 1),
  queueClearBtn: run_lib($queueClearBtn$, 1),
  queueActionViews: run_lib($queueActionViews$, 2),
  queueActionsView: run_lib($queueActionsView$, 2),
  queueStripKids: run_lib($queueStripKids$, 4),
  queueStripView: run_lib($queueStripView$, 5),
  editBannerAttrs: run_lib($editBannerAttrs$, 2),
  editBannerView: run_lib($editBannerView$, 2),
  settingsPanelLabel: run_lib($settingsPanelLabel$, 0),
  settingsPanelTitle: run_lib($settingsPanelTitle$, 0),
  settingsPanelBodyId: run_lib($settingsPanelBodyId$, 0),
  settingsToggleClass: run_lib($settingsToggleClass$, 1),
  settingsPanelHidden: run_lib($settingsPanelHidden$, 1),
  settingsToggleAttrs: run_lib($settingsToggleAttrs$, 1),
  settingsToggleBtn: run_lib($settingsToggleBtn$, 1),
  settingsPanelBody: run_lib($settingsPanelBody$, 1),
  settingsPanel: run_lib($settingsPanel$, 1)
};
export {
  composerview_default as default
};

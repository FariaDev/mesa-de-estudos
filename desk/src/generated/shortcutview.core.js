// GERADO de core/shortcutview.bend por `bun core/build.mjs` — não editar à mão.
// core/shortcutview.bend
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
function $skRow$(_id_0, _label_0, _effective_0, _fixed_0, _note_0, _overridden_0) {
  return { $: "ShortcutRowFact", ["id"]: _id_0, ["label"]: _label_0, ["effective"]: _effective_0, ["fixed"]: _fixed_0, ["note"]: _note_0, ["overridden"]: _overridden_0 };
}
function $skSection$(_id_0, _title_0, _rows_0) {
  return { $: "ShortcutSectionFact", ["id"]: _id_0, ["title"]: _title_0, ["rows"]: _rows_0 };
}
function $skDialog$(_open_0, _capturing_0, _conflict_0, _status_0, _statusKind_0, _hasOverrides_0, _sections_0) {
  return { $: "ShortcutDialogFact", ["open"]: _open_0, ["capturing"]: _capturing_0, ["conflict"]: _conflict_0, ["status"]: _status_0, ["statusKind"]: _statusKind_0, ["hasOverrides"]: _hasOverrides_0, ["sections"]: _sections_0 };
}
function $skTextOr$if$(_raw_0, _fallback_0, _empty_0) {
  if (_empty_0) {
    return _fallback_0;
  } else {
    return _raw_0;
  }
}
function $skTextOr$(_raw_0, _fallback_0) {
  return run_jump($skTextOr$if$, [_raw_0, _fallback_0, run_loop($String$is_empty$(_raw_0))]);
}
function $skKbdText$(_effective_0, _recording_0) {
  if (_recording_0) {
    return "Gravando…";
  } else {
    return run_jump($skTextOr$, [_effective_0, "Sem atalho"]);
  }
}
function $skKbdEmpty$(_effective_0, _recording_0) {
  if (_recording_0) {
    return false;
  } else {
    return run_jump($String$is_empty$, [_effective_0]);
  }
}
function $skKbdAria$if$(_effective_0, _empty_0) {
  if (_empty_0) {
    return "Sem atalho";
  } else {
    return "Atalho atual: " + _effective_0;
  }
}
function $skKbdAria$(_label_0, _effective_0, _recording_0) {
  if (_recording_0) {
    return "Gravando novo atalho para " + _label_0;
  } else {
    return run_jump($skKbdAria$if$, [_effective_0, run_loop($String$is_empty$(_effective_0))]);
  }
}
function $skLabelNode$(_id_0, _label_0) {
  return run_jump($view$viewEl$, ["span", { $: "Con", ["head"]: run_loop($view$attrClass$("keys-label")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrId$("keys-label-" + _id_0)), ["tail"]: { $: "Nil" } } }, { $: "Con", ["head"]: run_loop($view$viewText$(_label_0)), ["tail"]: { $: "Nil" } }]);
}
function $skKbdNode$(_label_0, _effective_0, _recording_0) {
  return run_jump($view$viewEl$, ["kbd", { $: "Con", ["head"]: run_loop($view$classes$({ $: "Con", ["head"]: run_loop($view$classOn$("keys-kbd", true)), ["tail"]: { $: "Con", ["head"]: run_loop($view$classOn$("empty", run_loop($skKbdEmpty$(_effective_0, _recording_0)))), ["tail"]: { $: "Nil" } } })), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("label", run_loop($skKbdAria$(_label_0, _effective_0, _recording_0)))), ["tail"]: { $: "Nil" } } }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($skKbdText$(_effective_0, _recording_0)))), ["tail"]: { $: "Nil" } }]);
}
function $skNoteNode$(_note_0) {
  return run_jump($view$viewEl$, ["span", { $: "Con", ["head"]: run_loop($view$attrClass$("keys-note")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($skTextOr$(_note_0, "fixo")))), ["tail"]: { $: "Nil" } }]);
}
function $skRecordLabel$(_recording_0) {
  if (_recording_0) {
    return "Cancelar";
  } else {
    return "Gravar";
  }
}
function $skRecordAria$(_label_0, _recording_0) {
  if (_recording_0) {
    return "Cancelar a gravação do atalho de " + _label_0;
  } else {
    return "Gravar novo atalho para " + _label_0;
  }
}
function $skRecordNode$(_id_0, _label_0, _recording_0) {
  return run_jump($view$viewEl$, ["button", { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrClass$("keys-rec")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("role", "rec")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrKey$("keys-rec-" + _id_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("pressed", run_loop($view$boolStr$(_recording_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("label", run_loop($skRecordAria$(_label_0, _recording_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "Record")), ["tail"]: { $: "Nil" } } } } } } } }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($skRecordLabel$(_recording_0)))), ["tail"]: { $: "Nil" } }]);
}
function $skResetNode$(_id_0, _overridden_0) {
  return run_jump($view$viewEl$, ["button", run_loop($view$attrJoin$({ $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrClass$("keys-reset")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("role", "reset")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrKey$("keys-reset-" + _id_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "Reset")), ["tail"]: { $: "Nil" } } } } } }, ["tail"]: { $: "Con", ["head"]: run_loop($view$attrWhen$(run_loop($Bool$not$(_overridden_0)), run_loop($view$attr$("hidden", "")))), ["tail"]: { $: "Nil" } } })), { $: "Con", ["head"]: run_loop($view$viewText$("Resetar")), ["tail"]: { $: "Nil" } }]);
}
function $skRowKids$editable$(_id_0, _label_0, _effective_0, _note_0, _overridden_0, _recording_0, _fixed_0) {
  if (_fixed_0) {
    return { $: "Con", ["head"]: run_loop($skLabelNode$(_id_0, _label_0)), ["tail"]: { $: "Con", ["head"]: run_loop($skKbdNode$(_label_0, _effective_0, _recording_0)), ["tail"]: { $: "Con", ["head"]: run_loop($skNoteNode$(_note_0)), ["tail"]: { $: "Nil" } } } };
  } else {
    return { $: "Con", ["head"]: run_loop($skLabelNode$(_id_0, _label_0)), ["tail"]: { $: "Con", ["head"]: run_loop($skKbdNode$(_label_0, _effective_0, _recording_0)), ["tail"]: { $: "Con", ["head"]: run_loop($skRecordNode$(_id_0, _label_0, _recording_0)), ["tail"]: { $: "Con", ["head"]: run_loop($skResetNode$(_id_0, _overridden_0)), ["tail"]: { $: "Nil" } } } } };
  }
}
function $skRowNode$record$(_row_0, _recording_0) {
  const _id_0 = _row_0["id"];
  const _label_0 = _row_0["label"];
  const _effective_0 = _row_0["effective"];
  const _fixed_0 = _row_0["fixed"];
  const _note_0 = _row_0["note"];
  const _overridden_0 = _row_0["overridden"];
  return run_jump($view$viewKey$, ["div", _id_0, { $: "Con", ["head"]: run_loop($view$classes$({ $: "Con", ["head"]: run_loop($view$classOn$("keys-row", true)), ["tail"]: { $: "Con", ["head"]: run_loop($view$classOn$("recording", _recording_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$classOn$("is-fixed", _fixed_0)), ["tail"]: { $: "Nil" } } } })), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("action", _id_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$attr$("role", "group")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("labelledby", "keys-label-" + _id_0)), ["tail"]: { $: "Nil" } } } } }, run_loop($skRowKids$editable$(_id_0, _label_0, _effective_0, _note_0, _overridden_0, _recording_0, _fixed_0))]);
}
function $skRowNode$(_row_0, _capturing_0) {
  const _id_0 = _row_0["id"];
  const _label_0 = _row_0["label"];
  const _effective_0 = _row_0["effective"];
  const _fixed_0 = _row_0["fixed"];
  const _note_0 = _row_0["note"];
  const _overridden_0 = _row_0["overridden"];
  return run_jump($skRowNode$record$, [{ $: "ShortcutRowFact", ["id"]: _id_0, ["label"]: _label_0, ["effective"]: _effective_0, ["fixed"]: _fixed_0, ["note"]: _note_0, ["overridden"]: _overridden_0 }, run_loop($String$eq$(_id_0, _capturing_0))]);
}
function $skRowNodes$go$(_xs_0, _capturing_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return { $: "Con", ["head"]: run_loop($skRowNode$(_h_0, _capturing_0)), ["tail"]: run_loop($skRowNodes$go$(_t_0, _capturing_0)) };
  }
}
function $skRowNodes$(_xs_0, _capturing_0) {
  return run_jump($skRowNodes$go$, [_xs_0, _capturing_0]);
}
function $skSectionNode$(_section_0, _capturing_0) {
  const _id_0 = _section_0["id"];
  const _title_0 = _section_0["title"];
  const _rows_0 = _section_0["rows"];
  return run_jump($view$viewEl$, ["section", { $: "Con", ["head"]: run_loop($view$attrClass$("keys-group")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("labelledby", _id_0)), ["tail"]: { $: "Nil" } } }, { $: "Con", ["head"]: run_loop($view$viewEl$("h3", { $: "Con", ["head"]: run_loop($view$attrId$(_id_0)), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$(_title_0)), ["tail"]: { $: "Nil" } })), ["tail"]: run_loop($skRowNodes$(_rows_0, _capturing_0)) }]);
}
function $skSectionNodes$go$(_xs_0, _capturing_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return { $: "Con", ["head"]: run_loop($skSectionNode$(_h_0, _capturing_0)), ["tail"]: run_loop($skSectionNodes$go$(_t_0, _capturing_0)) };
  }
}
function $skSectionNodes$(_xs_0, _capturing_0) {
  return run_jump($skSectionNodes$go$, [_xs_0, _capturing_0]);
}
function $skHeadNode$() {
  return run_jump($view$viewEl$, ["div", { $: "Con", ["head"]: run_loop($view$attrClass$("keys-head")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewEl$("h2", { $: "Con", ["head"]: run_loop($view$attrId$("keys-title")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$("Atalhos de teclado")), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("p", { $: "Con", ["head"]: run_loop($view$attrClass$("keys-sub")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$("Clique em Gravar e pressione a combinação nova. Esc cancela a gravação. As escolhas ficam guardadas neste computador.")), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Nil" } } }]);
}
function $skGroupsNode$(_sections_0, _capturing_0) {
  return run_jump($view$viewEl$, ["div", { $: "Con", ["head"]: run_loop($view$attrClass$("keys-groups")), ["tail"]: { $: "Nil" } }, run_loop($skSectionNodes$(_sections_0, _capturing_0))]);
}
function $skStatusKind$(_kind_0, _conflict_0) {
  if (_conflict_0) {
    return "error";
  } else {
    return run_jump($skTextOr$, [_kind_0, "info"]);
  }
}
function $skStatusNode$(_status_0, _kind_0, _conflict_0) {
  return run_jump($view$viewEl$, ["p", { $: "Con", ["head"]: run_loop($view$attrClass$("keys-status")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrId$("keys-status")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attr$("role", "status")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("live", "polite")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("kind", run_loop($skStatusKind$(_kind_0, _conflict_0)))), ["tail"]: { $: "Nil" } } } } } }, run_loop($view$viewWhen$(run_loop($Bool$not$(run_loop($String$is_empty$(_status_0)))), run_loop($view$viewText$(_status_0))))]);
}
function $skFooterNode$(_hasOverrides_0) {
  return run_jump($view$viewEl$, ["menu", { $: "Nil" }, { $: "Con", ["head"]: run_loop($view$viewEl$("button", run_loop($view$attrJoin$({ $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrId$("keys-reset-all")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrKey$("keys-reset-all")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "ResetAll")), ["tail"]: { $: "Nil" } } } } }, ["tail"]: { $: "Con", ["head"]: run_loop($view$attrWhen$(run_loop($Bool$not$(_hasOverrides_0)), run_loop($view$attr$("disabled", "")))), ["tail"]: { $: "Nil" } } })), { $: "Con", ["head"]: run_loop($view$viewText$("Restaurar padrões")), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("button", { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrId$("keys-done")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrKey$("keys-done")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "Done")), ["tail"]: { $: "Nil" } } } } }, { $: "Con", ["head"]: run_loop($view$viewText$("Fechar")), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Nil" } } }]);
}
function $skDialogChildren$(_fact_0) {
  const _open_0 = _fact_0["open"];
  const _capturing_0 = _fact_0["capturing"];
  const _conflict_0 = _fact_0["conflict"];
  const _status_0 = _fact_0["status"];
  const _statusKind_0 = _fact_0["statusKind"];
  const _hasOverrides_0 = _fact_0["hasOverrides"];
  const _sections_0 = _fact_0["sections"];
  return { $: "Con", ["head"]: run_loop($skHeadNode$()), ["tail"]: { $: "Con", ["head"]: run_loop($skGroupsNode$(_sections_0, _capturing_0)), ["tail"]: { $: "Con", ["head"]: run_loop($skStatusNode$(_status_0, _statusKind_0, _conflict_0)), ["tail"]: { $: "Con", ["head"]: run_loop($skFooterNode$(_hasOverrides_0)), ["tail"]: { $: "Nil" } } } } };
}
function $shortcutDialog$(_fact_0) {
  const _open_0 = _fact_0["open"];
  const _capturing_0 = _fact_0["capturing"];
  const _conflict_0 = _fact_0["conflict"];
  const _status_0 = _fact_0["status"];
  const _statusKind_0 = _fact_0["statusKind"];
  const _hasOverrides_0 = _fact_0["hasOverrides"];
  const _sections_0 = _fact_0["sections"];
  return run_jump($view$viewEl$, ["dialog", run_loop($view$attrConcat$({ $: "Con", ["head"]: run_loop($view$attrId$("keys-dialog")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("labelledby", "keys-title")), ["tail"]: { $: "Nil" } } }, run_loop($view$attrWhen$(_open_0, run_loop($view$attr$("open", "")))))), run_loop($skDialogChildren$({ $: "ShortcutDialogFact", ["open"]: _open_0, ["capturing"]: _capturing_0, ["conflict"]: _conflict_0, ["status"]: _status_0, ["statusKind"]: _statusKind_0, ["hasOverrides"]: _hasOverrides_0, ["sections"]: _sections_0 }))]);
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
function $Bool$not$(_b_0) {
  if (!_b_0) {
    return true;
  } else {
    return false;
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
var shortcutview_default = {
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
  skRow: run_lib($skRow$, 6),
  skSection: run_lib($skSection$, 3),
  skDialog: run_lib($skDialog$, 7),
  "skTextOr.if": run_lib($skTextOr$if$, 3),
  skTextOr: run_lib($skTextOr$, 2),
  skKbdText: run_lib($skKbdText$, 2),
  skKbdEmpty: run_lib($skKbdEmpty$, 2),
  "skKbdAria.if": run_lib($skKbdAria$if$, 2),
  skKbdAria: run_lib($skKbdAria$, 3),
  skLabelNode: run_lib($skLabelNode$, 2),
  skKbdNode: run_lib($skKbdNode$, 3),
  skNoteNode: run_lib($skNoteNode$, 1),
  skRecordLabel: run_lib($skRecordLabel$, 1),
  skRecordAria: run_lib($skRecordAria$, 2),
  skRecordNode: run_lib($skRecordNode$, 3),
  skResetNode: run_lib($skResetNode$, 2),
  "skRowKids.editable": run_lib($skRowKids$editable$, 7),
  "skRowNode.record": run_lib($skRowNode$record$, 2),
  skRowNode: run_lib($skRowNode$, 2),
  "skRowNodes.go": run_lib($skRowNodes$go$, 2),
  skRowNodes: run_lib($skRowNodes$, 2),
  skSectionNode: run_lib($skSectionNode$, 2),
  "skSectionNodes.go": run_lib($skSectionNodes$go$, 2),
  skSectionNodes: run_lib($skSectionNodes$, 2),
  skHeadNode: run_lib($skHeadNode$, 0),
  skGroupsNode: run_lib($skGroupsNode$, 2),
  skStatusKind: run_lib($skStatusKind$, 2),
  skStatusNode: run_lib($skStatusNode$, 3),
  skFooterNode: run_lib($skFooterNode$, 1),
  skDialogChildren: run_lib($skDialogChildren$, 1),
  shortcutDialog: run_lib($shortcutDialog$, 1)
};
export {
  shortcutview_default as default
};

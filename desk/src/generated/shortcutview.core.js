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
function $view$attr$(name_0, value_0) {
  return { $: "ViewAttr", ["name"]: name_0, ["value"]: value_0 };
}
function $view$classOn$(name_0, on_0) {
  return { $: "ViewClass", ["name"]: name_0, ["on"]: on_0 };
}
function $view$viewEl$(tag_0, attrs_0, kids_0) {
  return { $: "ViewEl", ["tag"]: tag_0, ["attrs"]: attrs_0, ["kids"]: kids_0 };
}
function $view$viewText$(s_0) {
  return { $: "ViewText", ["text"]: s_0 };
}
function $view$viewKey$(tag_0, key_0, attrs_0, kids_0) {
  return run_jump($view$viewEl$, [tag_0, { $: "Con", ["head"]: { $: "ViewAttr", ["name"]: "key", ["value"]: key_0 }, ["tail"]: attrs_0 }, kids_0]);
}
function $view$tagOf$(n_0) {
  if (n_0.$ === "ViewEl") {
    const tag_0 = n_0.tag;
    const attrs_0 = n_0.attrs;
    const kids_0 = n_0.kids;
    return tag_0;
  } else {
    const text_0 = n_0.text;
    return "";
  }
}
function $view$attrsOf$(n_0) {
  if (n_0.$ === "ViewEl") {
    const tag_0 = n_0.tag;
    const attrs_0 = n_0.attrs;
    const kids_0 = n_0.kids;
    return attrs_0;
  } else {
    const text_0 = n_0.text;
    return { $: "Nil" };
  }
}
function $view$kidsOf$(n_0) {
  if (n_0.$ === "ViewEl") {
    const tag_0 = n_0.tag;
    const attrs_0 = n_0.attrs;
    const kids_0 = n_0.kids;
    return kids_0;
  } else {
    const text_0 = n_0.text;
    return { $: "Nil" };
  }
}
function $view$textOf$(n_0) {
  if (n_0.$ === "ViewEl") {
    const tag_0 = n_0.tag;
    const attrs_0 = n_0.attrs;
    const kids_0 = n_0.kids;
    return "";
  } else {
    const text_0 = n_0.text;
    return text_0;
  }
}
function $view$isEl$(n_0) {
  if (n_0.$ === "ViewEl") {
    const tag_0 = n_0.tag;
    const attrs_0 = n_0.attrs;
    const kids_0 = n_0.kids;
    return true;
  } else {
    const text_0 = n_0.text;
    return false;
  }
}
function $view$isText$(n_0) {
  if (n_0.$ === "ViewEl") {
    const tag_0 = n_0.tag;
    const attrs_0 = n_0.attrs;
    const kids_0 = n_0.kids;
    return false;
  } else {
    const text_0 = n_0.text;
    return true;
  }
}
function $view$attrGet$choose$(av_0, rest_0, same_0) {
  if (same_0) {
    return { $: "Some", ["value"]: av_0 };
  } else {
    return rest_0;
  }
}
function $view$attrGet$go$(attrs_0, name_0) {
  if (attrs_0.$ === "Nil") {
    return { $: "None" };
  } else {
    const _t_0 = attrs_0.head;
    const an_0 = _t_0.name;
    const av_0 = _t_0.value;
    const t_0 = attrs_0.tail;
    return run_jump($view$attrGet$choose$, [av_0, run_loop($view$attrGet$go$(t_0, name_0)), run_loop($String$eq$(an_0, name_0))]);
  }
}
function $view$attrGet$(attrs_0, name_0) {
  return run_jump($view$attrGet$go$, [attrs_0, name_0]);
}
function $view$attrWhen$(cond_0, a_0) {
  if (cond_0) {
    return { $: "Con", ["head"]: a_0, ["tail"]: { $: "Nil" } };
  } else {
    return { $: "Nil" };
  }
}
function $view$attrConcat$(xs_0, ys_0) {
  return run_jump($List$append$, [xs_0, ys_0]);
}
function $view$attrJoin$(xss_0) {
  return run_jump($List$concat$, [xss_0]);
}
function $view$attrId$(value_0) {
  return { $: "ViewAttr", ["name"]: "id", ["value"]: value_0 };
}
function $view$attrClass$(value_0) {
  return { $: "ViewAttr", ["name"]: "class", ["value"]: value_0 };
}
function $view$attrType$(value_0) {
  return { $: "ViewAttr", ["name"]: "type", ["value"]: value_0 };
}
function $view$attrTitle$(value_0) {
  return { $: "ViewAttr", ["name"]: "title", ["value"]: value_0 };
}
function $view$attrKey$(value_0) {
  return { $: "ViewAttr", ["name"]: "key", ["value"]: value_0 };
}
function $view$attrOn$(event_0, handler_0) {
  return { $: "ViewAttr", ["name"]: "on:" + event_0, ["value"]: handler_0 };
}
function $view$attrData$(name_0, value_0) {
  return { $: "ViewAttr", ["name"]: "data-" + name_0, ["value"]: value_0 };
}
function $view$attrAria$(name_0, value_0) {
  return { $: "ViewAttr", ["name"]: "aria-" + name_0, ["value"]: value_0 };
}
function $view$boolStr$(on_0) {
  if (on_0) {
    return "true";
  } else {
    return "false";
  }
}
function $view$attrBool$(name_0, on_0) {
  return { $: "ViewAttr", ["name"]: name_0, ["value"]: run_loop($view$boolStr$(on_0)) };
}
function $view$classAppend$empty$(acc_0, name_0, empty_0) {
  if (empty_0) {
    return name_0;
  } else {
    const x_0 = " " + name_0;
    return acc_0 + x_0;
  }
}
function $view$classAppend$(acc_0, name_0) {
  return run_jump($view$classAppend$empty$, [acc_0, name_0, run_loop($String$is_empty$(acc_0))]);
}
function $view$classNext$emptyName$(name_0, acc_0, emptyName_0) {
  if (emptyName_0) {
    return acc_0;
  } else {
    return run_jump($view$classAppend$, [acc_0, name_0]);
  }
}
function $view$classNext$on$(name_0, on_0, acc_0) {
  if (!on_0) {
    return acc_0;
  } else {
    return run_jump($view$classNext$emptyName$, [name_0, acc_0, run_loop($String$is_empty$(name_0))]);
  }
}
function $view$classValue$go$(xs_0, acc_0) {
  if (xs_0.$ === "Nil") {
    return acc_0;
  } else {
    const _t_0 = xs_0.head;
    const name_0 = _t_0.name;
    const on_0 = _t_0.on;
    const t_0 = xs_0.tail;
    return run_jump($view$classValue$go$, [t_0, run_loop($view$classNext$on$(name_0, on_0, acc_0))]);
  }
}
function $view$classValue$(xs_0) {
  return run_jump($view$classValue$go$, [xs_0, ""]);
}
function $view$classes$(xs_0) {
  return { $: "ViewAttr", ["name"]: "class", ["value"]: run_loop($view$classValue$(xs_0)) };
}
function $view$viewWhen$(cond_0, node_0) {
  if (cond_0) {
    return { $: "Con", ["head"]: node_0, ["tail"]: { $: "Nil" } };
  } else {
    return { $: "Nil" };
  }
}
function $view$viewWhenAll$(cond_0, nodes_0) {
  if (cond_0) {
    return nodes_0;
  } else {
    return { $: "Nil" };
  }
}
function $view$viewConcat$(xs_0, ys_0) {
  return run_jump($List$append$, [xs_0, ys_0]);
}
function $view$viewJoin$(xss_0) {
  return run_jump($List$concat$, [xss_0]);
}
function $view$viewMap$0$(xs_0) {
  if (xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const h_0 = xs_0.head;
    const t_0 = xs_0.tail;
    return { $: "Con", ["head"]: run_loop($view$viewText$(h_0)), ["tail"]: run_loop($view$viewMap$0$(t_0)) };
  }
}
function $view$viewMapText$(xs_0) {
  return run_jump($view$viewMap$0$, [xs_0]);
}
function $view$asTextI$(i_0, s_0) {
  return run_jump($view$viewText$, [s_0]);
}
function $view$viewMapI$go$0$(xs_0, i_0) {
  if (xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const h_0 = xs_0.head;
    const t_0 = xs_0.tail;
    return { $: "Con", ["head"]: run_loop($view$asTextI$(i_0, h_0)), ["tail"]: run_loop($view$viewMapI$go$0$(t_0, nat_chk(i_0 + 1n))) };
  }
}
function $view$viewMapTextI$go$(xs_0, i_0) {
  return run_jump($view$viewMapI$go$0$, [xs_0, i_0]);
}
function $view$viewMapTextI$(xs_0) {
  return run_jump($view$viewMapTextI$go$, [xs_0, 0n]);
}
function $skRow$(id_0, label_0, effective_0, fixed_0, note_0, overridden_0) {
  return { $: "ShortcutRowFact", ["id"]: id_0, ["label"]: label_0, ["effective"]: effective_0, ["fixed"]: fixed_0, ["note"]: note_0, ["overridden"]: overridden_0 };
}
function $skSection$(id_0, title_0, rows_0) {
  return { $: "ShortcutSectionFact", ["id"]: id_0, ["title"]: title_0, ["rows"]: rows_0 };
}
function $skDialog$(open_0, capturing_0, conflict_0, status_0, statusKind_0, hasOverrides_0, sections_0) {
  return { $: "ShortcutDialogFact", ["open"]: open_0, ["capturing"]: capturing_0, ["conflict"]: conflict_0, ["status"]: status_0, ["statusKind"]: statusKind_0, ["hasOverrides"]: hasOverrides_0, ["sections"]: sections_0 };
}
function $skTextOr$if$(raw_0, fallback_0, empty_0) {
  if (empty_0) {
    return fallback_0;
  } else {
    return raw_0;
  }
}
function $skTextOr$(raw_0, fallback_0) {
  return run_jump($skTextOr$if$, [raw_0, fallback_0, run_loop($String$is_empty$(raw_0))]);
}
function $skKbdText$(effective_0, recording_0) {
  if (recording_0) {
    return "Gravando…";
  } else {
    return run_jump($skTextOr$, [effective_0, "Sem atalho"]);
  }
}
function $skKbdEmpty$(effective_0, recording_0) {
  if (recording_0) {
    return false;
  } else {
    return run_jump($String$is_empty$, [effective_0]);
  }
}
function $skKbdAria$if$(effective_0, empty_0) {
  if (empty_0) {
    return "Sem atalho";
  } else {
    return "Atalho atual: " + effective_0;
  }
}
function $skKbdAria$(label_0, effective_0, recording_0) {
  if (recording_0) {
    return "Gravando novo atalho para " + label_0;
  } else {
    return run_jump($skKbdAria$if$, [effective_0, run_loop($String$is_empty$(effective_0))]);
  }
}
function $skLabelNode$(id_0, label_0) {
  return run_jump($view$viewEl$, ["span", { $: "Con", ["head"]: run_loop($view$attrClass$("keys-label")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrId$("keys-label-" + id_0)), ["tail"]: { $: "Nil" } } }, { $: "Con", ["head"]: run_loop($view$viewText$(label_0)), ["tail"]: { $: "Nil" } }]);
}
function $skKbdNode$(label_0, effective_0, recording_0) {
  return run_jump($view$viewEl$, ["kbd", { $: "Con", ["head"]: run_loop($view$classes$({ $: "Con", ["head"]: run_loop($view$classOn$("keys-kbd", true)), ["tail"]: { $: "Con", ["head"]: run_loop($view$classOn$("empty", run_loop($skKbdEmpty$(effective_0, recording_0)))), ["tail"]: { $: "Nil" } } })), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("label", run_loop($skKbdAria$(label_0, effective_0, recording_0)))), ["tail"]: { $: "Nil" } } }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($skKbdText$(effective_0, recording_0)))), ["tail"]: { $: "Nil" } }]);
}
function $skNoteNode$(note_0) {
  return run_jump($view$viewEl$, ["span", { $: "Con", ["head"]: run_loop($view$attrClass$("keys-note")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($skTextOr$(note_0, "fixo")))), ["tail"]: { $: "Nil" } }]);
}
function $skRecordLabel$(recording_0) {
  if (recording_0) {
    return "Cancelar";
  } else {
    return "Gravar";
  }
}
function $skRecordAria$(label_0, recording_0) {
  if (recording_0) {
    return "Cancelar a gravação do atalho de " + label_0;
  } else {
    return "Gravar novo atalho para " + label_0;
  }
}
function $skRecordNode$(id_0, label_0, recording_0) {
  return run_jump($view$viewEl$, ["button", { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrClass$("keys-rec")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("role", "rec")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrKey$("keys-rec-" + id_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("pressed", run_loop($view$boolStr$(recording_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("label", run_loop($skRecordAria$(label_0, recording_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "Record")), ["tail"]: { $: "Nil" } } } } } } } }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($skRecordLabel$(recording_0)))), ["tail"]: { $: "Nil" } }]);
}
function $skResetNode$(id_0, overridden_0) {
  return run_jump($view$viewEl$, ["button", run_loop($view$attrJoin$({ $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrClass$("keys-reset")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("role", "reset")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrKey$("keys-reset-" + id_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "Reset")), ["tail"]: { $: "Nil" } } } } } }, ["tail"]: { $: "Con", ["head"]: run_loop($view$attrWhen$(run_loop($Bool$not$(overridden_0)), run_loop($view$attr$("hidden", "")))), ["tail"]: { $: "Nil" } } })), { $: "Con", ["head"]: run_loop($view$viewText$("Resetar")), ["tail"]: { $: "Nil" } }]);
}
function $skRowKids$editable$(id_0, label_0, effective_0, note_0, overridden_0, recording_0, fixed_0) {
  if (fixed_0) {
    return { $: "Con", ["head"]: run_loop($skLabelNode$(id_0, label_0)), ["tail"]: { $: "Con", ["head"]: run_loop($skKbdNode$(label_0, effective_0, recording_0)), ["tail"]: { $: "Con", ["head"]: run_loop($skNoteNode$(note_0)), ["tail"]: { $: "Nil" } } } };
  } else {
    return { $: "Con", ["head"]: run_loop($skLabelNode$(id_0, label_0)), ["tail"]: { $: "Con", ["head"]: run_loop($skKbdNode$(label_0, effective_0, recording_0)), ["tail"]: { $: "Con", ["head"]: run_loop($skRecordNode$(id_0, label_0, recording_0)), ["tail"]: { $: "Con", ["head"]: run_loop($skResetNode$(id_0, overridden_0)), ["tail"]: { $: "Nil" } } } } };
  }
}
function $skRowNode$record$(row_0, recording_0) {
  const id_0 = row_0.id;
  const label_0 = row_0.label;
  const effective_0 = row_0.effective;
  const fixed_0 = row_0.fixed;
  const note_0 = row_0.note;
  const overridden_0 = row_0.overridden;
  const id_1 = id_0;
  const label_1 = label_0;
  const effective_1 = effective_0;
  const fixed_1 = fixed_0;
  return run_jump($view$viewKey$, ["div", id_1, { $: "Con", ["head"]: run_loop($view$classes$({ $: "Con", ["head"]: run_loop($view$classOn$("keys-row", true)), ["tail"]: { $: "Con", ["head"]: run_loop($view$classOn$("recording", recording_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$classOn$("is-fixed", fixed_1)), ["tail"]: { $: "Nil" } } } })), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("action", id_1)), ["tail"]: { $: "Con", ["head"]: run_loop($view$attr$("role", "group")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("labelledby", "keys-label-" + id_1)), ["tail"]: { $: "Nil" } } } } }, run_loop($skRowKids$editable$(id_1, label_1, effective_1, note_0, overridden_0, recording_0, fixed_1))]);
}
function $skRowNode$(row_0, capturing_0) {
  const id_0 = row_0.id;
  const label_0 = row_0.label;
  const effective_0 = row_0.effective;
  const fixed_0 = row_0.fixed;
  const note_0 = row_0.note;
  const overridden_0 = row_0.overridden;
  const id_1 = id_0;
  const label_1 = label_0;
  const effective_1 = effective_0;
  const note_1 = note_0;
  return run_jump($skRowNode$record$, [{ $: "ShortcutRowFact", ["id"]: id_1, ["label"]: label_1, ["effective"]: effective_1, ["fixed"]: fixed_0, ["note"]: note_1, ["overridden"]: overridden_0 }, run_loop($String$eq$(id_1, capturing_0))]);
}
function $skRowNodes$go$(xs_0, capturing_0) {
  if (xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const h_0 = xs_0.head;
    const t_0 = xs_0.tail;
    return { $: "Con", ["head"]: run_loop($skRowNode$(h_0, capturing_0)), ["tail"]: run_loop($skRowNodes$go$(t_0, capturing_0)) };
  }
}
function $skRowNodes$(xs_0, capturing_0) {
  return run_jump($skRowNodes$go$, [xs_0, capturing_0]);
}
function $skSectionNode$(section_0, capturing_0) {
  const id_0 = section_0.id;
  const title_0 = section_0.title;
  const rows_0 = section_0.rows;
  const id_1 = id_0;
  return run_jump($view$viewEl$, ["section", { $: "Con", ["head"]: run_loop($view$attrClass$("keys-group")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("labelledby", id_1)), ["tail"]: { $: "Nil" } } }, { $: "Con", ["head"]: run_loop($view$viewEl$("h3", { $: "Con", ["head"]: run_loop($view$attrId$(id_1)), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$(title_0)), ["tail"]: { $: "Nil" } })), ["tail"]: run_loop($skRowNodes$(rows_0, capturing_0)) }]);
}
function $skSectionNodes$go$(xs_0, capturing_0) {
  if (xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const h_0 = xs_0.head;
    const t_0 = xs_0.tail;
    return { $: "Con", ["head"]: run_loop($skSectionNode$(h_0, capturing_0)), ["tail"]: run_loop($skSectionNodes$go$(t_0, capturing_0)) };
  }
}
function $skSectionNodes$(xs_0, capturing_0) {
  return run_jump($skSectionNodes$go$, [xs_0, capturing_0]);
}
function $skHeadNode$() {
  return run_jump($view$viewEl$, ["div", { $: "Con", ["head"]: run_loop($view$attrClass$("keys-head")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewEl$("h2", { $: "Con", ["head"]: run_loop($view$attrId$("keys-title")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$("Atalhos de teclado")), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("p", { $: "Con", ["head"]: run_loop($view$attrClass$("keys-sub")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$("Clique em Gravar e pressione a combinação nova. Esc cancela a gravação. As escolhas ficam guardadas neste computador.")), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Nil" } } }]);
}
function $skGroupsNode$(sections_0, capturing_0) {
  return run_jump($view$viewEl$, ["div", { $: "Con", ["head"]: run_loop($view$attrClass$("keys-groups")), ["tail"]: { $: "Nil" } }, run_loop($skSectionNodes$(sections_0, capturing_0))]);
}
function $skStatusKind$(kind_0, conflict_0) {
  if (conflict_0) {
    return "error";
  } else {
    return run_jump($skTextOr$, [kind_0, "info"]);
  }
}
function $skStatusNode$(status_0, kind_0, conflict_0) {
  return run_jump($view$viewEl$, ["p", { $: "Con", ["head"]: run_loop($view$attrClass$("keys-status")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrId$("keys-status")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attr$("role", "status")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("live", "polite")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("kind", run_loop($skStatusKind$(kind_0, conflict_0)))), ["tail"]: { $: "Nil" } } } } } }, run_loop($view$viewWhen$(run_loop($Bool$not$(run_loop($String$is_empty$(status_0)))), run_loop($view$viewText$(status_0))))]);
}
function $skFooterNode$(hasOverrides_0) {
  return run_jump($view$viewEl$, ["menu", { $: "Nil" }, { $: "Con", ["head"]: run_loop($view$viewEl$("button", run_loop($view$attrJoin$({ $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrId$("keys-reset-all")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrKey$("keys-reset-all")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "ResetAll")), ["tail"]: { $: "Nil" } } } } }, ["tail"]: { $: "Con", ["head"]: run_loop($view$attrWhen$(run_loop($Bool$not$(hasOverrides_0)), run_loop($view$attr$("disabled", "")))), ["tail"]: { $: "Nil" } } })), { $: "Con", ["head"]: run_loop($view$viewText$("Restaurar padrões")), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("button", { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrId$("keys-done")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrKey$("keys-done")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "Done")), ["tail"]: { $: "Nil" } } } } }, { $: "Con", ["head"]: run_loop($view$viewText$("Fechar")), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Nil" } } }]);
}
function $skDialogChildren$(fact_0) {
  const open_0 = fact_0.open;
  const capturing_0 = fact_0.capturing;
  const conflict_0 = fact_0.conflict;
  const status_0 = fact_0.status;
  const statusKind_0 = fact_0.statusKind;
  const hasOverrides_0 = fact_0.hasOverrides;
  const sections_0 = fact_0.sections;
  const capturing_1 = capturing_0;
  const conflict_1 = conflict_0;
  const status_1 = status_0;
  const statusKind_1 = statusKind_0;
  const hasOverrides_1 = hasOverrides_0;
  const sections_1 = sections_0;
  return { $: "Con", ["head"]: run_loop($skHeadNode$()), ["tail"]: { $: "Con", ["head"]: run_loop($skGroupsNode$(sections_1, capturing_1)), ["tail"]: { $: "Con", ["head"]: run_loop($skStatusNode$(status_1, statusKind_1, conflict_1)), ["tail"]: { $: "Con", ["head"]: run_loop($skFooterNode$(hasOverrides_1)), ["tail"]: { $: "Nil" } } } } };
}
function $shortcutDialog$(fact_0) {
  const open_0 = fact_0.open;
  const capturing_0 = fact_0.capturing;
  const conflict_0 = fact_0.conflict;
  const status_0 = fact_0.status;
  const statusKind_0 = fact_0.statusKind;
  const hasOverrides_0 = fact_0.hasOverrides;
  const sections_0 = fact_0.sections;
  const open_1 = open_0;
  const capturing_1 = capturing_0;
  const conflict_1 = conflict_0;
  const status_1 = status_0;
  const statusKind_1 = statusKind_0;
  const hasOverrides_1 = hasOverrides_0;
  const sections_1 = sections_0;
  return run_jump($view$viewEl$, ["dialog", run_loop($view$attrConcat$({ $: "Con", ["head"]: run_loop($view$attrId$("keys-dialog")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("labelledby", "keys-title")), ["tail"]: { $: "Nil" } } }, run_loop($view$attrWhen$(open_1, run_loop($view$attr$("open", "")))))), run_loop($skDialogChildren$({ $: "ShortcutDialogFact", ["open"]: open_1, ["capturing"]: capturing_1, ["conflict"]: conflict_1, ["status"]: status_1, ["statusKind"]: statusKind_1, ["hasOverrides"]: hasOverrides_1, ["sections"]: sections_1 }))]);
}
function $String$eq$(a_0, b_0) {
  return run_jump($String$eq$fin$, [run_loop($String$cmp$(a_0, b_0))]);
}
function $List$append$(xs_0, ys_0) {
  if (xs_0.$ === "Nil") {
    return ys_0;
  } else {
    const h_0 = xs_0.head;
    const t_0 = xs_0.tail;
    return { $: "Con", ["head"]: h_0, ["tail"]: run_loop($List$append$(t_0, ys_0)) };
  }
}
function $List$concat$(xss_0) {
  if (xss_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const h_0 = xss_0.head;
    const t_0 = xss_0.tail;
    return run_jump($List$append$, [h_0, run_loop($List$concat$(t_0))]);
  }
}
function $String$is_empty$(s_0) {
  if (s_0 === "") {
    return true;
  } else {
    const h_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(0, 2) : s_0[0];
    const t_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(2) : s_0.slice(1);
    return false;
  }
}
function $Bool$not$(b_0) {
  if (!b_0) {
    return true;
  } else {
    return false;
  }
}
function $String$eq$fin$(r_0) {
  const _t_0 = r_0.fst;
  const a2_0 = _t_0.fst;
  const b2_0 = _t_0.snd;
  const c_0 = r_0.snd;
  return run_jump($Cmp$is_eq$, [c_0]);
}
function $String$cmp$(a_0, b_0) {
  if (a_0 === "") {
    if (b_0 === "") {
      return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: "", ["snd"]: "" }, ["snd"]: { $: "EQ" } };
    } else {
      const h_0 = b_0.codePointAt(0) > 65535 ? b_0.slice(0, 2) : b_0[0];
      const t_0 = b_0.codePointAt(0) > 65535 ? b_0.slice(2) : b_0.slice(1);
      return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: "", ["snd"]: h_0 + t_0 }, ["snd"]: { $: "LT" } };
    }
  } else {
    const h_1 = a_0.codePointAt(0) > 65535 ? a_0.slice(0, 2) : a_0[0];
    const t_1 = a_0.codePointAt(0) > 65535 ? a_0.slice(2) : a_0.slice(1);
    if (b_0 === "") {
      return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: h_1 + t_1, ["snd"]: "" }, ["snd"]: { $: "GT" } };
    } else {
      const h2_0 = b_0.codePointAt(0) > 65535 ? b_0.slice(0, 2) : b_0[0];
      const t2_0 = b_0.codePointAt(0) > 65535 ? b_0.slice(2) : b_0.slice(1);
      return run_jump($String$cmp$fin$, [t_1, t2_0, run_loop($Char$cmp$(h_1, h2_0))]);
    }
  }
}
function $Cmp$is_eq$(c_0) {
  if (c_0.$ === "LT") {
    return false;
  } else if (c_0.$ === "EQ") {
    return true;
  } else {
    return false;
  }
}
function $String$cmp$fin$(t1_0, t2_0, hc_0) {
  const _t_0 = hc_0.fst;
  const h1b_0 = _t_0.fst;
  const h2b_0 = _t_0.snd;
  const _t_1 = hc_0.snd;
  if (_t_1.$ === "LT") {
    return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: h1b_0 + t1_0, ["snd"]: h2b_0 + t2_0 }, ["snd"]: { $: "LT" } };
  } else if (_t_1.$ === "EQ") {
    return run_jump($String$cmp$rec$, [h1b_0, h2b_0, run_loop($String$cmp$(t1_0, t2_0))]);
  } else {
    return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: h1b_0 + t1_0, ["snd"]: h2b_0 + t2_0 }, ["snd"]: { $: "GT" } };
  }
}
function $Char$cmp$(a_0, b_0) {
  const x_0 = a_0.codePointAt(0);
  const y_0 = b_0.codePointAt(0);
  const x_1 = x_0;
  const y_1 = y_0;
  return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: char_new(x_1), ["snd"]: char_new(y_1) }, ["snd"]: cmp_new(x_1, y_1) };
}
function $String$cmp$rec$(h1b_0, h2b_0, rr_0) {
  const _t_0 = rr_0.fst;
  const t1b_0 = _t_0.fst;
  const t2b_0 = _t_0.snd;
  const r_0 = rr_0.snd;
  return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: h1b_0 + t1b_0, ["snd"]: h2b_0 + t2b_0 }, ["snd"]: r_0 };
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
  "view.viewMap~0": run_lib($view$viewMap$0$, 1),
  "view.viewMapText": run_lib($view$viewMapText$, 1),
  "view.asTextI": run_lib($view$asTextI$, 2),
  "view.viewMapI.go~0": run_lib($view$viewMapI$go$0$, 2),
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

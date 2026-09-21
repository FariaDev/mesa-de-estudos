// GERADO de core/dialogsview.bend por `bun core/build.mjs` — não editar à mão.
// core/dialogsview.bend
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
function $textOr$if$(raw_0, fallback_0, empty_0) {
  if (empty_0) {
    return fallback_0;
  } else {
    return raw_0;
  }
}
function $textOr$(raw_0, fallback_0) {
  return run_jump($textOr$if$, [raw_0, fallback_0, run_loop($String$is_empty$(raw_0))]);
}
function $lastPartFrom$(m_0) {
  if (m_0.$ === "None") {
    return "";
  } else {
    const h_0 = m_0.value;
    return h_0;
  }
}
function $lastPart$(xs_0) {
  return run_jump($lastPartFrom$, [run_loop($List$last$(xs_0))]);
}
function $fileBase$(path_0) {
  return run_jump($lastPart$, [run_loop($String$split$(run_loop($lastPart$(run_loop($String$split$(path_0, "/")))), "\\"))]);
}
function $hintAttrs$(hint_0) {
  return run_jump($view$attrWhen$, [run_loop($Bool$not$(run_loop($String$is_empty$(hint_0)))), { $: "ViewAttr", ["name"]: "placeholder", ["value"]: hint_0 }]);
}
function $valueAttr$(value_0) {
  return run_jump($view$attrWhen$, [run_loop($Bool$not$(run_loop($String$is_empty$(value_0)))), { $: "ViewAttr", ["name"]: "value", ["value"]: value_0 }]);
}
function $labelAria$(label_0) {
  return run_jump($view$attrWhen$, [run_loop($Bool$not$(run_loop($String$is_empty$(label_0)))), run_loop($view$attrAria$("label", label_0))]);
}
function $textareaKids$if$(value_0, empty_0) {
  if (empty_0) {
    return { $: "Nil" };
  } else {
    return { $: "Con", ["head"]: run_loop($view$viewText$(value_0)), ["tail"]: { $: "Nil" } };
  }
}
function $textareaKids$(value_0) {
  return run_jump($textareaKids$if$, [value_0, run_loop($String$is_empty$(value_0))]);
}
function $optionNode$(selected_0, o_0) {
  const label_0 = o_0.label;
  const value_0 = o_0.value;
  const value_1 = value_0;
  return run_jump($view$viewEl$, ["option", run_loop($view$attrJoin$({ $: "Con", ["head"]: { $: "Con", ["head"]: { $: "ViewAttr", ["name"]: "value", ["value"]: value_1 }, ["tail"]: { $: "Nil" } }, ["tail"]: { $: "Con", ["head"]: run_loop($view$attrWhen$(run_loop($String$eq$(value_1, selected_0)), { $: "ViewAttr", ["name"]: "selected", ["value"]: "" })), ["tail"]: { $: "Nil" } } })), { $: "Con", ["head"]: run_loop($view$viewText$(label_0)), ["tail"]: { $: "Nil" } }]);
}
function $optionNodes$go$(selected_0, xs_0) {
  if (xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const h_0 = xs_0.head;
    const t_0 = xs_0.tail;
    return { $: "Con", ["head"]: run_loop($optionNode$(selected_0, h_0)), ["tail"]: run_loop($optionNodes$go$(selected_0, t_0)) };
  }
}
function $optionNodes$(selected_0, xs_0) {
  return run_jump($optionNodes$go$, [selected_0, xs_0]);
}
function $fieldControl$(f_0) {
  if (f_0.$ === "FieldText") {
    const label_0 = f_0.label;
    const value_0 = f_0.value;
    const hint_0 = f_0.hint;
    const label_1 = label_0;
    const value_1 = value_0;
    const hint_1 = hint_0;
    return run_jump($view$viewEl$, ["input", run_loop($view$attrJoin$({ $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrId$("dialog-value")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrType$("text")), ["tail"]: { $: "Nil" } } }, ["tail"]: { $: "Con", ["head"]: run_loop($labelAria$(label_1)), ["tail"]: { $: "Con", ["head"]: run_loop($valueAttr$(value_1)), ["tail"]: { $: "Con", ["head"]: run_loop($hintAttrs$(hint_1)), ["tail"]: { $: "Nil" } } } } })), { $: "Nil" }]);
  } else if (f_0.$ === "FieldEditor") {
    const label_2 = f_0.label;
    const value_2 = f_0.value;
    const hint_2 = f_0.hint;
    const label_3 = label_2;
    const value_3 = value_2;
    const hint_3 = hint_2;
    return run_jump($view$viewEl$, ["textarea", run_loop($view$attrJoin$({ $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrId$("dialog-value")), ["tail"]: { $: "Nil" } }, ["tail"]: { $: "Con", ["head"]: run_loop($labelAria$(label_3)), ["tail"]: { $: "Con", ["head"]: run_loop($hintAttrs$(hint_3)), ["tail"]: { $: "Nil" } } } })), run_loop($textareaKids$(value_3))]);
  } else if (f_0.$ === "FieldPick") {
    const label_4 = f_0.label;
    const value_4 = f_0.value;
    const options_0 = f_0.options;
    const label_5 = label_4;
    const options_1 = options_0;
    return run_jump($view$viewEl$, ["select", run_loop($view$attrJoin$({ $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrId$("dialog-value")), ["tail"]: { $: "Nil" } }, ["tail"]: { $: "Con", ["head"]: run_loop($labelAria$(label_5)), ["tail"]: { $: "Nil" } } })), run_loop($optionNodes$(value_4, options_1))]);
  } else {
    const label_6 = f_0.label;
    const value_5 = f_0.value;
    const on_0 = f_0.on;
    const label_7 = label_6;
    const value_6 = value_5;
    return run_jump($view$viewEl$, ["label", { $: "Nil" }, { $: "Con", ["head"]: run_loop($view$viewEl$("input", run_loop($view$attrJoin$({ $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrId$("dialog-value")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrType$("checkbox")), ["tail"]: { $: "Nil" } } }, ["tail"]: { $: "Con", ["head"]: run_loop($valueAttr$(value_6)), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrWhen$(on_0, { $: "ViewAttr", ["name"]: "checked", ["value"]: "" })), ["tail"]: { $: "Nil" } } } })), { $: "Nil" })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewText$(label_7)), ["tail"]: { $: "Nil" } } }]);
  }
}
function $piFields$(fs_0) {
  if (fs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const h_0 = fs_0.head;
    const t_0 = fs_0.tail;
    return { $: "Con", ["head"]: run_loop($fieldControl$(h_0)), ["tail"]: run_loop($piFields$(t_0)) };
  }
}
function $piTitle$(raw_0) {
  return run_jump($textOr$, [raw_0, "Pi"]);
}
function $piMessage$(raw_0) {
  return raw_0;
}
function $dialogOkLabel$(raw_0) {
  return run_jump($textOr$, [raw_0, "Continuar"]);
}
function $piOkNode$(label_0) {
  return run_jump($view$viewEl$, ["button", { $: "Con", ["head"]: run_loop($view$attrId$("dialog-ok")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attr$("value", "ok")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrClass$("primary")), ["tail"]: { $: "Nil" } } } }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($dialogOkLabel$(label_0)))), ["tail"]: { $: "Nil" } }]);
}
function $endDayTitle$() {
  return "Encerrar por hoje";
}
function $endDayLead$() {
  return "Salve na conversa um ponto curto para retomar depois.";
}
function $endDayWhereLabel$() {
  return "Onde parei";
}
function $endDayNextLabel$() {
  return "Próximo passo";
}
function $endDayCancelLabel$() {
  return "Cancelar";
}
function $endDaySaveLabel$() {
  return "Salvar na conversa";
}
function $endDayField$(id_0, label_0, value_0) {
  return run_jump($view$viewEl$, ["label", { $: "Nil" }, { $: "Con", ["head"]: run_loop($view$viewText$(label_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("textarea", { $: "Con", ["head"]: run_loop($view$attrId$(id_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$attr$("rows", "2")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attr$("required", "")), ["tail"]: { $: "Nil" } } } }, run_loop($textareaKids$(value_0)))), ["tail"]: { $: "Nil" } } }]);
}
function $endDayActions$() {
  return run_jump($view$viewEl$, ["div", { $: "Con", ["head"]: run_loop($view$attrClass$("dialog-actions")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewEl$("button", { $: "Con", ["head"]: run_loop($view$attr$("value", "cancel")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attr$("formnovalidate", "")), ["tail"]: { $: "Nil" } } }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($endDayCancelLabel$()))), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("button", { $: "Con", ["head"]: run_loop($view$attrId$("end-day-save")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attr$("value", "ok")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrClass$("primary")), ["tail"]: { $: "Nil" } } } }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($endDaySaveLabel$()))), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Nil" } } }]);
}
function $endDayChildren$(whereText_0, nextText_0) {
  return { $: "Con", ["head"]: run_loop($view$viewEl$("h2", { $: "Nil" }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($endDayTitle$()))), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("p", { $: "Con", ["head"]: run_loop($view$attrClass$("help-lead")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($endDayLead$()))), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Con", ["head"]: run_loop($endDayField$("end-where", run_loop($endDayWhereLabel$()), whereText_0)), ["tail"]: { $: "Con", ["head"]: run_loop($endDayField$("end-next", run_loop($endDayNextLabel$()), nextText_0)), ["tail"]: { $: "Con", ["head"]: run_loop($endDayActions$()), ["tail"]: { $: "Nil" } } } } } };
}
function $imageFallback$() {
  return "Imagem";
}
function $imageTitle$(file_0) {
  return run_jump($textOr$, [run_loop($fileBase$(file_0)), run_loop($imageFallback$())]);
}
function $imageTitleNode$(file_0) {
  return run_jump($view$viewText$, [run_loop($imageTitle$(file_0))]);
}
function $imageCopyLabel$() {
  return "Copiar";
}
function $imageOpenLabel$() {
  return "Abrir no Preview";
}
function $imageCloseLabel$() {
  return "Fechar";
}
function $imageActions$(hasFile_0) {
  return { $: "Con", ["head"]: run_loop($view$viewEl$("button", { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrId$("image-copy")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "ImageCopy")), ["tail"]: { $: "Nil" } } } }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($imageCopyLabel$()))), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("button", run_loop($view$attrJoin$({ $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrId$("image-open")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "ImageOpen")), ["tail"]: { $: "Nil" } } } }, ["tail"]: { $: "Con", ["head"]: run_loop($view$attrWhen$(run_loop($Bool$not$(hasFile_0)), { $: "ViewAttr", ["name"]: "hidden", ["value"]: "" })), ["tail"]: { $: "Nil" } } })), { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($imageOpenLabel$()))), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("button", { $: "Con", ["head"]: run_loop($view$attr$("value", "cancel")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrClass$("primary")), ["tail"]: { $: "Nil" } } }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($imageCloseLabel$()))), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Nil" } } } };
}
function $helpVersion$if$(version_0, missing_0) {
  if (missing_0) {
    return "";
  } else {
    return "Mesa de Estudos " + version_0;
  }
}
function $helpVersion$(version_0) {
  return run_jump($helpVersion$if$, [version_0, run_loop($String$is_empty$(version_0))]);
}
function $helpVersionNode$(version_0) {
  return run_jump($view$viewText$, [run_loop($helpVersion$(version_0))]);
}
function $helpFlags$(studyContext_0, endDay_0, refsToggle_0, conferir_0) {
  return { $: "HelpFlags", ["studyContext"]: studyContext_0, ["endDay"]: endDay_0, ["refsToggle"]: refsToggle_0, ["conferir"]: conferir_0 };
}
function $helpChrome$(version_0, flags_0) {
  const studyContext_0 = flags_0.studyContext;
  const endDay_0 = flags_0.endDay;
  const refsToggle_0 = flags_0.refsToggle;
  const conferir_0 = flags_0.conferir;
  return { $: "HelpChrome", ["version"]: run_loop($helpVersion$(version_0)), ["studyHidden"]: run_loop($Bool$not$(studyContext_0)), ["endDayHidden"]: run_loop($Bool$not$(endDay_0)), ["refsHidden"]: run_loop($Bool$not$(refsToggle_0)), ["conferirHidden"]: run_loop($Bool$not$(conferir_0)) };
}
function $aboutLead$if$(version_0, missing_0) {
  if (missing_0) {
    return "";
  } else {
    const x_0 = version_0 + " · licença MIT";
    return "Mesa de Estudos " + x_0;
  }
}
function $aboutLead$(version_0) {
  return run_jump($aboutLead$if$, [version_0, run_loop($String$is_empty$(version_0))]);
}
function $aboutLeadNode$(version_0) {
  return run_jump($view$viewText$, [run_loop($aboutLead$(version_0))]);
}
function $settingsTitle$(first_0) {
  if (first_0) {
    return "Bem-vindo à Mesa de Estudos";
  } else {
    return "Configurações";
  }
}
function $settingsLead$(first_0) {
  if (first_0) {
    return "Escolha a pasta de dados e pelo menos uma matéria (nome + pasta de PDFs). O Pi pede as credenciais na primeira conexão.";
  } else {
    return "Caminhos e nomes desta mesa. As credenciais do modelo continuam no Pi.";
  }
}
function $settingsTitleNode$(first_0) {
  return run_jump($view$viewText$, [run_loop($settingsTitle$(first_0))]);
}
function $settingsLeadNode$(first_0) {
  return run_jump($view$viewText$, [run_loop($settingsLead$(first_0))]);
}
function $emptyCourse$() {
  return { $: "SettingsCourse", ["id"]: "", ["name"]: "", ["path"]: "" };
}
function $courseRow$(course_0) {
  const id_0 = course_0.id;
  const name_0 = course_0.name;
  const path_0 = course_0.path;
  return run_jump($view$viewEl$, ["div", { $: "Con", ["head"]: run_loop($view$attrClass$("cfg-course")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("id", id_0)), ["tail"]: { $: "Nil" } } }, { $: "Con", ["head"]: run_loop($view$viewEl$("input", run_loop($view$attrJoin$({ $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrClass$("cfg-name")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attr$("placeholder", "Nome")), ["tail"]: { $: "Nil" } } }, ["tail"]: { $: "Con", ["head"]: run_loop($valueAttr$(name_0)), ["tail"]: { $: "Nil" } } })), { $: "Nil" })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("input", run_loop($view$attrJoin$({ $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrClass$("cfg-path")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attr$("placeholder", "Pasta dos PDFs")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attr$("spellcheck", "false")), ["tail"]: { $: "Nil" } } } }, ["tail"]: { $: "Con", ["head"]: run_loop($valueAttr$(path_0)), ["tail"]: { $: "Nil" } } })), { $: "Nil" })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("button", { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrClass$("cfg-browse")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "BrowseCourse")), ["tail"]: { $: "Nil" } } } }, { $: "Con", ["head"]: run_loop($view$viewText$("Pasta")), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("button", { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrClass$("cfg-remove icon-btn")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("label", "Remover")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "RemoveCourse")), ["tail"]: { $: "Nil" } } } } }, { $: "Con", ["head"]: run_loop($view$viewText$("×")), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Nil" } } } } }]);
}
function $courseRows$go$(cs_0) {
  if (cs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const h_0 = cs_0.head;
    const t_0 = cs_0.tail;
    return { $: "Con", ["head"]: run_loop($courseRow$(h_0)), ["tail"]: run_loop($courseRows$go$(t_0)) };
  }
}
function $courseRows$(cs_0) {
  if (cs_0.$ === "Nil") {
    return { $: "Con", ["head"]: run_loop($courseRow$(run_loop($emptyCourse$()))), ["tail"]: { $: "Nil" } };
  } else {
    const h_0 = cs_0.head;
    const t_0 = cs_0.tail;
    return { $: "Con", ["head"]: run_loop($courseRow$(h_0)), ["tail"]: run_loop($courseRows$go$(t_0)) };
  }
}
function $welcomeTitle$() {
  return "Bem-vindo à Mesa de Estudos";
}
function $welcomeWorkflowNote$(win32_0) {
  if (win32_0) {
    return "No Windows, o Conferir Xournal++ não existe: cole um print da resolução como anexo e envie com a mensagem.";
  } else {
    return "No macOS, o Conferir Xournal++ anexa a captura da sua resolução no Xournal++ e você envia junto com a mensagem.";
  }
}
function $welcomeBlocks$(win32_0) {
  return { $: "Con", ["head"]: { $: "WelcomeBlock", ["title"]: "O que é a Mesa", ["paras"]: { $: "Con", ["head"]: "A Mesa é a sua bancada de referências: os PDFs do enunciado e do formulário, uma calculadora e o Pi na mesma janela. A escrita à mão continua no Xournal++, do lado — a Mesa não é um canvas de tinta.", ["tail"]: { $: "Con", ["head"]: "Coloque um app em cada monitor, ou os dois lado a lado.", ["tail"]: { $: "Nil" } } } }, ["tail"]: { $: "Con", ["head"]: { $: "WelcomeBlock", ["title"]: "O Pi", ["paras"]: { $: "Con", ["head"]: "O Pi é o motor da conversa: um agente que roda nesta máquina. As credenciais do modelo ficam no Pi, não neste app — ele pede na primeira conexão.", ["tail"]: { $: "Con", ["head"]: "Cada matéria tem a sua conversa, guardada localmente; a Mesa conecta sozinha quando abre.", ["tail"]: { $: "Nil" } } } }, ["tail"]: { $: "Con", ["head"]: { $: "WelcomeBlock", ["title"]: "Customização por agentes", ["paras"]: { $: "Con", ["head"]: "Esta Mesa foi feita para ser customizada por agentes: o AGENTS.md é o contrato e o bloco desk do config.json decide os leitores, os rótulos, qual PDF abre primeiro e o que esconder (calculadora, Xournal++, Conferir, Encerrar).", ["tail"]: { $: "Con", ["head"]: "Os templates TUTOR.md e LEARNER.md ajustam o jeito de o Pi dar aula.", ["tail"]: { $: "Nil" } } } }, ["tail"]: { $: "Con", ["head"]: { $: "WelcomeBlock", ["title"]: "Dicas de uso", ["paras"]: { $: "Con", ["head"]: "Encerrar por hoje registra onde você parou e o próximo passo; o diário do turno e os quizzes aparecem na conversa. O Como usar tem os atalhos todos.", ["tail"]: { $: "Con", ["head"]: run_loop($welcomeWorkflowNote$(win32_0)), ["tail"]: { $: "Nil" } } } }, ["tail"]: { $: "Nil" } } } } };
}
function $paraNode$(text_0) {
  return run_jump($view$viewEl$, ["p", { $: "Nil" }, { $: "Con", ["head"]: run_loop($view$viewText$(text_0)), ["tail"]: { $: "Nil" } }]);
}
function $paraNodes$go$(ps_0) {
  if (ps_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const h_0 = ps_0.head;
    const t_0 = ps_0.tail;
    return { $: "Con", ["head"]: run_loop($paraNode$(h_0)), ["tail"]: run_loop($paraNodes$go$(t_0)) };
  }
}
function $paraNodes$(ps_0) {
  return run_jump($paraNodes$go$, [ps_0]);
}
function $blockNode$(b_0) {
  const title_0 = b_0.title;
  const paras_0 = b_0.paras;
  return run_jump($view$viewEl$, ["section", { $: "Con", ["head"]: run_loop($view$attrClass$("welcome-block")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewEl$("h3", { $: "Nil" }, { $: "Con", ["head"]: run_loop($view$viewText$(title_0)), ["tail"]: { $: "Nil" } })), ["tail"]: run_loop($paraNodes$(paras_0)) }]);
}
function $blockNodes$go$(bs_0) {
  if (bs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const h_0 = bs_0.head;
    const t_0 = bs_0.tail;
    return { $: "Con", ["head"]: run_loop($blockNode$(h_0)), ["tail"]: run_loop($blockNodes$go$(t_0)) };
  }
}
function $blockNodes$(bs_0) {
  return run_jump($blockNodes$go$, [bs_0]);
}
function $blockTitle$(b_0) {
  const title_0 = b_0.title;
  const __0 = b_0.paras;
  return title_0;
}
function $welcomeTitles$go$(bs_0) {
  if (bs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const h_0 = bs_0.head;
    const t_0 = bs_0.tail;
    return { $: "Con", ["head"]: run_loop($blockTitle$(h_0)), ["tail"]: run_loop($welcomeTitles$go$(t_0)) };
  }
}
function $welcomeTitles$(win32_0) {
  return run_jump($welcomeTitles$go$, [run_loop($welcomeBlocks$(win32_0))]);
}
function $welcomeActions$() {
  return run_jump($view$viewEl$, ["div", { $: "Con", ["head"]: run_loop($view$attrClass$("dialog-actions")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewEl$("button", { $: "Con", ["head"]: run_loop($view$attr$("value", "cancel")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$("Agora não")), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("button", { $: "Con", ["head"]: run_loop($view$attrId$("welcome-settings")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrClass$("primary")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "WelcomeConfigure")), ["tail"]: { $: "Nil" } } } } }, { $: "Con", ["head"]: run_loop($view$viewText$("Configurar agora")), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Nil" } } }]);
}
function $welcomeBody$(win32_0) {
  return run_jump($view$viewEl$, ["div", { $: "Con", ["head"]: run_loop($view$attrClass$("help-body")), ["tail"]: { $: "Nil" } }, run_loop($blockNodes$(run_loop($welcomeBlocks$(win32_0))))]);
}
function $welcomeChildren$(win32_0) {
  return { $: "Con", ["head"]: run_loop($view$viewEl$("h2", { $: "Nil" }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($welcomeTitle$()))), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Con", ["head"]: run_loop($welcomeBody$(win32_0)), ["tail"]: { $: "Con", ["head"]: run_loop($welcomeActions$()), ["tail"]: { $: "Nil" } } } };
}
function $checkUpdateLabel$() {
  return "Verificar atualizações";
}
function $updateIdleText$() {
  return "A Mesa verifica atualizações uma vez por dia, sem interromper. Você também pode verificar agora.";
}
function $updateCheckingText$() {
  return "Verificando atualizações…";
}
function $updateNoneText$(current_0) {
  const x_0 = current_0 + ").";
  return "Você está na última versão (v" + x_0;
}
function $updateFailedText$() {
  return "Não foi possível verificar agora. Tente de novo quando quiser.";
}
function $updateReadyPrefix$(version_0) {
  const x_0 = version_0 + " disponível — o que mudou (";
  return "v" + x_0;
}
function $updateReadyJoin$() {
  return ") · ";
}
function $updateNotesLabel$() {
  return "Release notes";
}
function $updateApplyLabel$() {
  return "Atualizar e reiniciar";
}
function $updatePiLabel$() {
  return "Atualizar Pi";
}
function $updateLineNode$(text_0) {
  return run_jump($view$viewEl$, ["p", { $: "Nil" }, { $: "Con", ["head"]: run_loop($view$viewText$(text_0)), ["tail"]: { $: "Nil" } }]);
}
function $releaseNotesButton$(url_0) {
  return run_jump($view$viewEl$, ["button", { $: "Con", ["head"]: run_loop($view$attrId$("update-notes")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "OpenLink")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("url", url_0)), ["tail"]: { $: "Nil" } } } } }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($updateNotesLabel$()))), ["tail"]: { $: "Nil" } }]);
}
function $applyUpdateButton$() {
  return run_jump($view$viewEl$, ["button", { $: "Con", ["head"]: run_loop($view$attrId$("update-apply")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrClass$("primary")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "ApplyUpdate")), ["tail"]: { $: "Nil" } } } } }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($updateApplyLabel$()))), ["tail"]: { $: "Nil" } }]);
}
function $checkUpdateButton$() {
  return run_jump($view$viewEl$, ["button", { $: "Con", ["head"]: run_loop($view$attrId$("update-check")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "CheckUpdate")), ["tail"]: { $: "Nil" } } } }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($checkUpdateLabel$()))), ["tail"]: { $: "Nil" } }]);
}
function $updateReadyLine$(version_0, url_0) {
  return run_jump($view$viewEl$, ["div", { $: "Con", ["head"]: run_loop($view$attrClass$("update-line")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($updateReadyPrefix$(version_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($releaseNotesButton$(url_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($updateReadyJoin$()))), ["tail"]: { $: "Con", ["head"]: run_loop($applyUpdateButton$()), ["tail"]: { $: "Nil" } } } } }]);
}
function $updateNotesNode$(notes_0) {
  return run_jump($view$viewEl$, ["p", { $: "Con", ["head"]: run_loop($view$attrClass$("update-notes")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$(notes_0)), ["tail"]: { $: "Nil" } }]);
}
function $aboutUpdateChildren$(s_0) {
  if (s_0.$ === "UpdateIdle") {
    return { $: "Con", ["head"]: run_loop($updateLineNode$(run_loop($updateIdleText$()))), ["tail"]: { $: "Con", ["head"]: run_loop($checkUpdateButton$()), ["tail"]: { $: "Nil" } } };
  } else if (s_0.$ === "UpdateChecking") {
    return { $: "Con", ["head"]: run_loop($updateLineNode$(run_loop($updateCheckingText$()))), ["tail"]: { $: "Nil" } };
  } else if (s_0.$ === "UpdateNone") {
    const current_0 = s_0.current;
    return { $: "Con", ["head"]: run_loop($updateLineNode$(run_loop($updateNoneText$(current_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($checkUpdateButton$()), ["tail"]: { $: "Nil" } } };
  } else if (s_0.$ === "UpdateReady") {
    const version_0 = s_0.version;
    const notes_0 = s_0.notes;
    const url_0 = s_0.url;
    return { $: "Con", ["head"]: run_loop($updateReadyLine$(version_0, url_0)), ["tail"]: { $: "Con", ["head"]: run_loop($updateNotesNode$(notes_0)), ["tail"]: { $: "Nil" } } };
  } else {
    return { $: "Con", ["head"]: run_loop($updateLineNode$(run_loop($updateFailedText$()))), ["tail"]: { $: "Con", ["head"]: run_loop($checkUpdateButton$()), ["tail"]: { $: "Nil" } } };
  }
}
function $componentIds$() {
  return { $: "Con", ["head"]: "mesa", ["tail"]: { $: "Con", ["head"]: "pi", ["tail"]: { $: "Con", ["head"]: "node", ["tail"]: { $: "Con", ["head"]: "xournal", ["tail"]: { $: "Nil" } } } } };
}
function $componentStateText$(s_0) {
  if (s_0.$ === "CompOk") {
    return "✓";
  } else if (s_0.$ === "CompUnknown") {
    return "desconhecido";
  } else if (s_0.$ === "CompOutdated") {
    const latest_0 = s_0.latest;
    const x_0 = latest_0 + " disponível";
    return "→ v" + x_0;
  } else {
    const note_0 = s_0.note;
    return note_0;
  }
}
function $componentVersionText$(version_0) {
  return run_jump($textOr$, [version_0, "—"]);
}
function $componentLinkLabel$(label_0) {
  return run_jump($textOr$, [label_0, "Ver página"]);
}
function $nodeTooOld$(major_0, minor_0) {
  const x_0 = major_0 < 22;
  const x_1 = run_loop($Bool$and$(major_0 === 22, minor_0 < 19));
  return x_0 || x_1;
}
function $nodeWarnText$() {
  return "abaixo de 22.19 — o Pi exige Node 22.19+";
}
function $nodeState$if$(old_0) {
  if (old_0) {
    return { $: "CompWarn", ["note"]: run_loop($nodeWarnText$()) };
  } else {
    return { $: "CompOk" };
  }
}
function $nodeState$(major_0, minor_0) {
  return run_jump($nodeState$if$, [run_loop($nodeTooOld$(major_0, minor_0))]);
}
function $updatePiButton$() {
  return run_jump($view$viewEl$, ["button", { $: "Con", ["head"]: run_loop($view$attrId$("update-pi")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrClass$("component-update")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "UpdatePi")), ["tail"]: { $: "Nil" } } } } }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($updatePiLabel$()))), ["tail"]: { $: "Nil" } }]);
}
function $componentLinkButton$(url_0, label_0) {
  return run_jump($view$viewEl$, ["button", { $: "Con", ["head"]: run_loop($view$attrClass$("component-link")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "OpenLink")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("url", url_0)), ["tail"]: { $: "Nil" } } } } }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($componentLinkLabel$(label_0)))), ["tail"]: { $: "Nil" } }]);
}
function $componentHintNode$(hint_0) {
  return run_jump($view$viewEl$, ["small", { $: "Con", ["head"]: run_loop($view$attrClass$("component-hint")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$(hint_0)), ["tail"]: { $: "Nil" } }]);
}
function $componentRowNode$(r_0) {
  const id_0 = r_0.id;
  const label_0 = r_0.label;
  const version_0 = r_0.version;
  const state_0 = r_0.state;
  const hint_0 = r_0.hint;
  const link_0 = r_0.link;
  const linkLabel_0 = r_0.linkLabel;
  const canUpdate_0 = r_0.canUpdate;
  const hint_1 = hint_0;
  const link_1 = link_0;
  const linkLabel_1 = linkLabel_0;
  const canUpdate_1 = canUpdate_0;
  return run_jump($view$viewEl$, ["div", { $: "Con", ["head"]: run_loop($view$attrClass$("component-row")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("id", id_0)), ["tail"]: { $: "Nil" } } }, run_loop($view$viewJoin$({ $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$viewEl$("span", { $: "Con", ["head"]: run_loop($view$attrClass$("component-name")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$(label_0)), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("span", { $: "Con", ["head"]: run_loop($view$attrClass$("component-version")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($componentVersionText$(version_0)))), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("span", { $: "Con", ["head"]: run_loop($view$attrClass$("component-state")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($componentStateText$(state_0)))), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Nil" } } } }, ["tail"]: { $: "Con", ["head"]: run_loop($view$viewWhen$(run_loop($Bool$not$(run_loop($String$is_empty$(hint_1)))), run_loop($componentHintNode$(hint_1)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewWhen$(run_loop($Bool$not$(run_loop($String$is_empty$(link_1)))), run_loop($componentLinkButton$(link_1, linkLabel_1)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewWhen$(canUpdate_1, run_loop($updatePiButton$()))), ["tail"]: { $: "Nil" } } } } }))]);
}
function $componentRows$go$(rs_0) {
  if (rs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const h_0 = rs_0.head;
    const t_0 = rs_0.tail;
    return { $: "Con", ["head"]: run_loop($componentRowNode$(h_0)), ["tail"]: run_loop($componentRows$go$(t_0)) };
  }
}
function $componentRows$(rs_0) {
  return run_jump($componentRows$go$, [rs_0]);
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
function $List$last$(xs_0) {
  if (xs_0.$ === "Nil") {
    return { $: "None" };
  } else {
    const h_0 = xs_0.head;
    const t_0 = xs_0.tail;
    return { $: "Some", ["value"]: run_loop($List$last$go$(t_0, h_0)) };
  }
}
function $String$split$(s_0, sep_0) {
  if (s_0 === "") {
    return { $: "Con", ["head"]: "", ["tail"]: { $: "Nil" } };
  } else {
    const h_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(0, 2) : s_0[0];
    const t_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(2) : s_0.slice(1);
    const h_1 = h_0;
    return run_jump($String$split$fin$, [h_1, run_loop($String$split$(t_0, sep_0)), run_loop($Char$is_eq$(h_1, sep_0))]);
  }
}
function $Bool$not$(b_0) {
  if (!b_0) {
    return true;
  } else {
    return false;
  }
}
function $Bool$and$(a_0, b_0) {
  if (!a_0) {
    return false;
  } else {
    return b_0;
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
function $List$last$go$(xs_0, last_0) {
  if (xs_0.$ === "Nil") {
    return last_0;
  } else {
    const h_0 = xs_0.head;
    const t_0 = xs_0.tail;
    return run_jump($List$last$go$, [t_0, h_0]);
  }
}
function $String$split$fin$(c_0, r_0, cut_0) {
  if (!cut_0) {
    return run_jump($String$split$push$, [c_0, r_0]);
  } else {
    return { $: "Con", ["head"]: "", ["tail"]: r_0 };
  }
}
function $Char$is_eq$(a_0, b_0) {
  const x_0 = a_0.codePointAt(0);
  const y_0 = b_0.codePointAt(0);
  return x_0 === y_0;
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
function $String$split$push$(c_0, ps_0) {
  if (ps_0.$ === "Nil") {
    return { $: "Con", ["head"]: c_0 + "", ["tail"]: { $: "Nil" } };
  } else {
    const h_0 = ps_0.head;
    const t_0 = ps_0.tail;
    return { $: "Con", ["head"]: c_0 + h_0, ["tail"]: t_0 };
  }
}
function $String$cmp$rec$(h1b_0, h2b_0, rr_0) {
  const _t_0 = rr_0.fst;
  const t1b_0 = _t_0.fst;
  const t2b_0 = _t_0.snd;
  const r_0 = rr_0.snd;
  return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: h1b_0 + t1b_0, ["snd"]: h2b_0 + t2b_0 }, ["snd"]: r_0 };
}
var dialogsview_default = {
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
  "textOr.if": run_lib($textOr$if$, 3),
  textOr: run_lib($textOr$, 2),
  lastPartFrom: run_lib($lastPartFrom$, 1),
  lastPart: run_lib($lastPart$, 1),
  fileBase: run_lib($fileBase$, 1),
  hintAttrs: run_lib($hintAttrs$, 1),
  valueAttr: run_lib($valueAttr$, 1),
  labelAria: run_lib($labelAria$, 1),
  "textareaKids.if": run_lib($textareaKids$if$, 2),
  textareaKids: run_lib($textareaKids$, 1),
  optionNode: run_lib($optionNode$, 2),
  "optionNodes.go": run_lib($optionNodes$go$, 2),
  optionNodes: run_lib($optionNodes$, 2),
  fieldControl: run_lib($fieldControl$, 1),
  piFields: run_lib($piFields$, 1),
  piTitle: run_lib($piTitle$, 1),
  piMessage: run_lib($piMessage$, 1),
  dialogOkLabel: run_lib($dialogOkLabel$, 1),
  piOkNode: run_lib($piOkNode$, 1),
  endDayTitle: run_lib($endDayTitle$, 0),
  endDayLead: run_lib($endDayLead$, 0),
  endDayWhereLabel: run_lib($endDayWhereLabel$, 0),
  endDayNextLabel: run_lib($endDayNextLabel$, 0),
  endDayCancelLabel: run_lib($endDayCancelLabel$, 0),
  endDaySaveLabel: run_lib($endDaySaveLabel$, 0),
  endDayField: run_lib($endDayField$, 3),
  endDayActions: run_lib($endDayActions$, 0),
  endDayChildren: run_lib($endDayChildren$, 2),
  imageFallback: run_lib($imageFallback$, 0),
  imageTitle: run_lib($imageTitle$, 1),
  imageTitleNode: run_lib($imageTitleNode$, 1),
  imageCopyLabel: run_lib($imageCopyLabel$, 0),
  imageOpenLabel: run_lib($imageOpenLabel$, 0),
  imageCloseLabel: run_lib($imageCloseLabel$, 0),
  imageActions: run_lib($imageActions$, 1),
  "helpVersion.if": run_lib($helpVersion$if$, 2),
  helpVersion: run_lib($helpVersion$, 1),
  helpVersionNode: run_lib($helpVersionNode$, 1),
  helpFlags: run_lib($helpFlags$, 4),
  helpChrome: run_lib($helpChrome$, 2),
  "aboutLead.if": run_lib($aboutLead$if$, 2),
  aboutLead: run_lib($aboutLead$, 1),
  aboutLeadNode: run_lib($aboutLeadNode$, 1),
  settingsTitle: run_lib($settingsTitle$, 1),
  settingsLead: run_lib($settingsLead$, 1),
  settingsTitleNode: run_lib($settingsTitleNode$, 1),
  settingsLeadNode: run_lib($settingsLeadNode$, 1),
  emptyCourse: run_lib($emptyCourse$, 0),
  courseRow: run_lib($courseRow$, 1),
  "courseRows.go": run_lib($courseRows$go$, 1),
  courseRows: run_lib($courseRows$, 1),
  welcomeTitle: run_lib($welcomeTitle$, 0),
  welcomeWorkflowNote: run_lib($welcomeWorkflowNote$, 1),
  welcomeBlocks: run_lib($welcomeBlocks$, 1),
  paraNode: run_lib($paraNode$, 1),
  "paraNodes.go": run_lib($paraNodes$go$, 1),
  paraNodes: run_lib($paraNodes$, 1),
  blockNode: run_lib($blockNode$, 1),
  "blockNodes.go": run_lib($blockNodes$go$, 1),
  blockNodes: run_lib($blockNodes$, 1),
  blockTitle: run_lib($blockTitle$, 1),
  "welcomeTitles.go": run_lib($welcomeTitles$go$, 1),
  welcomeTitles: run_lib($welcomeTitles$, 1),
  welcomeActions: run_lib($welcomeActions$, 0),
  welcomeBody: run_lib($welcomeBody$, 1),
  welcomeChildren: run_lib($welcomeChildren$, 1),
  checkUpdateLabel: run_lib($checkUpdateLabel$, 0),
  updateIdleText: run_lib($updateIdleText$, 0),
  updateCheckingText: run_lib($updateCheckingText$, 0),
  updateNoneText: run_lib($updateNoneText$, 1),
  updateFailedText: run_lib($updateFailedText$, 0),
  updateReadyPrefix: run_lib($updateReadyPrefix$, 1),
  updateReadyJoin: run_lib($updateReadyJoin$, 0),
  updateNotesLabel: run_lib($updateNotesLabel$, 0),
  updateApplyLabel: run_lib($updateApplyLabel$, 0),
  updatePiLabel: run_lib($updatePiLabel$, 0),
  updateLineNode: run_lib($updateLineNode$, 1),
  releaseNotesButton: run_lib($releaseNotesButton$, 1),
  applyUpdateButton: run_lib($applyUpdateButton$, 0),
  checkUpdateButton: run_lib($checkUpdateButton$, 0),
  updateReadyLine: run_lib($updateReadyLine$, 2),
  updateNotesNode: run_lib($updateNotesNode$, 1),
  aboutUpdateChildren: run_lib($aboutUpdateChildren$, 1),
  componentIds: run_lib($componentIds$, 0),
  componentStateText: run_lib($componentStateText$, 1),
  componentVersionText: run_lib($componentVersionText$, 1),
  componentLinkLabel: run_lib($componentLinkLabel$, 1),
  nodeTooOld: run_lib($nodeTooOld$, 2),
  nodeWarnText: run_lib($nodeWarnText$, 0),
  "nodeState.if": run_lib($nodeState$if$, 1),
  nodeState: run_lib($nodeState$, 2),
  updatePiButton: run_lib($updatePiButton$, 0),
  componentLinkButton: run_lib($componentLinkButton$, 2),
  componentHintNode: run_lib($componentHintNode$, 1),
  componentRowNode: run_lib($componentRowNode$, 1),
  "componentRows.go": run_lib($componentRows$go$, 1),
  componentRows: run_lib($componentRows$, 1)
};
export {
  dialogsview_default as default
};

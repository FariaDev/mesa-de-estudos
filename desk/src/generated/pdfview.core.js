// GERADO de core/pdfview.bend por `bun core/build.mjs` — não editar à mão.
// core/pdfview.bend
function cmp_new(a, b) {
  return { $: a < b ? "LT" : a === b ? "EQ" : "GT" };
}
function nat_divmod(a, b) {
  return b === 0n ? { $: "Tuple", fst: 0n, snd: a } : { $: "Tuple", fst: a / b, snd: a % b };
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
function $modeContinuous$() {
  return "rolagem contínua";
}
function $placeholderText$() {
  return "Escolha um PDF da biblioteca ou abra um arquivo local.";
}
function $footLoadingText$() {
  return "Carregando…";
}
function $footErrorText$() {
  return "Não foi possível abrir o PDF.";
}
function $pageTotalDash$() {
  return "/ —";
}
function $gridFlags$(selfMin_0, otherMin_0) {
  if (!selfMin_0) {
    if (!otherMin_0) {
      return { $: "GridFlags", ["otherMin"]: false, ["hasMin"]: false, ["hasOtherMin"]: false };
    } else {
      return { $: "GridFlags", ["otherMin"]: true, ["hasMin"]: true, ["hasOtherMin"]: false };
    }
  } else {
    if (!otherMin_0) {
      return { $: "GridFlags", ["otherMin"]: false, ["hasMin"]: true, ["hasOtherMin"]: true };
    } else {
      return { $: "GridFlags", ["otherMin"]: false, ["hasMin"]: true, ["hasOtherMin"]: false };
    }
  }
}
function $panelFlags$(minimized_0, pinned_0) {
  return { $: "PanelFlags", ["minimized"]: minimized_0, ["pinned"]: pinned_0 };
}
function $navChrome$(hasDoc_0, atFirst_0, atLast_0) {
  if (!hasDoc_0) {
    return { $: "NavChrome", ["prevDisabled"]: true, ["nextDisabled"]: true };
  } else {
    return { $: "NavChrome", ["prevDisabled"]: atFirst_0, ["nextDisabled"]: atLast_0 };
  }
}
function $collapseTitle$(minimized_0) {
  if (minimized_0) {
    return "Restaurar este leitor";
  } else {
    return "Minimizar este leitor";
  }
}
function $disabledAttr$(on_0) {
  return run_jump($view$attrWhen$, [on_0, run_loop($view$attr$("disabled", "disabled"))]);
}
function $pageNumberValue$(page_0) {
  return run_jump($Nat$show$, [page_0]);
}
function $pageNumberMax$(total_0) {
  return run_jump($Nat$show$, [total_0]);
}
function $pageTotalText$(n_0) {
  const x_0 = run_loop($Nat$show$(n_0));
  return "/ " + x_0;
}
function $zoomLabelText$(pct_0) {
  const x_0 = run_loop($Nat$show$(pct_0));
  return x_0 + "%";
}
function $footReadyText$(page_0, total_0, mode_0, file_0) {
  const x_0 = " · " + file_0;
  const x_1 = mode_0 + x_0;
  const x_2 = run_loop($Nat$show$(total_0));
  const x_3 = " · " + x_1;
  const x_4 = x_2 + x_3;
  const x_5 = run_loop($Nat$show$(page_0));
  const x_6 = " de " + x_4;
  const x_7 = x_5 + x_6;
  return "Página " + x_7;
}
function $findCountChrome$shown$(shown_0, index_0, total_0) {
  if (shown_0) {
    const x_0 = run_loop($Nat$show$(total_0));
    const x_1 = run_loop($Nat$show$(index_0));
    const x_2 = "/" + x_0;
    return { $: "CountChrome", ["hidden"]: false, ["text"]: x_1 + x_2 };
  } else {
    const x_3 = run_loop($Nat$show$(total_0));
    return { $: "CountChrome", ["hidden"]: false, ["text"]: x_3 + " ocorrências" };
  }
}
function $findCountChrome$(hidden_0, shown_0, index_0, total_0) {
  if (hidden_0) {
    return { $: "CountChrome", ["hidden"]: true, ["text"]: "" };
  } else {
    return run_jump($findCountChrome$shown$, [shown_0, index_0, total_0]);
  }
}
function $gridClass$(selfMin_0, otherMin_0) {
  if (!selfMin_0) {
    if (!otherMin_0) {
      return run_jump($view$classes$, [{ $: "Con", ["head"]: run_loop($view$classOn$("other-min", false)), ["tail"]: { $: "Con", ["head"]: run_loop($view$classOn$("has-min", false)), ["tail"]: { $: "Con", ["head"]: run_loop($view$classOn$("has-other-min", false)), ["tail"]: { $: "Nil" } } } }]);
    } else {
      return run_jump($view$classes$, [{ $: "Con", ["head"]: run_loop($view$classOn$("other-min", true)), ["tail"]: { $: "Con", ["head"]: run_loop($view$classOn$("has-min", true)), ["tail"]: { $: "Con", ["head"]: run_loop($view$classOn$("has-other-min", false)), ["tail"]: { $: "Nil" } } } }]);
    }
  } else {
    if (!otherMin_0) {
      return run_jump($view$classes$, [{ $: "Con", ["head"]: run_loop($view$classOn$("other-min", false)), ["tail"]: { $: "Con", ["head"]: run_loop($view$classOn$("has-min", true)), ["tail"]: { $: "Con", ["head"]: run_loop($view$classOn$("has-other-min", true)), ["tail"]: { $: "Nil" } } } }]);
    } else {
      return run_jump($view$classes$, [{ $: "Con", ["head"]: run_loop($view$classOn$("other-min", false)), ["tail"]: { $: "Con", ["head"]: run_loop($view$classOn$("has-min", true)), ["tail"]: { $: "Con", ["head"]: run_loop($view$classOn$("has-other-min", false)), ["tail"]: { $: "Nil" } } } }]);
    }
  }
}
function $panelClass$(minimized_0, pinned_0) {
  return run_jump($view$classes$, [{ $: "Con", ["head"]: run_loop($view$classOn$("pdf-panel", true)), ["tail"]: { $: "Con", ["head"]: run_loop($view$classOn$("minimized", minimized_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$classOn$("pinned", pinned_0)), ["tail"]: { $: "Nil" } } } }]);
}
function $label$(s_0) {
  return run_jump($view$viewText$, [s_0]);
}
function $placeholder$() {
  return run_jump($view$viewEl$, ["div", { $: "Con", ["head"]: run_loop($view$attrClass$("pdf-placeholder")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($placeholderText$()))), ["tail"]: { $: "Nil" } }]);
}
function $pageTotalEmpty$() {
  return run_jump($view$viewText$, [run_loop($pageTotalDash$())]);
}
function $pageTotal$(n_0) {
  return run_jump($view$viewText$, [run_loop($pageTotalText$(n_0))]);
}
function $zoomLabel$(pct_0) {
  return run_jump($view$viewText$, [run_loop($zoomLabelText$(pct_0))]);
}
function $footLoading$() {
  return run_jump($view$viewText$, [run_loop($footLoadingText$())]);
}
function $footError$() {
  return run_jump($view$viewText$, [run_loop($footErrorText$())]);
}
function $footReady$(page_0, total_0, mode_0, file_0) {
  return run_jump($view$viewText$, [run_loop($footReadyText$(page_0, total_0, mode_0, file_0))]);
}
function $findCountLabel$(c_0) {
  const hidden_0 = c_0.hidden;
  const text_0 = c_0.text;
  return run_jump($view$viewText$, [text_0]);
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
function $Nat$show$(n_0) {
  const m_0 = n_0;
  return run_jump($Nat$show$fin$, [m_0, "", run_loop($Nat$show$put$(nat_divmod(m_0, 10n)))]);
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
function $Nat$show$fin$(g_0, acc_0, dq_0) {
  const d_0 = dq_0.fst;
  const _t_0 = dq_0.snd;
  if (_t_0 === 0n) {
    return d_0 + acc_0;
  } else {
    const p_0 = _t_0 - 1n;
    return run_jump($Nat$show$go$, [g_0, nat_chk(p_0 + 1n), d_0 + acc_0]);
  }
}
function $Nat$show$put$(qr_0) {
  const q_0 = qr_0.fst;
  const r_0 = qr_0.snd;
  const x_0 = nat_chk(48n + r_0);
  return { $: "Tuple", ["fst"]: char_new(Number(x_0 & 0xFFFFFFFFn)), ["snd"]: q_0 };
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
function $Nat$show$go$(f_0, n_0, acc_0) {
  if (f_0 === 0n) {
    return acc_0;
  } else {
    const g_0 = f_0 - 1n;
    return run_jump($Nat$show$fin$, [g_0, acc_0, run_loop($Nat$show$put$(nat_divmod(n_0, 10n)))]);
  }
}
function $String$cmp$rec$(h1b_0, h2b_0, rr_0) {
  const _t_0 = rr_0.fst;
  const t1b_0 = _t_0.fst;
  const t2b_0 = _t_0.snd;
  const r_0 = rr_0.snd;
  return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: h1b_0 + t1b_0, ["snd"]: h2b_0 + t2b_0 }, ["snd"]: r_0 };
}
var pdfview_default = {
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
  modeContinuous: run_lib($modeContinuous$, 0),
  placeholderText: run_lib($placeholderText$, 0),
  footLoadingText: run_lib($footLoadingText$, 0),
  footErrorText: run_lib($footErrorText$, 0),
  pageTotalDash: run_lib($pageTotalDash$, 0),
  gridFlags: run_lib($gridFlags$, 2),
  panelFlags: run_lib($panelFlags$, 2),
  navChrome: run_lib($navChrome$, 3),
  collapseTitle: run_lib($collapseTitle$, 1),
  disabledAttr: run_lib($disabledAttr$, 1),
  pageNumberValue: run_lib($pageNumberValue$, 1),
  pageNumberMax: run_lib($pageNumberMax$, 1),
  pageTotalText: run_lib($pageTotalText$, 1),
  zoomLabelText: run_lib($zoomLabelText$, 1),
  footReadyText: run_lib($footReadyText$, 4),
  "findCountChrome.shown": run_lib($findCountChrome$shown$, 3),
  findCountChrome: run_lib($findCountChrome$, 4),
  gridClass: run_lib($gridClass$, 2),
  panelClass: run_lib($panelClass$, 2),
  label: run_lib($label$, 1),
  placeholder: run_lib($placeholder$, 0),
  pageTotalEmpty: run_lib($pageTotalEmpty$, 0),
  pageTotal: run_lib($pageTotal$, 1),
  zoomLabel: run_lib($zoomLabel$, 1),
  footLoading: run_lib($footLoading$, 0),
  footError: run_lib($footError$, 0),
  footReady: run_lib($footReady$, 4),
  findCountLabel: run_lib($findCountLabel$, 1)
};
export {
  pdfview_default as default
};

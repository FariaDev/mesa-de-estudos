// GERADO de core/pdfpageview.bend por `bun core/build.mjs` — não editar à mão.
// core/pdfpageview.bend
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
function $pdfview$modeContinuous$() {
  return "rolagem contínua";
}
function $pdfview$placeholderText$() {
  return "Escolha um PDF da biblioteca ou abra um arquivo local.";
}
function $pdfview$footLoadingText$() {
  return "Carregando…";
}
function $pdfview$footErrorText$() {
  return "Não foi possível abrir o PDF.";
}
function $pdfview$pageTotalDash$() {
  return "/ —";
}
function $pdfview$gridFlags$(selfMin_0, otherMin_0) {
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
function $pdfview$panelFlags$(minimized_0, pinned_0) {
  return { $: "PanelFlags", ["minimized"]: minimized_0, ["pinned"]: pinned_0 };
}
function $pdfview$navChrome$(hasDoc_0, atFirst_0, atLast_0) {
  if (!hasDoc_0) {
    return { $: "NavChrome", ["prevDisabled"]: true, ["nextDisabled"]: true };
  } else {
    return { $: "NavChrome", ["prevDisabled"]: atFirst_0, ["nextDisabled"]: atLast_0 };
  }
}
function $pdfview$collapseTitle$(minimized_0) {
  if (minimized_0) {
    return "Restaurar este leitor";
  } else {
    return "Minimizar este leitor";
  }
}
function $pdfview$disabledAttr$(on_0) {
  return run_jump($view$attrWhen$, [on_0, run_loop($view$attr$("disabled", "disabled"))]);
}
function $pdfview$pageNumberValue$(page_0) {
  return run_jump($Nat$show$, [page_0]);
}
function $pdfview$pageNumberMax$(total_0) {
  return run_jump($Nat$show$, [total_0]);
}
function $pdfview$pageTotalText$(n_0) {
  const x_0 = run_loop($Nat$show$(n_0));
  return "/ " + x_0;
}
function $pdfview$zoomLabelText$(pct_0) {
  const x_0 = run_loop($Nat$show$(pct_0));
  return x_0 + "%";
}
function $pdfview$footReadyText$(page_0, total_0, mode_0, file_0) {
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
function $pdfview$findCountChrome$shown$(shown_0, index_0, total_0) {
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
function $pdfview$findCountChrome$(hidden_0, shown_0, index_0, total_0) {
  if (hidden_0) {
    return { $: "CountChrome", ["hidden"]: true, ["text"]: "" };
  } else {
    return run_jump($pdfview$findCountChrome$shown$, [shown_0, index_0, total_0]);
  }
}
function $pdfview$gridClass$(selfMin_0, otherMin_0) {
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
function $pdfview$panelClass$(minimized_0, pinned_0) {
  return run_jump($view$classes$, [{ $: "Con", ["head"]: run_loop($view$classOn$("pdf-panel", true)), ["tail"]: { $: "Con", ["head"]: run_loop($view$classOn$("minimized", minimized_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$classOn$("pinned", pinned_0)), ["tail"]: { $: "Nil" } } } }]);
}
function $pdfview$label$(s_0) {
  return run_jump($view$viewText$, [s_0]);
}
function $pdfview$placeholder$() {
  return run_jump($view$viewEl$, ["div", { $: "Con", ["head"]: run_loop($view$attrClass$("pdf-placeholder")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($pdfview$placeholderText$()))), ["tail"]: { $: "Nil" } }]);
}
function $pdfview$pageTotalEmpty$() {
  return run_jump($view$viewText$, [run_loop($pdfview$pageTotalDash$())]);
}
function $pdfview$pageTotal$(n_0) {
  return run_jump($view$viewText$, [run_loop($pdfview$pageTotalText$(n_0))]);
}
function $pdfview$zoomLabel$(pct_0) {
  return run_jump($view$viewText$, [run_loop($pdfview$zoomLabelText$(pct_0))]);
}
function $pdfview$footLoading$() {
  return run_jump($view$viewText$, [run_loop($pdfview$footLoadingText$())]);
}
function $pdfview$footError$() {
  return run_jump($view$viewText$, [run_loop($pdfview$footErrorText$())]);
}
function $pdfview$footReady$(page_0, total_0, mode_0, file_0) {
  return run_jump($view$viewText$, [run_loop($pdfview$footReadyText$(page_0, total_0, mode_0, file_0))]);
}
function $pdfview$findCountLabel$(c_0) {
  const hidden_0 = c_0.hidden;
  const text_0 = c_0.text;
  return run_jump($view$viewText$, [text_0]);
}
function $emptyOptionLabel$() {
  return "Escolha um PDF…";
}
function $findPlaceholder$() {
  return "Buscar neste PDF…";
}
function $findButtonLabel$() {
  return "Buscar";
}
function $openTitle$() {
  return "Abrir outro PDF";
}
function $findTitle$() {
  return "Buscar";
}
function $shotTitle$() {
  return "Mandar esta página como imagem no chat";
}
function $prevAria$() {
  return "Página anterior";
}
function $nextAria$() {
  return "Próxima página";
}
function $outAria$() {
  return "Diminuir zoom";
}
function $inAria$() {
  return "Aumentar zoom";
}
function $fitTitle$() {
  return "Ajustar à largura";
}
function $invertTitle$() {
  return "Inverter cores da página (tema escuro)";
}
function $invertAria$() {
  return "Inverter cores da página";
}
function $dividerAria$() {
  return "Redimensionar leitores de PDF";
}
function $documentAria$(label_0) {
  return "Documento de " + label_0;
}
function $openAria$(label_0) {
  return "Abrir PDF em " + label_0;
}
function $findAria$(label_0) {
  return "Buscar em " + label_0;
}
function $pageAria$(label_0) {
  return "Página de " + label_0;
}
function $optionKids$(name_0) {
  return { $: "Con", ["head"]: run_loop($view$viewText$(name_0)), ["tail"]: { $: "Nil" } };
}
function $optionNode$(option_0, path_0) {
  const name_0 = option_0.name;
  const optionPath_0 = option_0.path;
  const optionPath_1 = optionPath_0;
  return run_jump($view$viewEl$, ["option", run_loop($view$attrJoin$({ $: "Con", ["head"]: { $: "Con", ["head"]: { $: "ViewAttr", ["name"]: "value", ["value"]: optionPath_1 }, ["tail"]: { $: "Nil" } }, ["tail"]: { $: "Con", ["head"]: run_loop($view$attrWhen$(run_loop($String$eq$(optionPath_1, path_0)), { $: "ViewAttr", ["name"]: "selected", ["value"]: "" })), ["tail"]: { $: "Nil" } } })), run_loop($optionKids$(name_0))]);
}
function $optionEmpty$() {
  return run_jump($view$viewEl$, ["option", { $: "Con", ["head"]: { $: "ViewAttr", ["name"]: "value", ["value"]: "" }, ["tail"]: { $: "Nil" } }, run_loop($optionKids$(run_loop($emptyOptionLabel$())))]);
}
function $optionNodes$go$(options_0, path_0) {
  if (options_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const h_0 = options_0.head;
    const t_0 = options_0.tail;
    return { $: "Con", ["head"]: run_loop($optionNode$(h_0, path_0)), ["tail"]: run_loop($optionNodes$go$(t_0, path_0)) };
  }
}
function $optionNodes$(options_0, path_0) {
  return { $: "Con", ["head"]: run_loop($optionEmpty$()), ["tail"]: run_loop($optionNodes$go$(options_0, path_0)) };
}
function $selectNode$(label_0, options_0, path_0) {
  return run_jump($view$viewEl$, ["select", { $: "Con", ["head"]: run_loop($view$attrClass$("pdf-select")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("label", run_loop($documentAria$(label_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("change", "OpenDoc")), ["tail"]: { $: "Nil" } } } }, run_loop($optionNodes$(options_0, path_0))]);
}
function $iconBtnAttrs$(cls_0, iconName_0, aria_0) {
  return { $: "Con", ["head"]: run_loop($view$attrClass$(cls_0 + " icon-btn")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("label", aria_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("icon", iconName_0)), ["tail"]: { $: "Nil" } } } };
}
function $openBtn$(label_0) {
  return run_jump($view$viewEl$, ["button", run_loop($view$attrJoin$({ $: "Con", ["head"]: run_loop($iconBtnAttrs$("open", "plus", run_loop($openAria$(label_0)))), ["tail"]: { $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrTitle$(run_loop($openTitle$()))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "OpenFile")), ["tail"]: { $: "Nil" } } }, ["tail"]: { $: "Nil" } } })), { $: "Nil" }]);
}
function $findToggleBtn$(label_0, open_0) {
  return run_jump($view$viewEl$, ["button", run_loop($view$attrJoin$({ $: "Con", ["head"]: run_loop($iconBtnAttrs$("find-toggle", "search", run_loop($findAria$(label_0)))), ["tail"]: { $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrTitle$(run_loop($findTitle$()))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrBool$("aria-pressed", open_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "ToggleFind")), ["tail"]: { $: "Nil" } } } }, ["tail"]: { $: "Nil" } } })), { $: "Nil" }]);
}
function $shotBtn$(label_0) {
  return run_jump($view$viewEl$, ["button", run_loop($view$attrJoin$({ $: "Con", ["head"]: run_loop($iconBtnAttrs$("page-shot", "camera", run_loop($shotTitle$()))), ["tail"]: { $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrTitle$(run_loop($shotTitle$()))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "PageShot")), ["tail"]: { $: "Nil" } } }, ["tail"]: { $: "Nil" } } })), { $: "Nil" }]);
}
function $collapseIcon$(minimized_0) {
  if (minimized_0) {
    return "chevronUp";
  } else {
    return "chevronDown";
  }
}
function $collapseBtn$(minimized_0) {
  const title_0 = run_loop($pdfview$collapseTitle$(minimized_0));
  return run_jump($view$viewEl$, ["button", run_loop($view$attrJoin$({ $: "Con", ["head"]: run_loop($iconBtnAttrs$("collapse", run_loop($collapseIcon$(minimized_0)), title_0)), ["tail"]: { $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrTitle$(title_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrBool$("aria-pressed", minimized_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "ToggleCollapse")), ["tail"]: { $: "Nil" } } } }, ["tail"]: { $: "Nil" } } })), { $: "Nil" }]);
}
function $titleBar$(shell_0) {
  const label_0 = shell_0.label;
  const options_0 = shell_0.options;
  const path_0 = shell_0.path;
  const minimized_0 = shell_0.minimized;
  const findOpen_0 = shell_0.findOpen;
  const label_1 = label_0;
  const options_1 = options_0;
  const path_1 = path_0;
  const minimized_1 = minimized_0;
  return run_jump($view$viewEl$, ["div", { $: "Con", ["head"]: run_loop($view$attrClass$("pdf-title")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewEl$("strong", { $: "Nil" }, { $: "Con", ["head"]: run_loop($view$viewText$(label_1)), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Con", ["head"]: run_loop($selectNode$(label_1, options_1, path_1)), ["tail"]: { $: "Con", ["head"]: run_loop($openBtn$(label_1)), ["tail"]: { $: "Con", ["head"]: run_loop($findToggleBtn$(label_1, findOpen_0)), ["tail"]: { $: "Con", ["head"]: run_loop($shotBtn$(label_1)), ["tail"]: { $: "Con", ["head"]: run_loop($collapseBtn$(minimized_1)), ["tail"]: { $: "Nil" } } } } } } }]);
}
function $iconBtn$(cls_0, iconName_0, aria_0, handler_0) {
  return run_jump($view$viewEl$, ["button", run_loop($view$attrConcat$(run_loop($iconBtnAttrs$(cls_0, iconName_0, aria_0)), { $: "Con", ["head"]: run_loop($view$attrOn$("click", handler_0)), ["tail"]: { $: "Nil" } })), { $: "Nil" }]);
}
function $titleIconBtn$(cls_0, iconName_0, title_0, aria_0, handler_0) {
  return run_jump($view$viewEl$, ["button", run_loop($view$attrJoin$({ $: "Con", ["head"]: run_loop($iconBtnAttrs$(cls_0, iconName_0, aria_0)), ["tail"]: { $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrTitle$(title_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", handler_0)), ["tail"]: { $: "Nil" } } }, ["tail"]: { $: "Nil" } } })), { $: "Nil" }]);
}
function $pageInput$(label_0) {
  return run_jump($view$viewEl$, ["input", { $: "Con", ["head"]: run_loop($view$attrClass$("page-number")), ["tail"]: { $: "Con", ["head"]: { $: "ViewAttr", ["name"]: "type", ["value"]: "number" }, ["tail"]: { $: "Con", ["head"]: { $: "ViewAttr", ["name"]: "min", ["value"]: "1" }, ["tail"]: { $: "Con", ["head"]: { $: "ViewAttr", ["name"]: "value", ["value"]: "1" }, ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("label", run_loop($pageAria$(label_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("change", "GotoPage")), ["tail"]: { $: "Nil" } } } } } } }, { $: "Nil" }]);
}
function $toolsBar$(label_0) {
  return run_jump($view$viewEl$, ["div", { $: "Con", ["head"]: run_loop($view$attrClass$("pdf-tools")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($iconBtn$("prev", "chevronLeft", run_loop($prevAria$()), "Prev")), ["tail"]: { $: "Con", ["head"]: run_loop($pageInput$(label_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("span", { $: "Con", ["head"]: run_loop($view$attrClass$("page-total")), ["tail"]: { $: "Nil" } }, { $: "Nil" })), ["tail"]: { $: "Con", ["head"]: run_loop($iconBtn$("next", "chevronRight", run_loop($nextAria$()), "Next")), ["tail"]: { $: "Con", ["head"]: run_loop($iconBtn$("out", "minus", run_loop($outAria$()), "ZoomOut")), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("span", { $: "Con", ["head"]: run_loop($view$attrClass$("zoom-label")), ["tail"]: { $: "Nil" } }, { $: "Nil" })), ["tail"]: { $: "Con", ["head"]: run_loop($iconBtn$("in", "plus", run_loop($inAria$()), "ZoomIn")), ["tail"]: { $: "Con", ["head"]: run_loop($titleIconBtn$("fit", "unfold", run_loop($fitTitle$()), run_loop($fitTitle$()), "Fit")), ["tail"]: { $: "Con", ["head"]: run_loop($titleIconBtn$("invert", "contrast", run_loop($invertTitle$()), run_loop($invertAria$()), "ToggleInvert")), ["tail"]: { $: "Nil" } } } } } } } } } }]);
}
function $stage$() {
  return run_jump($view$viewEl$, ["div", { $: "Con", ["head"]: run_loop($view$attrClass$("pdf-stage")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewEl$("div", { $: "Con", ["head"]: run_loop($view$attrClass$("pdf-viewport")), ["tail"]: { $: "Nil" } }, { $: "Nil" })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("div", { $: "Con", ["head"]: run_loop($view$attrClass$("pdf-foot")), ["tail"]: { $: "Nil" } }, { $: "Nil" })), ["tail"]: { $: "Nil" } } }]);
}
function $findForm$(label_0) {
  return run_jump($view$viewEl$, ["form", { $: "Con", ["head"]: run_loop($view$attrClass$("pdf-find")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("submit", "Find")), ["tail"]: { $: "Con", ["head"]: { $: "ViewAttr", ["name"]: "hidden", ["value"]: "" }, ["tail"]: { $: "Nil" } } } }, { $: "Con", ["head"]: run_loop($view$viewEl$("input", { $: "Con", ["head"]: { $: "ViewAttr", ["name"]: "placeholder", ["value"]: run_loop($findPlaceholder$()) }, ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("label", run_loop($findAria$(label_0)))), ["tail"]: { $: "Nil" } } }, { $: "Nil" })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("span", { $: "Con", ["head"]: run_loop($view$attrClass$("find-count")), ["tail"]: { $: "Con", ["head"]: { $: "ViewAttr", ["name"]: "hidden", ["value"]: "" }, ["tail"]: { $: "Nil" } } }, { $: "Nil" })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("button", { $: "Nil" }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($findButtonLabel$()))), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Nil" } } } }]);
}
function $panelShell$(shell_0) {
  const label_0 = shell_0.label;
  const options_0 = shell_0.options;
  const path_0 = shell_0.path;
  const minimized_0 = shell_0.minimized;
  const findOpen_0 = shell_0.findOpen;
  const label_1 = label_0;
  const options_1 = options_0;
  const path_1 = path_0;
  const minimized_1 = minimized_0;
  return run_jump($view$viewEl$, ["section", { $: "Con", ["head"]: run_loop($pdfview$panelClass$(minimized_1, false)), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("label", label_1)), ["tail"]: { $: "Con", ["head"]: { $: "ViewAttr", ["name"]: "tabindex", ["value"]: "0" }, ["tail"]: { $: "Nil" } } } }, { $: "Con", ["head"]: run_loop($titleBar$({ $: "PdfShell", ["label"]: label_1, ["options"]: options_1, ["path"]: path_1, ["minimized"]: minimized_1, ["findOpen"]: findOpen_0 })), ["tail"]: { $: "Con", ["head"]: run_loop($toolsBar$(label_1)), ["tail"]: { $: "Con", ["head"]: run_loop($stage$()), ["tail"]: { $: "Con", ["head"]: run_loop($findForm$(label_1)), ["tail"]: { $: "Nil" } } } } }]);
}
function $divider$() {
  return run_jump($view$viewEl$, ["div", { $: "Con", ["head"]: run_loop($view$attrClass$("pdf-divider")), ["tail"]: { $: "Con", ["head"]: { $: "ViewAttr", ["name"]: "tabindex", ["value"]: "0" }, ["tail"]: { $: "Con", ["head"]: { $: "ViewAttr", ["name"]: "role", ["value"]: "separator" }, ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("label", run_loop($dividerAria$()))), ["tail"]: { $: "Nil" } } } } }, { $: "Nil" }]);
}
function $pageStyle$(width_0, height_0) {
  const x_0 = ";height:" + height_0;
  const x_1 = width_0 + x_0;
  return "width:" + x_1;
}
function $pageNode$(box_0) {
  const n_0 = box_0.n;
  const width_0 = box_0.width;
  const height_0 = box_0.height;
  return run_jump($view$viewEl$, ["div", { $: "Con", ["head"]: run_loop($view$attrClass$("pdf-page")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("page", run_loop($Nat$show$(n_0)))), ["tail"]: { $: "Con", ["head"]: { $: "ViewAttr", ["name"]: "style", ["value"]: run_loop($pageStyle$(width_0, height_0)) }, ["tail"]: { $: "Nil" } } } }, { $: "Nil" }]);
}
function $pageNodes$(boxes_0) {
  if (boxes_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const h_0 = boxes_0.head;
    const t_0 = boxes_0.tail;
    return { $: "Con", ["head"]: run_loop($pageNode$(h_0)), ["tail"]: run_loop($pageNodes$(t_0)) };
  }
}
function $docFrame$(boxes_0) {
  return run_jump($view$viewEl$, ["div", { $: "Con", ["head"]: run_loop($view$attrClass$("pdf-document")), ["tail"]: { $: "Nil" } }, run_loop($pageNodes$(boxes_0))]);
}
function $viewport$(state_0, boxes_0) {
  if (state_0.$ === "PdfEmpty") {
    return { $: "Some", ["value"]: run_loop($pdfview$placeholder$()) };
  } else if (state_0.$ === "PdfReady") {
    return { $: "Some", ["value"]: run_loop($docFrame$(boxes_0)) };
  } else if (state_0.$ === "PdfLoading") {
    return { $: "None" };
  } else {
    return { $: "None" };
  }
}
function $hlPush$(seg_0, out_0) {
  return { $: "Con", ["head"]: seg_0, ["tail"]: out_0 };
}
function $hlFlush$if$(pend_0, out_0, empty_0) {
  if (empty_0) {
    return out_0;
  } else {
    return run_jump($hlPush$, [{ $: "PdfHlSeg", ["text"]: run_loop($String$reverse$(pend_0)), ["hit"]: false }, out_0]);
  }
}
function $hlFlush$(pend_0, out_0) {
  return run_jump($hlFlush$if$, [pend_0, out_0, run_loop($String$is_empty$(pend_0))]);
}
function $hlScan$(text_0, folded_0, term_0, n_0, rem_0, fact_0, pend_0, out_0) {
  if (text_0 === "") {
    return run_jump($hlFlush$, [pend_0, out_0]);
  } else {
    const __0 = text_0.codePointAt(0) > 65535 ? text_0.slice(0, 2) : text_0[0];
    const t_0 = text_0.codePointAt(0) > 65535 ? text_0.slice(2) : text_0.slice(1);
    if (rem_0 === "") {
      if (fact_0) {
        return run_jump($hlScan$, [t_0, run_loop($String$drop$(folded_0, 1n)), term_0, n_0, run_loop($String$drop$(term_0, 1n)), run_loop($String$starts_with$(run_loop($String$drop$(folded_0, 1n)), term_0)), "", run_loop($hlPush$({ $: "PdfHlSeg", ["text"]: run_loop($String$take$(__0 + t_0, n_0)), ["hit"]: true }, run_loop($hlFlush$(pend_0, out_0))))]);
      } else {
        const x_0 = run_loop($String$take$(__0 + t_0, 1n));
        return run_jump($hlScan$, [t_0, run_loop($String$drop$(folded_0, 1n)), term_0, n_0, "", run_loop($String$starts_with$(run_loop($String$drop$(folded_0, 1n)), term_0)), x_0 + pend_0, out_0]);
      }
    } else {
      const __1 = rem_0.codePointAt(0) > 65535 ? rem_0.slice(0, 2) : rem_0[0];
      const rs_0 = rem_0.codePointAt(0) > 65535 ? rem_0.slice(2) : rem_0.slice(1);
      return run_jump($hlScan$, [t_0, run_loop($String$drop$(folded_0, 1n)), term_0, n_0, rs_0, run_loop($String$starts_with$(run_loop($String$drop$(folded_0, 1n)), term_0)), pend_0, out_0]);
    }
  }
}
function $hlNode$go$(text_0, hit_0) {
  if (hit_0) {
    return run_jump($view$viewEl$, ["i", { $: "Con", ["head"]: run_loop($view$attrClass$("pdf-hl")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$(text_0)), ["tail"]: { $: "Nil" } }]);
  } else {
    return run_jump($view$viewText$, [text_0]);
  }
}
function $hlNode$(seg_0) {
  const text_0 = seg_0.text;
  const hit_0 = seg_0.hit;
  return run_jump($hlNode$go$, [text_0, hit_0]);
}
function $hlNodes$(segs_0, acc_0) {
  if (segs_0.$ === "Nil") {
    return acc_0;
  } else {
    const h_0 = segs_0.head;
    const t_0 = segs_0.tail;
    return run_jump($hlNodes$, [t_0, { $: "Con", ["head"]: run_loop($hlNode$(h_0)), ["tail"]: acc_0 }]);
  }
}
function $hlSegments$if$(text_0, folded_0, term_0, empty_0) {
  if (empty_0) {
    return { $: "Con", ["head"]: run_loop($view$viewText$(text_0)), ["tail"]: { $: "Nil" } };
  } else {
    return run_jump($hlNodes$, [run_loop($hlScan$(text_0, folded_0, term_0, BigInt([...term_0].length), "", run_loop($String$starts_with$(folded_0, term_0)), "", { $: "Nil" })), { $: "Nil" }]);
  }
}
function $hlSegments$(text_0, folded_0, term_0) {
  return run_jump($hlSegments$if$, [text_0, folded_0, term_0, run_loop($String$is_empty$(term_0))]);
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
function $String$reverse$(s_0) {
  return run_jump($String$reverse$go$, [s_0, ""]);
}
function $String$drop$(s_0, n_0) {
  if (s_0 === "") {
    return "";
  } else {
    const h_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(0, 2) : s_0[0];
    const t_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(2) : s_0.slice(1);
    if (n_0 === 0n) {
      return h_0 + t_0;
    } else {
      const p_0 = n_0 - 1n;
      return run_jump($String$drop$, [t_0, p_0]);
    }
  }
}
function $String$starts_with$(s_0, p_0) {
  if (s_0 === "") {
    if (p_0 === "") {
      return true;
    } else {
      const h_0 = p_0.codePointAt(0) > 65535 ? p_0.slice(0, 2) : p_0[0];
      const t_0 = p_0.codePointAt(0) > 65535 ? p_0.slice(2) : p_0.slice(1);
      return false;
    }
  } else {
    const h_1 = s_0.codePointAt(0) > 65535 ? s_0.slice(0, 2) : s_0[0];
    const t_1 = s_0.codePointAt(0) > 65535 ? s_0.slice(2) : s_0.slice(1);
    if (p_0 === "") {
      return true;
    } else {
      const y_0 = p_0.codePointAt(0) > 65535 ? p_0.slice(0, 2) : p_0[0];
      const yt_0 = p_0.codePointAt(0) > 65535 ? p_0.slice(2) : p_0.slice(1);
      return run_jump($String$starts_with$if$, [t_1, yt_0, run_loop($Char$is_eq$(h_1, y_0))]);
    }
  }
}
function $String$take$(s_0, n_0) {
  if (s_0 === "") {
    return "";
  } else {
    const h_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(0, 2) : s_0[0];
    const t_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(2) : s_0.slice(1);
    if (n_0 === 0n) {
      return "";
    } else {
      const p_0 = n_0 - 1n;
      return h_0 + run_loop($String$take$(t_0, p_0));
    }
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
function $String$reverse$go$(s_0, acc_0) {
  if (s_0 === "") {
    return acc_0;
  } else {
    const h_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(0, 2) : s_0[0];
    const t_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(2) : s_0.slice(1);
    return run_jump($String$reverse$go$, [t_0, h_0 + acc_0]);
  }
}
function $String$starts_with$if$(t_0, pt_0, same_0) {
  if (!same_0) {
    return false;
  } else {
    return run_jump($String$starts_with$, [t_0, pt_0]);
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
var pdfpageview_default = {
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
  "pdfview.modeContinuous": run_lib($pdfview$modeContinuous$, 0),
  "pdfview.placeholderText": run_lib($pdfview$placeholderText$, 0),
  "pdfview.footLoadingText": run_lib($pdfview$footLoadingText$, 0),
  "pdfview.footErrorText": run_lib($pdfview$footErrorText$, 0),
  "pdfview.pageTotalDash": run_lib($pdfview$pageTotalDash$, 0),
  "pdfview.gridFlags": run_lib($pdfview$gridFlags$, 2),
  "pdfview.panelFlags": run_lib($pdfview$panelFlags$, 2),
  "pdfview.navChrome": run_lib($pdfview$navChrome$, 3),
  "pdfview.collapseTitle": run_lib($pdfview$collapseTitle$, 1),
  "pdfview.disabledAttr": run_lib($pdfview$disabledAttr$, 1),
  "pdfview.pageNumberValue": run_lib($pdfview$pageNumberValue$, 1),
  "pdfview.pageNumberMax": run_lib($pdfview$pageNumberMax$, 1),
  "pdfview.pageTotalText": run_lib($pdfview$pageTotalText$, 1),
  "pdfview.zoomLabelText": run_lib($pdfview$zoomLabelText$, 1),
  "pdfview.footReadyText": run_lib($pdfview$footReadyText$, 4),
  "pdfview.findCountChrome.shown": run_lib($pdfview$findCountChrome$shown$, 3),
  "pdfview.findCountChrome": run_lib($pdfview$findCountChrome$, 4),
  "pdfview.gridClass": run_lib($pdfview$gridClass$, 2),
  "pdfview.panelClass": run_lib($pdfview$panelClass$, 2),
  "pdfview.label": run_lib($pdfview$label$, 1),
  "pdfview.placeholder": run_lib($pdfview$placeholder$, 0),
  "pdfview.pageTotalEmpty": run_lib($pdfview$pageTotalEmpty$, 0),
  "pdfview.pageTotal": run_lib($pdfview$pageTotal$, 1),
  "pdfview.zoomLabel": run_lib($pdfview$zoomLabel$, 1),
  "pdfview.footLoading": run_lib($pdfview$footLoading$, 0),
  "pdfview.footError": run_lib($pdfview$footError$, 0),
  "pdfview.footReady": run_lib($pdfview$footReady$, 4),
  "pdfview.findCountLabel": run_lib($pdfview$findCountLabel$, 1),
  emptyOptionLabel: run_lib($emptyOptionLabel$, 0),
  findPlaceholder: run_lib($findPlaceholder$, 0),
  findButtonLabel: run_lib($findButtonLabel$, 0),
  openTitle: run_lib($openTitle$, 0),
  findTitle: run_lib($findTitle$, 0),
  shotTitle: run_lib($shotTitle$, 0),
  prevAria: run_lib($prevAria$, 0),
  nextAria: run_lib($nextAria$, 0),
  outAria: run_lib($outAria$, 0),
  inAria: run_lib($inAria$, 0),
  fitTitle: run_lib($fitTitle$, 0),
  invertTitle: run_lib($invertTitle$, 0),
  invertAria: run_lib($invertAria$, 0),
  dividerAria: run_lib($dividerAria$, 0),
  documentAria: run_lib($documentAria$, 1),
  openAria: run_lib($openAria$, 1),
  findAria: run_lib($findAria$, 1),
  pageAria: run_lib($pageAria$, 1),
  optionKids: run_lib($optionKids$, 1),
  optionNode: run_lib($optionNode$, 2),
  optionEmpty: run_lib($optionEmpty$, 0),
  "optionNodes.go": run_lib($optionNodes$go$, 2),
  optionNodes: run_lib($optionNodes$, 2),
  selectNode: run_lib($selectNode$, 3),
  iconBtnAttrs: run_lib($iconBtnAttrs$, 3),
  openBtn: run_lib($openBtn$, 1),
  findToggleBtn: run_lib($findToggleBtn$, 2),
  shotBtn: run_lib($shotBtn$, 1),
  collapseIcon: run_lib($collapseIcon$, 1),
  collapseBtn: run_lib($collapseBtn$, 1),
  titleBar: run_lib($titleBar$, 1),
  iconBtn: run_lib($iconBtn$, 4),
  titleIconBtn: run_lib($titleIconBtn$, 5),
  pageInput: run_lib($pageInput$, 1),
  toolsBar: run_lib($toolsBar$, 1),
  stage: run_lib($stage$, 0),
  findForm: run_lib($findForm$, 1),
  panelShell: run_lib($panelShell$, 1),
  divider: run_lib($divider$, 0),
  pageStyle: run_lib($pageStyle$, 2),
  pageNode: run_lib($pageNode$, 1),
  pageNodes: run_lib($pageNodes$, 1),
  docFrame: run_lib($docFrame$, 1),
  viewport: run_lib($viewport$, 2),
  hlPush: run_lib($hlPush$, 2),
  "hlFlush.if": run_lib($hlFlush$if$, 3),
  hlFlush: run_lib($hlFlush$, 2),
  hlScan: run_lib($hlScan$, 8),
  "hlNode.go": run_lib($hlNode$go$, 2),
  hlNode: run_lib($hlNode$, 1),
  hlNodes: run_lib($hlNodes$, 2),
  "hlSegments.if": run_lib($hlSegments$if$, 4),
  hlSegments: run_lib($hlSegments$, 3)
};
export {
  pdfpageview_default as default
};

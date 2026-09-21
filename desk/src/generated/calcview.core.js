// GERADO de core/calcview.bend por `bun core/build.mjs` — não editar à mão.
// core/calcview.bend
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
function $calcTitle$() {
  return "Calculadora";
}
function $angleAria$() {
  return "Unidade angular";
}
function $expressionPlaceholder$() {
  return "sqrt(16) + sin(pi/2)";
}
function $expressionAria$() {
  return "Expressão matemática";
}
function $equalsAria$() {
  return "Calcular";
}
function $equalsText$() {
  return "=";
}
function $calcHelpText$() {
  return "+ − * / ^ · sqrt · sin · cos · tan · ln · log · pi";
}
function $guideSummaryText$() {
  return "Como usar";
}
function $codeNode$(txt_0) {
  return run_jump($view$viewEl$, ["code", { $: "Nil" }, { $: "Con", ["head"]: run_loop($view$viewText$(txt_0)), ["tail"]: { $: "Nil" } }]);
}
function $guideParagraph1$() {
  return run_jump($view$viewEl$, ["p", { $: "Nil" }, { $: "Con", ["head"]: run_loop($view$viewText$("Calculadora numérica local, sem IA. Digite e pressione Enter. Parênteses agrupam: ")), ["tail"]: { $: "Con", ["head"]: run_loop($codeNode$("(2+3)*4")), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewText$(". Multiplicação: ")), ["tail"]: { $: "Con", ["head"]: run_loop($codeNode$("2*pi")), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewText$("; potência: ")), ["tail"]: { $: "Con", ["head"]: run_loop($codeNode$("2^3")), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewText$("; raiz: ")), ["tail"]: { $: "Con", ["head"]: run_loop($codeNode$("sqrt(16)")), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewText$(".")), ["tail"]: { $: "Nil" } } } } } } } } } }]);
}
function $guideParagraph2$() {
  return run_jump($view$viewEl$, ["p", { $: "Nil" }, { $: "Con", ["head"]: run_loop($codeNode$("sin(pi/2)")), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewText$(" em RAD e ")), ["tail"]: { $: "Con", ["head"]: run_loop($codeNode$("sin(90)")), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewText$(" em GRAUS dão 1. ")), ["tail"]: { $: "Con", ["head"]: run_loop($codeNode$("ln")), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewText$(" é logaritmo natural; ")), ["tail"]: { $: "Con", ["head"]: run_loop($codeNode$("log")), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewText$(" é base 10. Aceita vírgula decimal. Clique no histórico para reutilizar uma expressão.")), ["tail"]: { $: "Nil" } } } } } } } } }]);
}
function $guideParagraph3$() {
  return run_jump($view$viewEl$, ["p", { $: "Nil" }, { $: "Con", ["head"]: run_loop($view$viewText$("Não resolve equações nem deriva ou integra simbolicamente.")), ["tail"]: { $: "Nil" } }]);
}
function $calcGuide$(open_0) {
  return run_jump($view$viewEl$, ["details", run_loop($view$attrJoin$({ $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrId$("calc-guide")), ["tail"]: { $: "Nil" } }, ["tail"]: { $: "Con", ["head"]: run_loop($view$attrWhen$(open_0, { $: "ViewAttr", ["name"]: "open", ["value"]: "" })), ["tail"]: { $: "Nil" } } })), { $: "Con", ["head"]: run_loop($view$viewEl$("summary", { $: "Nil" }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($guideSummaryText$()))), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Con", ["head"]: run_loop($guideParagraph1$()), ["tail"]: { $: "Con", ["head"]: run_loop($guideParagraph2$()), ["tail"]: { $: "Con", ["head"]: run_loop($guideParagraph3$()), ["tail"]: { $: "Nil" } } } } }]);
}
function $angleOption$(value_0, label_0, angle_0) {
  return run_jump($view$viewEl$, ["option", run_loop($view$attrJoin$({ $: "Con", ["head"]: { $: "Con", ["head"]: { $: "ViewAttr", ["name"]: "value", ["value"]: value_0 }, ["tail"]: { $: "Nil" } }, ["tail"]: { $: "Con", ["head"]: run_loop($view$attrWhen$(run_loop($String$eq$(value_0, angle_0)), { $: "ViewAttr", ["name"]: "selected", ["value"]: "" })), ["tail"]: { $: "Nil" } } })), { $: "Con", ["head"]: run_loop($view$viewText$(label_0)), ["tail"]: { $: "Nil" } }]);
}
function $angleSelect$(angle_0) {
  return run_jump($view$viewEl$, ["select", { $: "Con", ["head"]: run_loop($view$attrId$("angle")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("label", run_loop($angleAria$()))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("change", "SetAngle")), ["tail"]: { $: "Nil" } } } }, { $: "Con", ["head"]: run_loop($angleOption$("rad", "RAD", angle_0)), ["tail"]: { $: "Con", ["head"]: run_loop($angleOption$("deg", "GRAUS", angle_0)), ["tail"]: { $: "Nil" } } }]);
}
function $calcToggle$(collapsed_0, angle_0) {
  return run_jump($view$viewEl$, ["button", { $: "Con", ["head"]: run_loop($view$attrId$("calc-toggle")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("expanded", run_loop($view$boolStr$(run_loop($Bool$not$(collapsed_0)))))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "ToggleCalc")), ["tail"]: { $: "Nil" } } } }, { $: "Con", ["head"]: run_loop($view$viewEl$("span", { $: "Nil" }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($calcTitle$()))), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("span", { $: "Con", ["head"]: run_loop($view$attrClass$("calc-mode")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($angleSelect$(angle_0)), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Nil" } } }]);
}
function $expressionValue$(value_0) {
  return run_jump($view$attrWhen$, [run_loop($Bool$not$(run_loop($String$is_empty$(value_0)))), { $: "ViewAttr", ["name"]: "value", ["value"]: value_0 }]);
}
function $calcForm$(expression_0) {
  return run_jump($view$viewEl$, ["form", { $: "Con", ["head"]: run_loop($view$attrId$("calc-form")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("submit", "Eval")), ["tail"]: { $: "Nil" } } }, { $: "Con", ["head"]: run_loop($view$viewEl$("input", run_loop($view$attrJoin$({ $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrId$("expression")), ["tail"]: { $: "Con", ["head"]: { $: "ViewAttr", ["name"]: "autocomplete", ["value"]: "off" }, ["tail"]: { $: "Con", ["head"]: { $: "ViewAttr", ["name"]: "placeholder", ["value"]: run_loop($expressionPlaceholder$()) }, ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("label", run_loop($expressionAria$()))), ["tail"]: { $: "Nil" } } } } }, ["tail"]: { $: "Con", ["head"]: run_loop($expressionValue$(expression_0)), ["tail"]: { $: "Nil" } } })), { $: "Nil" })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("button", { $: "Con", ["head"]: run_loop($view$attrType$("submit")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("label", run_loop($equalsAria$()))), ["tail"]: { $: "Nil" } } }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($equalsText$()))), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Nil" } } }]);
}
function $calcResult$(value_0) {
  return run_jump($view$viewEl$, ["output", { $: "Con", ["head"]: run_loop($view$attrId$("result")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$(value_0)), ["tail"]: { $: "Nil" } }]);
}
function $histLabel$(expr_0, result_0) {
  const x_0 = " = " + result_0;
  return expr_0 + x_0;
}
function $histButton$(e_0) {
  const expr_0 = e_0.expr;
  const result_0 = e_0.result;
  const expr_1 = expr_0;
  return run_jump($view$viewEl$, ["button", { $: "Con", ["head"]: run_loop($view$attrData$("expr", expr_1)), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "Reuse")), ["tail"]: { $: "Nil" } } }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($histLabel$(expr_1, result_0)))), ["tail"]: { $: "Nil" } }]);
}
function $view$viewMap$1$(xs_0) {
  if (xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const h_0 = xs_0.head;
    const t_0 = xs_0.tail;
    return { $: "Con", ["head"]: run_loop($histButton$(h_0)), ["tail"]: run_loop($view$viewMap$1$(t_0)) };
  }
}
function $histItems$(hs_0) {
  return run_jump($view$viewMap$1$, [hs_0]);
}
function $calcHistory$(hs_0) {
  return run_jump($view$viewEl$, ["div", { $: "Con", ["head"]: run_loop($view$attrId$("calc-history")), ["tail"]: { $: "Nil" } }, run_loop($histItems$(hs_0))]);
}
function $calcHelp$() {
  return run_jump($view$viewEl$, ["div", { $: "Con", ["head"]: run_loop($view$attrClass$("calc-help")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($calcHelpText$()))), ["tail"]: { $: "Nil" } }]);
}
function $calcBody$(collapsed_0, expression_0, result_0, history_0, guideOpen_0) {
  return run_jump($view$viewEl$, ["div", run_loop($view$attrJoin$({ $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrId$("calc-body")), ["tail"]: { $: "Nil" } }, ["tail"]: { $: "Con", ["head"]: run_loop($view$attrWhen$(collapsed_0, { $: "ViewAttr", ["name"]: "hidden", ["value"]: "" })), ["tail"]: { $: "Nil" } } })), { $: "Con", ["head"]: run_loop($calcForm$(expression_0)), ["tail"]: { $: "Con", ["head"]: run_loop($calcResult$(result_0)), ["tail"]: { $: "Con", ["head"]: run_loop($calcHistory$(history_0)), ["tail"]: { $: "Con", ["head"]: run_loop($calcHelp$()), ["tail"]: { $: "Con", ["head"]: run_loop($calcGuide$(guideOpen_0)), ["tail"]: { $: "Nil" } } } } } }]);
}
function $calculator$(visible_0, collapsed_0, angle_0, expression_0, result_0, history_0, guideOpen_0) {
  return run_jump($view$viewEl$, ["section", run_loop($view$attrJoin$({ $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrId$("calculator")), ["tail"]: { $: "Nil" } }, ["tail"]: { $: "Con", ["head"]: run_loop($view$attrWhen$(run_loop($Bool$not$(visible_0)), { $: "ViewAttr", ["name"]: "hidden", ["value"]: "" })), ["tail"]: { $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$classes$({ $: "Con", ["head"]: run_loop($view$classOn$("collapsed", collapsed_0)), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Nil" } }, ["tail"]: { $: "Nil" } } } })), { $: "Con", ["head"]: run_loop($calcToggle$(collapsed_0, angle_0)), ["tail"]: { $: "Con", ["head"]: run_loop($calcBody$(collapsed_0, expression_0, result_0, history_0, guideOpen_0)), ["tail"]: { $: "Nil" } } }]);
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
var calcview_default = {
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
  calcTitle: run_lib($calcTitle$, 0),
  angleAria: run_lib($angleAria$, 0),
  expressionPlaceholder: run_lib($expressionPlaceholder$, 0),
  expressionAria: run_lib($expressionAria$, 0),
  equalsAria: run_lib($equalsAria$, 0),
  equalsText: run_lib($equalsText$, 0),
  calcHelpText: run_lib($calcHelpText$, 0),
  guideSummaryText: run_lib($guideSummaryText$, 0),
  codeNode: run_lib($codeNode$, 1),
  guideParagraph1: run_lib($guideParagraph1$, 0),
  guideParagraph2: run_lib($guideParagraph2$, 0),
  guideParagraph3: run_lib($guideParagraph3$, 0),
  calcGuide: run_lib($calcGuide$, 1),
  angleOption: run_lib($angleOption$, 3),
  angleSelect: run_lib($angleSelect$, 1),
  calcToggle: run_lib($calcToggle$, 2),
  expressionValue: run_lib($expressionValue$, 1),
  calcForm: run_lib($calcForm$, 1),
  calcResult: run_lib($calcResult$, 1),
  histLabel: run_lib($histLabel$, 2),
  histButton: run_lib($histButton$, 1),
  "view.viewMap~1": run_lib($view$viewMap$1$, 1),
  histItems: run_lib($histItems$, 1),
  calcHistory: run_lib($calcHistory$, 1),
  calcHelp: run_lib($calcHelp$, 0),
  calcBody: run_lib($calcBody$, 5),
  calculator: run_lib($calculator$, 7)
};
export {
  calcview_default as default
};

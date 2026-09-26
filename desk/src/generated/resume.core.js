// GERADO de core/resume.bend por `bun core/build.mjs` — não editar à mão.
// core/resume.bend
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
function $maxText$() {
  return 240n;
}
function $maxPath$() {
  return BigInt(1024);
}
function $maxPdfs$() {
  return 2n;
}
function $cutLine$if$(_text_0, _limit_0, _over_0) {
  if (!_over_0) {
    return _text_0;
  } else {
    return run_jump($String$take$, [_text_0, _limit_0]);
  }
}
function $cutLine$(_text_0, _limit_0) {
  return run_jump($cutLine$if$, [_text_0, _limit_0, run_loop($Nat$is_gt$(BigInt([..._text_0].length), _limit_0))]);
}
function $line$(_text_0) {
  return run_jump($cutLine$, [run_loop($String$trim$(_text_0)), run_loop($maxText$())]);
}
function $pathLine$(_text_0) {
  return run_jump($cutLine$, [run_loop($String$trim$(_text_0)), run_loop($maxPath$())]);
}
function $keepRecord$blank$(_blank_0) {
  if (_blank_0) {
    return false;
  } else {
    return true;
  }
}
function $keepRecord$(_stopped_0, _next_0) {
  return run_jump($Bool$and$, [run_loop($keepRecord$blank$(run_loop($String$is_empty$(run_loop($String$trim$(_stopped_0)))))), run_loop($keepRecord$blank$(run_loop($String$is_empty$(run_loop($String$trim$(_next_0))))))]);
}
function $pageOf$if$(_page_0, _zero_0) {
  if (_zero_0) {
    return 1n;
  } else {
    return _page_0;
  }
}
function $pageOf$(_page_0) {
  return run_jump($pageOf$if$, [_page_0, run_loop($Nat$is_eq$(_page_0, 0n))]);
}
function $pageRef$(_path_0, _page_0) {
  return { $: "ResumePage", ["path"]: run_loop($pathLine$(_path_0)), ["page"]: run_loop($pageOf$(_page_0)) };
}
function $keepPage$(_index_0) {
  const _x_0 = run_loop($maxPdfs$());
  return _index_0 < _x_0;
}
function $takePages$(_pages_0) {
  return run_jump($List$take$, [_pages_0, run_loop($maxPdfs$())]);
}
function $record$(_stopped_0, _next_0, _exercise_0, _xopp_0, _pages_0) {
  return { $: "ResumeRecord", ["stopped"]: run_loop($line$(_stopped_0)), ["next"]: run_loop($line$(_next_0)), ["exercise"]: run_loop($line$(_exercise_0)), ["xopp"]: run_loop($pathLine$(_xopp_0)), ["pages"]: run_loop($takePages$(_pages_0)) };
}
function $resumeTitle$if$(_text_0, _exercise_0, _hasExercise_0) {
  if (_hasExercise_0) {
    const _x_0 = " — " + _exercise_0;
    return _text_0 + _x_0;
  } else {
    return _text_0;
  }
}
function $resumeTitle$(_course_0, _exercise_0) {
  const _x_0 = run_loop($String$trim$(_course_0));
  return run_jump($resumeTitle$if$, ["Continuar " + _x_0, run_loop($String$trim$(_exercise_0)), run_loop($Bool$not$(run_loop($String$is_empty$(run_loop($String$trim$(_exercise_0))))))]);
}
function $resumeWhereLabel$(_stopped_0) {
  return "Onde parei: " + _stopped_0;
}
function $resumeNextLabel$(_next_0) {
  return "Próximo passo: " + _next_0;
}
function $resumeGoLabel$() {
  return "Retomar";
}
function $resumeGoTitle$() {
  return "Volta a questão, o .xopp e as páginas do registro e escreve a mensagem no composer";
}
function $resumeDismissLabel$() {
  return "Dispensar";
}
function $resumeDismissTitle$() {
  return "Descarta o registro de retomada (o que foi escrito fica só no histórico)";
}
function $endDayDraft$(_stopped_0, _next_0) {
  const _x_0 = `

Próximo passo: ` + _next_0;
  const _x_1 = _stopped_0 + _x_0;
  return `Encerrar por hoje.

Onde parei: ` + _x_1;
}
function $resumeDraft$(_stopped_0, _next_0) {
  const _x_0 = `

Próximo passo: ` + _next_0;
  const _x_1 = _stopped_0 + _x_0;
  return `Continuar de onde parei.

Onde parei: ` + _x_1;
}
function $resumeCardTitleView$(_text_0) {
  return run_jump($view$viewEl$, ["div", { $: "Con", ["head"]: run_loop($view$attrClass$("resume-card-title")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$(_text_0)), ["tail"]: { $: "Nil" } }]);
}
function $resumeCardLineView$(_text_0) {
  return run_jump($view$viewEl$, ["div", { $: "Con", ["head"]: run_loop($view$attrClass$("resume-card-line")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$(_text_0)), ["tail"]: { $: "Nil" } }]);
}
function $resumeGoAttrs$() {
  return { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrClass$("resume-go")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrTitle$(run_loop($resumeGoTitle$()))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "resume")), ["tail"]: { $: "Nil" } } } } };
}
function $resumeGoBtn$() {
  return run_jump($view$viewEl$, ["button", run_loop($resumeGoAttrs$()), { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($resumeGoLabel$()))), ["tail"]: { $: "Nil" } }]);
}
function $resumeDismissAttrs$() {
  return { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrClass$("resume-dismiss")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrTitle$(run_loop($resumeDismissTitle$()))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "dismiss")), ["tail"]: { $: "Nil" } } } } };
}
function $resumeDismissBtn$() {
  return run_jump($view$viewEl$, ["button", run_loop($resumeDismissAttrs$()), { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($resumeDismissLabel$()))), ["tail"]: { $: "Nil" } }]);
}
function $resumeCardActions$() {
  return run_jump($view$viewEl$, ["div", { $: "Con", ["head"]: run_loop($view$attrClass$("resume-card-actions")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($resumeGoBtn$()), ["tail"]: { $: "Con", ["head"]: run_loop($resumeDismissBtn$()), ["tail"]: { $: "Nil" } } }]);
}
function $resumeCardKids$(_title_0, _stopped_0, _next_0) {
  return { $: "Con", ["head"]: run_loop($resumeCardTitleView$(_title_0)), ["tail"]: { $: "Con", ["head"]: run_loop($resumeCardLineView$(run_loop($resumeWhereLabel$(_stopped_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($resumeCardLineView$(run_loop($resumeNextLabel$(_next_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($resumeCardActions$()), ["tail"]: { $: "Nil" } } } } };
}
function $resumeCardView$(_title_0, _stopped_0, _next_0) {
  return run_jump($view$viewEl$, ["div", { $: "Con", ["head"]: run_loop($view$attrClass$("resume-card")), ["tail"]: { $: "Nil" } }, run_loop($resumeCardKids$(_title_0, _stopped_0, _next_0))]);
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
function $String$take$(_s_0, _n_0) {
  if (_s_0 === "") {
    return "";
  } else {
    const _h_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(0, 2) : _s_0[0];
    const _t_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(2) : _s_0.slice(1);
    if (_n_0 === 0n) {
      return "";
    } else {
      const _p_0 = _n_0 - 1n;
      return _h_0 + run_loop($String$take$(_t_0, _p_0));
    }
  }
}
function $Nat$is_gt$(_a_0, _b_0) {
  return run_jump($Cmp$is_gt$, [cmp_new(_a_0, _b_0)]);
}
function $String$trim$(_s_0) {
  return run_jump($String$trim_end$, [run_loop($String$trim_start$(_s_0))]);
}
function $Bool$and$(_a_0, _b_0) {
  if (!_a_0) {
    return false;
  } else {
    return _b_0;
  }
}
function $Nat$is_eq$(_a_0, _b_0) {
  return run_jump($Cmp$is_eq$, [cmp_new(_a_0, _b_0)]);
}
function $List$take$(_xs_0, _n_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    if (_n_0 === 0n) {
      return { $: "Nil" };
    } else {
      const _p_0 = _n_0 - 1n;
      return { $: "Con", ["head"]: _h_0, ["tail"]: run_loop($List$take$(_t_0, _p_0)) };
    }
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
function $Cmp$is_gt$(_c_0) {
  if (_c_0.$ === "LT") {
    return false;
  } else if (_c_0.$ === "EQ") {
    return false;
  } else {
    return true;
  }
}
function $String$trim_end$(_s_0) {
  return run_jump($String$reverse$, [run_loop($String$trim_start$(run_loop($String$reverse$(_s_0))))]);
}
function $String$trim_start$(_s_0) {
  if (_s_0 === "") {
    return "";
  } else {
    const _h_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(0, 2) : _s_0[0];
    const _t_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(2) : _s_0.slice(1);
    return run_jump($String$trim_start$if$, [_h_0, _t_0, run_loop($Char$is_space$(_h_0))]);
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
function $String$reverse$(_s_0) {
  return run_jump($String$reverse$go$, [_s_0, ""]);
}
function $String$trim_start$if$(_h_0, _t_0, _space_0) {
  if (!_space_0) {
    return _h_0 + _t_0;
  } else {
    return run_jump($String$trim_start$, [_t_0]);
  }
}
function $Char$is_space$(_c_0) {
  const _x_0 = _c_0.codePointAt(0);
  const _x_1 = _x_0 === 32;
  const _x_2 = run_loop($Bool$and$(_x_0 >= 9, _x_0 <= 13));
  return _x_1 || _x_2;
}
function $String$cmp$rec$(_h1b_0, _h2b_0, _rr_0) {
  const _t_0 = _rr_0["fst"];
  const _t1b_0 = _t_0["fst"];
  const _t2b_0 = _t_0["snd"];
  const _r_0 = _rr_0["snd"];
  return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: _h1b_0 + _t1b_0, ["snd"]: _h2b_0 + _t2b_0 }, ["snd"]: _r_0 };
}
function $String$reverse$go$(_s_0, _acc_0) {
  if (_s_0 === "") {
    return _acc_0;
  } else {
    const _h_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(0, 2) : _s_0[0];
    const _t_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(2) : _s_0.slice(1);
    return run_jump($String$reverse$go$, [_t_0, _h_0 + _acc_0]);
  }
}
var resume_default = {
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
  maxText: run_lib($maxText$, 0),
  maxPath: run_lib($maxPath$, 0),
  maxPdfs: run_lib($maxPdfs$, 0),
  "cutLine.if": run_lib($cutLine$if$, 3),
  cutLine: run_lib($cutLine$, 2),
  line: run_lib($line$, 1),
  pathLine: run_lib($pathLine$, 1),
  "keepRecord.blank": run_lib($keepRecord$blank$, 1),
  keepRecord: run_lib($keepRecord$, 2),
  "pageOf.if": run_lib($pageOf$if$, 2),
  pageOf: run_lib($pageOf$, 1),
  pageRef: run_lib($pageRef$, 2),
  keepPage: run_lib($keepPage$, 1),
  takePages: run_lib($takePages$, 1),
  record: run_lib($record$, 5),
  "resumeTitle.if": run_lib($resumeTitle$if$, 3),
  resumeTitle: run_lib($resumeTitle$, 2),
  resumeWhereLabel: run_lib($resumeWhereLabel$, 1),
  resumeNextLabel: run_lib($resumeNextLabel$, 1),
  resumeGoLabel: run_lib($resumeGoLabel$, 0),
  resumeGoTitle: run_lib($resumeGoTitle$, 0),
  resumeDismissLabel: run_lib($resumeDismissLabel$, 0),
  resumeDismissTitle: run_lib($resumeDismissTitle$, 0),
  endDayDraft: run_lib($endDayDraft$, 2),
  resumeDraft: run_lib($resumeDraft$, 2),
  resumeCardTitleView: run_lib($resumeCardTitleView$, 1),
  resumeCardLineView: run_lib($resumeCardLineView$, 1),
  resumeGoAttrs: run_lib($resumeGoAttrs$, 0),
  resumeGoBtn: run_lib($resumeGoBtn$, 0),
  resumeDismissAttrs: run_lib($resumeDismissAttrs$, 0),
  resumeDismissBtn: run_lib($resumeDismissBtn$, 0),
  resumeCardActions: run_lib($resumeCardActions$, 0),
  resumeCardKids: run_lib($resumeCardKids$, 3),
  resumeCardView: run_lib($resumeCardView$, 3)
};
export {
  resume_default as default
};

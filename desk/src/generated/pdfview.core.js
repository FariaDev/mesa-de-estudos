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
function $gridFlags$(_selfMin_0, _otherMin_0) {
  if (!_selfMin_0) {
    if (!_otherMin_0) {
      return { $: "GridFlags", ["otherMin"]: false, ["hasMin"]: false, ["hasOtherMin"]: false };
    } else {
      return { $: "GridFlags", ["otherMin"]: true, ["hasMin"]: true, ["hasOtherMin"]: false };
    }
  } else {
    if (!_otherMin_0) {
      return { $: "GridFlags", ["otherMin"]: false, ["hasMin"]: true, ["hasOtherMin"]: true };
    } else {
      return { $: "GridFlags", ["otherMin"]: false, ["hasMin"]: true, ["hasOtherMin"]: false };
    }
  }
}
function $panelFlags$(_minimized_0, _pinned_0) {
  return { $: "PanelFlags", ["minimized"]: _minimized_0, ["pinned"]: _pinned_0 };
}
function $navChrome$(_hasDoc_0, _atFirst_0, _atLast_0) {
  if (!_hasDoc_0) {
    return { $: "NavChrome", ["prevDisabled"]: true, ["nextDisabled"]: true };
  } else {
    return { $: "NavChrome", ["prevDisabled"]: _atFirst_0, ["nextDisabled"]: _atLast_0 };
  }
}
function $collapseTitle$(_minimized_0) {
  if (_minimized_0) {
    return "Restaurar este leitor";
  } else {
    return "Minimizar este leitor";
  }
}
function $disabledAttr$(_on_0) {
  return run_jump($view$attrWhen$, [_on_0, run_loop($view$attr$("disabled", "disabled"))]);
}
function $pageNumberValue$(_page_0) {
  return run_jump($Nat$show$, [_page_0]);
}
function $pageNumberMax$(_total_0) {
  return run_jump($Nat$show$, [_total_0]);
}
function $pageTotalText$(_n_0) {
  const _x_0 = run_loop($Nat$show$(_n_0));
  return "/ " + _x_0;
}
function $zoomLabelText$(_pct_0) {
  const _x_0 = run_loop($Nat$show$(_pct_0));
  return _x_0 + "%";
}
function $footReadyText$(_page_0, _total_0, _mode_0, _file_0) {
  const _x_0 = " · " + _file_0;
  const _x_1 = _mode_0 + _x_0;
  const _x_2 = run_loop($Nat$show$(_total_0));
  const _x_3 = " · " + _x_1;
  const _x_4 = _x_2 + _x_3;
  const _x_5 = run_loop($Nat$show$(_page_0));
  const _x_6 = " de " + _x_4;
  const _x_7 = _x_5 + _x_6;
  return "Página " + _x_7;
}
function $findCountChrome$shown$(_shown_0, _index_0, _total_0) {
  if (_shown_0) {
    const _x_0 = run_loop($Nat$show$(_total_0));
    const _x_1 = run_loop($Nat$show$(_index_0));
    const _x_2 = "/" + _x_0;
    return { $: "CountChrome", ["hidden"]: false, ["text"]: _x_1 + _x_2 };
  } else {
    const _x_3 = run_loop($Nat$show$(_total_0));
    return { $: "CountChrome", ["hidden"]: false, ["text"]: _x_3 + " ocorrências" };
  }
}
function $findCountChrome$(_hidden_0, _shown_0, _index_0, _total_0) {
  if (_hidden_0) {
    return { $: "CountChrome", ["hidden"]: true, ["text"]: "" };
  } else {
    return run_jump($findCountChrome$shown$, [_shown_0, _index_0, _total_0]);
  }
}
function $gridClass$(_selfMin_0, _otherMin_0) {
  if (!_selfMin_0) {
    if (!_otherMin_0) {
      return run_jump($view$classes$, [{ $: "Con", ["head"]: run_loop($view$classOn$("other-min", false)), ["tail"]: { $: "Con", ["head"]: run_loop($view$classOn$("has-min", false)), ["tail"]: { $: "Con", ["head"]: run_loop($view$classOn$("has-other-min", false)), ["tail"]: { $: "Nil" } } } }]);
    } else {
      return run_jump($view$classes$, [{ $: "Con", ["head"]: run_loop($view$classOn$("other-min", true)), ["tail"]: { $: "Con", ["head"]: run_loop($view$classOn$("has-min", true)), ["tail"]: { $: "Con", ["head"]: run_loop($view$classOn$("has-other-min", false)), ["tail"]: { $: "Nil" } } } }]);
    }
  } else {
    if (!_otherMin_0) {
      return run_jump($view$classes$, [{ $: "Con", ["head"]: run_loop($view$classOn$("other-min", false)), ["tail"]: { $: "Con", ["head"]: run_loop($view$classOn$("has-min", true)), ["tail"]: { $: "Con", ["head"]: run_loop($view$classOn$("has-other-min", true)), ["tail"]: { $: "Nil" } } } }]);
    } else {
      return run_jump($view$classes$, [{ $: "Con", ["head"]: run_loop($view$classOn$("other-min", false)), ["tail"]: { $: "Con", ["head"]: run_loop($view$classOn$("has-min", true)), ["tail"]: { $: "Con", ["head"]: run_loop($view$classOn$("has-other-min", false)), ["tail"]: { $: "Nil" } } } }]);
    }
  }
}
function $panelClass$(_minimized_0, _pinned_0) {
  return run_jump($view$classes$, [{ $: "Con", ["head"]: run_loop($view$classOn$("pdf-panel", true)), ["tail"]: { $: "Con", ["head"]: run_loop($view$classOn$("minimized", _minimized_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$classOn$("pinned", _pinned_0)), ["tail"]: { $: "Nil" } } } }]);
}
function $label$(_s_0) {
  return run_jump($view$viewText$, [_s_0]);
}
function $placeholder$() {
  return run_jump($view$viewEl$, ["div", { $: "Con", ["head"]: run_loop($view$attrClass$("pdf-placeholder")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($placeholderText$()))), ["tail"]: { $: "Nil" } }]);
}
function $pageTotalEmpty$() {
  return run_jump($view$viewText$, [run_loop($pageTotalDash$())]);
}
function $pageTotal$(_n_0) {
  return run_jump($view$viewText$, [run_loop($pageTotalText$(_n_0))]);
}
function $zoomLabel$(_pct_0) {
  return run_jump($view$viewText$, [run_loop($zoomLabelText$(_pct_0))]);
}
function $footLoading$() {
  return run_jump($view$viewText$, [run_loop($footLoadingText$())]);
}
function $footError$() {
  return run_jump($view$viewText$, [run_loop($footErrorText$())]);
}
function $footReady$(_page_0, _total_0, _mode_0, _file_0) {
  return run_jump($view$viewText$, [run_loop($footReadyText$(_page_0, _total_0, _mode_0, _file_0))]);
}
function $findCountLabel$(_c_0) {
  const _hidden_0 = _c_0["hidden"];
  const _text_0 = _c_0["text"];
  return run_jump($view$viewText$, [_text_0]);
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
function $Nat$show$(_n_0) {
  const _m_0 = _n_0;
  return run_jump($Nat$show$fin$, [_m_0, "", run_loop($Nat$show$put$(nat_divmod(_m_0, 10n)))]);
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
function $Nat$show$fin$(_g_0, _acc_0, _dq_0) {
  const _d_0 = _dq_0["fst"];
  const _t_0 = _dq_0["snd"];
  if (_t_0 === 0n) {
    return _d_0 + _acc_0;
  } else {
    const _p_0 = _t_0 - 1n;
    return run_jump($Nat$show$go$, [_g_0, nat_chk(_p_0 + 1n), _d_0 + _acc_0]);
  }
}
function $Nat$show$put$(_qr_0) {
  const _q_0 = _qr_0["fst"];
  const _r_0 = _qr_0["snd"];
  const _x_0 = nat_chk(48n + _r_0);
  return { $: "Tuple", ["fst"]: char_new(Number(_x_0 & 0xFFFFFFFFn)), ["snd"]: _q_0 };
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
function $Nat$show$go$(_f_0, _n_0, _acc_0) {
  if (_f_0 === 0n) {
    return _acc_0;
  } else {
    const _g_0 = _f_0 - 1n;
    return run_jump($Nat$show$fin$, [_g_0, _acc_0, run_loop($Nat$show$put$(nat_divmod(_n_0, 10n)))]);
  }
}
function $String$cmp$rec$(_h1b_0, _h2b_0, _rr_0) {
  const _t_0 = _rr_0["fst"];
  const _t1b_0 = _t_0["fst"];
  const _t2b_0 = _t_0["snd"];
  const _r_0 = _rr_0["snd"];
  return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: _h1b_0 + _t1b_0, ["snd"]: _h2b_0 + _t2b_0 }, ["snd"]: _r_0 };
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
  "view.viewMapText": run_lib($view$viewMapText$, 1),
  "view.asTextI": run_lib($view$asTextI$, 2),
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

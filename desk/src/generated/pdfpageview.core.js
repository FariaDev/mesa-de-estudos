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
function $pdfnav$maxName$() {
  return 60n;
}
function $pdfnav$maxPath$() {
  return BigInt(1024);
}
function $pdfnav$maxBookmarks$() {
  return 200n;
}
function $pdfnav$maxOutline$() {
  return 40n;
}
function $pdfnav$maxDepth$() {
  return 3n;
}
function $pdfnav$cutName$if$(_text_0, _limit_0, _over_0) {
  if (!_over_0) {
    return _text_0;
  } else {
    return run_jump($String$take$, [_text_0, _limit_0]);
  }
}
function $pdfnav$cutName$(_text_0, _limit_0) {
  return run_jump($pdfnav$cutName$if$, [_text_0, _limit_0, run_loop($Nat$is_gt$(BigInt([..._text_0].length), _limit_0))]);
}
function $pdfnav$fitName$(_text_0) {
  return run_jump($pdfnav$cutName$, [run_loop($String$trim$(_text_0)), run_loop($pdfnav$maxName$())]);
}
function $pdfnav$keepName$blank$(_blank_0) {
  if (_blank_0) {
    return false;
  } else {
    return true;
  }
}
function $pdfnav$keepName$(_name_0) {
  return run_jump($pdfnav$keepName$blank$, [run_loop($String$is_empty$(run_loop($String$trim$(_name_0))))]);
}
function $pdfnav$pageLabel$(_page_0) {
  const _x_0 = run_loop($Nat$show$(_page_0));
  return "p. " + _x_0;
}
function $pdfnav$bookmarkLabel$(_name_0) {
  return _name_0;
}
function $pdfnav$bookmarkTitle$(_name_0, _page_0) {
  const _x_0 = run_loop($pdfnav$pageLabel$(_page_0));
  const _x_1 = " na " + _x_0;
  const _x_2 = _name_0 + _x_1;
  return "Abrir " + _x_2;
}
function $pdfnav$bookmarkAria$(_name_0, _page_0) {
  const _x_0 = run_loop($pdfnav$pageLabel$(_page_0));
  const _x_1 = ", " + _x_0;
  const _x_2 = _name_0 + _x_1;
  return "Abrir o favorito " + _x_2;
}
function $pdfnav$removeLabel$() {
  return "Remover";
}
function $pdfnav$removeTitle$(_name_0) {
  return "Remover o favorito " + _name_0;
}
function $pdfnav$removeAria$(_name_0) {
  return "Remover o favorito " + _name_0;
}
function $pdfnav$saveLabel$() {
  return "Guardar esta página…";
}
function $pdfnav$saveTitle$() {
  return "Guardar a página aberta como favorito";
}
function $pdfnav$favoritesTitle$() {
  return "Favoritos desta matéria";
}
function $pdfnav$favoritesEmpty$() {
  return "Nenhum favorito nesta matéria.";
}
function $pdfnav$outlineTitle$() {
  return "Sumário deste PDF";
}
function $pdfnav$outlineEmpty$() {
  return "Este PDF não tem sumário.";
}
function $pdfnav$navButtonLabel$() {
  return "Sumário e favoritos";
}
function $pdfnav$navButtonTitle$() {
  return "Sumário e favoritos";
}
function $pdfnav$navAria$(_label_0) {
  return "Sumário e favoritos de " + _label_0;
}
function $pdfnav$navBackLabel$() {
  return "Voltar";
}
function $pdfnav$navBackTitle$() {
  return "Voltar à página anterior";
}
function $pdfnav$navBackAria$(_label_0) {
  return "Voltar à página anterior de " + _label_0;
}
function $pdfnav$bookmarkDialogTitle$() {
  return "Guardar esta página";
}
function $pdfnav$bookmarkNameLabel$() {
  return "Nome do favorito";
}
function $pdfnav$bookmarkDialogHint$(_name_0, _page_0) {
  const _x_0 = run_loop($pdfnav$pageLabel$(_page_0));
  const _x_1 = ", " + _x_0;
  return _name_0 + _x_1;
}
function $pdfnav$bookmarkSaveLabel$() {
  return "Salvar";
}
function $pdfnav$bookmarkCancelLabel$() {
  return "Cancelar";
}
function $pdfnav$pageFloor$if$(_page_0, _low_0) {
  if (_low_0) {
    return 1n;
  } else {
    return _page_0;
  }
}
function $pdfnav$pageFloor$(_page_0) {
  return run_jump($pdfnav$pageFloor$if$, [_page_0, _page_0 < 1n]);
}
function $pdfnav$fitPath$(_text_0) {
  return run_jump($pdfnav$cutName$, [run_loop($String$trim$(_text_0)), run_loop($pdfnav$maxPath$())]);
}
function $pdfnav$newBookmark$(_name_0, _path_0, _page_0) {
  return { $: "Bookmark", ["name"]: run_loop($pdfnav$fitName$(_name_0)), ["path"]: run_loop($pdfnav$fitPath$(_path_0)), ["page"]: run_loop($pdfnav$pageFloor$(_page_0)) };
}
function $pdfnav$keepBookmark$path$(_noPath_0) {
  if (_noPath_0) {
    return false;
  } else {
    return true;
  }
}
function $pdfnav$keepBookmark$(_bm_0) {
  const _name_0 = _bm_0["name"];
  const _path_0 = _bm_0["path"];
  const __0 = _bm_0["page"];
  return run_jump($Bool$and$, [run_loop($pdfnav$keepName$blank$(run_loop($String$is_empty$(run_loop($String$trim$(_name_0)))))), run_loop($pdfnav$keepBookmark$path$(run_loop($String$is_empty$(run_loop($String$trim$(_path_0))))))]);
}
function $pdfnav$sameBookmark$(_a_0, _b_0) {
  const _name_0 = _a_0["name"];
  const _path_0 = _a_0["path"];
  const __0 = _a_0["page"];
  const _name2_0 = _b_0["name"];
  const _path2_0 = _b_0["path"];
  const __1 = _b_0["page"];
  return run_jump($Bool$and$, [run_loop($String$eq$(_name_0, _name2_0)), run_loop($String$eq$(_path_0, _path2_0))]);
}
function $pdfnav$dropSame$head$(_h_0, _rest_0, _same_0) {
  if (_same_0) {
    return _rest_0;
  } else {
    return { $: "Con", ["head"]: _h_0, ["tail"]: _rest_0 };
  }
}
function $pdfnav$dropSame$go$(_bs_0, _bm_0) {
  if (_bs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _bs_0["head"];
    const _t_0 = _bs_0["tail"];
    return run_jump($pdfnav$dropSame$head$, [_h_0, run_loop($pdfnav$dropSame$go$(_t_0, _bm_0)), run_loop($pdfnav$sameBookmark$(_h_0, _bm_0))]);
  }
}
function $pdfnav$takeList$go$(_xs_0, _n_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    if (_n_0 === 0n) {
      return { $: "Nil" };
    } else {
      const _p_0 = _n_0 - 1n;
      return { $: "Con", ["head"]: _h_0, ["tail"]: run_loop($pdfnav$takeList$go$(_t_0, _p_0)) };
    }
  }
}
function $pdfnav$addBookmark$(_bs_0, _bm_0) {
  return run_jump($pdfnav$takeList$go$, [{ $: "Con", ["head"]: _bm_0, ["tail"]: run_loop($pdfnav$dropSame$go$(_bs_0, _bm_0)) }, run_loop($pdfnav$maxBookmarks$())]);
}
function $pdfnav$removeBookmark$(_bs_0, _bm_0) {
  return run_jump($pdfnav$dropSame$go$, [_bs_0, _bm_0]);
}
function $pdfnav$emptyBooks$(_bs_0) {
  return run_jump($Nat$is_eq$, [run_loop($List$length$(_bs_0)), 0n]);
}
function $pdfnav$emptyOutline$(_os_0) {
  return run_jump($Nat$is_eq$, [run_loop($List$length$(_os_0)), 0n]);
}
function $pdfnav$bookmarkRow$(_id_0, _bm_0, _currentPath_0) {
  const _name_0 = _bm_0["name"];
  const _path_0 = _bm_0["path"];
  const _page_0 = _bm_0["page"];
  return run_jump($view$viewEl$, ["div", { $: "Con", ["head"]: run_loop($view$attrClass$("nav-row")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewEl$("button", { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$classes$({ $: "Con", ["head"]: run_loop($view$classOn$("nav-bookmark", true)), ["tail"]: { $: "Con", ["head"]: run_loop($view$classOn$("current", run_loop($String$eq$(_path_0, _currentPath_0)))), ["tail"]: { $: "Nil" } } })), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("id", run_loop($Nat$show$(_id_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("page", run_loop($Nat$show$(_page_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("path", _path_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrTitle$(run_loop($pdfnav$bookmarkTitle$(_name_0, _page_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("label", run_loop($pdfnav$bookmarkAria$(_name_0, _page_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "OpenBookmark")), ["tail"]: { $: "Nil" } } } } } } } } }, { $: "Con", ["head"]: run_loop($view$viewEl$("span", { $: "Con", ["head"]: run_loop($view$attrClass$("nav-name")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($pdfnav$bookmarkLabel$(_name_0)))), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("span", { $: "Con", ["head"]: run_loop($view$attrClass$("nav-page")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($pdfnav$pageLabel$(_page_0)))), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Nil" } } })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("button", { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$classes$({ $: "Con", ["head"]: run_loop($view$classOn$("icon-btn", true)), ["tail"]: { $: "Con", ["head"]: run_loop($view$classOn$("nav-bookmark-remove", true)), ["tail"]: { $: "Nil" } } })), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("icon", "minus")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("id", run_loop($Nat$show$(_id_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrTitle$(run_loop($pdfnav$removeTitle$(_name_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("label", run_loop($pdfnav$removeAria$(_name_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "RemoveBookmark")), ["tail"]: { $: "Nil" } } } } } } } }, { $: "Nil" })), ["tail"]: { $: "Nil" } } }]);
}
function $pdfnav$bookmarkRows$go$(_bs_0, _currentPath_0, _i_0) {
  if (_bs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _bs_0["head"];
    const _t_0 = _bs_0["tail"];
    return { $: "Con", ["head"]: run_loop($pdfnav$bookmarkRow$(_i_0, _h_0, _currentPath_0)), ["tail"]: run_loop($pdfnav$bookmarkRows$go$(_t_0, _currentPath_0, nat_chk(_i_0 + 1n))) };
  }
}
function $pdfnav$bookmarkRows$(_bs_0, _currentPath_0) {
  return run_jump($pdfnav$bookmarkRows$go$, [_bs_0, _currentPath_0, 0n]);
}
function $pdfnav$clampDepth$if$(_depth_0, _over_0) {
  if (_over_0) {
    return run_jump($pdfnav$maxDepth$, []);
  } else {
    return _depth_0;
  }
}
function $pdfnav$clampDepth$(_depth_0) {
  return run_jump($pdfnav$clampDepth$if$, [_depth_0, run_loop($Nat$is_gt$(_depth_0, run_loop($pdfnav$maxDepth$())))]);
}
function $pdfnav$outlineDepth$(_depth_0) {
  return run_jump($Nat$show$, [run_loop($pdfnav$clampDepth$(_depth_0))]);
}
function $pdfnav$outlineLabel$(_title_0, _page_0) {
  const _x_0 = run_loop($Nat$show$(_page_0));
  const _x_1 = ": " + _title_0;
  const _x_2 = _x_0 + _x_1;
  return "Ir para a p. " + _x_2;
}
function $pdfnav$outlineRow$(_o_0) {
  const _title_0 = _o_0["title"];
  const _page_0 = _o_0["page"];
  const _depth_0 = _o_0["depth"];
  return run_jump($view$viewEl$, ["button", { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrClass$("nav-outline")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("depth", run_loop($pdfnav$outlineDepth$(_depth_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("page", run_loop($Nat$show$(_page_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrTitle$(run_loop($pdfnav$outlineLabel$(_title_0, _page_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("label", run_loop($pdfnav$outlineLabel$(_title_0, _page_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "OpenOutline")), ["tail"]: { $: "Nil" } } } } } } } }, { $: "Con", ["head"]: run_loop($view$viewText$(_title_0)), ["tail"]: { $: "Nil" } }]);
}
function $pdfnav$outlineRows$(_os_0) {
  return run_jump($view$viewMap$1$, [_os_0]);
}
function $pdfnav$navEmpty$(_text_0) {
  return run_jump($view$viewEl$, ["p", { $: "Con", ["head"]: run_loop($view$attrClass$("nav-empty")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$(_text_0)), ["tail"]: { $: "Nil" } }]);
}
function $pdfnav$navSaveButton$() {
  return run_jump($view$viewEl$, ["button", { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrClass$("nav-save")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrTitle$(run_loop($pdfnav$saveTitle$()))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("label", run_loop($pdfnav$saveTitle$()))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "SaveBookmark")), ["tail"]: { $: "Nil" } } } } } }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($pdfnav$saveLabel$()))), ["tail"]: { $: "Nil" } }]);
}
function $pdfnav$navSection$(_title_0, _empty_0, _emptyText_0, _rows_0) {
  return run_jump($view$viewEl$, ["div", { $: "Con", ["head"]: run_loop($view$attrClass$("nav-section")), ["tail"]: { $: "Nil" } }, run_loop($view$viewJoin$({ $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$viewEl$("h4", { $: "Nil" }, { $: "Con", ["head"]: run_loop($view$viewText$(_title_0)), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Nil" } }, ["tail"]: { $: "Con", ["head"]: run_loop($view$viewWhen$(_empty_0, run_loop($pdfnav$navEmpty$(_emptyText_0)))), ["tail"]: { $: "Con", ["head"]: _rows_0, ["tail"]: { $: "Nil" } } } }))]);
}
function $pdfnav$navPopover$(_open_0, _bs_0, _os_0, _currentPath_0) {
  return run_jump($view$viewEl$, ["div", run_loop($view$attrJoin$({ $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$classes$({ $: "Con", ["head"]: run_loop($view$classOn$("pdf-nav-pop", true)), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Nil" } }, ["tail"]: { $: "Con", ["head"]: run_loop($view$attrWhen$(run_loop($Bool$not$(_open_0)), run_loop($view$attr$("hidden", "")))), ["tail"]: { $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrAria$("label", run_loop($pdfnav$navButtonTitle$()))), ["tail"]: { $: "Nil" } }, ["tail"]: { $: "Nil" } } } })), { $: "Con", ["head"]: run_loop($pdfnav$navSaveButton$()), ["tail"]: { $: "Con", ["head"]: run_loop($pdfnav$navSection$(run_loop($pdfnav$favoritesTitle$()), run_loop($pdfnav$emptyBooks$(_bs_0)), run_loop($pdfnav$favoritesEmpty$()), run_loop($pdfnav$bookmarkRows$(_bs_0, _currentPath_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($pdfnav$navSection$(run_loop($pdfnav$outlineTitle$()), run_loop($pdfnav$emptyOutline$(_os_0)), run_loop($pdfnav$outlineEmpty$()), run_loop($pdfnav$outlineRows$(_os_0)))), ["tail"]: { $: "Nil" } } } }]);
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
function $pdfview$gridFlags$(_selfMin_0, _otherMin_0) {
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
function $pdfview$panelFlags$(_minimized_0, _pinned_0) {
  return { $: "PanelFlags", ["minimized"]: _minimized_0, ["pinned"]: _pinned_0 };
}
function $pdfview$navChrome$(_hasDoc_0, _atFirst_0, _atLast_0) {
  if (!_hasDoc_0) {
    return { $: "NavChrome", ["prevDisabled"]: true, ["nextDisabled"]: true };
  } else {
    return { $: "NavChrome", ["prevDisabled"]: _atFirst_0, ["nextDisabled"]: _atLast_0 };
  }
}
function $pdfview$collapseTitle$(_minimized_0) {
  if (_minimized_0) {
    return "Restaurar este leitor";
  } else {
    return "Minimizar este leitor";
  }
}
function $pdfview$disabledAttr$(_on_0) {
  return run_jump($view$attrWhen$, [_on_0, run_loop($view$attr$("disabled", "disabled"))]);
}
function $pdfview$pageNumberValue$(_page_0) {
  return run_jump($Nat$show$, [_page_0]);
}
function $pdfview$pageNumberMax$(_total_0) {
  return run_jump($Nat$show$, [_total_0]);
}
function $pdfview$pageTotalText$(_n_0) {
  const _x_0 = run_loop($Nat$show$(_n_0));
  return "/ " + _x_0;
}
function $pdfview$zoomLabelText$(_pct_0) {
  const _x_0 = run_loop($Nat$show$(_pct_0));
  return _x_0 + "%";
}
function $pdfview$footReadyText$(_page_0, _total_0, _mode_0, _file_0) {
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
function $pdfview$findCountChrome$shown$(_shown_0, _index_0, _total_0) {
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
function $pdfview$findCountChrome$(_hidden_0, _shown_0, _index_0, _total_0) {
  if (_hidden_0) {
    return { $: "CountChrome", ["hidden"]: true, ["text"]: "" };
  } else {
    return run_jump($pdfview$findCountChrome$shown$, [_shown_0, _index_0, _total_0]);
  }
}
function $pdfview$gridClass$(_selfMin_0, _otherMin_0) {
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
function $pdfview$panelClass$(_minimized_0, _pinned_0) {
  return run_jump($view$classes$, [{ $: "Con", ["head"]: run_loop($view$classOn$("pdf-panel", true)), ["tail"]: { $: "Con", ["head"]: run_loop($view$classOn$("minimized", _minimized_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$classOn$("pinned", _pinned_0)), ["tail"]: { $: "Nil" } } } }]);
}
function $pdfview$label$(_s_0) {
  return run_jump($view$viewText$, [_s_0]);
}
function $pdfview$placeholder$() {
  return run_jump($view$viewEl$, ["div", { $: "Con", ["head"]: run_loop($view$attrClass$("pdf-placeholder")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($pdfview$placeholderText$()))), ["tail"]: { $: "Nil" } }]);
}
function $pdfview$pageTotalEmpty$() {
  return run_jump($view$viewText$, [run_loop($pdfview$pageTotalDash$())]);
}
function $pdfview$pageTotal$(_n_0) {
  return run_jump($view$viewText$, [run_loop($pdfview$pageTotalText$(_n_0))]);
}
function $pdfview$zoomLabel$(_pct_0) {
  return run_jump($view$viewText$, [run_loop($pdfview$zoomLabelText$(_pct_0))]);
}
function $pdfview$footLoading$() {
  return run_jump($view$viewText$, [run_loop($pdfview$footLoadingText$())]);
}
function $pdfview$footError$() {
  return run_jump($view$viewText$, [run_loop($pdfview$footErrorText$())]);
}
function $pdfview$footReady$(_page_0, _total_0, _mode_0, _file_0) {
  return run_jump($view$viewText$, [run_loop($pdfview$footReadyText$(_page_0, _total_0, _mode_0, _file_0))]);
}
function $pdfview$findCountLabel$(_c_0) {
  const _hidden_0 = _c_0["hidden"];
  const _text_0 = _c_0["text"];
  return run_jump($view$viewText$, [_text_0]);
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
function $documentAria$(_label_0) {
  return "Documento de " + _label_0;
}
function $openAria$(_label_0) {
  return "Abrir PDF em " + _label_0;
}
function $findAria$(_label_0) {
  return "Buscar em " + _label_0;
}
function $pageAria$(_label_0) {
  return "Página de " + _label_0;
}
function $rotationStep$() {
  return 90n;
}
function $rotationNext$(_rotation_0) {
  const _x_0 = run_loop($rotationStep$());
  return run_jump($Nat$mod$, [nat_chk(_rotation_0 + _x_0), BigInt(360)]);
}
function $rotationValid$(_rotation_0) {
  if (_rotation_0 === 0n) {
    return true;
  } else if (_rotation_0 === 1n) {
    const _5_0 = _rotation_0 - 1n;
    return false;
  } else if (_rotation_0 === 2n) {
    const _6_0 = _rotation_0 - 2n;
    return false;
  } else if (_rotation_0 === 3n) {
    const _7_0 = _rotation_0 - 3n;
    return false;
  } else if (_rotation_0 === 4n) {
    const _8_0 = _rotation_0 - 4n;
    return false;
  } else if (_rotation_0 === 5n) {
    const _9_0 = _rotation_0 - 5n;
    return false;
  } else if (_rotation_0 === 6n) {
    const _10_0 = _rotation_0 - 6n;
    return false;
  } else if (_rotation_0 === 7n) {
    const _11_0 = _rotation_0 - 7n;
    return false;
  } else if (_rotation_0 === 8n) {
    const _12_0 = _rotation_0 - 8n;
    return false;
  } else if (_rotation_0 === 9n) {
    const _13_0 = _rotation_0 - 9n;
    return false;
  } else if (_rotation_0 === 10n) {
    const _14_0 = _rotation_0 - 10n;
    return false;
  } else if (_rotation_0 === 11n) {
    const _15_0 = _rotation_0 - 11n;
    return false;
  } else if (_rotation_0 === 12n) {
    const _16_0 = _rotation_0 - 12n;
    return false;
  } else if (_rotation_0 === 13n) {
    const _17_0 = _rotation_0 - 13n;
    return false;
  } else if (_rotation_0 === 14n) {
    const _18_0 = _rotation_0 - 14n;
    return false;
  } else if (_rotation_0 === 15n) {
    const _19_0 = _rotation_0 - 15n;
    return false;
  } else if (_rotation_0 === 16n) {
    const _20_0 = _rotation_0 - 16n;
    return false;
  } else if (_rotation_0 === 17n) {
    const _21_0 = _rotation_0 - 17n;
    return false;
  } else if (_rotation_0 === 18n) {
    const _22_0 = _rotation_0 - 18n;
    return false;
  } else if (_rotation_0 === 19n) {
    const _23_0 = _rotation_0 - 19n;
    return false;
  } else if (_rotation_0 === 20n) {
    const _24_0 = _rotation_0 - 20n;
    return false;
  } else if (_rotation_0 === 21n) {
    const _25_0 = _rotation_0 - 21n;
    return false;
  } else if (_rotation_0 === 22n) {
    const _26_0 = _rotation_0 - 22n;
    return false;
  } else if (_rotation_0 === 23n) {
    const _27_0 = _rotation_0 - 23n;
    return false;
  } else if (_rotation_0 === 24n) {
    const _28_0 = _rotation_0 - 24n;
    return false;
  } else if (_rotation_0 === 25n) {
    const _29_0 = _rotation_0 - 25n;
    return false;
  } else if (_rotation_0 === 26n) {
    const _30_0 = _rotation_0 - 26n;
    return false;
  } else if (_rotation_0 === 27n) {
    const _31_0 = _rotation_0 - 27n;
    return false;
  } else if (_rotation_0 === 28n) {
    const _32_0 = _rotation_0 - 28n;
    return false;
  } else if (_rotation_0 === 29n) {
    const _33_0 = _rotation_0 - 29n;
    return false;
  } else if (_rotation_0 === 30n) {
    const _34_0 = _rotation_0 - 30n;
    return false;
  } else if (_rotation_0 === 31n) {
    const _35_0 = _rotation_0 - 31n;
    return false;
  } else if (_rotation_0 === 32n) {
    const _36_0 = _rotation_0 - 32n;
    return false;
  } else if (_rotation_0 === 33n) {
    const _37_0 = _rotation_0 - 33n;
    return false;
  } else if (_rotation_0 === 34n) {
    const _38_0 = _rotation_0 - 34n;
    return false;
  } else if (_rotation_0 === 35n) {
    const _39_0 = _rotation_0 - 35n;
    return false;
  } else if (_rotation_0 === 36n) {
    const _40_0 = _rotation_0 - 36n;
    return false;
  } else if (_rotation_0 === 37n) {
    const _41_0 = _rotation_0 - 37n;
    return false;
  } else if (_rotation_0 === 38n) {
    const _42_0 = _rotation_0 - 38n;
    return false;
  } else if (_rotation_0 === 39n) {
    const _43_0 = _rotation_0 - 39n;
    return false;
  } else if (_rotation_0 === 40n) {
    const _44_0 = _rotation_0 - 40n;
    return false;
  } else if (_rotation_0 === 41n) {
    const _45_0 = _rotation_0 - 41n;
    return false;
  } else if (_rotation_0 === 42n) {
    const _46_0 = _rotation_0 - 42n;
    return false;
  } else if (_rotation_0 === 43n) {
    const _47_0 = _rotation_0 - 43n;
    return false;
  } else if (_rotation_0 === 44n) {
    const _48_0 = _rotation_0 - 44n;
    return false;
  } else if (_rotation_0 === 45n) {
    const _49_0 = _rotation_0 - 45n;
    return false;
  } else if (_rotation_0 === 46n) {
    const _50_0 = _rotation_0 - 46n;
    return false;
  } else if (_rotation_0 === 47n) {
    const _51_0 = _rotation_0 - 47n;
    return false;
  } else if (_rotation_0 === 48n) {
    const _52_0 = _rotation_0 - 48n;
    return false;
  } else if (_rotation_0 === 49n) {
    const _53_0 = _rotation_0 - 49n;
    return false;
  } else if (_rotation_0 === 50n) {
    const _54_0 = _rotation_0 - 50n;
    return false;
  } else if (_rotation_0 === 51n) {
    const _55_0 = _rotation_0 - 51n;
    return false;
  } else if (_rotation_0 === 52n) {
    const _56_0 = _rotation_0 - 52n;
    return false;
  } else if (_rotation_0 === 53n) {
    const _57_0 = _rotation_0 - 53n;
    return false;
  } else if (_rotation_0 === 54n) {
    const _58_0 = _rotation_0 - 54n;
    return false;
  } else if (_rotation_0 === 55n) {
    const _59_0 = _rotation_0 - 55n;
    return false;
  } else if (_rotation_0 === 56n) {
    const _60_0 = _rotation_0 - 56n;
    return false;
  } else if (_rotation_0 === 57n) {
    const _61_0 = _rotation_0 - 57n;
    return false;
  } else if (_rotation_0 === 58n) {
    const _62_0 = _rotation_0 - 58n;
    return false;
  } else if (_rotation_0 === 59n) {
    const _63_0 = _rotation_0 - 59n;
    return false;
  } else if (_rotation_0 === 60n) {
    const _64_0 = _rotation_0 - 60n;
    return false;
  } else if (_rotation_0 === 61n) {
    const _65_0 = _rotation_0 - 61n;
    return false;
  } else if (_rotation_0 === 62n) {
    const _66_0 = _rotation_0 - 62n;
    return false;
  } else if (_rotation_0 === 63n) {
    const _67_0 = _rotation_0 - 63n;
    return false;
  } else if (_rotation_0 === 64n) {
    const _68_0 = _rotation_0 - 64n;
    return false;
  } else if (_rotation_0 === 65n) {
    const _69_0 = _rotation_0 - 65n;
    return false;
  } else if (_rotation_0 === 66n) {
    const _70_0 = _rotation_0 - 66n;
    return false;
  } else if (_rotation_0 === 67n) {
    const _71_0 = _rotation_0 - 67n;
    return false;
  } else if (_rotation_0 === 68n) {
    const _72_0 = _rotation_0 - 68n;
    return false;
  } else if (_rotation_0 === 69n) {
    const _73_0 = _rotation_0 - 69n;
    return false;
  } else if (_rotation_0 === 70n) {
    const _74_0 = _rotation_0 - 70n;
    return false;
  } else if (_rotation_0 === 71n) {
    const _75_0 = _rotation_0 - 71n;
    return false;
  } else if (_rotation_0 === 72n) {
    const _76_0 = _rotation_0 - 72n;
    return false;
  } else if (_rotation_0 === 73n) {
    const _77_0 = _rotation_0 - 73n;
    return false;
  } else if (_rotation_0 === 74n) {
    const _78_0 = _rotation_0 - 74n;
    return false;
  } else if (_rotation_0 === 75n) {
    const _79_0 = _rotation_0 - 75n;
    return false;
  } else if (_rotation_0 === 76n) {
    const _80_0 = _rotation_0 - 76n;
    return false;
  } else if (_rotation_0 === 77n) {
    const _81_0 = _rotation_0 - 77n;
    return false;
  } else if (_rotation_0 === 78n) {
    const _82_0 = _rotation_0 - 78n;
    return false;
  } else if (_rotation_0 === 79n) {
    const _83_0 = _rotation_0 - 79n;
    return false;
  } else if (_rotation_0 === 80n) {
    const _84_0 = _rotation_0 - 80n;
    return false;
  } else if (_rotation_0 === 81n) {
    const _85_0 = _rotation_0 - 81n;
    return false;
  } else if (_rotation_0 === 82n) {
    const _86_0 = _rotation_0 - 82n;
    return false;
  } else if (_rotation_0 === 83n) {
    const _87_0 = _rotation_0 - 83n;
    return false;
  } else if (_rotation_0 === 84n) {
    const _88_0 = _rotation_0 - 84n;
    return false;
  } else if (_rotation_0 === 85n) {
    const _89_0 = _rotation_0 - 85n;
    return false;
  } else if (_rotation_0 === 86n) {
    const _90_0 = _rotation_0 - 86n;
    return false;
  } else if (_rotation_0 === 87n) {
    const _91_0 = _rotation_0 - 87n;
    return false;
  } else if (_rotation_0 === 88n) {
    const _92_0 = _rotation_0 - 88n;
    return false;
  } else if (_rotation_0 === 89n) {
    const _93_0 = _rotation_0 - 89n;
    return false;
  } else if (_rotation_0 === 90n) {
    return true;
  } else if (_rotation_0 === 91n) {
    const _95_0 = _rotation_0 - 91n;
    return false;
  } else if (_rotation_0 === 92n) {
    const _96_0 = _rotation_0 - 92n;
    return false;
  } else if (_rotation_0 === 93n) {
    const _97_0 = _rotation_0 - 93n;
    return false;
  } else if (_rotation_0 === 94n) {
    const _98_0 = _rotation_0 - 94n;
    return false;
  } else if (_rotation_0 === 95n) {
    const _99_0 = _rotation_0 - 95n;
    return false;
  } else if (_rotation_0 === 96n) {
    const _100_0 = _rotation_0 - 96n;
    return false;
  } else if (_rotation_0 === 97n) {
    const _101_0 = _rotation_0 - 97n;
    return false;
  } else if (_rotation_0 === 98n) {
    const _102_0 = _rotation_0 - 98n;
    return false;
  } else if (_rotation_0 === 99n) {
    const _103_0 = _rotation_0 - 99n;
    return false;
  } else if (_rotation_0 === 100n) {
    const _104_0 = _rotation_0 - 100n;
    return false;
  } else if (_rotation_0 === 101n) {
    const _105_0 = _rotation_0 - 101n;
    return false;
  } else if (_rotation_0 === 102n) {
    const _106_0 = _rotation_0 - 102n;
    return false;
  } else if (_rotation_0 === 103n) {
    const _107_0 = _rotation_0 - 103n;
    return false;
  } else if (_rotation_0 === 104n) {
    const _108_0 = _rotation_0 - 104n;
    return false;
  } else if (_rotation_0 === 105n) {
    const _109_0 = _rotation_0 - 105n;
    return false;
  } else if (_rotation_0 === 106n) {
    const _110_0 = _rotation_0 - 106n;
    return false;
  } else if (_rotation_0 === 107n) {
    const _111_0 = _rotation_0 - 107n;
    return false;
  } else if (_rotation_0 === 108n) {
    const _112_0 = _rotation_0 - 108n;
    return false;
  } else if (_rotation_0 === 109n) {
    const _113_0 = _rotation_0 - 109n;
    return false;
  } else if (_rotation_0 === 110n) {
    const _114_0 = _rotation_0 - 110n;
    return false;
  } else if (_rotation_0 === 111n) {
    const _115_0 = _rotation_0 - 111n;
    return false;
  } else if (_rotation_0 === 112n) {
    const _116_0 = _rotation_0 - 112n;
    return false;
  } else if (_rotation_0 === 113n) {
    const _117_0 = _rotation_0 - 113n;
    return false;
  } else if (_rotation_0 === 114n) {
    const _118_0 = _rotation_0 - 114n;
    return false;
  } else if (_rotation_0 === 115n) {
    const _119_0 = _rotation_0 - 115n;
    return false;
  } else if (_rotation_0 === 116n) {
    const _120_0 = _rotation_0 - 116n;
    return false;
  } else if (_rotation_0 === 117n) {
    const _121_0 = _rotation_0 - 117n;
    return false;
  } else if (_rotation_0 === 118n) {
    const _122_0 = _rotation_0 - 118n;
    return false;
  } else if (_rotation_0 === 119n) {
    const _123_0 = _rotation_0 - 119n;
    return false;
  } else if (_rotation_0 === 120n) {
    const _124_0 = _rotation_0 - 120n;
    return false;
  } else if (_rotation_0 === 121n) {
    const _125_0 = _rotation_0 - 121n;
    return false;
  } else if (_rotation_0 === 122n) {
    const _126_0 = _rotation_0 - 122n;
    return false;
  } else if (_rotation_0 === 123n) {
    const _127_0 = _rotation_0 - 123n;
    return false;
  } else if (_rotation_0 === 124n) {
    const _128_0 = _rotation_0 - 124n;
    return false;
  } else if (_rotation_0 === 125n) {
    const _129_0 = _rotation_0 - 125n;
    return false;
  } else if (_rotation_0 === 126n) {
    const _130_0 = _rotation_0 - 126n;
    return false;
  } else if (_rotation_0 === 127n) {
    const _131_0 = _rotation_0 - 127n;
    return false;
  } else if (_rotation_0 === 128n) {
    const _132_0 = _rotation_0 - 128n;
    return false;
  } else if (_rotation_0 === 129n) {
    const _133_0 = _rotation_0 - 129n;
    return false;
  } else if (_rotation_0 === 130n) {
    const _134_0 = _rotation_0 - 130n;
    return false;
  } else if (_rotation_0 === 131n) {
    const _135_0 = _rotation_0 - 131n;
    return false;
  } else if (_rotation_0 === 132n) {
    const _136_0 = _rotation_0 - 132n;
    return false;
  } else if (_rotation_0 === 133n) {
    const _137_0 = _rotation_0 - 133n;
    return false;
  } else if (_rotation_0 === 134n) {
    const _138_0 = _rotation_0 - 134n;
    return false;
  } else if (_rotation_0 === 135n) {
    const _139_0 = _rotation_0 - 135n;
    return false;
  } else if (_rotation_0 === 136n) {
    const _140_0 = _rotation_0 - 136n;
    return false;
  } else if (_rotation_0 === 137n) {
    const _141_0 = _rotation_0 - 137n;
    return false;
  } else if (_rotation_0 === 138n) {
    const _142_0 = _rotation_0 - 138n;
    return false;
  } else if (_rotation_0 === 139n) {
    const _143_0 = _rotation_0 - 139n;
    return false;
  } else if (_rotation_0 === 140n) {
    const _144_0 = _rotation_0 - 140n;
    return false;
  } else if (_rotation_0 === 141n) {
    const _145_0 = _rotation_0 - 141n;
    return false;
  } else if (_rotation_0 === 142n) {
    const _146_0 = _rotation_0 - 142n;
    return false;
  } else if (_rotation_0 === 143n) {
    const _147_0 = _rotation_0 - 143n;
    return false;
  } else if (_rotation_0 === 144n) {
    const _148_0 = _rotation_0 - 144n;
    return false;
  } else if (_rotation_0 === 145n) {
    const _149_0 = _rotation_0 - 145n;
    return false;
  } else if (_rotation_0 === 146n) {
    const _150_0 = _rotation_0 - 146n;
    return false;
  } else if (_rotation_0 === 147n) {
    const _151_0 = _rotation_0 - 147n;
    return false;
  } else if (_rotation_0 === 148n) {
    const _152_0 = _rotation_0 - 148n;
    return false;
  } else if (_rotation_0 === 149n) {
    const _153_0 = _rotation_0 - 149n;
    return false;
  } else if (_rotation_0 === 150n) {
    const _154_0 = _rotation_0 - 150n;
    return false;
  } else if (_rotation_0 === 151n) {
    const _155_0 = _rotation_0 - 151n;
    return false;
  } else if (_rotation_0 === 152n) {
    const _156_0 = _rotation_0 - 152n;
    return false;
  } else if (_rotation_0 === 153n) {
    const _157_0 = _rotation_0 - 153n;
    return false;
  } else if (_rotation_0 === 154n) {
    const _158_0 = _rotation_0 - 154n;
    return false;
  } else if (_rotation_0 === 155n) {
    const _159_0 = _rotation_0 - 155n;
    return false;
  } else if (_rotation_0 === 156n) {
    const _160_0 = _rotation_0 - 156n;
    return false;
  } else if (_rotation_0 === 157n) {
    const _161_0 = _rotation_0 - 157n;
    return false;
  } else if (_rotation_0 === 158n) {
    const _162_0 = _rotation_0 - 158n;
    return false;
  } else if (_rotation_0 === 159n) {
    const _163_0 = _rotation_0 - 159n;
    return false;
  } else if (_rotation_0 === 160n) {
    const _164_0 = _rotation_0 - 160n;
    return false;
  } else if (_rotation_0 === 161n) {
    const _165_0 = _rotation_0 - 161n;
    return false;
  } else if (_rotation_0 === 162n) {
    const _166_0 = _rotation_0 - 162n;
    return false;
  } else if (_rotation_0 === 163n) {
    const _167_0 = _rotation_0 - 163n;
    return false;
  } else if (_rotation_0 === 164n) {
    const _168_0 = _rotation_0 - 164n;
    return false;
  } else if (_rotation_0 === 165n) {
    const _169_0 = _rotation_0 - 165n;
    return false;
  } else if (_rotation_0 === 166n) {
    const _170_0 = _rotation_0 - 166n;
    return false;
  } else if (_rotation_0 === 167n) {
    const _171_0 = _rotation_0 - 167n;
    return false;
  } else if (_rotation_0 === 168n) {
    const _172_0 = _rotation_0 - 168n;
    return false;
  } else if (_rotation_0 === 169n) {
    const _173_0 = _rotation_0 - 169n;
    return false;
  } else if (_rotation_0 === 170n) {
    const _174_0 = _rotation_0 - 170n;
    return false;
  } else if (_rotation_0 === 171n) {
    const _175_0 = _rotation_0 - 171n;
    return false;
  } else if (_rotation_0 === 172n) {
    const _176_0 = _rotation_0 - 172n;
    return false;
  } else if (_rotation_0 === 173n) {
    const _177_0 = _rotation_0 - 173n;
    return false;
  } else if (_rotation_0 === 174n) {
    const _178_0 = _rotation_0 - 174n;
    return false;
  } else if (_rotation_0 === 175n) {
    const _179_0 = _rotation_0 - 175n;
    return false;
  } else if (_rotation_0 === 176n) {
    const _180_0 = _rotation_0 - 176n;
    return false;
  } else if (_rotation_0 === 177n) {
    const _181_0 = _rotation_0 - 177n;
    return false;
  } else if (_rotation_0 === 178n) {
    const _182_0 = _rotation_0 - 178n;
    return false;
  } else if (_rotation_0 === 179n) {
    const _183_0 = _rotation_0 - 179n;
    return false;
  } else if (_rotation_0 === 180n) {
    return true;
  } else if (_rotation_0 === 181n) {
    const _185_0 = _rotation_0 - 181n;
    return false;
  } else if (_rotation_0 === 182n) {
    const _186_0 = _rotation_0 - 182n;
    return false;
  } else if (_rotation_0 === 183n) {
    const _187_0 = _rotation_0 - 183n;
    return false;
  } else if (_rotation_0 === 184n) {
    const _188_0 = _rotation_0 - 184n;
    return false;
  } else if (_rotation_0 === 185n) {
    const _189_0 = _rotation_0 - 185n;
    return false;
  } else if (_rotation_0 === 186n) {
    const _190_0 = _rotation_0 - 186n;
    return false;
  } else if (_rotation_0 === 187n) {
    const _191_0 = _rotation_0 - 187n;
    return false;
  } else if (_rotation_0 === 188n) {
    const _192_0 = _rotation_0 - 188n;
    return false;
  } else if (_rotation_0 === 189n) {
    const _193_0 = _rotation_0 - 189n;
    return false;
  } else if (_rotation_0 === 190n) {
    const _194_0 = _rotation_0 - 190n;
    return false;
  } else if (_rotation_0 === 191n) {
    const _195_0 = _rotation_0 - 191n;
    return false;
  } else if (_rotation_0 === 192n) {
    const _196_0 = _rotation_0 - 192n;
    return false;
  } else if (_rotation_0 === 193n) {
    const _197_0 = _rotation_0 - 193n;
    return false;
  } else if (_rotation_0 === 194n) {
    const _198_0 = _rotation_0 - 194n;
    return false;
  } else if (_rotation_0 === 195n) {
    const _199_0 = _rotation_0 - 195n;
    return false;
  } else if (_rotation_0 === 196n) {
    const _200_0 = _rotation_0 - 196n;
    return false;
  } else if (_rotation_0 === 197n) {
    const _201_0 = _rotation_0 - 197n;
    return false;
  } else if (_rotation_0 === 198n) {
    const _202_0 = _rotation_0 - 198n;
    return false;
  } else if (_rotation_0 === 199n) {
    const _203_0 = _rotation_0 - 199n;
    return false;
  } else if (_rotation_0 === 200n) {
    const _204_0 = _rotation_0 - 200n;
    return false;
  } else if (_rotation_0 === 201n) {
    const _205_0 = _rotation_0 - 201n;
    return false;
  } else if (_rotation_0 === 202n) {
    const _206_0 = _rotation_0 - 202n;
    return false;
  } else if (_rotation_0 === 203n) {
    const _207_0 = _rotation_0 - 203n;
    return false;
  } else if (_rotation_0 === 204n) {
    const _208_0 = _rotation_0 - 204n;
    return false;
  } else if (_rotation_0 === 205n) {
    const _209_0 = _rotation_0 - 205n;
    return false;
  } else if (_rotation_0 === 206n) {
    const _210_0 = _rotation_0 - 206n;
    return false;
  } else if (_rotation_0 === 207n) {
    const _211_0 = _rotation_0 - 207n;
    return false;
  } else if (_rotation_0 === 208n) {
    const _212_0 = _rotation_0 - 208n;
    return false;
  } else if (_rotation_0 === 209n) {
    const _213_0 = _rotation_0 - 209n;
    return false;
  } else if (_rotation_0 === 210n) {
    const _214_0 = _rotation_0 - 210n;
    return false;
  } else if (_rotation_0 === 211n) {
    const _215_0 = _rotation_0 - 211n;
    return false;
  } else if (_rotation_0 === 212n) {
    const _216_0 = _rotation_0 - 212n;
    return false;
  } else if (_rotation_0 === 213n) {
    const _217_0 = _rotation_0 - 213n;
    return false;
  } else if (_rotation_0 === 214n) {
    const _218_0 = _rotation_0 - 214n;
    return false;
  } else if (_rotation_0 === 215n) {
    const _219_0 = _rotation_0 - 215n;
    return false;
  } else if (_rotation_0 === 216n) {
    const _220_0 = _rotation_0 - 216n;
    return false;
  } else if (_rotation_0 === 217n) {
    const _221_0 = _rotation_0 - 217n;
    return false;
  } else if (_rotation_0 === 218n) {
    const _222_0 = _rotation_0 - 218n;
    return false;
  } else if (_rotation_0 === 219n) {
    const _223_0 = _rotation_0 - 219n;
    return false;
  } else if (_rotation_0 === 220n) {
    const _224_0 = _rotation_0 - 220n;
    return false;
  } else if (_rotation_0 === 221n) {
    const _225_0 = _rotation_0 - 221n;
    return false;
  } else if (_rotation_0 === 222n) {
    const _226_0 = _rotation_0 - 222n;
    return false;
  } else if (_rotation_0 === 223n) {
    const _227_0 = _rotation_0 - 223n;
    return false;
  } else if (_rotation_0 === 224n) {
    const _228_0 = _rotation_0 - 224n;
    return false;
  } else if (_rotation_0 === 225n) {
    const _229_0 = _rotation_0 - 225n;
    return false;
  } else if (_rotation_0 === 226n) {
    const _230_0 = _rotation_0 - 226n;
    return false;
  } else if (_rotation_0 === 227n) {
    const _231_0 = _rotation_0 - 227n;
    return false;
  } else if (_rotation_0 === 228n) {
    const _232_0 = _rotation_0 - 228n;
    return false;
  } else if (_rotation_0 === 229n) {
    const _233_0 = _rotation_0 - 229n;
    return false;
  } else if (_rotation_0 === 230n) {
    const _234_0 = _rotation_0 - 230n;
    return false;
  } else if (_rotation_0 === 231n) {
    const _235_0 = _rotation_0 - 231n;
    return false;
  } else if (_rotation_0 === 232n) {
    const _236_0 = _rotation_0 - 232n;
    return false;
  } else if (_rotation_0 === 233n) {
    const _237_0 = _rotation_0 - 233n;
    return false;
  } else if (_rotation_0 === 234n) {
    const _238_0 = _rotation_0 - 234n;
    return false;
  } else if (_rotation_0 === 235n) {
    const _239_0 = _rotation_0 - 235n;
    return false;
  } else if (_rotation_0 === 236n) {
    const _240_0 = _rotation_0 - 236n;
    return false;
  } else if (_rotation_0 === 237n) {
    const _241_0 = _rotation_0 - 237n;
    return false;
  } else if (_rotation_0 === 238n) {
    const _242_0 = _rotation_0 - 238n;
    return false;
  } else if (_rotation_0 === 239n) {
    const _243_0 = _rotation_0 - 239n;
    return false;
  } else if (_rotation_0 === 240n) {
    const _244_0 = _rotation_0 - 240n;
    return false;
  } else if (_rotation_0 === 241n) {
    const _245_0 = _rotation_0 - 241n;
    return false;
  } else if (_rotation_0 === 242n) {
    const _246_0 = _rotation_0 - 242n;
    return false;
  } else if (_rotation_0 === 243n) {
    const _247_0 = _rotation_0 - 243n;
    return false;
  } else if (_rotation_0 === 244n) {
    const _248_0 = _rotation_0 - 244n;
    return false;
  } else if (_rotation_0 === 245n) {
    const _249_0 = _rotation_0 - 245n;
    return false;
  } else if (_rotation_0 === 246n) {
    const _250_0 = _rotation_0 - 246n;
    return false;
  } else if (_rotation_0 === 247n) {
    const _251_0 = _rotation_0 - 247n;
    return false;
  } else if (_rotation_0 === 248n) {
    const _252_0 = _rotation_0 - 248n;
    return false;
  } else if (_rotation_0 === 249n) {
    const _253_0 = _rotation_0 - 249n;
    return false;
  } else if (_rotation_0 === 250n) {
    const _254_0 = _rotation_0 - 250n;
    return false;
  } else if (_rotation_0 === 251n) {
    const _255_0 = _rotation_0 - 251n;
    return false;
  } else if (_rotation_0 === 252n) {
    const _256_0 = _rotation_0 - 252n;
    return false;
  } else if (_rotation_0 === 253n) {
    const _257_0 = _rotation_0 - 253n;
    return false;
  } else if (_rotation_0 === 254n) {
    const _258_0 = _rotation_0 - 254n;
    return false;
  } else if (_rotation_0 === 255n) {
    const _259_0 = _rotation_0 - 255n;
    return false;
  } else if (_rotation_0 === 256n) {
    const _260_0 = _rotation_0 - 256n;
    return false;
  } else if (_rotation_0 === 257n) {
    const _261_0 = _rotation_0 - 257n;
    return false;
  } else if (_rotation_0 === 258n) {
    const _262_0 = _rotation_0 - 258n;
    return false;
  } else if (_rotation_0 === 259n) {
    const _263_0 = _rotation_0 - 259n;
    return false;
  } else if (_rotation_0 === 260n) {
    const _264_0 = _rotation_0 - 260n;
    return false;
  } else if (_rotation_0 === 261n) {
    const _265_0 = _rotation_0 - 261n;
    return false;
  } else if (_rotation_0 === 262n) {
    const _266_0 = _rotation_0 - 262n;
    return false;
  } else if (_rotation_0 === 263n) {
    const _267_0 = _rotation_0 - 263n;
    return false;
  } else if (_rotation_0 === 264n) {
    const _268_0 = _rotation_0 - 264n;
    return false;
  } else if (_rotation_0 === 265n) {
    const _269_0 = _rotation_0 - 265n;
    return false;
  } else if (_rotation_0 === 266n) {
    const _270_0 = _rotation_0 - 266n;
    return false;
  } else if (_rotation_0 === 267n) {
    const _271_0 = _rotation_0 - 267n;
    return false;
  } else if (_rotation_0 === 268n) {
    const _272_0 = _rotation_0 - 268n;
    return false;
  } else if (_rotation_0 === 269n) {
    const _273_0 = _rotation_0 - 269n;
    return false;
  } else if (_rotation_0 === 270n) {
    return true;
  } else {
    const _274_0 = _rotation_0 - 270n;
    return false;
  }
}
function $rotationNormalize$if$(_rotation_0, _valid_0) {
  if (_valid_0) {
    return _rotation_0;
  } else {
    return 0n;
  }
}
function $rotationNormalize$(_rotation_0) {
  return run_jump($rotationNormalize$if$, [_rotation_0, run_loop($rotationValid$(_rotation_0))]);
}
function $rotateTitle$(_rotation_0) {
  const _x_0 = run_loop($Nat$show$(_rotation_0));
  const _x_1 = _x_0 + "°";
  return "Girar 90° — orientação atual: " + _x_1;
}
function $rotateAria$(_label_0, _rotation_0) {
  const _x_0 = run_loop($Nat$show$(_rotation_0));
  const _x_1 = _x_0 + "°)";
  const _x_2 = " (atual: " + _x_1;
  const _x_3 = _label_0 + _x_2;
  return "Girar página de " + _x_3;
}
function $rotateToast$(_rotation_0) {
  const _x_0 = run_loop($Nat$show$(_rotation_0));
  const _x_1 = _x_0 + "°";
  return "Orientação: " + _x_1;
}
function $optionKids$(_name_0) {
  return { $: "Con", ["head"]: run_loop($view$viewText$(_name_0)), ["tail"]: { $: "Nil" } };
}
function $optionNode$(_option_0, _path_0) {
  const _name_0 = _option_0["name"];
  const _optionPath_0 = _option_0["path"];
  return run_jump($view$viewEl$, ["option", run_loop($view$attrJoin$({ $: "Con", ["head"]: { $: "Con", ["head"]: { $: "ViewAttr", ["name"]: "value", ["value"]: _optionPath_0 }, ["tail"]: { $: "Nil" } }, ["tail"]: { $: "Con", ["head"]: run_loop($view$attrWhen$(run_loop($String$eq$(_optionPath_0, _path_0)), { $: "ViewAttr", ["name"]: "selected", ["value"]: "" })), ["tail"]: { $: "Nil" } } })), run_loop($optionKids$(_name_0))]);
}
function $optionEmpty$() {
  return run_jump($view$viewEl$, ["option", { $: "Con", ["head"]: { $: "ViewAttr", ["name"]: "value", ["value"]: "" }, ["tail"]: { $: "Nil" } }, run_loop($optionKids$(run_loop($emptyOptionLabel$())))]);
}
function $optionNodes$go$(_options_0, _path_0) {
  if (_options_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _options_0["head"];
    const _t_0 = _options_0["tail"];
    return { $: "Con", ["head"]: run_loop($optionNode$(_h_0, _path_0)), ["tail"]: run_loop($optionNodes$go$(_t_0, _path_0)) };
  }
}
function $optionNodes$(_options_0, _path_0) {
  return { $: "Con", ["head"]: run_loop($optionEmpty$()), ["tail"]: run_loop($optionNodes$go$(_options_0, _path_0)) };
}
function $selectNode$(_label_0, _options_0, _path_0) {
  return run_jump($view$viewEl$, ["select", { $: "Con", ["head"]: run_loop($view$attrClass$("pdf-select")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("label", run_loop($documentAria$(_label_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("change", "OpenDoc")), ["tail"]: { $: "Nil" } } } }, run_loop($optionNodes$(_options_0, _path_0))]);
}
function $iconBtnAttrs$(_cls_0, _iconName_0, _aria_0) {
  return { $: "Con", ["head"]: run_loop($view$attrClass$(_cls_0 + " icon-btn")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("label", _aria_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("icon", _iconName_0)), ["tail"]: { $: "Nil" } } } };
}
function $openBtn$(_label_0) {
  return run_jump($view$viewEl$, ["button", run_loop($view$attrJoin$({ $: "Con", ["head"]: run_loop($iconBtnAttrs$("open", "plus", run_loop($openAria$(_label_0)))), ["tail"]: { $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrTitle$(run_loop($openTitle$()))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "OpenFile")), ["tail"]: { $: "Nil" } } }, ["tail"]: { $: "Nil" } } })), { $: "Nil" }]);
}
function $findToggleBtn$(_label_0, _open_0) {
  return run_jump($view$viewEl$, ["button", run_loop($view$attrJoin$({ $: "Con", ["head"]: run_loop($iconBtnAttrs$("find-toggle", "search", run_loop($findAria$(_label_0)))), ["tail"]: { $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrTitle$(run_loop($findTitle$()))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrBool$("aria-pressed", _open_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "ToggleFind")), ["tail"]: { $: "Nil" } } } }, ["tail"]: { $: "Nil" } } })), { $: "Nil" }]);
}
function $shotBtn$(_label_0) {
  return run_jump($view$viewEl$, ["button", run_loop($view$attrJoin$({ $: "Con", ["head"]: run_loop($iconBtnAttrs$("page-shot", "camera", run_loop($shotTitle$()))), ["tail"]: { $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrTitle$(run_loop($shotTitle$()))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "PageShot")), ["tail"]: { $: "Nil" } } }, ["tail"]: { $: "Nil" } } })), { $: "Nil" }]);
}
function $collapseIcon$(_minimized_0) {
  if (_minimized_0) {
    return "chevronUp";
  } else {
    return "chevronDown";
  }
}
function $collapseBtn$(_minimized_0) {
  const _title_0 = run_loop($pdfview$collapseTitle$(_minimized_0));
  return run_jump($view$viewEl$, ["button", run_loop($view$attrJoin$({ $: "Con", ["head"]: run_loop($iconBtnAttrs$("collapse", run_loop($collapseIcon$(_minimized_0)), _title_0)), ["tail"]: { $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrTitle$(_title_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrBool$("aria-pressed", _minimized_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "ToggleCollapse")), ["tail"]: { $: "Nil" } } } }, ["tail"]: { $: "Nil" } } })), { $: "Nil" }]);
}
function $navBackTitle$() {
  return run_jump($pdfnav$navBackTitle$, []);
}
function $navBackAria$(_label_0) {
  return run_jump($pdfnav$navBackAria$, [_label_0]);
}
function $navBtn$(_label_0) {
  return run_jump($view$viewEl$, ["button", run_loop($view$attrJoin$({ $: "Con", ["head"]: run_loop($iconBtnAttrs$("nav", "book", run_loop($pdfnav$navAria$(_label_0)))), ["tail"]: { $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrTitle$(run_loop($pdfnav$navButtonTitle$()))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrBool$("aria-expanded", false)), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "ToggleNav")), ["tail"]: { $: "Nil" } } } }, ["tail"]: { $: "Nil" } } })), { $: "Nil" }]);
}
function $backBtn$(_label_0) {
  return run_jump($view$viewEl$, ["button", run_loop($view$attrJoin$({ $: "Con", ["head"]: run_loop($iconBtnAttrs$("back", "chevronLeft", run_loop($navBackAria$(_label_0)))), ["tail"]: { $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrTitle$(run_loop($navBackTitle$()))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "NavBack")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attr$("hidden", "")), ["tail"]: { $: "Nil" } } } }, ["tail"]: { $: "Nil" } } })), { $: "Nil" }]);
}
function $titleBar$(_shell_0) {
  const _label_0 = _shell_0["label"];
  const _options_0 = _shell_0["options"];
  const _path_0 = _shell_0["path"];
  const _minimized_0 = _shell_0["minimized"];
  const _findOpen_0 = _shell_0["findOpen"];
  const _rotation_0 = _shell_0["rotation"];
  return run_jump($view$viewEl$, ["div", { $: "Con", ["head"]: run_loop($view$attrClass$("pdf-title")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewEl$("strong", { $: "Nil" }, { $: "Con", ["head"]: run_loop($view$viewText$(_label_0)), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Con", ["head"]: run_loop($selectNode$(_label_0, _options_0, _path_0)), ["tail"]: { $: "Con", ["head"]: run_loop($openBtn$(_label_0)), ["tail"]: { $: "Con", ["head"]: run_loop($findToggleBtn$(_label_0, _findOpen_0)), ["tail"]: { $: "Con", ["head"]: run_loop($shotBtn$(_label_0)), ["tail"]: { $: "Con", ["head"]: run_loop($backBtn$(_label_0)), ["tail"]: { $: "Con", ["head"]: run_loop($navBtn$(_label_0)), ["tail"]: { $: "Con", ["head"]: run_loop($collapseBtn$(_minimized_0)), ["tail"]: { $: "Nil" } } } } } } } } }]);
}
function $iconBtn$(_cls_0, _iconName_0, _aria_0, _handler_0) {
  return run_jump($view$viewEl$, ["button", run_loop($view$attrConcat$(run_loop($iconBtnAttrs$(_cls_0, _iconName_0, _aria_0)), { $: "Con", ["head"]: run_loop($view$attrOn$("click", _handler_0)), ["tail"]: { $: "Nil" } })), { $: "Nil" }]);
}
function $titleIconBtn$(_cls_0, _iconName_0, _title_0, _aria_0, _handler_0) {
  return run_jump($view$viewEl$, ["button", run_loop($view$attrJoin$({ $: "Con", ["head"]: run_loop($iconBtnAttrs$(_cls_0, _iconName_0, _aria_0)), ["tail"]: { $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrTitle$(_title_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", _handler_0)), ["tail"]: { $: "Nil" } } }, ["tail"]: { $: "Nil" } } })), { $: "Nil" }]);
}
function $rotateBtn$(_label_0, _rotation_0) {
  return run_jump($view$viewEl$, ["button", run_loop($view$attrJoin$({ $: "Con", ["head"]: run_loop($iconBtnAttrs$("rotate", "rotateCw", run_loop($rotateAria$(_label_0, _rotation_0)))), ["tail"]: { $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrTitle$(run_loop($rotateTitle$(_rotation_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "Rotate")), ["tail"]: { $: "Nil" } } }, ["tail"]: { $: "Nil" } } })), { $: "Con", ["head"]: run_loop($view$viewText$("Girar")), ["tail"]: { $: "Nil" } }]);
}
function $pageInput$(_label_0) {
  return run_jump($view$viewEl$, ["input", { $: "Con", ["head"]: run_loop($view$attrClass$("page-number")), ["tail"]: { $: "Con", ["head"]: { $: "ViewAttr", ["name"]: "type", ["value"]: "number" }, ["tail"]: { $: "Con", ["head"]: { $: "ViewAttr", ["name"]: "min", ["value"]: "1" }, ["tail"]: { $: "Con", ["head"]: { $: "ViewAttr", ["name"]: "value", ["value"]: "1" }, ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("label", run_loop($pageAria$(_label_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("change", "GotoPage")), ["tail"]: { $: "Nil" } } } } } } }, { $: "Nil" }]);
}
function $toolsBar$(_label_0, _rotation_0) {
  return run_jump($view$viewEl$, ["div", { $: "Con", ["head"]: run_loop($view$attrClass$("pdf-tools")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($iconBtn$("prev", "chevronLeft", run_loop($prevAria$()), "Prev")), ["tail"]: { $: "Con", ["head"]: run_loop($pageInput$(_label_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("span", { $: "Con", ["head"]: run_loop($view$attrClass$("page-total")), ["tail"]: { $: "Nil" } }, { $: "Nil" })), ["tail"]: { $: "Con", ["head"]: run_loop($iconBtn$("next", "chevronRight", run_loop($nextAria$()), "Next")), ["tail"]: { $: "Con", ["head"]: run_loop($iconBtn$("out", "minus", run_loop($outAria$()), "ZoomOut")), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("span", { $: "Con", ["head"]: run_loop($view$attrClass$("zoom-label")), ["tail"]: { $: "Nil" } }, { $: "Nil" })), ["tail"]: { $: "Con", ["head"]: run_loop($iconBtn$("in", "plus", run_loop($inAria$()), "ZoomIn")), ["tail"]: { $: "Con", ["head"]: run_loop($titleIconBtn$("fit", "unfold", run_loop($fitTitle$()), run_loop($fitTitle$()), "Fit")), ["tail"]: { $: "Con", ["head"]: run_loop($titleIconBtn$("invert", "contrast", run_loop($invertTitle$()), run_loop($invertAria$()), "ToggleInvert")), ["tail"]: { $: "Con", ["head"]: run_loop($rotateBtn$(_label_0, _rotation_0)), ["tail"]: { $: "Nil" } } } } } } } } } } }]);
}
function $stage$() {
  return run_jump($view$viewEl$, ["div", { $: "Con", ["head"]: run_loop($view$attrClass$("pdf-stage")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewEl$("div", { $: "Con", ["head"]: run_loop($view$attrClass$("pdf-viewport")), ["tail"]: { $: "Nil" } }, { $: "Nil" })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("div", { $: "Con", ["head"]: run_loop($view$attrClass$("pdf-foot")), ["tail"]: { $: "Nil" } }, { $: "Nil" })), ["tail"]: { $: "Nil" } } }]);
}
function $findForm$(_label_0) {
  return run_jump($view$viewEl$, ["form", { $: "Con", ["head"]: run_loop($view$attrClass$("pdf-find")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("submit", "Find")), ["tail"]: { $: "Con", ["head"]: { $: "ViewAttr", ["name"]: "hidden", ["value"]: "" }, ["tail"]: { $: "Nil" } } } }, { $: "Con", ["head"]: run_loop($view$viewEl$("input", { $: "Con", ["head"]: { $: "ViewAttr", ["name"]: "placeholder", ["value"]: run_loop($findPlaceholder$()) }, ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("label", run_loop($findAria$(_label_0)))), ["tail"]: { $: "Nil" } } }, { $: "Nil" })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("span", { $: "Con", ["head"]: run_loop($view$attrClass$("find-count")), ["tail"]: { $: "Con", ["head"]: { $: "ViewAttr", ["name"]: "hidden", ["value"]: "" }, ["tail"]: { $: "Nil" } } }, { $: "Nil" })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("button", { $: "Nil" }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($findButtonLabel$()))), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Nil" } } } }]);
}
function $panelShell$(_shell_0) {
  const _label_0 = _shell_0["label"];
  const _options_0 = _shell_0["options"];
  const _path_0 = _shell_0["path"];
  const _minimized_0 = _shell_0["minimized"];
  const _findOpen_0 = _shell_0["findOpen"];
  const _rotation_0 = _shell_0["rotation"];
  return run_jump($view$viewEl$, ["section", { $: "Con", ["head"]: run_loop($pdfview$panelClass$(_minimized_0, false)), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("label", _label_0)), ["tail"]: { $: "Con", ["head"]: { $: "ViewAttr", ["name"]: "tabindex", ["value"]: "0" }, ["tail"]: { $: "Nil" } } } }, { $: "Con", ["head"]: run_loop($titleBar$({ $: "PdfShell", ["label"]: _label_0, ["options"]: _options_0, ["path"]: _path_0, ["minimized"]: _minimized_0, ["findOpen"]: _findOpen_0, ["rotation"]: _rotation_0 })), ["tail"]: { $: "Con", ["head"]: run_loop($toolsBar$(_label_0, _rotation_0)), ["tail"]: { $: "Con", ["head"]: run_loop($stage$()), ["tail"]: { $: "Con", ["head"]: run_loop($findForm$(_label_0)), ["tail"]: { $: "Nil" } } } } }]);
}
function $divider$() {
  return run_jump($view$viewEl$, ["div", { $: "Con", ["head"]: run_loop($view$attrClass$("pdf-divider")), ["tail"]: { $: "Con", ["head"]: { $: "ViewAttr", ["name"]: "tabindex", ["value"]: "0" }, ["tail"]: { $: "Con", ["head"]: { $: "ViewAttr", ["name"]: "role", ["value"]: "separator" }, ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("label", run_loop($dividerAria$()))), ["tail"]: { $: "Nil" } } } } }, { $: "Nil" }]);
}
function $pageStyle$(_width_0, _height_0) {
  const _x_0 = ";height:" + _height_0;
  const _x_1 = _width_0 + _x_0;
  return "width:" + _x_1;
}
function $pageNode$(_box_0) {
  const _n_0 = _box_0["n"];
  const _width_0 = _box_0["width"];
  const _height_0 = _box_0["height"];
  return run_jump($view$viewEl$, ["div", { $: "Con", ["head"]: run_loop($view$attrClass$("pdf-page")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("page", run_loop($Nat$show$(_n_0)))), ["tail"]: { $: "Con", ["head"]: { $: "ViewAttr", ["name"]: "style", ["value"]: run_loop($pageStyle$(_width_0, _height_0)) }, ["tail"]: { $: "Nil" } } } }, { $: "Nil" }]);
}
function $pageNodes$(_boxes_0) {
  if (_boxes_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _boxes_0["head"];
    const _t_0 = _boxes_0["tail"];
    return { $: "Con", ["head"]: run_loop($pageNode$(_h_0)), ["tail"]: run_loop($pageNodes$(_t_0)) };
  }
}
function $docFrame$(_boxes_0) {
  return run_jump($view$viewEl$, ["div", { $: "Con", ["head"]: run_loop($view$attrClass$("pdf-document")), ["tail"]: { $: "Nil" } }, run_loop($pageNodes$(_boxes_0))]);
}
function $viewport$(_state_0, _boxes_0) {
  if (_state_0.$ === "PdfEmpty") {
    return { $: "Some", ["value"]: run_loop($pdfview$placeholder$()) };
  } else if (_state_0.$ === "PdfReady") {
    return { $: "Some", ["value"]: run_loop($docFrame$(_boxes_0)) };
  } else if (_state_0.$ === "PdfLoading") {
    return { $: "None" };
  } else {
    return { $: "None" };
  }
}
function $hlPush$(_seg_0, _out_0) {
  return { $: "Con", ["head"]: _seg_0, ["tail"]: _out_0 };
}
function $hlFlush$if$(_pend_0, _out_0, _empty_0) {
  if (_empty_0) {
    return _out_0;
  } else {
    return run_jump($hlPush$, [{ $: "PdfHlSeg", ["text"]: run_loop($String$reverse$(_pend_0)), ["hit"]: false }, _out_0]);
  }
}
function $hlFlush$(_pend_0, _out_0) {
  return run_jump($hlFlush$if$, [_pend_0, _out_0, run_loop($String$is_empty$(_pend_0))]);
}
function $hlScan$(_text_0, _folded_0, _term_0, _n_0, _rem_0, _fact_0, _pend_0, _out_0) {
  if (_text_0 === "") {
    return run_jump($hlFlush$, [_pend_0, _out_0]);
  } else {
    const __0 = _text_0.codePointAt(0) > 65535 ? _text_0.slice(0, 2) : _text_0[0];
    const _t_0 = _text_0.codePointAt(0) > 65535 ? _text_0.slice(2) : _text_0.slice(1);
    if (_rem_0 === "") {
      if (_fact_0) {
        return run_jump($hlScan$, [_t_0, run_loop($String$drop$(_folded_0, 1n)), _term_0, _n_0, run_loop($String$drop$(_term_0, 1n)), run_loop($String$starts_with$(run_loop($String$drop$(_folded_0, 1n)), _term_0)), "", run_loop($hlPush$({ $: "PdfHlSeg", ["text"]: run_loop($String$take$(__0 + _t_0, _n_0)), ["hit"]: true }, run_loop($hlFlush$(_pend_0, _out_0))))]);
      } else {
        const _x_0 = run_loop($String$take$(__0 + _t_0, 1n));
        return run_jump($hlScan$, [_t_0, run_loop($String$drop$(_folded_0, 1n)), _term_0, _n_0, "", run_loop($String$starts_with$(run_loop($String$drop$(_folded_0, 1n)), _term_0)), _x_0 + _pend_0, _out_0]);
      }
    } else {
      const __1 = _rem_0.codePointAt(0) > 65535 ? _rem_0.slice(0, 2) : _rem_0[0];
      const _rs_0 = _rem_0.codePointAt(0) > 65535 ? _rem_0.slice(2) : _rem_0.slice(1);
      return run_jump($hlScan$, [_t_0, run_loop($String$drop$(_folded_0, 1n)), _term_0, _n_0, _rs_0, run_loop($String$starts_with$(run_loop($String$drop$(_folded_0, 1n)), _term_0)), _pend_0, _out_0]);
    }
  }
}
function $hlNode$go$(_text_0, _hit_0) {
  if (_hit_0) {
    return run_jump($view$viewEl$, ["i", { $: "Con", ["head"]: run_loop($view$attrClass$("pdf-hl")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$(_text_0)), ["tail"]: { $: "Nil" } }]);
  } else {
    return run_jump($view$viewText$, [_text_0]);
  }
}
function $hlNode$(_seg_0) {
  const _text_0 = _seg_0["text"];
  const _hit_0 = _seg_0["hit"];
  return run_jump($hlNode$go$, [_text_0, _hit_0]);
}
function $hlNodes$(_segs_0, _acc_0) {
  if (_segs_0.$ === "Nil") {
    return _acc_0;
  } else {
    const _h_0 = _segs_0["head"];
    const _t_0 = _segs_0["tail"];
    return run_jump($hlNodes$, [_t_0, { $: "Con", ["head"]: run_loop($hlNode$(_h_0)), ["tail"]: _acc_0 }]);
  }
}
function $hlSegments$if$(_text_0, _folded_0, _term_0, _empty_0) {
  if (_empty_0) {
    return { $: "Con", ["head"]: run_loop($view$viewText$(_text_0)), ["tail"]: { $: "Nil" } };
  } else {
    return run_jump($hlNodes$, [run_loop($hlScan$(_text_0, _folded_0, _term_0, BigInt([..._term_0].length), "", run_loop($String$starts_with$(_folded_0, _term_0)), "", { $: "Nil" })), { $: "Nil" }]);
  }
}
function $hlSegments$(_text_0, _folded_0, _term_0) {
  return run_jump($hlSegments$if$, [_text_0, _folded_0, _term_0, run_loop($String$is_empty$(_term_0))]);
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
function $Nat$show$(_n_0) {
  const _m_0 = _n_0;
  return run_jump($Nat$show$fin$, [_m_0, "", run_loop($Nat$show$put$(nat_divmod(_m_0, 10n)))]);
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
function $List$length$(_xs_0) {
  if (_xs_0.$ === "Nil") {
    return 0n;
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return nat_chk(run_loop($List$length$(_t_0)) + 1n);
  }
}
function $view$viewMap$1$(_xs_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return { $: "Con", ["head"]: run_loop($pdfnav$outlineRow$(_h_0)), ["tail"]: run_loop($view$viewMap$1$(_t_0)) };
  }
}
function $Bool$not$(_b_0) {
  if (!_b_0) {
    return true;
  } else {
    return false;
  }
}
function $Nat$mod$(_a_0, _b_0) {
  return run_jump($Nat$mod$fin$, [nat_divmod(_a_0, _b_0)]);
}
function $String$reverse$(_s_0) {
  return run_jump($String$reverse$go$, [_s_0, ""]);
}
function $String$drop$(_s_0, _n_0) {
  if (_s_0 === "") {
    return "";
  } else {
    const _h_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(0, 2) : _s_0[0];
    const _t_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(2) : _s_0.slice(1);
    if (_n_0 === 0n) {
      return _h_0 + _t_0;
    } else {
      const _p_0 = _n_0 - 1n;
      return run_jump($String$drop$, [_t_0, _p_0]);
    }
  }
}
function $String$starts_with$(_s_0, _p_0) {
  if (_s_0 === "") {
    if (_p_0 === "") {
      return true;
    } else {
      const _h_0 = _p_0.codePointAt(0) > 65535 ? _p_0.slice(0, 2) : _p_0[0];
      const _t_0 = _p_0.codePointAt(0) > 65535 ? _p_0.slice(2) : _p_0.slice(1);
      return false;
    }
  } else {
    const _h_1 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(0, 2) : _s_0[0];
    const _t_1 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(2) : _s_0.slice(1);
    if (_p_0 === "") {
      return true;
    } else {
      const _y_0 = _p_0.codePointAt(0) > 65535 ? _p_0.slice(0, 2) : _p_0[0];
      const _yt_0 = _p_0.codePointAt(0) > 65535 ? _p_0.slice(2) : _p_0.slice(1);
      return run_jump($String$starts_with$if$, [_t_1, _yt_0, run_loop($Char$is_eq$(_h_1, _y_0))]);
    }
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
function $Nat$mod$fin$(_qr_0) {
  const _q_0 = _qr_0["fst"];
  const _r_0 = _qr_0["snd"];
  return _r_0;
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
function $String$starts_with$if$(_t_0, _pt_0, _same_0) {
  if (!_same_0) {
    return false;
  } else {
    return run_jump($String$starts_with$, [_t_0, _pt_0]);
  }
}
function $Char$is_eq$(_a_0, _b_0) {
  const _x_0 = _a_0.codePointAt(0);
  const _y_0 = _b_0.codePointAt(0);
  return _x_0 === _y_0;
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
  "view.viewMapText": run_lib($view$viewMapText$, 1),
  "view.asTextI": run_lib($view$asTextI$, 2),
  "view.viewMapTextI.go": run_lib($view$viewMapTextI$go$, 2),
  "view.viewMapTextI": run_lib($view$viewMapTextI$, 1),
  "pdfnav.maxName": run_lib($pdfnav$maxName$, 0),
  "pdfnav.maxPath": run_lib($pdfnav$maxPath$, 0),
  "pdfnav.maxBookmarks": run_lib($pdfnav$maxBookmarks$, 0),
  "pdfnav.maxOutline": run_lib($pdfnav$maxOutline$, 0),
  "pdfnav.maxDepth": run_lib($pdfnav$maxDepth$, 0),
  "pdfnav.cutName.if": run_lib($pdfnav$cutName$if$, 3),
  "pdfnav.cutName": run_lib($pdfnav$cutName$, 2),
  "pdfnav.fitName": run_lib($pdfnav$fitName$, 1),
  "pdfnav.keepName.blank": run_lib($pdfnav$keepName$blank$, 1),
  "pdfnav.keepName": run_lib($pdfnav$keepName$, 1),
  "pdfnav.pageLabel": run_lib($pdfnav$pageLabel$, 1),
  "pdfnav.bookmarkLabel": run_lib($pdfnav$bookmarkLabel$, 1),
  "pdfnav.bookmarkTitle": run_lib($pdfnav$bookmarkTitle$, 2),
  "pdfnav.bookmarkAria": run_lib($pdfnav$bookmarkAria$, 2),
  "pdfnav.removeLabel": run_lib($pdfnav$removeLabel$, 0),
  "pdfnav.removeTitle": run_lib($pdfnav$removeTitle$, 1),
  "pdfnav.removeAria": run_lib($pdfnav$removeAria$, 1),
  "pdfnav.saveLabel": run_lib($pdfnav$saveLabel$, 0),
  "pdfnav.saveTitle": run_lib($pdfnav$saveTitle$, 0),
  "pdfnav.favoritesTitle": run_lib($pdfnav$favoritesTitle$, 0),
  "pdfnav.favoritesEmpty": run_lib($pdfnav$favoritesEmpty$, 0),
  "pdfnav.outlineTitle": run_lib($pdfnav$outlineTitle$, 0),
  "pdfnav.outlineEmpty": run_lib($pdfnav$outlineEmpty$, 0),
  "pdfnav.navButtonLabel": run_lib($pdfnav$navButtonLabel$, 0),
  "pdfnav.navButtonTitle": run_lib($pdfnav$navButtonTitle$, 0),
  "pdfnav.navAria": run_lib($pdfnav$navAria$, 1),
  "pdfnav.navBackLabel": run_lib($pdfnav$navBackLabel$, 0),
  "pdfnav.navBackTitle": run_lib($pdfnav$navBackTitle$, 0),
  "pdfnav.navBackAria": run_lib($pdfnav$navBackAria$, 1),
  "pdfnav.bookmarkDialogTitle": run_lib($pdfnav$bookmarkDialogTitle$, 0),
  "pdfnav.bookmarkNameLabel": run_lib($pdfnav$bookmarkNameLabel$, 0),
  "pdfnav.bookmarkDialogHint": run_lib($pdfnav$bookmarkDialogHint$, 2),
  "pdfnav.bookmarkSaveLabel": run_lib($pdfnav$bookmarkSaveLabel$, 0),
  "pdfnav.bookmarkCancelLabel": run_lib($pdfnav$bookmarkCancelLabel$, 0),
  "pdfnav.pageFloor.if": run_lib($pdfnav$pageFloor$if$, 2),
  "pdfnav.pageFloor": run_lib($pdfnav$pageFloor$, 1),
  "pdfnav.fitPath": run_lib($pdfnav$fitPath$, 1),
  "pdfnav.newBookmark": run_lib($pdfnav$newBookmark$, 3),
  "pdfnav.keepBookmark.path": run_lib($pdfnav$keepBookmark$path$, 1),
  "pdfnav.keepBookmark": run_lib($pdfnav$keepBookmark$, 1),
  "pdfnav.sameBookmark": run_lib($pdfnav$sameBookmark$, 2),
  "pdfnav.dropSame.head": run_lib($pdfnav$dropSame$head$, 3),
  "pdfnav.dropSame.go": run_lib($pdfnav$dropSame$go$, 2),
  "pdfnav.takeList.go": run_lib($pdfnav$takeList$go$, 2),
  "pdfnav.addBookmark": run_lib($pdfnav$addBookmark$, 2),
  "pdfnav.removeBookmark": run_lib($pdfnav$removeBookmark$, 2),
  "pdfnav.emptyBooks": run_lib($pdfnav$emptyBooks$, 1),
  "pdfnav.emptyOutline": run_lib($pdfnav$emptyOutline$, 1),
  "pdfnav.bookmarkRow": run_lib($pdfnav$bookmarkRow$, 3),
  "pdfnav.bookmarkRows.go": run_lib($pdfnav$bookmarkRows$go$, 3),
  "pdfnav.bookmarkRows": run_lib($pdfnav$bookmarkRows$, 2),
  "pdfnav.clampDepth.if": run_lib($pdfnav$clampDepth$if$, 2),
  "pdfnav.clampDepth": run_lib($pdfnav$clampDepth$, 1),
  "pdfnav.outlineDepth": run_lib($pdfnav$outlineDepth$, 1),
  "pdfnav.outlineLabel": run_lib($pdfnav$outlineLabel$, 2),
  "pdfnav.outlineRow": run_lib($pdfnav$outlineRow$, 1),
  "pdfnav.outlineRows": run_lib($pdfnav$outlineRows$, 1),
  "pdfnav.navEmpty": run_lib($pdfnav$navEmpty$, 1),
  "pdfnav.navSaveButton": run_lib($pdfnav$navSaveButton$, 0),
  "pdfnav.navSection": run_lib($pdfnav$navSection$, 4),
  "pdfnav.navPopover": run_lib($pdfnav$navPopover$, 4),
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
  rotationStep: run_lib($rotationStep$, 0),
  rotationNext: run_lib($rotationNext$, 1),
  rotationValid: run_lib($rotationValid$, 1),
  "rotationNormalize.if": run_lib($rotationNormalize$if$, 2),
  rotationNormalize: run_lib($rotationNormalize$, 1),
  rotateTitle: run_lib($rotateTitle$, 1),
  rotateAria: run_lib($rotateAria$, 2),
  rotateToast: run_lib($rotateToast$, 1),
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
  navBackTitle: run_lib($navBackTitle$, 0),
  navBackAria: run_lib($navBackAria$, 1),
  navBtn: run_lib($navBtn$, 1),
  backBtn: run_lib($backBtn$, 1),
  titleBar: run_lib($titleBar$, 1),
  iconBtn: run_lib($iconBtn$, 4),
  titleIconBtn: run_lib($titleIconBtn$, 5),
  rotateBtn: run_lib($rotateBtn$, 2),
  pageInput: run_lib($pageInput$, 1),
  toolsBar: run_lib($toolsBar$, 2),
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

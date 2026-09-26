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
  return "Navegar";
}
function $pdfnav$navButtonTitle$() {
  return "Favoritos e sumário";
}
function $pdfnav$navAria$(_label_0) {
  return "Navegar em " + _label_0;
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
  return run_jump($view$viewEl$, ["div", { $: "Con", ["head"]: run_loop($view$attrClass$("pdf-title")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewEl$("strong", { $: "Nil" }, { $: "Con", ["head"]: run_loop($view$viewText$(_label_0)), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Con", ["head"]: run_loop($selectNode$(_label_0, _options_0, _path_0)), ["tail"]: { $: "Con", ["head"]: run_loop($openBtn$(_label_0)), ["tail"]: { $: "Con", ["head"]: run_loop($findToggleBtn$(_label_0, _findOpen_0)), ["tail"]: { $: "Con", ["head"]: run_loop($shotBtn$(_label_0)), ["tail"]: { $: "Con", ["head"]: run_loop($backBtn$(_label_0)), ["tail"]: { $: "Con", ["head"]: run_loop($navBtn$(_label_0)), ["tail"]: { $: "Con", ["head"]: run_loop($collapseBtn$(_minimized_0)), ["tail"]: { $: "Nil" } } } } } } } } }]);
}
function $iconBtn$(_cls_0, _iconName_0, _aria_0, _handler_0) {
  return run_jump($view$viewEl$, ["button", run_loop($view$attrConcat$(run_loop($iconBtnAttrs$(_cls_0, _iconName_0, _aria_0)), { $: "Con", ["head"]: run_loop($view$attrOn$("click", _handler_0)), ["tail"]: { $: "Nil" } })), { $: "Nil" }]);
}
function $titleIconBtn$(_cls_0, _iconName_0, _title_0, _aria_0, _handler_0) {
  return run_jump($view$viewEl$, ["button", run_loop($view$attrJoin$({ $: "Con", ["head"]: run_loop($iconBtnAttrs$(_cls_0, _iconName_0, _aria_0)), ["tail"]: { $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrTitle$(_title_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", _handler_0)), ["tail"]: { $: "Nil" } } }, ["tail"]: { $: "Nil" } } })), { $: "Nil" }]);
}
function $pageInput$(_label_0) {
  return run_jump($view$viewEl$, ["input", { $: "Con", ["head"]: run_loop($view$attrClass$("page-number")), ["tail"]: { $: "Con", ["head"]: { $: "ViewAttr", ["name"]: "type", ["value"]: "number" }, ["tail"]: { $: "Con", ["head"]: { $: "ViewAttr", ["name"]: "min", ["value"]: "1" }, ["tail"]: { $: "Con", ["head"]: { $: "ViewAttr", ["name"]: "value", ["value"]: "1" }, ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("label", run_loop($pageAria$(_label_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("change", "GotoPage")), ["tail"]: { $: "Nil" } } } } } } }, { $: "Nil" }]);
}
function $toolsBar$(_label_0) {
  return run_jump($view$viewEl$, ["div", { $: "Con", ["head"]: run_loop($view$attrClass$("pdf-tools")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($iconBtn$("prev", "chevronLeft", run_loop($prevAria$()), "Prev")), ["tail"]: { $: "Con", ["head"]: run_loop($pageInput$(_label_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("span", { $: "Con", ["head"]: run_loop($view$attrClass$("page-total")), ["tail"]: { $: "Nil" } }, { $: "Nil" })), ["tail"]: { $: "Con", ["head"]: run_loop($iconBtn$("next", "chevronRight", run_loop($nextAria$()), "Next")), ["tail"]: { $: "Con", ["head"]: run_loop($iconBtn$("out", "minus", run_loop($outAria$()), "ZoomOut")), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("span", { $: "Con", ["head"]: run_loop($view$attrClass$("zoom-label")), ["tail"]: { $: "Nil" } }, { $: "Nil" })), ["tail"]: { $: "Con", ["head"]: run_loop($iconBtn$("in", "plus", run_loop($inAria$()), "ZoomIn")), ["tail"]: { $: "Con", ["head"]: run_loop($titleIconBtn$("fit", "unfold", run_loop($fitTitle$()), run_loop($fitTitle$()), "Fit")), ["tail"]: { $: "Con", ["head"]: run_loop($titleIconBtn$("invert", "contrast", run_loop($invertTitle$()), run_loop($invertAria$()), "ToggleInvert")), ["tail"]: { $: "Nil" } } } } } } } } } }]);
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
  return run_jump($view$viewEl$, ["section", { $: "Con", ["head"]: run_loop($pdfview$panelClass$(_minimized_0, false)), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("label", _label_0)), ["tail"]: { $: "Con", ["head"]: { $: "ViewAttr", ["name"]: "tabindex", ["value"]: "0" }, ["tail"]: { $: "Nil" } } } }, { $: "Con", ["head"]: run_loop($titleBar$({ $: "PdfShell", ["label"]: _label_0, ["options"]: _options_0, ["path"]: _path_0, ["minimized"]: _minimized_0, ["findOpen"]: _findOpen_0 })), ["tail"]: { $: "Con", ["head"]: run_loop($toolsBar$(_label_0)), ["tail"]: { $: "Con", ["head"]: run_loop($stage$()), ["tail"]: { $: "Con", ["head"]: run_loop($findForm$(_label_0)), ["tail"]: { $: "Nil" } } } } }]);
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

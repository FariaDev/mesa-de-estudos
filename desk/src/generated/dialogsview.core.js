// GERADO de core/dialogsview.bend por `bun core/build.mjs` — não editar à mão.
// core/dialogsview.bend
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
function $textOr$if$(_raw_0, _fallback_0, _empty_0) {
  if (_empty_0) {
    return _fallback_0;
  } else {
    return _raw_0;
  }
}
function $textOr$(_raw_0, _fallback_0) {
  return run_jump($textOr$if$, [_raw_0, _fallback_0, run_loop($String$is_empty$(_raw_0))]);
}
function $lastPartFrom$(_m_0) {
  if (_m_0.$ === "None") {
    return "";
  } else {
    const _h_0 = _m_0["value"];
    return _h_0;
  }
}
function $lastPart$(_xs_0) {
  return run_jump($lastPartFrom$, [run_loop($List$last$(_xs_0))]);
}
function $fileBase$(_path_0) {
  return run_jump($lastPart$, [run_loop($String$split$(run_loop($lastPart$(run_loop($String$split$(_path_0, "/")))), "\\"))]);
}
function $hintAttrs$(_hint_0) {
  return run_jump($view$attrWhen$, [run_loop($Bool$not$(run_loop($String$is_empty$(_hint_0)))), { $: "ViewAttr", ["name"]: "placeholder", ["value"]: _hint_0 }]);
}
function $valueAttr$(_value_0) {
  return run_jump($view$attrWhen$, [run_loop($Bool$not$(run_loop($String$is_empty$(_value_0)))), { $: "ViewAttr", ["name"]: "value", ["value"]: _value_0 }]);
}
function $labelAria$(_label_0) {
  return run_jump($view$attrWhen$, [run_loop($Bool$not$(run_loop($String$is_empty$(_label_0)))), run_loop($view$attrAria$("label", _label_0))]);
}
function $textareaKids$if$(_value_0, _empty_0) {
  if (_empty_0) {
    return { $: "Nil" };
  } else {
    return { $: "Con", ["head"]: run_loop($view$viewText$(_value_0)), ["tail"]: { $: "Nil" } };
  }
}
function $textareaKids$(_value_0) {
  return run_jump($textareaKids$if$, [_value_0, run_loop($String$is_empty$(_value_0))]);
}
function $optionNode$(_selected_0, _o_0) {
  const _label_0 = _o_0["label"];
  const _value_0 = _o_0["value"];
  return run_jump($view$viewEl$, ["option", run_loop($view$attrJoin$({ $: "Con", ["head"]: { $: "Con", ["head"]: { $: "ViewAttr", ["name"]: "value", ["value"]: _value_0 }, ["tail"]: { $: "Nil" } }, ["tail"]: { $: "Con", ["head"]: run_loop($view$attrWhen$(run_loop($String$eq$(_value_0, _selected_0)), { $: "ViewAttr", ["name"]: "selected", ["value"]: "" })), ["tail"]: { $: "Nil" } } })), { $: "Con", ["head"]: run_loop($view$viewText$(_label_0)), ["tail"]: { $: "Nil" } }]);
}
function $optionNodes$go$(_selected_0, _xs_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return { $: "Con", ["head"]: run_loop($optionNode$(_selected_0, _h_0)), ["tail"]: run_loop($optionNodes$go$(_selected_0, _t_0)) };
  }
}
function $optionNodes$(_selected_0, _xs_0) {
  return run_jump($optionNodes$go$, [_selected_0, _xs_0]);
}
function $fieldControl$(_f_0) {
  if (_f_0.$ === "FieldText") {
    const _label_0 = _f_0["label"];
    const _value_0 = _f_0["value"];
    const _hint_0 = _f_0["hint"];
    return run_jump($view$viewEl$, ["input", run_loop($view$attrJoin$({ $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrId$("dialog-value")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrType$("text")), ["tail"]: { $: "Nil" } } }, ["tail"]: { $: "Con", ["head"]: run_loop($labelAria$(_label_0)), ["tail"]: { $: "Con", ["head"]: run_loop($valueAttr$(_value_0)), ["tail"]: { $: "Con", ["head"]: run_loop($hintAttrs$(_hint_0)), ["tail"]: { $: "Nil" } } } } })), { $: "Nil" }]);
  } else if (_f_0.$ === "FieldEditor") {
    const _label_1 = _f_0["label"];
    const _value_1 = _f_0["value"];
    const _hint_1 = _f_0["hint"];
    return run_jump($view$viewEl$, ["textarea", run_loop($view$attrJoin$({ $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrId$("dialog-value")), ["tail"]: { $: "Nil" } }, ["tail"]: { $: "Con", ["head"]: run_loop($labelAria$(_label_1)), ["tail"]: { $: "Con", ["head"]: run_loop($hintAttrs$(_hint_1)), ["tail"]: { $: "Nil" } } } })), run_loop($textareaKids$(_value_1))]);
  } else if (_f_0.$ === "FieldPick") {
    const _label_2 = _f_0["label"];
    const _value_2 = _f_0["value"];
    const _options_0 = _f_0["options"];
    return run_jump($view$viewEl$, ["select", run_loop($view$attrJoin$({ $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrId$("dialog-value")), ["tail"]: { $: "Nil" } }, ["tail"]: { $: "Con", ["head"]: run_loop($labelAria$(_label_2)), ["tail"]: { $: "Nil" } } })), run_loop($optionNodes$(_value_2, _options_0))]);
  } else {
    const _label_3 = _f_0["label"];
    const _value_3 = _f_0["value"];
    const _on_0 = _f_0["on"];
    return run_jump($view$viewEl$, ["label", { $: "Nil" }, { $: "Con", ["head"]: run_loop($view$viewEl$("input", run_loop($view$attrJoin$({ $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrId$("dialog-value")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrType$("checkbox")), ["tail"]: { $: "Nil" } } }, ["tail"]: { $: "Con", ["head"]: run_loop($valueAttr$(_value_3)), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrWhen$(_on_0, { $: "ViewAttr", ["name"]: "checked", ["value"]: "" })), ["tail"]: { $: "Nil" } } } })), { $: "Nil" })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewText$(_label_3)), ["tail"]: { $: "Nil" } } }]);
  }
}
function $piFields$(_fs_0) {
  if (_fs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _fs_0["head"];
    const _t_0 = _fs_0["tail"];
    return { $: "Con", ["head"]: run_loop($fieldControl$(_h_0)), ["tail"]: run_loop($piFields$(_t_0)) };
  }
}
function $piTitle$(_raw_0) {
  return run_jump($textOr$, [_raw_0, "Pi"]);
}
function $piMessage$(_raw_0) {
  return _raw_0;
}
function $dialogOkLabel$(_raw_0) {
  return run_jump($textOr$, [_raw_0, "Continuar"]);
}
function $piOkNode$(_label_0) {
  return run_jump($view$viewEl$, ["button", { $: "Con", ["head"]: run_loop($view$attrId$("dialog-ok")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attr$("value", "ok")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrClass$("primary")), ["tail"]: { $: "Nil" } } } }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($dialogOkLabel$(_label_0)))), ["tail"]: { $: "Nil" } }]);
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
function $endDayField$(_id_0, _label_0, _value_0) {
  return run_jump($view$viewEl$, ["label", { $: "Nil" }, { $: "Con", ["head"]: run_loop($view$viewText$(_label_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("textarea", { $: "Con", ["head"]: run_loop($view$attrId$(_id_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$attr$("rows", "2")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attr$("required", "")), ["tail"]: { $: "Nil" } } } }, run_loop($textareaKids$(_value_0)))), ["tail"]: { $: "Nil" } } }]);
}
function $endDayActions$() {
  return run_jump($view$viewEl$, ["div", { $: "Con", ["head"]: run_loop($view$attrClass$("dialog-actions")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewEl$("button", { $: "Con", ["head"]: run_loop($view$attr$("value", "cancel")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attr$("formnovalidate", "")), ["tail"]: { $: "Nil" } } }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($endDayCancelLabel$()))), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("button", { $: "Con", ["head"]: run_loop($view$attrId$("end-day-save")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attr$("value", "ok")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrClass$("primary")), ["tail"]: { $: "Nil" } } } }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($endDaySaveLabel$()))), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Nil" } } }]);
}
function $endDayChildren$(_whereText_0, _nextText_0) {
  return { $: "Con", ["head"]: run_loop($view$viewEl$("h2", { $: "Nil" }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($endDayTitle$()))), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("p", { $: "Con", ["head"]: run_loop($view$attrClass$("help-lead")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($endDayLead$()))), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Con", ["head"]: run_loop($endDayField$("end-where", run_loop($endDayWhereLabel$()), _whereText_0)), ["tail"]: { $: "Con", ["head"]: run_loop($endDayField$("end-next", run_loop($endDayNextLabel$()), _nextText_0)), ["tail"]: { $: "Con", ["head"]: run_loop($endDayActions$()), ["tail"]: { $: "Nil" } } } } } };
}
function $bookmarkNameInput$(_value_0) {
  return run_jump($view$viewEl$, ["input", { $: "Con", ["head"]: run_loop($view$attrId$("bookmark-name")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrType$("text")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attr$("value", _value_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$attr$("required", "")), ["tail"]: { $: "Nil" } } } } }, { $: "Nil" }]);
}
function $bookmarkActions$() {
  return run_jump($view$viewEl$, ["div", { $: "Con", ["head"]: run_loop($view$attrClass$("dialog-actions")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewEl$("button", { $: "Con", ["head"]: run_loop($view$attr$("value", "cancel")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attr$("formnovalidate", "")), ["tail"]: { $: "Nil" } } }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($pdfnav$bookmarkCancelLabel$()))), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("button", { $: "Con", ["head"]: run_loop($view$attrId$("bookmark-save")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attr$("value", "ok")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrClass$("primary")), ["tail"]: { $: "Nil" } } } }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($pdfnav$bookmarkSaveLabel$()))), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Nil" } } }]);
}
function $bookmarkChildren$(_name_0, _hint_0) {
  return { $: "Con", ["head"]: run_loop($view$viewEl$("h2", { $: "Nil" }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($pdfnav$bookmarkDialogTitle$()))), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("p", { $: "Con", ["head"]: run_loop($view$attrClass$("help-lead")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$(_hint_0)), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("label", { $: "Nil" }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($pdfnav$bookmarkNameLabel$()))), ["tail"]: { $: "Con", ["head"]: run_loop($bookmarkNameInput$(_name_0)), ["tail"]: { $: "Nil" } } })), ["tail"]: { $: "Con", ["head"]: run_loop($bookmarkActions$()), ["tail"]: { $: "Nil" } } } } };
}
function $imageFallback$() {
  return "Imagem";
}
function $imageTitle$(_file_0) {
  return run_jump($textOr$, [run_loop($fileBase$(_file_0)), run_loop($imageFallback$())]);
}
function $imageTitleNode$(_file_0) {
  return run_jump($view$viewText$, [run_loop($imageTitle$(_file_0))]);
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
function $imageActions$(_hasFile_0) {
  return { $: "Con", ["head"]: run_loop($view$viewEl$("button", { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrId$("image-copy")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "ImageCopy")), ["tail"]: { $: "Nil" } } } }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($imageCopyLabel$()))), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("button", run_loop($view$attrJoin$({ $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrId$("image-open")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "ImageOpen")), ["tail"]: { $: "Nil" } } } }, ["tail"]: { $: "Con", ["head"]: run_loop($view$attrWhen$(run_loop($Bool$not$(_hasFile_0)), { $: "ViewAttr", ["name"]: "hidden", ["value"]: "" })), ["tail"]: { $: "Nil" } } })), { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($imageOpenLabel$()))), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("button", { $: "Con", ["head"]: run_loop($view$attr$("value", "cancel")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrClass$("primary")), ["tail"]: { $: "Nil" } } }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($imageCloseLabel$()))), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Nil" } } } };
}
function $helpVersion$if$(_version_0, _missing_0) {
  if (_missing_0) {
    return "";
  } else {
    return "Mesa de Estudos " + _version_0;
  }
}
function $helpVersion$(_version_0) {
  return run_jump($helpVersion$if$, [_version_0, run_loop($String$is_empty$(_version_0))]);
}
function $helpVersionNode$(_version_0) {
  return run_jump($view$viewText$, [run_loop($helpVersion$(_version_0))]);
}
function $helpFlags$(_studyContext_0, _endDay_0, _refsToggle_0, _conferir_0) {
  return { $: "HelpFlags", ["studyContext"]: _studyContext_0, ["endDay"]: _endDay_0, ["refsToggle"]: _refsToggle_0, ["conferir"]: _conferir_0 };
}
function $helpChrome$(_version_0, _flags_0) {
  const _studyContext_0 = _flags_0["studyContext"];
  const _endDay_0 = _flags_0["endDay"];
  const _refsToggle_0 = _flags_0["refsToggle"];
  const _conferir_0 = _flags_0["conferir"];
  return { $: "HelpChrome", ["version"]: run_loop($helpVersion$(_version_0)), ["studyHidden"]: run_loop($Bool$not$(_studyContext_0)), ["endDayHidden"]: run_loop($Bool$not$(_endDay_0)), ["refsHidden"]: run_loop($Bool$not$(_refsToggle_0)), ["conferirHidden"]: run_loop($Bool$not$(_conferir_0)) };
}
function $aboutLead$if$(_version_0, _missing_0) {
  if (_missing_0) {
    return "";
  } else {
    const _x_0 = _version_0 + " · licença MIT";
    return "Mesa de Estudos " + _x_0;
  }
}
function $aboutLead$(_version_0) {
  return run_jump($aboutLead$if$, [_version_0, run_loop($String$is_empty$(_version_0))]);
}
function $aboutLeadNode$(_version_0) {
  return run_jump($view$viewText$, [run_loop($aboutLead$(_version_0))]);
}
function $settingsTitle$(_first_0) {
  if (_first_0) {
    return "Bem-vindo à Mesa de Estudos";
  } else {
    return "Configurações";
  }
}
function $settingsLead$(_first_0) {
  if (_first_0) {
    return "Escolha a pasta de dados e pelo menos uma matéria (nome + pasta de PDFs). O Pi pede as credenciais na primeira conexão.";
  } else {
    return "Caminhos e nomes desta mesa. As credenciais do modelo continuam no Pi.";
  }
}
function $settingsTitleNode$(_first_0) {
  return run_jump($view$viewText$, [run_loop($settingsTitle$(_first_0))]);
}
function $settingsLeadNode$(_first_0) {
  return run_jump($view$viewText$, [run_loop($settingsLead$(_first_0))]);
}
function $emptyCourse$() {
  return { $: "SettingsCourse", ["id"]: "", ["name"]: "", ["path"]: "" };
}
function $courseRow$(_course_0) {
  const _id_0 = _course_0["id"];
  const _name_0 = _course_0["name"];
  const _path_0 = _course_0["path"];
  return run_jump($view$viewEl$, ["div", { $: "Con", ["head"]: run_loop($view$attrClass$("cfg-course")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("id", _id_0)), ["tail"]: { $: "Nil" } } }, { $: "Con", ["head"]: run_loop($view$viewEl$("input", run_loop($view$attrJoin$({ $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrClass$("cfg-name")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attr$("placeholder", "Nome")), ["tail"]: { $: "Nil" } } }, ["tail"]: { $: "Con", ["head"]: run_loop($valueAttr$(_name_0)), ["tail"]: { $: "Nil" } } })), { $: "Nil" })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("input", run_loop($view$attrJoin$({ $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrClass$("cfg-path")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attr$("placeholder", "Pasta dos PDFs")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attr$("spellcheck", "false")), ["tail"]: { $: "Nil" } } } }, ["tail"]: { $: "Con", ["head"]: run_loop($valueAttr$(_path_0)), ["tail"]: { $: "Nil" } } })), { $: "Nil" })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("button", { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrClass$("cfg-browse")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "BrowseCourse")), ["tail"]: { $: "Nil" } } } }, { $: "Con", ["head"]: run_loop($view$viewText$("Pasta")), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("button", { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrClass$("cfg-remove icon-btn")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("label", "Remover")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "RemoveCourse")), ["tail"]: { $: "Nil" } } } } }, { $: "Con", ["head"]: run_loop($view$viewText$("×")), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Nil" } } } } }]);
}
function $courseRows$go$(_cs_0) {
  if (_cs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _cs_0["head"];
    const _t_0 = _cs_0["tail"];
    return { $: "Con", ["head"]: run_loop($courseRow$(_h_0)), ["tail"]: run_loop($courseRows$go$(_t_0)) };
  }
}
function $courseRows$(_cs_0) {
  if (_cs_0.$ === "Nil") {
    return { $: "Con", ["head"]: run_loop($courseRow$(run_loop($emptyCourse$()))), ["tail"]: { $: "Nil" } };
  } else {
    const _h_0 = _cs_0["head"];
    const _t_0 = _cs_0["tail"];
    return { $: "Con", ["head"]: run_loop($courseRow$(_h_0)), ["tail"]: run_loop($courseRows$go$(_t_0)) };
  }
}
function $welcomeTitle$() {
  return "Bem-vindo à Mesa de Estudos";
}
function $welcomeWorkflowNote$(_win32_0) {
  if (_win32_0) {
    return "No Windows, o Conferir Xournal++ captura a janela do Xournal++ (Ctrl+Shift+C) e você envia junto com a mensagem — prints colados com Ctrl+V também funcionam.";
  } else {
    return "No macOS, o Conferir Xournal++ anexa a captura da sua resolução no Xournal++ e você envia junto com a mensagem.";
  }
}
function $welcomeBlocks$(_win32_0) {
  return { $: "Con", ["head"]: { $: "WelcomeBlock", ["title"]: "O que é a Mesa", ["paras"]: { $: "Con", ["head"]: "A Mesa é a sua bancada de referências: os PDFs do enunciado e do formulário, uma calculadora e o Pi na mesma janela. A escrita à mão continua no Xournal++, do lado — a Mesa não é um canvas de tinta.", ["tail"]: { $: "Con", ["head"]: "Coloque um app em cada monitor, ou os dois lado a lado.", ["tail"]: { $: "Nil" } } } }, ["tail"]: { $: "Con", ["head"]: { $: "WelcomeBlock", ["title"]: "O Pi", ["paras"]: { $: "Con", ["head"]: "O Pi é o motor da conversa: um agente que roda nesta máquina. As credenciais do modelo ficam no Pi, não neste app — ele pede na primeira conexão.", ["tail"]: { $: "Con", ["head"]: "Cada matéria tem a sua conversa, guardada localmente; a Mesa conecta sozinha quando abre.", ["tail"]: { $: "Nil" } } } }, ["tail"]: { $: "Con", ["head"]: { $: "WelcomeBlock", ["title"]: "Customização por agentes", ["paras"]: { $: "Con", ["head"]: "Esta Mesa foi feita para ser customizada por agentes: o AGENTS.md é o contrato e o bloco desk do config.json decide os leitores, os rótulos, qual PDF abre primeiro e o que esconder (calculadora, Xournal++, Conferir, Encerrar).", ["tail"]: { $: "Con", ["head"]: "Para ajustar o jeito de o Pi dar aula, copie os templates TUTOR.md e LEARNER.md para a sua pasta de dados e edite as CÓPIAS — os arquivos do repositório são só o molde.", ["tail"]: { $: "Nil" } } } }, ["tail"]: { $: "Con", ["head"]: { $: "WelcomeBlock", ["title"]: "Dicas de uso", ["paras"]: { $: "Con", ["head"]: "Encerrar por hoje registra onde você parou e o próximo passo; o diário do turno e os quizzes aparecem na conversa. O Como usar tem os atalhos todos.", ["tail"]: { $: "Con", ["head"]: run_loop($welcomeWorkflowNote$(_win32_0)), ["tail"]: { $: "Nil" } } } }, ["tail"]: { $: "Nil" } } } } };
}
function $paraNode$(_text_0) {
  return run_jump($view$viewEl$, ["p", { $: "Nil" }, { $: "Con", ["head"]: run_loop($view$viewText$(_text_0)), ["tail"]: { $: "Nil" } }]);
}
function $paraNodes$go$(_ps_0) {
  if (_ps_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _ps_0["head"];
    const _t_0 = _ps_0["tail"];
    return { $: "Con", ["head"]: run_loop($paraNode$(_h_0)), ["tail"]: run_loop($paraNodes$go$(_t_0)) };
  }
}
function $paraNodes$(_ps_0) {
  return run_jump($paraNodes$go$, [_ps_0]);
}
function $blockNode$(_b_0) {
  const _title_0 = _b_0["title"];
  const _paras_0 = _b_0["paras"];
  return run_jump($view$viewEl$, ["section", { $: "Con", ["head"]: run_loop($view$attrClass$("welcome-block")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewEl$("h3", { $: "Nil" }, { $: "Con", ["head"]: run_loop($view$viewText$(_title_0)), ["tail"]: { $: "Nil" } })), ["tail"]: run_loop($paraNodes$(_paras_0)) }]);
}
function $blockNodes$go$(_bs_0) {
  if (_bs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _bs_0["head"];
    const _t_0 = _bs_0["tail"];
    return { $: "Con", ["head"]: run_loop($blockNode$(_h_0)), ["tail"]: run_loop($blockNodes$go$(_t_0)) };
  }
}
function $blockNodes$(_bs_0) {
  return run_jump($blockNodes$go$, [_bs_0]);
}
function $blockTitle$(_b_0) {
  const _title_0 = _b_0["title"];
  const __0 = _b_0["paras"];
  return _title_0;
}
function $welcomeTitles$go$(_bs_0) {
  if (_bs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _bs_0["head"];
    const _t_0 = _bs_0["tail"];
    return { $: "Con", ["head"]: run_loop($blockTitle$(_h_0)), ["tail"]: run_loop($welcomeTitles$go$(_t_0)) };
  }
}
function $welcomeTitles$(_win32_0) {
  return run_jump($welcomeTitles$go$, [run_loop($welcomeBlocks$(_win32_0))]);
}
function $welcomeActions$() {
  return run_jump($view$viewEl$, ["div", { $: "Con", ["head"]: run_loop($view$attrClass$("dialog-actions")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewEl$("button", { $: "Con", ["head"]: run_loop($view$attr$("value", "cancel")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$("Agora não")), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("button", { $: "Con", ["head"]: run_loop($view$attrId$("welcome-settings")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrClass$("primary")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "WelcomeConfigure")), ["tail"]: { $: "Nil" } } } } }, { $: "Con", ["head"]: run_loop($view$viewText$("Configurar agora")), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Nil" } } }]);
}
function $welcomeBody$(_win32_0) {
  return run_jump($view$viewEl$, ["div", { $: "Con", ["head"]: run_loop($view$attrClass$("help-body")), ["tail"]: { $: "Nil" } }, run_loop($blockNodes$(run_loop($welcomeBlocks$(_win32_0))))]);
}
function $welcomeChildren$(_win32_0) {
  return { $: "Con", ["head"]: run_loop($view$viewEl$("h2", { $: "Nil" }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($welcomeTitle$()))), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Con", ["head"]: run_loop($welcomeBody$(_win32_0)), ["tail"]: { $: "Con", ["head"]: run_loop($welcomeActions$()), ["tail"]: { $: "Nil" } } } };
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
function $updateNoneText$(_current_0) {
  const _x_0 = _current_0 + ").";
  return "Você está na última versão (v" + _x_0;
}
function $updateFailedText$() {
  return "Não foi possível verificar agora. Tente de novo quando quiser.";
}
function $updateReadyPrefix$if$(_version_0, _withoutUrl_0) {
  if (_withoutUrl_0) {
    const _x_0 = _version_0 + " disponível";
    return "v" + _x_0;
  } else {
    const _x_1 = _version_0 + " disponível — o que mudou (";
    return "v" + _x_1;
  }
}
function $updateReadyPrefix$(_version_0, _url_0) {
  return run_jump($updateReadyPrefix$if$, [_version_0, run_loop($String$is_empty$(_url_0))]);
}
function $updateReadyJoin$if$(_withoutUrl_0) {
  if (_withoutUrl_0) {
    return " · ";
  } else {
    return ") · ";
  }
}
function $updateReadyJoin$(_url_0) {
  return run_jump($updateReadyJoin$if$, [run_loop($String$is_empty$(_url_0))]);
}
function $updateNotesLabel$() {
  return "Notas da versão";
}
function $updateApplyLabel$() {
  return "Atualizar e reiniciar";
}
function $updatePiLabel$() {
  return "Atualizar Pi";
}
function $updateApplyingText$() {
  return "Aplicando a atualização — a Mesa fecha e reabre sozinha.";
}
function $updateDoneText$(_version_0) {
  const _x_0 = _version_0 + ".";
  return "Mesa atualizada para v" + _x_0;
}
function $updateRecoveredText$if$(_version_0, _reason_0, _emptyReason_0) {
  if (_emptyReason_0) {
    const _x_0 = _version_0 + " falhou — a versão anterior voltou.";
    return "A atualização para v" + _x_0;
  } else {
    const _x_1 = _reason_0 + ").";
    const _x_2 = " falhou — a versão anterior voltou (" + _x_1;
    const _x_3 = _version_0 + _x_2;
    return "A atualização para v" + _x_3;
  }
}
function $updateRecoveredText$(_version_0, _reason_0) {
  return run_jump($updateRecoveredText$if$, [_version_0, _reason_0, run_loop($String$is_empty$(_reason_0))]);
}
function $updateIncompleteText$if$(_version_0, _reason_0, _emptyReason_0) {
  if (_emptyReason_0) {
    const _x_0 = _version_0 + " falhou e a recuperação ficou incompleta.";
    return "A atualização para v" + _x_0;
  } else {
    const _x_1 = _reason_0 + ").";
    const _x_2 = " falhou e a recuperação ficou incompleta (" + _x_1;
    const _x_3 = _version_0 + _x_2;
    return "A atualização para v" + _x_3;
  }
}
function $updateIncompleteText$(_version_0, _reason_0) {
  return run_jump($updateIncompleteText$if$, [_version_0, _reason_0, run_loop($String$is_empty$(_reason_0))]);
}
function $updateLogLabel$() {
  return "Ver o log";
}
function $updateLineNode$(_text_0) {
  return run_jump($view$viewEl$, ["p", { $: "Nil" }, { $: "Con", ["head"]: run_loop($view$viewText$(_text_0)), ["tail"]: { $: "Nil" } }]);
}
function $releaseNotesButton$(_url_0) {
  return run_jump($view$viewEl$, ["button", { $: "Con", ["head"]: run_loop($view$attrId$("update-notes")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "OpenLink")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("url", _url_0)), ["tail"]: { $: "Nil" } } } } }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($updateNotesLabel$()))), ["tail"]: { $: "Nil" } }]);
}
function $updateLogButton$() {
  return run_jump($view$viewEl$, ["button", { $: "Con", ["head"]: run_loop($view$attrId$("update-log")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "OpenLog")), ["tail"]: { $: "Nil" } } } }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($updateLogLabel$()))), ["tail"]: { $: "Nil" } }]);
}
function $applyUpdateButton$() {
  return run_jump($view$viewEl$, ["button", { $: "Con", ["head"]: run_loop($view$attrId$("update-apply")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrClass$("primary")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "ApplyUpdate")), ["tail"]: { $: "Nil" } } } } }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($updateApplyLabel$()))), ["tail"]: { $: "Nil" } }]);
}
function $applyingUpdateButton$() {
  return run_jump($view$viewEl$, ["button", { $: "Con", ["head"]: run_loop($view$attrId$("update-apply")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrClass$("primary")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "ApplyUpdate")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attr$("disabled", "")), ["tail"]: { $: "Nil" } } } } } }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($updateApplyLabel$()))), ["tail"]: { $: "Nil" } }]);
}
function $checkUpdateButton$() {
  return run_jump($view$viewEl$, ["button", { $: "Con", ["head"]: run_loop($view$attrId$("update-check")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "CheckUpdate")), ["tail"]: { $: "Nil" } } } }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($checkUpdateLabel$()))), ["tail"]: { $: "Nil" } }]);
}
function $updateReadyLine$(_version_0, _url_0) {
  return run_jump($view$viewEl$, ["div", { $: "Con", ["head"]: run_loop($view$attrClass$("update-line")), ["tail"]: { $: "Nil" } }, run_loop($view$viewJoin$({ $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($updateReadyPrefix$(_version_0, _url_0)))), ["tail"]: { $: "Nil" } }, ["tail"]: { $: "Con", ["head"]: run_loop($view$viewWhen$(run_loop($Bool$not$(run_loop($String$is_empty$(_url_0)))), run_loop($releaseNotesButton$(_url_0)))), ["tail"]: { $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($updateReadyJoin$(_url_0)))), ["tail"]: { $: "Nil" } }, ["tail"]: { $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($applyUpdateButton$()), ["tail"]: { $: "Nil" } }, ["tail"]: { $: "Nil" } } } } }))]);
}
function $updateNotesNode$(_notes_0) {
  return run_jump($view$viewEl$, ["p", { $: "Con", ["head"]: run_loop($view$attrClass$("update-notes")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$(_notes_0)), ["tail"]: { $: "Nil" } }]);
}
function $aboutUpdateChildren$(_s_0) {
  if (_s_0.$ === "UpdateIdle") {
    return { $: "Con", ["head"]: run_loop($updateLineNode$(run_loop($updateIdleText$()))), ["tail"]: { $: "Con", ["head"]: run_loop($checkUpdateButton$()), ["tail"]: { $: "Nil" } } };
  } else if (_s_0.$ === "UpdateChecking") {
    return { $: "Con", ["head"]: run_loop($updateLineNode$(run_loop($updateCheckingText$()))), ["tail"]: { $: "Nil" } };
  } else if (_s_0.$ === "UpdateNone") {
    const _current_0 = _s_0["current"];
    return { $: "Con", ["head"]: run_loop($updateLineNode$(run_loop($updateNoneText$(_current_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($checkUpdateButton$()), ["tail"]: { $: "Nil" } } };
  } else if (_s_0.$ === "UpdateReady") {
    const _version_0 = _s_0["version"];
    const _notes_0 = _s_0["notes"];
    const _url_0 = _s_0["url"];
    return run_jump($view$viewConcat$, [{ $: "Con", ["head"]: run_loop($updateReadyLine$(_version_0, _url_0)), ["tail"]: { $: "Nil" } }, run_loop($view$viewWhen$(run_loop($Bool$not$(run_loop($String$is_empty$(_notes_0)))), run_loop($updateNotesNode$(_notes_0))))]);
  } else if (_s_0.$ === "UpdateFailed") {
    return { $: "Con", ["head"]: run_loop($updateLineNode$(run_loop($updateFailedText$()))), ["tail"]: { $: "Con", ["head"]: run_loop($checkUpdateButton$()), ["tail"]: { $: "Nil" } } };
  } else if (_s_0.$ === "UpdateApplying") {
    return { $: "Con", ["head"]: run_loop($updateLineNode$(run_loop($updateApplyingText$()))), ["tail"]: { $: "Con", ["head"]: run_loop($applyingUpdateButton$()), ["tail"]: { $: "Nil" } } };
  } else if (_s_0.$ === "UpdateDone") {
    const _version_1 = _s_0["version"];
    return { $: "Con", ["head"]: run_loop($updateLineNode$(run_loop($updateDoneText$(_version_1)))), ["tail"]: { $: "Con", ["head"]: run_loop($checkUpdateButton$()), ["tail"]: { $: "Nil" } } };
  } else if (_s_0.$ === "UpdateRecovered") {
    const _version_2 = _s_0["version"];
    const _reason_0 = _s_0["reason"];
    return { $: "Con", ["head"]: run_loop($updateLineNode$(run_loop($updateRecoveredText$(_version_2, _reason_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($updateLogButton$()), ["tail"]: { $: "Con", ["head"]: run_loop($checkUpdateButton$()), ["tail"]: { $: "Nil" } } } };
  } else {
    const _version_3 = _s_0["version"];
    const _reason_1 = _s_0["reason"];
    return { $: "Con", ["head"]: run_loop($updateLineNode$(run_loop($updateIncompleteText$(_version_3, _reason_1)))), ["tail"]: { $: "Con", ["head"]: run_loop($updateLogButton$()), ["tail"]: { $: "Con", ["head"]: run_loop($checkUpdateButton$()), ["tail"]: { $: "Nil" } } } };
  }
}
function $componentIds$() {
  return { $: "Con", ["head"]: "mesa", ["tail"]: { $: "Con", ["head"]: "pi", ["tail"]: { $: "Con", ["head"]: "node", ["tail"]: { $: "Con", ["head"]: "xournal", ["tail"]: { $: "Nil" } } } } };
}
function $componentStateText$(_s_0) {
  if (_s_0.$ === "CompOk") {
    return "✓";
  } else if (_s_0.$ === "CompUnknown") {
    return "desconhecido";
  } else if (_s_0.$ === "CompOutdated") {
    const _latest_0 = _s_0["latest"];
    const _x_0 = _latest_0 + " disponível";
    return "→ v" + _x_0;
  } else if (_s_0.$ === "CompWarn") {
    const _note_0 = _s_0["note"];
    return _note_0;
  } else {
    return "Verificando…";
  }
}
function $componentVersionText$(_version_0) {
  return run_jump($textOr$, [_version_0, "—"]);
}
function $componentLinkLabel$(_label_0) {
  return run_jump($textOr$, [_label_0, "Ver página"]);
}
function $nodeTooOld$(_major_0, _minor_0) {
  const _x_0 = _major_0 < 22;
  const _x_1 = run_loop($Bool$and$(_major_0 === 22, _minor_0 < 19));
  return _x_0 || _x_1;
}
function $nodeWarnText$() {
  return "abaixo de 22.19 — o Pi exige Node 22.19+";
}
function $nodeState$if$(_old_0) {
  if (_old_0) {
    return { $: "CompWarn", ["note"]: run_loop($nodeWarnText$()) };
  } else {
    return { $: "CompOk" };
  }
}
function $nodeState$(_major_0, _minor_0) {
  return run_jump($nodeState$if$, [run_loop($nodeTooOld$(_major_0, _minor_0))]);
}
function $updatePiButton$() {
  return run_jump($view$viewEl$, ["button", { $: "Con", ["head"]: run_loop($view$attrId$("update-pi")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrClass$("component-update")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "UpdatePi")), ["tail"]: { $: "Nil" } } } } }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($updatePiLabel$()))), ["tail"]: { $: "Nil" } }]);
}
function $componentLinkButton$(_url_0, _label_0) {
  return run_jump($view$viewEl$, ["button", { $: "Con", ["head"]: run_loop($view$attrClass$("component-link")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "OpenLink")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("url", _url_0)), ["tail"]: { $: "Nil" } } } } }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($componentLinkLabel$(_label_0)))), ["tail"]: { $: "Nil" } }]);
}
function $componentHintNode$(_hint_0) {
  return run_jump($view$viewEl$, ["small", { $: "Con", ["head"]: run_loop($view$attrClass$("component-hint")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$(_hint_0)), ["tail"]: { $: "Nil" } }]);
}
function $componentRowNode$(_r_0) {
  const _id_0 = _r_0["id"];
  const _label_0 = _r_0["label"];
  const _version_0 = _r_0["version"];
  const _state_0 = _r_0["state"];
  const _hint_0 = _r_0["hint"];
  const _link_0 = _r_0["link"];
  const _linkLabel_0 = _r_0["linkLabel"];
  const _canUpdate_0 = _r_0["canUpdate"];
  return run_jump($view$viewEl$, ["div", { $: "Con", ["head"]: run_loop($view$attrClass$("component-row")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("id", _id_0)), ["tail"]: { $: "Nil" } } }, run_loop($view$viewJoin$({ $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$viewEl$("span", { $: "Con", ["head"]: run_loop($view$attrClass$("component-name")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$(_label_0)), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("span", { $: "Con", ["head"]: run_loop($view$attrClass$("component-version")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($componentVersionText$(_version_0)))), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("span", { $: "Con", ["head"]: run_loop($view$attrClass$("component-state")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($componentStateText$(_state_0)))), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Nil" } } } }, ["tail"]: { $: "Con", ["head"]: run_loop($view$viewWhen$(run_loop($Bool$not$(run_loop($String$is_empty$(_hint_0)))), run_loop($componentHintNode$(_hint_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewWhen$(run_loop($Bool$not$(run_loop($String$is_empty$(_link_0)))), run_loop($componentLinkButton$(_link_0, _linkLabel_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewWhen$(_canUpdate_0, run_loop($updatePiButton$()))), ["tail"]: { $: "Nil" } } } } }))]);
}
function $componentRows$go$(_rs_0) {
  if (_rs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _rs_0["head"];
    const _t_0 = _rs_0["tail"];
    return { $: "Con", ["head"]: run_loop($componentRowNode$(_h_0)), ["tail"]: run_loop($componentRows$go$(_t_0)) };
  }
}
function $componentRows$(_rs_0) {
  return run_jump($componentRows$go$, [_rs_0]);
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
function $List$last$(_xs_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "None" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return { $: "Some", ["value"]: run_loop($List$last$go$(_t_0, _h_0)) };
  }
}
function $String$split$(_s_0, _sep_0) {
  if (_s_0 === "") {
    return { $: "Con", ["head"]: "", ["tail"]: { $: "Nil" } };
  } else {
    const _h_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(0, 2) : _s_0[0];
    const _t_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(2) : _s_0.slice(1);
    return run_jump($String$split$fin$, [_h_0, run_loop($String$split$(_t_0, _sep_0)), run_loop($Char$is_eq$(_h_0, _sep_0))]);
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
function $List$last$go$(_xs_0, _last_0) {
  if (_xs_0.$ === "Nil") {
    return _last_0;
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return run_jump($List$last$go$, [_t_0, _h_0]);
  }
}
function $String$split$fin$(_c_0, _r_0, _cut_0) {
  if (!_cut_0) {
    return run_jump($String$split$push$, [_c_0, _r_0]);
  } else {
    return { $: "Con", ["head"]: "", ["tail"]: _r_0 };
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
function $Nat$show$go$(_f_0, _n_0, _acc_0) {
  if (_f_0 === 0n) {
    return _acc_0;
  } else {
    const _g_0 = _f_0 - 1n;
    return run_jump($Nat$show$fin$, [_g_0, _acc_0, run_loop($Nat$show$put$(nat_divmod(_n_0, 10n)))]);
  }
}
function $String$split$push$(_c_0, _ps_0) {
  if (_ps_0.$ === "Nil") {
    return { $: "Con", ["head"]: _c_0 + "", ["tail"]: { $: "Nil" } };
  } else {
    const _h_0 = _ps_0["head"];
    const _t_0 = _ps_0["tail"];
    return { $: "Con", ["head"]: _c_0 + _h_0, ["tail"]: _t_0 };
  }
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
  bookmarkNameInput: run_lib($bookmarkNameInput$, 1),
  bookmarkActions: run_lib($bookmarkActions$, 0),
  bookmarkChildren: run_lib($bookmarkChildren$, 2),
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
  "updateReadyPrefix.if": run_lib($updateReadyPrefix$if$, 2),
  updateReadyPrefix: run_lib($updateReadyPrefix$, 2),
  "updateReadyJoin.if": run_lib($updateReadyJoin$if$, 1),
  updateReadyJoin: run_lib($updateReadyJoin$, 1),
  updateNotesLabel: run_lib($updateNotesLabel$, 0),
  updateApplyLabel: run_lib($updateApplyLabel$, 0),
  updatePiLabel: run_lib($updatePiLabel$, 0),
  updateApplyingText: run_lib($updateApplyingText$, 0),
  updateDoneText: run_lib($updateDoneText$, 1),
  "updateRecoveredText.if": run_lib($updateRecoveredText$if$, 3),
  updateRecoveredText: run_lib($updateRecoveredText$, 2),
  "updateIncompleteText.if": run_lib($updateIncompleteText$if$, 3),
  updateIncompleteText: run_lib($updateIncompleteText$, 2),
  updateLogLabel: run_lib($updateLogLabel$, 0),
  updateLineNode: run_lib($updateLineNode$, 1),
  releaseNotesButton: run_lib($releaseNotesButton$, 1),
  updateLogButton: run_lib($updateLogButton$, 0),
  applyUpdateButton: run_lib($applyUpdateButton$, 0),
  applyingUpdateButton: run_lib($applyingUpdateButton$, 0),
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

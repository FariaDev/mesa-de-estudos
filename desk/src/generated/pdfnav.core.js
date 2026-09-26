// GERADO de core/pdfnav.bend por `bun core/build.mjs` — não editar à mão.
// core/pdfnav.bend
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
function $maxName$() {
  return 60n;
}
function $maxPath$() {
  return BigInt(1024);
}
function $maxBookmarks$() {
  return 200n;
}
function $maxOutline$() {
  return 40n;
}
function $maxDepth$() {
  return 3n;
}
function $cutName$if$(_text_0, _limit_0, _over_0) {
  if (!_over_0) {
    return _text_0;
  } else {
    return run_jump($String$take$, [_text_0, _limit_0]);
  }
}
function $cutName$(_text_0, _limit_0) {
  return run_jump($cutName$if$, [_text_0, _limit_0, run_loop($Nat$is_gt$(BigInt([..._text_0].length), _limit_0))]);
}
function $fitName$(_text_0) {
  return run_jump($cutName$, [run_loop($String$trim$(_text_0)), run_loop($maxName$())]);
}
function $keepName$blank$(_blank_0) {
  if (_blank_0) {
    return false;
  } else {
    return true;
  }
}
function $keepName$(_name_0) {
  return run_jump($keepName$blank$, [run_loop($String$is_empty$(run_loop($String$trim$(_name_0))))]);
}
function $pageLabel$(_page_0) {
  const _x_0 = run_loop($Nat$show$(_page_0));
  return "p. " + _x_0;
}
function $bookmarkLabel$(_name_0) {
  return _name_0;
}
function $bookmarkTitle$(_name_0, _page_0) {
  const _x_0 = run_loop($pageLabel$(_page_0));
  const _x_1 = " na " + _x_0;
  const _x_2 = _name_0 + _x_1;
  return "Abrir " + _x_2;
}
function $bookmarkAria$(_name_0, _page_0) {
  const _x_0 = run_loop($pageLabel$(_page_0));
  const _x_1 = ", " + _x_0;
  const _x_2 = _name_0 + _x_1;
  return "Abrir o favorito " + _x_2;
}
function $removeLabel$() {
  return "Remover";
}
function $removeTitle$(_name_0) {
  return "Remover o favorito " + _name_0;
}
function $removeAria$(_name_0) {
  return "Remover o favorito " + _name_0;
}
function $saveLabel$() {
  return "Guardar esta página…";
}
function $saveTitle$() {
  return "Guardar a página aberta como favorito";
}
function $favoritesTitle$() {
  return "Favoritos desta matéria";
}
function $favoritesEmpty$() {
  return "Nenhum favorito nesta matéria.";
}
function $outlineTitle$() {
  return "Sumário deste PDF";
}
function $outlineEmpty$() {
  return "Este PDF não tem sumário.";
}
function $navButtonLabel$() {
  return "Navegar";
}
function $navButtonTitle$() {
  return "Favoritos e sumário";
}
function $navAria$(_label_0) {
  return "Navegar em " + _label_0;
}
function $navBackLabel$() {
  return "Voltar";
}
function $navBackTitle$() {
  return "Voltar à página anterior";
}
function $navBackAria$(_label_0) {
  return "Voltar à página anterior de " + _label_0;
}
function $bookmarkDialogTitle$() {
  return "Guardar esta página";
}
function $bookmarkNameLabel$() {
  return "Nome do favorito";
}
function $bookmarkDialogHint$(_name_0, _page_0) {
  const _x_0 = run_loop($pageLabel$(_page_0));
  const _x_1 = ", " + _x_0;
  return _name_0 + _x_1;
}
function $bookmarkSaveLabel$() {
  return "Salvar";
}
function $bookmarkCancelLabel$() {
  return "Cancelar";
}
function $pageFloor$if$(_page_0, _low_0) {
  if (_low_0) {
    return 1n;
  } else {
    return _page_0;
  }
}
function $pageFloor$(_page_0) {
  return run_jump($pageFloor$if$, [_page_0, _page_0 < 1n]);
}
function $fitPath$(_text_0) {
  return run_jump($cutName$, [run_loop($String$trim$(_text_0)), run_loop($maxPath$())]);
}
function $newBookmark$(_name_0, _path_0, _page_0) {
  return { $: "Bookmark", ["name"]: run_loop($fitName$(_name_0)), ["path"]: run_loop($fitPath$(_path_0)), ["page"]: run_loop($pageFloor$(_page_0)) };
}
function $keepBookmark$path$(_noPath_0) {
  if (_noPath_0) {
    return false;
  } else {
    return true;
  }
}
function $keepBookmark$(_bm_0) {
  const _name_0 = _bm_0["name"];
  const _path_0 = _bm_0["path"];
  const __0 = _bm_0["page"];
  return run_jump($Bool$and$, [run_loop($keepName$blank$(run_loop($String$is_empty$(run_loop($String$trim$(_name_0)))))), run_loop($keepBookmark$path$(run_loop($String$is_empty$(run_loop($String$trim$(_path_0))))))]);
}
function $sameBookmark$(_a_0, _b_0) {
  const _name_0 = _a_0["name"];
  const _path_0 = _a_0["path"];
  const __0 = _a_0["page"];
  const _name2_0 = _b_0["name"];
  const _path2_0 = _b_0["path"];
  const __1 = _b_0["page"];
  return run_jump($Bool$and$, [run_loop($String$eq$(_name_0, _name2_0)), run_loop($String$eq$(_path_0, _path2_0))]);
}
function $dropSame$head$(_h_0, _rest_0, _same_0) {
  if (_same_0) {
    return _rest_0;
  } else {
    return { $: "Con", ["head"]: _h_0, ["tail"]: _rest_0 };
  }
}
function $dropSame$go$(_bs_0, _bm_0) {
  if (_bs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _bs_0["head"];
    const _t_0 = _bs_0["tail"];
    return run_jump($dropSame$head$, [_h_0, run_loop($dropSame$go$(_t_0, _bm_0)), run_loop($sameBookmark$(_h_0, _bm_0))]);
  }
}
function $takeList$go$(_xs_0, _n_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    if (_n_0 === 0n) {
      return { $: "Nil" };
    } else {
      const _p_0 = _n_0 - 1n;
      return { $: "Con", ["head"]: _h_0, ["tail"]: run_loop($takeList$go$(_t_0, _p_0)) };
    }
  }
}
function $addBookmark$(_bs_0, _bm_0) {
  return run_jump($takeList$go$, [{ $: "Con", ["head"]: _bm_0, ["tail"]: run_loop($dropSame$go$(_bs_0, _bm_0)) }, run_loop($maxBookmarks$())]);
}
function $removeBookmark$(_bs_0, _bm_0) {
  return run_jump($dropSame$go$, [_bs_0, _bm_0]);
}
function $emptyBooks$(_bs_0) {
  return run_jump($Nat$is_eq$, [run_loop($List$length$(_bs_0)), 0n]);
}
function $emptyOutline$(_os_0) {
  return run_jump($Nat$is_eq$, [run_loop($List$length$(_os_0)), 0n]);
}
function $bookmarkRow$(_id_0, _bm_0, _currentPath_0) {
  const _name_0 = _bm_0["name"];
  const _path_0 = _bm_0["path"];
  const _page_0 = _bm_0["page"];
  return run_jump($view$viewEl$, ["div", { $: "Con", ["head"]: run_loop($view$attrClass$("nav-row")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewEl$("button", { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$classes$({ $: "Con", ["head"]: run_loop($view$classOn$("nav-bookmark", true)), ["tail"]: { $: "Con", ["head"]: run_loop($view$classOn$("current", run_loop($String$eq$(_path_0, _currentPath_0)))), ["tail"]: { $: "Nil" } } })), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("id", run_loop($Nat$show$(_id_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("page", run_loop($Nat$show$(_page_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("path", _path_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrTitle$(run_loop($bookmarkTitle$(_name_0, _page_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("label", run_loop($bookmarkAria$(_name_0, _page_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "OpenBookmark")), ["tail"]: { $: "Nil" } } } } } } } } }, { $: "Con", ["head"]: run_loop($view$viewEl$("span", { $: "Con", ["head"]: run_loop($view$attrClass$("nav-name")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($bookmarkLabel$(_name_0)))), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("span", { $: "Con", ["head"]: run_loop($view$attrClass$("nav-page")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($pageLabel$(_page_0)))), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Nil" } } })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("button", { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$classes$({ $: "Con", ["head"]: run_loop($view$classOn$("icon-btn", true)), ["tail"]: { $: "Con", ["head"]: run_loop($view$classOn$("nav-bookmark-remove", true)), ["tail"]: { $: "Nil" } } })), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("icon", "minus")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("id", run_loop($Nat$show$(_id_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrTitle$(run_loop($removeTitle$(_name_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("label", run_loop($removeAria$(_name_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "RemoveBookmark")), ["tail"]: { $: "Nil" } } } } } } } }, { $: "Nil" })), ["tail"]: { $: "Nil" } } }]);
}
function $bookmarkRows$go$(_bs_0, _currentPath_0, _i_0) {
  if (_bs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _bs_0["head"];
    const _t_0 = _bs_0["tail"];
    return { $: "Con", ["head"]: run_loop($bookmarkRow$(_i_0, _h_0, _currentPath_0)), ["tail"]: run_loop($bookmarkRows$go$(_t_0, _currentPath_0, nat_chk(_i_0 + 1n))) };
  }
}
function $bookmarkRows$(_bs_0, _currentPath_0) {
  return run_jump($bookmarkRows$go$, [_bs_0, _currentPath_0, 0n]);
}
function $clampDepth$if$(_depth_0, _over_0) {
  if (_over_0) {
    return run_jump($maxDepth$, []);
  } else {
    return _depth_0;
  }
}
function $clampDepth$(_depth_0) {
  return run_jump($clampDepth$if$, [_depth_0, run_loop($Nat$is_gt$(_depth_0, run_loop($maxDepth$())))]);
}
function $outlineDepth$(_depth_0) {
  return run_jump($Nat$show$, [run_loop($clampDepth$(_depth_0))]);
}
function $outlineLabel$(_title_0, _page_0) {
  const _x_0 = run_loop($Nat$show$(_page_0));
  const _x_1 = ": " + _title_0;
  const _x_2 = _x_0 + _x_1;
  return "Ir para a p. " + _x_2;
}
function $outlineRow$(_o_0) {
  const _title_0 = _o_0["title"];
  const _page_0 = _o_0["page"];
  const _depth_0 = _o_0["depth"];
  return run_jump($view$viewEl$, ["button", { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrClass$("nav-outline")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("depth", run_loop($outlineDepth$(_depth_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("page", run_loop($Nat$show$(_page_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrTitle$(run_loop($outlineLabel$(_title_0, _page_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("label", run_loop($outlineLabel$(_title_0, _page_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "OpenOutline")), ["tail"]: { $: "Nil" } } } } } } } }, { $: "Con", ["head"]: run_loop($view$viewText$(_title_0)), ["tail"]: { $: "Nil" } }]);
}
function $outlineRows$(_os_0) {
  return run_jump($view$viewMap$1$, [_os_0]);
}
function $navEmpty$(_text_0) {
  return run_jump($view$viewEl$, ["p", { $: "Con", ["head"]: run_loop($view$attrClass$("nav-empty")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$(_text_0)), ["tail"]: { $: "Nil" } }]);
}
function $navSaveButton$() {
  return run_jump($view$viewEl$, ["button", { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrClass$("nav-save")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrTitle$(run_loop($saveTitle$()))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("label", run_loop($saveTitle$()))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "SaveBookmark")), ["tail"]: { $: "Nil" } } } } } }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($saveLabel$()))), ["tail"]: { $: "Nil" } }]);
}
function $navSection$(_title_0, _empty_0, _emptyText_0, _rows_0) {
  return run_jump($view$viewEl$, ["div", { $: "Con", ["head"]: run_loop($view$attrClass$("nav-section")), ["tail"]: { $: "Nil" } }, run_loop($view$viewJoin$({ $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$viewEl$("h4", { $: "Nil" }, { $: "Con", ["head"]: run_loop($view$viewText$(_title_0)), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Nil" } }, ["tail"]: { $: "Con", ["head"]: run_loop($view$viewWhen$(_empty_0, run_loop($navEmpty$(_emptyText_0)))), ["tail"]: { $: "Con", ["head"]: _rows_0, ["tail"]: { $: "Nil" } } } }))]);
}
function $navPopover$(_open_0, _bs_0, _os_0, _currentPath_0) {
  return run_jump($view$viewEl$, ["div", run_loop($view$attrJoin$({ $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$classes$({ $: "Con", ["head"]: run_loop($view$classOn$("pdf-nav-pop", true)), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Nil" } }, ["tail"]: { $: "Con", ["head"]: run_loop($view$attrWhen$(run_loop($Bool$not$(_open_0)), run_loop($view$attr$("hidden", "")))), ["tail"]: { $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrAria$("label", run_loop($navButtonTitle$()))), ["tail"]: { $: "Nil" } }, ["tail"]: { $: "Nil" } } } })), { $: "Con", ["head"]: run_loop($navSaveButton$()), ["tail"]: { $: "Con", ["head"]: run_loop($navSection$(run_loop($favoritesTitle$()), run_loop($emptyBooks$(_bs_0)), run_loop($favoritesEmpty$()), run_loop($bookmarkRows$(_bs_0, _currentPath_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($navSection$(run_loop($outlineTitle$()), run_loop($emptyOutline$(_os_0)), run_loop($outlineEmpty$()), run_loop($outlineRows$(_os_0)))), ["tail"]: { $: "Nil" } } } }]);
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
    return { $: "Con", ["head"]: run_loop($outlineRow$(_h_0)), ["tail"]: run_loop($view$viewMap$1$(_t_0)) };
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
var pdfnav_default = {
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
  maxName: run_lib($maxName$, 0),
  maxPath: run_lib($maxPath$, 0),
  maxBookmarks: run_lib($maxBookmarks$, 0),
  maxOutline: run_lib($maxOutline$, 0),
  maxDepth: run_lib($maxDepth$, 0),
  "cutName.if": run_lib($cutName$if$, 3),
  cutName: run_lib($cutName$, 2),
  fitName: run_lib($fitName$, 1),
  "keepName.blank": run_lib($keepName$blank$, 1),
  keepName: run_lib($keepName$, 1),
  pageLabel: run_lib($pageLabel$, 1),
  bookmarkLabel: run_lib($bookmarkLabel$, 1),
  bookmarkTitle: run_lib($bookmarkTitle$, 2),
  bookmarkAria: run_lib($bookmarkAria$, 2),
  removeLabel: run_lib($removeLabel$, 0),
  removeTitle: run_lib($removeTitle$, 1),
  removeAria: run_lib($removeAria$, 1),
  saveLabel: run_lib($saveLabel$, 0),
  saveTitle: run_lib($saveTitle$, 0),
  favoritesTitle: run_lib($favoritesTitle$, 0),
  favoritesEmpty: run_lib($favoritesEmpty$, 0),
  outlineTitle: run_lib($outlineTitle$, 0),
  outlineEmpty: run_lib($outlineEmpty$, 0),
  navButtonLabel: run_lib($navButtonLabel$, 0),
  navButtonTitle: run_lib($navButtonTitle$, 0),
  navAria: run_lib($navAria$, 1),
  navBackLabel: run_lib($navBackLabel$, 0),
  navBackTitle: run_lib($navBackTitle$, 0),
  navBackAria: run_lib($navBackAria$, 1),
  bookmarkDialogTitle: run_lib($bookmarkDialogTitle$, 0),
  bookmarkNameLabel: run_lib($bookmarkNameLabel$, 0),
  bookmarkDialogHint: run_lib($bookmarkDialogHint$, 2),
  bookmarkSaveLabel: run_lib($bookmarkSaveLabel$, 0),
  bookmarkCancelLabel: run_lib($bookmarkCancelLabel$, 0),
  "pageFloor.if": run_lib($pageFloor$if$, 2),
  pageFloor: run_lib($pageFloor$, 1),
  fitPath: run_lib($fitPath$, 1),
  newBookmark: run_lib($newBookmark$, 3),
  "keepBookmark.path": run_lib($keepBookmark$path$, 1),
  keepBookmark: run_lib($keepBookmark$, 1),
  sameBookmark: run_lib($sameBookmark$, 2),
  "dropSame.head": run_lib($dropSame$head$, 3),
  "dropSame.go": run_lib($dropSame$go$, 2),
  "takeList.go": run_lib($takeList$go$, 2),
  addBookmark: run_lib($addBookmark$, 2),
  removeBookmark: run_lib($removeBookmark$, 2),
  emptyBooks: run_lib($emptyBooks$, 1),
  emptyOutline: run_lib($emptyOutline$, 1),
  bookmarkRow: run_lib($bookmarkRow$, 3),
  "bookmarkRows.go": run_lib($bookmarkRows$go$, 3),
  bookmarkRows: run_lib($bookmarkRows$, 2),
  "clampDepth.if": run_lib($clampDepth$if$, 2),
  clampDepth: run_lib($clampDepth$, 1),
  outlineDepth: run_lib($outlineDepth$, 1),
  outlineLabel: run_lib($outlineLabel$, 2),
  outlineRow: run_lib($outlineRow$, 1),
  outlineRows: run_lib($outlineRows$, 1),
  navEmpty: run_lib($navEmpty$, 1),
  navSaveButton: run_lib($navSaveButton$, 0),
  navSection: run_lib($navSection$, 4),
  navPopover: run_lib($navPopover$, 4)
};
export {
  pdfnav_default as default
};

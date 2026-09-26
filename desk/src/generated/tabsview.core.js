// GERADO de core/tabsview.bend por `bun core/build.mjs` — não editar à mão.
// core/tabsview.bend
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
function $themeLabel$atDark$(_dark_0) {
  if (_dark_0) {
    return "Tema: escuro";
  } else {
    return "Tema: auto";
  }
}
function $themeLabel$at$(_light_0, _dark_0) {
  if (_light_0) {
    return "Tema: claro";
  } else {
    return run_jump($themeLabel$atDark$, [_dark_0]);
  }
}
function $themeLabel$(_raw_0) {
  return run_jump($themeLabel$at$, [run_loop($String$eq$(_raw_0, "light")), run_loop($String$eq$(_raw_0, "dark"))]);
}
function $themeIcon$atDark$(_dark_0) {
  if (_dark_0) {
    return "moon";
  } else {
    return "contrast";
  }
}
function $themeIcon$at$(_light_0, _dark_0) {
  if (_light_0) {
    return "sun";
  } else {
    return run_jump($themeIcon$atDark$, [_dark_0]);
  }
}
function $themeIcon$(_raw_0) {
  return run_jump($themeIcon$at$, [run_loop($String$eq$(_raw_0, "light")), run_loop($String$eq$(_raw_0, "dark"))]);
}
function $labelOr$if$(_s_0, _fallback_0, _empty_0) {
  if (_empty_0) {
    return _fallback_0;
  } else {
    return _s_0;
  }
}
function $labelOr$(_s_0, _fallback_0) {
  return run_jump($labelOr$if$, [_s_0, _fallback_0, run_loop($String$is_empty$(_s_0))]);
}
function $refToggleLabel$(_toggle_0) {
  return run_jump($labelOr$, [_toggle_0, "Formulário"]);
}
function $xournalHidden$(_xournal_0, _win32_0, _hasPath_0) {
  const _x_0 = run_loop($Bool$not$(_xournal_0));
  const _x_1 = run_loop($Bool$and$(_win32_0, run_loop($Bool$not$(_hasPath_0))));
  return _x_0 || _x_1;
}
function $tabActive$(_id_0, _activeId_0, _ggbActive_0) {
  if (_ggbActive_0) {
    return false;
  } else {
    return run_jump($String$eq$, [_id_0, _activeId_0]);
  }
}
function $rovingTabindex$(_active_0) {
  if (_active_0) {
    return "0";
  } else {
    return "-1";
  }
}
function $tabAttrs$(_id_0, _active_0, _disabled_0) {
  return run_jump($view$attrJoin$, [{ $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$classes$({ $: "Con", ["head"]: run_loop($view$classOn$("active", _active_0)), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("id", _id_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$attr$("role", "tab")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("selected", run_loop($view$boolStr$(_active_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attr$("tabindex", run_loop($rovingTabindex$(_active_0)))), ["tail"]: { $: "Nil" } } } } } } }, ["tail"]: { $: "Con", ["head"]: run_loop($view$attrWhen$(_disabled_0, run_loop($view$attr$("disabled", "")))), ["tail"]: { $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "SelectCourse")), ["tail"]: { $: "Nil" } }, ["tail"]: { $: "Nil" } } } }]);
}
function $tabNode$(_id_0, _name_0, _active_0, _disabled_0) {
  return run_jump($view$viewEl$, ["button", run_loop($tabAttrs$(_id_0, _active_0, _disabled_0)), { $: "Con", ["head"]: run_loop($view$viewText$(_name_0)), ["tail"]: { $: "Nil" } }]);
}
function $tabNodeOf$(_h_0, _activeId_0, _ggbActive_0, _disabled_0) {
  const _id_0 = _h_0["id"];
  const _name_0 = _h_0["name"];
  return run_jump($tabNode$, [_id_0, _name_0, run_loop($tabActive$(_id_0, _activeId_0, _ggbActive_0)), _disabled_0]);
}
function $tabSep$() {
  return run_jump($view$viewEl$, ["span", { $: "Con", ["head"]: run_loop($view$attrClass$("tab-sep")), ["tail"]: { $: "Nil" } }, { $: "Nil" }]);
}
function $ggbAttrs$(_active_0, _disabled_0) {
  return run_jump($view$attrJoin$, [{ $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$classes$({ $: "Con", ["head"]: run_loop($view$classOn$("active", _active_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$classOn$("ggb-tab", true)), ["tail"]: { $: "Nil" } } })), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("id", "geogebra")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attr$("role", "tab")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("selected", run_loop($view$boolStr$(_active_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attr$("tabindex", run_loop($rovingTabindex$(_active_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrTitle$("GeoGebra embutido (gráficos, geometria e CAS no applet da web)")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("icon", "graph")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("icon-tight", "")), ["tail"]: { $: "Nil" } } } } } } } } } }, ["tail"]: { $: "Con", ["head"]: run_loop($view$attrWhen$(_disabled_0, run_loop($view$attr$("disabled", "")))), ["tail"]: { $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "OpenGeoGebra")), ["tail"]: { $: "Nil" } }, ["tail"]: { $: "Nil" } } } }]);
}
function $ggbTab$(_active_0, _disabled_0) {
  return run_jump($view$viewEl$, ["button", run_loop($ggbAttrs$(_active_0, _disabled_0)), { $: "Con", ["head"]: run_loop($view$viewText$("GeoGebra")), ["tail"]: { $: "Nil" } }]);
}
function $newTab$() {
  return run_jump($view$viewEl$, ["button", { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrId$("new-tab")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrTitle$("Nova matéria (abre as Configurações)")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("label", "Nova matéria (abre as Configurações)")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "NewCourse")), ["tail"]: { $: "Nil" } } } } } }, { $: "Con", ["head"]: run_loop($view$viewText$("+")), ["tail"]: { $: "Nil" } }]);
}
function $courseTabs$(_cs_0, _activeId_0, _ggbActive_0, _disabled_0) {
  if (_cs_0.$ === "Nil") {
    return { $: "Con", ["head"]: run_loop($tabSep$()), ["tail"]: { $: "Con", ["head"]: run_loop($ggbTab$(_ggbActive_0, _disabled_0)), ["tail"]: { $: "Nil" } } };
  } else {
    const _h_0 = _cs_0["head"];
    const _t_0 = _cs_0["tail"];
    return { $: "Con", ["head"]: run_loop($tabNodeOf$(_h_0, _activeId_0, _ggbActive_0, _disabled_0)), ["tail"]: run_loop($courseTabs$(_t_0, _activeId_0, _ggbActive_0, _disabled_0)) };
  }
}
function $itemIcon$if$(_empty_0, _icon_0) {
  if (_empty_0) {
    return { $: "Nil" };
  } else {
    return { $: "Con", ["head"]: run_loop($view$attrData$("icon", _icon_0)), ["tail"]: { $: "Nil" } };
  }
}
function $itemIcon$(_icon_0) {
  return run_jump($itemIcon$if$, [run_loop($String$is_empty$(_icon_0)), _icon_0]);
}
function $menuItemAttrs$(_id_0, _handler_0, _extra_0, _icon_0) {
  return run_jump($view$attrJoin$, [{ $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrId$(_id_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$attr$("role", "menuitem")), ["tail"]: { $: "Nil" } } } }, ["tail"]: { $: "Con", ["head"]: _extra_0, ["tail"]: { $: "Con", ["head"]: run_loop($itemIcon$(_icon_0)), ["tail"]: { $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", _handler_0)), ["tail"]: { $: "Nil" } }, ["tail"]: { $: "Nil" } } } } }]);
}
function $menuItem$(_id_0, _text_0, _icon_0, _handler_0, _extra_0) {
  return run_jump($view$viewEl$, ["button", run_loop($menuItemAttrs$(_id_0, _handler_0, _extra_0, _icon_0)), { $: "Con", ["head"]: run_loop($view$viewText$(_text_0)), ["tail"]: { $: "Nil" } }]);
}
function $refToggleItem$(_twoPanels_0, _toggle_0, _refVisible_0) {
  return run_jump($menuItem$, ["reference-toggle", run_loop($refToggleLabel$(_toggle_0)), "columns", "ToggleReference", run_loop($view$attrJoin$({ $: "Con", ["head"]: run_loop($view$attrWhen$(run_loop($Bool$not$(_twoPanels_0)), run_loop($view$attr$("hidden", "")))), ["tail"]: { $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrAria$("pressed", run_loop($view$boolStr$(_refVisible_0)))), ["tail"]: { $: "Nil" } }, ["tail"]: { $: "Nil" } } }))]);
}
function $xournalItem$(_xournal_0, _win32_0, _hasPath_0) {
  return run_jump($menuItem$, ["xournal", "Xournal++", "external", "OpenXournal", run_loop($view$attrWhen$(run_loop($xournalHidden$(_xournal_0, _win32_0, _hasPath_0)), run_loop($view$attr$("hidden", ""))))]);
}
function $helpItem$() {
  return run_jump($menuItem$, ["help", "Como usar", "help", "OpenHelp", { $: "Nil" }]);
}
function $endDayItem$(_endDay_0) {
  return run_jump($menuItem$, ["end-day", "Encerrar por hoje", "moon", "OpenEndDay", run_loop($view$attrWhen$(run_loop($Bool$not$(_endDay_0)), run_loop($view$attr$("hidden", ""))))]);
}
function $reviewItem$() {
  return run_jump($menuItem$, ["review-open", "Caderno de revisão", "book", "OpenReview", { $: "Nil" }]);
}
function $densityLabel$() {
  return "Modo compacto";
}
function $densityIcon$(_compact_0) {
  if (_compact_0) {
    return "check";
  } else {
    return "unfold";
  }
}
function $densityItem$(_compact_0) {
  return run_jump($menuItem$, ["density-cycle", run_loop($densityLabel$()), run_loop($densityIcon$(_compact_0)), "ToggleDensity", { $: "Con", ["head"]: run_loop($view$attrAria$("pressed", run_loop($view$boolStr$(_compact_0)))), ["tail"]: { $: "Nil" } }]);
}
function $settingsItem$() {
  return run_jump($menuItem$, ["settings", "Configurações", "settings", "OpenSettings", { $: "Nil" }]);
}
function $themeItem$(_theme_0) {
  return run_jump($menuItem$, ["theme-cycle", run_loop($themeLabel$(_theme_0)), run_loop($themeIcon$(_theme_0)), "CycleTheme", { $: "Nil" }]);
}
function $aboutItem$() {
  return run_jump($menuItem$, ["about", "Sobre", "help", "OpenAbout", { $: "Nil" }]);
}
function $studyItems$(_f_0) {
  const _twoPanels_0 = _f_0["twoPanels"];
  const _toggle_0 = _f_0["toggle"];
  const _refVisible_0 = _f_0["refVisible"];
  const _xournal_0 = _f_0["xournal"];
  const _win32_0 = _f_0["win32"];
  const _hasXournalPath_0 = _f_0["hasXournalPath"];
  const __0 = _f_0["theme"];
  const _endDay_0 = _f_0["endDay"];
  const __1 = _f_0["compact"];
  return { $: "Con", ["head"]: run_loop($refToggleItem$(_twoPanels_0, _toggle_0, _refVisible_0)), ["tail"]: { $: "Con", ["head"]: run_loop($xournalItem$(_xournal_0, _win32_0, _hasXournalPath_0)), ["tail"]: { $: "Con", ["head"]: run_loop($reviewItem$()), ["tail"]: { $: "Con", ["head"]: run_loop($endDayItem$(_endDay_0)), ["tail"]: { $: "Nil" } } } } };
}
function $mesaItems$(_f_0) {
  const __0 = _f_0["twoPanels"];
  const __1 = _f_0["toggle"];
  const __2 = _f_0["refVisible"];
  const __3 = _f_0["xournal"];
  const __4 = _f_0["win32"];
  const __5 = _f_0["hasXournalPath"];
  const _theme_0 = _f_0["theme"];
  const __6 = _f_0["endDay"];
  const _compact_0 = _f_0["compact"];
  return { $: "Con", ["head"]: run_loop($helpItem$()), ["tail"]: { $: "Con", ["head"]: run_loop($settingsItem$()), ["tail"]: { $: "Con", ["head"]: run_loop($themeItem$(_theme_0)), ["tail"]: { $: "Con", ["head"]: run_loop($densityItem$(_compact_0)), ["tail"]: { $: "Con", ["head"]: run_loop($aboutItem$()), ["tail"]: { $: "Nil" } } } } } };
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
function $Bool$not$(_b_0) {
  if (!_b_0) {
    return true;
  } else {
    return false;
  }
}
function $Bool$and$(_a_0, _b_0) {
  if (!_a_0) {
    return false;
  } else {
    return _b_0;
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
function $String$cmp$rec$(_h1b_0, _h2b_0, _rr_0) {
  const _t_0 = _rr_0["fst"];
  const _t1b_0 = _t_0["fst"];
  const _t2b_0 = _t_0["snd"];
  const _r_0 = _rr_0["snd"];
  return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: _h1b_0 + _t1b_0, ["snd"]: _h2b_0 + _t2b_0 }, ["snd"]: _r_0 };
}
var tabsview_default = {
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
  "themeLabel.atDark": run_lib($themeLabel$atDark$, 1),
  "themeLabel.at": run_lib($themeLabel$at$, 2),
  themeLabel: run_lib($themeLabel$, 1),
  "themeIcon.atDark": run_lib($themeIcon$atDark$, 1),
  "themeIcon.at": run_lib($themeIcon$at$, 2),
  themeIcon: run_lib($themeIcon$, 1),
  "labelOr.if": run_lib($labelOr$if$, 3),
  labelOr: run_lib($labelOr$, 2),
  refToggleLabel: run_lib($refToggleLabel$, 1),
  xournalHidden: run_lib($xournalHidden$, 3),
  tabActive: run_lib($tabActive$, 3),
  rovingTabindex: run_lib($rovingTabindex$, 1),
  tabAttrs: run_lib($tabAttrs$, 3),
  tabNode: run_lib($tabNode$, 4),
  tabNodeOf: run_lib($tabNodeOf$, 4),
  tabSep: run_lib($tabSep$, 0),
  ggbAttrs: run_lib($ggbAttrs$, 2),
  ggbTab: run_lib($ggbTab$, 2),
  newTab: run_lib($newTab$, 0),
  courseTabs: run_lib($courseTabs$, 4),
  "itemIcon.if": run_lib($itemIcon$if$, 2),
  itemIcon: run_lib($itemIcon$, 1),
  menuItemAttrs: run_lib($menuItemAttrs$, 4),
  menuItem: run_lib($menuItem$, 5),
  refToggleItem: run_lib($refToggleItem$, 3),
  xournalItem: run_lib($xournalItem$, 3),
  helpItem: run_lib($helpItem$, 0),
  endDayItem: run_lib($endDayItem$, 1),
  reviewItem: run_lib($reviewItem$, 0),
  densityLabel: run_lib($densityLabel$, 0),
  densityIcon: run_lib($densityIcon$, 1),
  densityItem: run_lib($densityItem$, 1),
  settingsItem: run_lib($settingsItem$, 0),
  themeItem: run_lib($themeItem$, 1),
  aboutItem: run_lib($aboutItem$, 0),
  studyItems: run_lib($studyItems$, 1),
  mesaItems: run_lib($mesaItems$, 1)
};
export {
  tabsview_default as default
};

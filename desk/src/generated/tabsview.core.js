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
function $themeLabel$atDark$(dark_0) {
  if (dark_0) {
    return "Tema: escuro";
  } else {
    return "Tema: auto";
  }
}
function $themeLabel$at$(light_0, dark_0) {
  if (light_0) {
    return "Tema: claro";
  } else {
    return run_jump($themeLabel$atDark$, [dark_0]);
  }
}
function $themeLabel$(raw_0) {
  return run_jump($themeLabel$at$, [run_loop($String$eq$(raw_0, "light")), run_loop($String$eq$(raw_0, "dark"))]);
}
function $labelOr$if$(s_0, fallback_0, empty_0) {
  if (empty_0) {
    return fallback_0;
  } else {
    return s_0;
  }
}
function $labelOr$(s_0, fallback_0) {
  return run_jump($labelOr$if$, [s_0, fallback_0, run_loop($String$is_empty$(s_0))]);
}
function $refToggleLabel$(toggle_0) {
  return run_jump($labelOr$, [toggle_0, "Formulário"]);
}
function $xournalHidden$(xournal_0, win32_0, hasPath_0) {
  const x_0 = run_loop($Bool$not$(xournal_0));
  const x_1 = run_loop($Bool$and$(win32_0, run_loop($Bool$not$(hasPath_0))));
  return x_0 || x_1;
}
function $tabActive$(id_0, activeId_0, ggbActive_0) {
  if (ggbActive_0) {
    return false;
  } else {
    return run_jump($String$eq$, [id_0, activeId_0]);
  }
}
function $rovingTabindex$(active_0) {
  if (active_0) {
    return "0";
  } else {
    return "-1";
  }
}
function $tabAttrs$(id_0, active_0, disabled_0) {
  return run_jump($view$attrJoin$, [{ $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$classes$({ $: "Con", ["head"]: run_loop($view$classOn$("active", active_0)), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("id", id_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$attr$("role", "tab")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("selected", run_loop($view$boolStr$(active_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attr$("tabindex", run_loop($rovingTabindex$(active_0)))), ["tail"]: { $: "Nil" } } } } } } }, ["tail"]: { $: "Con", ["head"]: run_loop($view$attrWhen$(disabled_0, run_loop($view$attr$("disabled", "")))), ["tail"]: { $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "SelectCourse")), ["tail"]: { $: "Nil" } }, ["tail"]: { $: "Nil" } } } }]);
}
function $tabNode$(id_0, name_0, active_0, disabled_0) {
  return run_jump($view$viewEl$, ["button", run_loop($tabAttrs$(id_0, active_0, disabled_0)), { $: "Con", ["head"]: run_loop($view$viewText$(name_0)), ["tail"]: { $: "Nil" } }]);
}
function $tabNodeOf$(h_0, activeId_0, ggbActive_0, disabled_0) {
  const id_0 = h_0.id;
  const name_0 = h_0.name;
  const id_1 = id_0;
  return run_jump($tabNode$, [id_1, name_0, run_loop($tabActive$(id_1, activeId_0, ggbActive_0)), disabled_0]);
}
function $tabSep$() {
  return run_jump($view$viewEl$, ["span", { $: "Con", ["head"]: run_loop($view$attrClass$("tab-sep")), ["tail"]: { $: "Nil" } }, { $: "Nil" }]);
}
function $ggbAttrs$(active_0, disabled_0) {
  return run_jump($view$attrJoin$, [{ $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$classes$({ $: "Con", ["head"]: run_loop($view$classOn$("active", active_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$classOn$("ggb-tab", true)), ["tail"]: { $: "Nil" } } })), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("id", "geogebra")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attr$("role", "tab")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("selected", run_loop($view$boolStr$(active_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attr$("tabindex", run_loop($rovingTabindex$(active_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrTitle$("GeoGebra embutido (gráficos, geometria e CAS no applet da web)")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("icon", "shapes")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("icon-tight", "")), ["tail"]: { $: "Nil" } } } } } } } } } }, ["tail"]: { $: "Con", ["head"]: run_loop($view$attrWhen$(disabled_0, run_loop($view$attr$("disabled", "")))), ["tail"]: { $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "OpenGeoGebra")), ["tail"]: { $: "Nil" } }, ["tail"]: { $: "Nil" } } } }]);
}
function $ggbTab$(active_0, disabled_0) {
  return run_jump($view$viewEl$, ["button", run_loop($ggbAttrs$(active_0, disabled_0)), { $: "Con", ["head"]: run_loop($view$viewText$("GeoGebra")), ["tail"]: { $: "Nil" } }]);
}
function $newTab$() {
  return run_jump($view$viewEl$, ["button", { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrId$("new-tab")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrTitle$("Nova matéria (abre as Configurações)")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("label", "Nova matéria (abre as Configurações)")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "NewCourse")), ["tail"]: { $: "Nil" } } } } } }, { $: "Con", ["head"]: run_loop($view$viewText$("+")), ["tail"]: { $: "Nil" } }]);
}
function $courseTabs$(cs_0, activeId_0, ggbActive_0, disabled_0) {
  if (cs_0.$ === "Nil") {
    return { $: "Con", ["head"]: run_loop($tabSep$()), ["tail"]: { $: "Con", ["head"]: run_loop($ggbTab$(ggbActive_0, disabled_0)), ["tail"]: { $: "Nil" } } };
  } else {
    const h_0 = cs_0.head;
    const t_0 = cs_0.tail;
    return { $: "Con", ["head"]: run_loop($tabNodeOf$(h_0, activeId_0, ggbActive_0, disabled_0)), ["tail"]: run_loop($courseTabs$(t_0, activeId_0, ggbActive_0, disabled_0)) };
  }
}
function $itemIcon$if$(empty_0, icon_0) {
  if (empty_0) {
    return { $: "Nil" };
  } else {
    return { $: "Con", ["head"]: run_loop($view$attrData$("icon", icon_0)), ["tail"]: { $: "Nil" } };
  }
}
function $itemIcon$(icon_0) {
  return run_jump($itemIcon$if$, [run_loop($String$is_empty$(icon_0)), icon_0]);
}
function $menuItemAttrs$(id_0, handler_0, extra_0, icon_0) {
  return run_jump($view$attrJoin$, [{ $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrId$(id_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$attr$("role", "menuitem")), ["tail"]: { $: "Nil" } } } }, ["tail"]: { $: "Con", ["head"]: extra_0, ["tail"]: { $: "Con", ["head"]: run_loop($itemIcon$(icon_0)), ["tail"]: { $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", handler_0)), ["tail"]: { $: "Nil" } }, ["tail"]: { $: "Nil" } } } } }]);
}
function $menuItem$(id_0, text_0, icon_0, handler_0, extra_0) {
  return run_jump($view$viewEl$, ["button", run_loop($menuItemAttrs$(id_0, handler_0, extra_0, icon_0)), { $: "Con", ["head"]: run_loop($view$viewText$(text_0)), ["tail"]: { $: "Nil" } }]);
}
function $refToggleItem$(twoPanels_0, toggle_0, refVisible_0) {
  return run_jump($menuItem$, ["reference-toggle", run_loop($refToggleLabel$(toggle_0)), "columns", "ToggleReference", run_loop($view$attrJoin$({ $: "Con", ["head"]: run_loop($view$attrWhen$(run_loop($Bool$not$(twoPanels_0)), run_loop($view$attr$("hidden", "")))), ["tail"]: { $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrAria$("pressed", run_loop($view$boolStr$(refVisible_0)))), ["tail"]: { $: "Nil" } }, ["tail"]: { $: "Nil" } } }))]);
}
function $xournalItem$(xournal_0, win32_0, hasPath_0) {
  return run_jump($menuItem$, ["xournal", "Xournal++", "external", "OpenXournal", run_loop($view$attrWhen$(run_loop($xournalHidden$(xournal_0, win32_0, hasPath_0)), run_loop($view$attr$("hidden", ""))))]);
}
function $helpItem$() {
  return run_jump($menuItem$, ["help", "Como usar", "help", "OpenHelp", { $: "Nil" }]);
}
function $settingsItem$() {
  return run_jump($menuItem$, ["settings", "Configurações", "settings", "OpenSettings", { $: "Nil" }]);
}
function $themeItem$(theme_0) {
  return run_jump($menuItem$, ["theme-cycle", run_loop($themeLabel$(theme_0)), "", "CycleTheme", { $: "Nil" }]);
}
function $aboutItem$() {
  return run_jump($menuItem$, ["about", "Sobre", "help", "OpenAbout", { $: "Nil" }]);
}
function $studyItems$(f_0) {
  const twoPanels_0 = f_0.twoPanels;
  const toggle_0 = f_0.toggle;
  const refVisible_0 = f_0.refVisible;
  const xournal_0 = f_0.xournal;
  const win32_0 = f_0.win32;
  const hasXournalPath_0 = f_0.hasXournalPath;
  const __0 = f_0.theme;
  return { $: "Con", ["head"]: run_loop($refToggleItem$(twoPanels_0, toggle_0, refVisible_0)), ["tail"]: { $: "Con", ["head"]: run_loop($xournalItem$(xournal_0, win32_0, hasXournalPath_0)), ["tail"]: { $: "Nil" } } };
}
function $mesaItems$(f_0) {
  const __0 = f_0.twoPanels;
  const __1 = f_0.toggle;
  const __2 = f_0.refVisible;
  const __3 = f_0.xournal;
  const __4 = f_0.win32;
  const __5 = f_0.hasXournalPath;
  const theme_0 = f_0.theme;
  return { $: "Con", ["head"]: run_loop($helpItem$()), ["tail"]: { $: "Con", ["head"]: run_loop($settingsItem$()), ["tail"]: { $: "Con", ["head"]: run_loop($themeItem$(theme_0)), ["tail"]: { $: "Con", ["head"]: run_loop($aboutItem$()), ["tail"]: { $: "Nil" } } } } };
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
function $Bool$and$(a_0, b_0) {
  if (!a_0) {
    return false;
  } else {
    return b_0;
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
  "view.viewMap~0": run_lib($view$viewMap$0$, 1),
  "view.viewMapText": run_lib($view$viewMapText$, 1),
  "view.asTextI": run_lib($view$asTextI$, 2),
  "view.viewMapI.go~0": run_lib($view$viewMapI$go$0$, 2),
  "view.viewMapTextI.go": run_lib($view$viewMapTextI$go$, 2),
  "view.viewMapTextI": run_lib($view$viewMapTextI$, 1),
  "themeLabel.atDark": run_lib($themeLabel$atDark$, 1),
  "themeLabel.at": run_lib($themeLabel$at$, 2),
  themeLabel: run_lib($themeLabel$, 1),
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
  settingsItem: run_lib($settingsItem$, 0),
  themeItem: run_lib($themeItem$, 1),
  aboutItem: run_lib($aboutItem$, 0),
  studyItems: run_lib($studyItems$, 1),
  mesaItems: run_lib($mesaItems$, 1)
};
export {
  tabsview_default as default
};

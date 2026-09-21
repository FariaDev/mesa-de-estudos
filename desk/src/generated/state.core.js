// GERADO de core/state.bend por `bun core/build.mjs` — não editar à mão.
// core/state.bend
function cmp_new(a, b) {
  return { $: a < b ? "LT" : a === b ? "EQ" : "GT" };
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
function $take$go$(s_0, n_0, acc_0) {
  if (s_0 === "") {
    return run_jump($String$reverse$, [acc_0]);
  } else {
    const h_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(0, 2) : s_0[0];
    const t_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(2) : s_0.slice(1);
    if (n_0 === 0n) {
      return run_jump($String$reverse$, [acc_0]);
    } else {
      const p_0 = n_0 - 1n;
      return run_jump($take$go$, [t_0, p_0, h_0 + acc_0]);
    }
  }
}
function $take$(s_0, n_0) {
  return run_jump($take$go$, [s_0, n_0, ""]);
}
function $trimTake$(text_0, limit_0) {
  return run_jump($take$, [run_loop($String$trim$(text_0)), limit_0]);
}
function $maxDraftChars$() {
  return 1e5;
}
function $cleanDraft$(overLimit_0, original_0, cut_0) {
  if (overLimit_0) {
    return cut_0;
  } else {
    return original_0;
  }
}
function $draftOrDefault$(value_0, cut_0, overLimit_0, fallback_0) {
  if (value_0.$ === "None") {
    return fallback_0;
  } else {
    const text_0 = value_0.value;
    return run_jump($cleanDraft$, [overLimit_0, text_0, cut_0]);
  }
}
function $themeFromDark$(isDark_0, fallback_0) {
  if (isDark_0) {
    return { $: "StateThemeDark" };
  } else {
    return fallback_0;
  }
}
function $themeFromLight$(isLight_0, isDark_0, fallback_0) {
  if (isLight_0) {
    return { $: "StateThemeLight" };
  } else {
    return run_jump($themeFromDark$, [isDark_0, fallback_0]);
  }
}
function $themeFromFacts$(isAuto_0, isLight_0, isDark_0, fallback_0) {
  if (isAuto_0) {
    return { $: "StateThemeAuto" };
  } else {
    return run_jump($themeFromLight$, [isLight_0, isDark_0, fallback_0]);
  }
}
function $parseTheme$(raw_0, fallback_0) {
  return run_jump($themeFromFacts$, [run_loop($String$eq$(raw_0, "auto")), run_loop($String$eq$(raw_0, "light")), run_loop($String$eq$(raw_0, "dark")), fallback_0]);
}
function $themeOrDefault$(value_0, fallback_0) {
  if (value_0.$ === "None") {
    return fallback_0;
  } else {
    const raw_0 = value_0.value;
    return run_jump($parseTheme$, [raw_0, fallback_0]);
  }
}
function $boolOrDefault$(value_0, fallback_0) {
  if (value_0.$ === "None") {
    return fallback_0;
  } else {
    const valid_0 = value_0.value;
    return valid_0;
  }
}
function $clampHigh$(over_0, value_0, high_0) {
  if (over_0) {
    return high_0;
  } else {
    return value_0;
  }
}
function $clampPresent$(under_0, over_0, value_0, low_0, high_0) {
  if (under_0) {
    return low_0;
  } else {
    return run_jump($clampHigh$, [over_0, value_0, high_0]);
  }
}
function $clampOrDefault$(value_0, under_0, over_0, low_0, high_0, fallback_0) {
  if (value_0.$ === "None") {
    return fallback_0;
  } else {
    const valid_0 = value_0.value;
    return run_jump($clampPresent$, [under_0, over_0, valid_0, low_0, high_0]);
  }
}
function $deskDefaults$() {
  return { $: "DeskState", ["draft"]: "", ["theme"]: { $: "StateThemeAuto" }, ["referenceVisible"]: true, ["chatWidth"]: 390, ["calcHeight"]: 220, ["pdfSplit"]: 0.5 };
}
function $chatDefaults$() {
  return { $: "ChatState", ["draft"]: "", ["theme"]: { $: "StateThemeAuto" }, ["search"]: false };
}
function $mergeDesk$(defaults_0, input_0) {
  const draft0_0 = defaults_0.draft;
  const theme0_0 = defaults_0.theme;
  const refs0_0 = defaults_0.referenceVisible;
  const chat0_0 = defaults_0.chatWidth;
  const calc0_0 = defaults_0.calcHeight;
  const split0_0 = defaults_0.pdfSplit;
  const draft_0 = input_0.draft;
  const draftCut_0 = input_0.draftCut;
  const draftOver_0 = input_0.draftOverLimit;
  const theme_0 = input_0.theme;
  const refs_0 = input_0.referenceVisible;
  const chat_0 = input_0.chatWidth;
  const chatUnder_0 = input_0.chatWidthUnder;
  const chatOver_0 = input_0.chatWidthOver;
  const calc_0 = input_0.calcHeight;
  const calcUnder_0 = input_0.calcHeightUnder;
  const calcOver_0 = input_0.calcHeightOver;
  const split_0 = input_0.pdfSplit;
  const splitUnder_0 = input_0.pdfSplitUnder;
  const splitOver_0 = input_0.pdfSplitOver;
  return { $: "DeskState", ["draft"]: run_loop($draftOrDefault$(draft_0, draftCut_0, draftOver_0, draft0_0)), ["theme"]: run_loop($themeOrDefault$(theme_0, theme0_0)), ["referenceVisible"]: run_loop($boolOrDefault$(refs_0, refs0_0)), ["chatWidth"]: run_loop($clampOrDefault$(chat_0, chatUnder_0, chatOver_0, 300, 700, chat0_0)), ["calcHeight"]: run_loop($clampOrDefault$(calc_0, calcUnder_0, calcOver_0, 72, 900, calc0_0)), ["pdfSplit"]: run_loop($clampOrDefault$(split_0, splitUnder_0, splitOver_0, 0.20000000298023224, 0.800000011920929, split0_0)) };
}
function $mergeChat$(defaults_0, input_0) {
  const draft0_0 = defaults_0.draft;
  const theme0_0 = defaults_0.theme;
  const search0_0 = defaults_0.search;
  const draft_0 = input_0.draft;
  const draftCut_0 = input_0.draftCut;
  const draftOver_0 = input_0.draftOverLimit;
  const theme_0 = input_0.theme;
  const search_0 = input_0.search;
  return { $: "ChatState", ["draft"]: run_loop($draftOrDefault$(draft_0, draftCut_0, draftOver_0, draft0_0)), ["theme"]: run_loop($themeOrDefault$(theme_0, theme0_0)), ["search"]: run_loop($boolOrDefault$(search_0, search0_0)) };
}
function $normalizeDesk$(input_0) {
  return run_jump($mergeDesk$, [run_loop($deskDefaults$()), input_0]);
}
function $normalizeChat$(input_0) {
  return run_jump($mergeChat$, [run_loop($chatDefaults$()), input_0]);
}
function $String$reverse$(s_0) {
  return run_jump($String$reverse$go$, [s_0, ""]);
}
function $String$trim$(s_0) {
  return run_jump($String$trim_end$, [run_loop($String$trim_start$(s_0))]);
}
function $String$eq$(a_0, b_0) {
  return run_jump($String$eq$fin$, [run_loop($String$cmp$(a_0, b_0))]);
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
function $String$trim_end$(s_0) {
  return run_jump($String$reverse$, [run_loop($String$trim_start$(run_loop($String$reverse$(s_0))))]);
}
function $String$trim_start$(s_0) {
  if (s_0 === "") {
    return "";
  } else {
    const h_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(0, 2) : s_0[0];
    const t_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(2) : s_0.slice(1);
    const h_1 = h_0;
    return run_jump($String$trim_start$if$, [h_1, t_0, run_loop($Char$is_space$(h_1))]);
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
function $String$trim_start$if$(h_0, t_0, space_0) {
  if (!space_0) {
    return h_0 + t_0;
  } else {
    return run_jump($String$trim_start$, [t_0]);
  }
}
function $Char$is_space$(c_0) {
  const x_0 = c_0.codePointAt(0);
  const x_1 = x_0;
  const x_2 = x_1 === 32;
  const x_3 = run_loop($Bool$and$(x_1 >= 9, x_1 <= 13));
  return x_2 || x_3;
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
function $Bool$and$(a_0, b_0) {
  if (!a_0) {
    return false;
  } else {
    return b_0;
  }
}
function $String$cmp$rec$(h1b_0, h2b_0, rr_0) {
  const _t_0 = rr_0.fst;
  const t1b_0 = _t_0.fst;
  const t2b_0 = _t_0.snd;
  const r_0 = rr_0.snd;
  return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: h1b_0 + t1b_0, ["snd"]: h2b_0 + t2b_0 }, ["snd"]: r_0 };
}
var state_default = {
  "take.go": run_lib($take$go$, 3),
  take: run_lib($take$, 2),
  trimTake: run_lib($trimTake$, 2),
  maxDraftChars: run_lib($maxDraftChars$, 0),
  cleanDraft: run_lib($cleanDraft$, 3),
  draftOrDefault: run_lib($draftOrDefault$, 4),
  themeFromDark: run_lib($themeFromDark$, 2),
  themeFromLight: run_lib($themeFromLight$, 3),
  themeFromFacts: run_lib($themeFromFacts$, 4),
  parseTheme: run_lib($parseTheme$, 2),
  themeOrDefault: run_lib($themeOrDefault$, 2),
  boolOrDefault: run_lib($boolOrDefault$, 2),
  clampHigh: run_lib($clampHigh$, 3),
  clampPresent: run_lib($clampPresent$, 5),
  clampOrDefault: run_lib($clampOrDefault$, 6),
  deskDefaults: run_lib($deskDefaults$, 0),
  chatDefaults: run_lib($chatDefaults$, 0),
  mergeDesk: run_lib($mergeDesk$, 2),
  mergeChat: run_lib($mergeChat$, 2),
  normalizeDesk: run_lib($normalizeDesk$, 1),
  normalizeChat: run_lib($normalizeChat$, 1)
};
export {
  state_default as default
};

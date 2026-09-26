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
function $take$go$(_s_0, _n_0, _acc_0) {
  if (_s_0 === "") {
    return run_jump($String$reverse$, [_acc_0]);
  } else {
    const _h_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(0, 2) : _s_0[0];
    const _t_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(2) : _s_0.slice(1);
    if (_n_0 === 0n) {
      return run_jump($String$reverse$, [_acc_0]);
    } else {
      const _p_0 = _n_0 - 1n;
      return run_jump($take$go$, [_t_0, _p_0, _h_0 + _acc_0]);
    }
  }
}
function $take$(_s_0, _n_0) {
  return run_jump($take$go$, [_s_0, _n_0, ""]);
}
function $trimTake$(_text_0, _limit_0) {
  return run_jump($take$, [run_loop($String$trim$(_text_0)), _limit_0]);
}
function $maxDraftChars$() {
  return 1e5;
}
function $cleanDraft$(_overLimit_0, _original_0, _cut_0) {
  if (_overLimit_0) {
    return _cut_0;
  } else {
    return _original_0;
  }
}
function $draftOrDefault$(_value_0, _cut_0, _overLimit_0, _fallback_0) {
  if (_value_0.$ === "None") {
    return _fallback_0;
  } else {
    const _text_0 = _value_0["value"];
    return run_jump($cleanDraft$, [_overLimit_0, _text_0, _cut_0]);
  }
}
function $themeFromDark$(_isDark_0, _fallback_0) {
  if (_isDark_0) {
    return { $: "StateThemeDark" };
  } else {
    return _fallback_0;
  }
}
function $themeFromLight$(_isLight_0, _isDark_0, _fallback_0) {
  if (_isLight_0) {
    return { $: "StateThemeLight" };
  } else {
    return run_jump($themeFromDark$, [_isDark_0, _fallback_0]);
  }
}
function $themeFromFacts$(_isAuto_0, _isLight_0, _isDark_0, _fallback_0) {
  if (_isAuto_0) {
    return { $: "StateThemeAuto" };
  } else {
    return run_jump($themeFromLight$, [_isLight_0, _isDark_0, _fallback_0]);
  }
}
function $parseTheme$(_raw_0, _fallback_0) {
  return run_jump($themeFromFacts$, [run_loop($String$eq$(_raw_0, "auto")), run_loop($String$eq$(_raw_0, "light")), run_loop($String$eq$(_raw_0, "dark")), _fallback_0]);
}
function $themeOrDefault$(_value_0, _fallback_0) {
  if (_value_0.$ === "None") {
    return _fallback_0;
  } else {
    const _raw_0 = _value_0["value"];
    return run_jump($parseTheme$, [_raw_0, _fallback_0]);
  }
}
function $boolOrDefault$(_value_0, _fallback_0) {
  if (_value_0.$ === "None") {
    return _fallback_0;
  } else {
    const _valid_0 = _value_0["value"];
    return _valid_0;
  }
}
function $clampHigh$(_over_0, _value_0, _high_0) {
  if (_over_0) {
    return _high_0;
  } else {
    return _value_0;
  }
}
function $clampPresent$(_under_0, _over_0, _value_0, _low_0, _high_0) {
  if (_under_0) {
    return _low_0;
  } else {
    return run_jump($clampHigh$, [_over_0, _value_0, _high_0]);
  }
}
function $clampOrDefault$(_value_0, _under_0, _over_0, _low_0, _high_0, _fallback_0) {
  if (_value_0.$ === "None") {
    return _fallback_0;
  } else {
    const _valid_0 = _value_0["value"];
    return run_jump($clampPresent$, [_under_0, _over_0, _valid_0, _low_0, _high_0]);
  }
}
function $deskDefaults$() {
  return { $: "DeskState", ["draft"]: "", ["theme"]: { $: "StateThemeAuto" }, ["referenceVisible"]: true, ["chatWidth"]: 390, ["calcHeight"]: 220, ["pdfSplit"]: 0.5 };
}
function $chatDefaults$() {
  return { $: "ChatState", ["draft"]: "", ["theme"]: { $: "StateThemeAuto" }, ["search"]: false };
}
function $mergeDesk$(_defaults_0, _input_0) {
  const _draft0_0 = _defaults_0["draft"];
  const _theme0_0 = _defaults_0["theme"];
  const _refs0_0 = _defaults_0["referenceVisible"];
  const _chat0_0 = _defaults_0["chatWidth"];
  const _calc0_0 = _defaults_0["calcHeight"];
  const _split0_0 = _defaults_0["pdfSplit"];
  const _draft_0 = _input_0["draft"];
  const _draftCut_0 = _input_0["draftCut"];
  const _draftOver_0 = _input_0["draftOverLimit"];
  const _theme_0 = _input_0["theme"];
  const _refs_0 = _input_0["referenceVisible"];
  const _chat_0 = _input_0["chatWidth"];
  const _chatUnder_0 = _input_0["chatWidthUnder"];
  const _chatOver_0 = _input_0["chatWidthOver"];
  const _calc_0 = _input_0["calcHeight"];
  const _calcUnder_0 = _input_0["calcHeightUnder"];
  const _calcOver_0 = _input_0["calcHeightOver"];
  const _split_0 = _input_0["pdfSplit"];
  const _splitUnder_0 = _input_0["pdfSplitUnder"];
  const _splitOver_0 = _input_0["pdfSplitOver"];
  return { $: "DeskState", ["draft"]: run_loop($draftOrDefault$(_draft_0, _draftCut_0, _draftOver_0, _draft0_0)), ["theme"]: run_loop($themeOrDefault$(_theme_0, _theme0_0)), ["referenceVisible"]: run_loop($boolOrDefault$(_refs_0, _refs0_0)), ["chatWidth"]: run_loop($clampOrDefault$(_chat_0, _chatUnder_0, _chatOver_0, 300, 700, _chat0_0)), ["calcHeight"]: run_loop($clampOrDefault$(_calc_0, _calcUnder_0, _calcOver_0, 72, 900, _calc0_0)), ["pdfSplit"]: run_loop($clampOrDefault$(_split_0, _splitUnder_0, _splitOver_0, 0.20000000298023224, 0.800000011920929, _split0_0)) };
}
function $mergeChat$(_defaults_0, _input_0) {
  const _draft0_0 = _defaults_0["draft"];
  const _theme0_0 = _defaults_0["theme"];
  const _search0_0 = _defaults_0["search"];
  const _draft_0 = _input_0["draft"];
  const _draftCut_0 = _input_0["draftCut"];
  const _draftOver_0 = _input_0["draftOverLimit"];
  const _theme_0 = _input_0["theme"];
  const _search_0 = _input_0["search"];
  return { $: "ChatState", ["draft"]: run_loop($draftOrDefault$(_draft_0, _draftCut_0, _draftOver_0, _draft0_0)), ["theme"]: run_loop($themeOrDefault$(_theme_0, _theme0_0)), ["search"]: run_loop($boolOrDefault$(_search_0, _search0_0)) };
}
function $normalizeDesk$(_input_0) {
  return run_jump($mergeDesk$, [run_loop($deskDefaults$()), _input_0]);
}
function $normalizeChat$(_input_0) {
  return run_jump($mergeChat$, [run_loop($chatDefaults$()), _input_0]);
}
function $String$reverse$(_s_0) {
  return run_jump($String$reverse$go$, [_s_0, ""]);
}
function $String$trim$(_s_0) {
  return run_jump($String$trim_end$, [run_loop($String$trim_start$(_s_0))]);
}
function $String$eq$(_a_0, _b_0) {
  return run_jump($String$eq$fin$, [run_loop($String$cmp$(_a_0, _b_0))]);
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
function $Bool$and$(_a_0, _b_0) {
  if (!_a_0) {
    return false;
  } else {
    return _b_0;
  }
}
function $String$cmp$rec$(_h1b_0, _h2b_0, _rr_0) {
  const _t_0 = _rr_0["fst"];
  const _t1b_0 = _t_0["fst"];
  const _t2b_0 = _t_0["snd"];
  const _r_0 = _rr_0["snd"];
  return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: _h1b_0 + _t1b_0, ["snd"]: _h2b_0 + _t2b_0 }, ["snd"]: _r_0 };
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

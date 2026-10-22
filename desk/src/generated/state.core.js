// GERADO de core/state.bend por `bun core/build.mjs` — não editar à mão.
// core/state.bend
function cmp_new(a, b) {
  return { $: a < b ? "LT" : a === b ? "EQ" : "GT" };
}
function nat_chk(n) {
  if (n > 281474976710655) {
    throw "bend: a Nat past the largest immediate 2^48-1";
  }
  return n;
}
function nat_in(n) {
  return Number.isInteger(n) && n >= 0 && n <= 2 ** 53 ? n : nat_chk(1 / 0);
}
function char_len(s) {
  return s[0] === "\uDC00" ? 4 : s.codePointAt(0) > 65535 ? 2 : 1;
}
function char_code(s) {
  return s.length < 4 ? s.codePointAt(0) : (s.charCodeAt(1) << 22 | s.charCodeAt(2) << 11 | s.charCodeAt(3)) >>> 0;
}
function str_out(s) {
  return s.replace(/\uDC00[^]{3}/gu, "�");
}
function str_in(s) {
  return s.replace(/\p{Cs}/gu, "�");
}
function run_loop(r) {
  while (r !== null && typeof r === "object" && r.$ === "$JMP") {
    r = r.f(r.x);
  }
  return r;
}
function run_lib(f, n) {
  return (...a) => a.length < n ? run_lib((...b) => f(...a, ...b), n - a.length) : run_loop(f(...a));
}
var $0eff = Object.create(null);
function $take_go($0, $1, $2) {
  for (;; ) {
    {
      const _s_0 = $0;
      const _n_0 = $1;
      const _acc_0 = $2;
      if (_s_0 === "") {
        return $String_reverse(_acc_0);
      } else {
        const _h_0 = _s_0.slice(0, char_len(_s_0));
        const _t_0 = _s_0.slice(char_len(_s_0));
        if (_n_0 === 0) {
          return $String_reverse(_acc_0);
        } else {
          const _p_0 = _n_0 - 1;
          $0 = _t_0;
          $1 = _p_0;
          $2 = _h_0 + _acc_0;
          continue;
        }
      }
    }
  }
}
function $take(_s_0, _n_0) {
  return $take_go(_s_0, _n_0, "");
}
function $trimTake(_text_0, _limit_0) {
  return $take($String_trim(_text_0), _limit_0);
}
function $maxDraftChars() {
  return 1e5;
}
function $cleanDraft(_overLimit_0, _original_0, _cut_0) {
  if (_overLimit_0) {
    return _cut_0;
  } else {
    return _original_0;
  }
}
function $draftOrDefault(_value_0, _cut_0, _overLimit_0, _fallback_0) {
  if (_value_0.$ === "None") {
    return _fallback_0;
  } else {
    const _text_0 = _value_0["value"];
    return $cleanDraft(_overLimit_0, _text_0, _cut_0);
  }
}
function $themeFromDark(_isDark_0, _fallback_0) {
  if (_isDark_0) {
    return { $: "StateThemeDark" };
  } else {
    return _fallback_0;
  }
}
function $themeFromLight(_isLight_0, _isDark_0, _fallback_0) {
  if (_isLight_0) {
    return { $: "StateThemeLight" };
  } else {
    return $themeFromDark(_isDark_0, _fallback_0);
  }
}
function $themeFromFacts(_isAuto_0, _isLight_0, _isDark_0, _fallback_0) {
  if (_isAuto_0) {
    return { $: "StateThemeAuto" };
  } else {
    return $themeFromLight(_isLight_0, _isDark_0, _fallback_0);
  }
}
function $parseTheme(_raw_0, _fallback_0) {
  return $themeFromFacts($String_eq(_raw_0, "auto"), $String_eq(_raw_0, "light"), $String_eq(_raw_0, "dark"), _fallback_0);
}
function $themeOrDefault(_value_0, _fallback_0) {
  if (_value_0.$ === "None") {
    return _fallback_0;
  } else {
    const _raw_0 = _value_0["value"];
    return $parseTheme(_raw_0, _fallback_0);
  }
}
function $boolOrDefault(_value_0, _fallback_0) {
  if (_value_0.$ === "None") {
    return _fallback_0;
  } else {
    const _valid_0 = _value_0["value"];
    return _valid_0;
  }
}
function $clampHigh(_over_0, _value_0, _high_0) {
  if (_over_0) {
    return _high_0;
  } else {
    return _value_0;
  }
}
function $clampPresent(_under_0, _over_0, _value_0, _low_0, _high_0) {
  if (_under_0) {
    return _low_0;
  } else {
    return $clampHigh(_over_0, _value_0, _high_0);
  }
}
function $clampOrDefault(_value_0, _under_0, _over_0, _low_0, _high_0, _fallback_0) {
  if (_value_0.$ === "None") {
    return _fallback_0;
  } else {
    const _valid_0 = _value_0["value"];
    return $clampPresent(_under_0, _over_0, _valid_0, _low_0, _high_0);
  }
}
function $deskDefaults() {
  return { $: "DeskState", draft: "", theme: { $: "StateThemeAuto" }, referenceVisible: true, chatWidth: 390, calcHeight: 220, pdfSplit: 0.5 };
}
function $chatDefaults() {
  return { $: "ChatState", draft: "", theme: { $: "StateThemeAuto" }, search: false };
}
function $mergeDesk(_defaults_0, _input_0) {
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
  return { $: "DeskState", draft: $draftOrDefault(_draft_0, _draftCut_0, _draftOver_0, _draft0_0), theme: $themeOrDefault(_theme_0, _theme0_0), referenceVisible: $boolOrDefault(_refs_0, _refs0_0), chatWidth: $clampOrDefault(_chat_0, _chatUnder_0, _chatOver_0, 300, 700, _chat0_0), calcHeight: $clampOrDefault(_calc_0, _calcUnder_0, _calcOver_0, 72, 900, _calc0_0), pdfSplit: $clampOrDefault(_split_0, _splitUnder_0, _splitOver_0, 0.20000000298023224, 0.800000011920929, _split0_0) };
}
function $mergeChat(_defaults_0, _input_0) {
  const _draft0_0 = _defaults_0["draft"];
  const _theme0_0 = _defaults_0["theme"];
  const _search0_0 = _defaults_0["search"];
  const _draft_0 = _input_0["draft"];
  const _draftCut_0 = _input_0["draftCut"];
  const _draftOver_0 = _input_0["draftOverLimit"];
  const _theme_0 = _input_0["theme"];
  const _search_0 = _input_0["search"];
  return { $: "ChatState", draft: $draftOrDefault(_draft_0, _draftCut_0, _draftOver_0, _draft0_0), theme: $themeOrDefault(_theme_0, _theme0_0), search: $boolOrDefault(_search_0, _search0_0) };
}
function $normalizeDesk(_input_0) {
  return $mergeDesk($deskDefaults(), _input_0);
}
function $normalizeChat(_input_0) {
  return $mergeChat($chatDefaults(), _input_0);
}
function $String_reverse(_s_0) {
  return $String_reverse_go(_s_0, "");
}
function $String_trim(_s_0) {
  return $String_trim_end($String_trim_start(_s_0));
}
function $String_eq(_a_0, _b_0) {
  return $Cmp_is_eq($String_order(_a_0, _b_0));
}
function $String_reverse_go($0, $1) {
  for (;; ) {
    {
      const _s_0 = $0;
      const _acc_0 = $1;
      if (_s_0 === "") {
        return _acc_0;
      } else {
        const _h_0 = _s_0.slice(0, char_len(_s_0));
        const _t_0 = _s_0.slice(char_len(_s_0));
        $0 = _t_0;
        $1 = _h_0 + _acc_0;
        continue;
      }
    }
  }
}
function $String_trim_end(_s_0) {
  return $String_reverse($String_trim_start($String_reverse(_s_0)));
}
function $String_trim_start($0, $1, $2) {
  let $pc = 0;
  for (;; )
    switch ($pc) {
      case 0: {
        const _s_0 = $0;
        if (_s_0 === "") {
          return "";
        } else {
          const _h_0 = _s_0.slice(0, char_len(_s_0));
          const _t_0 = _s_0.slice(char_len(_s_0));
          $0 = _t_0;
          $1 = _h_0;
          $2 = $Char_is_space(_h_0);
          $pc = 1;
          continue;
        }
      }
      case 1: {
        const _t_0 = $0;
        const _h_0 = $1;
        const _space_0 = $2;
        if (!_space_0) {
          return _h_0 + _t_0;
        } else {
          $0 = _t_0;
          $pc = 0;
          continue;
        }
      }
    }
}
function $Cmp_is_eq(_c_0) {
  if (_c_0.$ === "EQ") {
    return true;
  } else {
    return false;
  }
}
function $String_order(_a_0, _b_0) {
  return $String_order_go(_a_0, _b_0, { $: "EQ" });
}
function $Char_is_space(_c_0) {
  const _x_0 = char_code(_c_0);
  const _x_1 = char_code(_c_0);
  const _x_2 = char_code(_c_0);
  const _x_3 = _x_0 === 32;
  const _x_4 = $Bool_and(_x_1 >= 9, _x_2 <= 13);
  return _x_3 || _x_4;
}
function $String_order_go($0, $1, $2) {
  for (;; ) {
    {
      const _a_0 = $0;
      const _b_0 = $1;
      const _c_0 = $2;
      if (_a_0 === "") {
        if (_b_0 !== "") {
          if (_c_0.$ === "EQ") {
            return { $: "LT" };
          } else {
            return _c_0;
          }
        } else {
          return _c_0;
        }
      } else {
        const _t_1 = _a_0.slice(0, char_len(_a_0));
        const _t_2 = _a_0.slice(char_len(_a_0));
        if (_b_0 === "") {
          if (_c_0.$ === "EQ") {
            return { $: "GT" };
          } else {
            return _c_0;
          }
        } else {
          const _t_3 = _b_0.slice(0, char_len(_b_0));
          const _t2_0 = _b_0.slice(char_len(_b_0));
          if (_c_0.$ === "EQ") {
            const _x_0 = char_code(_t_1);
            const _x_1 = char_code(_t_3);
            $0 = _t_2;
            $1 = _t2_0;
            $2 = cmp_new(_x_0, _x_1);
            continue;
          } else {
            return _c_0;
          }
        }
      }
    }
  }
}
function $Bool_and(_a_0, _b_0) {
  if (!_a_0) {
    return false;
  } else {
    return _b_0;
  }
}
var state_default = {
  "take.go": run_lib((a0, a1, a2) => str_out(run_loop($take_go(str_in(a0), nat_in(a1), str_in(a2)))), 3),
  take: run_lib((a0, a1) => str_out(run_loop($take(str_in(a0), nat_in(a1)))), 2),
  trimTake: run_lib((a0, a1) => str_out(run_loop($trimTake(str_in(a0), nat_in(a1)))), 2),
  maxDraftChars: run_lib(() => run_loop($maxDraftChars()), 0),
  cleanDraft: run_lib((a0, a1, a2) => str_out(run_loop($cleanDraft(a0, str_in(a1), str_in(a2)))), 3),
  draftOrDefault: run_lib((a0, a1, a2, a3) => str_out(run_loop($draftOrDefault(a0, str_in(a1), a2, str_in(a3)))), 4),
  themeFromDark: run_lib((a0, a1) => run_loop($themeFromDark(a0, a1)), 2),
  themeFromLight: run_lib((a0, a1, a2) => run_loop($themeFromLight(a0, a1, a2)), 3),
  themeFromFacts: run_lib((a0, a1, a2, a3) => run_loop($themeFromFacts(a0, a1, a2, a3)), 4),
  parseTheme: run_lib((a0, a1) => run_loop($parseTheme(str_in(a0), a1)), 2),
  themeOrDefault: run_lib((a0, a1) => run_loop($themeOrDefault(a0, a1)), 2),
  boolOrDefault: run_lib((a0, a1) => run_loop($boolOrDefault(a0, a1)), 2),
  clampHigh: run_lib((a0, a1, a2) => run_loop($clampHigh(a0, Math.fround(a1), Math.fround(a2))), 3),
  clampPresent: run_lib((a0, a1, a2, a3, a4) => run_loop($clampPresent(a0, a1, Math.fround(a2), Math.fround(a3), Math.fround(a4))), 5),
  clampOrDefault: run_lib((a0, a1, a2, a3, a4, a5) => run_loop($clampOrDefault(a0, a1, a2, Math.fround(a3), Math.fround(a4), Math.fround(a5))), 6),
  deskDefaults: run_lib(() => run_loop($deskDefaults()), 0),
  chatDefaults: run_lib(() => run_loop($chatDefaults()), 0),
  mergeDesk: run_lib((a0, a1) => run_loop($mergeDesk(a0, a1)), 2),
  mergeChat: run_lib((a0, a1) => run_loop($mergeChat(a0, a1)), 2),
  normalizeDesk: run_lib((a0) => run_loop($normalizeDesk(a0)), 1),
  normalizeChat: run_lib((a0) => run_loop($normalizeChat(a0)), 1)
};
export {
  state_default as default
};

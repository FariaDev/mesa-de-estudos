// GERADO de core/language.bend por `bun core/build.mjs` — não editar à mão.
// core/language.bend
function cmp_new(a, b) {
  return { $: a < b ? "LT" : a === b ? "EQ" : "GT" };
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
function $pt() {
  return "pt-BR";
}
function $en() {
  return "en";
}
function $follow() {
  return "follow";
}
function $isPortugueseLocale(_locale_0) {
  const _x_0 = $String_starts_with(_locale_0, "pt");
  const _x_1 = $String_starts_with(_locale_0, "PT");
  const _x_2 = $String_starts_with(_locale_0, "Pt");
  const _x_3 = $String_starts_with(_locale_0, "pT");
  const _x_4 = _x_0 || _x_1;
  const _x_5 = _x_2 || _x_3;
  return _x_4 || _x_5;
}
function $fromSystem_pick(_portuguese_0) {
  if (_portuguese_0) {
    return $pt();
  } else {
    return $en();
  }
}
function $fromSystem(_locale_0) {
  return $fromSystem_pick($isPortugueseLocale(_locale_0));
}
function $storedUi_pickEn(_isEn_0) {
  if (_isEn_0) {
    return $en();
  } else {
    return "";
  }
}
function $storedUi_pick(_isPt_0, _isEn_0) {
  if (_isPt_0) {
    return $pt();
  } else {
    return $storedUi_pickEn(_isEn_0);
  }
}
function $storedUi(_stored_0) {
  return $storedUi_pick($String_eq(_stored_0, $pt()), $String_eq(_stored_0, $en()));
}
function $resolveUi_pickIf(_empty_0, _chosen_0, _system_0) {
  if (_empty_0) {
    return $fromSystem(_system_0);
  } else {
    return _chosen_0;
  }
}
function $resolveUi_pick(_chosen_0, _system_0) {
  return $resolveUi_pickIf($String_is_empty(_chosen_0), _chosen_0, _system_0);
}
function $resolveUi(_stored_0, _system_0) {
  return $resolveUi_pick($storedUi(_stored_0), _system_0);
}
function $tutor_pickEn(_isEn_0) {
  if (_isEn_0) {
    return $en();
  } else {
    return $follow();
  }
}
function $tutor_pick(_isPt_0, _isEn_0) {
  if (_isPt_0) {
    return $pt();
  } else {
    return $tutor_pickEn(_isEn_0);
  }
}
function $tutor(_stored_0) {
  return $tutor_pick($String_eq(_stored_0, $pt()), $String_eq(_stored_0, $en()));
}
function $tutorChoices() {
  return { $: "Con", head: $follow(), tail: { $: "Con", head: $pt(), tail: { $: "Con", head: $en(), tail: { $: "Nil" } } } };
}
function $uiChoices() {
  return { $: "Con", head: $pt(), tail: { $: "Con", head: $en(), tail: { $: "Nil" } } };
}
function $String_starts_with($0, $1, $2) {
  let $pc = 0;
  for (;; )
    switch ($pc) {
      case 0: {
        const _s_0 = $0;
        const _p_0 = $1;
        if (_s_0 === "") {
          if (_p_0 === "") {
            return true;
          } else {
            return false;
          }
        } else {
          const _h_1 = _s_0.slice(0, char_len(_s_0));
          const _t_1 = _s_0.slice(char_len(_s_0));
          if (_p_0 === "") {
            return true;
          } else {
            const _y_0 = _p_0.slice(0, char_len(_p_0));
            const _yt_0 = _p_0.slice(char_len(_p_0));
            $0 = _t_1;
            $1 = _yt_0;
            $2 = $Char_is_eq(_h_1, _y_0);
            $pc = 1;
            continue;
          }
        }
      }
      case 1: {
        const _t_0 = $0;
        const _pt_0 = $1;
        const _same_0 = $2;
        if (!_same_0) {
          return false;
        } else {
          $0 = _t_0;
          $1 = _pt_0;
          $pc = 0;
          continue;
        }
      }
    }
}
function $String_eq(_a_0, _b_0) {
  return $Cmp_is_eq($String_order(_a_0, _b_0));
}
function $String_is_empty(_s_0) {
  if (_s_0 === "") {
    return true;
  } else {
    return false;
  }
}
function $Char_is_eq(_a_0, _b_0) {
  const _x_0 = char_code(_a_0);
  const _x_1 = char_code(_b_0);
  return _x_0 === _x_1;
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
var language_default = {
  pt: run_lib(() => str_out(run_loop($pt())), 0),
  en: run_lib(() => str_out(run_loop($en())), 0),
  follow: run_lib(() => str_out(run_loop($follow())), 0),
  isPortugueseLocale: run_lib((a0) => run_loop($isPortugueseLocale(str_in(a0))), 1),
  "fromSystem.pick": run_lib((a0) => str_out(run_loop($fromSystem_pick(a0))), 1),
  fromSystem: run_lib((a0) => str_out(run_loop($fromSystem(str_in(a0)))), 1),
  "storedUi.pickEn": run_lib((a0) => str_out(run_loop($storedUi_pickEn(a0))), 1),
  "storedUi.pick": run_lib((a0, a1) => str_out(run_loop($storedUi_pick(a0, a1))), 2),
  storedUi: run_lib((a0) => str_out(run_loop($storedUi(str_in(a0)))), 1),
  "resolveUi.pickIf": run_lib((a0, a1, a2) => str_out(run_loop($resolveUi_pickIf(a0, str_in(a1), str_in(a2)))), 3),
  "resolveUi.pick": run_lib((a0, a1) => str_out(run_loop($resolveUi_pick(str_in(a0), str_in(a1)))), 2),
  resolveUi: run_lib((a0, a1) => str_out(run_loop($resolveUi(str_in(a0), str_in(a1)))), 2),
  "tutor.pickEn": run_lib((a0) => str_out(run_loop($tutor_pickEn(a0))), 1),
  "tutor.pick": run_lib((a0, a1) => str_out(run_loop($tutor_pick(a0, a1))), 2),
  tutor: run_lib((a0) => str_out(run_loop($tutor(str_in(a0)))), 1),
  tutorChoices: run_lib(() => run_loop($tutorChoices()), 0),
  uiChoices: run_lib(() => run_loop($uiChoices()), 0)
};
export {
  language_default as default
};

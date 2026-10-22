// GERADO de core/freeworkspaces.bend por `bun core/build.mjs` — não editar à mão.
// core/freeworkspaces.bend
function cmp_new(a, b) {
  return { $: a < b ? "LT" : a === b ? "EQ" : "GT" };
}
function nat_divmod(a, b) {
  return b === 0 ? { $: "Tuple", fst: 0, snd: a } : { $: "Tuple", fst: Math.trunc(a / b), snd: a % b };
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
var char_new = function char_new(c) {
  return c < 55296 || c >= 57344 && c <= 1114111 ? String.fromCodePoint(c) : String.fromCharCode(56320, c >>> 22, c >>> 11 & 2047, c & 2047);
};
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
function $maxTitle() {
  return 120;
}
function $maxName() {
  return 240;
}
function $maxDraftChars() {
  return 262144;
}
function $maxMaterials() {
  return 200;
}
function $maxSlug() {
  return 60;
}
function $freeCourseId() {
  return "mesa-free";
}
function $freeCourseName() {
  return "Livre";
}
function $defaultTitle() {
  return "Sessão livre";
}
function $cut_if(_text_0, _limit_0, _over_0) {
  if (!_over_0) {
    return _text_0;
  } else {
    return $String_take(_text_0, _limit_0);
  }
}
function $cut(_text_0, _limit_0) {
  return $cut_if(_text_0, _limit_0, $Nat_is_gt([...str_out(_text_0)].length, _limit_0));
}
function $fitTitle(_text_0) {
  return $cut($String_trim(_text_0), $maxTitle());
}
function $fitName(_text_0) {
  return $cut($String_trim(_text_0), $maxName());
}
function $fitTitleOr_if(_text_0, _blank_0) {
  if (_blank_0) {
    return $defaultTitle();
  } else {
    return $fitTitle(_text_0);
  }
}
function $fitTitleOr(_text_0) {
  return $fitTitleOr_if($String_trim(_text_0), $String_is_empty($String_trim(_text_0)));
}
function $isFreeCourseId(_id_0) {
  return $String_eq(_id_0, $freeCourseId());
}
function $isPromoted(_promotedCourseId_0) {
  return $Bool_not($String_is_empty($String_trim(_promotedCourseId_0)));
}
function $numberedName_if(_stem_0, _ext_0, _base_0, _n_0) {
  if (_base_0) {
    return _stem_0 + _ext_0;
  } else {
    const _x_0 = $Nat_show(_n_0);
    const _x_1 = _x_0 + _ext_0;
    const _x_2 = "-" + _x_1;
    return _stem_0 + _x_2;
  }
}
function $candidateName(_stem_0, _ext_0, _n_0) {
  if (_n_0 === 0) {
    return $numberedName_if(_stem_0, _ext_0, true, 0);
  } else {
    const _p_0 = _n_0 - 1;
    return $numberedName_if(_stem_0, _ext_0, false, nat_chk(_p_0 + 2));
  }
}
function $candidateFolder(_stem_0, _n_0) {
  return $candidateName(_stem_0, "", _n_0);
}
function $String_take(_s_0, _n_0) {
  if (_s_0 === "") {
    return "";
  } else {
    const _h_0 = _s_0.slice(0, char_len(_s_0));
    const _t_0 = _s_0.slice(char_len(_s_0));
    if (_n_0 === 0) {
      return "";
    } else {
      const _p_0 = _n_0 - 1;
      return _h_0 + $String_take(_t_0, _p_0);
    }
  }
}
function $Nat_is_gt(_a_0, _b_0) {
  return $Cmp_is_gt(cmp_new(_a_0, _b_0));
}
function $String_trim(_s_0) {
  return $String_trim_end($String_trim_start(_s_0));
}
function $String_is_empty(_s_0) {
  if (_s_0 === "") {
    return true;
  } else {
    return false;
  }
}
function $String_eq(_a_0, _b_0) {
  return $Cmp_is_eq($String_order(_a_0, _b_0));
}
function $Bool_not(_b_0) {
  if (!_b_0) {
    return true;
  } else {
    return false;
  }
}
function $Nat_show(_n_0) {
  const _m_0 = _n_0;
  return $Nat_show_fin(_m_0, "", $Nat_show_put(nat_divmod(_m_0, 10)));
}
function $Cmp_is_gt(_c_0) {
  if (_c_0.$ === "GT") {
    return true;
  } else {
    return false;
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
function $Nat_show_fin($0, $1, $2) {
  let $pc = 0;
  for (;; )
    switch ($pc) {
      case 0: {
        const _g_0 = $0;
        const _acc_0 = $1;
        const _dq_0 = $2;
        const _d_0 = _dq_0["fst"];
        const _t_0 = _dq_0["snd"];
        if (_t_0 === 0) {
          return _d_0 + _acc_0;
        } else {
          const _p_0 = _t_0 - 1;
          $0 = _g_0;
          $1 = nat_chk(_p_0 + 1);
          $2 = _d_0 + _acc_0;
          $pc = 1;
          continue;
        }
      }
      case 1: {
        const _f_0 = $0;
        const _n_0 = $1;
        const _acc_0 = $2;
        if (_f_0 === 0) {
          return _acc_0;
        } else {
          const _g_0 = _f_0 - 1;
          $0 = _g_0;
          $1 = _acc_0;
          $2 = $Nat_show_put(nat_divmod(_n_0, 10));
          $pc = 0;
          continue;
        }
      }
    }
}
function $Nat_show_put(_qr_0) {
  const _q_0 = _qr_0["fst"];
  const _r_0 = _qr_0["snd"];
  const _x_0 = nat_chk(48 + _r_0);
  return { $: "Tuple", fst: char_new(_x_0 >>> 0), snd: _q_0 };
}
function $String_reverse(_s_0) {
  return $String_reverse_go(_s_0, "");
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
function $Bool_and(_a_0, _b_0) {
  if (!_a_0) {
    return false;
  } else {
    return _b_0;
  }
}
var freeworkspaces_default = {
  maxTitle: run_lib(() => run_loop($maxTitle()), 0),
  maxName: run_lib(() => run_loop($maxName()), 0),
  maxDraftChars: run_lib(() => run_loop($maxDraftChars()), 0),
  maxMaterials: run_lib(() => run_loop($maxMaterials()), 0),
  maxSlug: run_lib(() => run_loop($maxSlug()), 0),
  freeCourseId: run_lib(() => str_out(run_loop($freeCourseId())), 0),
  freeCourseName: run_lib(() => str_out(run_loop($freeCourseName())), 0),
  defaultTitle: run_lib(() => str_out(run_loop($defaultTitle())), 0),
  "cut.if": run_lib((a0, a1, a2) => str_out(run_loop($cut_if(str_in(a0), nat_in(a1), a2))), 3),
  cut: run_lib((a0, a1) => str_out(run_loop($cut(str_in(a0), nat_in(a1)))), 2),
  fitTitle: run_lib((a0) => str_out(run_loop($fitTitle(str_in(a0)))), 1),
  fitName: run_lib((a0) => str_out(run_loop($fitName(str_in(a0)))), 1),
  "fitTitleOr.if": run_lib((a0, a1) => str_out(run_loop($fitTitleOr_if(str_in(a0), a1))), 2),
  fitTitleOr: run_lib((a0) => str_out(run_loop($fitTitleOr(str_in(a0)))), 1),
  isFreeCourseId: run_lib((a0) => run_loop($isFreeCourseId(str_in(a0))), 1),
  isPromoted: run_lib((a0) => run_loop($isPromoted(str_in(a0))), 1),
  "numberedName.if": run_lib((a0, a1, a2, a3) => str_out(run_loop($numberedName_if(str_in(a0), str_in(a1), a2, nat_in(a3)))), 4),
  candidateName: run_lib((a0, a1, a2) => str_out(run_loop($candidateName(str_in(a0), str_in(a1), nat_in(a2)))), 3),
  candidateFolder: run_lib((a0, a1) => str_out(run_loop($candidateFolder(str_in(a0), nat_in(a1)))), 2)
};
export {
  freeworkspaces_default as default
};

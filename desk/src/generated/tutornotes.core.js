// GERADO de core/tutornotes.bend por `bun core/build.mjs` — não editar à mão.
// core/tutornotes.bend
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
  if (!Number.isInteger(n) || n < 0 || n > 2 ** 53) {
    throw "bend: expected a Nat host number: an integer from 0 to 2^53";
  }
  return n;
}
var char_new = function char_new(c) {
  return c < 55296 || c >= 57344 && c <= 1114111 ? String.fromCodePoint(c) : String.fromCharCode(56320, c >>> 22, c >>> 11 & 2047, c & 2047);
};
function char_len(s, at = 0) {
  return s[at] === "\uDC00" ? 4 : s.codePointAt(at) > 65535 ? 2 : 1;
}
function char_code(s) {
  return s.length < 4 ? s.codePointAt(0) : (s.charCodeAt(1) << 22 | s.charCodeAt(2) << 11 | s.charCodeAt(3)) >>> 0;
}
function string_contains(s, p) {
  for (let at = 0;at <= s.length; at += char_len(s, at)) {
    if (s.startsWith(p, at)) {
      return true;
    }
  }
  return false;
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
var io_file_append = new Set;
function $freeworkspaces_maxTitle() {
  return 120;
}
function $freeworkspaces_maxName() {
  return 240;
}
function $freeworkspaces_maxDraftChars() {
  return 262144;
}
function $freeworkspaces_maxMaterials() {
  return 200;
}
function $freeworkspaces_maxSlug() {
  return 60;
}
function $freeworkspaces_freeCourseId() {
  return "mesa-free";
}
function $freeworkspaces_freeCourseName() {
  return "Livre";
}
function $freeworkspaces_defaultTitle() {
  return "Sessão livre";
}
function $freeworkspaces_cut_if(_text_0, _limit_0, _over_0) {
  if (!_over_0) {
    return _text_0;
  } else {
    return $String_take(_text_0, _limit_0);
  }
}
function $freeworkspaces_cut(_text_0, _limit_0) {
  return $freeworkspaces_cut_if(_text_0, _limit_0, $$Nat_is_gt([...str_out(_text_0)].length, _limit_0));
}
function $freeworkspaces_fitTitle(_text_0) {
  return $freeworkspaces_cut($$String_trim(_text_0), $$freeworkspaces_maxTitle());
}
function $freeworkspaces_fitName(_text_0) {
  return $freeworkspaces_cut($$String_trim(_text_0), $$freeworkspaces_maxName());
}
function $freeworkspaces_fitTitleOr_if(_text_0, _blank_0) {
  if (_blank_0) {
    return $freeworkspaces_defaultTitle();
  } else {
    return $freeworkspaces_fitTitle(_text_0);
  }
}
function $freeworkspaces_fitTitleOr(_text_0) {
  return $freeworkspaces_fitTitleOr_if($$String_trim(_text_0), $$String_is_empty($$String_trim(_text_0)));
}
function $freeworkspaces_isFreeCourseId(_id_0) {
  return $String_eq(_id_0, $$freeworkspaces_freeCourseId());
}
function $freeworkspaces_isPromoted(_promotedCourseId_0) {
  return $Bool_not($$String_is_empty($$String_trim(_promotedCourseId_0)));
}
function $freeworkspaces_numberedName_if(_stem_0, _ext_0, _base_0, _n_0) {
  if (_base_0) {
    return _stem_0 + _ext_0;
  } else {
    const _x_0 = $$Nat_show(_n_0);
    const _x_1 = _x_0 + _ext_0;
    const _x_2 = "-" + _x_1;
    return _stem_0 + _x_2;
  }
}
function $freeworkspaces_candidateName(_stem_0, _ext_0, _n_0) {
  if (_n_0 == 0) {
    return $freeworkspaces_numberedName_if(_stem_0, _ext_0, true, 0);
  } else {
    const _p_0 = _n_0 - 1;
    return $freeworkspaces_numberedName_if(_stem_0, _ext_0, false, nat_chk(_p_0 + 2));
  }
}
function $freeworkspaces_candidateFolder(_stem_0, _n_0) {
  return $freeworkspaces_candidateName(_stem_0, "", _n_0);
}
function $maxTitle() {
  return 120;
}
function $maxContent() {
  return 1e5;
}
function $folder() {
  return "Notas";
}
function $unsafeTitle(_title_0) {
  const _x_0 = string_contains(_title_0, `
`);
  const _x_1 = string_contains(_title_0, "\r");
  const _x_2 = string_contains(_title_0, "\\");
  const _x_3 = _x_0 || _x_1;
  const _x_4 = string_contains(_title_0, "/");
  const _x_5 = _x_2 || _x_3;
  const _x_6 = string_contains(_title_0, "..");
  const _x_7 = _x_4 || _x_5;
  const _x_8 = $$Nat_is_gt([...str_out(_title_0)].length, $$maxTitle());
  const _x_9 = _x_6 || _x_7;
  const _x_10 = $$String_is_empty(_title_0);
  const _x_11 = _x_8 || _x_9;
  return _x_10 || _x_11;
}
function $targetIf(_root_0, _clean_0, _n_0, _unsafe_0) {
  if (_unsafe_0) {
    return { $: "NoteTarget.Refused" };
  } else {
    const _x_0 = $$freeworkspaces_candidateName(_clean_0, ".md", _n_0);
    const _x_1 = $$folder();
    const _x_2 = "/" + _x_0;
    return { $: "NoteTarget.Ok", root: _root_0, rel: _x_1 + _x_2 };
  }
}
function $noteTargetAt(_root_0, _title_0, _n_0) {
  const _clean_0 = $$String_trim(_title_0);
  return $targetIf(_root_0, _clean_0, _n_0, $$unsafeTitle(_clean_0));
}
function $noteTarget(_root_0, _title_0) {
  return $noteTargetAt(_root_0, _title_0, 0);
}
function $String_take(_s_0, _n_0) {
  if (_s_0 === "") {
    return "";
  } else {
    const _h_0 = _s_0.slice(0, char_len(_s_0));
    const _t_0 = _s_0.slice(char_len(_s_0));
    if (_n_0 == 0) {
      return "";
    } else {
      const _p_0 = _n_0 - 1;
      return _h_0 + $$String_take(_t_0, _p_0);
    }
  }
}
function $Nat_is_gt(_a_0, _b_0) {
  return $Cmp_is_gt(cmp_new(_a_0, _b_0));
}
function $String_trim(_s_0) {
  return $String_trim_end($$String_trim_start(_s_0));
}
function $String_is_empty(_s_0) {
  if (_s_0 === "") {
    return true;
  } else {
    return false;
  }
}
function $String_eq(_a_0, _b_0) {
  return $Cmp_is_eq($$String_order(_a_0, _b_0));
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
  return $Nat_show_fin(_m_0, "", $$Nat_show_put(nat_divmod(_m_0, 10)));
}
function $Cmp_is_gt(_c_0) {
  if (_c_0.$ === "GT") {
    return true;
  } else {
    return false;
  }
}
function $String_trim_end(_s_0) {
  return $String_reverse($$String_trim_start($$String_reverse(_s_0)));
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
          $2 = $$Char_is_space(_h_0);
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
        if (_t_0 == 0) {
          return _d_0 + _acc_0;
        } else {
          $0 = _g_0;
          $1 = _t_0;
          $2 = _d_0 + _acc_0;
          $pc = 1;
          continue;
        }
      }
      case 1: {
        const _f_0 = $0;
        const _n_0 = $1;
        const _acc_0 = $2;
        if (_f_0 == 0) {
          return _acc_0;
        } else {
          const _g_0 = _f_0 - 1;
          $0 = _g_0;
          $1 = _acc_0;
          $2 = $$Nat_show_put(nat_divmod(_n_0, 10));
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
  const _x_1 = _x_0 === 32;
  const _x_2 = $$Bool_and(_x_0 >= 9, _x_0 <= 13);
  return _x_1 || _x_2;
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
        const _x_0 = char_code(_t_1);
        const _t_2 = _a_0.slice(char_len(_a_0));
        if (_b_0 === "") {
          if (_c_0.$ === "EQ") {
            return { $: "GT" };
          } else {
            return _c_0;
          }
        } else {
          const _t_3 = _b_0.slice(0, char_len(_b_0));
          const _y_0 = char_code(_t_3);
          const _t2_0 = _b_0.slice(char_len(_b_0));
          if (_c_0.$ === "EQ") {
            $0 = _t_2;
            $1 = _t2_0;
            $2 = cmp_new(_x_0, _y_0);
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
var $$Nat_is_gt = $Nat_is_gt;
var $$String_trim = $String_trim;
var $$freeworkspaces_maxTitle = $freeworkspaces_maxTitle;
var $$freeworkspaces_maxName = $freeworkspaces_maxName;
var $$String_is_empty = $String_is_empty;
var $$freeworkspaces_freeCourseId = $freeworkspaces_freeCourseId;
var $$Nat_show = $Nat_show;
var $$maxTitle = $maxTitle;
var $$folder = $folder;
var $$freeworkspaces_candidateName = $freeworkspaces_candidateName;
var $$unsafeTitle = $unsafeTitle;
var $$String_take = $String_take;
var $$String_trim_start = $String_trim_start;
var $$String_order = $String_order;
var $$Nat_show_put = $Nat_show_put;
var $$String_reverse = $String_reverse;
var $$Char_is_space = $Char_is_space;
var $$Bool_and = $Bool_and;
var tutornotes_default = {
  "freeworkspaces:maxTitle": run_lib(() => run_loop($freeworkspaces_maxTitle()), 0),
  "freeworkspaces:maxName": run_lib(() => run_loop($freeworkspaces_maxName()), 0),
  "freeworkspaces:maxDraftChars": run_lib(() => run_loop($freeworkspaces_maxDraftChars()), 0),
  "freeworkspaces:maxMaterials": run_lib(() => run_loop($freeworkspaces_maxMaterials()), 0),
  "freeworkspaces:maxSlug": run_lib(() => run_loop($freeworkspaces_maxSlug()), 0),
  "freeworkspaces:freeCourseId": run_lib(() => str_out(run_loop($freeworkspaces_freeCourseId())), 0),
  "freeworkspaces:freeCourseName": run_lib(() => str_out(run_loop($freeworkspaces_freeCourseName())), 0),
  "freeworkspaces:defaultTitle": run_lib(() => str_out(run_loop($freeworkspaces_defaultTitle())), 0),
  "freeworkspaces:cut.if": run_lib((a0, a1, a2) => str_out(run_loop($freeworkspaces_cut_if(str_in(a0), nat_in(a1), a2))), 3),
  "freeworkspaces:cut": run_lib((a0, a1) => str_out(run_loop($freeworkspaces_cut(str_in(a0), nat_in(a1)))), 2),
  "freeworkspaces:fitTitle": run_lib((a0) => str_out(run_loop($freeworkspaces_fitTitle(str_in(a0)))), 1),
  "freeworkspaces:fitName": run_lib((a0) => str_out(run_loop($freeworkspaces_fitName(str_in(a0)))), 1),
  "freeworkspaces:fitTitleOr.if": run_lib((a0, a1) => str_out(run_loop($freeworkspaces_fitTitleOr_if(str_in(a0), a1))), 2),
  "freeworkspaces:fitTitleOr": run_lib((a0) => str_out(run_loop($freeworkspaces_fitTitleOr(str_in(a0)))), 1),
  "freeworkspaces:isFreeCourseId": run_lib((a0) => run_loop($freeworkspaces_isFreeCourseId(str_in(a0))), 1),
  "freeworkspaces:isPromoted": run_lib((a0) => run_loop($freeworkspaces_isPromoted(str_in(a0))), 1),
  "freeworkspaces:numberedName.if": run_lib((a0, a1, a2, a3) => str_out(run_loop($freeworkspaces_numberedName_if(str_in(a0), str_in(a1), a2, nat_in(a3)))), 4),
  "freeworkspaces:candidateName": run_lib((a0, a1, a2) => str_out(run_loop($freeworkspaces_candidateName(str_in(a0), str_in(a1), nat_in(a2)))), 3),
  "freeworkspaces:candidateFolder": run_lib((a0, a1) => str_out(run_loop($freeworkspaces_candidateFolder(str_in(a0), nat_in(a1)))), 2),
  maxTitle: run_lib(() => run_loop($maxTitle()), 0),
  maxContent: run_lib(() => run_loop($maxContent()), 0),
  folder: run_lib(() => str_out(run_loop($folder())), 0),
  unsafeTitle: run_lib((a0) => run_loop($unsafeTitle(str_in(a0))), 1),
  targetIf: run_lib((a0, a1, a2, a3) => run_loop($targetIf(str_in(a0), str_in(a1), nat_in(a2), a3)), 4),
  noteTargetAt: run_lib((a0, a1, a2) => run_loop($noteTargetAt(str_in(a0), str_in(a1), nat_in(a2))), 3),
  noteTarget: run_lib((a0, a1) => run_loop($noteTarget(str_in(a0), str_in(a1))), 2)
};
export {
  tutornotes_default as default
};

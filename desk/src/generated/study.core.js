// GERADO de core/study.bend por `bun core/build.mjs` — não editar à mão.
// core/study.bend
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
function $endsXopp(_path_0) {
  return $String_ends_with($String_to_lower(_path_0), ".xopp");
}
function $restore_xopp(_path_0, _xopp_0) {
  if (!_xopp_0) {
    return "";
  } else {
    return _path_0;
  }
}
function $restore_if(_path_0, _exists_0, _xopp_0) {
  if (!_exists_0) {
    return "";
  } else {
    return $restore_xopp(_path_0, _xopp_0);
  }
}
function $restore_whenExists(_path_0) {
  return $restore_xopp(_path_0, $endsXopp(_path_0));
}
function $restoreXopp(_path_0, _exists_0) {
  if (!_exists_0) {
    return "";
  } else {
    return $restore_whenExists(_path_0);
  }
}
function $cleanTitle(_title_0) {
  return $String_take($String_trim(_title_0), 240);
}
function $cleanStudy(_title_0, _xopp_0, _exists_0) {
  return { $: "Study", title: $cleanTitle(_title_0), xopp: $restoreXopp($String_trim(_xopp_0), _exists_0) };
}
function $String_ends_with(_s_0, _p_0) {
  return $String_starts_with($String_reverse(_s_0), $String_reverse(_p_0));
}
function $String_to_lower(_s_0) {
  if (_s_0 === "") {
    return "";
  } else {
    const _h_0 = _s_0.slice(0, char_len(_s_0));
    const _t_0 = _s_0.slice(char_len(_s_0));
    return $Char_to_lower(_h_0) + $String_to_lower(_t_0);
  }
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
function $String_trim(_s_0) {
  return $String_trim_end($String_trim_start(_s_0));
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
function $String_reverse(_s_0) {
  return $String_reverse_go(_s_0, "");
}
function $Char_to_lower(_c_0) {
  const _x_0 = $Bool_to_u32($Char_is_upper(_c_0));
  const _x_1 = char_code(_c_0);
  const _x_2 = Math.imul(_x_0, 32) >>> 0;
  return char_new(_x_1 + _x_2 >>> 0);
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
function $Char_is_eq(_a_0, _b_0) {
  const _x_0 = char_code(_a_0);
  const _x_1 = char_code(_b_0);
  return _x_0 === _x_1;
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
function $Bool_to_u32(_b_0) {
  if (!_b_0) {
    return 0;
  } else {
    return 1;
  }
}
function $Char_is_upper(_c_0) {
  const _x_0 = char_code(_c_0);
  const _x_1 = char_code(_c_0);
  return $Bool_and(_x_0 >= 65, _x_1 <= 90);
}
function $Char_is_space(_c_0) {
  const _x_0 = char_code(_c_0);
  const _x_1 = char_code(_c_0);
  const _x_2 = char_code(_c_0);
  const _x_3 = _x_0 === 32;
  const _x_4 = $Bool_and(_x_1 >= 9, _x_2 <= 13);
  return _x_3 || _x_4;
}
function $Bool_and(_a_0, _b_0) {
  if (!_a_0) {
    return false;
  } else {
    return _b_0;
  }
}
var study_default = {
  endsXopp: run_lib((a0) => run_loop($endsXopp(str_in(a0))), 1),
  "restore.xopp": run_lib((a0, a1) => str_out(run_loop($restore_xopp(str_in(a0), a1))), 2),
  "restore.if": run_lib((a0, a1, a2) => str_out(run_loop($restore_if(str_in(a0), a1, a2))), 3),
  "restore.whenExists": run_lib((a0) => str_out(run_loop($restore_whenExists(str_in(a0)))), 1),
  restoreXopp: run_lib((a0, a1) => str_out(run_loop($restoreXopp(str_in(a0), a1))), 2),
  cleanTitle: run_lib((a0) => str_out(run_loop($cleanTitle(str_in(a0)))), 1),
  cleanStudy: run_lib((a0, a1, a2) => run_loop($cleanStudy(str_in(a0), str_in(a1), a2)), 3)
};
export {
  study_default as default
};

// GERADO de core/study.bend por `bun core/build.mjs` — não editar à mão.
// core/study.bend
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
function $endsXopp$(_path_0) {
  return run_jump($String$ends_with$, [run_loop($String$to_lower$(_path_0)), ".xopp"]);
}
function $restore$xopp$(_path_0, _xopp_0) {
  if (!_xopp_0) {
    return "";
  } else {
    return _path_0;
  }
}
function $restore$if$(_path_0, _exists_0, _xopp_0) {
  if (!_exists_0) {
    return "";
  } else {
    return run_jump($restore$xopp$, [_path_0, _xopp_0]);
  }
}
function $restore$whenExists$(_path_0) {
  return run_jump($restore$xopp$, [_path_0, run_loop($endsXopp$(_path_0))]);
}
function $restoreXopp$(_path_0, _exists_0) {
  if (!_exists_0) {
    return "";
  } else {
    return run_jump($restore$whenExists$, [_path_0]);
  }
}
function $cleanTitle$(_title_0) {
  return run_jump($String$take$, [run_loop($String$trim$(_title_0)), 240n]);
}
function $cleanStudy$(_title_0, _xopp_0, _exists_0) {
  return { $: "Study", ["title"]: run_loop($cleanTitle$(_title_0)), ["xopp"]: run_loop($restoreXopp$(run_loop($String$trim$(_xopp_0)), _exists_0)) };
}
function $String$ends_with$(_s_0, _p_0) {
  return run_jump($String$starts_with$, [run_loop($String$reverse$(_s_0)), run_loop($String$reverse$(_p_0))]);
}
function $String$to_lower$(_s_0) {
  if (_s_0 === "") {
    return "";
  } else {
    const _h_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(0, 2) : _s_0[0];
    const _t_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(2) : _s_0.slice(1);
    return run_loop($Char$to_lower$(_h_0)) + run_loop($String$to_lower$(_t_0));
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
function $String$trim$(_s_0) {
  return run_jump($String$trim_end$, [run_loop($String$trim_start$(_s_0))]);
}
function $String$starts_with$(_s_0, _p_0) {
  if (_s_0 === "") {
    if (_p_0 === "") {
      return true;
    } else {
      const _h_0 = _p_0.codePointAt(0) > 65535 ? _p_0.slice(0, 2) : _p_0[0];
      const _t_0 = _p_0.codePointAt(0) > 65535 ? _p_0.slice(2) : _p_0.slice(1);
      return false;
    }
  } else {
    const _h_1 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(0, 2) : _s_0[0];
    const _t_1 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(2) : _s_0.slice(1);
    if (_p_0 === "") {
      return true;
    } else {
      const _y_0 = _p_0.codePointAt(0) > 65535 ? _p_0.slice(0, 2) : _p_0[0];
      const _yt_0 = _p_0.codePointAt(0) > 65535 ? _p_0.slice(2) : _p_0.slice(1);
      return run_jump($String$starts_with$if$, [_t_1, _yt_0, run_loop($Char$is_eq$(_h_1, _y_0))]);
    }
  }
}
function $String$reverse$(_s_0) {
  return run_jump($String$reverse$go$, [_s_0, ""]);
}
function $Char$to_lower$(_c_0) {
  const _x_0 = run_loop($Bool$to_u32$(run_loop($Char$is_upper$(_c_0))));
  const _x_1 = run_loop($Char$to_u32$(_c_0));
  const _x_2 = Math.imul(_x_0, 32) >>> 0;
  return char_new(_x_1 + _x_2 >>> 0);
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
function $String$starts_with$if$(_t_0, _pt_0, _same_0) {
  if (!_same_0) {
    return false;
  } else {
    return run_jump($String$starts_with$, [_t_0, _pt_0]);
  }
}
function $Char$is_eq$(_a_0, _b_0) {
  const _x_0 = _a_0.codePointAt(0);
  const _y_0 = _b_0.codePointAt(0);
  return _x_0 === _y_0;
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
function $Char$to_u32$(_c_0) {
  const _x_0 = _c_0.codePointAt(0);
  return _x_0;
}
function $Bool$to_u32$(_b_0) {
  if (!_b_0) {
    return 0;
  } else {
    return 1;
  }
}
function $Char$is_upper$(_c_0) {
  const _x_0 = _c_0.codePointAt(0);
  return run_jump($Bool$and$, [_x_0 >= 65, _x_0 <= 90]);
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
function $Bool$and$(_a_0, _b_0) {
  if (!_a_0) {
    return false;
  } else {
    return _b_0;
  }
}
var study_default = {
  endsXopp: run_lib($endsXopp$, 1),
  "restore.xopp": run_lib($restore$xopp$, 2),
  "restore.if": run_lib($restore$if$, 3),
  "restore.whenExists": run_lib($restore$whenExists$, 1),
  restoreXopp: run_lib($restoreXopp$, 2),
  cleanTitle: run_lib($cleanTitle$, 1),
  cleanStudy: run_lib($cleanStudy$, 3)
};
export {
  study_default as default
};

// GERADO de core/pending.bend por `bun core/build.mjs` — não editar à mão.
// core/pending.bend
function cmp_new(a, b) {
  return { $: a < b ? "LT" : a === b ? "EQ" : "GT" };
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
function $maxItems$() {
  return 50n;
}
function $maxRefs$() {
  return 2n;
}
function $maxStoredBytes$() {
  const _x_0 = Math.imul(40, 1024) >>> 0;
  return Math.imul(_x_0, 1024) >>> 0;
}
function $pageOf$if$(_page_0, _zero_0) {
  if (_zero_0) {
    return 1n;
  } else {
    return _page_0;
  }
}
function $pageOf$(_page_0) {
  return run_jump($pageOf$if$, [_page_0, run_loop($Nat$is_eq$(_page_0, 0n))]);
}
function $keepItem$empty$(_hasImage_0, _blank_0) {
  if (_blank_0) {
    return _hasImage_0;
  } else {
    return true;
  }
}
function $keepItem$(_text_0, _imageCount_0) {
  return run_jump($keepItem$empty$, [run_loop($Nat$is_gt$(_imageCount_0, 0n)), run_loop($String$is_empty$(run_loop($String$trim$(_text_0))))]);
}
function $cutText$if$(_text_0, _limit_0, _over_0) {
  if (!_over_0) {
    return _text_0;
  } else {
    return run_jump($String$take$, [_text_0, _limit_0]);
  }
}
function $cutText$(_text_0, _limit_0) {
  return run_jump($cutText$if$, [_text_0, _limit_0, run_loop($Nat$is_gt$(BigInt([..._text_0].length), _limit_0))]);
}
function $keepAt$(_index_0) {
  const _x_0 = run_loop($maxItems$());
  return _index_0 < _x_0;
}
function $heldOnLoad$(_stored_0, _recovered_0) {
  if (_recovered_0) {
    return true;
  } else {
    return _stored_0;
  }
}
function $overStored$(_bytes_0) {
  const _x_0 = run_loop($maxStoredBytes$());
  return _bytes_0 > _x_0;
}
function $Nat$is_eq$(_a_0, _b_0) {
  return run_jump($Cmp$is_eq$, [cmp_new(_a_0, _b_0)]);
}
function $Nat$is_gt$(_a_0, _b_0) {
  return run_jump($Cmp$is_gt$, [cmp_new(_a_0, _b_0)]);
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
function $String$trim$(_s_0) {
  return run_jump($String$trim_end$, [run_loop($String$trim_start$(_s_0))]);
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
function $Cmp$is_eq$(_c_0) {
  if (_c_0.$ === "LT") {
    return false;
  } else if (_c_0.$ === "EQ") {
    return true;
  } else {
    return false;
  }
}
function $Cmp$is_gt$(_c_0) {
  if (_c_0.$ === "LT") {
    return false;
  } else if (_c_0.$ === "EQ") {
    return false;
  } else {
    return true;
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
function $String$reverse$(_s_0) {
  return run_jump($String$reverse$go$, [_s_0, ""]);
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
function $String$reverse$go$(_s_0, _acc_0) {
  if (_s_0 === "") {
    return _acc_0;
  } else {
    const _h_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(0, 2) : _s_0[0];
    const _t_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(2) : _s_0.slice(1);
    return run_jump($String$reverse$go$, [_t_0, _h_0 + _acc_0]);
  }
}
function $Bool$and$(_a_0, _b_0) {
  if (!_a_0) {
    return false;
  } else {
    return _b_0;
  }
}
var pending_default = {
  maxItems: run_lib($maxItems$, 0),
  maxRefs: run_lib($maxRefs$, 0),
  maxStoredBytes: run_lib($maxStoredBytes$, 0),
  "pageOf.if": run_lib($pageOf$if$, 2),
  pageOf: run_lib($pageOf$, 1),
  "keepItem.empty": run_lib($keepItem$empty$, 2),
  keepItem: run_lib($keepItem$, 2),
  "cutText.if": run_lib($cutText$if$, 3),
  cutText: run_lib($cutText$, 2),
  keepAt: run_lib($keepAt$, 1),
  heldOnLoad: run_lib($heldOnLoad$, 2),
  overStored: run_lib($overStored$, 1)
};
export {
  pending_default as default
};

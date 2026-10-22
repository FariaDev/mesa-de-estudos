// GERADO de core/framing.bend por `bun core/build.mjs` — não editar à mão.
// core/framing.bend
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
function $prependLine(_h_0, _more_0) {
  const _lines_0 = _more_0["lines"];
  const _rest_0 = _more_0["rest"];
  const _overflow_0 = _more_0["overflow"];
  return { $: "Frame", lines: { $: "Con", head: _h_0, tail: _lines_0 }, rest: _rest_0, overflow: _overflow_0 };
}
function $peel_go(_t_0, _h_0) {
  if (_t_0.$ === "Nil") {
    return { $: "Frame", lines: { $: "Nil" }, rest: _h_0, overflow: false };
  } else {
    const _h2_0 = _t_0["head"];
    const _t2_0 = _t_0["tail"];
    return $prependLine(_h_0, $peel_go(_t2_0, _h2_0));
  }
}
function $peel(_xs_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Frame", lines: { $: "Nil" }, rest: "", overflow: false };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return $peel_go(_t_0, _h_0);
  }
}
function $split_step(_h_0, _st_0, _cut_0) {
  const _cur_0 = _st_0["fst"];
  const _acc_0 = _st_0["snd"];
  if (_cut_0) {
    return { $: "Tuple", fst: "", snd: { $: "Con", head: $String_reverse(_cur_0), tail: _acc_0 } };
  } else {
    return { $: "Tuple", fst: _h_0 + _cur_0, snd: _acc_0 };
  }
}
function $split_fin(_cur_0, _acc_0) {
  return { $: "Frame", lines: $List_reverse(_acc_0), rest: $String_reverse(_cur_0), overflow: false };
}
function $split_go($0, $1) {
  for (;; ) {
    {
      const _s_0 = $0;
      const _st_0 = $1;
      if (_s_0 === "") {
        const _cur_0 = _st_0["fst"];
        const _acc_0 = _st_0["snd"];
        return $split_fin(_cur_0, _acc_0);
      } else {
        const _h_0 = _s_0.slice(0, char_len(_s_0));
        const _t_0 = _s_0.slice(char_len(_s_0));
        $0 = _t_0;
        $1 = $split_step(_h_0, _st_0, $Char_is_eq(_h_0, `
`));
        continue;
      }
    }
  }
}
function $split(_s_0) {
  return $split_go(_s_0, { $: "Tuple", fst: "", snd: { $: "Nil" } });
}
function $strLength_go($0, $1) {
  for (;; ) {
    {
      const _s_0 = $0;
      const _acc_0 = $1;
      if (_s_0 === "") {
        return _acc_0;
      } else {
        const _t_0 = _s_0.slice(char_len(_s_0));
        $0 = _t_0;
        $1 = nat_chk(_acc_0 + 1);
        continue;
      }
    }
  }
}
function $strLength(_s_0) {
  return $strLength_go(_s_0, 0);
}
function $feed_over(_joined_0, _over_0) {
  if (_over_0) {
    return { $: "Frame", lines: { $: "Nil" }, rest: "", overflow: true };
  } else {
    return $split(_joined_0);
  }
}
function $feed(_buffer_0, _chunk_0, _limit_0) {
  const _joined_0 = _buffer_0 + _chunk_0;
  return $feed_over(_joined_0, $Nat_is_gt($strLength(_joined_0), _limit_0));
}
function $rejoin(_lines_0, _rest_0) {
  if (_lines_0.$ === "Nil") {
    return _rest_0;
  } else {
    const _h_0 = _lines_0["head"];
    const _t_0 = _lines_0["tail"];
    const _x_0 = $rejoin(_t_0, _rest_0);
    const _x_1 = `
` + _x_0;
    return _h_0 + _x_1;
  }
}
function $rejoinFrame(_f_0) {
  const _lines_0 = _f_0["lines"];
  const _rest_0 = _f_0["rest"];
  return $rejoin(_lines_0, _rest_0);
}
function $overflowOf(_f_0) {
  const _overflow_0 = _f_0["overflow"];
  return _overflow_0;
}
function $String_reverse(_s_0) {
  return $String_reverse_go(_s_0, "");
}
function $List_reverse(_xs_0) {
  return $List_reverse_go(_xs_0, { $: "Nil" });
}
function $Char_is_eq(_a_0, _b_0) {
  const _x_0 = char_code(_a_0);
  const _x_1 = char_code(_b_0);
  return _x_0 === _x_1;
}
function $Nat_is_gt(_a_0, _b_0) {
  return $Cmp_is_gt(cmp_new(_a_0, _b_0));
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
function $List_reverse_go($0, $1) {
  for (;; ) {
    {
      const _xs_0 = $0;
      const _acc_0 = $1;
      if (_xs_0.$ === "Nil") {
        return _acc_0;
      } else {
        const _h_0 = _xs_0["head"];
        const _t_0 = _xs_0["tail"];
        $0 = _t_0;
        $1 = { $: "Con", head: _h_0, tail: _acc_0 };
        continue;
      }
    }
  }
}
function $Cmp_is_gt(_c_0) {
  if (_c_0.$ === "GT") {
    return true;
  } else {
    return false;
  }
}
var framing_default = {
  prependLine: run_lib((a0, a1) => run_loop($prependLine(str_in(a0), a1)), 2),
  "peel.go": run_lib((a0, a1) => run_loop($peel_go(a0, str_in(a1))), 2),
  peel: run_lib((a0) => run_loop($peel(a0)), 1),
  "split.step": run_lib((a0, a1, a2) => run_loop($split_step(str_in(a0), a1, a2)), 3),
  "split.fin": run_lib((a0, a1) => run_loop($split_fin(str_in(a0), a1)), 2),
  "split.go": run_lib((a0, a1) => run_loop($split_go(str_in(a0), a1)), 2),
  split: run_lib((a0) => run_loop($split(str_in(a0))), 1),
  "strLength.go": run_lib((a0, a1) => run_loop($strLength_go(str_in(a0), nat_in(a1))), 2),
  strLength: run_lib((a0) => run_loop($strLength(str_in(a0))), 1),
  "feed.over": run_lib((a0, a1) => run_loop($feed_over(str_in(a0), a1)), 2),
  feed: run_lib((a0, a1, a2) => run_loop($feed(str_in(a0), str_in(a1), nat_in(a2))), 3),
  rejoin: run_lib((a0, a1) => str_out(run_loop($rejoin(a0, str_in(a1)))), 2),
  rejoinFrame: run_lib((a0) => str_out(run_loop($rejoinFrame(a0))), 1),
  overflowOf: run_lib((a0) => run_loop($overflowOf(a0)), 1)
};
export {
  framing_default as default
};

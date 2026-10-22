// GERADO de core/mesaqollayout.bend por `bun core/build.mjs` — não editar à mão.
// core/mesaqollayout.bend
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
function $msg_mark() {
  return "";
}
function $msg_sep() {
  return "";
}
function $msg_pack(_parts_0) {
  const _x_0 = $msg_mark();
  const _x_1 = $String_join(_parts_0, $msg_sep());
  return _x_0 + _x_1;
}
function $msg_msg(_key_0) {
  return $msg_pack({ $: "Con", head: _key_0, tail: { $: "Nil" } });
}
function $msg_msg1(_key_0, _n1_0, _v1_0) {
  return $msg_pack({ $: "Con", head: _key_0, tail: { $: "Con", head: _n1_0, tail: { $: "Con", head: _v1_0, tail: { $: "Nil" } } } });
}
function $msg_msg2(_key_0, _n1_0, _v1_0, _n2_0, _v2_0) {
  return $msg_pack({ $: "Con", head: _key_0, tail: { $: "Con", head: _n1_0, tail: { $: "Con", head: _v1_0, tail: { $: "Con", head: _n2_0, tail: { $: "Con", head: _v2_0, tail: { $: "Nil" } } } } } });
}
function $msg_msg3(_key_0, _n1_0, _v1_0, _n2_0, _v2_0, _n3_0, _v3_0) {
  return $msg_pack({ $: "Con", head: _key_0, tail: { $: "Con", head: _n1_0, tail: { $: "Con", head: _v1_0, tail: { $: "Con", head: _n2_0, tail: { $: "Con", head: _v2_0, tail: { $: "Con", head: _n3_0, tail: { $: "Con", head: _v3_0, tail: { $: "Nil" } } } } } } } });
}
function $msg_msg4(_key_0, _n1_0, _v1_0, _n2_0, _v2_0, _n3_0, _v3_0, _n4_0, _v4_0) {
  return $msg_pack({ $: "Con", head: _key_0, tail: { $: "Con", head: _n1_0, tail: { $: "Con", head: _v1_0, tail: { $: "Con", head: _n2_0, tail: { $: "Con", head: _v2_0, tail: { $: "Con", head: _n3_0, tail: { $: "Con", head: _v3_0, tail: { $: "Con", head: _n4_0, tail: { $: "Con", head: _v4_0, tail: { $: "Nil" } } } } } } } } } });
}
function $msg_isMsg(_s_0) {
  return $String_starts_with(_s_0, $msg_mark());
}
function $minChat() {
  return 300;
}
function $maxChat() {
  return 700;
}
function $minCalc() {
  return 72;
}
function $maxCalc() {
  return 900;
}
function $minSplit() {
  return 200;
}
function $maxSplit() {
  return 800;
}
function $maxName() {
  return 60;
}
function $maxPresets() {
  return 24;
}
function $clamp_over(_value_0, _hi_0, _over_0) {
  if (_over_0) {
    return _hi_0;
  } else {
    return _value_0;
  }
}
function $clamp_below(_value_0, _lo_0, _hi_0, _under_0) {
  if (_under_0) {
    return _lo_0;
  } else {
    return $clamp_over(_value_0, _hi_0, $Nat_is_gt(_value_0, _hi_0));
  }
}
function $clamp(_value_0, _lo_0, _hi_0) {
  return $clamp_below(_value_0, _lo_0, _hi_0, _value_0 < _lo_0);
}
function $cut_if(_text_0, _limit_0, _over_0) {
  if (_over_0) {
    return $String_take(_text_0, _limit_0);
  } else {
    return _text_0;
  }
}
function $cut(_text_0, _limit_0) {
  return $cut_if(_text_0, _limit_0, $Nat_is_gt([...str_out(_text_0)].length, _limit_0));
}
function $name(_raw_0) {
  return $cut($String_trim(_raw_0), $maxName());
}
function $keepMinimized(_xs_0) {
  return $List_take(_xs_0, 2);
}
function $layout(_chatWidth_0, _calcHeight_0, _splitPct_0, _chatCollapsed_0, _calculatorCollapsed_0, _referenceVisible_0, _minimized_0) {
  return { $: "LayoutView", chatWidth: $clamp(_chatWidth_0, $minChat(), $maxChat()), calcHeight: $clamp(_calcHeight_0, $minCalc(), $maxCalc()), splitPct: $clamp(_splitPct_0, $minSplit(), $maxSplit()), chatCollapsed: _chatCollapsed_0, calculatorCollapsed: _calculatorCollapsed_0, referenceVisible: _referenceVisible_0, minimized: $keepMinimized(_minimized_0) };
}
function $referenceShown(_two_0, _tabIsForm_0, _open_0) {
  return $Bool_and(_two_0, $Bool_and(_tabIsForm_0, _open_0));
}
function $refAction_whenShown(_visible_0) {
  if (_visible_0) {
    return "none";
  } else {
    return "hide";
  }
}
function $refAction_whenHidden(_visible_0) {
  if (_visible_0) {
    return "show";
  } else {
    return "none";
  }
}
function $refAction_shown(_shown_0, _visible_0) {
  if (_shown_0) {
    return $refAction_whenShown(_visible_0);
  } else {
    return $refAction_whenHidden(_visible_0);
  }
}
function $referenceAction_two(_two_0, _shown_0, _visible_0) {
  if (!_two_0) {
    return "none";
  } else {
    return $refAction_shown(_shown_0, _visible_0);
  }
}
function $referenceAction(_two_0, _tabIsForm_0, _open_0, _visible_0) {
  return $referenceAction_two(_two_0, $referenceShown(_two_0, _tabIsForm_0, _open_0), _visible_0);
}
function $oneIf(_on_0) {
  if (_on_0) {
    return 1;
  } else {
    return 0;
  }
}
function $miniCount_go($0, $1) {
  for (;; ) {
    {
      const _xs_0 = $0;
      const _acc_0 = $1;
      if (_xs_0.$ === "Nil") {
        return _acc_0;
      } else {
        const _h_0 = _xs_0["head"];
        const _t_0 = _xs_0["tail"];
        const _x_0 = $oneIf(_h_0);
        $0 = _t_0;
        $1 = nat_chk(_acc_0 + _x_0);
        continue;
      }
    }
  }
}
function $miniCount(_xs_0) {
  return $miniCount_go(_xs_0, 0);
}
function $roundPercent(_pct_0) {
  return $Nat_div(nat_chk(_pct_0 + 5), 10);
}
function $facts(_l_0) {
  const _chatWidth_0 = _l_0["chatWidth"];
  const _calcHeight_0 = _l_0["calcHeight"];
  const _splitPct_0 = _l_0["splitPct"];
  const _chatCollapsed_0 = _l_0["chatCollapsed"];
  const _minimized_0 = _l_0["minimized"];
  const _x_0 = $Nat_show($oneIf(_chatCollapsed_0));
  const _x_1 = $Nat_show($miniCount(_minimized_0));
  const _x_2 = "/" + _x_0;
  const _x_3 = _x_1 + _x_2;
  const _x_4 = $Nat_show($roundPercent(_splitPct_0));
  const _x_5 = "/" + _x_3;
  const _x_6 = _x_4 + _x_5;
  const _x_7 = $Nat_show(_calcHeight_0);
  const _x_8 = "/" + _x_6;
  const _x_9 = _x_7 + _x_8;
  const _x_10 = $Nat_show(_chatWidth_0);
  const _x_11 = "/" + _x_9;
  return _x_10 + _x_11;
}
function $leituraId() {
  return "mesa-leitura";
}
function $exerciciosId() {
  return "mesa-exercicios";
}
function $compararId() {
  return "mesa-comparar";
}
function $leituraLayout() {
  return { $: "LayoutView", chatWidth: 420, calcHeight: 220, splitPct: 500, chatCollapsed: false, calculatorCollapsed: false, referenceVisible: false, minimized: { $: "Con", head: false, tail: { $: "Con", head: false, tail: { $: "Nil" } } } };
}
function $exerciciosLayout() {
  return { $: "LayoutView", chatWidth: 360, calcHeight: 420, splitPct: 500, chatCollapsed: false, calculatorCollapsed: false, referenceVisible: true, minimized: { $: "Con", head: false, tail: { $: "Con", head: false, tail: { $: "Nil" } } } };
}
function $compararLayout() {
  return { $: "LayoutView", chatWidth: 330, calcHeight: 220, splitPct: 500, chatCollapsed: true, calculatorCollapsed: false, referenceVisible: true, minimized: { $: "Con", head: false, tail: { $: "Con", head: false, tail: { $: "Nil" } } } };
}
function $isExercicios(_id_0) {
  return $String_eq(_id_0, $exerciciosId());
}
function $isComparar(_id_0) {
  return $String_eq(_id_0, $compararId());
}
function $isBuiltin(_id_0) {
  const _x_0 = $isExercicios(_id_0);
  const _x_1 = $isComparar(_id_0);
  const _x_2 = $String_eq(_id_0, $leituraId());
  const _x_3 = _x_0 || _x_1;
  return _x_2 || _x_3;
}
function $builtinName_compare(_compare_0) {
  if (_compare_0) {
    return $msg_msg("layout.builtin.compare");
  } else {
    return $msg_msg("layout.builtin.reading");
  }
}
function $builtinName_exec(_exec_0, _compare_0) {
  if (_exec_0) {
    return $msg_msg("layout.builtin.exercises");
  } else {
    return $builtinName_compare(_compare_0);
  }
}
function $builtinName(_id_0) {
  return $builtinName_exec($isExercicios(_id_0), $isComparar(_id_0));
}
function $builtinLayout_compare(_compare_0) {
  if (_compare_0) {
    return { $: "Some", value: $compararLayout() };
  } else {
    return { $: "Some", value: $leituraLayout() };
  }
}
function $builtinLayout_exec(_exec_0, _compare_0) {
  if (_exec_0) {
    return { $: "Some", value: $exerciciosLayout() };
  } else {
    return $builtinLayout_compare(_compare_0);
  }
}
function $builtinLayout(_id_0) {
  return $builtinLayout_exec($isExercicios(_id_0), $isComparar(_id_0));
}
function $String_join(_xs_0, _sep_0) {
  if (_xs_0.$ === "Nil") {
    return "";
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return $String_join_go(_t_0, _h_0, _sep_0);
  }
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
function $Nat_is_gt(_a_0, _b_0) {
  return $Cmp_is_gt(cmp_new(_a_0, _b_0));
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
function $List_take(_xs_0, _n_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    if (_n_0 === 0) {
      return { $: "Nil" };
    } else {
      const _p_0 = _n_0 - 1;
      return { $: "Con", head: _h_0, tail: $List_take(_t_0, _p_0) };
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
function $Nat_div(_a_0, _b_0) {
  return $Pair_fst(nat_divmod(_a_0, _b_0));
}
function $Nat_show(_n_0) {
  const _m_0 = _n_0;
  return $Nat_show_fin(_m_0, "", $Nat_show_put(nat_divmod(_m_0, 10)));
}
function $String_eq(_a_0, _b_0) {
  return $Cmp_is_eq($String_order(_a_0, _b_0));
}
function $String_join_go(_xs_0, _h_0, _sep_0) {
  if (_xs_0.$ === "Nil") {
    return _h_0;
  } else {
    const _h2_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    const _x_0 = $String_join_go(_t_0, _h2_0, _sep_0);
    const _x_1 = _sep_0 + _x_0;
    return _h_0 + _x_1;
  }
}
function $Char_is_eq(_a_0, _b_0) {
  const _x_0 = char_code(_a_0);
  const _x_1 = char_code(_b_0);
  return _x_0 === _x_1;
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
function $Pair_fst(_p_0) {
  const _a_0 = _p_0["fst"];
  return _a_0;
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
var mesaqollayout_default = {
  "msg.mark": run_lib(() => str_out(run_loop($msg_mark())), 0),
  "msg.sep": run_lib(() => str_out(run_loop($msg_sep())), 0),
  "msg.pack": run_lib((a0) => str_out(run_loop($msg_pack(a0))), 1),
  "msg.msg": run_lib((a0) => str_out(run_loop($msg_msg(str_in(a0)))), 1),
  "msg.msg1": run_lib((a0, a1, a2) => str_out(run_loop($msg_msg1(str_in(a0), str_in(a1), str_in(a2)))), 3),
  "msg.msg2": run_lib((a0, a1, a2, a3, a4) => str_out(run_loop($msg_msg2(str_in(a0), str_in(a1), str_in(a2), str_in(a3), str_in(a4)))), 5),
  "msg.msg3": run_lib((a0, a1, a2, a3, a4, a5, a6) => str_out(run_loop($msg_msg3(str_in(a0), str_in(a1), str_in(a2), str_in(a3), str_in(a4), str_in(a5), str_in(a6)))), 7),
  "msg.msg4": run_lib((a0, a1, a2, a3, a4, a5, a6, a7, a8) => str_out(run_loop($msg_msg4(str_in(a0), str_in(a1), str_in(a2), str_in(a3), str_in(a4), str_in(a5), str_in(a6), str_in(a7), str_in(a8)))), 9),
  "msg.isMsg": run_lib((a0) => run_loop($msg_isMsg(str_in(a0))), 1),
  minChat: run_lib(() => run_loop($minChat()), 0),
  maxChat: run_lib(() => run_loop($maxChat()), 0),
  minCalc: run_lib(() => run_loop($minCalc()), 0),
  maxCalc: run_lib(() => run_loop($maxCalc()), 0),
  minSplit: run_lib(() => run_loop($minSplit()), 0),
  maxSplit: run_lib(() => run_loop($maxSplit()), 0),
  maxName: run_lib(() => run_loop($maxName()), 0),
  maxPresets: run_lib(() => run_loop($maxPresets()), 0),
  "clamp.over": run_lib((a0, a1, a2) => run_loop($clamp_over(nat_in(a0), nat_in(a1), a2)), 3),
  "clamp.below": run_lib((a0, a1, a2, a3) => run_loop($clamp_below(nat_in(a0), nat_in(a1), nat_in(a2), a3)), 4),
  clamp: run_lib((a0, a1, a2) => run_loop($clamp(nat_in(a0), nat_in(a1), nat_in(a2))), 3),
  "cut.if": run_lib((a0, a1, a2) => str_out(run_loop($cut_if(str_in(a0), nat_in(a1), a2))), 3),
  cut: run_lib((a0, a1) => str_out(run_loop($cut(str_in(a0), nat_in(a1)))), 2),
  name: run_lib((a0) => str_out(run_loop($name(str_in(a0)))), 1),
  keepMinimized: run_lib((a0) => run_loop($keepMinimized(a0)), 1),
  layout: run_lib((a0, a1, a2, a3, a4, a5, a6) => run_loop($layout(nat_in(a0), nat_in(a1), nat_in(a2), a3, a4, a5, a6)), 7),
  referenceShown: run_lib((a0, a1, a2) => run_loop($referenceShown(a0, a1, a2)), 3),
  "refAction.whenShown": run_lib((a0) => str_out(run_loop($refAction_whenShown(a0))), 1),
  "refAction.whenHidden": run_lib((a0) => str_out(run_loop($refAction_whenHidden(a0))), 1),
  "refAction.shown": run_lib((a0, a1) => str_out(run_loop($refAction_shown(a0, a1))), 2),
  "referenceAction.two": run_lib((a0, a1, a2) => str_out(run_loop($referenceAction_two(a0, a1, a2))), 3),
  referenceAction: run_lib((a0, a1, a2, a3) => str_out(run_loop($referenceAction(a0, a1, a2, a3))), 4),
  oneIf: run_lib((a0) => run_loop($oneIf(a0)), 1),
  "miniCount.go": run_lib((a0, a1) => run_loop($miniCount_go(a0, nat_in(a1))), 2),
  miniCount: run_lib((a0) => run_loop($miniCount(a0)), 1),
  roundPercent: run_lib((a0) => run_loop($roundPercent(nat_in(a0))), 1),
  facts: run_lib((a0) => str_out(run_loop($facts(a0))), 1),
  leituraId: run_lib(() => str_out(run_loop($leituraId())), 0),
  exerciciosId: run_lib(() => str_out(run_loop($exerciciosId())), 0),
  compararId: run_lib(() => str_out(run_loop($compararId())), 0),
  leituraLayout: run_lib(() => run_loop($leituraLayout()), 0),
  exerciciosLayout: run_lib(() => run_loop($exerciciosLayout()), 0),
  compararLayout: run_lib(() => run_loop($compararLayout()), 0),
  isExercicios: run_lib((a0) => run_loop($isExercicios(str_in(a0))), 1),
  isComparar: run_lib((a0) => run_loop($isComparar(str_in(a0))), 1),
  isBuiltin: run_lib((a0) => run_loop($isBuiltin(str_in(a0))), 1),
  "builtinName.compare": run_lib((a0) => str_out(run_loop($builtinName_compare(a0))), 1),
  "builtinName.exec": run_lib((a0, a1) => str_out(run_loop($builtinName_exec(a0, a1))), 2),
  builtinName: run_lib((a0) => str_out(run_loop($builtinName(str_in(a0)))), 1),
  "builtinLayout.compare": run_lib((a0) => run_loop($builtinLayout_compare(a0)), 1),
  "builtinLayout.exec": run_lib((a0, a1) => run_loop($builtinLayout_exec(a0, a1)), 2),
  builtinLayout: run_lib((a0) => run_loop($builtinLayout(str_in(a0))), 1)
};
export {
  mesaqollayout_default as default
};

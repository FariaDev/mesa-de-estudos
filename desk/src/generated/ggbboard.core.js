// GERADO de core/ggbboard.bend por `bun core/build.mjs` — não editar à mão.
// core/ggbboard.bend
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
function $planOfKeep(_keep_0) {
  if (_keep_0) {
    return { $: "PlanKeep" };
  } else {
    return { $: "PlanFresh" };
  }
}
function $runPlan(_continues_0, _sameRequest_0, _empty_0) {
  const _x_0 = _sameRequest_0 || _empty_0;
  return $planOfKeep(_continues_0 || _x_0);
}
function $boardPlan(_kind_0, _continues_0, _sameRequest_0, _empty_0) {
  if (_kind_0.$ === "UseRead") {
    return { $: "PlanKeep" };
  } else {
    return $runPlan(_continues_0, _sameRequest_0, _empty_0);
  }
}
function $keptLimit() {
  return 3;
}
function $originOfTutor(_tutor_0) {
  if (_tutor_0) {
    return { $: "FromTutor" };
  } else {
    return { $: "FromStudent" };
  }
}
function $originOf(_tutorDrew_0, _unchangedSinceTutor_0) {
  return $originOfTutor($Bool_and(_tutorDrew_0, _unchangedSinceTutor_0));
}
function $keptAfterPush(_count_0) {
  const _x_0 = nat_chk(_count_0 + 1);
  const _x_1 = $keptLimit();
  return _x_0 < _x_1 ? _x_0 : _x_1;
}
function $canGoBack(_count_0) {
  if (_count_0 === 0) {
    return false;
  } else {
    return true;
  }
}
function $restoreWith(_currentEmpty_0) {
  if (_currentEmpty_0) {
    return { $: "RestoreOnly" };
  } else {
    return { $: "RestoreSwap" };
  }
}
function $restorePlan(_count_0, _currentEmpty_0) {
  if (_count_0 === 0) {
    return { $: "RestoreNone" };
  } else {
    return $restoreWith(_currentEmpty_0);
  }
}
function $keptAfterRestore_pick(_currentEmpty_0, _rest_0) {
  if (_currentEmpty_0) {
    return _rest_0;
  } else {
    return nat_chk(_rest_0 + 1);
  }
}
function $keptAfterRestore(_count_0, _currentEmpty_0) {
  if (_count_0 === 0) {
    return 0;
  } else {
    const _p_0 = _count_0 - 1;
    return $keptAfterRestore_pick(_currentEmpty_0, _p_0);
  }
}
function $freshNote(_origin_0) {
  if (_origin_0.$ === "FromTutor") {
    return $msg_msg("ggb.board.freshTutor");
  } else {
    return $msg_msg("ggb.board.freshStudent");
  }
}
function $backLabel() {
  return $msg_msg("ggb.board.back");
}
function $backTitle(_count_0) {
  return $msg_msg1("ggb.board.backTitle", "count", $Nat_show(_count_0));
}
function $restoredNote() {
  return $msg_msg("ggb.board.restored");
}
function $nothingToRestoreNote() {
  return $msg_msg("ggb.board.nothingToRestore");
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
function $Bool_and(_a_0, _b_0) {
  if (!_a_0) {
    return false;
  } else {
    return _b_0;
  }
}
function $Nat_show(_n_0) {
  const _m_0 = _n_0;
  return $Nat_show_fin(_m_0, "", $Nat_show_put(nat_divmod(_m_0, 10)));
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
var ggbboard_default = {
  "msg.mark": run_lib(() => str_out(run_loop($msg_mark())), 0),
  "msg.sep": run_lib(() => str_out(run_loop($msg_sep())), 0),
  "msg.pack": run_lib((a0) => str_out(run_loop($msg_pack(a0))), 1),
  "msg.msg": run_lib((a0) => str_out(run_loop($msg_msg(str_in(a0)))), 1),
  "msg.msg1": run_lib((a0, a1, a2) => str_out(run_loop($msg_msg1(str_in(a0), str_in(a1), str_in(a2)))), 3),
  "msg.msg2": run_lib((a0, a1, a2, a3, a4) => str_out(run_loop($msg_msg2(str_in(a0), str_in(a1), str_in(a2), str_in(a3), str_in(a4)))), 5),
  "msg.msg3": run_lib((a0, a1, a2, a3, a4, a5, a6) => str_out(run_loop($msg_msg3(str_in(a0), str_in(a1), str_in(a2), str_in(a3), str_in(a4), str_in(a5), str_in(a6)))), 7),
  "msg.msg4": run_lib((a0, a1, a2, a3, a4, a5, a6, a7, a8) => str_out(run_loop($msg_msg4(str_in(a0), str_in(a1), str_in(a2), str_in(a3), str_in(a4), str_in(a5), str_in(a6), str_in(a7), str_in(a8)))), 9),
  "msg.isMsg": run_lib((a0) => run_loop($msg_isMsg(str_in(a0))), 1),
  planOfKeep: run_lib((a0) => run_loop($planOfKeep(a0)), 1),
  runPlan: run_lib((a0, a1, a2) => run_loop($runPlan(a0, a1, a2)), 3),
  boardPlan: run_lib((a0, a1, a2, a3) => run_loop($boardPlan(a0, a1, a2, a3)), 4),
  keptLimit: run_lib(() => run_loop($keptLimit()), 0),
  originOfTutor: run_lib((a0) => run_loop($originOfTutor(a0)), 1),
  originOf: run_lib((a0, a1) => run_loop($originOf(a0, a1)), 2),
  keptAfterPush: run_lib((a0) => run_loop($keptAfterPush(nat_in(a0))), 1),
  canGoBack: run_lib((a0) => run_loop($canGoBack(nat_in(a0))), 1),
  restoreWith: run_lib((a0) => run_loop($restoreWith(a0)), 1),
  restorePlan: run_lib((a0, a1) => run_loop($restorePlan(nat_in(a0), a1)), 2),
  "keptAfterRestore.pick": run_lib((a0, a1) => run_loop($keptAfterRestore_pick(a0, nat_in(a1))), 2),
  keptAfterRestore: run_lib((a0, a1) => run_loop($keptAfterRestore(nat_in(a0), a1)), 2),
  freshNote: run_lib((a0) => str_out(run_loop($freshNote(a0))), 1),
  backLabel: run_lib(() => str_out(run_loop($backLabel())), 0),
  backTitle: run_lib((a0) => str_out(run_loop($backTitle(nat_in(a0)))), 1),
  restoredNote: run_lib(() => str_out(run_loop($restoredNote())), 0),
  nothingToRestoreNote: run_lib(() => str_out(run_loop($nothingToRestoreNote())), 0)
};
export {
  ggbboard_default as default
};

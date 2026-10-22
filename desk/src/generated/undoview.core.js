// GERADO de core/undoview.bend por `bun core/build.mjs` — não editar à mão.
// core/undoview.bend
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
function $ttlMs() {
  return 60000;
}
function $noticeMs() {
  return 25000;
}
function $maxToken() {
  return 64;
}
function $maxEntries() {
  return 64;
}
function $expiryFrom(_now_0, _ttl_0) {
  return nat_chk(_now_0 + _ttl_0);
}
function $isExpired(_now_0, _expiresAt_0) {
  return $Nat_is_ge(_now_0, _expiresAt_0);
}
function $remainingMs_if(_now_0, _expiresAt_0, _expired_0) {
  if (_expired_0) {
    return 0;
  } else {
    return _expiresAt_0 < _now_0 ? 0 : _expiresAt_0 - _now_0;
  }
}
function $remainingMs(_now_0, _expiresAt_0) {
  return $remainingMs_if(_now_0, _expiresAt_0, $isExpired(_now_0, _expiresAt_0));
}
function $secondsLeft(_now_0, _expiresAt_0) {
  return $Nat_div($remainingMs(_now_0, _expiresAt_0), 1000);
}
function $validToken(_token_0) {
  return $Bool_and($Bool_not($String_is_empty($String_trim(_token_0))), $Nat_is_le([...str_out(_token_0)].length, $maxToken()));
}
function $clampIndex_if(_index_0, _len_0, _over_0) {
  if (_over_0) {
    return _len_0;
  } else {
    return _index_0;
  }
}
function $clampIndex(_index_0, _len_0) {
  return $clampIndex_if(_index_0, _len_0, $Nat_is_gt(_index_0, _len_0));
}
function $decide(_known_0, _expired_0, _sameScope_0, _authorized_0) {
  if (!_known_0) {
    return { $: "UndoUnknown" };
  } else {
    if (_expired_0) {
      return { $: "UndoExpired" };
    } else {
      if (!_sameScope_0) {
        return { $: "UndoForeign" };
      } else {
        if (!_authorized_0) {
          return { $: "UndoBlocked" };
        } else {
          return { $: "UndoReady" };
        }
      }
    }
  }
}
function $undoLabel() {
  return $msg_msg("undo.label");
}
function $undoTitle() {
  return $msg_msg("undo.title");
}
function $closeTitle() {
  return $msg_msg("undo.close");
}
function $noticeReview() {
  return $msg_msg("undo.noticeReview");
}
function $noticeNote() {
  return $msg_msg("undo.noticeNote");
}
function $restoredReview() {
  return $msg_msg("undo.restoredReview");
}
function $restoredNote() {
  return $msg_msg("undo.restoredNote");
}
function $expiredText() {
  return $msg_msg("undo.expired");
}
function $foreignText() {
  return $msg_msg("undo.foreign");
}
function $blockedText() {
  return $msg_msg("undo.blocked");
}
function $unknownText() {
  return $msg_msg("undo.unknown");
}
function $failedText() {
  return $msg_msg("undo.failed");
}
function $countdownLabel(_seconds_0) {
  return $msg_msg1("undo.countdown", "seconds", $Nat_show(_seconds_0));
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
function $Nat_is_ge(_a_0, _b_0) {
  return $Cmp_is_ge(cmp_new(_a_0, _b_0));
}
function $Nat_div(_a_0, _b_0) {
  return $Pair_fst(nat_divmod(_a_0, _b_0));
}
function $Bool_and(_a_0, _b_0) {
  if (!_a_0) {
    return false;
  } else {
    return _b_0;
  }
}
function $Bool_not(_b_0) {
  if (!_b_0) {
    return true;
  } else {
    return false;
  }
}
function $String_is_empty(_s_0) {
  if (_s_0 === "") {
    return true;
  } else {
    return false;
  }
}
function $String_trim(_s_0) {
  return $String_trim_end($String_trim_start(_s_0));
}
function $Nat_is_le(_a_0, _b_0) {
  return $Cmp_is_le(cmp_new(_a_0, _b_0));
}
function $Nat_is_gt(_a_0, _b_0) {
  return $Cmp_is_gt(cmp_new(_a_0, _b_0));
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
function $Cmp_is_ge(_c_0) {
  if (_c_0.$ === "LT") {
    return false;
  } else {
    return true;
  }
}
function $Pair_fst(_p_0) {
  const _a_0 = _p_0["fst"];
  return _a_0;
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
function $Cmp_is_le(_c_0) {
  if (_c_0.$ === "GT") {
    return false;
  } else {
    return true;
  }
}
function $Cmp_is_gt(_c_0) {
  if (_c_0.$ === "GT") {
    return true;
  } else {
    return false;
  }
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
var undoview_default = {
  "msg.mark": run_lib(() => str_out(run_loop($msg_mark())), 0),
  "msg.sep": run_lib(() => str_out(run_loop($msg_sep())), 0),
  "msg.pack": run_lib((a0) => str_out(run_loop($msg_pack(a0))), 1),
  "msg.msg": run_lib((a0) => str_out(run_loop($msg_msg(str_in(a0)))), 1),
  "msg.msg1": run_lib((a0, a1, a2) => str_out(run_loop($msg_msg1(str_in(a0), str_in(a1), str_in(a2)))), 3),
  "msg.msg2": run_lib((a0, a1, a2, a3, a4) => str_out(run_loop($msg_msg2(str_in(a0), str_in(a1), str_in(a2), str_in(a3), str_in(a4)))), 5),
  "msg.msg3": run_lib((a0, a1, a2, a3, a4, a5, a6) => str_out(run_loop($msg_msg3(str_in(a0), str_in(a1), str_in(a2), str_in(a3), str_in(a4), str_in(a5), str_in(a6)))), 7),
  "msg.msg4": run_lib((a0, a1, a2, a3, a4, a5, a6, a7, a8) => str_out(run_loop($msg_msg4(str_in(a0), str_in(a1), str_in(a2), str_in(a3), str_in(a4), str_in(a5), str_in(a6), str_in(a7), str_in(a8)))), 9),
  "msg.isMsg": run_lib((a0) => run_loop($msg_isMsg(str_in(a0))), 1),
  ttlMs: run_lib(() => run_loop($ttlMs()), 0),
  noticeMs: run_lib(() => run_loop($noticeMs()), 0),
  maxToken: run_lib(() => run_loop($maxToken()), 0),
  maxEntries: run_lib(() => run_loop($maxEntries()), 0),
  expiryFrom: run_lib((a0, a1) => run_loop($expiryFrom(nat_in(a0), nat_in(a1))), 2),
  isExpired: run_lib((a0, a1) => run_loop($isExpired(nat_in(a0), nat_in(a1))), 2),
  "remainingMs.if": run_lib((a0, a1, a2) => run_loop($remainingMs_if(nat_in(a0), nat_in(a1), a2)), 3),
  remainingMs: run_lib((a0, a1) => run_loop($remainingMs(nat_in(a0), nat_in(a1))), 2),
  secondsLeft: run_lib((a0, a1) => run_loop($secondsLeft(nat_in(a0), nat_in(a1))), 2),
  validToken: run_lib((a0) => run_loop($validToken(str_in(a0))), 1),
  "clampIndex.if": run_lib((a0, a1, a2) => run_loop($clampIndex_if(nat_in(a0), nat_in(a1), a2)), 3),
  clampIndex: run_lib((a0, a1) => run_loop($clampIndex(nat_in(a0), nat_in(a1))), 2),
  decide: run_lib((a0, a1, a2, a3) => run_loop($decide(a0, a1, a2, a3)), 4),
  undoLabel: run_lib(() => str_out(run_loop($undoLabel())), 0),
  undoTitle: run_lib(() => str_out(run_loop($undoTitle())), 0),
  closeTitle: run_lib(() => str_out(run_loop($closeTitle())), 0),
  noticeReview: run_lib(() => str_out(run_loop($noticeReview())), 0),
  noticeNote: run_lib(() => str_out(run_loop($noticeNote())), 0),
  restoredReview: run_lib(() => str_out(run_loop($restoredReview())), 0),
  restoredNote: run_lib(() => str_out(run_loop($restoredNote())), 0),
  expiredText: run_lib(() => str_out(run_loop($expiredText())), 0),
  foreignText: run_lib(() => str_out(run_loop($foreignText())), 0),
  blockedText: run_lib(() => str_out(run_loop($blockedText())), 0),
  unknownText: run_lib(() => str_out(run_loop($unknownText())), 0),
  failedText: run_lib(() => str_out(run_loop($failedText())), 0),
  countdownLabel: run_lib((a0) => str_out(run_loop($countdownLabel(nat_in(a0)))), 1)
};
export {
  undoview_default as default
};

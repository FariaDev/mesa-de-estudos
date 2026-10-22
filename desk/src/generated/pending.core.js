// GERADO de core/pending.bend por `bun core/build.mjs` — não editar à mão.
// core/pending.bend
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
function $maxItems() {
  return 50;
}
function $maxRefs() {
  return 2;
}
function $maxStoredBytes() {
  const _x_0 = Math.imul(40, 1024) >>> 0;
  return Math.imul(_x_0, 1024) >>> 0;
}
function $pageOf_if(_page_0, _zero_0) {
  if (_zero_0) {
    return 1;
  } else {
    return _page_0;
  }
}
function $pageOf(_page_0) {
  return $pageOf_if(_page_0, $Nat_is_eq(_page_0, 0));
}
function $keepItem_empty(_hasImage_0, _blank_0) {
  if (_blank_0) {
    return _hasImage_0;
  } else {
    return true;
  }
}
function $keepItem(_text_0, _imageCount_0) {
  return $keepItem_empty($Nat_is_gt(_imageCount_0, 0), $String_is_empty($String_trim(_text_0)));
}
function $cutText_if(_text_0, _limit_0, _over_0) {
  if (!_over_0) {
    return _text_0;
  } else {
    return $String_take(_text_0, _limit_0);
  }
}
function $cutText(_text_0, _limit_0) {
  return $cutText_if(_text_0, _limit_0, $Nat_is_gt([...str_out(_text_0)].length, _limit_0));
}
function $keepAt(_index_0) {
  const _x_0 = $maxItems();
  return _index_0 < _x_0;
}
function $heldOnLoad(_stored_0, _recovered_0) {
  if (_recovered_0) {
    return true;
  } else {
    return _stored_0;
  }
}
function $overStored(_bytes_0) {
  const _x_0 = $maxStoredBytes();
  return _bytes_0 > _x_0;
}
function $maxAutoRetries() {
  return 3;
}
function $retryAllowed(_safe_0, _belowLimit_0) {
  if (!_safe_0) {
    return false;
  } else {
    return _belowLimit_0;
  }
}
function $retryDelay(_retry_0) {
  return TAB_0[Math.min(_retry_0, 4)];
}
function $keptWhileOff_ready(_command_0, _usable_0) {
  if (_command_0) {
    return false;
  } else {
    return _usable_0;
  }
}
function $keptWhileOff_idle(_busy_0, _command_0, _usable_0) {
  if (_busy_0) {
    return false;
  } else {
    return $keptWhileOff_ready(_command_0, _usable_0);
  }
}
function $keptWhileOff(_connected_0, _busy_0, _command_0, _text_0, _imageCount_0) {
  if (_connected_0) {
    return false;
  } else {
    return $keptWhileOff_idle(_busy_0, _command_0, $keepItem(_text_0, _imageCount_0));
  }
}
function $keptLabel(_many_0, _count_0) {
  if (!_many_0) {
    return $msg_msg("pending.kept");
  } else {
    return $msg_msg1("pending.keptMany", "count", _count_0);
  }
}
function $stripLabel_off(_tutorOff_0, _many_0, _count_0, _plain_0) {
  if (_tutorOff_0) {
    return $keptLabel(_many_0, _count_0);
  } else {
    return _plain_0;
  }
}
function $stripLabel(_recovered_0, _tutorOff_0, _many_0, _count_0, _plain_0) {
  if (_recovered_0) {
    return _plain_0;
  } else {
    return $stripLabel_off(_tutorOff_0, _many_0, _count_0, _plain_0);
  }
}
function $tutorAnswered(_wasOnline_0, _isOnline_0) {
  if (_wasOnline_0) {
    return false;
  } else {
    return _isOnline_0;
  }
}
function $holdAfterAnswer_stuck(_uncertain_0, _cancelled_0) {
  if (_uncertain_0) {
    return true;
  } else {
    return _cancelled_0;
  }
}
function $holdAfterAnswer_free(_permissionPending_0, _uncertain_0, _cancelled_0) {
  if (_permissionPending_0) {
    return false;
  } else {
    return $holdAfterAnswer_stuck(_uncertain_0, _cancelled_0);
  }
}
function $holdAfterAnswer(_busy_0, _permissionPending_0, _uncertain_0, _cancelled_0) {
  if (_busy_0) {
    return false;
  } else {
    return $holdAfterAnswer_free(_permissionPending_0, _uncertain_0, _cancelled_0);
  }
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
function $Nat_is_eq(_a_0, _b_0) {
  return $Cmp_is_eq(cmp_new(_a_0, _b_0));
}
function $Nat_is_gt(_a_0, _b_0) {
  return $Cmp_is_gt(cmp_new(_a_0, _b_0));
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
function $Cmp_is_eq(_c_0) {
  if (_c_0.$ === "EQ") {
    return true;
  } else {
    return false;
  }
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
function $Bool_and(_a_0, _b_0) {
  if (!_a_0) {
    return false;
  } else {
    return _b_0;
  }
}
var TAB_0 = [0, 2000, 4000, 8000, 0];
var pending_default = {
  "msg.mark": run_lib(() => str_out(run_loop($msg_mark())), 0),
  "msg.sep": run_lib(() => str_out(run_loop($msg_sep())), 0),
  "msg.pack": run_lib((a0) => str_out(run_loop($msg_pack(a0))), 1),
  "msg.msg": run_lib((a0) => str_out(run_loop($msg_msg(str_in(a0)))), 1),
  "msg.msg1": run_lib((a0, a1, a2) => str_out(run_loop($msg_msg1(str_in(a0), str_in(a1), str_in(a2)))), 3),
  "msg.msg2": run_lib((a0, a1, a2, a3, a4) => str_out(run_loop($msg_msg2(str_in(a0), str_in(a1), str_in(a2), str_in(a3), str_in(a4)))), 5),
  "msg.msg3": run_lib((a0, a1, a2, a3, a4, a5, a6) => str_out(run_loop($msg_msg3(str_in(a0), str_in(a1), str_in(a2), str_in(a3), str_in(a4), str_in(a5), str_in(a6)))), 7),
  "msg.msg4": run_lib((a0, a1, a2, a3, a4, a5, a6, a7, a8) => str_out(run_loop($msg_msg4(str_in(a0), str_in(a1), str_in(a2), str_in(a3), str_in(a4), str_in(a5), str_in(a6), str_in(a7), str_in(a8)))), 9),
  "msg.isMsg": run_lib((a0) => run_loop($msg_isMsg(str_in(a0))), 1),
  maxItems: run_lib(() => run_loop($maxItems()), 0),
  maxRefs: run_lib(() => run_loop($maxRefs()), 0),
  maxStoredBytes: run_lib(() => run_loop($maxStoredBytes()), 0),
  "pageOf.if": run_lib((a0, a1) => run_loop($pageOf_if(nat_in(a0), a1)), 2),
  pageOf: run_lib((a0) => run_loop($pageOf(nat_in(a0))), 1),
  "keepItem.empty": run_lib((a0, a1) => run_loop($keepItem_empty(a0, a1)), 2),
  keepItem: run_lib((a0, a1) => run_loop($keepItem(str_in(a0), nat_in(a1))), 2),
  "cutText.if": run_lib((a0, a1, a2) => str_out(run_loop($cutText_if(str_in(a0), nat_in(a1), a2))), 3),
  cutText: run_lib((a0, a1) => str_out(run_loop($cutText(str_in(a0), nat_in(a1)))), 2),
  keepAt: run_lib((a0) => run_loop($keepAt(nat_in(a0))), 1),
  heldOnLoad: run_lib((a0, a1) => run_loop($heldOnLoad(a0, a1)), 2),
  overStored: run_lib((a0) => run_loop($overStored(a0)), 1),
  maxAutoRetries: run_lib(() => run_loop($maxAutoRetries()), 0),
  retryAllowed: run_lib((a0, a1) => run_loop($retryAllowed(a0, a1)), 2),
  retryDelay: run_lib((a0) => run_loop($retryDelay(nat_in(a0))), 1),
  "keptWhileOff.ready": run_lib((a0, a1) => run_loop($keptWhileOff_ready(a0, a1)), 2),
  "keptWhileOff.idle": run_lib((a0, a1, a2) => run_loop($keptWhileOff_idle(a0, a1, a2)), 3),
  keptWhileOff: run_lib((a0, a1, a2, a3, a4) => run_loop($keptWhileOff(a0, a1, a2, str_in(a3), nat_in(a4))), 5),
  keptLabel: run_lib((a0, a1) => str_out(run_loop($keptLabel(a0, str_in(a1)))), 2),
  "stripLabel.off": run_lib((a0, a1, a2, a3) => str_out(run_loop($stripLabel_off(a0, a1, str_in(a2), str_in(a3)))), 4),
  stripLabel: run_lib((a0, a1, a2, a3, a4) => str_out(run_loop($stripLabel(a0, a1, a2, str_in(a3), str_in(a4)))), 5),
  tutorAnswered: run_lib((a0, a1) => run_loop($tutorAnswered(a0, a1)), 2),
  "holdAfterAnswer.stuck": run_lib((a0, a1) => run_loop($holdAfterAnswer_stuck(a0, a1)), 2),
  "holdAfterAnswer.free": run_lib((a0, a1, a2) => run_loop($holdAfterAnswer_free(a0, a1, a2)), 3),
  holdAfterAnswer: run_lib((a0, a1, a2, a3) => run_loop($holdAfterAnswer(a0, a1, a2, a3)), 4)
};
export {
  pending_default as default
};

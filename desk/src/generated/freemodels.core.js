// GERADO de core/freemodels.bend por `bun core/build.mjs` — não editar à mão.
// core/freemodels.bend
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
function $zenProvider() {
  return "opencode";
}
function $keyPrefix() {
  return "sk-";
}
function $keyChar(_c_0) {
  const _x_0 = $Char_is_digit(_c_0);
  const _x_1 = $Char_is_alpha(_c_0);
  const _x_2 = $Char_is_eq(_c_0, "-");
  const _x_3 = $Char_is_eq(_c_0, "_");
  const _x_4 = _x_0 || _x_1;
  const _x_5 = _x_2 || _x_3;
  return _x_4 || _x_5;
}
function $keyChars(_s_0) {
  if (_s_0 === "") {
    return true;
  } else {
    const _h_0 = _s_0.slice(0, char_len(_s_0));
    const _t_0 = _s_0.slice(char_len(_s_0));
    return $Bool_and($keyChar(_h_0), $keyChars(_t_0));
  }
}
function $keyLength(_key_0) {
  return $Bool_and($Bool_not($String_is_empty($String_drop(_key_0, 19))), $String_is_empty($String_drop(_key_0, 200)));
}
function $typedKey(_key_0) {
  return $Bool_and($keyLength(_key_0), $keyChars(_key_0));
}
function $clipboardKey(_key_0) {
  return $Bool_and($String_starts_with(_key_0, $keyPrefix()), $typedKey(_key_0));
}
function $lastFour(_key_0) {
  return $String_reverse($String_take($String_reverse(_key_0), 4));
}
function $mask_show(_valid_0, _key_0) {
  if (_valid_0) {
    const _x_0 = $lastFour(_key_0);
    const _x_1 = $String_take(_key_0, 3);
    const _x_2 = "••••" + _x_0;
    return _x_1 + _x_2;
  } else {
    return "••••";
  }
}
function $mask(_key_0) {
  return $mask_show($typedKey(_key_0), _key_0);
}
function $outcomeBilling(_billing_0) {
  if (_billing_0) {
    return "billing";
  } else {
    return "unexpected";
  }
}
function $outcomeInvalid(_invalid_0, _billing_0) {
  if (_invalid_0) {
    return "invalid";
  } else {
    return $outcomeBilling(_billing_0);
  }
}
function $outcomePick(_ok_0, _invalid_0, _billing_0) {
  if (_ok_0) {
    return "ok";
  } else {
    return $outcomeInvalid(_invalid_0, _billing_0);
  }
}
function $outcomeStatus(_status_0) {
  const _x_0 = $Nat_is_eq(_status_0, 402);
  const _x_1 = $Nat_is_eq(_status_0, 403);
  return $outcomePick($Nat_is_eq(_status_0, 200), $Nat_is_eq(_status_0, 401), _x_0 || _x_1);
}
function $outcome(_network_0, _status_0) {
  if (_network_0) {
    return "network";
  } else {
    return $outcomeStatus(_status_0);
  }
}
function $outcomeFor(_shapeOk_0, _network_0, _status_0) {
  if (_shapeOk_0) {
    return $outcome(_network_0, _status_0);
  } else {
    return "shape";
  }
}
function $outcomeMsgShape(_isShape_0) {
  if (_isShape_0) {
    return $msg_msg("freeModels.test.shape");
  } else {
    return $msg_msg("freeModels.test.unexpected");
  }
}
function $outcomeMsgNetwork(_isNetwork_0, _outcome_0) {
  if (_isNetwork_0) {
    return $msg_msg("freeModels.test.network");
  } else {
    return $outcomeMsgShape($String_eq(_outcome_0, "shape"));
  }
}
function $outcomeMsgBilling(_isBilling_0, _outcome_0) {
  if (_isBilling_0) {
    return $msg_msg("freeModels.test.billing");
  } else {
    return $outcomeMsgNetwork($String_eq(_outcome_0, "network"), _outcome_0);
  }
}
function $outcomeMsgInvalid(_isInvalid_0, _outcome_0) {
  if (_isInvalid_0) {
    return $msg_msg("freeModels.test.invalid");
  } else {
    return $outcomeMsgBilling($String_eq(_outcome_0, "billing"), _outcome_0);
  }
}
function $outcomeMsgOk(_isOk_0, _outcome_0) {
  if (_isOk_0) {
    return $msg_msg("freeModels.test.ok");
  } else {
    return $outcomeMsgInvalid($String_eq(_outcome_0, "invalid"), _outcome_0);
  }
}
function $outcomeMsg(_outcome_0) {
  return $outcomeMsgOk($String_eq(_outcome_0, "ok"), _outcome_0);
}
function $keepsKey(_outcome_0) {
  return $String_eq(_outcome_0, "ok");
}
function $isFree(_provider_0, _id_0, _costZero_0) {
  const _x_0 = $String_ends_with(_id_0, "-free");
  const _x_1 = $String_eq(_id_0, "big-pickle");
  const _x_2 = _x_0 || _x_1;
  return $Bool_and($String_eq(_provider_0, $zenProvider()), _costZero_0 || _x_2);
}
function $routerProvider() {
  return "openrouter";
}
function $routerAuto() {
  return "openrouter/auto";
}
function $isRouterFree(_provider_0, _id_0, _costZero_0) {
  const _x_0 = $String_ends_with(_id_0, ":free");
  return $Bool_and($String_eq(_provider_0, $routerProvider()), $Bool_and($Bool_not($String_eq(_id_0, $routerAuto())), _x_0 || _costZero_0));
}
function $isFreeModel(_provider_0, _id_0, _costZero_0) {
  const _x_0 = $isFree(_provider_0, _id_0, _costZero_0);
  const _x_1 = $isRouterFree(_provider_0, _id_0, _costZero_0);
  return _x_0 || _x_1;
}
function $paidNeedsConfirmPick(_zen_0, _free_0, _confirmed_0) {
  return $Bool_and(_zen_0, $Bool_and($Bool_not(_free_0), $Bool_not(_confirmed_0)));
}
function $paidNeedsConfirm(_provider_0, _free_0, _confirmed_0) {
  return $paidNeedsConfirmPick($String_eq(_provider_0, $zenProvider()), _free_0, _confirmed_0);
}
function $mayHaveLeft(_free_0, _liveKnown_0, _inLive_0) {
  return $Bool_and(_free_0, $Bool_and(_liveKnown_0, $Bool_not(_inLive_0)));
}
function $policyTrain(_train_0) {
  if (_train_0) {
    return $msg_msg("freeModels.policy.train");
  } else {
    return $msg_msg("freeModels.policy.unknown");
  }
}
function $policyTrial(_trial_0, _train_0) {
  if (_trial_0) {
    return $msg_msg("freeModels.policy.trial");
  } else {
    return $policyTrain(_train_0);
  }
}
function $policyImprove(_improve_0, _trial_0, _train_0) {
  if (_improve_0) {
    return $msg_msg("freeModels.policy.improve");
  } else {
    return $policyTrial(_trial_0, _train_0);
  }
}
function $policyRetained(_retained_0, _improve_0, _trial_0, _train_0) {
  if (_retained_0) {
    return $msg_msg("freeModels.policy.retained");
  } else {
    return $policyImprove(_improve_0, _trial_0, _train_0);
  }
}
function $policyKnown(_zero_0, _retained_0, _improve_0, _trial_0, _train_0) {
  if (_zero_0) {
    return $msg_msg("freeModels.policy.zero");
  } else {
    return $policyRetained(_retained_0, _improve_0, _trial_0, _train_0);
  }
}
function $policyMsg(_policy_0) {
  return $policyKnown($String_eq(_policy_0, "zero"), $String_eq(_policy_0, "retained"), $String_eq(_policy_0, "improve"), $String_eq(_policy_0, "trial"), $String_eq(_policy_0, "train"));
}
function $isZeroRetention(_policy_0) {
  return $String_eq(_policy_0, "zero");
}
function $appendTail(_xs_0, _x_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Con", head: _x_0, tail: { $: "Nil" } };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return { $: "Con", head: _h_0, tail: $appendTail(_t_0, _x_0) };
  }
}
function $optionTailLeft(_left_0, _base_0) {
  if (_left_0) {
    return $appendTail(_base_0, $msg_msg("freeModels.maybeLeft"));
  } else {
    return _base_0;
  }
}
function $optionTailFree(_free_0, _policy_0, _left_0) {
  if (_free_0) {
    return $optionTailLeft(_left_0, { $: "Con", head: $msg_msg("freeModels.badge"), tail: { $: "Con", head: $policyMsg(_policy_0), tail: { $: "Nil" } } });
  } else {
    return { $: "Nil" };
  }
}
function $optionTail(_free_0, _policy_0, _left_0) {
  return $optionTailFree(_free_0, _policy_0, _left_0);
}
function $hasId(_xs_0, _id_0) {
  if (_xs_0.$ === "Nil") {
    return false;
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    const _x_0 = $String_eq(_h_0, _id_0);
    const _x_1 = $hasId(_t_0, _id_0);
    return _x_0 || _x_1;
  }
}
function $pickDefaultPick(_hit_0, _h_0, _rest_0) {
  if (_hit_0) {
    return _h_0;
  } else {
    return _rest_0;
  }
}
function $pickDefault(_preferred_0, _available_0) {
  if (_preferred_0.$ === "Nil") {
    return "";
  } else {
    const _h_0 = _preferred_0["head"];
    const _t_0 = _preferred_0["tail"];
    return $pickDefaultPick($hasId(_available_0, _h_0), _h_0, $pickDefault(_t_0, _available_0));
  }
}
function $doneMsgPick(_none_0) {
  if (_none_0) {
    return $msg_msg("freeModels.done.none");
  } else {
    return $msg_msg("freeModels.done.zero");
  }
}
function $doneMsg(_chosen_0) {
  return $doneMsgPick($String_is_empty(_chosen_0));
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
function $Char_is_digit(_c_0) {
  const _x_0 = char_code(_c_0);
  const _x_1 = char_code(_c_0);
  return $Bool_and(_x_0 >= 48, _x_1 <= 57);
}
function $Char_is_alpha(_c_0) {
  const _x_0 = $Char_is_upper(_c_0);
  const _x_1 = $Char_is_lower(_c_0);
  return _x_0 || _x_1;
}
function $Char_is_eq(_a_0, _b_0) {
  const _x_0 = char_code(_a_0);
  const _x_1 = char_code(_b_0);
  return _x_0 === _x_1;
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
function $String_drop($0, $1) {
  for (;; ) {
    {
      const _s_0 = $0;
      const _n_0 = $1;
      if (_s_0 === "") {
        return "";
      } else {
        const _h_0 = _s_0.slice(0, char_len(_s_0));
        const _t_0 = _s_0.slice(char_len(_s_0));
        if (_n_0 === 0) {
          return _h_0 + _t_0;
        } else {
          const _p_0 = _n_0 - 1;
          $0 = _t_0;
          $1 = _p_0;
          continue;
        }
      }
    }
  }
}
function $String_reverse(_s_0) {
  return $String_reverse_go(_s_0, "");
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
function $Nat_is_eq(_a_0, _b_0) {
  return $Cmp_is_eq(cmp_new(_a_0, _b_0));
}
function $String_eq(_a_0, _b_0) {
  return $Cmp_is_eq($String_order(_a_0, _b_0));
}
function $String_ends_with(_s_0, _p_0) {
  return $String_starts_with($String_reverse(_s_0), $String_reverse(_p_0));
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
function $Char_is_upper(_c_0) {
  const _x_0 = char_code(_c_0);
  const _x_1 = char_code(_c_0);
  return $Bool_and(_x_0 >= 65, _x_1 <= 90);
}
function $Char_is_lower(_c_0) {
  const _x_0 = char_code(_c_0);
  const _x_1 = char_code(_c_0);
  return $Bool_and(_x_0 >= 97, _x_1 <= 122);
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
var freemodels_default = {
  "msg.mark": run_lib(() => str_out(run_loop($msg_mark())), 0),
  "msg.sep": run_lib(() => str_out(run_loop($msg_sep())), 0),
  "msg.pack": run_lib((a0) => str_out(run_loop($msg_pack(a0))), 1),
  "msg.msg": run_lib((a0) => str_out(run_loop($msg_msg(str_in(a0)))), 1),
  "msg.msg1": run_lib((a0, a1, a2) => str_out(run_loop($msg_msg1(str_in(a0), str_in(a1), str_in(a2)))), 3),
  "msg.msg2": run_lib((a0, a1, a2, a3, a4) => str_out(run_loop($msg_msg2(str_in(a0), str_in(a1), str_in(a2), str_in(a3), str_in(a4)))), 5),
  "msg.msg3": run_lib((a0, a1, a2, a3, a4, a5, a6) => str_out(run_loop($msg_msg3(str_in(a0), str_in(a1), str_in(a2), str_in(a3), str_in(a4), str_in(a5), str_in(a6)))), 7),
  "msg.msg4": run_lib((a0, a1, a2, a3, a4, a5, a6, a7, a8) => str_out(run_loop($msg_msg4(str_in(a0), str_in(a1), str_in(a2), str_in(a3), str_in(a4), str_in(a5), str_in(a6), str_in(a7), str_in(a8)))), 9),
  "msg.isMsg": run_lib((a0) => run_loop($msg_isMsg(str_in(a0))), 1),
  zenProvider: run_lib(() => str_out(run_loop($zenProvider())), 0),
  keyPrefix: run_lib(() => str_out(run_loop($keyPrefix())), 0),
  keyChar: run_lib((a0) => run_loop($keyChar(str_in(a0))), 1),
  keyChars: run_lib((a0) => run_loop($keyChars(str_in(a0))), 1),
  keyLength: run_lib((a0) => run_loop($keyLength(str_in(a0))), 1),
  typedKey: run_lib((a0) => run_loop($typedKey(str_in(a0))), 1),
  clipboardKey: run_lib((a0) => run_loop($clipboardKey(str_in(a0))), 1),
  lastFour: run_lib((a0) => str_out(run_loop($lastFour(str_in(a0)))), 1),
  "mask.show": run_lib((a0, a1) => str_out(run_loop($mask_show(a0, str_in(a1)))), 2),
  mask: run_lib((a0) => str_out(run_loop($mask(str_in(a0)))), 1),
  outcomeBilling: run_lib((a0) => str_out(run_loop($outcomeBilling(a0))), 1),
  outcomeInvalid: run_lib((a0, a1) => str_out(run_loop($outcomeInvalid(a0, a1))), 2),
  outcomePick: run_lib((a0, a1, a2) => str_out(run_loop($outcomePick(a0, a1, a2))), 3),
  outcomeStatus: run_lib((a0) => str_out(run_loop($outcomeStatus(nat_in(a0)))), 1),
  outcome: run_lib((a0, a1) => str_out(run_loop($outcome(a0, nat_in(a1)))), 2),
  outcomeFor: run_lib((a0, a1, a2) => str_out(run_loop($outcomeFor(a0, a1, nat_in(a2)))), 3),
  outcomeMsgShape: run_lib((a0) => str_out(run_loop($outcomeMsgShape(a0))), 1),
  outcomeMsgNetwork: run_lib((a0, a1) => str_out(run_loop($outcomeMsgNetwork(a0, str_in(a1)))), 2),
  outcomeMsgBilling: run_lib((a0, a1) => str_out(run_loop($outcomeMsgBilling(a0, str_in(a1)))), 2),
  outcomeMsgInvalid: run_lib((a0, a1) => str_out(run_loop($outcomeMsgInvalid(a0, str_in(a1)))), 2),
  outcomeMsgOk: run_lib((a0, a1) => str_out(run_loop($outcomeMsgOk(a0, str_in(a1)))), 2),
  outcomeMsg: run_lib((a0) => str_out(run_loop($outcomeMsg(str_in(a0)))), 1),
  keepsKey: run_lib((a0) => run_loop($keepsKey(str_in(a0))), 1),
  isFree: run_lib((a0, a1, a2) => run_loop($isFree(str_in(a0), str_in(a1), a2)), 3),
  routerProvider: run_lib(() => str_out(run_loop($routerProvider())), 0),
  routerAuto: run_lib(() => str_out(run_loop($routerAuto())), 0),
  isRouterFree: run_lib((a0, a1, a2) => run_loop($isRouterFree(str_in(a0), str_in(a1), a2)), 3),
  isFreeModel: run_lib((a0, a1, a2) => run_loop($isFreeModel(str_in(a0), str_in(a1), a2)), 3),
  paidNeedsConfirmPick: run_lib((a0, a1, a2) => run_loop($paidNeedsConfirmPick(a0, a1, a2)), 3),
  paidNeedsConfirm: run_lib((a0, a1, a2) => run_loop($paidNeedsConfirm(str_in(a0), a1, a2)), 3),
  mayHaveLeft: run_lib((a0, a1, a2) => run_loop($mayHaveLeft(a0, a1, a2)), 3),
  policyTrain: run_lib((a0) => str_out(run_loop($policyTrain(a0))), 1),
  policyTrial: run_lib((a0, a1) => str_out(run_loop($policyTrial(a0, a1))), 2),
  policyImprove: run_lib((a0, a1, a2) => str_out(run_loop($policyImprove(a0, a1, a2))), 3),
  policyRetained: run_lib((a0, a1, a2, a3) => str_out(run_loop($policyRetained(a0, a1, a2, a3))), 4),
  policyKnown: run_lib((a0, a1, a2, a3, a4) => str_out(run_loop($policyKnown(a0, a1, a2, a3, a4))), 5),
  policyMsg: run_lib((a0) => str_out(run_loop($policyMsg(str_in(a0)))), 1),
  isZeroRetention: run_lib((a0) => run_loop($isZeroRetention(str_in(a0))), 1),
  appendTail: run_lib((a0, a1) => run_loop($appendTail(a0, str_in(a1))), 2),
  optionTailLeft: run_lib((a0, a1) => run_loop($optionTailLeft(a0, a1)), 2),
  optionTailFree: run_lib((a0, a1, a2) => run_loop($optionTailFree(a0, str_in(a1), a2)), 3),
  optionTail: run_lib((a0, a1, a2) => run_loop($optionTail(a0, str_in(a1), a2)), 3),
  hasId: run_lib((a0, a1) => run_loop($hasId(a0, str_in(a1))), 2),
  pickDefaultPick: run_lib((a0, a1, a2) => str_out(run_loop($pickDefaultPick(a0, str_in(a1), str_in(a2)))), 3),
  pickDefault: run_lib((a0, a1) => str_out(run_loop($pickDefault(a0, a1))), 2),
  doneMsgPick: run_lib((a0) => str_out(run_loop($doneMsgPick(a0))), 1),
  doneMsg: run_lib((a0) => str_out(run_loop($doneMsg(str_in(a0)))), 1)
};
export {
  freemodels_default as default
};

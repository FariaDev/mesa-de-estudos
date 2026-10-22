// GERADO de core/worklog.bend por `bun core/build.mjs` — não editar à mão.
// core/worklog.bend
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
function $emptyPayload() {
  return { $: "Payload", text: "", toolName: "", argsJson: "", query: "", url: "", domain: "", pageTitle: "", hits: { $: "Nil" }, resultText: "", error: "" };
}
function $withText(_p_0, _delta_0) {
  const _text_0 = _p_0["text"];
  const _toolName_0 = _p_0["toolName"];
  const _argsJson_0 = _p_0["argsJson"];
  const _query_0 = _p_0["query"];
  const _url_0 = _p_0["url"];
  const _domain_0 = _p_0["domain"];
  const _pageTitle_0 = _p_0["pageTitle"];
  const _hits_0 = _p_0["hits"];
  const _resultText_0 = _p_0["resultText"];
  const _error_0 = _p_0["error"];
  return { $: "Payload", text: _text_0 + _delta_0, toolName: _toolName_0, argsJson: _argsJson_0, query: _query_0, url: _url_0, domain: _domain_0, pageTitle: _pageTitle_0, hits: _hits_0, resultText: _resultText_0, error: _error_0 };
}
function $newThinking(_id_0, _now_0, _delta_0) {
  return { $: "Step", id: _id_0, status: { $: "Status.Running" }, kind: { $: "Thinking" }, startedAt: _now_0, endedAt: 0, payload: $withText($emptyPayload(), _delta_0) };
}
function $thinkId(_n_0) {
  const _x_0 = $Nat_show(nat_chk(_n_0 + 1));
  return "pensar-" + _x_0;
}
function $headHere(_s_0, _needle_0) {
  if (_s_0 === "") {
    return false;
  } else {
    const _h_0 = _s_0.slice(0, char_len(_s_0));
    const _t_0 = _s_0.slice(char_len(_s_0));
    return $String_starts_with(_h_0 + _t_0, _needle_0);
  }
}
function $hasNeedle_go($0, $1, $2) {
  for (;; ) {
    {
      const _s_0 = $0;
      const _here_0 = $1;
      const _needle_0 = $2;
      if (_s_0 === "") {
        return $String_is_empty(_needle_0);
      } else {
        const _t_0 = _s_0.slice(char_len(_s_0));
        if (_here_0) {
          return true;
        } else {
          $0 = _t_0;
          $1 = $headHere(_t_0, _needle_0);
          $2 = _needle_0;
          continue;
        }
      }
    }
  }
}
function $hasNeedle(_s_0, _needle_0) {
  return $hasNeedle_go(_s_0, $headHere(_s_0, _needle_0), _needle_0);
}
function $toLower_go($0, $1) {
  for (;; ) {
    {
      const _s_0 = $0;
      const _acc_0 = $1;
      if (_s_0 === "") {
        return $String_reverse(_acc_0);
      } else {
        const _h_0 = _s_0.slice(0, char_len(_s_0));
        const _t_0 = _s_0.slice(char_len(_s_0));
        $0 = _t_0;
        $1 = $Char_to_lower(_h_0) + _acc_0;
        continue;
      }
    }
  }
}
function $toLower(_s_0) {
  return $toLower_go(_s_0, "");
}
function $anyContains_go($0, $1, $2) {
  for (;; ) {
    {
      const _n_0 = $0;
      const _needles_0 = $1;
      const _found_0 = $2;
      if (_needles_0.$ === "Nil") {
        return _found_0;
      } else {
        const _h_0 = _needles_0["head"];
        const _t_0 = _needles_0["tail"];
        const _x_0 = $hasNeedle(_n_0, _h_0);
        $0 = _n_0;
        $1 = _t_0;
        $2 = _found_0 || _x_0;
        continue;
      }
    }
  }
}
function $anyContains(_n_0, _needles_0) {
  return $anyContains_go(_n_0, _needles_0, false);
}
function $toolKind_fetch_if(_n_0, _fetch_0) {
  if (_fetch_0) {
    return { $: "Fetch" };
  } else {
    return { $: "Tool" };
  }
}
function $toolKind_fetch(_n_0) {
  return $toolKind_fetch_if(_n_0, $anyContains(_n_0, { $: "Con", head: "fetch", tail: { $: "Con", head: "reader", tail: { $: "Con", head: "http", tail: { $: "Con", head: "url", tail: { $: "Con", head: "page", tail: { $: "Nil" } } } } } }));
}
function $toolKind_search_if(_n_0, _search_0) {
  if (_search_0) {
    return { $: "Search" };
  } else {
    return $toolKind_fetch(_n_0);
  }
}
function $toolKind_search(_n_0) {
  return $toolKind_search_if(_n_0, $anyContains(_n_0, { $: "Con", head: "search", tail: { $: "Con", head: "busca", tail: { $: "Nil" } } }));
}
function $toolKind_ref(_n_0, _ref_0) {
  if (_ref_0) {
    return { $: "Reference" };
  } else {
    return $toolKind_search(_n_0);
  }
}
function $toolKind(_name_0) {
  const _n_0 = $toLower(_name_0);
  return $toolKind_ref(_n_0, $anyContains(_n_0, { $: "Con", head: "reference", tail: { $: "Nil" } }));
}
function $createLog(_now_0) {
  return { $: "Log", startedAt: _now_0, endedAt: 0, reason: "", text: "", steps: { $: "Nil" } };
}
function $burst_last(_h_0, _delta_0, _now_0, _n_0) {
  const _id_0 = _h_0["id"];
  const _t_0 = _h_0["status"];
  if (_t_0.$ === "Status.Running") {
    const _t_1 = _h_0["kind"];
    if (_t_1.$ === "Thinking") {
      const _startedAt_0 = _h_0["startedAt"];
      const _endedAt_0 = _h_0["endedAt"];
      const _payload_0 = _h_0["payload"];
      return { $: "Con", head: { $: "Step", id: _id_0, status: { $: "Status.Running" }, kind: { $: "Thinking" }, startedAt: _startedAt_0, endedAt: _endedAt_0, payload: $withText(_payload_0, _delta_0) }, tail: { $: "Nil" } };
    } else {
      const _startedAt_1 = _h_0["startedAt"];
      const _endedAt_1 = _h_0["endedAt"];
      const _payload_1 = _h_0["payload"];
      return { $: "Con", head: { $: "Step", id: _id_0, status: { $: "Status.Running" }, kind: _t_1, startedAt: _startedAt_1, endedAt: _endedAt_1, payload: _payload_1 }, tail: { $: "Con", head: $newThinking($thinkId(_n_0), _now_0, _delta_0), tail: { $: "Nil" } } };
    }
  } else {
    const _kind_0 = _h_0["kind"];
    const _startedAt_2 = _h_0["startedAt"];
    const _endedAt_2 = _h_0["endedAt"];
    const _payload_2 = _h_0["payload"];
    return { $: "Con", head: { $: "Step", id: _id_0, status: _t_0, kind: _kind_0, startedAt: _startedAt_2, endedAt: _endedAt_2, payload: _payload_2 }, tail: { $: "Con", head: $newThinking($thinkId(_n_0), _now_0, _delta_0), tail: { $: "Nil" } } };
  }
}
function $burst(_xs_0, _delta_0, _now_0, _n_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Con", head: $newThinking($thinkId(_n_0), _now_0, _delta_0), tail: { $: "Nil" } };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    if (_t_0.$ === "Nil") {
      return $burst_last(_h_0, _delta_0, _now_0, _n_0);
    } else {
      const __0 = _t_0["head"];
      const __1 = _t_0["tail"];
      return { $: "Con", head: _h_0, tail: $burst({ $: "Con", head: __0, tail: __1 }, _delta_0, _now_0, _n_0) };
    }
  }
}
function $thinkingDelta_go(_log_0, _delta_0, _now_0) {
  const _startedAt_0 = _log_0["startedAt"];
  const _endedAt_0 = _log_0["endedAt"];
  const _reason_0 = _log_0["reason"];
  const _text_0 = _log_0["text"];
  const _steps_0 = _log_0["steps"];
  const _n_0 = $List_length(_steps_0);
  return { $: "Log", startedAt: _startedAt_0, endedAt: _endedAt_0, reason: _reason_0, text: _text_0, steps: $burst(_steps_0, _delta_0, _now_0, _n_0) };
}
function $thinkingDelta_if(_log_0, _delta_0, _now_0, _empty_0) {
  if (_empty_0) {
    return _log_0;
  } else {
    return $thinkingDelta_go(_log_0, _delta_0, _now_0);
  }
}
function $thinkingDelta(_log_0, _delta_0, _now_0) {
  const _d_0 = _delta_0;
  return $thinkingDelta_if(_log_0, _d_0, _now_0, $String_is_empty(_d_0));
}
function $closeStep_running(_id_0, _kind_0, _startedAt_0, _endedAt_0, _payload_0, _now_0) {
  if (_kind_0.$ === "Thinking") {
    return { $: "Step", id: _id_0, status: { $: "Status.Done" }, kind: { $: "Thinking" }, startedAt: _startedAt_0, endedAt: _now_0, payload: _payload_0 };
  } else {
    return { $: "Step", id: _id_0, status: { $: "Status.Running" }, kind: _kind_0, startedAt: _startedAt_0, endedAt: _endedAt_0, payload: _payload_0 };
  }
}
function $closeStep_status(_id_0, _status_0, _kind_0, _startedAt_0, _endedAt_0, _payload_0, _now_0) {
  if (_status_0.$ === "Status.Running") {
    return $closeStep_running(_id_0, _kind_0, _startedAt_0, _endedAt_0, _payload_0, _now_0);
  } else {
    return { $: "Step", id: _id_0, status: _status_0, kind: _kind_0, startedAt: _startedAt_0, endedAt: _endedAt_0, payload: _payload_0 };
  }
}
function $closeStep(_s_0, _now_0) {
  const _id_0 = _s_0["id"];
  const _status_0 = _s_0["status"];
  const _kind_0 = _s_0["kind"];
  const _startedAt_0 = _s_0["startedAt"];
  const _endedAt_0 = _s_0["endedAt"];
  const _payload_0 = _s_0["payload"];
  return $closeStep_status(_id_0, _status_0, _kind_0, _startedAt_0, _endedAt_0, _payload_0, _now_0);
}
function $closeEach(_xs_0, _now_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return { $: "Con", head: $closeStep(_h_0, _now_0), tail: $closeEach(_t_0, _now_0) };
  }
}
function $closeThinking(_log_0, _now_0) {
  const _startedAt_0 = _log_0["startedAt"];
  const _endedAt_0 = _log_0["endedAt"];
  const _reason_0 = _log_0["reason"];
  const _text_0 = _log_0["text"];
  const _steps_0 = _log_0["steps"];
  return { $: "Log", startedAt: _startedAt_0, endedAt: _endedAt_0, reason: _reason_0, text: _text_0, steps: $closeEach(_steps_0, _now_0) };
}
function $finishStep_running(_id_0, _kind_0, _startedAt_0, _endedAt_0, _payload_0, _now_0) {
  if (_kind_0.$ === "Thinking") {
    return { $: "Step", id: _id_0, status: { $: "Status.Done" }, kind: { $: "Thinking" }, startedAt: _startedAt_0, endedAt: _now_0, payload: _payload_0 };
  } else {
    return { $: "Step", id: _id_0, status: { $: "Status.Stopped" }, kind: _kind_0, startedAt: _startedAt_0, endedAt: _now_0, payload: _payload_0 };
  }
}
function $finishStep_status(_id_0, _status_0, _kind_0, _startedAt_0, _endedAt_0, _payload_0, _now_0) {
  if (_status_0.$ === "Status.Running") {
    return $finishStep_running(_id_0, _kind_0, _startedAt_0, _endedAt_0, _payload_0, _now_0);
  } else {
    return { $: "Step", id: _id_0, status: _status_0, kind: _kind_0, startedAt: _startedAt_0, endedAt: _endedAt_0, payload: _payload_0 };
  }
}
function $finishStep(_s_0, _now_0) {
  const _id_0 = _s_0["id"];
  const _status_0 = _s_0["status"];
  const _kind_0 = _s_0["kind"];
  const _startedAt_0 = _s_0["startedAt"];
  const _endedAt_0 = _s_0["endedAt"];
  const _payload_0 = _s_0["payload"];
  return $finishStep_status(_id_0, _status_0, _kind_0, _startedAt_0, _endedAt_0, _payload_0, _now_0);
}
function $finishEach(_xs_0, _now_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return { $: "Con", head: $finishStep(_h_0, _now_0), tail: $finishEach(_t_0, _now_0) };
  }
}
function $finishLog(_log_0, _now_0, _reason_0) {
  const _startedAt_0 = _log_0["startedAt"];
  const _text_0 = _log_0["text"];
  const _steps_0 = _log_0["steps"];
  const _n_0 = _now_0;
  return { $: "Log", startedAt: _startedAt_0, endedAt: _n_0, reason: _reason_0, text: _text_0, steps: $finishEach(_steps_0, _n_0) };
}
function $isRunningThinking_kind(_kind_0) {
  if (_kind_0.$ === "Thinking") {
    return true;
  } else {
    return false;
  }
}
function $isRunningThinking_check(_kind_0, _status_0) {
  if (_status_0.$ === "Status.Running") {
    return $isRunningThinking_kind(_kind_0);
  } else {
    return false;
  }
}
function $isRunningThinking(_s_0) {
  const _status_0 = _s_0["status"];
  const _kind_0 = _s_0["kind"];
  return $isRunningThinking_check(_kind_0, _status_0);
}
function $isRunning_status(_status_0) {
  if (_status_0.$ === "Status.Running") {
    return true;
  } else {
    return false;
  }
}
function $isRunning(_s_0) {
  const _status_0 = _s_0["status"];
  return $isRunning_status(_status_0);
}
function $noRunningThinking_and(_running_0, _rest_0) {
  if (_running_0) {
    return false;
  } else {
    return _rest_0;
  }
}
function $noRunningThinking(_xs_0) {
  if (_xs_0.$ === "Nil") {
    return true;
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return $noRunningThinking_and($isRunningThinking(_h_0), $noRunningThinking(_t_0));
  }
}
function $Nat_show(_n_0) {
  const _m_0 = _n_0;
  return $Nat_show_fin(_m_0, "", $Nat_show_put(nat_divmod(_m_0, 10)));
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
function $String_is_empty(_s_0) {
  if (_s_0 === "") {
    return true;
  } else {
    return false;
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
function $List_length(_xs_0) {
  if (_xs_0.$ === "Nil") {
    return 0;
  } else {
    const _t_0 = _xs_0["tail"];
    return nat_chk($List_length(_t_0) + 1);
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
function $Bool_and(_a_0, _b_0) {
  if (!_a_0) {
    return false;
  } else {
    return _b_0;
  }
}
var worklog_default = {
  emptyPayload: run_lib(() => run_loop($emptyPayload()), 0),
  withText: run_lib((a0, a1) => run_loop($withText(a0, str_in(a1))), 2),
  newThinking: run_lib((a0, a1, a2) => run_loop($newThinking(str_in(a0), nat_in(a1), str_in(a2))), 3),
  thinkId: run_lib((a0) => str_out(run_loop($thinkId(nat_in(a0)))), 1),
  headHere: run_lib((a0, a1) => run_loop($headHere(str_in(a0), str_in(a1))), 2),
  "hasNeedle.go": run_lib((a0, a1, a2) => run_loop($hasNeedle_go(str_in(a0), a1, str_in(a2))), 3),
  hasNeedle: run_lib((a0, a1) => run_loop($hasNeedle(str_in(a0), str_in(a1))), 2),
  "toLower.go": run_lib((a0, a1) => str_out(run_loop($toLower_go(str_in(a0), str_in(a1)))), 2),
  toLower: run_lib((a0) => str_out(run_loop($toLower(str_in(a0)))), 1),
  "anyContains.go": run_lib((a0, a1, a2) => run_loop($anyContains_go(str_in(a0), a1, a2)), 3),
  anyContains: run_lib((a0, a1) => run_loop($anyContains(str_in(a0), a1)), 2),
  "toolKind.fetch.if": run_lib((a0, a1) => run_loop($toolKind_fetch_if(str_in(a0), a1)), 2),
  "toolKind.fetch": run_lib((a0) => run_loop($toolKind_fetch(str_in(a0))), 1),
  "toolKind.search.if": run_lib((a0, a1) => run_loop($toolKind_search_if(str_in(a0), a1)), 2),
  "toolKind.search": run_lib((a0) => run_loop($toolKind_search(str_in(a0))), 1),
  "toolKind.ref": run_lib((a0, a1) => run_loop($toolKind_ref(str_in(a0), a1)), 2),
  toolKind: run_lib((a0) => run_loop($toolKind(str_in(a0))), 1),
  createLog: run_lib((a0) => run_loop($createLog(nat_in(a0))), 1),
  "burst.last": run_lib((a0, a1, a2, a3) => run_loop($burst_last(a0, str_in(a1), nat_in(a2), nat_in(a3))), 4),
  burst: run_lib((a0, a1, a2, a3) => run_loop($burst(a0, str_in(a1), nat_in(a2), nat_in(a3))), 4),
  "thinkingDelta.go": run_lib((a0, a1, a2) => run_loop($thinkingDelta_go(a0, str_in(a1), nat_in(a2))), 3),
  "thinkingDelta.if": run_lib((a0, a1, a2, a3) => run_loop($thinkingDelta_if(a0, str_in(a1), nat_in(a2), a3)), 4),
  thinkingDelta: run_lib((a0, a1, a2) => run_loop($thinkingDelta(a0, str_in(a1), nat_in(a2))), 3),
  "closeStep.running": run_lib((a0, a1, a2, a3, a4, a5) => run_loop($closeStep_running(str_in(a0), a1, nat_in(a2), nat_in(a3), a4, nat_in(a5))), 6),
  "closeStep.status": run_lib((a0, a1, a2, a3, a4, a5, a6) => run_loop($closeStep_status(str_in(a0), a1, a2, nat_in(a3), nat_in(a4), a5, nat_in(a6))), 7),
  closeStep: run_lib((a0, a1) => run_loop($closeStep(a0, nat_in(a1))), 2),
  closeEach: run_lib((a0, a1) => run_loop($closeEach(a0, nat_in(a1))), 2),
  closeThinking: run_lib((a0, a1) => run_loop($closeThinking(a0, nat_in(a1))), 2),
  "finishStep.running": run_lib((a0, a1, a2, a3, a4, a5) => run_loop($finishStep_running(str_in(a0), a1, nat_in(a2), nat_in(a3), a4, nat_in(a5))), 6),
  "finishStep.status": run_lib((a0, a1, a2, a3, a4, a5, a6) => run_loop($finishStep_status(str_in(a0), a1, a2, nat_in(a3), nat_in(a4), a5, nat_in(a6))), 7),
  finishStep: run_lib((a0, a1) => run_loop($finishStep(a0, nat_in(a1))), 2),
  finishEach: run_lib((a0, a1) => run_loop($finishEach(a0, nat_in(a1))), 2),
  finishLog: run_lib((a0, a1, a2) => run_loop($finishLog(a0, nat_in(a1), str_in(a2))), 3),
  "isRunningThinking.kind": run_lib((a0) => run_loop($isRunningThinking_kind(a0)), 1),
  "isRunningThinking.check": run_lib((a0, a1) => run_loop($isRunningThinking_check(a0, a1)), 2),
  isRunningThinking: run_lib((a0) => run_loop($isRunningThinking(a0)), 1),
  "isRunning.status": run_lib((a0) => run_loop($isRunning_status(a0)), 1),
  isRunning: run_lib((a0) => run_loop($isRunning(a0)), 1),
  "noRunningThinking.and": run_lib((a0, a1) => run_loop($noRunningThinking_and(a0, a1)), 2),
  noRunningThinking: run_lib((a0) => run_loop($noRunningThinking(a0)), 1)
};
export {
  worklog_default as default
};

// GERADO de core/sessions.bend por `bun core/build.mjs` — não editar à mão.
// core/sessions.bend
function nat_divmod(a, b) {
  return b === 0n ? { $: "Tuple", fst: 0n, snd: a } : { $: "Tuple", fst: a / b, snd: a % b };
}
function nat_chk(n) {
  if (n > 281474976710655n) {
    throw "bend: a Nat past the largest immediate 2^48-1";
  }
  return n;
}
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
function $previewCap$() {
  return 48n;
}
function $noteCap$() {
  return 40n;
}
function $jsonlLen$() {
  return 6n;
}
function $conferirLen$() {
  return 9n;
}
function $novaLabel$() {
  return "Nova conversa";
}
function $conversaLabel$() {
  return "Conversa";
}
function $conferirLabel$() {
  return "Conferir Xournal++";
}
function $conferirCmd$() {
  return "/conferir";
}
function $noteSep$() {
  return " · ";
}
function $mesaSuffix$() {
  return { $: "Con", ["head"]: "[Da Conversa]", ["tail"]: { $: "Con", ["head"]: "[Contexto da Mesa]", ["tail"]: { $: "Con", ["head"]: "[Contexto da sessão na Mesa:", ["tail"]: { $: "Con", ["head"]: "[Referências abertas", ["tail"]: { $: "Con", ["head"]: "[Conferência visual", ["tail"]: { $: "Nil" } } } } } };
}
function $chatSuffix$() {
  return { $: "Con", ["head"]: "[Buscar na web]", ["tail"]: { $: "Con", ["head"]: "[Anexo: ", ["tail"]: { $: "Nil" } } };
}
function $mesaCuts$() {
  return { $: "PreviewCuts", ["suffix"]: run_loop($mesaSuffix$()), ["conferir"]: true };
}
function $chatCuts$() {
  return { $: "PreviewCuts", ["suffix"]: run_loop($chatSuffix$()), ["conferir"]: false };
}
function $charStr$(_c_0) {
  return _c_0 + "";
}
function $isWord$(_c_0) {
  const _x_0 = run_loop($Char$is_digit$(_c_0));
  const _x_1 = run_loop($Char$is_eq$(_c_0, "_"));
  const _x_2 = run_loop($Char$is_alpha$(_c_0));
  const _x_3 = _x_0 || _x_1;
  return _x_2 || _x_3;
}
function $headSpace$(_s_0) {
  if (_s_0 === "") {
    return false;
  } else {
    const _h_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(0, 2) : _s_0[0];
    const _t_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(2) : _s_0.slice(1);
    return run_jump($Char$is_space$, [_h_0]);
  }
}
function $collapse$go$(_s_0, _space_0, _inSpace_0, _acc_0) {
  if (_s_0 === "") {
    return _acc_0;
  } else {
    const _h_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(0, 2) : _s_0[0];
    const _t_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(2) : _s_0.slice(1);
    if (!_space_0) {
      return run_jump($collapse$go$, [_t_0, run_loop($headSpace$(_t_0)), false, _h_0 + _acc_0]);
    } else {
      if (_inSpace_0) {
        return run_jump($collapse$go$, [_t_0, run_loop($headSpace$(_t_0)), true, _acc_0]);
      } else {
        return run_jump($collapse$go$, [_t_0, run_loop($headSpace$(_t_0)), true, " " + _acc_0]);
      }
    }
  }
}
function $collapseSpaces$(_s_0) {
  return run_jump($String$reverse$, [run_loop($collapse$go$(_s_0, run_loop($headSpace$(_s_0)), false, ""))]);
}
function $cleanText$(_s_0) {
  return run_jump($String$trim$, [run_loop($collapseSpaces$(_s_0))]);
}
function $headStarts$(_s_0, _needle_0) {
  if (_s_0 === "") {
    return false;
  } else {
    const _h_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(0, 2) : _s_0[0];
    const _t_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(2) : _s_0.slice(1);
    return run_jump($String$starts_with$, [_h_0 + _t_0, _needle_0]);
  }
}
function $cutFrom$go$(_s_0, _here_0, _needle_0, _acc_0) {
  if (_s_0 === "") {
    return run_jump($String$reverse$, [_acc_0]);
  } else {
    const _h_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(0, 2) : _s_0[0];
    const _t_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(2) : _s_0.slice(1);
    if (_here_0) {
      return run_jump($String$reverse$, [_acc_0]);
    } else {
      return run_jump($cutFrom$go$, [_t_0, run_loop($headStarts$(_t_0, _needle_0)), _needle_0, _h_0 + _acc_0]);
    }
  }
}
function $cutFrom$(_s_0, _needle_0) {
  return run_jump($cutFrom$go$, [_s_0, run_loop($headStarts$(_s_0, _needle_0)), _needle_0, ""]);
}
function $cutOne$(_s_0, _marker_0) {
  return run_jump($cutFrom$, [_s_0, `

` + _marker_0]);
}
function $cutSuffixes$(_markers_0, _s_0) {
  if (_markers_0.$ === "Nil") {
    return _s_0;
  } else {
    const _h_0 = _markers_0["head"];
    const _t_0 = _markers_0["tail"];
    return run_jump($cutSuffixes$, [_t_0, run_loop($cutOne$(_s_0, _h_0))]);
  }
}
function $isConferir$rest$(_rest_0) {
  if (_rest_0 === "") {
    return true;
  } else {
    const _h_0 = _rest_0.codePointAt(0) > 65535 ? _rest_0.slice(0, 2) : _rest_0[0];
    const _t_0 = _rest_0.codePointAt(0) > 65535 ? _rest_0.slice(2) : _rest_0.slice(1);
    return run_jump($Bool$not$, [run_loop($isWord$(_h_0))]);
  }
}
function $isConferir$if$(_s_0, _starts_0) {
  if (!_starts_0) {
    return false;
  } else {
    return run_jump($isConferir$rest$, [run_loop($String$drop$(_s_0, run_loop($conferirLen$())))]);
  }
}
function $isConferir$(_s_0) {
  return run_jump($isConferir$if$, [_s_0, run_loop($String$starts_with$(_s_0, run_loop($conferirCmd$())))]);
}
function $rewriteConferir$hit$(_t_0, _hit_0) {
  if (_hit_0) {
    return run_jump($conferirLabel$, []);
  } else {
    return _t_0;
  }
}
function $rewriteConferir$on$(_text_0) {
  const _t_0 = run_loop($String$trim$(_text_0));
  return run_jump($rewriteConferir$hit$, [_t_0, run_loop($isConferir$(_t_0))]);
}
function $rewriteConferir$(_text_0, _on_0) {
  if (!_on_0) {
    return _text_0;
  } else {
    return run_jump($rewriteConferir$on$, [_text_0]);
  }
}
function $applyCuts$(_text_0, _cuts_0) {
  const _suffix_0 = _cuts_0["suffix"];
  const _conferir_0 = _cuts_0["conferir"];
  return run_jump($rewriteConferir$, [run_loop($cutSuffixes$(_suffix_0, _text_0)), _conferir_0]);
}
function $contentText$(_body_0) {
  if (_body_0.$ === "BodyString") {
    const _text_0 = _body_0["text"];
    return _text_0;
  } else if (_body_0.$ === "BodyParts") {
    const _parts_0 = _body_0["parts"];
    return run_jump($String$join$, [_parts_0, " "]);
  } else {
    const _text_1 = _body_0["text"];
    return _text_1;
  }
}
function $preview$try$empty$(_cleaned_0, _empty_0) {
  if (_empty_0) {
    return { $: "None" };
  } else {
    return { $: "Some", ["value"]: run_loop($String$take$(_cleaned_0, run_loop($previewCap$()))) };
  }
}
function $preview$try$clean$(_cleaned_0) {
  return run_jump($preview$try$empty$, [_cleaned_0, run_loop($String$is_empty$(_cleaned_0))]);
}
function $preview$try$user$(_text_0, _cuts_0) {
  return run_jump($preview$try$clean$, [run_loop($cleanText$(run_loop($applyCuts$(_text_0, _cuts_0))))]);
}
function $preview$try$role$(_isUser_0, _text_0, _cuts_0) {
  if (!_isUser_0) {
    return { $: "None" };
  } else {
    return run_jump($preview$try$user$, [_text_0, _cuts_0]);
  }
}
function $preview$try$(_h_0, _cuts_0) {
  const _isUser_0 = _h_0["isUser"];
  const _body_0 = _h_0["body"];
  return run_jump($preview$try$role$, [_isUser_0, run_loop($contentText$(_body_0)), _cuts_0]);
}
function $preview$step$(_found_0, _h_0, _cuts_0) {
  if (_found_0.$ === "Some") {
    const _v_0 = _found_0["value"];
    return { $: "Some", ["value"]: _v_0 };
  } else {
    return run_jump($preview$try$, [_h_0, _cuts_0]);
  }
}
function $preview$go$(_msgs_0, _cuts_0, _found_0) {
  if (_msgs_0.$ === "Nil") {
    return _found_0;
  } else {
    const _h_0 = _msgs_0["head"];
    const _t_0 = _msgs_0["tail"];
    return run_jump($preview$go$, [_t_0, _cuts_0, run_loop($preview$step$(_found_0, _h_0, _cuts_0))]);
  }
}
function $preview$fin$(_m_0) {
  if (_m_0.$ === "None") {
    return "";
  } else {
    const _s_0 = _m_0["value"];
    return _s_0;
  }
}
function $sessionPreview$(_msgs_0, _cuts_0) {
  return run_jump($preview$fin$, [run_loop($preview$go$(_msgs_0, _cuts_0, { $: "None" }))]);
}
function $headDigit$(_s_0) {
  if (_s_0 === "") {
    return false;
  } else {
    const _h_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(0, 2) : _s_0[0];
    const _t_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(2) : _s_0.slice(1);
    return run_jump($Char$is_digit$, [_h_0]);
  }
}
function $takeTrail$go$(_s_0, _d_0, _prefix_0, _digits_0) {
  if (_s_0 === "") {
    return { $: "Tuple", ["fst"]: _prefix_0, ["snd"]: _digits_0 };
  } else {
    const _h_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(0, 2) : _s_0[0];
    const _t_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(2) : _s_0.slice(1);
    if (_d_0) {
      const _x_0 = run_loop($charStr$(_h_0));
      return run_jump($takeTrail$go$, [_t_0, run_loop($headDigit$(_t_0)), _prefix_0, _digits_0 + _x_0]);
    } else {
      const _x_1 = run_loop($charStr$(_h_0));
      const _x_2 = _digits_0 + _x_1;
      return run_jump($takeTrail$go$, [_t_0, run_loop($headDigit$(_t_0)), _prefix_0 + _x_2, ""]);
    }
  }
}
function $takeTrail$(_s_0) {
  return run_jump($takeTrail$go$, [_s_0, run_loop($headDigit$(_s_0)), "", ""]);
}
function $stripJsonl$(_path_0) {
  return run_jump($String$reverse$, [run_loop($String$drop$(run_loop($String$reverse$(_path_0)), run_loop($jsonlLen$())))]);
}
function $digitVal$(_c_0) {
  const _x_0 = run_loop($Char$to_u32$(_c_0));
  const _x_1 = BigInt(_x_0);
  return _x_1 < 48n ? 0n : _x_1 - 48n;
}
function $readDigits$(_s_0, _acc_0) {
  if (_s_0 === "") {
    return _acc_0;
  } else {
    const _h_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(0, 2) : _s_0[0];
    const _t_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(2) : _s_0.slice(1);
    const _x_0 = nat_chk(_acc_0 * 10n);
    const _x_1 = run_loop($digitVal$(_h_0));
    return run_jump($readDigits$, [_t_0, nat_chk(_x_0 + _x_1)]);
  }
}
function $started$val$(_digits_0, _empty_0) {
  if (_empty_0) {
    return 0n;
  } else {
    return run_jump($readDigits$, [_digits_0, 0n]);
  }
}
function $started$pi$(_digits_0, _ok_0) {
  if (!_ok_0) {
    return 0n;
  } else {
    return run_jump($started$val$, [_digits_0, run_loop($String$is_empty$(_digits_0))]);
  }
}
function $started$from$(_pd_0) {
  const _prefix_0 = _pd_0["fst"];
  const _digits_0 = _pd_0["snd"];
  return run_jump($started$pi$, [_digits_0, run_loop($String$ends_with$(_prefix_0, "pi-"))]);
}
function $started$digits$(_s_0) {
  return run_jump($started$from$, [run_loop($takeTrail$(_s_0))]);
}
function $started$if$(_path_0, _jsonl_0) {
  if (!_jsonl_0) {
    return 0n;
  } else {
    return run_jump($started$digits$, [run_loop($stripJsonl$(_path_0))]);
  }
}
function $sessionStartedFromPath$(_path_0) {
  return run_jump($started$if$, [_path_0, run_loop($String$ends_with$(_path_0, ".jsonl"))]);
}
function $pad2$if$(_n_0, _small_0) {
  if (_small_0) {
    const _x_0 = run_loop($Nat$show$(_n_0));
    return "0" + _x_0;
  } else {
    return run_jump($Nat$show$, [_n_0]);
  }
}
function $pad2$(_n_0) {
  return run_jump($pad2$if$, [_n_0, _n_0 < 10n]);
}
function $formatDate$(_day_0, _month_0, _hour_0, _minute_0) {
  const _x_0 = run_loop($pad2$(_minute_0));
  const _x_1 = run_loop($pad2$(_hour_0));
  const _x_2 = ":" + _x_0;
  const _x_3 = _x_1 + _x_2;
  const _x_4 = run_loop($pad2$(_month_0));
  const _x_5 = ", " + _x_3;
  const _x_6 = _x_4 + _x_5;
  const _x_7 = run_loop($pad2$(_day_0));
  const _x_8 = "/" + _x_6;
  return _x_7 + _x_8;
}
function $formatWhen$(_valid_0, _day_0, _month_0, _hour_0, _minute_0) {
  if (!_valid_0) {
    return run_jump($conversaLabel$, []);
  } else {
    return run_jump($formatDate$, [_day_0, _month_0, _hour_0, _minute_0]);
  }
}
function $formatLabel$withNote$(_note_0, _valid_0, _day_0, _month_0, _hour_0, _minute_0) {
  const _x_0 = run_loop($noteSep$());
  const _x_1 = run_loop($String$take$(_note_0, run_loop($noteCap$())));
  const _x_2 = run_loop($formatWhen$(_valid_0, _day_0, _month_0, _hour_0, _minute_0));
  const _x_3 = _x_0 + _x_1;
  return _x_2 + _x_3;
}
function $formatLabel$empty$(_nova_0, _valid_0, _day_0, _month_0, _hour_0, _minute_0) {
  if (_nova_0) {
    return run_jump($novaLabel$, []);
  } else {
    return run_jump($formatWhen$, [_valid_0, _day_0, _month_0, _hour_0, _minute_0]);
  }
}
function $formatLabel$note$if$(_note_0, _noNote_0, _nova_0, _valid_0, _day_0, _month_0, _hour_0, _minute_0) {
  if (_noNote_0) {
    return run_jump($formatLabel$empty$, [_nova_0, _valid_0, _day_0, _month_0, _hour_0, _minute_0]);
  } else {
    return run_jump($formatLabel$withNote$, [_note_0, _valid_0, _day_0, _month_0, _hour_0, _minute_0]);
  }
}
function $formatLabel$note$(_preview_0, _nova_0, _valid_0, _day_0, _month_0, _hour_0, _minute_0) {
  const _note_0 = run_loop($cleanText$(_preview_0));
  return run_jump($formatLabel$note$if$, [_note_0, run_loop($String$is_empty$(_note_0)), _nova_0, _valid_0, _day_0, _month_0, _hour_0, _minute_0]);
}
function $formatLabel$title$if$(_title_0, _empty_0, _preview_0, _nova_0, _valid_0, _day_0, _month_0, _hour_0, _minute_0) {
  if (!_empty_0) {
    return _title_0;
  } else {
    return run_jump($formatLabel$note$, [_preview_0, _nova_0, _valid_0, _day_0, _month_0, _hour_0, _minute_0]);
  }
}
function $formatSessionLabel$(_title_0, _preview_0, _nova_0, _valid_0, _day_0, _month_0, _hour_0, _minute_0) {
  const _t_0 = run_loop($String$trim$(_title_0));
  return run_jump($formatLabel$title$if$, [_t_0, run_loop($String$is_empty$(_t_0)), _preview_0, _nova_0, _valid_0, _day_0, _month_0, _hour_0, _minute_0]);
}
function $groupOf$yest$(_isYesterday_0) {
  if (_isYesterday_0) {
    return { $: "GroupYesterday" };
  } else {
    return { $: "GroupOlder" };
  }
}
function $groupOf$(_isToday_0, _isYesterday_0) {
  if (_isToday_0) {
    return { $: "GroupToday" };
  } else {
    return run_jump($groupOf$yest$, [_isYesterday_0]);
  }
}
function $groupLabel$(_g_0) {
  if (_g_0.$ === "GroupToday") {
    return "Hoje";
  } else if (_g_0.$ === "GroupYesterday") {
    return "Ontem";
  } else {
    return "Anteriores";
  }
}
function $group$push$at$(_today_0, _yesterday_0, _older_0, _item_0, _g_0) {
  if (_g_0.$ === "GroupToday") {
    return { $: "SessAcc", ["today"]: run_loop($List$append$(_today_0, { $: "Con", ["head"]: _item_0, ["tail"]: { $: "Nil" } })), ["yesterday"]: _yesterday_0, ["older"]: _older_0 };
  } else if (_g_0.$ === "GroupYesterday") {
    return { $: "SessAcc", ["today"]: _today_0, ["yesterday"]: run_loop($List$append$(_yesterday_0, { $: "Con", ["head"]: _item_0, ["tail"]: { $: "Nil" } })), ["older"]: _older_0 };
  } else {
    return { $: "SessAcc", ["today"]: _today_0, ["yesterday"]: _yesterday_0, ["older"]: run_loop($List$append$(_older_0, { $: "Con", ["head"]: _item_0, ["tail"]: { $: "Nil" } })) };
  }
}
function $group$push$(_acc_0, _item_0, _g_0) {
  const _today_0 = _acc_0["today"];
  const _yesterday_0 = _acc_0["yesterday"];
  const _older_0 = _acc_0["older"];
  return run_jump($group$push$at$, [_today_0, _yesterday_0, _older_0, _item_0, _g_0]);
}
function $group$go$(_items_0, _todayF_0, _yestF_0, _acc_0) {
  if (_items_0.$ === "Nil") {
    return _acc_0;
  } else {
    const _h_0 = _items_0["head"];
    const _t_0 = _items_0["tail"];
    if (_todayF_0.$ === "Nil") {
      return _acc_0;
    } else {
      const _td_0 = _todayF_0["head"];
      const _tds_0 = _todayF_0["tail"];
      if (_yestF_0.$ === "Nil") {
        return _acc_0;
      } else {
        const _yd_0 = _yestF_0["head"];
        const _yds_0 = _yestF_0["tail"];
        return run_jump($group$go$, [_t_0, _tds_0, _yds_0, run_loop($group$push$(_acc_0, _h_0, run_loop($groupOf$(_td_0, _yd_0))))]);
      }
    }
  }
}
function $keepBucket$if$(_g_0, _items_0, _rest_0, _empty_0) {
  if (_empty_0) {
    return _rest_0;
  } else {
    return { $: "Con", ["head"]: { $: "SessionBucket", ["group"]: _g_0, ["label"]: run_loop($groupLabel$(_g_0)), ["items"]: _items_0 }, ["tail"]: _rest_0 };
  }
}
function $keepBucket$(_g_0, _items_0, _rest_0) {
  return run_jump($keepBucket$if$, [_g_0, _items_0, _rest_0, run_loop($List$is_empty$(_items_0))]);
}
function $group$finish$(_acc_0) {
  const _today_0 = _acc_0["today"];
  const _yesterday_0 = _acc_0["yesterday"];
  const _older_0 = _acc_0["older"];
  return run_jump($keepBucket$, [{ $: "GroupToday" }, _today_0, run_loop($keepBucket$({ $: "GroupYesterday" }, _yesterday_0, run_loop($keepBucket$({ $: "GroupOlder" }, _older_0, { $: "Nil" }))))]);
}
function $groupSessions$(_items_0, _todayF_0, _yestF_0) {
  return run_jump($group$finish$, [run_loop($group$go$(_items_0, _todayF_0, _yestF_0, { $: "SessAcc", ["today"]: { $: "Nil" }, ["yesterday"]: { $: "Nil" }, ["older"]: { $: "Nil" } }))]);
}
function $Char$is_alpha$(_c_0) {
  const _x_0 = run_loop($Char$is_upper$(_c_0));
  const _x_1 = run_loop($Char$is_lower$(_c_0));
  return _x_0 || _x_1;
}
function $Char$is_digit$(_c_0) {
  const _x_0 = _c_0.codePointAt(0);
  return run_jump($Bool$and$, [_x_0 >= 48, _x_0 <= 57]);
}
function $Char$is_eq$(_a_0, _b_0) {
  const _x_0 = _a_0.codePointAt(0);
  const _y_0 = _b_0.codePointAt(0);
  return _x_0 === _y_0;
}
function $Char$is_space$(_c_0) {
  const _x_0 = _c_0.codePointAt(0);
  const _x_1 = _x_0 === 32;
  const _x_2 = run_loop($Bool$and$(_x_0 >= 9, _x_0 <= 13));
  return _x_1 || _x_2;
}
function $String$reverse$(_s_0) {
  return run_jump($String$reverse$go$, [_s_0, ""]);
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
function $Bool$not$(_b_0) {
  if (!_b_0) {
    return true;
  } else {
    return false;
  }
}
function $String$drop$(_s_0, _n_0) {
  if (_s_0 === "") {
    return "";
  } else {
    const _h_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(0, 2) : _s_0[0];
    const _t_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(2) : _s_0.slice(1);
    if (_n_0 === 0n) {
      return _h_0 + _t_0;
    } else {
      const _p_0 = _n_0 - 1n;
      return run_jump($String$drop$, [_t_0, _p_0]);
    }
  }
}
function $String$join$(_xs_0, _sep_0) {
  if (_xs_0.$ === "Nil") {
    return "";
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return run_jump($String$join$go$, [_t_0, _h_0, _sep_0]);
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
function $String$is_empty$(_s_0) {
  if (_s_0 === "") {
    return true;
  } else {
    const _h_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(0, 2) : _s_0[0];
    const _t_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(2) : _s_0.slice(1);
    return false;
  }
}
function $Char$to_u32$(_c_0) {
  const _x_0 = _c_0.codePointAt(0);
  return _x_0;
}
function $String$ends_with$(_s_0, _p_0) {
  return run_jump($String$starts_with$, [run_loop($String$reverse$(_s_0)), run_loop($String$reverse$(_p_0))]);
}
function $Nat$show$(_n_0) {
  const _m_0 = _n_0;
  return run_jump($Nat$show$fin$, [_m_0, "", run_loop($Nat$show$put$(nat_divmod(_m_0, 10n)))]);
}
function $List$append$(_xs_0, _ys_0) {
  if (_xs_0.$ === "Nil") {
    return _ys_0;
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return { $: "Con", ["head"]: _h_0, ["tail"]: run_loop($List$append$(_t_0, _ys_0)) };
  }
}
function $List$is_empty$(_xs_0) {
  if (_xs_0.$ === "Nil") {
    return true;
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return false;
  }
}
function $Char$is_upper$(_c_0) {
  const _x_0 = _c_0.codePointAt(0);
  return run_jump($Bool$and$, [_x_0 >= 65, _x_0 <= 90]);
}
function $Char$is_lower$(_c_0) {
  const _x_0 = _c_0.codePointAt(0);
  return run_jump($Bool$and$, [_x_0 >= 97, _x_0 <= 122]);
}
function $Bool$and$(_a_0, _b_0) {
  if (!_a_0) {
    return false;
  } else {
    return _b_0;
  }
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
function $String$join$go$(_xs_0, _h_0, _sep_0) {
  if (_xs_0.$ === "Nil") {
    return _h_0;
  } else {
    const _h2_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    const _x_0 = run_loop($String$join$go$(_t_0, _h2_0, _sep_0));
    const _x_1 = _sep_0 + _x_0;
    return _h_0 + _x_1;
  }
}
function $Nat$show$fin$(_g_0, _acc_0, _dq_0) {
  const _d_0 = _dq_0["fst"];
  const _t_0 = _dq_0["snd"];
  if (_t_0 === 0n) {
    return _d_0 + _acc_0;
  } else {
    const _p_0 = _t_0 - 1n;
    return run_jump($Nat$show$go$, [_g_0, nat_chk(_p_0 + 1n), _d_0 + _acc_0]);
  }
}
function $Nat$show$put$(_qr_0) {
  const _q_0 = _qr_0["fst"];
  const _r_0 = _qr_0["snd"];
  const _x_0 = nat_chk(48n + _r_0);
  return { $: "Tuple", ["fst"]: char_new(Number(_x_0 & 0xFFFFFFFFn)), ["snd"]: _q_0 };
}
function $String$trim_start$if$(_h_0, _t_0, _space_0) {
  if (!_space_0) {
    return _h_0 + _t_0;
  } else {
    return run_jump($String$trim_start$, [_t_0]);
  }
}
function $Nat$show$go$(_f_0, _n_0, _acc_0) {
  if (_f_0 === 0n) {
    return _acc_0;
  } else {
    const _g_0 = _f_0 - 1n;
    return run_jump($Nat$show$fin$, [_g_0, _acc_0, run_loop($Nat$show$put$(nat_divmod(_n_0, 10n)))]);
  }
}
var sessions_default = {
  previewCap: run_lib($previewCap$, 0),
  noteCap: run_lib($noteCap$, 0),
  jsonlLen: run_lib($jsonlLen$, 0),
  conferirLen: run_lib($conferirLen$, 0),
  novaLabel: run_lib($novaLabel$, 0),
  conversaLabel: run_lib($conversaLabel$, 0),
  conferirLabel: run_lib($conferirLabel$, 0),
  conferirCmd: run_lib($conferirCmd$, 0),
  noteSep: run_lib($noteSep$, 0),
  mesaSuffix: run_lib($mesaSuffix$, 0),
  chatSuffix: run_lib($chatSuffix$, 0),
  mesaCuts: run_lib($mesaCuts$, 0),
  chatCuts: run_lib($chatCuts$, 0),
  charStr: run_lib($charStr$, 1),
  isWord: run_lib($isWord$, 1),
  headSpace: run_lib($headSpace$, 1),
  "collapse.go": run_lib($collapse$go$, 4),
  collapseSpaces: run_lib($collapseSpaces$, 1),
  cleanText: run_lib($cleanText$, 1),
  headStarts: run_lib($headStarts$, 2),
  "cutFrom.go": run_lib($cutFrom$go$, 4),
  cutFrom: run_lib($cutFrom$, 2),
  cutOne: run_lib($cutOne$, 2),
  cutSuffixes: run_lib($cutSuffixes$, 2),
  "isConferir.rest": run_lib($isConferir$rest$, 1),
  "isConferir.if": run_lib($isConferir$if$, 2),
  isConferir: run_lib($isConferir$, 1),
  "rewriteConferir.hit": run_lib($rewriteConferir$hit$, 2),
  "rewriteConferir.on": run_lib($rewriteConferir$on$, 1),
  rewriteConferir: run_lib($rewriteConferir$, 2),
  applyCuts: run_lib($applyCuts$, 2),
  contentText: run_lib($contentText$, 1),
  "preview.try.empty": run_lib($preview$try$empty$, 2),
  "preview.try.clean": run_lib($preview$try$clean$, 1),
  "preview.try.user": run_lib($preview$try$user$, 2),
  "preview.try.role": run_lib($preview$try$role$, 3),
  "preview.try": run_lib($preview$try$, 2),
  "preview.step": run_lib($preview$step$, 3),
  "preview.go": run_lib($preview$go$, 3),
  "preview.fin": run_lib($preview$fin$, 1),
  sessionPreview: run_lib($sessionPreview$, 2),
  headDigit: run_lib($headDigit$, 1),
  "takeTrail.go": run_lib($takeTrail$go$, 4),
  takeTrail: run_lib($takeTrail$, 1),
  stripJsonl: run_lib($stripJsonl$, 1),
  digitVal: run_lib($digitVal$, 1),
  readDigits: run_lib($readDigits$, 2),
  "started.val": run_lib($started$val$, 2),
  "started.pi": run_lib($started$pi$, 2),
  "started.from": run_lib($started$from$, 1),
  "started.digits": run_lib($started$digits$, 1),
  "started.if": run_lib($started$if$, 2),
  sessionStartedFromPath: run_lib($sessionStartedFromPath$, 1),
  "pad2.if": run_lib($pad2$if$, 2),
  pad2: run_lib($pad2$, 1),
  formatDate: run_lib($formatDate$, 4),
  formatWhen: run_lib($formatWhen$, 5),
  "formatLabel.withNote": run_lib($formatLabel$withNote$, 6),
  "formatLabel.empty": run_lib($formatLabel$empty$, 6),
  "formatLabel.note.if": run_lib($formatLabel$note$if$, 8),
  "formatLabel.note": run_lib($formatLabel$note$, 7),
  "formatLabel.title.if": run_lib($formatLabel$title$if$, 9),
  formatSessionLabel: run_lib($formatSessionLabel$, 8),
  "groupOf.yest": run_lib($groupOf$yest$, 1),
  groupOf: run_lib($groupOf$, 2),
  groupLabel: run_lib($groupLabel$, 1),
  "group.push.at": run_lib($group$push$at$, 5),
  "group.push": run_lib($group$push$, 3),
  "group.go": run_lib($group$go$, 4),
  "keepBucket.if": run_lib($keepBucket$if$, 4),
  keepBucket: run_lib($keepBucket$, 3),
  "group.finish": run_lib($group$finish$, 1),
  groupSessions: run_lib($groupSessions$, 3)
};
export {
  sessions_default as default
};

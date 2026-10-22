// GERADO de core/sessions.bend por `bun core/build.mjs` — não editar à mão.
// core/sessions.bend
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
function $previewCap() {
  return 48;
}
function $noteCap() {
  return 40;
}
function $jsonlLen() {
  return 6;
}
function $conferirLen() {
  return 9;
}
function $novaLabel() {
  return "Nova conversa";
}
function $conversaLabel() {
  return "Conversa";
}
function $conferirLabel() {
  return "Conferir Xournal++";
}
function $conferirCmd() {
  return "/conferir";
}
function $noteSep() {
  return " · ";
}
function $mesaSuffix() {
  return { $: "Con", head: "[Da Conversa]", tail: { $: "Con", head: "[Contexto da Mesa]", tail: { $: "Con", head: "[Desk context]", tail: { $: "Con", head: "[Contexto da sessão na Mesa:", tail: { $: "Con", head: "[Referências abertas", tail: { $: "Con", head: "[Conferência visual", tail: { $: "Con", head: "[Ferramenta pedida na Mesa:", tail: { $: "Nil" } } } } } } } };
}
function $chatSuffix() {
  return { $: "Con", head: "[Buscar na web]", tail: { $: "Con", head: "[Anexo: ", tail: { $: "Nil" } } };
}
function $mesaCuts() {
  return { $: "PreviewCuts", suffix: $mesaSuffix(), conferir: true };
}
function $chatCuts() {
  return { $: "PreviewCuts", suffix: $chatSuffix(), conferir: false };
}
function $charStr(_c_0) {
  return _c_0 + "";
}
function $isWord(_c_0) {
  const _x_0 = $Char_is_digit(_c_0);
  const _x_1 = $Char_is_eq(_c_0, "_");
  const _x_2 = $Char_is_alpha(_c_0);
  const _x_3 = _x_0 || _x_1;
  return _x_2 || _x_3;
}
function $headSpace(_s_0) {
  if (_s_0 === "") {
    return false;
  } else {
    const _h_0 = _s_0.slice(0, char_len(_s_0));
    return $Char_is_space(_h_0);
  }
}
function $collapse_go($0, $1, $2, $3) {
  for (;; ) {
    {
      const _s_0 = $0;
      const _space_0 = $1;
      const _inSpace_0 = $2;
      const _acc_0 = $3;
      if (_s_0 === "") {
        return _acc_0;
      } else {
        const _h_0 = _s_0.slice(0, char_len(_s_0));
        const _t_0 = _s_0.slice(char_len(_s_0));
        if (!_space_0) {
          $0 = _t_0;
          $1 = $headSpace(_t_0);
          $2 = false;
          $3 = _h_0 + _acc_0;
          continue;
        } else {
          if (_inSpace_0) {
            $0 = _t_0;
            $1 = $headSpace(_t_0);
            $2 = true;
            $3 = _acc_0;
            continue;
          } else {
            $0 = _t_0;
            $1 = $headSpace(_t_0);
            $2 = true;
            $3 = " " + _acc_0;
            continue;
          }
        }
      }
    }
  }
}
function $collapseSpaces(_s_0) {
  return $String_reverse($collapse_go(_s_0, $headSpace(_s_0), false, ""));
}
function $cleanText(_s_0) {
  return $String_trim($collapseSpaces(_s_0));
}
function $headStarts(_s_0, _needle_0) {
  if (_s_0 === "") {
    return false;
  } else {
    const _h_0 = _s_0.slice(0, char_len(_s_0));
    const _t_0 = _s_0.slice(char_len(_s_0));
    return $String_starts_with(_h_0 + _t_0, _needle_0);
  }
}
function $cutFrom_go($0, $1, $2, $3) {
  for (;; ) {
    {
      const _s_0 = $0;
      const _here_0 = $1;
      const _needle_0 = $2;
      const _acc_0 = $3;
      if (_s_0 === "") {
        return $String_reverse(_acc_0);
      } else {
        const _h_0 = _s_0.slice(0, char_len(_s_0));
        const _t_0 = _s_0.slice(char_len(_s_0));
        if (_here_0) {
          return $String_reverse(_acc_0);
        } else {
          $0 = _t_0;
          $1 = $headStarts(_t_0, _needle_0);
          $2 = _needle_0;
          $3 = _h_0 + _acc_0;
          continue;
        }
      }
    }
  }
}
function $cutFrom(_s_0, _needle_0) {
  return $cutFrom_go(_s_0, $headStarts(_s_0, _needle_0), _needle_0, "");
}
function $cutOne(_s_0, _marker_0) {
  return $cutFrom(_s_0, `

` + _marker_0);
}
function $cutSuffixes($0, $1) {
  for (;; ) {
    {
      const _markers_0 = $0;
      const _s_0 = $1;
      if (_markers_0.$ === "Nil") {
        return _s_0;
      } else {
        const _h_0 = _markers_0["head"];
        const _t_0 = _markers_0["tail"];
        $0 = _t_0;
        $1 = $cutOne(_s_0, _h_0);
        continue;
      }
    }
  }
}
function $isConferir_rest(_rest_0) {
  if (_rest_0 === "") {
    return true;
  } else {
    const _h_0 = _rest_0.slice(0, char_len(_rest_0));
    return $Bool_not($isWord(_h_0));
  }
}
function $isConferir_if(_s_0, _starts_0) {
  if (!_starts_0) {
    return false;
  } else {
    return $isConferir_rest($String_drop(_s_0, $conferirLen()));
  }
}
function $isConferir(_s_0) {
  return $isConferir_if(_s_0, $String_starts_with(_s_0, $conferirCmd()));
}
function $rewriteConferir_hit(_t_0, _hit_0) {
  if (_hit_0) {
    return $conferirLabel();
  } else {
    return _t_0;
  }
}
function $rewriteConferir_on(_text_0) {
  const _t_0 = $String_trim(_text_0);
  return $rewriteConferir_hit(_t_0, $isConferir(_t_0));
}
function $rewriteConferir(_text_0, _on_0) {
  if (!_on_0) {
    return _text_0;
  } else {
    return $rewriteConferir_on(_text_0);
  }
}
function $applyCuts(_text_0, _cuts_0) {
  const _suffix_0 = _cuts_0["suffix"];
  const _conferir_0 = _cuts_0["conferir"];
  return $rewriteConferir($cutSuffixes(_suffix_0, _text_0), _conferir_0);
}
function $contentText(_body_0) {
  if (_body_0.$ === "BodyString") {
    const _text_0 = _body_0["text"];
    return _text_0;
  } else if (_body_0.$ === "BodyParts") {
    const _parts_0 = _body_0["parts"];
    return $String_join(_parts_0, " ");
  } else {
    const _text_1 = _body_0["text"];
    return _text_1;
  }
}
function $preview_try_empty(_cleaned_0, _empty_0) {
  if (_empty_0) {
    return { $: "None" };
  } else {
    return { $: "Some", value: $String_take(_cleaned_0, $previewCap()) };
  }
}
function $preview_try_clean(_cleaned_0) {
  return $preview_try_empty(_cleaned_0, $String_is_empty(_cleaned_0));
}
function $preview_try_user(_text_0, _cuts_0) {
  return $preview_try_clean($cleanText($applyCuts(_text_0, _cuts_0)));
}
function $preview_try_role(_isUser_0, _text_0, _cuts_0) {
  if (!_isUser_0) {
    return { $: "None" };
  } else {
    return $preview_try_user(_text_0, _cuts_0);
  }
}
function $preview_try(_h_0, _cuts_0) {
  const _isUser_0 = _h_0["isUser"];
  const _body_0 = _h_0["body"];
  return $preview_try_role(_isUser_0, $contentText(_body_0), _cuts_0);
}
function $preview_step(_found_0, _h_0, _cuts_0) {
  if (_found_0.$ === "Some") {
    const _v_0 = _found_0["value"];
    return { $: "Some", value: _v_0 };
  } else {
    return $preview_try(_h_0, _cuts_0);
  }
}
function $preview_go($0, $1, $2) {
  for (;; ) {
    {
      const _msgs_0 = $0;
      const _cuts_0 = $1;
      const _found_0 = $2;
      if (_msgs_0.$ === "Nil") {
        return _found_0;
      } else {
        const _h_0 = _msgs_0["head"];
        const _t_0 = _msgs_0["tail"];
        $0 = _t_0;
        $1 = _cuts_0;
        $2 = $preview_step(_found_0, _h_0, _cuts_0);
        continue;
      }
    }
  }
}
function $preview_fin(_m_0) {
  if (_m_0.$ === "None") {
    return "";
  } else {
    const _s_0 = _m_0["value"];
    return _s_0;
  }
}
function $sessionPreview(_msgs_0, _cuts_0) {
  return $preview_fin($preview_go(_msgs_0, _cuts_0, { $: "None" }));
}
function $headDigit(_s_0) {
  if (_s_0 === "") {
    return false;
  } else {
    const _h_0 = _s_0.slice(0, char_len(_s_0));
    return $Char_is_digit(_h_0);
  }
}
function $takeTrail_go($0, $1, $2, $3) {
  for (;; ) {
    {
      const _s_0 = $0;
      const _d_0 = $1;
      const _prefix_0 = $2;
      const _digits_0 = $3;
      if (_s_0 === "") {
        return { $: "Tuple", fst: _prefix_0, snd: _digits_0 };
      } else {
        const _h_0 = _s_0.slice(0, char_len(_s_0));
        const _t_0 = _s_0.slice(char_len(_s_0));
        if (_d_0) {
          const _x_0 = $charStr(_h_0);
          $0 = _t_0;
          $1 = $headDigit(_t_0);
          $2 = _prefix_0;
          $3 = _digits_0 + _x_0;
          continue;
        } else {
          const _x_1 = $charStr(_h_0);
          const _x_2 = _digits_0 + _x_1;
          $0 = _t_0;
          $1 = $headDigit(_t_0);
          $2 = _prefix_0 + _x_2;
          $3 = "";
          continue;
        }
      }
    }
  }
}
function $takeTrail(_s_0) {
  return $takeTrail_go(_s_0, $headDigit(_s_0), "", "");
}
function $stripJsonl(_path_0) {
  return $String_reverse($String_drop($String_reverse(_path_0), $jsonlLen()));
}
function $digitVal(_c_0) {
  const _x_0 = $Char_to_u32(_c_0);
  return _x_0 < 48 ? 0 : _x_0 - 48;
}
function $readDigits($0, $1) {
  for (;; ) {
    {
      const _s_0 = $0;
      const _acc_0 = $1;
      if (_s_0 === "") {
        return _acc_0;
      } else {
        const _h_0 = _s_0.slice(0, char_len(_s_0));
        const _t_0 = _s_0.slice(char_len(_s_0));
        const _x_0 = nat_chk(_acc_0 * 10);
        const _x_1 = $digitVal(_h_0);
        $0 = _t_0;
        $1 = nat_chk(_x_0 + _x_1);
        continue;
      }
    }
  }
}
function $started_val(_digits_0, _empty_0) {
  if (_empty_0) {
    return 0;
  } else {
    return $readDigits(_digits_0, 0);
  }
}
function $started_pi(_digits_0, _ok_0) {
  if (!_ok_0) {
    return 0;
  } else {
    return $started_val(_digits_0, $String_is_empty(_digits_0));
  }
}
function $started_from(_pd_0) {
  const _prefix_0 = _pd_0["fst"];
  const _digits_0 = _pd_0["snd"];
  return $started_pi(_digits_0, $String_ends_with(_prefix_0, "pi-"));
}
function $started_digits(_s_0) {
  return $started_from($takeTrail(_s_0));
}
function $started_if(_path_0, _jsonl_0) {
  if (!_jsonl_0) {
    return 0;
  } else {
    return $started_digits($stripJsonl(_path_0));
  }
}
function $sessionStartedFromPath(_path_0) {
  return $started_if(_path_0, $String_ends_with(_path_0, ".jsonl"));
}
function $pad2_if(_n_0, _small_0) {
  if (_small_0) {
    const _x_0 = $Nat_show(_n_0);
    return "0" + _x_0;
  } else {
    return $Nat_show(_n_0);
  }
}
function $pad2(_n_0) {
  return $pad2_if(_n_0, _n_0 < 10);
}
function $formatDate(_day_0, _month_0, _hour_0, _minute_0) {
  const _x_0 = $pad2(_minute_0);
  const _x_1 = $pad2(_hour_0);
  const _x_2 = ":" + _x_0;
  const _x_3 = _x_1 + _x_2;
  const _x_4 = $pad2(_month_0);
  const _x_5 = ", " + _x_3;
  const _x_6 = _x_4 + _x_5;
  const _x_7 = $pad2(_day_0);
  const _x_8 = "/" + _x_6;
  return _x_7 + _x_8;
}
function $formatWhen(_valid_0, _day_0, _month_0, _hour_0, _minute_0) {
  if (!_valid_0) {
    return $conversaLabel();
  } else {
    return $formatDate(_day_0, _month_0, _hour_0, _minute_0);
  }
}
function $formatLabel_withNote(_note_0, _valid_0, _day_0, _month_0, _hour_0, _minute_0) {
  const _x_0 = $noteSep();
  const _x_1 = $String_take(_note_0, $noteCap());
  const _x_2 = $formatWhen(_valid_0, _day_0, _month_0, _hour_0, _minute_0);
  const _x_3 = _x_0 + _x_1;
  return _x_2 + _x_3;
}
function $formatLabel_empty(_nova_0, _valid_0, _day_0, _month_0, _hour_0, _minute_0) {
  if (_nova_0) {
    return $novaLabel();
  } else {
    return $formatWhen(_valid_0, _day_0, _month_0, _hour_0, _minute_0);
  }
}
function $formatLabel_note_if(_note_0, _noNote_0, _nova_0, _valid_0, _day_0, _month_0, _hour_0, _minute_0) {
  if (_noNote_0) {
    return $formatLabel_empty(_nova_0, _valid_0, _day_0, _month_0, _hour_0, _minute_0);
  } else {
    return $formatLabel_withNote(_note_0, _valid_0, _day_0, _month_0, _hour_0, _minute_0);
  }
}
function $formatLabel_note(_preview_0, _nova_0, _valid_0, _day_0, _month_0, _hour_0, _minute_0) {
  const _note_0 = $cleanText(_preview_0);
  return $formatLabel_note_if(_note_0, $String_is_empty(_note_0), _nova_0, _valid_0, _day_0, _month_0, _hour_0, _minute_0);
}
function $formatLabel_title_if(_title_0, _empty_0, _preview_0, _nova_0, _valid_0, _day_0, _month_0, _hour_0, _minute_0) {
  if (!_empty_0) {
    return _title_0;
  } else {
    return $formatLabel_note(_preview_0, _nova_0, _valid_0, _day_0, _month_0, _hour_0, _minute_0);
  }
}
function $formatSessionLabel(_title_0, _preview_0, _nova_0, _valid_0, _day_0, _month_0, _hour_0, _minute_0) {
  const _t_0 = $String_trim(_title_0);
  return $formatLabel_title_if(_t_0, $String_is_empty(_t_0), _preview_0, _nova_0, _valid_0, _day_0, _month_0, _hour_0, _minute_0);
}
function $groupOf_yest(_isYesterday_0) {
  if (_isYesterday_0) {
    return { $: "GroupYesterday" };
  } else {
    return { $: "GroupOlder" };
  }
}
function $groupOf(_isToday_0, _isYesterday_0) {
  if (_isToday_0) {
    return { $: "GroupToday" };
  } else {
    return $groupOf_yest(_isYesterday_0);
  }
}
function $groupLabel(_g_0) {
  if (_g_0.$ === "GroupToday") {
    return "Hoje";
  } else if (_g_0.$ === "GroupYesterday") {
    return "Ontem";
  } else {
    return "Anteriores";
  }
}
function $group_push_at(_today_0, _yesterday_0, _older_0, _item_0, _g_0) {
  if (_g_0.$ === "GroupToday") {
    return { $: "SessAcc", today: $List_append(_today_0, { $: "Con", head: _item_0, tail: { $: "Nil" } }), yesterday: _yesterday_0, older: _older_0 };
  } else if (_g_0.$ === "GroupYesterday") {
    return { $: "SessAcc", today: _today_0, yesterday: $List_append(_yesterday_0, { $: "Con", head: _item_0, tail: { $: "Nil" } }), older: _older_0 };
  } else {
    return { $: "SessAcc", today: _today_0, yesterday: _yesterday_0, older: $List_append(_older_0, { $: "Con", head: _item_0, tail: { $: "Nil" } }) };
  }
}
function $group_push(_acc_0, _item_0, _g_0) {
  const _today_0 = _acc_0["today"];
  const _yesterday_0 = _acc_0["yesterday"];
  const _older_0 = _acc_0["older"];
  return $group_push_at(_today_0, _yesterday_0, _older_0, _item_0, _g_0);
}
function $group_go($0, $1, $2, $3) {
  for (;; ) {
    {
      const _items_0 = $0;
      const _todayF_0 = $1;
      const _yestF_0 = $2;
      const _acc_0 = $3;
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
            $0 = _t_0;
            $1 = _tds_0;
            $2 = _yds_0;
            $3 = $group_push(_acc_0, _h_0, $groupOf(_td_0, _yd_0));
            continue;
          }
        }
      }
    }
  }
}
function $keepBucket_if(_g_0, _items_0, _rest_0, _empty_0) {
  if (_empty_0) {
    return _rest_0;
  } else {
    return { $: "Con", head: { $: "SessionBucket", group: _g_0, label: $groupLabel(_g_0), items: _items_0 }, tail: _rest_0 };
  }
}
function $keepBucket(_g_0, _items_0, _rest_0) {
  return $keepBucket_if(_g_0, _items_0, _rest_0, $List_is_empty(_items_0));
}
function $group_finish(_acc_0) {
  const _today_0 = _acc_0["today"];
  const _yesterday_0 = _acc_0["yesterday"];
  const _older_0 = _acc_0["older"];
  return $keepBucket({ $: "GroupToday" }, _today_0, $keepBucket({ $: "GroupYesterday" }, _yesterday_0, $keepBucket({ $: "GroupOlder" }, _older_0, { $: "Nil" })));
}
function $groupSessions(_items_0, _todayF_0, _yestF_0) {
  return $group_finish($group_go(_items_0, _todayF_0, _yestF_0, { $: "SessAcc", today: { $: "Nil" }, yesterday: { $: "Nil" }, older: { $: "Nil" } }));
}
function $Char_is_alpha(_c_0) {
  const _x_0 = $Char_is_upper(_c_0);
  const _x_1 = $Char_is_lower(_c_0);
  return _x_0 || _x_1;
}
function $Char_is_digit(_c_0) {
  const _x_0 = char_code(_c_0);
  const _x_1 = char_code(_c_0);
  return $Bool_and(_x_0 >= 48, _x_1 <= 57);
}
function $Char_is_eq(_a_0, _b_0) {
  const _x_0 = char_code(_a_0);
  const _x_1 = char_code(_b_0);
  return _x_0 === _x_1;
}
function $Char_is_space(_c_0) {
  const _x_0 = char_code(_c_0);
  const _x_1 = char_code(_c_0);
  const _x_2 = char_code(_c_0);
  const _x_3 = _x_0 === 32;
  const _x_4 = $Bool_and(_x_1 >= 9, _x_2 <= 13);
  return _x_3 || _x_4;
}
function $String_reverse(_s_0) {
  return $String_reverse_go(_s_0, "");
}
function $String_trim(_s_0) {
  return $String_trim_end($String_trim_start(_s_0));
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
function $Bool_not(_b_0) {
  if (!_b_0) {
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
function $String_join(_xs_0, _sep_0) {
  if (_xs_0.$ === "Nil") {
    return "";
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return $String_join_go(_t_0, _h_0, _sep_0);
  }
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
function $String_is_empty(_s_0) {
  if (_s_0 === "") {
    return true;
  } else {
    return false;
  }
}
function $Char_to_u32(_c_0) {
  return char_code(_c_0);
}
function $String_ends_with(_s_0, _p_0) {
  return $String_starts_with($String_reverse(_s_0), $String_reverse(_p_0));
}
function $Nat_show(_n_0) {
  const _m_0 = _n_0;
  return $Nat_show_fin(_m_0, "", $Nat_show_put(nat_divmod(_m_0, 10)));
}
function $List_append(_xs_0, _ys_0) {
  if (_xs_0.$ === "Nil") {
    return _ys_0;
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return { $: "Con", head: _h_0, tail: $List_append(_t_0, _ys_0) };
  }
}
function $List_is_empty(_xs_0) {
  if (_xs_0.$ === "Nil") {
    return true;
  } else {
    return false;
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
function $Bool_and(_a_0, _b_0) {
  if (!_a_0) {
    return false;
  } else {
    return _b_0;
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
var sessions_default = {
  previewCap: run_lib(() => run_loop($previewCap()), 0),
  noteCap: run_lib(() => run_loop($noteCap()), 0),
  jsonlLen: run_lib(() => run_loop($jsonlLen()), 0),
  conferirLen: run_lib(() => run_loop($conferirLen()), 0),
  novaLabel: run_lib(() => str_out(run_loop($novaLabel())), 0),
  conversaLabel: run_lib(() => str_out(run_loop($conversaLabel())), 0),
  conferirLabel: run_lib(() => str_out(run_loop($conferirLabel())), 0),
  conferirCmd: run_lib(() => str_out(run_loop($conferirCmd())), 0),
  noteSep: run_lib(() => str_out(run_loop($noteSep())), 0),
  mesaSuffix: run_lib(() => run_loop($mesaSuffix()), 0),
  chatSuffix: run_lib(() => run_loop($chatSuffix()), 0),
  mesaCuts: run_lib(() => run_loop($mesaCuts()), 0),
  chatCuts: run_lib(() => run_loop($chatCuts()), 0),
  charStr: run_lib((a0) => str_out(run_loop($charStr(str_in(a0)))), 1),
  isWord: run_lib((a0) => run_loop($isWord(str_in(a0))), 1),
  headSpace: run_lib((a0) => run_loop($headSpace(str_in(a0))), 1),
  "collapse.go": run_lib((a0, a1, a2, a3) => str_out(run_loop($collapse_go(str_in(a0), a1, a2, str_in(a3)))), 4),
  collapseSpaces: run_lib((a0) => str_out(run_loop($collapseSpaces(str_in(a0)))), 1),
  cleanText: run_lib((a0) => str_out(run_loop($cleanText(str_in(a0)))), 1),
  headStarts: run_lib((a0, a1) => run_loop($headStarts(str_in(a0), str_in(a1))), 2),
  "cutFrom.go": run_lib((a0, a1, a2, a3) => str_out(run_loop($cutFrom_go(str_in(a0), a1, str_in(a2), str_in(a3)))), 4),
  cutFrom: run_lib((a0, a1) => str_out(run_loop($cutFrom(str_in(a0), str_in(a1)))), 2),
  cutOne: run_lib((a0, a1) => str_out(run_loop($cutOne(str_in(a0), str_in(a1)))), 2),
  cutSuffixes: run_lib((a0, a1) => str_out(run_loop($cutSuffixes(a0, str_in(a1)))), 2),
  "isConferir.rest": run_lib((a0) => run_loop($isConferir_rest(str_in(a0))), 1),
  "isConferir.if": run_lib((a0, a1) => run_loop($isConferir_if(str_in(a0), a1)), 2),
  isConferir: run_lib((a0) => run_loop($isConferir(str_in(a0))), 1),
  "rewriteConferir.hit": run_lib((a0, a1) => str_out(run_loop($rewriteConferir_hit(str_in(a0), a1))), 2),
  "rewriteConferir.on": run_lib((a0) => str_out(run_loop($rewriteConferir_on(str_in(a0)))), 1),
  rewriteConferir: run_lib((a0, a1) => str_out(run_loop($rewriteConferir(str_in(a0), a1))), 2),
  applyCuts: run_lib((a0, a1) => str_out(run_loop($applyCuts(str_in(a0), a1))), 2),
  contentText: run_lib((a0) => str_out(run_loop($contentText(a0))), 1),
  "preview.try.empty": run_lib((a0, a1) => run_loop($preview_try_empty(str_in(a0), a1)), 2),
  "preview.try.clean": run_lib((a0) => run_loop($preview_try_clean(str_in(a0))), 1),
  "preview.try.user": run_lib((a0, a1) => run_loop($preview_try_user(str_in(a0), a1)), 2),
  "preview.try.role": run_lib((a0, a1, a2) => run_loop($preview_try_role(a0, str_in(a1), a2)), 3),
  "preview.try": run_lib((a0, a1) => run_loop($preview_try(a0, a1)), 2),
  "preview.step": run_lib((a0, a1, a2) => run_loop($preview_step(a0, a1, a2)), 3),
  "preview.go": run_lib((a0, a1, a2) => run_loop($preview_go(a0, a1, a2)), 3),
  "preview.fin": run_lib((a0) => str_out(run_loop($preview_fin(a0))), 1),
  sessionPreview: run_lib((a0, a1) => str_out(run_loop($sessionPreview(a0, a1))), 2),
  headDigit: run_lib((a0) => run_loop($headDigit(str_in(a0))), 1),
  "takeTrail.go": run_lib((a0, a1, a2, a3) => run_loop($takeTrail_go(str_in(a0), a1, str_in(a2), str_in(a3))), 4),
  takeTrail: run_lib((a0) => run_loop($takeTrail(str_in(a0))), 1),
  stripJsonl: run_lib((a0) => str_out(run_loop($stripJsonl(str_in(a0)))), 1),
  digitVal: run_lib((a0) => run_loop($digitVal(str_in(a0))), 1),
  readDigits: run_lib((a0, a1) => run_loop($readDigits(str_in(a0), nat_in(a1))), 2),
  "started.val": run_lib((a0, a1) => run_loop($started_val(str_in(a0), a1)), 2),
  "started.pi": run_lib((a0, a1) => run_loop($started_pi(str_in(a0), a1)), 2),
  "started.from": run_lib((a0) => run_loop($started_from(a0)), 1),
  "started.digits": run_lib((a0) => run_loop($started_digits(str_in(a0))), 1),
  "started.if": run_lib((a0, a1) => run_loop($started_if(str_in(a0), a1)), 2),
  sessionStartedFromPath: run_lib((a0) => run_loop($sessionStartedFromPath(str_in(a0))), 1),
  "pad2.if": run_lib((a0, a1) => str_out(run_loop($pad2_if(nat_in(a0), a1))), 2),
  pad2: run_lib((a0) => str_out(run_loop($pad2(nat_in(a0)))), 1),
  formatDate: run_lib((a0, a1, a2, a3) => str_out(run_loop($formatDate(nat_in(a0), nat_in(a1), nat_in(a2), nat_in(a3)))), 4),
  formatWhen: run_lib((a0, a1, a2, a3, a4) => str_out(run_loop($formatWhen(a0, nat_in(a1), nat_in(a2), nat_in(a3), nat_in(a4)))), 5),
  "formatLabel.withNote": run_lib((a0, a1, a2, a3, a4, a5) => str_out(run_loop($formatLabel_withNote(str_in(a0), a1, nat_in(a2), nat_in(a3), nat_in(a4), nat_in(a5)))), 6),
  "formatLabel.empty": run_lib((a0, a1, a2, a3, a4, a5) => str_out(run_loop($formatLabel_empty(a0, a1, nat_in(a2), nat_in(a3), nat_in(a4), nat_in(a5)))), 6),
  "formatLabel.note.if": run_lib((a0, a1, a2, a3, a4, a5, a6, a7) => str_out(run_loop($formatLabel_note_if(str_in(a0), a1, a2, a3, nat_in(a4), nat_in(a5), nat_in(a6), nat_in(a7)))), 8),
  "formatLabel.note": run_lib((a0, a1, a2, a3, a4, a5, a6) => str_out(run_loop($formatLabel_note(str_in(a0), a1, a2, nat_in(a3), nat_in(a4), nat_in(a5), nat_in(a6)))), 7),
  "formatLabel.title.if": run_lib((a0, a1, a2, a3, a4, a5, a6, a7, a8) => str_out(run_loop($formatLabel_title_if(str_in(a0), a1, str_in(a2), a3, a4, nat_in(a5), nat_in(a6), nat_in(a7), nat_in(a8)))), 9),
  formatSessionLabel: run_lib((a0, a1, a2, a3, a4, a5, a6, a7) => str_out(run_loop($formatSessionLabel(str_in(a0), str_in(a1), a2, a3, nat_in(a4), nat_in(a5), nat_in(a6), nat_in(a7)))), 8),
  "groupOf.yest": run_lib((a0) => run_loop($groupOf_yest(a0)), 1),
  groupOf: run_lib((a0, a1) => run_loop($groupOf(a0, a1)), 2),
  groupLabel: run_lib((a0) => str_out(run_loop($groupLabel(a0))), 1),
  "group.push.at": run_lib((a0, a1, a2, a3, a4) => run_loop($group_push_at(a0, a1, a2, str_in(a3), a4)), 5),
  "group.push": run_lib((a0, a1, a2) => run_loop($group_push(a0, str_in(a1), a2)), 3),
  "group.go": run_lib((a0, a1, a2, a3) => run_loop($group_go(a0, a1, a2, a3)), 4),
  "keepBucket.if": run_lib((a0, a1, a2, a3) => run_loop($keepBucket_if(a0, a1, a2, a3)), 4),
  keepBucket: run_lib((a0, a1, a2) => run_loop($keepBucket(a0, a1, a2)), 3),
  "group.finish": run_lib((a0) => run_loop($group_finish(a0)), 1),
  groupSessions: run_lib((a0, a1, a2) => run_loop($groupSessions(a0, a1, a2)), 3)
};
export {
  sessions_default as default
};

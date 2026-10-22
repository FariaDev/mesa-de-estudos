// GERADO de core/pdfref.bend por `bun core/build.mjs` — não editar à mão.
// core/pdfref.bend
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
function $search_minQueryChars() {
  return 2;
}
function $search_maxQueryChars() {
  return 80;
}
function $search_defaultLimit() {
  return 30;
}
function $search_maxLimit() {
  return 50;
}
function $search_maxTotalHits() {
  return 200;
}
function $search_maxFiles() {
  return 300;
}
function $search_charStr(_c_0) {
  return _c_0 + "";
}
function $search_combining(_code_0) {
  return $Bool_and(_code_0 >= 768, _code_0 <= 879);
}
function $search_asciiUpper(_code_0) {
  return $Bool_and(_code_0 >= 65, _code_0 <= 90);
}
function $search_foldChar_ascii(_code_0) {
  return $search_charStr($Char_from_u32(_code_0 + 32 >>> 0));
}
function $search_foldChar_latin(_c_0, _code_0) {
  if (_code_0 == 192) {
    return "a";
  } else if (_code_0 == 224) {
    return "a";
  } else if ((_code_0 & 15) == 0) {
    return $search_charStr(_c_0);
  } else if (_code_0 == 200) {
    return "e";
  } else if (_code_0 == 232) {
    return "e";
  } else if ((_code_0 & 15) == 8) {
    return $search_charStr(_c_0);
  } else if (_code_0 == 196) {
    return "a";
  } else if ((_code_0 & 63) == 4) {
    return $search_charStr(_c_0);
  } else if (_code_0 == 228) {
    return "a";
  } else if ((_code_0 & 63) == 36) {
    return $search_charStr(_c_0);
  } else if (_code_0 == 212) {
    return "o";
  } else if ((_code_0 & 63) == 20) {
    return $search_charStr(_c_0);
  } else if (_code_0 == 244) {
    return "o";
  } else if ((_code_0 & 63) == 52) {
    return $search_charStr(_c_0);
  } else if (_code_0 == 204) {
    return "i";
  } else if ((_code_0 & 63) == 12) {
    return $search_charStr(_c_0);
  } else if (_code_0 == 236) {
    return "i";
  } else if ((_code_0 & 63) == 44) {
    return $search_charStr(_c_0);
  } else if (_code_0 == 220) {
    return "u";
  } else if ((_code_0 & 63) == 28) {
    return $search_charStr(_c_0);
  } else if (_code_0 == 252) {
    return "u";
  } else if ((_code_0 & 63) == 60) {
    return $search_charStr(_c_0);
  } else if (_code_0 == 194) {
    return "a";
  } else if ((_code_0 & 63) == 2) {
    return $search_charStr(_c_0);
  } else if (_code_0 == 226) {
    return "a";
  } else if ((_code_0 & 63) == 34) {
    return $search_charStr(_c_0);
  } else if (_code_0 == 210) {
    return "o";
  } else if ((_code_0 & 63) == 18) {
    return $search_charStr(_c_0);
  } else if (_code_0 == 242) {
    return "o";
  } else if ((_code_0 & 63) == 50) {
    return $search_charStr(_c_0);
  } else if (_code_0 == 202) {
    return "e";
  } else if ((_code_0 & 63) == 10) {
    return $search_charStr(_c_0);
  } else if (_code_0 == 234) {
    return "e";
  } else if ((_code_0 & 63) == 42) {
    return $search_charStr(_c_0);
  } else if (_code_0 == 218) {
    return "u";
  } else if ((_code_0 & 63) == 26) {
    return $search_charStr(_c_0);
  } else if (_code_0 == 250) {
    return "u";
  } else if ((_code_0 & 63) == 58) {
    return $search_charStr(_c_0);
  } else if (_code_0 == 206) {
    return "i";
  } else if (_code_0 == 238) {
    return "i";
  } else if ((_code_0 & 15) == 14) {
    return $search_charStr(_c_0);
  } else if (_code_0 == 214) {
    return "o";
  } else if (_code_0 == 246) {
    return "o";
  } else if ((_code_0 & 15) == 6) {
    return $search_charStr(_c_0);
  } else if (_code_0 == 193) {
    return "a";
  } else if ((_code_0 & 63) == 1) {
    return $search_charStr(_c_0);
  } else if (_code_0 == 225) {
    return "a";
  } else if ((_code_0 & 63) == 33) {
    return $search_charStr(_c_0);
  } else if (_code_0 == 209) {
    return "n";
  } else if ((_code_0 & 63) == 17) {
    return $search_charStr(_c_0);
  } else if (_code_0 == 241) {
    return "n";
  } else if ((_code_0 & 63) == 49) {
    return $search_charStr(_c_0);
  } else if (_code_0 == 201) {
    return "e";
  } else if ((_code_0 & 63) == 9) {
    return $search_charStr(_c_0);
  } else if (_code_0 == 233) {
    return "e";
  } else if ((_code_0 & 63) == 41) {
    return $search_charStr(_c_0);
  } else if (_code_0 == 217) {
    return "u";
  } else if ((_code_0 & 63) == 25) {
    return $search_charStr(_c_0);
  } else if (_code_0 == 249) {
    return "u";
  } else if ((_code_0 & 63) == 57) {
    return $search_charStr(_c_0);
  } else if (_code_0 == 197) {
    return "a";
  } else if ((_code_0 & 63) == 5) {
    return $search_charStr(_c_0);
  } else if (_code_0 == 229) {
    return "a";
  } else if ((_code_0 & 63) == 37) {
    return $search_charStr(_c_0);
  } else if (_code_0 == 213) {
    return "o";
  } else if ((_code_0 & 63) == 21) {
    return $search_charStr(_c_0);
  } else if (_code_0 == 245) {
    return "o";
  } else if ((_code_0 & 63) == 53) {
    return $search_charStr(_c_0);
  } else if (_code_0 == 205) {
    return "i";
  } else if ((_code_0 & 63) == 13) {
    return $search_charStr(_c_0);
  } else if (_code_0 == 237) {
    return "i";
  } else if ((_code_0 & 63) == 45) {
    return $search_charStr(_c_0);
  } else if (_code_0 == 221) {
    return "y";
  } else if ((_code_0 & 63) == 29) {
    return $search_charStr(_c_0);
  } else if (_code_0 == 253) {
    return "y";
  } else if ((_code_0 & 63) == 61) {
    return $search_charStr(_c_0);
  } else if (_code_0 == 195) {
    return "a";
  } else if ((_code_0 & 63) == 3) {
    return $search_charStr(_c_0);
  } else if (_code_0 == 227) {
    return "a";
  } else if ((_code_0 & 63) == 35) {
    return $search_charStr(_c_0);
  } else if (_code_0 == 211) {
    return "o";
  } else if ((_code_0 & 63) == 19) {
    return $search_charStr(_c_0);
  } else if (_code_0 == 243) {
    return "o";
  } else if ((_code_0 & 63) == 51) {
    return $search_charStr(_c_0);
  } else if (_code_0 == 203) {
    return "e";
  } else if ((_code_0 & 63) == 11) {
    return $search_charStr(_c_0);
  } else if (_code_0 == 235) {
    return "e";
  } else if ((_code_0 & 63) == 43) {
    return $search_charStr(_c_0);
  } else if (_code_0 == 219) {
    return "u";
  } else if ((_code_0 & 63) == 27) {
    return $search_charStr(_c_0);
  } else if (_code_0 == 251) {
    return "u";
  } else if ((_code_0 & 63) == 59) {
    return $search_charStr(_c_0);
  } else if (_code_0 == 199) {
    return "c";
  } else if (_code_0 == 231) {
    return "c";
  } else if ((_code_0 & 15) == 7) {
    return $search_charStr(_c_0);
  } else if (_code_0 == 207) {
    return "i";
  } else if ((_code_0 & 63) == 15) {
    return $search_charStr(_c_0);
  } else if (_code_0 == 239) {
    return "i";
  } else if ((_code_0 & 63) == 47) {
    return $search_charStr(_c_0);
  } else if (_code_0 == 255) {
    return "y";
  } else {
    return $search_charStr(_c_0);
  }
}
function $search_foldChar_case(_c_0, _code_0, _upper_0) {
  if (_upper_0) {
    return $search_foldChar_ascii(_code_0);
  } else {
    return $search_foldChar_latin(_c_0, _code_0);
  }
}
function $search_foldChar_strip(_c_0, _code_0, _isMark_0) {
  if (_isMark_0) {
    return "";
  } else {
    return $search_foldChar_case(_c_0, _code_0, $search_asciiUpper(_code_0));
  }
}
function $search_foldChar_go(_c_0, _code_0) {
  return $search_foldChar_strip(_c_0, _code_0, $search_combining(_code_0));
}
function $search_foldChar(_c_0) {
  return $search_foldChar_go(_c_0, $Char_to_u32(_c_0));
}
function $search_fold_go($0, $1) {
  for (;; ) {
    {
      const _s_0 = $0;
      const _acc_0 = $1;
      if (_s_0 === "") {
        return _acc_0;
      } else {
        const _h_0 = _s_0.slice(0, char_len(_s_0));
        const _t_0 = _s_0.slice(char_len(_s_0));
        const _x_0 = $search_foldChar(_h_0);
        $0 = _t_0;
        $1 = _acc_0 + _x_0;
        continue;
      }
    }
  }
}
function $search_fold(_s_0) {
  return $search_fold_go(_s_0, "");
}
function $search_matches_empty(_emptyHay_0, _emptyNeedle_0, _hay_0, _needle_0) {
  if (_emptyHay_0) {
    return false;
  } else {
    if (_emptyNeedle_0) {
      return false;
    } else {
      return $String_contains(_hay_0, _needle_0);
    }
  }
}
function $search_matches(_hay_0, _needle_0) {
  const _h_0 = $search_fold(_hay_0);
  const _n_0 = $search_fold($String_trim(_needle_0));
  return $search_matches_empty($String_is_empty(_h_0), $String_is_empty(_n_0), _h_0, _n_0);
}
function $search_snippet_start(_cut_0, _core_0) {
  if (_cut_0) {
    return "…" + _core_0;
  } else {
    return _core_0;
  }
}
function $search_snippet_end(_cut_0, _s_0) {
  if (_cut_0) {
    return _s_0 + "…";
  } else {
    return _s_0;
  }
}
function $search_snippet(_cutStart_0, _cutEnd_0, _core_0) {
  return $search_snippet_end(_cutEnd_0, $search_snippet_start(_cutStart_0, _core_0));
}
function $search_clampLimit_cap(_overMax_0, _n_0) {
  if (_overMax_0) {
    return 50;
  } else {
    return _n_0;
  }
}
function $search_clampLimit(_invalid_0, _overMax_0, _n_0) {
  if (_invalid_0) {
    return 30;
  } else {
    return $search_clampLimit_cap(_overMax_0, _n_0);
  }
}
function $search_keepRole_assistant(_isAssistant_0) {
  if (_isAssistant_0) {
    return { $: "Some", value: { $: "MsgAssistant" } };
  } else {
    return { $: "None" };
  }
}
function $search_keepRole(_isUser_0, _isAssistant_0) {
  if (_isUser_0) {
    return { $: "Some", value: { $: "MsgUser" } };
  } else {
    return $search_keepRole_assistant(_isAssistant_0);
  }
}
function $search_fileAct_large(_tooLarge_0) {
  if (_tooLarge_0) {
    return { $: "ActSkip" };
  } else {
    return { $: "ActScan" };
  }
}
function $search_fileAct_files(_atFileCap_0, _tooLarge_0) {
  if (_atFileCap_0) {
    return { $: "ActStop" };
  } else {
    return $search_fileAct_large(_tooLarge_0);
  }
}
function $search_fileAct_time(_timedOut_0, _atFileCap_0, _tooLarge_0) {
  if (_timedOut_0) {
    return { $: "ActStop" };
  } else {
    return $search_fileAct_files(_atFileCap_0, _tooLarge_0);
  }
}
function $search_fileAct(_atHitCap_0, _timedOut_0, _atFileCap_0, _tooLarge_0) {
  if (_atHitCap_0) {
    return { $: "ActStop" };
  } else {
    return $search_fileAct_time(_timedOut_0, _atFileCap_0, _tooLarge_0);
  }
}
function $search_isStop(_a_0) {
  if (_a_0.$ === "ActStop") {
    return true;
  } else if (_a_0.$ === "ActSkip") {
    return false;
  } else {
    return false;
  }
}
function $search_withTruncated(_was_0, _act_0) {
  if (_act_0.$ === "ActStop") {
    return true;
  } else if (_act_0.$ === "ActSkip") {
    return _was_0;
  } else {
    return _was_0;
  }
}
function $search_stepTruncated(_was_0, _atHitCap_0, _timedOut_0, _atFileCap_0, _tooLarge_0) {
  return $search_withTruncated(_was_0, $search_fileAct(_atHitCap_0, _timedOut_0, _atFileCap_0, _tooLarge_0));
}
function $search_takeUntilFull(_xs_0, _full_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const __0 = _xs_0["head"];
    const __1 = _xs_0["tail"];
    if (_full_0.$ === "Nil") {
      return { $: "Nil" };
    } else {
      const _t_0 = _full_0["head"];
      if (_t_0) {
        return { $: "Nil" };
      } else {
        const _fs_1 = _full_0["tail"];
        return { $: "Con", head: __0, tail: $search_takeUntilFull(__1, _fs_1) };
      }
    }
  }
}
function $search_anyFull(_full_0) {
  if (_full_0.$ === "Nil") {
    return false;
  } else {
    const _f_0 = _full_0["head"];
    const _fs_0 = _full_0["tail"];
    const _x_0 = $search_anyFull(_fs_0);
    return _f_0 || _x_0;
  }
}
function $search_noneFull(_xs_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _t_0 = _xs_0["tail"];
    return { $: "Con", head: false, tail: $search_noneFull(_t_0) };
  }
}
function $search_openGroup(_h_0) {
  const _conv_0 = _h_0["conv"];
  const _title_0 = _h_0["title"];
  const _role_0 = _h_0["role"];
  const _clip_0 = _h_0["clip"];
  return { $: "SearchGroup", conv: _conv_0, title: _title_0, hits: { $: "Con", head: { $: "SearchHit", conv: _conv_0, title: _title_0, role: _role_0, clip: _clip_0 }, tail: { $: "Nil" } } };
}
function $search_addHit(_g_0, _h_0) {
  const _conv_0 = _g_0["conv"];
  const _title_0 = _g_0["title"];
  const _hits_0 = _g_0["hits"];
  return { $: "SearchGroup", conv: _conv_0, title: _title_0, hits: $List_append(_hits_0, { $: "Con", head: _h_0, tail: { $: "Nil" } }) };
}
function $search_group_go($0, $1, $2) {
  for (;; ) {
    {
      const _xs_0 = $0;
      const _same_0 = $1;
      const _g_0 = $2;
      if (_xs_0.$ === "Nil") {
        return { $: "Con", head: _g_0, tail: { $: "Nil" } };
      } else {
        const __0 = _xs_0["head"];
        const __1 = _xs_0["tail"];
        if (_same_0.$ === "Nil") {
          return { $: "Con", head: _g_0, tail: { $: "Nil" } };
        } else {
          const _t_0 = _same_0["head"];
          if (_t_0) {
            const _ss_0 = _same_0["tail"];
            $0 = __1;
            $1 = _ss_0;
            $2 = $search_addHit(_g_0, __0);
            continue;
          } else {
            const _ss_1 = _same_0["tail"];
            return { $: "Con", head: _g_0, tail: $search_group_go(__1, _ss_1, $search_openGroup(__0)) };
          }
        }
      }
    }
  }
}
function $search_groupHits(_xs_0, _same_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return $search_group_go(_t_0, _same_0, $search_openGroup(_h_0));
  }
}
function $search_truncatedOf(_o_0) {
  const _truncated_0 = _o_0["truncated"];
  return _truncated_0;
}
function $search_hitsOf(_o_0) {
  const _hits_0 = _o_0["hits"];
  return _hits_0;
}
function $search_finishQuery(_tooShort_0, _hits_0, _truncated_0) {
  if (_tooShort_0) {
    return { $: "SearchOut", hits: { $: "Nil" }, truncated: false };
  } else {
    return { $: "SearchOut", hits: _hits_0, truncated: _truncated_0 };
  }
}
function $search_searchOut(_tooShort_0, _xs_0, _full_0) {
  return $search_finishQuery(_tooShort_0, $search_takeUntilFull(_xs_0, _full_0), $search_anyFull(_full_0));
}
function $charStr(_c_0) {
  return _c_0 + "";
}
function $pageOf(_c_0) {
  const _page_0 = _c_0["page"];
  return _page_0;
}
function $cueLenOf(_c_0) {
  const _length_0 = _c_0["length"];
  return _length_0;
}
function $maxPage() {
  return 1e4;
}
function $maxCandidate() {
  return 200;
}
function $refLabel(_name_0, _page_0) {
  const _x_0 = $Nat_show(_page_0);
  const _x_1 = ", p. " + _x_0;
  return _name_0 + _x_1;
}
function $refTitle(_name_0, _page_0) {
  return $msg_msg2("pdf.ref.title", "name", _name_0, "page", $Nat_show(_page_0));
}
function $refAria(_name_0, _page_0) {
  return $msg_msg2("pdf.ref.aria", "page", $Nat_show(_page_0), "name", _name_0);
}
function $fitName(_name_0) {
  return $String_take($String_trim(_name_0), $maxCandidate());
}
function $knownName_facts(_names_0, _folded_0) {
  if (_names_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _name_0 = _names_0["head"];
    const _t_0 = _names_0["tail"];
    return { $: "Con", head: $String_eq($search_fold($fitName(_name_0)), _folded_0), tail: $knownName_facts(_t_0, _folded_0) };
  }
}
function $knownName_pickNone(_hit_0, _name_0) {
  if (_hit_0) {
    return { $: "Some", value: _name_0 };
  } else {
    return { $: "None" };
  }
}
function $knownName_pick(_best_0, _hit_0, _name_0) {
  if (_best_0.$ === "Some") {
    const _b_0 = _best_0["value"];
    return { $: "Some", value: _b_0 };
  } else {
    return $knownName_pickNone(_hit_0, _name_0);
  }
}
function $knownName_go($0, $1, $2, $3) {
  for (;; ) {
    {
      const _folded_0 = $0;
      const _names_0 = $1;
      const _facts_0 = $2;
      const _best_0 = $3;
      if (_names_0.$ === "Nil") {
        return _best_0;
      } else {
        const _name_0 = _names_0["head"];
        const _t_0 = _names_0["tail"];
        if (_facts_0.$ === "Nil") {
          return _best_0;
        } else {
          const _hit_0 = _facts_0["head"];
          const _fs_0 = _facts_0["tail"];
          $0 = _folded_0;
          $1 = _t_0;
          $2 = _fs_0;
          $3 = $knownName_pick(_best_0, _hit_0, _name_0);
          continue;
        }
      }
    }
  }
}
function $knownName_empty(_empty_0, _folded_0, _names_0) {
  if (_empty_0) {
    return { $: "None" };
  } else {
    return $knownName_go(_folded_0, _names_0, $knownName_facts(_names_0, _folded_0), { $: "None" });
  }
}
function $knownName(_candidate_0, _names_0) {
  const _c_0 = $fitName(_candidate_0);
  return $knownName_empty($String_is_empty(_c_0), $search_fold(_c_0), _names_0);
}
function $cueMarkers() {
  return { $: "Con", head: "página ", tail: { $: "Con", head: "page ", tail: { $: "Con", head: "pág. ", tail: { $: "Con", head: "pág ", tail: { $: "Con", head: "pg. ", tail: { $: "Con", head: "pg ", tail: { $: "Con", head: "#page=", tail: { $: "Con", head: "p. ", tail: { $: "Con", head: "p.", tail: { $: "Con", head: "p ", tail: { $: "Nil" } } } } } } } } } } };
}
function $isSeparator(_c_0) {
  const _x_0 = $Char_is_eq(_c_0, ",");
  const _x_1 = $Char_is_eq(_c_0, ";");
  const _x_2 = $Char_is_space(_c_0);
  const _x_3 = _x_0 || _x_1;
  return _x_2 || _x_3;
}
function $sep_stop(_hit_0) {
  if (_hit_0) {
    return false;
  } else {
    return true;
  }
}
function $sep_bump(_n_0, _hit_0) {
  if (_hit_0) {
    return nat_chk(_n_0 + 1);
  } else {
    return _n_0;
  }
}
function $sep_go($0, $1, $2) {
  for (;; ) {
    {
      const _s_0 = $0;
      const _d_0 = $1;
      const _n_0 = $2;
      if (_s_0 === "") {
        return _n_0;
      } else {
        const _h_0 = _s_0.slice(0, char_len(_s_0));
        const _t_0 = _s_0.slice(char_len(_s_0));
        if (_d_0) {
          return _n_0;
        } else {
          const _hit_0 = $isSeparator(_h_0);
          $0 = _t_0;
          $1 = $sep_stop(_hit_0);
          $2 = $sep_bump(_n_0, _hit_0);
          continue;
        }
      }
    }
  }
}
function $sepAt(_s_0) {
  return $sep_go(_s_0, false, 0);
}
function $spaces_stop(_hit_0) {
  if (_hit_0) {
    return false;
  } else {
    return true;
  }
}
function $spaces_bump(_n_0, _hit_0) {
  if (_hit_0) {
    return nat_chk(_n_0 + 1);
  } else {
    return _n_0;
  }
}
function $spaces_go($0, $1, $2) {
  for (;; ) {
    {
      const _s_0 = $0;
      const _d_0 = $1;
      const _n_0 = $2;
      if (_s_0 === "") {
        return _n_0;
      } else {
        const _h_0 = _s_0.slice(0, char_len(_s_0));
        const _t_0 = _s_0.slice(char_len(_s_0));
        if (_d_0) {
          return _n_0;
        } else {
          const _hit_0 = $Char_is_space(_h_0);
          $0 = _t_0;
          $1 = $spaces_stop(_hit_0);
          $2 = $spaces_bump(_n_0, _hit_0);
          continue;
        }
      }
    }
  }
}
function $spacesAt(_s_0) {
  return $spaces_go(_s_0, false, 0);
}
function $digitVal(_c_0) {
  const _x_0 = $Char_to_u32(_c_0);
  return _x_0 < 48 ? 0 : _x_0 - 48;
}
function $digits_stop(_hit_0) {
  if (_hit_0) {
    return false;
  } else {
    return true;
  }
}
function $digits_acc(_acc_0, _n_0, _hit_0, _val_0) {
  if (_hit_0) {
    const _x_0 = nat_chk(_acc_0 * 10);
    return nat_chk(_x_0 + _val_0);
  } else {
    return _acc_0;
  }
}
function $digits_count(_n_0, _hit_0) {
  if (_hit_0) {
    return nat_chk(_n_0 + 1);
  } else {
    return _n_0;
  }
}
function $digits_go($0, $1, $2, $3) {
  for (;; ) {
    {
      const _s_0 = $0;
      const _d_0 = $1;
      const _acc_0 = $2;
      const _n_0 = $3;
      if (_s_0 === "") {
        return { $: "Tuple", fst: _acc_0, snd: _n_0 };
      } else {
        const _h_0 = _s_0.slice(0, char_len(_s_0));
        const _t_0 = _s_0.slice(char_len(_s_0));
        if (_d_0) {
          return { $: "Tuple", fst: _acc_0, snd: _n_0 };
        } else {
          const _hit_0 = $Char_is_digit(_h_0);
          $0 = _t_0;
          $1 = $digits_stop(_hit_0);
          $2 = $digits_acc(_acc_0, _n_0, _hit_0, $digitVal(_h_0));
          $3 = $digits_count(_n_0, _hit_0);
          continue;
        }
      }
    }
  }
}
function $readDigits(_s_0) {
  return $digits_go(_s_0, false, 0, 0);
}
function $pageOk(_page_0) {
  return $Bool_and($Nat_is_ge(_page_0, 1), $Nat_is_le(_page_0, $maxPage()));
}
function $cueAfter_valid(_page_0, _ok_0, _consumed_0) {
  if (!_ok_0) {
    return { $: "None" };
  } else {
    return { $: "Some", value: { $: "CiteCue", page: _page_0, length: _consumed_0 } };
  }
}
function $cueAfter_any(_any_0, _page_0, _consumed_0) {
  if (!_any_0) {
    return { $: "None" };
  } else {
    return $cueAfter_valid(_page_0, $pageOk(_page_0), _consumed_0);
  }
}
function $cueAfter_pick(_page_0, _digits_0, _before_0, _sp_0) {
  const _x_0 = nat_chk(_sp_0 + _digits_0);
  return $cueAfter_any($Nat_is_gt(_digits_0, 0), _page_0, nat_chk(_before_0 + _x_0));
}
function $cueAfter_pair(_d_0, _before_0, _sp_0) {
  const _page_0 = _d_0["fst"];
  const _digits_0 = _d_0["snd"];
  return $cueAfter_pick(_page_0, _digits_0, _before_0, _sp_0);
}
function $cueAfter(_rest_0, _before_0) {
  const _sp_0 = $spacesAt(_rest_0);
  return $cueAfter_pair($readDigits($String_drop(_rest_0, _sp_0)), _before_0, _sp_0);
}
function $tryMarker_hit(_hit_0, _rest_0, _before_0, _ml_0) {
  if (!_hit_0) {
    return { $: "None" };
  } else {
    return $cueAfter($String_drop(_rest_0, _ml_0), nat_chk(_before_0 + _ml_0));
  }
}
function $tryMarker(_rest_0, _before_0, _marker_0) {
  const _ml_0 = [...str_out(_marker_0)].length;
  return $tryMarker_hit($String_starts_with(_rest_0, _marker_0), _rest_0, _before_0, _ml_0);
}
function $tryMarkers_pick(_found_0, _next_0) {
  if (_found_0.$ === "Some") {
    const _c_0 = _found_0["value"];
    return { $: "Some", value: _c_0 };
  } else {
    return _next_0;
  }
}
function $tryMarkers($0, $1, $2, $3) {
  for (;; ) {
    {
      const _rest_0 = $0;
      const _before_0 = $1;
      const _markers_0 = $2;
      const _found_0 = $3;
      if (_markers_0.$ === "Nil") {
        return _found_0;
      } else {
        const _m_0 = _markers_0["head"];
        const _t_0 = _markers_0["tail"];
        $0 = _rest_0;
        $1 = _before_0;
        $2 = _t_0;
        $3 = $tryMarkers_pick(_found_0, $tryMarker(_rest_0, _before_0, _m_0));
        continue;
      }
    }
  }
}
function $cueFrom(_text_0) {
  const _n_0 = $sepAt(_text_0);
  return $tryMarkers($String_drop(_text_0, _n_0), _n_0, $cueMarkers(), { $: "None" });
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
function $Char_from_u32(_x_0) {
  return char_new(_x_0);
}
function $Char_to_u32(_c_0) {
  return char_code(_c_0);
}
function $String_contains($0, $1, $2) {
  let $pc = 0;
  for (;; )
    switch ($pc) {
      case 0: {
        const _s_0 = $0;
        const _p_0 = $1;
        if (_s_0 === "") {
          return $String_is_empty(_p_0);
        } else {
          const _h_0 = _s_0.slice(0, char_len(_s_0));
          const _t_0 = _s_0.slice(char_len(_s_0));
          $0 = _t_0;
          $1 = _p_0;
          $2 = $String_starts_with(_h_0 + _t_0, _p_0);
          $pc = 1;
          continue;
        }
      }
      case 1: {
        const _t_0 = $0;
        const _p_0 = $1;
        const _here_0 = $2;
        if (!_here_0) {
          $0 = _t_0;
          $1 = _p_0;
          $pc = 0;
          continue;
        } else {
          return true;
        }
      }
    }
}
function $String_trim(_s_0) {
  return $String_trim_end($String_trim_start(_s_0));
}
function $String_is_empty(_s_0) {
  if (_s_0 === "") {
    return true;
  } else {
    return false;
  }
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
function $Nat_show(_n_0) {
  const _m_0 = _n_0;
  return $Nat_show_fin(_m_0, "", $Nat_show_put(nat_divmod(_m_0, 10)));
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
function $String_eq(_a_0, _b_0) {
  return $Cmp_is_eq($String_order(_a_0, _b_0));
}
function $Char_is_space(_c_0) {
  const _x_0 = char_code(_c_0);
  const _x_1 = char_code(_c_0);
  const _x_2 = char_code(_c_0);
  const _x_3 = _x_0 === 32;
  const _x_4 = $Bool_and(_x_1 >= 9, _x_2 <= 13);
  return _x_3 || _x_4;
}
function $Char_is_eq(_a_0, _b_0) {
  const _x_0 = char_code(_a_0);
  const _x_1 = char_code(_b_0);
  return _x_0 === _x_1;
}
function $Char_is_digit(_c_0) {
  const _x_0 = char_code(_c_0);
  const _x_1 = char_code(_c_0);
  return $Bool_and(_x_0 >= 48, _x_1 <= 57);
}
function $Nat_is_ge(_a_0, _b_0) {
  return $Cmp_is_ge(cmp_new(_a_0, _b_0));
}
function $Nat_is_le(_a_0, _b_0) {
  return $Cmp_is_le(cmp_new(_a_0, _b_0));
}
function $Nat_is_gt(_a_0, _b_0) {
  return $Cmp_is_gt(cmp_new(_a_0, _b_0));
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
function $Cmp_is_ge(_c_0) {
  if (_c_0.$ === "LT") {
    return false;
  } else {
    return true;
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
function $String_reverse(_s_0) {
  return $String_reverse_go(_s_0, "");
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
var pdfref_default = {
  "msg.mark": run_lib(() => str_out(run_loop($msg_mark())), 0),
  "msg.sep": run_lib(() => str_out(run_loop($msg_sep())), 0),
  "msg.pack": run_lib((a0) => str_out(run_loop($msg_pack(a0))), 1),
  "msg.msg": run_lib((a0) => str_out(run_loop($msg_msg(str_in(a0)))), 1),
  "msg.msg1": run_lib((a0, a1, a2) => str_out(run_loop($msg_msg1(str_in(a0), str_in(a1), str_in(a2)))), 3),
  "msg.msg2": run_lib((a0, a1, a2, a3, a4) => str_out(run_loop($msg_msg2(str_in(a0), str_in(a1), str_in(a2), str_in(a3), str_in(a4)))), 5),
  "msg.msg3": run_lib((a0, a1, a2, a3, a4, a5, a6) => str_out(run_loop($msg_msg3(str_in(a0), str_in(a1), str_in(a2), str_in(a3), str_in(a4), str_in(a5), str_in(a6)))), 7),
  "msg.msg4": run_lib((a0, a1, a2, a3, a4, a5, a6, a7, a8) => str_out(run_loop($msg_msg4(str_in(a0), str_in(a1), str_in(a2), str_in(a3), str_in(a4), str_in(a5), str_in(a6), str_in(a7), str_in(a8)))), 9),
  "msg.isMsg": run_lib((a0) => run_loop($msg_isMsg(str_in(a0))), 1),
  "search.minQueryChars": run_lib(() => run_loop($search_minQueryChars()), 0),
  "search.maxQueryChars": run_lib(() => run_loop($search_maxQueryChars()), 0),
  "search.defaultLimit": run_lib(() => run_loop($search_defaultLimit()), 0),
  "search.maxLimit": run_lib(() => run_loop($search_maxLimit()), 0),
  "search.maxTotalHits": run_lib(() => run_loop($search_maxTotalHits()), 0),
  "search.maxFiles": run_lib(() => run_loop($search_maxFiles()), 0),
  "search.charStr": run_lib((a0) => str_out(run_loop($search_charStr(str_in(a0)))), 1),
  "search.combining": run_lib((a0) => run_loop($search_combining(a0)), 1),
  "search.asciiUpper": run_lib((a0) => run_loop($search_asciiUpper(a0)), 1),
  "search.foldChar.ascii": run_lib((a0) => str_out(run_loop($search_foldChar_ascii(a0))), 1),
  "search.foldChar.latin": run_lib((a0, a1) => str_out(run_loop($search_foldChar_latin(str_in(a0), a1))), 2),
  "search.foldChar.case": run_lib((a0, a1, a2) => str_out(run_loop($search_foldChar_case(str_in(a0), a1, a2))), 3),
  "search.foldChar.strip": run_lib((a0, a1, a2) => str_out(run_loop($search_foldChar_strip(str_in(a0), a1, a2))), 3),
  "search.foldChar.go": run_lib((a0, a1) => str_out(run_loop($search_foldChar_go(str_in(a0), a1))), 2),
  "search.foldChar": run_lib((a0) => str_out(run_loop($search_foldChar(str_in(a0)))), 1),
  "search.fold.go": run_lib((a0, a1) => str_out(run_loop($search_fold_go(str_in(a0), str_in(a1)))), 2),
  "search.fold": run_lib((a0) => str_out(run_loop($search_fold(str_in(a0)))), 1),
  "search.matches.empty": run_lib((a0, a1, a2, a3) => run_loop($search_matches_empty(a0, a1, str_in(a2), str_in(a3))), 4),
  "search.matches": run_lib((a0, a1) => run_loop($search_matches(str_in(a0), str_in(a1))), 2),
  "search.snippet.start": run_lib((a0, a1) => str_out(run_loop($search_snippet_start(a0, str_in(a1)))), 2),
  "search.snippet.end": run_lib((a0, a1) => str_out(run_loop($search_snippet_end(a0, str_in(a1)))), 2),
  "search.snippet": run_lib((a0, a1, a2) => str_out(run_loop($search_snippet(a0, a1, str_in(a2)))), 3),
  "search.clampLimit.cap": run_lib((a0, a1) => run_loop($search_clampLimit_cap(a0, nat_in(a1))), 2),
  "search.clampLimit": run_lib((a0, a1, a2) => run_loop($search_clampLimit(a0, a1, nat_in(a2))), 3),
  "search.keepRole.assistant": run_lib((a0) => run_loop($search_keepRole_assistant(a0)), 1),
  "search.keepRole": run_lib((a0, a1) => run_loop($search_keepRole(a0, a1)), 2),
  "search.fileAct.large": run_lib((a0) => run_loop($search_fileAct_large(a0)), 1),
  "search.fileAct.files": run_lib((a0, a1) => run_loop($search_fileAct_files(a0, a1)), 2),
  "search.fileAct.time": run_lib((a0, a1, a2) => run_loop($search_fileAct_time(a0, a1, a2)), 3),
  "search.fileAct": run_lib((a0, a1, a2, a3) => run_loop($search_fileAct(a0, a1, a2, a3)), 4),
  "search.isStop": run_lib((a0) => run_loop($search_isStop(a0)), 1),
  "search.withTruncated": run_lib((a0, a1) => run_loop($search_withTruncated(a0, a1)), 2),
  "search.stepTruncated": run_lib((a0, a1, a2, a3, a4) => run_loop($search_stepTruncated(a0, a1, a2, a3, a4)), 5),
  "search.takeUntilFull": run_lib((a0, a1) => run_loop($search_takeUntilFull(a0, a1)), 2),
  "search.anyFull": run_lib((a0) => run_loop($search_anyFull(a0)), 1),
  "search.noneFull": run_lib((a0) => run_loop($search_noneFull(a0)), 1),
  "search.openGroup": run_lib((a0) => run_loop($search_openGroup(a0)), 1),
  "search.addHit": run_lib((a0, a1) => run_loop($search_addHit(a0, a1)), 2),
  "search.group.go": run_lib((a0, a1, a2) => run_loop($search_group_go(a0, a1, a2)), 3),
  "search.groupHits": run_lib((a0, a1) => run_loop($search_groupHits(a0, a1)), 2),
  "search.truncatedOf": run_lib((a0) => run_loop($search_truncatedOf(a0)), 1),
  "search.hitsOf": run_lib((a0) => run_loop($search_hitsOf(a0)), 1),
  "search.finishQuery": run_lib((a0, a1, a2) => run_loop($search_finishQuery(a0, a1, a2)), 3),
  "search.searchOut": run_lib((a0, a1, a2) => run_loop($search_searchOut(a0, a1, a2)), 3),
  charStr: run_lib((a0) => str_out(run_loop($charStr(str_in(a0)))), 1),
  pageOf: run_lib((a0) => run_loop($pageOf(a0)), 1),
  cueLenOf: run_lib((a0) => run_loop($cueLenOf(a0)), 1),
  maxPage: run_lib(() => run_loop($maxPage()), 0),
  maxCandidate: run_lib(() => run_loop($maxCandidate()), 0),
  refLabel: run_lib((a0, a1) => str_out(run_loop($refLabel(str_in(a0), nat_in(a1)))), 2),
  refTitle: run_lib((a0, a1) => str_out(run_loop($refTitle(str_in(a0), nat_in(a1)))), 2),
  refAria: run_lib((a0, a1) => str_out(run_loop($refAria(str_in(a0), nat_in(a1)))), 2),
  fitName: run_lib((a0) => str_out(run_loop($fitName(str_in(a0)))), 1),
  "knownName.facts": run_lib((a0, a1) => run_loop($knownName_facts(a0, str_in(a1))), 2),
  "knownName.pickNone": run_lib((a0, a1) => run_loop($knownName_pickNone(a0, str_in(a1))), 2),
  "knownName.pick": run_lib((a0, a1, a2) => run_loop($knownName_pick(a0, a1, str_in(a2))), 3),
  "knownName.go": run_lib((a0, a1, a2, a3) => run_loop($knownName_go(str_in(a0), a1, a2, a3)), 4),
  "knownName.empty": run_lib((a0, a1, a2) => run_loop($knownName_empty(a0, str_in(a1), a2)), 3),
  knownName: run_lib((a0, a1) => run_loop($knownName(str_in(a0), a1)), 2),
  cueMarkers: run_lib(() => run_loop($cueMarkers()), 0),
  isSeparator: run_lib((a0) => run_loop($isSeparator(str_in(a0))), 1),
  "sep.stop": run_lib((a0) => run_loop($sep_stop(a0)), 1),
  "sep.bump": run_lib((a0, a1) => run_loop($sep_bump(nat_in(a0), a1)), 2),
  "sep.go": run_lib((a0, a1, a2) => run_loop($sep_go(str_in(a0), a1, nat_in(a2))), 3),
  sepAt: run_lib((a0) => run_loop($sepAt(str_in(a0))), 1),
  "spaces.stop": run_lib((a0) => run_loop($spaces_stop(a0)), 1),
  "spaces.bump": run_lib((a0, a1) => run_loop($spaces_bump(nat_in(a0), a1)), 2),
  "spaces.go": run_lib((a0, a1, a2) => run_loop($spaces_go(str_in(a0), a1, nat_in(a2))), 3),
  spacesAt: run_lib((a0) => run_loop($spacesAt(str_in(a0))), 1),
  digitVal: run_lib((a0) => run_loop($digitVal(str_in(a0))), 1),
  "digits.stop": run_lib((a0) => run_loop($digits_stop(a0)), 1),
  "digits.acc": run_lib((a0, a1, a2, a3) => run_loop($digits_acc(nat_in(a0), nat_in(a1), a2, nat_in(a3))), 4),
  "digits.count": run_lib((a0, a1) => run_loop($digits_count(nat_in(a0), a1)), 2),
  "digits.go": run_lib((a0, a1, a2, a3) => run_loop($digits_go(str_in(a0), a1, nat_in(a2), nat_in(a3))), 4),
  readDigits: run_lib((a0) => run_loop($readDigits(str_in(a0))), 1),
  pageOk: run_lib((a0) => run_loop($pageOk(nat_in(a0))), 1),
  "cueAfter.valid": run_lib((a0, a1, a2) => run_loop($cueAfter_valid(nat_in(a0), a1, nat_in(a2))), 3),
  "cueAfter.any": run_lib((a0, a1, a2) => run_loop($cueAfter_any(a0, nat_in(a1), nat_in(a2))), 3),
  "cueAfter.pick": run_lib((a0, a1, a2, a3) => run_loop($cueAfter_pick(nat_in(a0), nat_in(a1), nat_in(a2), nat_in(a3))), 4),
  "cueAfter.pair": run_lib((a0, a1, a2) => run_loop($cueAfter_pair(a0, nat_in(a1), nat_in(a2))), 3),
  cueAfter: run_lib((a0, a1) => run_loop($cueAfter(str_in(a0), nat_in(a1))), 2),
  "tryMarker.hit": run_lib((a0, a1, a2, a3) => run_loop($tryMarker_hit(a0, str_in(a1), nat_in(a2), nat_in(a3))), 4),
  tryMarker: run_lib((a0, a1, a2) => run_loop($tryMarker(str_in(a0), nat_in(a1), str_in(a2))), 3),
  "tryMarkers.pick": run_lib((a0, a1) => run_loop($tryMarkers_pick(a0, a1)), 2),
  tryMarkers: run_lib((a0, a1, a2, a3) => run_loop($tryMarkers(str_in(a0), nat_in(a1), a2, a3)), 4),
  cueFrom: run_lib((a0) => run_loop($cueFrom(str_in(a0))), 1)
};
export {
  pdfref_default as default
};

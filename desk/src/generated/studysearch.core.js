// GERADO de core/studysearch.bend por `bun core/build.mjs` — não editar à mão.
// core/studysearch.bend
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
function $sourceKey(_s_0) {
  if (_s_0.$ === "HsConv") {
    return "conversa";
  } else if (_s_0.$ === "HsSide") {
    return "lateral";
  } else if (_s_0.$ === "HsNote") {
    return "nota";
  } else if (_s_0.$ === "HsReview") {
    return "caderno";
  } else if (_s_0.$ === "HsFree") {
    return "livre";
  } else if (_s_0.$ === "HsMaterial") {
    return "materia";
  } else {
    return "pdf";
  }
}
function $sourceLabel(_s_0) {
  if (_s_0.$ === "HsConv") {
    return $msg_msg("search.source.conv");
  } else if (_s_0.$ === "HsSide") {
    return $msg_msg("search.source.side");
  } else if (_s_0.$ === "HsNote") {
    return $msg_msg("search.source.note");
  } else if (_s_0.$ === "HsReview") {
    return $msg_msg("search.source.review");
  } else if (_s_0.$ === "HsFree") {
    return $msg_msg("search.source.free");
  } else if (_s_0.$ === "HsMaterial") {
    return $msg_msg("search.source.material");
  } else {
    return $msg_msg("search.source.pdf");
  }
}
function $needsPdfAuth(_s_0) {
  if (_s_0.$ === "HsPdf") {
    return true;
  } else {
    return false;
  }
}
function $allowed(_s_0, _runtimeOk_0, _courseOk_0, _pdfAuth_0) {
  if (_s_0.$ === "HsPdf") {
    return $Bool_and(_runtimeOk_0, $Bool_and(_courseOk_0, _pdfAuth_0));
  } else if (_s_0.$ === "HsMaterial") {
    return _courseOk_0;
  } else {
    return _runtimeOk_0;
  }
}
function $pathTrusted(_inLibrary_0, _fromRenderer_0) {
  return _inLibrary_0;
}
function $minQueryChars() {
  return 2;
}
function $maxQueryChars() {
  return 80;
}
function $defaultLimit() {
  return 30;
}
function $maxLimit() {
  return 50;
}
function $maxHits() {
  return 200;
}
function $maxFiles() {
  return 400;
}
function $maxPerConversation() {
  return 4;
}
function $maxPerFile() {
  return 3;
}
function $maxSnippetChars() {
  return 160;
}
function $maxFileBytes() {
  return 8388608;
}
function $timeBudgetMs() {
  return 2500;
}
function $clampLimit_cap(_overMax_0, _n_0) {
  if (_overMax_0) {
    return $maxLimit();
  } else {
    return _n_0;
  }
}
function $clampLimit(_invalid_0, _overMax_0, _n_0) {
  if (_invalid_0) {
    return $defaultLimit();
  } else {
    return $clampLimit_cap(_overMax_0, _n_0);
  }
}
function $matches(_hay_0, _needle_0) {
  return $search_matches(_hay_0, _needle_0);
}
function $clipText(_cutStart_0, _cutEnd_0, _body_0) {
  return $search_snippet(_cutStart_0, _cutEnd_0, _body_0);
}
function $best_any(_titleHit_0, _startHit_0, _wordHit_0) {
  if (_wordHit_0) {
    return { $: "RankWord" };
  } else {
    return { $: "RankAny" };
  }
}
function $best_start(_titleHit_0, _startHit_0, _wordHit_0) {
  if (_startHit_0) {
    return { $: "RankStart" };
  } else {
    return $best_any(_titleHit_0, false, _wordHit_0);
  }
}
function $best(_titleHit_0, _startHit_0, _wordHit_0) {
  if (_titleHit_0) {
    return { $: "RankTitle" };
  } else {
    return $best_start(false, _startHit_0, _wordHit_0);
  }
}
function $rankWeight(_r_0) {
  if (_r_0.$ === "RankTitle") {
    return 3;
  } else if (_r_0.$ === "RankStart") {
    return 2;
  } else if (_r_0.$ === "RankWord") {
    return 1;
  } else {
    return 0;
  }
}
function $better(_a_0, _b_0) {
  if (_a_0.$ === "RankTitle") {
    if (_b_0.$ === "RankTitle") {
      return false;
    } else {
      return true;
    }
  } else if (_a_0.$ === "RankStart") {
    if (_b_0.$ === "RankTitle") {
      return false;
    } else {
      return true;
    }
  } else if (_a_0.$ === "RankWord") {
    if (_b_0.$ === "RankTitle") {
      return false;
    } else if (_b_0.$ === "RankStart") {
      return false;
    } else {
      return true;
    }
  } else {
    return false;
  }
}
function $dialogTitle() {
  return $msg_msg("search.title");
}
function $searchPlaceholder() {
  return $msg_msg("search.placeholder");
}
function $searchLabel() {
  return $msg_msg("search.label");
}
function $searchButton() {
  return $msg_msg("common.search");
}
function $sourcesLabel() {
  return $msg_msg("search.sources");
}
function $coursesLabel() {
  return $msg_msg("search.courses");
}
function $allSourcesLabel() {
  return $msg_msg("search.allSources");
}
function $clearFiltersLabel() {
  return $msg_msg("search.clear");
}
function $pdfScopeHint() {
  return $msg_msg("search.pdfScope");
}
function $allCoursesLabel() {
  return $msg_msg("common.allCourses");
}
function $hintText() {
  return $msg_msg("search.hint");
}
function $shortQueryText() {
  return $msg_msg("search.short");
}
function $searchingText() {
  return $msg_msg("search.searching");
}
function $emptyText() {
  return $msg_msg("search.empty");
}
function $truncatedText() {
  return $msg_msg("search.truncated");
}
function $openLabel() {
  return $msg_msg("search.open");
}
function $closeLabel() {
  return $msg_msg("common.close");
}
function $noteLabel() {
  return $msg_msg("search.note");
}
function $countText_one(_n_0) {
  if (_n_0 === 0) {
    const _n_1 = _n_0 - 0;
    return $msg_msg1("search.count", "count", $Nat_show(_n_1));
  } else if (_n_0 === 1) {
    return $msg_msg1("search.count", "count", "1");
  } else {
    const _5_0 = _n_0 - 1;
    return $msg_msg1("search.count", "count", $Nat_show(nat_chk(_5_0 + 1)));
  }
}
function $countText(_n_0) {
  return $countText_one(_n_0);
}
function $pageLabel(_page_0) {
  return $msg_msg1("common.pageShort", "page", $Nat_show(_page_0));
}
function $nowLabel() {
  return $msg_msg("search.now");
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
var studysearch_default = {
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
  sourceKey: run_lib((a0) => str_out(run_loop($sourceKey(a0))), 1),
  sourceLabel: run_lib((a0) => str_out(run_loop($sourceLabel(a0))), 1),
  needsPdfAuth: run_lib((a0) => run_loop($needsPdfAuth(a0)), 1),
  allowed: run_lib((a0, a1, a2, a3) => run_loop($allowed(a0, a1, a2, a3)), 4),
  pathTrusted: run_lib((a0, a1) => run_loop($pathTrusted(a0, a1)), 2),
  minQueryChars: run_lib(() => run_loop($minQueryChars()), 0),
  maxQueryChars: run_lib(() => run_loop($maxQueryChars()), 0),
  defaultLimit: run_lib(() => run_loop($defaultLimit()), 0),
  maxLimit: run_lib(() => run_loop($maxLimit()), 0),
  maxHits: run_lib(() => run_loop($maxHits()), 0),
  maxFiles: run_lib(() => run_loop($maxFiles()), 0),
  maxPerConversation: run_lib(() => run_loop($maxPerConversation()), 0),
  maxPerFile: run_lib(() => run_loop($maxPerFile()), 0),
  maxSnippetChars: run_lib(() => run_loop($maxSnippetChars()), 0),
  maxFileBytes: run_lib(() => run_loop($maxFileBytes()), 0),
  timeBudgetMs: run_lib(() => run_loop($timeBudgetMs()), 0),
  "clampLimit.cap": run_lib((a0, a1) => run_loop($clampLimit_cap(a0, nat_in(a1))), 2),
  clampLimit: run_lib((a0, a1, a2) => run_loop($clampLimit(a0, a1, nat_in(a2))), 3),
  matches: run_lib((a0, a1) => run_loop($matches(str_in(a0), str_in(a1))), 2),
  clipText: run_lib((a0, a1, a2) => str_out(run_loop($clipText(a0, a1, str_in(a2)))), 3),
  "best.any": run_lib((a0, a1, a2) => run_loop($best_any(a0, a1, a2)), 3),
  "best.start": run_lib((a0, a1, a2) => run_loop($best_start(a0, a1, a2)), 3),
  best: run_lib((a0, a1, a2) => run_loop($best(a0, a1, a2)), 3),
  rankWeight: run_lib((a0) => run_loop($rankWeight(a0)), 1),
  better: run_lib((a0, a1) => run_loop($better(a0, a1)), 2),
  dialogTitle: run_lib(() => str_out(run_loop($dialogTitle())), 0),
  searchPlaceholder: run_lib(() => str_out(run_loop($searchPlaceholder())), 0),
  searchLabel: run_lib(() => str_out(run_loop($searchLabel())), 0),
  searchButton: run_lib(() => str_out(run_loop($searchButton())), 0),
  sourcesLabel: run_lib(() => str_out(run_loop($sourcesLabel())), 0),
  coursesLabel: run_lib(() => str_out(run_loop($coursesLabel())), 0),
  allSourcesLabel: run_lib(() => str_out(run_loop($allSourcesLabel())), 0),
  clearFiltersLabel: run_lib(() => str_out(run_loop($clearFiltersLabel())), 0),
  pdfScopeHint: run_lib(() => str_out(run_loop($pdfScopeHint())), 0),
  allCoursesLabel: run_lib(() => str_out(run_loop($allCoursesLabel())), 0),
  hintText: run_lib(() => str_out(run_loop($hintText())), 0),
  shortQueryText: run_lib(() => str_out(run_loop($shortQueryText())), 0),
  searchingText: run_lib(() => str_out(run_loop($searchingText())), 0),
  emptyText: run_lib(() => str_out(run_loop($emptyText())), 0),
  truncatedText: run_lib(() => str_out(run_loop($truncatedText())), 0),
  openLabel: run_lib(() => str_out(run_loop($openLabel())), 0),
  closeLabel: run_lib(() => str_out(run_loop($closeLabel())), 0),
  noteLabel: run_lib(() => str_out(run_loop($noteLabel())), 0),
  "countText.one": run_lib((a0) => str_out(run_loop($countText_one(nat_in(a0)))), 1),
  countText: run_lib((a0) => str_out(run_loop($countText(nat_in(a0)))), 1),
  pageLabel: run_lib((a0) => str_out(run_loop($pageLabel(nat_in(a0)))), 1),
  nowLabel: run_lib(() => str_out(run_loop($nowLabel())), 0)
};
export {
  studysearch_default as default
};

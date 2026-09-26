// GERADO de core/pdfref.bend por `bun core/build.mjs` — não editar à mão.
// core/pdfref.bend
function u32_to_word(x) {
  let w = { $: "WNil" };
  for (let i = 31;i >= 0; i--) {
    w = { $: "WCon", head: (x >>> i & 1) === 1, tail: w };
  }
  return w;
}
function cmp_new(a, b) {
  return { $: a < b ? "LT" : a === b ? "EQ" : "GT" };
}
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
function $search$minQueryChars$() {
  return 2n;
}
function $search$maxQueryChars$() {
  return 80n;
}
function $search$defaultLimit$() {
  return 30n;
}
function $search$maxLimit$() {
  return 50n;
}
function $search$maxTotalHits$() {
  return 200n;
}
function $search$maxFiles$() {
  return BigInt(300);
}
function $search$charStr$(_c_0) {
  return _c_0 + "";
}
function $search$combining$(_code_0) {
  return run_jump($Bool$and$, [_code_0 >= 768, _code_0 <= 879]);
}
function $search$asciiUpper$(_code_0) {
  return run_jump($Bool$and$, [_code_0 >= 65, _code_0 <= 90]);
}
function $search$foldChar$ascii$(_code_0) {
  return run_jump($search$charStr$, [run_loop($Char$from_u32$(_code_0 + 32 >>> 0))]);
}
function $search$foldChar$latin$(_c_0, _code_0) {
  if (_code_0 == 192) {
    return "a";
  } else if (_code_0 == 224) {
    return "a";
  } else if ((_code_0 & 15) == 0) {
    const _17_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["head"];
    const _18_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"];
    return run_jump($search$charStr$, [_c_0]);
  } else if (_code_0 == 200) {
    return "e";
  } else if (_code_0 == 232) {
    return "e";
  } else if ((_code_0 & 15) == 8) {
    const _125_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["head"];
    const _126_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"];
    return run_jump($search$charStr$, [_c_0]);
  } else if (_code_0 == 196) {
    return "a";
  } else if ((_code_0 & 63) == 4) {
    const _239_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["head"];
    const _240_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["tail"];
    return run_jump($search$charStr$, [_c_0]);
  } else if (_code_0 == 228) {
    return "a";
  } else if ((_code_0 & 63) == 36) {
    const _291_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["head"];
    const _292_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["tail"];
    return run_jump($search$charStr$, [_c_0]);
  } else if (_code_0 == 212) {
    return "o";
  } else if ((_code_0 & 63) == 20) {
    const _345_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["head"];
    const _346_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["tail"];
    return run_jump($search$charStr$, [_c_0]);
  } else if (_code_0 == 244) {
    return "o";
  } else if ((_code_0 & 63) == 52) {
    const _397_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["head"];
    const _398_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["tail"];
    return run_jump($search$charStr$, [_c_0]);
  } else if (_code_0 == 204) {
    return "i";
  } else if ((_code_0 & 63) == 12) {
    const _453_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["head"];
    const _454_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["tail"];
    return run_jump($search$charStr$, [_c_0]);
  } else if (_code_0 == 236) {
    return "i";
  } else if ((_code_0 & 63) == 44) {
    const _505_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["head"];
    const _506_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["tail"];
    return run_jump($search$charStr$, [_c_0]);
  } else if (_code_0 == 220) {
    return "u";
  } else if ((_code_0 & 63) == 28) {
    const _559_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["head"];
    const _560_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["tail"];
    return run_jump($search$charStr$, [_c_0]);
  } else if (_code_0 == 252) {
    return "u";
  } else if ((_code_0 & 63) == 60) {
    const _611_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["head"];
    const _612_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["tail"];
    return run_jump($search$charStr$, [_c_0]);
  } else if (_code_0 == 194) {
    return "a";
  } else if ((_code_0 & 63) == 2) {
    const _671_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["head"];
    const _672_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["tail"];
    return run_jump($search$charStr$, [_c_0]);
  } else if (_code_0 == 226) {
    return "a";
  } else if ((_code_0 & 63) == 34) {
    const _723_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["head"];
    const _724_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["tail"];
    return run_jump($search$charStr$, [_c_0]);
  } else if (_code_0 == 210) {
    return "o";
  } else if ((_code_0 & 63) == 18) {
    const _777_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["head"];
    const _778_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["tail"];
    return run_jump($search$charStr$, [_c_0]);
  } else if (_code_0 == 242) {
    return "o";
  } else if ((_code_0 & 63) == 50) {
    const _829_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["head"];
    const _830_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["tail"];
    return run_jump($search$charStr$, [_c_0]);
  } else if (_code_0 == 202) {
    return "e";
  } else if ((_code_0 & 63) == 10) {
    const _885_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["head"];
    const _886_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["tail"];
    return run_jump($search$charStr$, [_c_0]);
  } else if (_code_0 == 234) {
    return "e";
  } else if ((_code_0 & 63) == 42) {
    const _937_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["head"];
    const _938_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["tail"];
    return run_jump($search$charStr$, [_c_0]);
  } else if (_code_0 == 218) {
    return "u";
  } else if ((_code_0 & 63) == 26) {
    const _991_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["head"];
    const _992_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["tail"];
    return run_jump($search$charStr$, [_c_0]);
  } else if (_code_0 == 250) {
    return "u";
  } else if ((_code_0 & 63) == 58) {
    const _1043_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["head"];
    const _1044_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["tail"];
    return run_jump($search$charStr$, [_c_0]);
  } else if (_code_0 == 206) {
    return "i";
  } else if (_code_0 == 238) {
    return "i";
  } else if ((_code_0 & 15) == 14) {
    const _1097_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["head"];
    const _1098_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"];
    return run_jump($search$charStr$, [_c_0]);
  } else if (_code_0 == 214) {
    return "o";
  } else if (_code_0 == 246) {
    return "o";
  } else if ((_code_0 & 15) == 6) {
    const _1205_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["head"];
    const _1206_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"];
    return run_jump($search$charStr$, [_c_0]);
  } else if (_code_0 == 193) {
    return "a";
  } else if ((_code_0 & 63) == 1) {
    const _1323_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["head"];
    const _1324_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["tail"];
    return run_jump($search$charStr$, [_c_0]);
  } else if (_code_0 == 225) {
    return "a";
  } else if ((_code_0 & 63) == 33) {
    const _1375_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["head"];
    const _1376_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["tail"];
    return run_jump($search$charStr$, [_c_0]);
  } else if (_code_0 == 209) {
    return "n";
  } else if ((_code_0 & 63) == 17) {
    const _1429_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["head"];
    const _1430_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["tail"];
    return run_jump($search$charStr$, [_c_0]);
  } else if (_code_0 == 241) {
    return "n";
  } else if ((_code_0 & 63) == 49) {
    const _1481_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["head"];
    const _1482_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["tail"];
    return run_jump($search$charStr$, [_c_0]);
  } else if (_code_0 == 201) {
    return "e";
  } else if ((_code_0 & 63) == 9) {
    const _1537_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["head"];
    const _1538_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["tail"];
    return run_jump($search$charStr$, [_c_0]);
  } else if (_code_0 == 233) {
    return "e";
  } else if ((_code_0 & 63) == 41) {
    const _1589_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["head"];
    const _1590_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["tail"];
    return run_jump($search$charStr$, [_c_0]);
  } else if (_code_0 == 217) {
    return "u";
  } else if ((_code_0 & 63) == 25) {
    const _1643_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["head"];
    const _1644_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["tail"];
    return run_jump($search$charStr$, [_c_0]);
  } else if (_code_0 == 249) {
    return "u";
  } else if ((_code_0 & 63) == 57) {
    const _1695_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["head"];
    const _1696_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["tail"];
    return run_jump($search$charStr$, [_c_0]);
  } else if (_code_0 == 197) {
    return "a";
  } else if ((_code_0 & 63) == 5) {
    const _1753_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["head"];
    const _1754_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["tail"];
    return run_jump($search$charStr$, [_c_0]);
  } else if (_code_0 == 229) {
    return "a";
  } else if ((_code_0 & 63) == 37) {
    const _1805_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["head"];
    const _1806_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["tail"];
    return run_jump($search$charStr$, [_c_0]);
  } else if (_code_0 == 213) {
    return "o";
  } else if ((_code_0 & 63) == 21) {
    const _1859_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["head"];
    const _1860_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["tail"];
    return run_jump($search$charStr$, [_c_0]);
  } else if (_code_0 == 245) {
    return "o";
  } else if ((_code_0 & 63) == 53) {
    const _1911_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["head"];
    const _1912_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["tail"];
    return run_jump($search$charStr$, [_c_0]);
  } else if (_code_0 == 205) {
    return "i";
  } else if ((_code_0 & 63) == 13) {
    const _1967_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["head"];
    const _1968_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["tail"];
    return run_jump($search$charStr$, [_c_0]);
  } else if (_code_0 == 237) {
    return "i";
  } else if ((_code_0 & 63) == 45) {
    const _2019_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["head"];
    const _2020_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["tail"];
    return run_jump($search$charStr$, [_c_0]);
  } else if (_code_0 == 221) {
    return "y";
  } else if ((_code_0 & 63) == 29) {
    const _2073_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["head"];
    const _2074_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["tail"];
    return run_jump($search$charStr$, [_c_0]);
  } else if (_code_0 == 253) {
    return "y";
  } else if ((_code_0 & 63) == 61) {
    const _2125_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["head"];
    const _2126_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["tail"];
    return run_jump($search$charStr$, [_c_0]);
  } else if (_code_0 == 195) {
    return "a";
  } else if ((_code_0 & 63) == 3) {
    const _2185_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["head"];
    const _2186_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["tail"];
    return run_jump($search$charStr$, [_c_0]);
  } else if (_code_0 == 227) {
    return "a";
  } else if ((_code_0 & 63) == 35) {
    const _2237_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["head"];
    const _2238_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["tail"];
    return run_jump($search$charStr$, [_c_0]);
  } else if (_code_0 == 211) {
    return "o";
  } else if ((_code_0 & 63) == 19) {
    const _2291_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["head"];
    const _2292_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["tail"];
    return run_jump($search$charStr$, [_c_0]);
  } else if (_code_0 == 243) {
    return "o";
  } else if ((_code_0 & 63) == 51) {
    const _2343_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["head"];
    const _2344_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["tail"];
    return run_jump($search$charStr$, [_c_0]);
  } else if (_code_0 == 203) {
    return "e";
  } else if ((_code_0 & 63) == 11) {
    const _2399_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["head"];
    const _2400_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["tail"];
    return run_jump($search$charStr$, [_c_0]);
  } else if (_code_0 == 235) {
    return "e";
  } else if ((_code_0 & 63) == 43) {
    const _2451_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["head"];
    const _2452_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["tail"];
    return run_jump($search$charStr$, [_c_0]);
  } else if (_code_0 == 219) {
    return "u";
  } else if ((_code_0 & 63) == 27) {
    const _2505_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["head"];
    const _2506_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["tail"];
    return run_jump($search$charStr$, [_c_0]);
  } else if (_code_0 == 251) {
    return "u";
  } else if ((_code_0 & 63) == 59) {
    const _2557_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["head"];
    const _2558_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["tail"];
    return run_jump($search$charStr$, [_c_0]);
  } else if (_code_0 == 199) {
    return "c";
  } else if (_code_0 == 231) {
    return "c";
  } else if ((_code_0 & 15) == 7) {
    const _2611_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["head"];
    const _2612_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"];
    return run_jump($search$charStr$, [_c_0]);
  } else if (_code_0 == 207) {
    return "i";
  } else if ((_code_0 & 63) == 15) {
    const _2723_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["head"];
    const _2724_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["tail"];
    return run_jump($search$charStr$, [_c_0]);
  } else if (_code_0 == 239) {
    return "i";
  } else if ((_code_0 & 63) == 47) {
    const _2775_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["head"];
    const _2776_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"]["tail"];
    return run_jump($search$charStr$, [_c_0]);
  } else if (_code_0 == 255) {
    return "y";
  } else {
    const _2827_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["head"];
    const _2828_0 = u32_to_word(_code_0)["tail"]["tail"]["tail"]["tail"]["tail"]["tail"];
    return run_jump($search$charStr$, [_c_0]);
  }
}
function $search$foldChar$case$(_c_0, _code_0, _upper_0) {
  if (_upper_0) {
    return run_jump($search$foldChar$ascii$, [_code_0]);
  } else {
    return run_jump($search$foldChar$latin$, [_c_0, _code_0]);
  }
}
function $search$foldChar$strip$(_c_0, _code_0, _isMark_0) {
  if (_isMark_0) {
    return "";
  } else {
    return run_jump($search$foldChar$case$, [_c_0, _code_0, run_loop($search$asciiUpper$(_code_0))]);
  }
}
function $search$foldChar$go$(_c_0, _code_0) {
  return run_jump($search$foldChar$strip$, [_c_0, _code_0, run_loop($search$combining$(_code_0))]);
}
function $search$foldChar$(_c_0) {
  return run_jump($search$foldChar$go$, [_c_0, run_loop($Char$to_u32$(_c_0))]);
}
function $search$fold$go$(_s_0, _acc_0) {
  if (_s_0 === "") {
    return _acc_0;
  } else {
    const _h_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(0, 2) : _s_0[0];
    const _t_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(2) : _s_0.slice(1);
    const _x_0 = run_loop($search$foldChar$(_h_0));
    return run_jump($search$fold$go$, [_t_0, _acc_0 + _x_0]);
  }
}
function $search$fold$(_s_0) {
  return run_jump($search$fold$go$, [_s_0, ""]);
}
function $search$matches$empty$(_emptyHay_0, _emptyNeedle_0, _hay_0, _needle_0) {
  if (_emptyHay_0) {
    return false;
  } else {
    if (_emptyNeedle_0) {
      return false;
    } else {
      return run_jump($String$contains$, [_hay_0, _needle_0]);
    }
  }
}
function $search$matches$(_hay_0, _needle_0) {
  const _h_0 = run_loop($search$fold$(_hay_0));
  const _n_0 = run_loop($search$fold$(run_loop($String$trim$(_needle_0))));
  return run_jump($search$matches$empty$, [run_loop($String$is_empty$(_h_0)), run_loop($String$is_empty$(_n_0)), _h_0, _n_0]);
}
function $search$snippet$start$(_cut_0, _core_0) {
  if (_cut_0) {
    return "…" + _core_0;
  } else {
    return _core_0;
  }
}
function $search$snippet$end$(_cut_0, _s_0) {
  if (_cut_0) {
    return _s_0 + "…";
  } else {
    return _s_0;
  }
}
function $search$snippet$(_cutStart_0, _cutEnd_0, _core_0) {
  return run_jump($search$snippet$end$, [_cutEnd_0, run_loop($search$snippet$start$(_cutStart_0, _core_0))]);
}
function $search$clampLimit$cap$(_overMax_0, _n_0) {
  if (_overMax_0) {
    return 50n;
  } else {
    return _n_0;
  }
}
function $search$clampLimit$(_invalid_0, _overMax_0, _n_0) {
  if (_invalid_0) {
    return 30n;
  } else {
    return run_jump($search$clampLimit$cap$, [_overMax_0, _n_0]);
  }
}
function $search$keepRole$assistant$(_isAssistant_0) {
  if (_isAssistant_0) {
    return { $: "Some", ["value"]: { $: "MsgAssistant" } };
  } else {
    return { $: "None" };
  }
}
function $search$keepRole$(_isUser_0, _isAssistant_0) {
  if (_isUser_0) {
    return { $: "Some", ["value"]: { $: "MsgUser" } };
  } else {
    return run_jump($search$keepRole$assistant$, [_isAssistant_0]);
  }
}
function $search$fileAct$large$(_tooLarge_0) {
  if (_tooLarge_0) {
    return { $: "ActSkip" };
  } else {
    return { $: "ActScan" };
  }
}
function $search$fileAct$files$(_atFileCap_0, _tooLarge_0) {
  if (_atFileCap_0) {
    return { $: "ActStop" };
  } else {
    return run_jump($search$fileAct$large$, [_tooLarge_0]);
  }
}
function $search$fileAct$time$(_timedOut_0, _atFileCap_0, _tooLarge_0) {
  if (_timedOut_0) {
    return { $: "ActStop" };
  } else {
    return run_jump($search$fileAct$files$, [_atFileCap_0, _tooLarge_0]);
  }
}
function $search$fileAct$(_atHitCap_0, _timedOut_0, _atFileCap_0, _tooLarge_0) {
  if (_atHitCap_0) {
    return { $: "ActStop" };
  } else {
    return run_jump($search$fileAct$time$, [_timedOut_0, _atFileCap_0, _tooLarge_0]);
  }
}
function $search$isStop$(_a_0) {
  if (_a_0.$ === "ActStop") {
    return true;
  } else if (_a_0.$ === "ActSkip") {
    return false;
  } else {
    return false;
  }
}
function $search$withTruncated$(_was_0, _act_0) {
  if (_act_0.$ === "ActStop") {
    return true;
  } else if (_act_0.$ === "ActSkip") {
    return _was_0;
  } else {
    return _was_0;
  }
}
function $search$stepTruncated$(_was_0, _atHitCap_0, _timedOut_0, _atFileCap_0, _tooLarge_0) {
  return run_jump($search$withTruncated$, [_was_0, run_loop($search$fileAct$(_atHitCap_0, _timedOut_0, _atFileCap_0, _tooLarge_0))]);
}
function $search$takeUntilFull$(_xs_0, _full_0) {
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
        const _fs_0 = _full_0["tail"];
        return { $: "Nil" };
      } else {
        const _fs_1 = _full_0["tail"];
        return { $: "Con", ["head"]: __0, ["tail"]: run_loop($search$takeUntilFull$(__1, _fs_1)) };
      }
    }
  }
}
function $search$anyFull$(_full_0) {
  if (_full_0.$ === "Nil") {
    return false;
  } else {
    const _f_0 = _full_0["head"];
    const _fs_0 = _full_0["tail"];
    const _x_0 = run_loop($search$anyFull$(_fs_0));
    return _f_0 || _x_0;
  }
}
function $search$noneFull$(_xs_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return { $: "Con", ["head"]: false, ["tail"]: run_loop($search$noneFull$(_t_0)) };
  }
}
function $search$openGroup$(_h_0) {
  const _conv_0 = _h_0["conv"];
  const _title_0 = _h_0["title"];
  const _role_0 = _h_0["role"];
  const _clip_0 = _h_0["clip"];
  return { $: "SearchGroup", ["conv"]: _conv_0, ["title"]: _title_0, ["hits"]: { $: "Con", ["head"]: { $: "SearchHit", ["conv"]: _conv_0, ["title"]: _title_0, ["role"]: _role_0, ["clip"]: _clip_0 }, ["tail"]: { $: "Nil" } } };
}
function $search$addHit$(_g_0, _h_0) {
  const _conv_0 = _g_0["conv"];
  const _title_0 = _g_0["title"];
  const _hits_0 = _g_0["hits"];
  return { $: "SearchGroup", ["conv"]: _conv_0, ["title"]: _title_0, ["hits"]: run_loop($List$append$(_hits_0, { $: "Con", ["head"]: _h_0, ["tail"]: { $: "Nil" } })) };
}
function $search$group$go$(_xs_0, _same_0, _g_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Con", ["head"]: _g_0, ["tail"]: { $: "Nil" } };
  } else {
    const __0 = _xs_0["head"];
    const __1 = _xs_0["tail"];
    if (_same_0.$ === "Nil") {
      return { $: "Con", ["head"]: _g_0, ["tail"]: { $: "Nil" } };
    } else {
      const _t_0 = _same_0["head"];
      if (_t_0) {
        const _ss_0 = _same_0["tail"];
        return run_jump($search$group$go$, [__1, _ss_0, run_loop($search$addHit$(_g_0, __0))]);
      } else {
        const _ss_1 = _same_0["tail"];
        return { $: "Con", ["head"]: _g_0, ["tail"]: run_loop($search$group$go$(__1, _ss_1, run_loop($search$openGroup$(__0)))) };
      }
    }
  }
}
function $search$groupHits$(_xs_0, _same_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return run_jump($search$group$go$, [_t_0, _same_0, run_loop($search$openGroup$(_h_0))]);
  }
}
function $search$truncatedOf$(_o_0) {
  const _hits_0 = _o_0["hits"];
  const _truncated_0 = _o_0["truncated"];
  return _truncated_0;
}
function $search$hitsOf$(_o_0) {
  const _hits_0 = _o_0["hits"];
  const _truncated_0 = _o_0["truncated"];
  return _hits_0;
}
function $search$finishQuery$(_tooShort_0, _hits_0, _truncated_0) {
  if (_tooShort_0) {
    return { $: "SearchOut", ["hits"]: { $: "Nil" }, ["truncated"]: false };
  } else {
    return { $: "SearchOut", ["hits"]: _hits_0, ["truncated"]: _truncated_0 };
  }
}
function $search$searchOut$(_tooShort_0, _xs_0, _full_0) {
  return run_jump($search$finishQuery$, [_tooShort_0, run_loop($search$takeUntilFull$(_xs_0, _full_0)), run_loop($search$anyFull$(_full_0))]);
}
function $charStr$(_c_0) {
  return _c_0 + "";
}
function $pageOf$(_c_0) {
  const _page_0 = _c_0["page"];
  const _length_0 = _c_0["length"];
  return _page_0;
}
function $cueLenOf$(_c_0) {
  const _page_0 = _c_0["page"];
  const _length_0 = _c_0["length"];
  return _length_0;
}
function $maxPage$() {
  return BigInt(1e4);
}
function $maxCandidate$() {
  return 200n;
}
function $refLabel$(_name_0, _page_0) {
  const _x_0 = run_loop($Nat$show$(_page_0));
  const _x_1 = ", p. " + _x_0;
  return _name_0 + _x_1;
}
function $refTitle$(_name_0, _page_0) {
  const _x_0 = run_loop($Nat$show$(_page_0));
  const _x_1 = " na p. " + _x_0;
  const _x_2 = _name_0 + _x_1;
  return "Abrir " + _x_2;
}
function $refAria$(_name_0, _page_0) {
  const _x_0 = run_loop($Nat$show$(_page_0));
  const _x_1 = " de " + _name_0;
  const _x_2 = _x_0 + _x_1;
  return "Abrir a página " + _x_2;
}
function $fitName$(_name_0) {
  return run_jump($String$take$, [run_loop($String$trim$(_name_0)), run_loop($maxCandidate$())]);
}
function $knownName$facts$(_names_0, _folded_0) {
  if (_names_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _name_0 = _names_0["head"];
    const _t_0 = _names_0["tail"];
    return { $: "Con", ["head"]: run_loop($String$eq$(run_loop($search$fold$(run_loop($fitName$(_name_0)))), _folded_0)), ["tail"]: run_loop($knownName$facts$(_t_0, _folded_0)) };
  }
}
function $knownName$pickNone$(_hit_0, _name_0) {
  if (_hit_0) {
    return { $: "Some", ["value"]: _name_0 };
  } else {
    return { $: "None" };
  }
}
function $knownName$pick$(_best_0, _hit_0, _name_0) {
  if (_best_0.$ === "Some") {
    const _b_0 = _best_0["value"];
    return { $: "Some", ["value"]: _b_0 };
  } else {
    return run_jump($knownName$pickNone$, [_hit_0, _name_0]);
  }
}
function $knownName$go$(_folded_0, _names_0, _facts_0, _best_0) {
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
      return run_jump($knownName$go$, [_folded_0, _t_0, _fs_0, run_loop($knownName$pick$(_best_0, _hit_0, _name_0))]);
    }
  }
}
function $knownName$empty$(_empty_0, _folded_0, _names_0) {
  if (_empty_0) {
    return { $: "None" };
  } else {
    return run_jump($knownName$go$, [_folded_0, _names_0, run_loop($knownName$facts$(_names_0, _folded_0)), { $: "None" }]);
  }
}
function $knownName$(_candidate_0, _names_0) {
  const _c_0 = run_loop($fitName$(_candidate_0));
  return run_jump($knownName$empty$, [run_loop($String$is_empty$(_c_0)), run_loop($search$fold$(_c_0)), _names_0]);
}
function $cueMarkers$() {
  return { $: "Con", ["head"]: "página ", ["tail"]: { $: "Con", ["head"]: "pág. ", ["tail"]: { $: "Con", ["head"]: "pág ", ["tail"]: { $: "Con", ["head"]: "#page=", ["tail"]: { $: "Con", ["head"]: "p. ", ["tail"]: { $: "Con", ["head"]: "p.", ["tail"]: { $: "Con", ["head"]: "p ", ["tail"]: { $: "Nil" } } } } } } } };
}
function $isSeparator$(_c_0) {
  const _x_0 = run_loop($Char$is_eq$(_c_0, ","));
  const _x_1 = run_loop($Char$is_eq$(_c_0, ";"));
  const _x_2 = run_loop($Char$is_space$(_c_0));
  const _x_3 = _x_0 || _x_1;
  return _x_2 || _x_3;
}
function $sep$stop$(_hit_0) {
  if (_hit_0) {
    return false;
  } else {
    return true;
  }
}
function $sep$bump$(_n_0, _hit_0) {
  if (_hit_0) {
    return nat_chk(_n_0 + 1n);
  } else {
    return _n_0;
  }
}
function $sep$go$(_s_0, _d_0, _n_0) {
  if (_s_0 === "") {
    return _n_0;
  } else {
    const _h_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(0, 2) : _s_0[0];
    const _t_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(2) : _s_0.slice(1);
    if (_d_0) {
      return _n_0;
    } else {
      const _hit_0 = run_loop($isSeparator$(_h_0));
      return run_jump($sep$go$, [_t_0, run_loop($sep$stop$(_hit_0)), run_loop($sep$bump$(_n_0, _hit_0))]);
    }
  }
}
function $sepAt$(_s_0) {
  return run_jump($sep$go$, [_s_0, false, 0n]);
}
function $spaces$stop$(_hit_0) {
  if (_hit_0) {
    return false;
  } else {
    return true;
  }
}
function $spaces$bump$(_n_0, _hit_0) {
  if (_hit_0) {
    return nat_chk(_n_0 + 1n);
  } else {
    return _n_0;
  }
}
function $spaces$go$(_s_0, _d_0, _n_0) {
  if (_s_0 === "") {
    return _n_0;
  } else {
    const _h_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(0, 2) : _s_0[0];
    const _t_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(2) : _s_0.slice(1);
    if (_d_0) {
      return _n_0;
    } else {
      const _hit_0 = run_loop($Char$is_space$(_h_0));
      return run_jump($spaces$go$, [_t_0, run_loop($spaces$stop$(_hit_0)), run_loop($spaces$bump$(_n_0, _hit_0))]);
    }
  }
}
function $spacesAt$(_s_0) {
  return run_jump($spaces$go$, [_s_0, false, 0n]);
}
function $digitVal$(_c_0) {
  const _x_0 = run_loop($Char$to_u32$(_c_0));
  const _x_1 = BigInt(_x_0);
  return _x_1 < 48n ? 0n : _x_1 - 48n;
}
function $digits$stop$(_hit_0) {
  if (_hit_0) {
    return false;
  } else {
    return true;
  }
}
function $digits$acc$(_acc_0, _n_0, _hit_0, _val_0) {
  if (_hit_0) {
    const _x_0 = nat_chk(_acc_0 * 10n);
    return nat_chk(_x_0 + _val_0);
  } else {
    return _acc_0;
  }
}
function $digits$count$(_n_0, _hit_0) {
  if (_hit_0) {
    return nat_chk(_n_0 + 1n);
  } else {
    return _n_0;
  }
}
function $digits$go$(_s_0, _d_0, _acc_0, _n_0) {
  if (_s_0 === "") {
    return { $: "Tuple", ["fst"]: _acc_0, ["snd"]: _n_0 };
  } else {
    const _h_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(0, 2) : _s_0[0];
    const _t_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(2) : _s_0.slice(1);
    if (_d_0) {
      return { $: "Tuple", ["fst"]: _acc_0, ["snd"]: _n_0 };
    } else {
      const _hit_0 = run_loop($Char$is_digit$(_h_0));
      return run_jump($digits$go$, [_t_0, run_loop($digits$stop$(_hit_0)), run_loop($digits$acc$(_acc_0, _n_0, _hit_0, run_loop($digitVal$(_h_0)))), run_loop($digits$count$(_n_0, _hit_0))]);
    }
  }
}
function $readDigits$(_s_0) {
  return run_jump($digits$go$, [_s_0, false, 0n, 0n]);
}
function $pageOk$(_page_0) {
  return run_jump($Bool$and$, [run_loop($Nat$is_ge$(_page_0, 1n)), run_loop($Nat$is_le$(_page_0, run_loop($maxPage$())))]);
}
function $cueAfter$valid$(_page_0, _ok_0, _consumed_0) {
  if (!_ok_0) {
    return { $: "None" };
  } else {
    return { $: "Some", ["value"]: { $: "CiteCue", ["page"]: _page_0, ["length"]: _consumed_0 } };
  }
}
function $cueAfter$any$(_any_0, _page_0, _consumed_0) {
  if (!_any_0) {
    return { $: "None" };
  } else {
    return run_jump($cueAfter$valid$, [_page_0, run_loop($pageOk$(_page_0)), _consumed_0]);
  }
}
function $cueAfter$pick$(_page_0, _digits_0, _before_0, _sp_0) {
  const _x_0 = nat_chk(_sp_0 + _digits_0);
  return run_jump($cueAfter$any$, [run_loop($Nat$is_gt$(_digits_0, 0n)), _page_0, nat_chk(_before_0 + _x_0)]);
}
function $cueAfter$pair$(_d_0, _before_0, _sp_0) {
  const _page_0 = _d_0["fst"];
  const _digits_0 = _d_0["snd"];
  return run_jump($cueAfter$pick$, [_page_0, _digits_0, _before_0, _sp_0]);
}
function $cueAfter$(_rest_0, _before_0) {
  const _sp_0 = run_loop($spacesAt$(_rest_0));
  return run_jump($cueAfter$pair$, [run_loop($readDigits$(run_loop($String$drop$(_rest_0, _sp_0)))), _before_0, _sp_0]);
}
function $tryMarker$hit$(_hit_0, _rest_0, _before_0, _ml_0) {
  if (!_hit_0) {
    return { $: "None" };
  } else {
    return run_jump($cueAfter$, [run_loop($String$drop$(_rest_0, _ml_0)), nat_chk(_before_0 + _ml_0)]);
  }
}
function $tryMarker$(_rest_0, _before_0, _marker_0) {
  const _ml_0 = BigInt([..._marker_0].length);
  return run_jump($tryMarker$hit$, [run_loop($String$starts_with$(_rest_0, _marker_0)), _rest_0, _before_0, _ml_0]);
}
function $tryMarkers$pick$(_found_0, _next_0) {
  if (_found_0.$ === "Some") {
    const _c_0 = _found_0["value"];
    return { $: "Some", ["value"]: _c_0 };
  } else {
    return _next_0;
  }
}
function $tryMarkers$(_rest_0, _before_0, _markers_0, _found_0) {
  if (_markers_0.$ === "Nil") {
    return _found_0;
  } else {
    const _m_0 = _markers_0["head"];
    const _t_0 = _markers_0["tail"];
    return run_jump($tryMarkers$, [_rest_0, _before_0, _t_0, run_loop($tryMarkers$pick$(_found_0, run_loop($tryMarker$(_rest_0, _before_0, _m_0))))]);
  }
}
function $cueFrom$(_text_0) {
  const _n_0 = run_loop($sepAt$(_text_0));
  return run_jump($tryMarkers$, [run_loop($String$drop$(_text_0, _n_0)), _n_0, run_loop($cueMarkers$()), { $: "None" }]);
}
function $Bool$and$(_a_0, _b_0) {
  if (!_a_0) {
    return false;
  } else {
    return _b_0;
  }
}
function $Char$from_u32$(_x_0) {
  return char_new(_x_0);
}
function $Char$to_u32$(_c_0) {
  const _x_0 = _c_0.codePointAt(0);
  return _x_0;
}
function $String$contains$(_s_0, _p_0) {
  if (_s_0 === "") {
    return run_jump($String$is_empty$, [_p_0]);
  } else {
    const _h_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(0, 2) : _s_0[0];
    const _t_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(2) : _s_0.slice(1);
    return run_jump($String$contains$if$, [_t_0, _p_0, run_loop($String$starts_with$(_h_0 + _t_0, _p_0))]);
  }
}
function $String$trim$(_s_0) {
  return run_jump($String$trim_end$, [run_loop($String$trim_start$(_s_0))]);
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
function $List$append$(_xs_0, _ys_0) {
  if (_xs_0.$ === "Nil") {
    return _ys_0;
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return { $: "Con", ["head"]: _h_0, ["tail"]: run_loop($List$append$(_t_0, _ys_0)) };
  }
}
function $Nat$show$(_n_0) {
  const _m_0 = _n_0;
  return run_jump($Nat$show$fin$, [_m_0, "", run_loop($Nat$show$put$(nat_divmod(_m_0, 10n)))]);
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
function $String$eq$(_a_0, _b_0) {
  return run_jump($String$eq$fin$, [run_loop($String$cmp$(_a_0, _b_0))]);
}
function $Char$is_space$(_c_0) {
  const _x_0 = _c_0.codePointAt(0);
  const _x_1 = _x_0 === 32;
  const _x_2 = run_loop($Bool$and$(_x_0 >= 9, _x_0 <= 13));
  return _x_1 || _x_2;
}
function $Char$is_eq$(_a_0, _b_0) {
  const _x_0 = _a_0.codePointAt(0);
  const _y_0 = _b_0.codePointAt(0);
  return _x_0 === _y_0;
}
function $Char$is_digit$(_c_0) {
  const _x_0 = _c_0.codePointAt(0);
  return run_jump($Bool$and$, [_x_0 >= 48, _x_0 <= 57]);
}
function $Nat$is_ge$(_a_0, _b_0) {
  return run_jump($Cmp$is_ge$, [cmp_new(_a_0, _b_0)]);
}
function $Nat$is_le$(_a_0, _b_0) {
  return run_jump($Cmp$is_le$, [cmp_new(_a_0, _b_0)]);
}
function $Nat$is_gt$(_a_0, _b_0) {
  return run_jump($Cmp$is_gt$, [cmp_new(_a_0, _b_0)]);
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
function $String$contains$if$(_t_0, _p_0, _here_0) {
  if (!_here_0) {
    return run_jump($String$contains$, [_t_0, _p_0]);
  } else {
    return true;
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
function $String$eq$fin$(_r_0) {
  const _t_0 = _r_0["fst"];
  const _a2_0 = _t_0["fst"];
  const _b2_0 = _t_0["snd"];
  const _c_0 = _r_0["snd"];
  return run_jump($Cmp$is_eq$, [_c_0]);
}
function $String$cmp$(_a_0, _b_0) {
  if (_a_0 === "") {
    if (_b_0 === "") {
      return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: "", ["snd"]: "" }, ["snd"]: { $: "EQ" } };
    } else {
      const _h_0 = _b_0.codePointAt(0) > 65535 ? _b_0.slice(0, 2) : _b_0[0];
      const _t_0 = _b_0.codePointAt(0) > 65535 ? _b_0.slice(2) : _b_0.slice(1);
      return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: "", ["snd"]: _h_0 + _t_0 }, ["snd"]: { $: "LT" } };
    }
  } else {
    const _h_1 = _a_0.codePointAt(0) > 65535 ? _a_0.slice(0, 2) : _a_0[0];
    const _t_1 = _a_0.codePointAt(0) > 65535 ? _a_0.slice(2) : _a_0.slice(1);
    if (_b_0 === "") {
      return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: _h_1 + _t_1, ["snd"]: "" }, ["snd"]: { $: "GT" } };
    } else {
      const _h2_0 = _b_0.codePointAt(0) > 65535 ? _b_0.slice(0, 2) : _b_0[0];
      const _t2_0 = _b_0.codePointAt(0) > 65535 ? _b_0.slice(2) : _b_0.slice(1);
      return run_jump($String$cmp$fin$, [_t_1, _t2_0, run_loop($Char$cmp$(_h_1, _h2_0))]);
    }
  }
}
function $Cmp$is_ge$(_c_0) {
  if (_c_0.$ === "LT") {
    return false;
  } else if (_c_0.$ === "EQ") {
    return true;
  } else {
    return true;
  }
}
function $Cmp$is_le$(_c_0) {
  if (_c_0.$ === "LT") {
    return true;
  } else if (_c_0.$ === "EQ") {
    return true;
  } else {
    return false;
  }
}
function $Cmp$is_gt$(_c_0) {
  if (_c_0.$ === "LT") {
    return false;
  } else if (_c_0.$ === "EQ") {
    return false;
  } else {
    return true;
  }
}
function $String$starts_with$if$(_t_0, _pt_0, _same_0) {
  if (!_same_0) {
    return false;
  } else {
    return run_jump($String$starts_with$, [_t_0, _pt_0]);
  }
}
function $String$reverse$(_s_0) {
  return run_jump($String$reverse$go$, [_s_0, ""]);
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
function $Cmp$is_eq$(_c_0) {
  if (_c_0.$ === "LT") {
    return false;
  } else if (_c_0.$ === "EQ") {
    return true;
  } else {
    return false;
  }
}
function $String$cmp$fin$(_t1_0, _t2_0, _hc_0) {
  const _t_0 = _hc_0["fst"];
  const _h1b_0 = _t_0["fst"];
  const _h2b_0 = _t_0["snd"];
  const _t_1 = _hc_0["snd"];
  if (_t_1.$ === "LT") {
    return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: _h1b_0 + _t1_0, ["snd"]: _h2b_0 + _t2_0 }, ["snd"]: { $: "LT" } };
  } else if (_t_1.$ === "EQ") {
    return run_jump($String$cmp$rec$, [_h1b_0, _h2b_0, run_loop($String$cmp$(_t1_0, _t2_0))]);
  } else {
    return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: _h1b_0 + _t1_0, ["snd"]: _h2b_0 + _t2_0 }, ["snd"]: { $: "GT" } };
  }
}
function $Char$cmp$(_a_0, _b_0) {
  const _x_0 = _a_0.codePointAt(0);
  const _y_0 = _b_0.codePointAt(0);
  return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: char_new(_x_0), ["snd"]: char_new(_y_0) }, ["snd"]: cmp_new(_x_0, _y_0) };
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
function $String$cmp$rec$(_h1b_0, _h2b_0, _rr_0) {
  const _t_0 = _rr_0["fst"];
  const _t1b_0 = _t_0["fst"];
  const _t2b_0 = _t_0["snd"];
  const _r_0 = _rr_0["snd"];
  return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: _h1b_0 + _t1b_0, ["snd"]: _h2b_0 + _t2b_0 }, ["snd"]: _r_0 };
}
var pdfref_default = {
  "search.minQueryChars": run_lib($search$minQueryChars$, 0),
  "search.maxQueryChars": run_lib($search$maxQueryChars$, 0),
  "search.defaultLimit": run_lib($search$defaultLimit$, 0),
  "search.maxLimit": run_lib($search$maxLimit$, 0),
  "search.maxTotalHits": run_lib($search$maxTotalHits$, 0),
  "search.maxFiles": run_lib($search$maxFiles$, 0),
  "search.charStr": run_lib($search$charStr$, 1),
  "search.combining": run_lib($search$combining$, 1),
  "search.asciiUpper": run_lib($search$asciiUpper$, 1),
  "search.foldChar.ascii": run_lib($search$foldChar$ascii$, 1),
  "search.foldChar.latin": run_lib($search$foldChar$latin$, 2),
  "search.foldChar.case": run_lib($search$foldChar$case$, 3),
  "search.foldChar.strip": run_lib($search$foldChar$strip$, 3),
  "search.foldChar.go": run_lib($search$foldChar$go$, 2),
  "search.foldChar": run_lib($search$foldChar$, 1),
  "search.fold.go": run_lib($search$fold$go$, 2),
  "search.fold": run_lib($search$fold$, 1),
  "search.matches.empty": run_lib($search$matches$empty$, 4),
  "search.matches": run_lib($search$matches$, 2),
  "search.snippet.start": run_lib($search$snippet$start$, 2),
  "search.snippet.end": run_lib($search$snippet$end$, 2),
  "search.snippet": run_lib($search$snippet$, 3),
  "search.clampLimit.cap": run_lib($search$clampLimit$cap$, 2),
  "search.clampLimit": run_lib($search$clampLimit$, 3),
  "search.keepRole.assistant": run_lib($search$keepRole$assistant$, 1),
  "search.keepRole": run_lib($search$keepRole$, 2),
  "search.fileAct.large": run_lib($search$fileAct$large$, 1),
  "search.fileAct.files": run_lib($search$fileAct$files$, 2),
  "search.fileAct.time": run_lib($search$fileAct$time$, 3),
  "search.fileAct": run_lib($search$fileAct$, 4),
  "search.isStop": run_lib($search$isStop$, 1),
  "search.withTruncated": run_lib($search$withTruncated$, 2),
  "search.stepTruncated": run_lib($search$stepTruncated$, 5),
  "search.takeUntilFull": run_lib($search$takeUntilFull$, 2),
  "search.anyFull": run_lib($search$anyFull$, 1),
  "search.noneFull": run_lib($search$noneFull$, 1),
  "search.openGroup": run_lib($search$openGroup$, 1),
  "search.addHit": run_lib($search$addHit$, 2),
  "search.group.go": run_lib($search$group$go$, 3),
  "search.groupHits": run_lib($search$groupHits$, 2),
  "search.truncatedOf": run_lib($search$truncatedOf$, 1),
  "search.hitsOf": run_lib($search$hitsOf$, 1),
  "search.finishQuery": run_lib($search$finishQuery$, 3),
  "search.searchOut": run_lib($search$searchOut$, 3),
  charStr: run_lib($charStr$, 1),
  pageOf: run_lib($pageOf$, 1),
  cueLenOf: run_lib($cueLenOf$, 1),
  maxPage: run_lib($maxPage$, 0),
  maxCandidate: run_lib($maxCandidate$, 0),
  refLabel: run_lib($refLabel$, 2),
  refTitle: run_lib($refTitle$, 2),
  refAria: run_lib($refAria$, 2),
  fitName: run_lib($fitName$, 1),
  "knownName.facts": run_lib($knownName$facts$, 2),
  "knownName.pickNone": run_lib($knownName$pickNone$, 2),
  "knownName.pick": run_lib($knownName$pick$, 3),
  "knownName.go": run_lib($knownName$go$, 4),
  "knownName.empty": run_lib($knownName$empty$, 3),
  knownName: run_lib($knownName$, 2),
  cueMarkers: run_lib($cueMarkers$, 0),
  isSeparator: run_lib($isSeparator$, 1),
  "sep.stop": run_lib($sep$stop$, 1),
  "sep.bump": run_lib($sep$bump$, 2),
  "sep.go": run_lib($sep$go$, 3),
  sepAt: run_lib($sepAt$, 1),
  "spaces.stop": run_lib($spaces$stop$, 1),
  "spaces.bump": run_lib($spaces$bump$, 2),
  "spaces.go": run_lib($spaces$go$, 3),
  spacesAt: run_lib($spacesAt$, 1),
  digitVal: run_lib($digitVal$, 1),
  "digits.stop": run_lib($digits$stop$, 1),
  "digits.acc": run_lib($digits$acc$, 4),
  "digits.count": run_lib($digits$count$, 2),
  "digits.go": run_lib($digits$go$, 4),
  readDigits: run_lib($readDigits$, 1),
  pageOk: run_lib($pageOk$, 1),
  "cueAfter.valid": run_lib($cueAfter$valid$, 3),
  "cueAfter.any": run_lib($cueAfter$any$, 3),
  "cueAfter.pick": run_lib($cueAfter$pick$, 4),
  "cueAfter.pair": run_lib($cueAfter$pair$, 3),
  cueAfter: run_lib($cueAfter$, 2),
  "tryMarker.hit": run_lib($tryMarker$hit$, 4),
  tryMarker: run_lib($tryMarker$, 3),
  "tryMarkers.pick": run_lib($tryMarkers$pick$, 2),
  tryMarkers: run_lib($tryMarkers$, 4),
  cueFrom: run_lib($cueFrom$, 1)
};
export {
  pdfref_default as default
};

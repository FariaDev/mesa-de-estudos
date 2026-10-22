// GERADO de core/accent.bend por `bun core/build.mjs` — não editar à mão.
// core/accent.bend
function cmp_new(a, b) {
  return { $: a < b ? "LT" : a === b ? "EQ" : "GT" };
}
function char_len(s) {
  return s[0] === "\uDC00" ? 4 : s.codePointAt(0) > 65535 ? 2 : 1;
}
function char_code(s) {
  return s.length < 4 ? s.codePointAt(0) : (s.charCodeAt(1) << 22 | s.charCodeAt(2) << 11 | s.charCodeAt(3)) >>> 0;
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
function $accentDefault() {
  return { $: "AccentBlue" };
}
function $accentIf(_hit_0, _found_0, _rest_0) {
  if (_hit_0) {
    return _found_0;
  } else {
    return _rest_0;
  }
}
function $parseAccent(_raw_0, _fallback_0) {
  return $accentIf($String_eq(_raw_0, "blue"), { $: "AccentBlue" }, $accentIf($String_eq(_raw_0, "violet"), { $: "AccentViolet" }, $accentIf($String_eq(_raw_0, "green"), { $: "AccentGreen" }, $accentIf($String_eq(_raw_0, "orange"), { $: "AccentOrange" }, $accentIf($String_eq(_raw_0, "pink"), { $: "AccentPink" }, $accentIf($String_eq(_raw_0, "graphite"), { $: "AccentGraphite" }, _fallback_0))))));
}
function $accentOrDefault(_value_0, _fallback_0) {
  if (_value_0.$ === "None") {
    return _fallback_0;
  } else {
    const _raw_0 = _value_0["value"];
    return $parseAccent(_raw_0, _fallback_0);
  }
}
function $normalizeAccent(_value_0) {
  return $accentOrDefault(_value_0, $accentDefault());
}
function $String_eq(_a_0, _b_0) {
  return $Cmp_is_eq($String_order(_a_0, _b_0));
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
var accent_default = {
  accentDefault: run_lib(() => run_loop($accentDefault()), 0),
  accentIf: run_lib((a0, a1, a2) => run_loop($accentIf(a0, a1, a2)), 3),
  parseAccent: run_lib((a0, a1) => run_loop($parseAccent(str_in(a0), a1)), 2),
  accentOrDefault: run_lib((a0, a1) => run_loop($accentOrDefault(a0, a1)), 2),
  normalizeAccent: run_lib((a0) => run_loop($normalizeAccent(a0)), 1)
};
export {
  accent_default as default
};

// GERADO de core/mesaqolescape.bend por `bun core/build.mjs` — não editar à mão.
// core/mesaqolescape.bend
function cmp_new(a, b) {
  return { $: a < b ? "LT" : a === b ? "EQ" : "GT" };
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
function $tutorAction(_tutor_0) {
  if (_tutor_0) {
    return "tutor";
  } else {
    return "none";
  }
}
function $afterSearch(_search_0, _tutor_0) {
  if (_search_0) {
    return "search";
  } else {
    return $tutorAction(_tutor_0);
  }
}
function $afterCitation(_citation_0, _search_0, _tutor_0) {
  if (_citation_0) {
    return "citation";
  } else {
    return $afterSearch(_search_0, _tutor_0);
  }
}
function $afterPopover(_popover_0, _citation_0, _search_0, _tutor_0) {
  if (_popover_0) {
    return "popover";
  } else {
    return $afterCitation(_citation_0, _search_0, _tutor_0);
  }
}
function $afterMenu(_menu_0, _popover_0, _citation_0, _search_0, _tutor_0) {
  if (_menu_0) {
    return "menu";
  } else {
    return $afterPopover(_popover_0, _citation_0, _search_0, _tutor_0);
  }
}
function $afterPalette(_palette_0, _menu_0, _popover_0, _citation_0, _search_0, _tutor_0) {
  if (_palette_0) {
    return "palette";
  } else {
    return $afterMenu(_menu_0, _popover_0, _citation_0, _search_0, _tutor_0);
  }
}
function $escapeAction(_f_0) {
  const _t_0 = _f_0["dialog"];
  if (_t_0) {
    return "modal";
  } else {
    const _palette_1 = _f_0["palette"];
    const _menu_1 = _f_0["menu"];
    const _popover_1 = _f_0["popover"];
    const _citation_1 = _f_0["citation"];
    const _search_1 = _f_0["search"];
    const _tutor_1 = _f_0["tutor"];
    return $afterPalette(_palette_1, _menu_1, _popover_1, _citation_1, _search_1, _tutor_1);
  }
}
function $stopsTutor(_action_0) {
  return $String_eq(_action_0, "tutor");
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
var mesaqolescape_default = {
  tutorAction: run_lib((a0) => str_out(run_loop($tutorAction(a0))), 1),
  afterSearch: run_lib((a0, a1) => str_out(run_loop($afterSearch(a0, a1))), 2),
  afterCitation: run_lib((a0, a1, a2) => str_out(run_loop($afterCitation(a0, a1, a2))), 3),
  afterPopover: run_lib((a0, a1, a2, a3) => str_out(run_loop($afterPopover(a0, a1, a2, a3))), 4),
  afterMenu: run_lib((a0, a1, a2, a3, a4) => str_out(run_loop($afterMenu(a0, a1, a2, a3, a4))), 5),
  afterPalette: run_lib((a0, a1, a2, a3, a4, a5) => str_out(run_loop($afterPalette(a0, a1, a2, a3, a4, a5))), 6),
  escapeAction: run_lib((a0) => str_out(run_loop($escapeAction(a0))), 1),
  stopsTutor: run_lib((a0) => run_loop($stopsTutor(str_in(a0))), 1)
};
export {
  mesaqolescape_default as default
};

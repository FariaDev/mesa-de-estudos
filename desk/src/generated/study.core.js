// GERADO de core/study.bend por `bun core/build.mjs` — não editar à mão.
// core/study.bend
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
function $endsXopp$(path_0) {
  return run_jump($String$ends_with$, [run_loop($String$to_lower$(path_0)), ".xopp"]);
}
function $restore$xopp$(path_0, xopp_0) {
  if (!xopp_0) {
    return "";
  } else {
    return path_0;
  }
}
function $restore$if$(path_0, exists_0, xopp_0) {
  if (!exists_0) {
    return "";
  } else {
    return run_jump($restore$xopp$, [path_0, xopp_0]);
  }
}
function $restore$whenExists$(path_0) {
  return run_jump($restore$xopp$, [path_0, run_loop($endsXopp$(path_0))]);
}
function $restoreXopp$(path_0, exists_0) {
  if (!exists_0) {
    return "";
  } else {
    return run_jump($restore$whenExists$, [path_0]);
  }
}
function $cleanTitle$(title_0) {
  return run_jump($String$take$, [run_loop($String$trim$(title_0)), 240n]);
}
function $cleanStudy$(title_0, xopp_0, exists_0) {
  return { $: "Study", ["title"]: run_loop($cleanTitle$(title_0)), ["xopp"]: run_loop($restoreXopp$(run_loop($String$trim$(xopp_0)), exists_0)) };
}
function $String$ends_with$(s_0, p_0) {
  return run_jump($String$starts_with$, [run_loop($String$reverse$(s_0)), run_loop($String$reverse$(p_0))]);
}
function $String$to_lower$(s_0) {
  if (s_0 === "") {
    return "";
  } else {
    const h_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(0, 2) : s_0[0];
    const t_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(2) : s_0.slice(1);
    return run_loop($Char$to_lower$(h_0)) + run_loop($String$to_lower$(t_0));
  }
}
function $String$take$(s_0, n_0) {
  if (s_0 === "") {
    return "";
  } else {
    const h_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(0, 2) : s_0[0];
    const t_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(2) : s_0.slice(1);
    if (n_0 === 0n) {
      return "";
    } else {
      const p_0 = n_0 - 1n;
      return h_0 + run_loop($String$take$(t_0, p_0));
    }
  }
}
function $String$trim$(s_0) {
  return run_jump($String$trim_end$, [run_loop($String$trim_start$(s_0))]);
}
function $String$starts_with$(s_0, p_0) {
  if (s_0 === "") {
    if (p_0 === "") {
      return true;
    } else {
      const h_0 = p_0.codePointAt(0) > 65535 ? p_0.slice(0, 2) : p_0[0];
      const t_0 = p_0.codePointAt(0) > 65535 ? p_0.slice(2) : p_0.slice(1);
      return false;
    }
  } else {
    const h_1 = s_0.codePointAt(0) > 65535 ? s_0.slice(0, 2) : s_0[0];
    const t_1 = s_0.codePointAt(0) > 65535 ? s_0.slice(2) : s_0.slice(1);
    if (p_0 === "") {
      return true;
    } else {
      const y_0 = p_0.codePointAt(0) > 65535 ? p_0.slice(0, 2) : p_0[0];
      const yt_0 = p_0.codePointAt(0) > 65535 ? p_0.slice(2) : p_0.slice(1);
      return run_jump($String$starts_with$if$, [t_1, yt_0, run_loop($Char$is_eq$(h_1, y_0))]);
    }
  }
}
function $String$reverse$(s_0) {
  return run_jump($String$reverse$go$, [s_0, ""]);
}
function $Char$to_lower$(c_0) {
  const x_0 = run_loop($Bool$to_u32$(run_loop($Char$is_upper$(c_0))));
  const x_1 = run_loop($Char$to_u32$(c_0));
  const x_2 = Math.imul(x_0, 32) >>> 0;
  return char_new(x_1 + x_2 >>> 0);
}
function $String$trim_end$(s_0) {
  return run_jump($String$reverse$, [run_loop($String$trim_start$(run_loop($String$reverse$(s_0))))]);
}
function $String$trim_start$(s_0) {
  if (s_0 === "") {
    return "";
  } else {
    const h_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(0, 2) : s_0[0];
    const t_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(2) : s_0.slice(1);
    const h_1 = h_0;
    return run_jump($String$trim_start$if$, [h_1, t_0, run_loop($Char$is_space$(h_1))]);
  }
}
function $String$starts_with$if$(t_0, pt_0, same_0) {
  if (!same_0) {
    return false;
  } else {
    return run_jump($String$starts_with$, [t_0, pt_0]);
  }
}
function $Char$is_eq$(a_0, b_0) {
  const x_0 = a_0.codePointAt(0);
  const y_0 = b_0.codePointAt(0);
  return x_0 === y_0;
}
function $String$reverse$go$(s_0, acc_0) {
  if (s_0 === "") {
    return acc_0;
  } else {
    const h_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(0, 2) : s_0[0];
    const t_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(2) : s_0.slice(1);
    return run_jump($String$reverse$go$, [t_0, h_0 + acc_0]);
  }
}
function $Char$to_u32$(c_0) {
  const x_0 = c_0.codePointAt(0);
  return x_0;
}
function $Bool$to_u32$(b_0) {
  if (!b_0) {
    return 0;
  } else {
    return 1;
  }
}
function $Char$is_upper$(c_0) {
  const x_0 = c_0.codePointAt(0);
  const x_1 = x_0;
  return run_jump($Bool$and$, [x_1 >= 65, x_1 <= 90]);
}
function $String$trim_start$if$(h_0, t_0, space_0) {
  if (!space_0) {
    return h_0 + t_0;
  } else {
    return run_jump($String$trim_start$, [t_0]);
  }
}
function $Char$is_space$(c_0) {
  const x_0 = c_0.codePointAt(0);
  const x_1 = x_0;
  const x_2 = x_1 === 32;
  const x_3 = run_loop($Bool$and$(x_1 >= 9, x_1 <= 13));
  return x_2 || x_3;
}
function $Bool$and$(a_0, b_0) {
  if (!a_0) {
    return false;
  } else {
    return b_0;
  }
}
var study_default = {
  endsXopp: run_lib($endsXopp$, 1),
  "restore.xopp": run_lib($restore$xopp$, 2),
  "restore.if": run_lib($restore$if$, 3),
  "restore.whenExists": run_lib($restore$whenExists$, 1),
  restoreXopp: run_lib($restoreXopp$, 2),
  cleanTitle: run_lib($cleanTitle$, 1),
  cleanStudy: run_lib($cleanStudy$, 3)
};
export {
  study_default as default
};

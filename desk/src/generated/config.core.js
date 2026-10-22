// GERADO de core/config.bend por `bun core/build.mjs` — não editar à mão.
// core/config.bend
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
function $orElse(_v_0, _fallback_0) {
  if (_v_0.$ === "None") {
    return _fallback_0;
  } else {
    const _s_0 = _v_0["value"];
    return _s_0;
  }
}
function $ifEmpty(_s_0, _fallback_0, _empty_0) {
  if (_empty_0) {
    return _fallback_0;
  } else {
    return _s_0;
  }
}
function $trimmedOr(_v_0, _fallback_0) {
  const _s_0 = $String_trim($orElse(_v_0, _fallback_0));
  return $ifEmpty(_s_0, _fallback_0, $String_is_empty(_s_0));
}
function $asStringList_put(_s_0, _rest_0, _empty_0) {
  if (_empty_0) {
    return _rest_0;
  } else {
    return { $: "Con", head: _s_0, tail: _rest_0 };
  }
}
function $asStringList(_items_0) {
  if (_items_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _items_0["head"];
    const _t_0 = _items_0["tail"];
    const _s_0 = $String_trim(_h_0);
    return $asStringList_put(_s_0, $asStringList(_t_0), $String_is_empty(_s_0));
  }
}
function $preferOr(_clean_0, _slot_0, _empty_0) {
  if (_empty_0) {
    return _slot_0;
  } else {
    return _clean_0;
  }
}
function $preferOf(_items_0, _slot_0) {
  const _clean_0 = $asStringList(_items_0);
  return $preferOr(_clean_0, _slot_0, $List_is_empty(_clean_0));
}
function $flagOf(_v_0) {
  if (_v_0.$ === "None") {
    return true;
  } else {
    const _b_0 = _v_0["value"];
    return _b_0;
  }
}
function $normalizePanel(_f_0, _slot_0) {
  const _label_0 = _f_0["label"];
  const _prefer_0 = _f_0["prefer"];
  const _toggle_0 = _f_0["toggle"];
  const _slotLabel_0 = _slot_0["label"];
  const _slotPrefer_0 = _slot_0["prefer"];
  const _slotToggle_0 = _slot_0["toggle"];
  return { $: "Panel", label: $trimmedOr(_label_0, _slotLabel_0), prefer: $preferOf(_prefer_0, _slotPrefer_0), toggle: $String_trim($orElse(_toggle_0, _slotToggle_0)) };
}
function $defaultPanel0() {
  return { $: "Panel", label: "Enunciado", prefer: { $: "Con", head: "Limites", tail: { $: "Nil" } }, toggle: "" };
}
function $defaultPanel1() {
  return { $: "Panel", label: "Formulário & apoio", prefer: { $: "Con", head: "Formul", tail: { $: "Nil" } }, toggle: "Formulário" };
}
function $normalizePanel0(_f_0) {
  return $normalizePanel(_f_0, $defaultPanel0());
}
function $normalizePanel1(_f_0) {
  return $normalizePanel(_f_0, $defaultPanel1());
}
function $defaultPanels() {
  return { $: "Con", head: $defaultPanel0(), tail: { $: "Con", head: $defaultPanel1(), tail: { $: "Nil" } } };
}
function $normalizePanels(_panels_0) {
  if (_panels_0.$ === "Nil") {
    return $defaultPanels();
  } else {
    const _p0_0 = _panels_0["head"];
    const _t_0 = _panels_0["tail"];
    if (_t_0.$ === "Nil") {
      return { $: "Con", head: $normalizePanel0(_p0_0), tail: { $: "Nil" } };
    } else {
      const _p1_0 = _t_0["head"];
      return { $: "Con", head: $normalizePanel0(_p0_0), tail: { $: "Con", head: $normalizePanel1(_p1_0), tail: { $: "Nil" } } };
    }
  }
}
function $defaultDesk() {
  return { $: "Desk", title: "Mesa de Estudos", calculator: true, xournal: true, conferir: true, refsToggle: true, endDay: true, studyContext: true, panels: $defaultPanels() };
}
function $normalizeDesk(_desk_0) {
  if (_desk_0.$ === "None") {
    return $defaultDesk();
  } else {
    const _t_0 = _desk_0["value"];
    const _title_0 = _t_0["title"];
    const _calculator_0 = _t_0["calculator"];
    const _xournal_0 = _t_0["xournal"];
    const _conferir_0 = _t_0["conferir"];
    const _refsToggle_0 = _t_0["refsToggle"];
    const _endDay_0 = _t_0["endDay"];
    const _studyContext_0 = _t_0["studyContext"];
    const _panels_0 = _t_0["panels"];
    return { $: "Desk", title: $trimmedOr(_title_0, "Mesa de Estudos"), calculator: $flagOf(_calculator_0), xournal: $flagOf(_xournal_0), conferir: $flagOf(_conferir_0), refsToggle: $flagOf(_refsToggle_0), endDay: $flagOf(_endDay_0), studyContext: $flagOf(_studyContext_0), panels: $normalizePanels(_panels_0) };
  }
}
function $courseId(_f_0) {
  const _id_0 = _f_0["id"];
  const _base_0 = _f_0["base"];
  return $String_trim($orElse(_id_0, $orElse(_base_0, "")));
}
function $courseName(_f_0) {
  const _id_0 = _f_0["id"];
  const _name_0 = _f_0["name"];
  return $String_trim($orElse(_name_0, $orElse(_id_0, "")));
}
function $coursePath(_f_0) {
  const _path_0 = _f_0["path"];
  return $String_trim($orElse(_path_0, ""));
}
function $courseOf(_f_0) {
  return { $: "Course", id: $courseId(_f_0), name: $courseName(_f_0), path: $coursePath(_f_0) };
}
function $courseOk(_c_0) {
  const _id_0 = _c_0["id"];
  const _path_0 = _c_0["path"];
  return $Bool_and($Bool_not($String_is_empty(_id_0)), $Bool_not($String_is_empty(_path_0)));
}
function $keepCourse(_c_0, _rest_0, _ok_0) {
  if (_ok_0) {
    return { $: "Con", head: _c_0, tail: _rest_0 };
  } else {
    return _rest_0;
  }
}
function $normalizeCourses(_xs_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    const _c_0 = $courseOf(_h_0);
    return $keepCourse(_c_0, $normalizeCourses(_t_0), $courseOk(_c_0));
  }
}
function $needsSetup(_vaultUsable_0, _courses_0) {
  return $Bool_and($Bool_not(_vaultUsable_0), $List_is_empty(_courses_0));
}
function $normalize(_facts_0) {
  const _vaultPath_0 = _facts_0["vaultPath"];
  const _runtimePath_0 = _facts_0["runtimePath"];
  const _piPath_0 = _facts_0["piPath"];
  const _claudePath_0 = _facts_0["claudePath"];
  const _xournalPath_0 = _facts_0["xournalPath"];
  const _courses_0 = _facts_0["courses"];
  const _desk_0 = _facts_0["desk"];
  return { $: "Config", vaultPath: $orElse(_vaultPath_0, ""), runtimePath: $orElse(_runtimePath_0, ""), piPath: $orElse(_piPath_0, ""), claudePath: $orElse(_claudePath_0, ""), xournalPath: $orElse(_xournalPath_0, ""), courses: $normalizeCourses(_courses_0), desk: $normalizeDesk(_desk_0) };
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
function $List_is_empty(_xs_0) {
  if (_xs_0.$ === "Nil") {
    return true;
  } else {
    return false;
  }
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
var config_default = {
  orElse: run_lib((a0, a1) => str_out(run_loop($orElse(a0, str_in(a1)))), 2),
  ifEmpty: run_lib((a0, a1, a2) => str_out(run_loop($ifEmpty(str_in(a0), str_in(a1), a2))), 3),
  trimmedOr: run_lib((a0, a1) => str_out(run_loop($trimmedOr(a0, str_in(a1)))), 2),
  "asStringList.put": run_lib((a0, a1, a2) => run_loop($asStringList_put(str_in(a0), a1, a2)), 3),
  asStringList: run_lib((a0) => run_loop($asStringList(a0)), 1),
  preferOr: run_lib((a0, a1, a2) => run_loop($preferOr(a0, a1, a2)), 3),
  preferOf: run_lib((a0, a1) => run_loop($preferOf(a0, a1)), 2),
  flagOf: run_lib((a0) => run_loop($flagOf(a0)), 1),
  normalizePanel: run_lib((a0, a1) => run_loop($normalizePanel(a0, a1)), 2),
  defaultPanel0: run_lib(() => run_loop($defaultPanel0()), 0),
  defaultPanel1: run_lib(() => run_loop($defaultPanel1()), 0),
  normalizePanel0: run_lib((a0) => run_loop($normalizePanel0(a0)), 1),
  normalizePanel1: run_lib((a0) => run_loop($normalizePanel1(a0)), 1),
  defaultPanels: run_lib(() => run_loop($defaultPanels()), 0),
  normalizePanels: run_lib((a0) => run_loop($normalizePanels(a0)), 1),
  defaultDesk: run_lib(() => run_loop($defaultDesk()), 0),
  normalizeDesk: run_lib((a0) => run_loop($normalizeDesk(a0)), 1),
  courseId: run_lib((a0) => str_out(run_loop($courseId(a0))), 1),
  courseName: run_lib((a0) => str_out(run_loop($courseName(a0))), 1),
  coursePath: run_lib((a0) => str_out(run_loop($coursePath(a0))), 1),
  courseOf: run_lib((a0) => run_loop($courseOf(a0)), 1),
  courseOk: run_lib((a0) => run_loop($courseOk(a0)), 1),
  keepCourse: run_lib((a0, a1, a2) => run_loop($keepCourse(a0, a1, a2)), 3),
  normalizeCourses: run_lib((a0) => run_loop($normalizeCourses(a0)), 1),
  needsSetup: run_lib((a0, a1) => run_loop($needsSetup(a0, a1)), 2),
  normalize: run_lib((a0) => run_loop($normalize(a0)), 1)
};
export {
  config_default as default
};

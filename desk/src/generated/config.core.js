// GERADO de core/config.bend por `bun core/build.mjs` — não editar à mão.
// core/config.bend
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
function $orElse$(_v_0, _fallback_0) {
  if (_v_0.$ === "None") {
    return _fallback_0;
  } else {
    const _s_0 = _v_0["value"];
    return _s_0;
  }
}
function $ifEmpty$(_s_0, _fallback_0, _empty_0) {
  if (_empty_0) {
    return _fallback_0;
  } else {
    return _s_0;
  }
}
function $trimmedOr$(_v_0, _fallback_0) {
  const _s_0 = run_loop($String$trim$(run_loop($orElse$(_v_0, _fallback_0))));
  return run_jump($ifEmpty$, [_s_0, _fallback_0, run_loop($String$is_empty$(_s_0))]);
}
function $asStringList$put$(_s_0, _rest_0, _empty_0) {
  if (_empty_0) {
    return _rest_0;
  } else {
    return { $: "Con", ["head"]: _s_0, ["tail"]: _rest_0 };
  }
}
function $asStringList$(_items_0) {
  if (_items_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _items_0["head"];
    const _t_0 = _items_0["tail"];
    const _s_0 = run_loop($String$trim$(_h_0));
    return run_jump($asStringList$put$, [_s_0, run_loop($asStringList$(_t_0)), run_loop($String$is_empty$(_s_0))]);
  }
}
function $preferOr$(_clean_0, _slot_0, _empty_0) {
  if (_empty_0) {
    return _slot_0;
  } else {
    return _clean_0;
  }
}
function $preferOf$(_items_0, _slot_0) {
  const _clean_0 = run_loop($asStringList$(_items_0));
  return run_jump($preferOr$, [_clean_0, _slot_0, run_loop($List$is_empty$(_clean_0))]);
}
function $flagOf$(_v_0) {
  if (_v_0.$ === "None") {
    return true;
  } else {
    const _b_0 = _v_0["value"];
    return _b_0;
  }
}
function $normalizePanel$(_f_0, _slot_0) {
  const _label_0 = _f_0["label"];
  const _prefer_0 = _f_0["prefer"];
  const _toggle_0 = _f_0["toggle"];
  const _slotLabel_0 = _slot_0["label"];
  const _slotPrefer_0 = _slot_0["prefer"];
  const _slotToggle_0 = _slot_0["toggle"];
  return { $: "Panel", ["label"]: run_loop($trimmedOr$(_label_0, _slotLabel_0)), ["prefer"]: run_loop($preferOf$(_prefer_0, _slotPrefer_0)), ["toggle"]: run_loop($String$trim$(run_loop($orElse$(_toggle_0, _slotToggle_0)))) };
}
function $defaultPanel0$() {
  return { $: "Panel", ["label"]: "Enunciado", ["prefer"]: { $: "Con", ["head"]: "Limites", ["tail"]: { $: "Nil" } }, ["toggle"]: "" };
}
function $defaultPanel1$() {
  return { $: "Panel", ["label"]: "Formulário & apoio", ["prefer"]: { $: "Con", ["head"]: "Formul", ["tail"]: { $: "Nil" } }, ["toggle"]: "Formulário" };
}
function $normalizePanel0$(_f_0) {
  return run_jump($normalizePanel$, [_f_0, run_loop($defaultPanel0$())]);
}
function $normalizePanel1$(_f_0) {
  return run_jump($normalizePanel$, [_f_0, run_loop($defaultPanel1$())]);
}
function $defaultPanels$() {
  return { $: "Con", ["head"]: run_loop($defaultPanel0$()), ["tail"]: { $: "Con", ["head"]: run_loop($defaultPanel1$()), ["tail"]: { $: "Nil" } } };
}
function $normalizePanels$(_panels_0) {
  if (_panels_0.$ === "Nil") {
    return run_jump($defaultPanels$, []);
  } else {
    const _p0_0 = _panels_0["head"];
    const _t_0 = _panels_0["tail"];
    if (_t_0.$ === "Nil") {
      return { $: "Con", ["head"]: run_loop($normalizePanel0$(_p0_0)), ["tail"]: { $: "Nil" } };
    } else {
      const _p1_0 = _t_0["head"];
      const __0 = _t_0["tail"];
      return { $: "Con", ["head"]: run_loop($normalizePanel0$(_p0_0)), ["tail"]: { $: "Con", ["head"]: run_loop($normalizePanel1$(_p1_0)), ["tail"]: { $: "Nil" } } };
    }
  }
}
function $defaultDesk$() {
  return { $: "Desk", ["title"]: "Mesa de Estudos", ["calculator"]: true, ["xournal"]: true, ["conferir"]: true, ["refsToggle"]: true, ["endDay"]: true, ["studyContext"]: true, ["panels"]: run_loop($defaultPanels$()) };
}
function $normalizeDesk$(_desk_0) {
  if (_desk_0.$ === "None") {
    return run_jump($defaultDesk$, []);
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
    return { $: "Desk", ["title"]: run_loop($trimmedOr$(_title_0, "Mesa de Estudos")), ["calculator"]: run_loop($flagOf$(_calculator_0)), ["xournal"]: run_loop($flagOf$(_xournal_0)), ["conferir"]: run_loop($flagOf$(_conferir_0)), ["refsToggle"]: run_loop($flagOf$(_refsToggle_0)), ["endDay"]: run_loop($flagOf$(_endDay_0)), ["studyContext"]: run_loop($flagOf$(_studyContext_0)), ["panels"]: run_loop($normalizePanels$(_panels_0)) };
  }
}
function $courseId$(_f_0) {
  const _id_0 = _f_0["id"];
  const _name_0 = _f_0["name"];
  const _path_0 = _f_0["path"];
  const _base_0 = _f_0["base"];
  return run_jump($String$trim$, [run_loop($orElse$(_id_0, run_loop($orElse$(_base_0, ""))))]);
}
function $courseName$(_f_0) {
  const _id_0 = _f_0["id"];
  const _name_0 = _f_0["name"];
  const _path_0 = _f_0["path"];
  const _base_0 = _f_0["base"];
  return run_jump($String$trim$, [run_loop($orElse$(_name_0, run_loop($orElse$(_id_0, ""))))]);
}
function $coursePath$(_f_0) {
  const _id_0 = _f_0["id"];
  const _name_0 = _f_0["name"];
  const _path_0 = _f_0["path"];
  const _base_0 = _f_0["base"];
  return run_jump($String$trim$, [run_loop($orElse$(_path_0, ""))]);
}
function $courseOf$(_f_0) {
  return { $: "Course", ["id"]: run_loop($courseId$(_f_0)), ["name"]: run_loop($courseName$(_f_0)), ["path"]: run_loop($coursePath$(_f_0)) };
}
function $courseOk$(_c_0) {
  const _id_0 = _c_0["id"];
  const _name_0 = _c_0["name"];
  const _path_0 = _c_0["path"];
  return run_jump($Bool$and$, [run_loop($Bool$not$(run_loop($String$is_empty$(_id_0)))), run_loop($Bool$not$(run_loop($String$is_empty$(_path_0))))]);
}
function $keepCourse$(_c_0, _rest_0, _ok_0) {
  if (_ok_0) {
    return { $: "Con", ["head"]: _c_0, ["tail"]: _rest_0 };
  } else {
    return _rest_0;
  }
}
function $normalizeCourses$(_xs_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    const _c_0 = run_loop($courseOf$(_h_0));
    return run_jump($keepCourse$, [_c_0, run_loop($normalizeCourses$(_t_0)), run_loop($courseOk$(_c_0))]);
  }
}
function $needsSetup$(_vaultUsable_0, _courses_0) {
  return run_jump($Bool$and$, [run_loop($Bool$not$(_vaultUsable_0)), run_loop($List$is_empty$(_courses_0))]);
}
function $normalize$(_facts_0) {
  const _vaultPath_0 = _facts_0["vaultPath"];
  const _runtimePath_0 = _facts_0["runtimePath"];
  const _piPath_0 = _facts_0["piPath"];
  const _xournalPath_0 = _facts_0["xournalPath"];
  const _courses_0 = _facts_0["courses"];
  const _desk_0 = _facts_0["desk"];
  return { $: "Config", ["vaultPath"]: run_loop($orElse$(_vaultPath_0, "")), ["runtimePath"]: run_loop($orElse$(_runtimePath_0, "")), ["piPath"]: run_loop($orElse$(_piPath_0, "")), ["xournalPath"]: run_loop($orElse$(_xournalPath_0, "")), ["courses"]: run_loop($normalizeCourses$(_courses_0)), ["desk"]: run_loop($normalizeDesk$(_desk_0)) };
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
function $List$is_empty$(_xs_0) {
  if (_xs_0.$ === "Nil") {
    return true;
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return false;
  }
}
function $Bool$and$(_a_0, _b_0) {
  if (!_a_0) {
    return false;
  } else {
    return _b_0;
  }
}
function $Bool$not$(_b_0) {
  if (!_b_0) {
    return true;
  } else {
    return false;
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
function $Char$is_space$(_c_0) {
  const _x_0 = _c_0.codePointAt(0);
  const _x_1 = _x_0 === 32;
  const _x_2 = run_loop($Bool$and$(_x_0 >= 9, _x_0 <= 13));
  return _x_1 || _x_2;
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
var config_default = {
  orElse: run_lib($orElse$, 2),
  ifEmpty: run_lib($ifEmpty$, 3),
  trimmedOr: run_lib($trimmedOr$, 2),
  "asStringList.put": run_lib($asStringList$put$, 3),
  asStringList: run_lib($asStringList$, 1),
  preferOr: run_lib($preferOr$, 3),
  preferOf: run_lib($preferOf$, 2),
  flagOf: run_lib($flagOf$, 1),
  normalizePanel: run_lib($normalizePanel$, 2),
  defaultPanel0: run_lib($defaultPanel0$, 0),
  defaultPanel1: run_lib($defaultPanel1$, 0),
  normalizePanel0: run_lib($normalizePanel0$, 1),
  normalizePanel1: run_lib($normalizePanel1$, 1),
  defaultPanels: run_lib($defaultPanels$, 0),
  normalizePanels: run_lib($normalizePanels$, 1),
  defaultDesk: run_lib($defaultDesk$, 0),
  normalizeDesk: run_lib($normalizeDesk$, 1),
  courseId: run_lib($courseId$, 1),
  courseName: run_lib($courseName$, 1),
  coursePath: run_lib($coursePath$, 1),
  courseOf: run_lib($courseOf$, 1),
  courseOk: run_lib($courseOk$, 1),
  keepCourse: run_lib($keepCourse$, 3),
  normalizeCourses: run_lib($normalizeCourses$, 1),
  needsSetup: run_lib($needsSetup$, 2),
  normalize: run_lib($normalize$, 1)
};
export {
  config_default as default
};

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
function $orElse$(v_0, fallback_0) {
  if (v_0.$ === "None") {
    return fallback_0;
  } else {
    const s_0 = v_0.value;
    return s_0;
  }
}
function $ifEmpty$(s_0, fallback_0, empty_0) {
  if (empty_0) {
    return fallback_0;
  } else {
    return s_0;
  }
}
function $trimmedOr$(v_0, fallback_0) {
  const s_0 = run_loop($String$trim$(run_loop($orElse$(v_0, fallback_0))));
  return run_jump($ifEmpty$, [s_0, fallback_0, run_loop($String$is_empty$(s_0))]);
}
function $asStringList$put$(s_0, rest_0, empty_0) {
  if (empty_0) {
    return rest_0;
  } else {
    return { $: "Con", ["head"]: s_0, ["tail"]: rest_0 };
  }
}
function $asStringList$(items_0) {
  if (items_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const h_0 = items_0.head;
    const t_0 = items_0.tail;
    const s_0 = run_loop($String$trim$(h_0));
    return run_jump($asStringList$put$, [s_0, run_loop($asStringList$(t_0)), run_loop($String$is_empty$(s_0))]);
  }
}
function $preferOr$(clean_0, slot_0, empty_0) {
  if (empty_0) {
    return slot_0;
  } else {
    return clean_0;
  }
}
function $preferOf$(items_0, slot_0) {
  const clean_0 = run_loop($asStringList$(items_0));
  return run_jump($preferOr$, [clean_0, slot_0, run_loop($List$is_empty$(clean_0))]);
}
function $flagOf$(v_0) {
  if (v_0.$ === "None") {
    return true;
  } else {
    const b_0 = v_0.value;
    return b_0;
  }
}
function $normalizePanel$(f_0, slot_0) {
  const label_0 = f_0.label;
  const prefer_0 = f_0.prefer;
  const toggle_0 = f_0.toggle;
  const slotLabel_0 = slot_0.label;
  const slotPrefer_0 = slot_0.prefer;
  const slotToggle_0 = slot_0.toggle;
  return { $: "Panel", ["label"]: run_loop($trimmedOr$(label_0, slotLabel_0)), ["prefer"]: run_loop($preferOf$(prefer_0, slotPrefer_0)), ["toggle"]: run_loop($String$trim$(run_loop($orElse$(toggle_0, slotToggle_0)))) };
}
function $defaultPanel0$() {
  return { $: "Panel", ["label"]: "Enunciado", ["prefer"]: { $: "Con", ["head"]: "Limites", ["tail"]: { $: "Nil" } }, ["toggle"]: "" };
}
function $defaultPanel1$() {
  return { $: "Panel", ["label"]: "Formulário & apoio", ["prefer"]: { $: "Con", ["head"]: "Formul", ["tail"]: { $: "Nil" } }, ["toggle"]: "Formulário" };
}
function $normalizePanel0$(f_0) {
  return run_jump($normalizePanel$, [f_0, run_loop($defaultPanel0$())]);
}
function $normalizePanel1$(f_0) {
  return run_jump($normalizePanel$, [f_0, run_loop($defaultPanel1$())]);
}
function $defaultPanels$() {
  return { $: "Con", ["head"]: run_loop($defaultPanel0$()), ["tail"]: { $: "Con", ["head"]: run_loop($defaultPanel1$()), ["tail"]: { $: "Nil" } } };
}
function $normalizePanels$(panels_0) {
  if (panels_0.$ === "Nil") {
    return run_jump($defaultPanels$, []);
  } else {
    const p0_0 = panels_0.head;
    const _t_0 = panels_0.tail;
    if (_t_0.$ === "Nil") {
      return { $: "Con", ["head"]: run_loop($normalizePanel0$(p0_0)), ["tail"]: { $: "Nil" } };
    } else {
      const p1_0 = _t_0.head;
      const __0 = _t_0.tail;
      return { $: "Con", ["head"]: run_loop($normalizePanel0$(p0_0)), ["tail"]: { $: "Con", ["head"]: run_loop($normalizePanel1$(p1_0)), ["tail"]: { $: "Nil" } } };
    }
  }
}
function $defaultDesk$() {
  return { $: "Desk", ["title"]: "Mesa de Estudos", ["calculator"]: true, ["xournal"]: true, ["conferir"]: true, ["refsToggle"]: true, ["endDay"]: true, ["studyContext"]: true, ["panels"]: run_loop($defaultPanels$()) };
}
function $normalizeDesk$(desk_0) {
  if (desk_0.$ === "None") {
    return run_jump($defaultDesk$, []);
  } else {
    const _t_0 = desk_0.value;
    const title_0 = _t_0.title;
    const calculator_0 = _t_0.calculator;
    const xournal_0 = _t_0.xournal;
    const conferir_0 = _t_0.conferir;
    const refsToggle_0 = _t_0.refsToggle;
    const endDay_0 = _t_0.endDay;
    const studyContext_0 = _t_0.studyContext;
    const panels_0 = _t_0.panels;
    return { $: "Desk", ["title"]: run_loop($trimmedOr$(title_0, "Mesa de Estudos")), ["calculator"]: run_loop($flagOf$(calculator_0)), ["xournal"]: run_loop($flagOf$(xournal_0)), ["conferir"]: run_loop($flagOf$(conferir_0)), ["refsToggle"]: run_loop($flagOf$(refsToggle_0)), ["endDay"]: run_loop($flagOf$(endDay_0)), ["studyContext"]: run_loop($flagOf$(studyContext_0)), ["panels"]: run_loop($normalizePanels$(panels_0)) };
  }
}
function $courseId$(f_0) {
  const id_0 = f_0.id;
  const name_0 = f_0.name;
  const path_0 = f_0.path;
  const base_0 = f_0.base;
  return run_jump($String$trim$, [run_loop($orElse$(id_0, run_loop($orElse$(base_0, ""))))]);
}
function $courseName$(f_0) {
  const id_0 = f_0.id;
  const name_0 = f_0.name;
  const path_0 = f_0.path;
  const base_0 = f_0.base;
  return run_jump($String$trim$, [run_loop($orElse$(name_0, run_loop($orElse$(id_0, ""))))]);
}
function $coursePath$(f_0) {
  const id_0 = f_0.id;
  const name_0 = f_0.name;
  const path_0 = f_0.path;
  const base_0 = f_0.base;
  return run_jump($String$trim$, [run_loop($orElse$(path_0, ""))]);
}
function $courseOf$(f_0) {
  return { $: "Course", ["id"]: run_loop($courseId$(f_0)), ["name"]: run_loop($courseName$(f_0)), ["path"]: run_loop($coursePath$(f_0)) };
}
function $courseOk$(c_0) {
  const id_0 = c_0.id;
  const name_0 = c_0.name;
  const path_0 = c_0.path;
  return run_jump($Bool$and$, [run_loop($Bool$not$(run_loop($String$is_empty$(id_0)))), run_loop($Bool$not$(run_loop($String$is_empty$(path_0))))]);
}
function $keepCourse$(c_0, rest_0, ok_0) {
  if (ok_0) {
    return { $: "Con", ["head"]: c_0, ["tail"]: rest_0 };
  } else {
    return rest_0;
  }
}
function $normalizeCourses$(xs_0) {
  if (xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const h_0 = xs_0.head;
    const t_0 = xs_0.tail;
    const c_0 = run_loop($courseOf$(h_0));
    return run_jump($keepCourse$, [c_0, run_loop($normalizeCourses$(t_0)), run_loop($courseOk$(c_0))]);
  }
}
function $needsSetup$(vaultUsable_0, courses_0) {
  return run_jump($Bool$and$, [run_loop($Bool$not$(vaultUsable_0)), run_loop($List$is_empty$(courses_0))]);
}
function $normalize$(facts_0) {
  const vaultPath_0 = facts_0.vaultPath;
  const runtimePath_0 = facts_0.runtimePath;
  const piPath_0 = facts_0.piPath;
  const xournalPath_0 = facts_0.xournalPath;
  const courses_0 = facts_0.courses;
  const desk_0 = facts_0.desk;
  return { $: "Config", ["vaultPath"]: run_loop($orElse$(vaultPath_0, "")), ["runtimePath"]: run_loop($orElse$(runtimePath_0, "")), ["piPath"]: run_loop($orElse$(piPath_0, "")), ["xournalPath"]: run_loop($orElse$(xournalPath_0, "")), ["courses"]: run_loop($normalizeCourses$(courses_0)), ["desk"]: run_loop($normalizeDesk$(desk_0)) };
}
function $String$trim$(s_0) {
  return run_jump($String$trim_end$, [run_loop($String$trim_start$(s_0))]);
}
function $String$is_empty$(s_0) {
  if (s_0 === "") {
    return true;
  } else {
    const h_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(0, 2) : s_0[0];
    const t_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(2) : s_0.slice(1);
    return false;
  }
}
function $List$is_empty$(xs_0) {
  if (xs_0.$ === "Nil") {
    return true;
  } else {
    const h_0 = xs_0.head;
    const t_0 = xs_0.tail;
    return false;
  }
}
function $Bool$and$(a_0, b_0) {
  if (!a_0) {
    return false;
  } else {
    return b_0;
  }
}
function $Bool$not$(b_0) {
  if (!b_0) {
    return true;
  } else {
    return false;
  }
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
function $String$reverse$(s_0) {
  return run_jump($String$reverse$go$, [s_0, ""]);
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
function $String$reverse$go$(s_0, acc_0) {
  if (s_0 === "") {
    return acc_0;
  } else {
    const h_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(0, 2) : s_0[0];
    const t_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(2) : s_0.slice(1);
    return run_jump($String$reverse$go$, [t_0, h_0 + acc_0]);
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

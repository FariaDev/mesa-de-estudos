// GERADO de core/courses.bend por `bun core/build.mjs` — não editar à mão.
// core/courses.bend
function cmp_new(a, b) {
  return { $: a < b ? "LT" : a === b ? "EQ" : "GT" };
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
function $idOf$(c_0) {
  const id_0 = c_0.id;
  const name_0 = c_0.name;
  const path_0 = c_0.path;
  return id_0;
}
function $nameOf$(c_0) {
  const id_0 = c_0.id;
  const name_0 = c_0.name;
  const path_0 = c_0.path;
  return name_0;
}
function $pathOf$(c_0) {
  const id_0 = c_0.id;
  const name_0 = c_0.name;
  const path_0 = c_0.path;
  return path_0;
}
function $pdfName$(p_0) {
  const name_0 = p_0.name;
  const path_0 = p_0.path;
  const canonical_0 = p_0.canonical;
  return name_0;
}
function $ids$(xs_0) {
  if (xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const h_0 = xs_0.head;
    const t_0 = xs_0.tail;
    return { $: "Con", ["head"]: run_loop($idOf$(h_0)), ["tail"]: run_loop($ids$(t_0)) };
  }
}
function $names$(xs_0) {
  if (xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const h_0 = xs_0.head;
    const t_0 = xs_0.tail;
    return { $: "Con", ["head"]: run_loop($pdfName$(h_0)), ["tail"]: run_loop($names$(t_0)) };
  }
}
function $hasId$(xs_0, id_0) {
  if (xs_0.$ === "Nil") {
    return false;
  } else {
    const _t_0 = xs_0.head;
    const cid_0 = _t_0.id;
    const name_0 = _t_0.name;
    const path_0 = _t_0.path;
    const t_0 = xs_0.tail;
    const x_0 = run_loop($String$eq$(cid_0, id_0));
    const x_1 = run_loop($hasId$(t_0, id_0));
    return x_0 || x_1;
  }
}
function $pickName$prev$if$(prevName_0, id_0, empty_0) {
  if (!empty_0) {
    return prevName_0;
  } else {
    return id_0;
  }
}
function $pickName$prev$(prevName_0, id_0) {
  return run_jump($pickName$prev$if$, [prevName_0, id_0, run_loop($String$is_empty$(prevName_0))]);
}
function $pickName$cfg$(cfgName_0, prevName_0, id_0, empty_0) {
  if (!empty_0) {
    return cfgName_0;
  } else {
    return run_jump($pickName$prev$, [prevName_0, id_0]);
  }
}
function $pickName$(cfgName_0, prevName_0, id_0) {
  return run_jump($pickName$cfg$, [cfgName_0, prevName_0, id_0, run_loop($String$is_empty$(cfgName_0))]);
}
function $overlay$(prev_0, cfg_0) {
  const pid_0 = prev_0.id;
  const prevName_0 = prev_0.name;
  const ppath_0 = prev_0.path;
  const id_0 = cfg_0.id;
  const cfgName_0 = cfg_0.name;
  const cfgPath_0 = cfg_0.path;
  const id_1 = id_0;
  return { $: "Course", ["id"]: id_1, ["name"]: run_loop($pickName$(cfgName_0, prevName_0, id_1)), ["path"]: cfgPath_0 };
}
function $asNew$(cfg_0) {
  const id_0 = cfg_0.id;
  const name_0 = cfg_0.name;
  const path_0 = cfg_0.path;
  const id_1 = id_0;
  return { $: "Course", ["id"]: id_1, ["name"]: run_loop($pickName$(name_0, "", id_1)), ["path"]: path_0 };
}
function $rewrite$(h_0, cfg_0, same_0) {
  if (same_0) {
    return run_jump($overlay$, [h_0, cfg_0]);
  } else {
    return h_0;
  }
}
function $rewriteHead$(h_0, cfg_0) {
  const hid_0 = h_0.id;
  const hname_0 = h_0.name;
  const hpath_0 = h_0.path;
  const cid_0 = cfg_0.id;
  const cname_0 = cfg_0.name;
  const cpath_0 = cfg_0.path;
  const hid_1 = hid_0;
  const cid_1 = cid_0;
  return run_jump($rewrite$, [{ $: "Course", ["id"]: hid_1, ["name"]: hname_0, ["path"]: hpath_0 }, { $: "Course", ["id"]: cid_1, ["name"]: cname_0, ["path"]: cpath_0 }, run_loop($String$eq$(hid_1, cid_1))]);
}
function $updateById$(xs_0, cfg_0) {
  if (xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const h_0 = xs_0.head;
    const t_0 = xs_0.tail;
    return { $: "Con", ["head"]: run_loop($rewriteHead$(h_0, cfg_0)), ["tail"]: run_loop($updateById$(t_0, cfg_0)) };
  }
}
function $mergeOne$has$(acc_0, cfg_0, found_0) {
  if (found_0) {
    return run_jump($updateById$, [acc_0, cfg_0]);
  } else {
    return run_jump($List$append$, [acc_0, { $: "Con", ["head"]: run_loop($asNew$(cfg_0)), ["tail"]: { $: "Nil" } }]);
  }
}
function $mergeOne$(acc_0, cfg_0) {
  const id_0 = cfg_0.id;
  const name_0 = cfg_0.name;
  const path_0 = cfg_0.path;
  const id_1 = id_0;
  const c_0 = { $: "Course", ["id"]: id_1, ["name"]: name_0, ["path"]: path_0 };
  return run_jump($mergeOne$has$, [acc_0, c_0, run_loop($hasId$(acc_0, id_1))]);
}
function $merge$go$(cfg_0, acc_0) {
  if (cfg_0.$ === "Nil") {
    return acc_0;
  } else {
    const h_0 = cfg_0.head;
    const t_0 = cfg_0.tail;
    return run_jump($merge$go$, [t_0, run_loop($mergeOne$(acc_0, h_0))]);
  }
}
function $mergeCourses$(discovered_0, config_0) {
  return run_jump($merge$go$, [config_0, discovered_0]);
}
function $uniqueIds$and$(found_0, rest_0) {
  if (found_0) {
    return false;
  } else {
    return rest_0;
  }
}
function $uniqueIds$(xs_0) {
  if (xs_0.$ === "Nil") {
    return true;
  } else {
    const _t_0 = xs_0.head;
    const id_0 = _t_0.id;
    const name_0 = _t_0.name;
    const path_0 = _t_0.path;
    const t_0 = xs_0.tail;
    const t_1 = t_0;
    const id_1 = id_0;
    return run_jump($uniqueIds$and$, [run_loop($hasId$(t_1, id_1)), run_loop($uniqueIds$(t_1))]);
  }
}
function $hasCanonical$(xs_0, key_0) {
  if (xs_0.$ === "Nil") {
    return false;
  } else {
    const _t_0 = xs_0.head;
    const n_0 = _t_0.name;
    const p_0 = _t_0.path;
    const c_0 = _t_0.canonical;
    const t_0 = xs_0.tail;
    const x_0 = run_loop($String$eq$(c_0, key_0));
    const x_1 = run_loop($hasCanonical$(t_0, key_0));
    return x_0 || x_1;
  }
}
function $keepPdf$(acc_0, pdf_0, seen_0) {
  if (seen_0) {
    return acc_0;
  } else {
    return run_jump($List$append$, [acc_0, { $: "Con", ["head"]: pdf_0, ["tail"]: { $: "Nil" } }]);
  }
}
function $dedupe$go$(xs_0, acc_0) {
  if (xs_0.$ === "Nil") {
    return acc_0;
  } else {
    const _t_0 = xs_0.head;
    const n_0 = _t_0.name;
    const p_0 = _t_0.path;
    const c_0 = _t_0.canonical;
    const t_0 = xs_0.tail;
    const c_1 = c_0;
    const pdf_0 = { $: "Pdf", ["name"]: n_0, ["path"]: p_0, ["canonical"]: c_1 };
    return run_jump($dedupe$go$, [t_0, run_loop($keepPdf$(acc_0, pdf_0, run_loop($hasCanonical$(acc_0, c_1))))]);
  }
}
function $dedupe$(xs_0) {
  return run_jump($dedupe$go$, [xs_0, { $: "Nil" }]);
}
function $pdfLe$(a_0, b_0) {
  const na_0 = a_0.name;
  const pa_0 = a_0.path;
  const ca_0 = a_0.canonical;
  const nb_0 = b_0.name;
  const pb_0 = b_0.path;
  const cb_0 = b_0.canonical;
  return run_jump($String$is_le$, [na_0, nb_0]);
}
function $insertPdf$finish$(st_0) {
  const acc_0 = st_0.acc;
  const rest_0 = st_0.rest;
  const x_0 = st_0.x;
  const done_0 = st_0.done;
  return run_jump($List$append$, [run_loop($List$reverse$(acc_0)), { $: "Con", ["head"]: x_0, ["tail"]: rest_0 }]);
}
function $insertPdf$step$(acc_0, x_0, y_0, ys_0, le_0) {
  if (le_0) {
    return { $: "PdfIns", ["acc"]: acc_0, ["rest"]: { $: "Con", ["head"]: y_0, ["tail"]: ys_0 }, ["x"]: x_0, ["done"]: true };
  } else {
    return { $: "PdfIns", ["acc"]: { $: "Con", ["head"]: y_0, ["tail"]: acc_0 }, ["rest"]: ys_0, ["x"]: x_0, ["done"]: false };
  }
}
function $insertPdf$go$(fuel_0, st_0) {
  if (fuel_0 === 0n) {
    return run_jump($insertPdf$finish$, [st_0]);
  } else {
    const f_0 = fuel_0 - 1n;
    const acc_0 = st_0.acc;
    const _t_0 = st_0.rest;
    if (_t_0.$ === "Nil") {
      const x_0 = st_0.x;
      const done_0 = st_0.done;
      const x_1 = x_0;
      return run_jump($insertPdf$finish$, [{ $: "PdfIns", ["acc"]: acc_0, ["rest"]: { $: "Nil" }, ["x"]: x_1, ["done"]: true }]);
    } else {
      const y_0 = _t_0.head;
      const ys_0 = _t_0.tail;
      const x_2 = st_0.x;
      const _t_1 = st_0.done;
      if (_t_1) {
        const x_3 = x_2;
        const y_1 = y_0;
        return run_jump($insertPdf$finish$, [{ $: "PdfIns", ["acc"]: acc_0, ["rest"]: { $: "Con", ["head"]: y_1, ["tail"]: ys_0 }, ["x"]: x_3, ["done"]: true }]);
      } else {
        const x_4 = x_2;
        const y_2 = y_0;
        return run_jump($insertPdf$go$, [f_0, run_loop($insertPdf$step$(acc_0, x_4, y_2, ys_0, run_loop($pdfLe$(x_4, y_2))))]);
      }
    }
  }
}
function $insertPdf$(x_0, xs_0) {
  const n_0 = run_loop($List$length$(xs_0));
  return run_jump($insertPdf$go$, [n_0, { $: "PdfIns", ["acc"]: { $: "Nil" }, ["rest"]: xs_0, ["x"]: x_0, ["done"]: false }]);
}
function $sortPdfs$go$(fuel_0, xs_0, acc_0) {
  if (fuel_0 === 0n) {
    return acc_0;
  } else {
    const f_0 = fuel_0 - 1n;
    if (xs_0.$ === "Nil") {
      return acc_0;
    } else {
      const h_0 = xs_0.head;
      const t_0 = xs_0.tail;
      return run_jump($sortPdfs$go$, [f_0, t_0, run_loop($insertPdf$(h_0, acc_0))]);
    }
  }
}
function $sortPdfs$(xs_0) {
  const n_0 = run_loop($List$length$(xs_0));
  return run_jump($sortPdfs$go$, [n_0, xs_0, { $: "Nil" }]);
}
function $courseLibrary$(xs_0) {
  const ds_0 = run_loop($dedupe$(xs_0));
  return run_jump($sortPdfs$, [ds_0]);
}
function $uniqueCanonicals$and$(found_0, rest_0) {
  if (found_0) {
    return false;
  } else {
    return rest_0;
  }
}
function $uniqueCanonicals$(xs_0) {
  if (xs_0.$ === "Nil") {
    return true;
  } else {
    const _t_0 = xs_0.head;
    const n_0 = _t_0.name;
    const p_0 = _t_0.path;
    const c_0 = _t_0.canonical;
    const t_0 = xs_0.tail;
    const t_1 = t_0;
    const c_1 = c_0;
    return run_jump($uniqueCanonicals$and$, [run_loop($hasCanonical$(t_1, c_1)), run_loop($uniqueCanonicals$(t_1))]);
  }
}
function $String$eq$(a_0, b_0) {
  return run_jump($String$eq$fin$, [run_loop($String$cmp$(a_0, b_0))]);
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
function $List$append$(xs_0, ys_0) {
  if (xs_0.$ === "Nil") {
    return ys_0;
  } else {
    const h_0 = xs_0.head;
    const t_0 = xs_0.tail;
    return { $: "Con", ["head"]: h_0, ["tail"]: run_loop($List$append$(t_0, ys_0)) };
  }
}
function $String$is_le$(a_0, b_0) {
  return run_jump($Cmp$is_le$, [run_loop($String$order$(a_0, b_0))]);
}
function $List$reverse$(xs_0) {
  return run_jump($List$reverse$go$, [xs_0, { $: "Nil" }]);
}
function $List$length$(xs_0) {
  if (xs_0.$ === "Nil") {
    return 0n;
  } else {
    const h_0 = xs_0.head;
    const t_0 = xs_0.tail;
    return nat_chk(run_loop($List$length$(t_0)) + 1n);
  }
}
function $String$eq$fin$(r_0) {
  const _t_0 = r_0.fst;
  const a2_0 = _t_0.fst;
  const b2_0 = _t_0.snd;
  const c_0 = r_0.snd;
  return run_jump($Cmp$is_eq$, [c_0]);
}
function $String$cmp$(a_0, b_0) {
  if (a_0 === "") {
    if (b_0 === "") {
      return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: "", ["snd"]: "" }, ["snd"]: { $: "EQ" } };
    } else {
      const h_0 = b_0.codePointAt(0) > 65535 ? b_0.slice(0, 2) : b_0[0];
      const t_0 = b_0.codePointAt(0) > 65535 ? b_0.slice(2) : b_0.slice(1);
      return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: "", ["snd"]: h_0 + t_0 }, ["snd"]: { $: "LT" } };
    }
  } else {
    const h_1 = a_0.codePointAt(0) > 65535 ? a_0.slice(0, 2) : a_0[0];
    const t_1 = a_0.codePointAt(0) > 65535 ? a_0.slice(2) : a_0.slice(1);
    if (b_0 === "") {
      return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: h_1 + t_1, ["snd"]: "" }, ["snd"]: { $: "GT" } };
    } else {
      const h2_0 = b_0.codePointAt(0) > 65535 ? b_0.slice(0, 2) : b_0[0];
      const t2_0 = b_0.codePointAt(0) > 65535 ? b_0.slice(2) : b_0.slice(1);
      return run_jump($String$cmp$fin$, [t_1, t2_0, run_loop($Char$cmp$(h_1, h2_0))]);
    }
  }
}
function $Cmp$is_le$(c_0) {
  if (c_0.$ === "LT") {
    return true;
  } else if (c_0.$ === "EQ") {
    return true;
  } else {
    return false;
  }
}
function $String$order$(a_0, b_0) {
  return run_jump($String$order$fin$, [run_loop($String$cmp$(a_0, b_0))]);
}
function $List$reverse$go$(xs_0, acc_0) {
  if (xs_0.$ === "Nil") {
    return acc_0;
  } else {
    const h_0 = xs_0.head;
    const t_0 = xs_0.tail;
    return run_jump($List$reverse$go$, [t_0, { $: "Con", ["head"]: h_0, ["tail"]: acc_0 }]);
  }
}
function $Cmp$is_eq$(c_0) {
  if (c_0.$ === "LT") {
    return false;
  } else if (c_0.$ === "EQ") {
    return true;
  } else {
    return false;
  }
}
function $String$cmp$fin$(t1_0, t2_0, hc_0) {
  const _t_0 = hc_0.fst;
  const h1b_0 = _t_0.fst;
  const h2b_0 = _t_0.snd;
  const _t_1 = hc_0.snd;
  if (_t_1.$ === "LT") {
    return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: h1b_0 + t1_0, ["snd"]: h2b_0 + t2_0 }, ["snd"]: { $: "LT" } };
  } else if (_t_1.$ === "EQ") {
    return run_jump($String$cmp$rec$, [h1b_0, h2b_0, run_loop($String$cmp$(t1_0, t2_0))]);
  } else {
    return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: h1b_0 + t1_0, ["snd"]: h2b_0 + t2_0 }, ["snd"]: { $: "GT" } };
  }
}
function $Char$cmp$(a_0, b_0) {
  const x_0 = a_0.codePointAt(0);
  const y_0 = b_0.codePointAt(0);
  const x_1 = x_0;
  const y_1 = y_0;
  return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: char_new(x_1), ["snd"]: char_new(y_1) }, ["snd"]: cmp_new(x_1, y_1) };
}
function $String$order$fin$(r_0) {
  const ab_0 = r_0.fst;
  const c_0 = r_0.snd;
  return c_0;
}
function $String$cmp$rec$(h1b_0, h2b_0, rr_0) {
  const _t_0 = rr_0.fst;
  const t1b_0 = _t_0.fst;
  const t2b_0 = _t_0.snd;
  const r_0 = rr_0.snd;
  return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: h1b_0 + t1b_0, ["snd"]: h2b_0 + t2b_0 }, ["snd"]: r_0 };
}
var courses_default = {
  idOf: run_lib($idOf$, 1),
  nameOf: run_lib($nameOf$, 1),
  pathOf: run_lib($pathOf$, 1),
  pdfName: run_lib($pdfName$, 1),
  ids: run_lib($ids$, 1),
  names: run_lib($names$, 1),
  hasId: run_lib($hasId$, 2),
  "pickName.prev.if": run_lib($pickName$prev$if$, 3),
  "pickName.prev": run_lib($pickName$prev$, 2),
  "pickName.cfg": run_lib($pickName$cfg$, 4),
  pickName: run_lib($pickName$, 3),
  overlay: run_lib($overlay$, 2),
  asNew: run_lib($asNew$, 1),
  rewrite: run_lib($rewrite$, 3),
  rewriteHead: run_lib($rewriteHead$, 2),
  updateById: run_lib($updateById$, 2),
  "mergeOne.has": run_lib($mergeOne$has$, 3),
  mergeOne: run_lib($mergeOne$, 2),
  "merge.go": run_lib($merge$go$, 2),
  mergeCourses: run_lib($mergeCourses$, 2),
  "uniqueIds.and": run_lib($uniqueIds$and$, 2),
  uniqueIds: run_lib($uniqueIds$, 1),
  hasCanonical: run_lib($hasCanonical$, 2),
  keepPdf: run_lib($keepPdf$, 3),
  "dedupe.go": run_lib($dedupe$go$, 2),
  dedupe: run_lib($dedupe$, 1),
  pdfLe: run_lib($pdfLe$, 2),
  "insertPdf.finish": run_lib($insertPdf$finish$, 1),
  "insertPdf.step": run_lib($insertPdf$step$, 5),
  "insertPdf.go": run_lib($insertPdf$go$, 2),
  insertPdf: run_lib($insertPdf$, 2),
  "sortPdfs.go": run_lib($sortPdfs$go$, 3),
  sortPdfs: run_lib($sortPdfs$, 1),
  courseLibrary: run_lib($courseLibrary$, 1),
  "uniqueCanonicals.and": run_lib($uniqueCanonicals$and$, 2),
  uniqueCanonicals: run_lib($uniqueCanonicals$, 1)
};
export {
  courses_default as default
};

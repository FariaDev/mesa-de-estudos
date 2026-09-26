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
function $idOf$(_c_0) {
  const _id_0 = _c_0["id"];
  const _name_0 = _c_0["name"];
  const _path_0 = _c_0["path"];
  return _id_0;
}
function $nameOf$(_c_0) {
  const _id_0 = _c_0["id"];
  const _name_0 = _c_0["name"];
  const _path_0 = _c_0["path"];
  return _name_0;
}
function $pathOf$(_c_0) {
  const _id_0 = _c_0["id"];
  const _name_0 = _c_0["name"];
  const _path_0 = _c_0["path"];
  return _path_0;
}
function $pdfName$(_p_0) {
  const _name_0 = _p_0["name"];
  const _path_0 = _p_0["path"];
  const _canonical_0 = _p_0["canonical"];
  return _name_0;
}
function $ids$(_xs_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return { $: "Con", ["head"]: run_loop($idOf$(_h_0)), ["tail"]: run_loop($ids$(_t_0)) };
  }
}
function $names$(_xs_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return { $: "Con", ["head"]: run_loop($pdfName$(_h_0)), ["tail"]: run_loop($names$(_t_0)) };
  }
}
function $hasId$(_xs_0, _id_0) {
  if (_xs_0.$ === "Nil") {
    return false;
  } else {
    const _t_0 = _xs_0["head"];
    const _cid_0 = _t_0["id"];
    const _name_0 = _t_0["name"];
    const _path_0 = _t_0["path"];
    const _t_1 = _xs_0["tail"];
    const _x_0 = run_loop($String$eq$(_cid_0, _id_0));
    const _x_1 = run_loop($hasId$(_t_1, _id_0));
    return _x_0 || _x_1;
  }
}
function $pickName$prev$if$(_prevName_0, _id_0, _empty_0) {
  if (!_empty_0) {
    return _prevName_0;
  } else {
    return _id_0;
  }
}
function $pickName$prev$(_prevName_0, _id_0) {
  return run_jump($pickName$prev$if$, [_prevName_0, _id_0, run_loop($String$is_empty$(_prevName_0))]);
}
function $pickName$cfg$(_cfgName_0, _prevName_0, _id_0, _empty_0) {
  if (!_empty_0) {
    return _cfgName_0;
  } else {
    return run_jump($pickName$prev$, [_prevName_0, _id_0]);
  }
}
function $pickName$(_cfgName_0, _prevName_0, _id_0) {
  return run_jump($pickName$cfg$, [_cfgName_0, _prevName_0, _id_0, run_loop($String$is_empty$(_cfgName_0))]);
}
function $overlay$(_prev_0, _cfg_0) {
  const _pid_0 = _prev_0["id"];
  const _prevName_0 = _prev_0["name"];
  const _ppath_0 = _prev_0["path"];
  const _id_0 = _cfg_0["id"];
  const _cfgName_0 = _cfg_0["name"];
  const _cfgPath_0 = _cfg_0["path"];
  return { $: "Course", ["id"]: _id_0, ["name"]: run_loop($pickName$(_cfgName_0, _prevName_0, _id_0)), ["path"]: _cfgPath_0 };
}
function $asNew$(_cfg_0) {
  const _id_0 = _cfg_0["id"];
  const _name_0 = _cfg_0["name"];
  const _path_0 = _cfg_0["path"];
  return { $: "Course", ["id"]: _id_0, ["name"]: run_loop($pickName$(_name_0, "", _id_0)), ["path"]: _path_0 };
}
function $rewrite$(_h_0, _cfg_0, _same_0) {
  if (_same_0) {
    return run_jump($overlay$, [_h_0, _cfg_0]);
  } else {
    return _h_0;
  }
}
function $rewriteHead$(_h_0, _cfg_0) {
  const _hid_0 = _h_0["id"];
  const _hname_0 = _h_0["name"];
  const _hpath_0 = _h_0["path"];
  const _cid_0 = _cfg_0["id"];
  const _cname_0 = _cfg_0["name"];
  const _cpath_0 = _cfg_0["path"];
  return run_jump($rewrite$, [{ $: "Course", ["id"]: _hid_0, ["name"]: _hname_0, ["path"]: _hpath_0 }, { $: "Course", ["id"]: _cid_0, ["name"]: _cname_0, ["path"]: _cpath_0 }, run_loop($String$eq$(_hid_0, _cid_0))]);
}
function $updateById$(_xs_0, _cfg_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return { $: "Con", ["head"]: run_loop($rewriteHead$(_h_0, _cfg_0)), ["tail"]: run_loop($updateById$(_t_0, _cfg_0)) };
  }
}
function $mergeOne$has$(_acc_0, _cfg_0, _found_0) {
  if (_found_0) {
    return run_jump($updateById$, [_acc_0, _cfg_0]);
  } else {
    return run_jump($List$append$, [_acc_0, { $: "Con", ["head"]: run_loop($asNew$(_cfg_0)), ["tail"]: { $: "Nil" } }]);
  }
}
function $mergeOne$(_acc_0, _cfg_0) {
  const _id_0 = _cfg_0["id"];
  const _name_0 = _cfg_0["name"];
  const _path_0 = _cfg_0["path"];
  const _c_0 = { $: "Course", ["id"]: _id_0, ["name"]: _name_0, ["path"]: _path_0 };
  return run_jump($mergeOne$has$, [_acc_0, _c_0, run_loop($hasId$(_acc_0, _id_0))]);
}
function $merge$go$(_cfg_0, _acc_0) {
  if (_cfg_0.$ === "Nil") {
    return _acc_0;
  } else {
    const _h_0 = _cfg_0["head"];
    const _t_0 = _cfg_0["tail"];
    return run_jump($merge$go$, [_t_0, run_loop($mergeOne$(_acc_0, _h_0))]);
  }
}
function $mergeCourses$(_discovered_0, _config_0) {
  return run_jump($merge$go$, [_config_0, _discovered_0]);
}
function $uniqueIds$and$(_found_0, _rest_0) {
  if (_found_0) {
    return false;
  } else {
    return _rest_0;
  }
}
function $uniqueIds$(_xs_0) {
  if (_xs_0.$ === "Nil") {
    return true;
  } else {
    const _t_0 = _xs_0["head"];
    const _id_0 = _t_0["id"];
    const _name_0 = _t_0["name"];
    const _path_0 = _t_0["path"];
    const _t_1 = _xs_0["tail"];
    return run_jump($uniqueIds$and$, [run_loop($hasId$(_t_1, _id_0)), run_loop($uniqueIds$(_t_1))]);
  }
}
function $hasCanonical$(_xs_0, _key_0) {
  if (_xs_0.$ === "Nil") {
    return false;
  } else {
    const _t_0 = _xs_0["head"];
    const _n_0 = _t_0["name"];
    const _p_0 = _t_0["path"];
    const _c_0 = _t_0["canonical"];
    const _t_1 = _xs_0["tail"];
    const _x_0 = run_loop($String$eq$(_c_0, _key_0));
    const _x_1 = run_loop($hasCanonical$(_t_1, _key_0));
    return _x_0 || _x_1;
  }
}
function $keepPdf$(_acc_0, _pdf_0, _seen_0) {
  if (_seen_0) {
    return _acc_0;
  } else {
    return run_jump($List$append$, [_acc_0, { $: "Con", ["head"]: _pdf_0, ["tail"]: { $: "Nil" } }]);
  }
}
function $dedupe$go$(_xs_0, _acc_0) {
  if (_xs_0.$ === "Nil") {
    return _acc_0;
  } else {
    const _t_0 = _xs_0["head"];
    const _n_0 = _t_0["name"];
    const _p_0 = _t_0["path"];
    const _c_0 = _t_0["canonical"];
    const _t_1 = _xs_0["tail"];
    const _pdf_0 = { $: "Pdf", ["name"]: _n_0, ["path"]: _p_0, ["canonical"]: _c_0 };
    return run_jump($dedupe$go$, [_t_1, run_loop($keepPdf$(_acc_0, _pdf_0, run_loop($hasCanonical$(_acc_0, _c_0))))]);
  }
}
function $dedupe$(_xs_0) {
  return run_jump($dedupe$go$, [_xs_0, { $: "Nil" }]);
}
function $pdfLe$(_a_0, _b_0) {
  const _na_0 = _a_0["name"];
  const _pa_0 = _a_0["path"];
  const _ca_0 = _a_0["canonical"];
  const _nb_0 = _b_0["name"];
  const _pb_0 = _b_0["path"];
  const _cb_0 = _b_0["canonical"];
  return run_jump($String$is_le$, [_na_0, _nb_0]);
}
function $insertPdf$finish$(_st_0) {
  const _acc_0 = _st_0["acc"];
  const _rest_0 = _st_0["rest"];
  const _x_0 = _st_0["x"];
  const _done_0 = _st_0["done"];
  return run_jump($List$append$, [run_loop($List$reverse$(_acc_0)), { $: "Con", ["head"]: _x_0, ["tail"]: _rest_0 }]);
}
function $insertPdf$step$(_acc_0, _x_0, _y_0, _ys_0, _le_0) {
  if (_le_0) {
    return { $: "PdfIns", ["acc"]: _acc_0, ["rest"]: { $: "Con", ["head"]: _y_0, ["tail"]: _ys_0 }, ["x"]: _x_0, ["done"]: true };
  } else {
    return { $: "PdfIns", ["acc"]: { $: "Con", ["head"]: _y_0, ["tail"]: _acc_0 }, ["rest"]: _ys_0, ["x"]: _x_0, ["done"]: false };
  }
}
function $insertPdf$go$(_fuel_0, _st_0) {
  if (_fuel_0 === 0n) {
    return run_jump($insertPdf$finish$, [_st_0]);
  } else {
    const _f_0 = _fuel_0 - 1n;
    const _acc_0 = _st_0["acc"];
    const _t_0 = _st_0["rest"];
    if (_t_0.$ === "Nil") {
      const _x_0 = _st_0["x"];
      const _done_0 = _st_0["done"];
      return run_jump($insertPdf$finish$, [{ $: "PdfIns", ["acc"]: _acc_0, ["rest"]: { $: "Nil" }, ["x"]: _x_0, ["done"]: true }]);
    } else {
      const _y_0 = _t_0["head"];
      const _ys_0 = _t_0["tail"];
      const _x_1 = _st_0["x"];
      const _t_1 = _st_0["done"];
      if (_t_1) {
        return run_jump($insertPdf$finish$, [{ $: "PdfIns", ["acc"]: _acc_0, ["rest"]: { $: "Con", ["head"]: _y_0, ["tail"]: _ys_0 }, ["x"]: _x_1, ["done"]: true }]);
      } else {
        return run_jump($insertPdf$go$, [_f_0, run_loop($insertPdf$step$(_acc_0, _x_1, _y_0, _ys_0, run_loop($pdfLe$(_x_1, _y_0))))]);
      }
    }
  }
}
function $insertPdf$(_x_0, _xs_0) {
  const _n_0 = run_loop($List$length$(_xs_0));
  return run_jump($insertPdf$go$, [_n_0, { $: "PdfIns", ["acc"]: { $: "Nil" }, ["rest"]: _xs_0, ["x"]: _x_0, ["done"]: false }]);
}
function $sortPdfs$go$(_fuel_0, _xs_0, _acc_0) {
  if (_fuel_0 === 0n) {
    return _acc_0;
  } else {
    const _f_0 = _fuel_0 - 1n;
    if (_xs_0.$ === "Nil") {
      return _acc_0;
    } else {
      const _h_0 = _xs_0["head"];
      const _t_0 = _xs_0["tail"];
      return run_jump($sortPdfs$go$, [_f_0, _t_0, run_loop($insertPdf$(_h_0, _acc_0))]);
    }
  }
}
function $sortPdfs$(_xs_0) {
  const _n_0 = run_loop($List$length$(_xs_0));
  return run_jump($sortPdfs$go$, [_n_0, _xs_0, { $: "Nil" }]);
}
function $courseLibrary$(_xs_0) {
  const _ds_0 = run_loop($dedupe$(_xs_0));
  return run_jump($sortPdfs$, [_ds_0]);
}
function $uniqueCanonicals$and$(_found_0, _rest_0) {
  if (_found_0) {
    return false;
  } else {
    return _rest_0;
  }
}
function $uniqueCanonicals$(_xs_0) {
  if (_xs_0.$ === "Nil") {
    return true;
  } else {
    const _t_0 = _xs_0["head"];
    const _n_0 = _t_0["name"];
    const _p_0 = _t_0["path"];
    const _c_0 = _t_0["canonical"];
    const _t_1 = _xs_0["tail"];
    return run_jump($uniqueCanonicals$and$, [run_loop($hasCanonical$(_t_1, _c_0)), run_loop($uniqueCanonicals$(_t_1))]);
  }
}
function $String$eq$(_a_0, _b_0) {
  return run_jump($String$eq$fin$, [run_loop($String$cmp$(_a_0, _b_0))]);
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
function $String$is_le$(_a_0, _b_0) {
  return run_jump($Cmp$is_le$, [run_loop($String$order$(_a_0, _b_0))]);
}
function $List$reverse$(_xs_0) {
  return run_jump($List$reverse$go$, [_xs_0, { $: "Nil" }]);
}
function $List$length$(_xs_0) {
  if (_xs_0.$ === "Nil") {
    return 0n;
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return nat_chk(run_loop($List$length$(_t_0)) + 1n);
  }
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
function $Cmp$is_le$(_c_0) {
  if (_c_0.$ === "LT") {
    return true;
  } else if (_c_0.$ === "EQ") {
    return true;
  } else {
    return false;
  }
}
function $String$order$(_a_0, _b_0) {
  return run_jump($String$order$fin$, [run_loop($String$cmp$(_a_0, _b_0))]);
}
function $List$reverse$go$(_xs_0, _acc_0) {
  if (_xs_0.$ === "Nil") {
    return _acc_0;
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return run_jump($List$reverse$go$, [_t_0, { $: "Con", ["head"]: _h_0, ["tail"]: _acc_0 }]);
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
function $String$order$fin$(_r_0) {
  const _ab_0 = _r_0["fst"];
  const _c_0 = _r_0["snd"];
  return _c_0;
}
function $String$cmp$rec$(_h1b_0, _h2b_0, _rr_0) {
  const _t_0 = _rr_0["fst"];
  const _t1b_0 = _t_0["fst"];
  const _t2b_0 = _t_0["snd"];
  const _r_0 = _rr_0["snd"];
  return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: _h1b_0 + _t1b_0, ["snd"]: _h2b_0 + _t2b_0 }, ["snd"]: _r_0 };
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

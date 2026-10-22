// GERADO de core/courses.bend por `bun core/build.mjs` — não editar à mão.
// core/courses.bend
function cmp_new(a, b) {
  return { $: a < b ? "LT" : a === b ? "EQ" : "GT" };
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
function $idOf(_c_0) {
  const _id_0 = _c_0["id"];
  return _id_0;
}
function $nameOf(_c_0) {
  const _name_0 = _c_0["name"];
  return _name_0;
}
function $pathOf(_c_0) {
  const _path_0 = _c_0["path"];
  return _path_0;
}
function $pdfName(_p_0) {
  const _name_0 = _p_0["name"];
  return _name_0;
}
function $ids(_xs_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return { $: "Con", head: $idOf(_h_0), tail: $ids(_t_0) };
  }
}
function $names(_xs_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return { $: "Con", head: $pdfName(_h_0), tail: $names(_t_0) };
  }
}
function $hasId(_xs_0, _id_0) {
  if (_xs_0.$ === "Nil") {
    return false;
  } else {
    const _t_0 = _xs_0["head"];
    const _cid_0 = _t_0["id"];
    const _t_1 = _xs_0["tail"];
    const _x_0 = $String_eq(_cid_0, _id_0);
    const _x_1 = $hasId(_t_1, _id_0);
    return _x_0 || _x_1;
  }
}
function $pickName_prev_if(_prevName_0, _id_0, _empty_0) {
  if (!_empty_0) {
    return _prevName_0;
  } else {
    return _id_0;
  }
}
function $pickName_prev(_prevName_0, _id_0) {
  return $pickName_prev_if(_prevName_0, _id_0, $String_is_empty(_prevName_0));
}
function $pickName_cfg(_cfgName_0, _prevName_0, _id_0, _empty_0) {
  if (!_empty_0) {
    return _cfgName_0;
  } else {
    return $pickName_prev(_prevName_0, _id_0);
  }
}
function $pickName(_cfgName_0, _prevName_0, _id_0) {
  return $pickName_cfg(_cfgName_0, _prevName_0, _id_0, $String_is_empty(_cfgName_0));
}
function $overlay(_prev_0, _cfg_0) {
  const _prevName_0 = _prev_0["name"];
  const _id_0 = _cfg_0["id"];
  const _cfgName_0 = _cfg_0["name"];
  const _cfgPath_0 = _cfg_0["path"];
  return { $: "Course", id: _id_0, name: $pickName(_cfgName_0, _prevName_0, _id_0), path: _cfgPath_0 };
}
function $asNew(_cfg_0) {
  const _id_0 = _cfg_0["id"];
  const _name_0 = _cfg_0["name"];
  const _path_0 = _cfg_0["path"];
  return { $: "Course", id: _id_0, name: $pickName(_name_0, "", _id_0), path: _path_0 };
}
function $rewrite(_h_0, _cfg_0, _same_0) {
  if (_same_0) {
    return $overlay(_h_0, _cfg_0);
  } else {
    return _h_0;
  }
}
function $rewriteHead(_h_0, _cfg_0) {
  const _hid_0 = _h_0["id"];
  const _hname_0 = _h_0["name"];
  const _hpath_0 = _h_0["path"];
  const _cid_0 = _cfg_0["id"];
  const _cname_0 = _cfg_0["name"];
  const _cpath_0 = _cfg_0["path"];
  return $rewrite({ $: "Course", id: _hid_0, name: _hname_0, path: _hpath_0 }, { $: "Course", id: _cid_0, name: _cname_0, path: _cpath_0 }, $String_eq(_hid_0, _cid_0));
}
function $updateById(_xs_0, _cfg_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return { $: "Con", head: $rewriteHead(_h_0, _cfg_0), tail: $updateById(_t_0, _cfg_0) };
  }
}
function $mergeOne_has(_acc_0, _cfg_0, _found_0) {
  if (_found_0) {
    return $updateById(_acc_0, _cfg_0);
  } else {
    return $List_append(_acc_0, { $: "Con", head: $asNew(_cfg_0), tail: { $: "Nil" } });
  }
}
function $mergeOne(_acc_0, _cfg_0) {
  const _id_0 = _cfg_0["id"];
  const _name_0 = _cfg_0["name"];
  const _path_0 = _cfg_0["path"];
  const _c_0 = { $: "Course", id: _id_0, name: _name_0, path: _path_0 };
  return $mergeOne_has(_acc_0, _c_0, $hasId(_acc_0, _id_0));
}
function $merge_go($0, $1) {
  for (;; ) {
    {
      const _cfg_0 = $0;
      const _acc_0 = $1;
      if (_cfg_0.$ === "Nil") {
        return _acc_0;
      } else {
        const _h_0 = _cfg_0["head"];
        const _t_0 = _cfg_0["tail"];
        $0 = _t_0;
        $1 = $mergeOne(_acc_0, _h_0);
        continue;
      }
    }
  }
}
function $mergeCourses(_discovered_0, _config_0) {
  return $merge_go(_config_0, _discovered_0);
}
function $uniqueIds_and(_found_0, _rest_0) {
  if (_found_0) {
    return false;
  } else {
    return _rest_0;
  }
}
function $uniqueIds(_xs_0) {
  if (_xs_0.$ === "Nil") {
    return true;
  } else {
    const _t_0 = _xs_0["head"];
    const _id_0 = _t_0["id"];
    const _t_1 = _xs_0["tail"];
    return $uniqueIds_and($hasId(_t_1, _id_0), $uniqueIds(_t_1));
  }
}
function $hasCanonical(_xs_0, _key_0) {
  if (_xs_0.$ === "Nil") {
    return false;
  } else {
    const _t_0 = _xs_0["head"];
    const _c_0 = _t_0["canonical"];
    const _t_1 = _xs_0["tail"];
    const _x_0 = $String_eq(_c_0, _key_0);
    const _x_1 = $hasCanonical(_t_1, _key_0);
    return _x_0 || _x_1;
  }
}
function $keepPdf(_acc_0, _pdf_0, _seen_0) {
  if (_seen_0) {
    return _acc_0;
  } else {
    return $List_append(_acc_0, { $: "Con", head: _pdf_0, tail: { $: "Nil" } });
  }
}
function $dedupe_go($0, $1) {
  for (;; ) {
    {
      const _xs_0 = $0;
      const _acc_0 = $1;
      if (_xs_0.$ === "Nil") {
        return _acc_0;
      } else {
        const _t_0 = _xs_0["head"];
        const _n_0 = _t_0["name"];
        const _p_0 = _t_0["path"];
        const _c_0 = _t_0["canonical"];
        const _t_1 = _xs_0["tail"];
        const _pdf_0 = { $: "Pdf", name: _n_0, path: _p_0, canonical: _c_0 };
        $0 = _t_1;
        $1 = $keepPdf(_acc_0, _pdf_0, $hasCanonical(_acc_0, _c_0));
        continue;
      }
    }
  }
}
function $dedupe(_xs_0) {
  return $dedupe_go(_xs_0, { $: "Nil" });
}
function $pdfLe(_a_0, _b_0) {
  const _na_0 = _a_0["name"];
  const _nb_0 = _b_0["name"];
  return $String_is_le(_na_0, _nb_0);
}
function $insertPdf_finish(_st_0) {
  const _acc_0 = _st_0["acc"];
  const _rest_0 = _st_0["rest"];
  const _x_0 = _st_0["x"];
  return $List_append($List_reverse(_acc_0), { $: "Con", head: _x_0, tail: _rest_0 });
}
function $insertPdf_step(_acc_0, _x_0, _y_0, _ys_0, _le_0) {
  if (_le_0) {
    return { $: "PdfIns", acc: _acc_0, rest: { $: "Con", head: _y_0, tail: _ys_0 }, x: _x_0, done: true };
  } else {
    return { $: "PdfIns", acc: { $: "Con", head: _y_0, tail: _acc_0 }, rest: _ys_0, x: _x_0, done: false };
  }
}
function $insertPdf_go($0, $1) {
  for (;; ) {
    {
      const _fuel_0 = $0;
      const _st_0 = $1;
      if (_fuel_0 === 0) {
        return $insertPdf_finish(_st_0);
      } else {
        const _f_0 = _fuel_0 - 1;
        const _acc_0 = _st_0["acc"];
        const _t_0 = _st_0["rest"];
        if (_t_0.$ === "Nil") {
          const _x_0 = _st_0["x"];
          return $insertPdf_finish({ $: "PdfIns", acc: _acc_0, rest: { $: "Nil" }, x: _x_0, done: true });
        } else {
          const _y_0 = _t_0["head"];
          const _ys_0 = _t_0["tail"];
          const _x_1 = _st_0["x"];
          const _t_1 = _st_0["done"];
          if (_t_1) {
            return $insertPdf_finish({ $: "PdfIns", acc: _acc_0, rest: { $: "Con", head: _y_0, tail: _ys_0 }, x: _x_1, done: true });
          } else {
            $0 = _f_0;
            $1 = $insertPdf_step(_acc_0, _x_1, _y_0, _ys_0, $pdfLe(_x_1, _y_0));
            continue;
          }
        }
      }
    }
  }
}
function $insertPdf(_x_0, _xs_0) {
  const _n_0 = $List_length(_xs_0);
  return $insertPdf_go(_n_0, { $: "PdfIns", acc: { $: "Nil" }, rest: _xs_0, x: _x_0, done: false });
}
function $sortPdfs_go($0, $1, $2) {
  for (;; ) {
    {
      const _fuel_0 = $0;
      const _xs_0 = $1;
      const _acc_0 = $2;
      if (_fuel_0 === 0) {
        return _acc_0;
      } else {
        const _f_0 = _fuel_0 - 1;
        if (_xs_0.$ === "Nil") {
          return _acc_0;
        } else {
          const _h_0 = _xs_0["head"];
          const _t_0 = _xs_0["tail"];
          $0 = _f_0;
          $1 = _t_0;
          $2 = $insertPdf(_h_0, _acc_0);
          continue;
        }
      }
    }
  }
}
function $sortPdfs(_xs_0) {
  const _n_0 = $List_length(_xs_0);
  return $sortPdfs_go(_n_0, _xs_0, { $: "Nil" });
}
function $courseLibrary(_xs_0) {
  const _ds_0 = $dedupe(_xs_0);
  return $sortPdfs(_ds_0);
}
function $uniqueCanonicals_and(_found_0, _rest_0) {
  if (_found_0) {
    return false;
  } else {
    return _rest_0;
  }
}
function $uniqueCanonicals(_xs_0) {
  if (_xs_0.$ === "Nil") {
    return true;
  } else {
    const _t_0 = _xs_0["head"];
    const _c_0 = _t_0["canonical"];
    const _t_1 = _xs_0["tail"];
    return $uniqueCanonicals_and($hasCanonical(_t_1, _c_0), $uniqueCanonicals(_t_1));
  }
}
function $String_eq(_a_0, _b_0) {
  return $Cmp_is_eq($String_order(_a_0, _b_0));
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
function $String_is_le(_a_0, _b_0) {
  return $Cmp_is_le($String_order(_a_0, _b_0));
}
function $List_reverse(_xs_0) {
  return $List_reverse_go(_xs_0, { $: "Nil" });
}
function $List_length(_xs_0) {
  if (_xs_0.$ === "Nil") {
    return 0;
  } else {
    const _t_0 = _xs_0["tail"];
    return nat_chk($List_length(_t_0) + 1);
  }
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
function $Cmp_is_le(_c_0) {
  if (_c_0.$ === "GT") {
    return false;
  } else {
    return true;
  }
}
function $List_reverse_go($0, $1) {
  for (;; ) {
    {
      const _xs_0 = $0;
      const _acc_0 = $1;
      if (_xs_0.$ === "Nil") {
        return _acc_0;
      } else {
        const _h_0 = _xs_0["head"];
        const _t_0 = _xs_0["tail"];
        $0 = _t_0;
        $1 = { $: "Con", head: _h_0, tail: _acc_0 };
        continue;
      }
    }
  }
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
var courses_default = {
  idOf: run_lib((a0) => str_out(run_loop($idOf(a0))), 1),
  nameOf: run_lib((a0) => str_out(run_loop($nameOf(a0))), 1),
  pathOf: run_lib((a0) => str_out(run_loop($pathOf(a0))), 1),
  pdfName: run_lib((a0) => str_out(run_loop($pdfName(a0))), 1),
  ids: run_lib((a0) => run_loop($ids(a0)), 1),
  names: run_lib((a0) => run_loop($names(a0)), 1),
  hasId: run_lib((a0, a1) => run_loop($hasId(a0, str_in(a1))), 2),
  "pickName.prev.if": run_lib((a0, a1, a2) => str_out(run_loop($pickName_prev_if(str_in(a0), str_in(a1), a2))), 3),
  "pickName.prev": run_lib((a0, a1) => str_out(run_loop($pickName_prev(str_in(a0), str_in(a1)))), 2),
  "pickName.cfg": run_lib((a0, a1, a2, a3) => str_out(run_loop($pickName_cfg(str_in(a0), str_in(a1), str_in(a2), a3))), 4),
  pickName: run_lib((a0, a1, a2) => str_out(run_loop($pickName(str_in(a0), str_in(a1), str_in(a2)))), 3),
  overlay: run_lib((a0, a1) => run_loop($overlay(a0, a1)), 2),
  asNew: run_lib((a0) => run_loop($asNew(a0)), 1),
  rewrite: run_lib((a0, a1, a2) => run_loop($rewrite(a0, a1, a2)), 3),
  rewriteHead: run_lib((a0, a1) => run_loop($rewriteHead(a0, a1)), 2),
  updateById: run_lib((a0, a1) => run_loop($updateById(a0, a1)), 2),
  "mergeOne.has": run_lib((a0, a1, a2) => run_loop($mergeOne_has(a0, a1, a2)), 3),
  mergeOne: run_lib((a0, a1) => run_loop($mergeOne(a0, a1)), 2),
  "merge.go": run_lib((a0, a1) => run_loop($merge_go(a0, a1)), 2),
  mergeCourses: run_lib((a0, a1) => run_loop($mergeCourses(a0, a1)), 2),
  "uniqueIds.and": run_lib((a0, a1) => run_loop($uniqueIds_and(a0, a1)), 2),
  uniqueIds: run_lib((a0) => run_loop($uniqueIds(a0)), 1),
  hasCanonical: run_lib((a0, a1) => run_loop($hasCanonical(a0, str_in(a1))), 2),
  keepPdf: run_lib((a0, a1, a2) => run_loop($keepPdf(a0, a1, a2)), 3),
  "dedupe.go": run_lib((a0, a1) => run_loop($dedupe_go(a0, a1)), 2),
  dedupe: run_lib((a0) => run_loop($dedupe(a0)), 1),
  pdfLe: run_lib((a0, a1) => run_loop($pdfLe(a0, a1)), 2),
  "insertPdf.finish": run_lib((a0) => run_loop($insertPdf_finish(a0)), 1),
  "insertPdf.step": run_lib((a0, a1, a2, a3, a4) => run_loop($insertPdf_step(a0, a1, a2, a3, a4)), 5),
  "insertPdf.go": run_lib((a0, a1) => run_loop($insertPdf_go(nat_in(a0), a1)), 2),
  insertPdf: run_lib((a0, a1) => run_loop($insertPdf(a0, a1)), 2),
  "sortPdfs.go": run_lib((a0, a1, a2) => run_loop($sortPdfs_go(nat_in(a0), a1, a2)), 3),
  sortPdfs: run_lib((a0) => run_loop($sortPdfs(a0)), 1),
  courseLibrary: run_lib((a0) => run_loop($courseLibrary(a0)), 1),
  "uniqueCanonicals.and": run_lib((a0, a1) => run_loop($uniqueCanonicals_and(a0, a1)), 2),
  uniqueCanonicals: run_lib((a0) => run_loop($uniqueCanonicals(a0)), 1)
};
export {
  courses_default as default
};

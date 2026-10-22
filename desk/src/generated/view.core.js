// GERADO de core/view.bend por `bun core/build.mjs` — não editar à mão.
// core/view.bend
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
function $attr(_name_0, _value_0) {
  return { $: "ViewAttr", name: _name_0, value: _value_0 };
}
function $classOn(_name_0, _on_0) {
  return { $: "ViewClass", name: _name_0, on: _on_0 };
}
function $viewEl(_tag_0, _attrs_0, _kids_0) {
  return { $: "ViewEl", tag: _tag_0, attrs: _attrs_0, kids: _kids_0 };
}
function $viewText(_s_0) {
  return { $: "ViewText", text: _s_0 };
}
function $viewKey(_tag_0, _key_0, _attrs_0, _kids_0) {
  return $viewEl(_tag_0, { $: "Con", head: { $: "ViewAttr", name: "key", value: _key_0 }, tail: _attrs_0 }, _kids_0);
}
function $tagOf(_n_0) {
  if (_n_0.$ === "ViewEl") {
    const _tag_0 = _n_0["tag"];
    return _tag_0;
  } else {
    return "";
  }
}
function $attrsOf(_n_0) {
  if (_n_0.$ === "ViewEl") {
    const _attrs_0 = _n_0["attrs"];
    return _attrs_0;
  } else {
    return { $: "Nil" };
  }
}
function $kidsOf(_n_0) {
  if (_n_0.$ === "ViewEl") {
    const _kids_0 = _n_0["kids"];
    return _kids_0;
  } else {
    return { $: "Nil" };
  }
}
function $textOf(_n_0) {
  if (_n_0.$ === "ViewEl") {
    return "";
  } else {
    const _text_0 = _n_0["text"];
    return _text_0;
  }
}
function $isText(_n_0) {
  if (_n_0.$ === "ViewEl") {
    return false;
  } else {
    return true;
  }
}
function $attrGet_choose(_av_0, _rest_0, _same_0) {
  if (_same_0) {
    return { $: "Some", value: _av_0 };
  } else {
    return _rest_0;
  }
}
function $attrGet_go(_attrs_0, _name_0) {
  if (_attrs_0.$ === "Nil") {
    return { $: "None" };
  } else {
    const _t_0 = _attrs_0["head"];
    const _an_0 = _t_0["name"];
    const _av_0 = _t_0["value"];
    const _t_1 = _attrs_0["tail"];
    return $attrGet_choose(_av_0, $attrGet_go(_t_1, _name_0), $String_eq(_an_0, _name_0));
  }
}
function $attrGet(_attrs_0, _name_0) {
  return $attrGet_go(_attrs_0, _name_0);
}
function $attrWhen(_cond_0, _a_0) {
  if (_cond_0) {
    return { $: "Con", head: _a_0, tail: { $: "Nil" } };
  } else {
    return { $: "Nil" };
  }
}
function $attrConcat(_xs_0, _ys_0) {
  return $List_append(_xs_0, _ys_0);
}
function $attrJoin(_xss_0) {
  return $List_concat(_xss_0);
}
function $attrId(_value_0) {
  return { $: "ViewAttr", name: "id", value: _value_0 };
}
function $attrClass(_value_0) {
  return { $: "ViewAttr", name: "class", value: _value_0 };
}
function $attrType(_value_0) {
  return { $: "ViewAttr", name: "type", value: _value_0 };
}
function $attrTitle(_value_0) {
  return { $: "ViewAttr", name: "title", value: _value_0 };
}
function $attrKey(_value_0) {
  return { $: "ViewAttr", name: "key", value: _value_0 };
}
function $attrOn(_event_0, _handler_0) {
  return { $: "ViewAttr", name: "on:" + _event_0, value: _handler_0 };
}
function $attrData(_name_0, _value_0) {
  return { $: "ViewAttr", name: "data-" + _name_0, value: _value_0 };
}
function $attrAria(_name_0, _value_0) {
  return { $: "ViewAttr", name: "aria-" + _name_0, value: _value_0 };
}
function $boolStr(_on_0) {
  if (_on_0) {
    return "true";
  } else {
    return "false";
  }
}
function $attrBool(_name_0, _on_0) {
  return { $: "ViewAttr", name: _name_0, value: $boolStr(_on_0) };
}
function $classAppend_empty(_acc_0, _name_0, _empty_0) {
  if (_empty_0) {
    return _name_0;
  } else {
    const _x_0 = " " + _name_0;
    return _acc_0 + _x_0;
  }
}
function $classAppend(_acc_0, _name_0) {
  return $classAppend_empty(_acc_0, _name_0, $String_is_empty(_acc_0));
}
function $classNext_emptyName(_name_0, _acc_0, _emptyName_0) {
  if (_emptyName_0) {
    return _acc_0;
  } else {
    return $classAppend(_acc_0, _name_0);
  }
}
function $classNext_on(_name_0, _on_0, _acc_0) {
  if (!_on_0) {
    return _acc_0;
  } else {
    return $classNext_emptyName(_name_0, _acc_0, $String_is_empty(_name_0));
  }
}
function $classValue_go($0, $1) {
  for (;; ) {
    {
      const _xs_0 = $0;
      const _acc_0 = $1;
      if (_xs_0.$ === "Nil") {
        return _acc_0;
      } else {
        const _t_0 = _xs_0["head"];
        const _name_0 = _t_0["name"];
        const _on_0 = _t_0["on"];
        const _t_1 = _xs_0["tail"];
        $0 = _t_1;
        $1 = $classNext_on(_name_0, _on_0, _acc_0);
        continue;
      }
    }
  }
}
function $classValue(_xs_0) {
  return $classValue_go(_xs_0, "");
}
function $classes(_xs_0) {
  return { $: "ViewAttr", name: "class", value: $classValue(_xs_0) };
}
function $viewWhen(_cond_0, _node_0) {
  if (_cond_0) {
    return { $: "Con", head: _node_0, tail: { $: "Nil" } };
  } else {
    return { $: "Nil" };
  }
}
function $viewWhenAll(_cond_0, _nodes_0) {
  if (_cond_0) {
    return _nodes_0;
  } else {
    return { $: "Nil" };
  }
}
function $viewConcat(_xs_0, _ys_0) {
  return $List_append(_xs_0, _ys_0);
}
function $viewJoin(_xss_0) {
  return $List_concat(_xss_0);
}
function $viewMapText(_xs_0) {
  return $viewMap_0(_xs_0);
}
function $asTextI(_i_0, _s_0) {
  return $viewText(_s_0);
}
function $viewMapTextI_go(_xs_0, _i_0) {
  return $viewMapI_go_0(_xs_0, _i_0);
}
function $viewMapTextI(_xs_0) {
  return $viewMapTextI_go(_xs_0, 0);
}
function $String_eq(_a_0, _b_0) {
  return $Cmp_is_eq($String_order(_a_0, _b_0));
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
function $List_concat(_xss_0) {
  if (_xss_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xss_0["head"];
    const _t_0 = _xss_0["tail"];
    return $List_append(_h_0, $List_concat(_t_0));
  }
}
function $String_is_empty(_s_0) {
  if (_s_0 === "") {
    return true;
  } else {
    return false;
  }
}
function $viewMap_0(_xs_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return { $: "Con", head: $viewText(_h_0), tail: $viewMap_0(_t_0) };
  }
}
function $viewMapI_go_0(_xs_0, _i_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return { $: "Con", head: $asTextI(_i_0, _h_0), tail: $viewMapI_go_0(_t_0, nat_chk(_i_0 + 1)) };
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
var view_default = {
  attr: run_lib((a0, a1) => run_loop($attr(str_in(a0), str_in(a1))), 2),
  classOn: run_lib((a0, a1) => run_loop($classOn(str_in(a0), a1)), 2),
  viewEl: run_lib((a0, a1, a2) => run_loop($viewEl(str_in(a0), a1, a2)), 3),
  viewText: run_lib((a0) => run_loop($viewText(str_in(a0))), 1),
  viewKey: run_lib((a0, a1, a2, a3) => run_loop($viewKey(str_in(a0), str_in(a1), a2, a3)), 4),
  tagOf: run_lib((a0) => str_out(run_loop($tagOf(a0))), 1),
  attrsOf: run_lib((a0) => run_loop($attrsOf(a0)), 1),
  kidsOf: run_lib((a0) => run_loop($kidsOf(a0)), 1),
  textOf: run_lib((a0) => str_out(run_loop($textOf(a0))), 1),
  isText: run_lib((a0) => run_loop($isText(a0)), 1),
  "attrGet.choose": run_lib((a0, a1, a2) => run_loop($attrGet_choose(str_in(a0), a1, a2)), 3),
  "attrGet.go": run_lib((a0, a1) => run_loop($attrGet_go(a0, str_in(a1))), 2),
  attrGet: run_lib((a0, a1) => run_loop($attrGet(a0, str_in(a1))), 2),
  attrWhen: run_lib((a0, a1) => run_loop($attrWhen(a0, a1)), 2),
  attrConcat: run_lib((a0, a1) => run_loop($attrConcat(a0, a1)), 2),
  attrJoin: run_lib((a0) => run_loop($attrJoin(a0)), 1),
  attrId: run_lib((a0) => run_loop($attrId(str_in(a0))), 1),
  attrClass: run_lib((a0) => run_loop($attrClass(str_in(a0))), 1),
  attrType: run_lib((a0) => run_loop($attrType(str_in(a0))), 1),
  attrTitle: run_lib((a0) => run_loop($attrTitle(str_in(a0))), 1),
  attrKey: run_lib((a0) => run_loop($attrKey(str_in(a0))), 1),
  attrOn: run_lib((a0, a1) => run_loop($attrOn(str_in(a0), str_in(a1))), 2),
  attrData: run_lib((a0, a1) => run_loop($attrData(str_in(a0), str_in(a1))), 2),
  attrAria: run_lib((a0, a1) => run_loop($attrAria(str_in(a0), str_in(a1))), 2),
  boolStr: run_lib((a0) => str_out(run_loop($boolStr(a0))), 1),
  attrBool: run_lib((a0, a1) => run_loop($attrBool(str_in(a0), a1)), 2),
  "classAppend.empty": run_lib((a0, a1, a2) => str_out(run_loop($classAppend_empty(str_in(a0), str_in(a1), a2))), 3),
  classAppend: run_lib((a0, a1) => str_out(run_loop($classAppend(str_in(a0), str_in(a1)))), 2),
  "classNext.emptyName": run_lib((a0, a1, a2) => str_out(run_loop($classNext_emptyName(str_in(a0), str_in(a1), a2))), 3),
  "classNext.on": run_lib((a0, a1, a2) => str_out(run_loop($classNext_on(str_in(a0), a1, str_in(a2)))), 3),
  "classValue.go": run_lib((a0, a1) => str_out(run_loop($classValue_go(a0, str_in(a1)))), 2),
  classValue: run_lib((a0) => str_out(run_loop($classValue(a0))), 1),
  classes: run_lib((a0) => run_loop($classes(a0)), 1),
  viewWhen: run_lib((a0, a1) => run_loop($viewWhen(a0, a1)), 2),
  viewWhenAll: run_lib((a0, a1) => run_loop($viewWhenAll(a0, a1)), 2),
  viewConcat: run_lib((a0, a1) => run_loop($viewConcat(a0, a1)), 2),
  viewJoin: run_lib((a0) => run_loop($viewJoin(a0)), 1),
  viewMapText: run_lib((a0) => run_loop($viewMapText(a0)), 1),
  asTextI: run_lib((a0, a1) => run_loop($asTextI(nat_in(a0), str_in(a1))), 2),
  "viewMapTextI.go": run_lib((a0, a1) => run_loop($viewMapTextI_go(a0, nat_in(a1))), 2),
  viewMapTextI: run_lib((a0) => run_loop($viewMapTextI(a0)), 1)
};
export {
  view_default as default
};

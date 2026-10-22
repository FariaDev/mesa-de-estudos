// GERADO de core/guideview.bend por `bun core/build.mjs` — não editar à mão.
// core/guideview.bend
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
function $msg_mark() {
  return "";
}
function $msg_sep() {
  return "";
}
function $msg_pack(_parts_0) {
  const _x_0 = $msg_mark();
  const _x_1 = $String_join(_parts_0, $msg_sep());
  return _x_0 + _x_1;
}
function $msg_msg(_key_0) {
  return $msg_pack({ $: "Con", head: _key_0, tail: { $: "Nil" } });
}
function $msg_msg1(_key_0, _n1_0, _v1_0) {
  return $msg_pack({ $: "Con", head: _key_0, tail: { $: "Con", head: _n1_0, tail: { $: "Con", head: _v1_0, tail: { $: "Nil" } } } });
}
function $msg_msg2(_key_0, _n1_0, _v1_0, _n2_0, _v2_0) {
  return $msg_pack({ $: "Con", head: _key_0, tail: { $: "Con", head: _n1_0, tail: { $: "Con", head: _v1_0, tail: { $: "Con", head: _n2_0, tail: { $: "Con", head: _v2_0, tail: { $: "Nil" } } } } } });
}
function $msg_msg3(_key_0, _n1_0, _v1_0, _n2_0, _v2_0, _n3_0, _v3_0) {
  return $msg_pack({ $: "Con", head: _key_0, tail: { $: "Con", head: _n1_0, tail: { $: "Con", head: _v1_0, tail: { $: "Con", head: _n2_0, tail: { $: "Con", head: _v2_0, tail: { $: "Con", head: _n3_0, tail: { $: "Con", head: _v3_0, tail: { $: "Nil" } } } } } } } });
}
function $msg_msg4(_key_0, _n1_0, _v1_0, _n2_0, _v2_0, _n3_0, _v3_0, _n4_0, _v4_0) {
  return $msg_pack({ $: "Con", head: _key_0, tail: { $: "Con", head: _n1_0, tail: { $: "Con", head: _v1_0, tail: { $: "Con", head: _n2_0, tail: { $: "Con", head: _v2_0, tail: { $: "Con", head: _n3_0, tail: { $: "Con", head: _v3_0, tail: { $: "Con", head: _n4_0, tail: { $: "Con", head: _v4_0, tail: { $: "Nil" } } } } } } } } } });
}
function $msg_isMsg(_s_0) {
  return $String_starts_with(_s_0, $msg_mark());
}
function $view_attr(_name_0, _value_0) {
  return { $: "ViewAttr", name: _name_0, value: _value_0 };
}
function $view_classOn(_name_0, _on_0) {
  return { $: "ViewClass", name: _name_0, on: _on_0 };
}
function $view_viewEl(_tag_0, _attrs_0, _kids_0) {
  return { $: "ViewEl", tag: _tag_0, attrs: _attrs_0, kids: _kids_0 };
}
function $view_viewText(_s_0) {
  return { $: "ViewText", text: _s_0 };
}
function $view_viewKey(_tag_0, _key_0, _attrs_0, _kids_0) {
  return $view_viewEl(_tag_0, { $: "Con", head: { $: "ViewAttr", name: "key", value: _key_0 }, tail: _attrs_0 }, _kids_0);
}
function $view_tagOf(_n_0) {
  if (_n_0.$ === "ViewEl") {
    const _tag_0 = _n_0["tag"];
    return _tag_0;
  } else {
    return "";
  }
}
function $view_attrsOf(_n_0) {
  if (_n_0.$ === "ViewEl") {
    const _attrs_0 = _n_0["attrs"];
    return _attrs_0;
  } else {
    return { $: "Nil" };
  }
}
function $view_kidsOf(_n_0) {
  if (_n_0.$ === "ViewEl") {
    const _kids_0 = _n_0["kids"];
    return _kids_0;
  } else {
    return { $: "Nil" };
  }
}
function $view_textOf(_n_0) {
  if (_n_0.$ === "ViewEl") {
    return "";
  } else {
    const _text_0 = _n_0["text"];
    return _text_0;
  }
}
function $view_isText(_n_0) {
  if (_n_0.$ === "ViewEl") {
    return false;
  } else {
    return true;
  }
}
function $view_attrGet_choose(_av_0, _rest_0, _same_0) {
  if (_same_0) {
    return { $: "Some", value: _av_0 };
  } else {
    return _rest_0;
  }
}
function $view_attrGet_go(_attrs_0, _name_0) {
  if (_attrs_0.$ === "Nil") {
    return { $: "None" };
  } else {
    const _t_0 = _attrs_0["head"];
    const _an_0 = _t_0["name"];
    const _av_0 = _t_0["value"];
    const _t_1 = _attrs_0["tail"];
    return $view_attrGet_choose(_av_0, $view_attrGet_go(_t_1, _name_0), $String_eq(_an_0, _name_0));
  }
}
function $view_attrGet(_attrs_0, _name_0) {
  return $view_attrGet_go(_attrs_0, _name_0);
}
function $view_attrWhen(_cond_0, _a_0) {
  if (_cond_0) {
    return { $: "Con", head: _a_0, tail: { $: "Nil" } };
  } else {
    return { $: "Nil" };
  }
}
function $view_attrConcat(_xs_0, _ys_0) {
  return $List_append(_xs_0, _ys_0);
}
function $view_attrJoin(_xss_0) {
  return $List_concat(_xss_0);
}
function $view_attrId(_value_0) {
  return { $: "ViewAttr", name: "id", value: _value_0 };
}
function $view_attrClass(_value_0) {
  return { $: "ViewAttr", name: "class", value: _value_0 };
}
function $view_attrType(_value_0) {
  return { $: "ViewAttr", name: "type", value: _value_0 };
}
function $view_attrTitle(_value_0) {
  return { $: "ViewAttr", name: "title", value: _value_0 };
}
function $view_attrKey(_value_0) {
  return { $: "ViewAttr", name: "key", value: _value_0 };
}
function $view_attrOn(_event_0, _handler_0) {
  return { $: "ViewAttr", name: "on:" + _event_0, value: _handler_0 };
}
function $view_attrData(_name_0, _value_0) {
  return { $: "ViewAttr", name: "data-" + _name_0, value: _value_0 };
}
function $view_attrAria(_name_0, _value_0) {
  return { $: "ViewAttr", name: "aria-" + _name_0, value: _value_0 };
}
function $view_boolStr(_on_0) {
  if (_on_0) {
    return "true";
  } else {
    return "false";
  }
}
function $view_attrBool(_name_0, _on_0) {
  return { $: "ViewAttr", name: _name_0, value: $view_boolStr(_on_0) };
}
function $view_classAppend_empty(_acc_0, _name_0, _empty_0) {
  if (_empty_0) {
    return _name_0;
  } else {
    const _x_0 = " " + _name_0;
    return _acc_0 + _x_0;
  }
}
function $view_classAppend(_acc_0, _name_0) {
  return $view_classAppend_empty(_acc_0, _name_0, $String_is_empty(_acc_0));
}
function $view_classNext_emptyName(_name_0, _acc_0, _emptyName_0) {
  if (_emptyName_0) {
    return _acc_0;
  } else {
    return $view_classAppend(_acc_0, _name_0);
  }
}
function $view_classNext_on(_name_0, _on_0, _acc_0) {
  if (!_on_0) {
    return _acc_0;
  } else {
    return $view_classNext_emptyName(_name_0, _acc_0, $String_is_empty(_name_0));
  }
}
function $view_classValue_go($0, $1) {
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
        $1 = $view_classNext_on(_name_0, _on_0, _acc_0);
        continue;
      }
    }
  }
}
function $view_classValue(_xs_0) {
  return $view_classValue_go(_xs_0, "");
}
function $view_classes(_xs_0) {
  return { $: "ViewAttr", name: "class", value: $view_classValue(_xs_0) };
}
function $view_viewWhen(_cond_0, _node_0) {
  if (_cond_0) {
    return { $: "Con", head: _node_0, tail: { $: "Nil" } };
  } else {
    return { $: "Nil" };
  }
}
function $view_viewWhenAll(_cond_0, _nodes_0) {
  if (_cond_0) {
    return _nodes_0;
  } else {
    return { $: "Nil" };
  }
}
function $view_viewConcat(_xs_0, _ys_0) {
  return $List_append(_xs_0, _ys_0);
}
function $view_viewJoin(_xss_0) {
  return $List_concat(_xss_0);
}
function $view_viewMapText(_xs_0) {
  return $view_viewMap_0(_xs_0);
}
function $view_asTextI(_i_0, _s_0) {
  return $view_viewText(_s_0);
}
function $view_viewMapTextI_go(_xs_0, _i_0) {
  return $view_viewMapI_go_0(_xs_0, _i_0);
}
function $view_viewMapTextI(_xs_0) {
  return $view_viewMapTextI_go(_xs_0, 0);
}
function $guideAll() {
  return { $: "Con", head: "comecar", tail: { $: "Con", head: "tutor", tail: { $: "Con", head: "leitores", tail: { $: "Con", head: "lateral", tail: { $: "Con", head: "revisao", tail: { $: "Con", head: "calc", tail: { $: "Con", head: "atalhos", tail: { $: "Nil" } } } } } } } };
}
function $guidePick(_hit_0, _found_0, _rest_0) {
  if (_hit_0) {
    return _found_0;
  } else {
    return _rest_0;
  }
}
function $guideLabel(_id_0) {
  return $guidePick($String_eq(_id_0, "comecar"), $msg_msg("guide.label.comecar"), $guidePick($String_eq(_id_0, "tutor"), $msg_msg("guide.label.tutor"), $guidePick($String_eq(_id_0, "leitores"), $msg_msg("guide.label.leitores"), $guidePick($String_eq(_id_0, "lateral"), $msg_msg("guide.label.lateral"), $guidePick($String_eq(_id_0, "revisao"), $msg_msg("guide.label.revisao"), $guidePick($String_eq(_id_0, "calc"), $msg_msg("guide.label.calc"), $guidePick($String_eq(_id_0, "atalhos"), $msg_msg("guide.label.atalhos"), "")))))));
}
function $guideTitle(_id_0) {
  return $guidePick($String_eq(_id_0, "comecar"), $msg_msg("guide.sectionTitle.comecar"), $guidePick($String_eq(_id_0, "tutor"), $msg_msg("guide.sectionTitle.tutor"), $guidePick($String_eq(_id_0, "leitores"), $msg_msg("guide.sectionTitle.leitores"), $guidePick($String_eq(_id_0, "lateral"), $msg_msg("guide.sectionTitle.lateral"), $guidePick($String_eq(_id_0, "revisao"), $msg_msg("guide.sectionTitle.revisao"), $guidePick($String_eq(_id_0, "calc"), $msg_msg("guide.sectionTitle.calc"), $guidePick($String_eq(_id_0, "atalhos"), $msg_msg("guide.label.atalhos"), "")))))));
}
function $guideLead(_id_0) {
  return $guidePick($String_eq(_id_0, "comecar"), $msg_msg("guide.lead.comecar"), $guidePick($String_eq(_id_0, "tutor"), $msg_msg("guide.lead.tutor"), $guidePick($String_eq(_id_0, "leitores"), $msg_msg("guide.lead.leitores"), $guidePick($String_eq(_id_0, "lateral"), $msg_msg("guide.lead.lateral"), $guidePick($String_eq(_id_0, "revisao"), $msg_msg("guide.lead.revisao"), $guidePick($String_eq(_id_0, "calc"), $msg_msg("guide.lead.calc"), $guidePick($String_eq(_id_0, "atalhos"), $msg_msg("guide.lead.atalhos"), "")))))));
}
function $guideCrumb(_id_0) {
  return $guideLabel(_id_0);
}
function $guideSearchLabel() {
  return $msg_msg("guide.search");
}
function $guideNoHits() {
  return $msg_msg("guide.noHits");
}
function $guideHas_step(_same_0, _rest_0) {
  return _same_0 || _rest_0;
}
function $guideHas(_xs_0, _id_0) {
  if (_xs_0.$ === "Nil") {
    return false;
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return $guideHas_step($String_eq(_h_0, _id_0), $guideHas(_t_0, _id_0));
  }
}
function $guideKeep_step(_hit_0, _h_0, _rest_0) {
  if (_hit_0) {
    return { $: "Con", head: _h_0, tail: _rest_0 };
  } else {
    return _rest_0;
  }
}
function $guideKeep(_all_0, _hits_0) {
  if (_all_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _all_0["head"];
    const _t_0 = _all_0["tail"];
    return $guideKeep_step($guideHas(_hits_0, _h_0), _h_0, $guideKeep(_t_0, _hits_0));
  }
}
function $guideVisible(_hits_0) {
  return $guideKeep($guideAll(), _hits_0);
}
function $guideFirst(_xs_0) {
  if (_xs_0.$ === "Nil") {
    return "";
  } else {
    const _h_0 = _xs_0["head"];
    return _h_0;
  }
}
function $guideCurrent_pick(_member_0, _id_0, _first_0) {
  if (_member_0) {
    return _id_0;
  } else {
    return _first_0;
  }
}
function $guideCurrent(_vis_0, _id_0) {
  return $guideCurrent_pick($guideHas(_vis_0, _id_0), _id_0, $guideFirst(_vis_0));
}
function $guideNext_step(_same_0, _after_0, _rest_0) {
  if (_same_0) {
    return _after_0;
  } else {
    return _rest_0;
  }
}
function $guideNext(_vis_0, _id_0) {
  if (_vis_0.$ === "Nil") {
    return "";
  } else {
    const _h_0 = _vis_0["head"];
    const _t_0 = _vis_0["tail"];
    return $guideNext_step($String_eq(_h_0, _id_0), $guideFirst(_t_0), $guideNext(_t_0, _id_0));
  }
}
function $guidePrev_go(_vis_0, _id_0, _before_0) {
  if (_vis_0.$ === "Nil") {
    return "";
  } else {
    const _h_0 = _vis_0["head"];
    const _t_0 = _vis_0["tail"];
    return $guideNext_step($String_eq(_h_0, _id_0), _before_0, $guidePrev_go(_t_0, _id_0, _h_0));
  }
}
function $guidePrev(_vis_0, _id_0) {
  return $guidePrev_go(_vis_0, _id_0, "");
}
function $guideNextText_if(_next_0, _none_0) {
  if (_none_0) {
    return "";
  } else {
    return $msg_msg1("guide.next", "section", "guide.label." + _next_0);
  }
}
function $guideNextLabel(_vis_0, _id_0) {
  return $guideNextText_if($guideNext(_vis_0, _id_0), $String_is_empty($guideNext(_vis_0, _id_0)));
}
function $guidePrevText_if(_none_0) {
  if (_none_0) {
    return "";
  } else {
    return $msg_msg("guide.prev");
  }
}
function $guidePrevLabel(_vis_0, _id_0) {
  return $guidePrevText_if($String_is_empty($guidePrev(_vis_0, _id_0)));
}
function $guideNavItem(_id_0, _cur_0) {
  return $view_viewEl("button", { $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_attrClass("guide-nav-item"), tail: { $: "Con", head: $view_attrData("section", _id_0), tail: { $: "Con", head: $view_attrAria("current", $guidePick($String_eq(_id_0, _cur_0), "page", "false")), tail: { $: "Con", head: $view_attrOn("click", "GuidePick"), tail: { $: "Nil" } } } } } }, { $: "Con", head: $view_viewText($guideLabel(_id_0)), tail: { $: "Nil" } });
}
function $guideNavNodes(_vis_0, _cur_0) {
  if (_vis_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _vis_0["head"];
    const _t_0 = _vis_0["tail"];
    return { $: "Con", head: $guideNavItem(_h_0, _cur_0), tail: $guideNavNodes(_t_0, _cur_0) };
  }
}
function $guideStepNode(_kind_0, _target_0, _text_0) {
  return $view_viewEl("button", { $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_attrClass(_kind_0), tail: { $: "Con", head: $view_attrData("section", _target_0), tail: { $: "Con", head: $view_attrOn("click", "GuidePick"), tail: { $: "Nil" } } } } }, { $: "Con", head: $view_viewText(_text_0), tail: { $: "Nil" } });
}
function $guideStepWhen(_kind_0, _target_0, _text_0) {
  return $view_viewWhen($Bool_not($String_is_empty(_target_0)), $guideStepNode(_kind_0, _target_0, _text_0));
}
function $guideFoot(_vis_0, _cur_0) {
  return $view_viewConcat($guideStepWhen("guide-step guide-prev", $guidePrev(_vis_0, _cur_0), $guidePrevLabel(_vis_0, _cur_0)), $guideStepWhen("guide-step guide-next", $guideNext(_vis_0, _cur_0), $guideNextLabel(_vis_0, _cur_0)));
}
function $String_join(_xs_0, _sep_0) {
  if (_xs_0.$ === "Nil") {
    return "";
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return $String_join_go(_t_0, _h_0, _sep_0);
  }
}
function $String_starts_with($0, $1, $2) {
  let $pc = 0;
  for (;; )
    switch ($pc) {
      case 0: {
        const _s_0 = $0;
        const _p_0 = $1;
        if (_s_0 === "") {
          if (_p_0 === "") {
            return true;
          } else {
            return false;
          }
        } else {
          const _h_1 = _s_0.slice(0, char_len(_s_0));
          const _t_1 = _s_0.slice(char_len(_s_0));
          if (_p_0 === "") {
            return true;
          } else {
            const _y_0 = _p_0.slice(0, char_len(_p_0));
            const _yt_0 = _p_0.slice(char_len(_p_0));
            $0 = _t_1;
            $1 = _yt_0;
            $2 = $Char_is_eq(_h_1, _y_0);
            $pc = 1;
            continue;
          }
        }
      }
      case 1: {
        const _t_0 = $0;
        const _pt_0 = $1;
        const _same_0 = $2;
        if (!_same_0) {
          return false;
        } else {
          $0 = _t_0;
          $1 = _pt_0;
          $pc = 0;
          continue;
        }
      }
    }
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
function $view_viewMap_0(_xs_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return { $: "Con", head: $view_viewText(_h_0), tail: $view_viewMap_0(_t_0) };
  }
}
function $view_viewMapI_go_0(_xs_0, _i_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return { $: "Con", head: $view_asTextI(_i_0, _h_0), tail: $view_viewMapI_go_0(_t_0, nat_chk(_i_0 + 1)) };
  }
}
function $Bool_not(_b_0) {
  if (!_b_0) {
    return true;
  } else {
    return false;
  }
}
function $String_join_go(_xs_0, _h_0, _sep_0) {
  if (_xs_0.$ === "Nil") {
    return _h_0;
  } else {
    const _h2_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    const _x_0 = $String_join_go(_t_0, _h2_0, _sep_0);
    const _x_1 = _sep_0 + _x_0;
    return _h_0 + _x_1;
  }
}
function $Char_is_eq(_a_0, _b_0) {
  const _x_0 = char_code(_a_0);
  const _x_1 = char_code(_b_0);
  return _x_0 === _x_1;
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
var guideview_default = {
  "msg.mark": run_lib(() => str_out(run_loop($msg_mark())), 0),
  "msg.sep": run_lib(() => str_out(run_loop($msg_sep())), 0),
  "msg.pack": run_lib((a0) => str_out(run_loop($msg_pack(a0))), 1),
  "msg.msg": run_lib((a0) => str_out(run_loop($msg_msg(str_in(a0)))), 1),
  "msg.msg1": run_lib((a0, a1, a2) => str_out(run_loop($msg_msg1(str_in(a0), str_in(a1), str_in(a2)))), 3),
  "msg.msg2": run_lib((a0, a1, a2, a3, a4) => str_out(run_loop($msg_msg2(str_in(a0), str_in(a1), str_in(a2), str_in(a3), str_in(a4)))), 5),
  "msg.msg3": run_lib((a0, a1, a2, a3, a4, a5, a6) => str_out(run_loop($msg_msg3(str_in(a0), str_in(a1), str_in(a2), str_in(a3), str_in(a4), str_in(a5), str_in(a6)))), 7),
  "msg.msg4": run_lib((a0, a1, a2, a3, a4, a5, a6, a7, a8) => str_out(run_loop($msg_msg4(str_in(a0), str_in(a1), str_in(a2), str_in(a3), str_in(a4), str_in(a5), str_in(a6), str_in(a7), str_in(a8)))), 9),
  "msg.isMsg": run_lib((a0) => run_loop($msg_isMsg(str_in(a0))), 1),
  "view.attr": run_lib((a0, a1) => run_loop($view_attr(str_in(a0), str_in(a1))), 2),
  "view.classOn": run_lib((a0, a1) => run_loop($view_classOn(str_in(a0), a1)), 2),
  "view.viewEl": run_lib((a0, a1, a2) => run_loop($view_viewEl(str_in(a0), a1, a2)), 3),
  "view.viewText": run_lib((a0) => run_loop($view_viewText(str_in(a0))), 1),
  "view.viewKey": run_lib((a0, a1, a2, a3) => run_loop($view_viewKey(str_in(a0), str_in(a1), a2, a3)), 4),
  "view.tagOf": run_lib((a0) => str_out(run_loop($view_tagOf(a0))), 1),
  "view.attrsOf": run_lib((a0) => run_loop($view_attrsOf(a0)), 1),
  "view.kidsOf": run_lib((a0) => run_loop($view_kidsOf(a0)), 1),
  "view.textOf": run_lib((a0) => str_out(run_loop($view_textOf(a0))), 1),
  "view.isText": run_lib((a0) => run_loop($view_isText(a0)), 1),
  "view.attrGet.choose": run_lib((a0, a1, a2) => run_loop($view_attrGet_choose(str_in(a0), a1, a2)), 3),
  "view.attrGet.go": run_lib((a0, a1) => run_loop($view_attrGet_go(a0, str_in(a1))), 2),
  "view.attrGet": run_lib((a0, a1) => run_loop($view_attrGet(a0, str_in(a1))), 2),
  "view.attrWhen": run_lib((a0, a1) => run_loop($view_attrWhen(a0, a1)), 2),
  "view.attrConcat": run_lib((a0, a1) => run_loop($view_attrConcat(a0, a1)), 2),
  "view.attrJoin": run_lib((a0) => run_loop($view_attrJoin(a0)), 1),
  "view.attrId": run_lib((a0) => run_loop($view_attrId(str_in(a0))), 1),
  "view.attrClass": run_lib((a0) => run_loop($view_attrClass(str_in(a0))), 1),
  "view.attrType": run_lib((a0) => run_loop($view_attrType(str_in(a0))), 1),
  "view.attrTitle": run_lib((a0) => run_loop($view_attrTitle(str_in(a0))), 1),
  "view.attrKey": run_lib((a0) => run_loop($view_attrKey(str_in(a0))), 1),
  "view.attrOn": run_lib((a0, a1) => run_loop($view_attrOn(str_in(a0), str_in(a1))), 2),
  "view.attrData": run_lib((a0, a1) => run_loop($view_attrData(str_in(a0), str_in(a1))), 2),
  "view.attrAria": run_lib((a0, a1) => run_loop($view_attrAria(str_in(a0), str_in(a1))), 2),
  "view.boolStr": run_lib((a0) => str_out(run_loop($view_boolStr(a0))), 1),
  "view.attrBool": run_lib((a0, a1) => run_loop($view_attrBool(str_in(a0), a1)), 2),
  "view.classAppend.empty": run_lib((a0, a1, a2) => str_out(run_loop($view_classAppend_empty(str_in(a0), str_in(a1), a2))), 3),
  "view.classAppend": run_lib((a0, a1) => str_out(run_loop($view_classAppend(str_in(a0), str_in(a1)))), 2),
  "view.classNext.emptyName": run_lib((a0, a1, a2) => str_out(run_loop($view_classNext_emptyName(str_in(a0), str_in(a1), a2))), 3),
  "view.classNext.on": run_lib((a0, a1, a2) => str_out(run_loop($view_classNext_on(str_in(a0), a1, str_in(a2)))), 3),
  "view.classValue.go": run_lib((a0, a1) => str_out(run_loop($view_classValue_go(a0, str_in(a1)))), 2),
  "view.classValue": run_lib((a0) => str_out(run_loop($view_classValue(a0))), 1),
  "view.classes": run_lib((a0) => run_loop($view_classes(a0)), 1),
  "view.viewWhen": run_lib((a0, a1) => run_loop($view_viewWhen(a0, a1)), 2),
  "view.viewWhenAll": run_lib((a0, a1) => run_loop($view_viewWhenAll(a0, a1)), 2),
  "view.viewConcat": run_lib((a0, a1) => run_loop($view_viewConcat(a0, a1)), 2),
  "view.viewJoin": run_lib((a0) => run_loop($view_viewJoin(a0)), 1),
  "view.viewMapText": run_lib((a0) => run_loop($view_viewMapText(a0)), 1),
  "view.asTextI": run_lib((a0, a1) => run_loop($view_asTextI(nat_in(a0), str_in(a1))), 2),
  "view.viewMapTextI.go": run_lib((a0, a1) => run_loop($view_viewMapTextI_go(a0, nat_in(a1))), 2),
  "view.viewMapTextI": run_lib((a0) => run_loop($view_viewMapTextI(a0)), 1),
  guideAll: run_lib(() => run_loop($guideAll()), 0),
  guidePick: run_lib((a0, a1, a2) => str_out(run_loop($guidePick(a0, str_in(a1), str_in(a2)))), 3),
  guideLabel: run_lib((a0) => str_out(run_loop($guideLabel(str_in(a0)))), 1),
  guideTitle: run_lib((a0) => str_out(run_loop($guideTitle(str_in(a0)))), 1),
  guideLead: run_lib((a0) => str_out(run_loop($guideLead(str_in(a0)))), 1),
  guideCrumb: run_lib((a0) => str_out(run_loop($guideCrumb(str_in(a0)))), 1),
  guideSearchLabel: run_lib(() => str_out(run_loop($guideSearchLabel())), 0),
  guideNoHits: run_lib(() => str_out(run_loop($guideNoHits())), 0),
  "guideHas.step": run_lib((a0, a1) => run_loop($guideHas_step(a0, a1)), 2),
  guideHas: run_lib((a0, a1) => run_loop($guideHas(a0, str_in(a1))), 2),
  "guideKeep.step": run_lib((a0, a1, a2) => run_loop($guideKeep_step(a0, str_in(a1), a2)), 3),
  guideKeep: run_lib((a0, a1) => run_loop($guideKeep(a0, a1)), 2),
  guideVisible: run_lib((a0) => run_loop($guideVisible(a0)), 1),
  guideFirst: run_lib((a0) => str_out(run_loop($guideFirst(a0))), 1),
  "guideCurrent.pick": run_lib((a0, a1, a2) => str_out(run_loop($guideCurrent_pick(a0, str_in(a1), str_in(a2)))), 3),
  guideCurrent: run_lib((a0, a1) => str_out(run_loop($guideCurrent(a0, str_in(a1)))), 2),
  "guideNext.step": run_lib((a0, a1, a2) => str_out(run_loop($guideNext_step(a0, str_in(a1), str_in(a2)))), 3),
  guideNext: run_lib((a0, a1) => str_out(run_loop($guideNext(a0, str_in(a1)))), 2),
  "guidePrev.go": run_lib((a0, a1, a2) => str_out(run_loop($guidePrev_go(a0, str_in(a1), str_in(a2)))), 3),
  guidePrev: run_lib((a0, a1) => str_out(run_loop($guidePrev(a0, str_in(a1)))), 2),
  "guideNextText.if": run_lib((a0, a1) => str_out(run_loop($guideNextText_if(str_in(a0), a1))), 2),
  guideNextLabel: run_lib((a0, a1) => str_out(run_loop($guideNextLabel(a0, str_in(a1)))), 2),
  "guidePrevText.if": run_lib((a0) => str_out(run_loop($guidePrevText_if(a0))), 1),
  guidePrevLabel: run_lib((a0, a1) => str_out(run_loop($guidePrevLabel(a0, str_in(a1)))), 2),
  guideNavItem: run_lib((a0, a1) => run_loop($guideNavItem(str_in(a0), str_in(a1))), 2),
  guideNavNodes: run_lib((a0, a1) => run_loop($guideNavNodes(a0, str_in(a1))), 2),
  guideStepNode: run_lib((a0, a1, a2) => run_loop($guideStepNode(str_in(a0), str_in(a1), str_in(a2))), 3),
  guideStepWhen: run_lib((a0, a1, a2) => run_loop($guideStepWhen(str_in(a0), str_in(a1), str_in(a2))), 3),
  guideFoot: run_lib((a0, a1) => run_loop($guideFoot(a0, str_in(a1))), 2)
};
export {
  guideview_default as default
};

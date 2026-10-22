// GERADO de core/pdfpageview.bend por `bun core/build.mjs` — não editar à mão.
// core/pdfpageview.bend
function cmp_new(a, b) {
  return { $: a < b ? "LT" : a === b ? "EQ" : "GT" };
}
function nat_divmod(a, b) {
  return b === 0 ? { $: "Tuple", fst: 0, snd: a } : { $: "Tuple", fst: Math.trunc(a / b), snd: a % b };
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
var char_new = function char_new(c) {
  return c < 55296 || c >= 57344 && c <= 1114111 ? String.fromCodePoint(c) : String.fromCharCode(56320, c >>> 22, c >>> 11 & 2047, c & 2047);
};
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
function $pdfnav_maxName() {
  return 60;
}
function $pdfnav_maxPath() {
  return 1024;
}
function $pdfnav_maxBookmarks() {
  return 200;
}
function $pdfnav_maxOutline() {
  return 40;
}
function $pdfnav_maxDepth() {
  return 3;
}
function $pdfnav_cutName_if(_text_0, _limit_0, _over_0) {
  if (!_over_0) {
    return _text_0;
  } else {
    return $String_take(_text_0, _limit_0);
  }
}
function $pdfnav_cutName(_text_0, _limit_0) {
  return $pdfnav_cutName_if(_text_0, _limit_0, $Nat_is_gt([...str_out(_text_0)].length, _limit_0));
}
function $pdfnav_fitName(_text_0) {
  return $pdfnav_cutName($String_trim(_text_0), $pdfnav_maxName());
}
function $pdfnav_keepName_blank(_blank_0) {
  if (_blank_0) {
    return false;
  } else {
    return true;
  }
}
function $pdfnav_keepName(_name_0) {
  return $pdfnav_keepName_blank($String_is_empty($String_trim(_name_0)));
}
function $pdfnav_pageLabel(_page_0) {
  const _x_0 = $Nat_show(_page_0);
  return "p. " + _x_0;
}
function $pdfnav_bookmarkLabel(_name_0) {
  return _name_0;
}
function $pdfnav_bookmarkTitle(_name_0, _page_0) {
  return $msg_msg2("pdf.ref.title", "name", _name_0, "page", $Nat_show(_page_0));
}
function $pdfnav_bookmarkAria(_name_0, _page_0) {
  return $msg_msg2("pdf.nav.bookmarkAria", "name", _name_0, "page", $Nat_show(_page_0));
}
function $pdfnav_removeLabel() {
  return $msg_msg("common.remove");
}
function $pdfnav_removeTitle(_name_0) {
  return $msg_msg1("pdf.nav.removeTitle", "name", _name_0);
}
function $pdfnav_removeAria(_name_0) {
  return $msg_msg1("pdf.nav.removeTitle", "name", _name_0);
}
function $pdfnav_saveLabel() {
  return $msg_msg("pdf.nav.save");
}
function $pdfnav_saveTitle() {
  return $msg_msg("pdf.nav.saveTitle");
}
function $pdfnav_favoritesTitle() {
  return $msg_msg("pdf.nav.favorites");
}
function $pdfnav_favoritesEmpty() {
  return $msg_msg("pdf.nav.favoritesEmpty");
}
function $pdfnav_outlineTitle() {
  return $msg_msg("pdf.nav.outline");
}
function $pdfnav_outlineEmpty() {
  return $msg_msg("pdf.nav.outlineEmpty");
}
function $pdfnav_navButtonLabel() {
  return $msg_msg("pdf.nav.button");
}
function $pdfnav_navButtonTitle() {
  return $msg_msg("pdf.nav.button");
}
function $pdfnav_navAria(_label_0) {
  return $msg_msg1("pdf.nav.ariaOf", "label", _label_0);
}
function $pdfnav_navBackLabel() {
  return $msg_msg("pdf.nav.back");
}
function $pdfnav_navBackTitle() {
  return $msg_msg("pdf.nav.backTitle");
}
function $pdfnav_navBackAria(_label_0) {
  return $msg_msg1("pdf.nav.backAria", "label", _label_0);
}
function $pdfnav_bookmarkDialogTitle() {
  return $msg_msg("pdf.nav.dialogTitle");
}
function $pdfnav_bookmarkNameLabel() {
  return $msg_msg("pdf.nav.nameLabel");
}
function $pdfnav_bookmarkDialogHint(_name_0, _page_0) {
  const _x_0 = $pdfnav_pageLabel(_page_0);
  const _x_1 = ", " + _x_0;
  return _name_0 + _x_1;
}
function $pdfnav_bookmarkSaveLabel() {
  return $msg_msg("common.save");
}
function $pdfnav_bookmarkCancelLabel() {
  return $msg_msg("common.cancel");
}
function $pdfnav_pageFloor_if(_page_0, _low_0) {
  if (_low_0) {
    return 1;
  } else {
    return _page_0;
  }
}
function $pdfnav_pageFloor(_page_0) {
  return $pdfnav_pageFloor_if(_page_0, _page_0 < 1);
}
function $pdfnav_fitPath(_text_0) {
  return $pdfnav_cutName($String_trim(_text_0), $pdfnav_maxPath());
}
function $pdfnav_newBookmark(_name_0, _path_0, _page_0) {
  return { $: "Bookmark", name: $pdfnav_fitName(_name_0), path: $pdfnav_fitPath(_path_0), page: $pdfnav_pageFloor(_page_0) };
}
function $pdfnav_keepBookmark_path(_noPath_0) {
  if (_noPath_0) {
    return false;
  } else {
    return true;
  }
}
function $pdfnav_keepBookmark(_bm_0) {
  const _name_0 = _bm_0["name"];
  const _path_0 = _bm_0["path"];
  return $Bool_and($pdfnav_keepName_blank($String_is_empty($String_trim(_name_0))), $pdfnav_keepBookmark_path($String_is_empty($String_trim(_path_0))));
}
function $pdfnav_sameBookmark(_a_0, _b_0) {
  const _name_0 = _a_0["name"];
  const _path_0 = _a_0["path"];
  const _name2_0 = _b_0["name"];
  const _path2_0 = _b_0["path"];
  return $Bool_and($String_eq(_name_0, _name2_0), $String_eq(_path_0, _path2_0));
}
function $pdfnav_dropSame_head(_h_0, _rest_0, _same_0) {
  if (_same_0) {
    return _rest_0;
  } else {
    return { $: "Con", head: _h_0, tail: _rest_0 };
  }
}
function $pdfnav_dropSame_go(_bs_0, _bm_0) {
  if (_bs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _bs_0["head"];
    const _t_0 = _bs_0["tail"];
    return $pdfnav_dropSame_head(_h_0, $pdfnav_dropSame_go(_t_0, _bm_0), $pdfnav_sameBookmark(_h_0, _bm_0));
  }
}
function $pdfnav_takeList_go(_xs_0, _n_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    if (_n_0 === 0) {
      return { $: "Nil" };
    } else {
      const _p_0 = _n_0 - 1;
      return { $: "Con", head: _h_0, tail: $pdfnav_takeList_go(_t_0, _p_0) };
    }
  }
}
function $pdfnav_addBookmark(_bs_0, _bm_0) {
  return $pdfnav_takeList_go({ $: "Con", head: _bm_0, tail: $pdfnav_dropSame_go(_bs_0, _bm_0) }, $pdfnav_maxBookmarks());
}
function $pdfnav_removeBookmark(_bs_0, _bm_0) {
  return $pdfnav_dropSame_go(_bs_0, _bm_0);
}
function $pdfnav_emptyBooks(_bs_0) {
  return $Nat_is_eq($List_length(_bs_0), 0);
}
function $pdfnav_emptyOutline(_os_0) {
  return $Nat_is_eq($List_length(_os_0), 0);
}
function $pdfnav_bookmarkRow(_id_0, _bm_0, _currentPath_0) {
  const _name_0 = _bm_0["name"];
  const _path_0 = _bm_0["path"];
  const _page_0 = _bm_0["page"];
  return $view_viewEl("div", { $: "Con", head: $view_attrClass("nav-row"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewEl("button", { $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_classes({ $: "Con", head: $view_classOn("nav-bookmark", true), tail: { $: "Con", head: $view_classOn("current", $String_eq(_path_0, _currentPath_0)), tail: { $: "Nil" } } }), tail: { $: "Con", head: $view_attrData("id", $Nat_show(_id_0)), tail: { $: "Con", head: $view_attrData("page", $Nat_show(_page_0)), tail: { $: "Con", head: $view_attrData("path", _path_0), tail: { $: "Con", head: $view_attrTitle($pdfnav_bookmarkTitle(_name_0, _page_0)), tail: { $: "Con", head: $view_attrAria("label", $pdfnav_bookmarkAria(_name_0, _page_0)), tail: { $: "Con", head: $view_attrOn("click", "OpenBookmark"), tail: { $: "Nil" } } } } } } } } }, { $: "Con", head: $view_viewEl("span", { $: "Con", head: $view_attrClass("nav-name"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText($pdfnav_bookmarkLabel(_name_0)), tail: { $: "Nil" } }), tail: { $: "Con", head: $view_viewEl("span", { $: "Con", head: $view_attrClass("nav-page"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText($pdfnav_pageLabel(_page_0)), tail: { $: "Nil" } }), tail: { $: "Nil" } } }), tail: { $: "Con", head: $view_viewEl("button", { $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_classes({ $: "Con", head: $view_classOn("icon-btn", true), tail: { $: "Con", head: $view_classOn("nav-bookmark-remove", true), tail: { $: "Nil" } } }), tail: { $: "Con", head: $view_attrData("icon", "minus"), tail: { $: "Con", head: $view_attrData("id", $Nat_show(_id_0)), tail: { $: "Con", head: $view_attrTitle($pdfnav_removeTitle(_name_0)), tail: { $: "Con", head: $view_attrAria("label", $pdfnav_removeAria(_name_0)), tail: { $: "Con", head: $view_attrOn("click", "RemoveBookmark"), tail: { $: "Nil" } } } } } } } }, { $: "Nil" }), tail: { $: "Nil" } } });
}
function $pdfnav_bookmarkRows_go(_bs_0, _currentPath_0, _i_0) {
  if (_bs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _bs_0["head"];
    const _t_0 = _bs_0["tail"];
    return { $: "Con", head: $pdfnav_bookmarkRow(_i_0, _h_0, _currentPath_0), tail: $pdfnav_bookmarkRows_go(_t_0, _currentPath_0, nat_chk(_i_0 + 1)) };
  }
}
function $pdfnav_bookmarkRows(_bs_0, _currentPath_0) {
  return $pdfnav_bookmarkRows_go(_bs_0, _currentPath_0, 0);
}
function $pdfnav_clampDepth_if(_depth_0, _over_0) {
  if (_over_0) {
    return $pdfnav_maxDepth();
  } else {
    return _depth_0;
  }
}
function $pdfnav_clampDepth(_depth_0) {
  return $pdfnav_clampDepth_if(_depth_0, $Nat_is_gt(_depth_0, $pdfnav_maxDepth()));
}
function $pdfnav_outlineDepth(_depth_0) {
  return $Nat_show($pdfnav_clampDepth(_depth_0));
}
function $pdfnav_outlineLabel(_title_0, _page_0) {
  return $msg_msg2("pdf.nav.goTo", "page", $Nat_show(_page_0), "title", _title_0);
}
function $pdfnav_outlineRow(_o_0) {
  const _title_0 = _o_0["title"];
  const _page_0 = _o_0["page"];
  const _depth_0 = _o_0["depth"];
  return $view_viewEl("button", { $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_attrClass("nav-outline"), tail: { $: "Con", head: $view_attrData("depth", $pdfnav_outlineDepth(_depth_0)), tail: { $: "Con", head: $view_attrData("page", $Nat_show(_page_0)), tail: { $: "Con", head: $view_attrTitle($pdfnav_outlineLabel(_title_0, _page_0)), tail: { $: "Con", head: $view_attrAria("label", $pdfnav_outlineLabel(_title_0, _page_0)), tail: { $: "Con", head: $view_attrOn("click", "OpenOutline"), tail: { $: "Nil" } } } } } } } }, { $: "Con", head: $view_viewText(_title_0), tail: { $: "Nil" } });
}
function $pdfnav_outlineRows(_os_0) {
  return $view_viewMap_1(_os_0);
}
function $pdfnav_navEmpty(_text_0) {
  return $view_viewEl("p", { $: "Con", head: $view_attrClass("nav-empty"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText(_text_0), tail: { $: "Nil" } });
}
function $pdfnav_navSaveButton() {
  return $view_viewEl("button", { $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_attrClass("nav-save"), tail: { $: "Con", head: $view_attrTitle($pdfnav_saveTitle()), tail: { $: "Con", head: $view_attrAria("label", $pdfnav_saveTitle()), tail: { $: "Con", head: $view_attrOn("click", "SaveBookmark"), tail: { $: "Nil" } } } } } }, { $: "Con", head: $view_viewText($pdfnav_saveLabel()), tail: { $: "Nil" } });
}
function $pdfnav_navSection(_title_0, _empty_0, _emptyText_0, _rows_0) {
  return $view_viewEl("div", { $: "Con", head: $view_attrClass("nav-section"), tail: { $: "Nil" } }, $view_viewJoin({ $: "Con", head: { $: "Con", head: $view_viewEl("h4", { $: "Nil" }, { $: "Con", head: $view_viewText(_title_0), tail: { $: "Nil" } }), tail: { $: "Nil" } }, tail: { $: "Con", head: $view_viewWhen(_empty_0, $pdfnav_navEmpty(_emptyText_0)), tail: { $: "Con", head: _rows_0, tail: { $: "Nil" } } } }));
}
function $pdfnav_navPopover(_open_0, _bs_0, _os_0, _currentPath_0) {
  return $view_viewEl("div", $view_attrJoin({ $: "Con", head: { $: "Con", head: $view_classes({ $: "Con", head: $view_classOn("pdf-nav-pop", true), tail: { $: "Nil" } }), tail: { $: "Nil" } }, tail: { $: "Con", head: $view_attrWhen($Bool_not(_open_0), $view_attr("hidden", "")), tail: { $: "Con", head: { $: "Con", head: $view_attrAria("label", $pdfnav_navButtonTitle()), tail: { $: "Nil" } }, tail: { $: "Nil" } } } }), { $: "Con", head: $pdfnav_navSaveButton(), tail: { $: "Con", head: $pdfnav_navSection($pdfnav_favoritesTitle(), $pdfnav_emptyBooks(_bs_0), $pdfnav_favoritesEmpty(), $pdfnav_bookmarkRows(_bs_0, _currentPath_0)), tail: { $: "Con", head: $pdfnav_navSection($pdfnav_outlineTitle(), $pdfnav_emptyOutline(_os_0), $pdfnav_outlineEmpty(), $pdfnav_outlineRows(_os_0)), tail: { $: "Nil" } } } });
}
function $pdfview_placeholderText() {
  return $msg_msg("pdf.placeholder");
}
function $pdfview_footLoadingText() {
  return $msg_msg("pdf.loading");
}
function $pdfview_footErrorText() {
  return $msg_msg("pdf.openFailed");
}
function $pdfview_pageTotalDash() {
  return "/ —";
}
function $pdfview_gridFlags(_selfMin_0, _otherMin_0) {
  if (!_selfMin_0) {
    if (!_otherMin_0) {
      return { $: "GridFlags", otherMin: false, hasMin: false, hasOtherMin: false };
    } else {
      return { $: "GridFlags", otherMin: true, hasMin: true, hasOtherMin: false };
    }
  } else {
    if (!_otherMin_0) {
      return { $: "GridFlags", otherMin: false, hasMin: true, hasOtherMin: true };
    } else {
      return { $: "GridFlags", otherMin: false, hasMin: true, hasOtherMin: false };
    }
  }
}
function $pdfview_panelFlags(_minimized_0, _pinned_0) {
  return { $: "PanelFlags", minimized: _minimized_0, pinned: _pinned_0 };
}
function $pdfview_navChrome(_hasDoc_0, _atFirst_0, _atLast_0) {
  if (!_hasDoc_0) {
    return { $: "NavChrome", prevDisabled: true, nextDisabled: true };
  } else {
    return { $: "NavChrome", prevDisabled: _atFirst_0, nextDisabled: _atLast_0 };
  }
}
function $pdfview_collapseTitle(_minimized_0) {
  if (_minimized_0) {
    return $msg_msg("pdf.restore");
  } else {
    return $msg_msg("pdf.minimize");
  }
}
function $pdfview_disabledAttr(_on_0) {
  return $view_attrWhen(_on_0, $view_attr("disabled", "disabled"));
}
function $pdfview_pageNumberValue(_page_0) {
  return $Nat_show(_page_0);
}
function $pdfview_pageNumberMax(_total_0) {
  return $Nat_show(_total_0);
}
function $pdfview_pageTotalText(_n_0) {
  const _x_0 = $Nat_show(_n_0);
  return "/ " + _x_0;
}
function $pdfview_zoomLabelText(_pct_0) {
  const _x_0 = $Nat_show(_pct_0);
  return _x_0 + "%";
}
function $pdfview_footReadyText(_page_0, _total_0, _file_0) {
  return $msg_msg3("pdf.foot.ready", "page", $Nat_show(_page_0), "total", $Nat_show(_total_0), "file", _file_0);
}
function $pdfview_findCountChrome_shown(_shown_0, _index_0, _total_0) {
  if (_shown_0) {
    const _x_0 = $Nat_show(_total_0);
    const _x_1 = $Nat_show(_index_0);
    const _x_2 = "/" + _x_0;
    return { $: "CountChrome", hidden: false, text: _x_1 + _x_2 };
  } else {
    return { $: "CountChrome", hidden: false, text: $msg_msg1("pdf.find.count", "count", $Nat_show(_total_0)) };
  }
}
function $pdfview_findCountChrome(_hidden_0, _shown_0, _index_0, _total_0) {
  if (_hidden_0) {
    return { $: "CountChrome", hidden: true, text: "" };
  } else {
    return $pdfview_findCountChrome_shown(_shown_0, _index_0, _total_0);
  }
}
function $pdfview_gridClass(_selfMin_0, _otherMin_0) {
  if (!_selfMin_0) {
    if (!_otherMin_0) {
      return $view_classes({ $: "Con", head: $view_classOn("other-min", false), tail: { $: "Con", head: $view_classOn("has-min", false), tail: { $: "Con", head: $view_classOn("has-other-min", false), tail: { $: "Nil" } } } });
    } else {
      return $view_classes({ $: "Con", head: $view_classOn("other-min", true), tail: { $: "Con", head: $view_classOn("has-min", true), tail: { $: "Con", head: $view_classOn("has-other-min", false), tail: { $: "Nil" } } } });
    }
  } else {
    if (!_otherMin_0) {
      return $view_classes({ $: "Con", head: $view_classOn("other-min", false), tail: { $: "Con", head: $view_classOn("has-min", true), tail: { $: "Con", head: $view_classOn("has-other-min", true), tail: { $: "Nil" } } } });
    } else {
      return $view_classes({ $: "Con", head: $view_classOn("other-min", false), tail: { $: "Con", head: $view_classOn("has-min", true), tail: { $: "Con", head: $view_classOn("has-other-min", false), tail: { $: "Nil" } } } });
    }
  }
}
function $pdfview_panelClass(_minimized_0, _pinned_0) {
  return $view_classes({ $: "Con", head: $view_classOn("pdf-panel", true), tail: { $: "Con", head: $view_classOn("minimized", _minimized_0), tail: { $: "Con", head: $view_classOn("pinned", _pinned_0), tail: { $: "Nil" } } } });
}
function $pdfview_label(_s_0) {
  return $view_viewText(_s_0);
}
function $pdfview_placeholder() {
  return $view_viewEl("div", { $: "Con", head: $view_attrClass("pdf-placeholder"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText($pdfview_placeholderText()), tail: { $: "Nil" } });
}
function $pdfview_pageTotalEmpty() {
  return $view_viewText($pdfview_pageTotalDash());
}
function $pdfview_pageTotal(_n_0) {
  return $view_viewText($pdfview_pageTotalText(_n_0));
}
function $pdfview_zoomLabel(_pct_0) {
  return $view_viewText($pdfview_zoomLabelText(_pct_0));
}
function $pdfview_footLoading() {
  return $view_viewText($pdfview_footLoadingText());
}
function $pdfview_footError() {
  return $view_viewText($pdfview_footErrorText());
}
function $pdfview_footReady(_page_0, _total_0, _file_0) {
  return $view_viewText($pdfview_footReadyText(_page_0, _total_0, _file_0));
}
function $pdfview_footReadyTextLabeled_if(_page_0, _total_0, _file_0, _label_0, _empty_0) {
  if (_empty_0) {
    return $pdfview_footReadyText(_page_0, _total_0, _file_0);
  } else {
    return $msg_msg4("pdf.foot.readyLabeled", "page", $Nat_show(_page_0), "total", $Nat_show(_total_0), "label", _label_0, "file", _file_0);
  }
}
function $pdfview_footReadyTextLabeled(_page_0, _total_0, _file_0, _label_0) {
  return $pdfview_footReadyTextLabeled_if(_page_0, _total_0, _file_0, _label_0, $String_is_empty(_label_0));
}
function $pdfview_footReadyLabeled(_page_0, _total_0, _file_0, _label_0) {
  const _text_0 = $pdfview_footReadyTextLabeled(_page_0, _total_0, _file_0, _label_0);
  return $view_viewEl("span", { $: "Con", head: $view_attrTitle(_text_0), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText(_text_0), tail: { $: "Nil" } });
}
function $pdfview_findCountLabel(_c_0) {
  const _text_0 = _c_0["text"];
  return $view_viewText(_text_0);
}
function $readersheet_sheetTitle() {
  return $msg_msg("sheet.title");
}
function $readersheet_introText() {
  return $msg_msg("sheet.intro");
}
function $readersheet_dragText() {
  return $msg_msg("sheet.drag");
}
function $readersheet_openText() {
  return $msg_msg("sheet.open");
}
function $readersheet_folderText() {
  return $msg_msg("sheet.folder");
}
function $readersheet_tutorText() {
  return $msg_msg("sheet.tutor");
}
function $readersheet_openLabel() {
  return $msg_msg("sheet.openLabel");
}
function $readersheet_folderLabel() {
  return $msg_msg("sheet.folderLabel");
}
function $readersheet_tutorLabel() {
  return $msg_msg("sheet.tutorLabel");
}
function $readersheet_dropTitle() {
  return $msg_msg("sheet.dropTitle");
}
function $readersheet_dropHelp() {
  return $msg_msg("sheet.dropHelp");
}
function $readersheet_sheetAria(_course_0) {
  return $msg_msg1("sheet.aria", "course", _course_0);
}
function $readersheet_courseLine_pick(_blank_0, _course_0) {
  if (_blank_0) {
    return $msg_msg("sheet.courseBlank");
  } else {
    return $msg_msg1("sheet.course", "course", _course_0);
  }
}
function $readersheet_courseLine(_course_0) {
  return $readersheet_courseLine_pick($String_is_empty($String_trim(_course_0)), $String_trim(_course_0));
}
function $readersheet_tutorSeed_pick(_blank_0, _course_0) {
  if (_blank_0) {
    return $msg_msg("sheet.seedBlank");
  } else {
    return $msg_msg1("sheet.seed", "course", _course_0);
  }
}
function $readersheet_tutorSeed(_course_0) {
  return $readersheet_tutorSeed_pick($String_is_empty($String_trim(_course_0)), $String_trim(_course_0));
}
function $readersheet_link(_label_0, _handler_0) {
  return $view_viewEl("button", { $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_attrClass("sheet-link"), tail: { $: "Con", head: $view_attrOn("click", _handler_0), tail: { $: "Nil" } } } }, { $: "Con", head: $view_viewText(_label_0), tail: { $: "Nil" } });
}
function $readersheet_plainItem(_text_0) {
  return $view_viewEl("li", { $: "Con", head: $view_attrClass("sheet-item"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText(_text_0), tail: { $: "Nil" } });
}
function $readersheet_linkItem(_text_0, _label_0, _handler_0) {
  return $view_viewEl("li", { $: "Con", head: $view_attrClass("sheet-item"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText(_text_0), tail: { $: "Con", head: $view_viewText(" "), tail: { $: "Con", head: $readersheet_link(_label_0, _handler_0), tail: { $: "Nil" } } } });
}
function $readersheet_items() {
  return { $: "Con", head: $readersheet_plainItem($readersheet_dragText()), tail: { $: "Con", head: $readersheet_linkItem($readersheet_openText(), $readersheet_openLabel(), "OpenFile"), tail: { $: "Con", head: $readersheet_linkItem($readersheet_folderText(), $readersheet_folderLabel(), "RevealFolder"), tail: { $: "Con", head: $readersheet_linkItem($readersheet_tutorText(), $readersheet_tutorLabel(), "AskTutor"), tail: { $: "Nil" } } } } };
}
function $readersheet_dropZone() {
  return $view_viewEl("div", { $: "Con", head: $view_attrClass("sheet-drop"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewEl("span", { $: "Con", head: $view_attrClass("sheet-drop-icon"), tail: { $: "Con", head: $view_attrData("icon", "download"), tail: { $: "Con", head: $view_attrAria("hidden", "true"), tail: { $: "Nil" } } } }, { $: "Nil" }), tail: { $: "Con", head: $view_viewEl("strong", { $: "Nil" }, { $: "Con", head: $view_viewText($readersheet_dropTitle()), tail: { $: "Nil" } }), tail: { $: "Con", head: $view_viewEl("small", { $: "Nil" }, { $: "Con", head: $view_viewText($readersheet_dropHelp()), tail: { $: "Nil" } }), tail: { $: "Nil" } } } });
}
function $readersheet_sheet(_course_0) {
  return $view_viewEl("article", { $: "Con", head: $view_attrClass("reader-sheet"), tail: { $: "Con", head: $view_attrAria("label", $readersheet_sheetAria(_course_0)), tail: { $: "Nil" } } }, { $: "Con", head: $view_viewEl("h1", { $: "Con", head: $view_attrClass("sheet-title"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText($readersheet_sheetTitle()), tail: { $: "Nil" } }), tail: { $: "Con", head: $view_viewEl("p", { $: "Con", head: $view_attrClass("sheet-course"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText($readersheet_courseLine(_course_0)), tail: { $: "Nil" } }), tail: { $: "Con", head: $view_viewEl("p", { $: "Con", head: $view_attrClass("sheet-intro"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText($readersheet_introText()), tail: { $: "Nil" } }), tail: { $: "Con", head: $view_viewEl("ol", { $: "Con", head: $view_attrClass("sheet-items"), tail: { $: "Nil" } }, $readersheet_items()), tail: { $: "Con", head: $readersheet_dropZone(), tail: { $: "Nil" } } } } } });
}
function $emptyOptionLabel() {
  return $msg_msg("pdf.view.empty");
}
function $findPlaceholder() {
  return $msg_msg("pdf.view.findPlaceholder");
}
function $findButtonLabel() {
  return $msg_msg("common.search");
}
function $openTitle() {
  return $msg_msg("pdf.view.open");
}
function $findTitle() {
  return $msg_msg("common.search");
}
function $shotTitle() {
  return $msg_msg("pdf.view.shot");
}
function $prevAria() {
  return $msg_msg("pdf.view.prev");
}
function $nextAria() {
  return $msg_msg("pdf.view.next");
}
function $outAria() {
  return $msg_msg("pdf.view.zoomOut");
}
function $inAria() {
  return $msg_msg("pdf.view.zoomIn");
}
function $fitTitle() {
  return $msg_msg("pdf.view.fit");
}
function $invertTitle() {
  return $msg_msg("pdf.view.invertTitle");
}
function $invertAria() {
  return $msg_msg("pdf.view.invert");
}
function $dividerAria() {
  return $msg_msg("pdf.view.divider");
}
function $documentAria(_label_0) {
  return $msg_msg1("pdf.view.docAria", "label", _label_0);
}
function $openAria(_label_0) {
  return $msg_msg1("pdf.view.openAria", "label", _label_0);
}
function $findAria(_label_0) {
  return $msg_msg1("pdf.view.findAria", "label", _label_0);
}
function $pageAria(_label_0) {
  return $msg_msg1("pdf.view.pageAria", "label", _label_0);
}
function $moreTitle() {
  return $msg_msg("pdf.view.more");
}
function $moreAria(_label_0) {
  return $msg_msg1("pdf.view.moreAria", "label", _label_0);
}
function $restoreAria(_label_0) {
  return $msg_msg1("pdf.view.restoreAria", "label", _label_0);
}
function $zoomRowLabel() {
  return $msg_msg("pdf.view.zoom");
}
function $shotMenuLabel() {
  return $msg_msg("pdf.view.shotMenu");
}
function $invertMenuLabel() {
  return $msg_msg("pdf.view.invert");
}
function $printedMenuLabel() {
  return $msg_msg("pdf.view.printedMenu");
}
function $rotationStep() {
  return 90;
}
function $rotationNext(_rotation_0) {
  const _x_0 = $rotationStep();
  return $Nat_mod(nat_chk(_rotation_0 + _x_0), 360);
}
function $rotationValid(_rotation_0) {
  if (_rotation_0 === 0) {
    return true;
  } else if (_rotation_0 === 1) {
    return false;
  } else if (_rotation_0 === 2) {
    return false;
  } else if (_rotation_0 === 3) {
    return false;
  } else if (_rotation_0 === 4) {
    return false;
  } else if (_rotation_0 === 5) {
    return false;
  } else if (_rotation_0 === 6) {
    return false;
  } else if (_rotation_0 === 7) {
    return false;
  } else if (_rotation_0 === 8) {
    return false;
  } else if (_rotation_0 === 9) {
    return false;
  } else if (_rotation_0 === 10) {
    return false;
  } else if (_rotation_0 === 11) {
    return false;
  } else if (_rotation_0 === 12) {
    return false;
  } else if (_rotation_0 === 13) {
    return false;
  } else if (_rotation_0 === 14) {
    return false;
  } else if (_rotation_0 === 15) {
    return false;
  } else if (_rotation_0 === 16) {
    return false;
  } else if (_rotation_0 === 17) {
    return false;
  } else if (_rotation_0 === 18) {
    return false;
  } else if (_rotation_0 === 19) {
    return false;
  } else if (_rotation_0 === 20) {
    return false;
  } else if (_rotation_0 === 21) {
    return false;
  } else if (_rotation_0 === 22) {
    return false;
  } else if (_rotation_0 === 23) {
    return false;
  } else if (_rotation_0 === 24) {
    return false;
  } else if (_rotation_0 === 25) {
    return false;
  } else if (_rotation_0 === 26) {
    return false;
  } else if (_rotation_0 === 27) {
    return false;
  } else if (_rotation_0 === 28) {
    return false;
  } else if (_rotation_0 === 29) {
    return false;
  } else if (_rotation_0 === 30) {
    return false;
  } else if (_rotation_0 === 31) {
    return false;
  } else if (_rotation_0 === 32) {
    return false;
  } else if (_rotation_0 === 33) {
    return false;
  } else if (_rotation_0 === 34) {
    return false;
  } else if (_rotation_0 === 35) {
    return false;
  } else if (_rotation_0 === 36) {
    return false;
  } else if (_rotation_0 === 37) {
    return false;
  } else if (_rotation_0 === 38) {
    return false;
  } else if (_rotation_0 === 39) {
    return false;
  } else if (_rotation_0 === 40) {
    return false;
  } else if (_rotation_0 === 41) {
    return false;
  } else if (_rotation_0 === 42) {
    return false;
  } else if (_rotation_0 === 43) {
    return false;
  } else if (_rotation_0 === 44) {
    return false;
  } else if (_rotation_0 === 45) {
    return false;
  } else if (_rotation_0 === 46) {
    return false;
  } else if (_rotation_0 === 47) {
    return false;
  } else if (_rotation_0 === 48) {
    return false;
  } else if (_rotation_0 === 49) {
    return false;
  } else if (_rotation_0 === 50) {
    return false;
  } else if (_rotation_0 === 51) {
    return false;
  } else if (_rotation_0 === 52) {
    return false;
  } else if (_rotation_0 === 53) {
    return false;
  } else if (_rotation_0 === 54) {
    return false;
  } else if (_rotation_0 === 55) {
    return false;
  } else if (_rotation_0 === 56) {
    return false;
  } else if (_rotation_0 === 57) {
    return false;
  } else if (_rotation_0 === 58) {
    return false;
  } else if (_rotation_0 === 59) {
    return false;
  } else if (_rotation_0 === 60) {
    return false;
  } else if (_rotation_0 === 61) {
    return false;
  } else if (_rotation_0 === 62) {
    return false;
  } else if (_rotation_0 === 63) {
    return false;
  } else if (_rotation_0 === 64) {
    return false;
  } else if (_rotation_0 === 65) {
    return false;
  } else if (_rotation_0 === 66) {
    return false;
  } else if (_rotation_0 === 67) {
    return false;
  } else if (_rotation_0 === 68) {
    return false;
  } else if (_rotation_0 === 69) {
    return false;
  } else if (_rotation_0 === 70) {
    return false;
  } else if (_rotation_0 === 71) {
    return false;
  } else if (_rotation_0 === 72) {
    return false;
  } else if (_rotation_0 === 73) {
    return false;
  } else if (_rotation_0 === 74) {
    return false;
  } else if (_rotation_0 === 75) {
    return false;
  } else if (_rotation_0 === 76) {
    return false;
  } else if (_rotation_0 === 77) {
    return false;
  } else if (_rotation_0 === 78) {
    return false;
  } else if (_rotation_0 === 79) {
    return false;
  } else if (_rotation_0 === 80) {
    return false;
  } else if (_rotation_0 === 81) {
    return false;
  } else if (_rotation_0 === 82) {
    return false;
  } else if (_rotation_0 === 83) {
    return false;
  } else if (_rotation_0 === 84) {
    return false;
  } else if (_rotation_0 === 85) {
    return false;
  } else if (_rotation_0 === 86) {
    return false;
  } else if (_rotation_0 === 87) {
    return false;
  } else if (_rotation_0 === 88) {
    return false;
  } else if (_rotation_0 === 89) {
    return false;
  } else if (_rotation_0 === 90) {
    return true;
  } else if (_rotation_0 === 91) {
    return false;
  } else if (_rotation_0 === 92) {
    return false;
  } else if (_rotation_0 === 93) {
    return false;
  } else if (_rotation_0 === 94) {
    return false;
  } else if (_rotation_0 === 95) {
    return false;
  } else if (_rotation_0 === 96) {
    return false;
  } else if (_rotation_0 === 97) {
    return false;
  } else if (_rotation_0 === 98) {
    return false;
  } else if (_rotation_0 === 99) {
    return false;
  } else if (_rotation_0 === 100) {
    return false;
  } else if (_rotation_0 === 101) {
    return false;
  } else if (_rotation_0 === 102) {
    return false;
  } else if (_rotation_0 === 103) {
    return false;
  } else if (_rotation_0 === 104) {
    return false;
  } else if (_rotation_0 === 105) {
    return false;
  } else if (_rotation_0 === 106) {
    return false;
  } else if (_rotation_0 === 107) {
    return false;
  } else if (_rotation_0 === 108) {
    return false;
  } else if (_rotation_0 === 109) {
    return false;
  } else if (_rotation_0 === 110) {
    return false;
  } else if (_rotation_0 === 111) {
    return false;
  } else if (_rotation_0 === 112) {
    return false;
  } else if (_rotation_0 === 113) {
    return false;
  } else if (_rotation_0 === 114) {
    return false;
  } else if (_rotation_0 === 115) {
    return false;
  } else if (_rotation_0 === 116) {
    return false;
  } else if (_rotation_0 === 117) {
    return false;
  } else if (_rotation_0 === 118) {
    return false;
  } else if (_rotation_0 === 119) {
    return false;
  } else if (_rotation_0 === 120) {
    return false;
  } else if (_rotation_0 === 121) {
    return false;
  } else if (_rotation_0 === 122) {
    return false;
  } else if (_rotation_0 === 123) {
    return false;
  } else if (_rotation_0 === 124) {
    return false;
  } else if (_rotation_0 === 125) {
    return false;
  } else if (_rotation_0 === 126) {
    return false;
  } else if (_rotation_0 === 127) {
    return false;
  } else if (_rotation_0 === 128) {
    return false;
  } else if (_rotation_0 === 129) {
    return false;
  } else if (_rotation_0 === 130) {
    return false;
  } else if (_rotation_0 === 131) {
    return false;
  } else if (_rotation_0 === 132) {
    return false;
  } else if (_rotation_0 === 133) {
    return false;
  } else if (_rotation_0 === 134) {
    return false;
  } else if (_rotation_0 === 135) {
    return false;
  } else if (_rotation_0 === 136) {
    return false;
  } else if (_rotation_0 === 137) {
    return false;
  } else if (_rotation_0 === 138) {
    return false;
  } else if (_rotation_0 === 139) {
    return false;
  } else if (_rotation_0 === 140) {
    return false;
  } else if (_rotation_0 === 141) {
    return false;
  } else if (_rotation_0 === 142) {
    return false;
  } else if (_rotation_0 === 143) {
    return false;
  } else if (_rotation_0 === 144) {
    return false;
  } else if (_rotation_0 === 145) {
    return false;
  } else if (_rotation_0 === 146) {
    return false;
  } else if (_rotation_0 === 147) {
    return false;
  } else if (_rotation_0 === 148) {
    return false;
  } else if (_rotation_0 === 149) {
    return false;
  } else if (_rotation_0 === 150) {
    return false;
  } else if (_rotation_0 === 151) {
    return false;
  } else if (_rotation_0 === 152) {
    return false;
  } else if (_rotation_0 === 153) {
    return false;
  } else if (_rotation_0 === 154) {
    return false;
  } else if (_rotation_0 === 155) {
    return false;
  } else if (_rotation_0 === 156) {
    return false;
  } else if (_rotation_0 === 157) {
    return false;
  } else if (_rotation_0 === 158) {
    return false;
  } else if (_rotation_0 === 159) {
    return false;
  } else if (_rotation_0 === 160) {
    return false;
  } else if (_rotation_0 === 161) {
    return false;
  } else if (_rotation_0 === 162) {
    return false;
  } else if (_rotation_0 === 163) {
    return false;
  } else if (_rotation_0 === 164) {
    return false;
  } else if (_rotation_0 === 165) {
    return false;
  } else if (_rotation_0 === 166) {
    return false;
  } else if (_rotation_0 === 167) {
    return false;
  } else if (_rotation_0 === 168) {
    return false;
  } else if (_rotation_0 === 169) {
    return false;
  } else if (_rotation_0 === 170) {
    return false;
  } else if (_rotation_0 === 171) {
    return false;
  } else if (_rotation_0 === 172) {
    return false;
  } else if (_rotation_0 === 173) {
    return false;
  } else if (_rotation_0 === 174) {
    return false;
  } else if (_rotation_0 === 175) {
    return false;
  } else if (_rotation_0 === 176) {
    return false;
  } else if (_rotation_0 === 177) {
    return false;
  } else if (_rotation_0 === 178) {
    return false;
  } else if (_rotation_0 === 179) {
    return false;
  } else if (_rotation_0 === 180) {
    return true;
  } else if (_rotation_0 === 181) {
    return false;
  } else if (_rotation_0 === 182) {
    return false;
  } else if (_rotation_0 === 183) {
    return false;
  } else if (_rotation_0 === 184) {
    return false;
  } else if (_rotation_0 === 185) {
    return false;
  } else if (_rotation_0 === 186) {
    return false;
  } else if (_rotation_0 === 187) {
    return false;
  } else if (_rotation_0 === 188) {
    return false;
  } else if (_rotation_0 === 189) {
    return false;
  } else if (_rotation_0 === 190) {
    return false;
  } else if (_rotation_0 === 191) {
    return false;
  } else if (_rotation_0 === 192) {
    return false;
  } else if (_rotation_0 === 193) {
    return false;
  } else if (_rotation_0 === 194) {
    return false;
  } else if (_rotation_0 === 195) {
    return false;
  } else if (_rotation_0 === 196) {
    return false;
  } else if (_rotation_0 === 197) {
    return false;
  } else if (_rotation_0 === 198) {
    return false;
  } else if (_rotation_0 === 199) {
    return false;
  } else if (_rotation_0 === 200) {
    return false;
  } else if (_rotation_0 === 201) {
    return false;
  } else if (_rotation_0 === 202) {
    return false;
  } else if (_rotation_0 === 203) {
    return false;
  } else if (_rotation_0 === 204) {
    return false;
  } else if (_rotation_0 === 205) {
    return false;
  } else if (_rotation_0 === 206) {
    return false;
  } else if (_rotation_0 === 207) {
    return false;
  } else if (_rotation_0 === 208) {
    return false;
  } else if (_rotation_0 === 209) {
    return false;
  } else if (_rotation_0 === 210) {
    return false;
  } else if (_rotation_0 === 211) {
    return false;
  } else if (_rotation_0 === 212) {
    return false;
  } else if (_rotation_0 === 213) {
    return false;
  } else if (_rotation_0 === 214) {
    return false;
  } else if (_rotation_0 === 215) {
    return false;
  } else if (_rotation_0 === 216) {
    return false;
  } else if (_rotation_0 === 217) {
    return false;
  } else if (_rotation_0 === 218) {
    return false;
  } else if (_rotation_0 === 219) {
    return false;
  } else if (_rotation_0 === 220) {
    return false;
  } else if (_rotation_0 === 221) {
    return false;
  } else if (_rotation_0 === 222) {
    return false;
  } else if (_rotation_0 === 223) {
    return false;
  } else if (_rotation_0 === 224) {
    return false;
  } else if (_rotation_0 === 225) {
    return false;
  } else if (_rotation_0 === 226) {
    return false;
  } else if (_rotation_0 === 227) {
    return false;
  } else if (_rotation_0 === 228) {
    return false;
  } else if (_rotation_0 === 229) {
    return false;
  } else if (_rotation_0 === 230) {
    return false;
  } else if (_rotation_0 === 231) {
    return false;
  } else if (_rotation_0 === 232) {
    return false;
  } else if (_rotation_0 === 233) {
    return false;
  } else if (_rotation_0 === 234) {
    return false;
  } else if (_rotation_0 === 235) {
    return false;
  } else if (_rotation_0 === 236) {
    return false;
  } else if (_rotation_0 === 237) {
    return false;
  } else if (_rotation_0 === 238) {
    return false;
  } else if (_rotation_0 === 239) {
    return false;
  } else if (_rotation_0 === 240) {
    return false;
  } else if (_rotation_0 === 241) {
    return false;
  } else if (_rotation_0 === 242) {
    return false;
  } else if (_rotation_0 === 243) {
    return false;
  } else if (_rotation_0 === 244) {
    return false;
  } else if (_rotation_0 === 245) {
    return false;
  } else if (_rotation_0 === 246) {
    return false;
  } else if (_rotation_0 === 247) {
    return false;
  } else if (_rotation_0 === 248) {
    return false;
  } else if (_rotation_0 === 249) {
    return false;
  } else if (_rotation_0 === 250) {
    return false;
  } else if (_rotation_0 === 251) {
    return false;
  } else if (_rotation_0 === 252) {
    return false;
  } else if (_rotation_0 === 253) {
    return false;
  } else if (_rotation_0 === 254) {
    return false;
  } else if (_rotation_0 === 255) {
    return false;
  } else if (_rotation_0 === 256) {
    return false;
  } else if (_rotation_0 === 257) {
    return false;
  } else if (_rotation_0 === 258) {
    return false;
  } else if (_rotation_0 === 259) {
    return false;
  } else if (_rotation_0 === 260) {
    return false;
  } else if (_rotation_0 === 261) {
    return false;
  } else if (_rotation_0 === 262) {
    return false;
  } else if (_rotation_0 === 263) {
    return false;
  } else if (_rotation_0 === 264) {
    return false;
  } else if (_rotation_0 === 265) {
    return false;
  } else if (_rotation_0 === 266) {
    return false;
  } else if (_rotation_0 === 267) {
    return false;
  } else if (_rotation_0 === 268) {
    return false;
  } else if (_rotation_0 === 269) {
    return false;
  } else if (_rotation_0 === 270) {
    return true;
  } else {
    return false;
  }
}
function $rotationNormalize_if(_rotation_0, _valid_0) {
  if (_valid_0) {
    return _rotation_0;
  } else {
    return 0;
  }
}
function $rotationNormalize(_rotation_0) {
  return $rotationNormalize_if(_rotation_0, $rotationValid(_rotation_0));
}
function $rotateTitle(_rotation_0) {
  return $msg_msg1("pdf.view.rotateTitle", "deg", $Nat_show(_rotation_0));
}
function $rotateAria(_label_0, _rotation_0) {
  return $msg_msg2("pdf.view.rotateAria", "label", _label_0, "deg", $Nat_show(_rotation_0));
}
function $rotateToast(_rotation_0) {
  return $msg_msg1("pdf.view.rotateToast", "deg", $Nat_show(_rotation_0));
}
function $printedOffsetLabel_positive(_n_0) {
  if (_n_0 === 0) {
    return "";
  } else {
    const _p_0 = _n_0 - 1;
    return $Nat_show(nat_chk(_p_0 + 1));
  }
}
function $printedOffsetLabel_signed(_negative_0, _magnitude_0, _physical_0) {
  if (_negative_0) {
    return $printedOffsetLabel_positive(_physical_0 < _magnitude_0 ? 0 : _physical_0 - _magnitude_0);
  } else {
    return $Nat_show(nat_chk(_physical_0 + _magnitude_0));
  }
}
function $printedOffsetLabel(_offset_0, _physical_0) {
  if (_offset_0.$ === "OffsetAuto") {
    return "";
  } else {
    const _negative_0 = _offset_0["negative"];
    const _magnitude_0 = _offset_0["magnitude"];
    return $printedOffsetLabel_signed(_negative_0, _magnitude_0, _physical_0);
  }
}
function $printedLabel_own_if(_label_0, _offset_0, _physical_0, _empty_0) {
  if (_empty_0) {
    return $printedOffsetLabel(_offset_0, _physical_0);
  } else {
    return _label_0;
  }
}
function $printedLabel_own(_label_0, _offset_0, _physical_0) {
  return $printedLabel_own_if(_label_0, _offset_0, _physical_0, $String_is_empty(_label_0));
}
function $printedLabel_go($0, $1, $2, $3) {
  for (;; ) {
    {
      const _own_0 = $0;
      const _offset_0 = $1;
      const _original_0 = $2;
      const _i_0 = $3;
      if (_own_0.$ === "Nil") {
        return $printedOffsetLabel(_offset_0, _original_0);
      } else {
        const _h_0 = _own_0["head"];
        const _t_0 = _own_0["tail"];
        if (_i_0 === 0) {
          return $printedLabel_own(_h_0, _offset_0, _original_0);
        } else {
          const _p_0 = _i_0 - 1;
          $0 = _t_0;
          $1 = _offset_0;
          $2 = _original_0;
          $3 = _p_0;
          continue;
        }
      }
    }
  }
}
function $printedLabel(_own_0, _offset_0, _physical_0) {
  return $printedLabel_go(_own_0, _offset_0, _physical_0, _physical_0 < 1 ? 0 : _physical_0 - 1);
}
function $isDigitChar(_c_0) {
  const _u_0 = $Char_to_u32(_c_0);
  return $Bool_and(_u_0 >= 48, _u_0 <= 57);
}
function $printedDigits_go($0, $1) {
  for (;; ) {
    {
      const _s_0 = $0;
      const _ok_0 = $1;
      if (_s_0 === "") {
        return _ok_0;
      } else {
        const _h_0 = _s_0.slice(0, char_len(_s_0));
        const _t_0 = _s_0.slice(char_len(_s_0));
        $0 = _t_0;
        $1 = $Bool_and(_ok_0, $isDigitChar(_h_0));
        continue;
      }
    }
  }
}
function $printedDigits(_text_0) {
  return $printedDigits_go(_text_0, true);
}
function $printedNumber_parsed(_parsed_0) {
  if (_parsed_0.$ === "Some") {
    const _n_0 = _parsed_0["value"];
    return { $: "Some", value: _n_0 };
  } else {
    return { $: "None" };
  }
}
function $printedNumber_if(_text_0, _empty_0, _digits_0) {
  if (_empty_0) {
    return { $: "None" };
  } else {
    if (!_digits_0) {
      return { $: "None" };
    } else {
      return $printedNumber_parsed($U32_read(_text_0));
    }
  }
}
function $printedNumber(_text_0) {
  return $printedNumber_if(_text_0, $String_is_empty(_text_0), $printedDigits(_text_0));
}
function $printedMatches_cmp(_candidate_0, _text_0, _fold_0) {
  if (!_fold_0) {
    return $String_eq(_candidate_0, _text_0);
  } else {
    return $String_eq($String_to_lower(_candidate_0), $String_to_lower(_text_0));
  }
}
function $printedMatches_push(_out_0, _n_0, _same_0) {
  if (_same_0) {
    return $List_append(_out_0, { $: "Con", head: _n_0, tail: { $: "Nil" } });
  } else {
    return _out_0;
  }
}
function $printedMatches_go($0, $1, $2, $3, $4) {
  for (;; ) {
    {
      const _own_0 = $0;
      const _text_0 = $1;
      const _fold_0 = $2;
      const _n_0 = $3;
      const _out_0 = $4;
      if (_own_0.$ === "Nil") {
        return _out_0;
      } else {
        const _h_0 = _own_0["head"];
        const _t_0 = _own_0["tail"];
        $0 = _t_0;
        $1 = _text_0;
        $2 = _fold_0;
        $3 = nat_chk(_n_0 + 1);
        $4 = $printedMatches_push(_out_0, _n_0, $printedMatches_cmp(_h_0, _text_0, _fold_0));
        continue;
      }
    }
  }
}
function $printedPick_first_if(_first_0, _candidate_0, _zero_0) {
  if (_zero_0) {
    return _candidate_0;
  } else {
    return _first_0;
  }
}
function $printedPick_first(_first_0, _candidate_0) {
  return $printedPick_first_if(_first_0, _candidate_0, $Nat_is_eq(_first_0, 0));
}
function $printedPick_best_min_if(_candidate_0, _best_0, _lt_0) {
  if (_lt_0) {
    return _candidate_0;
  } else {
    return _best_0;
  }
}
function $printedPick_best_min(_candidate_0, _best_0) {
  return $printedPick_best_min_if(_candidate_0, _best_0, _candidate_0 < _best_0);
}
function $printedPick_best_none(_best_0, _candidate_0, _zero_0) {
  if (_zero_0) {
    return _candidate_0;
  } else {
    return $printedPick_best_min(_candidate_0, _best_0);
  }
}
function $printedPick_best_if(_best_0, _candidate_0, _current_0, _gt_0) {
  if (!_gt_0) {
    return _best_0;
  } else {
    return $printedPick_best_none(_best_0, _candidate_0, $Nat_is_eq(_best_0, 0));
  }
}
function $printedPick_best(_best_0, _candidate_0, _current_0) {
  return $printedPick_best_if(_best_0, _candidate_0, _current_0, $Nat_is_gt(_candidate_0, _current_0));
}
function $printedPick_fin_if(_first_0, _best_0, _zero_0) {
  if (_zero_0) {
    return _first_0;
  } else {
    return _best_0;
  }
}
function $printedPick_fin(_first_0, _best_0) {
  return $printedPick_fin_if(_first_0, _best_0, $Nat_is_eq(_best_0, 0));
}
function $printedPick_go($0, $1, $2, $3) {
  for (;; ) {
    {
      const _matches_0 = $0;
      const _current_0 = $1;
      const _first_0 = $2;
      const _best_0 = $3;
      if (_matches_0.$ === "Nil") {
        return $printedPick_fin(_first_0, _best_0);
      } else {
        const _h_0 = _matches_0["head"];
        const _t_0 = _matches_0["tail"];
        $0 = _t_0;
        $1 = _current_0;
        $2 = $printedPick_first(_first_0, _h_0);
        $3 = $printedPick_best(_best_0, _h_0, _current_0);
        continue;
      }
    }
  }
}
function $resolvePrinted_inBounds_if(_page_0, _total_0, _ok_0) {
  if (_ok_0) {
    return { $: "Some", value: _page_0 };
  } else {
    return { $: "None" };
  }
}
function $resolvePrinted_inBounds(_page_0, _total_0) {
  return $resolvePrinted_inBounds_if(_page_0, _total_0, $Bool_and($Nat_is_ge(_page_0, 1), $Nat_is_le(_page_0, _total_0)));
}
function $resolvePrinted_shift(_negative_0, _magnitude_0, _printed_0, _total_0) {
  if (_negative_0) {
    return $resolvePrinted_inBounds(nat_chk(_printed_0 + _magnitude_0), _total_0);
  } else {
    return $resolvePrinted_inBounds(_printed_0 < _magnitude_0 ? 0 : _printed_0 - _magnitude_0, _total_0);
  }
}
function $resolvePrinted_byOffset_value(_offset_0, _printed_0, _total_0) {
  if (_offset_0.$ === "OffsetAuto") {
    return $resolvePrinted_inBounds(_printed_0, _total_0);
  } else {
    const _negative_0 = _offset_0["negative"];
    const _magnitude_0 = _offset_0["magnitude"];
    return $resolvePrinted_shift(_negative_0, _magnitude_0, _printed_0, _total_0);
  }
}
function $resolvePrinted_byOffset_parsed(_offset_0, _total_0, _parsed_0) {
  if (_parsed_0.$ === "None") {
    return { $: "None" };
  } else {
    const _printed_0 = _parsed_0["value"];
    return $resolvePrinted_byOffset_value(_offset_0, _printed_0, _total_0);
  }
}
function $resolvePrinted_byOffset(_offset_0, _text_0, _total_0) {
  return $resolvePrinted_byOffset_parsed(_offset_0, _total_0, $printedNumber(_text_0));
}
function $resolvePrinted_folded_matches(_text_0, _total_0, _current_0, _matches_0) {
  if (_matches_0.$ === "Nil") {
    return { $: "None" };
  } else {
    const _h_0 = _matches_0["head"];
    const _t_0 = _matches_0["tail"];
    return $resolvePrinted_inBounds($printedPick_go({ $: "Con", head: _h_0, tail: _t_0 }, _current_0, 0, 0), _total_0);
  }
}
function $resolvePrinted_folded(_own_0, _text_0, _total_0, _current_0) {
  return $resolvePrinted_folded_matches(_text_0, _total_0, _current_0, $printedMatches_go(_own_0, _text_0, true, 1, { $: "Nil" }));
}
function $resolvePrinted_own_matches(_own_0, _text_0, _total_0, _current_0, _matches_0) {
  if (_matches_0.$ === "Nil") {
    return $resolvePrinted_folded(_own_0, _text_0, _total_0, _current_0);
  } else {
    const _h_0 = _matches_0["head"];
    const _t_0 = _matches_0["tail"];
    return $resolvePrinted_inBounds($printedPick_go({ $: "Con", head: _h_0, tail: _t_0 }, _current_0, 0, 0), _total_0);
  }
}
function $resolvePrinted_own(_own_0, _text_0, _total_0, _current_0) {
  return $resolvePrinted_own_matches(_own_0, _text_0, _total_0, _current_0, $printedMatches_go(_own_0, _text_0, false, 1, { $: "Nil" }));
}
function $resolvePrinted_if(_own_0, _offset_0, _total_0, _current_0, _text_0) {
  if (_own_0.$ === "Nil") {
    return $resolvePrinted_byOffset(_offset_0, _text_0, _total_0);
  } else {
    const _h_0 = _own_0["head"];
    const _t_0 = _own_0["tail"];
    return $resolvePrinted_own({ $: "Con", head: _h_0, tail: _t_0 }, _text_0, _total_0, _current_0);
  }
}
function $resolvePrinted_empty(_own_0, _offset_0, _total_0, _current_0, _text_0, _empty_0) {
  if (_empty_0) {
    return { $: "None" };
  } else {
    return $resolvePrinted_if(_own_0, _offset_0, _total_0, _current_0, _text_0);
  }
}
function $resolvePrinted(_own_0, _offset_0, _total_0, _current_0, _text_0) {
  const _trimmed_0 = $String_trim(_text_0);
  return $resolvePrinted_empty(_own_0, _offset_0, _total_0, _current_0, _trimmed_0, $String_is_empty(_trimmed_0));
}
function $printedTitle() {
  return $msg_msg("pdf.printed.title");
}
function $printedInputPlaceholder() {
  return $msg_msg("pdf.printed.placeholder");
}
function $printedInputAria(_label_0) {
  return $msg_msg1("pdf.printed.inputAria", "label", _label_0);
}
function $printedGoLabel() {
  return $msg_msg("pdf.printed.go");
}
function $printedToggleTitle() {
  return $msg_msg("pdf.printed.toggleTitle");
}
function $printedToggleAria(_label_0) {
  return $msg_msg1("pdf.printed.toggleAria", "label", _label_0);
}
function $printedOffsetFieldLabel() {
  return $msg_msg("pdf.printed.offset");
}
function $printedOffsetTitle() {
  return $msg_msg("pdf.printed.offsetTitle");
}
function $printedOffsetInputAria(_label_0) {
  return $msg_msg1("pdf.printed.offsetAria", "label", _label_0);
}
function $printedOffsetSaveLabel() {
  return $msg_msg("pdf.printed.save");
}
function $printedOffsetAutoLabel() {
  return $msg_msg("pdf.printed.auto");
}
function $printedOwnLabel() {
  return $msg_msg("pdf.printed.own");
}
function $printedAutoLabel() {
  return $msg_msg("pdf.printed.noAdjust");
}
function $printedOwnHint() {
  return $msg_msg("pdf.printed.ownHint");
}
function $printedNoApiHint() {
  return $msg_msg("pdf.printed.noApi");
}
function $printedStatusText_signed(_negative_0, _magnitude_0) {
  if (_negative_0) {
    return $msg_msg1("pdf.printed.minus", "n", $Nat_show(_magnitude_0));
  } else {
    return $msg_msg1("pdf.printed.plus", "n", $Nat_show(_magnitude_0));
  }
}
function $printedStatusText(_own_0, _offset_0) {
  if (_own_0) {
    return $printedOwnLabel();
  } else {
    if (_offset_0.$ === "OffsetAuto") {
      return $printedAutoLabel();
    } else {
      const _negative_0 = _offset_0["negative"];
      const _magnitude_0 = _offset_0["magnitude"];
      return $printedStatusText_signed(_negative_0, _magnitude_0);
    }
  }
}
function $printedCurrentText_if(_label_0, _empty_0) {
  if (_empty_0) {
    return $msg_msg("pdf.printed.noLabel");
  } else {
    return $msg_msg1("pdf.printed.current", "label", _label_0);
  }
}
function $printedCurrentText(_label_0) {
  return $printedCurrentText_if(_label_0, $String_is_empty(_label_0));
}
function $printedFoundText(_text_0, _page_0) {
  return $msg_msg2("pdf.printed.found", "text", _text_0, "page", $Nat_show(_page_0));
}
function $printedNotFoundText() {
  return $msg_msg("pdf.printed.notFound");
}
function $printedInvalidText() {
  return $msg_msg("pdf.printed.invalid");
}
function $printedBadOffsetText() {
  return $msg_msg("pdf.printed.badOffset");
}
function $dropHintText(_label_0) {
  return $msg_msg1("pdf.drop.hint", "label", _label_0);
}
function $dropOpeningText() {
  return $msg_msg("pdf.drop.opening");
}
function $dropOpenedText(_name_0, _label_0) {
  return $msg_msg2("pdf.drop.opened", "name", _name_0, "label", _label_0);
}
function $dropUnavailableText() {
  return $msg_msg("pdf.drop.unavailable");
}
function $dropInvalidText() {
  return $msg_msg("pdf.drop.invalid");
}
function $printedSavedAutoText() {
  return $msg_msg("pdf.printed.savedAuto");
}
function $printedSavedOffsetText_signed(_negative_0, _magnitude_0) {
  if (_negative_0) {
    return $msg_msg1("pdf.printed.savedMinus", "n", $Nat_show(_magnitude_0));
  } else {
    return $msg_msg1("pdf.printed.savedPlus", "n", $Nat_show(_magnitude_0));
  }
}
function $printedSavedOffsetText(_offset_0) {
  if (_offset_0.$ === "OffsetAuto") {
    return $printedSavedAutoText();
  } else {
    const _negative_0 = _offset_0["negative"];
    const _magnitude_0 = _offset_0["magnitude"];
    return $printedSavedOffsetText_signed(_negative_0, _magnitude_0);
  }
}
function $optionKids(_name_0) {
  return { $: "Con", head: $view_viewText(_name_0), tail: { $: "Nil" } };
}
function $optionNode(_option_0, _path_0) {
  const _name_0 = _option_0["name"];
  const _optionPath_0 = _option_0["path"];
  return $view_viewEl("option", $view_attrJoin({ $: "Con", head: { $: "Con", head: { $: "ViewAttr", name: "value", value: _optionPath_0 }, tail: { $: "Nil" } }, tail: { $: "Con", head: $view_attrWhen($String_eq(_optionPath_0, _path_0), { $: "ViewAttr", name: "selected", value: "" }), tail: { $: "Nil" } } }), $optionKids(_name_0));
}
function $optionEmpty() {
  return $view_viewEl("option", { $: "Con", head: { $: "ViewAttr", name: "value", value: "" }, tail: { $: "Nil" } }, $optionKids($emptyOptionLabel()));
}
function $optionNodes_go(_options_0, _path_0) {
  if (_options_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _options_0["head"];
    const _t_0 = _options_0["tail"];
    return { $: "Con", head: $optionNode(_h_0, _path_0), tail: $optionNodes_go(_t_0, _path_0) };
  }
}
function $optionNodes(_options_0, _path_0) {
  return { $: "Con", head: $optionEmpty(), tail: $optionNodes_go(_options_0, _path_0) };
}
function $selectNode(_label_0, _options_0, _path_0) {
  return $view_viewEl("select", { $: "Con", head: $view_attrClass("pdf-select"), tail: { $: "Con", head: $view_attrAria("label", $documentAria(_label_0)), tail: { $: "Con", head: $view_attrOn("change", "OpenDoc"), tail: { $: "Nil" } } } }, $optionNodes(_options_0, _path_0));
}
function $iconBtnAttrs(_cls_0, _iconName_0, _aria_0) {
  return { $: "Con", head: $view_attrClass(_cls_0 + " icon-btn"), tail: { $: "Con", head: $view_attrAria("label", _aria_0), tail: { $: "Con", head: $view_attrData("icon", _iconName_0), tail: { $: "Nil" } } } };
}
function $itemAttrs(_cls_0, _iconName_0, _aria_0) {
  return { $: "Con", head: $view_attrClass(_cls_0 + " more-item"), tail: { $: "Con", head: $view_attrAria("label", _aria_0), tail: { $: "Con", head: $view_attrData("icon", _iconName_0), tail: { $: "Nil" } } } };
}
function $iconBtn(_cls_0, _iconName_0, _aria_0, _handler_0) {
  return $view_viewEl("button", $view_attrConcat($iconBtnAttrs(_cls_0, _iconName_0, _aria_0), { $: "Con", head: $view_attrOn("click", _handler_0), tail: { $: "Nil" } }), { $: "Nil" });
}
function $openBtn(_label_0) {
  return $view_viewEl("button", $view_attrJoin({ $: "Con", head: $itemAttrs("open", "plus", $openAria(_label_0)), tail: { $: "Con", head: { $: "Con", head: $view_attrTitle($openTitle()), tail: { $: "Con", head: $view_attrOn("click", "OpenFile"), tail: { $: "Nil" } } }, tail: { $: "Nil" } } }), { $: "Con", head: $view_viewText($openTitle()), tail: { $: "Nil" } });
}
function $findToggleBtn(_label_0, _open_0) {
  return $view_viewEl("button", $view_attrJoin({ $: "Con", head: $iconBtnAttrs("find-toggle", "search", $findAria(_label_0)), tail: { $: "Con", head: { $: "Con", head: $view_attrTitle($findTitle()), tail: { $: "Con", head: $view_attrBool("aria-pressed", _open_0), tail: { $: "Con", head: $view_attrOn("click", "ToggleFind"), tail: { $: "Nil" } } } }, tail: { $: "Nil" } } }), { $: "Nil" });
}
function $shotBtn(_label_0) {
  return $view_viewEl("button", $view_attrJoin({ $: "Con", head: $itemAttrs("page-shot", "camera", $shotTitle()), tail: { $: "Con", head: { $: "Con", head: $view_attrTitle($shotTitle()), tail: { $: "Con", head: $view_attrOn("click", "PageShot"), tail: { $: "Nil" } } }, tail: { $: "Nil" } } }), { $: "Con", head: $view_viewText($shotMenuLabel()), tail: { $: "Nil" } });
}
function $collapseIcon(_minimized_0) {
  if (_minimized_0) {
    return "chevronUp";
  } else {
    return "chevronDown";
  }
}
function $collapseBtn(_minimized_0) {
  const _title_0 = $pdfview_collapseTitle(_minimized_0);
  return $view_viewEl("button", $view_attrJoin({ $: "Con", head: $itemAttrs("collapse", $collapseIcon(_minimized_0), _title_0), tail: { $: "Con", head: { $: "Con", head: $view_attrTitle(_title_0), tail: { $: "Con", head: $view_attrBool("aria-pressed", _minimized_0), tail: { $: "Con", head: $view_attrOn("click", "ToggleCollapse"), tail: { $: "Nil" } } } }, tail: { $: "Nil" } } }), { $: "Con", head: $view_viewText(_title_0), tail: { $: "Nil" } });
}
function $navBackTitle() {
  return $pdfnav_navBackTitle();
}
function $navBackAria(_label_0) {
  return $pdfnav_navBackAria(_label_0);
}
function $navBtn(_label_0) {
  return $view_viewEl("button", $view_attrJoin({ $: "Con", head: $iconBtnAttrs("nav", "bookmark", $pdfnav_navAria(_label_0)), tail: { $: "Con", head: { $: "Con", head: $view_attrTitle($pdfnav_navButtonTitle()), tail: { $: "Con", head: $view_attrBool("aria-expanded", false), tail: { $: "Con", head: $view_attrOn("click", "ToggleNav"), tail: { $: "Nil" } } } }, tail: { $: "Nil" } } }), { $: "Nil" });
}
function $backBtn(_label_0) {
  return $view_viewEl("button", $view_attrJoin({ $: "Con", head: $iconBtnAttrs("back", "chevronLeft", $navBackAria(_label_0)), tail: { $: "Con", head: { $: "Con", head: $view_attrTitle($navBackTitle()), tail: { $: "Con", head: $view_attrOn("click", "NavBack"), tail: { $: "Con", head: $view_attr("hidden", ""), tail: { $: "Nil" } } } }, tail: { $: "Nil" } } }), { $: "Nil" });
}
function $moreBtn(_label_0) {
  return $view_viewEl("button", $view_attrJoin({ $: "Con", head: $iconBtnAttrs("more", "more", $moreAria(_label_0)), tail: { $: "Con", head: { $: "Con", head: $view_attrTitle($moreTitle()), tail: { $: "Con", head: $view_attrBool("aria-expanded", false), tail: { $: "Con", head: $view_attrOn("click", "ToggleMore"), tail: { $: "Nil" } } } }, tail: { $: "Nil" } } }), { $: "Nil" });
}
function $rotateBtn(_label_0, _rotation_0) {
  return $view_viewEl("button", $view_attrJoin({ $: "Con", head: $itemAttrs("rotate", "rotateCw", $rotateAria(_label_0, _rotation_0)), tail: { $: "Con", head: { $: "Con", head: $view_attrTitle($rotateTitle(_rotation_0)), tail: { $: "Con", head: $view_attrOn("click", "Rotate"), tail: { $: "Nil" } } }, tail: { $: "Nil" } } }), { $: "Con", head: $view_viewText($msg_msg("pdf.view.rotate")), tail: { $: "Nil" } });
}
function $pageInput(_label_0) {
  return $view_viewEl("input", { $: "Con", head: $view_attrClass("page-number"), tail: { $: "Con", head: { $: "ViewAttr", name: "type", value: "number" }, tail: { $: "Con", head: { $: "ViewAttr", name: "min", value: "1" }, tail: { $: "Con", head: { $: "ViewAttr", name: "value", value: "1" }, tail: { $: "Con", head: $view_attrAria("label", $pageAria(_label_0)), tail: { $: "Con", head: $view_attrOn("change", "GotoPage"), tail: { $: "Nil" } } } } } } }, { $: "Nil" });
}
function $titleBar(_shell_0) {
  const _label_0 = _shell_0["label"];
  const _options_0 = _shell_0["options"];
  const _path_0 = _shell_0["path"];
  const _findOpen_0 = _shell_0["findOpen"];
  return $view_viewEl("div", { $: "Con", head: $view_attrClass("pdf-title"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewEl("strong", { $: "Nil" }, { $: "Con", head: $view_viewText(_label_0), tail: { $: "Nil" } }), tail: { $: "Con", head: $selectNode(_label_0, _options_0, _path_0), tail: { $: "Con", head: $backBtn(_label_0), tail: { $: "Con", head: $iconBtn("prev", "chevronLeft", $prevAria(), "Prev"), tail: { $: "Con", head: $pageInput(_label_0), tail: { $: "Con", head: $view_viewEl("span", { $: "Con", head: $view_attrClass("page-total"), tail: { $: "Nil" } }, { $: "Nil" }), tail: { $: "Con", head: $iconBtn("next", "chevronRight", $nextAria(), "Next"), tail: { $: "Con", head: $findToggleBtn(_label_0, _findOpen_0), tail: { $: "Con", head: $navBtn(_label_0), tail: { $: "Con", head: $moreBtn(_label_0), tail: { $: "Nil" } } } } } } } } } } });
}
function $fitBtn() {
  return $view_viewEl("button", $view_attrJoin({ $: "Con", head: $itemAttrs("fit", "unfold", $fitTitle()), tail: { $: "Con", head: { $: "Con", head: $view_attrTitle($fitTitle()), tail: { $: "Con", head: $view_attrOn("click", "Fit"), tail: { $: "Nil" } } }, tail: { $: "Nil" } } }), { $: "Con", head: $view_viewText($fitTitle()), tail: { $: "Nil" } });
}
function $invertBtn() {
  return $view_viewEl("button", $view_attrJoin({ $: "Con", head: $itemAttrs("invert", "contrast", $invertAria()), tail: { $: "Con", head: { $: "Con", head: $view_attrTitle($invertTitle()), tail: { $: "Con", head: $view_attrOn("click", "ToggleInvert"), tail: { $: "Nil" } } }, tail: { $: "Nil" } } }), { $: "Con", head: $view_viewText($invertMenuLabel()), tail: { $: "Nil" } });
}
function $zoomRow() {
  return $view_viewEl("div", { $: "Con", head: $view_attrClass("more-zoom"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewEl("span", { $: "Con", head: $view_attrClass("more-zoom-title"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText($zoomRowLabel()), tail: { $: "Nil" } }), tail: { $: "Con", head: $view_viewEl("span", { $: "Con", head: $view_attrClass("more-zoom-ctl"), tail: { $: "Nil" } }, { $: "Con", head: $iconBtn("out", "minus", $outAria(), "ZoomOut"), tail: { $: "Con", head: $view_viewEl("span", { $: "Con", head: $view_attrClass("zoom-label"), tail: { $: "Nil" } }, { $: "Nil" }), tail: { $: "Con", head: $iconBtn("in", "plus", $inAria(), "ZoomIn"), tail: { $: "Nil" } } } }), tail: { $: "Nil" } } });
}
function $moreMenu(_label_0, _rotation_0, _minimized_0) {
  return $view_viewEl("div", { $: "Con", head: $view_attrClass("pdf-more-pop"), tail: { $: "Con", head: $view_attr("role", "group"), tail: { $: "Con", head: $view_attrAria("label", $moreAria(_label_0)), tail: { $: "Con", head: $view_attr("hidden", ""), tail: { $: "Nil" } } } } }, { $: "Con", head: $openBtn(_label_0), tail: { $: "Con", head: $shotBtn(_label_0), tail: { $: "Con", head: $zoomRow(), tail: { $: "Con", head: $fitBtn(), tail: { $: "Con", head: $invertBtn(), tail: { $: "Con", head: $rotateBtn(_label_0, _rotation_0), tail: { $: "Con", head: $collapseBtn(_minimized_0), tail: { $: "Nil" } } } } } } } });
}
function $restoreBtn(_label_0) {
  return $view_viewEl("button", { $: "Con", head: $view_attrClass("pdf-restore"), tail: { $: "Con", head: $view_attrAria("label", $restoreAria(_label_0)), tail: { $: "Con", head: $view_attrTitle($restoreAria(_label_0)), tail: { $: "Con", head: $view_attrOn("click", "ToggleCollapse"), tail: { $: "Nil" } } } } }, { $: "Con", head: $view_viewEl("span", { $: "Con", head: $view_attrClass("pdf-restore-icon"), tail: { $: "Con", head: $view_attrData("icon", "chevronLeft"), tail: { $: "Nil" } } }, { $: "Nil" }), tail: { $: "Con", head: $view_viewEl("span", { $: "Con", head: $view_attrClass("pdf-restore-label"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText(_label_0), tail: { $: "Nil" } }), tail: { $: "Nil" } } });
}
function $stage() {
  return $view_viewEl("div", { $: "Con", head: $view_attrClass("pdf-stage"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewEl("div", { $: "Con", head: $view_attrClass("pdf-viewport"), tail: { $: "Nil" } }, { $: "Nil" }), tail: { $: "Con", head: $view_viewEl("div", { $: "Con", head: $view_attrClass("pdf-foot"), tail: { $: "Nil" } }, { $: "Nil" }), tail: { $: "Nil" } } });
}
function $findForm(_label_0) {
  return $view_viewEl("form", { $: "Con", head: $view_attrClass("pdf-find"), tail: { $: "Con", head: $view_attrOn("submit", "Find"), tail: { $: "Con", head: { $: "ViewAttr", name: "hidden", value: "" }, tail: { $: "Nil" } } } }, { $: "Con", head: $view_viewEl("input", { $: "Con", head: { $: "ViewAttr", name: "placeholder", value: $findPlaceholder() }, tail: { $: "Con", head: $view_attrAria("label", $findAria(_label_0)), tail: { $: "Nil" } } }, { $: "Nil" }), tail: { $: "Con", head: $view_viewEl("span", { $: "Con", head: $view_attrClass("find-count"), tail: { $: "Con", head: { $: "ViewAttr", name: "hidden", value: "" }, tail: { $: "Nil" } } }, { $: "Nil" }), tail: { $: "Con", head: $view_viewEl("button", { $: "Nil" }, { $: "Con", head: $view_viewText($findButtonLabel()), tail: { $: "Nil" } }), tail: { $: "Nil" } } } });
}
function $panelShell(_shell_0) {
  const _label_0 = _shell_0["label"];
  const _options_0 = _shell_0["options"];
  const _path_0 = _shell_0["path"];
  const _minimized_0 = _shell_0["minimized"];
  const _findOpen_0 = _shell_0["findOpen"];
  const _rotation_0 = _shell_0["rotation"];
  return $view_viewEl("section", { $: "Con", head: $pdfview_panelClass(_minimized_0, false), tail: { $: "Con", head: $view_attrAria("label", _label_0), tail: { $: "Con", head: { $: "ViewAttr", name: "tabindex", value: "0" }, tail: { $: "Nil" } } } }, { $: "Con", head: $titleBar({ $: "PdfShell", label: _label_0, options: _options_0, path: _path_0, minimized: _minimized_0, findOpen: _findOpen_0, rotation: _rotation_0 }), tail: { $: "Con", head: $stage(), tail: { $: "Con", head: $findForm(_label_0), tail: { $: "Con", head: $moreMenu(_label_0, _rotation_0, _minimized_0), tail: { $: "Con", head: $restoreBtn(_label_0), tail: { $: "Nil" } } } } } });
}
function $divider() {
  return $view_viewEl("div", { $: "Con", head: $view_attrClass("pdf-divider"), tail: { $: "Con", head: { $: "ViewAttr", name: "tabindex", value: "0" }, tail: { $: "Con", head: { $: "ViewAttr", name: "role", value: "separator" }, tail: { $: "Con", head: $view_attrAria("label", $dividerAria()), tail: { $: "Nil" } } } } }, { $: "Nil" });
}
function $pageStyle(_width_0, _height_0) {
  const _x_0 = ";height:" + _height_0;
  const _x_1 = _width_0 + _x_0;
  return "width:" + _x_1;
}
function $pageNode(_box_0) {
  const _n_0 = _box_0["n"];
  const _width_0 = _box_0["width"];
  const _height_0 = _box_0["height"];
  return $view_viewEl("div", { $: "Con", head: $view_attrClass("pdf-page"), tail: { $: "Con", head: $view_attrData("page", $Nat_show(_n_0)), tail: { $: "Con", head: { $: "ViewAttr", name: "style", value: $pageStyle(_width_0, _height_0) }, tail: { $: "Nil" } } } }, { $: "Nil" });
}
function $pageNodes(_boxes_0) {
  if (_boxes_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _boxes_0["head"];
    const _t_0 = _boxes_0["tail"];
    return { $: "Con", head: $pageNode(_h_0), tail: $pageNodes(_t_0) };
  }
}
function $docFrame(_boxes_0) {
  return $view_viewEl("div", { $: "Con", head: $view_attrClass("pdf-document"), tail: { $: "Nil" } }, $pageNodes(_boxes_0));
}
function $viewport(_state_0, _boxes_0) {
  if (_state_0.$ === "PdfEmpty") {
    return { $: "Some", value: $pdfview_placeholder() };
  } else if (_state_0.$ === "PdfSheet") {
    const _course_0 = _state_0["course"];
    return { $: "Some", value: $readersheet_sheet(_course_0) };
  } else if (_state_0.$ === "PdfReady") {
    return { $: "Some", value: $docFrame(_boxes_0) };
  } else if (_state_0.$ === "PdfLoading") {
    return { $: "None" };
  } else {
    return { $: "None" };
  }
}
function $hlPush(_seg_0, _out_0) {
  return { $: "Con", head: _seg_0, tail: _out_0 };
}
function $hlFlush_if(_pend_0, _out_0, _empty_0) {
  if (_empty_0) {
    return _out_0;
  } else {
    return $hlPush({ $: "PdfHlSeg", text: $String_reverse(_pend_0), hit: false }, _out_0);
  }
}
function $hlFlush(_pend_0, _out_0) {
  return $hlFlush_if(_pend_0, _out_0, $String_is_empty(_pend_0));
}
function $hlScan($0, $1, $2, $3, $4, $5, $6, $7) {
  for (;; ) {
    {
      const _text_0 = $0;
      const _folded_0 = $1;
      const _term_0 = $2;
      const _n_0 = $3;
      const _rem_0 = $4;
      const _fact_0 = $5;
      const _pend_0 = $6;
      const _out_0 = $7;
      if (_text_0 === "") {
        return $hlFlush(_pend_0, _out_0);
      } else {
        const __0 = _text_0.slice(0, char_len(_text_0));
        const _t_0 = _text_0.slice(char_len(_text_0));
        if (_rem_0 === "") {
          if (_fact_0) {
            $0 = _t_0;
            $1 = $String_drop(_folded_0, 1);
            $2 = _term_0;
            $3 = _n_0;
            $4 = $String_drop(_term_0, 1);
            $5 = $String_starts_with($String_drop(_folded_0, 1), _term_0);
            $6 = "";
            $7 = $hlPush({ $: "PdfHlSeg", text: $String_take(__0 + _t_0, _n_0), hit: true }, $hlFlush(_pend_0, _out_0));
            continue;
          } else {
            const _x_0 = $String_take(__0 + _t_0, 1);
            $0 = _t_0;
            $1 = $String_drop(_folded_0, 1);
            $2 = _term_0;
            $3 = _n_0;
            $4 = "";
            $5 = $String_starts_with($String_drop(_folded_0, 1), _term_0);
            $6 = _x_0 + _pend_0;
            $7 = _out_0;
            continue;
          }
        } else {
          const _rs_0 = _rem_0.slice(char_len(_rem_0));
          $0 = _t_0;
          $1 = $String_drop(_folded_0, 1);
          $2 = _term_0;
          $3 = _n_0;
          $4 = _rs_0;
          $5 = $String_starts_with($String_drop(_folded_0, 1), _term_0);
          $6 = _pend_0;
          $7 = _out_0;
          continue;
        }
      }
    }
  }
}
function $hlNode_go(_text_0, _hit_0) {
  if (_hit_0) {
    return $view_viewEl("i", { $: "Con", head: $view_attrClass("pdf-hl"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText(_text_0), tail: { $: "Nil" } });
  } else {
    return $view_viewText(_text_0);
  }
}
function $hlNode(_seg_0) {
  const _text_0 = _seg_0["text"];
  const _hit_0 = _seg_0["hit"];
  return $hlNode_go(_text_0, _hit_0);
}
function $hlNodes($0, $1) {
  for (;; ) {
    {
      const _segs_0 = $0;
      const _acc_0 = $1;
      if (_segs_0.$ === "Nil") {
        return _acc_0;
      } else {
        const _h_0 = _segs_0["head"];
        const _t_0 = _segs_0["tail"];
        $0 = _t_0;
        $1 = { $: "Con", head: $hlNode(_h_0), tail: _acc_0 };
        continue;
      }
    }
  }
}
function $hlSegments_if(_text_0, _folded_0, _term_0, _empty_0) {
  if (_empty_0) {
    return { $: "Con", head: $view_viewText(_text_0), tail: { $: "Nil" } };
  } else {
    return $hlNodes($hlScan(_text_0, _folded_0, _term_0, [...str_out(_term_0)].length, "", $String_starts_with(_folded_0, _term_0), "", { $: "Nil" }), { $: "Nil" });
  }
}
function $hlSegments(_text_0, _folded_0, _term_0) {
  return $hlSegments_if(_text_0, _folded_0, _term_0, $String_is_empty(_term_0));
}
function $printedInput(_label_0) {
  return $view_viewEl("input", { $: "Con", head: $view_attrClass("printed-input"), tail: { $: "Con", head: $view_attrType("text"), tail: { $: "Con", head: { $: "ViewAttr", name: "placeholder", value: $printedInputPlaceholder() }, tail: { $: "Con", head: { $: "ViewAttr", name: "autocomplete", value: "off" }, tail: { $: "Con", head: $view_attrAria("label", $printedInputAria(_label_0)), tail: { $: "Nil" } } } } } }, { $: "Nil" });
}
function $printedGoBtn() {
  return $view_viewEl("button", { $: "Con", head: $view_attrClass("printed-go"), tail: { $: "Con", head: $view_attrType("submit"), tail: { $: "Nil" } } }, { $: "Con", head: $view_viewText($printedGoLabel()), tail: { $: "Nil" } });
}
function $printedStatusNode() {
  return $view_viewEl("span", { $: "Con", head: $view_attrClass("printed-status"), tail: { $: "Con", head: $view_attrAria("live", "polite"), tail: { $: "Nil" } } }, { $: "Con", head: $view_viewText($printedAutoLabel()), tail: { $: "Nil" } });
}
function $printedOffsetInput(_label_0) {
  return $view_viewEl("input", { $: "Con", head: $view_attrClass("printed-offset"), tail: { $: "Con", head: $view_attrType("number"), tail: { $: "Con", head: { $: "ViewAttr", name: "step", value: "1" }, tail: { $: "Con", head: { $: "ViewAttr", name: "min", value: "-1000000" }, tail: { $: "Con", head: { $: "ViewAttr", name: "max", value: "1000000" }, tail: { $: "Con", head: { $: "ViewAttr", name: "inputmode", value: "numeric" }, tail: { $: "Con", head: $view_attrAria("label", $printedOffsetInputAria(_label_0)), tail: { $: "Nil" } } } } } } } }, { $: "Nil" });
}
function $printedOffsetSaveBtn() {
  return $view_viewEl("button", $view_attrJoin({ $: "Con", head: { $: "Con", head: $view_attrClass("printed-offset-save"), tail: { $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_attrOn("click", "PrintedOffsetSave"), tail: { $: "Nil" } } } }, tail: { $: "Nil" } }), { $: "Con", head: $view_viewText($printedOffsetSaveLabel()), tail: { $: "Nil" } });
}
function $printedOffsetAutoBtn() {
  return $view_viewEl("button", $view_attrJoin({ $: "Con", head: { $: "Con", head: $view_attrClass("printed-offset-auto"), tail: { $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_attrOn("click", "PrintedOffsetAuto"), tail: { $: "Nil" } } } }, tail: { $: "Nil" } }), { $: "Con", head: $view_viewText($printedOffsetAutoLabel()), tail: { $: "Nil" } });
}
function $printedOffsetEditor(_label_0) {
  return $view_viewEl("span", { $: "Con", head: $view_attrClass("printed-offset-editor"), tail: { $: "Con", head: $view_attrTitle($printedOffsetTitle()), tail: { $: "Nil" } } }, { $: "Con", head: $view_viewEl("label", { $: "Con", head: $view_attrClass("printed-offset-label"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText($printedOffsetFieldLabel()), tail: { $: "Con", head: $printedOffsetInput(_label_0), tail: { $: "Nil" } } }), tail: { $: "Con", head: $printedOffsetSaveBtn(), tail: { $: "Con", head: $printedOffsetAutoBtn(), tail: { $: "Nil" } } } });
}
function $printedRow(_label_0, _open_0) {
  return $view_viewEl("form", $view_attrJoin({ $: "Con", head: { $: "Con", head: $view_attrClass("pdf-printed"), tail: { $: "Con", head: $view_attrOn("submit", "GoPrinted"), tail: { $: "Con", head: $view_attrAria("label", $printedToggleAria(_label_0)), tail: { $: "Nil" } } } }, tail: { $: "Con", head: $view_attrWhen($Bool_not(_open_0), $view_attr("hidden", "")), tail: { $: "Nil" } } }), { $: "Con", head: $printedInput(_label_0), tail: { $: "Con", head: $printedGoBtn(), tail: { $: "Con", head: $printedStatusNode(), tail: { $: "Con", head: $printedOffsetEditor(_label_0), tail: { $: "Nil" } } } } });
}
function $printedToggleBtn(_label_0, _open_0) {
  return $view_viewEl("button", $view_attrJoin({ $: "Con", head: $itemAttrs("printed-toggle", "scan", $printedToggleAria(_label_0)), tail: { $: "Con", head: { $: "Con", head: $view_attrTitle($printedToggleTitle()), tail: { $: "Con", head: $view_attrBool("aria-expanded", _open_0), tail: { $: "Con", head: $view_attrOn("click", "TogglePrinted"), tail: { $: "Nil" } } } }, tail: { $: "Nil" } } }), { $: "Con", head: $view_viewText($printedMenuLabel()), tail: { $: "Nil" } });
}
function $dropHint(_label_0) {
  return $view_viewEl("div", $view_attrJoin({ $: "Con", head: { $: "Con", head: $view_attrClass("pdf-drop-hint"), tail: { $: "Con", head: $view_attr("hidden", ""), tail: { $: "Nil" } } }, tail: { $: "Nil" } }), { $: "Con", head: $view_viewText($dropHintText(_label_0)), tail: { $: "Nil" } });
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
function $String_take(_s_0, _n_0) {
  if (_s_0 === "") {
    return "";
  } else {
    const _h_0 = _s_0.slice(0, char_len(_s_0));
    const _t_0 = _s_0.slice(char_len(_s_0));
    if (_n_0 === 0) {
      return "";
    } else {
      const _p_0 = _n_0 - 1;
      return _h_0 + $String_take(_t_0, _p_0);
    }
  }
}
function $Nat_is_gt(_a_0, _b_0) {
  return $Cmp_is_gt(cmp_new(_a_0, _b_0));
}
function $String_trim(_s_0) {
  return $String_trim_end($String_trim_start(_s_0));
}
function $Nat_show(_n_0) {
  const _m_0 = _n_0;
  return $Nat_show_fin(_m_0, "", $Nat_show_put(nat_divmod(_m_0, 10)));
}
function $Bool_and(_a_0, _b_0) {
  if (!_a_0) {
    return false;
  } else {
    return _b_0;
  }
}
function $Nat_is_eq(_a_0, _b_0) {
  return $Cmp_is_eq(cmp_new(_a_0, _b_0));
}
function $List_length(_xs_0) {
  if (_xs_0.$ === "Nil") {
    return 0;
  } else {
    const _t_0 = _xs_0["tail"];
    return nat_chk($List_length(_t_0) + 1);
  }
}
function $view_viewMap_1(_xs_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return { $: "Con", head: $pdfnav_outlineRow(_h_0), tail: $view_viewMap_1(_t_0) };
  }
}
function $Bool_not(_b_0) {
  if (!_b_0) {
    return true;
  } else {
    return false;
  }
}
function $Nat_mod(_a_0, _b_0) {
  return $Pair_snd(nat_divmod(_a_0, _b_0));
}
function $Char_to_u32(_c_0) {
  return char_code(_c_0);
}
function $U32_read(_s_0) {
  if (_s_0 === "") {
    return { $: "None" };
  } else {
    const _h_0 = _s_0.slice(0, char_len(_s_0));
    const _t_0 = _s_0.slice(char_len(_s_0));
    return $U32_read_go(_h_0 + _t_0, 0);
  }
}
function $String_to_lower(_s_0) {
  if (_s_0 === "") {
    return "";
  } else {
    const _h_0 = _s_0.slice(0, char_len(_s_0));
    const _t_0 = _s_0.slice(char_len(_s_0));
    return $Char_to_lower(_h_0) + $String_to_lower(_t_0);
  }
}
function $Nat_is_ge(_a_0, _b_0) {
  return $Cmp_is_ge(cmp_new(_a_0, _b_0));
}
function $Nat_is_le(_a_0, _b_0) {
  return $Cmp_is_le(cmp_new(_a_0, _b_0));
}
function $String_reverse(_s_0) {
  return $String_reverse_go(_s_0, "");
}
function $String_drop($0, $1) {
  for (;; ) {
    {
      const _s_0 = $0;
      const _n_0 = $1;
      if (_s_0 === "") {
        return "";
      } else {
        const _h_0 = _s_0.slice(0, char_len(_s_0));
        const _t_0 = _s_0.slice(char_len(_s_0));
        if (_n_0 === 0) {
          return _h_0 + _t_0;
        } else {
          const _p_0 = _n_0 - 1;
          $0 = _t_0;
          $1 = _p_0;
          continue;
        }
      }
    }
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
function $Cmp_is_gt(_c_0) {
  if (_c_0.$ === "GT") {
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
function $Nat_show_fin($0, $1, $2) {
  let $pc = 0;
  for (;; )
    switch ($pc) {
      case 0: {
        const _g_0 = $0;
        const _acc_0 = $1;
        const _dq_0 = $2;
        const _d_0 = _dq_0["fst"];
        const _t_0 = _dq_0["snd"];
        if (_t_0 === 0) {
          return _d_0 + _acc_0;
        } else {
          const _p_0 = _t_0 - 1;
          $0 = _g_0;
          $1 = nat_chk(_p_0 + 1);
          $2 = _d_0 + _acc_0;
          $pc = 1;
          continue;
        }
      }
      case 1: {
        const _f_0 = $0;
        const _n_0 = $1;
        const _acc_0 = $2;
        if (_f_0 === 0) {
          return _acc_0;
        } else {
          const _g_0 = _f_0 - 1;
          $0 = _g_0;
          $1 = _acc_0;
          $2 = $Nat_show_put(nat_divmod(_n_0, 10));
          $pc = 0;
          continue;
        }
      }
    }
}
function $Nat_show_put(_qr_0) {
  const _q_0 = _qr_0["fst"];
  const _r_0 = _qr_0["snd"];
  const _x_0 = nat_chk(48 + _r_0);
  return { $: "Tuple", fst: char_new(_x_0 >>> 0), snd: _q_0 };
}
function $Pair_snd(_p_0) {
  const _b_0 = _p_0["snd"];
  return _b_0;
}
function $U32_read_go($0, $1, $2) {
  let $pc = 0;
  for (;; )
    switch ($pc) {
      case 0: {
        const _s_0 = $0;
        const _acc_0 = $1;
        if (_s_0 === "") {
          return { $: "Some", value: _acc_0 };
        } else {
          const _t_0 = _s_0.slice(0, char_len(_s_0));
          const _t_1 = _s_0.slice(char_len(_s_0));
          const _x_0 = char_code(_t_0);
          const _x_1 = Math.imul(_acc_0, 10) >>> 0;
          const _x_2 = _x_0 - 48 >>> 0;
          const _n_0 = _x_1 + _x_2 >>> 0;
          const _x_3 = _n_0 / 10 >>> 0;
          $0 = _t_1;
          $1 = _n_0;
          $2 = _x_3 === _acc_0;
          $pc = 1;
          continue;
        }
      }
      case 1: {
        const _t_0 = $0;
        const _n_0 = $1;
        const _ok_0 = $2;
        if (_ok_0) {
          $0 = _t_0;
          $1 = _n_0;
          $pc = 0;
          continue;
        } else {
          return { $: "None" };
        }
      }
    }
}
function $Char_to_lower(_c_0) {
  const _x_0 = $Bool_to_u32($Char_is_upper(_c_0));
  const _x_1 = char_code(_c_0);
  const _x_2 = Math.imul(_x_0, 32) >>> 0;
  return char_new(_x_1 + _x_2 >>> 0);
}
function $Cmp_is_ge(_c_0) {
  if (_c_0.$ === "LT") {
    return false;
  } else {
    return true;
  }
}
function $Cmp_is_le(_c_0) {
  if (_c_0.$ === "GT") {
    return false;
  } else {
    return true;
  }
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
function $Char_is_space(_c_0) {
  const _x_0 = char_code(_c_0);
  const _x_1 = char_code(_c_0);
  const _x_2 = char_code(_c_0);
  const _x_3 = _x_0 === 32;
  const _x_4 = $Bool_and(_x_1 >= 9, _x_2 <= 13);
  return _x_3 || _x_4;
}
function $Bool_to_u32(_b_0) {
  if (!_b_0) {
    return 0;
  } else {
    return 1;
  }
}
function $Char_is_upper(_c_0) {
  const _x_0 = char_code(_c_0);
  const _x_1 = char_code(_c_0);
  return $Bool_and(_x_0 >= 65, _x_1 <= 90);
}
var pdfpageview_default = {
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
  "pdfnav.maxName": run_lib(() => run_loop($pdfnav_maxName()), 0),
  "pdfnav.maxPath": run_lib(() => run_loop($pdfnav_maxPath()), 0),
  "pdfnav.maxBookmarks": run_lib(() => run_loop($pdfnav_maxBookmarks()), 0),
  "pdfnav.maxOutline": run_lib(() => run_loop($pdfnav_maxOutline()), 0),
  "pdfnav.maxDepth": run_lib(() => run_loop($pdfnav_maxDepth()), 0),
  "pdfnav.cutName.if": run_lib((a0, a1, a2) => str_out(run_loop($pdfnav_cutName_if(str_in(a0), nat_in(a1), a2))), 3),
  "pdfnav.cutName": run_lib((a0, a1) => str_out(run_loop($pdfnav_cutName(str_in(a0), nat_in(a1)))), 2),
  "pdfnav.fitName": run_lib((a0) => str_out(run_loop($pdfnav_fitName(str_in(a0)))), 1),
  "pdfnav.keepName.blank": run_lib((a0) => run_loop($pdfnav_keepName_blank(a0)), 1),
  "pdfnav.keepName": run_lib((a0) => run_loop($pdfnav_keepName(str_in(a0))), 1),
  "pdfnav.pageLabel": run_lib((a0) => str_out(run_loop($pdfnav_pageLabel(nat_in(a0)))), 1),
  "pdfnav.bookmarkLabel": run_lib((a0) => str_out(run_loop($pdfnav_bookmarkLabel(str_in(a0)))), 1),
  "pdfnav.bookmarkTitle": run_lib((a0, a1) => str_out(run_loop($pdfnav_bookmarkTitle(str_in(a0), nat_in(a1)))), 2),
  "pdfnav.bookmarkAria": run_lib((a0, a1) => str_out(run_loop($pdfnav_bookmarkAria(str_in(a0), nat_in(a1)))), 2),
  "pdfnav.removeLabel": run_lib(() => str_out(run_loop($pdfnav_removeLabel())), 0),
  "pdfnav.removeTitle": run_lib((a0) => str_out(run_loop($pdfnav_removeTitle(str_in(a0)))), 1),
  "pdfnav.removeAria": run_lib((a0) => str_out(run_loop($pdfnav_removeAria(str_in(a0)))), 1),
  "pdfnav.saveLabel": run_lib(() => str_out(run_loop($pdfnav_saveLabel())), 0),
  "pdfnav.saveTitle": run_lib(() => str_out(run_loop($pdfnav_saveTitle())), 0),
  "pdfnav.favoritesTitle": run_lib(() => str_out(run_loop($pdfnav_favoritesTitle())), 0),
  "pdfnav.favoritesEmpty": run_lib(() => str_out(run_loop($pdfnav_favoritesEmpty())), 0),
  "pdfnav.outlineTitle": run_lib(() => str_out(run_loop($pdfnav_outlineTitle())), 0),
  "pdfnav.outlineEmpty": run_lib(() => str_out(run_loop($pdfnav_outlineEmpty())), 0),
  "pdfnav.navButtonLabel": run_lib(() => str_out(run_loop($pdfnav_navButtonLabel())), 0),
  "pdfnav.navButtonTitle": run_lib(() => str_out(run_loop($pdfnav_navButtonTitle())), 0),
  "pdfnav.navAria": run_lib((a0) => str_out(run_loop($pdfnav_navAria(str_in(a0)))), 1),
  "pdfnav.navBackLabel": run_lib(() => str_out(run_loop($pdfnav_navBackLabel())), 0),
  "pdfnav.navBackTitle": run_lib(() => str_out(run_loop($pdfnav_navBackTitle())), 0),
  "pdfnav.navBackAria": run_lib((a0) => str_out(run_loop($pdfnav_navBackAria(str_in(a0)))), 1),
  "pdfnav.bookmarkDialogTitle": run_lib(() => str_out(run_loop($pdfnav_bookmarkDialogTitle())), 0),
  "pdfnav.bookmarkNameLabel": run_lib(() => str_out(run_loop($pdfnav_bookmarkNameLabel())), 0),
  "pdfnav.bookmarkDialogHint": run_lib((a0, a1) => str_out(run_loop($pdfnav_bookmarkDialogHint(str_in(a0), nat_in(a1)))), 2),
  "pdfnav.bookmarkSaveLabel": run_lib(() => str_out(run_loop($pdfnav_bookmarkSaveLabel())), 0),
  "pdfnav.bookmarkCancelLabel": run_lib(() => str_out(run_loop($pdfnav_bookmarkCancelLabel())), 0),
  "pdfnav.pageFloor.if": run_lib((a0, a1) => run_loop($pdfnav_pageFloor_if(nat_in(a0), a1)), 2),
  "pdfnav.pageFloor": run_lib((a0) => run_loop($pdfnav_pageFloor(nat_in(a0))), 1),
  "pdfnav.fitPath": run_lib((a0) => str_out(run_loop($pdfnav_fitPath(str_in(a0)))), 1),
  "pdfnav.newBookmark": run_lib((a0, a1, a2) => run_loop($pdfnav_newBookmark(str_in(a0), str_in(a1), nat_in(a2))), 3),
  "pdfnav.keepBookmark.path": run_lib((a0) => run_loop($pdfnav_keepBookmark_path(a0)), 1),
  "pdfnav.keepBookmark": run_lib((a0) => run_loop($pdfnav_keepBookmark(a0)), 1),
  "pdfnav.sameBookmark": run_lib((a0, a1) => run_loop($pdfnav_sameBookmark(a0, a1)), 2),
  "pdfnav.dropSame.head": run_lib((a0, a1, a2) => run_loop($pdfnav_dropSame_head(a0, a1, a2)), 3),
  "pdfnav.dropSame.go": run_lib((a0, a1) => run_loop($pdfnav_dropSame_go(a0, a1)), 2),
  "pdfnav.takeList.go": run_lib((a0, a1) => run_loop($pdfnav_takeList_go(a0, nat_in(a1))), 2),
  "pdfnav.addBookmark": run_lib((a0, a1) => run_loop($pdfnav_addBookmark(a0, a1)), 2),
  "pdfnav.removeBookmark": run_lib((a0, a1) => run_loop($pdfnav_removeBookmark(a0, a1)), 2),
  "pdfnav.emptyBooks": run_lib((a0) => run_loop($pdfnav_emptyBooks(a0)), 1),
  "pdfnav.emptyOutline": run_lib((a0) => run_loop($pdfnav_emptyOutline(a0)), 1),
  "pdfnav.bookmarkRow": run_lib((a0, a1, a2) => run_loop($pdfnav_bookmarkRow(nat_in(a0), a1, str_in(a2))), 3),
  "pdfnav.bookmarkRows.go": run_lib((a0, a1, a2) => run_loop($pdfnav_bookmarkRows_go(a0, str_in(a1), nat_in(a2))), 3),
  "pdfnav.bookmarkRows": run_lib((a0, a1) => run_loop($pdfnav_bookmarkRows(a0, str_in(a1))), 2),
  "pdfnav.clampDepth.if": run_lib((a0, a1) => run_loop($pdfnav_clampDepth_if(nat_in(a0), a1)), 2),
  "pdfnav.clampDepth": run_lib((a0) => run_loop($pdfnav_clampDepth(nat_in(a0))), 1),
  "pdfnav.outlineDepth": run_lib((a0) => str_out(run_loop($pdfnav_outlineDepth(nat_in(a0)))), 1),
  "pdfnav.outlineLabel": run_lib((a0, a1) => str_out(run_loop($pdfnav_outlineLabel(str_in(a0), nat_in(a1)))), 2),
  "pdfnav.outlineRow": run_lib((a0) => run_loop($pdfnav_outlineRow(a0)), 1),
  "pdfnav.outlineRows": run_lib((a0) => run_loop($pdfnav_outlineRows(a0)), 1),
  "pdfnav.navEmpty": run_lib((a0) => run_loop($pdfnav_navEmpty(str_in(a0))), 1),
  "pdfnav.navSaveButton": run_lib(() => run_loop($pdfnav_navSaveButton()), 0),
  "pdfnav.navSection": run_lib((a0, a1, a2, a3) => run_loop($pdfnav_navSection(str_in(a0), a1, str_in(a2), a3)), 4),
  "pdfnav.navPopover": run_lib((a0, a1, a2, a3) => run_loop($pdfnav_navPopover(a0, a1, a2, str_in(a3))), 4),
  "pdfview.placeholderText": run_lib(() => str_out(run_loop($pdfview_placeholderText())), 0),
  "pdfview.footLoadingText": run_lib(() => str_out(run_loop($pdfview_footLoadingText())), 0),
  "pdfview.footErrorText": run_lib(() => str_out(run_loop($pdfview_footErrorText())), 0),
  "pdfview.pageTotalDash": run_lib(() => str_out(run_loop($pdfview_pageTotalDash())), 0),
  "pdfview.gridFlags": run_lib((a0, a1) => run_loop($pdfview_gridFlags(a0, a1)), 2),
  "pdfview.panelFlags": run_lib((a0, a1) => run_loop($pdfview_panelFlags(a0, a1)), 2),
  "pdfview.navChrome": run_lib((a0, a1, a2) => run_loop($pdfview_navChrome(a0, a1, a2)), 3),
  "pdfview.collapseTitle": run_lib((a0) => str_out(run_loop($pdfview_collapseTitle(a0))), 1),
  "pdfview.disabledAttr": run_lib((a0) => run_loop($pdfview_disabledAttr(a0)), 1),
  "pdfview.pageNumberValue": run_lib((a0) => str_out(run_loop($pdfview_pageNumberValue(nat_in(a0)))), 1),
  "pdfview.pageNumberMax": run_lib((a0) => str_out(run_loop($pdfview_pageNumberMax(nat_in(a0)))), 1),
  "pdfview.pageTotalText": run_lib((a0) => str_out(run_loop($pdfview_pageTotalText(nat_in(a0)))), 1),
  "pdfview.zoomLabelText": run_lib((a0) => str_out(run_loop($pdfview_zoomLabelText(nat_in(a0)))), 1),
  "pdfview.footReadyText": run_lib((a0, a1, a2) => str_out(run_loop($pdfview_footReadyText(nat_in(a0), nat_in(a1), str_in(a2)))), 3),
  "pdfview.findCountChrome.shown": run_lib((a0, a1, a2) => run_loop($pdfview_findCountChrome_shown(a0, nat_in(a1), nat_in(a2))), 3),
  "pdfview.findCountChrome": run_lib((a0, a1, a2, a3) => run_loop($pdfview_findCountChrome(a0, a1, nat_in(a2), nat_in(a3))), 4),
  "pdfview.gridClass": run_lib((a0, a1) => run_loop($pdfview_gridClass(a0, a1)), 2),
  "pdfview.panelClass": run_lib((a0, a1) => run_loop($pdfview_panelClass(a0, a1)), 2),
  "pdfview.label": run_lib((a0) => run_loop($pdfview_label(str_in(a0))), 1),
  "pdfview.placeholder": run_lib(() => run_loop($pdfview_placeholder()), 0),
  "pdfview.pageTotalEmpty": run_lib(() => run_loop($pdfview_pageTotalEmpty()), 0),
  "pdfview.pageTotal": run_lib((a0) => run_loop($pdfview_pageTotal(nat_in(a0))), 1),
  "pdfview.zoomLabel": run_lib((a0) => run_loop($pdfview_zoomLabel(nat_in(a0))), 1),
  "pdfview.footLoading": run_lib(() => run_loop($pdfview_footLoading()), 0),
  "pdfview.footError": run_lib(() => run_loop($pdfview_footError()), 0),
  "pdfview.footReady": run_lib((a0, a1, a2) => run_loop($pdfview_footReady(nat_in(a0), nat_in(a1), str_in(a2))), 3),
  "pdfview.footReadyTextLabeled.if": run_lib((a0, a1, a2, a3, a4) => str_out(run_loop($pdfview_footReadyTextLabeled_if(nat_in(a0), nat_in(a1), str_in(a2), str_in(a3), a4))), 5),
  "pdfview.footReadyTextLabeled": run_lib((a0, a1, a2, a3) => str_out(run_loop($pdfview_footReadyTextLabeled(nat_in(a0), nat_in(a1), str_in(a2), str_in(a3)))), 4),
  "pdfview.footReadyLabeled": run_lib((a0, a1, a2, a3) => run_loop($pdfview_footReadyLabeled(nat_in(a0), nat_in(a1), str_in(a2), str_in(a3))), 4),
  "pdfview.findCountLabel": run_lib((a0) => run_loop($pdfview_findCountLabel(a0)), 1),
  "readersheet.sheetTitle": run_lib(() => str_out(run_loop($readersheet_sheetTitle())), 0),
  "readersheet.introText": run_lib(() => str_out(run_loop($readersheet_introText())), 0),
  "readersheet.dragText": run_lib(() => str_out(run_loop($readersheet_dragText())), 0),
  "readersheet.openText": run_lib(() => str_out(run_loop($readersheet_openText())), 0),
  "readersheet.folderText": run_lib(() => str_out(run_loop($readersheet_folderText())), 0),
  "readersheet.tutorText": run_lib(() => str_out(run_loop($readersheet_tutorText())), 0),
  "readersheet.openLabel": run_lib(() => str_out(run_loop($readersheet_openLabel())), 0),
  "readersheet.folderLabel": run_lib(() => str_out(run_loop($readersheet_folderLabel())), 0),
  "readersheet.tutorLabel": run_lib(() => str_out(run_loop($readersheet_tutorLabel())), 0),
  "readersheet.dropTitle": run_lib(() => str_out(run_loop($readersheet_dropTitle())), 0),
  "readersheet.dropHelp": run_lib(() => str_out(run_loop($readersheet_dropHelp())), 0),
  "readersheet.sheetAria": run_lib((a0) => str_out(run_loop($readersheet_sheetAria(str_in(a0)))), 1),
  "readersheet.courseLine.pick": run_lib((a0, a1) => str_out(run_loop($readersheet_courseLine_pick(a0, str_in(a1)))), 2),
  "readersheet.courseLine": run_lib((a0) => str_out(run_loop($readersheet_courseLine(str_in(a0)))), 1),
  "readersheet.tutorSeed.pick": run_lib((a0, a1) => str_out(run_loop($readersheet_tutorSeed_pick(a0, str_in(a1)))), 2),
  "readersheet.tutorSeed": run_lib((a0) => str_out(run_loop($readersheet_tutorSeed(str_in(a0)))), 1),
  "readersheet.link": run_lib((a0, a1) => run_loop($readersheet_link(str_in(a0), str_in(a1))), 2),
  "readersheet.plainItem": run_lib((a0) => run_loop($readersheet_plainItem(str_in(a0))), 1),
  "readersheet.linkItem": run_lib((a0, a1, a2) => run_loop($readersheet_linkItem(str_in(a0), str_in(a1), str_in(a2))), 3),
  "readersheet.items": run_lib(() => run_loop($readersheet_items()), 0),
  "readersheet.dropZone": run_lib(() => run_loop($readersheet_dropZone()), 0),
  "readersheet.sheet": run_lib((a0) => run_loop($readersheet_sheet(str_in(a0))), 1),
  emptyOptionLabel: run_lib(() => str_out(run_loop($emptyOptionLabel())), 0),
  findPlaceholder: run_lib(() => str_out(run_loop($findPlaceholder())), 0),
  findButtonLabel: run_lib(() => str_out(run_loop($findButtonLabel())), 0),
  openTitle: run_lib(() => str_out(run_loop($openTitle())), 0),
  findTitle: run_lib(() => str_out(run_loop($findTitle())), 0),
  shotTitle: run_lib(() => str_out(run_loop($shotTitle())), 0),
  prevAria: run_lib(() => str_out(run_loop($prevAria())), 0),
  nextAria: run_lib(() => str_out(run_loop($nextAria())), 0),
  outAria: run_lib(() => str_out(run_loop($outAria())), 0),
  inAria: run_lib(() => str_out(run_loop($inAria())), 0),
  fitTitle: run_lib(() => str_out(run_loop($fitTitle())), 0),
  invertTitle: run_lib(() => str_out(run_loop($invertTitle())), 0),
  invertAria: run_lib(() => str_out(run_loop($invertAria())), 0),
  dividerAria: run_lib(() => str_out(run_loop($dividerAria())), 0),
  documentAria: run_lib((a0) => str_out(run_loop($documentAria(str_in(a0)))), 1),
  openAria: run_lib((a0) => str_out(run_loop($openAria(str_in(a0)))), 1),
  findAria: run_lib((a0) => str_out(run_loop($findAria(str_in(a0)))), 1),
  pageAria: run_lib((a0) => str_out(run_loop($pageAria(str_in(a0)))), 1),
  moreTitle: run_lib(() => str_out(run_loop($moreTitle())), 0),
  moreAria: run_lib((a0) => str_out(run_loop($moreAria(str_in(a0)))), 1),
  restoreAria: run_lib((a0) => str_out(run_loop($restoreAria(str_in(a0)))), 1),
  zoomRowLabel: run_lib(() => str_out(run_loop($zoomRowLabel())), 0),
  shotMenuLabel: run_lib(() => str_out(run_loop($shotMenuLabel())), 0),
  invertMenuLabel: run_lib(() => str_out(run_loop($invertMenuLabel())), 0),
  printedMenuLabel: run_lib(() => str_out(run_loop($printedMenuLabel())), 0),
  rotationStep: run_lib(() => run_loop($rotationStep()), 0),
  rotationNext: run_lib((a0) => run_loop($rotationNext(nat_in(a0))), 1),
  rotationValid: run_lib((a0) => run_loop($rotationValid(nat_in(a0))), 1),
  "rotationNormalize.if": run_lib((a0, a1) => run_loop($rotationNormalize_if(nat_in(a0), a1)), 2),
  rotationNormalize: run_lib((a0) => run_loop($rotationNormalize(nat_in(a0))), 1),
  rotateTitle: run_lib((a0) => str_out(run_loop($rotateTitle(nat_in(a0)))), 1),
  rotateAria: run_lib((a0, a1) => str_out(run_loop($rotateAria(str_in(a0), nat_in(a1)))), 2),
  rotateToast: run_lib((a0) => str_out(run_loop($rotateToast(nat_in(a0)))), 1),
  "printedOffsetLabel.positive": run_lib((a0) => str_out(run_loop($printedOffsetLabel_positive(nat_in(a0)))), 1),
  "printedOffsetLabel.signed": run_lib((a0, a1, a2) => str_out(run_loop($printedOffsetLabel_signed(a0, nat_in(a1), nat_in(a2)))), 3),
  printedOffsetLabel: run_lib((a0, a1) => str_out(run_loop($printedOffsetLabel(a0, nat_in(a1)))), 2),
  "printedLabel.own.if": run_lib((a0, a1, a2, a3) => str_out(run_loop($printedLabel_own_if(str_in(a0), a1, nat_in(a2), a3))), 4),
  "printedLabel.own": run_lib((a0, a1, a2) => str_out(run_loop($printedLabel_own(str_in(a0), a1, nat_in(a2)))), 3),
  "printedLabel.go": run_lib((a0, a1, a2, a3) => str_out(run_loop($printedLabel_go(a0, a1, nat_in(a2), nat_in(a3)))), 4),
  printedLabel: run_lib((a0, a1, a2) => str_out(run_loop($printedLabel(a0, a1, nat_in(a2)))), 3),
  isDigitChar: run_lib((a0) => run_loop($isDigitChar(str_in(a0))), 1),
  "printedDigits.go": run_lib((a0, a1) => run_loop($printedDigits_go(str_in(a0), a1)), 2),
  printedDigits: run_lib((a0) => run_loop($printedDigits(str_in(a0))), 1),
  "printedNumber.parsed": run_lib((a0) => run_loop($printedNumber_parsed(a0)), 1),
  "printedNumber.if": run_lib((a0, a1, a2) => run_loop($printedNumber_if(str_in(a0), a1, a2)), 3),
  printedNumber: run_lib((a0) => run_loop($printedNumber(str_in(a0))), 1),
  "printedMatches.cmp": run_lib((a0, a1, a2) => run_loop($printedMatches_cmp(str_in(a0), str_in(a1), a2)), 3),
  "printedMatches.push": run_lib((a0, a1, a2) => run_loop($printedMatches_push(a0, nat_in(a1), a2)), 3),
  "printedMatches.go": run_lib((a0, a1, a2, a3, a4) => run_loop($printedMatches_go(a0, str_in(a1), a2, nat_in(a3), a4)), 5),
  "printedPick.first.if": run_lib((a0, a1, a2) => run_loop($printedPick_first_if(nat_in(a0), nat_in(a1), a2)), 3),
  "printedPick.first": run_lib((a0, a1) => run_loop($printedPick_first(nat_in(a0), nat_in(a1))), 2),
  "printedPick.best.min.if": run_lib((a0, a1, a2) => run_loop($printedPick_best_min_if(nat_in(a0), nat_in(a1), a2)), 3),
  "printedPick.best.min": run_lib((a0, a1) => run_loop($printedPick_best_min(nat_in(a0), nat_in(a1))), 2),
  "printedPick.best.none": run_lib((a0, a1, a2) => run_loop($printedPick_best_none(nat_in(a0), nat_in(a1), a2)), 3),
  "printedPick.best.if": run_lib((a0, a1, a2, a3) => run_loop($printedPick_best_if(nat_in(a0), nat_in(a1), nat_in(a2), a3)), 4),
  "printedPick.best": run_lib((a0, a1, a2) => run_loop($printedPick_best(nat_in(a0), nat_in(a1), nat_in(a2))), 3),
  "printedPick.fin.if": run_lib((a0, a1, a2) => run_loop($printedPick_fin_if(nat_in(a0), nat_in(a1), a2)), 3),
  "printedPick.fin": run_lib((a0, a1) => run_loop($printedPick_fin(nat_in(a0), nat_in(a1))), 2),
  "printedPick.go": run_lib((a0, a1, a2, a3) => run_loop($printedPick_go(a0, nat_in(a1), nat_in(a2), nat_in(a3))), 4),
  "resolvePrinted.inBounds.if": run_lib((a0, a1, a2) => run_loop($resolvePrinted_inBounds_if(nat_in(a0), nat_in(a1), a2)), 3),
  "resolvePrinted.inBounds": run_lib((a0, a1) => run_loop($resolvePrinted_inBounds(nat_in(a0), nat_in(a1))), 2),
  "resolvePrinted.shift": run_lib((a0, a1, a2, a3) => run_loop($resolvePrinted_shift(a0, nat_in(a1), nat_in(a2), nat_in(a3))), 4),
  "resolvePrinted.byOffset.value": run_lib((a0, a1, a2) => run_loop($resolvePrinted_byOffset_value(a0, nat_in(a1), nat_in(a2))), 3),
  "resolvePrinted.byOffset.parsed": run_lib((a0, a1, a2) => run_loop($resolvePrinted_byOffset_parsed(a0, nat_in(a1), a2)), 3),
  "resolvePrinted.byOffset": run_lib((a0, a1, a2) => run_loop($resolvePrinted_byOffset(a0, str_in(a1), nat_in(a2))), 3),
  "resolvePrinted.folded.matches": run_lib((a0, a1, a2, a3) => run_loop($resolvePrinted_folded_matches(str_in(a0), nat_in(a1), nat_in(a2), a3)), 4),
  "resolvePrinted.folded": run_lib((a0, a1, a2, a3) => run_loop($resolvePrinted_folded(a0, str_in(a1), nat_in(a2), nat_in(a3))), 4),
  "resolvePrinted.own.matches": run_lib((a0, a1, a2, a3, a4) => run_loop($resolvePrinted_own_matches(a0, str_in(a1), nat_in(a2), nat_in(a3), a4)), 5),
  "resolvePrinted.own": run_lib((a0, a1, a2, a3) => run_loop($resolvePrinted_own(a0, str_in(a1), nat_in(a2), nat_in(a3))), 4),
  "resolvePrinted.if": run_lib((a0, a1, a2, a3, a4) => run_loop($resolvePrinted_if(a0, a1, nat_in(a2), nat_in(a3), str_in(a4))), 5),
  "resolvePrinted.empty": run_lib((a0, a1, a2, a3, a4, a5) => run_loop($resolvePrinted_empty(a0, a1, nat_in(a2), nat_in(a3), str_in(a4), a5)), 6),
  resolvePrinted: run_lib((a0, a1, a2, a3, a4) => run_loop($resolvePrinted(a0, a1, nat_in(a2), nat_in(a3), str_in(a4))), 5),
  printedTitle: run_lib(() => str_out(run_loop($printedTitle())), 0),
  printedInputPlaceholder: run_lib(() => str_out(run_loop($printedInputPlaceholder())), 0),
  printedInputAria: run_lib((a0) => str_out(run_loop($printedInputAria(str_in(a0)))), 1),
  printedGoLabel: run_lib(() => str_out(run_loop($printedGoLabel())), 0),
  printedToggleTitle: run_lib(() => str_out(run_loop($printedToggleTitle())), 0),
  printedToggleAria: run_lib((a0) => str_out(run_loop($printedToggleAria(str_in(a0)))), 1),
  printedOffsetFieldLabel: run_lib(() => str_out(run_loop($printedOffsetFieldLabel())), 0),
  printedOffsetTitle: run_lib(() => str_out(run_loop($printedOffsetTitle())), 0),
  printedOffsetInputAria: run_lib((a0) => str_out(run_loop($printedOffsetInputAria(str_in(a0)))), 1),
  printedOffsetSaveLabel: run_lib(() => str_out(run_loop($printedOffsetSaveLabel())), 0),
  printedOffsetAutoLabel: run_lib(() => str_out(run_loop($printedOffsetAutoLabel())), 0),
  printedOwnLabel: run_lib(() => str_out(run_loop($printedOwnLabel())), 0),
  printedAutoLabel: run_lib(() => str_out(run_loop($printedAutoLabel())), 0),
  printedOwnHint: run_lib(() => str_out(run_loop($printedOwnHint())), 0),
  printedNoApiHint: run_lib(() => str_out(run_loop($printedNoApiHint())), 0),
  "printedStatusText.signed": run_lib((a0, a1) => str_out(run_loop($printedStatusText_signed(a0, nat_in(a1)))), 2),
  printedStatusText: run_lib((a0, a1) => str_out(run_loop($printedStatusText(a0, a1))), 2),
  "printedCurrentText.if": run_lib((a0, a1) => str_out(run_loop($printedCurrentText_if(str_in(a0), a1))), 2),
  printedCurrentText: run_lib((a0) => str_out(run_loop($printedCurrentText(str_in(a0)))), 1),
  printedFoundText: run_lib((a0, a1) => str_out(run_loop($printedFoundText(str_in(a0), nat_in(a1)))), 2),
  printedNotFoundText: run_lib(() => str_out(run_loop($printedNotFoundText())), 0),
  printedInvalidText: run_lib(() => str_out(run_loop($printedInvalidText())), 0),
  printedBadOffsetText: run_lib(() => str_out(run_loop($printedBadOffsetText())), 0),
  dropHintText: run_lib((a0) => str_out(run_loop($dropHintText(str_in(a0)))), 1),
  dropOpeningText: run_lib(() => str_out(run_loop($dropOpeningText())), 0),
  dropOpenedText: run_lib((a0, a1) => str_out(run_loop($dropOpenedText(str_in(a0), str_in(a1)))), 2),
  dropUnavailableText: run_lib(() => str_out(run_loop($dropUnavailableText())), 0),
  dropInvalidText: run_lib(() => str_out(run_loop($dropInvalidText())), 0),
  printedSavedAutoText: run_lib(() => str_out(run_loop($printedSavedAutoText())), 0),
  "printedSavedOffsetText.signed": run_lib((a0, a1) => str_out(run_loop($printedSavedOffsetText_signed(a0, nat_in(a1)))), 2),
  printedSavedOffsetText: run_lib((a0) => str_out(run_loop($printedSavedOffsetText(a0))), 1),
  optionKids: run_lib((a0) => run_loop($optionKids(str_in(a0))), 1),
  optionNode: run_lib((a0, a1) => run_loop($optionNode(a0, str_in(a1))), 2),
  optionEmpty: run_lib(() => run_loop($optionEmpty()), 0),
  "optionNodes.go": run_lib((a0, a1) => run_loop($optionNodes_go(a0, str_in(a1))), 2),
  optionNodes: run_lib((a0, a1) => run_loop($optionNodes(a0, str_in(a1))), 2),
  selectNode: run_lib((a0, a1, a2) => run_loop($selectNode(str_in(a0), a1, str_in(a2))), 3),
  iconBtnAttrs: run_lib((a0, a1, a2) => run_loop($iconBtnAttrs(str_in(a0), str_in(a1), str_in(a2))), 3),
  itemAttrs: run_lib((a0, a1, a2) => run_loop($itemAttrs(str_in(a0), str_in(a1), str_in(a2))), 3),
  iconBtn: run_lib((a0, a1, a2, a3) => run_loop($iconBtn(str_in(a0), str_in(a1), str_in(a2), str_in(a3))), 4),
  openBtn: run_lib((a0) => run_loop($openBtn(str_in(a0))), 1),
  findToggleBtn: run_lib((a0, a1) => run_loop($findToggleBtn(str_in(a0), a1)), 2),
  shotBtn: run_lib((a0) => run_loop($shotBtn(str_in(a0))), 1),
  collapseIcon: run_lib((a0) => str_out(run_loop($collapseIcon(a0))), 1),
  collapseBtn: run_lib((a0) => run_loop($collapseBtn(a0)), 1),
  navBackTitle: run_lib(() => str_out(run_loop($navBackTitle())), 0),
  navBackAria: run_lib((a0) => str_out(run_loop($navBackAria(str_in(a0)))), 1),
  navBtn: run_lib((a0) => run_loop($navBtn(str_in(a0))), 1),
  backBtn: run_lib((a0) => run_loop($backBtn(str_in(a0))), 1),
  moreBtn: run_lib((a0) => run_loop($moreBtn(str_in(a0))), 1),
  rotateBtn: run_lib((a0, a1) => run_loop($rotateBtn(str_in(a0), nat_in(a1))), 2),
  pageInput: run_lib((a0) => run_loop($pageInput(str_in(a0))), 1),
  titleBar: run_lib((a0) => run_loop($titleBar(a0)), 1),
  fitBtn: run_lib(() => run_loop($fitBtn()), 0),
  invertBtn: run_lib(() => run_loop($invertBtn()), 0),
  zoomRow: run_lib(() => run_loop($zoomRow()), 0),
  moreMenu: run_lib((a0, a1, a2) => run_loop($moreMenu(str_in(a0), nat_in(a1), a2)), 3),
  restoreBtn: run_lib((a0) => run_loop($restoreBtn(str_in(a0))), 1),
  stage: run_lib(() => run_loop($stage()), 0),
  findForm: run_lib((a0) => run_loop($findForm(str_in(a0))), 1),
  panelShell: run_lib((a0) => run_loop($panelShell(a0)), 1),
  divider: run_lib(() => run_loop($divider()), 0),
  pageStyle: run_lib((a0, a1) => str_out(run_loop($pageStyle(str_in(a0), str_in(a1)))), 2),
  pageNode: run_lib((a0) => run_loop($pageNode(a0)), 1),
  pageNodes: run_lib((a0) => run_loop($pageNodes(a0)), 1),
  docFrame: run_lib((a0) => run_loop($docFrame(a0)), 1),
  viewport: run_lib((a0, a1) => run_loop($viewport(a0, a1)), 2),
  hlPush: run_lib((a0, a1) => run_loop($hlPush(a0, a1)), 2),
  "hlFlush.if": run_lib((a0, a1, a2) => run_loop($hlFlush_if(str_in(a0), a1, a2)), 3),
  hlFlush: run_lib((a0, a1) => run_loop($hlFlush(str_in(a0), a1)), 2),
  hlScan: run_lib((a0, a1, a2, a3, a4, a5, a6, a7) => run_loop($hlScan(str_in(a0), str_in(a1), str_in(a2), nat_in(a3), str_in(a4), a5, str_in(a6), a7)), 8),
  "hlNode.go": run_lib((a0, a1) => run_loop($hlNode_go(str_in(a0), a1)), 2),
  hlNode: run_lib((a0) => run_loop($hlNode(a0)), 1),
  hlNodes: run_lib((a0, a1) => run_loop($hlNodes(a0, a1)), 2),
  "hlSegments.if": run_lib((a0, a1, a2, a3) => run_loop($hlSegments_if(str_in(a0), str_in(a1), str_in(a2), a3)), 4),
  hlSegments: run_lib((a0, a1, a2) => run_loop($hlSegments(str_in(a0), str_in(a1), str_in(a2))), 3),
  printedInput: run_lib((a0) => run_loop($printedInput(str_in(a0))), 1),
  printedGoBtn: run_lib(() => run_loop($printedGoBtn()), 0),
  printedStatusNode: run_lib(() => run_loop($printedStatusNode()), 0),
  printedOffsetInput: run_lib((a0) => run_loop($printedOffsetInput(str_in(a0))), 1),
  printedOffsetSaveBtn: run_lib(() => run_loop($printedOffsetSaveBtn()), 0),
  printedOffsetAutoBtn: run_lib(() => run_loop($printedOffsetAutoBtn()), 0),
  printedOffsetEditor: run_lib((a0) => run_loop($printedOffsetEditor(str_in(a0))), 1),
  printedRow: run_lib((a0, a1) => run_loop($printedRow(str_in(a0), a1)), 2),
  printedToggleBtn: run_lib((a0, a1) => run_loop($printedToggleBtn(str_in(a0), a1)), 2),
  dropHint: run_lib((a0) => run_loop($dropHint(str_in(a0))), 1)
};
export {
  pdfpageview_default as default
};

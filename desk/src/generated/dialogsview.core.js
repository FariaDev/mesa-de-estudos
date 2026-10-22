// GERADO de core/dialogsview.bend por `bun core/build.mjs` — não editar à mão.
// core/dialogsview.bend
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
function $updatenotice_isVer(_v_0) {
  if (_v_0.$ === "NoVer") {
    return false;
  } else {
    return true;
  }
}
function $updatenotice_tripleNewer(_am_0, _an_0, _ap_0, _bm_0, _bn_0, _bp_0) {
  const _x_0 = _an_0 > _bn_0;
  const _x_1 = $Bool_and(_an_0 === _bn_0, _ap_0 > _bp_0);
  const _x_2 = _am_0 > _bm_0;
  const _x_3 = $Bool_and(_am_0 === _bm_0, _x_0 || _x_1);
  return _x_2 || _x_3;
}
function $updatenotice_verNewer(_a_0, _b_0) {
  if (_a_0.$ === "NoVer") {
    return false;
  } else {
    const _am_0 = _a_0["major"];
    const _an_0 = _a_0["minor"];
    const _ap_0 = _a_0["patch"];
    if (_b_0.$ === "NoVer") {
      return false;
    } else {
      const _bm_0 = _b_0["major"];
      const _bn_0 = _b_0["minor"];
      const _bp_0 = _b_0["patch"];
      return $updatenotice_tripleNewer(_am_0, _an_0, _ap_0, _bm_0, _bn_0, _bp_0);
    }
  }
}
function $updatenotice_verPick(_c_0, _a_0, _b_0) {
  if (_c_0) {
    return _a_0;
  } else {
    return _b_0;
  }
}
function $updatenotice_verMax(_a_0, _b_0) {
  const _x_0 = $Bool_not($updatenotice_isVer(_a_0));
  const _x_1 = $updatenotice_verNewer(_b_0, _a_0);
  return $updatenotice_verPick(_x_0 || _x_1, _b_0, _a_0);
}
function $updatenotice_emptyMemory() {
  return { $: "Memory", seen: { $: "NoVer" }, ignored: { $: "NoVer" }, remindDay: 0 };
}
function $updatenotice_ignoredCovers(_latest_0, _ignored_0) {
  return $Bool_and($updatenotice_isVer(_ignored_0), $Bool_not($updatenotice_verNewer(_latest_0, _ignored_0)));
}
function $updatenotice_newerThanSeen(_latest_0, _seen_0) {
  const _x_0 = $Bool_not($updatenotice_isVer(_seen_0));
  const _x_1 = $updatenotice_verNewer(_latest_0, _seen_0);
  return _x_0 || _x_1;
}
function $updatenotice_targetVersion(_available_0, _latest_0, _installed_0) {
  return $updatenotice_verPick(_available_0, _latest_0, _installed_0);
}
function $updatenotice_noticeFrom(_available_0, _unreachable_0, _quiet_0, _newer_0, _ahead_0) {
  return { $: "Notice", available: _available_0, unreachable: _unreachable_0, showLine: $Bool_and(_available_0, $Bool_not(_quiet_0)), showDot: $Bool_and($Bool_and(_available_0, $Bool_not(_quiet_0)), _newer_0), ahead: _ahead_0 };
}
function $updatenotice_noticeOf(_installed_0, _latest_0, _tested_0, _m_0, _today_0) {
  const _seen_0 = _m_0["seen"];
  const _ignored_0 = _m_0["ignored"];
  const _remindDay_0 = _m_0["remindDay"];
  const _x_0 = $updatenotice_ignoredCovers(_latest_0, _ignored_0);
  const _x_1 = _today_0 < _remindDay_0;
  return $updatenotice_noticeFrom($updatenotice_verNewer(_latest_0, _installed_0), $Bool_not($updatenotice_isVer(_latest_0)), _x_0 || _x_1, $updatenotice_newerThanSeen(_latest_0, _seen_0), $updatenotice_verNewer($updatenotice_targetVersion($updatenotice_verNewer(_latest_0, _installed_0), _latest_0, _installed_0), _tested_0));
}
function $updatenotice_seenAfterOpen(_seen_0, _latest_0, _available_0) {
  return $updatenotice_verPick(_available_0, $updatenotice_verMax(_seen_0, _latest_0), _seen_0);
}
function $updatenotice_afterOpen(_m_0, _installed_0, _latest_0) {
  const _seen_0 = _m_0["seen"];
  const _ignored_0 = _m_0["ignored"];
  const _remindDay_0 = _m_0["remindDay"];
  return { $: "Memory", seen: $updatenotice_seenAfterOpen(_seen_0, _latest_0, $updatenotice_verNewer(_latest_0, _installed_0)), ignored: _ignored_0, remindDay: _remindDay_0 };
}
function $updatenotice_afterPostpone(_m_0, _today_0) {
  const _ignored_0 = _m_0["ignored"];
  return { $: "Memory", seen: { $: "NoVer" }, ignored: _ignored_0, remindDay: _today_0 + 1 >>> 0 };
}
function $updatenotice_afterIgnore(_m_0, _latest_0) {
  const _seen_0 = _m_0["seen"];
  const _ignored_0 = _m_0["ignored"];
  const _remindDay_0 = _m_0["remindDay"];
  return { $: "Memory", seen: _seen_0, ignored: $updatenotice_verMax(_ignored_0, _latest_0), remindDay: _remindDay_0 };
}
function $updatenotice_noticeText(_name_0, _version_0) {
  return $msg_msg2("update.noticeAvailable", "name", _name_0, "version", _version_0);
}
function $updatenotice_aheadText() {
  return $msg_msg("update.ahead");
}
function $updatenotice_offlineText() {
  return $msg_msg("update.offline");
}
function $updatenotice_remindLabel() {
  return $msg_msg("update.remind");
}
function $updatenotice_ignoreLabel() {
  return $msg_msg("update.ignore");
}
function $updatenotice_updateLabel() {
  return $msg_msg("update.update");
}
function $updatenotice_copyLabel() {
  return $msg_msg("common.copy");
}
function $updatenotice_cancelLabel() {
  return $msg_msg("common.cancel");
}
function $updatenotice_closeLabel() {
  return $msg_msg("common.close");
}
function $updatenotice_waitHint() {
  return $msg_msg("update.waitHint");
}
function $updatenotice_waitShort() {
  return $msg_msg("update.waitShort");
}
function $updatenotice_settingsTitle(_dot_0) {
  if (_dot_0) {
    return $msg_msg("chrome.settings.withUpdate");
  } else {
    return $msg_msg("chrome.settings");
  }
}
function $updatenotice_aheadWarning(_version_0, _tested_0) {
  return $msg_msg2("update.aheadWarning", "version", _version_0, "tested", _tested_0);
}
function $updatenotice_runningText() {
  return $msg_msg("update.running");
}
function $updatenotice_willRunText() {
  return $msg_msg("update.willRun");
}
function $updatenotice_relinkedText() {
  return $msg_msg("update.relinked");
}
function $updatenotice_doneSentence_same(_name_0, _before_0) {
  return $msg_msg2("update.sameVersion", "name", _name_0, "version", _before_0);
}
function $updatenotice_doneSentence_changed(_name_0, _after_0, _relinked_0) {
  if (_relinked_0) {
    return $msg_msg2("update.updatedRelinked", "name", _name_0, "version", _after_0);
  } else {
    return $msg_msg2("update.updated", "name", _name_0, "version", _after_0);
  }
}
function $updatenotice_doneSentence_improved(_name_0, _before_0, _after_0, _relinked_0, _improved_0) {
  if (_improved_0) {
    return $updatenotice_doneSentence_changed(_name_0, _after_0, _relinked_0);
  } else {
    return $updatenotice_doneSentence_same(_name_0, _before_0);
  }
}
function $updatenotice_doneSentence_known(_name_0, _before_0, _after_0, _relinked_0, _known_0, _improved_0) {
  if (!_known_0) {
    return $msg_msg1("update.unreadable", "name", _name_0);
  } else {
    return $updatenotice_doneSentence_improved(_name_0, _before_0, _after_0, _relinked_0, _improved_0);
  }
}
function $updatenotice_doneSentence_ok(_name_0, _beforeV_0, _afterV_0, _before_0, _after_0, _relinked_0) {
  return $updatenotice_doneSentence_known(_name_0, _before_0, _after_0, _relinked_0, $updatenotice_isVer(_afterV_0), $updatenotice_verNewer(_afterV_0, _beforeV_0));
}
function $updatenotice_doneSentence(_name_0, _ok_0, _beforeV_0, _afterV_0, _before_0, _after_0, _relinked_0) {
  if (_ok_0) {
    return $updatenotice_doneSentence_ok(_name_0, _beforeV_0, _afterV_0, _before_0, _after_0, _relinked_0);
  } else {
    return $msg_msg1("update.failedRun", "name", _name_0);
  }
}
function $updatenotice_noticeIcon() {
  return $view_viewEl("span", { $: "Con", head: $view_attrClass("update-icon"), tail: { $: "Con", head: $view_attrData("state", "new"), tail: { $: "Con", head: $view_attrAria("hidden", "true"), tail: { $: "Nil" } } } }, { $: "Con", head: $view_viewText("↑"), tail: { $: "Nil" } });
}
function $updatenotice_noticeButton(_id_0, _handler_0, _label_0) {
  return $view_viewEl("button", { $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_attrClass("notice-btn"), tail: { $: "Con", head: $view_attrData("id", _id_0), tail: { $: "Con", head: $view_attrOn("click", _handler_0), tail: { $: "Nil" } } } } }, { $: "Con", head: $view_viewText(_label_0), tail: { $: "Nil" } });
}
function $updatenotice_noticeLineText(_name_0, _version_0, _ahead_0) {
  return $view_viewEl("p", { $: "Con", head: $view_attrClass("update-text"), tail: { $: "Nil" } }, $view_viewJoin({ $: "Con", head: { $: "Con", head: $view_viewEl("span", { $: "Con", head: $view_attrClass("update-main"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText($updatenotice_noticeText(_name_0, _version_0)), tail: { $: "Nil" } }), tail: { $: "Nil" } }, tail: { $: "Con", head: $view_viewWhen(_ahead_0, $view_viewEl("span", { $: "Con", head: $view_attrClass("update-muted"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText(" · "), tail: { $: "Con", head: $view_viewText($updatenotice_aheadText()), tail: { $: "Nil" } } })), tail: { $: "Nil" } } }));
}
function $updatenotice_noticeLineBody(_id_0, _name_0, _version_0, _ahead_0, _leading_0) {
  return $view_viewEl("div", { $: "Con", head: $view_attrClass("about-notice"), tail: { $: "Con", head: $view_attrData("id", _id_0), tail: { $: "Nil" } } }, $view_viewJoin({ $: "Con", head: { $: "Con", head: $updatenotice_noticeIcon(), tail: { $: "Con", head: $updatenotice_noticeLineText(_name_0, _version_0, _ahead_0), tail: { $: "Nil" } } }, tail: { $: "Con", head: _leading_0, tail: { $: "Con", head: { $: "Con", head: $updatenotice_noticeButton(_id_0, "PostponeNotice", $updatenotice_remindLabel()), tail: { $: "Con", head: $updatenotice_noticeButton(_id_0, "IgnoreNotice", $updatenotice_ignoreLabel()), tail: { $: "Nil" } } }, tail: { $: "Nil" } } } }));
}
function $updatenotice_noticeLineNode(_l_0) {
  const _id_0 = _l_0["id"];
  const _name_0 = _l_0["name"];
  const _version_0 = _l_0["version"];
  const _ahead_0 = _l_0["ahead"];
  return $updatenotice_noticeLineBody(_id_0, _name_0, _version_0, _ahead_0, { $: "Nil" });
}
function $updatenotice_noticeLines(_ls_0) {
  if (_ls_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _ls_0["head"];
    const _t_0 = _ls_0["tail"];
    return { $: "Con", head: $updatenotice_noticeLineNode(_h_0), tail: $updatenotice_noticeLines(_t_0) };
  }
}
function $updatenotice_showsNotice(_s_0) {
  if (_s_0.$ === "About") {
    return true;
  } else {
    return true;
  }
}
function $updatenotice_seesLine(_s_0, _lineVisible_0) {
  return $Bool_and($updatenotice_showsNotice(_s_0), _lineVisible_0);
}
function $updatenotice_seeAboutLabel() {
  return $msg_msg("update.seeAbout");
}
function $updatenotice_seeAboutButton(_id_0) {
  return $view_viewEl("button", { $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_attrClass("notice-btn"), tail: { $: "Con", head: $view_attrData("id", _id_0), tail: { $: "Con", head: $view_attrOn("click", "OpenAboutFromNotice"), tail: { $: "Nil" } } } } }, { $: "Con", head: $view_viewText($updatenotice_seeAboutLabel()), tail: { $: "Nil" } });
}
function $updatenotice_noticeLineFor(_s_0, _l_0) {
  if (_s_0.$ === "About") {
    return $updatenotice_noticeLineNode(_l_0);
  } else {
    const _id_0 = _l_0["id"];
    const _name_0 = _l_0["name"];
    const _version_0 = _l_0["version"];
    const _ahead_0 = _l_0["ahead"];
    return $updatenotice_noticeLineBody(_id_0, _name_0, _version_0, _ahead_0, { $: "Con", head: $updatenotice_seeAboutButton(_id_0), tail: { $: "Nil" } });
  }
}
function $updatenotice_noticeLinesFor(_s_0, _ls_0) {
  if (_ls_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _ls_0["head"];
    const _t_0 = _ls_0["tail"];
    return { $: "Con", head: $updatenotice_noticeLineFor(_s_0, _h_0), tail: $updatenotice_noticeLinesFor(_s_0, _t_0) };
  }
}
function $updatenotice_hasAction(_a_0) {
  if (_a_0.$ === "ToolNone") {
    return false;
  } else if (_a_0.$ === "ToolLocal") {
    return true;
  } else if (_a_0.$ === "ToolAsk") {
    return true;
  } else if (_a_0.$ === "ToolWait") {
    return true;
  } else {
    return true;
  }
}
function $updatenotice_localButton() {
  return $view_viewEl("button", { $: "Con", head: $view_attrId("update-pi"), tail: { $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_attrClass("component-update"), tail: { $: "Con", head: $view_attrOn("click", "UpdatePi"), tail: { $: "Nil" } } } } }, { $: "Con", head: $view_viewText($msg_msg("update.pi")), tail: { $: "Nil" } });
}
function $updatenotice_askButton(_command_0) {
  return $view_viewEl("button", { $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_attrClass("component-update tool-ask"), tail: { $: "Con", head: $view_attrData("command", _command_0), tail: { $: "Con", head: $view_attrOn("click", "AskUpdate"), tail: { $: "Nil" } } } } }, { $: "Con", head: $view_viewText($updatenotice_updateLabel()), tail: { $: "Nil" } });
}
function $updatenotice_waitNodes() {
  return { $: "Con", head: $view_viewEl("button", { $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_attrClass("component-update tool-ask"), tail: { $: "Con", head: $view_attr("disabled", ""), tail: { $: "Con", head: $view_attr("title", $updatenotice_waitHint()), tail: { $: "Con", head: $view_attrAria("describedby", "tool-wait-hint"), tail: { $: "Nil" } } } } } }, { $: "Con", head: $view_viewText($updatenotice_updateLabel()), tail: { $: "Nil" } }), tail: { $: "Con", head: $view_viewEl("small", { $: "Con", head: $view_attrClass("component-wait"), tail: { $: "Con", head: $view_attrId("tool-wait-hint"), tail: { $: "Nil" } } }, { $: "Con", head: $view_viewText($updatenotice_waitShort()), tail: { $: "Nil" } }), tail: { $: "Nil" } } };
}
function $updatenotice_copyButton(_command_0) {
  return $view_viewEl("button", { $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_attrClass("component-update tool-copy"), tail: { $: "Con", head: $view_attrData("command", _command_0), tail: { $: "Con", head: $view_attrAria("label", $msg_msg1("update.copyAria", "command", _command_0)), tail: { $: "Con", head: $view_attrOn("click", "CopyCommand"), tail: { $: "Nil" } } } } } }, { $: "Con", head: $view_viewText($updatenotice_copyLabel()), tail: { $: "Nil" } });
}
function $updatenotice_actionNodes(_a_0) {
  if (_a_0.$ === "ToolNone") {
    return { $: "Nil" };
  } else if (_a_0.$ === "ToolLocal") {
    return { $: "Con", head: $updatenotice_localButton(), tail: { $: "Nil" } };
  } else if (_a_0.$ === "ToolAsk") {
    const _command_0 = _a_0["command"];
    return { $: "Con", head: $updatenotice_askButton(_command_0), tail: { $: "Nil" } };
  } else if (_a_0.$ === "ToolWait") {
    return $updatenotice_waitNodes();
  } else {
    const _command_1 = _a_0["command"];
    return { $: "Con", head: $updatenotice_copyButton(_command_1), tail: { $: "Nil" } };
  }
}
function $updatenotice_commandNode(_command_0) {
  return $view_viewEl("code", { $: "Con", head: $view_attrClass("run-command"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText(_command_0), tail: { $: "Nil" } });
}
function $updatenotice_runLine(_label_0, _command_0) {
  return $view_viewEl("p", { $: "Con", head: $view_attrClass("run-line"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText(_label_0), tail: { $: "Con", head: $updatenotice_commandNode(_command_0), tail: { $: "Nil" } } });
}
function $updatenotice_outputNode(_output_0) {
  return $view_viewWhen($Bool_not($String_is_empty(_output_0)), $view_viewEl("pre", { $: "Con", head: $view_attrClass("run-output"), tail: { $: "Con", head: $view_attr("tabindex", "0"), tail: { $: "Con", head: $view_attr("role", "log"), tail: { $: "Con", head: $view_attrAria("label", $msg_msg("update.outputAria")), tail: { $: "Nil" } } } } }, { $: "Con", head: $view_viewText(_output_0), tail: { $: "Nil" } }));
}
function $updatenotice_runButton(_label_0, _handler_0, _cls_0) {
  return $view_viewEl("button", { $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_attrClass(_cls_0), tail: { $: "Con", head: $view_attrOn("click", _handler_0), tail: { $: "Nil" } } } }, { $: "Con", head: $view_viewText(_label_0), tail: { $: "Nil" } });
}
function $updatenotice_donePhase(_ok_0) {
  if (_ok_0) {
    return "done";
  } else {
    return "failed";
  }
}
function $updatenotice_runPanel(_phase_0, _kids_0) {
  return $view_viewEl("div", { $: "Con", head: $view_attrClass("component-run"), tail: { $: "Con", head: $view_attrData("phase", _phase_0), tail: { $: "Con", head: $view_attr("role", "group"), tail: { $: "Nil" } } } }, _kids_0);
}
function $updatenotice_confirmNodes(_command_0, _warning_0) {
  return $updatenotice_runPanel("confirm", $view_viewJoin({ $: "Con", head: { $: "Con", head: $updatenotice_runLine($updatenotice_willRunText(), _command_0), tail: { $: "Nil" } }, tail: { $: "Con", head: $view_viewWhen($Bool_not($String_is_empty(_warning_0)), $view_viewEl("p", { $: "Con", head: $view_attrClass("run-warn"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText(_warning_0), tail: { $: "Nil" } })), tail: { $: "Con", head: { $: "Con", head: $view_viewEl("div", { $: "Con", head: $view_attrClass("run-actions"), tail: { $: "Nil" } }, { $: "Con", head: $updatenotice_runButton($updatenotice_cancelLabel(), "CancelRun", "run-cancel"), tail: { $: "Con", head: $updatenotice_runButton($updatenotice_updateLabel(), "ConfirmRun", "primary run-confirm"), tail: { $: "Nil" } } }), tail: { $: "Nil" } }, tail: { $: "Nil" } } } }));
}
function $updatenotice_busyNodes(_command_0, _output_0) {
  return $view_viewEl("div", { $: "Con", head: $view_attrClass("component-run"), tail: { $: "Con", head: $view_attrData("phase", "busy"), tail: { $: "Con", head: $view_attr("role", "group"), tail: { $: "Con", head: $view_attrAria("live", "polite"), tail: { $: "Nil" } } } } }, $view_viewJoin({ $: "Con", head: { $: "Con", head: $updatenotice_runLine($updatenotice_runningText(), _command_0), tail: { $: "Nil" } }, tail: { $: "Con", head: $updatenotice_outputNode(_output_0), tail: { $: "Nil" } } }));
}
function $updatenotice_doneNodes(_ok_0, _sentence_0, _output_0) {
  return $updatenotice_runPanel($updatenotice_donePhase(_ok_0), $view_viewJoin({ $: "Con", head: { $: "Con", head: $view_viewEl("p", { $: "Con", head: $view_attrClass("run-line run-result"), tail: { $: "Con", head: $view_attr("role", "status"), tail: { $: "Nil" } } }, { $: "Con", head: $view_viewText(_sentence_0), tail: { $: "Nil" } }), tail: { $: "Nil" } }, tail: { $: "Con", head: $updatenotice_outputNode(_output_0), tail: { $: "Con", head: { $: "Con", head: $view_viewEl("div", { $: "Con", head: $view_attrClass("run-actions"), tail: { $: "Nil" } }, { $: "Con", head: $updatenotice_runButton($updatenotice_closeLabel(), "CloseRun", "run-close"), tail: { $: "Nil" } }), tail: { $: "Nil" } }, tail: { $: "Nil" } } } }));
}
function $updatenotice_runNodes(_r_0) {
  if (_r_0.$ === "RunNone") {
    return { $: "Nil" };
  } else if (_r_0.$ === "RunConfirm") {
    const _command_0 = _r_0["command"];
    const _warning_0 = _r_0["warning"];
    return { $: "Con", head: $updatenotice_confirmNodes(_command_0, _warning_0), tail: { $: "Nil" } };
  } else if (_r_0.$ === "RunBusy") {
    const _command_1 = _r_0["command"];
    const _output_0 = _r_0["output"];
    return { $: "Con", head: $updatenotice_busyNodes(_command_1, _output_0), tail: { $: "Nil" } };
  } else {
    const _ok_0 = _r_0["ok"];
    const _sentence_0 = _r_0["sentence"];
    const _output_1 = _r_0["output"];
    return { $: "Con", head: $updatenotice_doneNodes(_ok_0, _sentence_0, _output_1), tail: { $: "Nil" } };
  }
}
function $textOr_if(_raw_0, _fallback_0, _empty_0) {
  if (_empty_0) {
    return _fallback_0;
  } else {
    return _raw_0;
  }
}
function $textOr(_raw_0, _fallback_0) {
  return $textOr_if(_raw_0, _fallback_0, $String_is_empty(_raw_0));
}
function $lastPartFrom(_m_0) {
  if (_m_0.$ === "None") {
    return "";
  } else {
    const _h_0 = _m_0["value"];
    return _h_0;
  }
}
function $lastPart(_xs_0) {
  return $lastPartFrom($List_last(_xs_0));
}
function $fileBase(_path_0) {
  return $lastPart($String_split($lastPart($String_split(_path_0, "/")), "\\"));
}
function $hintAttrs(_hint_0) {
  return $view_attrWhen($Bool_not($String_is_empty(_hint_0)), { $: "ViewAttr", name: "placeholder", value: _hint_0 });
}
function $valueAttr(_value_0) {
  return $view_attrWhen($Bool_not($String_is_empty(_value_0)), { $: "ViewAttr", name: "value", value: _value_0 });
}
function $labelAria(_label_0) {
  return $view_attrWhen($Bool_not($String_is_empty(_label_0)), $view_attrAria("label", _label_0));
}
function $textareaKids_if(_value_0, _empty_0) {
  if (_empty_0) {
    return { $: "Nil" };
  } else {
    return { $: "Con", head: $view_viewText(_value_0), tail: { $: "Nil" } };
  }
}
function $textareaKids(_value_0) {
  return $textareaKids_if(_value_0, $String_is_empty(_value_0));
}
function $optionNode(_selected_0, _o_0) {
  const _label_0 = _o_0["label"];
  const _value_0 = _o_0["value"];
  return $view_viewEl("option", $view_attrJoin({ $: "Con", head: { $: "Con", head: { $: "ViewAttr", name: "value", value: _value_0 }, tail: { $: "Nil" } }, tail: { $: "Con", head: $view_attrWhen($String_eq(_value_0, _selected_0), { $: "ViewAttr", name: "selected", value: "" }), tail: { $: "Nil" } } }), { $: "Con", head: $view_viewText(_label_0), tail: { $: "Nil" } });
}
function $optionNodes_go(_selected_0, _xs_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return { $: "Con", head: $optionNode(_selected_0, _h_0), tail: $optionNodes_go(_selected_0, _t_0) };
  }
}
function $optionNodes(_selected_0, _xs_0) {
  return $optionNodes_go(_selected_0, _xs_0);
}
function $fieldControl(_f_0) {
  if (_f_0.$ === "FieldText") {
    const _label_0 = _f_0["label"];
    const _value_0 = _f_0["value"];
    const _hint_0 = _f_0["hint"];
    return $view_viewEl("input", $view_attrJoin({ $: "Con", head: { $: "Con", head: $view_attrId("dialog-value"), tail: { $: "Con", head: $view_attrType("text"), tail: { $: "Nil" } } }, tail: { $: "Con", head: $labelAria(_label_0), tail: { $: "Con", head: $valueAttr(_value_0), tail: { $: "Con", head: $hintAttrs(_hint_0), tail: { $: "Nil" } } } } }), { $: "Nil" });
  } else if (_f_0.$ === "FieldEditor") {
    const _label_1 = _f_0["label"];
    const _value_1 = _f_0["value"];
    const _hint_1 = _f_0["hint"];
    return $view_viewEl("textarea", $view_attrJoin({ $: "Con", head: { $: "Con", head: $view_attrId("dialog-value"), tail: { $: "Nil" } }, tail: { $: "Con", head: $labelAria(_label_1), tail: { $: "Con", head: $hintAttrs(_hint_1), tail: { $: "Nil" } } } }), $textareaKids(_value_1));
  } else if (_f_0.$ === "FieldPick") {
    const _label_2 = _f_0["label"];
    const _value_2 = _f_0["value"];
    const _options_0 = _f_0["options"];
    return $view_viewEl("select", $view_attrJoin({ $: "Con", head: { $: "Con", head: $view_attrId("dialog-value"), tail: { $: "Nil" } }, tail: { $: "Con", head: $labelAria(_label_2), tail: { $: "Nil" } } }), $optionNodes(_value_2, _options_0));
  } else {
    const _label_3 = _f_0["label"];
    const _value_3 = _f_0["value"];
    const _on_0 = _f_0["on"];
    return $view_viewEl("label", { $: "Nil" }, { $: "Con", head: $view_viewEl("input", $view_attrJoin({ $: "Con", head: { $: "Con", head: $view_attrId("dialog-value"), tail: { $: "Con", head: $view_attrType("checkbox"), tail: { $: "Nil" } } }, tail: { $: "Con", head: $valueAttr(_value_3), tail: { $: "Con", head: $view_attrWhen(_on_0, { $: "ViewAttr", name: "checked", value: "" }), tail: { $: "Nil" } } } }), { $: "Nil" }), tail: { $: "Con", head: $view_viewText(_label_3), tail: { $: "Nil" } } });
  }
}
function $piFields(_fs_0) {
  if (_fs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _fs_0["head"];
    const _t_0 = _fs_0["tail"];
    return { $: "Con", head: $fieldControl(_h_0), tail: $piFields(_t_0) };
  }
}
function $piTitle(_raw_0) {
  return $textOr(_raw_0, $msg_msg("dialog.tutor"));
}
function $piMessage(_raw_0) {
  return _raw_0;
}
function $dialogOkLabel(_raw_0) {
  return $textOr(_raw_0, $msg_msg("dialog.continue"));
}
function $piOkNode(_label_0) {
  return $view_viewEl("button", { $: "Con", head: $view_attrId("dialog-ok"), tail: { $: "Con", head: $view_attr("value", "ok"), tail: { $: "Con", head: $view_attrClass("primary"), tail: { $: "Nil" } } } }, { $: "Con", head: $view_viewText($dialogOkLabel(_label_0)), tail: { $: "Nil" } });
}
function $endDayTitle() {
  return $msg_msg("dialogs.endDay.title");
}
function $endDayLead() {
  return $msg_msg("dialogs.endDay.lead");
}
function $endDayWhereLabel() {
  return $msg_msg("dialogs.endDay.where");
}
function $endDayNextLabel() {
  return $msg_msg("dialogs.endDay.next");
}
function $endDayCancelLabel() {
  return $msg_msg("common.cancel");
}
function $endDaySaveLabel() {
  return $msg_msg("dialogs.endDay.save");
}
function $endDayField(_id_0, _label_0, _value_0) {
  return $view_viewEl("label", { $: "Nil" }, { $: "Con", head: $view_viewText(_label_0), tail: { $: "Con", head: $view_viewEl("textarea", { $: "Con", head: $view_attrId(_id_0), tail: { $: "Con", head: $view_attr("rows", "2"), tail: { $: "Con", head: $view_attr("required", ""), tail: { $: "Nil" } } } }, $textareaKids(_value_0)), tail: { $: "Nil" } } });
}
function $endDayActions() {
  return $view_viewEl("div", { $: "Con", head: $view_attrClass("dialog-actions"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewEl("button", { $: "Con", head: $view_attr("value", "cancel"), tail: { $: "Con", head: $view_attr("formnovalidate", ""), tail: { $: "Nil" } } }, { $: "Con", head: $view_viewText($endDayCancelLabel()), tail: { $: "Nil" } }), tail: { $: "Con", head: $view_viewEl("button", { $: "Con", head: $view_attrId("end-day-save"), tail: { $: "Con", head: $view_attr("value", "ok"), tail: { $: "Con", head: $view_attrClass("primary"), tail: { $: "Nil" } } } }, { $: "Con", head: $view_viewText($endDaySaveLabel()), tail: { $: "Nil" } }), tail: { $: "Nil" } } });
}
function $endDayChildren(_whereText_0, _nextText_0) {
  return { $: "Con", head: $view_viewEl("h2", { $: "Nil" }, { $: "Con", head: $view_viewText($endDayTitle()), tail: { $: "Nil" } }), tail: { $: "Con", head: $view_viewEl("p", { $: "Con", head: $view_attrClass("help-lead"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText($endDayLead()), tail: { $: "Nil" } }), tail: { $: "Con", head: $endDayField("end-where", $endDayWhereLabel(), _whereText_0), tail: { $: "Con", head: $endDayField("end-next", $endDayNextLabel(), _nextText_0), tail: { $: "Con", head: $endDayActions(), tail: { $: "Nil" } } } } } };
}
function $bookmarkNameInput(_value_0) {
  return $view_viewEl("input", { $: "Con", head: $view_attrId("bookmark-name"), tail: { $: "Con", head: $view_attrType("text"), tail: { $: "Con", head: $view_attr("value", _value_0), tail: { $: "Con", head: $view_attr("required", ""), tail: { $: "Nil" } } } } }, { $: "Nil" });
}
function $bookmarkActions() {
  return $view_viewEl("div", { $: "Con", head: $view_attrClass("dialog-actions"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewEl("button", { $: "Con", head: $view_attr("value", "cancel"), tail: { $: "Con", head: $view_attr("formnovalidate", ""), tail: { $: "Nil" } } }, { $: "Con", head: $view_viewText($pdfnav_bookmarkCancelLabel()), tail: { $: "Nil" } }), tail: { $: "Con", head: $view_viewEl("button", { $: "Con", head: $view_attrId("bookmark-save"), tail: { $: "Con", head: $view_attr("value", "ok"), tail: { $: "Con", head: $view_attrClass("primary"), tail: { $: "Nil" } } } }, { $: "Con", head: $view_viewText($pdfnav_bookmarkSaveLabel()), tail: { $: "Nil" } }), tail: { $: "Nil" } } });
}
function $bookmarkChildren(_name_0, _hint_0) {
  return { $: "Con", head: $view_viewEl("h2", { $: "Nil" }, { $: "Con", head: $view_viewText($pdfnav_bookmarkDialogTitle()), tail: { $: "Nil" } }), tail: { $: "Con", head: $view_viewEl("p", { $: "Con", head: $view_attrClass("help-lead"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText(_hint_0), tail: { $: "Nil" } }), tail: { $: "Con", head: $view_viewEl("label", { $: "Nil" }, { $: "Con", head: $view_viewText($pdfnav_bookmarkNameLabel()), tail: { $: "Con", head: $bookmarkNameInput(_name_0), tail: { $: "Nil" } } }), tail: { $: "Con", head: $bookmarkActions(), tail: { $: "Nil" } } } } };
}
function $imageFallback() {
  return $msg_msg("dialogs.image.fallback");
}
function $imageTitle(_file_0) {
  return $textOr($fileBase(_file_0), $imageFallback());
}
function $imageTitleNode(_file_0) {
  return $view_viewText($imageTitle(_file_0));
}
function $imageCopyLabel() {
  return $msg_msg("common.copy");
}
function $imageOpenLabel() {
  return $msg_msg("dialogs.image.openPreview");
}
function $imageActions(_hasFile_0) {
  return { $: "Con", head: $view_viewEl("button", { $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_attrId("image-copy"), tail: { $: "Con", head: $view_attrOn("click", "ImageCopy"), tail: { $: "Nil" } } } }, { $: "Con", head: $view_viewText($imageCopyLabel()), tail: { $: "Nil" } }), tail: { $: "Con", head: $view_viewEl("button", $view_attrJoin({ $: "Con", head: { $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_attrId("image-open"), tail: { $: "Con", head: $view_attrOn("click", "ImageOpen"), tail: { $: "Nil" } } } }, tail: { $: "Con", head: $view_attrWhen($Bool_not(_hasFile_0), { $: "ViewAttr", name: "hidden", value: "" }), tail: { $: "Nil" } } }), { $: "Con", head: $view_viewText($imageOpenLabel()), tail: { $: "Nil" } }), tail: { $: "Nil" } } };
}
function $helpVersion_if(_version_0, _missing_0) {
  if (_missing_0) {
    return "";
  } else {
    return "Mesa de Estudos " + _version_0;
  }
}
function $helpVersion(_version_0) {
  return $helpVersion_if(_version_0, $String_is_empty(_version_0));
}
function $helpVersionNode(_version_0) {
  return $view_viewText($helpVersion(_version_0));
}
function $helpFlags(_studyContext_0, _endDay_0, _refsToggle_0, _conferir_0) {
  return { $: "HelpFlags", studyContext: _studyContext_0, endDay: _endDay_0, refsToggle: _refsToggle_0, conferir: _conferir_0 };
}
function $helpChrome(_version_0, _flags_0) {
  const _studyContext_0 = _flags_0["studyContext"];
  const _endDay_0 = _flags_0["endDay"];
  const _refsToggle_0 = _flags_0["refsToggle"];
  const _conferir_0 = _flags_0["conferir"];
  return { $: "HelpChrome", version: $helpVersion(_version_0), studyHidden: $Bool_not(_studyContext_0), endDayHidden: $Bool_not(_endDay_0), refsHidden: $Bool_not(_refsToggle_0), conferirHidden: $Bool_not(_conferir_0) };
}
function $aboutLead_if(_version_0, _missing_0) {
  if (_missing_0) {
    return "";
  } else {
    return $msg_msg1("about.lead", "version", _version_0);
  }
}
function $aboutLead(_version_0) {
  return $aboutLead_if(_version_0, $String_is_empty(_version_0));
}
function $aboutLeadNode(_version_0) {
  return $view_viewText($aboutLead(_version_0));
}
function $emptyCourse() {
  return { $: "SettingsCourse", id: "", name: "", path: "" };
}
function $courseRow(_course_0) {
  const _id_0 = _course_0["id"];
  const _name_0 = _course_0["name"];
  const _path_0 = _course_0["path"];
  return $view_viewEl("div", { $: "Con", head: $view_attrClass("cfg-course"), tail: { $: "Con", head: $view_attrData("id", _id_0), tail: { $: "Nil" } } }, { $: "Con", head: $view_viewEl("input", $view_attrJoin({ $: "Con", head: { $: "Con", head: $view_attrClass("cfg-name"), tail: { $: "Con", head: $view_attr("placeholder", $msg_msg("settings.course.nameColumn")), tail: { $: "Con", head: $view_attrAria("label", $msg_msg("settings.course.nameLabel")), tail: { $: "Nil" } } } }, tail: { $: "Con", head: $valueAttr(_name_0), tail: { $: "Nil" } } }), { $: "Nil" }), tail: { $: "Con", head: $view_viewEl("input", $view_attrJoin({ $: "Con", head: { $: "Con", head: $view_attrClass("cfg-path"), tail: { $: "Con", head: $view_attr("placeholder", $msg_msg("settings.course.folderColumn")), tail: { $: "Con", head: $view_attr("spellcheck", "false"), tail: { $: "Con", head: $view_attrAria("label", $msg_msg("settings.course.folderLabel")), tail: { $: "Nil" } } } } }, tail: { $: "Con", head: $valueAttr(_path_0), tail: { $: "Nil" } } }), { $: "Nil" }), tail: { $: "Con", head: $view_viewEl("button", { $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_attrClass("cfg-browse"), tail: { $: "Con", head: $view_attrOn("click", "BrowseCourse"), tail: { $: "Nil" } } } }, { $: "Con", head: $view_viewText($msg_msg("settings.course.choose")), tail: { $: "Nil" } }), tail: { $: "Con", head: $view_viewEl("button", { $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_attrClass("cfg-remove icon-btn"), tail: { $: "Con", head: $view_attrAria("label", $msg_msg("settings.course.remove")), tail: { $: "Con", head: $view_attrOn("click", "RemoveCourse"), tail: { $: "Nil" } } } } }, { $: "Con", head: $view_viewText("×"), tail: { $: "Nil" } }), tail: { $: "Nil" } } } } });
}
function $courseHead() {
  return $view_viewEl("div", { $: "Con", head: $view_attrClass("cfg-course-head"), tail: { $: "Con", head: $view_attrAria("hidden", "true"), tail: { $: "Nil" } } }, { $: "Con", head: $view_viewEl("span", { $: "Nil" }, { $: "Con", head: $view_viewText($msg_msg("settings.course.nameColumn")), tail: { $: "Nil" } }), tail: { $: "Con", head: $view_viewEl("span", { $: "Nil" }, { $: "Con", head: $view_viewText($msg_msg("settings.course.folderColumn")), tail: { $: "Nil" } }), tail: { $: "Nil" } } });
}
function $courseRows_go(_cs_0) {
  if (_cs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _cs_0["head"];
    const _t_0 = _cs_0["tail"];
    return { $: "Con", head: $courseRow(_h_0), tail: $courseRows_go(_t_0) };
  }
}
function $courseRows(_cs_0) {
  if (_cs_0.$ === "Nil") {
    return { $: "Con", head: $courseRow($emptyCourse()), tail: { $: "Nil" } };
  } else {
    const _h_0 = _cs_0["head"];
    const _t_0 = _cs_0["tail"];
    return { $: "Con", head: $courseRow(_h_0), tail: $courseRows_go(_t_0) };
  }
}
function $checkUpdateLabel() {
  return $msg_msg("update.check");
}
function $updateIdleText() {
  return $msg_msg("update.idle");
}
function $updateCheckingText() {
  return $msg_msg("update.checking");
}
function $updateNoneText() {
  return $msg_msg("update.none");
}
function $updateNoneRest_if(_current_0, _noChecked_0, _checked_0) {
  if (_noChecked_0) {
    return $msg_msg1("update.youAreOn", "version", _current_0);
  } else {
    return _checked_0;
  }
}
function $updateNoneRest(_current_0, _checked_0) {
  return $updateNoneRest_if(_current_0, $String_is_empty(_checked_0), _checked_0);
}
function $updateFailedText() {
  return $msg_msg("update.failed");
}
function $updateFailedRest() {
  return $msg_msg("update.failedRest");
}
function $updateReadyText(_version_0) {
  return $msg_msg1("update.ready", "version", _version_0);
}
function $updateNotesLabel() {
  return $msg_msg("update.notes");
}
function $updateApplyLabel() {
  return $msg_msg("update.apply");
}
function $updatePiLabel() {
  return $msg_msg("update.pi");
}
function $updateApplyingText() {
  return $msg_msg("update.applying");
}
function $updateDoneText(_version_0) {
  return $msg_msg1("update.done", "version", _version_0);
}
function $updateRecoveredText_if(_version_0, _reason_0, _emptyReason_0) {
  if (_emptyReason_0) {
    return $msg_msg1("update.recovered", "version", _version_0);
  } else {
    return $msg_msg2("update.recovered.reason", "version", _version_0, "reason", _reason_0);
  }
}
function $updateRecoveredText(_version_0, _reason_0) {
  return $updateRecoveredText_if(_version_0, _reason_0, $String_is_empty(_reason_0));
}
function $updateIncompleteText_if(_version_0, _reason_0, _emptyReason_0) {
  if (_emptyReason_0) {
    return $msg_msg1("update.incomplete", "version", _version_0);
  } else {
    return $msg_msg2("update.incomplete.reason", "version", _version_0, "reason", _reason_0);
  }
}
function $updateIncompleteText(_version_0, _reason_0) {
  return $updateIncompleteText_if(_version_0, _reason_0, $String_is_empty(_reason_0));
}
function $updateLogLabel() {
  return $msg_msg("update.log");
}
function $updateIcon(_kind_0, _glyph_0) {
  return $view_viewEl("span", { $: "Con", head: $view_attrClass("update-icon"), tail: { $: "Con", head: $view_attrData("state", _kind_0), tail: { $: "Con", head: $view_attrAria("hidden", "true"), tail: { $: "Nil" } } } }, { $: "Con", head: $view_viewText(_glyph_0), tail: { $: "Nil" } });
}
function $updateLineNode(_text_0) {
  return $view_viewEl("p", { $: "Con", head: $view_attrClass("update-text"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewEl("span", { $: "Con", head: $view_attrClass("update-main"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText(_text_0), tail: { $: "Nil" } }), tail: { $: "Nil" } });
}
function $updateLine2(_main_0, _rest_0) {
  return $view_viewEl("p", { $: "Con", head: $view_attrClass("update-text"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewEl("span", { $: "Con", head: $view_attrClass("update-main"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText(_main_0), tail: { $: "Nil" } }), tail: { $: "Con", head: $view_viewEl("span", { $: "Con", head: $view_attrClass("update-muted"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText(" "), tail: { $: "Con", head: $view_viewText(_rest_0), tail: { $: "Nil" } } }), tail: { $: "Nil" } } });
}
function $releaseNotesButton(_url_0) {
  return $view_viewEl("button", { $: "Con", head: $view_attrId("update-notes"), tail: { $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_attrOn("click", "OpenLink"), tail: { $: "Con", head: $view_attrData("url", _url_0), tail: { $: "Nil" } } } } }, { $: "Con", head: $view_viewText($updateNotesLabel()), tail: { $: "Nil" } });
}
function $updateLogButton() {
  return $view_viewEl("button", { $: "Con", head: $view_attrId("update-log"), tail: { $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_attrOn("click", "OpenLog"), tail: { $: "Nil" } } } }, { $: "Con", head: $view_viewText($updateLogLabel()), tail: { $: "Nil" } });
}
function $applyUpdateButton() {
  return $view_viewEl("button", { $: "Con", head: $view_attrId("update-apply"), tail: { $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_attrClass("primary"), tail: { $: "Con", head: $view_attrOn("click", "ApplyUpdate"), tail: { $: "Nil" } } } } }, { $: "Con", head: $view_viewText($updateApplyLabel()), tail: { $: "Nil" } });
}
function $applyingUpdateButton() {
  return $view_viewEl("button", { $: "Con", head: $view_attrId("update-apply"), tail: { $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_attrClass("primary"), tail: { $: "Con", head: $view_attrOn("click", "ApplyUpdate"), tail: { $: "Con", head: $view_attr("disabled", ""), tail: { $: "Nil" } } } } } }, { $: "Con", head: $view_viewText($updateApplyLabel()), tail: { $: "Nil" } });
}
function $checkUpdateButton() {
  return $view_viewEl("button", { $: "Con", head: $view_attrId("update-check"), tail: { $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_attrClass("icon-btn"), tail: { $: "Con", head: $view_attrAria("label", $checkUpdateLabel()), tail: { $: "Con", head: $view_attr("title", $checkUpdateLabel()), tail: { $: "Con", head: $view_attrOn("click", "CheckUpdate"), tail: { $: "Nil" } } } } } } }, { $: "Con", head: $view_viewText("↻"), tail: { $: "Nil" } });
}
function $updateReadyChildren(_version_0, _url_0) {
  return $view_viewJoin({ $: "Con", head: { $: "Con", head: $updateIcon("new", "↑"), tail: { $: "Nil" } }, tail: { $: "Con", head: { $: "Con", head: $updateLineNode($updateReadyText(_version_0)), tail: { $: "Nil" } }, tail: { $: "Con", head: $view_viewWhen($Bool_not($String_is_empty(_url_0)), $releaseNotesButton(_url_0)), tail: { $: "Con", head: { $: "Con", head: $applyUpdateButton(), tail: { $: "Nil" } }, tail: { $: "Nil" } } } } });
}
function $updateNotesNode(_notes_0) {
  return $view_viewEl("p", { $: "Con", head: $view_attrClass("update-notes"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText(_notes_0), tail: { $: "Nil" } });
}
function $aboutUpdateChildren(_s_0) {
  if (_s_0.$ === "UpdateIdle") {
    return { $: "Con", head: $updateIcon("idle", "↻"), tail: { $: "Con", head: $updateLineNode($updateIdleText()), tail: { $: "Con", head: $checkUpdateButton(), tail: { $: "Nil" } } } };
  } else if (_s_0.$ === "UpdateChecking") {
    return { $: "Con", head: $updateIcon("busy", "…"), tail: { $: "Con", head: $updateLineNode($updateCheckingText()), tail: { $: "Nil" } } };
  } else if (_s_0.$ === "UpdateNone") {
    const _current_0 = _s_0["current"];
    const _checked_0 = _s_0["checked"];
    return { $: "Con", head: $updateIcon("ok", "✓"), tail: { $: "Con", head: $updateLine2($updateNoneText(), $updateNoneRest(_current_0, _checked_0)), tail: { $: "Con", head: $checkUpdateButton(), tail: { $: "Nil" } } } };
  } else if (_s_0.$ === "UpdateReady") {
    const _version_0 = _s_0["version"];
    const _notes_0 = _s_0["notes"];
    const _url_0 = _s_0["url"];
    return $view_viewConcat($updateReadyChildren(_version_0, _url_0), $view_viewWhen($Bool_not($String_is_empty(_notes_0)), $updateNotesNode(_notes_0)));
  } else if (_s_0.$ === "UpdateFailed") {
    return { $: "Con", head: $updateIcon("warn", "!"), tail: { $: "Con", head: $updateLine2($updateFailedText(), $updateFailedRest()), tail: { $: "Con", head: $checkUpdateButton(), tail: { $: "Nil" } } } };
  } else if (_s_0.$ === "UpdateApplying") {
    return { $: "Con", head: $updateIcon("busy", "…"), tail: { $: "Con", head: $updateLineNode($updateApplyingText()), tail: { $: "Con", head: $applyingUpdateButton(), tail: { $: "Nil" } } } };
  } else if (_s_0.$ === "UpdateDone") {
    const _version_1 = _s_0["version"];
    return { $: "Con", head: $updateIcon("ok", "✓"), tail: { $: "Con", head: $updateLineNode($updateDoneText(_version_1)), tail: { $: "Con", head: $checkUpdateButton(), tail: { $: "Nil" } } } };
  } else if (_s_0.$ === "UpdateRecovered") {
    const _version_2 = _s_0["version"];
    const _reason_0 = _s_0["reason"];
    return { $: "Con", head: $updateIcon("warn", "!"), tail: { $: "Con", head: $updateLineNode($updateRecoveredText(_version_2, _reason_0)), tail: { $: "Con", head: $updateLogButton(), tail: { $: "Con", head: $checkUpdateButton(), tail: { $: "Nil" } } } } };
  } else {
    const _version_3 = _s_0["version"];
    const _reason_1 = _s_0["reason"];
    return { $: "Con", head: $updateIcon("warn", "!"), tail: { $: "Con", head: $updateLineNode($updateIncompleteText(_version_3, _reason_1)), tail: { $: "Con", head: $updateLogButton(), tail: { $: "Con", head: $checkUpdateButton(), tail: { $: "Nil" } } } } };
  }
}
function $componentIds() {
  return { $: "Con", head: "pi", tail: { $: "Con", head: "claude", tail: { $: "Con", head: "node", tail: { $: "Con", head: "xournal", tail: { $: "Nil" } } } } };
}
function $componentStateText(_s_0) {
  if (_s_0.$ === "CompOk") {
    return $msg_msg("component.ok");
  } else if (_s_0.$ === "CompUnknown") {
    return $msg_msg("component.unknown");
  } else if (_s_0.$ === "CompOffline") {
    return $updatenotice_offlineText();
  } else if (_s_0.$ === "CompOutdated") {
    const _latest_0 = _s_0["latest"];
    return $msg_msg1("component.outdated", "latest", _latest_0);
  } else if (_s_0.$ === "CompWarn") {
    const _note_0 = _s_0["note"];
    return _note_0;
  } else {
    return $msg_msg("component.checking");
  }
}
function $componentVersionText(_version_0) {
  return $textOr(_version_0, "—");
}
function $componentLinkLabel(_label_0) {
  return $textOr(_label_0, $msg_msg("component.openSite"));
}
function $nodeTooOld(_major_0, _minor_0) {
  const _x_0 = _major_0 < 22;
  const _x_1 = $Bool_and(_major_0 === 22, _minor_0 < 19);
  return _x_0 || _x_1;
}
function $nodeWarnText() {
  return $msg_msg("component.nodeTooOld");
}
function $nodeState_if(_old_0) {
  if (_old_0) {
    return { $: "CompWarn", note: $nodeWarnText() };
  } else {
    return { $: "CompOk" };
  }
}
function $nodeState(_major_0, _minor_0) {
  return $nodeState_if($nodeTooOld(_major_0, _minor_0));
}
function $updatePiButton() {
  return $updatenotice_localButton();
}
function $componentLinkButton(_url_0, _label_0) {
  return $view_viewEl("button", { $: "Con", head: $view_attrClass("component-link"), tail: { $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_attrOn("click", "OpenLink"), tail: { $: "Con", head: $view_attrData("url", _url_0), tail: { $: "Nil" } } } } }, { $: "Con", head: $view_viewText($componentLinkLabel(_label_0)), tail: { $: "Nil" } });
}
function $componentDot(_s_0) {
  if (_s_0.$ === "CompOk") {
    return "ok";
  } else if (_s_0.$ === "CompUnknown") {
    return "muted";
  } else if (_s_0.$ === "CompOffline") {
    return "muted";
  } else if (_s_0.$ === "CompOutdated") {
    return "new";
  } else if (_s_0.$ === "CompWarn") {
    return "warn";
  } else {
    return "busy";
  }
}
function $componentShowsHint(_s_0) {
  if (_s_0.$ === "CompOk") {
    return false;
  } else if (_s_0.$ === "CompChecking") {
    return false;
  } else if (_s_0.$ === "CompUnknown") {
    return true;
  } else if (_s_0.$ === "CompOffline") {
    return true;
  } else if (_s_0.$ === "CompOutdated") {
    return true;
  } else {
    return true;
  }
}
function $componentDescription_xournal(_isXournal_0) {
  if (_isXournal_0) {
    return $msg_msg("component.desc.xournal");
  } else {
    return "";
  }
}
function $componentDescription_node(_isNode_0, _isXournal_0) {
  if (_isNode_0) {
    return $msg_msg("component.desc.node");
  } else {
    return $componentDescription_xournal(_isXournal_0);
  }
}
function $componentDescription_claude(_isClaude_0, _isNode_0, _isXournal_0) {
  if (_isClaude_0) {
    return $msg_msg("component.desc.claude");
  } else {
    return $componentDescription_node(_isNode_0, _isXournal_0);
  }
}
function $componentDescription_pick(_isPi_0, _isClaude_0, _isNode_0, _isXournal_0) {
  if (_isPi_0) {
    return $msg_msg("component.desc.pi");
  } else {
    return $componentDescription_claude(_isClaude_0, _isNode_0, _isXournal_0);
  }
}
function $componentDescription(_id_0) {
  return $componentDescription_pick($String_eq(_id_0, "pi"), $String_eq(_id_0, "claude"), $String_eq(_id_0, "node"), $String_eq(_id_0, "xournal"));
}
function $componentHintNode(_parts_0) {
  return $view_viewEl("small", { $: "Con", head: $view_attrClass("component-hint"), tail: { $: "Nil" } }, _parts_0);
}
function $componentNote(_desc_0, _hint_0, _show_0) {
  return $view_viewJoin({ $: "Con", head: $view_viewWhen($Bool_not($String_is_empty(_desc_0)), $view_viewText(_desc_0)), tail: { $: "Con", head: $view_viewWhen($Bool_and(_show_0, $Bool_and($Bool_not($String_is_empty(_desc_0)), $Bool_not($String_is_empty(_hint_0)))), $view_viewText(" ")), tail: { $: "Con", head: $view_viewWhen($Bool_and(_show_0, $Bool_not($String_is_empty(_hint_0))), $view_viewText(_hint_0)), tail: { $: "Nil" } } } });
}
function $componentNoteNodes(_parts_0) {
  if (_parts_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _parts_0["head"];
    const _t_0 = _parts_0["tail"];
    return { $: "Con", head: $componentHintNode({ $: "Con", head: _h_0, tail: _t_0 }), tail: { $: "Nil" } };
  }
}
function $componentActions(_link_0, _label_0, _action_0) {
  return $view_viewEl("div", { $: "Con", head: $view_attrClass("component-actions"), tail: { $: "Nil" } }, $view_viewJoin({ $: "Con", head: $view_viewWhen($Bool_not($String_is_empty(_link_0)), $componentLinkButton(_link_0, _label_0)), tail: { $: "Con", head: $updatenotice_actionNodes(_action_0), tail: { $: "Nil" } } }));
}
function $componentAheadNode() {
  return $view_viewEl("span", { $: "Con", head: $view_attrClass("component-ahead"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText($updatenotice_aheadText()), tail: { $: "Nil" } });
}
function $componentHead(_label_0, _version_0, _state_0, _ahead_0) {
  return $view_viewEl("div", { $: "Con", head: $view_attrClass("component-head"), tail: { $: "Nil" } }, $view_viewJoin({ $: "Con", head: { $: "Con", head: $view_viewEl("span", { $: "Con", head: $view_attrClass("component-name"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText(_label_0), tail: { $: "Nil" } }), tail: { $: "Con", head: $view_viewEl("span", { $: "Con", head: $view_attrClass("component-version"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText($componentVersionText(_version_0)), tail: { $: "Nil" } }), tail: { $: "Con", head: $view_viewEl("span", { $: "Con", head: $view_attrClass("component-dot"), tail: { $: "Con", head: $view_attrData("state", $componentDot(_state_0)), tail: { $: "Con", head: $view_attrAria("hidden", "true"), tail: { $: "Nil" } } } }, { $: "Nil" }), tail: { $: "Con", head: $view_viewEl("span", { $: "Con", head: $view_attrClass("component-state"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText($componentStateText(_state_0)), tail: { $: "Nil" } }), tail: { $: "Nil" } } } } }, tail: { $: "Con", head: $view_viewWhen(_ahead_0, $componentAheadNode()), tail: { $: "Nil" } } }));
}
function $componentRowNode(_r_0) {
  const _id_0 = _r_0["id"];
  const _label_0 = _r_0["label"];
  const _version_0 = _r_0["version"];
  const _state_0 = _r_0["state"];
  const _hint_0 = _r_0["hint"];
  const _link_0 = _r_0["link"];
  const _linkLabel_0 = _r_0["linkLabel"];
  const _action_0 = _r_0["action"];
  const _ahead_0 = _r_0["ahead"];
  const _run_0 = _r_0["run"];
  const _x_0 = $Bool_not($String_is_empty(_link_0));
  const _x_1 = $updatenotice_hasAction(_action_0);
  return $view_viewEl("div", { $: "Con", head: $view_attrClass("component-row"), tail: { $: "Con", head: $view_attrData("id", _id_0), tail: { $: "Nil" } } }, $view_viewJoin({ $: "Con", head: { $: "Con", head: $view_viewEl("div", { $: "Con", head: $view_attrClass("component-main"), tail: { $: "Nil" } }, $view_viewJoin({ $: "Con", head: { $: "Con", head: $componentHead(_label_0, _version_0, _state_0, _ahead_0), tail: { $: "Nil" } }, tail: { $: "Con", head: $componentNoteNodes($componentNote($componentDescription(_id_0), _hint_0, $componentShowsHint(_state_0))), tail: { $: "Nil" } } })), tail: { $: "Nil" } }, tail: { $: "Con", head: $view_viewWhen(_x_0 || _x_1, $componentActions(_link_0, _linkLabel_0, _action_0)), tail: { $: "Con", head: $updatenotice_runNodes(_run_0), tail: { $: "Nil" } } } }));
}
function $componentRows_go(_rs_0) {
  if (_rs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _rs_0["head"];
    const _t_0 = _rs_0["tail"];
    return { $: "Con", head: $componentRowNode(_h_0), tail: $componentRows_go(_t_0) };
  }
}
function $componentRows(_rs_0) {
  return $componentRows_go(_rs_0);
}
function $courseList(_cs_0) {
  return { $: "Con", head: $courseHead(), tail: $courseRows(_cs_0) };
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
function $List_last(_xs_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "None" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return { $: "Some", value: $List_last_go(_t_0, _h_0) };
  }
}
function $String_split(_s_0, _sep_0) {
  if (_s_0 === "") {
    return { $: "Con", head: "", tail: { $: "Nil" } };
  } else {
    const _h_0 = _s_0.slice(0, char_len(_s_0));
    const _t_0 = _s_0.slice(char_len(_s_0));
    return $String_split_fin(_h_0, $String_split(_t_0, _sep_0), $Char_is_eq(_h_0, _sep_0));
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
function $List_last_go($0, $1) {
  for (;; ) {
    {
      const _xs_0 = $0;
      const _last_0 = $1;
      if (_xs_0.$ === "Nil") {
        return _last_0;
      } else {
        const _h_0 = _xs_0["head"];
        const _t_0 = _xs_0["tail"];
        $0 = _t_0;
        $1 = _h_0;
        continue;
      }
    }
  }
}
function $String_split_fin(_c_0, _r_0, _cut_0) {
  if (!_cut_0) {
    return $String_split_push(_c_0, _r_0);
  } else {
    return { $: "Con", head: "", tail: _r_0 };
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
function $String_split_push(_c_0, _ps_0) {
  if (_ps_0.$ === "Nil") {
    return { $: "Con", head: _c_0 + "", tail: { $: "Nil" } };
  } else {
    const _h_0 = _ps_0["head"];
    const _t_0 = _ps_0["tail"];
    return { $: "Con", head: _c_0 + _h_0, tail: _t_0 };
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
var dialogsview_default = {
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
  "updatenotice.isVer": run_lib((a0) => run_loop($updatenotice_isVer(a0)), 1),
  "updatenotice.tripleNewer": run_lib((a0, a1, a2, a3, a4, a5) => run_loop($updatenotice_tripleNewer(a0, a1, a2, a3, a4, a5)), 6),
  "updatenotice.verNewer": run_lib((a0, a1) => run_loop($updatenotice_verNewer(a0, a1)), 2),
  "updatenotice.verPick": run_lib((a0, a1, a2) => run_loop($updatenotice_verPick(a0, a1, a2)), 3),
  "updatenotice.verMax": run_lib((a0, a1) => run_loop($updatenotice_verMax(a0, a1)), 2),
  "updatenotice.emptyMemory": run_lib(() => run_loop($updatenotice_emptyMemory()), 0),
  "updatenotice.ignoredCovers": run_lib((a0, a1) => run_loop($updatenotice_ignoredCovers(a0, a1)), 2),
  "updatenotice.newerThanSeen": run_lib((a0, a1) => run_loop($updatenotice_newerThanSeen(a0, a1)), 2),
  "updatenotice.targetVersion": run_lib((a0, a1, a2) => run_loop($updatenotice_targetVersion(a0, a1, a2)), 3),
  "updatenotice.noticeFrom": run_lib((a0, a1, a2, a3, a4) => run_loop($updatenotice_noticeFrom(a0, a1, a2, a3, a4)), 5),
  "updatenotice.noticeOf": run_lib((a0, a1, a2, a3, a4) => run_loop($updatenotice_noticeOf(a0, a1, a2, a3, a4)), 5),
  "updatenotice.seenAfterOpen": run_lib((a0, a1, a2) => run_loop($updatenotice_seenAfterOpen(a0, a1, a2)), 3),
  "updatenotice.afterOpen": run_lib((a0, a1, a2) => run_loop($updatenotice_afterOpen(a0, a1, a2)), 3),
  "updatenotice.afterPostpone": run_lib((a0, a1) => run_loop($updatenotice_afterPostpone(a0, a1)), 2),
  "updatenotice.afterIgnore": run_lib((a0, a1) => run_loop($updatenotice_afterIgnore(a0, a1)), 2),
  "updatenotice.noticeText": run_lib((a0, a1) => str_out(run_loop($updatenotice_noticeText(str_in(a0), str_in(a1)))), 2),
  "updatenotice.aheadText": run_lib(() => str_out(run_loop($updatenotice_aheadText())), 0),
  "updatenotice.offlineText": run_lib(() => str_out(run_loop($updatenotice_offlineText())), 0),
  "updatenotice.remindLabel": run_lib(() => str_out(run_loop($updatenotice_remindLabel())), 0),
  "updatenotice.ignoreLabel": run_lib(() => str_out(run_loop($updatenotice_ignoreLabel())), 0),
  "updatenotice.updateLabel": run_lib(() => str_out(run_loop($updatenotice_updateLabel())), 0),
  "updatenotice.copyLabel": run_lib(() => str_out(run_loop($updatenotice_copyLabel())), 0),
  "updatenotice.cancelLabel": run_lib(() => str_out(run_loop($updatenotice_cancelLabel())), 0),
  "updatenotice.closeLabel": run_lib(() => str_out(run_loop($updatenotice_closeLabel())), 0),
  "updatenotice.waitHint": run_lib(() => str_out(run_loop($updatenotice_waitHint())), 0),
  "updatenotice.waitShort": run_lib(() => str_out(run_loop($updatenotice_waitShort())), 0),
  "updatenotice.settingsTitle": run_lib((a0) => str_out(run_loop($updatenotice_settingsTitle(a0))), 1),
  "updatenotice.aheadWarning": run_lib((a0, a1) => str_out(run_loop($updatenotice_aheadWarning(str_in(a0), str_in(a1)))), 2),
  "updatenotice.runningText": run_lib(() => str_out(run_loop($updatenotice_runningText())), 0),
  "updatenotice.willRunText": run_lib(() => str_out(run_loop($updatenotice_willRunText())), 0),
  "updatenotice.relinkedText": run_lib(() => str_out(run_loop($updatenotice_relinkedText())), 0),
  "updatenotice.doneSentence.same": run_lib((a0, a1) => str_out(run_loop($updatenotice_doneSentence_same(str_in(a0), str_in(a1)))), 2),
  "updatenotice.doneSentence.changed": run_lib((a0, a1, a2) => str_out(run_loop($updatenotice_doneSentence_changed(str_in(a0), str_in(a1), a2))), 3),
  "updatenotice.doneSentence.improved": run_lib((a0, a1, a2, a3, a4) => str_out(run_loop($updatenotice_doneSentence_improved(str_in(a0), str_in(a1), str_in(a2), a3, a4))), 5),
  "updatenotice.doneSentence.known": run_lib((a0, a1, a2, a3, a4, a5) => str_out(run_loop($updatenotice_doneSentence_known(str_in(a0), str_in(a1), str_in(a2), a3, a4, a5))), 6),
  "updatenotice.doneSentence.ok": run_lib((a0, a1, a2, a3, a4, a5) => str_out(run_loop($updatenotice_doneSentence_ok(str_in(a0), a1, a2, str_in(a3), str_in(a4), a5))), 6),
  "updatenotice.doneSentence": run_lib((a0, a1, a2, a3, a4, a5, a6) => str_out(run_loop($updatenotice_doneSentence(str_in(a0), a1, a2, a3, str_in(a4), str_in(a5), a6))), 7),
  "updatenotice.noticeIcon": run_lib(() => run_loop($updatenotice_noticeIcon()), 0),
  "updatenotice.noticeButton": run_lib((a0, a1, a2) => run_loop($updatenotice_noticeButton(str_in(a0), str_in(a1), str_in(a2))), 3),
  "updatenotice.noticeLineText": run_lib((a0, a1, a2) => run_loop($updatenotice_noticeLineText(str_in(a0), str_in(a1), a2)), 3),
  "updatenotice.noticeLineBody": run_lib((a0, a1, a2, a3, a4) => run_loop($updatenotice_noticeLineBody(str_in(a0), str_in(a1), str_in(a2), a3, a4)), 5),
  "updatenotice.noticeLineNode": run_lib((a0) => run_loop($updatenotice_noticeLineNode(a0)), 1),
  "updatenotice.noticeLines": run_lib((a0) => run_loop($updatenotice_noticeLines(a0)), 1),
  "updatenotice.showsNotice": run_lib((a0) => run_loop($updatenotice_showsNotice(a0)), 1),
  "updatenotice.seesLine": run_lib((a0, a1) => run_loop($updatenotice_seesLine(a0, a1)), 2),
  "updatenotice.seeAboutLabel": run_lib(() => str_out(run_loop($updatenotice_seeAboutLabel())), 0),
  "updatenotice.seeAboutButton": run_lib((a0) => run_loop($updatenotice_seeAboutButton(str_in(a0))), 1),
  "updatenotice.noticeLineFor": run_lib((a0, a1) => run_loop($updatenotice_noticeLineFor(a0, a1)), 2),
  "updatenotice.noticeLinesFor": run_lib((a0, a1) => run_loop($updatenotice_noticeLinesFor(a0, a1)), 2),
  "updatenotice.hasAction": run_lib((a0) => run_loop($updatenotice_hasAction(a0)), 1),
  "updatenotice.localButton": run_lib(() => run_loop($updatenotice_localButton()), 0),
  "updatenotice.askButton": run_lib((a0) => run_loop($updatenotice_askButton(str_in(a0))), 1),
  "updatenotice.waitNodes": run_lib(() => run_loop($updatenotice_waitNodes()), 0),
  "updatenotice.copyButton": run_lib((a0) => run_loop($updatenotice_copyButton(str_in(a0))), 1),
  "updatenotice.actionNodes": run_lib((a0) => run_loop($updatenotice_actionNodes(a0)), 1),
  "updatenotice.commandNode": run_lib((a0) => run_loop($updatenotice_commandNode(str_in(a0))), 1),
  "updatenotice.runLine": run_lib((a0, a1) => run_loop($updatenotice_runLine(str_in(a0), str_in(a1))), 2),
  "updatenotice.outputNode": run_lib((a0) => run_loop($updatenotice_outputNode(str_in(a0))), 1),
  "updatenotice.runButton": run_lib((a0, a1, a2) => run_loop($updatenotice_runButton(str_in(a0), str_in(a1), str_in(a2))), 3),
  "updatenotice.donePhase": run_lib((a0) => str_out(run_loop($updatenotice_donePhase(a0))), 1),
  "updatenotice.runPanel": run_lib((a0, a1) => run_loop($updatenotice_runPanel(str_in(a0), a1)), 2),
  "updatenotice.confirmNodes": run_lib((a0, a1) => run_loop($updatenotice_confirmNodes(str_in(a0), str_in(a1))), 2),
  "updatenotice.busyNodes": run_lib((a0, a1) => run_loop($updatenotice_busyNodes(str_in(a0), str_in(a1))), 2),
  "updatenotice.doneNodes": run_lib((a0, a1, a2) => run_loop($updatenotice_doneNodes(a0, str_in(a1), str_in(a2))), 3),
  "updatenotice.runNodes": run_lib((a0) => run_loop($updatenotice_runNodes(a0)), 1),
  "textOr.if": run_lib((a0, a1, a2) => str_out(run_loop($textOr_if(str_in(a0), str_in(a1), a2))), 3),
  textOr: run_lib((a0, a1) => str_out(run_loop($textOr(str_in(a0), str_in(a1)))), 2),
  lastPartFrom: run_lib((a0) => str_out(run_loop($lastPartFrom(a0))), 1),
  lastPart: run_lib((a0) => str_out(run_loop($lastPart(a0))), 1),
  fileBase: run_lib((a0) => str_out(run_loop($fileBase(str_in(a0)))), 1),
  hintAttrs: run_lib((a0) => run_loop($hintAttrs(str_in(a0))), 1),
  valueAttr: run_lib((a0) => run_loop($valueAttr(str_in(a0))), 1),
  labelAria: run_lib((a0) => run_loop($labelAria(str_in(a0))), 1),
  "textareaKids.if": run_lib((a0, a1) => run_loop($textareaKids_if(str_in(a0), a1)), 2),
  textareaKids: run_lib((a0) => run_loop($textareaKids(str_in(a0))), 1),
  optionNode: run_lib((a0, a1) => run_loop($optionNode(str_in(a0), a1)), 2),
  "optionNodes.go": run_lib((a0, a1) => run_loop($optionNodes_go(str_in(a0), a1)), 2),
  optionNodes: run_lib((a0, a1) => run_loop($optionNodes(str_in(a0), a1)), 2),
  fieldControl: run_lib((a0) => run_loop($fieldControl(a0)), 1),
  piFields: run_lib((a0) => run_loop($piFields(a0)), 1),
  piTitle: run_lib((a0) => str_out(run_loop($piTitle(str_in(a0)))), 1),
  piMessage: run_lib((a0) => str_out(run_loop($piMessage(str_in(a0)))), 1),
  dialogOkLabel: run_lib((a0) => str_out(run_loop($dialogOkLabel(str_in(a0)))), 1),
  piOkNode: run_lib((a0) => run_loop($piOkNode(str_in(a0))), 1),
  endDayTitle: run_lib(() => str_out(run_loop($endDayTitle())), 0),
  endDayLead: run_lib(() => str_out(run_loop($endDayLead())), 0),
  endDayWhereLabel: run_lib(() => str_out(run_loop($endDayWhereLabel())), 0),
  endDayNextLabel: run_lib(() => str_out(run_loop($endDayNextLabel())), 0),
  endDayCancelLabel: run_lib(() => str_out(run_loop($endDayCancelLabel())), 0),
  endDaySaveLabel: run_lib(() => str_out(run_loop($endDaySaveLabel())), 0),
  endDayField: run_lib((a0, a1, a2) => run_loop($endDayField(str_in(a0), str_in(a1), str_in(a2))), 3),
  endDayActions: run_lib(() => run_loop($endDayActions()), 0),
  endDayChildren: run_lib((a0, a1) => run_loop($endDayChildren(str_in(a0), str_in(a1))), 2),
  bookmarkNameInput: run_lib((a0) => run_loop($bookmarkNameInput(str_in(a0))), 1),
  bookmarkActions: run_lib(() => run_loop($bookmarkActions()), 0),
  bookmarkChildren: run_lib((a0, a1) => run_loop($bookmarkChildren(str_in(a0), str_in(a1))), 2),
  imageFallback: run_lib(() => str_out(run_loop($imageFallback())), 0),
  imageTitle: run_lib((a0) => str_out(run_loop($imageTitle(str_in(a0)))), 1),
  imageTitleNode: run_lib((a0) => run_loop($imageTitleNode(str_in(a0))), 1),
  imageCopyLabel: run_lib(() => str_out(run_loop($imageCopyLabel())), 0),
  imageOpenLabel: run_lib(() => str_out(run_loop($imageOpenLabel())), 0),
  imageActions: run_lib((a0) => run_loop($imageActions(a0)), 1),
  "helpVersion.if": run_lib((a0, a1) => str_out(run_loop($helpVersion_if(str_in(a0), a1))), 2),
  helpVersion: run_lib((a0) => str_out(run_loop($helpVersion(str_in(a0)))), 1),
  helpVersionNode: run_lib((a0) => run_loop($helpVersionNode(str_in(a0))), 1),
  helpFlags: run_lib((a0, a1, a2, a3) => run_loop($helpFlags(a0, a1, a2, a3)), 4),
  helpChrome: run_lib((a0, a1) => run_loop($helpChrome(str_in(a0), a1)), 2),
  "aboutLead.if": run_lib((a0, a1) => str_out(run_loop($aboutLead_if(str_in(a0), a1))), 2),
  aboutLead: run_lib((a0) => str_out(run_loop($aboutLead(str_in(a0)))), 1),
  aboutLeadNode: run_lib((a0) => run_loop($aboutLeadNode(str_in(a0))), 1),
  emptyCourse: run_lib(() => run_loop($emptyCourse()), 0),
  courseRow: run_lib((a0) => run_loop($courseRow(a0)), 1),
  courseHead: run_lib(() => run_loop($courseHead()), 0),
  "courseRows.go": run_lib((a0) => run_loop($courseRows_go(a0)), 1),
  courseRows: run_lib((a0) => run_loop($courseRows(a0)), 1),
  checkUpdateLabel: run_lib(() => str_out(run_loop($checkUpdateLabel())), 0),
  updateIdleText: run_lib(() => str_out(run_loop($updateIdleText())), 0),
  updateCheckingText: run_lib(() => str_out(run_loop($updateCheckingText())), 0),
  updateNoneText: run_lib(() => str_out(run_loop($updateNoneText())), 0),
  "updateNoneRest.if": run_lib((a0, a1, a2) => str_out(run_loop($updateNoneRest_if(str_in(a0), a1, str_in(a2)))), 3),
  updateNoneRest: run_lib((a0, a1) => str_out(run_loop($updateNoneRest(str_in(a0), str_in(a1)))), 2),
  updateFailedText: run_lib(() => str_out(run_loop($updateFailedText())), 0),
  updateFailedRest: run_lib(() => str_out(run_loop($updateFailedRest())), 0),
  updateReadyText: run_lib((a0) => str_out(run_loop($updateReadyText(str_in(a0)))), 1),
  updateNotesLabel: run_lib(() => str_out(run_loop($updateNotesLabel())), 0),
  updateApplyLabel: run_lib(() => str_out(run_loop($updateApplyLabel())), 0),
  updatePiLabel: run_lib(() => str_out(run_loop($updatePiLabel())), 0),
  updateApplyingText: run_lib(() => str_out(run_loop($updateApplyingText())), 0),
  updateDoneText: run_lib((a0) => str_out(run_loop($updateDoneText(str_in(a0)))), 1),
  "updateRecoveredText.if": run_lib((a0, a1, a2) => str_out(run_loop($updateRecoveredText_if(str_in(a0), str_in(a1), a2))), 3),
  updateRecoveredText: run_lib((a0, a1) => str_out(run_loop($updateRecoveredText(str_in(a0), str_in(a1)))), 2),
  "updateIncompleteText.if": run_lib((a0, a1, a2) => str_out(run_loop($updateIncompleteText_if(str_in(a0), str_in(a1), a2))), 3),
  updateIncompleteText: run_lib((a0, a1) => str_out(run_loop($updateIncompleteText(str_in(a0), str_in(a1)))), 2),
  updateLogLabel: run_lib(() => str_out(run_loop($updateLogLabel())), 0),
  updateIcon: run_lib((a0, a1) => run_loop($updateIcon(str_in(a0), str_in(a1))), 2),
  updateLineNode: run_lib((a0) => run_loop($updateLineNode(str_in(a0))), 1),
  updateLine2: run_lib((a0, a1) => run_loop($updateLine2(str_in(a0), str_in(a1))), 2),
  releaseNotesButton: run_lib((a0) => run_loop($releaseNotesButton(str_in(a0))), 1),
  updateLogButton: run_lib(() => run_loop($updateLogButton()), 0),
  applyUpdateButton: run_lib(() => run_loop($applyUpdateButton()), 0),
  applyingUpdateButton: run_lib(() => run_loop($applyingUpdateButton()), 0),
  checkUpdateButton: run_lib(() => run_loop($checkUpdateButton()), 0),
  updateReadyChildren: run_lib((a0, a1) => run_loop($updateReadyChildren(str_in(a0), str_in(a1))), 2),
  updateNotesNode: run_lib((a0) => run_loop($updateNotesNode(str_in(a0))), 1),
  aboutUpdateChildren: run_lib((a0) => run_loop($aboutUpdateChildren(a0)), 1),
  componentIds: run_lib(() => run_loop($componentIds()), 0),
  componentStateText: run_lib((a0) => str_out(run_loop($componentStateText(a0))), 1),
  componentVersionText: run_lib((a0) => str_out(run_loop($componentVersionText(str_in(a0)))), 1),
  componentLinkLabel: run_lib((a0) => str_out(run_loop($componentLinkLabel(str_in(a0)))), 1),
  nodeTooOld: run_lib((a0, a1) => run_loop($nodeTooOld(a0, a1)), 2),
  nodeWarnText: run_lib(() => str_out(run_loop($nodeWarnText())), 0),
  "nodeState.if": run_lib((a0) => run_loop($nodeState_if(a0)), 1),
  nodeState: run_lib((a0, a1) => run_loop($nodeState(a0, a1)), 2),
  updatePiButton: run_lib(() => run_loop($updatePiButton()), 0),
  componentLinkButton: run_lib((a0, a1) => run_loop($componentLinkButton(str_in(a0), str_in(a1))), 2),
  componentDot: run_lib((a0) => str_out(run_loop($componentDot(a0))), 1),
  componentShowsHint: run_lib((a0) => run_loop($componentShowsHint(a0)), 1),
  "componentDescription.xournal": run_lib((a0) => str_out(run_loop($componentDescription_xournal(a0))), 1),
  "componentDescription.node": run_lib((a0, a1) => str_out(run_loop($componentDescription_node(a0, a1))), 2),
  "componentDescription.claude": run_lib((a0, a1, a2) => str_out(run_loop($componentDescription_claude(a0, a1, a2))), 3),
  "componentDescription.pick": run_lib((a0, a1, a2, a3) => str_out(run_loop($componentDescription_pick(a0, a1, a2, a3))), 4),
  componentDescription: run_lib((a0) => str_out(run_loop($componentDescription(str_in(a0)))), 1),
  componentHintNode: run_lib((a0) => run_loop($componentHintNode(a0)), 1),
  componentNote: run_lib((a0, a1, a2) => run_loop($componentNote(str_in(a0), str_in(a1), a2)), 3),
  componentNoteNodes: run_lib((a0) => run_loop($componentNoteNodes(a0)), 1),
  componentActions: run_lib((a0, a1, a2) => run_loop($componentActions(str_in(a0), str_in(a1), a2)), 3),
  componentAheadNode: run_lib(() => run_loop($componentAheadNode()), 0),
  componentHead: run_lib((a0, a1, a2, a3) => run_loop($componentHead(str_in(a0), str_in(a1), a2, a3)), 4),
  componentRowNode: run_lib((a0) => run_loop($componentRowNode(a0)), 1),
  "componentRows.go": run_lib((a0) => run_loop($componentRows_go(a0)), 1),
  componentRows: run_lib((a0) => run_loop($componentRows(a0)), 1),
  courseList: run_lib((a0) => run_loop($courseList(a0)), 1)
};
export {
  dialogsview_default as default
};

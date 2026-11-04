// GERADO de core/talkview.bend por `bun core/build.mjs` — não editar à mão.
// core/talkview.bend
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
  if (!Number.isInteger(n) || n < 0 || n > 2 ** 53) {
    throw "bend: expected a Nat host number: an integer from 0 to 2^53";
  }
  return n;
}
function char_len(s, at = 0) {
  return s[at] === "\uDC00" ? 4 : s.codePointAt(at) > 65535 ? 2 : 1;
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
var io_file_append = new Set;
function $msg_mark() {
  return "";
}
function $msg_sep() {
  return "";
}
function $msg_pack(_parts_0) {
  const _x_0 = $$msg_mark();
  const _x_1 = $$String_join(_parts_0, $$msg_sep());
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
  return $String_starts_with(_s_0, $$msg_mark());
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
    return $view_attrGet_choose(_av_0, $$view_attrGet_go(_t_1, _name_0), $$String_eq(_an_0, _name_0));
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
  return { $: "ViewAttr", name: _name_0, value: $$view_boolStr(_on_0) };
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
  return $view_classAppend_empty(_acc_0, _name_0, $$String_is_empty(_acc_0));
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
    return $view_classNext_emptyName(_name_0, _acc_0, $$String_is_empty(_name_0));
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
        $1 = $$view_classNext_on(_name_0, _on_0, _acc_0);
        continue;
      }
    }
  }
}
function $view_classValue(_xs_0) {
  return $view_classValue_go(_xs_0, "");
}
function $view_classes(_xs_0) {
  return { $: "ViewAttr", name: "class", value: $$view_classValue(_xs_0) };
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
function $off(_on_0) {
  if (_on_0) {
    return false;
  } else {
    return true;
  }
}
function $roleName(_user_0) {
  if (_user_0) {
    return "user";
  } else {
    return "assistant";
  }
}
function $roleLabel(_user_0) {
  if (_user_0) {
    return $msg_msg("talk.you");
  } else {
    return "Pi";
  }
}
function $messageClasses(_user_0) {
  return { $: "Con", head: $$view_classOn("message", true), tail: { $: "Con", head: $$view_classOn("user", _user_0), tail: { $: "Con", head: $$view_classOn("assistant", $$off(_user_0)), tail: { $: "Nil" } } } };
}
function $messageAttrs(_user_0) {
  return { $: "Con", head: $$view_classes($$messageClasses(_user_0)), tail: { $: "Con", head: $$view_attrData("role", $$roleName(_user_0)), tail: { $: "Nil" } } };
}
function $roleNode(_label_0) {
  return $view_viewEl("div", { $: "Con", head: $$view_attrClass("role"), tail: { $: "Nil" } }, { $: "Con", head: $$view_viewText(_label_0), tail: { $: "Nil" } });
}
function $shot(_src_0) {
  return $view_viewEl("img", { $: "Con", head: $$view_attrClass("shot"), tail: { $: "Con", head: $$view_attr("src", _src_0), tail: { $: "Con", head: $$view_attr("alt", $$msg_msg("talk.imageSent")), tail: { $: "Con", head: $$view_attr("loading", "lazy"), tail: { $: "Con", head: $$view_attr("decoding", "async"), tail: { $: "Nil" } } } } } }, { $: "Nil" });
}
function $shotNodes(_xs_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return { $: "Con", head: $$shot(_h_0), tail: $$shotNodes(_t_0) };
  }
}
function $messageBody(_markup_0, _images_0) {
  return $view_viewEl("div", { $: "Con", head: $$view_attrClass("body"), tail: { $: "Nil" } }, { $: "Con", head: _markup_0, tail: $$shotNodes(_images_0) });
}
function $messageAction(_className_0, _label_0, _handler_0, _icon_0) {
  return $view_viewEl("button", { $: "Con", head: $$view_attrType("button"), tail: { $: "Con", head: $$view_attrClass(_className_0), tail: { $: "Con", head: $$view_attrAria("label", _label_0), tail: { $: "Con", head: $$view_attrTitle(_label_0), tail: { $: "Con", head: $$view_attrData("icon", _icon_0), tail: { $: "Con", head: $$view_attrOn("click", _handler_0), tail: { $: "Nil" } } } } } } }, { $: "Nil" });
}
function $messageActions(_canCopy_0, _canQuote_0, _canReview_0) {
  return $view_viewEl("div", { $: "Con", head: $$view_attrClass("message-actions"), tail: { $: "Nil" } }, $$view_viewJoin({ $: "Con", head: $$view_viewWhen(_canCopy_0, $$messageAction("msg-copy", $$msg_msg("talk.copy"), "CopyMessage", "copy")), tail: { $: "Con", head: $$view_viewWhen(_canQuote_0, $$messageAction("msg-quote", $$msg_msg("talk.quote"), "QuoteMessage", "textQuote")), tail: { $: "Con", head: $$view_viewWhen(_canReview_0, $$messageAction("msg-review", $$msg_msg("talk.review"), "SaveForReview", "bookmark")), tail: { $: "Nil" } } } }));
}
function $messageKids(_user_0, _markup_0, _images_0, _canCopy_0, _canQuote_0, _canReview_0) {
  return { $: "Con", head: $$roleNode($$roleLabel(_user_0)), tail: { $: "Con", head: $$messageBody(_markup_0, _images_0), tail: { $: "Con", head: $$messageActions(_canCopy_0, _canQuote_0, _canReview_0), tail: { $: "Nil" } } } };
}
function $message(_user_0, _markup_0, _images_0, _canCopy_0, _canQuote_0, _canReview_0) {
  return $view_viewEl("article", $$messageAttrs(_user_0), $$messageKids(_user_0, _markup_0, _images_0, _canCopy_0, _canQuote_0, _canReview_0));
}
function $assetImg_go(_src_0, _path_0, _alt_0) {
  return $view_viewEl("img", { $: "Con", head: $$view_attrClass("plot"), tail: { $: "Con", head: $$view_attr("src", _src_0), tail: { $: "Con", head: $$view_attrData("path", _path_0), tail: { $: "Con", head: $$view_attr("alt", _alt_0), tail: { $: "Con", head: $$view_attr("loading", "lazy"), tail: { $: "Con", head: $$view_attr("decoding", "async"), tail: { $: "Nil" } } } } } } }, { $: "Nil" });
}
function $assetCaption(_caption_0) {
  return $view_viewWhen($$Bool_not($$String_is_empty(_caption_0)), $$view_viewEl("figcaption", { $: "Nil" }, { $: "Con", head: $$view_viewText(_caption_0), tail: { $: "Nil" } }));
}
function $assetKids_go(_src_0, _path_0, _alt_0, _caption_0) {
  return $List_append({ $: "Con", head: $$assetImg_go(_src_0, _path_0, _alt_0), tail: { $: "Nil" } }, $$assetCaption(_caption_0));
}
function $assetKids(_row_0) {
  const _src_0 = _row_0["src"];
  const _path_0 = _row_0["path"];
  const _alt_0 = _row_0["alt"];
  const _caption_0 = _row_0["caption"];
  return $assetKids_go(_src_0, _path_0, _alt_0, _caption_0);
}
function $assetFigure_go(_src_0, _path_0, _alt_0, _caption_0) {
  return $view_viewEl("figure", { $: "Con", head: $$view_attrClass("asset"), tail: { $: "Nil" } }, $$assetKids_go(_src_0, _path_0, _alt_0, _caption_0));
}
function $assetFigure(_row_0) {
  const _src_0 = _row_0["src"];
  const _path_0 = _row_0["path"];
  const _alt_0 = _row_0["alt"];
  const _caption_0 = _row_0["caption"];
  return $assetFigure_go(_src_0, _path_0, _alt_0, _caption_0);
}
function $assetFallback(_source_0) {
  return $view_viewEl("code", { $: "Nil" }, { $: "Con", head: $$view_viewText(_source_0), tail: { $: "Nil" } });
}
function $codeCopy() {
  return $view_viewEl("button", { $: "Con", head: $$view_attrType("button"), tail: { $: "Con", head: $$view_attrClass("code-copy"), tail: { $: "Con", head: $$view_attrAria("label", $$msg_msg("talk.copyCode")), tail: { $: "Nil" } } } }, { $: "Con", head: $$view_viewText($$msg_msg("talk.copyShort")), tail: { $: "Nil" } });
}
function $codeHead_kids(_lang_0) {
  return $view_viewConcat($$view_viewWhen($$Bool_not($$String_is_empty(_lang_0)), $$view_viewEl("span", { $: "Con", head: $$view_attrClass("code-lang"), tail: { $: "Nil" } }, { $: "Con", head: $$view_viewText(_lang_0), tail: { $: "Nil" } })), { $: "Con", head: $$codeCopy(), tail: { $: "Nil" } });
}
function $codeHead(_lang_0) {
  return $view_viewEl("div", { $: "Con", head: $$view_attrClass("code-head"), tail: { $: "Nil" } }, $$codeHead_kids(_lang_0));
}
function $codeBlock_kids(_lang_0, _pre_0) {
  return { $: "Con", head: $$codeHead(_lang_0), tail: { $: "Con", head: _pre_0, tail: { $: "Nil" } } };
}
function $codeBlock(_pre_0, _lang_0) {
  return $view_viewEl("div", { $: "Con", head: $$view_attrClass("codeblock"), tail: { $: "Nil" } }, $$codeBlock_kids(_lang_0, _pre_0));
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
function $String_starts_with(_s_0, _p_0) {
  return $String_starts_with_go(_p_0, _s_0);
}
function $String_eq(_a_0, _b_0) {
  return $Cmp_is_eq($$String_order(_a_0, _b_0));
}
function $List_append(_xs_0, _ys_0) {
  if (_xs_0.$ === "Nil") {
    return _ys_0;
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return { $: "Con", head: _h_0, tail: $$List_append(_t_0, _ys_0) };
  }
}
function $List_concat(_xss_0) {
  if (_xss_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xss_0["head"];
    const _t_0 = _xss_0["tail"];
    return $List_append(_h_0, $$List_concat(_t_0));
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
    return { $: "Con", head: $$view_viewText(_h_0), tail: $$view_viewMap_0(_t_0) };
  }
}
function $view_viewMapI_go_0(_xs_0, _i_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return { $: "Con", head: $$view_asTextI(_i_0, _h_0), tail: $$view_viewMapI_go_0(_t_0, nat_chk(_i_0 + 1)) };
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
    const _x_0 = $$String_join_go(_t_0, _h2_0, _sep_0);
    const _x_1 = _sep_0 + _x_0;
    return _h_0 + _x_1;
  }
}
function $String_starts_with_go($0, $1, $2) {
  let $pc = 0;
  for (;; )
    switch ($pc) {
      case 0: {
        const _p_0 = $0;
        const _s_0 = $1;
        if (_p_0 === "") {
          return true;
        } else {
          const _y_0 = _p_0.slice(0, char_len(_p_0));
          const _yt_0 = _p_0.slice(char_len(_p_0));
          if (_s_0 === "") {
            return false;
          } else {
            const _x_0 = _s_0.slice(0, char_len(_s_0));
            const _xt_0 = _s_0.slice(char_len(_s_0));
            $0 = _yt_0;
            $1 = _xt_0;
            $2 = $$Char_is_eq(_x_0, _y_0);
            $pc = 1;
            continue;
          }
        }
      }
      case 1: {
        const _pt_0 = $0;
        const _t_0 = $1;
        const _same_0 = $2;
        if (!_same_0) {
          return false;
        } else {
          $0 = _pt_0;
          $1 = _t_0;
          $pc = 0;
          continue;
        }
      }
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
function $Char_is_eq(_a_0, _b_0) {
  const _x_0 = char_code(_a_0);
  const _y_0 = char_code(_b_0);
  return _x_0 === _y_0;
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
        const _x_0 = char_code(_t_1);
        const _t_2 = _a_0.slice(char_len(_a_0));
        if (_b_0 === "") {
          if (_c_0.$ === "EQ") {
            return { $: "GT" };
          } else {
            return _c_0;
          }
        } else {
          const _t_3 = _b_0.slice(0, char_len(_b_0));
          const _y_0 = char_code(_t_3);
          const _t2_0 = _b_0.slice(char_len(_b_0));
          if (_c_0.$ === "EQ") {
            $0 = _t_2;
            $1 = _t2_0;
            $2 = cmp_new(_x_0, _y_0);
            continue;
          } else {
            return _c_0;
          }
        }
      }
    }
  }
}
var $$msg_mark = $msg_mark;
var $$msg_sep = $msg_sep;
var $$String_join = $String_join;
var $$view_attrGet_go = $view_attrGet_go;
var $$String_eq = $String_eq;
var $$view_boolStr = $view_boolStr;
var $$String_is_empty = $String_is_empty;
var $$view_classNext_on = $view_classNext_on;
var $$view_classValue = $view_classValue;
var $$view_classOn = $view_classOn;
var $$off = $off;
var $$messageClasses = $messageClasses;
var $$view_classes = $view_classes;
var $$roleName = $roleName;
var $$view_attrData = $view_attrData;
var $$view_attrClass = $view_attrClass;
var $$view_viewText = $view_viewText;
var $$view_attr = $view_attr;
var $$msg_msg = $msg_msg;
var $$shot = $shot;
var $$shotNodes = $shotNodes;
var $$view_attrType = $view_attrType;
var $$view_attrAria = $view_attrAria;
var $$view_attrTitle = $view_attrTitle;
var $$view_attrOn = $view_attrOn;
var $$messageAction = $messageAction;
var $$view_viewWhen = $view_viewWhen;
var $$view_viewJoin = $view_viewJoin;
var $$roleLabel = $roleLabel;
var $$roleNode = $roleNode;
var $$messageBody = $messageBody;
var $$messageActions = $messageActions;
var $$messageAttrs = $messageAttrs;
var $$messageKids = $messageKids;
var $$Bool_not = $Bool_not;
var $$view_viewEl = $view_viewEl;
var $$assetImg_go = $assetImg_go;
var $$assetCaption = $assetCaption;
var $$assetKids_go = $assetKids_go;
var $$codeCopy = $codeCopy;
var $$codeHead_kids = $codeHead_kids;
var $$codeHead = $codeHead;
var $$codeBlock_kids = $codeBlock_kids;
var $$String_order = $String_order;
var $$List_append = $List_append;
var $$List_concat = $List_concat;
var $$view_viewMap_0 = $view_viewMap_0;
var $$view_asTextI = $view_asTextI;
var $$view_viewMapI_go_0 = $view_viewMapI_go_0;
var $$String_join_go = $String_join_go;
var $$Char_is_eq = $Char_is_eq;
var talkview_default = {
  "msg:mark": run_lib(() => str_out(run_loop($msg_mark())), 0),
  "msg:sep": run_lib(() => str_out(run_loop($msg_sep())), 0),
  "msg:pack": run_lib((a0) => str_out(run_loop($msg_pack(a0))), 1),
  "msg:msg": run_lib((a0) => str_out(run_loop($msg_msg(str_in(a0)))), 1),
  "msg:msg1": run_lib((a0, a1, a2) => str_out(run_loop($msg_msg1(str_in(a0), str_in(a1), str_in(a2)))), 3),
  "msg:msg2": run_lib((a0, a1, a2, a3, a4) => str_out(run_loop($msg_msg2(str_in(a0), str_in(a1), str_in(a2), str_in(a3), str_in(a4)))), 5),
  "msg:msg3": run_lib((a0, a1, a2, a3, a4, a5, a6) => str_out(run_loop($msg_msg3(str_in(a0), str_in(a1), str_in(a2), str_in(a3), str_in(a4), str_in(a5), str_in(a6)))), 7),
  "msg:msg4": run_lib((a0, a1, a2, a3, a4, a5, a6, a7, a8) => str_out(run_loop($msg_msg4(str_in(a0), str_in(a1), str_in(a2), str_in(a3), str_in(a4), str_in(a5), str_in(a6), str_in(a7), str_in(a8)))), 9),
  "msg:isMsg": run_lib((a0) => run_loop($msg_isMsg(str_in(a0))), 1),
  "view:attr": run_lib((a0, a1) => run_loop($view_attr(str_in(a0), str_in(a1))), 2),
  "view:classOn": run_lib((a0, a1) => run_loop($view_classOn(str_in(a0), a1)), 2),
  "view:viewEl": run_lib((a0, a1, a2) => run_loop($view_viewEl(str_in(a0), a1, a2)), 3),
  "view:viewText": run_lib((a0) => run_loop($view_viewText(str_in(a0))), 1),
  "view:viewKey": run_lib((a0, a1, a2, a3) => run_loop($view_viewKey(str_in(a0), str_in(a1), a2, a3)), 4),
  "view:tagOf": run_lib((a0) => str_out(run_loop($view_tagOf(a0))), 1),
  "view:attrsOf": run_lib((a0) => run_loop($view_attrsOf(a0)), 1),
  "view:kidsOf": run_lib((a0) => run_loop($view_kidsOf(a0)), 1),
  "view:textOf": run_lib((a0) => str_out(run_loop($view_textOf(a0))), 1),
  "view:isText": run_lib((a0) => run_loop($view_isText(a0)), 1),
  "view:attrGet.choose": run_lib((a0, a1, a2) => run_loop($view_attrGet_choose(str_in(a0), a1, a2)), 3),
  "view:attrGet.go": run_lib((a0, a1) => run_loop($view_attrGet_go(a0, str_in(a1))), 2),
  "view:attrGet": run_lib((a0, a1) => run_loop($view_attrGet(a0, str_in(a1))), 2),
  "view:attrWhen": run_lib((a0, a1) => run_loop($view_attrWhen(a0, a1)), 2),
  "view:attrConcat": run_lib((a0, a1) => run_loop($view_attrConcat(a0, a1)), 2),
  "view:attrJoin": run_lib((a0) => run_loop($view_attrJoin(a0)), 1),
  "view:attrId": run_lib((a0) => run_loop($view_attrId(str_in(a0))), 1),
  "view:attrClass": run_lib((a0) => run_loop($view_attrClass(str_in(a0))), 1),
  "view:attrType": run_lib((a0) => run_loop($view_attrType(str_in(a0))), 1),
  "view:attrTitle": run_lib((a0) => run_loop($view_attrTitle(str_in(a0))), 1),
  "view:attrKey": run_lib((a0) => run_loop($view_attrKey(str_in(a0))), 1),
  "view:attrOn": run_lib((a0, a1) => run_loop($view_attrOn(str_in(a0), str_in(a1))), 2),
  "view:attrData": run_lib((a0, a1) => run_loop($view_attrData(str_in(a0), str_in(a1))), 2),
  "view:attrAria": run_lib((a0, a1) => run_loop($view_attrAria(str_in(a0), str_in(a1))), 2),
  "view:boolStr": run_lib((a0) => str_out(run_loop($view_boolStr(a0))), 1),
  "view:attrBool": run_lib((a0, a1) => run_loop($view_attrBool(str_in(a0), a1)), 2),
  "view:classAppend.empty": run_lib((a0, a1, a2) => str_out(run_loop($view_classAppend_empty(str_in(a0), str_in(a1), a2))), 3),
  "view:classAppend": run_lib((a0, a1) => str_out(run_loop($view_classAppend(str_in(a0), str_in(a1)))), 2),
  "view:classNext.emptyName": run_lib((a0, a1, a2) => str_out(run_loop($view_classNext_emptyName(str_in(a0), str_in(a1), a2))), 3),
  "view:classNext.on": run_lib((a0, a1, a2) => str_out(run_loop($view_classNext_on(str_in(a0), a1, str_in(a2)))), 3),
  "view:classValue.go": run_lib((a0, a1) => str_out(run_loop($view_classValue_go(a0, str_in(a1)))), 2),
  "view:classValue": run_lib((a0) => str_out(run_loop($view_classValue(a0))), 1),
  "view:classes": run_lib((a0) => run_loop($view_classes(a0)), 1),
  "view:viewWhen": run_lib((a0, a1) => run_loop($view_viewWhen(a0, a1)), 2),
  "view:viewWhenAll": run_lib((a0, a1) => run_loop($view_viewWhenAll(a0, a1)), 2),
  "view:viewConcat": run_lib((a0, a1) => run_loop($view_viewConcat(a0, a1)), 2),
  "view:viewJoin": run_lib((a0) => run_loop($view_viewJoin(a0)), 1),
  "view:viewMapText": run_lib((a0) => run_loop($view_viewMapText(a0)), 1),
  "view:asTextI": run_lib((a0, a1) => run_loop($view_asTextI(nat_in(a0), str_in(a1))), 2),
  "view:viewMapTextI.go": run_lib((a0, a1) => run_loop($view_viewMapTextI_go(a0, nat_in(a1))), 2),
  "view:viewMapTextI": run_lib((a0) => run_loop($view_viewMapTextI(a0)), 1),
  off: run_lib((a0) => run_loop($off(a0)), 1),
  roleName: run_lib((a0) => str_out(run_loop($roleName(a0))), 1),
  roleLabel: run_lib((a0) => str_out(run_loop($roleLabel(a0))), 1),
  messageClasses: run_lib((a0) => run_loop($messageClasses(a0)), 1),
  messageAttrs: run_lib((a0) => run_loop($messageAttrs(a0)), 1),
  roleNode: run_lib((a0) => run_loop($roleNode(str_in(a0))), 1),
  shot: run_lib((a0) => run_loop($shot(str_in(a0))), 1),
  shotNodes: run_lib((a0) => run_loop($shotNodes(a0)), 1),
  messageBody: run_lib((a0, a1) => run_loop($messageBody(a0, a1)), 2),
  messageAction: run_lib((a0, a1, a2, a3) => run_loop($messageAction(str_in(a0), str_in(a1), str_in(a2), str_in(a3))), 4),
  messageActions: run_lib((a0, a1, a2) => run_loop($messageActions(a0, a1, a2)), 3),
  messageKids: run_lib((a0, a1, a2, a3, a4, a5) => run_loop($messageKids(a0, a1, a2, a3, a4, a5)), 6),
  message: run_lib((a0, a1, a2, a3, a4, a5) => run_loop($message(a0, a1, a2, a3, a4, a5)), 6),
  "assetImg.go": run_lib((a0, a1, a2) => run_loop($assetImg_go(str_in(a0), str_in(a1), str_in(a2))), 3),
  assetCaption: run_lib((a0) => run_loop($assetCaption(str_in(a0))), 1),
  "assetKids.go": run_lib((a0, a1, a2, a3) => run_loop($assetKids_go(str_in(a0), str_in(a1), str_in(a2), str_in(a3))), 4),
  assetKids: run_lib((a0) => run_loop($assetKids(a0)), 1),
  "assetFigure.go": run_lib((a0, a1, a2, a3) => run_loop($assetFigure_go(str_in(a0), str_in(a1), str_in(a2), str_in(a3))), 4),
  assetFigure: run_lib((a0) => run_loop($assetFigure(a0)), 1),
  assetFallback: run_lib((a0) => run_loop($assetFallback(str_in(a0))), 1),
  codeCopy: run_lib(() => run_loop($codeCopy()), 0),
  "codeHead.kids": run_lib((a0) => run_loop($codeHead_kids(str_in(a0))), 1),
  codeHead: run_lib((a0) => run_loop($codeHead(str_in(a0))), 1),
  "codeBlock.kids": run_lib((a0, a1) => run_loop($codeBlock_kids(str_in(a0), a1)), 2),
  codeBlock: run_lib((a0, a1) => run_loop($codeBlock(a0, str_in(a1))), 2)
};
export {
  talkview_default as default
};

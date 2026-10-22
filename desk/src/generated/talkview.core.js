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
  return { $: "Con", head: $view_classOn("message", true), tail: { $: "Con", head: $view_classOn("user", _user_0), tail: { $: "Con", head: $view_classOn("assistant", $off(_user_0)), tail: { $: "Nil" } } } };
}
function $messageAttrs(_user_0) {
  return { $: "Con", head: $view_classes($messageClasses(_user_0)), tail: { $: "Con", head: $view_attrData("role", $roleName(_user_0)), tail: { $: "Nil" } } };
}
function $roleNode(_label_0) {
  return $view_viewEl("div", { $: "Con", head: $view_attrClass("role"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText(_label_0), tail: { $: "Nil" } });
}
function $shot(_src_0) {
  return $view_viewEl("img", { $: "Con", head: $view_attrClass("shot"), tail: { $: "Con", head: $view_attr("src", _src_0), tail: { $: "Con", head: $view_attr("alt", $msg_msg("talk.imageSent")), tail: { $: "Con", head: $view_attr("loading", "lazy"), tail: { $: "Con", head: $view_attr("decoding", "async"), tail: { $: "Nil" } } } } } }, { $: "Nil" });
}
function $shotNodes(_xs_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return { $: "Con", head: $shot(_h_0), tail: $shotNodes(_t_0) };
  }
}
function $messageBody(_markup_0, _images_0) {
  return $view_viewEl("div", { $: "Con", head: $view_attrClass("body"), tail: { $: "Nil" } }, { $: "Con", head: _markup_0, tail: $shotNodes(_images_0) });
}
function $messageAction(_className_0, _label_0, _handler_0) {
  return $view_viewEl("button", { $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_attrClass(_className_0), tail: { $: "Con", head: $view_attrOn("click", _handler_0), tail: { $: "Nil" } } } }, { $: "Con", head: $view_viewText(_label_0), tail: { $: "Nil" } });
}
function $messageActions(_canCopy_0, _canQuote_0, _canReview_0) {
  return $view_viewJoin({ $: "Con", head: $view_viewWhen(_canCopy_0, $messageAction("msg-copy", $msg_msg("talk.copy"), "CopyMessage")), tail: { $: "Con", head: $view_viewWhen(_canQuote_0, $messageAction("msg-quote", $msg_msg("talk.quote"), "QuoteMessage")), tail: { $: "Con", head: $view_viewWhen(_canReview_0, $messageAction("msg-review", $msg_msg("talk.review"), "SaveForReview")), tail: { $: "Nil" } } } });
}
function $messageKids(_user_0, _markup_0, _images_0, _canCopy_0, _canQuote_0, _canReview_0) {
  return $view_viewConcat({ $: "Con", head: $roleNode($roleLabel(_user_0)), tail: { $: "Con", head: $messageBody(_markup_0, _images_0), tail: { $: "Nil" } } }, $messageActions(_canCopy_0, _canQuote_0, _canReview_0));
}
function $message(_user_0, _markup_0, _images_0, _canCopy_0, _canQuote_0, _canReview_0) {
  return $view_viewEl("article", $messageAttrs(_user_0), $messageKids(_user_0, _markup_0, _images_0, _canCopy_0, _canQuote_0, _canReview_0));
}
function $assetImg_go(_src_0, _path_0, _alt_0) {
  return $view_viewEl("img", { $: "Con", head: $view_attrClass("plot"), tail: { $: "Con", head: $view_attr("src", _src_0), tail: { $: "Con", head: $view_attrData("path", _path_0), tail: { $: "Con", head: $view_attr("alt", _alt_0), tail: { $: "Con", head: $view_attr("loading", "lazy"), tail: { $: "Con", head: $view_attr("decoding", "async"), tail: { $: "Nil" } } } } } } }, { $: "Nil" });
}
function $assetCaption(_caption_0) {
  return $view_viewWhen($Bool_not($String_is_empty(_caption_0)), $view_viewEl("figcaption", { $: "Nil" }, { $: "Con", head: $view_viewText(_caption_0), tail: { $: "Nil" } }));
}
function $assetKids_go(_src_0, _path_0, _alt_0, _caption_0) {
  return $List_append({ $: "Con", head: $assetImg_go(_src_0, _path_0, _alt_0), tail: { $: "Nil" } }, $assetCaption(_caption_0));
}
function $assetKids(_row_0) {
  const _src_0 = _row_0["src"];
  const _path_0 = _row_0["path"];
  const _alt_0 = _row_0["alt"];
  const _caption_0 = _row_0["caption"];
  return $assetKids_go(_src_0, _path_0, _alt_0, _caption_0);
}
function $assetFigure_go(_src_0, _path_0, _alt_0, _caption_0) {
  return $view_viewEl("figure", { $: "Con", head: $view_attrClass("asset"), tail: { $: "Nil" } }, $assetKids_go(_src_0, _path_0, _alt_0, _caption_0));
}
function $assetFigure(_row_0) {
  const _src_0 = _row_0["src"];
  const _path_0 = _row_0["path"];
  const _alt_0 = _row_0["alt"];
  const _caption_0 = _row_0["caption"];
  return $assetFigure_go(_src_0, _path_0, _alt_0, _caption_0);
}
function $assetFallback(_source_0) {
  return $view_viewEl("code", { $: "Nil" }, { $: "Con", head: $view_viewText(_source_0), tail: { $: "Nil" } });
}
function $codeCopy() {
  return $view_viewEl("button", { $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_attrClass("code-copy"), tail: { $: "Con", head: $view_attrAria("label", $msg_msg("talk.copyCode")), tail: { $: "Nil" } } } }, { $: "Con", head: $view_viewText($msg_msg("talk.copyShort")), tail: { $: "Nil" } });
}
function $codeBlock_kids(_lang_0, _pre_0) {
  return $view_viewConcat($view_viewWhen($Bool_not($String_is_empty(_lang_0)), $view_viewEl("span", { $: "Con", head: $view_attrClass("code-lang"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText(_lang_0), tail: { $: "Nil" } })), { $: "Con", head: $codeCopy(), tail: { $: "Con", head: _pre_0, tail: { $: "Nil" } } });
}
function $codeBlock(_pre_0, _lang_0) {
  return $view_viewEl("div", { $: "Con", head: $view_attrClass("codeblock"), tail: { $: "Nil" } }, $codeBlock_kids(_lang_0, _pre_0));
}
function $quizRole(_multi_0) {
  if (_multi_0) {
    return $msg_msg("talk.quizMulti");
  } else {
    return $msg_msg("talk.quiz");
  }
}
function $quizAria(_multi_0) {
  if (_multi_0) {
    return $msg_msg("talk.quizMultiAria");
  } else {
    return $msg_msg("talk.quizAria");
  }
}
function $optionRole(_multi_0) {
  if (_multi_0) {
    return "checkbox";
  } else {
    return "radio";
  }
}
function $optionsRole(_multi_0) {
  if (_multi_0) {
    return "group";
  } else {
    return "radiogroup";
  }
}
function $optionClasses(_correct_0, _wrong_0, _dim_0) {
  return { $: "Con", head: $view_classOn("quiz-option", true), tail: { $: "Con", head: $view_classOn("correct", _correct_0), tail: { $: "Con", head: $view_classOn("wrong", _wrong_0), tail: { $: "Con", head: $view_classOn("dim", _dim_0), tail: { $: "Nil" } } } } };
}
function $optionAttrs(_label_0, _index_0, _multi_0, _checked_0, _disabled_0, _correct_0, _wrong_0, _dim_0) {
  return $view_attrJoin({ $: "Con", head: { $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_classes($optionClasses(_correct_0, _wrong_0, _dim_0)), tail: { $: "Con", head: $view_attrKey($String_join({ $: "Con", head: "quiz-option-", tail: { $: "Con", head: _index_0, tail: { $: "Nil" } } }, "")), tail: { $: "Con", head: $view_attrData("label", _label_0), tail: { $: "Con", head: $view_attrData("index", _index_0), tail: { $: "Con", head: $view_attr("role", $optionRole(_multi_0)), tail: { $: "Con", head: $view_attrAria("checked", $view_boolStr(_checked_0)), tail: { $: "Nil" } } } } } } } }, tail: { $: "Con", head: $view_attrWhen(_disabled_0, $view_attr("disabled", "")), tail: { $: "Con", head: { $: "Con", head: $view_attrOn("click", "SelectQuizOption"), tail: { $: "Nil" } }, tail: { $: "Nil" } } } });
}
function $markKids(_mark_0) {
  return $view_viewWhen($Bool_not($String_is_empty(_mark_0)), $view_viewEl("span", { $: "Con", head: $view_attrClass("quiz-mark"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText(_mark_0), tail: { $: "Nil" } }));
}
function $quizOption_go(_label_0, _index_0, _markup_0, _checked_0, _disabled_0, _correct_0, _wrong_0, _dim_0, _mark_0, _multi_0) {
  return $view_viewEl("button", $optionAttrs(_label_0, _index_0, _multi_0, _checked_0, _disabled_0, _correct_0, _wrong_0, _dim_0), $view_viewConcat({ $: "Con", head: $view_viewEl("span", { $: "Nil" }, { $: "Con", head: $view_viewText($String_join({ $: "Con", head: _index_0, tail: { $: "Con", head: ". ", tail: { $: "Nil" } } }, "")), tail: { $: "Con", head: _markup_0, tail: { $: "Nil" } } }), tail: { $: "Nil" } }, $markKids(_mark_0)));
}
function $quizOption(_row_0, _multi_0) {
  const _label_0 = _row_0["label"];
  const _index_0 = _row_0["index"];
  const _markup_0 = _row_0["markup"];
  const _checked_0 = _row_0["checked"];
  const _disabled_0 = _row_0["disabled"];
  const _correct_0 = _row_0["correct"];
  const _wrong_0 = _row_0["wrong"];
  const _dim_0 = _row_0["dim"];
  const _mark_0 = _row_0["mark"];
  return $quizOption_go(_label_0, _index_0, _markup_0, _checked_0, _disabled_0, _correct_0, _wrong_0, _dim_0, _mark_0, _multi_0);
}
function $quizOptions(_xs_0, _multi_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return { $: "Con", head: $quizOption(_h_0, _multi_0), tail: $quizOptions(_t_0, _multi_0) };
  }
}
function $quizQuestion(_markup_0) {
  return $view_viewEl("div", { $: "Con", head: $view_attrClass("quiz-question"), tail: { $: "Nil" } }, { $: "Con", head: _markup_0, tail: { $: "Nil" } });
}
function $quizDetails(_has_0, _markup_0) {
  return $view_viewWhen(_has_0, $view_viewEl("div", { $: "Con", head: $view_attrClass("quiz-details"), tail: { $: "Nil" } }, { $: "Con", head: _markup_0, tail: { $: "Nil" } }));
}
function $quizOptionsBox(_multi_0, _options_0) {
  return $view_viewEl("div", { $: "Con", head: $view_attrClass("quiz-options"), tail: { $: "Con", head: $view_attr("role", $optionsRole(_multi_0)), tail: { $: "Con", head: $view_attrAria("label", $msg_msg("talk.quizOptionsAria")), tail: { $: "Nil" } } } }, $quizOptions(_options_0, _multi_0));
}
function $sendButton(_disabled_0) {
  return $view_viewEl("button", $view_attrConcat({ $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_attrClass("quiz-send primary"), tail: { $: "Con", head: $view_attrKey("quiz-send"), tail: { $: "Con", head: $view_attrOn("click", "SendQuiz"), tail: { $: "Nil" } } } } }, $view_attrWhen(_disabled_0, $view_attr("disabled", ""))), { $: "Con", head: $view_viewText($msg_msg("talk.quizSend")), tail: { $: "Nil" } });
}
function $skipButton() {
  return $view_viewEl("button", { $: "Con", head: $view_attrType("button"), tail: { $: "Con", head: $view_attrClass("quiz-skip"), tail: { $: "Con", head: $view_attrOn("click", "SkipQuiz"), tail: { $: "Nil" } } } }, { $: "Con", head: $view_viewText($msg_msg("talk.quizSkip")), tail: { $: "Nil" } });
}
function $quizActions(_showSend_0, _sendDisabled_0, _showSkip_0) {
  const _kids_0 = $view_viewConcat($view_viewWhen(_showSend_0, $sendButton(_sendDisabled_0)), $view_viewWhen(_showSkip_0, $skipButton()));
  return $view_viewWhenAll(_showSend_0 || _showSkip_0, { $: "Con", head: $view_viewEl("div", { $: "Con", head: $view_attrClass("quiz-actions"), tail: { $: "Nil" } }, _kids_0), tail: { $: "Nil" } });
}
function $quizTail(_hasVerdict_0, _verdict_0, _hasNote_0, _note_0, _hasExplain_0, _explain_0) {
  return $view_viewJoin({ $: "Con", head: $view_viewWhen(_hasVerdict_0, $view_viewEl("div", { $: "Con", head: $view_attrClass("quiz-verdict"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText(_verdict_0), tail: { $: "Nil" } })), tail: { $: "Con", head: $view_viewWhen(_hasNote_0, $view_viewEl("div", { $: "Con", head: $view_attrClass("quiz-note"), tail: { $: "Nil" } }, { $: "Con", head: $view_viewText($msg_msg("talk.quizNotePrefix")), tail: { $: "Con", head: _note_0, tail: { $: "Nil" } } })), tail: { $: "Con", head: $view_viewWhen(_hasExplain_0, $view_viewEl("div", { $: "Con", head: $view_attrClass("quiz-explain"), tail: { $: "Nil" } }, { $: "Con", head: _explain_0, tail: { $: "Nil" } })), tail: { $: "Nil" } } } });
}
function $quizCard_go(_toolId_0, _multi_0, _question_0, _hasDetails_0, _details_0, _options_0, _showSend_0, _sendDisabled_0, _showSkip_0, _hasVerdict_0, _verdict_0, _hasNote_0, _note_0, _hasExplain_0, _explain_0) {
  const _boxKids_0 = $view_viewJoin({ $: "Con", head: { $: "Con", head: $quizQuestion(_question_0), tail: { $: "Nil" } }, tail: { $: "Con", head: $quizDetails(_hasDetails_0, _details_0), tail: { $: "Con", head: { $: "Con", head: $quizOptionsBox(_multi_0, _options_0), tail: { $: "Nil" } }, tail: { $: "Con", head: $quizActions(_showSend_0, _sendDisabled_0, _showSkip_0), tail: { $: "Con", head: $quizTail(_hasVerdict_0, _verdict_0, _hasNote_0, _note_0, _hasExplain_0, _explain_0), tail: { $: "Nil" } } } } } });
  return $view_viewEl("article", { $: "Con", head: $view_attrClass("message assistant quiz"), tail: { $: "Con", head: $view_attrData("role", "assistant"), tail: { $: "Con", head: $view_attrData("tool", _toolId_0), tail: { $: "Con", head: $view_attrAria("label", $quizAria(_multi_0)), tail: { $: "Nil" } } } } }, { $: "Con", head: $roleNode($quizRole(_multi_0)), tail: { $: "Con", head: $view_viewEl("div", { $: "Con", head: $view_attrClass("quiz-card"), tail: { $: "Nil" } }, _boxKids_0), tail: { $: "Nil" } } });
}
function $quizCard(_row_0) {
  const _toolId_0 = _row_0["toolId"];
  const _multi_0 = _row_0["multi"];
  const _question_0 = _row_0["question"];
  const _hasDetails_0 = _row_0["hasDetails"];
  const _details_0 = _row_0["details"];
  const _options_0 = _row_0["options"];
  const _showSend_0 = _row_0["showSend"];
  const _sendDisabled_0 = _row_0["sendDisabled"];
  const _showSkip_0 = _row_0["showSkip"];
  const _hasVerdict_0 = _row_0["hasVerdict"];
  const _verdict_0 = _row_0["verdict"];
  const _hasNote_0 = _row_0["hasNote"];
  const _note_0 = _row_0["note"];
  const _hasExplain_0 = _row_0["hasExplain"];
  const _explain_0 = _row_0["explain"];
  return $quizCard_go(_toolId_0, _multi_0, _question_0, _hasDetails_0, _details_0, _options_0, _showSend_0, _sendDisabled_0, _showSkip_0, _hasVerdict_0, _verdict_0, _hasNote_0, _note_0, _hasExplain_0, _explain_0);
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
var talkview_default = {
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
  off: run_lib((a0) => run_loop($off(a0)), 1),
  roleName: run_lib((a0) => str_out(run_loop($roleName(a0))), 1),
  roleLabel: run_lib((a0) => str_out(run_loop($roleLabel(a0))), 1),
  messageClasses: run_lib((a0) => run_loop($messageClasses(a0)), 1),
  messageAttrs: run_lib((a0) => run_loop($messageAttrs(a0)), 1),
  roleNode: run_lib((a0) => run_loop($roleNode(str_in(a0))), 1),
  shot: run_lib((a0) => run_loop($shot(str_in(a0))), 1),
  shotNodes: run_lib((a0) => run_loop($shotNodes(a0)), 1),
  messageBody: run_lib((a0, a1) => run_loop($messageBody(a0, a1)), 2),
  messageAction: run_lib((a0, a1, a2) => run_loop($messageAction(str_in(a0), str_in(a1), str_in(a2))), 3),
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
  "codeBlock.kids": run_lib((a0, a1) => run_loop($codeBlock_kids(str_in(a0), a1)), 2),
  codeBlock: run_lib((a0, a1) => run_loop($codeBlock(a0, str_in(a1))), 2),
  quizRole: run_lib((a0) => str_out(run_loop($quizRole(a0))), 1),
  quizAria: run_lib((a0) => str_out(run_loop($quizAria(a0))), 1),
  optionRole: run_lib((a0) => str_out(run_loop($optionRole(a0))), 1),
  optionsRole: run_lib((a0) => str_out(run_loop($optionsRole(a0))), 1),
  optionClasses: run_lib((a0, a1, a2) => run_loop($optionClasses(a0, a1, a2)), 3),
  optionAttrs: run_lib((a0, a1, a2, a3, a4, a5, a6, a7) => run_loop($optionAttrs(str_in(a0), str_in(a1), a2, a3, a4, a5, a6, a7)), 8),
  markKids: run_lib((a0) => run_loop($markKids(str_in(a0))), 1),
  "quizOption.go": run_lib((a0, a1, a2, a3, a4, a5, a6, a7, a8, a9) => run_loop($quizOption_go(str_in(a0), str_in(a1), a2, a3, a4, a5, a6, a7, str_in(a8), a9)), 10),
  quizOption: run_lib((a0, a1) => run_loop($quizOption(a0, a1)), 2),
  quizOptions: run_lib((a0, a1) => run_loop($quizOptions(a0, a1)), 2),
  quizQuestion: run_lib((a0) => run_loop($quizQuestion(a0)), 1),
  quizDetails: run_lib((a0, a1) => run_loop($quizDetails(a0, a1)), 2),
  quizOptionsBox: run_lib((a0, a1) => run_loop($quizOptionsBox(a0, a1)), 2),
  sendButton: run_lib((a0) => run_loop($sendButton(a0)), 1),
  skipButton: run_lib(() => run_loop($skipButton()), 0),
  quizActions: run_lib((a0, a1, a2) => run_loop($quizActions(a0, a1, a2)), 3),
  quizTail: run_lib((a0, a1, a2, a3, a4, a5) => run_loop($quizTail(a0, str_in(a1), a2, a3, a4, a5)), 6),
  "quizCard.go": run_lib((a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11, a12, a13, a14) => run_loop($quizCard_go(str_in(a0), a1, a2, a3, a4, a5, a6, a7, a8, a9, str_in(a10), a11, a12, a13, a14)), 15),
  quizCard: run_lib((a0) => run_loop($quizCard(a0)), 1)
};
export {
  talkview_default as default
};

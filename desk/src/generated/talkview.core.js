// GERADO de core/talkview.bend por `bun core/build.mjs` — não editar à mão.
// core/talkview.bend
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
function $view$attr$(_name_0, _value_0) {
  return { $: "ViewAttr", ["name"]: _name_0, ["value"]: _value_0 };
}
function $view$classOn$(_name_0, _on_0) {
  return { $: "ViewClass", ["name"]: _name_0, ["on"]: _on_0 };
}
function $view$viewEl$(_tag_0, _attrs_0, _kids_0) {
  return { $: "ViewEl", ["tag"]: _tag_0, ["attrs"]: _attrs_0, ["kids"]: _kids_0 };
}
function $view$viewText$(_s_0) {
  return { $: "ViewText", ["text"]: _s_0 };
}
function $view$viewKey$(_tag_0, _key_0, _attrs_0, _kids_0) {
  return run_jump($view$viewEl$, [_tag_0, { $: "Con", ["head"]: { $: "ViewAttr", ["name"]: "key", ["value"]: _key_0 }, ["tail"]: _attrs_0 }, _kids_0]);
}
function $view$tagOf$(_n_0) {
  if (_n_0.$ === "ViewEl") {
    const _tag_0 = _n_0["tag"];
    const _attrs_0 = _n_0["attrs"];
    const _kids_0 = _n_0["kids"];
    return _tag_0;
  } else {
    const _text_0 = _n_0["text"];
    return "";
  }
}
function $view$attrsOf$(_n_0) {
  if (_n_0.$ === "ViewEl") {
    const _tag_0 = _n_0["tag"];
    const _attrs_0 = _n_0["attrs"];
    const _kids_0 = _n_0["kids"];
    return _attrs_0;
  } else {
    const _text_0 = _n_0["text"];
    return { $: "Nil" };
  }
}
function $view$kidsOf$(_n_0) {
  if (_n_0.$ === "ViewEl") {
    const _tag_0 = _n_0["tag"];
    const _attrs_0 = _n_0["attrs"];
    const _kids_0 = _n_0["kids"];
    return _kids_0;
  } else {
    const _text_0 = _n_0["text"];
    return { $: "Nil" };
  }
}
function $view$textOf$(_n_0) {
  if (_n_0.$ === "ViewEl") {
    const _tag_0 = _n_0["tag"];
    const _attrs_0 = _n_0["attrs"];
    const _kids_0 = _n_0["kids"];
    return "";
  } else {
    const _text_0 = _n_0["text"];
    return _text_0;
  }
}
function $view$isEl$(_n_0) {
  if (_n_0.$ === "ViewEl") {
    const _tag_0 = _n_0["tag"];
    const _attrs_0 = _n_0["attrs"];
    const _kids_0 = _n_0["kids"];
    return true;
  } else {
    const _text_0 = _n_0["text"];
    return false;
  }
}
function $view$isText$(_n_0) {
  if (_n_0.$ === "ViewEl") {
    const _tag_0 = _n_0["tag"];
    const _attrs_0 = _n_0["attrs"];
    const _kids_0 = _n_0["kids"];
    return false;
  } else {
    const _text_0 = _n_0["text"];
    return true;
  }
}
function $view$attrGet$choose$(_av_0, _rest_0, _same_0) {
  if (_same_0) {
    return { $: "Some", ["value"]: _av_0 };
  } else {
    return _rest_0;
  }
}
function $view$attrGet$go$(_attrs_0, _name_0) {
  if (_attrs_0.$ === "Nil") {
    return { $: "None" };
  } else {
    const _t_0 = _attrs_0["head"];
    const _an_0 = _t_0["name"];
    const _av_0 = _t_0["value"];
    const _t_1 = _attrs_0["tail"];
    return run_jump($view$attrGet$choose$, [_av_0, run_loop($view$attrGet$go$(_t_1, _name_0)), run_loop($String$eq$(_an_0, _name_0))]);
  }
}
function $view$attrGet$(_attrs_0, _name_0) {
  return run_jump($view$attrGet$go$, [_attrs_0, _name_0]);
}
function $view$attrWhen$(_cond_0, _a_0) {
  if (_cond_0) {
    return { $: "Con", ["head"]: _a_0, ["tail"]: { $: "Nil" } };
  } else {
    return { $: "Nil" };
  }
}
function $view$attrConcat$(_xs_0, _ys_0) {
  return run_jump($List$append$, [_xs_0, _ys_0]);
}
function $view$attrJoin$(_xss_0) {
  return run_jump($List$concat$, [_xss_0]);
}
function $view$attrId$(_value_0) {
  return { $: "ViewAttr", ["name"]: "id", ["value"]: _value_0 };
}
function $view$attrClass$(_value_0) {
  return { $: "ViewAttr", ["name"]: "class", ["value"]: _value_0 };
}
function $view$attrType$(_value_0) {
  return { $: "ViewAttr", ["name"]: "type", ["value"]: _value_0 };
}
function $view$attrTitle$(_value_0) {
  return { $: "ViewAttr", ["name"]: "title", ["value"]: _value_0 };
}
function $view$attrKey$(_value_0) {
  return { $: "ViewAttr", ["name"]: "key", ["value"]: _value_0 };
}
function $view$attrOn$(_event_0, _handler_0) {
  return { $: "ViewAttr", ["name"]: "on:" + _event_0, ["value"]: _handler_0 };
}
function $view$attrData$(_name_0, _value_0) {
  return { $: "ViewAttr", ["name"]: "data-" + _name_0, ["value"]: _value_0 };
}
function $view$attrAria$(_name_0, _value_0) {
  return { $: "ViewAttr", ["name"]: "aria-" + _name_0, ["value"]: _value_0 };
}
function $view$boolStr$(_on_0) {
  if (_on_0) {
    return "true";
  } else {
    return "false";
  }
}
function $view$attrBool$(_name_0, _on_0) {
  return { $: "ViewAttr", ["name"]: _name_0, ["value"]: run_loop($view$boolStr$(_on_0)) };
}
function $view$classAppend$empty$(_acc_0, _name_0, _empty_0) {
  if (_empty_0) {
    return _name_0;
  } else {
    const _x_0 = " " + _name_0;
    return _acc_0 + _x_0;
  }
}
function $view$classAppend$(_acc_0, _name_0) {
  return run_jump($view$classAppend$empty$, [_acc_0, _name_0, run_loop($String$is_empty$(_acc_0))]);
}
function $view$classNext$emptyName$(_name_0, _acc_0, _emptyName_0) {
  if (_emptyName_0) {
    return _acc_0;
  } else {
    return run_jump($view$classAppend$, [_acc_0, _name_0]);
  }
}
function $view$classNext$on$(_name_0, _on_0, _acc_0) {
  if (!_on_0) {
    return _acc_0;
  } else {
    return run_jump($view$classNext$emptyName$, [_name_0, _acc_0, run_loop($String$is_empty$(_name_0))]);
  }
}
function $view$classValue$go$(_xs_0, _acc_0) {
  if (_xs_0.$ === "Nil") {
    return _acc_0;
  } else {
    const _t_0 = _xs_0["head"];
    const _name_0 = _t_0["name"];
    const _on_0 = _t_0["on"];
    const _t_1 = _xs_0["tail"];
    return run_jump($view$classValue$go$, [_t_1, run_loop($view$classNext$on$(_name_0, _on_0, _acc_0))]);
  }
}
function $view$classValue$(_xs_0) {
  return run_jump($view$classValue$go$, [_xs_0, ""]);
}
function $view$classes$(_xs_0) {
  return { $: "ViewAttr", ["name"]: "class", ["value"]: run_loop($view$classValue$(_xs_0)) };
}
function $view$viewWhen$(_cond_0, _node_0) {
  if (_cond_0) {
    return { $: "Con", ["head"]: _node_0, ["tail"]: { $: "Nil" } };
  } else {
    return { $: "Nil" };
  }
}
function $view$viewWhenAll$(_cond_0, _nodes_0) {
  if (_cond_0) {
    return _nodes_0;
  } else {
    return { $: "Nil" };
  }
}
function $view$viewConcat$(_xs_0, _ys_0) {
  return run_jump($List$append$, [_xs_0, _ys_0]);
}
function $view$viewJoin$(_xss_0) {
  return run_jump($List$concat$, [_xss_0]);
}
function $view$viewMapText$(_xs_0) {
  return run_jump($view$viewMap$0$, [_xs_0]);
}
function $view$asTextI$(_i_0, _s_0) {
  return run_jump($view$viewText$, [_s_0]);
}
function $view$viewMapTextI$go$(_xs_0, _i_0) {
  return run_jump($view$viewMapI$go$0$, [_xs_0, _i_0]);
}
function $view$viewMapTextI$(_xs_0) {
  return run_jump($view$viewMapTextI$go$, [_xs_0, 0n]);
}
function $off$(_on_0) {
  if (_on_0) {
    return false;
  } else {
    return true;
  }
}
function $roleName$(_user_0) {
  if (_user_0) {
    return "user";
  } else {
    return "assistant";
  }
}
function $roleLabel$(_user_0) {
  if (_user_0) {
    return "Você";
  } else {
    return "Pi";
  }
}
function $messageClasses$(_user_0) {
  return { $: "Con", ["head"]: run_loop($view$classOn$("message", true)), ["tail"]: { $: "Con", ["head"]: run_loop($view$classOn$("user", _user_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$classOn$("assistant", run_loop($off$(_user_0)))), ["tail"]: { $: "Nil" } } } };
}
function $messageAttrs$(_user_0) {
  return { $: "Con", ["head"]: run_loop($view$classes$(run_loop($messageClasses$(_user_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("role", run_loop($roleName$(_user_0)))), ["tail"]: { $: "Nil" } } };
}
function $roleNode$(_label_0) {
  return run_jump($view$viewEl$, ["div", { $: "Con", ["head"]: run_loop($view$attrClass$("role")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$(_label_0)), ["tail"]: { $: "Nil" } }]);
}
function $shot$(_src_0) {
  return run_jump($view$viewEl$, ["img", { $: "Con", ["head"]: run_loop($view$attrClass$("shot")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attr$("src", _src_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$attr$("alt", "Imagem enviada")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attr$("loading", "lazy")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attr$("decoding", "async")), ["tail"]: { $: "Nil" } } } } } }, { $: "Nil" }]);
}
function $shotNodes$(_xs_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return { $: "Con", ["head"]: run_loop($shot$(_h_0)), ["tail"]: run_loop($shotNodes$(_t_0)) };
  }
}
function $messageBody$(_markup_0, _images_0) {
  return run_jump($view$viewEl$, ["div", { $: "Con", ["head"]: run_loop($view$attrClass$("body")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: _markup_0, ["tail"]: run_loop($shotNodes$(_images_0)) }]);
}
function $messageAction$(_className_0, _label_0, _handler_0) {
  return run_jump($view$viewEl$, ["button", { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrClass$(_className_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", _handler_0)), ["tail"]: { $: "Nil" } } } }, { $: "Con", ["head"]: run_loop($view$viewText$(_label_0)), ["tail"]: { $: "Nil" } }]);
}
function $messageActions$(_canCopy_0, _canQuote_0, _canReview_0) {
  return run_jump($view$viewJoin$, [{ $: "Con", ["head"]: run_loop($view$viewWhen$(_canCopy_0, run_loop($messageAction$("msg-copy", "Copiar", "CopyMessage")))), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewWhen$(_canQuote_0, run_loop($messageAction$("msg-quote", "Citar", "QuoteMessage")))), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewWhen$(_canReview_0, run_loop($messageAction$("msg-review", "Guardar para revisar", "SaveForReview")))), ["tail"]: { $: "Nil" } } } }]);
}
function $messageKids$(_user_0, _markup_0, _images_0, _canCopy_0, _canQuote_0, _canReview_0) {
  return run_jump($view$viewConcat$, [{ $: "Con", ["head"]: run_loop($roleNode$(run_loop($roleLabel$(_user_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($messageBody$(_markup_0, _images_0)), ["tail"]: { $: "Nil" } } }, run_loop($messageActions$(_canCopy_0, _canQuote_0, _canReview_0))]);
}
function $message$(_user_0, _markup_0, _images_0, _canCopy_0, _canQuote_0, _canReview_0) {
  return run_jump($view$viewEl$, ["article", run_loop($messageAttrs$(_user_0)), run_loop($messageKids$(_user_0, _markup_0, _images_0, _canCopy_0, _canQuote_0, _canReview_0))]);
}
function $citation$(_text_0) {
  return run_jump($view$viewEl$, ["blockquote", { $: "Con", ["head"]: run_loop($view$attrClass$("citation")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$(_text_0)), ["tail"]: { $: "Nil" } }]);
}
function $talkChip$(_kind_0, _label_0) {
  return run_jump($view$viewEl$, ["span", { $: "Con", ["head"]: run_loop($view$classes$({ $: "Con", ["head"]: run_loop($view$classOn$("talk-chip", true)), ["tail"]: { $: "Con", ["head"]: run_loop($view$classOn$(_kind_0, true)), ["tail"]: { $: "Nil" } } })), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("kind", _kind_0)), ["tail"]: { $: "Nil" } } }, { $: "Con", ["head"]: run_loop($view$viewText$(_label_0)), ["tail"]: { $: "Nil" } }]);
}
function $thinkingChip$(_label_0) {
  return run_jump($talkChip$, ["thinking", _label_0]);
}
function $toolChip$(_label_0) {
  return run_jump($talkChip$, ["tool", _label_0]);
}
function $emptyState$() {
  return run_jump($view$viewEl$, ["div", { $: "Con", ["head"]: run_loop($view$attrId$("welcome")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewEl$("button", { $: "Con", ["head"]: run_loop($view$attrId$("connect")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "Connect")), ["tail"]: { $: "Nil" } } } }, { $: "Con", ["head"]: run_loop($view$viewText$("Conectar ao Pi")), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("p", { $: "Nil" }, { $: "Con", ["head"]: run_loop($view$viewText$("Sessão local desta matéria.")), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Nil" } } }]);
}
function $typingState$(_label_0) {
  return run_jump($view$viewEl$, ["article", { $: "Con", ["head"]: run_loop($view$attrClass$("message assistant typing")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("role", "assistant")), ["tail"]: { $: "Nil" } } }, { $: "Con", ["head"]: run_loop($roleNode$("Pi")), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("div", { $: "Con", ["head"]: run_loop($view$attrClass$("body")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewEl$("span", { $: "Con", ["head"]: run_loop($view$attrClass$("pulse")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("hidden", "true")), ["tail"]: { $: "Nil" } } }, { $: "Nil" })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewText$(_label_0)), ["tail"]: { $: "Nil" } } })), ["tail"]: { $: "Nil" } } }]);
}
function $assetImg$go$(_src_0, _path_0, _alt_0) {
  return run_jump($view$viewEl$, ["img", { $: "Con", ["head"]: run_loop($view$attrClass$("plot")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attr$("src", _src_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("path", _path_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$attr$("alt", _alt_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$attr$("loading", "lazy")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attr$("decoding", "async")), ["tail"]: { $: "Nil" } } } } } } }, { $: "Nil" }]);
}
function $assetCaption$(_caption_0) {
  return run_jump($view$viewWhen$, [run_loop($Bool$not$(run_loop($String$is_empty$(_caption_0)))), run_loop($view$viewEl$("figcaption", { $: "Nil" }, { $: "Con", ["head"]: run_loop($view$viewText$(_caption_0)), ["tail"]: { $: "Nil" } }))]);
}
function $assetKids$go$(_src_0, _path_0, _alt_0, _caption_0) {
  return run_jump($List$append$, [{ $: "Con", ["head"]: run_loop($assetImg$go$(_src_0, _path_0, _alt_0)), ["tail"]: { $: "Nil" } }, run_loop($assetCaption$(_caption_0))]);
}
function $assetKids$(_row_0) {
  const _src_0 = _row_0["src"];
  const _path_0 = _row_0["path"];
  const _alt_0 = _row_0["alt"];
  const _caption_0 = _row_0["caption"];
  return run_jump($assetKids$go$, [_src_0, _path_0, _alt_0, _caption_0]);
}
function $assetFigure$go$(_src_0, _path_0, _alt_0, _caption_0) {
  return run_jump($view$viewEl$, ["figure", { $: "Con", ["head"]: run_loop($view$attrClass$("asset")), ["tail"]: { $: "Nil" } }, run_loop($assetKids$go$(_src_0, _path_0, _alt_0, _caption_0))]);
}
function $assetFigure$(_row_0) {
  const _src_0 = _row_0["src"];
  const _path_0 = _row_0["path"];
  const _alt_0 = _row_0["alt"];
  const _caption_0 = _row_0["caption"];
  return run_jump($assetFigure$go$, [_src_0, _path_0, _alt_0, _caption_0]);
}
function $assetFallback$(_source_0) {
  return run_jump($view$viewEl$, ["code", { $: "Nil" }, { $: "Con", ["head"]: run_loop($view$viewText$(_source_0)), ["tail"]: { $: "Nil" } }]);
}
function $codeCopy$() {
  return run_jump($view$viewEl$, ["button", { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrClass$("code-copy")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("label", "Copiar código")), ["tail"]: { $: "Nil" } } } }, { $: "Con", ["head"]: run_loop($view$viewText$("cópia")), ["tail"]: { $: "Nil" } }]);
}
function $codeBlock$kids$(_lang_0, _pre_0) {
  return run_jump($view$viewConcat$, [run_loop($view$viewWhen$(run_loop($Bool$not$(run_loop($String$is_empty$(_lang_0)))), run_loop($view$viewEl$("span", { $: "Con", ["head"]: run_loop($view$attrClass$("code-lang")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$(_lang_0)), ["tail"]: { $: "Nil" } })))), { $: "Con", ["head"]: run_loop($codeCopy$()), ["tail"]: { $: "Con", ["head"]: _pre_0, ["tail"]: { $: "Nil" } } }]);
}
function $codeBlock$(_pre_0, _lang_0) {
  return run_jump($view$viewEl$, ["div", { $: "Con", ["head"]: run_loop($view$attrClass$("codeblock")), ["tail"]: { $: "Nil" } }, run_loop($codeBlock$kids$(_lang_0, _pre_0))]);
}
function $quizRole$(_multi_0) {
  if (_multi_0) {
    return "Quiz · múltipla escolha";
  } else {
    return "Quiz";
  }
}
function $quizAria$(_multi_0) {
  if (_multi_0) {
    return "Quiz de múltipla escolha";
  } else {
    return "Pergunta de quiz";
  }
}
function $optionRole$(_multi_0) {
  if (_multi_0) {
    return "checkbox";
  } else {
    return "radio";
  }
}
function $optionsRole$(_multi_0) {
  if (_multi_0) {
    return "group";
  } else {
    return "radiogroup";
  }
}
function $optionClasses$(_correct_0, _wrong_0, _dim_0) {
  return { $: "Con", ["head"]: run_loop($view$classOn$("quiz-option", true)), ["tail"]: { $: "Con", ["head"]: run_loop($view$classOn$("correct", _correct_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$classOn$("wrong", _wrong_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$classOn$("dim", _dim_0)), ["tail"]: { $: "Nil" } } } } };
}
function $optionAttrs$(_label_0, _index_0, _multi_0, _checked_0, _disabled_0, _correct_0, _wrong_0, _dim_0) {
  return run_jump($view$attrJoin$, [{ $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$classes$(run_loop($optionClasses$(_correct_0, _wrong_0, _dim_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrKey$(run_loop($String$join$({ $: "Con", ["head"]: "quiz-option-", ["tail"]: { $: "Con", ["head"]: _index_0, ["tail"]: { $: "Nil" } } }, "")))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("label", _label_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("index", _index_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$attr$("role", run_loop($optionRole$(_multi_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("checked", run_loop($view$boolStr$(_checked_0)))), ["tail"]: { $: "Nil" } } } } } } } }, ["tail"]: { $: "Con", ["head"]: run_loop($view$attrWhen$(_disabled_0, run_loop($view$attr$("disabled", "")))), ["tail"]: { $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "SelectQuizOption")), ["tail"]: { $: "Nil" } }, ["tail"]: { $: "Nil" } } } }]);
}
function $markKids$(_mark_0) {
  return run_jump($view$viewWhen$, [run_loop($Bool$not$(run_loop($String$is_empty$(_mark_0)))), run_loop($view$viewEl$("span", { $: "Con", ["head"]: run_loop($view$attrClass$("quiz-mark")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$(_mark_0)), ["tail"]: { $: "Nil" } }))]);
}
function $quizOption$go$(_label_0, _index_0, _markup_0, _checked_0, _disabled_0, _correct_0, _wrong_0, _dim_0, _mark_0, _multi_0) {
  return run_jump($view$viewEl$, ["button", run_loop($optionAttrs$(_label_0, _index_0, _multi_0, _checked_0, _disabled_0, _correct_0, _wrong_0, _dim_0)), run_loop($view$viewConcat$({ $: "Con", ["head"]: run_loop($view$viewEl$("span", { $: "Nil" }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($String$join$({ $: "Con", ["head"]: _index_0, ["tail"]: { $: "Con", ["head"]: ". ", ["tail"]: { $: "Nil" } } }, "")))), ["tail"]: { $: "Con", ["head"]: _markup_0, ["tail"]: { $: "Nil" } } })), ["tail"]: { $: "Nil" } }, run_loop($markKids$(_mark_0))))]);
}
function $quizOption$(_row_0, _multi_0) {
  const _label_0 = _row_0["label"];
  const _index_0 = _row_0["index"];
  const _markup_0 = _row_0["markup"];
  const _checked_0 = _row_0["checked"];
  const _disabled_0 = _row_0["disabled"];
  const _correct_0 = _row_0["correct"];
  const _wrong_0 = _row_0["wrong"];
  const _dim_0 = _row_0["dim"];
  const _mark_0 = _row_0["mark"];
  return run_jump($quizOption$go$, [_label_0, _index_0, _markup_0, _checked_0, _disabled_0, _correct_0, _wrong_0, _dim_0, _mark_0, _multi_0]);
}
function $quizOptions$(_xs_0, _multi_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return { $: "Con", ["head"]: run_loop($quizOption$(_h_0, _multi_0)), ["tail"]: run_loop($quizOptions$(_t_0, _multi_0)) };
  }
}
function $quizQuestion$(_markup_0) {
  return run_jump($view$viewEl$, ["div", { $: "Con", ["head"]: run_loop($view$attrClass$("quiz-question")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: _markup_0, ["tail"]: { $: "Nil" } }]);
}
function $quizDetails$(_has_0, _markup_0) {
  return run_jump($view$viewWhen$, [_has_0, run_loop($view$viewEl$("div", { $: "Con", ["head"]: run_loop($view$attrClass$("quiz-details")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: _markup_0, ["tail"]: { $: "Nil" } }))]);
}
function $quizOptionsBox$(_multi_0, _options_0) {
  return run_jump($view$viewEl$, ["div", { $: "Con", ["head"]: run_loop($view$attrClass$("quiz-options")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attr$("role", run_loop($optionsRole$(_multi_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("label", "Opções")), ["tail"]: { $: "Nil" } } } }, run_loop($quizOptions$(_options_0, _multi_0))]);
}
function $sendButton$(_disabled_0) {
  return run_jump($view$viewEl$, ["button", run_loop($view$attrConcat$({ $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrClass$("quiz-send primary")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrKey$("quiz-send")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "SendQuiz")), ["tail"]: { $: "Nil" } } } } }, run_loop($view$attrWhen$(_disabled_0, run_loop($view$attr$("disabled", "")))))), { $: "Con", ["head"]: run_loop($view$viewText$("Enviar resposta")), ["tail"]: { $: "Nil" } }]);
}
function $skipButton$() {
  return run_jump($view$viewEl$, ["button", { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrClass$("quiz-skip")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "SkipQuiz")), ["tail"]: { $: "Nil" } } } }, { $: "Con", ["head"]: run_loop($view$viewText$("Pular")), ["tail"]: { $: "Nil" } }]);
}
function $quizActions$(_showSend_0, _sendDisabled_0, _showSkip_0) {
  const _kids_0 = run_loop($view$viewConcat$(run_loop($view$viewWhen$(_showSend_0, run_loop($sendButton$(_sendDisabled_0)))), run_loop($view$viewWhen$(_showSkip_0, run_loop($skipButton$())))));
  return run_jump($view$viewWhenAll$, [_showSend_0 || _showSkip_0, { $: "Con", ["head"]: run_loop($view$viewEl$("div", { $: "Con", ["head"]: run_loop($view$attrClass$("quiz-actions")), ["tail"]: { $: "Nil" } }, _kids_0)), ["tail"]: { $: "Nil" } }]);
}
function $quizTail$(_hasVerdict_0, _verdict_0, _hasNote_0, _note_0, _hasExplain_0, _explain_0) {
  return run_jump($view$viewJoin$, [{ $: "Con", ["head"]: run_loop($view$viewWhen$(_hasVerdict_0, run_loop($view$viewEl$("div", { $: "Con", ["head"]: run_loop($view$attrClass$("quiz-verdict")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$(_verdict_0)), ["tail"]: { $: "Nil" } })))), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewWhen$(_hasNote_0, run_loop($view$viewEl$("div", { $: "Con", ["head"]: run_loop($view$attrClass$("quiz-note")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$("Observação: ")), ["tail"]: { $: "Con", ["head"]: _note_0, ["tail"]: { $: "Nil" } } })))), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewWhen$(_hasExplain_0, run_loop($view$viewEl$("div", { $: "Con", ["head"]: run_loop($view$attrClass$("quiz-explain")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: _explain_0, ["tail"]: { $: "Nil" } })))), ["tail"]: { $: "Nil" } } } }]);
}
function $quizCard$go$(_toolId_0, _multi_0, _question_0, _hasDetails_0, _details_0, _options_0, _showSend_0, _sendDisabled_0, _showSkip_0, _hasVerdict_0, _verdict_0, _hasNote_0, _note_0, _hasExplain_0, _explain_0) {
  const _boxKids_0 = run_loop($view$viewJoin$({ $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($quizQuestion$(_question_0)), ["tail"]: { $: "Nil" } }, ["tail"]: { $: "Con", ["head"]: run_loop($quizDetails$(_hasDetails_0, _details_0)), ["tail"]: { $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($quizOptionsBox$(_multi_0, _options_0)), ["tail"]: { $: "Nil" } }, ["tail"]: { $: "Con", ["head"]: run_loop($quizActions$(_showSend_0, _sendDisabled_0, _showSkip_0)), ["tail"]: { $: "Con", ["head"]: run_loop($quizTail$(_hasVerdict_0, _verdict_0, _hasNote_0, _note_0, _hasExplain_0, _explain_0)), ["tail"]: { $: "Nil" } } } } } }));
  return run_jump($view$viewEl$, ["article", { $: "Con", ["head"]: run_loop($view$attrClass$("message assistant quiz")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("role", "assistant")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("tool", _toolId_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("label", run_loop($quizAria$(_multi_0)))), ["tail"]: { $: "Nil" } } } } }, { $: "Con", ["head"]: run_loop($roleNode$(run_loop($quizRole$(_multi_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("div", { $: "Con", ["head"]: run_loop($view$attrClass$("quiz-card")), ["tail"]: { $: "Nil" } }, _boxKids_0)), ["tail"]: { $: "Nil" } } }]);
}
function $quizCard$(_row_0) {
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
  return run_jump($quizCard$go$, [_toolId_0, _multi_0, _question_0, _hasDetails_0, _details_0, _options_0, _showSend_0, _sendDisabled_0, _showSkip_0, _hasVerdict_0, _verdict_0, _hasNote_0, _note_0, _hasExplain_0, _explain_0]);
}
function $String$eq$(_a_0, _b_0) {
  return run_jump($String$eq$fin$, [run_loop($String$cmp$(_a_0, _b_0))]);
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
function $List$concat$(_xss_0) {
  if (_xss_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xss_0["head"];
    const _t_0 = _xss_0["tail"];
    return run_jump($List$append$, [_h_0, run_loop($List$concat$(_t_0))]);
  }
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
function $view$viewMap$0$(_xs_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return { $: "Con", ["head"]: run_loop($view$viewText$(_h_0)), ["tail"]: run_loop($view$viewMap$0$(_t_0)) };
  }
}
function $view$viewMapI$go$0$(_xs_0, _i_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return { $: "Con", ["head"]: run_loop($view$asTextI$(_i_0, _h_0)), ["tail"]: run_loop($view$viewMapI$go$0$(_t_0, nat_chk(_i_0 + 1n))) };
  }
}
function $Bool$not$(_b_0) {
  if (!_b_0) {
    return true;
  } else {
    return false;
  }
}
function $String$join$(_xs_0, _sep_0) {
  if (_xs_0.$ === "Nil") {
    return "";
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return run_jump($String$join$go$, [_t_0, _h_0, _sep_0]);
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
function $String$join$go$(_xs_0, _h_0, _sep_0) {
  if (_xs_0.$ === "Nil") {
    return _h_0;
  } else {
    const _h2_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    const _x_0 = run_loop($String$join$go$(_t_0, _h2_0, _sep_0));
    const _x_1 = _sep_0 + _x_0;
    return _h_0 + _x_1;
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
function $String$cmp$rec$(_h1b_0, _h2b_0, _rr_0) {
  const _t_0 = _rr_0["fst"];
  const _t1b_0 = _t_0["fst"];
  const _t2b_0 = _t_0["snd"];
  const _r_0 = _rr_0["snd"];
  return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: _h1b_0 + _t1b_0, ["snd"]: _h2b_0 + _t2b_0 }, ["snd"]: _r_0 };
}
var talkview_default = {
  "view.attr": run_lib($view$attr$, 2),
  "view.classOn": run_lib($view$classOn$, 2),
  "view.viewEl": run_lib($view$viewEl$, 3),
  "view.viewText": run_lib($view$viewText$, 1),
  "view.viewKey": run_lib($view$viewKey$, 4),
  "view.tagOf": run_lib($view$tagOf$, 1),
  "view.attrsOf": run_lib($view$attrsOf$, 1),
  "view.kidsOf": run_lib($view$kidsOf$, 1),
  "view.textOf": run_lib($view$textOf$, 1),
  "view.isEl": run_lib($view$isEl$, 1),
  "view.isText": run_lib($view$isText$, 1),
  "view.attrGet.choose": run_lib($view$attrGet$choose$, 3),
  "view.attrGet.go": run_lib($view$attrGet$go$, 2),
  "view.attrGet": run_lib($view$attrGet$, 2),
  "view.attrWhen": run_lib($view$attrWhen$, 2),
  "view.attrConcat": run_lib($view$attrConcat$, 2),
  "view.attrJoin": run_lib($view$attrJoin$, 1),
  "view.attrId": run_lib($view$attrId$, 1),
  "view.attrClass": run_lib($view$attrClass$, 1),
  "view.attrType": run_lib($view$attrType$, 1),
  "view.attrTitle": run_lib($view$attrTitle$, 1),
  "view.attrKey": run_lib($view$attrKey$, 1),
  "view.attrOn": run_lib($view$attrOn$, 2),
  "view.attrData": run_lib($view$attrData$, 2),
  "view.attrAria": run_lib($view$attrAria$, 2),
  "view.boolStr": run_lib($view$boolStr$, 1),
  "view.attrBool": run_lib($view$attrBool$, 2),
  "view.classAppend.empty": run_lib($view$classAppend$empty$, 3),
  "view.classAppend": run_lib($view$classAppend$, 2),
  "view.classNext.emptyName": run_lib($view$classNext$emptyName$, 3),
  "view.classNext.on": run_lib($view$classNext$on$, 3),
  "view.classValue.go": run_lib($view$classValue$go$, 2),
  "view.classValue": run_lib($view$classValue$, 1),
  "view.classes": run_lib($view$classes$, 1),
  "view.viewWhen": run_lib($view$viewWhen$, 2),
  "view.viewWhenAll": run_lib($view$viewWhenAll$, 2),
  "view.viewConcat": run_lib($view$viewConcat$, 2),
  "view.viewJoin": run_lib($view$viewJoin$, 1),
  "view.viewMapText": run_lib($view$viewMapText$, 1),
  "view.asTextI": run_lib($view$asTextI$, 2),
  "view.viewMapTextI.go": run_lib($view$viewMapTextI$go$, 2),
  "view.viewMapTextI": run_lib($view$viewMapTextI$, 1),
  off: run_lib($off$, 1),
  roleName: run_lib($roleName$, 1),
  roleLabel: run_lib($roleLabel$, 1),
  messageClasses: run_lib($messageClasses$, 1),
  messageAttrs: run_lib($messageAttrs$, 1),
  roleNode: run_lib($roleNode$, 1),
  shot: run_lib($shot$, 1),
  shotNodes: run_lib($shotNodes$, 1),
  messageBody: run_lib($messageBody$, 2),
  messageAction: run_lib($messageAction$, 3),
  messageActions: run_lib($messageActions$, 3),
  messageKids: run_lib($messageKids$, 6),
  message: run_lib($message$, 6),
  citation: run_lib($citation$, 1),
  talkChip: run_lib($talkChip$, 2),
  thinkingChip: run_lib($thinkingChip$, 1),
  toolChip: run_lib($toolChip$, 1),
  emptyState: run_lib($emptyState$, 0),
  typingState: run_lib($typingState$, 1),
  "assetImg.go": run_lib($assetImg$go$, 3),
  assetCaption: run_lib($assetCaption$, 1),
  "assetKids.go": run_lib($assetKids$go$, 4),
  assetKids: run_lib($assetKids$, 1),
  "assetFigure.go": run_lib($assetFigure$go$, 4),
  assetFigure: run_lib($assetFigure$, 1),
  assetFallback: run_lib($assetFallback$, 1),
  codeCopy: run_lib($codeCopy$, 0),
  "codeBlock.kids": run_lib($codeBlock$kids$, 2),
  codeBlock: run_lib($codeBlock$, 2),
  quizRole: run_lib($quizRole$, 1),
  quizAria: run_lib($quizAria$, 1),
  optionRole: run_lib($optionRole$, 1),
  optionsRole: run_lib($optionsRole$, 1),
  optionClasses: run_lib($optionClasses$, 3),
  optionAttrs: run_lib($optionAttrs$, 8),
  markKids: run_lib($markKids$, 1),
  "quizOption.go": run_lib($quizOption$go$, 10),
  quizOption: run_lib($quizOption$, 2),
  quizOptions: run_lib($quizOptions$, 2),
  quizQuestion: run_lib($quizQuestion$, 1),
  quizDetails: run_lib($quizDetails$, 2),
  quizOptionsBox: run_lib($quizOptionsBox$, 2),
  sendButton: run_lib($sendButton$, 1),
  skipButton: run_lib($skipButton$, 0),
  quizActions: run_lib($quizActions$, 3),
  quizTail: run_lib($quizTail$, 6),
  "quizCard.go": run_lib($quizCard$go$, 15),
  quizCard: run_lib($quizCard$, 1)
};
export {
  talkview_default as default
};

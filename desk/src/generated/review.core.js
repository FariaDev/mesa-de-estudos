// GERADO de core/review.bend por `bun core/build.mjs` — não editar à mão.
// core/review.bend
function cmp_new(a, b) {
  return { $: a < b ? "LT" : a === b ? "EQ" : "GT" };
}
function nat_divmod(a, b) {
  return b === 0n ? { $: "Tuple", fst: 0n, snd: a } : { $: "Tuple", fst: a / b, snd: a % b };
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
function $maxQuestion$() {
  return BigInt(400);
}
function $maxAttempt$() {
  return BigInt(400);
}
function $maxDifficulty$() {
  return 240n;
}
function $maxName$() {
  return 60n;
}
function $maxPath$() {
  return BigInt(1024);
}
function $maxItems$() {
  return 200n;
}
function $cutReview$if$(_text_0, _limit_0, _over_0) {
  if (!_over_0) {
    return _text_0;
  } else {
    return run_jump($String$take$, [_text_0, _limit_0]);
  }
}
function $cutReview$(_text_0, _limit_0) {
  return run_jump($cutReview$if$, [_text_0, _limit_0, run_loop($Nat$is_gt$(BigInt([..._text_0].length), _limit_0))]);
}
function $clip$(_text_0, _limit_0) {
  return run_jump($cutReview$, [run_loop($String$trim$(_text_0)), _limit_0]);
}
function $fitQuestion$(_text_0) {
  return run_jump($clip$, [_text_0, run_loop($maxQuestion$())]);
}
function $fitAttempt$(_text_0) {
  return run_jump($clip$, [_text_0, run_loop($maxAttempt$())]);
}
function $fitDifficulty$(_text_0) {
  return run_jump($clip$, [_text_0, run_loop($maxDifficulty$())]);
}
function $fitName$(_text_0) {
  return run_jump($clip$, [_text_0, run_loop($maxName$())]);
}
function $fitPath$(_text_0) {
  return run_jump($clip$, [_text_0, run_loop($maxPath$())]);
}
function $pageFloor$if$(_page_0, _low_0) {
  if (_low_0) {
    return 1n;
  } else {
    return _page_0;
  }
}
function $pageFloor$(_page_0) {
  return run_jump($pageFloor$if$, [_page_0, _page_0 < 1n]);
}
function $newRef$(_name_0, _page_0, _path_0) {
  return { $: "ReviewRef", ["name"]: run_loop($fitName$(_name_0)), ["page"]: run_loop($pageFloor$(_page_0)), ["path"]: run_loop($fitPath$(_path_0)) };
}
function $newItem$(_question_0, _attempt_0, _difficulty_0, _name_0, _page_0, _path_0) {
  return { $: "ReviewItem", ["question"]: run_loop($fitQuestion$(_question_0)), ["attempt"]: run_loop($fitAttempt$(_attempt_0)), ["difficulty"]: run_loop($fitDifficulty$(_difficulty_0)), ["ref"]: run_loop($newRef$(_name_0, _page_0, _path_0)) };
}
function $keepQuestion$blank$(_blank_0) {
  if (_blank_0) {
    return false;
  } else {
    return true;
  }
}
function $keepQuestion$(_question_0) {
  return run_jump($keepQuestion$blank$, [run_loop($String$is_empty$(run_loop($String$trim$(_question_0))))]);
}
function $keepItem$(_item_0) {
  const _question_0 = _item_0["question"];
  const __0 = _item_0["attempt"];
  const __1 = _item_0["difficulty"];
  const __2 = _item_0["ref"];
  return run_jump($keepQuestion$, [_question_0]);
}
function $sameRef$(_a_0, _b_0) {
  const _name_0 = _a_0["name"];
  const _page_0 = _a_0["page"];
  const _path_0 = _a_0["path"];
  const _name2_0 = _b_0["name"];
  const _page2_0 = _b_0["page"];
  const _path2_0 = _b_0["path"];
  return run_jump($Bool$and$, [run_loop($Bool$and$(run_loop($String$eq$(_name_0, _name2_0)), run_loop($Nat$is_eq$(_page_0, _page2_0)))), run_loop($String$eq$(_path_0, _path2_0))]);
}
function $sameItem$(_a_0, _b_0) {
  const _question_0 = _a_0["question"];
  const __0 = _a_0["attempt"];
  const __1 = _a_0["difficulty"];
  const _ref_0 = _a_0["ref"];
  const _question2_0 = _b_0["question"];
  const __2 = _b_0["attempt"];
  const __3 = _b_0["difficulty"];
  const _ref2_0 = _b_0["ref"];
  return run_jump($Bool$and$, [run_loop($String$eq$(_question_0, _question2_0)), run_loop($sameRef$(_ref_0, _ref2_0))]);
}
function $dropSame$head$(_h_0, _rest_0, _same_0) {
  if (_same_0) {
    return _rest_0;
  } else {
    return { $: "Con", ["head"]: _h_0, ["tail"]: _rest_0 };
  }
}
function $dropSame$go$(_items_0, _item_0) {
  if (_items_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _items_0["head"];
    const _t_0 = _items_0["tail"];
    return run_jump($dropSame$head$, [_h_0, run_loop($dropSame$go$(_t_0, _item_0)), run_loop($sameItem$(_h_0, _item_0))]);
  }
}
function $takeItems$go$(_xs_0, _n_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    if (_n_0 === 0n) {
      return { $: "Nil" };
    } else {
      const _p_0 = _n_0 - 1n;
      return { $: "Con", ["head"]: _h_0, ["tail"]: run_loop($takeItems$go$(_t_0, _p_0)) };
    }
  }
}
function $addItem$(_items_0, _item_0) {
  return run_jump($takeItems$go$, [{ $: "Con", ["head"]: _item_0, ["tail"]: run_loop($dropSame$go$(_items_0, _item_0)) }, run_loop($maxItems$())]);
}
function $replaceSame$head$(_h_0, _rest_0, _item_0, _same_0) {
  if (_same_0) {
    return { $: "Con", ["head"]: _item_0, ["tail"]: _rest_0 };
  } else {
    return { $: "Con", ["head"]: _h_0, ["tail"]: _rest_0 };
  }
}
function $replaceSame$go$(_xs_0, _key_0, _item_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return run_jump($replaceSame$head$, [_h_0, run_loop($replaceSame$go$(_t_0, _key_0, _item_0)), _item_0, run_loop($sameItem$(_h_0, _key_0))]);
  }
}
function $replaceSame$(_items_0, _key_0, _item_0) {
  return run_jump($replaceSame$go$, [_items_0, _key_0, _item_0]);
}
function $removeSame$(_items_0, _key_0) {
  return run_jump($dropSame$go$, [_items_0, _key_0]);
}
function $reviewTitle$() {
  return "Caderno de revisão";
}
function $closeLabel$() {
  return "Fechar";
}
function $emptyText$() {
  return "Nada guardado para revisar ainda. Use Guardar para revisar numa resposta do Pi.";
}
function $countText$if$(_n_0, _one_0) {
  if (_one_0) {
    return "1 item";
  } else {
    const _x_0 = run_loop($Nat$show$(_n_0));
    return _x_0 + " itens";
  }
}
function $countText$(_n_0) {
  return run_jump($countText$if$, [_n_0, run_loop($Nat$is_eq$(_n_0, 1n))]);
}
function $pageLabel$(_page_0) {
  const _x_0 = run_loop($Nat$show$(_page_0));
  return "p. " + _x_0;
}
function $refLine$if$(_name_0, _page_0, _unnamed_0) {
  if (_unnamed_0) {
    return run_jump($pageLabel$, [_page_0]);
  } else {
    const _x_0 = run_loop($pageLabel$(_page_0));
    const _x_1 = ", " + _x_0;
    return _name_0 + _x_1;
  }
}
function $refLine$(_name_0, _page_0) {
  return run_jump($refLine$if$, [_name_0, _page_0, run_loop($String$is_empty$(run_loop($String$trim$(_name_0))))]);
}
function $refNone$() {
  return "sem referência";
}
function $refPrefix$() {
  return "Referência: ";
}
function $questionLabel$() {
  return "A questão";
}
function $attemptLabel$() {
  return "O que você tentou";
}
function $difficultyLabel$() {
  return "Onde travou";
}
function $dialogTitle$() {
  return "Guardar para revisar";
}
function $saveLabel$() {
  return "Salvar";
}
function $cancelLabel$() {
  return "Cancelar";
}
function $similarLabel$() {
  return "Semelhante";
}
function $similarTitle$() {
  return "Pedir um exercício semelhante com outros números";
}
function $redoLabel$() {
  return "Tentar de novo";
}
function $redoTitle$() {
  return "Refazer este exercício no composer";
}
function $editTitle$() {
  return "Editar o item do caderno";
}
function $removeLabel$() {
  return "Remover";
}
function $removeTitle$() {
  return "Remover o item do caderno";
}
function $saveActionLabel$() {
  return "Guardar para revisar";
}
function $saveActionTitle$() {
  return "Guardar esta resposta para revisar depois";
}
function $refNodeFrom$(_name_0, _page_0, _path_0) {
  const _x_0 = run_loop($refLine$(_name_0, _page_0));
  const _x_1 = run_loop($refLine$(_name_0, _page_0));
  return run_jump($view$viewEl$, ["button", { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrClass$("review-ref")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("page", run_loop($Nat$show$(_page_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("path", _path_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("name", _name_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrTitle$("Abrir " + _x_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("label", "Abrir " + _x_1)), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "OpenReviewRef")), ["tail"]: { $: "Nil" } } } } } } } } }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($refLine$(_name_0, _page_0)))), ["tail"]: { $: "Nil" } }]);
}
function $refNode$(_ref_0) {
  const _name_0 = _ref_0["name"];
  const _page_0 = _ref_0["page"];
  const _path_0 = _ref_0["path"];
  return run_jump($refNodeFrom$, [_name_0, _page_0, _path_0]);
}
function $refNodeWhen$(_ref_0) {
  const _name_0 = _ref_0["name"];
  const _page_0 = _ref_0["page"];
  const _path_0 = _ref_0["path"];
  return run_jump($view$viewWhen$, [run_loop($Bool$not$(run_loop($String$is_empty$(run_loop($String$trim$(_path_0)))))), run_loop($refNodeFrom$(_name_0, _page_0, _path_0))]);
}
function $troubleNode$(_difficulty_0) {
  return run_jump($view$viewWhen$, [run_loop($Bool$not$(run_loop($String$is_empty$(run_loop($String$trim$(_difficulty_0)))))), run_loop($view$viewEl$("p", { $: "Con", ["head"]: run_loop($view$attrClass$("review-trouble")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$(_difficulty_0)), ["tail"]: { $: "Nil" } }))]);
}
function $attemptNode$(_attempt_0) {
  return run_jump($view$viewWhen$, [run_loop($Bool$not$(run_loop($String$is_empty$(run_loop($String$trim$(_attempt_0)))))), run_loop($view$viewEl$("p", { $: "Con", ["head"]: run_loop($view$attrClass$("review-attempt")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$(_attempt_0)), ["tail"]: { $: "Nil" } }))]);
}
function $actionButton$(_id_0, _cls_0, _label_0, _title_0, _action_0) {
  return run_jump($view$viewEl$, ["button", { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrClass$(_cls_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("id", run_loop($Nat$show$(_id_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrTitle$(_title_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("label", _title_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", _action_0)), ["tail"]: { $: "Nil" } } } } } } }, { $: "Con", ["head"]: run_loop($view$viewText$(_label_0)), ["tail"]: { $: "Nil" } }]);
}
function $reviewActions$(_id_0) {
  return run_jump($view$viewEl$, ["div", { $: "Con", ["head"]: run_loop($view$attrClass$("review-actions")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($actionButton$(_id_0, "review-similar", run_loop($similarLabel$()), run_loop($similarTitle$()), "SimilarReview")), ["tail"]: { $: "Con", ["head"]: run_loop($actionButton$(_id_0, "review-redo", run_loop($redoLabel$()), run_loop($redoTitle$()), "RedoReview")), ["tail"]: { $: "Con", ["head"]: run_loop($actionButton$(_id_0, "review-remove", run_loop($removeLabel$()), run_loop($removeTitle$()), "RemoveReview")), ["tail"]: { $: "Nil" } } } }]);
}
function $reviewRow$(_id_0, _item_0) {
  const _question_0 = _item_0["question"];
  const _attempt_0 = _item_0["attempt"];
  const _difficulty_0 = _item_0["difficulty"];
  const _ref_0 = _item_0["ref"];
  return run_jump($view$viewEl$, ["article", run_loop($view$attrJoin$({ $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrClass$("review-item")), ["tail"]: { $: "Nil" } }, ["tail"]: { $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrData$("id", run_loop($Nat$show$(_id_0)))), ["tail"]: { $: "Nil" } }, ["tail"]: { $: "Nil" } } })), run_loop($view$viewJoin$({ $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$viewEl$("button", { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrClass$("review-open")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("id", run_loop($Nat$show$(_id_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrTitle$(run_loop($editTitle$()))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("label", run_loop($editTitle$()))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "EditReview")), ["tail"]: { $: "Nil" } } } } } } }, { $: "Con", ["head"]: run_loop($view$viewText$(_question_0)), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Nil" } }, ["tail"]: { $: "Con", ["head"]: run_loop($troubleNode$(_difficulty_0)), ["tail"]: { $: "Con", ["head"]: run_loop($attemptNode$(_attempt_0)), ["tail"]: { $: "Con", ["head"]: run_loop($refNodeWhen$(_ref_0)), ["tail"]: { $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($reviewActions$(_id_0)), ["tail"]: { $: "Nil" } }, ["tail"]: { $: "Nil" } } } } } }))]);
}
function $reviewRows$go$(_items_0, _i_0) {
  if (_items_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _items_0["head"];
    const _t_0 = _items_0["tail"];
    return { $: "Con", ["head"]: run_loop($reviewRow$(_i_0, _h_0)), ["tail"]: run_loop($reviewRows$go$(_t_0, nat_chk(_i_0 + 1n))) };
  }
}
function $reviewRows$(_items_0) {
  return run_jump($reviewRows$go$, [_items_0, 0n]);
}
function $reviewBar$(_count_0) {
  return run_jump($view$viewEl$, ["div", { $: "Con", ["head"]: run_loop($view$attrClass$("review-head")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewEl$("h2", { $: "Nil" }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($reviewTitle$()))), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("span", { $: "Con", ["head"]: run_loop($view$attrClass$("review-count")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($countText$(_count_0)))), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("button", { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrClass$("review-close")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrTitle$(run_loop($closeLabel$()))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("label", run_loop($closeLabel$()))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "CloseReview")), ["tail"]: { $: "Nil" } } } } } }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($closeLabel$()))), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Nil" } } } }]);
}
function $reviewEmpty$() {
  return run_jump($view$viewEl$, ["p", { $: "Con", ["head"]: run_loop($view$attrClass$("review-empty")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($emptyText$()))), ["tail"]: { $: "Nil" } }]);
}
function $reviewQuestionField$(_value_0) {
  return run_jump($view$viewEl$, ["label", { $: "Nil" }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($questionLabel$()))), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("textarea", { $: "Con", ["head"]: run_loop($view$attrId$("review-question")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attr$("rows", "3")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attr$("required", "")), ["tail"]: { $: "Nil" } } } }, { $: "Con", ["head"]: run_loop($view$viewText$(_value_0)), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Nil" } } }]);
}
function $reviewAttemptField$(_value_0) {
  return run_jump($view$viewEl$, ["label", { $: "Nil" }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($attemptLabel$()))), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("textarea", { $: "Con", ["head"]: run_loop($view$attrId$("review-attempt")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attr$("rows", "3")), ["tail"]: { $: "Nil" } } }, { $: "Con", ["head"]: run_loop($view$viewText$(_value_0)), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Nil" } } }]);
}
function $reviewDifficultyField$(_value_0) {
  return run_jump($view$viewEl$, ["label", { $: "Nil" }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($difficultyLabel$()))), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("input", { $: "Con", ["head"]: run_loop($view$attrId$("review-difficulty")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrType$("text")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attr$("value", _value_0)), ["tail"]: { $: "Nil" } } } }, { $: "Nil" })), ["tail"]: { $: "Nil" } } }]);
}
function $refHint$if$(_name_0, _page_0, _noPath_0) {
  if (_noPath_0) {
    const _x_0 = run_loop($refPrefix$());
    const _x_1 = run_loop($refNone$());
    return _x_0 + _x_1;
  } else {
    const _x_2 = run_loop($refPrefix$());
    const _x_3 = run_loop($refLine$(_name_0, _page_0));
    return _x_2 + _x_3;
  }
}
function $refHint$(_ref_0) {
  const _name_0 = _ref_0["name"];
  const _page_0 = _ref_0["page"];
  const _path_0 = _ref_0["path"];
  return run_jump($refHint$if$, [_name_0, _page_0, run_loop($String$is_empty$(run_loop($String$trim$(_path_0))))]);
}
function $reviewDialogActions$() {
  return run_jump($view$viewEl$, ["div", { $: "Con", ["head"]: run_loop($view$attrClass$("dialog-actions")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewEl$("button", { $: "Con", ["head"]: run_loop($view$attr$("value", "cancel")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attr$("formnovalidate", "")), ["tail"]: { $: "Nil" } } }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($cancelLabel$()))), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("button", { $: "Con", ["head"]: run_loop($view$attrId$("review-save")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attr$("value", "ok")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrClass$("primary")), ["tail"]: { $: "Nil" } } } }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($saveLabel$()))), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Nil" } } }]);
}
function $reviewDialogChildren$(_question_0, _attempt_0, _difficulty_0, _hint_0) {
  return { $: "Con", ["head"]: run_loop($view$viewEl$("h2", { $: "Nil" }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($dialogTitle$()))), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("p", run_loop($view$attrJoin$({ $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrId$("review-ref")), ["tail"]: { $: "Nil" } }, ["tail"]: { $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrClass$("help-lead")), ["tail"]: { $: "Nil" } }, ["tail"]: { $: "Nil" } } })), { $: "Con", ["head"]: run_loop($view$viewText$(_hint_0)), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Con", ["head"]: run_loop($reviewQuestionField$(_question_0)), ["tail"]: { $: "Con", ["head"]: run_loop($reviewAttemptField$(_attempt_0)), ["tail"]: { $: "Con", ["head"]: run_loop($reviewDifficultyField$(_difficulty_0)), ["tail"]: { $: "Con", ["head"]: run_loop($reviewDialogActions$()), ["tail"]: { $: "Nil" } } } } } } };
}
function $attemptSuffix$if$(_attempt_0, _none_0) {
  if (_none_0) {
    return "";
  } else {
    return `
O que eu tentei: ` + _attempt_0;
  }
}
function $attemptSuffix$(_attempt_0) {
  return run_jump($attemptSuffix$if$, [_attempt_0, run_loop($String$is_empty$(run_loop($String$trim$(_attempt_0))))]);
}
function $troubleSuffix$if$(_difficulty_0, _none_0) {
  if (_none_0) {
    return "";
  } else {
    return `
Onde eu travei: ` + _difficulty_0;
  }
}
function $troubleSuffix$(_difficulty_0) {
  return run_jump($troubleSuffix$if$, [_difficulty_0, run_loop($String$is_empty$(run_loop($String$trim$(_difficulty_0))))]);
}
function $refSuffix$if$(_name_0, _page_0, _noPath_0) {
  if (_noPath_0) {
    return "";
  } else {
    const _x_0 = run_loop($refPrefix$());
    const _x_1 = run_loop($refLine$(_name_0, _page_0));
    const _x_2 = _x_0 + _x_1;
    return `
` + _x_2;
  }
}
function $refSuffix$(_ref_0) {
  const _name_0 = _ref_0["name"];
  const _page_0 = _ref_0["page"];
  const _path_0 = _ref_0["path"];
  return run_jump($refSuffix$if$, [_name_0, _page_0, run_loop($String$is_empty$(run_loop($String$trim$(_path_0))))]);
}
function $similarPrompt$(_item_0) {
  const _question_0 = _item_0["question"];
  const __0 = _item_0["attempt"];
  const _difficulty_0 = _item_0["difficulty"];
  const _ref_0 = _item_0["ref"];
  const _x_0 = run_loop($troubleSuffix$(_difficulty_0));
  const _x_1 = run_loop($refSuffix$(_ref_0));
  const _x_2 = _x_0 + _x_1;
  const _x_3 = _question_0 + _x_2;
  return `Quero um exercício semelhante a este, com outros números:
` + _x_3;
}
function $redoPrompt$(_item_0) {
  const _question_0 = _item_0["question"];
  const _attempt_0 = _item_0["attempt"];
  const _difficulty_0 = _item_0["difficulty"];
  const _ref_0 = _item_0["ref"];
  const _x_0 = run_loop($troubleSuffix$(_difficulty_0));
  const _x_1 = run_loop($refSuffix$(_ref_0));
  const _x_2 = run_loop($attemptSuffix$(_attempt_0));
  const _x_3 = _x_0 + _x_1;
  const _x_4 = _x_2 + _x_3;
  const _x_5 = _question_0 + _x_4;
  return `Vou refazer este exercício:
` + _x_5;
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
function $String$take$(_s_0, _n_0) {
  if (_s_0 === "") {
    return "";
  } else {
    const _h_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(0, 2) : _s_0[0];
    const _t_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(2) : _s_0.slice(1);
    if (_n_0 === 0n) {
      return "";
    } else {
      const _p_0 = _n_0 - 1n;
      return _h_0 + run_loop($String$take$(_t_0, _p_0));
    }
  }
}
function $Nat$is_gt$(_a_0, _b_0) {
  return run_jump($Cmp$is_gt$, [cmp_new(_a_0, _b_0)]);
}
function $String$trim$(_s_0) {
  return run_jump($String$trim_end$, [run_loop($String$trim_start$(_s_0))]);
}
function $Bool$and$(_a_0, _b_0) {
  if (!_a_0) {
    return false;
  } else {
    return _b_0;
  }
}
function $Nat$is_eq$(_a_0, _b_0) {
  return run_jump($Cmp$is_eq$, [cmp_new(_a_0, _b_0)]);
}
function $Nat$show$(_n_0) {
  const _m_0 = _n_0;
  return run_jump($Nat$show$fin$, [_m_0, "", run_loop($Nat$show$put$(nat_divmod(_m_0, 10n)))]);
}
function $Bool$not$(_b_0) {
  if (!_b_0) {
    return true;
  } else {
    return false;
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
function $Cmp$is_gt$(_c_0) {
  if (_c_0.$ === "LT") {
    return false;
  } else if (_c_0.$ === "EQ") {
    return false;
  } else {
    return true;
  }
}
function $String$trim_end$(_s_0) {
  return run_jump($String$reverse$, [run_loop($String$trim_start$(run_loop($String$reverse$(_s_0))))]);
}
function $String$trim_start$(_s_0) {
  if (_s_0 === "") {
    return "";
  } else {
    const _h_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(0, 2) : _s_0[0];
    const _t_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(2) : _s_0.slice(1);
    return run_jump($String$trim_start$if$, [_h_0, _t_0, run_loop($Char$is_space$(_h_0))]);
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
function $Nat$show$fin$(_g_0, _acc_0, _dq_0) {
  const _d_0 = _dq_0["fst"];
  const _t_0 = _dq_0["snd"];
  if (_t_0 === 0n) {
    return _d_0 + _acc_0;
  } else {
    const _p_0 = _t_0 - 1n;
    return run_jump($Nat$show$go$, [_g_0, nat_chk(_p_0 + 1n), _d_0 + _acc_0]);
  }
}
function $Nat$show$put$(_qr_0) {
  const _q_0 = _qr_0["fst"];
  const _r_0 = _qr_0["snd"];
  const _x_0 = nat_chk(48n + _r_0);
  return { $: "Tuple", ["fst"]: char_new(Number(_x_0 & 0xFFFFFFFFn)), ["snd"]: _q_0 };
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
function $String$reverse$(_s_0) {
  return run_jump($String$reverse$go$, [_s_0, ""]);
}
function $String$trim_start$if$(_h_0, _t_0, _space_0) {
  if (!_space_0) {
    return _h_0 + _t_0;
  } else {
    return run_jump($String$trim_start$, [_t_0]);
  }
}
function $Char$is_space$(_c_0) {
  const _x_0 = _c_0.codePointAt(0);
  const _x_1 = _x_0 === 32;
  const _x_2 = run_loop($Bool$and$(_x_0 >= 9, _x_0 <= 13));
  return _x_1 || _x_2;
}
function $Nat$show$go$(_f_0, _n_0, _acc_0) {
  if (_f_0 === 0n) {
    return _acc_0;
  } else {
    const _g_0 = _f_0 - 1n;
    return run_jump($Nat$show$fin$, [_g_0, _acc_0, run_loop($Nat$show$put$(nat_divmod(_n_0, 10n)))]);
  }
}
function $String$cmp$rec$(_h1b_0, _h2b_0, _rr_0) {
  const _t_0 = _rr_0["fst"];
  const _t1b_0 = _t_0["fst"];
  const _t2b_0 = _t_0["snd"];
  const _r_0 = _rr_0["snd"];
  return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: _h1b_0 + _t1b_0, ["snd"]: _h2b_0 + _t2b_0 }, ["snd"]: _r_0 };
}
function $String$reverse$go$(_s_0, _acc_0) {
  if (_s_0 === "") {
    return _acc_0;
  } else {
    const _h_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(0, 2) : _s_0[0];
    const _t_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(2) : _s_0.slice(1);
    return run_jump($String$reverse$go$, [_t_0, _h_0 + _acc_0]);
  }
}
var review_default = {
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
  maxQuestion: run_lib($maxQuestion$, 0),
  maxAttempt: run_lib($maxAttempt$, 0),
  maxDifficulty: run_lib($maxDifficulty$, 0),
  maxName: run_lib($maxName$, 0),
  maxPath: run_lib($maxPath$, 0),
  maxItems: run_lib($maxItems$, 0),
  "cutReview.if": run_lib($cutReview$if$, 3),
  cutReview: run_lib($cutReview$, 2),
  clip: run_lib($clip$, 2),
  fitQuestion: run_lib($fitQuestion$, 1),
  fitAttempt: run_lib($fitAttempt$, 1),
  fitDifficulty: run_lib($fitDifficulty$, 1),
  fitName: run_lib($fitName$, 1),
  fitPath: run_lib($fitPath$, 1),
  "pageFloor.if": run_lib($pageFloor$if$, 2),
  pageFloor: run_lib($pageFloor$, 1),
  newRef: run_lib($newRef$, 3),
  newItem: run_lib($newItem$, 6),
  "keepQuestion.blank": run_lib($keepQuestion$blank$, 1),
  keepQuestion: run_lib($keepQuestion$, 1),
  keepItem: run_lib($keepItem$, 1),
  sameRef: run_lib($sameRef$, 2),
  sameItem: run_lib($sameItem$, 2),
  "dropSame.head": run_lib($dropSame$head$, 3),
  "dropSame.go": run_lib($dropSame$go$, 2),
  "takeItems.go": run_lib($takeItems$go$, 2),
  addItem: run_lib($addItem$, 2),
  "replaceSame.head": run_lib($replaceSame$head$, 4),
  "replaceSame.go": run_lib($replaceSame$go$, 3),
  replaceSame: run_lib($replaceSame$, 3),
  removeSame: run_lib($removeSame$, 2),
  reviewTitle: run_lib($reviewTitle$, 0),
  closeLabel: run_lib($closeLabel$, 0),
  emptyText: run_lib($emptyText$, 0),
  "countText.if": run_lib($countText$if$, 2),
  countText: run_lib($countText$, 1),
  pageLabel: run_lib($pageLabel$, 1),
  "refLine.if": run_lib($refLine$if$, 3),
  refLine: run_lib($refLine$, 2),
  refNone: run_lib($refNone$, 0),
  refPrefix: run_lib($refPrefix$, 0),
  questionLabel: run_lib($questionLabel$, 0),
  attemptLabel: run_lib($attemptLabel$, 0),
  difficultyLabel: run_lib($difficultyLabel$, 0),
  dialogTitle: run_lib($dialogTitle$, 0),
  saveLabel: run_lib($saveLabel$, 0),
  cancelLabel: run_lib($cancelLabel$, 0),
  similarLabel: run_lib($similarLabel$, 0),
  similarTitle: run_lib($similarTitle$, 0),
  redoLabel: run_lib($redoLabel$, 0),
  redoTitle: run_lib($redoTitle$, 0),
  editTitle: run_lib($editTitle$, 0),
  removeLabel: run_lib($removeLabel$, 0),
  removeTitle: run_lib($removeTitle$, 0),
  saveActionLabel: run_lib($saveActionLabel$, 0),
  saveActionTitle: run_lib($saveActionTitle$, 0),
  refNodeFrom: run_lib($refNodeFrom$, 3),
  refNode: run_lib($refNode$, 1),
  refNodeWhen: run_lib($refNodeWhen$, 1),
  troubleNode: run_lib($troubleNode$, 1),
  attemptNode: run_lib($attemptNode$, 1),
  actionButton: run_lib($actionButton$, 5),
  reviewActions: run_lib($reviewActions$, 1),
  reviewRow: run_lib($reviewRow$, 2),
  "reviewRows.go": run_lib($reviewRows$go$, 2),
  reviewRows: run_lib($reviewRows$, 1),
  reviewBar: run_lib($reviewBar$, 1),
  reviewEmpty: run_lib($reviewEmpty$, 0),
  reviewQuestionField: run_lib($reviewQuestionField$, 1),
  reviewAttemptField: run_lib($reviewAttemptField$, 1),
  reviewDifficultyField: run_lib($reviewDifficultyField$, 1),
  "refHint.if": run_lib($refHint$if$, 3),
  refHint: run_lib($refHint$, 1),
  reviewDialogActions: run_lib($reviewDialogActions$, 0),
  reviewDialogChildren: run_lib($reviewDialogChildren$, 4),
  "attemptSuffix.if": run_lib($attemptSuffix$if$, 2),
  attemptSuffix: run_lib($attemptSuffix$, 1),
  "troubleSuffix.if": run_lib($troubleSuffix$if$, 2),
  troubleSuffix: run_lib($troubleSuffix$, 1),
  "refSuffix.if": run_lib($refSuffix$if$, 3),
  refSuffix: run_lib($refSuffix$, 1),
  similarPrompt: run_lib($similarPrompt$, 1),
  redoPrompt: run_lib($redoPrompt$, 1)
};
export {
  review_default as default
};

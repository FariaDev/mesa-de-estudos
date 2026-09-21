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
function $view$attr$(name_0, value_0) {
  return { $: "ViewAttr", ["name"]: name_0, ["value"]: value_0 };
}
function $view$classOn$(name_0, on_0) {
  return { $: "ViewClass", ["name"]: name_0, ["on"]: on_0 };
}
function $view$viewEl$(tag_0, attrs_0, kids_0) {
  return { $: "ViewEl", ["tag"]: tag_0, ["attrs"]: attrs_0, ["kids"]: kids_0 };
}
function $view$viewText$(s_0) {
  return { $: "ViewText", ["text"]: s_0 };
}
function $view$viewKey$(tag_0, key_0, attrs_0, kids_0) {
  return run_jump($view$viewEl$, [tag_0, { $: "Con", ["head"]: { $: "ViewAttr", ["name"]: "key", ["value"]: key_0 }, ["tail"]: attrs_0 }, kids_0]);
}
function $view$tagOf$(n_0) {
  if (n_0.$ === "ViewEl") {
    const tag_0 = n_0.tag;
    const attrs_0 = n_0.attrs;
    const kids_0 = n_0.kids;
    return tag_0;
  } else {
    const text_0 = n_0.text;
    return "";
  }
}
function $view$attrsOf$(n_0) {
  if (n_0.$ === "ViewEl") {
    const tag_0 = n_0.tag;
    const attrs_0 = n_0.attrs;
    const kids_0 = n_0.kids;
    return attrs_0;
  } else {
    const text_0 = n_0.text;
    return { $: "Nil" };
  }
}
function $view$kidsOf$(n_0) {
  if (n_0.$ === "ViewEl") {
    const tag_0 = n_0.tag;
    const attrs_0 = n_0.attrs;
    const kids_0 = n_0.kids;
    return kids_0;
  } else {
    const text_0 = n_0.text;
    return { $: "Nil" };
  }
}
function $view$textOf$(n_0) {
  if (n_0.$ === "ViewEl") {
    const tag_0 = n_0.tag;
    const attrs_0 = n_0.attrs;
    const kids_0 = n_0.kids;
    return "";
  } else {
    const text_0 = n_0.text;
    return text_0;
  }
}
function $view$isEl$(n_0) {
  if (n_0.$ === "ViewEl") {
    const tag_0 = n_0.tag;
    const attrs_0 = n_0.attrs;
    const kids_0 = n_0.kids;
    return true;
  } else {
    const text_0 = n_0.text;
    return false;
  }
}
function $view$isText$(n_0) {
  if (n_0.$ === "ViewEl") {
    const tag_0 = n_0.tag;
    const attrs_0 = n_0.attrs;
    const kids_0 = n_0.kids;
    return false;
  } else {
    const text_0 = n_0.text;
    return true;
  }
}
function $view$attrGet$choose$(av_0, rest_0, same_0) {
  if (same_0) {
    return { $: "Some", ["value"]: av_0 };
  } else {
    return rest_0;
  }
}
function $view$attrGet$go$(attrs_0, name_0) {
  if (attrs_0.$ === "Nil") {
    return { $: "None" };
  } else {
    const _t_0 = attrs_0.head;
    const an_0 = _t_0.name;
    const av_0 = _t_0.value;
    const t_0 = attrs_0.tail;
    return run_jump($view$attrGet$choose$, [av_0, run_loop($view$attrGet$go$(t_0, name_0)), run_loop($String$eq$(an_0, name_0))]);
  }
}
function $view$attrGet$(attrs_0, name_0) {
  return run_jump($view$attrGet$go$, [attrs_0, name_0]);
}
function $view$attrWhen$(cond_0, a_0) {
  if (cond_0) {
    return { $: "Con", ["head"]: a_0, ["tail"]: { $: "Nil" } };
  } else {
    return { $: "Nil" };
  }
}
function $view$attrConcat$(xs_0, ys_0) {
  return run_jump($List$append$, [xs_0, ys_0]);
}
function $view$attrJoin$(xss_0) {
  return run_jump($List$concat$, [xss_0]);
}
function $view$attrId$(value_0) {
  return { $: "ViewAttr", ["name"]: "id", ["value"]: value_0 };
}
function $view$attrClass$(value_0) {
  return { $: "ViewAttr", ["name"]: "class", ["value"]: value_0 };
}
function $view$attrType$(value_0) {
  return { $: "ViewAttr", ["name"]: "type", ["value"]: value_0 };
}
function $view$attrTitle$(value_0) {
  return { $: "ViewAttr", ["name"]: "title", ["value"]: value_0 };
}
function $view$attrKey$(value_0) {
  return { $: "ViewAttr", ["name"]: "key", ["value"]: value_0 };
}
function $view$attrOn$(event_0, handler_0) {
  return { $: "ViewAttr", ["name"]: "on:" + event_0, ["value"]: handler_0 };
}
function $view$attrData$(name_0, value_0) {
  return { $: "ViewAttr", ["name"]: "data-" + name_0, ["value"]: value_0 };
}
function $view$attrAria$(name_0, value_0) {
  return { $: "ViewAttr", ["name"]: "aria-" + name_0, ["value"]: value_0 };
}
function $view$boolStr$(on_0) {
  if (on_0) {
    return "true";
  } else {
    return "false";
  }
}
function $view$attrBool$(name_0, on_0) {
  return { $: "ViewAttr", ["name"]: name_0, ["value"]: run_loop($view$boolStr$(on_0)) };
}
function $view$classAppend$empty$(acc_0, name_0, empty_0) {
  if (empty_0) {
    return name_0;
  } else {
    const x_0 = " " + name_0;
    return acc_0 + x_0;
  }
}
function $view$classAppend$(acc_0, name_0) {
  return run_jump($view$classAppend$empty$, [acc_0, name_0, run_loop($String$is_empty$(acc_0))]);
}
function $view$classNext$emptyName$(name_0, acc_0, emptyName_0) {
  if (emptyName_0) {
    return acc_0;
  } else {
    return run_jump($view$classAppend$, [acc_0, name_0]);
  }
}
function $view$classNext$on$(name_0, on_0, acc_0) {
  if (!on_0) {
    return acc_0;
  } else {
    return run_jump($view$classNext$emptyName$, [name_0, acc_0, run_loop($String$is_empty$(name_0))]);
  }
}
function $view$classValue$go$(xs_0, acc_0) {
  if (xs_0.$ === "Nil") {
    return acc_0;
  } else {
    const _t_0 = xs_0.head;
    const name_0 = _t_0.name;
    const on_0 = _t_0.on;
    const t_0 = xs_0.tail;
    return run_jump($view$classValue$go$, [t_0, run_loop($view$classNext$on$(name_0, on_0, acc_0))]);
  }
}
function $view$classValue$(xs_0) {
  return run_jump($view$classValue$go$, [xs_0, ""]);
}
function $view$classes$(xs_0) {
  return { $: "ViewAttr", ["name"]: "class", ["value"]: run_loop($view$classValue$(xs_0)) };
}
function $view$viewWhen$(cond_0, node_0) {
  if (cond_0) {
    return { $: "Con", ["head"]: node_0, ["tail"]: { $: "Nil" } };
  } else {
    return { $: "Nil" };
  }
}
function $view$viewWhenAll$(cond_0, nodes_0) {
  if (cond_0) {
    return nodes_0;
  } else {
    return { $: "Nil" };
  }
}
function $view$viewConcat$(xs_0, ys_0) {
  return run_jump($List$append$, [xs_0, ys_0]);
}
function $view$viewJoin$(xss_0) {
  return run_jump($List$concat$, [xss_0]);
}
function $view$viewMap$0$(xs_0) {
  if (xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const h_0 = xs_0.head;
    const t_0 = xs_0.tail;
    return { $: "Con", ["head"]: run_loop($view$viewText$(h_0)), ["tail"]: run_loop($view$viewMap$0$(t_0)) };
  }
}
function $view$viewMapText$(xs_0) {
  return run_jump($view$viewMap$0$, [xs_0]);
}
function $view$asTextI$(i_0, s_0) {
  return run_jump($view$viewText$, [s_0]);
}
function $view$viewMapI$go$0$(xs_0, i_0) {
  if (xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const h_0 = xs_0.head;
    const t_0 = xs_0.tail;
    return { $: "Con", ["head"]: run_loop($view$asTextI$(i_0, h_0)), ["tail"]: run_loop($view$viewMapI$go$0$(t_0, nat_chk(i_0 + 1n))) };
  }
}
function $view$viewMapTextI$go$(xs_0, i_0) {
  return run_jump($view$viewMapI$go$0$, [xs_0, i_0]);
}
function $view$viewMapTextI$(xs_0) {
  return run_jump($view$viewMapTextI$go$, [xs_0, 0n]);
}
function $off$(on_0) {
  if (on_0) {
    return false;
  } else {
    return true;
  }
}
function $roleName$(user_0) {
  if (user_0) {
    return "user";
  } else {
    return "assistant";
  }
}
function $roleLabel$(user_0) {
  if (user_0) {
    return "Você";
  } else {
    return "Pi";
  }
}
function $messageClasses$(user_0) {
  return { $: "Con", ["head"]: run_loop($view$classOn$("message", true)), ["tail"]: { $: "Con", ["head"]: run_loop($view$classOn$("user", user_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$classOn$("assistant", run_loop($off$(user_0)))), ["tail"]: { $: "Nil" } } } };
}
function $messageAttrs$(user_0) {
  return { $: "Con", ["head"]: run_loop($view$classes$(run_loop($messageClasses$(user_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("role", run_loop($roleName$(user_0)))), ["tail"]: { $: "Nil" } } };
}
function $roleNode$(label_0) {
  return run_jump($view$viewEl$, ["div", { $: "Con", ["head"]: run_loop($view$attrClass$("role")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$(label_0)), ["tail"]: { $: "Nil" } }]);
}
function $shot$(src_0) {
  return run_jump($view$viewEl$, ["img", { $: "Con", ["head"]: run_loop($view$attrClass$("shot")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attr$("src", src_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$attr$("alt", "Imagem enviada")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attr$("loading", "lazy")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attr$("decoding", "async")), ["tail"]: { $: "Nil" } } } } } }, { $: "Nil" }]);
}
function $shotNodes$(xs_0) {
  if (xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const h_0 = xs_0.head;
    const t_0 = xs_0.tail;
    return { $: "Con", ["head"]: run_loop($shot$(h_0)), ["tail"]: run_loop($shotNodes$(t_0)) };
  }
}
function $messageBody$(markup_0, images_0) {
  return run_jump($view$viewEl$, ["div", { $: "Con", ["head"]: run_loop($view$attrClass$("body")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: markup_0, ["tail"]: run_loop($shotNodes$(images_0)) }]);
}
function $messageAction$(className_0, label_0, handler_0) {
  return run_jump($view$viewEl$, ["button", { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrClass$(className_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", handler_0)), ["tail"]: { $: "Nil" } } } }, { $: "Con", ["head"]: run_loop($view$viewText$(label_0)), ["tail"]: { $: "Nil" } }]);
}
function $messageActions$(canCopy_0, canQuote_0) {
  return run_jump($view$viewConcat$, [run_loop($view$viewWhen$(canCopy_0, run_loop($messageAction$("msg-copy", "Copiar", "CopyMessage")))), run_loop($view$viewWhen$(canQuote_0, run_loop($messageAction$("msg-quote", "Citar", "QuoteMessage"))))]);
}
function $messageKids$(user_0, markup_0, images_0, canCopy_0, canQuote_0) {
  return run_jump($view$viewConcat$, [{ $: "Con", ["head"]: run_loop($roleNode$(run_loop($roleLabel$(user_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($messageBody$(markup_0, images_0)), ["tail"]: { $: "Nil" } } }, run_loop($messageActions$(canCopy_0, canQuote_0))]);
}
function $message$(user_0, markup_0, images_0, canCopy_0, canQuote_0) {
  return run_jump($view$viewEl$, ["article", run_loop($messageAttrs$(user_0)), run_loop($messageKids$(user_0, markup_0, images_0, canCopy_0, canQuote_0))]);
}
function $citation$(text_0) {
  return run_jump($view$viewEl$, ["blockquote", { $: "Con", ["head"]: run_loop($view$attrClass$("citation")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$(text_0)), ["tail"]: { $: "Nil" } }]);
}
function $talkChip$(kind_0, label_0) {
  return run_jump($view$viewEl$, ["span", { $: "Con", ["head"]: run_loop($view$classes$({ $: "Con", ["head"]: run_loop($view$classOn$("talk-chip", true)), ["tail"]: { $: "Con", ["head"]: run_loop($view$classOn$(kind_0, true)), ["tail"]: { $: "Nil" } } })), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("kind", kind_0)), ["tail"]: { $: "Nil" } } }, { $: "Con", ["head"]: run_loop($view$viewText$(label_0)), ["tail"]: { $: "Nil" } }]);
}
function $thinkingChip$(label_0) {
  return run_jump($talkChip$, ["thinking", label_0]);
}
function $toolChip$(label_0) {
  return run_jump($talkChip$, ["tool", label_0]);
}
function $emptyState$() {
  return run_jump($view$viewEl$, ["div", { $: "Con", ["head"]: run_loop($view$attrId$("welcome")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewEl$("button", { $: "Con", ["head"]: run_loop($view$attrId$("connect")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "Connect")), ["tail"]: { $: "Nil" } } } }, { $: "Con", ["head"]: run_loop($view$viewText$("Conectar ao Pi")), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("p", { $: "Nil" }, { $: "Con", ["head"]: run_loop($view$viewText$("Sessão local desta matéria.")), ["tail"]: { $: "Nil" } })), ["tail"]: { $: "Nil" } } }]);
}
function $typingState$(label_0) {
  return run_jump($view$viewEl$, ["article", { $: "Con", ["head"]: run_loop($view$attrClass$("message assistant typing")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("role", "assistant")), ["tail"]: { $: "Nil" } } }, { $: "Con", ["head"]: run_loop($roleNode$("Pi")), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("div", { $: "Con", ["head"]: run_loop($view$attrClass$("body")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewEl$("span", { $: "Con", ["head"]: run_loop($view$attrClass$("pulse")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("hidden", "true")), ["tail"]: { $: "Nil" } } }, { $: "Nil" })), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewText$(label_0)), ["tail"]: { $: "Nil" } } })), ["tail"]: { $: "Nil" } } }]);
}
function $assetImg$go$(src_0, path_0, alt_0) {
  return run_jump($view$viewEl$, ["img", { $: "Con", ["head"]: run_loop($view$attrClass$("plot")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attr$("src", src_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("path", path_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$attr$("alt", alt_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$attr$("loading", "lazy")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attr$("decoding", "async")), ["tail"]: { $: "Nil" } } } } } } }, { $: "Nil" }]);
}
function $assetCaption$(caption_0) {
  return run_jump($view$viewWhen$, [run_loop($Bool$not$(run_loop($String$is_empty$(caption_0)))), run_loop($view$viewEl$("figcaption", { $: "Nil" }, { $: "Con", ["head"]: run_loop($view$viewText$(caption_0)), ["tail"]: { $: "Nil" } }))]);
}
function $assetKids$go$(src_0, path_0, alt_0, caption_0) {
  return run_jump($List$append$, [{ $: "Con", ["head"]: run_loop($assetImg$go$(src_0, path_0, alt_0)), ["tail"]: { $: "Nil" } }, run_loop($assetCaption$(caption_0))]);
}
function $assetKids$(row_0) {
  const src_0 = row_0.src;
  const path_0 = row_0.path;
  const alt_0 = row_0.alt;
  const caption_0 = row_0.caption;
  return run_jump($assetKids$go$, [src_0, path_0, alt_0, caption_0]);
}
function $assetFigure$go$(src_0, path_0, alt_0, caption_0) {
  return run_jump($view$viewEl$, ["figure", { $: "Con", ["head"]: run_loop($view$attrClass$("asset")), ["tail"]: { $: "Nil" } }, run_loop($assetKids$go$(src_0, path_0, alt_0, caption_0))]);
}
function $assetFigure$(row_0) {
  const src_0 = row_0.src;
  const path_0 = row_0.path;
  const alt_0 = row_0.alt;
  const caption_0 = row_0.caption;
  return run_jump($assetFigure$go$, [src_0, path_0, alt_0, caption_0]);
}
function $assetFallback$(source_0) {
  return run_jump($view$viewEl$, ["code", { $: "Nil" }, { $: "Con", ["head"]: run_loop($view$viewText$(source_0)), ["tail"]: { $: "Nil" } }]);
}
function $codeCopy$() {
  return run_jump($view$viewEl$, ["button", { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrClass$("code-copy")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("label", "Copiar código")), ["tail"]: { $: "Nil" } } } }, { $: "Con", ["head"]: run_loop($view$viewText$("cópia")), ["tail"]: { $: "Nil" } }]);
}
function $codeBlock$kids$(lang_0, pre_0) {
  return run_jump($view$viewConcat$, [run_loop($view$viewWhen$(run_loop($Bool$not$(run_loop($String$is_empty$(lang_0)))), run_loop($view$viewEl$("span", { $: "Con", ["head"]: run_loop($view$attrClass$("code-lang")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$(lang_0)), ["tail"]: { $: "Nil" } })))), { $: "Con", ["head"]: run_loop($codeCopy$()), ["tail"]: { $: "Con", ["head"]: pre_0, ["tail"]: { $: "Nil" } } }]);
}
function $codeBlock$(pre_0, lang_0) {
  return run_jump($view$viewEl$, ["div", { $: "Con", ["head"]: run_loop($view$attrClass$("codeblock")), ["tail"]: { $: "Nil" } }, run_loop($codeBlock$kids$(lang_0, pre_0))]);
}
function $quizRole$(multi_0) {
  if (multi_0) {
    return "Quiz · múltipla escolha";
  } else {
    return "Quiz";
  }
}
function $quizAria$(multi_0) {
  if (multi_0) {
    return "Quiz de múltipla escolha";
  } else {
    return "Pergunta de quiz";
  }
}
function $optionRole$(multi_0) {
  if (multi_0) {
    return "checkbox";
  } else {
    return "radio";
  }
}
function $optionsRole$(multi_0) {
  if (multi_0) {
    return "group";
  } else {
    return "radiogroup";
  }
}
function $optionClasses$(correct_0, wrong_0, dim_0) {
  return { $: "Con", ["head"]: run_loop($view$classOn$("quiz-option", true)), ["tail"]: { $: "Con", ["head"]: run_loop($view$classOn$("correct", correct_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$classOn$("wrong", wrong_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$classOn$("dim", dim_0)), ["tail"]: { $: "Nil" } } } } };
}
function $optionAttrs$(label_0, index_0, multi_0, checked_0, disabled_0, correct_0, wrong_0, dim_0) {
  return run_jump($view$attrJoin$, [{ $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$classes$(run_loop($optionClasses$(correct_0, wrong_0, dim_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrKey$(run_loop($String$join$({ $: "Con", ["head"]: "quiz-option-", ["tail"]: { $: "Con", ["head"]: index_0, ["tail"]: { $: "Nil" } } }, "")))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("label", label_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("index", index_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$attr$("role", run_loop($optionRole$(multi_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("checked", run_loop($view$boolStr$(checked_0)))), ["tail"]: { $: "Nil" } } } } } } } }, ["tail"]: { $: "Con", ["head"]: run_loop($view$attrWhen$(disabled_0, run_loop($view$attr$("disabled", "")))), ["tail"]: { $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "SelectQuizOption")), ["tail"]: { $: "Nil" } }, ["tail"]: { $: "Nil" } } } }]);
}
function $markKids$(mark_0) {
  return run_jump($view$viewWhen$, [run_loop($Bool$not$(run_loop($String$is_empty$(mark_0)))), run_loop($view$viewEl$("span", { $: "Con", ["head"]: run_loop($view$attrClass$("quiz-mark")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$(mark_0)), ["tail"]: { $: "Nil" } }))]);
}
function $quizOption$go$(label_0, index_0, markup_0, checked_0, disabled_0, correct_0, wrong_0, dim_0, mark_0, multi_0) {
  return run_jump($view$viewEl$, ["button", run_loop($optionAttrs$(label_0, index_0, multi_0, checked_0, disabled_0, correct_0, wrong_0, dim_0)), run_loop($view$viewConcat$({ $: "Con", ["head"]: run_loop($view$viewEl$("span", { $: "Nil" }, { $: "Con", ["head"]: run_loop($view$viewText$(run_loop($String$join$({ $: "Con", ["head"]: index_0, ["tail"]: { $: "Con", ["head"]: ". ", ["tail"]: { $: "Nil" } } }, "")))), ["tail"]: { $: "Con", ["head"]: markup_0, ["tail"]: { $: "Nil" } } })), ["tail"]: { $: "Nil" } }, run_loop($markKids$(mark_0))))]);
}
function $quizOption$(row_0, multi_0) {
  const label_0 = row_0.label;
  const index_0 = row_0.index;
  const markup_0 = row_0.markup;
  const checked_0 = row_0.checked;
  const disabled_0 = row_0.disabled;
  const correct_0 = row_0.correct;
  const wrong_0 = row_0.wrong;
  const dim_0 = row_0.dim;
  const mark_0 = row_0.mark;
  return run_jump($quizOption$go$, [label_0, index_0, markup_0, checked_0, disabled_0, correct_0, wrong_0, dim_0, mark_0, multi_0]);
}
function $quizOptions$(xs_0, multi_0) {
  if (xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const h_0 = xs_0.head;
    const t_0 = xs_0.tail;
    return { $: "Con", ["head"]: run_loop($quizOption$(h_0, multi_0)), ["tail"]: run_loop($quizOptions$(t_0, multi_0)) };
  }
}
function $quizQuestion$(markup_0) {
  return run_jump($view$viewEl$, ["div", { $: "Con", ["head"]: run_loop($view$attrClass$("quiz-question")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: markup_0, ["tail"]: { $: "Nil" } }]);
}
function $quizDetails$(has_0, markup_0) {
  return run_jump($view$viewWhen$, [has_0, run_loop($view$viewEl$("div", { $: "Con", ["head"]: run_loop($view$attrClass$("quiz-details")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: markup_0, ["tail"]: { $: "Nil" } }))]);
}
function $quizOptionsBox$(multi_0, options_0) {
  return run_jump($view$viewEl$, ["div", { $: "Con", ["head"]: run_loop($view$attrClass$("quiz-options")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attr$("role", run_loop($optionsRole$(multi_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("label", "Opções")), ["tail"]: { $: "Nil" } } } }, run_loop($quizOptions$(options_0, multi_0))]);
}
function $sendButton$(disabled_0) {
  return run_jump($view$viewEl$, ["button", run_loop($view$attrConcat$({ $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrClass$("quiz-send primary")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrKey$("quiz-send")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "SendQuiz")), ["tail"]: { $: "Nil" } } } } }, run_loop($view$attrWhen$(disabled_0, run_loop($view$attr$("disabled", "")))))), { $: "Con", ["head"]: run_loop($view$viewText$("Enviar resposta")), ["tail"]: { $: "Nil" } }]);
}
function $skipButton$() {
  return run_jump($view$viewEl$, ["button", { $: "Con", ["head"]: run_loop($view$attrType$("button")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrClass$("quiz-skip")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrOn$("click", "SkipQuiz")), ["tail"]: { $: "Nil" } } } }, { $: "Con", ["head"]: run_loop($view$viewText$("Pular")), ["tail"]: { $: "Nil" } }]);
}
function $quizActions$(showSend_0, sendDisabled_0, showSkip_0) {
  const kids_0 = run_loop($view$viewConcat$(run_loop($view$viewWhen$(showSend_0, run_loop($sendButton$(sendDisabled_0)))), run_loop($view$viewWhen$(showSkip_0, run_loop($skipButton$())))));
  return run_jump($view$viewWhenAll$, [showSend_0 || showSkip_0, { $: "Con", ["head"]: run_loop($view$viewEl$("div", { $: "Con", ["head"]: run_loop($view$attrClass$("quiz-actions")), ["tail"]: { $: "Nil" } }, kids_0)), ["tail"]: { $: "Nil" } }]);
}
function $quizTail$(hasVerdict_0, verdict_0, hasNote_0, note_0, hasExplain_0, explain_0) {
  return run_jump($view$viewJoin$, [{ $: "Con", ["head"]: run_loop($view$viewWhen$(hasVerdict_0, run_loop($view$viewEl$("div", { $: "Con", ["head"]: run_loop($view$attrClass$("quiz-verdict")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$(verdict_0)), ["tail"]: { $: "Nil" } })))), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewWhen$(hasNote_0, run_loop($view$viewEl$("div", { $: "Con", ["head"]: run_loop($view$attrClass$("quiz-note")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: run_loop($view$viewText$("Observação: ")), ["tail"]: { $: "Con", ["head"]: note_0, ["tail"]: { $: "Nil" } } })))), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewWhen$(hasExplain_0, run_loop($view$viewEl$("div", { $: "Con", ["head"]: run_loop($view$attrClass$("quiz-explain")), ["tail"]: { $: "Nil" } }, { $: "Con", ["head"]: explain_0, ["tail"]: { $: "Nil" } })))), ["tail"]: { $: "Nil" } } } }]);
}
function $quizCard$go$(toolId_0, multi_0, question_0, hasDetails_0, details_0, options_0, showSend_0, sendDisabled_0, showSkip_0, hasVerdict_0, verdict_0, hasNote_0, note_0, hasExplain_0, explain_0) {
  const boxKids_0 = run_loop($view$viewJoin$({ $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($quizQuestion$(question_0)), ["tail"]: { $: "Nil" } }, ["tail"]: { $: "Con", ["head"]: run_loop($quizDetails$(hasDetails_0, details_0)), ["tail"]: { $: "Con", ["head"]: { $: "Con", ["head"]: run_loop($quizOptionsBox$(multi_0, options_0)), ["tail"]: { $: "Nil" } }, ["tail"]: { $: "Con", ["head"]: run_loop($quizActions$(showSend_0, sendDisabled_0, showSkip_0)), ["tail"]: { $: "Con", ["head"]: run_loop($quizTail$(hasVerdict_0, verdict_0, hasNote_0, note_0, hasExplain_0, explain_0)), ["tail"]: { $: "Nil" } } } } } }));
  return run_jump($view$viewEl$, ["article", { $: "Con", ["head"]: run_loop($view$attrClass$("message assistant quiz")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("role", "assistant")), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrData$("tool", toolId_0)), ["tail"]: { $: "Con", ["head"]: run_loop($view$attrAria$("label", run_loop($quizAria$(multi_0)))), ["tail"]: { $: "Nil" } } } } }, { $: "Con", ["head"]: run_loop($roleNode$(run_loop($quizRole$(multi_0)))), ["tail"]: { $: "Con", ["head"]: run_loop($view$viewEl$("div", { $: "Con", ["head"]: run_loop($view$attrClass$("quiz-card")), ["tail"]: { $: "Nil" } }, boxKids_0)), ["tail"]: { $: "Nil" } } }]);
}
function $quizCard$(row_0) {
  const toolId_0 = row_0.toolId;
  const multi_0 = row_0.multi;
  const question_0 = row_0.question;
  const hasDetails_0 = row_0.hasDetails;
  const details_0 = row_0.details;
  const options_0 = row_0.options;
  const showSend_0 = row_0.showSend;
  const sendDisabled_0 = row_0.sendDisabled;
  const showSkip_0 = row_0.showSkip;
  const hasVerdict_0 = row_0.hasVerdict;
  const verdict_0 = row_0.verdict;
  const hasNote_0 = row_0.hasNote;
  const note_0 = row_0.note;
  const hasExplain_0 = row_0.hasExplain;
  const explain_0 = row_0.explain;
  return run_jump($quizCard$go$, [toolId_0, multi_0, question_0, hasDetails_0, details_0, options_0, showSend_0, sendDisabled_0, showSkip_0, hasVerdict_0, verdict_0, hasNote_0, note_0, hasExplain_0, explain_0]);
}
function $String$eq$(a_0, b_0) {
  return run_jump($String$eq$fin$, [run_loop($String$cmp$(a_0, b_0))]);
}
function $List$append$(xs_0, ys_0) {
  if (xs_0.$ === "Nil") {
    return ys_0;
  } else {
    const h_0 = xs_0.head;
    const t_0 = xs_0.tail;
    return { $: "Con", ["head"]: h_0, ["tail"]: run_loop($List$append$(t_0, ys_0)) };
  }
}
function $List$concat$(xss_0) {
  if (xss_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const h_0 = xss_0.head;
    const t_0 = xss_0.tail;
    return run_jump($List$append$, [h_0, run_loop($List$concat$(t_0))]);
  }
}
function $String$is_empty$(s_0) {
  if (s_0 === "") {
    return true;
  } else {
    const h_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(0, 2) : s_0[0];
    const t_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(2) : s_0.slice(1);
    return false;
  }
}
function $Bool$not$(b_0) {
  if (!b_0) {
    return true;
  } else {
    return false;
  }
}
function $String$join$(xs_0, sep_0) {
  if (xs_0.$ === "Nil") {
    return "";
  } else {
    const h_0 = xs_0.head;
    const t_0 = xs_0.tail;
    return run_jump($String$join$go$, [t_0, h_0, sep_0]);
  }
}
function $String$eq$fin$(r_0) {
  const _t_0 = r_0.fst;
  const a2_0 = _t_0.fst;
  const b2_0 = _t_0.snd;
  const c_0 = r_0.snd;
  return run_jump($Cmp$is_eq$, [c_0]);
}
function $String$cmp$(a_0, b_0) {
  if (a_0 === "") {
    if (b_0 === "") {
      return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: "", ["snd"]: "" }, ["snd"]: { $: "EQ" } };
    } else {
      const h_0 = b_0.codePointAt(0) > 65535 ? b_0.slice(0, 2) : b_0[0];
      const t_0 = b_0.codePointAt(0) > 65535 ? b_0.slice(2) : b_0.slice(1);
      return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: "", ["snd"]: h_0 + t_0 }, ["snd"]: { $: "LT" } };
    }
  } else {
    const h_1 = a_0.codePointAt(0) > 65535 ? a_0.slice(0, 2) : a_0[0];
    const t_1 = a_0.codePointAt(0) > 65535 ? a_0.slice(2) : a_0.slice(1);
    if (b_0 === "") {
      return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: h_1 + t_1, ["snd"]: "" }, ["snd"]: { $: "GT" } };
    } else {
      const h2_0 = b_0.codePointAt(0) > 65535 ? b_0.slice(0, 2) : b_0[0];
      const t2_0 = b_0.codePointAt(0) > 65535 ? b_0.slice(2) : b_0.slice(1);
      return run_jump($String$cmp$fin$, [t_1, t2_0, run_loop($Char$cmp$(h_1, h2_0))]);
    }
  }
}
function $String$join$go$(xs_0, h_0, sep_0) {
  if (xs_0.$ === "Nil") {
    return h_0;
  } else {
    const h2_0 = xs_0.head;
    const t_0 = xs_0.tail;
    const x_0 = run_loop($String$join$go$(t_0, h2_0, sep_0));
    const x_1 = sep_0 + x_0;
    return h_0 + x_1;
  }
}
function $Cmp$is_eq$(c_0) {
  if (c_0.$ === "LT") {
    return false;
  } else if (c_0.$ === "EQ") {
    return true;
  } else {
    return false;
  }
}
function $String$cmp$fin$(t1_0, t2_0, hc_0) {
  const _t_0 = hc_0.fst;
  const h1b_0 = _t_0.fst;
  const h2b_0 = _t_0.snd;
  const _t_1 = hc_0.snd;
  if (_t_1.$ === "LT") {
    return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: h1b_0 + t1_0, ["snd"]: h2b_0 + t2_0 }, ["snd"]: { $: "LT" } };
  } else if (_t_1.$ === "EQ") {
    return run_jump($String$cmp$rec$, [h1b_0, h2b_0, run_loop($String$cmp$(t1_0, t2_0))]);
  } else {
    return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: h1b_0 + t1_0, ["snd"]: h2b_0 + t2_0 }, ["snd"]: { $: "GT" } };
  }
}
function $Char$cmp$(a_0, b_0) {
  const x_0 = a_0.codePointAt(0);
  const y_0 = b_0.codePointAt(0);
  const x_1 = x_0;
  const y_1 = y_0;
  return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: char_new(x_1), ["snd"]: char_new(y_1) }, ["snd"]: cmp_new(x_1, y_1) };
}
function $String$cmp$rec$(h1b_0, h2b_0, rr_0) {
  const _t_0 = rr_0.fst;
  const t1b_0 = _t_0.fst;
  const t2b_0 = _t_0.snd;
  const r_0 = rr_0.snd;
  return { $: "Tuple", ["fst"]: { $: "Tuple", ["fst"]: h1b_0 + t1b_0, ["snd"]: h2b_0 + t2b_0 }, ["snd"]: r_0 };
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
  "view.viewMap~0": run_lib($view$viewMap$0$, 1),
  "view.viewMapText": run_lib($view$viewMapText$, 1),
  "view.asTextI": run_lib($view$asTextI$, 2),
  "view.viewMapI.go~0": run_lib($view$viewMapI$go$0$, 2),
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
  messageActions: run_lib($messageActions$, 2),
  messageKids: run_lib($messageKids$, 5),
  message: run_lib($message$, 5),
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

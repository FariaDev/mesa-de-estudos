// GERADO de core/sessions.bend por `bun core/build.mjs` — não editar à mão.
// core/sessions.bend
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
function $previewCap$() {
  return 48n;
}
function $noteCap$() {
  return 40n;
}
function $jsonlLen$() {
  return 6n;
}
function $conferirLen$() {
  return 9n;
}
function $novaLabel$() {
  return "Nova conversa";
}
function $conversaLabel$() {
  return "Conversa";
}
function $conferirLabel$() {
  return "Conferir Xournal++";
}
function $conferirCmd$() {
  return "/conferir";
}
function $noteSep$() {
  return " · ";
}
function $mesaSuffix$() {
  return { $: "Con", ["head"]: "[Contexto da sessão na Mesa:", ["tail"]: { $: "Con", ["head"]: "[Referências abertas", ["tail"]: { $: "Con", ["head"]: "[Conferência visual", ["tail"]: { $: "Nil" } } } };
}
function $chatSuffix$() {
  return { $: "Con", ["head"]: "[Buscar na web]", ["tail"]: { $: "Con", ["head"]: "[Anexo: ", ["tail"]: { $: "Nil" } } };
}
function $mesaCuts$() {
  return { $: "PreviewCuts", ["suffix"]: run_loop($mesaSuffix$()), ["conferir"]: true };
}
function $chatCuts$() {
  return { $: "PreviewCuts", ["suffix"]: run_loop($chatSuffix$()), ["conferir"]: false };
}
function $charStr$(c_0) {
  return c_0 + "";
}
function $isWord$(c_0) {
  const x_0 = run_loop($Char$is_digit$(c_0));
  const x_1 = run_loop($Char$is_eq$(c_0, "_"));
  const x_2 = run_loop($Char$is_alpha$(c_0));
  const x_3 = x_0 || x_1;
  return x_2 || x_3;
}
function $headSpace$(s_0) {
  if (s_0 === "") {
    return false;
  } else {
    const h_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(0, 2) : s_0[0];
    const t_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(2) : s_0.slice(1);
    return run_jump($Char$is_space$, [h_0]);
  }
}
function $collapse$go$(s_0, space_0, inSpace_0, acc_0) {
  if (s_0 === "") {
    return acc_0;
  } else {
    const h_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(0, 2) : s_0[0];
    const t_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(2) : s_0.slice(1);
    if (!space_0) {
      const t_1 = t_0;
      return run_jump($collapse$go$, [t_1, run_loop($headSpace$(t_1)), false, h_0 + acc_0]);
    } else {
      if (inSpace_0) {
        const t_2 = t_0;
        return run_jump($collapse$go$, [t_2, run_loop($headSpace$(t_2)), true, acc_0]);
      } else {
        const t_3 = t_0;
        return run_jump($collapse$go$, [t_3, run_loop($headSpace$(t_3)), true, " " + acc_0]);
      }
    }
  }
}
function $collapseSpaces$(s_0) {
  return run_jump($String$reverse$, [run_loop($collapse$go$(s_0, run_loop($headSpace$(s_0)), false, ""))]);
}
function $cleanText$(s_0) {
  return run_jump($String$trim$, [run_loop($collapseSpaces$(s_0))]);
}
function $headStarts$(s_0, needle_0) {
  if (s_0 === "") {
    return false;
  } else {
    const h_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(0, 2) : s_0[0];
    const t_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(2) : s_0.slice(1);
    return run_jump($String$starts_with$, [h_0 + t_0, needle_0]);
  }
}
function $cutFrom$go$(s_0, here_0, needle_0, acc_0) {
  if (s_0 === "") {
    return run_jump($String$reverse$, [acc_0]);
  } else {
    const h_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(0, 2) : s_0[0];
    const t_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(2) : s_0.slice(1);
    if (here_0) {
      return run_jump($String$reverse$, [acc_0]);
    } else {
      const t_1 = t_0;
      return run_jump($cutFrom$go$, [t_1, run_loop($headStarts$(t_1, needle_0)), needle_0, h_0 + acc_0]);
    }
  }
}
function $cutFrom$(s_0, needle_0) {
  return run_jump($cutFrom$go$, [s_0, run_loop($headStarts$(s_0, needle_0)), needle_0, ""]);
}
function $cutOne$(s_0, marker_0) {
  return run_jump($cutFrom$, [s_0, `

` + marker_0]);
}
function $cutSuffixes$(markers_0, s_0) {
  if (markers_0.$ === "Nil") {
    return s_0;
  } else {
    const h_0 = markers_0.head;
    const t_0 = markers_0.tail;
    return run_jump($cutSuffixes$, [t_0, run_loop($cutOne$(s_0, h_0))]);
  }
}
function $isConferir$rest$(rest_0) {
  if (rest_0 === "") {
    return true;
  } else {
    const h_0 = rest_0.codePointAt(0) > 65535 ? rest_0.slice(0, 2) : rest_0[0];
    const t_0 = rest_0.codePointAt(0) > 65535 ? rest_0.slice(2) : rest_0.slice(1);
    const h_1 = h_0;
    return run_jump($Bool$not$, [run_loop($isWord$(h_1))]);
  }
}
function $isConferir$if$(s_0, starts_0) {
  if (!starts_0) {
    return false;
  } else {
    return run_jump($isConferir$rest$, [run_loop($String$drop$(s_0, run_loop($conferirLen$())))]);
  }
}
function $isConferir$(s_0) {
  return run_jump($isConferir$if$, [s_0, run_loop($String$starts_with$(s_0, run_loop($conferirCmd$())))]);
}
function $rewriteConferir$hit$(t_0, hit_0) {
  if (hit_0) {
    return run_jump($conferirLabel$, []);
  } else {
    return t_0;
  }
}
function $rewriteConferir$on$(text_0) {
  const t_0 = run_loop($String$trim$(text_0));
  return run_jump($rewriteConferir$hit$, [t_0, run_loop($isConferir$(t_0))]);
}
function $rewriteConferir$(text_0, on_0) {
  if (!on_0) {
    return text_0;
  } else {
    return run_jump($rewriteConferir$on$, [text_0]);
  }
}
function $applyCuts$(text_0, cuts_0) {
  const suffix_0 = cuts_0.suffix;
  const conferir_0 = cuts_0.conferir;
  return run_jump($rewriteConferir$, [run_loop($cutSuffixes$(suffix_0, text_0)), conferir_0]);
}
function $contentText$(body_0) {
  if (body_0.$ === "BodyString") {
    const text_0 = body_0.text;
    return text_0;
  } else if (body_0.$ === "BodyParts") {
    const parts_0 = body_0.parts;
    return run_jump($String$join$, [parts_0, " "]);
  } else {
    const text_1 = body_0.text;
    return text_1;
  }
}
function $preview$try$empty$(cleaned_0, empty_0) {
  if (empty_0) {
    return { $: "None" };
  } else {
    return { $: "Some", ["value"]: run_loop($String$take$(cleaned_0, run_loop($previewCap$()))) };
  }
}
function $preview$try$clean$(cleaned_0) {
  return run_jump($preview$try$empty$, [cleaned_0, run_loop($String$is_empty$(cleaned_0))]);
}
function $preview$try$user$(text_0, cuts_0) {
  return run_jump($preview$try$clean$, [run_loop($cleanText$(run_loop($applyCuts$(text_0, cuts_0))))]);
}
function $preview$try$role$(isUser_0, text_0, cuts_0) {
  if (!isUser_0) {
    return { $: "None" };
  } else {
    return run_jump($preview$try$user$, [text_0, cuts_0]);
  }
}
function $preview$try$(h_0, cuts_0) {
  const isUser_0 = h_0.isUser;
  const body_0 = h_0.body;
  return run_jump($preview$try$role$, [isUser_0, run_loop($contentText$(body_0)), cuts_0]);
}
function $preview$step$(found_0, h_0, cuts_0) {
  if (found_0.$ === "Some") {
    const v_0 = found_0.value;
    return { $: "Some", ["value"]: v_0 };
  } else {
    return run_jump($preview$try$, [h_0, cuts_0]);
  }
}
function $preview$go$(msgs_0, cuts_0, found_0) {
  if (msgs_0.$ === "Nil") {
    return found_0;
  } else {
    const h_0 = msgs_0.head;
    const t_0 = msgs_0.tail;
    return run_jump($preview$go$, [t_0, cuts_0, run_loop($preview$step$(found_0, h_0, cuts_0))]);
  }
}
function $preview$fin$(m_0) {
  if (m_0.$ === "None") {
    return "";
  } else {
    const s_0 = m_0.value;
    return s_0;
  }
}
function $sessionPreview$(msgs_0, cuts_0) {
  return run_jump($preview$fin$, [run_loop($preview$go$(msgs_0, cuts_0, { $: "None" }))]);
}
function $headDigit$(s_0) {
  if (s_0 === "") {
    return false;
  } else {
    const h_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(0, 2) : s_0[0];
    const t_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(2) : s_0.slice(1);
    return run_jump($Char$is_digit$, [h_0]);
  }
}
function $takeTrail$go$(s_0, d_0, prefix_0, digits_0) {
  if (s_0 === "") {
    return { $: "Tuple", ["fst"]: prefix_0, ["snd"]: digits_0 };
  } else {
    const h_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(0, 2) : s_0[0];
    const t_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(2) : s_0.slice(1);
    if (d_0) {
      const t_1 = t_0;
      const x_0 = run_loop($charStr$(h_0));
      return run_jump($takeTrail$go$, [t_1, run_loop($headDigit$(t_1)), prefix_0, digits_0 + x_0]);
    } else {
      const t_2 = t_0;
      const x_1 = run_loop($charStr$(h_0));
      const x_2 = digits_0 + x_1;
      return run_jump($takeTrail$go$, [t_2, run_loop($headDigit$(t_2)), prefix_0 + x_2, ""]);
    }
  }
}
function $takeTrail$(s_0) {
  return run_jump($takeTrail$go$, [s_0, run_loop($headDigit$(s_0)), "", ""]);
}
function $stripJsonl$(path_0) {
  return run_jump($String$reverse$, [run_loop($String$drop$(run_loop($String$reverse$(path_0)), run_loop($jsonlLen$())))]);
}
function $digitVal$(c_0) {
  const x_0 = run_loop($Char$to_u32$(c_0));
  const x_1 = BigInt(x_0);
  return x_1 < 48n ? 0n : x_1 - 48n;
}
function $readDigits$(s_0, acc_0) {
  if (s_0 === "") {
    return acc_0;
  } else {
    const h_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(0, 2) : s_0[0];
    const t_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(2) : s_0.slice(1);
    const x_0 = nat_chk(acc_0 * 10n);
    const x_1 = run_loop($digitVal$(h_0));
    return run_jump($readDigits$, [t_0, nat_chk(x_0 + x_1)]);
  }
}
function $started$val$(digits_0, empty_0) {
  if (empty_0) {
    return 0n;
  } else {
    return run_jump($readDigits$, [digits_0, 0n]);
  }
}
function $started$pi$(digits_0, ok_0) {
  if (!ok_0) {
    return 0n;
  } else {
    return run_jump($started$val$, [digits_0, run_loop($String$is_empty$(digits_0))]);
  }
}
function $started$from$(pd_0) {
  const prefix_0 = pd_0.fst;
  const digits_0 = pd_0.snd;
  return run_jump($started$pi$, [digits_0, run_loop($String$ends_with$(prefix_0, "pi-"))]);
}
function $started$digits$(s_0) {
  return run_jump($started$from$, [run_loop($takeTrail$(s_0))]);
}
function $started$if$(path_0, jsonl_0) {
  if (!jsonl_0) {
    return 0n;
  } else {
    return run_jump($started$digits$, [run_loop($stripJsonl$(path_0))]);
  }
}
function $sessionStartedFromPath$(path_0) {
  return run_jump($started$if$, [path_0, run_loop($String$ends_with$(path_0, ".jsonl"))]);
}
function $pad2$if$(n_0, small_0) {
  if (small_0) {
    const x_0 = run_loop($Nat$show$(n_0));
    return "0" + x_0;
  } else {
    return run_jump($Nat$show$, [n_0]);
  }
}
function $pad2$(n_0) {
  return run_jump($pad2$if$, [n_0, n_0 < 10n]);
}
function $formatDate$(day_0, month_0, hour_0, minute_0) {
  const x_0 = run_loop($pad2$(minute_0));
  const x_1 = run_loop($pad2$(hour_0));
  const x_2 = ":" + x_0;
  const x_3 = x_1 + x_2;
  const x_4 = run_loop($pad2$(month_0));
  const x_5 = ", " + x_3;
  const x_6 = x_4 + x_5;
  const x_7 = run_loop($pad2$(day_0));
  const x_8 = "/" + x_6;
  return x_7 + x_8;
}
function $formatWhen$(valid_0, day_0, month_0, hour_0, minute_0) {
  if (!valid_0) {
    return run_jump($conversaLabel$, []);
  } else {
    return run_jump($formatDate$, [day_0, month_0, hour_0, minute_0]);
  }
}
function $formatLabel$withNote$(note_0, valid_0, day_0, month_0, hour_0, minute_0) {
  const x_0 = run_loop($noteSep$());
  const x_1 = run_loop($String$take$(note_0, run_loop($noteCap$())));
  const x_2 = run_loop($formatWhen$(valid_0, day_0, month_0, hour_0, minute_0));
  const x_3 = x_0 + x_1;
  return x_2 + x_3;
}
function $formatLabel$empty$(nova_0, valid_0, day_0, month_0, hour_0, minute_0) {
  if (nova_0) {
    return run_jump($novaLabel$, []);
  } else {
    return run_jump($formatWhen$, [valid_0, day_0, month_0, hour_0, minute_0]);
  }
}
function $formatLabel$note$if$(note_0, noNote_0, nova_0, valid_0, day_0, month_0, hour_0, minute_0) {
  if (noNote_0) {
    return run_jump($formatLabel$empty$, [nova_0, valid_0, day_0, month_0, hour_0, minute_0]);
  } else {
    return run_jump($formatLabel$withNote$, [note_0, valid_0, day_0, month_0, hour_0, minute_0]);
  }
}
function $formatLabel$note$(preview_0, nova_0, valid_0, day_0, month_0, hour_0, minute_0) {
  const note_0 = run_loop($cleanText$(preview_0));
  return run_jump($formatLabel$note$if$, [note_0, run_loop($String$is_empty$(note_0)), nova_0, valid_0, day_0, month_0, hour_0, minute_0]);
}
function $formatLabel$title$if$(title_0, empty_0, preview_0, nova_0, valid_0, day_0, month_0, hour_0, minute_0) {
  if (!empty_0) {
    return title_0;
  } else {
    return run_jump($formatLabel$note$, [preview_0, nova_0, valid_0, day_0, month_0, hour_0, minute_0]);
  }
}
function $formatSessionLabel$(title_0, preview_0, nova_0, valid_0, day_0, month_0, hour_0, minute_0) {
  const t_0 = run_loop($String$trim$(title_0));
  return run_jump($formatLabel$title$if$, [t_0, run_loop($String$is_empty$(t_0)), preview_0, nova_0, valid_0, day_0, month_0, hour_0, minute_0]);
}
function $groupOf$yest$(isYesterday_0) {
  if (isYesterday_0) {
    return { $: "GroupYesterday" };
  } else {
    return { $: "GroupOlder" };
  }
}
function $groupOf$(isToday_0, isYesterday_0) {
  if (isToday_0) {
    return { $: "GroupToday" };
  } else {
    return run_jump($groupOf$yest$, [isYesterday_0]);
  }
}
function $groupLabel$(g_0) {
  if (g_0.$ === "GroupToday") {
    return "Hoje";
  } else if (g_0.$ === "GroupYesterday") {
    return "Ontem";
  } else {
    return "Anteriores";
  }
}
function $group$push$at$(today_0, yesterday_0, older_0, item_0, g_0) {
  if (g_0.$ === "GroupToday") {
    return { $: "SessAcc", ["today"]: run_loop($List$append$(today_0, { $: "Con", ["head"]: item_0, ["tail"]: { $: "Nil" } })), ["yesterday"]: yesterday_0, ["older"]: older_0 };
  } else if (g_0.$ === "GroupYesterday") {
    return { $: "SessAcc", ["today"]: today_0, ["yesterday"]: run_loop($List$append$(yesterday_0, { $: "Con", ["head"]: item_0, ["tail"]: { $: "Nil" } })), ["older"]: older_0 };
  } else {
    return { $: "SessAcc", ["today"]: today_0, ["yesterday"]: yesterday_0, ["older"]: run_loop($List$append$(older_0, { $: "Con", ["head"]: item_0, ["tail"]: { $: "Nil" } })) };
  }
}
function $group$push$(acc_0, item_0, g_0) {
  const today_0 = acc_0.today;
  const yesterday_0 = acc_0.yesterday;
  const older_0 = acc_0.older;
  return run_jump($group$push$at$, [today_0, yesterday_0, older_0, item_0, g_0]);
}
function $group$go$(items_0, todayF_0, yestF_0, acc_0) {
  if (items_0.$ === "Nil") {
    return acc_0;
  } else {
    const h_0 = items_0.head;
    const t_0 = items_0.tail;
    if (todayF_0.$ === "Nil") {
      return acc_0;
    } else {
      const td_0 = todayF_0.head;
      const tds_0 = todayF_0.tail;
      if (yestF_0.$ === "Nil") {
        return acc_0;
      } else {
        const yd_0 = yestF_0.head;
        const yds_0 = yestF_0.tail;
        return run_jump($group$go$, [t_0, tds_0, yds_0, run_loop($group$push$(acc_0, h_0, run_loop($groupOf$(td_0, yd_0))))]);
      }
    }
  }
}
function $keepBucket$if$(g_0, items_0, rest_0, empty_0) {
  if (empty_0) {
    return rest_0;
  } else {
    return { $: "Con", ["head"]: { $: "SessionBucket", ["group"]: g_0, ["label"]: run_loop($groupLabel$(g_0)), ["items"]: items_0 }, ["tail"]: rest_0 };
  }
}
function $keepBucket$(g_0, items_0, rest_0) {
  return run_jump($keepBucket$if$, [g_0, items_0, rest_0, run_loop($List$is_empty$(items_0))]);
}
function $group$finish$(acc_0) {
  const today_0 = acc_0.today;
  const yesterday_0 = acc_0.yesterday;
  const older_0 = acc_0.older;
  return run_jump($keepBucket$, [{ $: "GroupToday" }, today_0, run_loop($keepBucket$({ $: "GroupYesterday" }, yesterday_0, run_loop($keepBucket$({ $: "GroupOlder" }, older_0, { $: "Nil" }))))]);
}
function $groupSessions$(items_0, todayF_0, yestF_0) {
  return run_jump($group$finish$, [run_loop($group$go$(items_0, todayF_0, yestF_0, { $: "SessAcc", ["today"]: { $: "Nil" }, ["yesterday"]: { $: "Nil" }, ["older"]: { $: "Nil" } }))]);
}
function $Char$is_alpha$(c_0) {
  const x_0 = run_loop($Char$is_upper$(c_0));
  const x_1 = run_loop($Char$is_lower$(c_0));
  return x_0 || x_1;
}
function $Char$is_digit$(c_0) {
  const x_0 = c_0.codePointAt(0);
  const x_1 = x_0;
  return run_jump($Bool$and$, [x_1 >= 48, x_1 <= 57]);
}
function $Char$is_eq$(a_0, b_0) {
  const x_0 = a_0.codePointAt(0);
  const y_0 = b_0.codePointAt(0);
  return x_0 === y_0;
}
function $Char$is_space$(c_0) {
  const x_0 = c_0.codePointAt(0);
  const x_1 = x_0;
  const x_2 = x_1 === 32;
  const x_3 = run_loop($Bool$and$(x_1 >= 9, x_1 <= 13));
  return x_2 || x_3;
}
function $String$reverse$(s_0) {
  return run_jump($String$reverse$go$, [s_0, ""]);
}
function $String$trim$(s_0) {
  return run_jump($String$trim_end$, [run_loop($String$trim_start$(s_0))]);
}
function $String$starts_with$(s_0, p_0) {
  if (s_0 === "") {
    if (p_0 === "") {
      return true;
    } else {
      const h_0 = p_0.codePointAt(0) > 65535 ? p_0.slice(0, 2) : p_0[0];
      const t_0 = p_0.codePointAt(0) > 65535 ? p_0.slice(2) : p_0.slice(1);
      return false;
    }
  } else {
    const h_1 = s_0.codePointAt(0) > 65535 ? s_0.slice(0, 2) : s_0[0];
    const t_1 = s_0.codePointAt(0) > 65535 ? s_0.slice(2) : s_0.slice(1);
    if (p_0 === "") {
      return true;
    } else {
      const y_0 = p_0.codePointAt(0) > 65535 ? p_0.slice(0, 2) : p_0[0];
      const yt_0 = p_0.codePointAt(0) > 65535 ? p_0.slice(2) : p_0.slice(1);
      return run_jump($String$starts_with$if$, [t_1, yt_0, run_loop($Char$is_eq$(h_1, y_0))]);
    }
  }
}
function $Bool$not$(b_0) {
  if (!b_0) {
    return true;
  } else {
    return false;
  }
}
function $String$drop$(s_0, n_0) {
  if (s_0 === "") {
    return "";
  } else {
    const h_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(0, 2) : s_0[0];
    const t_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(2) : s_0.slice(1);
    if (n_0 === 0n) {
      return h_0 + t_0;
    } else {
      const p_0 = n_0 - 1n;
      return run_jump($String$drop$, [t_0, p_0]);
    }
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
function $String$take$(s_0, n_0) {
  if (s_0 === "") {
    return "";
  } else {
    const h_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(0, 2) : s_0[0];
    const t_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(2) : s_0.slice(1);
    if (n_0 === 0n) {
      return "";
    } else {
      const p_0 = n_0 - 1n;
      return h_0 + run_loop($String$take$(t_0, p_0));
    }
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
function $Char$to_u32$(c_0) {
  const x_0 = c_0.codePointAt(0);
  return x_0;
}
function $String$ends_with$(s_0, p_0) {
  return run_jump($String$starts_with$, [run_loop($String$reverse$(s_0)), run_loop($String$reverse$(p_0))]);
}
function $Nat$show$(n_0) {
  const m_0 = n_0;
  return run_jump($Nat$show$fin$, [m_0, "", run_loop($Nat$show$put$(nat_divmod(m_0, 10n)))]);
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
function $List$is_empty$(xs_0) {
  if (xs_0.$ === "Nil") {
    return true;
  } else {
    const h_0 = xs_0.head;
    const t_0 = xs_0.tail;
    return false;
  }
}
function $Char$is_upper$(c_0) {
  const x_0 = c_0.codePointAt(0);
  const x_1 = x_0;
  return run_jump($Bool$and$, [x_1 >= 65, x_1 <= 90]);
}
function $Char$is_lower$(c_0) {
  const x_0 = c_0.codePointAt(0);
  const x_1 = x_0;
  return run_jump($Bool$and$, [x_1 >= 97, x_1 <= 122]);
}
function $Bool$and$(a_0, b_0) {
  if (!a_0) {
    return false;
  } else {
    return b_0;
  }
}
function $String$reverse$go$(s_0, acc_0) {
  if (s_0 === "") {
    return acc_0;
  } else {
    const h_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(0, 2) : s_0[0];
    const t_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(2) : s_0.slice(1);
    return run_jump($String$reverse$go$, [t_0, h_0 + acc_0]);
  }
}
function $String$trim_end$(s_0) {
  return run_jump($String$reverse$, [run_loop($String$trim_start$(run_loop($String$reverse$(s_0))))]);
}
function $String$trim_start$(s_0) {
  if (s_0 === "") {
    return "";
  } else {
    const h_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(0, 2) : s_0[0];
    const t_0 = s_0.codePointAt(0) > 65535 ? s_0.slice(2) : s_0.slice(1);
    const h_1 = h_0;
    return run_jump($String$trim_start$if$, [h_1, t_0, run_loop($Char$is_space$(h_1))]);
  }
}
function $String$starts_with$if$(t_0, pt_0, same_0) {
  if (!same_0) {
    return false;
  } else {
    return run_jump($String$starts_with$, [t_0, pt_0]);
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
function $Nat$show$fin$(g_0, acc_0, dq_0) {
  const d_0 = dq_0.fst;
  const _t_0 = dq_0.snd;
  if (_t_0 === 0n) {
    return d_0 + acc_0;
  } else {
    const p_0 = _t_0 - 1n;
    return run_jump($Nat$show$go$, [g_0, nat_chk(p_0 + 1n), d_0 + acc_0]);
  }
}
function $Nat$show$put$(qr_0) {
  const q_0 = qr_0.fst;
  const r_0 = qr_0.snd;
  const x_0 = nat_chk(48n + r_0);
  return { $: "Tuple", ["fst"]: char_new(Number(x_0 & 0xFFFFFFFFn)), ["snd"]: q_0 };
}
function $String$trim_start$if$(h_0, t_0, space_0) {
  if (!space_0) {
    return h_0 + t_0;
  } else {
    return run_jump($String$trim_start$, [t_0]);
  }
}
function $Nat$show$go$(f_0, n_0, acc_0) {
  if (f_0 === 0n) {
    return acc_0;
  } else {
    const g_0 = f_0 - 1n;
    return run_jump($Nat$show$fin$, [g_0, acc_0, run_loop($Nat$show$put$(nat_divmod(n_0, 10n)))]);
  }
}
var sessions_default = {
  previewCap: run_lib($previewCap$, 0),
  noteCap: run_lib($noteCap$, 0),
  jsonlLen: run_lib($jsonlLen$, 0),
  conferirLen: run_lib($conferirLen$, 0),
  novaLabel: run_lib($novaLabel$, 0),
  conversaLabel: run_lib($conversaLabel$, 0),
  conferirLabel: run_lib($conferirLabel$, 0),
  conferirCmd: run_lib($conferirCmd$, 0),
  noteSep: run_lib($noteSep$, 0),
  mesaSuffix: run_lib($mesaSuffix$, 0),
  chatSuffix: run_lib($chatSuffix$, 0),
  mesaCuts: run_lib($mesaCuts$, 0),
  chatCuts: run_lib($chatCuts$, 0),
  charStr: run_lib($charStr$, 1),
  isWord: run_lib($isWord$, 1),
  headSpace: run_lib($headSpace$, 1),
  "collapse.go": run_lib($collapse$go$, 4),
  collapseSpaces: run_lib($collapseSpaces$, 1),
  cleanText: run_lib($cleanText$, 1),
  headStarts: run_lib($headStarts$, 2),
  "cutFrom.go": run_lib($cutFrom$go$, 4),
  cutFrom: run_lib($cutFrom$, 2),
  cutOne: run_lib($cutOne$, 2),
  cutSuffixes: run_lib($cutSuffixes$, 2),
  "isConferir.rest": run_lib($isConferir$rest$, 1),
  "isConferir.if": run_lib($isConferir$if$, 2),
  isConferir: run_lib($isConferir$, 1),
  "rewriteConferir.hit": run_lib($rewriteConferir$hit$, 2),
  "rewriteConferir.on": run_lib($rewriteConferir$on$, 1),
  rewriteConferir: run_lib($rewriteConferir$, 2),
  applyCuts: run_lib($applyCuts$, 2),
  contentText: run_lib($contentText$, 1),
  "preview.try.empty": run_lib($preview$try$empty$, 2),
  "preview.try.clean": run_lib($preview$try$clean$, 1),
  "preview.try.user": run_lib($preview$try$user$, 2),
  "preview.try.role": run_lib($preview$try$role$, 3),
  "preview.try": run_lib($preview$try$, 2),
  "preview.step": run_lib($preview$step$, 3),
  "preview.go": run_lib($preview$go$, 3),
  "preview.fin": run_lib($preview$fin$, 1),
  sessionPreview: run_lib($sessionPreview$, 2),
  headDigit: run_lib($headDigit$, 1),
  "takeTrail.go": run_lib($takeTrail$go$, 4),
  takeTrail: run_lib($takeTrail$, 1),
  stripJsonl: run_lib($stripJsonl$, 1),
  digitVal: run_lib($digitVal$, 1),
  readDigits: run_lib($readDigits$, 2),
  "started.val": run_lib($started$val$, 2),
  "started.pi": run_lib($started$pi$, 2),
  "started.from": run_lib($started$from$, 1),
  "started.digits": run_lib($started$digits$, 1),
  "started.if": run_lib($started$if$, 2),
  sessionStartedFromPath: run_lib($sessionStartedFromPath$, 1),
  "pad2.if": run_lib($pad2$if$, 2),
  pad2: run_lib($pad2$, 1),
  formatDate: run_lib($formatDate$, 4),
  formatWhen: run_lib($formatWhen$, 5),
  "formatLabel.withNote": run_lib($formatLabel$withNote$, 6),
  "formatLabel.empty": run_lib($formatLabel$empty$, 6),
  "formatLabel.note.if": run_lib($formatLabel$note$if$, 8),
  "formatLabel.note": run_lib($formatLabel$note$, 7),
  "formatLabel.title.if": run_lib($formatLabel$title$if$, 9),
  formatSessionLabel: run_lib($formatSessionLabel$, 8),
  "groupOf.yest": run_lib($groupOf$yest$, 1),
  groupOf: run_lib($groupOf$, 2),
  groupLabel: run_lib($groupLabel$, 1),
  "group.push.at": run_lib($group$push$at$, 5),
  "group.push": run_lib($group$push$, 3),
  "group.go": run_lib($group$go$, 4),
  "keepBucket.if": run_lib($keepBucket$if$, 4),
  keepBucket: run_lib($keepBucket$, 3),
  "group.finish": run_lib($group$finish$, 1),
  groupSessions: run_lib($groupSessions$, 3)
};
export {
  sessions_default as default
};

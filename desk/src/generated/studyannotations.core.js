// GERADO de core/studyannotations.bend por `bun core/build.mjs` — não editar à mão.
// core/studyannotations.bend
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
function $maxId() {
  return 80;
}
function $maxQuote() {
  return 2000;
}
function $maxNote() {
  return 2000;
}
function $maxName() {
  return 120;
}
function $maxRel() {
  return 1024;
}
function $maxPath() {
  return 4096;
}
function $maxItems() {
  return 500;
}
function $cut_if(_text_0, _limit_0, _over_0) {
  if (!_over_0) {
    return _text_0;
  } else {
    return $String_take(_text_0, _limit_0);
  }
}
function $cut(_text_0, _limit_0) {
  return $cut_if(_text_0, _limit_0, $Nat_is_gt([...str_out(_text_0)].length, _limit_0));
}
function $clip(_text_0, _limit_0) {
  return $cut($String_trim(_text_0), _limit_0);
}
function $fitId(_text_0) {
  return $clip(_text_0, $maxId());
}
function $fitQuote(_text_0) {
  return $clip(_text_0, $maxQuote());
}
function $fitNote(_text_0) {
  return $clip(_text_0, $maxNote());
}
function $fitName(_text_0) {
  return $clip(_text_0, $maxName());
}
function $fitRel(_text_0) {
  return $clip(_text_0, $maxRel());
}
function $fitPath(_text_0) {
  return $clip(_text_0, $maxPath());
}
function $pageFloor_if(_page_0, _low_0) {
  if (_low_0) {
    return 1;
  } else {
    return _page_0;
  }
}
function $pageFloor(_page_0) {
  return $pageFloor_if(_page_0, _page_0 < 1);
}
function $scopeOf(_isFree_0, _courseId_0, _freeId_0) {
  if (_isFree_0) {
    return "free:" + _freeId_0;
  } else {
    return _courseId_0;
  }
}
function $kindOf(_doubt_0) {
  if (_doubt_0) {
    return { $: "NoteDoubt" };
  } else {
    return { $: "NoteNote" };
  }
}
function $kindKey(_k_0) {
  if (_k_0.$ === "NoteNote") {
    return "nota";
  } else {
    return "duvida";
  }
}
function $kindLabel(_k_0) {
  if (_k_0.$ === "NoteNote") {
    return $msg_msg("annot.kind.note");
  } else {
    return $msg_msg("annot.kind.doubt");
  }
}
function $newRef(_name_0, _rel_0, _path_0, _page_0) {
  return { $: "NoteRef", name: $fitName(_name_0), rel: $fitRel(_rel_0), path: $fitPath(_path_0), page: $pageFloor(_page_0) };
}
function $newItem(_id_0, _doubt_0, _quote_0, _note_0, _name_0, _rel_0, _path_0, _page_0) {
  return { $: "NoteItem", id: $fitId(_id_0), kind: $kindOf(_doubt_0), quote: $fitQuote(_quote_0), note: $fitNote(_note_0), ref: $newRef(_name_0, _rel_0, _path_0, _page_0) };
}
function $keep_tags(_emptyQuote_0, _emptyNote_0) {
  if (_emptyQuote_0) {
    return $Bool_not(_emptyNote_0);
  } else {
    return true;
  }
}
function $keep(_item_0) {
  const _quote_0 = _item_0["quote"];
  const _note_0 = _item_0["note"];
  return $keep_tags($String_is_empty($String_trim(_quote_0)), $String_is_empty($String_trim(_note_0)));
}
function $sameId(_a_0, _b_0) {
  const _id_0 = _a_0["id"];
  const _id2_0 = _b_0["id"];
  return $String_eq(_id_0, _id2_0);
}
function $takeItems_go(_xs_0, _n_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    if (_n_0 === 0) {
      return { $: "Nil" };
    } else {
      const _p_0 = _n_0 - 1;
      return { $: "Con", head: _h_0, tail: $takeItems_go(_t_0, _p_0) };
    }
  }
}
function $dropSame_head(_h_0, _rest_0, _same_0) {
  if (_same_0) {
    return _rest_0;
  } else {
    return { $: "Con", head: _h_0, tail: _rest_0 };
  }
}
function $dropSame_go(_items_0, _item_0) {
  if (_items_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _items_0["head"];
    const _t_0 = _items_0["tail"];
    return $dropSame_head(_h_0, $dropSame_go(_t_0, _item_0), $sameId(_h_0, _item_0));
  }
}
function $addItem(_items_0, _item_0) {
  return $takeItems_go({ $: "Con", head: _item_0, tail: $dropSame_go(_items_0, _item_0) }, $maxItems());
}
function $replaceSame_head(_h_0, _rest_0, _item_0, _same_0) {
  if (_same_0) {
    return { $: "Con", head: _item_0, tail: _rest_0 };
  } else {
    return { $: "Con", head: _h_0, tail: _rest_0 };
  }
}
function $replaceSame_go(_xs_0, _key_0, _item_0) {
  if (_xs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _xs_0["head"];
    const _t_0 = _xs_0["tail"];
    return $replaceSame_head(_h_0, $replaceSame_go(_t_0, _key_0, _item_0), _item_0, $sameId(_h_0, _key_0));
  }
}
function $replaceSame(_items_0, _key_0, _item_0) {
  return $replaceSame_go(_items_0, _key_0, _item_0);
}
function $removeSame(_items_0, _key_0) {
  return $dropSame_go(_items_0, _key_0);
}
function $onPage(_ref_0, _page_0) {
  const _p_0 = _ref_0["page"];
  return $Nat_is_eq(_p_0, _page_0);
}
function $panelTitle() {
  return $msg_msg("annot.title");
}
function $panelLead() {
  return $msg_msg("annot.lead");
}
function $quoteLabel() {
  return $msg_msg("annot.quote");
}
function $noteLabel() {
  return $msg_msg("annot.note");
}
function $kindLabelText() {
  return $msg_msg("annot.kind");
}
function $pageFieldLabel() {
  return $msg_msg("annot.page");
}
function $filterPageLabel() {
  return $msg_msg("annot.page");
}
function $filterAllLabel() {
  return $msg_msg("annot.filterAll");
}
function $saveLabel() {
  return $msg_msg("annot.save");
}
function $cancelLabel() {
  return $msg_msg("common.cancel");
}
function $editTitle() {
  return $msg_msg("annot.edit");
}
function $removeLabel() {
  return $msg_msg("common.remove");
}
function $removeTitle() {
  return $msg_msg("annot.remove");
}
function $closeLabel() {
  return $msg_msg("common.close");
}
function $useQuoteLabel() {
  return $msg_msg("annot.useQuote");
}
function $useQuoteTitle() {
  return $msg_msg("annot.useQuoteTitle");
}
function $emptyText() {
  return $msg_msg("annot.empty");
}
function $countText(_n_0) {
  return $msg_msg1("annot.count", "count", $Nat_show(_n_0));
}
function $pageLabel(_page_0) {
  return $msg_msg1("common.pageShort", "page", $Nat_show(_page_0));
}
function $refLine_if(_name_0, _page_0, _unnamed_0) {
  if (_unnamed_0) {
    return $pageLabel(_page_0);
  } else {
    return $msg_msg2("common.refNamed", "name", _name_0, "page", $Nat_show(_page_0));
  }
}
function $refLine(_name_0, _page_0) {
  return $refLine_if(_name_0, _page_0, $String_is_empty($String_trim(_name_0)));
}
function $refNone() {
  return $msg_msg("annot.refNone");
}
function $portableHint() {
  return $msg_msg("annot.portable");
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
function $Bool_not(_b_0) {
  if (!_b_0) {
    return true;
  } else {
    return false;
  }
}
function $String_is_empty(_s_0) {
  if (_s_0 === "") {
    return true;
  } else {
    return false;
  }
}
function $String_eq(_a_0, _b_0) {
  return $Cmp_is_eq($String_order(_a_0, _b_0));
}
function $Nat_is_eq(_a_0, _b_0) {
  return $Cmp_is_eq(cmp_new(_a_0, _b_0));
}
function $Nat_show(_n_0) {
  const _m_0 = _n_0;
  return $Nat_show_fin(_m_0, "", $Nat_show_put(nat_divmod(_m_0, 10)));
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
function $Bool_and(_a_0, _b_0) {
  if (!_a_0) {
    return false;
  } else {
    return _b_0;
  }
}
var studyannotations_default = {
  "msg.mark": run_lib(() => str_out(run_loop($msg_mark())), 0),
  "msg.sep": run_lib(() => str_out(run_loop($msg_sep())), 0),
  "msg.pack": run_lib((a0) => str_out(run_loop($msg_pack(a0))), 1),
  "msg.msg": run_lib((a0) => str_out(run_loop($msg_msg(str_in(a0)))), 1),
  "msg.msg1": run_lib((a0, a1, a2) => str_out(run_loop($msg_msg1(str_in(a0), str_in(a1), str_in(a2)))), 3),
  "msg.msg2": run_lib((a0, a1, a2, a3, a4) => str_out(run_loop($msg_msg2(str_in(a0), str_in(a1), str_in(a2), str_in(a3), str_in(a4)))), 5),
  "msg.msg3": run_lib((a0, a1, a2, a3, a4, a5, a6) => str_out(run_loop($msg_msg3(str_in(a0), str_in(a1), str_in(a2), str_in(a3), str_in(a4), str_in(a5), str_in(a6)))), 7),
  "msg.msg4": run_lib((a0, a1, a2, a3, a4, a5, a6, a7, a8) => str_out(run_loop($msg_msg4(str_in(a0), str_in(a1), str_in(a2), str_in(a3), str_in(a4), str_in(a5), str_in(a6), str_in(a7), str_in(a8)))), 9),
  "msg.isMsg": run_lib((a0) => run_loop($msg_isMsg(str_in(a0))), 1),
  maxId: run_lib(() => run_loop($maxId()), 0),
  maxQuote: run_lib(() => run_loop($maxQuote()), 0),
  maxNote: run_lib(() => run_loop($maxNote()), 0),
  maxName: run_lib(() => run_loop($maxName()), 0),
  maxRel: run_lib(() => run_loop($maxRel()), 0),
  maxPath: run_lib(() => run_loop($maxPath()), 0),
  maxItems: run_lib(() => run_loop($maxItems()), 0),
  "cut.if": run_lib((a0, a1, a2) => str_out(run_loop($cut_if(str_in(a0), nat_in(a1), a2))), 3),
  cut: run_lib((a0, a1) => str_out(run_loop($cut(str_in(a0), nat_in(a1)))), 2),
  clip: run_lib((a0, a1) => str_out(run_loop($clip(str_in(a0), nat_in(a1)))), 2),
  fitId: run_lib((a0) => str_out(run_loop($fitId(str_in(a0)))), 1),
  fitQuote: run_lib((a0) => str_out(run_loop($fitQuote(str_in(a0)))), 1),
  fitNote: run_lib((a0) => str_out(run_loop($fitNote(str_in(a0)))), 1),
  fitName: run_lib((a0) => str_out(run_loop($fitName(str_in(a0)))), 1),
  fitRel: run_lib((a0) => str_out(run_loop($fitRel(str_in(a0)))), 1),
  fitPath: run_lib((a0) => str_out(run_loop($fitPath(str_in(a0)))), 1),
  "pageFloor.if": run_lib((a0, a1) => run_loop($pageFloor_if(nat_in(a0), a1)), 2),
  pageFloor: run_lib((a0) => run_loop($pageFloor(nat_in(a0))), 1),
  scopeOf: run_lib((a0, a1, a2) => str_out(run_loop($scopeOf(a0, str_in(a1), str_in(a2)))), 3),
  kindOf: run_lib((a0) => run_loop($kindOf(a0)), 1),
  kindKey: run_lib((a0) => str_out(run_loop($kindKey(a0))), 1),
  kindLabel: run_lib((a0) => str_out(run_loop($kindLabel(a0))), 1),
  newRef: run_lib((a0, a1, a2, a3) => run_loop($newRef(str_in(a0), str_in(a1), str_in(a2), nat_in(a3))), 4),
  newItem: run_lib((a0, a1, a2, a3, a4, a5, a6, a7) => run_loop($newItem(str_in(a0), a1, str_in(a2), str_in(a3), str_in(a4), str_in(a5), str_in(a6), nat_in(a7))), 8),
  "keep.tags": run_lib((a0, a1) => run_loop($keep_tags(a0, a1)), 2),
  keep: run_lib((a0) => run_loop($keep(a0)), 1),
  sameId: run_lib((a0, a1) => run_loop($sameId(a0, a1)), 2),
  "takeItems.go": run_lib((a0, a1) => run_loop($takeItems_go(a0, nat_in(a1))), 2),
  "dropSame.head": run_lib((a0, a1, a2) => run_loop($dropSame_head(a0, a1, a2)), 3),
  "dropSame.go": run_lib((a0, a1) => run_loop($dropSame_go(a0, a1)), 2),
  addItem: run_lib((a0, a1) => run_loop($addItem(a0, a1)), 2),
  "replaceSame.head": run_lib((a0, a1, a2, a3) => run_loop($replaceSame_head(a0, a1, a2, a3)), 4),
  "replaceSame.go": run_lib((a0, a1, a2) => run_loop($replaceSame_go(a0, a1, a2)), 3),
  replaceSame: run_lib((a0, a1, a2) => run_loop($replaceSame(a0, a1, a2)), 3),
  removeSame: run_lib((a0, a1) => run_loop($removeSame(a0, a1)), 2),
  onPage: run_lib((a0, a1) => run_loop($onPage(a0, nat_in(a1))), 2),
  panelTitle: run_lib(() => str_out(run_loop($panelTitle())), 0),
  panelLead: run_lib(() => str_out(run_loop($panelLead())), 0),
  quoteLabel: run_lib(() => str_out(run_loop($quoteLabel())), 0),
  noteLabel: run_lib(() => str_out(run_loop($noteLabel())), 0),
  kindLabelText: run_lib(() => str_out(run_loop($kindLabelText())), 0),
  pageFieldLabel: run_lib(() => str_out(run_loop($pageFieldLabel())), 0),
  filterPageLabel: run_lib(() => str_out(run_loop($filterPageLabel())), 0),
  filterAllLabel: run_lib(() => str_out(run_loop($filterAllLabel())), 0),
  saveLabel: run_lib(() => str_out(run_loop($saveLabel())), 0),
  cancelLabel: run_lib(() => str_out(run_loop($cancelLabel())), 0),
  editTitle: run_lib(() => str_out(run_loop($editTitle())), 0),
  removeLabel: run_lib(() => str_out(run_loop($removeLabel())), 0),
  removeTitle: run_lib(() => str_out(run_loop($removeTitle())), 0),
  closeLabel: run_lib(() => str_out(run_loop($closeLabel())), 0),
  useQuoteLabel: run_lib(() => str_out(run_loop($useQuoteLabel())), 0),
  useQuoteTitle: run_lib(() => str_out(run_loop($useQuoteTitle())), 0),
  emptyText: run_lib(() => str_out(run_loop($emptyText())), 0),
  countText: run_lib((a0) => str_out(run_loop($countText(nat_in(a0)))), 1),
  pageLabel: run_lib((a0) => str_out(run_loop($pageLabel(nat_in(a0)))), 1),
  "refLine.if": run_lib((a0, a1, a2) => str_out(run_loop($refLine_if(str_in(a0), nat_in(a1), a2))), 3),
  refLine: run_lib((a0, a1) => str_out(run_loop($refLine(str_in(a0), nat_in(a1)))), 2),
  refNone: run_lib(() => str_out(run_loop($refNone())), 0),
  portableHint: run_lib(() => str_out(run_loop($portableHint())), 0)
};
export {
  studyannotations_default as default
};

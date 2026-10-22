// GERADO de core/materialmodel.bend por `bun core/build.mjs` — não editar à mão.
// core/materialmodel.bend
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
function $strIf(_hit_0, _found_0, _rest_0) {
  if (_hit_0) {
    return _found_0;
  } else {
    return _rest_0;
  }
}
function $natIf(_hit_0, _found_0, _rest_0) {
  if (_hit_0) {
    return _found_0;
  } else {
    return _rest_0;
  }
}
function $boolIf(_hit_0, _found_0, _rest_0) {
  if (_hit_0) {
    return _found_0;
  } else {
    return _rest_0;
  }
}
function $modelIf(_hit_0, _found_0, _rest_0) {
  if (_hit_0) {
    return _found_0;
  } else {
    return _rest_0;
  }
}
function $both(_a_0, _b_0) {
  return $boolIf(_a_0, _b_0, false);
}
function $either(_a_0, _b_0) {
  return $boolIf(_a_0, true, _b_0);
}
function $modelCount() {
  return 6;
}
function $modelId(_m_0) {
  if (_m_0.$ === "ModelLista") {
    return "lista";
  } else if (_m_0.$ === "ModelApostila") {
    return "apostila";
  } else if (_m_0.$ === "ModelResumo") {
    return "resumo";
  } else if (_m_0.$ === "ModelSimulado") {
    return "simulado";
  } else if (_m_0.$ === "ModelFormulario") {
    return "formulario";
  } else {
    return "livre";
  }
}
function $modelDefault() {
  return { $: "ModelLivre" };
}
function $modelAt(_i_0) {
  return $modelIf($Nat_is_eq(_i_0, 0), { $: "ModelLista" }, $modelIf($Nat_is_eq(_i_0, 1), { $: "ModelApostila" }, $modelIf($Nat_is_eq(_i_0, 2), { $: "ModelResumo" }, $modelIf($Nat_is_eq(_i_0, 3), { $: "ModelSimulado" }, $modelIf($Nat_is_eq(_i_0, 4), { $: "ModelFormulario" }, { $: "ModelLivre" })))));
}
function $modelIdAt(_i_0) {
  return $modelId($modelAt(_i_0));
}
function $parseModel(_raw_0, _fallback_0) {
  return $modelIf($String_eq(_raw_0, "lista"), { $: "ModelLista" }, $modelIf($String_eq(_raw_0, "apostila"), { $: "ModelApostila" }, $modelIf($String_eq(_raw_0, "resumo"), { $: "ModelResumo" }, $modelIf($String_eq(_raw_0, "simulado"), { $: "ModelSimulado" }, $modelIf($String_eq(_raw_0, "formulario"), { $: "ModelFormulario" }, $modelIf($String_eq(_raw_0, "livre"), { $: "ModelLivre" }, _fallback_0))))));
}
function $modelOrDefault(_value_0, _fallback_0) {
  if (_value_0.$ === "None") {
    return _fallback_0;
  } else {
    const _raw_0 = _value_0["value"];
    return $parseModel(_raw_0, _fallback_0);
  }
}
function $isKnownModel(_raw_0) {
  return $either($String_eq(_raw_0, "lista"), $either($String_eq(_raw_0, "apostila"), $either($String_eq(_raw_0, "resumo"), $either($String_eq(_raw_0, "simulado"), $either($String_eq(_raw_0, "formulario"), $String_eq(_raw_0, "livre"))))));
}
function $modelLabelKey(_m_0) {
  if (_m_0.$ === "ModelLista") {
    return "material.model.lista";
  } else if (_m_0.$ === "ModelApostila") {
    return "material.model.apostila";
  } else if (_m_0.$ === "ModelResumo") {
    return "material.model.resumo";
  } else if (_m_0.$ === "ModelSimulado") {
    return "material.model.simulado";
  } else if (_m_0.$ === "ModelFormulario") {
    return "material.model.formulario";
  } else {
    return "material.model.livre";
  }
}
function $modelLabel(_m_0) {
  return $msg_msg($modelLabelKey(_m_0));
}
function $modelBlurb(_m_0) {
  if (_m_0.$ === "ModelLista") {
    return $msg_msg("material.blurb.lista");
  } else if (_m_0.$ === "ModelApostila") {
    return $msg_msg("material.blurb.apostila");
  } else if (_m_0.$ === "ModelResumo") {
    return $msg_msg("material.blurb.resumo");
  } else if (_m_0.$ === "ModelSimulado") {
    return $msg_msg("material.blurb.simulado");
  } else if (_m_0.$ === "ModelFormulario") {
    return $msg_msg("material.blurb.formulario");
  } else {
    return $msg_msg("material.blurb.livre");
  }
}
function $labelOf(_raw_0) {
  return $modelLabel($parseModel(_raw_0, $modelDefault()));
}
function $labelKeyOf(_raw_0) {
  return $modelLabelKey($parseModel(_raw_0, $modelDefault()));
}
function $blurbOf(_raw_0) {
  return $modelBlurb($parseModel(_raw_0, $modelDefault()));
}
function $resolveModel(_requested_0, _last_0) {
  return $modelOrDefault(_requested_0, $modelOrDefault(_last_0, $modelDefault()));
}
function $resolveModelId(_requested_0, _last_0) {
  return $modelId($resolveModel(_requested_0, _last_0));
}
function $sourceOfValue(_value_0) {
  if (_value_0.$ === "None") {
    return false;
  } else {
    const _raw_0 = _value_0["value"];
    return $isKnownModel(_raw_0);
  }
}
function $resolveSource(_requested_0, _last_0) {
  return $strIf($sourceOfValue(_requested_0), "agent", $strIf($sourceOfValue(_last_0), "last", "default"));
}
function $optionCount(_m_0) {
  if (_m_0.$ === "ModelLista") {
    return 3;
  } else if (_m_0.$ === "ModelApostila") {
    return 3;
  } else if (_m_0.$ === "ModelResumo") {
    return 2;
  } else if (_m_0.$ === "ModelSimulado") {
    return 3;
  } else if (_m_0.$ === "ModelFormulario") {
    return 2;
  } else {
    return 0;
  }
}
function $optionKeyAt(_m_0, _i_0) {
  if (_m_0.$ === "ModelLista") {
    return $strIf($Nat_is_eq(_i_0, 0), "colunas", $strIf($Nat_is_eq(_i_0, 1), "gabarito", $strIf($Nat_is_eq(_i_0, 2), "rodape", "")));
  } else if (_m_0.$ === "ModelApostila") {
    return $strIf($Nat_is_eq(_i_0, 0), "equacoes", $strIf($Nat_is_eq(_i_0, 1), "recuo", $strIf($Nat_is_eq(_i_0, 2), "capitulo", "")));
  } else if (_m_0.$ === "ModelResumo") {
    return $strIf($Nat_is_eq(_i_0, 0), "regra", $strIf($Nat_is_eq(_i_0, 1), "revisao", ""));
  } else if (_m_0.$ === "ModelSimulado") {
    return $strIf($Nat_is_eq(_i_0, 0), "valor", $strIf($Nat_is_eq(_i_0, 1), "espaco", $strIf($Nat_is_eq(_i_0, 2), "gabarito", "")));
  } else if (_m_0.$ === "ModelFormulario") {
    return $strIf($Nat_is_eq(_i_0, 0), "colunas", $strIf($Nat_is_eq(_i_0, 1), "umafolha", ""));
  } else {
    return "";
  }
}
function $optionKind(_key_0) {
  return $strIf($String_eq(_key_0, "colunas"), "columns", $strIf($String_eq(_key_0, "espaco"), "space", $strIf($either($String_eq(_key_0, "rodape"), $String_eq(_key_0, "capitulo")), "text", "flag")));
}
function $optionLabelGabarito(_m_0) {
  if (_m_0.$ === "ModelSimulado") {
    return $msg_msg("material.option.gabaritoSeparate");
  } else {
    return $msg_msg("material.option.gabaritoEnd");
  }
}
function $optionLabel(_m_0, _key_0) {
  return $strIf($String_eq(_key_0, "colunas"), $msg_msg("material.option.colunas"), $strIf($String_eq(_key_0, "rodape"), $msg_msg("material.option.rodape"), $strIf($String_eq(_key_0, "equacoes"), $msg_msg("material.option.equacoes"), $strIf($String_eq(_key_0, "recuo"), $msg_msg("material.option.recuo"), $strIf($String_eq(_key_0, "capitulo"), $msg_msg("material.option.capitulo"), $strIf($String_eq(_key_0, "regra"), $msg_msg("material.option.regra"), $strIf($String_eq(_key_0, "revisao"), $msg_msg("material.option.revisao"), $strIf($String_eq(_key_0, "valor"), $msg_msg("material.option.valor"), $strIf($String_eq(_key_0, "espaco"), $msg_msg("material.option.espaco"), $strIf($String_eq(_key_0, "umafolha"), $msg_msg("material.option.umafolha"), $optionLabelGabarito(_m_0)))))))))));
}
function $flagDefault(_m_0, _key_0) {
  if (_m_0.$ === "ModelLista") {
    return $String_eq(_key_0, "gabarito");
  } else if (_m_0.$ === "ModelApostila") {
    return $either($String_eq(_key_0, "equacoes"), $String_eq(_key_0, "recuo"));
  } else if (_m_0.$ === "ModelResumo") {
    return $either($String_eq(_key_0, "regra"), $String_eq(_key_0, "revisao"));
  } else if (_m_0.$ === "ModelSimulado") {
    return $either($String_eq(_key_0, "valor"), $String_eq(_key_0, "gabarito"));
  } else if (_m_0.$ === "ModelFormulario") {
    return false;
  } else {
    return false;
  }
}
function $flagOr(_value_0, _fallback_0) {
  if (_value_0.$ === "None") {
    return _fallback_0;
  } else {
    const _flag_0 = _value_0["value"];
    return _flag_0;
  }
}
function $maxOptionText() {
  return 80;
}
function $spaceDefault() {
  return "medio";
}
function $parseSpace(_raw_0) {
  return $strIf($String_eq(_raw_0, "pequeno"), "pequeno", $strIf($String_eq(_raw_0, "medio"), "medio", $strIf($String_eq(_raw_0, "grande"), "grande", $spaceDefault())));
}
function $spaceChoice(_value_0) {
  if (_value_0.$ === "None") {
    return $spaceDefault();
  } else {
    const _raw_0 = _value_0["value"];
    return $parseSpace(_raw_0);
  }
}
function $spaceLabel(_raw_0) {
  return $strIf($String_eq(_raw_0, "pequeno"), $msg_msg("material.space.pequeno"), $strIf($String_eq(_raw_0, "grande"), $msg_msg("material.space.grande"), $msg_msg("material.space.medio")));
}
function $columnsDefault() {
  return "auto";
}
function $columnsAllowed(_m_0, _raw_0) {
  if (_m_0.$ === "ModelLista") {
    return $either($String_eq(_raw_0, "auto"), $either($String_eq(_raw_0, "1"), $either($String_eq(_raw_0, "2"), $String_eq(_raw_0, "3"))));
  } else if (_m_0.$ === "ModelFormulario") {
    return $either($String_eq(_raw_0, "auto"), $either($String_eq(_raw_0, "2"), $String_eq(_raw_0, "3")));
  } else {
    return false;
  }
}
function $columnsKeep(_m_0, _raw_0) {
  return $strIf($columnsAllowed(_m_0, _raw_0), _raw_0, $columnsDefault());
}
function $columnsChoice(_m_0, _value_0) {
  if (_value_0.$ === "None") {
    return $columnsDefault();
  } else {
    const _raw_0 = _value_0["value"];
    return $columnsKeep(_m_0, _raw_0);
  }
}
function $columnsMax(_m_0) {
  if (_m_0.$ === "ModelLista") {
    return 3;
  } else if (_m_0.$ === "ModelFormulario") {
    return 3;
  } else {
    return 1;
  }
}
function $columnsMin(_m_0) {
  if (_m_0.$ === "ModelFormulario") {
    return 2;
  } else {
    return 1;
  }
}
function $colsFit(_n_0, _widest_0, _available_0, _gap_0) {
  const _x_0 = _n_0 < 1 ? 0 : _n_0 - 1;
  const _x_1 = nat_chk(_n_0 * _widest_0);
  const _x_2 = nat_chk(_x_0 * _gap_0);
  return $Nat_is_le(nat_chk(_x_1 + _x_2), _available_0);
}
function $autoPick(_max_0, _min_0, _widest_0, _available_0, _gap_0) {
  return $natIf($both($Nat_is_ge(_max_0, 3), $colsFit(3, _widest_0, _available_0, _gap_0)), 3, $natIf($both($Nat_is_ge(_max_0, 2), $colsFit(2, _widest_0, _available_0, _gap_0)), 2, _min_0));
}
function $autoColumns(_m_0, _widest_0, _available_0, _gap_0) {
  return $autoPick($columnsMax(_m_0), $columnsMin(_m_0), _widest_0, _available_0, _gap_0);
}
function $columnsLabel(_choice_0, _auto_0) {
  const _x_0 = $Nat_show(_auto_0);
  return $strIf($String_eq(_choice_0, "auto"), "Auto · " + _x_0, _choice_0);
}
function $answerHeightMm(_size_0, _long_0) {
  return $natIf($String_eq(_size_0, "pequeno"), $natIf(_long_0, 36, 22), $natIf($String_eq(_size_0, "grande"), $natIf(_long_0, 110, 80), $natIf(_long_0, 80, 36)));
}
function $phrasePedido(_label_0) {
  return $msg_msg1("material.status.agent", "model", _label_0);
}
function $phraseLast(_label_0) {
  return $msg_msg1("material.status.last", "model", _label_0);
}
function $phraseDefault(_label_0) {
  return $msg_msg1("material.status.default", "model", _label_0);
}
function $phraseChanged(_label_0) {
  return $msg_msg1("material.status.changed", "model", _label_0);
}
function $statusPhrase(_source_0, _model_0) {
  return $strIf($String_eq(_source_0, "agent"), $phrasePedido($labelKeyOf(_model_0)), $strIf($String_eq(_source_0, "last"), $phraseLast($labelKeyOf(_model_0)), $strIf($String_eq(_source_0, "changed"), $phraseChanged($labelKeyOf(_model_0)), $phraseDefault($labelKeyOf(_model_0)))));
}
function $pageOf(_page_0, _total_0) {
  return $msg_msg2("material.pageOf", "page", $Nat_show(_page_0), "total", $Nat_show(_total_0));
}
function $fitStart() {
  return 100;
}
function $fitFloor() {
  return 60;
}
function $fitStep() {
  return 4;
}
function $fitNext(_p_0) {
  const _x_0 = $fitFloor();
  const _x_1 = $fitStep();
  const _x_2 = $fitStep();
  return $natIf($Nat_is_le(_p_0, nat_chk(_x_0 + _x_1)), $fitFloor(), _p_0 < _x_2 ? 0 : _p_0 - _x_2);
}
function $fitDone(_p_0) {
  return $Nat_is_le(_p_0, $fitFloor());
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
function $Nat_is_eq(_a_0, _b_0) {
  return $Cmp_is_eq(cmp_new(_a_0, _b_0));
}
function $String_eq(_a_0, _b_0) {
  return $Cmp_is_eq($String_order(_a_0, _b_0));
}
function $Nat_is_le(_a_0, _b_0) {
  return $Cmp_is_le(cmp_new(_a_0, _b_0));
}
function $Nat_is_ge(_a_0, _b_0) {
  return $Cmp_is_ge(cmp_new(_a_0, _b_0));
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
function $Cmp_is_le(_c_0) {
  if (_c_0.$ === "GT") {
    return false;
  } else {
    return true;
  }
}
function $Cmp_is_ge(_c_0) {
  if (_c_0.$ === "LT") {
    return false;
  } else {
    return true;
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
var materialmodel_default = {
  "msg.mark": run_lib(() => str_out(run_loop($msg_mark())), 0),
  "msg.sep": run_lib(() => str_out(run_loop($msg_sep())), 0),
  "msg.pack": run_lib((a0) => str_out(run_loop($msg_pack(a0))), 1),
  "msg.msg": run_lib((a0) => str_out(run_loop($msg_msg(str_in(a0)))), 1),
  "msg.msg1": run_lib((a0, a1, a2) => str_out(run_loop($msg_msg1(str_in(a0), str_in(a1), str_in(a2)))), 3),
  "msg.msg2": run_lib((a0, a1, a2, a3, a4) => str_out(run_loop($msg_msg2(str_in(a0), str_in(a1), str_in(a2), str_in(a3), str_in(a4)))), 5),
  "msg.msg3": run_lib((a0, a1, a2, a3, a4, a5, a6) => str_out(run_loop($msg_msg3(str_in(a0), str_in(a1), str_in(a2), str_in(a3), str_in(a4), str_in(a5), str_in(a6)))), 7),
  "msg.msg4": run_lib((a0, a1, a2, a3, a4, a5, a6, a7, a8) => str_out(run_loop($msg_msg4(str_in(a0), str_in(a1), str_in(a2), str_in(a3), str_in(a4), str_in(a5), str_in(a6), str_in(a7), str_in(a8)))), 9),
  "msg.isMsg": run_lib((a0) => run_loop($msg_isMsg(str_in(a0))), 1),
  strIf: run_lib((a0, a1, a2) => str_out(run_loop($strIf(a0, str_in(a1), str_in(a2)))), 3),
  natIf: run_lib((a0, a1, a2) => run_loop($natIf(a0, nat_in(a1), nat_in(a2))), 3),
  boolIf: run_lib((a0, a1, a2) => run_loop($boolIf(a0, a1, a2)), 3),
  modelIf: run_lib((a0, a1, a2) => run_loop($modelIf(a0, a1, a2)), 3),
  both: run_lib((a0, a1) => run_loop($both(a0, a1)), 2),
  either: run_lib((a0, a1) => run_loop($either(a0, a1)), 2),
  modelCount: run_lib(() => run_loop($modelCount()), 0),
  modelId: run_lib((a0) => str_out(run_loop($modelId(a0))), 1),
  modelDefault: run_lib(() => run_loop($modelDefault()), 0),
  modelAt: run_lib((a0) => run_loop($modelAt(nat_in(a0))), 1),
  modelIdAt: run_lib((a0) => str_out(run_loop($modelIdAt(nat_in(a0)))), 1),
  parseModel: run_lib((a0, a1) => run_loop($parseModel(str_in(a0), a1)), 2),
  modelOrDefault: run_lib((a0, a1) => run_loop($modelOrDefault(a0, a1)), 2),
  isKnownModel: run_lib((a0) => run_loop($isKnownModel(str_in(a0))), 1),
  modelLabelKey: run_lib((a0) => str_out(run_loop($modelLabelKey(a0))), 1),
  modelLabel: run_lib((a0) => str_out(run_loop($modelLabel(a0))), 1),
  modelBlurb: run_lib((a0) => str_out(run_loop($modelBlurb(a0))), 1),
  labelOf: run_lib((a0) => str_out(run_loop($labelOf(str_in(a0)))), 1),
  labelKeyOf: run_lib((a0) => str_out(run_loop($labelKeyOf(str_in(a0)))), 1),
  blurbOf: run_lib((a0) => str_out(run_loop($blurbOf(str_in(a0)))), 1),
  resolveModel: run_lib((a0, a1) => run_loop($resolveModel(a0, a1)), 2),
  resolveModelId: run_lib((a0, a1) => str_out(run_loop($resolveModelId(a0, a1))), 2),
  sourceOfValue: run_lib((a0) => run_loop($sourceOfValue(a0)), 1),
  resolveSource: run_lib((a0, a1) => str_out(run_loop($resolveSource(a0, a1))), 2),
  optionCount: run_lib((a0) => run_loop($optionCount(a0)), 1),
  optionKeyAt: run_lib((a0, a1) => str_out(run_loop($optionKeyAt(a0, nat_in(a1)))), 2),
  optionKind: run_lib((a0) => str_out(run_loop($optionKind(str_in(a0)))), 1),
  optionLabelGabarito: run_lib((a0) => str_out(run_loop($optionLabelGabarito(a0))), 1),
  optionLabel: run_lib((a0, a1) => str_out(run_loop($optionLabel(a0, str_in(a1)))), 2),
  flagDefault: run_lib((a0, a1) => run_loop($flagDefault(a0, str_in(a1))), 2),
  flagOr: run_lib((a0, a1) => run_loop($flagOr(a0, a1)), 2),
  maxOptionText: run_lib(() => run_loop($maxOptionText()), 0),
  spaceDefault: run_lib(() => str_out(run_loop($spaceDefault())), 0),
  parseSpace: run_lib((a0) => str_out(run_loop($parseSpace(str_in(a0)))), 1),
  spaceChoice: run_lib((a0) => str_out(run_loop($spaceChoice(a0))), 1),
  spaceLabel: run_lib((a0) => str_out(run_loop($spaceLabel(str_in(a0)))), 1),
  columnsDefault: run_lib(() => str_out(run_loop($columnsDefault())), 0),
  columnsAllowed: run_lib((a0, a1) => run_loop($columnsAllowed(a0, str_in(a1))), 2),
  columnsKeep: run_lib((a0, a1) => str_out(run_loop($columnsKeep(a0, str_in(a1)))), 2),
  columnsChoice: run_lib((a0, a1) => str_out(run_loop($columnsChoice(a0, a1))), 2),
  columnsMax: run_lib((a0) => run_loop($columnsMax(a0)), 1),
  columnsMin: run_lib((a0) => run_loop($columnsMin(a0)), 1),
  colsFit: run_lib((a0, a1, a2, a3) => run_loop($colsFit(nat_in(a0), nat_in(a1), nat_in(a2), nat_in(a3))), 4),
  autoPick: run_lib((a0, a1, a2, a3, a4) => run_loop($autoPick(nat_in(a0), nat_in(a1), nat_in(a2), nat_in(a3), nat_in(a4))), 5),
  autoColumns: run_lib((a0, a1, a2, a3) => run_loop($autoColumns(a0, nat_in(a1), nat_in(a2), nat_in(a3))), 4),
  columnsLabel: run_lib((a0, a1) => str_out(run_loop($columnsLabel(str_in(a0), nat_in(a1)))), 2),
  answerHeightMm: run_lib((a0, a1) => run_loop($answerHeightMm(str_in(a0), a1)), 2),
  phrasePedido: run_lib((a0) => str_out(run_loop($phrasePedido(str_in(a0)))), 1),
  phraseLast: run_lib((a0) => str_out(run_loop($phraseLast(str_in(a0)))), 1),
  phraseDefault: run_lib((a0) => str_out(run_loop($phraseDefault(str_in(a0)))), 1),
  phraseChanged: run_lib((a0) => str_out(run_loop($phraseChanged(str_in(a0)))), 1),
  statusPhrase: run_lib((a0, a1) => str_out(run_loop($statusPhrase(str_in(a0), str_in(a1)))), 2),
  pageOf: run_lib((a0, a1) => str_out(run_loop($pageOf(nat_in(a0), nat_in(a1)))), 2),
  fitStart: run_lib(() => run_loop($fitStart()), 0),
  fitFloor: run_lib(() => run_loop($fitFloor()), 0),
  fitStep: run_lib(() => run_loop($fitStep()), 0),
  fitNext: run_lib((a0) => run_loop($fitNext(nat_in(a0))), 1),
  fitDone: run_lib((a0) => run_loop($fitDone(nat_in(a0))), 1)
};
export {
  materialmodel_default as default
};

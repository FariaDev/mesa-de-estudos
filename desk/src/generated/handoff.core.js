// GERADO de core/handoff.bend por `bun core/build.mjs` — não editar à mão.
// core/handoff.bend
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
function $header$() {
  return "[Da Conversa]";
}
function $seg$(_text_0) {
  return `
` + _text_0;
}
function $goalLine$(_goal_0) {
  return "- objetivo: " + _goal_0;
}
function $questionLine$(_question_0) {
  return "- pergunta pendente: " + _question_0;
}
function $refsHeader$() {
  return "- referências trazidas da Conversa:";
}
function $refLine$(_ref_0) {
  return "  · " + _ref_0;
}
function $refLines$(_refs_0) {
  if (_refs_0.$ === "Nil") {
    return "";
  } else {
    const _h_0 = _refs_0["head"];
    const _t_0 = _refs_0["tail"];
    const _x_0 = run_loop($seg$(run_loop($refLine$(_h_0))));
    const _x_1 = run_loop($refLines$(_t_0));
    return _x_0 + _x_1;
  }
}
function $refsBlock$(_refs_0) {
  if (_refs_0.$ === "Nil") {
    return "";
  } else {
    const _h_0 = _refs_0["head"];
    const _t_0 = _refs_0["tail"];
    const _x_0 = run_loop($seg$(run_loop($refsHeader$())));
    const _x_1 = run_loop($refLines$({ $: "Con", ["head"]: _h_0, ["tail"]: _t_0 }));
    return _x_0 + _x_1;
  }
}
function $optional$(_content_0, _empty_0) {
  if (_empty_0) {
    return "";
  } else {
    return run_jump($seg$, [_content_0]);
  }
}
function $staleNote$() {
  return "- atenção: bilhete escrito há mais de um dia; confirme com o usuário antes de tratar como o assunto de agora";
}
function $staleLine$(_staleFact_0) {
  if (_staleFact_0) {
    return run_jump($seg$, [run_loop($staleNote$())]);
  } else {
    return "";
  }
}
function $accepted$(_goal_0, _question_0) {
  const _x_0 = run_loop($Bool$not$(run_loop($String$is_empty$(_goal_0))));
  const _x_1 = run_loop($Bool$not$(run_loop($String$is_empty$(_question_0))));
  return _x_0 || _x_1;
}
function $cleanGoal$(_goal_0) {
  return run_jump($String$take$, [run_loop($String$trim$(_goal_0)), BigInt(400)]);
}
function $cleanQuestion$(_question_0) {
  return run_jump($String$take$, [run_loop($String$trim$(_question_0)), BigInt(2000)]);
}
function $body$(_goal_0, _question_0, _refs_0) {
  const _x_0 = run_loop($optional$(run_loop($goalLine$(_goal_0)), run_loop($String$is_empty$(_goal_0))));
  const _x_1 = run_loop($optional$(run_loop($questionLine$(_question_0)), run_loop($String$is_empty$(_question_0))));
  const _x_2 = _x_0 + _x_1;
  const _x_3 = run_loop($refsBlock$(_refs_0));
  return _x_2 + _x_3;
}
function $render$(_goal_0, _question_0, _refs_0, _acceptedFact_0, _staleFact_0) {
  if (!_acceptedFact_0) {
    return "";
  } else {
    const _x_0 = run_loop($header$());
    const _x_1 = run_loop($body$(_goal_0, _question_0, _refs_0));
    const _x_2 = _x_0 + _x_1;
    const _x_3 = run_loop($staleLine$(_staleFact_0));
    return _x_2 + _x_3;
  }
}
function $Bool$not$(_b_0) {
  if (!_b_0) {
    return true;
  } else {
    return false;
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
function $String$trim$(_s_0) {
  return run_jump($String$trim_end$, [run_loop($String$trim_start$(_s_0))]);
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
function $String$reverse$go$(_s_0, _acc_0) {
  if (_s_0 === "") {
    return _acc_0;
  } else {
    const _h_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(0, 2) : _s_0[0];
    const _t_0 = _s_0.codePointAt(0) > 65535 ? _s_0.slice(2) : _s_0.slice(1);
    return run_jump($String$reverse$go$, [_t_0, _h_0 + _acc_0]);
  }
}
function $Bool$and$(_a_0, _b_0) {
  if (!_a_0) {
    return false;
  } else {
    return _b_0;
  }
}
var handoff_default = {
  header: run_lib($header$, 0),
  seg: run_lib($seg$, 1),
  goalLine: run_lib($goalLine$, 1),
  questionLine: run_lib($questionLine$, 1),
  refsHeader: run_lib($refsHeader$, 0),
  refLine: run_lib($refLine$, 1),
  refLines: run_lib($refLines$, 1),
  refsBlock: run_lib($refsBlock$, 1),
  optional: run_lib($optional$, 2),
  staleNote: run_lib($staleNote$, 0),
  staleLine: run_lib($staleLine$, 1),
  accepted: run_lib($accepted$, 2),
  cleanGoal: run_lib($cleanGoal$, 1),
  cleanQuestion: run_lib($cleanQuestion$, 1),
  body: run_lib($body$, 3),
  render: run_lib($render$, 5)
};
export {
  handoff_default as default
};

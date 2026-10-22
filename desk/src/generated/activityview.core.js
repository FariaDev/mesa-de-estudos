// GERADO de core/activityview.bend por `bun core/build.mjs` — não editar à mão.
// core/activityview.bend
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
function $listIf(_hit_0, _found_0, _rest_0) {
  if (_hit_0) {
    return _found_0;
  } else {
    return _rest_0;
  }
}
function $natMax(_a_0, _b_0) {
  return $natIf($Nat_is_gt(_a_0, _b_0), _a_0, _b_0);
}
function $vizKind() {
  return "visualizacao";
}
function $activityKind() {
  return "atividade";
}
function $kindOf(_raw_0) {
  return $strIf($String_eq(_raw_0, $vizKind()), $vizKind(), $activityKind());
}
function $isViz(_kind_0) {
  return $String_eq($kindOf(_kind_0), $vizKind());
}
function $showsBring(_kind_0) {
  return $Bool_not($isViz(_kind_0));
}
function $controlIds(_kind_0) {
  return $listIf($isViz(_kind_0), { $: "Con", head: "fullscreen", tail: { $: "Nil" } }, { $: "Con", head: "fullscreen", tail: { $: "Con", head: "restart", tail: { $: "Con", head: "stop", tail: { $: "Con", head: "bring", tail: { $: "Nil" } } } } });
}
function $restartLabel() {
  return $msg_msg("activity.restart");
}
function $stopLabel() {
  return $msg_msg("activity.stop");
}
function $openLabel() {
  return $msg_msg("activity.open");
}
function $kindKey(_kind_0) {
  return $strIf($isViz(_kind_0), "activity.kind.viz", "activity.kind.activity");
}
function $kindLabel(_kind_0) {
  return $msg_msg($kindKey(_kind_0));
}
function $fullscreenLabel() {
  return $msg_msg("activity.fullscreen");
}
function $exitFullscreenLabel() {
  return $msg_msg("activity.exitFullscreen");
}
function $bringLabel() {
  return $msg_msg("activity.bring");
}
function $bringDone() {
  return $msg_msg("activity.bringDone");
}
function $descriptionLabel() {
  return $msg_msg("activity.description");
}
function $frameTitle(_kind_0, _title_0) {
  return $msg_msg2("activity.frameTitle", "kind", $kindKey(_kind_0), "title", _title_0);
}
function $heightMin() {
  return 48;
}
function $heightMax() {
  return 1200;
}
function $clampHeight(_h_0) {
  const _x_0 = $heightMin();
  return $natIf(_h_0 < _x_0, $heightMin(), $natIf($Nat_is_gt(_h_0, $heightMax()), $heightMax(), _h_0));
}
function $measureWidths() {
  return { $: "Con", head: 320, tail: { $: "Con", head: 375, tail: { $: "Con", head: 430, tail: { $: "Con", head: 520, tail: { $: "Con", head: 640, tail: { $: "Con", head: 728, tail: { $: "Con", head: 860, tail: { $: "Con", head: 1000, tail: { $: "Con", head: 1144, tail: { $: "Nil" } } } } } } } } } };
}
function $heightAt_hit(_prev_0, _w_0, _ht_0, _width_0) {
  return $natIf($Nat_is_eq(_w_0, _width_0), _ht_0, $natMax(_prev_0, _ht_0));
}
function $heightAt_go(_pairs_0, _prev_0, _width_0) {
  if (_pairs_0.$ === "Nil") {
    return _prev_0;
  } else {
    const _t_0 = _pairs_0["head"];
    const _w_0 = _t_0["width"];
    const _ht_0 = _t_0["height"];
    const _t_1 = _pairs_0["tail"];
    return $natIf($Nat_is_ge(_w_0, _width_0), $heightAt_hit(_prev_0, _w_0, _ht_0, _width_0), $heightAt_go(_t_1, _ht_0, _width_0));
  }
}
function $heightAt(_pairs_0, _width_0) {
  return $heightAt_go(_pairs_0, 0, _width_0);
}
function $initialHeight(_pairs_0, _width_0) {
  const _raw_0 = $heightAt(_pairs_0, _width_0);
  return $natIf($Nat_is_eq(_raw_0, 0), 0, $clampHeight(_raw_0));
}
function $isDark(_theme_0) {
  return $String_eq(_theme_0, "dark");
}
function $byTheme(_theme_0, _light_0, _dark_0) {
  return $strIf($isDark(_theme_0), _dark_0, _light_0);
}
function $accentIds() {
  return { $: "Con", head: "blue", tail: { $: "Con", head: "violet", tail: { $: "Con", head: "green", tail: { $: "Con", head: "orange", tail: { $: "Con", head: "pink", tail: { $: "Con", head: "graphite", tail: { $: "Nil" } } } } } } };
}
function $accentOf(_accent_0) {
  return $strIf($String_eq(_accent_0, "violet"), "violet", $strIf($String_eq(_accent_0, "green"), "green", $strIf($String_eq(_accent_0, "orange"), "orange", $strIf($String_eq(_accent_0, "pink"), "pink", $strIf($String_eq(_accent_0, "graphite"), "graphite", "blue")))));
}
function $accentFill(_theme_0, _accent_0) {
  return $strIf($String_eq($accentOf(_accent_0), "violet"), $byTheme(_theme_0, "#6d28d9", "#7c3aed"), $strIf($String_eq($accentOf(_accent_0), "green"), $byTheme(_theme_0, "#0f7b55", "#12805a"), $strIf($String_eq($accentOf(_accent_0), "orange"), $byTheme(_theme_0, "#c2410c", "#c2410c"), $strIf($String_eq($accentOf(_accent_0), "pink"), $byTheme(_theme_0, "#c02667", "#c2255c"), $strIf($String_eq($accentOf(_accent_0), "graphite"), $byTheme(_theme_0, "#27272a", "#ededed"), $byTheme(_theme_0, "#2548c7", "#3b5bdb"))))));
}
function $accentText(_theme_0, _accent_0) {
  return $strIf($String_eq($accentOf(_accent_0), "violet"), $byTheme(_theme_0, "#6d28d9", "#a78bfa"), $strIf($String_eq($accentOf(_accent_0), "green"), $byTheme(_theme_0, "#0f7b55", "#5fd3a4"), $strIf($String_eq($accentOf(_accent_0), "orange"), $byTheme(_theme_0, "#c2410c", "#fb9a6b"), $strIf($String_eq($accentOf(_accent_0), "pink"), $byTheme(_theme_0, "#c02667", "#f783ac"), $strIf($String_eq($accentOf(_accent_0), "graphite"), $byTheme(_theme_0, "#27272a", "#ededed"), $byTheme(_theme_0, "#2548c7", "#8fa8ff"))))));
}
function $accentFg(_theme_0, _accent_0) {
  return $strIf($String_eq($accentOf(_accent_0), "graphite"), $byTheme(_theme_0, "#ffffff", "#181818"), "#ffffff");
}
function $slot(_theme_0, _accent_0, _family_0, _light_0, _dark_0, _spareLight_0, _spareDark_0) {
  return $strIf($String_eq($accentOf(_accent_0), _family_0), $byTheme(_theme_0, _spareLight_0, _spareDark_0), $byTheme(_theme_0, _light_0, _dark_0));
}
function $chartColors(_theme_0, _accent_0) {
  return { $: "Con", head: $accentText(_theme_0, _accent_0), tail: { $: "Con", head: $slot(_theme_0, _accent_0, "orange", "#c77700", "#d9480f", "#0b9b8f", "#0d9488"), tail: { $: "Con", head: $slot(_theme_0, _accent_0, "violet", "#3b1782", "#c4b5fd", "#13423e", "#99f6e4"), tail: { $: "Con", head: $slot(_theme_0, _accent_0, "pink", "#e0508a", "#db2777", "#1a8aa8", "#0d9488"), tail: { $: "Con", head: $slot(_theme_0, _accent_0, "green", "#2f4a10", "#a3e635", "#1b2f78", "#93c5fd"), tail: { $: "Con", head: $slot(_theme_0, _accent_0, "blue", "#3d6fd0", "#60a5fa", "#8a5a06", "#f59e0b"), tail: { $: "Nil" } } } } } } };
}
function $fontSans() {
  return '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
}
function $fontSerif() {
  return '"STIX Two Text", "Latin Modern Roman", "CMU Serif", Palatino, "Palatino Linotype", "Times New Roman", serif';
}
function $fontMono() {
  return '"SF Mono", SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';
}
function $radius() {
  return "8px";
}
function $chartTokens_go(_colors_0, _i_0) {
  if (_colors_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _h_0 = _colors_0["head"];
    const _t_0 = _colors_0["tail"];
    const _x_0 = $Nat_show(_i_0);
    return { $: "Con", head: { $: "Token", name: "--mesa-chart-" + _x_0, value: _h_0 }, tail: $chartTokens_go(_t_0, nat_chk(_i_0 + 1)) };
  }
}
function $chartTokens(_theme_0, _accent_0) {
  return $chartTokens_go($chartColors(_theme_0, _accent_0), 1);
}
function $baseTokens(_theme_0, _accent_0) {
  return { $: "Con", head: { $: "Token", name: "--mesa-bg", value: $byTheme(_theme_0, "#f4f4f4", "#242424") }, tail: { $: "Con", head: { $: "Token", name: "--mesa-fg", value: $byTheme(_theme_0, "#272727", "#e4e4e4") }, tail: { $: "Con", head: { $: "Token", name: "--mesa-muted", value: $byTheme(_theme_0, "#525252", "#a6a6a6") }, tail: { $: "Con", head: { $: "Token", name: "--mesa-card", value: $byTheme(_theme_0, "#ffffff", "#2c2c2c") }, tail: { $: "Con", head: { $: "Token", name: "--mesa-surface", value: $byTheme(_theme_0, "#ffffff", "#2c2c2c") }, tail: { $: "Con", head: { $: "Token", name: "--mesa-hover", value: $byTheme(_theme_0, "#e8e8e8", "#333333") }, tail: { $: "Con", head: { $: "Token", name: "--mesa-border", value: $byTheme(_theme_0, "#dadada", "#3a3a3a") }, tail: { $: "Con", head: { $: "Token", name: "--mesa-input", value: $byTheme(_theme_0, "#c7c7c7", "#4a4a4a") }, tail: { $: "Con", head: { $: "Token", name: "--mesa-ring", value: $accentText(_theme_0, _accent_0) }, tail: { $: "Con", head: { $: "Token", name: "--mesa-accent", value: $accentFill(_theme_0, _accent_0) }, tail: { $: "Con", head: { $: "Token", name: "--mesa-accent-fg", value: $accentFg(_theme_0, _accent_0) }, tail: { $: "Con", head: { $: "Token", name: "--mesa-accent-text", value: $accentText(_theme_0, _accent_0) }, tail: { $: "Con", head: { $: "Token", name: "--mesa-good", value: $byTheme(_theme_0, "#15803d", "#34d399") }, tail: { $: "Con", head: { $: "Token", name: "--mesa-good-surface", value: $byTheme(_theme_0, "#e6f4ea", "#1d3a2c") }, tail: { $: "Con", head: { $: "Token", name: "--mesa-warn", value: $byTheme(_theme_0, "#b45309", "#fbbf24") }, tail: { $: "Con", head: { $: "Token", name: "--mesa-warn-surface", value: $byTheme(_theme_0, "#fdf2dc", "#3d3220") }, tail: { $: "Con", head: { $: "Token", name: "--mesa-bad", value: $byTheme(_theme_0, "#c4281c", "#f08a80") }, tail: { $: "Con", head: { $: "Token", name: "--mesa-bad-surface", value: $byTheme(_theme_0, "#fbe9e7", "#432624") }, tail: { $: "Con", head: { $: "Token", name: "--mesa-code-bg", value: $byTheme(_theme_0, "#ffffff", "#2c2c2c") }, tail: { $: "Con", head: { $: "Token", name: "--mesa-code-fg", value: $byTheme(_theme_0, "#272727", "#e4e4e4") }, tail: { $: "Con", head: { $: "Token", name: "--mesa-radius", value: $radius() }, tail: { $: "Con", head: { $: "Token", name: "--mesa-font-sans", value: $fontSans() }, tail: { $: "Con", head: { $: "Token", name: "--mesa-font-serif", value: $fontSerif() }, tail: { $: "Con", head: { $: "Token", name: "--mesa-font-mono", value: $fontMono() }, tail: { $: "Nil" } } } } } } } } } } } } } } } } } } } } } } } } };
}
function $mesaTokens(_theme_0, _accent_0) {
  return $List_append($baseTokens(_theme_0, _accent_0), $chartTokens(_theme_0, _accent_0));
}
function $valueOf(_name_0, _tokens_0) {
  if (_tokens_0.$ === "Nil") {
    return "";
  } else {
    const _t_0 = _tokens_0["head"];
    const _n_0 = _t_0["name"];
    const _v_0 = _t_0["value"];
    const _t_1 = _tokens_0["tail"];
    return $strIf($String_eq(_n_0, _name_0), _v_0, $valueOf(_name_0, _t_1));
  }
}
function $mcpPairs() {
  return { $: "Con", head: { $: "Token", name: "--color-background-primary", value: "--mesa-bg" }, tail: { $: "Con", head: { $: "Token", name: "--color-background-secondary", value: "--mesa-card" }, tail: { $: "Con", head: { $: "Token", name: "--color-background-tertiary", value: "--mesa-hover" }, tail: { $: "Con", head: { $: "Token", name: "--color-background-inverse", value: "--mesa-fg" }, tail: { $: "Con", head: { $: "Token", name: "--color-background-info", value: "--mesa-accent" }, tail: { $: "Con", head: { $: "Token", name: "--color-background-danger", value: "--mesa-bad-surface" }, tail: { $: "Con", head: { $: "Token", name: "--color-background-warning", value: "--mesa-warn-surface" }, tail: { $: "Con", head: { $: "Token", name: "--color-background-success", value: "--mesa-good-surface" }, tail: { $: "Con", head: { $: "Token", name: "--color-text-primary", value: "--mesa-fg" }, tail: { $: "Con", head: { $: "Token", name: "--color-text-secondary", value: "--mesa-muted" }, tail: { $: "Con", head: { $: "Token", name: "--color-text-tertiary", value: "--mesa-muted" }, tail: { $: "Con", head: { $: "Token", name: "--color-text-inverse", value: "--mesa-bg" }, tail: { $: "Con", head: { $: "Token", name: "--color-text-info", value: "--mesa-accent-text" }, tail: { $: "Con", head: { $: "Token", name: "--color-text-danger", value: "--mesa-bad" }, tail: { $: "Con", head: { $: "Token", name: "--color-text-success", value: "--mesa-good" }, tail: { $: "Con", head: { $: "Token", name: "--color-text-warning", value: "--mesa-warn" }, tail: { $: "Con", head: { $: "Token", name: "--color-border-primary", value: "--mesa-border" }, tail: { $: "Con", head: { $: "Token", name: "--color-border-secondary", value: "--mesa-input" }, tail: { $: "Con", head: { $: "Token", name: "--color-border-danger", value: "--mesa-bad" }, tail: { $: "Con", head: { $: "Token", name: "--color-ring-primary", value: "--mesa-ring" }, tail: { $: "Con", head: { $: "Token", name: "--font-sans", value: "--mesa-font-sans" }, tail: { $: "Con", head: { $: "Token", name: "--font-mono", value: "--mesa-font-mono" }, tail: { $: "Con", head: { $: "Token", name: "--border-radius-md", value: "--mesa-radius" }, tail: { $: "Nil" } } } } } } } } } } } } } } } } } } } } } } } };
}
function $mcpTokens_go(_pairs_0, _mesa_0) {
  if (_pairs_0.$ === "Nil") {
    return { $: "Nil" };
  } else {
    const _t_0 = _pairs_0["head"];
    const _name_0 = _t_0["name"];
    const _from_0 = _t_0["value"];
    const _t_1 = _pairs_0["tail"];
    return { $: "Con", head: { $: "Token", name: _name_0, value: $valueOf(_from_0, _mesa_0) }, tail: $mcpTokens_go(_t_1, _mesa_0) };
  }
}
function $mcpTokens(_theme_0, _accent_0) {
  return $mcpTokens_go($mcpPairs(), $mesaTokens(_theme_0, _accent_0));
}
function $themeTokens(_theme_0, _accent_0) {
  return $List_append($mesaTokens(_theme_0, _accent_0), $mcpTokens(_theme_0, _accent_0));
}
function $schemeOf(_theme_0) {
  return $byTheme(_theme_0, "light", "dark");
}
function $declarations(_tokens_0) {
  if (_tokens_0.$ === "Nil") {
    return "";
  } else {
    const _t_0 = _tokens_0["head"];
    const _n_0 = _t_0["name"];
    const _v_0 = _t_0["value"];
    const _t_1 = _tokens_0["tail"];
    const _x_0 = _n_0 + ":";
    const _x_1 = _x_0 + _v_0;
    const _x_2 = _x_1 + ";";
    const _x_3 = $declarations(_t_1);
    return _x_2 + _x_3;
  }
}
function $rootCss(_theme_0, _accent_0) {
  const _x_0 = $schemeOf(_theme_0);
  const _x_1 = ":root{color-scheme:" + _x_0;
  const _x_2 = $declarations($themeTokens(_theme_0, _accent_0));
  const _x_3 = _x_1 + ";";
  const _x_4 = _x_2 + "}";
  return _x_3 + _x_4;
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
function $Nat_is_gt(_a_0, _b_0) {
  return $Cmp_is_gt(cmp_new(_a_0, _b_0));
}
function $String_eq(_a_0, _b_0) {
  return $Cmp_is_eq($String_order(_a_0, _b_0));
}
function $Bool_not(_b_0) {
  if (!_b_0) {
    return true;
  } else {
    return false;
  }
}
function $Nat_is_eq(_a_0, _b_0) {
  return $Cmp_is_eq(cmp_new(_a_0, _b_0));
}
function $Nat_is_ge(_a_0, _b_0) {
  return $Cmp_is_ge(cmp_new(_a_0, _b_0));
}
function $Nat_show(_n_0) {
  const _m_0 = _n_0;
  return $Nat_show_fin(_m_0, "", $Nat_show_put(nat_divmod(_m_0, 10)));
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
var activityview_default = {
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
  listIf: run_lib((a0, a1, a2) => run_loop($listIf(a0, a1, a2)), 3),
  natMax: run_lib((a0, a1) => run_loop($natMax(nat_in(a0), nat_in(a1))), 2),
  vizKind: run_lib(() => str_out(run_loop($vizKind())), 0),
  activityKind: run_lib(() => str_out(run_loop($activityKind())), 0),
  kindOf: run_lib((a0) => str_out(run_loop($kindOf(str_in(a0)))), 1),
  isViz: run_lib((a0) => run_loop($isViz(str_in(a0))), 1),
  showsBring: run_lib((a0) => run_loop($showsBring(str_in(a0))), 1),
  controlIds: run_lib((a0) => run_loop($controlIds(str_in(a0))), 1),
  restartLabel: run_lib(() => str_out(run_loop($restartLabel())), 0),
  stopLabel: run_lib(() => str_out(run_loop($stopLabel())), 0),
  openLabel: run_lib(() => str_out(run_loop($openLabel())), 0),
  kindKey: run_lib((a0) => str_out(run_loop($kindKey(str_in(a0)))), 1),
  kindLabel: run_lib((a0) => str_out(run_loop($kindLabel(str_in(a0)))), 1),
  fullscreenLabel: run_lib(() => str_out(run_loop($fullscreenLabel())), 0),
  exitFullscreenLabel: run_lib(() => str_out(run_loop($exitFullscreenLabel())), 0),
  bringLabel: run_lib(() => str_out(run_loop($bringLabel())), 0),
  bringDone: run_lib(() => str_out(run_loop($bringDone())), 0),
  descriptionLabel: run_lib(() => str_out(run_loop($descriptionLabel())), 0),
  frameTitle: run_lib((a0, a1) => str_out(run_loop($frameTitle(str_in(a0), str_in(a1)))), 2),
  heightMin: run_lib(() => run_loop($heightMin()), 0),
  heightMax: run_lib(() => run_loop($heightMax()), 0),
  clampHeight: run_lib((a0) => run_loop($clampHeight(nat_in(a0))), 1),
  measureWidths: run_lib(() => run_loop($measureWidths()), 0),
  "heightAt.hit": run_lib((a0, a1, a2, a3) => run_loop($heightAt_hit(nat_in(a0), nat_in(a1), nat_in(a2), nat_in(a3))), 4),
  "heightAt.go": run_lib((a0, a1, a2) => run_loop($heightAt_go(a0, nat_in(a1), nat_in(a2))), 3),
  heightAt: run_lib((a0, a1) => run_loop($heightAt(a0, nat_in(a1))), 2),
  initialHeight: run_lib((a0, a1) => run_loop($initialHeight(a0, nat_in(a1))), 2),
  isDark: run_lib((a0) => run_loop($isDark(str_in(a0))), 1),
  byTheme: run_lib((a0, a1, a2) => str_out(run_loop($byTheme(str_in(a0), str_in(a1), str_in(a2)))), 3),
  accentIds: run_lib(() => run_loop($accentIds()), 0),
  accentOf: run_lib((a0) => str_out(run_loop($accentOf(str_in(a0)))), 1),
  accentFill: run_lib((a0, a1) => str_out(run_loop($accentFill(str_in(a0), str_in(a1)))), 2),
  accentText: run_lib((a0, a1) => str_out(run_loop($accentText(str_in(a0), str_in(a1)))), 2),
  accentFg: run_lib((a0, a1) => str_out(run_loop($accentFg(str_in(a0), str_in(a1)))), 2),
  slot: run_lib((a0, a1, a2, a3, a4, a5, a6) => str_out(run_loop($slot(str_in(a0), str_in(a1), str_in(a2), str_in(a3), str_in(a4), str_in(a5), str_in(a6)))), 7),
  chartColors: run_lib((a0, a1) => run_loop($chartColors(str_in(a0), str_in(a1))), 2),
  fontSans: run_lib(() => str_out(run_loop($fontSans())), 0),
  fontSerif: run_lib(() => str_out(run_loop($fontSerif())), 0),
  fontMono: run_lib(() => str_out(run_loop($fontMono())), 0),
  radius: run_lib(() => str_out(run_loop($radius())), 0),
  "chartTokens.go": run_lib((a0, a1) => run_loop($chartTokens_go(a0, nat_in(a1))), 2),
  chartTokens: run_lib((a0, a1) => run_loop($chartTokens(str_in(a0), str_in(a1))), 2),
  baseTokens: run_lib((a0, a1) => run_loop($baseTokens(str_in(a0), str_in(a1))), 2),
  mesaTokens: run_lib((a0, a1) => run_loop($mesaTokens(str_in(a0), str_in(a1))), 2),
  valueOf: run_lib((a0, a1) => str_out(run_loop($valueOf(str_in(a0), a1))), 2),
  mcpPairs: run_lib(() => run_loop($mcpPairs()), 0),
  "mcpTokens.go": run_lib((a0, a1) => run_loop($mcpTokens_go(a0, a1)), 2),
  mcpTokens: run_lib((a0, a1) => run_loop($mcpTokens(str_in(a0), str_in(a1))), 2),
  themeTokens: run_lib((a0, a1) => run_loop($themeTokens(str_in(a0), str_in(a1))), 2),
  schemeOf: run_lib((a0) => str_out(run_loop($schemeOf(str_in(a0)))), 1),
  declarations: run_lib((a0) => str_out(run_loop($declarations(a0))), 1),
  rootCss: run_lib((a0, a1) => str_out(run_loop($rootCss(str_in(a0), str_in(a1)))), 2)
};
export {
  activityview_default as default
};

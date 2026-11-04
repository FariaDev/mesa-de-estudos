// @ts-check
/* Cores literais do SVG do tutor viram tokens do tema (#60). O modelo recebe
   `currentColor` e `var(--plot-1…6)` na descrição da ferramenta, mas escreve
   hex, rgb() e nome (`orange`, `#2563eb`) mesmo assim: o DOMPurify deixava
   passar, porque não é risco de segurança, e a figura ficava fora da paleta
   no tema claro e no escuro. A troca acontece na guarda, no chat, no PDF e
   na prévia. O acento da interface é uma cor só; a figura precisa de séries
   distinguíveis, então o token é `--plot-*` (claro/escuro no chat, tons
   escuros no PDF) e a tinta estrutural é `currentColor`. */

const PAINT_ATTR = new Set(['fill', 'stroke', 'color', 'stop-color', 'flood-color', 'lighting-color']);
const STYLE_PAINT = /(^|;)(\s*)(fill|stroke|color|stop-color|flood-color|lighting-color)(\s*:\s*)([^;]+)/gi;
const KEEP = /^(?:none|transparent|currentcolor|inherit|unset|revert|context-stroke|context-fill)$/i;
const CHROMA_MIN = 0.12;
const PAPER_LUM = 0.62;
const PLOT_SLOTS = 6;

/* Nomes CSS que um modelo escreve no lugar de um token. Hex de css-color-4. */
const NAMED = Object.fromEntries(`black:000000 white:ffffff gray:808080 grey:808080 silver:c0c0c0 red:ff0000 maroon:800000 yellow:ffff00 olive:808000 lime:00ff00 green:008000 aqua:00ffff cyan:00ffff teal:008080 blue:0000ff navy:000080 fuchsia:ff00ff magenta:ff00ff purple:800080 orange:ffa500
aliceblue:f0f8ff antiquewhite:faebd7 aquamarine:7fffd4 azure:f0ffff beige:f5f5dc bisque:ffe4c4 blanchedalmond:ffebcd blueviolet:8a2be2 brown:a52a2a burlywood:deb887 cadetblue:5f9ea0 chartreuse:7fff00 chocolate:d2691e coral:ff7f50 cornflowerblue:6495ed cornsilk:fff8dc crimson:dc143c
darkblue:00008b darkcyan:008b8b darkgoldenrod:b8860b darkgray:a9a9a9 darkgrey:a9a9a9 darkgreen:006400 darkkhaki:bdb76b darkmagenta:8b008b darkolivegreen:556b2f darkorange:ff8c00 darkorchid:9932cc darkred:8b0000 darksalmon:e9967a darkseagreen:8fbc8f darkslateblue:483d8b darkslategray:2f4f4f darkslategrey:2f4f4f darkturquoise:00ced1 darkviolet:9400d3
deeppink:ff1493 deepskyblue:00bfff dimgray:696969 dimgrey:696969 dodgerblue:1e90ff firebrick:b22222 floralwhite:fffaf0 forestgreen:228b22 gainsboro:dcdcdc ghostwhite:f8f8ff gold:ffd700 goldenrod:daa520 greenyellow:adff2f honeydew:f0fff0 hotpink:ff69b4 indianred:cd5c5c indigo:4b0082 ivory:fffff0
khaki:f0e68c lavender:e6e6fa lavenderblush:fff0f5 lawngreen:7cfc00 lemonchiffon:fffacd lightblue:add8e6 lightcoral:f08080 lightcyan:e0ffff lightgoldenrodyellow:fafad2 lightgray:d3d3d3 lightgrey:d3d3d3 lightgreen:90ee90 lightpink:ffb6c1 lightsalmon:ffa07a lightseagreen:20b2aa lightskyblue:87cefa lightslategray:778899 lightslategrey:778899 lightsteelblue:b0c4de lightyellow:ffffe0
limegreen:32cd32 linen:faf0e6 mediumaquamarine:66cdaa mediumblue:0000cd mediumorchid:ba55d3 mediumpurple:9370db mediumseagreen:3cb371 mediumslateblue:7b68ee mediumspringgreen:00fa9a mediumturquoise:48d1cc mediumvioletred:c71585 midnightblue:191970 mintcream:f5fffa mistyrose:ffe4e1 moccasin:ffe4b5 navajowhite:ffdead
oldlace:fdf5e6 olivedrab:6b8e23 orangered:ff4500 orchid:da70d6 palegoldenrod:eee8aa palegreen:98fb98 paleturquoise:afeeee palevioletred:db7093 papayawhip:ffefd5 peachpuff:ffdab9 peru:cd853f pink:ffc0cb plum:dda0dd powderblue:b0e0e6 rebeccapurple:663399 rosybrown:bc8f8f royalblue:4169e1 saddlebrown:8b4513 salmon:fa8072 sandybrown:f4a460 seagreen:2e8b57 seashell:fff5ee sienna:a0522d
skyblue:87ceeb slateblue:6a5acd slategray:708090 slategrey:708090 snow:fffafa springgreen:00ff7f steelblue:4682b4 tan:d2b48c thistle:d8bfd8 tomato:ff6347 turquoise:40e0d0 violet:ee82ee wheat:f5deb3 whitesmoke:f5f5f5 yellowgreen:9acd32`.split(/\s+/).map((pair) => {
  const [name, hex] = pair.split(':');
  return [name, hex];
}));

/** @typedef {{r: number, g: number, b: number, a: number}} Rgb */

/** @param {number} channel 0..255 */
function linear(channel) {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/** @param {Rgb} color */
function luminance(color) {
  return 0.2126 * linear(color.r) + 0.7152 * linear(color.g) + 0.0722 * linear(color.b);
}

/** @param {string} text @returns {number} 0..255 */
function byte(text) {
  return parseInt(text, 16);
}

/** @param {string} body sem o `#` @returns {Rgb|null} */
function fromHex(body) {
  const expanded = body.length === 3 || body.length === 4 ? [...body].map((char) => char + char).join('') : body;
  if (expanded.length !== 6 && expanded.length !== 8) return null;
  if (!/^[0-9a-f]+$/.test(expanded)) return null;
  return {
    r: byte(expanded.slice(0, 2)), g: byte(expanded.slice(2, 4)), b: byte(expanded.slice(4, 6)),
    a: expanded.length === 8 ? byte(expanded.slice(6, 8)) / 255 : 1,
  };
}

/** @param {string} token @returns {number} */
function channel(token) {
  const text = token.trim();
  if (text.endsWith('%')) return Math.round(Math.min(100, Math.max(0, parseFloat(text))) * 2.55);
  return Math.round(Math.min(255, Math.max(0, parseFloat(text))));
}

/** @param {string|undefined} token @returns {number} */
function alpha(token) {
  if (!token) return 1;
  const text = token.trim();
  const value = text.endsWith('%') ? parseFloat(text) / 100 : parseFloat(text);
  if (!Number.isFinite(value)) return 1;
  return Math.min(1, Math.max(0, value));
}

/** @param {string} body conteúdo de rgb()/rgba()/hsl()/hsla() @param {boolean} hsl */
function fromFunction(body, hsl) {
  const [head, tail] = body.split('/');
  const parts = head.split(/[\s,]+/).map((part) => part.trim()).filter(Boolean);
  if (parts.length < 3 || parts.slice(0, 3).some((part) => !Number.isFinite(parseFloat(part)))) return null;
  const opacity = alpha(tail ?? (parts.length > 3 ? parts[3] : undefined));
  if (hsl) {
    const [r, g, b] = hslToRgb(parseFloat(parts[0]), parseFloat(parts[1]), parseFloat(parts[2]));
    return {r, g, b, a: opacity};
  }
  return {r: channel(parts[0]), g: channel(parts[1]), b: channel(parts[2]), a: opacity};
}

/** @param {number} hue @param {number} sat @param {number} lig @returns {[number, number, number]} */
function hslToRgb(hue, sat, lig) {
  const turn = ((hue % 360) + 360) % 360;
  const s = Math.min(100, Math.max(0, sat)) / 100;
  const l = Math.min(100, Math.max(0, lig)) / 100;
  const span = s * Math.min(l, 1 - l);
  const channelAt = (n) => {
    const k = (n + turn / 30) % 12;
    const value = l - span * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(Math.min(1, Math.max(0, value)) * 255);
  };
  return [channelAt(0), channelAt(8), channelAt(4)];
}

/**
 * Cor literal, ou null quando o valor já é token, `none` ou `url()`.
 * @param {string} raw
 * @returns {Rgb|null}
 * @example literalColor('#2563eb') // {r: 37, g: 99, b: 235, a: 1}
 */
export function literalColor(raw) {
  const value = String(raw).replace(/!important\s*$/i, '').trim().toLowerCase();
  if (!value || KEEP.test(value) || /^var\s*\(/.test(value) || /^url\s*\(/.test(value)) return null;
  if (value.startsWith('#')) return fromHex(value.slice(1));
  const named = NAMED[value];
  if (named) return fromHex(named);
  const fn = /^(rgba?|hsla?)\(([^)]*)\)$/.exec(value);
  if (!fn) return null;
  return fromFunction(fn[2], fn[1].startsWith('hsl'));
}

/** @param {Rgb} color @returns {'series'|'paper'|'ink'} */
function roleOf(color) {
  const chroma = (Math.max(color.r, color.g, color.b) - Math.min(color.r, color.g, color.b)) / 255;
  if (chroma >= CHROMA_MIN) return 'series';
  return luminance(color) >= PAPER_LUM ? 'paper' : 'ink';
}

/** @param {Rgb} color */
function seriesKey(color) {
  const hex = (channel) => channel.toString(16).padStart(2, '0');
  return `#${hex(color.r)}${hex(color.g)}${hex(color.b)}`;
}

/** @param {string} key @param {Map<string, number>} slots */
function slotFor(key, slots) {
  const known = slots.get(key);
  if (known) return known;
  const slot = (slots.size % PLOT_SLOTS) + 1;
  slots.set(key, slot);
  return slot;
}

/** @param {string} base @param {number} opacity */
function withAlpha(base, opacity) {
  if (opacity >= 0.995) return base;
  if (opacity <= 0.02) return 'transparent';
  return `color-mix(in srgb, ${base} ${Math.round(opacity * 100)}%, transparent)`;
}

/**
 * Uma pintura (fill, stroke, …) com as cores literais trocadas pelos tokens.
 * A mesma cor cromática, no mesmo `slots`, cai sempre na mesma série.
 * @param {string} value
 * @param {string} property fill trata claro como fundo (`--plot-bg`); stroke trata claro como tinta
 * @param {Map<string, number>} slots
 * @returns {string}
 * @example themePaint('#2563eb', 'stroke', new Map()) // 'var(--plot-1)'
 */
export function themePaint(value, property, slots) {
  const important = /!important\s*$/i.test(String(value).trim());
  const color = literalColor(value);
  if (!color) return value;
  const role = roleOf(color);
  const fillLike = property === 'fill' || property === 'stop-color' || property === 'flood-color';
  const base = role === 'series'
    ? `var(--plot-${slotFor(seriesKey(color), slots)})`
    : role === 'paper' && fillLike ? 'var(--plot-bg)' : 'currentColor';
  const token = withAlpha(base, color.a);
  return important ? `${token} !important` : token;
}

/**
 * Declaração `style` com as propriedades de pintura trocadas; o resto fica.
 * @param {string} style
 * @param {Map<string, number>} slots
 * @returns {string}
 * @example themeStyle('stroke:#000;stroke-width:2', new Map()) // 'stroke:currentColor;stroke-width:2'
 */
export function themeStyle(style, slots) {
  return String(style).replace(STYLE_PAINT, (all, sep, space, prop, colon, raw) => {
    const next = themePaint(raw.trim(), prop.toLowerCase(), slots);
    if (next === raw.trim()) return all;
    return `${sep}${space}${prop}${colon}${next}`;
  });
}

/**
 * Atributo de SVG: pintura e `style` entram na paleta; o resto volta igual.
 * @param {string} name
 * @param {string} value
 * @param {Map<string, number>} slots
 * @returns {string}
 * @example themeAttribute('fill', 'orange', new Map()) // 'var(--plot-1)'
 */
export function themeAttribute(name, value, slots) {
  const key = String(name).toLowerCase();
  if (key === 'style') return themeStyle(value, slots);
  if (!PAINT_ATTR.has(key)) return value;
  const next = themePaint(String(value).trim(), key, slots);
  return next === String(value).trim() ? value : next;
}

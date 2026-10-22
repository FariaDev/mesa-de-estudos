// @ts-check
/* Desenho da logo da Mesa (G1: docs/design/identidade/logo-folha-r5.html; o autor trocou a G2
   da #65 pela G1 em 2026-10-22, e a F1 com a lista era da #61).
   Folha creme inclinada sobre o fundo no acento, com a dobra no acento clareado
   e uma ∫ em traço de pincel no tom escuro do acento, sem o visto. As misturas de cor do protótipo
   (color-mix em oklab) são calculadas aqui e saem como hex, para o SVG abrir em
   qualquer programa. Só o script de ícones (scripts/app-icons.cjs) usa isto.
   Variante `small` (#67, docs/reviews/issue-67/): em 16–32 px a ∫ de pincel
   virava uma barra escura; a pequena tem folha reta e maior, sem sombra nem
   dobra, e a ∫ mais aberta com traço de 104. */

/** Acentos da Mesa (valores claros de --acc-* em style.css), na ordem das Configurações. */
export const ICON_ACCENTS=Object.freeze({
  blue:'#2548c7',violet:'#6d28d9',green:'#0f7b55',orange:'#c2410c',pink:'#c02667',graphite:'#27272a',
});
/** O ícone do pacote (Finder, Launchpad, Iniciar, instalador) é fixo, em violeta (#61). */
export const BUNDLE_ACCENT='violet';

const CREME='#fffbf0',TINTA_BASE='#1a1033';
const INTEGRAL_PATH='M606 336Q590 272 544 286Q508 300 508 366V632Q508 706 462 712Q428 716 418 684';
const SHEET={x:292,y:182,w:440,h:660,f:150,r:44};
const SMALL_SHEET_PATH='M262 132H762V832Q762 892 702 892H322Q262 892 262 832Z';
const SMALL_INTEGRAL_PATH='M676 300Q650 196 560 220Q512 236 512 330V694Q512 790 434 800Q372 806 350 726';

/** Mistura `a` e `b` em oklab, como `color-mix(in oklab, a pct%, b)`.
 * @param {string} a cor #rrggbb que entra com `pct`
 * @param {number} pct de 0 a 100
 * @param {string} b cor #rrggbb que completa
 * @returns {string} #rrggbb
 * @example mixOklab('#2548c7',78,'#ffffff') */
export function mixOklab(a,pct,b){
  const k=pct/100;
  const [la,lb]=[toOklab(a),toOklab(b)];
  return fromOklab(la.map((v,i)=>v*k+lb[i]*(1-k)));
}

/** SVG do ícone num acento. `grid` põe a arte na grade do macOS (800 px no meio
 * de 1024, raio 180), como o Dock espera; sem ela a arte ocupa o quadro todo.
 * `small` desenha a variante para 16–32 px.
 * @param {string} accent id de ICON_ACCENTS
 * @param {{grid?: boolean, small?: boolean}} [layout]
 * @returns {string} SVG de 1024×1024
 * @example appIconSvg('violet',{grid:true,small:true}) */
export function appIconSvg(accent,{grid=false,small=false}={}){
  const color=ICON_ACCENTS[accent];
  if(!color)throw new Error(`Acento de ícone desconhecido: ${JSON.stringify(accent)}; esperado um de ${Object.keys(ICON_ACCENTS).join(', ')}`);
  const art=small?smallArt(color):fullArt(color);
  const body=grid?`<g transform="translate(112 112) scale(.78125)">${art}</g>`:art;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${body}</svg>\n`;
}

function fullArt(color){
  return background(color)+`<g transform="rotate(-4 512 512)"><path d="${sheetPath(SHEET)}" fill="${CREME}" filter="url(#shadow)"/><path d="${foldPath(SHEET)}" fill="${mixOklab(color,55,CREME)}"/>${integral(mixOklab(color,70,TINTA_BASE))}</g>`;
}
/* Sem filtro: em 16 px o pincel e a sombra só sujam a borda. */
function smallArt(color){
  return `<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mixOklab(color,78,'#ffffff')}"/><stop offset="1" stop-color="${mixOklab(color,88,'#000000')}"/></linearGradient></defs>`
    +`<rect width="1024" height="1024" rx="230" fill="url(#bg)"/><path d="${SMALL_SHEET_PATH}" fill="${CREME}"/>${stroke(SMALL_INTEGRAL_PATH,mixOklab(color,70,TINTA_BASE),104)}`;
}

function background(color){
  return `<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mixOklab(color,78,'#ffffff')}"/><stop offset="1" stop-color="${mixOklab(color,88,'#000000')}"/></linearGradient>`
    +`<filter id="brush" x="-15%" y="-15%" width="130%" height="130%"><feTurbulence type="fractalNoise" baseFrequency=".008" numOctaves="2" seed="7" result="wave"/><feDisplacementMap in="SourceGraphic" in2="wave" scale="22" xChannelSelector="R" yChannelSelector="G"/></filter>`
    +`<filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="18" stdDeviation="22" flood-color="#000" flood-opacity=".26"/></filter></defs>`
    +`<rect width="1024" height="1024" rx="230" fill="url(#bg)"/>`;
}
function sheetPath({x,y,w,h,r,f}){
  return `M${x+r} ${y}H${x+w-f}L${x+w} ${y+f}V${y+h-r}Q${x+w} ${y+h} ${x+w-r} ${y+h}H${x+r}Q${x} ${y+h} ${x} ${y+h-r}V${y+r}Q${x} ${y} ${x+r} ${y}Z`;
}
function foldPath({x,y,w,f}){
  return `M${x+w-f} ${y}V${y+f-22}Q${x+w-f} ${y+f} ${x+w-f+22} ${y+f}H${x+w}Z`;
}
function stroke(d,color,width){
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
}
/** ∫ de pincel: o traço passa pelo feTurbulence + feDisplacementMap do `background`. */
function integral(color){
  return `<g filter="url(#brush)">${stroke(INTEGRAL_PATH,color,58)}</g>`;
}

/* sRGB ↔ oklab (Björn Ottosson, https://bottosson.github.io/posts/oklab/). */
function toOklab(hex){
  const m=/^#([0-9a-f]{6})$/i.exec(hex);
  if(!m)throw new Error(`Cor inválida: ${JSON.stringify(hex)}; esperado #rrggbb`);
  const [r,g,b]=[0,2,4].map(i=>toLinear(parseInt(m[1].slice(i,i+2),16)/255));
  const l=Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b);
  const mm=Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b);
  const s=Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b);
  return [.2104542553*l+.793617785*mm-.0040720468*s,1.9779984951*l-2.428592205*mm+.4505937099*s,.0259040371*l+.7827717662*mm-.808675766*s];
}
/** @param {number[]} lab [L, a, b] */
function fromOklab(lab){
  const [L,A,B]=lab;
  const l=(L+.3963377774*A+.2158037573*B)**3,m=(L-.1055613458*A-.0638541728*B)**3,s=(L-.0894841775*A-1.291485548*B)**3;
  const rgb=[4.0767416621*l-3.3077115913*m+.2309699292*s,-1.2684380046*l+2.6097574011*m-.3413193965*s,-.0041960863*l-.7034186147*m+1.707614701*s];
  return '#'+rgb.map(v=>Math.round(Math.min(1,Math.max(0,fromLinear(v)))*255).toString(16).padStart(2,'0')).join('');
}
function toLinear(c){return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;}
function fromLinear(c){return c<=.0031308?12.92*c:1.055*c**(1/2.4)-.055;}

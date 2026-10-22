import {$,S,capabilities,toast} from './state.mjs';
import statusCore from './generated/statusview.core.js';
import {applyAttrs,applyView} from './live-view.mjs';
import {t,formatNumber} from './ui-text.mjs';
import {message} from './i18n.mjs';
import {meterUsage} from './meter-usage.mjs';
import {toNat} from './bend-nat.mjs';

export {meterUsage};

/* Medidor de contexto e botão de compactação automática do cabeçalho do tutor
   (#43 fase 2: saíram de state.mjs, que reexporta `refreshMeter`). O import de
   volta de state.mjs só é lido dentro das funções, então o ciclo não pesa. */

function compactCount(value){
 const n=Math.max(0,Number(value)||0);
 const short=amount=>formatNumber(amount,{maximumFractionDigits:1});
 if(n<10000)return formatNumber(n);
 if(n<1000000)return t('count.thousand',{n:short(n/1000)});
 return t('count.million',{n:short(n/1000000)});
}
/* O medidor é nó vivo do index.html (a barra anima por `transform`, #63);
   as decisões — `hidden`, cortes warn/hot, `%` e largura — vêm do
   `statusview.ctxMeter`/`meterText`/`meterFill`, mas o nó do medidor não é
   recriado: `hidden`/`class` entram no `#ctx-meter` e o preenchimento/texto nos
   `i`/`em` que já estão lá (recriá-los cortaria a animação). A porcentagem
   chega ao núcleo já arredondada (contrato do statusview), então o corte
   acompanha o mostrador. O texto do balão (tokens formatados) é fato do host
   e vai pelo `#ctx-tip` da onda 4. */
export function updateMeter(usage){
 const meter=$('#ctx-meter');if(!meter)return;
 S.lastUsage=usage||null;
 if(capabilities().contextUsage!==true)usage=null;
 const visible=!!usage&&Number.isFinite(usage.percent);
 const pct=visible?Math.round(Math.min(100,Math.max(0,Number(usage.percent)))):0;
 const nat=toNat(pct);
 applyAttrs(meter,statusCore.ctxMeter(visible,nat));
 if(!visible)return;
 const bar=meter.querySelector('i');if(bar)bar.setAttribute('style',statusCore.meterFill(nat));
 const em=meter.querySelector('em');if(em)em.textContent=statusCore.meterText(nat);
 const tip=t('meter.tip',{pct,used:compactCount(usage.tokens),window:compactCount(usage.contextWindow)});
 meter.title=tip;
 setMeterTip(tip);
}
/* O balão do medidor é árvore do núcleo (`core/statusview.bend` → `ctxTip`):
   texto e `hidden` são fatos; medir, posicionar e os eventos de hover/foco (e o
   clique no rodapé) ficam aqui. O `#ctx-tip` é nó vivo do index.html: o host
   guarda o texto corrente em `_tipText` para o toggle do rodapé. */
function paintMeterTip(hidden){
 const meter=$('#ctx-meter'),tip=$('#ctx-tip');
 if(!meter||!tip)return;
 applyView(tip,statusCore.ctxTip(meter._tipText||'',!!hidden));
}
function placeMeterTip(){
 const meter=$('#ctx-meter'),tip=$('#ctx-tip');
 if(!meter||!tip)return;
 const r=meter.getBoundingClientRect();
 tip.style.left=Math.round(Math.max(8,Math.min(r.left,innerWidth-tip.offsetWidth-8)))+'px';
 tip.style.top=Math.round(r.bottom+6)+'px';
}
function setMeterTip(text){
 const meter=$('#ctx-meter'),tip=$('#ctx-tip');
 if(!meter||!tip)return;
 meter._tipText=String(text||'');
 if(tip.textContent===meter._tipText){placeMeterTip();return;}
 paintMeterTip(tip.hidden);
 placeMeterTip();
}
function wireMeterTip(){
 const meter=$('#ctx-meter');if(!meter)return;
 const hide=()=>{paintMeterTip(true);};
 const show=()=>{const tip=$('#ctx-tip');if(!tip||!meter._tipText)return;paintMeterTip(false);setMeterTip(meter._tipText);};
 meter.addEventListener('mouseenter',show);
 meter.addEventListener('mouseleave',hide);
 meter.addEventListener('focusin',show);
 meter.addEventListener('focusout',hide);
}
export async function refreshMeter(){
 /* O medidor é genérico: quem informa o uso é `health().contextUsage`. Sem
    número (compactação que zerou a amostra, ou motor sem a capacidade), o
    valor antigo sai da tela (#58). Falha da leitura não apaga: a ponte pode
    estar muda e o último número ainda vale. */
 if(capabilities().contextUsage!==true){updateMeter(null);return;}
 try{const data=await window.desk.health();updateMeter(meterUsage(data));}catch{}
}
/* O botão é árvore do núcleo (`statusview.autoCompact`): `hidden` sem conexão,
   `aria-pressed` + `.on` e o tooltip em `data-tip`. O elemento do index.html
   fica (o texto e o `onclick` são dele); o `title` estático vira o `data-tip`
   do núcleo e **sai do nó** (drop) — o `tooltip.mjs` prefere `title` e o
   `data-tip` ficaria inerte até o primeiro arm/reset. */
const autoCompactTip=()=>t('compact.tip');
export function renderAutoCompact(piState){
 const button=$('#auto-compact');if(!button)return;
 S.autoCompact=!!piState?.autoCompactionEnabled;
 const canAuto=capabilities().autoCompaction===true;
 applyAttrs(button,statusCore.autoCompact(!!S.connected&&canAuto,S.autoCompact,autoCompactTip()),['class','hidden','title']);
 window.dispatchEvent(new Event('desk-auto-compact-state'));
}

/**
 * Liga o balão do medidor (hover/foco e resize) e o clique do botão de
 * compactação automática. state.mjs chama uma vez, no ponto em que esse código
 * rodava antes da divisão, para manter a ordem dos listeners.
 * @returns {void}
 * @example installContextMeter();
 */
export function installContextMeter(){
 wireMeterTip();
 /* Com o balão aberto, um resize pode deixá-lo fora da janela: reposiciona com a
    mesma lógica do `setMeterTip` (mede o medidor e trava nas bordas). */
 window.addEventListener('resize',()=>{const tip=$('#ctx-tip');if(tip&&!tip.hidden)placeMeterTip();});
 $('#auto-compact').onclick=async()=>{
  if(capabilities().autoCompaction!==true){toast(message('compact.unavailable'));return;}
  const button=$('#auto-compact');
  try{
   const r=await window.desk.autoCompaction(button.getAttribute('aria-pressed')!=='true');
   renderAutoCompact({autoCompactionEnabled:r?.autoCompactionEnabled});
   updateMeter(r?.contextUsage);
   toast(message(r?.autoCompactionEnabled?'compact.on':'compact.off'));
  }catch(e){toast(e.message);}
 };
}

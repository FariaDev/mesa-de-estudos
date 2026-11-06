/* Cabeçalho do diário ("Trabalhou por 2s"): a duração e a frase. Saiu de
   `worklog.mjs`, que passava do teto de linhas. Carimbo ausente vira 0 no
   histórico do OpenCode, e `Date.now()` contra início 0 pintava "29888217m"
   (~57 anos): sem início válido, o cabeçalho fica sem duração. Fim ausente
   idem: o cabeçalho só aparece com o turno parado (`worklog-view.mjs`), e
   `Date.now()` ali pintava "Pensou por 24939m" em sessões antigas cujo
   trabalho só tinha raciocínio (sem carimbo de fim; teste manual do Mac,
   2026-10-31). */
import {t} from './ui-text.mjs';

/* Relógio de teste começa em 0 e termina em poucos segundos. Um fim de parede
   (Date.now()) com início 0 não é esse relógio: é carimbo ausente. */
const TEST_CLOCK_MS=24*60*60*1000;

/**
 * Milissegundos do turno, ou null quando o início ou o fim não é um instante.
 * @param {{startedAt?: number, endedAt?: number}} log
 * @returns {number|null}
 * @example headlineElapsed({startedAt: 1000, endedAt: 3000}) // 2000
 */
export function headlineElapsed(log){
 const started=Number(log.startedAt);
 const endedRaw=Number(log.endedAt);
 if(!Number.isFinite(started)||started<0)return null;
 if(started===0)return endedRaw>0&&endedRaw<=TEST_CLOCK_MS?endedRaw:null;
 if(!(endedRaw>0))return null;
 return started>endedRaw?null:endedRaw-started;
}

/**
 * A frase do cabeçalho, com ou sem duração.
 * @param {{reason?: string}} log
 * @param {string} duration já formatada; vazia quando não há duração
 * @param {boolean} toolish o turno usou ferramenta
 * @returns {string}
 * @example headBase({}, '2s', true) // 'Trabalhou por 2s'
 */
export function headBase(log,duration,toolish){
 if(!duration){
  if(log.reason==='stopped')return t('work.head.stoppedPlain');
  if(log.reason)return t('work.head.interruptedPlain');
  return toolish?t('work.head.workedPlain'):t('work.head.thoughtPlain');
 }
 if(log.reason==='stopped')return t('work.head.stopped',{duration});
 if(log.reason)return t('work.head.interrupted',{duration});
 return toolish?t('work.head.worked',{duration}):t('work.head.thought',{duration});
}

/* E3 (auditoria rodada 3): turno interrompido com motivo e sem nenhum texto de
   resposta começa com o diário aberto, para o motivo não exigir clique. Com
   resposta parcial segue recolhido, como antes; o 429 do limite do grátis
   também segue recolhido, porque o aviso próprio (`free-limit-notice.mjs`) já
   mostra o motivo — abrir duplicaria a mensagem. É só dobra inicial: o
   `touched` da visão (`worklog-view.mjs`) preserva o clique do aluno nas
   repinturas, e vale no histórico quando o diário reconstruído traz o motivo.
   Puro (sem DOM): a janela pinta a partir daqui.
   @param {{reason?: string, text?: string, steps?: Array<{status?: string}>}} log
   @param {{hasAnswer?: boolean, isFreeLimit?: boolean}} [facts]
   @returns {boolean}
   @example shouldStartOpen({reason:'error',text:'',steps:[{status:'error'}]}) // true
   @example shouldStartOpen({reason:'error',text:'',steps:[{status:'error'}]},{hasAnswer:true}) // false
*/
export function shouldStartOpen(log,{hasAnswer=false,isFreeLimit=false}={}){
 if(isFreeLimit||hasAnswer)return false;
 if(String(log?.text||'').trim())return false;
 const reason=String(log?.reason||'');
 if(!reason||reason==='stopped')return false;
 return (log?.steps||[]).some(step=>step?.status==='error');
}

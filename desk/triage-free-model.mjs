// @ts-check
import {createRequire} from 'node:module';
import {parseMessage} from './src/i18n.mjs';

/* O modelo grátis do comando `opencode run` do "Relatar um problema" (#62).
   A lista é a viva: o `opencode models opencode` desta máquina (o que o
   OpenCode instalado consegue chamar agora). O que é grátis é a regra do
   núcleo (`core/freemodels.bend`, `isFree`) e a política de dados é a tabela
   da Mesa (`free-models.json`), as mesmas do seletor. Nenhum nome é fixo: a
   preferência é por família (DeepSeek Flash, depois MiniMax), e dentro dela o
   que não guarda nem treina vem antes. */

const require=createRequire(import.meta.url);
const core=require('./src/generated/freemodels.core.js').default;
const policyTable=require('./free-models.json');

const PREFERRED_FAMILIES=[/deepseek.*flash/i,/minimax/i];

/** @typedef {{id: string, model: string, policy: string, policyKey: string}} TriageModel */

/**
 * Os ids grátis do Zen na saída do `opencode models` (uma linha `provedor/id`).
 * @param {string} output
 * @returns {string[]}
 * @example freeZenIds('opencode/deepseek-v4.1-flash-free\nopencode/gpt-5.5\n') // ['deepseek-v4.1-flash-free']
 */
export function freeZenIds(output){
 const ids=[];
 for(const line of String(output||'').split('\n')){
  const [provider,...rest]=line.trim().split('/');
  const id=rest.join('/');
  if(id&&provider===core.zenProvider()&&core.isFree(provider,id,false)&&!Object.hasOwn(policyTable.excluded||{},id))ids.push(id);
 }
 return [...new Set(ids)];
}

/** @param {string} id @returns {number} 0 para a primeira família, `PREFERRED_FAMILIES.length` para nenhuma */
function familyRank(id){
 const at=PREFERRED_FAMILIES.findIndex(pattern=>pattern.test(id));
 return at<0?PREFERRED_FAMILIES.length:at;
}

/** @param {string} id @returns {string} */
function policyOf(id){return policyTable.models[id]?.policy||'';}

/**
 * O grátis do comando: família preferida primeiro; dentro da família, retenção
 * zero antes; depois a ordem em que o OpenCode listou. Null sem nenhum grátis.
 * @param {string[]} ids grátis vivos (`freeZenIds`)
 * @returns {TriageModel | null}
 * @example pickTriageModel(['big-pickle', 'minimax-m3-free'])?.model // 'opencode/minimax-m3-free'
 */
export function pickTriageModel(ids){
 const ranked=ids
  .map((id,order)=>({id,order,family:familyRank(id),zero:core.isZeroRetention(policyOf(id))?0:1}))
  .sort((a,b)=>a.family-b.family||a.zero-b.zero||a.order-b.order);
 const best=ranked[0];
 if(!best)return null;
 const policy=policyOf(best.id);
 /* O núcleo devolve a frase como mensagem codificada (`core/msg.bend`): a chave basta para os dois idiomas. */
 const policyKey=parseMessage(String(core.policyMsg(policy)))?.key||'freeModels.policy.unknown';
 return {id:best.id,model:`${core.zenProvider()}/${best.id}`,policy,policyKey};
}

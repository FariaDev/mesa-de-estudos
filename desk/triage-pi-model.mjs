// @ts-check
import {createRequire} from 'node:module';
import {normalizeRecents,normalizeFavorites} from './src/model-picker.mjs';

/* Os modelos do comando `pi` do "Relatar um problema" (#62): o que a pessoa já
   usa no Pi, para não pedir conta nova. Primeiro o modelo em uso (se o motor
   da janela for o Pi), depois os recentes e os favoritos do seletor (#59), do
   estado de interface. Os grátis do Zen ficam de fora: pelo Pi eles voltam
   403 `FreeTierError` (#57). Vazio quer dizer "o padrão do Pi". */

const require=createRequire(import.meta.url);
const freeCore=require('./src/generated/freemodels.core.js').default;

/** @param {[string, string]} pair @returns {string} */
const modelOf=([provider,id])=>`${provider}/${id}`;

/** @param {string} model @returns {boolean} */
function callableByPi(model){
 const [provider,...rest]=model.split('/');
 const id=rest.join('/');
 return !!provider&&!!id&&!freeCore.isFree(provider,id,false);
}

/**
 * @param {{current?: {engine: string, model: string} | null, state?: {modelRecents?: unknown, modelFavorites?: unknown}}} input
 * @returns {string[]} `provedor/id`, sem repetição, o primeiro é o padrão do comando
 * @example piModelChoices({current: {engine: 'pi', model: 'xai/grok-4'}, state: {}}) // ['xai/grok-4']
 */
export function piModelChoices({current=null,state={}}){
 const recents=normalizeRecents(state?.modelRecents).pi||[];
 const favorites=normalizeFavorites(state?.modelFavorites).pi||[];
 const live=current?.engine==='pi'&&current.model?[current.model]:[];
 return [...new Set([...live,...recents.map(modelOf),...favorites.map(modelOf)])].filter(callableByPi);
}

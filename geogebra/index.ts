// Ferramenta geogebra: deixa o Pi comandar e ler o applet GeoGebra
// embutido na Mesa de Estudos (aba GeoGebra). A ponte é um servidor
// HTTP local (127.0.0.1) publicado pela Mesa em <runtime>/ggb-bridge.json.
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Type } from 'typebox';

interface BridgeFile { port:number; token:string }
interface RunResult { ok?:boolean; error?:string; state?:{ objects?:string; count?:number } | null }
interface BridgeResponse extends RunResult { png?:string; error?:string }

function bridgeFile():string {
 // O caminho oficial vem da Mesa via env (LEARNING_DESK_GGB_BRIDGE). O fallback
 // cobre uso manual: o Pi roda com cwd em <runtime>/learning/Courses/<matéria>,
 // então o runtime fica três níveis acima.
 const fromEnv=typeof process.env.LEARNING_DESK_GGB_BRIDGE==='string'?process.env.LEARNING_DESK_GGB_BRIDGE.trim():'';
 if(fromEnv)return fromEnv;
 return resolve(process.cwd(), '..', '..', '..', 'ggb-bridge.json');
}

function readBridge():BridgeFile {
 const raw=JSON.parse(readFileSync(bridgeFile(), 'utf8')) as BridgeFile;
 if(typeof raw?.port!=='number' || typeof raw?.token!=='string') throw new Error('arquivo da ponte inválido');
 return raw;
}

async function callGgb(action:string, command?:string, signal?:AbortSignal):Promise<BridgeResponse> {
 let bridge:BridgeFile;
 try { bridge=readBridge(); } catch { throw new Error('a Mesa não está com a ponte do GeoGebra aberta (abra a aba GeoGebra)'); }
 const ctrl=new AbortController();
 const timer=setTimeout(()=>ctrl.abort(), 30000);
 const abort=()=>ctrl.abort();
 signal?.addEventListener('abort', abort, { once:true });
 try {
  const res=await fetch(`http://127.0.0.1:${bridge.port}/${action}`, {
   method:'POST',
   headers:{ 'content-type':'application/json', 'x-desk-token':bridge.token },
   body:JSON.stringify({ command }),
   signal:ctrl.signal,
  });
  const data=await res.json() as BridgeResponse;
  if(!res.ok) throw new Error(String(data?.error || `HTTP ${res.status}`));
  return data;
 } finally {
  clearTimeout(timer);
  signal?.removeEventListener('abort', abort);
 }
}

function formatState(state?:{ objects?:string; count?:number } | null):string {
 const objects=state?.objects?.trim();
 return objects ? objects : '(a construção está vazia)';
}

const text=(t:string)=>({ content:[{ type:'text' as const, text:t }] });

export default function geogebra(pi:ExtensionAPI) {
 pi.registerTool({
  name:'geogebra',
  label:'GeoGebra',
  executionMode:'sequential',
  description:
   'Controle o applet GeoGebra embutido na Mesa de Estudos (aba GeoGebra, mesmo app da web). ' +
   'actions: "run" executa um comando na sintaxe do GeoGebra (ex.: f(x)=x^2-2, Solve(f), Derivative(f), Root(f,0,5), ' +
   'Circumference((0,0),2), Intersect(f,g)); "state" lista os objetos atuais com comando/definição e valor; ' +
   '"screenshot" captura o applet como imagem para você ver. ' +
   'Use para construir gráficos e figuras junto com o usuário, verificar resultados graficamente e ler construções que ele montou. ' +
   'O applet precisa estar aberto na aba GeoGebra da Mesa.',
  promptSnippet:
   'Use a ferramenta geogebra para executar comandos, ler objetos e capturar o applet GeoGebra embutido na Mesa (aba GeoGebra).',
  promptGuidelines: [
   'Prefira "run" + "state" para construir: rode o comando e depois leia os objetos criados.',
   'Use "screenshot" quando precisar ver o visual (curvas, figuras, interseções).',
   'Se a ferramenta reportar indisponível, avise o usuário para abrir a aba GeoGebra — não reinvente o resultado.',
   'Comandos são na sintaxe exata do GeoGebra (inglês), ex.: Derivative, Solve, Root, Intersect, Circumference.',
  ],
  parameters: Type.Object({
   action: Type.Union([Type.Literal('run'), Type.Literal('state'), Type.Literal('screenshot')]),
   command: Type.Optional(Type.String()),
  }),
  async execute(_toolCallId, params, signal) {
   try {
    if(params.action==='run' && !params.command?.trim()) return text('Informe o command (sintaxe GeoGebra).');
    if(params.action==='screenshot') {
     const shot=await callGgb('screenshot', undefined, signal);
     return {
      content:[
       { type:'image' as const, data:String(shot.png||''), mimeType:'image/png' },
       { type:'text' as const, text:'Captura do applet GeoGebra.' },
      ],
     };
    }
    const data=await callGgb(params.action, params.command, signal);
    const state=formatState(data.state);
    if(params.action==='run' && data.ok===false) {
     return text(`O GeoGebra recusou o comando: ${data.error || 'erro desconhecido'}.${state ? `\n\nObjetos atuais:\n${state}` : ''}`);
    }
    return text(
     params.action==='run'
      ? `Comando aceito pelo GeoGebra.${state ? `\n\nObjetos atuais:\n${state}` : ''}`
      : `Objetos atuais no GeoGebra:\n${state}`,
    );
   } catch (e) {
    const msg=String((e as Error)?.message || e);
    return text(`GeoGebra indisponível (${msg}). Peça ao usuário para abrir a aba GeoGebra na Mesa e tente de novo.`);
   }
  },
 });
}

/* Fixture do SDK Claude para o smoke do chat lateral (só DESK_TEST).
 *
 * Embrulha `claude-sdk-fake.mjs` (nenhuma cópia do transporte) e adiciona UMA
 * capacidade de observação: quando `FAKE_CLAUDE_READ_TARGET` está definido, o
 * alvo de `Read` dos roteiros `[claude:permission-allow|permission-deny]` passa
 * a ser esse caminho REAL (a ref PDF autorizada do teste) em vez do
 * `fixture-read.txt` dentro do cwd. Assim o pedido só chega ao host como
 * `extension_ui_request` se o caminho estiver em `readPaths`/`readRoots` do
 * adaptador — é a prova ponta a ponta de que a ref do snapshot foi autorizada a
 * leitura. Sem a variável, nada muda em relação à fixture base.
 *
 * A troca acontece sobre `options.canUseTool`, que a fixture base consulta a
 * cada roteiro; o restante (eco de aceite, deltas, store, interrupt) é byte a
 * byte o da fixture compartilhada. */
import {query as baseQuery,getSessionMessages} from './claude-sdk-fake.mjs';

export {getSessionMessages};

export function query(input={}){
 const options=input&&typeof input.options==='object'&&input.options!==null?input.options:{};
 const target=process.env.FAKE_CLAUDE_READ_TARGET;
 const original=options.canUseTool;
 if(target&&typeof original==='function'){
  options.canUseTool=(toolName,toolInput,opts)=>{
   const next=toolName==='Read'&&toolInput&&typeof toolInput==='object'?{...toolInput,file_path:target}:toolInput;
   return original(toolName,next,opts);
  };
 }
 return baseQuery(input);
}

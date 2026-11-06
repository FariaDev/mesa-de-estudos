/* Helper do Conferir no macOS: `visual-check/windows` é binário e não vai no git.
   Quem instalava só com `npm run install-app`, sem `npm run setup`, ficava com o
   Conferir apagado ("não está disponível neste computador") mesmo com a permissão
   de Gravação de Tela dada: a Mesa nem chegava a pedir a permissão. */
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

/**
 * Compila o helper do Conferir se ele faltar. Fora do macOS não faz nada.
 * Falhar não interrompe a instalação: o resto da Mesa funciona sem o Conferir,
 * e o chamador avisa como resolver.
 * @param {{root:string, platform?:string, compile?:(source:string,output:string)=>{status:number|null}}} options
 *   `root` é a raiz do repositório; `compile` entra por parâmetro para os testes.
 * @returns {'not-mac'|'present'|'compiled'|'failed'}
 * @example ensureVisualHelper({root:'/caminho/do/clone'}) // 'present'
 */
export function ensureVisualHelper({root,platform=process.platform,compile=compileWithSwiftc}){
 if(platform!=='darwin')return 'not-mac';
 const visual=path.join(root,'visual-check');
 const helper=path.join(visual,'windows');
 if(fs.existsSync(helper))return 'present';
 const result=compile(path.join(visual,'windows.swift'),helper);
 return result.status===0&&fs.existsSync(helper)?'compiled':'failed';
}

function compileWithSwiftc(source,output){
 return spawnSync('swiftc',[source,'-o',output],{stdio:'inherit'});
}

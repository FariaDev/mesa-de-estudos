/* GeoGebra offline, opcional (#55): baixa o Math Apps Bundle oficial para
   `desk/.runtime/geogebra/`. A Mesa não distribui o pacote (licença pessoal e
   intransferível do GeoGebra): quem roda este script baixa direto de geogebra.org,
   com a versão fixada e o hash conferido.

   Uso (em desk/):
     npm run geogebra:offline            # pergunta antes de baixar
     npm run geogebra:offline -- --yes   # a pessoa já leu a licença
     npm run geogebra:offline -- --remove
   `npm run setup` oferece o mesmo passo (e aceita --geogebra / --no-geogebra). */
import path from 'node:path';
import readline from 'node:readline/promises';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const {PACK,packDirFor,readInstalledPack,installPack,removePack}=require('../geogebra-pack.cjs');

const desk=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const LICENSE_URL='https://www.geogebra.org/license';

/** Texto do consentimento: o que será baixado, de onde e sob qual licença. @param {typeof PACK} pack @returns {string} */
export function consentText(pack=PACK){
 return [
  `GeoGebra offline: o pacote oficial ${pack.version} (cerca de ${Math.round(pack.bytes/1048576)} MB de download, ${pack.unpackedMegabytes} MB no disco)`,
  `será baixado de ${pack.url} para desk/.runtime/geogebra/.`,
  `Ele é do GeoGebra, sob a licença não comercial de ${LICENSE_URL}: uso pessoal e sem fins comerciais, com o aviso "Made with GeoGebra®".`,
  'A Mesa não distribui o pacote; ao baixar você aceita essa licença. Sem ele, a aba GeoGebra continua usando o applet da web.',
 ].join('\n');
}

/**
 * Pergunta s/N no terminal. Sem terminal (CI, pipe), a resposta é não.
 * @param {string} question
 * @param {{input?:NodeJS.ReadableStream,output?:NodeJS.WritableStream,interactive?:boolean}} [io]
 * @returns {Promise<boolean>}
 */
export async function askYesNo(question,{input=process.stdin,output=process.stdout,interactive=Boolean(process.stdin.isTTY)}={}){
 if(!interactive)return false;
 const rl=readline.createInterface({input,output});
 try{return /^\s*(s|sim|y|yes)\s*$/i.test(await rl.question(question));}
 finally{rl.close();}
}

/**
 * Passo opcional do setup. `choice`: 'yes' (já consentiu), 'no' (pulou) ou 'ask'.
 * @param {{choice?:'yes'|'no'|'ask',log?:(line:string)=>void,ask?:typeof askYesNo,install?:typeof installPack,dir?:string}} [options]
 * @returns {Promise<'installed'|'already'|'skipped'|'failed'>}
 */
export async function offerGeogebraOffline({choice='ask',log=console.log,ask=askYesNo,install=installPack,dir=packDirFor(path.resolve(desk,'..'))}={}){
 if(readInstalledPack(dir)){log(`GeoGebra offline ${PACK.version} já está em ${dir}.`);return 'already';}
 if(choice==='no')return 'skipped';
 log('');
 log(consentText());
 if(choice==='ask'&&!(await ask('Baixar o GeoGebra offline agora? [s/N] '))){
  log('GeoGebra offline pulado. Para baixar depois: npm run geogebra:offline');
  return 'skipped';
 }
 try{
  await install({dir,log});
  log(`GeoGebra offline ${PACK.version} pronto em ${dir}. Reabra a Mesa para ele valer.`);
  return 'installed';
 }catch(error){
  log(`Não foi possível instalar o GeoGebra offline: ${error.message}`);
  log('A aba GeoGebra segue usando o applet da web. Tente de novo com: npm run geogebra:offline');
  return 'failed';
 }
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2);
 if(args.includes('--remove')){
  removePack(packDirFor(path.resolve(desk,'..')));
  console.log('GeoGebra offline removido; a aba volta ao applet da web.');
 }else{
  const result=await offerGeogebraOffline({choice:args.includes('--yes')?'yes':'ask'});
  if(result==='failed')process.exitCode=1;
 }
}

// @ts-check
'use strict';

const {readConfig,writeConfig,seedConfig,normalize}=require('./config.cjs');

/* Config da partida (#43 fase 2: saiu do main.cjs). Os overrides de ambiente
   valem só para esta execução e eram repetidos duas vezes no main: na leitura
   inicial e na releitura depois do diário da promoção Livre. */

/**
 * Aplica os caminhos que o ambiente fixa (testes e instalação portátil) sobre a config lida.
 * @param {import('./types/desk-config').DeskConfig} config config normalizada (é alterada e devolvida)
 * @param {Record<string,string|undefined>} env normalmente `process.env`
 * @returns {import('./types/desk-config').DeskConfig} a mesma config
 * @example applyEnvOverrides(readConfig(file),process.env)
 */
function applyEnvOverrides(config,env){
 if(env.LEARNING_VAULT)config.vaultPath=env.LEARNING_VAULT;
 if(env.LEARNING_DESK_PI)config.piPath=env.LEARNING_DESK_PI;
 if(env.LEARNING_DESK_CLAUDE)config.claudePath=env.LEARNING_DESK_CLAUDE;
 return config;
}

/**
 * Lê a config do disco; sem ela, monta a do cofre do ambiente ou semeia os padrões
 * (e grava a semeada quando `persist` e há algo para guardar).
 * @param {{configFile:string, env:Record<string,string|undefined>, persist:boolean}} options
 * @returns {import('./types/desk-config').DeskConfig} config com os overrides de ambiente
 * @example let config=loadBootConfig({configFile,env:process.env,persist:!process.env.LEARNING_DESK_RUNTIME});
 */
function loadBootConfig({configFile,env,persist}){
 const envRuntime=env.LEARNING_DESK_RUNTIME;
 let config=readConfig(configFile);
 if(!config){
  if(env.LEARNING_VAULT)config=normalize({vaultPath:env.LEARNING_VAULT,runtimePath:envRuntime||'',piPath:env.LEARNING_DESK_PI||'',xournalPath:'',courses:[]});
  else{
   config=seedConfig({runtimePath:envRuntime||''});
   if(persist&&(config.vaultPath||config.courses.length))writeConfig(configFile,config);
  }
 }
 return applyEnvOverrides(config,env);
}

module.exports={applyEnvOverrides,loadBootConfig};

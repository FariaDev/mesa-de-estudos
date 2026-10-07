'use strict';
const path=require('node:path');
const os=require('node:os');

/* Localização usada pelo Electron após app.setName('Mesa de Estudos').
   Os diagnósticos Node usam o mesmo diretório, com o override de testes. */
function userDataDirectory({platform=process.platform,home=os.homedir(),env=process.env}={}){
 if(env.LEARNING_DESK_RUNTIME)return env.LEARNING_DESK_RUNTIME;
 const base=platform==='win32'?(env.APPDATA||path.join(home,'AppData','Roaming'))
  :platform==='darwin'?path.join(home,'Library','Application Support')
  :(env.XDG_CONFIG_HOME||path.join(home,'.config'));
 return path.join(base,'Mesa de Estudos');
}
module.exports={userDataDirectory};

export function testEnv(extra={}){
 const env={...process.env,...extra};
 env.DESK_TEST='1';
 delete env.ELECTRON_RUN_AS_NODE;
 return env;
}

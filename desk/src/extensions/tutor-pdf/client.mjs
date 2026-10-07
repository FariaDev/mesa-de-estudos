export async function createTutorPdf(bridge,{title,markdown},signal){
 if(!bridge||typeof bridge.token!=='string'||!/^http:\/\/127\.0\.0\.1:\d+\/pdf$/.test(bridge.url||''))throw Error('Gerar PDF pelo tutor está disponível na conversa principal da aba Livre.');
 const controller=new AbortController(),abort=()=>controller.abort();
 if(signal?.aborted)throw Error('Geração cancelada.');
 signal?.addEventListener('abort',abort,{once:true});const timer=setTimeout(abort,65000);
 try{
  const response=await fetch(bridge.url,{method:'POST',headers:{'content-type':'application/json','x-mesa-token':bridge.token},body:JSON.stringify({title,markdown}),signal:controller.signal});
  const data=await response.json();if(!response.ok||data.prepared!==true)throw Error(data.error||'A Mesa não confirmou a preparação do PDF.');return data;
 }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}

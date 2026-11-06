import {confirmOpenLink,openConfirmedLink} from './link-confirm.mjs';

/* Links no corpo da resposta do tutor (auditoria de UI/UX, rodada 1, F). O
   clique parecia não fazer nada: o main nega a navegação e nada abre o `href`.
   Só `https:` abre, e só depois do diálogo da Mesa com o domínio em destaque
   (#81) — o mesmo caminho seguro dos links de atividade. Âncora interna e
   qualquer outro esquema não fazem nada. */

/**
 * O que o clique num `href` de mensagem faz: só `https:` pede confirmação.
 * @param {unknown} href o `href` do link
 * @returns {'confirm'|'none'}
 * @example messageLinkAction('https://exemplo.com/guia') // 'confirm'
 */
export function messageLinkAction(href){
 const url=String(href||'');
 if(!url||url.startsWith('#'))return 'none';
 try{return new URL(url).protocol==='https:'?'confirm':'none';}catch{return 'none';}
}

/**
 * Liga os links do corpo das mensagens ao diálogo da Mesa. Um ouvinte só por
 * raiz, delegado: vale para o histórico, o stream e o chat lateral.
 * @param {Element|null} root o contêiner das mensagens
 * @example installMessageLinks(document.querySelector('#messages'))
 */
export function installMessageLinks(root){
 if(!root||root.dataset.linksInstalled)return;
 root.dataset.linksInstalled='1';
  root.addEventListener('click',(event)=>{
  const anchor=event.target?.closest?.('a[href]');
  if(!anchor||!root.contains(anchor))return;
  /* Imagem gerada ou enviada dentro de link: o clique fica com o visualizador
     de imagem (`chat-assets.mjs`) e o link não abre diálogo nesse caso (mas a
     navegação segue contida). Outra imagem (remota, por exemplo) segue o
     diálogo normal — clique morto nela virava silêncio. */
  if(event.target?.closest?.('img.plot,img.shot')){event.preventDefault();return;}
  event.preventDefault();
  if(messageLinkAction(anchor.getAttribute('href'))!=='confirm')return;
  openConfirmedLink(anchor.getAttribute('href'),{confirm:confirmOpenLink,open:(url)=>window.desk.openExternal(url)}).catch(()=>{});
 });
}

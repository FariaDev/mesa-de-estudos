import assert from 'node:assert/strict';

/* Varredura de idioma compartilhada por `language-ui.mjs` e `hunt-language.mjs`
   (#41): lê o texto que a pessoa vê (texto, placeholder, aria-label, title) e
   procura palavra do OUTRO idioma. Os nomes das línguas ("Português", "English")
   são os próprios nomes delas e os rótulos padrão dos leitores vêm de
   `config.cjs` (dado, não frase da interface): ficam fora, como o texto legal das licenças
   (`lang="en"`) e o nome do titular de direitos autorais do KaTeX. */

/* Português num texto em inglês: letras acentuadas ou palavras da interface. */
const PORTUGUESE_SIGNS=/[áàâãéêíóôõúç]|\b(Configurações|Matérias|Salvar|Cancelar|Aparência|Pastas|Idioma|Tema|Leitores|Acompanhar|Revisão|Estatísticas|Calculadora|Guia|Atalhos|Abrir|Fechar|Apagar|Buscar|Enviar|Voltar|Carregando|Erro|Falhou|Sessão|Livre|Anotações|Cursos?|Estudar|Encerrar)\b/i;
/* Inglês num texto em português. Palavras que o português também usa (Tutor, Material, Pi) não entram. */
const ENGLISH_SIGNS=/\b(Settings|Courses|Save|Cancel|Appearance|Language|Folders|Readers|Theme|Density|Study|Help|Edit|Follow|Review|Notes|Statistics|Open|Close|Delete|Search|Send|Back|Loading|Failed|Session|Template|Shortcuts|About|the|and|with|your|from|this|that)\b/;
export const SIGNS={en:{pattern:PORTUGUESE_SIGNS,other:'português'},'pt-BR':{pattern:ENGLISH_SIGNS,other:'inglês'}};
/* Fora das Configurações e do Sobre a interface em inglês não diz chat, thread nem conversation. */
const ENGLISH_VOCABULARY=/\b(chat|thread|conversation)\b/i;
/* "Chat lateral" é termo do CONTEXT.md; "Side chat" é o equivalente em inglês. */
const ALLOWED_ENGLISH_TERMS=/side chat/gi;

/** Textos visíveis ao leitor de `selector` (menos `exclude`) (e de seus filhos, ocultos ou não), um por nó de texto e por atributo,
 * sem nomes de línguas nem rótulos de leitor. Um texto por nó mantém o contexto curto e deixa repetidos de lado.
 * @param {import('playwright').Page} page @param {string} [selector] @param {string} [exclude] seletores a deixar de fora
 * @returns {Promise<string[]>} */
export const uiTexts=(page,selector='body',exclude='')=>page.evaluate(({sel,exclude})=>{
  const root=document.querySelector(sel).cloneNode(true);
  if(exclude)for(const skip of root.querySelectorAll(exclude))skip.remove();
  for(const skip of root.querySelectorAll('#first-run-language,#setup-language strong,#ui-language option,#tutor-language option[value="pt-BR"],#tutor-language option[value="en"],script,style,.textLayer,[data-sweep-skip],[lang="en"]'))skip.remove();
  /* O seletor de idioma do setup (#64) diz "Idioma / Language" de propósito, nos dois idiomas, como o #first-run-language. */
  root.querySelector('#setup-language')?.removeAttribute('aria-label');
  const texts=[];
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  for(let node=walker.nextNode();node;node=walker.nextNode()){
    const text=node.textContent.replace(/\s+/g,' ').trim();
    if(text)texts.push(text);
  }
  for(const el of root.querySelectorAll('[placeholder],[aria-label],[title]'))texts.push(...['placeholder','aria-label','title'].map(a=>el.getAttribute(a)).filter(Boolean));
  /* Os rótulos padrão dos leitores vêm de `config.cjs` e ficam como estão (dado, não frase da interface).
     "Made with GeoGebra®" é a atribuição que a licença do GeoGebra pede, em inglês nos dois idiomas (#55). */
  return texts.map(text=>text.replaceAll('Formulário & apoio','').replaceAll('Formulário','').replaceAll('Enunciado','').replaceAll('Khan Academy and other contributors','').replaceAll('Made with GeoGebra®','').trim()).filter(Boolean);
},{sel:selector,exclude});

/** Falha se algum texto tem palavra do outro idioma ou uma mensagem de núcleo sem tradução. */
export function assertNoOtherLanguage(language,texts,where){
  const {pattern,other}=SIGNS[language];
  for(const text of texts){
    /* Mensagem de núcleo que chegou ao DOM sem passar pelo `t()` (#41): aparece como chave crua. */
    assert.ok(!text.includes(''),`${where} (${language}): mensagem do núcleo sem tradução: ${JSON.stringify(text.slice(0,120))}`);
    const found=pattern.exec(text);
    assert.ok(!found,`${where} (${language}): sobrou palavra em ${other}: ${JSON.stringify(found?.[0])} em ${JSON.stringify(text.slice(Math.max(0,(found?.index??0)-40),(found?.index??0)+60))}`);
  }
}

export const assertEnglishVocabulary=(texts,where)=>{
  for(const text of texts){
    const found=ENGLISH_VOCABULARY.exec(text.replace(ALLOWED_ENGLISH_TERMS,' '));
    assert.ok(!found,`${where} (en): vocabulário proibido fora de Configurações/Sobre: ${JSON.stringify(found?.[0])} em ${JSON.stringify(text.slice(Math.max(0,(found?.index??0)-40),(found?.index??0)+60))}`);
  }
};

/** Um achado por texto (o primeiro), para a hunt listar tudo de uma vez.
 * `vocabulary: false` nas Configurações e no Sobre, onde "chat" é permitido.
 * @returns {string[]} uma linha por texto com palavra do outro idioma */
export function findOtherLanguage(language,texts,where,{vocabulary=true}={}){
  const {pattern,other}=SIGNS[language];
  const found=[];
  for(const text of texts){
    if(text.includes('\uE000')){found.push(`[${where}] mensagem do núcleo sem tradução: ${JSON.stringify(text.slice(0,100))}`);continue;}
    const match=pattern.exec(text);
    if(match){found.push(`[${where}] palavra em ${other} ${JSON.stringify(match[0])}: ${JSON.stringify(text.slice(0,110))}`);continue;}
    const vocab=language==='en'&&vocabulary?ENGLISH_VOCABULARY.exec(text.replace(ALLOWED_ENGLISH_TERMS,' ')):null;
    if(vocab)found.push(`[${where}] vocabulário proibido ${JSON.stringify(vocab[0])}: ${JSON.stringify(text.slice(0,110))}`);
  }
  return found;
}

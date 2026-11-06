class El extends EventTarget {
  constructor(){super();this.style={setProperty(){},removeProperty(){},getPropertyValue(){return '';}};this.dataset={};this.classList={add(){},remove(){},toggle(){},contains(){return false;}};this._attrs=new Map();this.children=[];this.value='';this.hidden=false;this.disabled=false;this.innerHTML='';this.textContent='';this.open=false;this.checked=false;this.files=[];}
  appendChild(c){this.children.push(c);return c;} append(...c){this.children.push(...c);} prepend(...c){this.children.unshift(...c);} replaceChildren(){this.children=[];}
  get attributes(){return [...this._attrs].map(([name,value])=>({name,value}));}
  setAttribute(k,v){this._attrs.set(String(k),String(v));} removeAttribute(k){this._attrs.delete(String(k));} getAttribute(k){return this._attrs.get(String(k))??null;} hasAttribute(k){return this._attrs.has(String(k));}
  addEventListener(t,f,o){super.addEventListener(t,f,o);} removeEventListener(t,f,o){super.removeEventListener(t,f,o);} focus(){} blur(){} close(){} showModal(){} matches(){return false;} closest(){return null;} contains(){return false;} setAttributeNS(){} toggleAttribute(k,v){if(v)this.setAttribute(k,'');else this.removeAttribute(k);}
  querySelector(){return new El();} querySelectorAll(){return [];} getBoundingClientRect(){return {top:0,left:0,right:0,bottom:0,width:0,height:0};}
  get firstElementChild(){return this.children[0]||null;} get lastElementChild(){return this.children.at(-1)||null;}
  insertAdjacentHTML(){} remove(){} scrollTo(){} scrollBy(){} scrollIntoView(){} setSelectionRange(){} select(){} click(){this.dispatchEvent(new Event('click'));}
  insertBefore(n){this.children.push(n);return n;} removeChild(){} replaceWith(){} cloneNode(){return new El();} getRootNode(){return this;} animate(){return {cancel(){},finished:Promise.resolve()};}
}
const els=new Map();
function elFor(sel){if(!els.has(sel))els.set(sel,new El());return els.get(sel);}
export function installDom(){
  const document={
    querySelector:(s)=>elFor(s), querySelectorAll:()=>[], getElementById:(id)=>elFor('#'+id),
    createElement:()=>new El(), createElementNS:()=>new El(), createDocumentFragment:()=>new El(), createTextNode:(text)=>{const n=new El();n.textContent=String(text);n.nodeType=3;return n;},
    addEventListener(){}, removeEventListener(){}, documentElement:new El(), body:new El(), head:new El(), hidden:false, readyState:'complete',
    createTreeWalker(){return {currentNode:null,nextNode(){return null;}};},
  };
  const window=new EventTarget();
  window.document=document;window.location={href:'file:///x',protocol:'file:'};window.navigator={userAgent:'node',platform:'linux'};window.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
  window.setTimeout=setTimeout;window.clearTimeout=clearTimeout;window.requestAnimationFrame=(f)=>setTimeout(f,0);window.cancelAnimationFrame=clearTimeout;
  window.localStorage={getItem(){return null;},setItem(){},removeItem(){}};
  window.desk=new Proxy({}, {get:(t,k)=>{if(!(k in t))t[k]=()=>Promise.resolve(undefined);return t[k];},set:(t,k,v)=>{t[k]=v;return true;}});
  const def=(k,v)=>{try{Object.defineProperty(globalThis,k,{value:v,configurable:true,writable:true});}catch{}};
  def('window',window);def('document',document);def('navigator',window.navigator);def('location',window.location);def('localStorage',window.localStorage);
  def('matchMedia',window.matchMedia);def('requestAnimationFrame',window.requestAnimationFrame);def('cancelAnimationFrame',window.cancelAnimationFrame);
  def('CustomEvent',class extends Event{constructor(type,init={}){super(type);this.detail=init.detail;}});
  def('getComputedStyle',()=>({getPropertyValue(){return '';}}));
  def('ResizeObserver',class{observe(){}unobserve(){}disconnect(){}});
  def('IntersectionObserver',class{observe(){}unobserve(){}disconnect(){}});
  def('MutationObserver',class{observe(){}disconnect(){}takeRecords(){return [];}});
  def('NodeFilter',{SHOW_ELEMENT:1,SHOW_TEXT:4,FILTER_ACCEPT:1,FILTER_REJECT:2,FILTER_SKIP:3});
  def('HTMLInputElement',class{});def('HTMLTextAreaElement',class{});def('SVGElement',class{});def('CSS',{escape:(s)=>String(s)});
  return {window,document,elFor};
}

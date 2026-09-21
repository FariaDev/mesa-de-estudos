// Realce de sintaxe para os blocos de código do chat, sem dependência nova.
// Recebe o code (texto já escapado pelo marked) e devolve o mesmo HTML com
// <span data-hl="..."> por tipo de token. Os tokens casam strings e comentários
// primeiro, então não há realce dentro deles.
const LANG={
 js:{kw:'const let var function return if else for while do switch case break continue new class extends super this typeof instanceof in of async await try catch finally throw yield delete void import export from default static get set null undefined true false NaN Infinity',
  types:'Promise Array Object String Number Boolean Map Set WeakMap WeakSet Symbol BigInt Date RegExp Error Math JSON console document window undefined'},
 ts:{kw:'const let var function return if else for while do switch case break continue new class extends super this typeof instanceof in of async await try catch finally throw yield delete void import export from default static get set null undefined true false NaN Infinity',
  types:'Promise Array Object String Number Boolean Map Set Record Partial Readonly Pick Omit Partial string number boolean any unknown never void interface type enum implements private public protected abstract as is keyof'},
 py:{kw:'def return if elif else for while in not and or import from as class try except finally raise with yield lambda global nonlocal pass break continue assert del is None True False async await match case',
  types:'int float str bool list dict tuple set frozenset bytes bytearray range enumerate zip len print open sum min max sorted abs round type isinstance str'},
 sh:{kw:'if then else fi for do done while until case esac in function return break continue local export readonly declare set unset source alias',
  types:'echo cd ls cp mv rm mkdir rmdir cat grep sed awk curl wget git npm node python3 pip which test exit printf sleep kill'},
 json:{},
 css:{kw:'important inherit initial unset'},
 html:{kw:''},
 sql:{kw:'select from where insert into values update set delete create table drop alter add index view join left right inner outer on group by order having limit offset distinct union all as and or not null is like between exists case when then else end primary key foreign references default cascade',
  types:'int integer varchar text boolean date timestamp serial bigint numeric decimal'},
 yaml:{},
 xml:{},
 md:{},markdown:{}};
const WORD=/[A-Za-z_$][\w$]*/y;
function escHtml(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function scanStr(text,i){const quote=text[i];const triple=text.startsWith(quote.repeat(3),i);const q=triple?quote.repeat(3):quote;let j=i+q.length;while(j<text.length){const ch=text[j];if(ch==='\\'){j+=2;continue;}if(q===quote&&ch==='\n')break;if(text.startsWith(q,j)){j+=q.length;break;}j++;}return Math.min(j,text.length);}
function wrap(type,raw){return `<span data-hl="${type}">${raw}</span>`;}
const cache=new Map();
export function highlightCode(code,lang){
 const key=(lang||'')+'\u0000'+code;
 if(cache.has(key))return cache.get(key);
 const out=tokenize(code,String(lang||'').toLowerCase());
 if(cache.size>240)cache.clear();
 cache.set(key,out);
 return out;
}
export function codeLang(className){
 const m=/language-([\w-]+)/.exec(String(className||''));
 return m?m[1].toLowerCase():'';
}
function tokenize(text,lang){
 const cfg=LANG[lang]||{};
 const kw=new Set(String(cfg.kw||'').split(/\s+/).filter(Boolean));
 const types=new Set(String(cfg.types||'').split(/\s+/).filter(Boolean));
 // strings antes de comentários: um // dentro de "..." não vira comentário
 const parts=[];
 if(['js','ts','py','sh','json','html','xml'].includes(lang))parts.push(['str',/"(?:\\.|[^"\\\n])*"/y],['str',/'(?:\\.|[^'\\\n])*'/y]);
 if(['js','ts','sh'].includes(lang))parts.push(['str',/`(?:\\.|[^`\\])*`/y]);
 if(lang==='py')parts.push(['str',/(?:'''[\s\S]*?'''|"""[\s\S]*?""")/y]);
 if(['js','ts','css','json'].includes(lang))parts.push(['comment',/\/\*[\s\S]*?\*\//y]);
 if(['js','ts','py','sh','sql','yaml'].includes(lang))parts.push(['comment',/[ \t]*#.*/y]);
 if(['js','ts'].includes(lang))parts.push(['comment',/\/\/.*/y]);
 if(lang==='sql')parts.push(['comment',/--.*/y]);
 parts.push(['num',/\b(?:0[xX][0-9a-fA-F]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b/y]);
 parts.push(['word',WORD]);
 const out=[];let i=0,last=0,prev='';
 const flush=end=>{if(end>last)out.push(escHtml(text.slice(last,end)));};
 while(i<text.length){
  let matched=false;
  for(const [type,re] of parts){
   re.lastIndex=i;
   const m=re.exec(text);
   if(!m)continue;
   let t=type,cls='';
   if(type==='word'&&(kw.has(m[0])||types.has(m[0]))){t=kw.has(m[0])?'kw':'type';}
   else if(type==='word'){
    const j=i+m[0].length;
    if(text[j]==='('&&prev!=='.')cls='fn';
   }
   flush(i);out.push(wrap(cls?cls:t,escHtml(m[0])));
   i+=m[0].length;last=i;prev=m[0];matched=true;break;
  }
  if(!matched){i++;prev='';}
 }
 flush(text.length);
 return out.join('');
}

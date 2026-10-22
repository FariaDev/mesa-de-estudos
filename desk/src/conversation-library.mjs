import view from './generated/chatlibraryview.core.js';
import {build} from './view-host.mjs';
import {S,toast} from './state.mjs';
import {t,text as translated,formatDate,currentLanguage,LANGUAGE_EVENT} from './ui-text.mjs';
import {displayFreeTitle} from './free-names.mjs';

const node=(tag,text='',className='')=>{const el=document.createElement(tag);el.textContent=text;if(className)el.className=className;return el;};
const fold=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
/* O título sem nome vem do main como mensagem marcada e o da sessão Livre sem título
   é gravado em português (#41): os dois se mostram no idioma da interface. */
const localizedRow=row=>({...row,title:displayFreeTitle(translated(String(row.title||''))),courseName:translated(String(row.courseName||''))});
export function initConversationLibrary({resume}){
 let dialog,rows=[],request=0;
 /* A janela é montada uma vez; ao trocar de idioma ela é refeita na próxima abertura. */
 window.addEventListener(LANGUAGE_EVENT,()=>{dialog?.remove();dialog=null;});
 function ensure(){
  if(dialog)return;
  dialog=node('dialog','','study-dialog chat-library-dialog');dialog.id='chat-library-dialog';
  dialog.setAttribute('aria-labelledby','chat-library-title');
  const title=node('h2',t('chatlib.ui.title'));title.id='chat-library-title';
  const hint=node('p',t('chatlib.ui.hint'),'study-muted');
  const filters=node('div','','chat-library-filters');
  const query=node('input');query.id='chat-library-query';query.type='search';query.placeholder=t('chatlib.ui.search');query.setAttribute('aria-label',t('chatlib.ui.searchAria'));
  const courses=node('select');courses.id='chat-library-course';courses.setAttribute('aria-label',t('chatlib.ui.filterCourse'));
  const topics=node('select');topics.id='chat-library-topic';topics.setAttribute('aria-label',t('chatlib.ui.filterTopic'));
  const favoriteLabel=node('label','');favoriteLabel.className='chat-library-favorite-filter';
  const favorites=node('input');favorites.type='checkbox';favorites.id='chat-library-favorites';favoriteLabel.append(favorites,document.createTextNode(` ${t('chatlib.ui.favoritesOnly')}`));
  filters.append(query,courses,topics,favoriteLabel);
  const status=node('p','','study-muted');status.id='chat-library-status';status.setAttribute('role','status');
  const list=node('div','','chat-library-list');list.id='chat-library-list';
  const editor=node('div','','study-card');editor.id='chat-library-editor';editor.hidden=true;
  const close=node('button','×','icon-btn dialog-close');close.type='button';close.title=t('common.close');close.setAttribute('aria-label',t('common.close'));close.onclick=()=>dialog.close();
  const head=node('div','','study-head');head.append(title,close);
  dialog.append(head,hint,filters,status,list,editor);document.body.append(dialog);
  for(const input of [query,courses,topics,favorites])input.addEventListener(input===query?'input':'change',draw);
  dialog.addEventListener('close',()=>{editor.hidden=true;});
 }
 function draw(){
  const course=dialog.querySelector('#chat-library-course').value,topic=dialog.querySelector('#chat-library-topic').value;
  const q=fold(dialog.querySelector('#chat-library-query').value),favorites=dialog.querySelector('#chat-library-favorites').checked;
  const filtered=rows.filter(row=>(!course||row.courseId===course)&&(!topic||row.topic===topic)&&(!favorites||row.favorite)&&(!q||fold([row.title,row.preview,row.topic,row.courseName].join(' ')).includes(q)));
  const list=dialog.querySelector('#chat-library-list');list.replaceChildren();
  dialog.querySelector('#chat-library-status').textContent=t('chatlib.ui.count',{count:filtered.length});
  for(const row of filtered){
   const date=row.at?formatDate(new Date(row.at),{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):t('chatlib.ui.noDate');
   const detail=[row.courseName,date,({claude:'Claude Code',opencode:'OpenCode'})[row.engine]||'Pi'].join(' · ');
   const article=build(view.row(row.id,row.title,detail,row.preview||t('chatlib.ui.noMessages'),row.topic||t('chatlib.ui.noTopic'),!!row.favorite,!!row.current),{
    ResumeChat:async()=>{try{if(await resume(row)){dialog.close();}}catch(error){toast(error.message);}},
    FavoriteChat:async()=>{try{await window.desk.libraryChatUpdate({id:row.id,patch:{favorite:!row.favorite}});await refresh();}catch(error){toast(error.message);}},
    LabelChat:()=>edit(row)
   });list.append(article);
  }
  if(!filtered.length)list.append(node('p',t('chatlib.ui.noMatch'),'study-muted'));
 }
 function edit(row){
  const editor=dialog.querySelector('#chat-library-editor');editor.replaceChildren();editor.hidden=false;
  editor.append(node('h3',t('chatlib.label')));
  const title=node('input');title.value=row.title;title.maxLength=160;title.id='chat-library-edit-title';
  const topic=node('input');topic.value=row.topic;topic.maxLength=80;topic.id='chat-library-edit-topic';topic.placeholder=t('chatlib.ui.topicExample');
  const titleLabel=node('label',t('chatlib.ui.titleLabel'));titleLabel.htmlFor=title.id;
  const topicLabel=node('label',t('chatlib.ui.topicLabel'));topicLabel.htmlFor=topic.id;
  const actions=node('div','','study-row');const save=node('button',t('common.save'));save.type='button';save.className='primary';
  const cancel=node('button',t('common.cancel'));cancel.type='button';cancel.onclick=()=>{editor.hidden=true;};
  save.onclick=async()=>{save.disabled=true;try{await window.desk.libraryChatUpdate({id:row.id,patch:{title:title.value,topic:topic.value}});editor.hidden=true;await refresh();toast(t('chatlib.ui.saved'));}catch(error){toast(error.message);}finally{save.disabled=false;}};
  actions.append(cancel,save);editor.append(titleLabel,title,topicLabel,topic,actions);title.focus();editor.scrollIntoView({block:'nearest'});
 }
 async function refresh(){
  const generation=++request;const values=await window.desk.libraryChats();if(generation!==request)return;
  rows=(Array.isArray(values)?values:[]).map(localizedRow);
  const courses=dialog.querySelector('#chat-library-course'),topics=dialog.querySelector('#chat-library-topic');
  const course=courses.value,topic=topics.value;
  courses.replaceChildren(new Option(t('chatlib.ui.allCourses'),''));
  const groups=new Map(rows.map(row=>[row.courseId,row.courseName]));
  for(const [id,name] of groups)courses.add(new Option(name,id));
  courses.value=groups.has(course)?course:'';
  topics.replaceChildren(new Option(t('chatlib.ui.allTopics'),''));
  for(const value of [...new Set(rows.map(row=>row.topic).filter(Boolean))].sort((a,b)=>a.localeCompare(b,currentLanguage())))topics.add(new Option(value,value));
  topics.value=[...topics.options].some(o=>o.value===topic)?topic:'';draw();
 }
 async function open(){
  if(document.querySelector('dialog[open]'))return;
  ensure();dialog.querySelector('#chat-library-query').value='';dialog.querySelector('#chat-library-favorites').checked=false;
  await refresh();const courses=dialog.querySelector('#chat-library-course');courses.value=[...courses.options].some(o=>o.value===S.currentCourseId)?S.currentCourseId:'';
  dialog.querySelector('#chat-library-topic').value='';draw();dialog.showModal();dialog.querySelector('#chat-library-query').focus();
 }
 return {open};
}

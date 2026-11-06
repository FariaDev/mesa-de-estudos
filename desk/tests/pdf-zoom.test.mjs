import test from 'node:test';
import assert from 'node:assert/strict';
import {handlePdfZoomKey,rememberPdfReader,selectedPdfReader,zoomIntent} from '../src/pdf-zoom.mjs';

/* Atalho de zoom do leitor (#111): a intenção vem das teclas e o alvo é o
   último leitor clicado/rolado, enquanto visível. Sem alvo o atalho não é
   consumido. */

function panel({visible=true,connected=true}={}){
 const calls=[];
 return {
  calls,
  el:{isConnected:connected,hidden:!visible,getBoundingClientRect:()=>({width:visible?100:0,height:visible?100:0})},
  nudgeZoom:delta=>calls.push(delta)
 };
}

test('atalho de zoom: =, + e - com Mod (Cmd/Ctrl); sem Mod, com Alt ou outra tecla não vale', () => {
 assert.equal(zoomIntent({key:'=',ctrlKey:true}),1);
 assert.equal(zoomIntent({key:'+',metaKey:true,shiftKey:true}),1);
 assert.equal(zoomIntent({key:'-',metaKey:true}),-1);
 assert.equal(zoomIntent({key:'-',ctrlKey:true}),-1);
 assert.equal(zoomIntent({key:'=',shiftKey:true}),0);
 assert.equal(zoomIntent({key:'=',ctrlKey:true,altKey:true}),0);
 assert.equal(zoomIntent({key:'0',metaKey:true}),0);
 assert.equal(zoomIntent({key:'_',metaKey:true,shiftKey:true}),0);
});

test('leitor selecionado é o último usado, e só enquanto visível', () => {
 const first=panel(),second=panel();
 rememberPdfReader(first);
 assert.equal(selectedPdfReader(),first);
 rememberPdfReader(second);
 assert.equal(selectedPdfReader(),second);
 rememberPdfReader(null);
 assert.equal(selectedPdfReader(),null);
 rememberPdfReader(first);
 first.el.hidden=true;
 assert.equal(selectedPdfReader(),null);
 first.el.hidden=false;
 first.el.isConnected=false;
 assert.equal(selectedPdfReader(),null);
 first.el.isConnected=true;
 first.el.getBoundingClientRect=()=>({width:0,height:0});
 assert.equal(selectedPdfReader(),null);
 first.el.getBoundingClientRect=()=>({width:100,height:100});
 first.minimized=true;
 assert.equal(selectedPdfReader(),null,'recolhido não recebe zoom que a pessoa não veria');
 first.minimized=false;
 assert.equal(selectedPdfReader(),first);
});

test('atalho consome só com leitor selecionado visível e mexe só no zoom dele', () => {
 const first=panel(),second=panel();
 rememberPdfReader(first);
 const event={key:'=',ctrlKey:true,prevented:false,preventDefault(){this.prevented=true;}};
 assert.equal(handlePdfZoomKey(event,[first,second]),true);
 assert.equal(event.prevented,true);
 assert.deepEqual(first.calls,[0.2]);
 assert.deepEqual(second.calls,[]);
 const down={key:'-',ctrlKey:true,prevented:false,preventDefault(){this.prevented=true;}};
 assert.equal(handlePdfZoomKey(down,[first,second]),true);
 assert.deepEqual(first.calls,[0.2,-0.2]);
});

test('sem leitor selecionado (ou com ele escondido) o atalho não é consumido', () => {
 const first=panel(),second=panel();
 rememberPdfReader(null);
 const event={key:'+',metaKey:true,prevented:false,preventDefault(){this.prevented=true;}};
 assert.equal(handlePdfZoomKey(event,[first,second]),false);
 assert.equal(event.prevented,false);
 rememberPdfReader(first);
 first.el.hidden=true;
 assert.equal(handlePdfZoomKey(event,[first,second]),false);
 assert.equal(event.prevented,false);
 assert.deepEqual(first.calls,[]);
});

test('leitor fora da lista atual não recebe o zoom', () => {
 const stale=panel(),current=panel();
 rememberPdfReader(stale);
 const event={key:'=',metaKey:true,prevented:false,preventDefault(){this.prevented=true;}};
 assert.equal(handlePdfZoomKey(event,[current]),false);
 assert.equal(event.prevented,false);
 assert.deepEqual(stale.calls,[]);
});

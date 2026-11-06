import assert from 'node:assert/strict';
import test from 'node:test';
import {createMathCache} from '../src/math-cache.mjs';

const counting=(value=tex=>tex)=>{
 const calls=[];
 const cache=createMathCache((tex,display)=>{calls.push([tex,display]);return value(tex,display);});
 return {cache,calls};
};

test('a mesma fórmula e modo renderiza uma vez; o resto é acerto no cache',()=>{
 const {cache,calls}=counting(tex=>`<span data-tex="${tex}">`);
 assert.equal(cache.render('x^2',false),'<span data-tex="x^2">');
 assert.equal(cache.render('x^2',false),'<span data-tex="x^2">');
 assert.equal(calls.length,1,'a segunda repintura não chama o KaTeX de novo');
 assert.deepEqual(cache.stats(),{hits:1,misses:1,size:1});
});

test('inline e display são chaves diferentes',()=>{
 const {cache,calls}=counting((tex,display)=>`${display?'D':'I'}:${tex}`);
 assert.equal(cache.render('x',false),'I:x');
 assert.equal(cache.render('x',true),'D:x');
 assert.equal(calls.length,2);
 assert.deepEqual(cache.stats(),{hits:0,misses:2,size:2});
});

test('a falha (null) também fica guardada: não repete a exceção a cada delta',()=>{
 const {cache,calls}=counting(()=>null);
 assert.equal(cache.render('\\frac{',false),null);
 assert.equal(cache.render('\\frac{',false),null);
 assert.equal(calls.length,1);
});

test('o cache respeita o limite e descarta o mais antigo',()=>{
 const {cache,calls}=counting();
 cache.render('a',false);
 cache.render('b',false);
 cache.render('c',false);
 assert.deepEqual(cache.stats(),{hits:0,misses:3,size:3});
 const limited=createMathCache((tex)=>{calls.push([tex,false]);return tex;},{limit:2});
 limited.render('a',false);
 limited.render('b',false);
 limited.render('c',false);
 assert.equal(limited.stats().size,2,'o limite vale para o cache novo');
 limited.render('a',false);
 assert.equal(limited.stats().hits,0,'a mais antiga saiu do cache');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {pageTurnFromWheel} from '../wheel.mjs';

test('wheel at the bottom turns to the next page after the threshold',()=>{
 assert.deepEqual(pageTurnFromWheel({deltaY:40,atBottom:true,accum:0}),{accum:40,turn:0});
 assert.deepEqual(pageTurnFromWheel({deltaY:50,atBottom:true,accum:40}),{accum:0,turn:1});
});

test('wheel in the middle of the page does not turn',()=>{
 assert.deepEqual(pageTurnFromWheel({deltaY:120,atTop:false,atBottom:false,fits:false,accum:40}),{accum:0,turn:0});
});

test('wheel at the top turns to the previous page',()=>{
 assert.deepEqual(pageTurnFromWheel({deltaY:-90,atTop:true,accum:0}),{accum:0,turn:-1});
});

test('a page that fits still turns after enough delta',()=>{
 assert.deepEqual(pageTurnFromWheel({deltaY:80,fits:true,atTop:true,atBottom:true}),{accum:0,turn:1});
});

test('cooldown blocks another turn',()=>{
 assert.deepEqual(pageTurnFromWheel({deltaY:120,atBottom:true,now:500,lastTurn:400,cooldown:280}),{accum:0,turn:0});
});

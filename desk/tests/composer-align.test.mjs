import test from 'node:test';
import assert from 'node:assert/strict';
import {tutorComposerFootprint} from '../src/composer-align.mjs';

/* O lateral soma a faixa da calculadora só quando ela está recolhida. */
const facts={composerTop:500,composerBottom:640,columnBottom:680,calculatorCollapsed:true};

test('calculadora recolhida entra na altura do lateral',()=>{
 assert.deepEqual(tutorComposerFootprint(facts),{height:140,foot:40});
});

test('calculadora aberta devolve o pé da coluna ao lateral',()=>{
 assert.deepEqual(tutorComposerFootprint({...facts,calculatorCollapsed:false}),{height:140,foot:0});
});

test('tutor fora da tela não deixa altura nem faixa',()=>{
 assert.deepEqual(tutorComposerFootprint({composerTop:0,composerBottom:0,columnBottom:680,calculatorCollapsed:true}),{height:0,foot:0});
});

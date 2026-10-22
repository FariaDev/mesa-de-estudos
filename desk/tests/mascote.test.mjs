import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mascoteHumor,mascoteLook,mascoteTilt,lookAtPointer,sparkTargets,poke,EYE_REACH} from '../src/mascote-humor.mjs';
import {personagemOf,mascoteNameKey,mascoteView,mascoteMarkup} from '../src/mascote.mjs';
import ptBR from '../src/locales/pt-BR.json' with {type: 'json'};
import en from '../src/locales/en.json' with {type: 'json'};

/* #64: o contrato das mascotes (o trio ∫ Σ ∇ da primeira abertura, do Guia e
   do "pensando"): humor por nome → estado e classes. O desenho tem o teste
   dele (trio-art.test.mjs). */

const TRIO = ['integral', 'sigma', 'nabla'];

test('personagem desconhecida é recusada com o valor recebido e o formato esperado', () => {
  for (const id of TRIO) assert.equal(personagemOf(id).nameKey, mascoteNameKey(id));
  assert.throws(() => personagemOf('folhinha'), /desconhecida: "folhinha"; esperado um destes textos: "integral", "sigma", "nabla"/, 'a Folhinha saiu');
  assert.throws(() => personagemOf(undefined), /desconhecida: undefined/, 'a personagem é obrigatória');
  assert.throws(() => personagemOf('toString'), /desconhecida/, 'nada herdado de Object vale como personagem');
});

test('o nome de cada um vem do catálogo, nos dois idiomas, e só vai no aria-label', () => {
  for (const id of TRIO) {
    const key = mascoteNameKey(id);
    assert.ok(ptBR[key] && en[key], `${key} nos dois catálogos`);
  }
  assert.deepEqual(TRIO.map((id) => ptBR[mascoteNameKey(id)]), ['Integral', 'Sigma', 'Nabla']);
  assert.equal(ptBR['mascote.folhinha.nome'], undefined);
  assert.doesNotMatch(ptBR['setup.say.welcome'], /\{name\}/, 'as boas-vindas apresentam a Mesa, não as personagens');
});

test('a marca parada (o "pensando" do chat) é decorativa e recusa humor desconhecido', () => {
  const html = mascoteMarkup({personagem: 'integral', humor: 'pensando', tamanho: 20});
  assert.match(html, /^<span class="mascote mascote-integral" data-humor="pensando" style="--fo-size:20px" aria-hidden="true"><svg/);
  assert.match(html, /class="mascote-look"/);
  assert.notEqual(html.match(/<filter id="([^"]+)"/)[1], mascoteMarkup({personagem: 'integral', tamanho: 20}).match(/<filter id="([^"]+)"/)[1], 'cada cópia tem o seu filtro');
  assert.throws(() => mascoteMarkup({personagem: 'integral', humor: /** @type {any} */ ('bravo'), tamanho: 20}), /humor da mascote desconhecido: "bravo"; esperado um destes: normal, feliz/);
  assert.throws(() => mascoteMarkup({personagem: 'pato', tamanho: 20}), /desconhecida: "pato"/);
});

test('humor → data-humor e classes de laço', () => {
  assert.deepEqual(mascoteView({}), {humor: 'normal', classes: {'mascote-waving': false, 'mascote-floating': true, 'mascote-party': false}});
  assert.equal(mascoteView({wave: true}).classes['mascote-waving'], true, 'acena no normal');
  assert.equal(mascoteView({wave: true, writing: true}).classes['mascote-waving'], false, 'não acena com outro rosto');
  assert.equal(mascoteView({mood: 'feliz'}).classes['mascote-party'], true);
  assert.equal(mascoteView({float: false}).classes['mascote-floating'], false);
  assert.equal(mascoteView({mood: 'pensando'}).humor, 'pensando');
  assert.equal(mascoteView({laughing: true, dizzy: true}).humor, 'aflita');
});

test('o rosto segue a ordem do protótipo: cutucada vence, depois feliz, sono, escrevendo, atento e lendo', () => {
  assert.equal(mascoteHumor({}), 'normal');
  assert.equal(mascoteHumor({mood:'pensando'}), 'pensando');
  assert.equal(mascoteHumor({mood:'normal',reading:true}), 'lendo');
  assert.equal(mascoteHumor({reading:true,alert:true}), 'atento');
  assert.equal(mascoteHumor({alert:true,writing:true}), 'escrevendo');
  assert.equal(mascoteHumor({writing:true,sleepy:true}), 'sono');
  assert.equal(mascoteHumor({sleepy:true,mood:'feliz'}), 'feliz');
  assert.equal(mascoteHumor({mood:'pensando',laughing:true}), 'feliz');
  assert.equal(mascoteHumor({laughing:true,dizzy:true}), 'aflita', 'cinco cutucadas: tonta');
});

test('a pupila não sai do olho e alguns humores fixam o olhar', () => {
  assert.deepEqual(mascoteLook('normal', 3, 4), [3, 4]);
  const [x, y] = mascoteLook('normal', 300, 400);
  assert.ok(Math.abs(Math.hypot(x, y) - EYE_REACH) < 1e-9, 'cortada no alcance');
  const [up, high] = mascoteLook('pensando', 100, 100);
  assert.ok(Math.abs(Math.hypot(up, high) - EYE_REACH) < 1e-9 && Math.abs(high / up + 2) < 1e-9, 'pensando olha para cima (4, -8), cortado no alcance');
  assert.deepEqual(mascoteLook('lendo', 8, 0), [0, 0], 'lendo varre sozinha');
  assert.deepEqual(mascoteLook('sono', -5, 0), [0, 6]);
});

test('o olhar segue o ponteiro com força pela distância e o corpo inclina até 6 graus', () => {
  const box = {left: 0, top: 0, width: 240, height: 260};
  const [farX, farY] = lookAtPointer(box, 1000, 109.2);
  assert.ok(Math.abs(farX - EYE_REACH) < 1e-9 && Math.abs(farY) < 1e-9);
  const [nearX] = lookAtPointer(box, 120 + 28.8, 109.2);
  assert.ok(Math.abs(nearX - 0.8) < 1e-9, 'perto, olha pouco');
  assert.equal(mascoteTilt(20), 6);
  assert.equal(mascoteTilt(-20), -6);
  assert.equal(mascoteTilt(5), 3);
});

test('cinco cutucadas em 2 s deixam tonta; mais espaçadas, não', () => {
  let pokes = [];
  for (const time of [0, 300, 600, 900]) {
    const out = poke(pokes, time);
    assert.equal(out.dizzy, false);
    pokes = out.pokes;
  }
  assert.deepEqual(poke(pokes, 1200), {pokes: [], dizzy: true});
  assert.equal(poke([0, 500, 1000, 1500], 2600).dizzy, false, 'as antigas saíram da janela');
});

test('oito faíscas em roda, alternando acento e âmbar', () => {
  const sparks = sparkTargets();
  assert.equal(sparks.length, 8);
  assert.deepEqual(sparks[0], {x: 120, y: 0, amber: false});
  assert.deepEqual(sparks.map((s) => s.amber), [false, true, false, true, false, true, false, true]);
});

test('o movimento do trio usa os tokens e para com movimento reduzido', () => {
  const css = fs.readFileSync(new URL('../src/trio.css', import.meta.url), 'utf8');
  const timings = [...css.matchAll(/animation:tr-[a-z]+ ([^;}]+)/g)].map((m) => m[1]);
  assert.ok(timings.length >= 15, `esperava os laços e as animações de uma vez, achei ${timings.length}`);
  for (const timing of timings) assert.match(timing, /^calc\(var\(--t-(loop|slow)\)/, `duração fora dos tokens que o reduzir zera: ${timing}`);
  assert.doesNotMatch(css, /button\.mascote/, 'a mascote não é botão: a reação ao mouse vale para .mascote-interativa');
  const areas = fs.readFileSync(new URL('../src/desk-areas.css', import.meta.url), 'utf8');
  assert.match(areas, /@import url\('trio\.css'\);/);
  assert.doesNotMatch(areas, /folhinha/);
});

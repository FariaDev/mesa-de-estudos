import test from 'node:test';
import assert from 'node:assert/strict';
import {copiedMark,savedMark,flashMark,MARK_MS} from '../src/icon-motion.mjs';

/* #61: as microinterações trocam o chip pela marca e devolvem o original. O
   botão e o relógio são falsos: o teste controla quando o tempo passa. */
function fakeButton(html){
  const classes=new Set();
  return {innerHTML:html,classList:{add:(c)=>classes.add(c),remove:(c)=>classes.delete(c),has:(c)=>classes.has(c)}};
}
function fakeClock(){
  const pending=new Map();let next=0;
  return {
    setTimer:(fn,ms)=>{pending.set(++next,{fn,ms});return next;},
    clearTimer:(id)=>pending.delete(id),
    runAll:()=>{for(const [id,{fn}] of [...pending]){pending.delete(id);fn();}},
    pending,
  };
}

test('copiedMark desenha o visto inteiro pelo pathLength', () => {
  assert.match(copiedMark(), /class="icon motion-mark motion-copied"/);
  assert.match(copiedMark(), /pathLength="1"/);
});

test('savedMark usa um recorte próprio por marca', () => {
  const ids=[savedMark(),savedMark()].map((svg)=>svg.match(/clipPath id="([^"]+)"/)[1]);
  assert.notEqual(ids[0],ids[1]);
  assert.match(savedMark(),/clip-path="url\(#motion-clip-\d+\)"/);
});

test('flashMark mostra a marca com o rótulo e devolve o chip original', () => {
  const button=fakeButton('Copiar');const clock=fakeClock();
  flashMark(button,copiedMark(),'copiado',clock);
  assert.ok(button.classList.has('ok'));
  assert.match(button.innerHTML,/motion-copied.*<span>copiado<\/span>/);
  assert.equal([...clock.pending.values()][0].ms,MARK_MS);
  clock.runAll();
  assert.equal(button.innerHTML,'Copiar');
  assert.equal(button.classList.has('ok'),false);
});

test('flashMark repetido não perde o chip original', () => {
  const button=fakeButton('Guardar para revisar');const clock=fakeClock();
  flashMark(button,savedMark(),'guardado',clock);
  flashMark(button,savedMark(),'guardado',clock);
  assert.equal(clock.pending.size,1,'o segundo clique reinicia o relógio');
  clock.runAll();
  assert.equal(button.innerHTML,'Guardar para revisar');
});

test('flashMark escapa o rótulo e ignora botão ausente', () => {
  const button=fakeButton('x');
  flashMark(button,copiedMark(),'<b>&',fakeClock());
  assert.match(button.innerHTML,/<span>&lt;b&gt;&amp;<\/span>/);
  assert.doesNotThrow(()=>flashMark(null,copiedMark(),'x'));
});

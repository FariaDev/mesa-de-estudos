/* Fixtures sintéticas de atividade (MRUV, cálculo e demonstração fora de
   catálogo). São specs do contrato real — usadas nos testes de store, ponte,
   runtime e UI. Nenhum dado pessoal, nenhuma biblioteca remota. */

export const MRUV_SPEC = {
  title: 'MRUV: posição com aceleração',
  objective: 'Relacionar aceleração, velocidade inicial e posição no instante 3 s.',
  alternativeMarkdown: 'Posição no MRUV: `s(t) = s₀ + v₀·t + a·t²/2`, com `s₀ = 6 m` e `t = 3 s`.\n\nTeste `a` entre 0 e 4 m/s². Com `a = 2`, a posição é 15 m; com `a = 4`, 24 m.',
  html: [
    '<div class="mruv">',
    '  <label for="a">Aceleração a (m/s²): <output id="a-out">2,0</output></label>',
    '  <input id="a" type="range" min="0" max="4" step="0.1" value="2">',
    '  <label for="v0">Velocidade inicial v₀ (m/s): <output id="v0-out">0,0</output></label>',
    '  <input id="v0" type="range" min="0" max="5" step="0.1" value="0">',
    '  <p>Previsão: qual a posição em t = 3 s? <output id="s-out">15,0 m</output></p>',
    '  <button id="check" type="button">Conferir minha previsão (15 m)</button>',
    '  <svg id="plot" viewBox="0 0 320 160" role="img" aria-label="gráfico de posição por tempo"></svg>',
    '</div>',
  ].join('\n'),
  css: '.mruv{display:grid;gap:6px}.mruv label{font-size:12px}.mruv svg{width:100%;height:160px;background:var(--mesa-bg);border:1px solid var(--mesa-border);border-radius:6px}',
  js: [
    '(function(){',
    '  var a=document.getElementById("a"),v0=document.getElementById("v0"),out=document.getElementById("s-out");',
    '  var plot=document.getElementById("plot"),s0=6,t=3;',
    '  function s(){return s0+(+v0.value)*t+(+a.value)*t*t/2;}',
    '  function draw(){',
    '    var w=300,h=120,x0=20,y0=140,maxS=s0+5*3+4*9/2+1;var pts="";',
    '    for(var i=0;i<=30;i+=1){var tt=i/10;var ss=s0+(+v0.value)*tt+(+a.value)*tt*tt/2;pts+=((x0+(tt/3)*(w))).toFixed(1)+","+(y0-(ss/maxS)*(h-20)).toFixed(1)+" ";}',
    '    plot.textContent="";var poly=document.createElementNS("http://www.w3.org/2000/svg","polyline");poly.setAttribute("points",pts.trim());poly.setAttribute("fill","none");poly.style.stroke="var(--mesa-accent)";poly.setAttribute("stroke-width","2");plot.append(poly);',
    '    var mark=document.createElementNS("http://www.w3.org/2000/svg","circle");mark.setAttribute("cx",x0+w);mark.setAttribute("cy",y0-(s()/maxS)*(h-20));mark.setAttribute("r","4");mark.style.fill="var(--mesa-accent)";plot.append(mark);',
    '  }',
    '  function update(){document.getElementById("a-out").textContent=(+a.value).toFixed(1);document.getElementById("v0-out").textContent=(+v0.value).toFixed(1);out.textContent=s().toFixed(1)+" m";draw();window.mesa.state({a:+a.value,v0:+v0.value});}',
    '  a.addEventListener("input",update);v0.addEventListener("input",update);',
    '  document.getElementById("check").addEventListener("click",function(){var ok=Math.abs(s()-15)<0.05;window.mesa.attempt({previsto:15,correto:ok,posicao:+s().toFixed(1)});});',
    '  window.mesa.onMessage(function(message){if(message.type==="init"&&message.state&&typeof message.state==="object"){if(typeof message.state.a==="number")a.value=message.state.a;if(typeof message.state.v0==="number")v0.value=message.state.v0;update();}});',
    '  update();window.mesa.ready();',
    '})();',
  ].join('\n'),
  katex: false,
};

export const CALC_SPEC = {
  title: 'Parâmetro da parábola',
  objective: 'Explorar como o coeficiente c desloca a parábola e testar uma resposta.',
  alternativeMarkdown: 'A função é `f(x) = x² + c`. O vértice fica em `(0, c)`.\n\nCom `c = 2`, `f(1) = 3`. Tente prever `f(1)` para outro `c`.',
  html: [
    '<div class="calc">',
    '  <label for="c">Coeficiente c: <output id="c-out">2,0</output></label>',
    '  <input id="c" type="range" min="-4" max="4" step="0.5" value="2">',
    '  <p><span class="fx">f(x) = x² + c</span> · f(1) = <output id="f-out">3,0</output></p>',
    '  <label for="r">Sua resposta para f(1): <input id="r" type="number" step="0.5" value="3"></label>',
    '  <button id="check" type="button">Conferir</button>',
    '  <p id="fb" aria-live="polite"></p>',
    '</div>',
  ].join('\n'),
  css: '.calc{display:grid;gap:6px}.calc input[type="number"]{width:80px}.calc .fx{font-weight:600}',
  js: [
    '(function(){',
    '  var c=document.getElementById("c"),fc=document.getElementById("f-out"),fb=document.getElementById("fb");',
    '  function f(){return 1+(+c.value);}',
    '  function update(){document.getElementById("c-out").textContent=(+c.value).toFixed(1);fc.textContent=f().toFixed(1);window.mesa.state({c:+c.value});}',
    '  c.addEventListener("input",update);',
    '  document.getElementById("check").addEventListener("click",function(){',
    '    var given=parseFloat(document.getElementById("r").value),expected=f(),ok=Math.abs(given-expected)<0.01;',
    '    fb.textContent=ok?"Certo: f(1) = "+expected.toFixed(1):"Ainda não: para c = "+(+c.value).toFixed(1)+", f(1) = "+expected.toFixed(1)+".";',
    '    window.mesa.attempt({dado:given,esperado:+expected.toFixed(1),correto:ok});',
    '  });',
    '  update();window.mesa.ready();',
    '})();',
  ].join('\n'),
  katex: false,
};

/* Fora de catálogo fixo: amostragem que aproxima a probabilidade de dois dados
   somarem 7 — demonstra geração livre (DOM + simulação), sem biblioteca externa. */
export const FREE_SPEC = {
  title: 'Probabilidade por amostragem: soma 7',
  objective: 'Comparar a frequência simulada de soma 7 com a probabilidade teórica 6/36.',
  alternativeMarkdown: 'Em dois dados honestos, `P(soma = 7) = 6/36 ≈ 0,1667`.\n\nA simulação local de N lançamentos aproxima esse valor; aumente N para ver a convergência.',
  html: [
    '<div class="prob">',
    '  <label for="n">Lançamentos: <output id="n-out">600</output></label>',
    '  <input id="n" type="range" min="60" max="6000" step="60" value="600">',
    '  <button id="run" type="button">Simular</button>',
    '  <p>Soma 7 em <output id="hits">0</output> lançamentos: <output id="freq">—</output> (teórico 16,7%)</p>',
    '  <div id="bar" aria-hidden="true"><div id="fill"></div></div>',
    '</div>',
  ].join('\n'),
  css: '.prob{display:grid;gap:6px}.prob #bar{height:12px;background:var(--mesa-border);border-radius:6px;overflow:hidden}.prob #fill{height:100%;width:0;background:var(--mesa-accent)}',
  js: [
    '(function(){',
    '  var n=document.getElementById("n"),hits=document.getElementById("hits"),freq=document.getElementById("freq"),fill=document.getElementById("fill");',
    '  function simulate(){var count=+n.value,seven=0;for(var i=0;i<count;i+=1){var d1=1+Math.floor(Math.random()*6),d2=1+Math.floor(Math.random()*6);if(d1+d2===7)seven+=1;}var p=seven/count;hits.textContent=count;freq.textContent=(p*100).toFixed(1)+"%";fill.style.width=(Math.min(1,p/0.35)*100).toFixed(1)+"%";window.mesa.state({n:count,seven:seven,freq:+p.toFixed(4)});window.mesa.attempt({simulado:+p.toFixed(4),teorico:6/36});}',
    '  document.getElementById("run").addEventListener("click",simulate);',
    '  n.addEventListener("input",function(){document.getElementById("n-out").textContent=n.value;});',
    '  simulate();window.mesa.ready();',
    '})();',
  ].join('\n'),
  katex: false,
};

export const LOOP_SPEC = {
  title: 'Laço sintético',
  objective: 'Fixture de contenção: trava o próprio frame até ser parada.',
  alternativeMarkdown: 'Fixture de teste: `while (true) {}`.',
  html: '<p id="loop">rodando…</p>',
  css: '',
  js: 'parent.postMessage({v:1,id:window.__MESA_ACTIVITY__.id,version:window.__MESA_ACTIVITY__.version,hash:window.__MESA_ACTIVITY__.hash,type:"state",payload:{looping:true}},"*");while(true){}',
  katex: false,
};

/* Flood DIRETO: chama parent.postMessage sem passar por window.mesa, para
   provar que o host limita taxa/total mesmo com script livre. */
export const FLOOD_SPEC = {
  title: 'Flood direto de mensagens',
  objective: 'Fixture de contenção: inunda o host por fora do wrapper.',
  alternativeMarkdown: 'Fixture de teste: flood de `postMessage`.',
  html: '<p id="flood">inundando…</p>',
  css: '',
  js: [
    '(function(){',
    '  var meta=window.__MESA_ACTIVITY__;var sent=0;',
    '  var pump=function(){',
    '    for(var i=0;i<400;i+=1){parent.postMessage({v:1,type:"state",id:meta.id,version:meta.version,hash:meta.hash,payload:{i:i}},"*");sent+=1;}',
    '    if(sent<60000)setTimeout(pump,0);',
    '  };',
    '  pump();',
    '})();',
  ].join('\n'),
  katex: false,
};

/* Estado 13 KiB + tentativa 3,5 KiB: cada campo dentro do próprio teto e do
   envelope de 21 KiB (reprodução do achado P2 — não pode sumir em silêncio). */
export const BIG_STATE_SPEC = {
  title: 'Estado grande com tentativa',
  objective: 'Fixture do envelope values 16 KiB + attempt 4 KiB.',
  alternativeMarkdown: 'Fixture de teste: estado 13 KiB + tentativa 3,5 KiB.',
  html: '<p id="big-state">guardando…</p>',
  css: '',
  js: [
    'var big="x".repeat(13000);',
    'window.mesa.state({blob:big});',
    'window.mesa.attempt({blob:"y".repeat(3500)});',
    'window.mesa.ready();',
  ].join('\n'),
  katex: false,
};

export const FIXTURES = {MRUV_SPEC, CALC_SPEC, FREE_SPEC, LOOP_SPEC, FLOOD_SPEC, BIG_STATE_SPEC};

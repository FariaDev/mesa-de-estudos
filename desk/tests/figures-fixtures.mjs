// Material de teste das figuras do tutor (#60): tudo inventado (funções e
// formas sem relação com material de curso). `evil.example` é domínio
// reservado (RFC 2606): nunca resolve.

/* Um SVG com tudo o que não pode passar: script, foreignObject, href externo
   (em <a>, <use> e <image>), url() externo em style e em atributos de
   pintura, animação que troca href e atributo on*. Sem linha em branco: o
   Markdown fecha o bloco HTML numa linha em branco. */
export const MALICIOUS_SVG = [
  '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 100 60" onload="alert(1)">',
  '<script>alert(1)</script>',
  '<foreignObject x="0" y="0" width="100" height="60"><div onclick="alert(2)">cai fora</div></foreignObject>',
  '<a href="https://evil.example/leak"><text x="5" y="10">link</text></a>',
  '<use href="https://evil.example/sprite.svg#a"/>',
  '<use xlink:href="//evil.example/sprite.svg#a"/>',
  '<image href="https://evil.example/pixel.png" width="1" height="1"/>',
  '<circle cx="30" cy="30" r="10" style="fill:url(https://evil.example/paint)"/>',
  '<rect x="50" y="20" width="20" height="20" fill="url(https://evil.example/g)" filter="url(http://evil.example/f)"/>',
  '<path d="M0 0L10 10" style="stroke:var(--plot-1,#000)"/>',
  '<animate attributeName="href" to="javascript:alert(3)"/>',
  '<text x="5" y="50" fill="currentColor">ok</text>',
  '</svg>',
].join('\n');

/* O que deve sobrar do SVG acima depois da sanitização. */
export const SURVIVORS = ['circle', 'rect', 'path', 'text', 'a'];

/* Um SVG honesto do tutor: triângulo com lados rotulados, cores do tema. */
export const TRIANGLE_SVG = [
  '<svg viewBox="0 0 220 140" role="img" aria-label="Triângulo retângulo de catetos 3 e 4">',
  '<polygon points="20,120 200,120 20,20" fill="none" stroke="currentColor" stroke-width="2"/>',
  '<path d="M20 104h16v16" fill="none" stroke="var(--plot-2)" stroke-width="1.5"/>',
  '<text x="105" y="136" text-anchor="middle" font-size="12" fill="currentColor">4</text>',
  '<text x="8" y="72" text-anchor="middle" font-size="12" fill="currentColor">3</text>',
  '<text x="118" y="64" font-size="12" fill="var(--plot-1)">5</text>',
  '</svg>',
].join('\n');

export const PLOT_PARABOLA = [
  'titulo: Parábola de exemplo',
  'x: -1..5',
  'y: -2..8',
  'eixo-x: x',
  'eixo-y: f(x)',
  'funcao: x^2 - 4x + 3 | rotulo=f(x)',
  'ponto: 1, 0 | rotulo=raiz',
  'ponto: 3, 0',
  'linha: x=2 | rotulo=eixo',
].join('\n');

export const PLOT_WAVES = [
  'titulo: Duas ondas inventadas',
  'x: 0..6.28',
  'y: -1.5..1.5',
  'funcao: sin(x) | rotulo=seno',
  'funcao: 0.5cos(2x) | rotulo=cosseno menor | tracejado',
  'linha: y=0',
].join('\n');

export const PLOT_BROKEN = 'x: de zero a dez\nfuncao: x^2';

/* Lista de exercícios com dois plot e um SVG (o "pronto quando" da #60) e, no
   fim, uma cerca com erro para ver o aviso no PDF. */
export const EXAMPLE_LIST = [
  '# Lista de exemplo: figuras',
  '',
  '1. Esboce $f(x)=x^2-4x+3$ e marque as raízes.',
  '',
  '   ```plot',
  ...PLOT_PARABOLA.split('\n').map((line) => `   ${line}`),
  '   ```',
  '',
  '2. Dois sinais periódicos, comparados na mesma escala.',
  '',
  '   ```plot',
  ...PLOT_WAVES.split('\n').map((line) => `   ${line}`),
  '   ```',
  '',
  '3. Na figura, qual é a hipotenusa?',
  '',
  ...TRIANGLE_SVG.split('\n').map((line) => `   ${line}`),
  '',
  '## Gabarito',
  '',
  '1. As raízes são $x=1$ e $x=3$.',
  '2. As curvas se cruzam em dois pontos.',
  '3. A hipotenusa mede $5$.',
].join('\n');

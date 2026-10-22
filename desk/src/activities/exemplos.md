# Exemplos de atividade para o tutor

Guia curto para usar `mesa_criar_atividade` / `mcp__mesa__criar_atividade`.
O contrato completo está na descrição da ferramenta; aqui ficam padrões de uso.

## Contrato, em uma tela

- `{title, objective, alternativeMarkdown, html, css, js, katex?, activityId?}` —
  tudo offline, nada de CDN, `fetch`, `eval`, worker ou arquivo.
- `window.mesa.state(obj)` guarda o estado; `mesa.attempt(obj)` registra a
  tentativa; `mesa.height(px)` avisa a altura; `mesa.onMessage(fn)` recebe
  `{type,payload,state,attempt}` — `init`, `theme` e `stop` vêm do host;
  `state`/`attempt` você envia. O html é sanitizado (sem
  `iframe`/`object`/`embed`/`srcdoc`) e scripts dentro do html não executam:
  mantenha o código no campo `js`.
- `activityId` (opcional): repetir a chamada com o id de uma atividade desta
  conversa publica uma revisão imutável (versão nova); sem ele, é uma
  atividade nova. Estado e tentativa pertencem à versão.
- Registre `onMessage` antes de `mesa.ready()`. Em `init`, restaure os controles
  de `message.state` e recalcule a visualização. `mesa.getState()` e
  `mesa.getAttempt()` consultam os valores locais; `mesa.state()` sem argumento
  não é getter.
- Use controles com rótulos e acessíveis por teclado. As cores do wrapper estão
  em `--mesa-bg`, `--mesa-fg`, `--mesa-muted`, `--mesa-border` e `--mesa-accent`.
- Largura fluida (`100%`); **não use `100vh`**. O quadro mede o próprio conteúdo e o host
  ajusta a altura entre 48 e 720 px (sem vão reservado).
- `katex: true` habilita `window.katex` (`katex.render(tex, el)`); o CSS/fonte
  vem do pacote local, sem rede.
- `alternativeMarkdown` é obrigatória e sempre visível no card: descreva o
  objetivo, as unidades, o que observar e como conferir.

## Padrões

- **MRUV** (previsão → observação → explicação): sliders de `a` e `v₀`, uma
  previsão de `s(3)` antes de revelar, gráfico `s×t` ligado à equação e
  conferência numérica com tolerância. Fixture executável em
  `tests/fixtures/activity/specs.mjs` (`MRUV_SPEC`).
- **Função com parâmetro** (`CALC_SPEC`): slider `c` em `f(x)=x²+c`, campo de
  resposta e feedback local; a explicação vem depois da tentativa.
- **Fora de catálogo** (`FREE_SPEC`): amostragem de dois dados somando 7,
  comparando frequência simulada com `6/36`. Mostra que o runtime aceita DOM,
  SVG/canvas, animação e simulação livre — presets são apoio, não limite.
- **Passo a passo**: um único bloco `details`/acordeão por etapa, com
  `mesa.state({passo})` para retomar do ponto.

## Erros comuns

- Altura fixa com `height:100vh` (ciclo de medição) ou `overflow:hidden` que
  esconde conteúdo da medição.
- Deixar o artefato tentar rede: a CSP bloqueia e o aluno vê erro; não há
  exceção para bibliotecas remotas.
- Esquecer `mesa.ready()`/`mesa.state` inicial: o card mostra a alternativa,
  mas o estado não volta ao reabrir.
- Usar o card para avaliar pedagogicamente: `mesa.attempt` é verificação local;
  correção e feedback de qualidade são do tutor.

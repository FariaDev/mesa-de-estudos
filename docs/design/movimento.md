# Linguagem de movimento da Mesa (#63)

Movimento discreto: é um app de estudo. Entra rápido, sai mais rápido ainda, e
nada anima o layout. Este arquivo é a fonte da verdade: o portão
`tests/motion-tokens.test.mjs` recusa duração ou curva em `desk/src/*.css`
que não venha daqui.

## Tokens

Ficam em `desk/style.css` (`:root`, bloco "Movimento").

### Durações (3)

| Token | Valor | Para quê |
|---|---|---|
| `--t-fast` | 120ms | resposta: hover, pressão, balão, troca de conteúdo e **toda saída** |
| `--t-base` | 180ms | entrada: menu, popover, aviso, barra, diálogo, mensagem nova |
| `--t-slow` | 320ms | mudança de quantidade: medidor de contexto e microinterações da #61 |

`--t-slower` (500ms) sai: o único uso era a transição de `width` do medidor.
`--t-base` sobe de 150 para 180ms para ficar distinto do `--t-fast` (120ms era
quase igual a 150ms).

### Curvas (2)

| Token | Valor | Para quê |
|---|---|---|
| `--ease-out` | `cubic-bezier(.22,.61,.36,1)` | entrada e saída (o que aparece ou some) |
| `--ease-move` | `cubic-bezier(.4,0,.2,1)` | mudança de lugar (o que já estava na tela e anda, gira ou enche) |

### Ritmo de espera (fora da linguagem de transição)

Os indicadores em laço (pensando, carregando) não são transição; ganham um
token próprio para o portão não ter exceção solta.

| Token | Valor | Usos |
|---|---|---|
| `--t-loop` | 1.2s | pulso, pontinhos "digitando", brilho da página carregando; o giro usa `calc(var(--t-loop) * 2 / 3)` e as piscadas do trio ∫ Σ ∇ `calc(var(--t-loop) * 4)`, cada um com o seu atraso |

Laços usam `--ease-move`; o giro do spinner usa a palavra `linear` (velocidade
constante não é curva, e é o único `linear` permitido).

### Deslocamentos

Só `opacity` e `transform`. O ponto de partida de cada entrada é uma variável,
e a saída volta para o mesmo ponto:

| Token | Valor | Para quê |
|---|---|---|
| `--from-drop` | `translateY(-3px) scale(.995)` | o que abre para baixo (menus da barra, popovers do tutor, paleta ⌘K) |
| `--from-rise` | `translateY(4px)` | o que abre para cima ou chega de baixo (seletor de modelo, avisos, barras, mensagem nova) |
| `--from-zoom` | `scale(.985)` | diálogo modal |

### Reduzir movimento (um lugar só)

`@media (prefers-reduced-motion:reduce)` no módulo de movimento, para o app
inteiro, só redefinindo tokens: os três `--from-*` viram `none` (nada se
desloca), `--t-base` cai para `--t-fast` (entrada e saída viram um fade curto)
e `--t-slow` e `--t-loop` viram `0s` (medidor, microinterações e laços pulam
para o estado final).
Os blocos `prefers-reduced-motion` espalhados (tutor-chat, slash-menu,
mesa-qol, icon-motion, activity) saem. A janela de atividade
(`activity-page-script.cjs`) é outro documento e mantém o dela.

## Mecânica (um módulo só)

`desk/src/motion-density.css` virou `desk/src/motion.css` (só movimento) e
`desk/src/density.css` (só densidade). Em `motion.css`:

- **Keyframes únicos**: `mesa-in` (de `var(--motion-from)` e opacidade 0) e
  `mesa-fade` (só opacidade). `mesa-in-up` some: vira `mesa-in` com
  `--motion-from:var(--from-rise)`.
- **Entra/sai por `[hidden]`** (o caso comum, sem JS): `transition` de
  `opacity`, `transform` e `display … allow-discrete`, com `@starting-style`
  na entrada. Ao ganhar `[hidden]`, o elemento volta para `--motion-from` em
  `--t-fast` e só então some; `pointer-events:none` durante a saída.
- **Sai por `.closing`** (o que o JS remove do DOM: aviso, fila, menus da
  barra, busca do PDF): uma regra só, `.closing{opacity:0;transform:var(--motion-from);…}`.
  A regra repetida em `notices.css` sai.
- **Diálogo**: abre de `--from-zoom` em `--t-base` e agora também fecha (volta
  para `--from-zoom` em `--t-fast`, com `display`/`overlay` discretos).

## Inventário

"Hoje" é o estado antes da #63. **Nenhum** quer dizer decidido não animar.

### Abrir e fechar

| Mudança | Hoje | Decidido |
|---|---|---|
| Menus da barra superior e do leitor (`.nav-pop`) | entra `mesa-in` 150ms; sai `.closing` | entra drop/base; sai `.closing` fast (sem mudança de forma) |
| Seletor de modelo (`#model-pop`) | seco | entra rise/base; sai fast |
| Popovers do tutor (`#new-session-pop`, `#chat-more-pop`, `#conversations-pop`, `#free-more-pop`, `#sidechat-more-pop`) | seco | entra drop/base; sai fast |
| "Vai junto" (`#context-pop`) e foto do celular (`.phone-pop`) | seco | entra rise/base; sai fast |
| Menu de barra (`.slash-pop`) | entra `mesa-in` 120ms; sai seco (removido) | entra rise/base; saída **nenhuma**: some ao digitar, e esperar atrapalharia o teclado |
| Paleta ⌘K (`.palette-backdrop` + `.palette`) | seco (o `transition:none` do reduce não tinha transição para zerar) | véu em fade/base, caixa drop/base; sai fast |
| Diálogos (`dialog`) | entra zoom 150ms; sai seco | entra zoom/base; sai fast |
| Busca no PDF (`.pdf-find`) | entra `mesa-in`; sai `.closing` | entra drop/base; sai `.closing` fast |
| Barra do GeoGebra (`#ggb-bar`) | entra `mesa-in-up`; sai seco | entra rise/base; sai fast |
| Barras do estudo livre e do caderno (`#free-bar`, `#review-bar`) | seco | **nenhum**: trocam junto com a área, e animar só a barra descolaria dela |
| Balão de dica (`.tip`, `#ctx-tip`) e botão de citar (`#quote-btn`) | entra fade 120ms; sai seco | entra fade/fast; sai fade/fast por `[hidden]` |
| Ações da mensagem e do quadro (hover: `.sidechat-msg-actions`, `.activity-tools`, cópia) | opacidade 120ms | igual (fade/fast) |

### Chegar e sair

| Mudança | Hoje | Decidido |
|---|---|---|
| Aviso (`#toast .toast-item`) | entra `mesa-in-up`; sai `.closing` | entra rise/base; sai `.closing` fast |
| Fila de mensagens (`.queue-strip`) | entra `mesa-in-up`; sai `.closing` | idem |
| Desfazer exclusão (`#undo-notice`) | entra `mesa-in-up`; sai seco | entra rise/base; sai fast por `[hidden]` |
| Aviso de atualização (`#update-notice`) | seco | entra rise/base; sai fast |
| Mensagem nova no tutor e no chat lateral (`.message`, `.sidechat-msg`) | seco | entra rise/base, uma vez ao ser criada; o corpo que chega aos pedaços (stream) **não** anima |
| Passos de ferramenta (`.work-steps`) | seco | **nenhum**: chegam em rajada durante a resposta |
| Anexo e menção no compositor (`.attachment`, `.mention-chips`) | seco | entra fade/fast; sai seco (removidos do DOM, e o clique é o retorno) |
| Estado do tutor (`.tutor-state`) | seco | entra fade/base |

### Recolher, trocar e mudar de lugar

| Mudança | Hoje | Decidido |
|---|---|---|
| Recolher/abrir o tutor (`body.chat-collapsed`) | salto de grade | grade **sem** animação (animar coluna força layout); o `#chat` reaparece com fade/fast, e o botão de restaurar entra fade/fast |
| Recolher/abrir o apoio (`#support-slot.collapsed`) e minimizar PDF | salto | idem: layout seco, conteúdo volta com fade/fast |
| Recolher/abrir a calculadora (`#calculator.collapsed`) | salto | idem |
| Abrir/fechar o chat lateral (`#sidechat`) | seco | layout seco; conteúdo fade/fast |
| Trocar aba do apoio (PDF ↔ chat lateral) | seco | o painel que volta entra fade/fast; as abas em si só mudam cor (fast, já existe) |
| Trocar de matéria (PDF novo no mesmo leitor) | seco | **nenhum**: as páginas são canvas redesenhados também no zoom, e um fade nelas piscaria a cada zoom; o brilho de "carregando" já cobre a espera |
| Abrir o caderno de revisão (`#review-view`) | seco | fade/fast |
| Medidor de contexto (`#ctx-meter .bar i`) | `width` 500ms | `transform:scaleX(var(--meter))` move/slow; o núcleo passa a emitir `--meter:42%` no lugar de `width:42%` |
| Chevron do passo (`.work-chevron`) | `transform` 150ms `ease` solto | gira em move/base (180ms; slow seria lento para um giro de 16px) |
| Hover/pressão de botão, foco de campo (calculadora, compositor, leitor) | cor/borda/sombra 120–150ms | cor/borda/sombra fast `--ease-out` (base vira fast: hover não espera) |
| Seleção, foco visível | seco | **nenhum** |

### Microinterações e laços (#61)

| Mudança | Hoje | Decidido |
|---|---|---|
| Copiado (`.motion-copied`) | traço .38s | slow (320ms) `--ease-out` |
| Guardado (`.motion-saved`) | enche .5s `cubic-bezier(.3,.7,.4,1)` | slow `--ease-move` (encher é mudança de quantidade) |
| Conferir (`.motion-shot`) | obturador .5s (o ícone apagava) | **flash**: o fundo do botão acende no acento e volta ao dele, slow `--ease-out` (retorno de um amigo do autor) |
| Trio ∫ Σ ∇ (`src/trio.css`, #64; antes a Folhinha "pensando", `.folhinha-palpebra`) | piscada 3.6s | piscada `calc(var(--t-loop) * 4)`, laços em `--t-loop` e uma vez em `--t-slow`; tudo para com reduzir |
| Pontinhos "digitando" (`.ts-dots`) | 1.1s `ease-in-out`, atrasos .15/.3s | `--t-loop` `--ease-move`, atrasos `calc(var(--t-loop) / 8)` e `/ 4` |
| Pulso (`.pulse`, `#status-dot.connecting`) | 1.2s `ease-in-out` | `--t-loop` `--ease-move` |
| Spinner (`.step-spin`) | .8s `linear` | `calc(var(--t-loop) * 2 / 3)` `linear` |
| Página do PDF carregando (`.pdf-page::after`) | brilho 1.2s `ease-in-out` | `--t-loop` `--ease-move` |
| Tempo do chip "Copiado" (`MARK_MS`, JS) | 1200ms | igual (é permanência do rótulo, não movimento) |

## Regras para animações que ainda não entraram

Retorno de um amigo do autor (2026-10-21), para quando estas animações dos
protótipos da #61 ([animados-r2.html](identidade/animados-r2.html),
[folhinha-r7.html](identidade/folhinha-r7.html)) entrarem no app:

- **Lápis do trio** (era o lápis da Folhinha, que saiu na #64): o lápis não mexe no
  eixo y; só gira, com a ponta como pivô (`transform-origin` na ponta).
- **Faísca A1b, "Cintilar"**: sem a transição de fundo cinza.
- **Faísca A1a, brilho no contorno**: velocidade constante, sempre em
  movimento: `linear`, sem curva por trecho nem pausa no recomeço do laço (hoje
  parece parar em cada canto e no fim). É laço, então usa `--t-loop` e a
  palavra `linear`, que o portão aceita em animação infinita.

## Portão

`desk/tests/motion-tokens.test.mjs` lê `desk/src/*.css` e `desk/style.css`
(fora o bloco de tokens) e falha com:

- tempo literal (`120ms`, `.5s`) em `transition*`/`animation*`, apontando o token
  mais próximo (`use var(--t-fast)`);
- curva literal (`ease`, `ease-in`, `ease-out`, `ease-in-out`, `cubic-bezier(…)`,
  `steps(…)`, `linear(…)`) e `linear` fora de `animation` infinita, apontando
  `--ease-out` ou `--ease-move`;
- `transition` de `width`, `height`, `top`, `left`, `right`, `bottom`, `margin*`
  ou `padding*`.

- `transition`/`animation` com duração e sem curva (o navegador cairia no
  `ease` padrão), fora dos itens `allow-discrete`.

Conferido que morde: acusa 26 pontos no CSS de antes da #63 e pega mutação
nova (ver `docs/reviews/issue-63-resultado.md`).

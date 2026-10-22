# #52: sobreposições, figura em tela cheia, linha de aviso e toast

Resultado da issue #52. Quatro defeitos visuais vistos no uso. Os commits ficam
locais, na branch da worktree. Não houve push, PR nem comentário na issue.

## O que mudou

1. **Applet por baixo.** A view nativa do GeoGebra fica acima do DOM e tampava a
   tela cheia da visualização. Agora uma regra só esconde a view durante
   qualquer sobreposição de página inteira (`dialog[open]`, a paleta de
   comandos, a tela cheia do quadro). A decisão é do núcleo
   (`core/overlay.bend` → `viewState`: aba inativa = fora, ativa sem
   sobreposição = aparece, com qualquer uma = coberta). "Coberta" usa
   `setVisible(false)` e **não** fecha: a aba segue ativa, com o mesmo
   retângulo, o mesmo documento e a mesma construção, e a ponte do tutor
   continua valendo. O seletor é um só (`OVERLAY_SELECTOR`, `desk/src/ggb.mjs`);
   sobreposição nova entra nele, não num caso por tela.
2. **Figura pequena e no topo.** Um quadro cujo documento é só uma figura (SVG
   ou imagem, com ou sem legenda) cresce até caber na tela cheia, mantém a
   proporção, fica centralizado e com a legenda inteira embaixo. O host posta o
   `displayMode` (`fullscreen`/`inline`) ao quadro; o runtime marca a figura e
   o CSS (`:where()`, especificidade zero, então o autor da atividade sempre
   vence) faz o resto. SVG só com `width`/`height` ganha `viewBox`. O lightbox de
   imagem usa a mesma ideia (`.image-frame` com `--ar` da proporção natural).
3. **Ponto do ⚙ sem destino.** O ⚙ abre o menu (Configurações, Ajuda, Atalhos,
   Sobre), mas a linha de aviso só morava no Sobre. Agora as Configurações
   mostram a mesma linha no topo, com "Ver no Sobre" (abre o Sobre por cima, sem
   descartar o que a pessoa editou). "Some ao abrir" vale quando a linha fica
   visível, nas duas superfícies (`Surface`, `seesLine`, `noticeLinesFor` em
   `core/updatenotice.bend`).
4. **Toast.** Vai para o canto inferior direito, acima da caixa do tutor e
   alinhado à coluna (CSS anchor `--composer`, com fallback). Com o tutor
   recolhido, vai para o canto da janela. Continua popover acima de diálogo (#42).

## Decisões

- **Esconder, não fechar.** Fechar o applet descarregaria a construção; esconder
  a view devolve tudo no mesmo lugar. A prova por pixel confere que o documento
  é o mesmo (o marcador injetado segue lá depois de fechar).
- **Contagem de sobreposições, não "qual".** O host entrega o número ao núcleo; a
  regra vale para duas sobreposições ao mesmo tempo (a view só volta quando a
  última fecha).
- **Figura é reconhecida pela estrutura**, não por marca do autor: um filho só
  (ou `figure`) com `svg`/`img` e uma legenda opcional. Documento com controles,
  texto ou gráfico segue o próprio layout.
- **O aviso nas Configurações é a mesma linha**, não um link: o "Atualizar" mora
  na linha do componente, no Sobre, então a linha leva até lá com "Ver no Sobre".
- **Defaults de `desk/config.cjs` intactos.** Nenhum PDF nem material de curso
  foi tocado.

## Testes

Novos (todos rodados e verdes):

- `tests/activity-ggb-overlay-ui.mjs` — prova **por pixel** (`screencapture -l`
  da janela, que inclui a view nativa; `tests/window-pixels.mjs`): um marcador
  magenta no documento do applet some sob a tela cheia da visualização, a imagem
  ampliada e as Configurações, e volta no mesmo lugar e no mesmo documento ao
  fechar; com duas sobreposições só volta na última. Só macOS (pula nos outros).
  Desfazendo a correção no host (`setVisible(true)`), ele falha.
- `tests/activity-figure-ui.mjs` — SVG e imagem em tela cheia, 1440×900 e
  900×650, nos dois temas: cresce além do tamanho natural, proporção mantida
  (±0,03), centralizada na janela, fora do topo, legenda abaixo e inteira, sem
  rolagem.
- `tests/tool-updates-ui.mjs`, cenário `tool-updates-configuracoes` — o ponto
  acende, o menu abre as Configurações, a linha (mesmos textos do Sobre + "Ver no
  Sobre") aparece no topo nos dois temas e tamanhos, o ponto some, "Ver no Sobre"
  abre o Sobre com o "Atualizar".
- `tests/toast-position-ui.mjs` — toast acima da caixa do tutor e alinhado à
  borda dela, com e sem tutor recolhido, ao reabrir, e acima de diálogo (por
  pixel, com o diálogo esticado sobre o aviso).
- Unitários: `overlay-view.test.mjs`, `updatenotice-surfaces.test.mjs` e um caso
  em `activity-runtime.test.mjs`.
- Leis do núcleo: 6 (`ovl_*`) em `core/laws/overlay.bend` e 10 novas em
  `core/laws/updatenotice.bend`.

## Portões rodados

| Portão | Resultado |
| --- | --- |
| `npm run verify:bend` | verde, 64 artefatos reproduzíveis |
| `MESA_GATE_CACHE=0 npm test` | 1392 passam, 0 falham |
| `npm run ui -- activity,calc,tool-updates,settings,toast,ggb,ui-smoke,about,dialog,responsive,topbar,first-run` | 22 arquivos de janela; 21 verdes na primeira rodada. O `tool-updates-ui` falhou duas asserções do **meu** cenário novo (respiro do topo e esperar as linhas do Sobre); corrigi e ele passou rodado sozinho |

Não rodei a bateria completa de janelas nem `npm run hunts`: ficam para o
`main`, pelo orquestrador. Depois do ajuste final no `tool-updates-ui` só o
arquivo dele foi rodado de novo.

## Capturas (fora do repositório)

`~/Developer/learning-canvas-capturas/issue-52/antes/` e `.../depois/`, as
mesmas nove cenas nas duas pastas: `ggb-aberto`, `ggb-aberto-tela-cheia`,
`ggb-aberto-imagem`, `figura-na-conversa`, `figura-tela-cheia-sem-ggb`,
`toast-chat-aberto`, `toast-chat-recolhido`, `engrenagem-ponto` e
`configuracoes-sem-aviso` (no "depois", as Configurações já trazem a linha).
Capturas de janela do macOS, com a view nativa.

## Fora do escopo

- A bateria completa e os hunts (acima).
- Windows/Linux: a prova por pixel do applet é só macOS; o resto da regra é
  independente de plataforma.

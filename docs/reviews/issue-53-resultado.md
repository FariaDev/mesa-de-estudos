# #53: menções `@`, GeoGebra sob demanda e quadro limpo por uso

Resultado da issue #53. Os commits ficam locais, na branch da worktree. Não houve
push, PR nem comentário na issue. Defaults de `desk/config.cjs`, PDFs e materiais
de curso ficaram intactos; não rodei `setup`, `update` nem `install-app`, e nenhum
teste usou inferência real.

## O que mudou

1. **Menções `@` na caixa do tutor.** Digitar `@` abre a lista curta do que o
   motor atual oferece (ícone, nome e uma linha), com ↑↓ (volta ao fim/começo),
   ⏎/Tab para escolher e Esc para fechar. O que se digita depois do `@` filtra
   pelo nome na língua da tela. A escolhida vira um **chip** acima do campo (até
   três; o quarto é recusado com um aviso), com × para tirar. Na mensagem, o tutor
   recebe `[Ferramenta pedida na Mesa: ids]` e uma linha de instrução ("use a
   ferramenta X nesta resposta"), logo depois do texto do aluno e antes do contexto,
   **no idioma do tutor** (o da tela, se o tutor segue a tela). A bolha do aluno e
   a prévia da lista de sessões cortam o bloco. A fila em disco guarda as menções
   (`mentions`, só quando há) e o reenvio as leva.
   - Catálogo, quem aparece (o `geogebra` só onde o motor tem), teto de chips,
     views do menu e dos chips, e as chaves de texto são de **uma fonte só**
     (`core/toolmentions.bend`), igual para Pi e Claude.
   - Textos nos catálogos pt-BR e en (24 chaves cada, `mention.*` e `ggb.board.*`).
2. **GeoGebra sob demanda.** Com a aba fechada, a ferramenta `geogebra` faz a Mesa
   abrir o applet (evento `ggb-open` → `selectTab('geogebra')`) e esperar view
   visível, documento carregado, restauração da matéria e applet pronto, com prazo
   de 25 s. Falha vira uma frase ("a aba GeoGebra não abriu a tempo" / "o applet
   GeoGebra não ficou pronto a tempo (ele precisa de internet)"). Os pedidos rodam
   um por vez. A frase "avise o usuário para abrir a aba" saiu do prompt; no lugar,
   o prompt de oferta lista o GeoGebra como ferramenta à mão.
3. **Quadro limpo por uso** (modelo abaixo; `core/ggbboard.bend`, leis e provas).
   "Voltar à construção anterior" é um botão discreto na barra da aba GeoGebra
   (`#ggb-back`), com uma nota de 12 s que diz o que aconteceu.
4. **GeoGebra no Claude.** A mesma ferramenta, pelo servidor MCP `mesa`
   (`mcp__mesa__geogebra`), com o mesmo guide e o mesmo esquema do Pi
   (`src/extensions/mesa-geogebra/guide.mjs`, usado pelos dois). `claudeCaps`
   passou a ter `geogebra: True`. A ponte HTTP do Pi e o MCP do Claude usam o
   **mesmo** `service` do host.
5. **Extensão do Pi.** O `geogebra.ts` solto (raiz `geogebra/` e o template do
   vault) virou a extensão empacotada `mesa-geogebra`, que só registra a
   ferramenta quando a Mesa entrega a ponte (`LEARNING_DESK_GGB_BRIDGE`), como as
   outras ferramentas da Mesa. `profiles.cjs` e o `EXPECTED_ACTIVE` passaram a
   esperar `mesa_geogebra`; `node tests/native-tool-parity.mjs` confere que
   `mesa_X` (Pi) e `X` (Claude) têm a mesma descrição e o mesmo esquema.

## O modelo do quadro limpo (proposta)

Decidi o modelo sem perguntar ao usuário: a issue pede explicitamente que o
relatório o **proponha**, ele não muda dado do aluno (nada é apagado: tudo o que
sai do quadro fica guardado e volta pelo botão) e dá para trocar a regra mexendo
em uma lei do núcleo. A alternativa descartada está abaixo.

- **Quando limpar.** Só no **primeiro comando que muda o quadro (`run`) de cada
  pedido novo do aluno** (cada mensagem enviada conta como pedido novo). Dentro
  da mesma resposta o tutor continua o desenho. **Ler** (`state`, `screenshot`)
  nunca limpa. Passar `continuar: true` num `run` mantém o que há mesmo sendo o
  primeiro da resposta (o aluno pediu "acrescente isto"). Quadro já vazio não
  guarda nada.
- **O que guardar.** O que está no quadro naquele instante, com a origem:
  **tutor** se ele já desenhou ali e nada mudou desde o último comando dele
  (comparação da lista de objetos), **aluno** em qualquer outro caso (inclusive
  quando o aluno mexeu depois do tutor). Até **3** construções por matéria
  (`runtime/ggb/<chave>.kept.json`; a aba Livre usa `free-<sessão>`); a mais antiga
  sai. Arquivo ausente ou estragado vale como "nada guardado".
- **Como desfazer.** "Voltar à construção anterior" restaura a mais recente. Se o
  quadro não está vazio, o que estava nele **toma o lugar** da restaurada (voltar
  se desfaz); com o quadro vazio, só tira do histórico. Sem nada guardado, o botão
  fica escondido.
- **Ordem na restauração da matéria.** O snapshot da matéria é aplicado **antes**
  de o quadro decidir, para a construção do aluno não reaparecer depois da limpeza.

**Alternativa descartada: "limpar a cada comando".** Simples, mas quebra o
desenho em etapas do próprio tutor (cada comando apagaria o anterior). Também
descartei "nunca limpar, só oferecer Limpar": é o comportamento de hoje e é o que
a issue quer mudar (cada uso herda o desenho do anterior).

## Um defeito achado no caminho

O host restaurava o snapshot da matéria "uma vez por documento", mas só marcava
como feito quando havia snapshot. Numa matéria sem snapshot, o primeiro uso do
tutor gravava um snapshot e o uso seguinte o **restaurava por cima do que o aluno
tinha desenhado no meio**. Agora o documento sem snapshot também conta como
restaurado. Regressão: `tests/geogebra-host.test.mjs` ("sem snapshot na abertura…"),
que falha sem a correção.

## Portões rodados

Todos em `desk/`, na worktree, só os rápidos (a bateria completa fica para o `main`).

| Portão | Resultado |
| --- | --- |
| `npm run verify:bend` | verde: 66 artefatos reproduzíveis, provas verdes |
| `MESA_GATE_CACHE=0 npm test` | verde: 1426 testes (numa das execuções, antes de eu endurecer a espera do teste novo de snapshot, 1 teste falhou e não reproduziu depois; a espera agora é por condição) |
| `npm run ui -- composer,calc,tutor` | verde: 9 janelas |
| `node tests/native-tool-parity.mjs` | verde (4 ferramentas iguais no Pi e no Claude) |
| `npm run ui -- activity-ggb,language,topbar,qol-actions,toast-position,ui-smoke,menu-conferir,send-offline,improvements,free-study,settings-busy,settled,slash,attach,queue` | verde: 14 janelas |

Testes novos: `tests/ggb-board.test.mjs` (12), `tests/geogebra-host.test.mjs` (11),
`tests/claude-geogebra-tool.test.mjs` (5), `tests/mentions-host.test.mjs` (5),
`tests/composer-mentions-ui.mjs` e `tests/tutor-geogebra-ondemand-ui.mjs` (janela).
Fakes com nome: `fake-ggb-applet.cjs`, `fake-ggb-electron.cjs`, `fake-ggb.html`
(applet sem internet, trocado pelo seam `LEARNING_DESK_GGB_PAGE`, que só vale com
`DESK_TEST=1`) e `mesa-geogebra-pi.mjs` (usa o cliente real da ponte). Esperas por
condição, via `tests/waits.mjs`.

Critério de pronto da issue:

- **`@` lista as ferramentas e insere o chip**, na janela, nos dois temas, em 1440×900
  e 900×650 (`composer-mentions-ui`): ordem, ícone/nome/descrição, ↑↓ com wrap, Esc,
  filtro, ⏎, teto de três, ×, menu dentro da janela e acima da caixa, chip dentro da
  caixa, e a instrução chegando ao Pi sem aparecer na bolha.
- **Com o GeoGebra fechado**, um pedido ao `geogebra` (Pi de mentira) abre o applet e
  roda o comando (`tutor-geogebra-ondemand-ui`).
- **O segundo uso começa vazio** e **Voltar restaura** (e troca), na mesma janela.
- Ajustes em testes existentes: `composer-box-ui` ganhou o `#mention-chips` na ordem
  dos filhos da caixa; `ui-smoke` agora confere o anexo do Print pelo alt `geogebra`
  (antes o ramo só rodava se o applet *não* tivesse terminado de carregar, porque a
  ponte respondia na hora; agora ela espera o applet e o ramo roda, com o anexo de
  um passo anterior ainda na caixa).

## Decisões e limites

- **Menu `@` reaproveita o `.slash-pop`** (mesmas classes do menu `/`); só o que é
  próprio ganhou `mention-*` (chips e ícone).
- **Idioma da instrução:** o do tutor se estiver fixado; senão o da tela. O texto
  das instruções vive nos catálogos (#41), não no código.
- **`updater.cjs`** ainda lista `geogebra` em `CODE_ROOT_DIRS`; deixei como está
  (diretório inexistente não quebra nada). Um `geogebra.ts` antigo, já copiado para
  o vault do usuário, só duplicaria a ferramenta se `pinnedExtensions` estiver
  `false`; com o padrão (extensões fixadas) o overlay não o carrega.
- **Capturas:** ficam fora do repo (`MESA_REVIEW_SHOTS=<pasta>`); a captura da
  página não inclui a view nativa do applet (aparece cinza), então o que se vê é a
  barra, a nota, o botão e o chat.
- **Não coberto:** applet real da web (precisa de internet; a prova usa o applet
  falso), motor Claude com inferência real (sem `claude auth`; a paridade é de
  descrição e esquema, e o fluxo do `service` é coberto por `claude-geogebra-tool.test`)
  e a bateria completa da suíte, que roda depois no `main`.

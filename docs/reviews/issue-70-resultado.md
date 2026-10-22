# #70 — Correções do teste manual da v1.0.0

Dez itens do teste manual e um extra pedido no meio da sessão (o OpenCode não lia os PDFs). Commits locais na branch `issue-70-teste-manual`, sem push e sem PR. As capturas usam runtime e PDFs sintéticos; nenhuma tem material de curso.

## Itens

| # | Item | O que estava errado | Correção | Teste de regressão | Commit |
|---|---|---|---|---|---|
| 1 | Citar LaTeX do PDF (B3.10) | A camada de texto do pdf.js põe cada índice, colchete e traço de fração numa caixa própria e fora da ordem de leitura: `lim f(x)→0 sen[f(x)]/f(x) = 1` chegava ao rascunho como "f ( x ) ] = 1 … → 0". Não há texto bom para extrair. | Quando a seleção parece fórmula (glifo matemático ou maioria de retalhos de até 2 caracteres), o Citar anexa o recorte da página como imagem (do canvas já desenhado) e o rascunho leva só a origem: `> (Formula.pdf, p. 1: fórmula anexada como imagem)`. Texto corrido continua citado como texto, com arquivo e página. | `tests/pdf-quote.test.mjs`; janela: `tests/pdf-quote-ui.mjs` | `46dc434` |
| 2 | Atividade interativa no OpenCode (B3.9) | O OpenCode 2.0.32 expõe as ferramentas MCP em Code Mode por padrão (`codemode` vale `true`): o modelo chamava `execute`, o id do slot não batia e o cartão nunca nascia. | A config do MCP `mesa` vai com `codemode: false`; a ferramenta chega como `mesa_<nome>` com o id da chamada. O `fake-opencode` imita os dois modos e chama o MCP de verdade por stdio. | `tests/opencode-tutor-wiring.test.mjs`; janela: `tests/opencode-activity-ui.mjs` (novo) | `125d5e6` |
| 3 | Sobre com a logo antiga | `index.html` tinha um `<span class="about-mark">M</span>`. | A marca do Sobre é a G1 (`assets/app-icon/mesa-<acento>.svg`) e segue o acento pelo mesmo `applyAccent` do cabeçalho. | `tests/about-ui.mjs` (acento violeta, confere o `src`) | `108c897` |
| 4 | "Pensando" piscando (B3.1) | O diário era refeito do zero a cada token: a ∫ do "pensando" reiniciava a animação e o painel aberto do raciocínio piscava. | `patchTree` (`view-host.mjs`) leva a árvore nova para os nós vivos: texto e atributos mudam no lugar e só o que mudou de tag, de `data-key` ou de eventos é trocado. O ícone do slot fica enquanto o nome não muda. | `tests/view-host-patch.test.mjs` (5); `tests/hunt-chat.mjs` (cenário thinking-open confere os mesmos nós entre tokens) | `1e4782a`, `385ecc1` |
| 5 | Balão longe do trio (A1) | A caixa dos personagens tinha 260 px de altura (a do personagem sozinho); no trio, com 104 px, o balão ficava lá em cima. A ponta apontava sempre para o meio. | No trio a caixa tem a altura dos três. A ponta segue quem fala (`tailX`, medida depois do layout e no resize). Na janela estreita o balão fica ao lado e a ponta, na caixa do trio, aponta para a direita. | `tests/setup-cast.test.mjs`; janela: `tests/first-run-ui.mjs` mede a distância (≤ 24 px) e a ponta em 1440×900 e 900×650 | `c4ee82c`, `385ecc1` |
| 6 | PDFs em subpastas (A6) | O passo PDFs só via a raiz; a biblioteca da matéria (`courseLibrary`) varre subpastas. Pasta com tudo em subpastas dava zero. | O setup lista pela própria `courseLibrary`: conta o que a biblioteca vai mostrar. | `tests/first-run-drop.test.mjs`; janela: `first-run-ui` | `478a4b2` |
| 7 | Estatísticas vazias com "Pausado" (B7.2) | Ver "Decisão" abaixo. | O cronômetro liga sozinho com a janela à vista numa matéria; a pausa do aluno segura e o vazio explica. | `tests/study-services.test.mjs` (3), `tests/study-stats-text.test.mjs`, `tests/study-stats.test.mjs` | `905dfdf` |
| 8 | Ícone do @visualizar (B3.7) | Usava o ícone genérico de formas. | Ícone `board` (quadro de apresentação, do Lucide) no catálogo do núcleo `toolmentions`. Lei nova `tmen_icones_do_catalogo` fixa os ícones. | `tests/mentions-host.test.mjs`; lei e prova em `core/` | `634ae16` |
| 9 | Acento no setup (A2) | A cor só se escolhia nas Configurações. | Seletor de acento no passo Boas-vindas, aplicado na hora e guardado. Uma fonte só para as duas telas (`src/accent-picker.mjs`). O trio tem cores próprias e não usa o acento; a marca da barra do setup muda junto. | `tests/accent-picker.test.mjs`; janela: `first-run-ui`, `accent-ui`, `settings-sections-ui` | `c4ee82c` |
| 10 | Tirar pasta escolhida por engano (A5) | Não havia como desfazer a escolha. | "Tirar esta pasta" no passo PDFs volta ao quadro vazio e trava o Continuar. A matéria tem uma pasta só, então é um botão por pasta escolhida. | `tests/setup-flow.test.mjs`; janela: `first-run-ui` | `c4ee82c` |
| extra | O tutor do OpenCode não lia os PDFs | A Mesa passava `arquivo.pdf#page=53`; o `read` do OpenCode não aceita âncora ("File not found") e, sem ela, devolve o PDF inteiro como anexo, que os modelos do OpenCode não aceitam. | Ferramenta `ler_pdf` no MCP `mesa`: pede à Mesa, pela ponte local, o texto de até 3 páginas. O main valida o caminho contra a biblioteca (`validPdf`). No OpenCode a referência vira `arquivo.pdf (p. 53)` e o prompt do motor diz para usar `ler_pdf`. | `tests/pdf-page-text.test.mjs`, `tests/studycontext.test.mjs`, `tests/tutor-prompt-host.test.mjs`, `tests/mesa-mcp.test.mjs` | `032a311` |

## Decisão do item 7

Por que estava pausado: desde a #34 a sessão de estudo só começava pelo botão das Estatísticas, e o padrão era "pausado". Ninguém apertava; o batimento de 15 s só soma com o cronômetro ligado. As perguntas são contadas à parte, por isso eram 112 perguntas e zero minuto. O vazio estava certo para as regras, mas as regras não serviam.

O que mudou: com a janela visível numa matéria configurada, o batimento liga ou continua a sessão. Trocar de matéria fecha a sessão da anterior e abre a da nova. Janela escondida ou minimizada não soma, como antes. Pausar ou parar pelo botão marca `held`, e só isso segura o cronômetro. Com `held` e sem tempo no período, a manchete diz "Nada contado: o cronômetro está pausado".

Confirmado pelo autor em 2026-10-22: o cronômetro liga sozinho com a janela à vista. A contagem só manual da #34 fica para trás.

## Achados dos testes de janela

- `ui-smoke` (worklog) e `hunt-chat` pegaram um bug do `patchTree` do item 4: o cabeçalho do diário só ganha o clique quando o turno acaba, o patch mantinha o nó antigo sem listener e o diário não abria. Agora o nó só fica se os eventos ligados são os mesmos. Teste de regressão em `view-host-patch.test.mjs`. `385ecc1`.
- `language-ui` mediu o balão "cortado" em 900×650 (222 > 212): a ponta nova, presa ao balão, vazava a caixa do texto. Ela passou para a caixa do trio. `385ecc1`.
- `typecheck-list.test.mjs`: os três arquivos novos com `// @ts-check` entraram no `tsconfig.json`. `385ecc1`.

## Antes e depois

Capturas com runtime e PDFs sintéticos, em `issue-70/`. O "antes" é a base `c1817a6` rodada num worktree temporário, o "depois" é esta branch. O item 4 (pensando estável) é movimento e não aparece numa foto: está provado no `hunt-chat` (mesmos nós entre tokens).

| Item | Antes | Depois |
|---|---|---|
| 1 Citar fórmula | [antes](issue-70/antes-citar-formula-1440x900.png): o rascunho leva as linhas soltas | [depois](issue-70/depois-citar-formula-1440x900.png): recorte anexado e só a origem; [o recorte](issue-70/depois-recorte-anexado.png) |
| 3 Sobre | [antes](issue-70/antes-sobre-1440x900.png): "M" | [depois](issue-70/depois-sobre-1440x900.png): G1 do acento |
| 5 Balão | [1440×900](issue-70/antes-boas-vindas-1440x900.png), [900×650](issue-70/antes-boas-vindas-900x650.png): longe do trio | [1440×900](issue-70/depois-boas-vindas-1440x900.png), [900×650](issue-70/depois-boas-vindas-900x650.png): encostado, ponta em quem fala |
| 6 e 10 PDFs | [antes](issue-70/antes-pdfs-subpastas-1440x900.png): pasta com PDFs só em subpastas dá "Nenhum PDF", sem como tirar | [depois](issue-70/depois-pdfs-subpastas-1440x900.png): os dois PDFs e "Tirar esta pasta" |
| 7 Estatísticas | [antes](issue-70/antes-estatisticas-1440x900.png) | [depois](issue-70/depois-estatisticas-1440x900.png): pausado pelo aluno, o vazio diz por quê |
| 8 @visualizar | [antes](issue-70/antes-mencoes-1440x900.png) | [depois](issue-70/depois-mencoes-1440x900.png): ícone de quadro |
| 9 Acento | [antes](issue-70/antes-boas-vindas-1440x900.png): sem escolha | [depois](issue-70/depois-boas-vindas-acento-violeta-1440x900.png): violeta escolhido no setup |

Na captura das Estatísticas o cronômetro não liga sozinho: o batimento só conta com o sistema ativo (ocioso há menos de 120 s), e a captura automática não mexe no mouse. A ligação automática está nos testes de unidade (`study-services.test.mjs`).

## Portões

Rodada final em 2026-10-22, nesta branch:

- `npm run verify:bend`: ok, todas as provas fecham.
- `npm run check`, `npm run lint`, `npm run typecheck`: ok.
- `MESA_GATE_CACHE=0 npm test`: 2040 de 2040.
- `npm run hunts`: 24 de 24.
- `npm run ui`: 80 ok, 2 falhas de ambiente. `activity-ggb-overlay-ui` e `toast-position-ui` param no `screencapture -l` do macOS ("could not create image from window"), antes de qualquer asserção. A base `c1817a6` falha igual nesta máquina. Ficam para rodar de novo com a permissão de gravação de tela em ordem.
- Rodados antes da rodada cheia, isolados: `about-ui`, `pdf-quote-ui`, `opencode-activity-ui`, `first-run-ui`, `accent-ui`, `settings-sections-ui`, `study-stats-screen-ui`, `language-ui`, `ui-smoke`, `hunt-chat`, `sidechat-layout-ui`, `layout-rules-ui`.

`tests/fake-pi.mjs` não mudou. `tests/helpers.mjs` mudou: o `tinyPdf` agora escapa `(`, `)` e `\`, que geravam PDF inválido na fórmula do `pdf-quote-ui`. Os outros usuários com parênteses (`sidechat-layout-ui`, `layout-rules-ui`) passam.

## Fora do escopo

Tema escuro do GeoGebra e os itens da #69, como pedido.

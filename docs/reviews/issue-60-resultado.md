# Issue #60 — Figuras do tutor: SVG, cerca `plot` e "ver o que desenhei"

Branch `claude/heuristic-blackburn-9c2a3a`. Nada foi enviado: sem push, sem PR, issue aberta.
Todos os exemplos usam funções inventadas (parábolas, ondas, um triângulo); nenhuma captura tem material de curso.

## O que foi feito

| Commit | Conteúdo |
| --- | --- |
| `ccc57b8` | Formato da cerca `plot`, analisador de expressões sem `eval`, escalas e desenho SVG determinístico (`desk/src/figures/`). |
| `06c45b1` | `markdown.mjs` e `materials/template.mjs` entendem `plot` e SVG; avisos de figura entram no relatório do PDF; cores `--plot-1..6` e tetos de largura no CSS. |
| `16d2e33` | Testes Electron: SVG malicioso sai limpo no chat e no PDF; `plot` e cerca quebrada no PDF real. |
| `1cafaef` | Host (`figure-preview.cjs`) e página (`figure.html`, `figure-page.mjs`) que desenham a figura e devolvem o print. |
| `8c52150` | Ferramenta `ver_figura` no Pi, no Claude e no OpenCode; rota `/figure` na ponte HTTP. |
| `5d0df6b` | Guias do chat e do PDF: quando usar `plot`, SVG ou GeoGebra; formato da cerca na descrição da ferramenta. |
| `ba5851a` | Lint do host da figura; `figure-markup.mjs` no typecheck. |
| `81cb486` | `mesa_ver_figura` no SDK real do Pi, pela ponte HTTP. |

### 1. SVG inline com a mesma sanitização do chat
`desk/src/figures/svg-guard.mjs` é a única configuração do DOMPurify para SVG (`svgSafeConfig` e `uponSanitizeAttribute`): `href` só aceita `#fragmento`, `url()` só `#fragmento`, e `image`, `use`, `foreignObject`, `script`, `style`, `animate*`, `set`, `handler` e `listener` estão em `SVG_FORBID_TAGS`. O chat (`markdown.mjs`) e o PDF (`materials/template.mjs`) importam o mesmo módulo.
Regressão: `tests/figures-sanitize.test.mjs` roda no Electron real (o DOMPurify precisa de DOM) e mostra o SVG malicioso (`script`, `foreignObject`, `href` externo em `a`/`use`/`image`, `url()` externo em `style`, `fill` e `filter`, `onload`, `onclick`, `animate` apontando para `javascript:`) saindo sem nenhum deles, no chat e no PDF, com o triângulo inocente intacto.

### 2. Cerca `plot`
O tutor descreve função, domínio, eixos e pontos; a Mesa desenha um SVG determinístico, sem rede e sem JS:
- `plot-spec.mjs` lê a cerca; `plot-expr.mjs` analisa a expressão (sem `eval`, só funções de `FUNCTION_NAMES`); `plot-scale.mjs` e `plot-render.mjs` desenham. 240 amostras fixas, números com 2 casas, id do `clipPath` por hash FNV-1a: a mesma entrada dá o mesmo SVG byte a byte.
- Cerca malformada: `plot-error.mjs` produz mensagem com o valor recebido e o formato esperado; a figura vira um `.plot-warning` legível e, no PDF, um diagnóstico `figure` no relatório.
- Testes: `tests/plot-figure.test.mjs` (Node) e os cenários Electron acima.

### 3. Ferramenta "ver o que desenhei"
- Fonte única: `src/extensions/mesa-figure/guide.mjs` (descrição, campos `kind`/`source`/`theme`/`width`, limites, texto do resultado), no mesmo padrão dos outros `guide.mjs`.
- Host: `figure-preview.cjs` abre uma janela escondida, em partição própria na memória, `sandbox`, sessão trancada (só `file:` dentro de `src`, `node_modules`, `locales`, `style.css`, `highlight.mjs`), desenha, captura e destrói. Chamadas em fila. Largura 240–1600 (padrão 560), altura limitada a 4000 px.
- Devolve PNG mais relatório: avisos, número de gráficos e SVGs e os nomes que a sanitização removeu (`<script>`, `@onload`, `@href`).
- Pi: `mesa-figure/index.ts` (`mesa_ver_figura`) pela ponte HTTP, rota `/figure`, mesmo `x-mesa-token` de `/activity` e `/preview`.
- Claude: `agents/figure-tool.cjs`, `mcp__mesa__ver_figura` no MCP do SDK, liberada em `canUseTool` e no `PreToolUse`.
- OpenCode: `ver_figura` em `mesa-mcp/tools.mjs`, pela ponte.
- Aviso útil: o markdown termina o bloco HTML numa linha em branco, então o resultado avisa quando o SVG do tutor tem linha em branco (`blankLineWarning`).

### 4. Guias (#39)
`FIGURE_CHOICE` diz quando usar `plot`, SVG simples ou GeoGebra, o tamanho máximo (8000 caracteres, 6 séries), as cores do tema (`--plot-1..6`, `currentColor`) e a largura (720 px no chat, 420 px no PDF). O chat recebe `CHAT_FIGURE_OFFER` em `desk-prompts.cjs`; o PDF recebe `PDF_FIGURE_GUIDE` no fim da descrição de `criar_pdf`. O formato da cerca mora só na descrição de `ver_figura`; o guia do PDF aponta para ela.

## Portões

| # | Portão | Resultado |
| --- | --- | --- |
| 1 | `MESA_GATE_CACHE=0 npm test` | 1898 passam, 0 falham; depois do rebase em `main` (`6f22757`, sem conflitos), 1913 passam, 0 falham. |
| 2 | `node tests/native-{tutor-pdf,activity-tool,tool-parity}.mjs` | Os três passam. A paridade Pi × Claude cobre `ver_figura` e foi rodada de novo depois do rebase (ok). |
| 3 | Testes que `rg` achou verificando o texto dos guias (`desk-prompts.test.mjs`, `mesa-mcp.test.mjs`, `native-tool-parity.mjs`, `figure-tool.test.mjs`) | Passam. `tests/tutor-language-ipc-smoke.mjs` passa no portão 6. |
| 4 | `tests/fake-pi.mjs` alterado? | Não. Não se aplica. |
| 5 | Arquivo de dados na partida? | Não entrou nenhum (as figuras são carregadas sob demanda). Não se aplica. Obs.: **`npm run bundle-payload` não existe** no `package.json` (só `test:packaged`), então não há o que rodar. |
| 6 | Janela do PDF, do markdown e do texto dos guias, um arquivo por vez (`npm run ui -- <arquivo> --jobs 1`), depois do rebase em `main` | `activity-figure-ui`, `course-pdf-ui`, `material-preview-ui`, `activity-concurrency-ui`, `material-template-ui`, `pdf-models-dialog-ui`, `free-study-ui` e `tutor-pdf-ui`: 8 de 8 ok, 0 falhas. `tests/tutor-language-ipc-smoke.mjs`: ok. Nenhuma falha de captura ("could not create image from window"). |

Provas adicionais, fora dos portões:
- `tests/native-figure-tool.mjs` (novo): o SDK real do Pi carrega a extensão `mesa-figure` e desenha pela ponte HTTP real, sem inferência. Passa.
- Cenário Electron `figure-preview`: o host e a página reais devolvem um PNG válido nos cinco casos (parábola, ondas no tema escuro, triângulo, SVG malicioso, cerca quebrada).
- Cenário `figures-pdf`: o PDF real inclui as figuras e o aviso da cerca quebrada no relatório.
- `figure-tool.test.mjs` (16 testes): validação do pedido, largura, sessão trancada, fila, destruição da janela, texto do resultado.
- `npm run check` (sintaxe de 661 arquivos) e `eslint` dos arquivos novos ok.

## Capturas (`docs/reviews/issue-60/`, sem material de curso)

| Arquivo | O que mostra |
| --- | --- |
| `pagina-1.png`, `pagina-2.png` | PDF real com lista de exemplo: gráficos, SVG e o aviso da cerca quebrada. |
| `ver-figura-plot.png` | O que a ferramenta devolve para uma parábola. |
| `ver-figura-plotDark.png` | Ondas no tema escuro, 480 px. |
| `ver-figura-broken.png` | Cerca malformada virando aviso legível. |
| `ver-figura-malicious.png` | SVG malicioso depois da sanitização: sem script, sem foreignObject, sem imagem externa. |

## Decisões

- **Regra R2 relaxada em `desk-prompts.test.mjs`.** O SVG agora é figura de primeira classe, então a oferta do chat pode citá-lo; o teste "sem frase repetida" continua valendo entre prompts e descrições de ferramentas.
- **Teto da oferta do chat subiu de 570 para 720 caracteres.** A oferta passou a dizer quando usar `plot`, SVG ou GeoGebra; `prompts-leitura.md` foi regenerado com `scripts/measure-prompts.mjs`.
- **Formato da cerca em um lugar só** (`FIGURE_DESCRIPTION`), para não ter duas cópias a divergir; o guia do PDF e a oferta do chat apontam para ele.
- **ADR 0001:** a cerca `plot` e o SVG são interface, ficam em JS com teste, não em Bend. Nenhuma lei nova no núcleo.
- **OpenCode não tem `criar_pdf`.** Só `ver_figura` entra lá; o guia do PDF fica nos dois motores que o têm.
- **CSP da página da figura com `connect-src file:`** porque os módulos JSON (locales) são buscados por `fetch`; o acesso continua limitado pela sessão trancada.

## Ressalvas

- No caminho do Claude, `ver_figura` chama o host direto (`viewFigure`, em `tutor-bridge-host.cjs`); o Pi e o OpenCode passam pela ponte HTTP. O contrato (`FIGURE_FIELDS`, texto do resultado) é o mesmo e a paridade está testada, mas são dois caminhos de transporte.
- O portão 6 rodou só nos arquivos de janela que casam `printToPDF|markdown|criar_pdf|figure` mais o smoke de idioma, não em todo `npm run ui`. `material-template-ui` leva ~0,1 s (não abre janela pesada).
- Não alterei `desk/config.cjs`, PDFs ou material de curso; não rodei `setup`, `update` nem `install-app`; não criei subagentes.

Pronto para integrar

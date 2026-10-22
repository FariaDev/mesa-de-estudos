# Issue #40 — Instruções, ferramentas e custo por turno do Pi e do Claude

Branch `issue-40-agentes`, cortada do `main` local em `2df1f8b` (com #39 e #42).
Sem push, sem PR, sem mexer na issue, sem inferência real: os números saem de
`desk/scripts/measure-prompts.mjs`, que monta o pedido com o mesmo código do app
e conta tokens com um estimador local (detalhes em [Como medir](#como-medir)).

Resumo: as descrições das ferramentas já tinham fonte única desde o #39/#42, mas
os **campos** e o **resultado** ainda divergiam entre os motores. Agora os dois
saem dos guias, com teste de paridade de ponta a ponta. O texto repetido entre o
prompt de sistema e as ferramentas foi cortado. O prefixo da Mesa caiu cerca de
**8%** nos dois motores, e cada chamada de ferramenta no Claude devolve
**60 a 80% menos** texto. As mudanças que o aluno perceberia estão em
[Recomendações](#recomendações-não-aplicadas): nenhuma foi aplicada.

## Inventário

O que vai ao modelo, por motor. "Fixo" = igual em todo turno da conversa.

| Peça | Pi | Claude | Onde mora (depois do #40) |
|---|---|---|---|
| Base do sistema | prompt do próprio Pi (preâmbulo "coding assistant", lista de ferramentas, regras, docs do Pi) + `PI_DESK_PROMPT` anexado com `--append-system-prompt` | `CLAUDE_DESK_PROMPT` **no lugar** do prompt do Claude Code (`systemPrompt` em texto) | `desk/src/agents/desk-prompts.cjs` |
| Perfil de estudo | `TUTOR.md`/`LEARNER.md` ligados por `prepareCourse` na pasta da sessão; a leitura fica com o overlay do usuário (`learning-session.ts`, segundo `profiles.cjs`), fora do repositório e não lido aqui, então o custo dele não está nos números | `TUTOR.md`/`LEARNER.md` lidos por `claudeProfile()` (matéria → vault → templates) e colados no sistema; Livre não leva | `desk/main.cjs`, `desk/templates/` |
| "Quando usar" PDF e quadro | `TUTOR_PDF_PROMPT` + `ACTIVITY_DESK_PROMPT` no adendo da sessão principal | os mesmos dois, no sistema da sessão principal | `desk-prompts.cjs` |
| Ferramentas da Mesa | `mesa_criar_pdf`, `mesa_criar_atividade`, `mesa_previsualizar_atividade` (extensões `tutor-pdf`, `mesa-activity`) | `criar_pdf`, `criar_atividade`, `previsualizar_atividade` (servidor MCP `mesa`, `alwaysLoad`) | texto, campos e resultado em `src/extensions/*/guide.mjs`; montagem em `src/extensions/tool-fields.mjs` |
| Outras ferramentas | `read`, `bash`, `edit`, `write` do Pi + as do perfil fixado (`profiles.cjs`: `ask_user`, `geogebra`, `obsidian-note`, `quiz`, `subagent_*`…) | `Read`, `Glob`, `Grep`, `AskUserQuestion` do Claude Code; o resto desligado | `desk/profiles.cjs`, `claude-adapter.cjs` (`SDK_TOOLS`) |
| Política MCP | `mcp-policy` (confirma `approveTools` antes de chamar) | `settingSources: []`, `strictMcpConfig`, sem MCP herdado | `src/extensions/mcp-policy`, `claude-adapter.cjs` |
| Contexto da mensagem | bloco `[Contexto da Mesa]` (matéria, questão, rascunho, até 2 refs, captura) **só quando muda** ou com captura nova | igual | `core/studycontext.bend`, `desk/studycontext.cjs` |
| Bilhete Conversa → Mesa | bloco do bilhete na mensagem | não entregue (aviso) | `desk/handoff.cjs`, `send.cjs` |
| Chat lateral | adendo sem ferramentas; digest do principal (até 12 falas × 800 car.) só quando o contexto muda | perfil sem ferramentas; mesmo digest | `sidechat-host.cjs`, `sidechat.cjs` |
| Retomada ("onde parei") | não vai ao modelo; é texto da coluna e da caixa | idem | `core/resume.bend` |
| Compactação | `/compact` com instruções opcionais (até 2000 car.) | indisponível | `main.cjs` (`pi-compact`) |
| Anexos | até 4 imagens; lado maior ≤ 2000 px, ≤ 8 MB cada, ≤ 28 MB no total | idem | `main.cjs#promptImages`, `core/attachments.bend` |
| Transcrição importada | — | sessão Pi aberta no Claude: até 50 000 car. no sistema | `main.cjs#prepareClaude` |
| Skills e prompts do Pi instalados pela Mesa | nenhum: a Mesa só liga `templates/.pi/extensions/geogebra.ts` (exemplo) e as extensões acima; skills vêm do perfil do usuário | — | — |

`claude-environment.cjs`, `claude-turn-policy.cjs` e `claude-controls.cjs` não
mandam texto ao modelo (escolha do binário, liquidação do turno e controles).

## Achados, por impacto

### Custo

1. **O grosso do prefixo é a descrição das ferramentas de quadro e de PDF**
   (~4,2 mil dos ~5,1 mil tokens da Mesa no Claude). É conteúdo que o modelo usa
   (tokens de tema, contrato `window.mesa.*`, marcação dos modelos), e a issue não
   pede mudar o comportamento. Cortado só o que se repetia (achados 2 e 3). Ver a
   recomendação R6 para ir além.
2. **Texto repetido entre sistema e ferramenta** — *aplicado*. `TUTOR_PDF_PROMPT`
   (760 car.) e `ACTIVITY_DESK_PROMPT` (900 car.) repetiam com outras palavras a
   descrição da ferramenta; os dois vão em todo turno. O sistema ficou com o
   "quando usar" (233 e 318 car.). As duas regras que só moravam no sistema foram
   para o guia: "sem pedido claro, deixe `modelo` de fora" e "diga que está pronto
   para revisar, nunca que foi salvo"; e, no quadro, "com unidades e cálculos
   conferidos". `tests/desk-prompts.test.mjs` trava a volta: frase do sistema não
   pode reaparecer na ferramenta e o "quando usar" tem teto de 400 caracteres.
3. **Repetição dentro das ferramentas** — *aplicado*. O texto de `kind` ia no
   corpo da descrição e no campo; a regra do quadro offline ia nas duas
   ferramentas de quadro, que sempre andam juntas; tema e largura repetiam os
   campos; `modelo`/`opcoes` do PDF repetiam a lista. Ficou um lugar só para cada.
4. **Resultado das ferramentas no Claude era o JSON interno** — *aplicado*.
   `criar_atividade` devolvia o item inteiro (caminho absoluto da sessão, `callRef`,
   `scopeRef`, hash, nove pares de alturas): ~335 tokens por chamada, contra ~71 no
   Pi. `criar_pdf` devolvia o JSON da preparação (~133 contra ~58). Agora os dois
   motores devolvem a frase do guia (`publishedText`, `resultText`). Além de mais
   barato, o Claude passa a receber o lembrete "não a anuncie nem a repita", que
   só o Pi tinha. O caminho absoluto da sessão também deixa de ir ao modelo.
5. **Ordem do prefixo** — *já amigável a cache; ajustada no Claude*. Nos dois
   motores nada muda dentro do prefixo de uma conversa: TUTOR/LEARNER são lidos
   ao conectar, e o contexto da Mesa vai na mensagem, não no sistema. No Pi, o
   adendo da Mesa vem antes de `cwd`/contexto do projeto. No Claude, a transcrição
   importada ficava no meio, antes das instruções das ferramentas. Agora a ordem é
   base → ferramentas (iguais em toda matéria) → TUTOR/LEARNER (por matéria) →
   transcrição (por conversa). Duas matérias passam a dividir o mesmo começo. Se o
   Claude Code reaproveita esse começo entre sessões depende de onde ele põe os
   pontos de cache, e isso não dá para ver sem inferência (roteiro abaixo).
6. **`alwaysLoad` nas três ferramentas do Claude** — *mantido de propósito*. A
   Mesa passa `tools: [Read, Glob, Grep, AskUserQuestion]`: não há ToolSearch.
   Uma ferramenta adiada ficaria inalcançável. No Pi as `mesa_*` são ativas por
   registro.
7. **Contexto que vai junto** — *já enxuto*. O núcleo (`studycontext.bend`, regra
   1) só reenvia o bloco quando matéria, questão, rascunho ou referências mudam.
   Captura nova sempre vai, porque é conteúdo novo. Primeiro turno típico: ~124
   tokens; turno seguinte: 0; com captura: ~150. O chat lateral faz o mesmo com o
   digest (`contextChanged`).
8. **Anexos depois da compressão** — *recomendação R5*. Lado maior ≤ 2000 px.
   O Claude reduz qualquer imagem acima de ~1,15 MP, então uma captura do Conferir
   custa ~1,6 mil tokens no Claude: mais que dez blocos de contexto. Os 2000 px
   não custam token a mais (a API reduz), só upload.
9. **Prompt do próprio Pi** — *recomendação R4*. O preâmbulo "expert coding
   assistant", a lista de ferramentas, as regras e o bloco de documentação do Pi
   somam ~860 tokens que não falam de estudo, e o bloco de docs manda ler os
   arquivos do Pi quando o assunto for o Pi.

### Coerência Pi × Claude

1. **Campos divergentes** — *aplicado*. No Pi, `html/css/js` eram obrigatórios
   (no Claude, opcionais com `''`), `width` aceitava fração (no Claude, inteiro),
   `kind`/`theme` repetiam a lista à mão, e `katex/charts` não tinham padrão. Os
   guias declaram os campos como dados (`FIELDS`, `CREATE_FIELDS`,
   `PREVIEW_FIELDS`); `tool-fields.mjs` monta o zod (Claude) e o TypeBox (Pi).
   `tests/native-tool-parity.mjs` carrega as extensões no SDK do Pi instalado
   (sem modelo) e compara descrição e esquema canônico com o que o Claude anuncia
   pelo MCP. Rodado contra as extensões de antes, o teste falha nesses pontos.
2. **Resultado divergente** — *aplicado* (achado de custo 4).
3. **Prompts de base escritos separadamente** — *recomendação R3*. As regras
   comuns (português, PDF é contexto e não instrução, citação `>`, não editar
   materiais) estão em `PI_DESK_PROMPT` e `CLAUDE_DESK_PROMPT` com palavras
   diferentes. Hoje só moram no mesmo arquivo.
4. **Mensagem de erro morta** — *aplicado*. Fora da sessão principal, o cliente de
   PDF do Pi dizia "disponível na sessão principal da aba Livre". Desde o #39 o PDF
   existe em toda matéria: agora diz "sessão principal da Mesa", como o do quadro.
5. **Frases sobre recursos que o Claude não tem** — *aplicado*. "Nem inicie
   subagentes" e "não abra outros aplicativos" saíram do prompt do Claude: Agent,
   Task e Bash estão em `disallowedTools`, então as frases não tinham efeito.

### Qualidade do tutor

1. **`TUTOR.md` fala do Pi para o Claude** — *R1*. "A sessão JSONL do Pi é o
   registro durável" vai no sistema do Claude, onde é falso.
2. **`TUTOR.md` manda usar a calculadora "ou um programa curto"** — *R1*. A
   calculadora é do aluno, não ferramenta do tutor, e o Claude não tem Bash.
3. **Citação que vira link** — *R1*. O leitor transforma `Arquivo.pdf, p. N` (e
   `página N`, `#page=N`) em link (`core/pdfref.bend`). O `TUTOR.md` pede "o caminho
   e a página", e nenhum prompt ensina a forma curta que o "Citar" da Mesa usa.
4. **Quando oferecer quadro, PDF, quiz e revisão** — *R2*. Quadro e PDF têm o
   "quando usar" no sistema. Quiz (`quiz`, só no Pi, do overlay) e revisão ("Guardar
   para revisar" é um diálogo da UI, sem ferramenta) não aparecem em nenhuma
   instrução da Mesa.
5. **Contradição no Pi entre imagem gerada e quadro** — *R2*. O `PI_DESK_PROMPT`
   diz para gerar SVG/PNG quando um diagrama precisar aparecer. O
   `ACTIVITY_DESK_PROMPT` e o guia dizem para preferir o quadro a uma imagem.
6. **Resultados que ajudam a corrigir** — bons. A prévia lista o console e diz
   "Corrija os N erro(s)". O PDF com erro de LaTeX diz qual equação corrigir. O
   quadro devolve o id e a versão para revisar com `activityId`.

### Erros e limites

- As mensagens de erro das ferramentas são do host, em português e acionáveis
  ("A sessão mudou; prepare o PDF na sessão atual.", "Referência de chamada
  inválida; atividade não publicada."). Algumas negações do adaptador do Claude
  que chegam ao modelo são secas ("conexão antiga", "pergunta sem questões
  válidas (nada a responder)"), mas só aparecem em corrida de reconexão. Sem
  mudança.
- Tempos-limite: PDF 65 s e quadro/prévia 30 s no cliente do Pi; no Claude, o PDF
  recebe o `signal` do SDK. O handler de `criar_atividade` no Claude não repassa
  o `signal`, mas a publicação é local e curta. Sem mudança.

## O que mudou (commits)

| Commit | O quê |
|---|---|
| `refactor(desk): instruções de sistema dos dois motores num módulo só…` | `desk-prompts.cjs` recebe os textos de `rpc.cjs`, `main.cjs` e `claude-prompt.cjs` (apagado), sem mudar nenhum byte; `scripts/measure-prompts.mjs` |
| `feat(desk): campos e resultado das ferramentas do tutor numa fonte só…` | `tool-fields.mjs`; campos e resultado nos guias; Claude e Pi montam a partir deles; erro "aba Livre"; `native-tool-parity.mjs` |
| `perf(desk): instrução de sistema diz quando usar…` | sistema enxuto, regras movidas para o guia, repetição interna removida, ordem fixo → variável no Claude; `desk-prompts.test.mjs` |
| `test(desk): snapshot público copia o texto de sistema do Pi…` | o `rpc.cjs` passou a ler `desk-prompts.cjs`; o teste do snapshot copia o arquivo |
| `docs: …` | este relatório e o mapa do `AGENTS.md` |

Nenhum núcleo Bend mudou (o `verify:bend` confirma que nenhum artefato mudou). Os
templates do repositório e os da pasta de dados, `chat/` e `desk/config.cjs`
ficaram intocados.

## Números

Tokens aproximados (estimador local; ver abaixo). "Prefixo da Mesa" = sistema +
ferramentas `mesa`. No Pi, o prefixo inclui o prompt do próprio Pi e `read/bash/
edit/write`, mas **não** as extensões do perfil do usuário, que dependem de
`~/.pi` e não foram lidas.

| Parte | Antes (car.) | Antes (tokens) | Depois (car.) | Depois (tokens) |
|---|---:|---:|---:|---:|
| **Claude — sistema, matéria** | 3.842 | 1.178 | 2.856 | 874 |
| Claude — sistema, aba Livre | 2.305 | 697 | 1.319 | 392 |
| Claude — sistema, chat lateral | 2.375 | 726 | 2.301 | 706 |
| Claude — "quando usar" das ferramentas | 1.465 | 453 | 553 | 168 |
| Claude — `criar_pdf` | 3.968 | 1.418 | 4.024 | 1.432 |
| Claude — `criar_atividade` | 6.243 | 2.160 | 6.137 | 2.122 |
| Claude — `previsualizar_atividade` | 2.248 | 808 | 1.837 | 668 |
| **Claude — prefixo da Mesa** | **16.301** | **5.564** | **14.854** | **5.096** (−8,4%) |
| Pi 1.2.0 — preâmbulo + ferramentas + regras + docs do Pi | 2.675 | 857 | 2.675 | 857 |
| Pi — adendo da Mesa | 2.927 | 900 | 2.015 | 615 |
| Pi — `mesa_criar_pdf` | 4.109 | 1.485 | 4.165 | 1.499 |
| Pi — `mesa_criar_atividade` | 6.164 | 2.133 | 6.111 | 2.113 |
| Pi — `mesa_previsualizar_atividade` | 2.218 | 804 | 1.848 | 678 |
| Pi — `read`/`bash`/`edit`/`write` | 2.720 | 906 | 2.720 | 906 |
| **Pi — parte da Mesa (adendo + `mesa_*`)** | **15.418** | **5.322** | **14.139** | **4.905** (−7,8%) |
| **Pi — prefixo sem o perfil do usuário** | 20.894 | ~7.130 | 19.615 | ~6.710 |
| Pi — adendo do chat lateral | 1.460 | 447 | 1.460 | 447 |
| Resultado `criar_pdf` — Claude | 386 | 133 | 178 | 58 |
| Resultado `criar_pdf` — Pi | 178 | 58 | 178 | 58 |
| Resultado `criar_atividade` — Claude | 742 | 335 | 195 | 71 |
| Resultado `criar_atividade` — Pi | 195 | 71 | 195 | 71 |
| Contexto — primeiro turno (matéria, questão, rascunho, 2 refs) | 321 | 124 | 321 | 124 |
| Contexto — turno seguinte sem mudança | 0 | 0 | 0 | 0 |
| Contexto — com captura do Conferir | 399 | 150 | 399 | 150 |

As ferramentas `criar_pdf` e `criar_atividade` cresceram ou quase não mudaram
porque receberam as regras que saíram do sistema. O ganho está no conjunto.
O `cwd` do Pi (~42 tokens) varia com o nome da pasta temporária. O JSON do
zod e o do TypeBox têm formas diferentes (`$schema`, `additionalProperties`),
por isso os caracteres não batem entre os motores, mas o esquema canônico é o
mesmo.

### Como medir

```sh
cd desk
node scripts/measure-prompts.mjs          # tabela
node scripts/measure-prompts.mjs --json   # números
```

O script usa `desk-prompts.cjs`, as ferramentas do Claude (zod → JSON Schema,
como o SDK anuncia) e o SDK do Pi instalado. O Pi roda numa pasta temporária,
sem extensões nem perfil do usuário, só para montar o prompt
(`buildSystemPromptSections`) e ler o esquema das ferramentas. Sem modelo e sem
rede. O estimador corta palavras em pedaços de até 4 bytes UTF-8 e conta
pontuação e quebras de linha à parte. Não é o tokenizador do Claude: o valor
absoluto erra ~15%, e a comparação antes/depois usa a mesma régua. "Antes" =
commit `f1b99a1` (só a mudança de lugar, textos idênticos ao `main`).

### Roteiro da medição real (passo manual, gasta a conta)

1. No `main` (antes) e nesta branch (depois), abra a Mesa com o motor Claude numa
   matéria com `TUTOR.md`/`LEARNER.md` e comece uma **sessão nova**.
2. Mande "oi" e, depois que ele responder, "obrigado". Não anexe nada nem troque
   a questão.
3. Em **Estatísticas → Uso do tutor**, anote entrada, saída e cache dos dois
   turnos. O primeiro turno mostra o prefixo inteiro (gravação no cache). O
   segundo deve ser quase todo leitura de cache.
4. Repita com o Pi (a Mesa registra `input`, `output` e `cacheRead+cacheWrite`
   por turno, em `src/study-data/usage-events.cjs`).
5. Para o resultado das ferramentas: peça "mostra um gráfico de y = x²" e compare
   a entrada do turno seguinte nas duas versões.

Esperado: o primeiro turno do Claude ~470 tokens menor, cada quadro mostrado
~260 tokens menor no histórico; no Pi, ~420 tokens menor.

## Recomendações (não aplicadas)

Cada uma muda o que o tutor faz de um jeito que o aluno notaria, ou mexe em
arquivo que esta tarefa não deve tocar. Ordem: impacto.

- **R1 — Corrigir o `templates/TUTOR.md`** (o AGENTS.md pede pedido explícito para
  editar os templates do repositório; quem já copiou o seu não é afetado). Trocar
  "A sessão JSONL do Pi é o registro durável" por algo neutro ("o histórico desta
  sessão é o registro"); trocar "use a calculadora local da mesa ou um programa
  curto" por "confira a conta passo a passo; peça ao aluno a calculadora da Mesa
  quando o número importar"; ensinar a citação curta `Arquivo.pdf, p. N`, que
  vira link no leitor.
- **R2 — Uma seção "o que oferecer"** no adendo dos dois motores: quadro quando
  manipular ajuda, PDF quando o aluno pede material, quiz (só Pi) para checar,
  "Guardar para revisar" quando um erro se repetir. E, no Pi da sessão principal,
  tirar a frase "gere SVG/PNG e referencie como imagem" (que briga com "prefira o
  quadro"), deixando-a só no chat lateral, que não tem quadro.
- **R3 — Base comum** em `desk-prompts.cjs`: as regras que os dois motores dividem
  escritas uma vez, mais um trecho por motor (Pi: GeoGebra, imagens em
  `PI_LEARNING_ASSET_DIR`, confirmação de ações destrutivas de MCP; Claude: Read
  com caminhos autorizados). Muda a redação que cada modelo lê.
- **R4 — Prompt de sistema próprio no Pi** (`--system-prompt` em vez de só
  `--append-system-prompt`): tira ~860 tokens de preâmbulo de programação, regras
  genéricas e docs do Pi. Some também a lista de ferramentas que o Pi monta (as
  ferramentas seguem no esquema). Precisa medir com o perfil real do usuário,
  que tem mais ferramentas.
- **R5 — Capturas em 1568 px no lado maior** (o teto efetivo do Claude): mesmo
  custo em tokens, menos upload. Ir abaixo disso (ou recortar a área da questão)
  economiza ~1,6 mil tokens por captura, mas pode custar legibilidade da letra à
  mão: decidir olhando capturas reais.
- **R6 — Descrição do quadro mais curta**: o tema (a lista de 22 tokens CSS, ~500
  tokens), o contrato `window.mesa.*` (~200) e as regras de layout (~210) somam
  ~900 tokens em todo turno, inclusive nos que não mostram quadro. Dá para mover o detalhe para o resultado da prévia (o modelo só o lê
  quando monta um quadro). Muda como o tutor monta quadros: validar com casos reais.
- **R7 — Perfil fixado do Pi**: `subagent_*` (5 ferramentas) está ativo, mas o
  adendo diz "não inicie subagentes sem autorização". Desativar na Mesa economiza
  o esquema delas em todo turno. É escolha do autor (`profiles.cjs`).
- **R8 — Digest do chat lateral sem o caminho da sessão**: a linha
  `conversa principal: /Users/…/sessão.jsonl` não ajuda o modelo (no Claude ele
  nem pode lê-la) e aparece em "Ver o contexto copiado". Tirar muda o que o
  usuário vê nesse painel.

## Portões

Rodados em `desk/` nesta branch:

| Portão | Resultado |
|---|---|
| `npm run verify:bend` | ok — 88 artefatos reproduzíveis, nenhum byte mudou, provas verdes |
| `MESA_GATE_CACHE=0 npm test` | 1318/1318 (+5 do portão do núcleo). Na primeira rodada, `snapshot.test.mjs` falhou porque o `rpc.cjs` passou a ler `desk-prompts.cjs` e o snapshot não o copiava; corrigido no teste |
| `npm run ui` | 56 ok e 3 com falha na rodada de 2 por vez. `composer-box-ui` e `ui-smoke` (que estourou os 600 s no bloco `composer-hierarquia`) passam sozinhos (`--jobs 1`: 23 s e 143 s); são medições de tempo sob carga. `pdf-models-dialog-ui` falha também no `main` (`2df1f8b`, conferido numa worktree temporária): "light 900x650: a frase do cartão aparece só onde cabe". É anterior a esta branch e fica para outra. `activity-viz-ui` passou |
| `npm run hunts` | 23 ok, 1 pulado (`hunt-handoff`, sem `chat/node_modules`); depois de `npm ci` em `chat/` (só dependências), `hunt-handoff` ok |
| `npm run test:claude-ui` | verde (as nove suítes, inclusive `mesa-claude-activity-ui`) |
| `node tests/native-tutor-pdf.mjs` | PASS |
| `node tests/native-activity-tool.mjs` | PASS |
| `node tests/native-tool-parity.mjs` (novo) | ok — as três ferramentas iguais no Pi e no Claude |
| `tests/tutor-materials.test.mjs`, `tests/activity-tools.test.mjs` | verdes (dentro do `npm test`) |
| `chat/tests/mcp-guard.test.mjs` | 16/16 |

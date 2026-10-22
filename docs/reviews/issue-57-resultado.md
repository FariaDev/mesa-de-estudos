# #57 — OpenCode como motor da Mesa: resultado

Branch de trabalho: `claude/zealous-jang-7a3638`, commits locais, um por
camada, sem push e sem PR.

| Commit | Camada |
|---|---|
| `9818bb7` | Fase 0: o Pi deixa de oferecer os grátis do Zen (403 `FreeTierError`) |
| `4ac3e4a` | Núcleo: caps do OpenCode; motor desconhecido fica todo fechado |
| `bb878b5` | Núcleo: `canSteer` em `agentdelivery.bend` (só com turno em voo, nunca sobre incerteza) |
| `7799b93` | Casca do `opencode serve`: processo, senha só na memória, ledger e recolha de órfãos |
| `989f8d5` | Adaptador HTTP + `NativeService` genérico (steer, comandos, compactação, medidor) |
| `81f78d0` | MCP `mesa` por stdio (GeoGebra, quadro, prévia) e identidade casada pelo SSE |
| `fcd3299` | Descritor `opencode-<uuid>.json` com o esquema do Claude e o nativo `ses_` |
| `8be0dbd` | Host e IPC: dono do serve, MCP por conversa, rotas nativas genéricas |
| `fffbab6` | Janela: sessão nova, seletor com os grátis primeiro, chave → sessão OpenCode |

## O que veio da branch e o que foi refeito

A branch `t3/opencode-provider` (`cc634be`) serviu só de especificação, lida
com `git show`/`git diff`; nada foi mesclado, rebaseado nem copiado por
cherry-pick.

- **Aproveitado como contrato:** as rotas do `opencode serve` (sessão
  idempotente pelo `ses_`, prompt com o item `user` da inbox, comando 204,
  compactação com fim no SSE, modelo 204, permissões, MCP em tempo de
  execução), o formato do catálogo (`providerID/id`, variantes como esforço),
  a leitura do histórico e o cálculo do medidor. Tudo foi medido de novo no
  binário 2.0.32 antes de virar código.
- **Refeito no estilo do main:** cada peça em módulo próprio com `// @ts-check`
  e JSDoc, no `tsconfig`; erros como mensagens marcadas do catálogo (pt-BR e
  en); dependências por parâmetro; fakes com nome (`fake-opencode.mjs` em modo
  `serve`); logs em JSON por linha; a regra de entrega no núcleo Bend
  (`outcome`/`mayRetry`/`canBegin`/`canSteer`) em vez de condição no adaptador.
- **Diferente da branch:** a Mesa é dona de UM servidor por app (a branch subia
  por conversa); a recolha de órfãos só encerra o pid do ledger cuja linha de
  comando é exatamente o serve da Mesa (nunca procura por nome); o serviço é
  um `NativeService` comum ao Claude e ao OpenCode (a #58 reaproveita); o MCP
  `mesa` foi escrito aqui, sem SDK novo; a identidade da atividade vem do SSE
  (`tool.called`) casada pelo hash dos parâmetros.
- **Fora do escopo, como pedido:** chat lateral no OpenCode (o lateral de uma
  conversa OpenCode segue no Pi) e pasta de dados compartilhada.

## O que os ajudantes fizeram e o que eu corrigi

Ajudantes: `opencode run` com DeepSeek V4.1 Flash Free e MiniMax M3.1 Flash
Free, rodados da worktree. Nenhum segredo, chave, conteúdo de `.runtime/`,
JSONL de sessão ou material de curso foi no texto das tarefas. Eles não
commitaram; revisei cada `git diff` e fiz os commits.

| Tarefa | Ajudante | Resultado |
|---|---|---|
| Testes do dono do servidor (`opencode-serve-owner.test.mjs`) | DeepSeek | Aceito sem mudança |
| Testes de catálogo e medidor, eventos e leitores (`opencode-catalog-usage`, `opencode-events`, `opencode-parsers`) | DeepSeek | Aceitos; acrescentei o caso do `wireItem` |
| Testes da fiação do host (`opencode-tutor-wiring.test.mjs`) | DeepSeek | Aceito; acrescentei o caso do `connect` (o livro casando o id do SSE) — o primeiro rascunho meu errou o corpo da atividade (`html` faltando) e corrigi |
| Testes dos fatos do motor na janela (`engine-facts.test.mjs`) | DeepSeek | Aceito sem mudança |
| Uma das tarefas de teste (a primeira delegada) | MiniMax | Rodou mais de 20 min sem gerar arquivo, em segundo plano (contra a regra "primeiro plano"); parei e refiz a tarefa menor com o DeepSeek em primeiro plano |

Os ajudantes tocaram só os arquivos pedidos; nenhum precisou de
`git checkout --`. O resto (arquitetura, adaptador, serviço, MCP, hosts,
janela, testes de janela) fiz eu.

Achados durante a revisão, já corrigidos:

- Seis módulos `opencode-*` copiavam a linha do `isPlainObject`
  (`plain-object.test.mjs` pegou); passaram a usar `plain-object.cjs`, e o tipo
  mais forte expôs dois acessos sem tipo em `opencode-events`/`opencode-usage`.
- A fase 0 tinha deixado o `index.html` uma linha acima do teto; a linha do
  aviso de 403 nas Configurações saiu junto com o fluxo novo.
- `createClaudeConversation` com o parâmetro `engine` mudou a inferência do tsc
  nos chamadores; ganhou JSDoc sem passar das 500 linhas.

## Portões

| Portão | Resultado |
|---|---|
| `npm run verify:bend` | Verde: 68 artefatos reproduzíveis, "All terms check." |
| `MESA_GATE_CACHE=0 npm test` | Verde: 1753 testes, 0 falhas |
| `npm run typecheck`, `npx eslint .` | Limpos |
| `npm run test:packaged` + `npm run ui -- bundle-payload` | Verdes (a pasta `src` vai inteira no bundle, com o `mesa-mcp`) |
| `npm run test:claude-ui` | Verde até o fim, depois de atualizar a lista do menu de sessão nova no `claude-ui-smoke` (agora com o item OpenCode) |
| `npm run ui -- opencode,free-models,ui-smoke` | Verdes. Na primeira rodada o passo 4 do `opencode-ui` esperava o eco do texto, mas o fake responde com o fim do prompt, que na sessão nova é o bloco de contexto; o teste passou a esperar a resposta. O app estava certo (captura do artefato) |
| Arquivos com `FAKE_PI`/`fakePiSource` | O `fake-pi.mjs` não mudou nesta issue; nada a rodar por ele |

## O que fica sem prova

- **Modelo real:** nada aqui chamou modelo. O roteiro está em
  `docs/manual/opencode-motor.md` e não foi executado.
- Se os grátis do Zen respondem pelo `opencode serve` **sem chave**.
- O nome final das ferramentas MCP no OpenCode (`mesa_criar_atividade`) e a
  ordem entre o `tool.called` do SSE e a chamada que chega ao MCP. Se o SSE
  chegar depois de 3 s, a atividade publica com id próprio
  (`opencode-mcp:<uuid>`) e um aviso no log.
- Regras de permissão para as ferramentas MCP (o servidor pode perguntar antes
  de rodá-las).
- O MCP rodando pelo Node do Electron (`ELECTRON_RUN_AS_NODE`) no app
  empacotado.
- Leitura de PDF citado fora da pasta da conversa: o OpenCode pode pedir
  permissão (`external_directory`), que a Mesa mostra como diálogo.
- O PDF do tutor (`tutor-pdf`) não está no MCP `mesa`; o prompt do OpenCode não
  o oferece.

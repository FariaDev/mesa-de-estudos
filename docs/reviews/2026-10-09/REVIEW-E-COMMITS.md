# Revisão das mudanças sem commit — Mesa, Codex e Claude

Data: 2026-10-09. Pedido: revisar as mudanças pendentes e fazer commits locais;
inclusão dos dois protótipos em commits separados confirmada pelo usuário.
Base: `d8a06b1b41980c95b50c5245e76efda7129fce38` (HEAD antes desta revisão).
O escopo é o trabalho sem commit, não uma comparação com a última release.

## Escopo e método

Estado inicial: 49 arquivos rastreados modificados e 374 arquivos novos.
Incluídos: `desk/`, alterações de `core/`, `codex-plugin/`, `claude-mod/`,
testes e documentação Markdown. Capturas, PDFs, logs, patches e demais
evidências históricas locais ficam preservados fora destes commits.
Não houve alteração de `chat/`, defaults do autor, materiais, configurações,
sessões pessoais ou instalações do usuário.

CodeRabbit rodou em clone temporário, com base explícita e arquivos novos.
A revisão conjunta foi recusada: 224 arquivos, limite de 150. O escopo foi
dividido em Mesa (117 arquivos iniciais), Codex (62) e Claude (44), preservando
a cobertura. As duas alterações Bend são apenas correção do texto de intervalo
de revisão; foram conferidas manualmente e pelo portão completo de provas.
Também foram lidos os fechamentos anteriores de atividade, PDF, timeline,
backup e protótipos, e conferidos os caminhos atuais de IPC, escopo,
persistência, correlação e impressão. Os resultados anteriores não foram
usados como substitutos dos testes atuais.

## Achados e correções desta rodada

1. **P2 — estado de atividade recusado durante mutação da Mesa.** Reproduzido
   com geração de PDF real e gravação de estado concorrente: PDF concluído,
   estado recusado com “Aguarde a operação em andamento terminar.” A atividade
   agora aguarda a mutação atual e revalida seu escopo antes de escrever.
   Foi mantida a exclusão entre escrita, navegação e restauração; remover a
   trava global, como sugerido pelo revisor, permitiria novas corridas nesses
   caminhos. O teste `activity-concurrency-ui.mjs` confirma duas gravações
   aguardando um seletor nativo e PDF real concorrente com estado persistido.
   Chamadas IPC rápidas simultâneas, sozinhas, não reproduziram a recusa.
2. **P2 — teste do helper Claude depende de ele ainda não estar compilado.**
   Reproduzido em cópia isolada com helper e staging sintéticos: o teste falha
   com `BUILD_TARGET_EXISTS`. Agora a cópia exclui helper/staging e compara a
   presença, inode, tamanho e mtime da origem antes/depois. A mesma reprodução
   passou após a correção, sem compilar ou alterar o helper do usuário.
3. **P3 — caminhos pessoais nos exemplos dos protótipos.** Os READMEs passam
   a usar placeholder ou diretório corrente, permitindo outros checkouts.
4. **P3 — configuração MCP descrita como quatro variáveis.** O README Codex
   documenta as sete variáveis reais, incluindo perfis/checkpoint.
5. **P3 — screenshots do teste integrado em caminho específico do macOS.**
   Agora usam `screenshotDirectory`, com destino padrão em artefatos de teste.
6. **P3 — precedência incorreta no vetor `fileimg`.** A segunda revisão Mesa
   identificou que o fallback produzia `file://null`. O fallback é aplicado
   ao parâmetro antes da concatenação; o spike de isolamento foi reexecutado.

São sete achados individuais do CodeRabbit (os dois READMEs com caminhos
pessoais estão agrupados no item 3), todos corrigidos. Segunda rodada: zero
achados no Codex e no Claude; Mesa com 118 arquivos e apenas o item 6,
corrigido em seguida. Os resultados completos estão em
[coderabbit-summary.json](coderabbit-summary.json).
Uma sonda adicional de troca rápida após alteração de slider preservou o
valor final; não foi inferido um defeito de navegação a partir do debounce.

## Validação atual

- Mesa: `npm test`, **1.201/1.201**, sem falhas, cancelamentos ou skips,
  repetido depois da correção de concorrência.
- Codex: `npm test`, **179/179**, sem falhas ou skips. Só documentação mudou
  depois dessa execução.
- Claude Mod: `npm test`, **159/159**, sem falhas ou skips, repetido após o fix.
- Sintaxe: **334 arquivos** aprovados no estado final.
- Bend: build, provas e paridades executados; **78 artefatos reproduzíveis**,
  nenhum byte divergente. A correção posterior é host/fixtures, fora do núcleo.
- **14 scripts Electron distintos** aprovados: isolamento (175 verificações),
  watchdog (27), atividade UI (50), atividade integrada Pi e Claude, nova
  concorrência, prévia de PDF, diálogo/template, PDF na matéria, timeline,
  timeline sem ID, eventos tardios, backup/restauração/exportação/importação
  e spike de isolamento. Os cinco fluxos afetados pelo ajuste do host foram
  repetidos depois dele; o spike foi repetido após o fix de `fileimg`.
- `git diff --check` aprovado; inventário sem sessões, credenciais, runtime,
  dependências instaladas ou bundles nos arquivos de produto selecionados.

Hashes do código e contagens desta rodada:
[source-validation.json](source-validation.json).
Logs completos locais: `/private/tmp/mesa-review-20261009-*.log` e
`/private/tmp/mesa-review-20261009-ui{,-final}/`. Clone de revisão referenciado
pelos resultados do CodeRabbit. Esses logs não contêm materiais pessoais.

## Limites e entrega

Electron, IPC/preload, impressão, ponte HTTP, MCP/SDK e Poppler foram reais;
respostas dos provedores, sessões, PDFs e seletores foram sintéticos.
Nenhum modelo autenticado, captura pessoal, Windows/Linux ou carregamento
dos protótipos nos apps foi exercitado. O isolamento medido depende do
Electron/Chromium atual; deve ser revalidado em upgrades. Os limites já
documentados da timeline para deltas anônimos fora do contrato Pi continuam.

Entrega organizada em três commits locais: app Mesa e documentação geral,
plugin Codex e sua documentação, mod Claude e sua documentação. Push, PR,
release, instalação e atualização do app não fazem parte desta entrega.

# Livro-razão de testes — ticket #30

Base `87a39ea`. Uma linha por arquivo de `desk/tests/`; R manter · F manter o contrato e consertar a asserção · C consolidar (o absorvedor está nomeado) · D apagar (a prova que fica está nomeada). Arquivo de janela/hunt conta como **1 unidade** (os blocos aparecem nas notas). Tempos: `unit` = `node --test arquivo` isolado; janela/hunt = rodada `npm run ui` / `npm run hunts` com 2 por vez (`tempos` sob carga).

Método de decisão de D nos testes de visão: o teste só é D quando **todos** os valores esperados (literais fora do nome e da mensagem) aparecem na lei/prova do módulo (`valores-nas-leis.mjs`); teste cujo valor só existe no teste fica R.

## Raia agentes-claude-a

| arquivo | tipo | linhas | tempo | o que protege | R | F | C | D | decisão |
|---|---|---:|---:|---|---:|---:|---:|---:|---|
| claude-activity-tools.test.mjs | unit | 46 | 0.3 s | SDK MCP anuncia PDF e atividade; hook injeta ID nativo sem confirmação extra | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| claude-adapter-usage-history.test.mjs | unit | 350 | 0.3 s | Uso de tokens + histórico importado do adaptador Claude | 13 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| claude-adapter.test.mjs | unit | 1835 | 0.4 s | Ponte Claude isolada (desk/src/agents/claude-adapter.cjs) contra SDK fake. | 59 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| claude-controls-ui.mjs | win | 69 | — | Electron controls regression with artificial SDK/account/course only. | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| claude-controls.test.mjs | unit | 468 | 0.2 s | Seleção de modelo e esforço do Claude (desk/src/agents/claude-controls.cjs). | 11 | 0 | 0 | 1 | D: módulo é puro: sem imports, timers, processos, rede ou ambie → varredura de fonte; o módulo roda no teste sem nenhum host (a pureza é provada pelo próprio uso) |
| claude-environment.test.mjs | unit | 560 | 0.3 s | Ambiente do Claude Code (desk/src/agents/claude-environment.cjs). | 28 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| claude-executable-upgrade-ui.mjs | win | 37 | — | Resume an established synthetic session whose last observed executable is | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| claude-fixtures.mjs | other | 339 | — | Fixtures da ponte Claude: SÓ simulação. | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| claude-host-recovery.mjs | win | 62 | — | Electron/IPC recovery with artificial data only. No native Claude process. | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| claude-lifecycle-integration.test.mjs | unit | 296 | 0.2 s | Behavioral transport tests: synthetic SDK only, no Claude process or account. | 17 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| claude-lifecycle-ui.mjs | win | 67 | — | Electron integration with artificial course, SDK, account and session only. | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| claude-native-controls.test.mjs | unit | 809 | 0.3 s | Controles nativos do Claude Code no adaptador (modelo/esforço) + transição de | 23 | 0 | 0 | 1 | D: portão concorda com canChangeControls do Bend em todas as co → core/laws/agentdelivery.bend (canChangeControls, 5 casos) + agent-core já coberto |
| claude-offline-queue-ui.mjs | win | 46 | — | New composer/tutor-state with Claude: sending offline calls the tutor, keeps | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| claude-questions.test.mjs | unit | 486 | 0.2 s | Perguntas estruturadas do Claude Code, aviso de limite e avisos de atividade | 14 | 0 | 0 | 1 | D: módulo é puro: sem imports, DOM, timers, rede ou ambiente → idem |
| claude-sdk-binary-ui.mjs | win | 103 | — | Executable choice with fake binaries (#32): when the user's Claude Code is | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| claude-turn-policy.test.mjs | unit | 533 | 0.2 s | Política pura de liquidação do turno Claude (desk/src/agents/claude-turn-policy.cjs). | 40 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| claude-ui-smoke.mjs | win | 406 | — | Smoke de UI da Mesa + Claude Code (experimental), sobre o host/IPC congelado. | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |

## Raia agentes-claude-b

| arquivo | tipo | linhas | tempo | o que protege | R | F | C | D | decisão |
|---|---|---:|---:|---|---:|---:|---:|---:|---|
| activity-bridge.test.mjs | unit | 284 | 0.4 s | ponte publica com escopo capturado, token e caller; retry é idempotente | 9 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| activity-call-gate.test.mjs | unit | 41 | 0.2 s | PreToolUse substitui referência do modelo e preserva ID real e hash | 3 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| activity-concurrency-ui.mjs | win | 60 | 3 s | Main/preload reais, Pi e seletor nativo sintéticos. Confirma que gravações | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| activity-dual-sdk-gate.test.mjs | unit | 84 | 0.4 s | Plano O2: duas chamadas de payload IDÊNTICO com IDs nativos distintos, | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| activity-process-guard.test.mjs | unit | 63 | 0.2 s | only a detached, currently owned renderer can be terminated | 5 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| activity-runtime.test.mjs | unit | 203 | 0.2 s | parseActivityUrl aceita o artefato com tema e recusa o resto | 8 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| activity-store.test.mjs | unit | 224 | 1.9 s | normalizeSpec aplica tetos e o hash é determinístico | 9 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| activity-tools.test.mjs | unit | 62 | 0.3 s | createActivityTool devolve a definição da ferramenta com schema e handler | 4 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| agent-core.test.mjs | unit | 42 | 0.2 s | native catalog gates controls and active ownership blocks configuration changes | 0 | 0 | 0 | 4 | D: native catalog gates controls and active ownership blocks co → core/laws/agentcaps.bend + core/laws/agentdelivery.bend (+ proofs)<br>D: Claude busy messages wait; idle text and image messages can  → core/laws/agentcaps.bend + core/laws/agentdelivery.bend (+ proofs)<br>D: acknowledged and uncertain deliveries cannot be retried auto → core/laws/agentcaps.bend + core/laws/agentdelivery.bend (+ proofs)<br>D: queue waits for tool/permission, uncertain delivery and conf → core/laws/agentcaps.bend + core/laws/agentdelivery.bend (+ proofs) |
| agent-history.test.mjs | unit | 160 | 0.2 s | Histórico Claude → forma do renderer/exportação (desk/src/agents/history.cjs). | 12 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| agent-service.test.mjs | unit | 134 | 0.2 s | persisted uncertainty locks controls before initialization and before native mutation | 11 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| bundle-payload-ui.mjs | win | 46 | 5 s | Payload real do instalador em diretório isolado; nenhuma instalação local, | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| bundle-runtime-sdk.mjs | other | 70 | — | SDK oficial e payload real, com CLI sintético local: sem login/inferência. | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| bundle-runtime.test.mjs | unit | 79 | 0.2 s | payload resolve peers e versões aninhadas sem depender da fonte | 5 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| conversations.test.mjs | unit | 382 | 0.3 s | Registro de conversa Claude (descritor JSON real) e compatibilidade Pi. | 13 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| descriptor-cache.test.mjs | unit | 16 | 0.2 s | typing/health metadata omits images and does not reparse unchanged conversations | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| hunt-activity-isolation.mjs | hunt | 87 | 152 s | Hunt de isolamento do runtime REAL (Electron sintético): todos os vetores de | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| hunt-activity-spike.mjs | hunt | 220 | 23 s | Spike real de contenção da superfície de atividade (Electron sintético, | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| hunt-activity-ui.mjs | hunt | 435 | 24 s | UI de atividades em Electron sintético: store/runtime/ponte reais no main, | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| hunt-activity-watchdog.mjs | hunt | 192 | 47 s | Prova do watchdog com processo compartilhado: 2-3 atividades no mesmo OOPIF, | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| live-pi.mjs | win | 28 | — |  | 0 | 0 | 0 | 1 | D: (arquivo inteiro, sem asserção) → manual, nunca roda na rodada; chama o Pi/provedor de verdade; guardião do contrato do Pi: rpc.test.mjs + framing-parity.mjs |
| mcp-policy.test.mjs | unit | 24 | 0.2 s | approveTools preserva confirmações por servidor, inclusive chamadas aninhadas | 3 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| mesa-activity-host.test.mjs | unit | 46 | 0.3 s | published metadata and all shell APIs are bound to original conversation scope | 2 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| mesa-claude-activity-ui.mjs | win | 35 | — | bloco mesa-claude-activity | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| mesa-interactive-ui.mjs | win | 86 | 32 s | bloco mesa-interactive-integrated | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| native-activity-tool.mjs | other | 74 | — | SDK Pi instalado, extensão real e ponte HTTP real; nenhum modelo/credencial. | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| native-history.test.mjs | unit | 16 | 0.2 s | export crosses display limit and paginates API entries without duplicates | 2 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| native-mcp.mjs | other | 75 | — | Integração opt-in com o SDK Pi instalado e servidor MCP de teste local. | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| native-review-draft.mjs | other | 24 | — | Opt-in: Pi/provedor reais, rascunho sintético sem ferramentas nem sessão salva. | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| native-rpc.mjs | other | 54 | — | Opt-in: uma conversa temporária com Pi/provedor reais, sem dados de curso. | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| native-tutor-pdf.mjs | other | 34 | — | SDK Pi instalado, extensão e HTTP reais; nenhum modelo/credencial/inferência. | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| run-claude-ui.mjs | other | 10 | — | Sequential synthetic Electron regressions; each harness owns a temp runtime. | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| timeline-adapter.test.mjs | unit | 222 | 0.2 s | Ponte Claude: identidade de bloco, declaração × execução de ferramenta e | 8 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| turn-identity.test.mjs | unit | 99 | 0.2 s | Identidade de execução do host Pi (achado N1): testes puros da decisão de | 7 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| tutor-materials.test.mjs | unit | 95 | 0.4 s | fechar durante a inicialização não deixa um servidor aberto | 5 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| tutor-pdf-ui.mjs | win | 81 | 4 s | Conversa Pi simulada; ferramenta HTTP, impressão, registro, abertura e UI reais. | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |

## Raia calc-estado-config

| arquivo | tipo | linhas | tempo | o que protege | R | F | C | D | decisão |
|---|---|---:|---:|---|---:|---:|---:|---:|---|
| accent-state.test.mjs | unit | 48 | 0.2 s | Cor de acento (ticket #9): estado de interface, como o tema. Pelo adaptador | 6 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| accent-ui.mjs | win | 250 | 10 s | Cor de acento (ticket #9 da spec de redesenho): mede na janela real, nos dois | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| calculator-ui.mjs | win | 317 | 15 s | Cobre cada critério de aceitação: recolhida é UMA linha de 40px (--bar) no pé | 0 | 1 | 0 | 0 | F: seção 6 só captura, sem asserção → capturas passam a depender de MESA_REVIEW_SHOTS |
| calcview.test.mjs | unit | 214 | 0.2 s | Árvore do Bend (listas Con/Nil) sem DOM: o aplicador é o view-host (testado | 12 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| color-roles-ui.mjs | win | 270 | 12 s | Papéis de cor nos dois temas (ticket #6 da spec de redesenho): mede na | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| config.test.mjs | unit | 141 | 0.2 s | a folder of PDFs is a course even without _state.md | 13 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| core.test.mjs | unit | 486 | 6.6 s | Carrega o main.cjs REAL com um módulo `electron` de mentira, para exercitar os | 13 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| cores-parity.mjs | other | 105 | — | Paridade dos núcleos de matérias/estudo do desk: lógica antiga (referência | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| hunt-calc-ggb.mjs | hunt | 667 | 30 s | Caça a bugs da onda Bend (calculadora, GeoGebra e status/indicador de modelo). | 0 | 0 | 1 | 0 | C: blocos do avaliador da calculadora (exemplos do guia, recípr → core.test.mjs (calculator) + calculator-ui.mjs + calcview.test.mjs |
| layout-presets.test.mjs | unit | 344 | 0.2 s | Layouts pessoais — política pura. O main (`layout-presets.cjs`) e o renderer | 20 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| layout-rules-ui.mjs | win | 193 | 7 s | Regras de layout (ticket #7 da spec de redesenho): mede na janela real o que | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| layout-settings.test.mjs | unit | 343 | 0.2 s | Editor visual de `desk.panels` (`src/layout-settings.mjs`). | 11 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| lib-limits.test.mjs | unit | 77 | 4.4 s | Limites de texto grande da Mesa (issue bendlang/bend#798, acumulador do | 6 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| lib.test.mjs | unit | 97 | 0.2 s | Geometria real do autor: interna 2560x1664 à direita (x=0), LG 1920x1080 à | 11 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| responsive-chat-calc-ui.mjs | win | 189 | 14 s | R3 pós-R2 — a coluna da conversa x calculadora na geometria PADRÃO real | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| responsive-ui.mjs | win | 213 | 12 s | QA responsivo real (finding R2 8): janela 900×650 (mínima do app) com 1 e 2 | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| settings-resources-ui.mjs | win | 116 | 9 s | Integração Electron isolada: preferências, persistência e aviso do updater. | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| settings-sections-ui.mjs | win | 454 | 9 s | Configurações com seções na lateral (ticket #20 da spec de redesenho): mede e | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| settingsview.test.mjs | unit | 93 | 0.2 s | Contrato do artefato `settingsview.core.js` (gerado de core/settingsview.bend): | 7 | 0 | 0 | 3 | D: seção desconhecida ou vazia cai em Matérias → core/laws/settingsview.bend + core/proofs/settingsview.bend<br>D: setas da lateral: vizinhas cíclicas → core/laws/settingsview.bend + core/proofs/settingsview.bend<br>D: navegação: cinco botões, só a seção corrente leva aria-curre → core/laws/settingsview.bend + core/proofs/settingsview.bend |
| snapshot.test.mjs | unit | 78 | 0.6 s | O snapshot público da Mesa é `desk/` sem o app irmão `chat/`. | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| state-parity.mjs | other | 185 | — | Paridade do estado persistido da Mesa: lógica antiga (referência inline, como | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| wheel.test.mjs | unit | 25 | 0.2 s | wheel at the bottom turns to the next page after the threshold | 5 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |

## Raia estudo-backup

| arquivo | tipo | linhas | tempo | o que protege | R | F | C | D | decisão |
|---|---|---:|---:|---|---:|---:|---:|---:|---|
| deletion-undo.test.mjs | unit | 108 | 0.2 s | Registry de tokens do Desfazer (`desk/deletion-undo.cjs`) com o núcleo real | 8 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| study-activity-backup.test.mjs | unit | 32 | 0.3 s | activity documents and attempt state remain reachable after backup relocation | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| study-backup-cli.test.mjs | unit | 132 | 1.6 s | O CLI é a porta headless (backup com o app fechado, conferência, ensaio de | 3 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| study-backup-e2e.mjs | win | 64 | 3 s | App/IPC/renderer reais, configurações em userData temporário, sem override | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| study-backup-fixtures.mjs | win | 136 | — | Fixtures sintéticas para os testes de backup/compartilhamento (nada de | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| study-backup-host.test.mjs | unit | 257 | 0.5 s | Integração do HOST de backup (study-backup-host.cjs) sem Electron: os | 5 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| study-backup-panel-git.test.mjs | unit | 309 | 0.2 s | Ação manual de push do Git no painel e o opt-in de remapeamento de material | 5 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| study-backup-panel.test.mjs | unit | 585 | 0.2 s | Painel Backup/Compartilhar sem navegador: um DOM mínimo (sem dependência | 9 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| study-backup.test.mjs | unit | 800 | 1.2 s | Backup local + restauração, com runtime sintético e SEM Electron. O que a | 26 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| study-core-build.mjs | other | 109 | — | Build temporário dos núcleos novos de estudo (estatísticas e agenda do | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| study-git-backup.test.mjs | unit | 335 | 3.2 s | Destino Git do backup: repositórios git LOCAIS de verdade (sem rede, sem | 2 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| study-history-retention.test.mjs | unit | 133 | 0.8 s | Histórico antigo (>7 dias) continua existindo: prova de comportamento contra | 3 | 0 | 0 | 2 | D: nenhum módulo do Mesa apaga sessão por idade → varredura de fonte; o guardião comportamental é "o Pi continua lendo uma sessão de 40 dias" + "a Conversa agrupa…" no mesmo arquivo<br>D: o repositório não tem política de expiração de 7 dias para c → idem (varredura de fonte) |
| study-integration-edge.test.mjs | unit | 58 | 0.3 s | quadros divididos reservam a métrica quando ela chega; replay alterado não duplica | 5 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| study-notes-portable.test.mjs | unit | 211 | 0.3 s | Anotações de página (pdf-notes) no pacote portátil: exportar NUNCA leva o | 6 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| study-packages.test.mjs | unit | 424 | 0.4 s | Compartilhar matéria: pacote portátil com manifesto, importação que cria | 18 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| study-restore-materials.test.mjs | unit | 427 | 0.9 s | Restauração com material de matéria: a versão guarda a cópia em | 13 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| study-review-fixes.test.mjs | unit | 132 | 1.2 s | compartilhar A exporta só conversas com dono A, no formato atual e no legado | 7 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| undo-core-build.mjs | other | 23 | — | Resolve o núcleo do Desfazer (`core/undoview.bend`). | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |

## Raia estudo-resto

| arquivo | tipo | linhas | tempo | o que protege | R | F | C | D | decisão |
|---|---|---:|---:|---|---:|---:|---:|---:|---|
| bookmarks.test.mjs | unit | 143 | 0.2 s | Favoritos nomeados do leitor (Mesa). | 11 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| chat-library-ui.mjs | win | 64 | 3 s |  | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| chat-library.test.mjs | unit | 42 | 0.2 s | conversa de um ano continua disponível e rótulo não modifica sessão | 4 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| chat-state.test.mjs | unit | 27 | 0.2 s | rascunho e leitores são restaurados por conversa sem mudar tema ou enviar fila | 3 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| course-materials.test.mjs | unit | 133 | 0.3 s | cópia Livre para matéria preserva original, homônimos e descoberta com Sources | 7 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| hunt-qol-ipc.mjs | hunt | 83 | 2 s | Preload/IPC reais e persistência normal em userData temporário, sem override | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| hunt-qol-undo.mjs | hunt | 45 | 3 s | Electron real, backend real e material sintético. O botão do modal precisa | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| hunt-review-today.mjs | hunt | 182 | 1 s | Caça a bugs do "Revisar hoje" (agenda do caderno) na janela real: a fila do | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| hunt-review.mjs | hunt | 249 | 3 s | Caça a bugs do caderno de revisão (pedido 6): guardar de uma resposta do Pi | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| hunt-study-stats.mjs | hunt | 187 | 17 s | Caça a bugs do painel de Estatísticas na janela real: o botão aparece, o | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| material-preview-host.test.mjs | unit | 34 | 0.2 s | preview returns transient bytes tied to immutable revision | 4 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| material-preview-ui.mjs | win | 53 | 31 s | Synthetic runtime, real preload/IPC and Electron PDF generation; no provider. | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| pdf-notes-undo.test.mjs | unit | 208 | 0.3 s | Desfazer nas Anotações de página (`desk/src/study-data/annotations.cjs`). | 9 | 0 | 2 | 0 | C: token vence no prazo do host → deletion-undo.test.mjs: "prazo do host…"<br>C: token inventado não permite reinserção arbitrária → deletion-undo.test.mjs: "token inventado, vazio ou acima do teto…" |
| pdf-notes.test.mjs | unit | 275 | 0.3 s | Anotações de página (Mesa): o módulo de host `src/study-data/annotations.cjs`. | 14 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| review-draft.test.mjs | unit | 46 | 0.2 s | draft validates model JSON, applies limits and preserves only the supplied reference | 5 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| review-schedule.test.mjs | unit | 307 | 0.3 s | Agenda do caderno de revisão (Mesa) — `runtime/review-schedule.json`. | 17 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| review-undo.test.mjs | unit | 254 | 0.3 s | Desfazer no Caderno de revisão (`desk/review.cjs` + `deletion-undo.cjs`). | 10 | 0 | 2 | 0 | C: token vence no prazo do host e não desfaz depois → deletion-undo.test.mjs: "prazo do host: vence no instante exato…" (o módulo compartilhado `deletion-undo.cjs`)<br>C: token inventado não permite reinserção arbitrária → deletion-undo.test.mjs: "token inventado, vazio ou acima do teto nunca vira reinserção" |
| review-visibility.test.mjs | unit | 76 | 0.2 s | Visibilidade do caderno: item com referência fora da biblioteca (ou com | 5 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| review.test.mjs | unit | 188 | 0.2 s | Caderno de revisão (Mesa). | 11 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| study-features-ui.mjs | win | 70 | 6 s | Integração de serviços e interface reais com Pi simulado e dados sintéticos. | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| study-ipc.test.mjs | unit | 145 | 2.4 s | Busca e anotações pela IPC REAL do app (main.cjs + preload.cjs + serviços). | 2 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| study-search.test.mjs | unit | 591 | 0.8 s | Busca de estudos (Mesa): o módulo de host `src/study-data/search.cjs`. | 21 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| study-services.test.mjs | unit | 142 | 0.3 s | Integração pelo adapter do host (`desk/src/study-data/services.cjs`). | 6 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| study-stats-ui.test.mjs | unit | 257 | 0.2 s | Painel de Estatísticas (renderer independente). | 7 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| study-stats.test.mjs | unit | 354 | 2 s | Estatísticas locais de estudo (Mesa). | 19 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| study-ui.test.mjs | unit | 323 | 5.4 s | Diálogos da busca e das anotações (Mesa): teste de UI com Electron de verdade. | 8 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| study.test.mjs | unit | 28 | 0.2 s | a persisted Xournal file is reauthorized when its session is restored | 2 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| studycontext.test.mjs | unit | 119 | 0.3 s | Contexto de estudo da Mesa: o núcleo Bend decide o que entra e se o bloco vai | 12 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| undo-notice-ui.test.mjs | unit | 310 | 0.2 s | Aviso "Desfazer" (`desk/src/undo-deletion.mjs`) com DOM de mentira. | 9 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |

## Raia fila-timeline-worklog

| arquivo | tipo | linhas | tempo | o que protege | R | F | C | D | decisão |
|---|---|---:|---:|---|---:|---:|---:|---:|---|
| attachview.test.mjs | unit | 60 | 0.2 s | Uso da Mesa: só imagens anexadas, com o `alt`/rótulo próprios e o handler | 0 | 0 | 0 | 3 | D: anexo da Mesa: img lazy, alt "Anexo:" e × com aria-label → core/laws/attachview.bend + core/proofs/attachview.bend<br>D: sem nome: alt "Imagem anexada" e rótulo "Remover imagem" → core/laws/attachview.bend + core/proofs/attachview.bend<br>D: lista de anexos preserva ordem e keys → core/laws/attachview.bend + core/proofs/attachview.bend |
| capture-lock.test.mjs | unit | 52 | 0.2 s | D7/B6 — a trava do Conferir Xournal++: clique duplo não duplica a captura e | 4 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| hunt-chat.mjs | hunt | 1008 | 63 s | Caça a bugs da onda Bend no escopo do chat/diário (Mesa de Estudos). | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| hunt-queue.mjs | hunt | 309 | 48 s | Caça a bugs da fila/steer da Mesa (mesma feature da Conversa, sobre o núcleo | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| hunt-timeline.mjs | hunt | 306 | 18 s | Caça à linha do tempo do turno (Mesa de Estudos): ordem ao vivo e ao | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| pending.test.mjs | unit | 166 | 1 s | Fila e bandeja guardadas no disco (Mesa). | 7 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| queue-retry.test.mjs | unit | 24 | 0.2 s | queue retries use 2/4/8 seconds then hold without losing the item | 3 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| resume.test.mjs | unit | 134 | 0.2 s | Registro do "Encerrar por hoje" (Mesa). | 7 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| send-offline-ui.mjs | win | 259 | 23 s | testado na janela com o Pi de teste. Cobre os critérios de aceite: | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| send-offline.test.mjs | unit | 57 | 0.2 s | Enviar com o tutor desligado (ticket #18): as regras que o host (`queue.mjs`) | 0 | 0 | 0 | 8 | D: tutor desligado e livre: a mensagem é guardada (e o tutor é  → core/laws/pending.bend (keptWhileOff, stripLabel, tutorAnswered, holdAfterAnswer) + proofs/pending.bend<br>D: só anexo também é guardado; texto em branco sem anexo não → core/laws/pending.bend (keptWhileOff, stripLabel, tutorAnswered, holdAfterAnswer) + proofs/pending.bend<br>D: tutor ligado: nada é guardado, a mensagem vai direto → core/laws/pending.bend (keptWhileOff, stripLabel, tutorAnswered, holdAfterAnswer) + proofs/pending.bend<br>D: com a resposta em andamento a fila de sempre cuida: não é "g → core/laws/pending.bend (keptWhileOff, stripLabel, tutorAnswered, holdAfterAnswer) + proofs/pending.bend<br>D: comando digitado (/compact, /conferir) não é guardado como m → core/laws/pending.bend (keptWhileOff, stripLabel, tutorAnswered, holdAfterAnswer) + proofs/pending.bend<br>D: a faixa diz "Guardada" quando o tutor não atendeu; recuperad → core/laws/pending.bend (keptWhileOff, stripLabel, tutorAnswered, holdAfterAnswer) + proofs/pending.bend<br>D: a fila só sai quando o tutor passa a atender (e não a cada c → core/laws/pending.bend (keptWhileOff, stripLabel, tutorAnswered, holdAfterAnswer) + proofs/pending.bend<br>D: tutor atendeu e a fila está vetada por incerteza/cancelament → core/laws/pending.bend (keptWhileOff, stripLabel, tutorAnswered, holdAfterAnswer) + proofs/pending.bend |
| settled-ui.mjs | win | 22 | 5 s | bloco settled | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| talkview.test.mjs | unit | 122 | 0.2 s | bolha vem do Bend com role, body HTML opaco, imagem e ações por Bool | 7 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| timeline-late.mjs | win | 310 | 34 s | Regressão dos achados N1/N2/N3 da revisão final independente de 2026-10-08: | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| timeline-noid.mjs | win | 138 | 9 s | Regressão da identidade sintética do Pi (achado B da revisão independente de | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| timeline-pi.mjs | other | 623 | — | Pi sintético do hunt-timeline (fixture PRÓPRIA; não altera fake-pi.mjs nem | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| timeline.test.mjs | unit | 122 | 0.2 s | Linha do tempo do turno (desk/src/timeline.mjs): segmentos com limites | 8 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| worklog-parity.mjs | other | 230 | — | Paridade do adaptador do worklog: roda um roteiro determinístico de eventos | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| worklog-view.test.mjs | unit | 188 | 0.2 s | kindName e statusName batem com data-* do DOM | 11 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| worklog.test.mjs | unit | 260 | 0.2 s | toolKind separa busca, referência e leitura | 18 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |

## Raia leitor-pdf

| arquivo | tipo | linhas | tempo | o que protege | R | F | C | D | decisão |
|---|---|---:|---:|---|---:|---:|---:|---:|---|
| find-parity.mjs | other | 51 | — | Paridade do "Buscar neste PDF": lógica antiga do pdf.mjs × núcleo Bend | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| hunt-bench.cjs | hunt | 13 | — | Sonda de isolamento: abre hunt-bench.html numa janela Electron oculta e | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| hunt-nav.mjs | hunt | 405 | 4 s | Caça a bugs da navegação entre a resposta e o material (pedido 5): a citação | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| hunt-pdf-codecs.mjs | hunt | 45 | 1 s | Regressão de conteúdo que sumia: imagem JBIG2 sintética, sem material de curso. | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| hunt-pdf-qol.mjs | hunt | 437 | 5 s | QoL do leitor de PDF, no app de verdade (Electron, runtime sintético e Pi de | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| hunt-pdf-render-race.mjs | hunt | 65 | 2 s | Um getPage deliberadamente atrasado não pode repintar uma página descartada. | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| hunt-pdf-retention.mjs | hunt | 230 | 9 s | Retenção de canvas/textLayer no leitor de PDF: um passeio REAL (Electron, | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| hunt-pdf.mjs | hunt | 398 | 11 s | Caça a bugs do leitor de PDF da Mesa: fase offline (fuzz do destaque da | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| pdf-labels.test.mjs | unit | 282 | 0.2 s | Numeração impressa e PDF solto: unidade do host (pdf-labels/pdf-drop) e do | 18 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| pdf-rotation.mjs | win | 480 | 11 s | Rotação de 90° por leitor (pedido do usuário: "girar o PDF"). | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| pdfnav.test.mjs | unit | 130 | 0.2 s | Navegação do leitor no artefato (`core/pdfnav.bend` → `src/generated/pdfnav.core.js`). | 10 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| pdfpageview.test.mjs | unit | 286 | 0.2 s | DOM falso mínimo: só o que o aplicador usa (o fragmento "puxa" os filhos | 14 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| pdfview.test.mjs | unit | 113 | 0.2 s | gridFlags: os quatro pares de minimizar | 8 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| reader-bar-ui.mjs | win | 278 | 14 s | Barra única do leitor (ticket #11 da spec de redesenho): cada leitor tem UMA | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| reader-empty-ui.mjs | win | 307 | 14 s | Leitor sem material (ticket #12 da spec de redesenho): numa matéria sem PDFs | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| readersheet.test.mjs | unit | 93 | 0.2 s | DOM falso mínimo (o mesmo desenho do `pdfpageview.test.mjs`): o aplicador só | 6 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |

## Raia livre-materia

| arquivo | tipo | linhas | tempo | o que protege | R | F | C | D | decisão |
|---|---|---:|---:|---|---:|---:|---:|---:|---|
| course-drop-folder.test.mjs | unit | 37 | 0.2 s | "Mostrar a pasta" da folha Lista 0 tem de abrir a pasta que a biblioteca | 4 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| course-pdf-ui.mjs | win | 62 | 4 s | UI, ponte HTTP e impressão reais; tutor simulado, nenhum material pessoal. | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| first-run-drop.test.mjs | unit | 87 | 0.2 s | Tudo numa pasta temporária: nada toca a pasta pessoal nem material de curso. | 7 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| free-host-ipc.test.mjs | unit | 682 | 17.1 s | Integração IPC REAL da aba Livre no host (main.cjs/preload.cjs), com Electron | 6 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| free-material-pdf.test.mjs | unit | 167 | 5 s | Teste do serviço de PDF da aba Livre (desk/material-pdf.cjs + print.*) com | 8 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| free-pdf-runner.cjs | win | 224 | — | Wrapper isolado do serviço de PDF: roda DENTRO do Electron (main), exercita | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| free-promotion.test.mjs | unit | 221 | 0.3 s | Testes do diário externo da promoção Livre → matéria | 5 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| free-study-integration-ui.mjs | win | 95 | 5 s | Fluxo UI + preload/IPC/host e impressão Electron REAIS, com Pi simulado e | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| free-study-ui.mjs | win | 453 | 6 s | Teste real do renderer Livre e loadCourse, com APIs livres simuladas. | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| free-workspaces.test.mjs | unit | 570 | 0.6 s | Testes do store da aba Livre (desk/free-workspaces.cjs): ciclo de vida do | 27 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| freeworkspaces-parity.mjs | other | 54 | — | Paridade do contrato da aba Livre: os limites, a sequência de nomes e o | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| hunt-pdf-drop-scope.mjs | hunt | 49 | 1 s | Resposta IPC atrasada não pode adicionar PDF à matéria que abriu depois. | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| material-template-dialog-ui.mjs | win | 102 | 21 s | UI do diálogo de PDF (Playwright + runtime sintético): diagnóstico de erro de | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| material-template-ui.mjs | win | 199 | 0 s | Cenários sintéticos do template de material, executados DENTRO do Electron | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| material-template.test.mjs | unit | 404 | 2.5 s | Testes do template de material: tokenizador de matemática (cifrão/dinheiro, | 25 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| pdf-drop-host.test.mjs | unit | 21 | 0.2 s | arquivo solto precisa ser PDF local real antes de entrar na biblioteca | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| subjects-ui.mjs | win | 34 | — | subjects-ui usa o Pi REAL (sem fake-pi) e descobre matérias pelo vault (seedConfig). | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| subjects.test.mjs | unit | 4 | 0.3 s | subjects require course configuration; libraries follow Sources and deduplicate canonical roots | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |

## Raia pi-bilhete

| arquivo | tipo | linhas | tempo | o que protege | R | F | C | D | decisão |
|---|---|---:|---:|---|---:|---:|---:|---:|---|
| appcontract.test.mjs | unit | 257 | 0.2 s | Contrato entre os dois apps irmãos (Mesa/desk e Conversa/chat). | 9 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| capture-new-ui.mjs | win | 75 | 69 s | Capturas da UI real com conteúdo sintético. Não acessa cursos pessoais, | 0 | 0 | 0 | 1 | D: (arquivo inteiro, sem asserção) → só captura telas (69 s) sem asserção; guardiões: as janelas *-ui.mjs que medem as mesmas telas |
| capture-win.test.mjs | unit | 62 | 0.2 s | A captura do Windows (PowerShell + .NET do sistema) sem Windows: o script é | 4 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| fake-pi-dialog.mjs | other | 48 | — | Fake do Pi para exercitar o `#pi-dialog` (pergunta do Pi) no hunt-shell: | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| fake-pi.mjs | other | 233 | — | Fake do Pi para os smokes. Modos de caos via FAKE_PI_CHAOS (combináveis por vírgula; | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| framing-parity.mjs | other | 105 | — | Paridade host × `core/framing.bend` (gêmeo da Mesa). | 5 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| handoff.test.mjs | unit | 690 | 0.3 s | Bilhete da Conversa → Mesa. | 37 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| hunt-handoff.mjs | hunt | 174 | 0 s | Bilhete Conversa → Mesa de ponta a ponta, com os DOIS apps de verdade. | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| hunt-pi.mjs | hunt | 210 | — | Fake do Pi para a caça adversarial (`desk/tests/hunt-chaos.mjs`). | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| menu-conferir-ipc-smoke.mjs | win | 84 | 1 s | Smoke de CONTRATO do menu nativo para a flag `desk.conferir`. | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| pi-contract.mjs | other | 80 | — |  | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| pi-prompt-capture-ipc-smoke.mjs | win | 109 | 1 s | Smoke de CONTRATO do contexto de estudo no `pi-prompt` real (preload + main + | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| pi.test.mjs | unit | 52 | 0.3 s | Um app aberto pelo Finder nasce com PATH mínimo (/usr/bin:/bin:...), e o que o | 5 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| rpc-settled.test.mjs | unit | 33 | 0.7 s | ${app}: end is not idle; settled closes retries, queue and compaction | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| rpc.test.mjs | unit | 166 | 2.8 s | N1 da revisão final: a corrida 1 fica com a mensagem aberta e a ferramenta | 8 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| send.test.mjs | unit | 580 | 0.3 s | Ciclo de envio de um prompt: o que conta como entregue (desk/send.cjs). | 13 | 1 | 0 | 0 | F: último teste: inspeção do fonte do main → passa a exercitar o ciclo de `desk/send.cjs` (comportamento), sem mover o handler |
| session-switch.mjs | win | 49 | — | Usa o Pi real da máquina (como subjects-ui): o fake-pi não muda o uso por sessão de | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |

## Raia sidechat

| arquivo | tipo | linhas | tempo | o que protege | R | F | C | D | decisão |
|---|---|---:|---:|---|---:|---:|---:|---:|---|
| sidechat-claude-ipc-smoke.mjs | win | 260 | 3 s | Smoke de CONTRATO do chat lateral Claude pela ponte REAL (preload + main + | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| sidechat-claude-recoverable-ui.mjs | win | 37 | — | Main/preload/native fake/renderer regression: partial → recoverable error → | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| sidechat-claude.test.mjs | unit | 170 | 0.2 s | Fábrica do canal Claude do chat lateral: wiring do descritor PRÓPRIO, cache de | 5 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| sidechat-draft-reload.mjs | win | 277 | 8 s | Finding R4: o rascunho novo (B) era perdido no reload quando o backend já | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| sidechat-ipc-smoke.mjs | win | 141 | 2 s | Smoke de CONTRATO do chat lateral na ponte real (preload + main + fake Pi): | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| sidechat-layout-ui.mjs | win | 226 | 23 s | Chat lateral no padrão novo (ticket #19): ao lado de um leitor ele segue as | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| sidechat-pi.test.mjs | unit | 161 | 0.8 s | Integração do chat lateral com o Pi de teste (fake-pi.mjs): canal próprio, | 3 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| sidechat-questions-ui.mjs | win | 35 | 1 s | Renderer Electron real + canal controlado: validação, seleção múltipla, | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| sidechat-scope.test.mjs | unit | 32 | 0.2 s | Contrato do artefato `sidechat.core.js` (gerado de core/sidechat.bend, | 0 | 0 | 0 | 4 | D: um material: nome, página e que não entra na sessão principa → core/laws/sidechat.bend (scopeLine, scopeRefresh) + core/proofs/sidechat.bend<br>D: dois materiais: na ordem dos leitores, em vírgula → core/laws/sidechat.bend (scopeLine, scopeRefresh) + core/proofs/sidechat.bend<br>D: sem material aberto a linha diz isso e ainda diz o escopo → core/laws/sidechat.bend (scopeLine, scopeRefresh) + core/proofs/sidechat.bend<br>D: a ação que renova o contexto tem um nome só → core/laws/sidechat.bend (scopeLine, scopeRefresh) + core/proofs/sidechat.bend |
| sidechat-ui-races.mjs | win | 232 | 5 s | Chat lateral — corridas do frontend (finding R2 1–5) com bridge CONTROLADO: | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| sidechat-ui.mjs | win | 275 | 11 s | Smoke Electron da área de apoio + chat lateral (frontend). | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| sidechat.test.mjs | unit | 831 | 0.3 s | Testes do chat lateral (backend puro): isolamento, escopo/id antigo, | 34 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |

## Raia updater-infra

| arquivo | tipo | linhas | tempo | o que protege | R | F | C | D | decisão |
|---|---|---:|---:|---|---:|---:|---:|---:|---|
| components.test.mjs | unit | 211 | 0.2 s | Painel "Componentes" com tudo injetado (fetch e comandos falsos, sem rede): | 9 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| coregate.test.mjs | unit | 230 | 0.3 s | Chave do cache do portão do núcleo (scripts/gate-hash.mjs). | 15 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| design-check.mjs | win | 7 | — |  | 0 | 0 | 0 | 1 | D: (arquivo inteiro, sem asserção) → script de 6 linhas sem asserção; coberto por syntax-check.mjs e pelo portão `check` |
| electron-env.mjs | other | 15 | — | Window tests never reach the real Claude binary that the SDK package | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| gitreal.test.mjs | unit | 199 | 2.2 s | D1 — git DE VERDADE (remoto bare temporário, sem rede): portão de clone | 6 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| helpers.mjs | win | 352 | — | Boot compartilhado dos smokes de UI (ui-smoke/subjects-ui) + artefatos de falha. | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| installed-smoke.mjs | win | 17 | — |  | 0 | 0 | 0 | 1 | D: (arquivo inteiro, sem asserção) → abre o app instalado do usuário (proibido nesta rodada); a mesma cadeia sobe em app-smoke.mjs |
| layout-measure.mjs | other | 212 | — | Medidas de layout compartilhadas pelos testes de janela (ticket #7 da spec de | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| parity.mjs | other | 34 | — | A lista vem da varredura, não de uma lista à mão: foi uma lista à mão que | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| performance-smoke.mjs | win | 46 | — | Benchmark local com dois PDFs sintéticos e Pi fake; não acessa dados reais. | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| profiles.test.mjs | unit | 132 | 0.2 s | Perfil da Mesa: a lista declarada é o contrato. O que estes testes garantem é | 9 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| reference-fixture.mjs | other | 14 | — |  | 0 | 0 | 0 | 1 | D: (arquivo inteiro, sem asserção) → script de apoio sem asserção; não é chamado por runner nem teste |
| reference-live.mjs | win | 13 | — |  | 0 | 0 | 0 | 1 | D: (arquivo inteiro, sem asserção) → manual, sem asserção; guardião: fixtures de referência em tests/fixtures + pdf*.test.mjs |
| run-hunts.mjs | other | 81 | — | Corre os hunts (`tests/hunt-*.mjs`) em paralelo. | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| smoke-x3.mjs | other | 15 | — | Roda tests/ui-smoke.mjs três vezes seguidas; para no primeiro fracasso propagando o exit code. | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| syntax-check.mjs | other | 46 | — | Um `node --check` por arquivo, vários de uma vez: em série isto custava ~25s | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| updateflow.test.mjs | unit | 593 | 1.3 s | Aplicação do updater em raiz fake (modos git e zip), SEM rede e SEM processo | 16 | 0 | 3 | 0 | C: modo git: pull --ff-only; npm ci só quando o lock mudou → gitreal.test.mjs "D1: update real com git — pull ff, versão CONFERIDA, sem npm ci sem lock novo" (git de verdade)<br>C: modo git: clone com trabalho local é recusado antes de qualq → gitreal.test.mjs "D1: clone com trabalho local… é recusado SEM destruir nada"<br>C: modo git: pull falha → rollback, git reset e a versão antiga → gitreal.test.mjs "D1: remoto divergiu… rollback volta a versão antiga de verdade" |
| updater.test.mjs | unit | 353 | 1.8 s | Checagem do updater com fetch falso (NUNCA rede de verdade): semver, cache | 24 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| watchdog-ui.mjs | win | 40 | — | O watchdog (src/state.mjs) pinga a saúde a cada 15s. Enquanto o Pi reporta streaming, cada | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| zipkit.mjs | other | 80 | — | Zip mínimo para os testes do updater (store e deflate). O updater lê o zip | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |

## Raia visoes-a

| arquivo | tipo | linhas | tempo | o que protege | R | F | C | D | decisão |
|---|---|---:|---:|---|---:|---:|---:|---:|---|
| auxview.test.mjs | unit | 194 | 0.2 s | Contrato do artefato `auxview.core.js` (gerado de core/auxview.bend) para os | 9 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| composerbox.test.mjs | unit | 67 | 0.2 s | Contrato do artefato `composerbox.core.js` (gerado de core/composerbox.bend, | 5 | 0 | 0 | 1 | D: referências desligadas: a linha acompanha o alternador e não → core/laws/composerbox.bend + core/proofs/composerbox.bend |
| deskflags.test.mjs | unit | 67 | 0.2 s | Contrato do artefato `deskflags.core.js` (gerado de core/deskflags.bend): | 3 | 0 | 0 | 2 | D: referências do composer: id, pressed corrente e hidden pela  → core/laws/deskflags.bend + core/proofs/deskflags.bend<br>D: sem o botão de referências, pressed fica forçado e o botão s → core/laws/deskflags.bend + core/proofs/deskflags.bend |
| dialogsview.test.mjs | unit | 460 | 0.2 s | DOM falso mínimo para os aplicadores dos diálogos: o mesmo espírito do | 15 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| escape-policy.test.mjs | unit | 148 | 0.2 s | Política do Esc: o núcleo Bend decide a PRIMEIRA camada aberta, na ordem | 12 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| firstrun.test.mjs | unit | 211 | 0.2 s | DOM falso mínimo (o mesmo desenho do `readersheet.test.mjs`): o aplicador só | 16 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| shortcutview.test.mjs | unit | 130 | 0.2 s | diálogo e seções preservam o contrato de DOM e a ordem | 6 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| slashview.test.mjs | unit | 139 | 0.2 s | Contrato do artefato `slashview.core.js` (gerado de core/slashview.bend, | 5 | 0 | 0 | 3 | D: linhas: id por índice, key, papel, ARIA e handlers do host → core/laws/slashview.bend + core/proofs/slashview.bend<br>D: linhas: sem ativo nenhuma acende; id cresce na ordem da list → core/laws/slashview.bend + core/proofs/slashview.bend<br>D: check: slot nasce em toda linha e o SVG é do host → core/laws/slashview.bend + core/proofs/slashview.bend |
| statusview.test.mjs | unit | 129 | 0.2 s | Contrato do artefato `statusview.core.js` (gerado de core/statusview.bend). | 4 | 0 | 0 | 3 | D: rodapé vazio fica hidden, sem tooltip → core/laws/statusview.bend + core/proofs/statusview.bend<br>D: medidor: hidden, classes warn/hot e barra em % → core/laws/statusview.bend + core/proofs/statusview.bend<br>D: modelo, sessão e balão → core/laws/statusview.bend + core/proofs/statusview.bend |
| tabsview.test.mjs | unit | 189 | 0.3 s | Árvore do Bend (listas Con/Nil) sem DOM: o aplicador é testado em | 3 | 0 | 0 | 7 | D: abas: matérias, "+", separador, Caderno e GeoGebra na ordem → core/laws/tabsview.bend + core/proofs/tabsview.bend<br>D: abas: GeoGebra desativa a matéria e ativa a própria aba → core/laws/tabsview.bend + core/proofs/tabsview.bend<br>D: abas: disabled é fato, não texto; o "+" e o Caderno ficam se → core/laws/tabsview.bend + core/proofs/tabsview.bend<br>D: Caderno: aba com a contagem de revisar hoje → core/laws/tabsview.bend + core/proofs/tabsview.bend<br>D: menu Estudar: rótulo do toggle, ARIA e painel único → core/laws/tabsview.bend + core/proofs/tabsview.bend<br>D: menu Estudar: Xournal++ segue a flag e a plataforma → core/laws/tabsview.bend + core/proofs/tabsview.bend<br>D: menu Ajustes: Configurações, Ajuda, Atalhos e Sobre → core/laws/tabsview.bend + core/proofs/tabsview.bend |
| toast-view.test.mjs | unit | 148 | 0.2 s | DOM falso mínimo: só o que o aplicador usa (movimentação de nós inclusive, | 9 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| tutorheader.test.mjs | unit | 143 | 0.2 s | Contrato do artefato `tutorheader.core.js` (gerado de core/tutorheader.bend): | 7 | 0 | 0 | 8 | D: sessão nova: o motor padrão primeiro, o Claude Code (experim → core/laws/tutorheader.bend + core/proofs/tutorheader.bend<br>D: mais opções: exportar, Encerrar por hoje, contexto, compacta → core/laws/tutorheader.bend + core/proofs/tutorheader.bend<br>D: mais opções: a compactação é um interruptor e o contexto não → core/laws/tutorheader.bend + core/proofs/tutorheader.bend<br>D: indicador: esforço desconhecido segue como veio → core/laws/tutorheader.bend + core/proofs/tutorheader.bend<br>D: indicador: é um botão que abre o popover, com o estado em da → core/laws/tutorheader.bend + core/proofs/tutorheader.bend<br>D: popover: desligado explica e oferece chamar o tutor → core/laws/tutorheader.bend + core/proofs/tutorheader.bend<br>D: popover: ligado num motor que não troca nada diz isso em vez → core/laws/tutorheader.bend + core/proofs/tutorheader.bend<br>D: mais opções: Resumir agora entra depois da compactação autom → core/laws/tutorheader.bend + core/proofs/tutorheader.bend |
| tutorstate.test.mjs | unit | 151 | 0.2 s | Contrato do artefato `tutorstate.core.js` (gerado de core/tutorstate.bend): | 9 | 0 | 0 | 4 | D: sem resposta com retomada guardada ainda mostra o motivo (o  → core/laws/tutorstate.bend + core/proofs/tutorstate.bend<br>D: ligado: sem retomada não há bloco; com retomada o bloco de r → core/laws/tutorstate.bend + core/proofs/tutorstate.bend<br>D: motivo com código de saída vira uma frase em português, sem  → core/laws/tutorstate.bend + core/proofs/tutorstate.bend<br>D: texto da caixa de mensagem por estado do tutor → core/laws/tutorstate.bend + core/proofs/tutorstate.bend |
| view-host-attrs.test.mjs | unit | 184 | 0.2 s | Contrato de attrs do aplicador: o primeiro attr de cada nome vence — a | 7 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| view-host.test.mjs | unit | 183 | 0.2 s | DOM falso mínimo: só o que o aplicador usa (movimentação de nós inclusive, | 10 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |

## Raia visoes-b

| arquivo | tipo | linhas | tempo | o que protege | R | F | C | D | decisão |
|---|---|---:|---:|---|---:|---:|---:|---:|---|
| app-smoke.mjs | win | 73 | — | Opt-in e determinístico: (a) sem bundle → exit 0 com instrução; (b) arquivos-chave presentes | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| composer-box-ui.mjs | win | 417 | 21 s | Cobre cada critério de aceitação: uma caixa só (anexos, campo, fileira); a | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| dialog-standard-ui.mjs | win | 90 | 4 s | Padrão dos diálogos, medido na janela (teste à mão de 2026-10-13). | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| first-run-ui.mjs | win | 612 | 19 s | Primeira abertura dentro do app (ticket #21 da spec de redesenho). Sem | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| hunt-chaos.mjs | hunt | 895 | 147 s | Caça adversarial da Mesa de Estudos (onda de bugs pós-rewrite Bend). | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| hunt-shell.mjs | hunt | 1240 | 38 s | Caça a bugs da Mesa (onda de views do Bend). Roda com o mesmo boot do | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| improvements-ui.mjs | win | 59 | 31 s | Hover and focus cannot open a menu; click/keyboard and Escape own its state. | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| model-indicator-ui.mjs | win | 274 | 5 s | testado na janela. O indicador mora no cabeçalho do tutor com o ponto de | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| qol-actions-ui.mjs | win | 326 | 6 s | QoL da Mesa — UI isolada (Playwright + fake Pi + runtime temporário). | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| splitter-ui.mjs | win | 33 | 2 s | A normal primary-button drag must still resize, as must the keyboard. | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| topbar-ui.mjs | win | 341 | 18 s | Barra superior (ticket #10 da spec de redesenho): marca, abas de matéria | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| tutor-header-ui.mjs | win | 297 | 10 s | título da sessão, chat lateral, sessão nova e mais opções; testado na janela. | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| tutor-states-ui.mjs | win | 373 | 21 s | testados na janela. Desligado (com retomada guardada e sem), ligando (com | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |
| ui-smoke.mjs | win | 1247 | 100 s | a moldura do leitor e o documento vêm da view do Bend (core/pdfpageview.bend) | 1 | 0 | 0 | 0 | R (nada a tirar sem perder contrato; ver camadas no inventário) |

**Totais:** 253 arquivos, 1429 unidades, 53176 linhas — R 1358 · F 2 · C 8 · D 61.

## Correções posteriores ao inventário

Decisões do inventário revistas pela mutação manual (`issue-30-mutacoes.md`):

- **"token vence no prazo do host…" (review-undo, pdf-notes-undo): MANTIDOS (R), não C.** Sem eles a mutação "ignorar `at`" em `review.cjs`/`annotations.cjs` passa; só "token inventado" foi removido.
- **`canChangeControls` (native-controls): R**, não D — é paridade host↔núcleo, não repetição de lei.
- **`send.test`**: só o último teste foi aparado (F), o resto fica.
- **Novos guardiões baratos**: `updateflow.test` (pull com `--ff-only`) e `resume.test` ("sem matéria ativa").

## Janelas corrigidas (pedido do usuário via orquestrador; não apagadas nem puladas)

Falhavam na `main` antes do redesenho; ajustadas ao app atual, sem produção tocada e sem asserção enfraquecida:

| arquivo | causa | correção |
|---|---|---|
| `improvements-ui.mjs` | montava `#mesa-menu`, que não existe mais; os menus da barra são `#study-menu` e `#settings-menu` | o laço de clique/teclado/Esc passa a cobrir `study` e `settings` (mesmas 6 asserções por menu; nenhuma ficou sem objeto) |
| `material-preview-ui.mjs` | clicava em `#free-generate-pdf` com `courses: []`: a Mesa abre na primeira abertura e a barra da aba Livre fica escondida | `enterFree(page)` antes do clique |
| `material-template-dialog-ui.mjs` | idem, esperava `#free-bar` visível sem entrar na Livre | `enterFree(page)` no lugar da espera |

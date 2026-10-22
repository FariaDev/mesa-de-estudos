# Integração local em andamento

Implementação autorizada pelo usuário em 2026-10-08. Agentes Pi Mesa Dev com
`commandcode/deepseek/deepseek-v4.1-flash`, `thinking=max`, full access, três
domínios exclusivos. A conclusão depende da integração e revisão independente.

## Canal de PDF implementado pelo pai

- `window.desk.materialPreview({title,markdown,revision,requestId})`.
- `revision`: string não vazia até 128 caracteres, identificando o conteúdo
  imutável no renderer. `requestId`: string não vazia até 64 caracteres,
  identidade nova por solicitação. Título até 120; Markdown até 262144.
- Retorno `{requestId,revision,pdf:Uint8Array,sha256,diagnostics,templateHash}`.
  `pdf` são os bytes, sem material registrado ou arquivo salvo. O renderer
  deve conferir sua revisão ainda ativa antes de mostrar os bytes.
- `window.desk.materialPreviewCancel({requestId})` cancela apenas a identidade
  correspondente. Nova prévia substitui e aborta a anterior.
- Troca de ponte/conversa e encerramento cancelam a prévia. Após qualquer
  await, o host confere trabalho ativo e escopo capturado, mesmo se uma função
  de renderização ignorar AbortSignal. Apenas o WebContents da Mesa tem acesso.
- Implementação: `desk/material-preview-host.cjs`, main/preload.

## Evidência inicial

- Baseline: `node --test tests/*.test.mjs`, 1096 aprovados, zero falhas.
  Log em `/private/tmp/mesa-ui-20261008-baseline/node-tests.log`.
- `node --test tests/material-preview-host.test.mjs`, quatro aprovados:
  revisão/bytes, troca de conversa, substituição/cancelamento e remetente.
- `node tests/material-preview-ui.mjs`: preload/IPC e impressão Electron
  reais, runtime sintético, PDF válido, nenhum PDF salvo e cancelamento real.
- Não houve instalação, atualização ou abertura do app pessoal nem provedor
  real. As verificações do runtime interativo ainda não foram concluídas.

## Referências e verificação adicional

O usuário forneceu artigo OpenUI e sugeriu leitura do T3 nightly. Consulta
registrada em `interactive-ui-reference-openui-t3.md`; referências enviadas aos
agentes ativos como atualização desta implementação.

O teste independente `desk/tests/study-activity-backup.test.mjs` encontrou uma
falha na primeira versão em elaboração do store: ao restaurar em outro runtime,
os arquivos entram no backup, mas o hash do caminho absoluto da conversa impede
encontrá-los pelo caminho relocacionado. Evidência enviada ao agente responsável
para corrigir a identidade portátil e repetir a ida e volta. O teste passou
depois da correção do agente (documento e tentativa alcançáveis após relocação).

## PDF integrado

Template do agente concluído e main agora chama `checkMaterial` antes de
persistir o rascunho, repassando diagnósticos sem destruir conteúdo com erro.
Index tem CSS compartilhado, título120 e botão Ver PDF. Pai corrigiu wiring do
botão estático, checagem de sender da impressão e a corrida durante desenho
pdf.js: compara título/conteúdo capturados a cada await e só publica fragmento
pronto para a revisão ainda ativa. Os36 testes focados e scripts reais
material-preview-ui (inclui edição DURANTE canvas), material-template-dialog-ui
e course-pdf-ui passaram. Revisão independente PDF r4 em execução.

## Atividade integrada parcialmente

`activity-host.cjs` adiciona scopeRef opaco por geração/conversa às APIs de
leitura/estado; callbacks antigos são recusados. Main liga bridge Pi, protocolo,
guardas e renderer; duas provas Node da integração passam. Claude aguarda o
agente de timeline liberar o adaptador antes de sua integração final.

Primeiro teste completo `mesa-interactive-ui.mjs` publicou documento pela ponte
HTTP real, mas o card ficou idle. Root encontrou que o renderer guarda escopo
vazio do pré-boot e descarta o evento ao vivo da primeira conversa Pi vazia;
fix solicitado ao agente responsável. Não é conclusão do gate integrado.

## Retomada após revisão PDF r4

Revisão PDF r4 concluída: um P1 (proteção de código em listas/citações) e três
P2 (headings aninhados, CRLF e placeholders em atributos). Correções delegadas
em task nova `mesa08-pdf-review-fixes-pi-commandcode-r5`; nenhum achado foi
descartado sem reprodução. Root exportou a factory pública `createTutorPdfTool`
para compor as duas ferramentas no mesmo servidor MCP `mesa`, sem usar
registries privados do SDK. Testes tutor/preview host passaram após o refactor.

Com a correção de escopo do agente, o teste integrado avançou: publicação
automática, interação MRUV, tentativa salva, rascunho preservado, ordem da
timeline e reabertura lazy passaram. A restauração do slider ainda falhou:
o throttle descartou a mudança rápida a=4 após o evento inicial a=2, mesmo
salvando a tentativa com posição24. Solicitado coalescing do último estado ao
agente, mantendo limites de escrita; o teste não foi atrasado para mascarar.

Root criou `activity-call-gate.cjs` para correlação Claude: PreToolUse reserva
callRef opaco por ID nativo/hash/conversa/geração/rodada; handler rejeita valores
inventados, alterados, de outra rodada ou encerrados. Duas provas Node passam.
A ligação ao adaptador aguarda handoff da timeline, que ainda tem ownership.

## Timeline entregue e Claude integrado

Handoff timeline r3 recebido (137 focados e hunts de domínio passaram). Root
integrou activity-call-gate e study-tools no adapter; MCP mesa anuncia ambas
ferramentas, hook auto-aprovado reserva referência pelo tool_use_id real.
O teste SDK/MCP e 78 testes de integração passaram. Atualizado mock Electron
de core.test para declarar protocolo e sessão do novo runtime (sem enfraquecer
verificação de produção). `npm test`: 1177 pass / 0 fail; sintaxe325 passou.

Teste Electron Claude novo detectou corrupção real na reconciliação final:
chat usava índice local i em vez de message.contentIndexes fornecido pelo
adapter, sobrescrevendo fala antes da atividade. Root corrigiu índice final
e messageId das deltas; teste agora exige três posições existentes e texto
único, e passou com main/preload/MCP/protocolo reais + provider sintético.
Revisão independente timeline r4 em andamento com esse caso informado.

Correção da evidência anterior: a espera de IPC no teste Pi usava
waitForFunction com async predicate, que trata Promise como truthy antes do
resultado (Playwright coreBundle.js:24413). Por isso “tentativa salva” da rodada
anterior NÃO prova persistência. Root substituiu por poll externo limitado de
page.evaluate await e exige valoresa4+attempt24 antes de recarregar. Validação
integrada completa ainda pendente. Coalescing do agente corrige perda real
possível de mudanças rápidas; rodada atual mede estado corretamente.

Rodada Pi seguinte passou até o fim (`/private/tmp/mesa-interactive-ui-full.log`):
MCP bridge real, publicação automática, MRUV a4/24m, persistência comprovada,
reload lazy + restauraçãoa4, KaTeX offline, loop isolado + Parar sem congelar
Mesa, nova conversa e rejeição de scopeRef antigo. Dialogconfirm do teste agora
é aceito explicitamente. Teste ampliado em seguida inclui expansão conservando
o mesmo iframe e Parar→Abrir com restauração do estado atual. Renderer do agente
passou a reinicializar protocolo por montagem e preservar último estado.

Root identificou ordem insegura no wrapper: HTML cru podia executar script
antes do lockdownRTC. Agente mudou CSP+lockdown+API para o head, antes de
qualquer HTML/CSS fornecido pelo modelo, e incluiu a verificação em seu domínio.
Latepublished após slotstopped deve ficar lazy; correção solicitada ao agente.
Root não alterou arquivos de ownership concorrente.

`hunt-timeline.mjs` repetido após integração/fixroot: order e mixed passaram
(resultado tardio, slot estável, quiz, retry, Parar e troca). Três testes de
host/backup de atividade passaram novamente, incluindo restore para runtime
diferente. Não houve instalação/release/inferência real.

## Revisão timeline r4 recebida

Revisão confirmou independentemente o fix Claude (`contentIndexes`) e apontou
fallback Pi sem message.id perdendo falas quando o conteúdo chega só no final,
mais três símbolos mortos. Nova task de correção r5 tem ownership chat e testes
do domínio, sem tocar integração/adapter. Root pediu identidade por sequência
e reconciliação ordenada com anchors (sem mover o slot/iframe). Precisa nova
revisão depois da resposta. Prévia PDF real foi reexecutada e passou, inclusive
edição durante desenho cliente; expansão/remontagem integrada Pi passou.

## PDF correções r5 recebidas

Template passou para material-2026-10-08.2. Proteção de código e headings agora
usam árvore Markdown recursiva com localização de raw; CRLF normalizado;
substituição matemática percorre nós de texto e preserva atributos como texto.
Root reexecutou quatro conjuntos:39 pass/0fail. Nova revisão independente
`mesa08-pdf-final-review-pi-commandcode-r6` conferirá originalr4 + respostasr5,
com sondas além das fixtures e atenção à sanitização de atributos após DOMPurify.
Pasta vazia após MATH é cosmética e continua fora do escopo autorizado de fixes.

Root acrescentou teste integrado de tema light/dark sem recarregar iframe e
capturas sintéticas em /private/tmp/mesa-ui-visual-proof para inspeção visual.
Leitura identificou falta de tema system no runtime: repassado ao agente antes
do handoff, junto com limites UTF8/hash em mensagens já exigidos pelo plano.
Teste visual adicional falhou (frame detached durante espera tema); diagnóstico
pendente, sem declarar essa rodada aprovada.

Diagnóstico visual seguinte: tema dark/light chegou ao iframe corretamente e
o estado permaneceu24m. Falha foi captura do slot vazio após o card usar
position:fixed na expansão; a captura deve visar .activity-card. Screenshot de
falha do app inteiro foi inspecionado: card expandido legível, slider/unidades,
objetivo, ações e alternativa acessíveis. Root corrigiu alvo da captura e
reexecuta o teste; nenhum fix de produto foi inferido desse erro do harness.

## Entrega de atividade e revisão independente

Handoff activity r3 recebido: gateA medido e SDK Pi real. Root repetiu spike:
gateA passou (OOPIF separado; HTTP/UDP zero no wrapper; rawRTC vaza; laço/flood
contidos); native-activity-tool passou. Revisão independente activity r4 começou
incluindo integração root/Claude/backup. Root identificou risco no watchdog:
fallback frame.processId interno usado como PID do SO e kill sem verificar
compartilhamento/reuso. Removeu fallback e condicionou terminação a PIDOS+
creationTime em métrica atual Tab do próprio Electron, mainPID conhecido e
nenhum frame vivo em qualquer WebContents da Mesa compartilhando o processo.
Oito testes guard/runtime passaram e hunt-activity-ui completo passou com
essa guarda, incluindo recuperação após laço. Reviewer informado para validar.

PDF r6 confirmou os quatro fixes, sem P0/P1 aberto, mas reproduziu dois P2:
tab de recuo pode acionar fallback global, e HTML cru h1 cria título adicional.
Root optou por fechar esses casos em task r7 exclusiva de template/testes;
cosmético de pasta vazia e falha legacy de suporte não entram nessa tarefa.

Root refinou descrições de ambas ferramentas de atividade e exemplos: setter
state(obj) distinto de getState(), onMessage antes de ready e restauração em
init; formato livre DOM/SVG/canvas, teclado/rótulos e variáveis CSS do tema.
Cinco testes de definição/SDK MCP passaram. Reviewer activity r4 recebeu o
diff por steer; runtime/schema não mudaram nessa rodada. Aguarda entregas
activity-review r4, timeline-fixes r5 e pdf-residual-fixes r7 para fechamento.

## Revisões recebidas e novas correções

Timeline r5 corrigiu identidade Pi sem ID, reconciliação e código morto;
integrado root Pi reexecutado passou. R6 confirmou A/B/C, mas reproduziu atraso
de turno parado pintando durante envio novo (N1 P2) e dois fallbacks P3 sem
índice/início. Task r7 corrige os três com prova durante stream e sem carimbar
eventos atrasados cegamente com o epoch atual.

Activity r4 reproduziu WebRTC via realm srcdoc (5 datagramas STUN), bloqueio
compartilhado OOPIF, quota no Reiniciar e envelope de estado descartado
silenciosamente; também registrou geração/documentação/revisão e teste SDK
faltante. Task r5 recebeu todos os achados, ownership exclusivo de atividade,
exigência de medir filhos adversariais e preservar a guarda segura de PID.

PDF r7 entregou template v3: tabs mapeados aos offsets da fonte, warning de
fallback independente de título, h1 cru rebaixado pós-DOMPurify. Task r8
independente verifica fechamento; root fará inspeção visual sintética via
Poppler, usando a skill PDF só para validação das páginas produzidas.

PDF r8 recebido: originais e residuais fechados; nenhum P0/P1/P2 novo.
Revisor executou 39 sondas próprias, template25/host23, diálogo/prévia e
syntax327. Root renderizou e inspecionou TODAS as seis páginas de
material-v3-longo.pdf e a página de fórmula larga preservadas em
/private/tmp/mesa-pdf-v3-visual-proof: título/hierarquia legíveis, margens
consistentes, cabeçalho de tabela repetido, blocos de código preservados,
fórmulas sem recorte ou sobreposição. Fórmula larga reduzida no piso anunciado
é legível; não houve novo achado visual. É prova sintética v3, não material
pessoal nem app instalado. Faltam correções/revisões activity/timeline e suite
geral após congelar os arquivos de produto.

Timeline r7 entregue: helper turn-identity no RPC abre/fecha corridas por
agent_start/agent_settled e aposenta ferramentas conhecidas; fallback FIFO sem
índice e rotação de finais sem início. Autor relata testes e probeoriginais
passando, sem tocar main. Root agendou r8 independente com objeções explícitas:
delta anônimo dentro do novo turno ainda é impossível de atribuir pelo fio;
limpeza por texto igual/sufixo pode apagar fala legítima. Reviewer verificará
garantia de abort/drain, barreira contra novo envio e reconexão/identidade,
além dos originais. Nenhum aceite final inferido apenas do handoff r7.

Activity r5 entregue: sanitização de subframes/Trusted Types com referências
pristinas, guarda compartilhada só para todos os frames comprovadamente
travados, quota corrigida, envelopes 16K+4K/21K e versões via activityId.
Task r6 independente revisa todos os originais e variações adversariais.
Root reexecutou seis testes SDKduplo/guard/host/backup:6pass; hunts de isolamento
e watchdog em execução separada, sem tocar produto em ownership.

Timeline r8 confirmou contrato atual Pi1.1 (partial-end antes de settle e
isStreaming/defer segura novo envio), mas reproduziu deleção legítima por
heurística igual/sufixo e ledger sobrevivendo a reconexão/conversa. Root decidiu
RETIRAR limpeza por texto (não prova identidade) e resetar ledger de transporte
e conversa, preservando sequência de run IDs. Task r9 recebe fixes + testes
contratuais e limites honestos: delta anônimo depois do novo agent_start em
host fora do contrato não tem identidade recuperável. Não será declarado
“resolvido” por comparação de textos nem por acerto só depois do stream.

Root hunt-activity-watchdog completo passou:3frames mesmoPID, laçoCPU,
shared-stalled kill, processo fora métricas, IPC/host preservados, nova
atividade executa. Log /private/tmp/mesa-root-activity-watchdog-r5.log.
Isolamento adversarial root segue em execução (logs parciais semfalhas),
não contado como PASS até encerrar. Activity r6 revisão independente ativa;
timeline r9 correções finais ativas. PDF permanece fechado.

Isolamento adversarial root encerrou exit0/PASSOU:28vetores, UDP/HTTPzero,
nenhum srcdoc/subframe executado, poisoning/Trusted Types testados, eval/popup/
acesso ao topo bloqueados; DOM/SVG/canvas/template legítimos funcionam.
Log /private/tmp/mesa-root-activity-isolation-r5.log. Nenhuma prova inferida
de saída parcial; todos os testes root em execução nesta rodada encerraram.

Timeline r9 recebido: heurística de deleção retirada por inteiro, ledgers
resetados em transporte/conversa sem reset da sequência host-run, testes
contratuais e de texto legítimo/IDs reusados. R10 independente confirma
fechamento R1/R3 e preservação dos originais, com R2/R4 fora contrato explícitos.
Produto congelado (ambas revisões atuais READ ONLY); root iniciou npm test
geral e integrado Pi final. Integrado Pi encerrou PASS, incluindo persistência,
reload/tema/expansão/KaTeX/loop/escopo. Suite geral ainda em execução.

## Validação geral final (produto congelado)

Root npm test encerrou exit0:1198pass/0fail/0skip. Pretest fez build Bend,
provas e seis verificadores de paridade realmente (não cache), portão297
arquivos aprovado; sintaxe333ok. Log /private/tmp/mesa-final-npm-test.log.
Integrados root finais Pi, Claude SDK/MCP e prévia PDF real encerraram exit0:
/private/tmp/mesa-final-{interactive-ui,claude-activity-ui,pdf-preview-ui}.log.
git diff --check passou. Não repetir testes já aprovados sem novo produto
alterado/achado; faltam apenas vereditos activityr6 e timeliner10 para aceitar.

## Activity r6: fechamento recusado por provas novas

Revisor reproduziu DSD (setHTMLUnsafe/Document.parseHTMLUnsafe/ShadowRoot)
criando template shadowroot com iframe srcdoc:5STUNporvetor. 28vetoresanteriores
PASS não fecham a classe inteira. Também probe determinístico de enumeração
com erro fez watchdog matar atividade saudável (catch→array vazio fail-open).
Task r7 restrita runtime/testes corrige ambos, exige prova completa de enumeração
failclosed e DSD antescriação (inclui template.content/shadowroots e sinks).
Os testes gerais anteriores continuam válidos para aquela revisão, mas terão
nova rodada final após mudar runtime. Não há aceite GateA neste estado.

Timeline r10 recebido: domínio fechado sob contrato documentado Pi1.1, sem
bloqueadores. Revisor141unitpass +8blocoslate/noid/hunt/Claude/snapshot/probe
crashsameconversa confirmou R1 semdeleção e R3resettransport/conversa. A/B/C/
N2/N3preservados. R2/R4hostsforacontrato e R5hostpure ficam explícitos sem
heurística mascarando. Timeline e PDF aceitos; único domínio pendente é
activityr7 (DSD+enumeração failclosed), depois revisão e suitefinalatualizada.

Activity r7 recebido em 2026-10-09: unsafeHTML/Document factory parsing
sanitizado antesDSD, stripshadowroot* e travessia template.content/shadowroots;
enumeração completa obrigatória failclosed. Autor41vetores175pass, watchdog27
pass, originaisrevisãoDSD5UDP→0 mantendohostpositive5. Root agendou r8READONLY
(taskprefix novo MCP56cefe83) e iniciou npmtest +Pi/ClaudeUI finais do runtime
congelado. Nenhuma aceitação inferida dohandoff antesvereditoindependente.

Root validação após runtime30ed3661 encerrou: npmtest1201pass/0fail/0skip,
syntax333ok; portão297 por conteúdo reaproveitado (build/provas/paridade foram
realmente executados na rodada anterior sem mudança core/rpc desde então).
Pi+Claude integrados reais main/preload/bridge/MCP/render com provedores
sintéticos PASS; imagem expandida sintética conferida: título/objetivo,
controle/unidade24m e ações legíveis (fixture mínima não representa toda
capacidade livre). Logs /private/tmp/mesa-final-runtime-{npm-test,interactive-ui,
claude-ui}.log. Só falta r8 independente para fechar domínio atividade.

## Aceite final — 2026-10-09

Activity r8 recebido: R6P1DSD e R6P2enumeração failopen FECHADOS, sem achados
concretos de bloqueio. Revisor conferiu hashesantes/depois, cincoDSDoriginais
0UDP/0filho compositivo5UDP válido, variantes próprias/nested/closed/poison,
175assertsisolation e watchdog27asserts duasrodadas; KaTeXlegítimooffline
preservado. GateAinlineaceito dentroElectron44.2/Chromium152/macOSmedidos.
P3onWatchdognão ligado é anotaçãoUXaceita, não requisito pendente.

Todos os três domínios aceitos:activityr8,PDFresidualr8,timelineclosingr10.
Runtime30ed3661 foi aprovado pela suitegeralroot1201/0 ePiClaudeintegrados,
syntax333 e gitdiffcheck. Bendbuild/proof/parity executados na rodada anterior,
conteúdo297cache naúltima. Não há produtoeditado depoisdesses testes; só docs.
Relatório docs/IMPLEMENTACAO-UI-PDF-TIMELINE-2026-10-08.md atualizado para
CONCLUÍDOlocal. LimitesmacOSsyntético/noactualprovider/noinstalledapp/semrelease
expressos. Nada commitado/push/install/update/publish; dadospessoais/defaults
e trabalhoalheio mantidos. Não há trabalho obrigatório restante autorizado.

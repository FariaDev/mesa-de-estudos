# Mesa: atividades interativas, template PDF e sequência do chat

Status: planejamento concluído, com três análises delegadas e uma revisão independente incorporada. Implementação local autorizada pelo usuário e em andamento; a integração, os testes finais e a revisão do código ainda precisam ser concluídos. Evidência atual em [root-integration-progress.md](reviews/2026-10-08/root-integration-progress.md).

Este documento é a decisão consolidada. Os relatórios de domínio registram alternativas e recomendações anteriores; quando houver divergência, valem as decisões abaixo e as respostas à revisão final.

## Objetivo

O tutor deve conseguir criar recursos para aprender dentro da conversa: manipular parâmetros, formular uma previsão, observar um resultado, tentar responder e receber feedback. A atividade aparece no ponto em que foi criada, entre as falas e ferramentas do turno. PDFs gerados seguem um padrão limpo com matemática legível.

## Ordem proposta

1. Contrato da sequência: blocos de trabalho, fala e artefato preservam a ordem de ocorrência ao vivo e ao reabrir. IDs de mensagem/chamada fazem deduplicação; ferramentas concorrentes atualizam seu lugar original. Reaproveitar decisões do Conversa sem fundir os apps.
2. UI interativa como prioridade: ferramenta própria da Mesa, validação no host e cartão no chat, com ampliar/reiniciar/descrição textual. Persistência por conversa e conteúdo versionado. Interações locais não fazem chamadas de modelo; enviar tentativa ao tutor é ação explícita.
3. Geração livre de HTML/CSS/JS é o formato prioritário; presets ajudam o tutor sem limitar os recursos que ele pode criar. A superfície de execução será escolhida por experimento de contenção, com alternativa ampliada documentada se o inline reprovar. Conteúdo gerado não recebe APIs do app; estado e mensagens usam contrato limitado e validado.
4. Template PDF central no pipeline existente Markdown + KaTeX + impressão: A4, hierarquia tipográfica, título, margens, equações e tabelas sem cortes. Tutor prepara conteúdo sem inventar preâmbulo ou layout. Prévia e PDF precisam corresponder; erros de matemática devem ser visíveis antes do salvamento.
5. Testes sintéticos: ordem durante streaming e histórico, cancelamento/repetição/concorrência, isolamento, tentativa e estado entre conversas, layouts estreitos, temas, PDF multipágina e fórmulas grandes. Distinguir testes locais de uso real com provedor.

## Pontos de integração já observados

- `desk/src/chat.mjs` e `desk/src/worklog.mjs` agrupam trabalho antes da resposta no histórico; `chat/src/worklog.mjs` tem `parts` intercalados.
- `desk/src/extensions/tutor-pdf/` e `desk/src/agents/tutor-pdf.cjs` fornecem ferramenta Pi e SDK Claude.
- `desk/material-pdf.cjs` e `desk/src/materials/` já imprimem Markdown/KaTeX em janela isolada.
- `desk/profiles.cjs` controla as extensões; Livre deve manter `--no-context-files` e isolamento existente.

## Limites desta etapa

Preservar mudanças locais existentes, dados pessoais, defaults do autor e materiais. Não instalar, atualizar ou reabrir app pessoal, criar release, fazer commit ou publicar. Agentes usam `pi-mesa-dev`, `commandcode/deepseek/deepseek-v4.1-flash`, `thinking=max`, runtime `full-access`. Integrações compartilhadas serão centralizadas após delimitar domínio e escopo.

## Aceitação de produto

- Uma simulação de MRUV permite prever e comparar posição/velocidade com explicação e unidades; uma atividade de cálculo permite explorar parâmetro e tentar uma resposta. Toda atividade tem objetivo de aprendizado e alternativa textual.
- Uma ferramenta executada depois de uma fala aparece depois dessa fala e conserva a posição ao retomar a conversa.
- Interação/reabertura nunca dispara mensagem ou inferência automaticamente; estado não atravessa conversas.
- PDF de resolução e PDF de resumo seguem o mesmo template, com LaTeX legível e sem conteúdo cortado.

As análises e a revisão final estão concluídas e vinculadas abaixo. Experimentos de runtime e testes de produto fazem parte da execução futura, não foram simulados como concluídos no planejamento.

## Decisões de UI interativa

- Geração livre é necessária: um catálogo fixo de quizzes não atende à sugestão. O formato principal proposto é documento HTML/CSS/JS autocontido, com presets como ajuda ao tutor, não como limite da atividade.
- Documento só é executado depois de terminar e passar pela validação do host. Deltas mostram preparação; nunca executam HTML pela metade. Não enfraquecer `markup` ou o DOMPurify do chat para permitir scripts.
- Metadados mínimos: versão do contrato, ID/hash do conteúdo, título, objetivo, descrição alternativa, referência à conversa e à chamada da ferramenta. Conteúdo e tentativas ficam separados. Regerar cria uma revisão; a versão anterior não é silenciosamente substituída.
- Ao reabrir, conteúdo permanece disponível sem chamar o modelo. Inicialização automática de JavaScript antigo é uma decisão de produto distinta da restauração de um resumo/snapshot. Limitar atividades montadas e pausar quando fora da tela evita custo crescente por conversa.
- Feedback do programa é apresentado como cálculo/verificação local; a qualidade pedagógica e correção do código gerado precisam de revisão pelo tutor e exemplos verificados. Não atribuir ao tutor uma avaliação que ele não fez.
- Bloquear rede, navegação, popups, downloads, permissões e acesso a arquivos/Node/preload. `iframe sandbox` e CSP são barreiras complementares; não são teto de CPU/RAM. Uma atividade com loop deve poder ser encerrada sem congelar o chat. O gate técnico decidirá entre iframe e renderer dedicado com testes reais no Electron.
- Recursos para estudo: prever antes de revelar; sliders com unidades; gráficos ligados à equação; tentativa e explicação; alternativas textuais; botões de ampliar e reiniciar quando necessários. Envio de tentativa passa pelo rascunho/fluxo existente e depende da ação do usuário.

Referências oficiais consultadas em 2026-10-08: [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security), [MDN iframe](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe), [MDN CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy). A seleção da superfície da Mesa é uma proposta derivada dessas restrições, ainda sem prova local de isolamento.

## Exemplo navegável da proposta

Arquivo: `docs/reviews/2026-10-08/mesa-interactive-proposal.html`. Demonstra sequência de trabalho/fala/atividade, ajuste de aceleração, previsão, gráfico, resultado e tentativa no rascunho. Verificado com `html_preview` em 728 px e 360 px; tema claro e escuro; asserts no navegador para 15 m (a=2), 24 m (a=4), revelação do gráfico, mudança de parâmetro e preenchimento do rascunho. É um protótipo independente, não uma integração nem validação do runtime da Mesa.

## Tarefas delegadas

Configuração live confirmada: provider `pi-mesa-dev`; modelo `commandcode/deepseek/deepseek-v4.1-flash`; `thinking=max`; `runtimeMode=full-access`; `interactionMode=default`. Rodada de investigação, sem implementação do app.

- UI: `node:delegated-task:command%3Amcp%3A4daa6e34-163a-4b5a-ba4c-49ea3bd88f00%3Adelegate-task%3Amesa08-interactive-plan-pi-commandcode-r1`
- Sequência: `node:delegated-task:command%3Amcp%3A4daa6e34-163a-4b5a-ba4c-49ea3bd88f00%3Adelegate-task%3Amesa08-timeline-plan-pi-commandcode-r1`
- PDF: `node:delegated-task:command%3Amcp%3A4daa6e34-163a-4b5a-ba4c-49ea3bd88f00%3Adelegate-task%3Amesa08-pdf-plan-pi-commandcode-r1`

## Resultado de cronologia e revisão do pai

Análise concluída em [timeline-plan.md](reviews/2026-10-08/timeline-plan.md). Foram localizadas a agregação do histórico da Mesa e a view única no início do turno; ambas descartam a intercalação. O pipeline Claude também perde a identidade de blocos em `service.cjs` e resultados de ferramentas no cache/transcrição nativa. Referências conferidas diretamente no código pelo pai.

Uma sonda Node com mensagens sintéticas `pensamento → fala → ferramenta → fala` confirmou: a Mesa retorna `parts=null` e texto agregado; a Conversa retorna `work,text,work,text`. Esta sonda verifica a projeção do histórico, não o streaming nem o Electron.

Decisões após revisão:

1. Aproveitar os segmentos e `parts` da Conversa seletivamente. Não copiar junto recursos MCP/repetição sem necessidade. Compartilhar um módulo não é necessariamente fundir os produtos; preservar a separação funcional é o requisito, e extração de módulo fica fora do escopo inicial para reduzir mudanças.
2. O código da Conversa é uma referência, não prova suficiente para todos os casos. Seu `segmentLog` usa `slice(seg.from)` sem limite final; segmentos fechados precisam de `to` ou IDs explícitos, e resultados tardios de ferramentas concorrentes devem atualizar o segmento original, mesmo depois de fechado. Não atribuir novos passos a segmentos anteriores.
3. Chave de bloco: identidade de conversa + geração/turno + mensagem + `contentIndex`. Pi pode não fornecer `message.id`; nesses casos o host cria identidade por sequência de `message_start`. Eventos finais reconciliam cada bloco sem juntar falas que estavam separadas por ferramentas.
4. Distinguir declaração de chamada (`toolcall_end`/`tool_use`) de início de execução. A declaração fixa a posição, com estado pendente; o evento de execução atualiza o mesmo ID. Isso preserva `[tool,text]` sem anunciar execução que ainda não aconteceu.
5. Artefatos reservam âncora pelo ID da chamada antes de terminar. Resultado fora de ordem preenche a âncora original. A ordem de término não deve mover a atividade para depois de outra fala.
6. Parar/trocar conversa encerra views, timers e buffers. Guardas usam identidade de execução quando disponível; um booleano de parada sozinho não distingue evento atrasado do turno anterior depois de começar outro turno.
7. Falas ficam legíveis; trabalho anterior recolhe em seu local. O quiz existente conserva seu fluxo nesta primeira implementação. PDF preparado pode ter cartão que abre a revisão existente, sem salvar automaticamente.

A recomendação dos agentes de adiar HTML livre não foi adotada: geração livre continua requisito prioritário desta proposta, condicionada à contenção medida da superfície executável.

## Resultado de UI interativa e decisão consolidada do pai

Análise concluída em [interactive-ui-plan.md](reviews/2026-10-08/interactive-ui-plan.md). As alternativas e riscos da seção 8 são úteis; a recomendação de componentes declarativos como entrega principal não foi adotada. O protótipo MRUV foi criado pelo pai como exemplo de fluxo, não fornecido pelo usuário nem tratado como limite de expressividade. O objetivo original inclui UI gerada livremente pelo tutor.

### Primeira entrega pretendida

1. **Experimento curto de isolamento antes do restante da UI.** Comparar iframe servido por origem dedicada e renderer dedicado; usar fixtures de laço, flood de mensagens, navegação e tentativas de rede/arquivos. Medir IDs de processos, responsividade da Mesa e recuperação. A superfície só é escolhida depois dessas evidências. `WebContentsView` possui WebContents próprio, mas isso não dispensa medir compartilhamento de processo. Um iframe OOPIF não oferece automaticamente um WebContents independente que se possa destruir. Não implementar watchdog prometendo APIs que não controlam aquele frame.
2. **Ferramenta de geração livre.** Contrato candidato: `{title, objective, alternativeMarkdown, html, css, js}`; host produz wrapper de tema/math e valida tetos/recursos. Um documento completo é compilado/publicado atomicamente; sucesso significa "atividade publicada", não "conteúdo pedagogicamente verificado". Nome candidato Pi `mesa_criar_atividade`, Claude `mcp__mesa__criar_atividade`, ambos chamando o mesmo serviço. Reusar ponte própria existente, sem depender de extensão global do usuário.
3. **Shell confiável no chat.** Título/objetivo, atividade, texto alternativo, ampliar, parar/reiniciar, tentar novamente após erro e levar tentativa ao tutor. Controles do shell ficam fora do código gerado. Geração mostra preparação; publicação ocupa âncora reservada pela chamada. A atividade aparece embutida se o experimento comprovar contenção; uma superfície ampliada com cartão inline é fallback identificado como limite, não entrega equivalente silenciosa.
4. **Estado e diálogo com tutor.** API pequena para ready/error, altura, estado JSON e tentativa. Nenhuma API de arquivo, shell, Node, credencial, ferramenta, clipboard ou inferência. Tentativa reportada pelo documento é dado não confiável; botão do shell coloca um resumo identificável no rascunho sem apagar o texto existente. O aluno revisa e usa o envio normal, que já respeita fila/ocupação. Não adicionar confirmação intermediária nem autoenvio.
5. **Liberdade pedagógica com guias.** Fornecer exemplos de MRUV, função com parâmetro, geometria, probabilidade e raciocínio passo a passo. O tutor escolhe visualização quando a relação pode ser explorada, uma hipótese pode ser testada ou o aluno pede algo interativo. Não exigir o ciclo previsão/observação para toda atividade: ele é um bom padrão, não regra universal.

### Persistência e runtime

- Manifesto contém identidade de conversa/execução/chamada/artefato, versão, hash e metadados; documento é imutável por revisão. Hash detecta alteração, não prova segurança ou correção matemática. SDK precisa de um ponto comprovado de correlação com `toolCallId`, pois não se deve inventar que o callback da ferramenta expõe essa identidade.
- Estado JSON e tentativa pertencem à versão/hash. Reabertura mostra shell e resumo restaurados sem inferência; execução de JS antigo é preguiçosa/acionada ao abrir atividade. Conteúdo executável não roda em massa ao restaurar histórico. Montagens têm identidade nova; mensagens da montagem anterior são ignoradas.
- Canal por montagem com identidade de origem/source e, se necessário, MessageChannel. Teto inicial de documento inline: 64 KiB UTF-8 somando conteúdo e metadados; estado 16 KiB, altura clampada, limite de frequência e número de atividades simultaneamente executando. O limite inline considera também o custo do argumento no transcript; limites definitivos vêm de medição. Quotas não apagam atividades antigas silenciosamente.
- Negar rede em CSP e sessão/protocolo, com regra explícita de recursos locais empacotados e sem aceitar caminho do modelo. KaTeX/CSS/fontes e gráficos SVG/canvas devem funcionar offline. `unsafe-eval`, navegação, frame filho, popups, downloads e permissões permanecem bloqueados. Nenhum token da ponte é injetado no documento.
- Salvar estado revalida a identidade original da conversa no main. Resolver apenas a conversa "atual" no momento de um callback atrasado pode gravar na conversa errada; usar identificador opaco vinculado pelo host e comparar geração/escopo.
- Corrupção conserva o arquivo para recuperação e mostra erro; não substituir automaticamente por vazio. Cotas servem para negar nova publicação ou descarregar execução, não para excluir documentos referenciados no histórico.
- As atividades e tentativas são dados pessoais de estudo mesmo sem credenciais. Backup/restauração/promoção/exportação precisam de testes de ida e volta e políticas de escopo; leitura estática não prova inclusão automática nem ausência de conteúdo pessoal.

### O que fica fora da primeira entrega

Não criar agora um DSL geral de telas, avaliador matemático novo ou editor visual de atividades. Presets são exemplos para o gerador, e o runtime livre atende aos casos fora desses exemplos. Chat lateral permanece fora da primeira integração por ter estado e motor próprios; principal funciona tanto em Livre quanto em matéria, nos dois motores, preservando o isolamento de Livre. Exportação textual inclui objetivo, alternativa e valores/tentativa; exportação de imagem/PDF do artefato fica para etapa seguinte, com recursos gerenciados explicitamente.

Referências de runtime: [WebFrameMain](https://www.electronjs.org/docs/latest/api/web-frame-main) e [WebContentsView](https://www.electronjs.org/docs/latest/api/web-contents-view), consultadas em 2026-10-08. A necessidade de medir e validar contenção é decisão de engenharia; nenhuma prova no Electron foi executada nesta rodada.

## Resultado de PDF e decisão consolidada do pai

Análise concluída em [pdf-template-plan.md](reviews/2026-10-08/pdf-template-plan.md). O agente fez sondas isoladas de KaTeX e inspecionou um PDF sintético já existente; não gerou novo PDF nem testou o aplicativo. O pai conferiu diretamente a prévia e as opções atuais do renderer, e repetiu sondas de equação alinhada, erro de sintaxe e extração de cifrões.

### Template e fluxo recomendados

- **Manter Markdown + KaTeX + impressão Chromium**, que já existem. A primeira entrega atende fórmulas de estudo, não promete compilação de qualquer documento TeX com pacotes. `aligned`, `cases`, matrizes e unidades bem escritas atendem resoluções usuais. Não instalar TeX Live/Tectonic nesta etapa.
- **Template único**: A4, margens atuais 18/16/20 mm, título único, texto 11–11,5 pt com tipografia limpa coerente com matemática, hierarquia de seções, realce discreto de resposta, tabelas com cabeçalho repetido e controle de viúvas/órfãs. Serifa no texto é decisão de design proposta, não requisito que o usuário tenha explicitado. Sem marca d'água, capa extra ou branding chamativo.
- **Conteúdo e layout separados**: tutor envia título e Markdown; o host aplica o template. Guia de redação traz exemplo de resumo/resolução/lista e uso de `aligned`, mas não exige preencher seções irrelevantes nem impede estrutura que o aluno peça. Campo de variante, se adotado, é opcional e retrocompatível.
- **Preparação compartilhada**: módulo de material usado por prévia e impressão, título deduplicado e heading tratado por estrutura Markdown (inclusive código cercado, setext e texto matemático), sem modificar globalmente o chat. Corrigir teto divergente de título 160 na ferramenta versus 120 no host, preservando rascunhos existentes.
- **Equações verificáveis**: separar erro de parsing/comando sem suporte de aviso de estilo. Usar `throwOnError:true`, `trust:false` e política explícita de `strict` para diagnóstico, sem bloquear toda mensagem por um warning de Unicode válido. Problemas reais têm trecho/localização e impedem salvar um PDF defeituoso; rascunho fica intacto para editar. Preparação da ferramenta devolve os erros ao tutor na mesma execução, sem afirmar que o PDF foi salvo. Botão de pedir correção usa rascunho/envio explícito existente.
- **Cifrões e código**: a regex atual ainda captura `\$5 ... \$10` como matemática. Sonda do pai confirmou isso. Uma instrução de prompt para escapar `$` não resolve sozinha. Tokenização de material deve respeitar escape, código inline/cercado e delimitadores incompletos, com testes próprios.
- **Fórmulas largas/altas**: medir depois das fontes, tentar ajuste moderado preservando tamanho legível; se continuar fora da área, explicar qual expressão deve ser quebrada em `aligned` ou reorganizada. Não cortar, não reduzir tudo a 72% nem transformar matematicamente a expressão automaticamente. Bloco maior que página precisa de diagnóstico e revisão; `break-inside:avoid` sozinho não garante integridade.
- **Prévia com fidelidade explícita**: edição mostra estilo compartilhado em largura A4. A ação "Ver PDF" renderiza bytes temporários, sem salvar material, e usa o pdf.js existente para conferir páginas reais. Só essa visualização é chamada de paginada/exata. Cancelar não cria material. Save usa a revisão correspondente ao título/conteúdo/template e não um resultado assíncrono antigo. Não renderizar novamente em cada tecla.
- **Preservar o serviço atual**: nomes únicos, escrita atômica, fsync/hash, cancelamento, rollback, espera de fontes locais e ausência de rede. Material só entra na biblioteca quando o aluno clica em salvar.

## Plano executável por etapas e responsabilidades

1. **Prova de runtime livre (prioridade máxima, risco alto):** agente de interatividade monta experimento sintético isolado, registra processos/responsividade/rede/recuperação e recomenda superfície. Critério: laço da atividade pode ser encerrado sem perder a conversa ou congelar o chat. Reprovação exige mudar arquitetura e registrar o limite, não esconder geração livre atrás de um catálogo fixo.
2. **Cronologia e âncoras (complexidade média):** agente de timeline implementa projeção por blocos/segmentos com limites e IDs, reconciliação de eventos finais, ferramentas concorrentes e guardas de cancelamento/troca. Contrato é acordado com agente de interatividade antes de editar `chat.mjs`.
3. **Atividades no chat (complexidade alta):** agente de interatividade implementa store/bridge/ferramentas/host/renderização e shell confiável, reaproveitando recursos locais. Pai centraliza `main.cjs`, `preload.cjs`, perfis, capacidades, build/proofs e integração para evitar edits concorrentes. Principal em Livre e matéria primeiro; lateral fica fora desta entrega.
4. **PDF (complexidade média):** agente de PDF implementa template/preparação/diagnósticos/medição/prévia e contrato do tutor em arquivos de domínio; pai integra o shell e main. Pode trabalhar em paralelo após fixar interfaces compartilhadas.
5. **Validação e revisão (obrigatória para entregar código):** unidade + fake Pi/SDK + Electron com runtimes sintéticos; `npm test`, checks focados e portão Bend se houver núcleo novo/alterado. Revisão independente cobre diffs da tarefa, preservando mudanças anteriores. Nenhum teste sintético prova inferência real ou uso do app instalado.

As estimativas dos agentes são referências de esforço de engenharia para escopos distintos, não compromissos de prazo de execução de agentes. UI declarativa extensa, PDF com variantes/overrides e motor de expressões novo inflaram os números dos relatórios; esses itens não fazem parte do MVP consolidado. O runtime livre é a principal incerteza e deve ser medido antes de estimar o restante.

### Gate de entrega local

- Dois exemplos gerados: MRUV e cálculo; mais um exemplo fora de catálogo fixo (ex.: probabilidade por amostragem ou geometria manipulável), com unidades/alternativa textual e nenhuma biblioteca remota.
- Streaming e histórico têm mesma sequência para `pensamento → fala → tool/atividade → fala`; ferramentas que acabam fora de ordem atualizam a própria âncora; final de mensagem não duplica/nem mistura falas.
- Parar, retry, eventos atrasados e troca de conversa não restauram turno abandonado nem gravam em conversa errada.
- Interações, ampliar, reiniciar e reabrir não enviam prompt; levar tentativa preserva o rascunho existente e depende de envio do usuário.
- Runtime bloqueia APIs do app, arquivos, rede e navegação; laço/flood é contido; processo é encerrável; histórico longo não inicia todas as atividades.
- Backup/restore/promoção conservam documento e tentativa com integridade, sem ler materiais pessoais nos testes. Exportação tem alternativa textual e identifica a revisão.
- PDF sintético multipágina com `aligned`, `cases`, matriz, tabela grande, código com cifrão, texto monetário, equação inválida e equação larga: fontes locais, conteúdo legível, erros detectados e nenhuma quebra/corte escondido.
- UI validada nos temas e em chat estreito, teclado e movimento reduzido. Relatório distingue código/testes locais, provedor autenticado, plataforma real e app instalado.

## Estado da investigação

Quatro rodadas delegadas concluídas no provider/modelo/esforço solicitados: UI, timeline, PDF e revisão independente. Plano consolidado e corrigido pelo pai. Nenhuma implementação do produto foi iniciada; esta entrega atende ao planejamento solicitado. Instalação/publicação não fazem parte do escopo.

## Revisão final: objeções e resolução

Relatório: [interactive-plan-final-review.md](reviews/2026-10-08/interactive-plan-final-review.md). Task ID: `node:delegated-task:command%3Amcp%3A4daa6e34-163a-4b5a-ba4c-49ea3bd88f00%3Adelegate-task%3Amesa08-plan-final-review-pi-commandcode-r2`. Todas as recomendações abaixo são decisões de implementação a validar, não resultados de testes executados.

1. **O1 — Transcript/contexto:** a ferramenta que recebe HTML/CSS/JS inline registra esse conteúdo nos argumentos da chamada, mesmo que o resultado devolva apenas referência. Aceitar explicitamente essa duplicação na primeira versão, com teto inicial de 64 KiB UTF-8; store guarda cópia canônica por hash. Não redigir sessões nativas nem mutar retroativamente argumentos. Medir tamanho de transcript, contexto reportado, retomada e compactação com os exemplos sintéticos antes de aumentar limite. Rejeitar tamanho excedido com instrução para simplificar, sem truncar silenciosamente. Se os exemplos úteis não couberem ou o custo for inadequado, implementar publicação por arquivo gerenciado em etapa própria; não afirmar que o transcript já é só referência.
2. **O2 — Identidade Claude:** o handler MCP não expõe `toolCallId` nas tipagens. Usar o hook `PreToolUse`, já instalado no adaptador: seu input tipado tem `tool_use_id` e sua saída suporta `updatedInput` (`sdk.d.ts:2380-2392`). O host registra identidade por geração/conversa/chamada e injeta `callRef` opaco em campo reservado opcional aceito pelo schema; valor fornecido pelo modelo é ignorado/substituído. Handler resolve apenas referência registrada, confere escopo/hash/geração e publica idempotentemente. O `callRef` é correlação, não concede permissões de arquivos/tools. Pi recebe `toolCallId` diretamente de `execute` e repassa à ponte. Teste fake SDK obrigatório com duas chamadas de payload idêntico, IDs distintos, autoaprovação, cancelamento/troca e retry; se o hook não chegar ao handler como previsto, a etapa 3 permanece bloqueada até corrigir a amarração. Não fazer casamento ambíguo apenas por ordem/digest.
3. **O3 — Rede/navegação:** ampliar o experimento para fetch/XHR/WS/beacon/EventSource/fetchLater, imagens/fontes/CSS, `a[ping]`, WebTransport e WebRTC/STUN, usando probes locais HTTP e UDP sem dados pessoais. `connect-src` cobre `a[ping]` segundo a [MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/connect-src); a revisão exagerou essa lacuna, mas o teste continua útil. CSP/sandbox não serão tratados como bloqueio universal de todos os canais. A superfície escolhida precisa negar também APIs/canais que escapem da política, com evidência; renderer dedicado não resolve rede automaticamente. Navegação valida frame+montagem+artefato exato, não apenas prefixo de URL; negar troca entre artefatos. Falha no probe reprova a alegação de offline e a publicação daquela superfície, até aplicar contenção eficaz.
4. **O4 — Gates explícitos de superfície:** gate A exige atividade inline interativa, Mesa responsiva durante laço/flood, encerramento só da atividade e zero saída observada nos probes. Gate B exige cartão inline estático com alternativa/resumo, sem executar código, e atividade em view ampliada comprovadamente encerrável sem perda da conversa, com os mesmos testes de rede/arquivos. Se somente B passar, registrar essa entrega como versão limitada; ela não cumpre o objetivo inline completo, que continua aberto. Se nenhum passar, corrigir o runtime antes de publicar atividade executável.
5. **O5 — Ordem/montagem:** `parts` com limites/IDs é dependência obrigatória da publicação; excluir fallback que põe toda atividade depois do diário agregado. Placeholder nasce na declaração da chamada e distingue pendente/executando/pronto/erro/parado. Não mover iframe entre pais para ampliar, pois reparenting pode recarregar seu contexto. Ampliar/remontar usa novo contexto, snapshot validado e `init`; a montagem antiga é invalidada. Testar ordem e preservação de estado ao desmontar/ampliar/retomar.
6. **O6 — Tokenização:** manter renderer do chat inalterado nesta tarefa. O caminho de material tokeniza Markdown/código/math uma vez e usa esses tokens tanto na validação quanto na geração de HTML/KaTeX; não passar depois o texto cru pela regex antiga do `markup`. Compartilhar sanitização/realce/recursos reutilizáveis sem mudar a saída global do chat. Fixtures incluem escape, código inline/cercado/indentado, setext e delimitador incompleto; verificação de paridade do chat confirma a fronteira.
7. **O7 — Layout/revisão PDF:** qualquer ajuste de escala gera diagnóstico com expressão e fator; piso legível inicialmente 9 pt (valor de design a verificar visualmente), não 72% automático. Medição definitiva ocorre na página de impressão, depois das fontes; prévia CSS é orientação. Revisão imutável inclui título+Markdown+variante+versão do template e hash; fechar/editar cancela ou invalida renders antigos, save não consome bytes de outra revisão. Resultado de "Ver PDF" pertence àquela revisão, não cria material e pode ser reutilizado somente quando o hash do save confere.
8. **O8 — Dados pessoais:** teste de backup fixa documento, tentativa, horários e revisão; documentar que são dados de estudo incluídos no backup. Exportação textual não inclui script. Conteúdo órfão/corrompido é preservado para recuperação; ausência da conversa na carga não autoriza apagar versões referenciadas. Não compartilhar tentativas automaticamente ao exportar uma matéria.
9. **O9 — Consistência:** atualizar status e ordem inicial para refletir geração livre prioritária e revisão concluída. Os relatórios de domínio ficam preservados como insumos; suas recomendações de DSL primeiro, `slice(from)`, reparenting e fallback agregado não substituem este plano.

Resultado: objeções resolvidas no desenho ou convertidas em gates técnicos explícitos da execução. O plano está pronto para iniciar os experimentos e mudanças por etapas. Não é uma certificação de runtime, inferência, PDF gerado ou app instalado.

# Transporte Claude experimental

Integração local da Mesa com o Claude Code original pelo Agent SDK oficial. A segunda rodada usa o T3 Code como referência de comportamento. O código foi testado com SDK e dados artificiais; inferência autenticada ainda não foi validada. O aplicativo instalado não foi sincronizado.

Referência pública: `pingdotgg/t3code`, commit `1604ccc9d79f5270fb8e14d60664184bf142c4cb`. As implementações desta rodada adaptam conceitos; não copiaram código do T3. A licença da referência é MIT, © 2026 T3 Tools Inc. O T3 observado usa um SDK mais novo; a Mesa valida suas chamadas contra o pin local `@anthropic-ai/claude-agent-sdk@0.3.246`, pareado com Claude Code `2.1.246`.

## Fronteira e arquivos

| Arquivo | Responsabilidade |
| --- | --- |
| `desk/src/agents/claude-environment.cjs` | Resolve o executável original, confere versão/login e recusa conflitos de API/endpoint sem expor valores |
| `desk/src/agents/claude-adapter.cjs` | Query nativa, mensagens, permissões, controles, cancelamento e histórico |
| `desk/src/agents/claude-controls.cjs` | Catálogo, capacidade de esforço e validação da escolha |
| `desk/src/agents/claude-turn-policy.cjs` | Correlação, encerramento, classificação de falhas e avisos de retry/fallback |
| `desk/src/agents/service.cjs` | Tradução para o contrato da Mesa, locks, cache e guarda de incerteza |
| `desk/src/agents/conversations.cjs` | Descritor atômico, identidade, seleção e entrega persistidas |
| `desk/main.cjs` | IPC, preparação do contexto selecionado e integração com o host |
| `desk/src/claude-questions.mjs` / `chat.mjs` | Perguntas estruturadas e avisos visíveis |
| `core/agentcaps.bend` / `agentdelivery.bend` | Capacidades e portões com leis/provas |

Cada conversa fixa seu motor. Conversas Claude usam descritor JSON com ID local e ID nativo separado; conversas Pi preservam JSONL. Nenhum processo Pi é iniciado para transportar uma conversa Claude. A Mesa usa o binário autenticado pelo usuário, não realiza login nem guarda tokens. Não altera configuração global do Claude.

O workspace da conversa fica no runtime da Mesa; não recebe symlink do vault inteiro ou o perfil Pi. Contexto de estudo e referências são escolhidos pelo fluxo da Mesa. O processo usa `settingSources:[]`, MCP explicitamente isolado e auto-update desligado apenas no subprocesso.

## Controles nativos

`connect()` confere ambiente sem abrir Query ou enviar prompt. A conexão explícita da Mesa chama `initializeControls()`, que inicia uma Query sem prompt e lê `supportedModels()`/`initializationResult()`. Health não inicia catálogo nem consulta de inferência. O envio também inicializa os controles antes de transmitir.

Modelo aparece apenas com catálogo nativo e `setModel` disponíveis. Esforço depende de metadados do modelo escolhido e `applyFlagSettings`; sem informação suficiente, o controle fica oculto. A opção “Padrão do Claude Code” remove a escolha explícita. Não há catálogo futuro fixado no app.

`setControls({model,effort}, {persistSelection})` valida o conjunto antes de aplicar. Modelo e esforço são aplicados nativamente; o descritor só muda depois do sucesso. Falha provoca rollback. Falha do rollback bloqueia novos envios até uma conexão nova. Operações têm prazos e lock: turno, permissão ou entrega incerta impedem troca. Nenhuma atualização global de preferências é feita.

A escolha desejada fica no descritor e é restaurada. O modelo observado pelo CLI é metadado separado; não sobrescreve a escolha. Seleção salva indisponível é recusada antes do envio, sem troca silenciosa para outro modelo. `max` só é oferecido se estiver no catálogo nativo; sua semântica ao vivo ainda depende da validação autenticada.

## Entrega, encerramento e retomada

O envio grava `transmitting` antes de entregar o item ao SDK. Aceite exige replay/carimbo do UUID correto e gravação de `accepted` antes de resolver a promise. O item puxado pelo iterador, texto renderizado e `message_stop` não são prova de aceite.

Resultado correlacionado encerra o turno. Resultado sem eco de UUID só liquida com um único turno aceito, sem degradação, evidência estrangeira, origem não humana ou detrito de zero turnos. Resultado de outro turno é ignorado. Mensagens de outra sessão ou subagentes não mudam a identidade da conversa.

Cancelamento explícito com aceite comprovado e fim nativo observado encerra como `settled`, com `cancelled:true` e `uncertain:false`. A fila permanece guardada. Crash sem cancelamento, fechamento pelo host ou falha de persistência mantêm a decisão conservadora. Uma entrega incerta bloqueia envio e controles, inclusive depois de reabrir; nunca é reenviada automaticamente.

Nova Query usa `sessionId` para sessão nova ou `resume` para sessão estabelecida, nunca ambos. Uma Query que só leu catálogo não estabelece sessão de estudo. Após cancelamento com encerramento nativo, a próxima consulta retoma o ID exato.

## Permissões e perguntas

Read/Glob/Grep seguem política por caminhos reais autorizados; escrita e ferramentas fora da lista são recusadas. Referências só mudam dentro do lock do envio. O confinamento adicional do CLI não foi exercitado com conta real.

`AskUserQuestion` produz pedido canônico `method:'question'`. A Mesa mostra seleção única/múltipla e texto livre. Resposta usa o texto exato da pergunta como chave; arrays são juntados para o formato nativo. Chaves como `__proto__` são preservadas como propriedades próprias. Limites do IPC/UI: 16 perguntas, 32 opções e 4000 caracteres por campo/resposta. Todas as perguntas devem ser respondidas para Responder; Cancelar e Escape não exigem respostas.

Pedidos têm identidade, TTL e abort. Resultado, cancelamento e consulta encerrada revogam permissões pendentes. Resposta atrasada/desconhecida nunca concede permissão. Resposta inválida não consome o pedido nativo.

## Limites, retry e falhas

`rate_limit_event` é interpretado no nível principal do SDK, com suporte defensivo ao subtipo legado. Janelas rejeitadas são acompanhadas separadamente; liberar uma não esconde outra. Bloqueio/proximidade/overage e transição de liberação aparecem na atividade e em aviso, sem limpar busy, desconectar ou avançar a fila.

`system/api_retry` preserva tentativa, máximo, atraso e status limitados, com deduplicação por turno. 429, 529, `blocking_limit`, contexto, imagem e orçamento recebem códigos próprios. Uma falha de resultado mantém a entrega aceita liquidada e segura a fila. Erros nativos recuperáveis usam `fatal:false`; o encerramento vem do resultado nativo. Erros fatais de transporte/autenticação mantêm o tratamento de desconexão.

Recusa/fallback mostra aviso e preserva metadados limitados de retração. A remoção de texto parcial retratado do DOM está adiada; ele pode permanecer visível junto ao aviso.

## Histórico e limites

Histórico usa `getSessionMessages` por ID exato, sem reexecutar ferramentas. A exibição é paginada/limitada; exportação percorre o histórico nativo. Cache do descritor mantém as mensagens mais recentes sob 12 MiB, sem cortar metadados de identidade ou entrega. A poda conta bytes UTF-8 por mensagem para evitar reserializar imagens repetidamente.

O adaptador limita imagem a 10 MB decodificados, até 16 imagens, texto a 512 KB e conteúdo a 32 MB. O host pode impor tetos mais restritos e reduzir imagens. Resultados de ferramenta têm truncamento explícito. Esses limites são de proteção do transporte; não comprovam visão no modelo real.

## Validação

```sh
cd desk
npm test
npm run test:claude-ui
npm run verify:bend
node tests/ui-smoke.mjs
```

`test:claude-ui` roda em sequência os harnesses de integração geral, controles, ciclo de vida e recuperação. Todos usam runtime temporário e SDK artificial, sem login/inferência. Resultados e contagens atuais ficam no [registro da segunda rodada](STATUS-MESA-T3-CLAUDE-2026-10-05.md).

Na primeira rodada foi registrado um probe estrutural com SDK/binário original, endpoint local indisponível e custo zero: spawn/init/replay e erro de API. Isso não comprova inferência autenticada.

Pendente em conta real: resposta e imagem/Xournal++, catálogo e troca de modelo/esforço, permissões, cancelamento, retomada e limites da assinatura. Compactação manual, steer, forks/agentes em segundo plano, `resume_return` e remoção de parciais retratados continuam fora deste experimento.

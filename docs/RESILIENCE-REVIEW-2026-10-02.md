# Revisão final: conexão fraca, desempenho e simplicidade

Base: Mesa v0.4.6. Melhorias em codex/mesa-resilience-cleanup, sem nova Release
ou instalação. Durable adiado por decisão do usuário.

CodeRabbit 0.8.2 revisou o diff dos 12 arquivos: 0 issues. As observações abaixo
são da inspeção local, não apontamentos atribuídos ao CodeRabbit.

| Prioridade | Arquivo | Problema / melhoria | Correção |
|---|---|---|---|
| P2 | desk/rpc.cjs, chat/rpc.cjs | Timeout dizia que cancelou o pedido, embora só encerrasse a espera pela confirmação. O Pi pode continuar, e o usuário poderia reenviar. | Aviso explica que a execução pode continuar e pede conferir antes de reenviar. Timeout continua sem notSent; não libera reenvio automático de entrega incerta. |
| P2 | desk/src/chat.mjs, desk/src/queue.mjs, chat/src/features/queue.mjs | Fila restaurava o composer por polling a cada 16 ms. Mesa apagava texto alheio ao envio; Conversa já preservava com payload explícito. | Mesa só limpa o composer no envio direto e quando o texto ainda é o enviado. Removidos os dois holdDraft, timers e listeners de restauração. Hunt confirma preservação do rascunho. |
| P2 | desk/src/state.mjs, chat/src/state.mjs | setInterval de 15s podia abrir outra consulta de saúde antes de a anterior terminar; o prazo RPC de 20s e leitura de estatísticas permitem sobreposição. | Uma consulta periódica em voo por renderer; finally libera a próxima após sucesso ou falha. Health mede o Pi local, não a disponibilidade da internet. |
| P3 | desk/updater.cjs | Consultas públicas de versão abandonavam a tentativa em falhas transitórias. | GET de metadados tenta novamente uma única vez em erro de transporte/timeout ou HTTP 408/429/502/503/504. Prazo 10s por tentativa; espera padrão 1s; respeita Retry-After até 3s, e não insiste quando o servidor pede espera maior. HTTP definitivo e JSON inválido não repetem. |
| P3 | desk/profiles.cjs, desk/scripts/doctor.mjs, desk/tests/profiles.test.mjs | Lista PACKAGES vazia tinha helper, leitura de settings e loop sem efeito. Segundo teste do adapter repetia a mesma ausência já verificada. | Removido caminho vazio e teste redundante. Extensões nativas, globais escolhidas, overlays e política MCP preservados. Pacotes reais da Conversa são independentes e foram mantidos. |

Diff de implementação e testes: 67 linhas adicionadas, 104 removidas (37 a menos).
A remoção de um timer de 16ms por fila elimina esse polling durante o envio;
não houve benchmark comparativo de CPU/RAM, portanto não se afirma percentual
ou aceleração medida. PDF já possui cache limitado, renderização visível,
worker local e debounce de resize; não foi alterado por suposição.

Validação: Mesa 432/432; Conversa 340/340; testes direcionados 38/38; hunt-queue
aprovado; smokes completos Mesa/Conversa aprovados; sintaxe 144/102 arquivos;
verify:bend desenvolvimento: 64 artefatos reproduzíveis e provas aprovadas.
Testes de transporte usam fetch simulado (falhas HTTP/socket e payload inválido),
sem consulta externa. Sem novas chamadas a provedor real nesta rodada.
Snapshot público: 418 aprovados, 14 ignorados, zero falhas.

Limitações: o retry GET não se aplica a prompts nem downloads ZIP. Não há
retomada parcial de download nem garantia de recuperação de streams do provedor;
esses caminhos preservam rollback e entrega incerta. Internet fraca real,
Linux/Windows, uso com modelo escolhido e captura Xournal++ não foram medidos
nesta rodada. Manteve-se o timeout limitado do rascunho e seu cancelamento.

Não removidos: provas Bend, paridade host/núcleo, testes de entrega/persistência,
rollback e smokes. Eles cobrem camadas distintas. Scripts de migração foram
mantidos para quem atualiza de instalações antigas; não são carregados no
caminho de envio normal. Evitou-se remodelar arquitetura sem ganho demonstrado.

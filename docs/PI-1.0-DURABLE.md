# Pi 1.0 e Durable na Mesa

Avaliação de 1 de outubro de 2026. Fontes lidas integralmente:

- https://earendil.com/posts/pi-1-0/
- https://earendil.com/posts/pi-durable/
- Referência de API: https://github.com/earendil-works/pi/tree/main/packages/durable

## Integração atual

O bundle instalado continua na v0.4.5. Pela configuração e resolução do
executável do bundle, o candidato é `/opt/homebrew/bin/pi`, que reporta 1.0.0.
Nenhum pacote, configuração, sessão de estudo ou bundle foi atualizado nesta
avaliação. O Pi e a versão da Mesa são componentes distintos.

`agent_end` termina uma execução de baixo nível; retries, recuperação de
contexto, compactação e mensagens internas enfileiradas podem continuar depois.
`agent_settled` encerra o ciclo completo da sessão. Esse contrato também existe
no Pi 0.99.1, mínimo já exigido pelo projeto.

As pontes guardam um ciclo pendente após aceite `started` e eventos de
início, até `agent_settled` ou queda/parada do processo. `get_state.isStreaming`
sozinho não libera a fila nos intervalos de retry. `queued` não inicia ciclo
por si só; limpar uma fila interna sem execução não deixa a ponte presa.
Compactação e mensagens
pendentes também contam como ocupação. Uma confirmação tardia não reabre um
ciclo já concluído. `handled` não começa ciclo por si só.

Mesa e Conversa liberam o composer, seus avisos de conclusão e suas filas no
settled. O rascunho de revisão usa outro processo, sem ferramentas, extensões,
skills ou sessão persistida: espera settled, cancela quando o diálogo fecha e
recusa retry ou solicitação interativa. Não altera a conversa principal. Uma
consulta auxiliar de modelo que falha usa o padrão do Pi e registra o motivo no
log. Modelos virtuais fornecidos por extensões não estão garantidos nesse
worker sem extensões: devem receber validação própria antes de anunciar suporte.

O limite dos retries anunciados inclui `auto_retry_start` e
`summarization_retry_scheduled`. Entrega incerta continua segurando a fila.
Não se introduziu identidade idempotente no RPC do coding agent.

## O que Durable oferece

É um pacote/framework experimental separado, não uma opção ativada pelo
upgrade do coding agent. Aplicações instanciam um `Harness`, storage,
registro de extensões, modelos/provedores e ambiente de execução.

Há backends de memória, SQLite e JSONL. Checkpoints persistem tarefas, fila,
histórico, saídas parciais e estado da aplicação. Ao reabrir o mesmo storage,
`resume()` pode continuar tarefas pendentes. Respostas de modelo interrompidas
são marcadas como abortadas e o pedido é repetido. Ferramentas só se repetem
automaticamente quando declaradas `replay: "safe"`; outras retornam interrupção
para o modelo. Isso não impede o próprio modelo de propor uma nova ação.

Submissões com o mesmo `requestId` devolvem a submissão existente. Essa
identidade pode resolver a dúvida entre “aceitou” e “não recebi a confirmação”.
Ela não torna efeitos em serviços externos exatamente uma vez. Mesmo uma
ferramenta replay-safe precisa ser idempotente quando faz escrita externa.

Conversas/forks, documentos em commits atômicos e views observáveis facilitam
retomada de UI, busca de histórico anterior à compactação e estado consistente.
O histórico antigo permanece no storage; compactar limita o contexto do modelo,
não apaga as mensagens.

## Proposta para a Mesa (não implementada)

1. Criar um backend opt-in, com banco novo e um único processo dono. A referência
   atual não fornece lock entre processos; o host precisa impor esse lock.
   O caminho RPC/JSONL atual permanece disponível como recuperação.
2. Uma conversa Durable por conversa da Mesa. Guardar UUID da submissão no disco
   ANTES de chamar `submit`; a mesma mensagem usa o mesmo `requestId` em toda
   reconexão. Bilhetes precisam da própria identidade persistida, estável ao
   mover o arquivo de fase. A retomada consulta o status, sem criar outra entrada.
3. Devolver aceite somente depois do commit da submissão. Distinguir aceite,
   execução, conclusão e falha. Reconstituir UI pela view do storage; não reenviar
   porque o socket caiu nem porque o renderer recarregou.
4. Começar com rascunhos técnicos e conversas novas de teste. Reabertura após queda
   deve oferecer revisão do trabalho pendente antes de permitir `resume()`, que
   pode produzir chamadas e custos novos. Não habilitar retomada automática de
   ferramentas com efeitos reais sem aprovação e teste próprios.
5. Usar replay-safe somente em leituras comprovadas. Manter políticas MCP,
   aprovações, limites, PDFs somente leitura e isolamento da Conversa. Credenciais
   e extensões do coding agent precisam de adaptação explícita; não pressupor
   descoberta automática nem compatibilidade direta entre os sistemas de plugins.
6. Preservar JSONLs existentes. Não abrir o JSONL antigo como storage Durable:
   o formato e o protocolo são diferentes. Uma futura importação deve ser
   não destrutiva, com origem registrada, conferência de mensagens/anexos e
   contagem; histórico importado não é tarefa pronta para retomar/reexecutar.
7. Validar quedas antes/depois de aceite, durante modelo e ferramenta; repetir
   requestId e medir ausência de duplicatas; validar cancelamento, rollback,
   custo da repetição e comportamento quando falta uma extensão após reiniciar.

Não instalar Durable, migrar sessões ou substituir a ponte faz parte desta
proposta. A API experimental pode mudar; fixar versões só após um protótipo
isolado com testes de falha.

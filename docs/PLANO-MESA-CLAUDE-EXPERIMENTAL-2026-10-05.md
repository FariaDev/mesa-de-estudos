# Mesa de Estudos + Claude Code — primeira versão experimental

Plano de 5 de outubro de 2026. Escopo: implementação futura, local e experimental no macOS do autor. Este documento não anuncia suporte funcionando nem inicia implementação, login, instalação, sincronização do bundle ou publicação.

## 1. Objetivo e decisões

Permitir estudar na Mesa usando o Claude Code original, autenticado pelo próprio usuário, com a assinatura que ele pretende contratar depois da preparação técnica.

Primeiro ciclo completo: escolher Claude Code para uma conversa nova → enviar pergunta e captura do Xournal++ → acompanhar a resposta → cancelar quando necessário → fechar e reabrir a mesma conversa.

Decisões desta versão:

- Claude Code vem antes de Codex/OpenCode como motor da Mesa. A pesquisa geral continua em [Plano multi-harness](PLANO-MULTI-HARNESS-2026-10-04.md).
- Mesa executa o Claude Code diretamente. Pi continua sendo uma opção independente.
- Transporte candidato inicial: interface programática oficial do Claude Code com mensagens estruturadas. Escolha final entre CLI direta e Agent SDK ocorre na prova de transporte.
- Mods são alternativa de pesquisa se houver uma limitação concreta; não são pré-requisito.
- Conversas conservam o motor que as criou. Não há conversão automática de sessões Pi.
- Implementação por subagentes **DeepSeek V4.1 Flash no OpenCode, com esforço max**, delegados pelo Orchestrator V2 do T3; o agente principal integra e confere as mudanças.

## 2. Assinatura e limite de autenticação

**Não integrar a assinatura Claude ao Pi.** Não usar OAuth do Claude em Pi/OpenCode, extrair tokens, encaminhar requisições por um proxy de assinatura, trocar endpoints para simular outro cliente, modificar o binário nem contornar limites de uso. Reutilizar a captura e a interface da Mesa é diferente de reutilizar credenciais em outra harness.

O processo desejado é:

```text
Mesa → adaptador Claude → Claude Code original → Anthropic
Mesa → adaptador Pi     → Pi                  → provedor configurado no Pi
```

O login ocorre no fluxo oficial do Claude Code; a Mesa consulta apenas o estado necessário e não guarda credenciais. A implementação com DeepSeek/OpenCode é um fluxo de desenvolvimento separado, sem acesso à assinatura Claude para executar as tarefas de programação.

As [condições oficiais](https://code.claude.com/docs/en/legal-and-compliance) distinguem login no binário original de oferecer login claude.ai em um produto de terceiros; também impõem condições para produtos que executam Claude Code. Essa distinção orienta o desenho, mas não certifica o enquadramento da Mesa nem garante ausência de suspensão da conta. Antes do ensaio autenticado, reconferir as regras aplicáveis ao desenho concreto. Distribuição pública exige avaliação própria.

O [Help Center](https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan) informa atualmente que SDK e `claude -p` continuam consumindo limites da assinatura após a suspensão da alteração anunciada em junho. Isso não é autorização universal para qualquer integração. Os créditos descritos abaixo do aviso nessa página são históricos.

Para o ensaio da assinatura, detectar configuração de API, endpoint alternativo ou helper de credenciais conflitante e pedir que o usuário resolva a escolha no Claude Code. Não remover configurações globais nem cobrar API como fallback. Não alterar configurações de cobrança ou uso adicional da conta.

## 3. Ponto de partida confirmado

Inspeção nesta conversa, anterior à implementação:

- Checkout da Mesa declara `desk/package.json` 0.4.7; isso não confirma a versão do app aberto/instalado.
- Claude resolve para `~/.local/share/claude/versions/2.1.246` pelo launcher `~/.local/bin/claude`.
- SHA-256 do executável coincide com o manifesto oficial `darwin-arm64` da versão. A verificação `codesign` local falhou; a comparação com a distribuição oficial confirmou identidade do arquivo, sem explicar a falha da assinatura macOS.
- `claude auth status --json` indicou `loggedIn: false`, `authMethod: none`, `apiProvider: firstParty`.
- Não foi encontrado redirecionamento para Codex nas variáveis/configurações inspecionadas. Isso não explica como funcionava a configuração antiga lembrada pelo usuário.
- Nenhuma solicitação a modelo Claude foi feita para estas inspeções. Não há prova de imagem, retomada, permissões ou consumo da assinatura.
- O catálogo vivo do T3 lista `providerInstanceId: opencode`, `model: opencode-go/deepseek-v4.1-flash`, com delegação habilitada e sem restrições declaradas. Isso confirma disponibilidade no catálogo, não uma tarefa executada com sucesso.

## 4. O que entra na primeira versão

| Recurso | Comportamento esperado |
| --- | --- |
| Escolha do motor | Pi ou Claude Code para conversa nova; indicação do motor no histórico |
| Conexão | Detectar executável, verificar versão/capacidades e mostrar falta de autenticação |
| Contexto de estudo | Matéria, questão ativa, instruções de tutor e referências selecionadas |
| Anexos | Captura do Xournal++ e imagem colada; prévia, validação e persistência |
| Resposta | Texto progressivo, ferramentas e avisos coerentes no diário |
| Permissões | Aprovar/recusar pedidos suportados, associados à execução correta |
| Cancelamento | Interromper execução, resolver pedidos pendentes e segurar a fila |
| Conversas | Criar, listar, reabrir, retomar e exportar conversa Claude |
| Fila | Envio sequencial e persistência; nenhuma repetição automática de entrega incerta |
| Referências PDF | Leitura de arquivo autorizada ou envio de página renderizada/extraída; comprovar conteúdo recebido |
| Diagnóstico | Distinguir binário ausente, login ausente, limite atingido, recurso indisponível e queda do processo |

PDFs e materiais de curso permanecem somente leitura. O Xournal++ continua sendo a superfície de escrita; a Mesa não ganha um canvas de tinta.

### Disponibilidade explícita

GeoGebra, quiz via extensão Pi, geração automática de rascunho de revisão, comandos específicos Pi, compactação manual e steer só aparecem para Claude quando houver integração comprovada. Nesta primeira versão, esses recursos específicos ficam indisponíveis em conversas Claude; não chamar um Pi auxiliar silenciosamente. O caderno de revisão manual continua disponível.

Mensagens durante uma resposta entram na fila da Mesa. Não simular steer por cancelar e reenviar. Métricas de contexto/uso só aparecem quando fornecidas pela integração; custo de API estimado não representa cobrança da assinatura.

Ficam fora: outros motores, migração entre harnesses, paridade de extensões globais, suporte Windows anunciado, marketplace de adaptadores e release pública. A Conversa permanece com seu motor atual.

## 5. Arquitetura mínima

```text
Interface Electron da Mesa
        │
Serviço de agente + identidade de conversa + capacidades
        ├── adaptador Pi ─────── ponte RPC existente
        └── adaptador Claude ── transporte oficial ── Claude Code original
```

O contrato interno descreve o que a Mesa precisa, sem exigir que Claude imite o protocolo Pi. A extração acomoda apenas Pi e Claude nesta etapa.

### Operações e eventos

Operações: detectar, conectar, criar/retomar conversa, carregar histórico, enviar, cancelar, responder pedido interativo e encerrar processo pertencente à Mesa.

Capacidades opcionais: imagens, permissões, perguntas interativas, steer, troca de modelo/esforço, compactação, uso de contexto e geração auxiliar. Capacidades dependem da versão do transporte e da combinação motor/modelo; presença no contrato não significa implementação.

Eventos carregam identidade de conversa, conexão/processo, execução e mensagem/pedido: início, delta, ferramenta, pedido interativo, aviso, falha, aceite quando comprovado e término. Permissão de ferramenta e pergunta pedagógica são eventos distintos.

### Transporte Claude: decisão na fase 0

A [execução programática oficial](https://code.claude.com/docs/en/headless) e a [referência da CLI](https://code.claude.com/docs/en/cli-reference) documentam entrada/saída estruturadas, resposta progressiva e retomada. A [documentação de entrada contínua do SDK](https://code.claude.com/docs/en/agent-sdk/streaming-vs-single-mode) apresenta imagens e sessões interativas. Isso sustenta candidatos, não comprova a combinação na Mesa.

1. Verificar flags e formatos da versão instalada; identificar canais oficiais para cancelamento, permissões e confirmação.
2. Tentar CLI direta usando `stream-json`, IDs explícitos de sessão e eventos parciais. Não fazer parsing da tela do terminal nem presumir que toda operação interna é uma API pública estável.
3. Se a CLI exigir controles sem contrato suficiente, avaliar o Agent SDK com o executável original explicitamente selecionado. Fixar versão e dependência somente depois dessa decisão, conferindo também as condições de autenticação/distribuição.
4. Se nenhum caminho atender aos critérios, registrar o bloqueio e investigar Mods. Não compensar com proxy de OAuth, flag privada ou bypass de permissões.

Escolher a porta com base em imagens, permissões, cancelamento, confirmação de envio e retomada, não só na primeira resposta de texto. Login ausente permite testes de estrutura/transporte e falha de autenticação, mas não valida capacidades de inferência.

### Identidade e persistência

- Registro local de conversa: ID estável, motor, versão do adaptador, referência nativa, matéria, anexos e metadados de estudo.
- Identidade não depende de o caminho terminar em `pi-*.jsonl`.
- Sessões Pi existentes continuam reconhecidas com suas chaves de fila/rascunho; adicionar referências compatíveis sem reescrever os JSONLs. Qualquer migração de metadados deve ter backup e verificação.
- Histórico normalizado serve à exibição/exportação. Retomar o agente usa a sessão nativa pelo ID exato; nunca reaplicar mensagens/ferramentas para reconstruir a tela.
- Não usar “última sessão” para escolher uma conversa Claude: guardar e retomar sua identidade explícita.
- Sessões nativas Claude podem permanecer no armazenamento oficial do Claude Code. Documentar a localização; não prometer que todos os dados ficam em `desk/.runtime/`.

### Configuração e processo

Adicionar configuração própria do motor e caminho do Claude, sem colocar seu caminho no campo `pi`. Preservar os defaults do autor em `desk/config.cjs`; seleção experimental por conversa e config do ambiente de teste. Detectar o binário existente sem instalar/atualizar automaticamente.

Usar pasta de trabalho controlada para a conversa, sem descobrir instruções do vault inteiro por acidente. Compor as políticas de estudo explicitamente, mantendo auth e permissões oficiais. Selecionar ferramentas e diretórios autorizados; conferir caminhos e symlinks no host. Orientação no prompt não substitui verificação de acesso nem sandbox.

A Mesa encerra somente processos que criou. Troca de matéria/conversa descarta eventos antigos por identidade, não apenas removendo elementos do DOM. Preservar as conversas abertas no Claude Code fora da Mesa.

## 6. Garantias de entrega, fila e permissões

São critérios de implementação, não propriedades já verificadas do Claude:

- Distinguir pedido preparado, possível envio, aceite comprovado, execução, cancelamento solicitado e encerramento confirmado.
- Uma escrita em stdin, o início do processo ou o término do texto não comprovam esses três últimos estados.
- Determinar na fase 0 que evidência nativa confirma recebimento e como ela se correlaciona com a submissão; replay de mensagem só é confirmação se a semântica for suficiente e comprovada.
- Persistir a marca de envio antes da transmissão. Falha comprovada antes dela pode ser tentada novamente; queda após possível transmissão é incerta e segura o item para conferência.
- Não prometer entrega exatamente uma vez sem deduplicação garantida pela porta. IDs locais isoladamente não oferecem isso.
- Um erro de consulta após aceite não transforma a mensagem em não enviada.
- A fila não avança durante ferramentas, retries, compactação ou permissão pendente. Cancelamento segura a fila até confirmação; diálogos vencidos não recebem respostas novas.
- Pedidos interativos têm IDs, origem e validade. Fechar diálogo não concede aprovação; cancelamento/queda resolve ou invalida o pedido.
- Bilhete Conversa → Mesa preserva as fases e destinos de `desk/handoff.cjs`/`desk/send.cjs`. O branch Claude só reivindica/envia bilhetes depois de cumprir a mesma política de entrega; antes disso, mantém bilhetes pendentes no disco e informa a indisponibilidade. Pi conserva seu comportamento.
- Políticas novas de estado/capacidades/entrega que pertençam ao núcleo recebem leis e provas Bend; processos, transporte e temporizadores ficam no host.

## 7. Pontos de mudança no código

| Área atual | Mudança planejada |
| --- | --- |
| `desk/rpc.cjs` | Preservar PiBridge; acomodar em adaptador Pi |
| Novos módulos em `desk/src/agents/` | Serviço, contrato, capacidades, transporte/adaptador Claude e tradução de histórico |
| `desk/main.cjs` | Criar motor por conversa; compor contexto; integrar estado, envio, permissões e encerramento |
| `desk/send.cjs`, `desk/handoff.cjs` | Manter recusa/aceite/ambiguidade e fases do bilhete com evidência própria de cada motor |
| `desk/lib.cjs`, `desk/pending.cjs`, persistência de estado | Listagem e IDs de conversa independentes de sessão Pi; preservação das chaves antigas |
| `desk/preload.cjs` | Operações de agente e validação IPC; transição controlada dos canais `pi-*` |
| `desk/src/chat.mjs`, `main.mjs`, `queue.mjs`, diário | Consumir eventos/capacidades; mensagem parcial, fila, histórico e eventos antigos |
| `desk/src/dialogs.mjs`, configuração e Componentes | Seleção do motor para conversa nova, pedidos interativos e diagnóstico por motor |
| `desk/review-draft.cjs` e handler correspondente | Bloquear geração auxiliar em conversa Claude até suporte próprio; sem fallback Pi |
| `desk/scripts/doctor.mjs`, setup e documentação | Diagnóstico Claude; seleção não exige instalar Pi; separar instalação de login |
| `core/`, leis/provas e artefatos | Apenas invariantes novas/alteradas; preservar provas existentes |

Nomes novos são uma proposta de organização. Confirmar dependências de cada arquivo antes de repartir trabalho. Não reestruturar a Conversa para esta entrega.

## 8. Etapas e critérios para concluir

| Etapa | Entrega | Critério |
| --- | --- | --- |
| 0 — transporte | Relatório CLI/SDK com contrato, versões e lacunas | Formatos e controles definidos; nenhuma dependência de token/proxy/flag privada |
| 1 — ponte isolada | Adaptador Claude e processo simulado de testes | Texto/imagem estruturados; estado, permissões, cancelamento e falhas exercitados |
| 2 — serviço e identidade | Pi preservado; metadados Claude separados | Reabrir dados simulados sem perder sessões, anexos ou fila antigos |
| 3 — interface experimental | Claude selecionável na Mesa de desenvolvimento | Ciclo completo no Electron com simulação; indisponibilidade e login claros |
| 4 — validação autenticada | Estudo real depois da assinatura/login | Imagem reconhecida, contexto correto, retomada, permissões, cancelamento e limites observados |
| 5 — uso local | Bundle sincronizado quando autorizado | Mesmo comportamento na instalação; app reaberto pelo usuário e evidência registrada |

Depois da fase 3, o estado correto é **preparado para teste autenticado**, não “Claude funcionando com assinatura”. Se a assinatura ainda não existir, a fase 4 permanece pendente explicitamente.

Estimativa inicial para trabalho com foco: fase 0, 1–2 dias; ponte, 2–4; identidade/serviço, 2–4; interface/diagnóstico e regressões, 3–5. Total aproximado **8–15 dias úteis de engenharia** até candidato experimental, condicionado ao transporte. Delegação não reduz esse prazo automaticamente. Testes reais acrescentam tempo de validação e podem exigir correções; reestimar ao concluir a fase 0.

## 9. Validação antes e depois da assinatura

### Antes: artificial e sem consumo Claude

Usar runtime e matéria artificiais separados do ambiente de estudo. Nenhum material de curso, credencial ou transcript pessoal em fixtures.

Testes necessários: texto fragmentado, blocos de imagem, ferramentas intercaladas, retry, permissão aprovada/recusada/cancelada, saída malformada, mensagem grande, conexão perdida antes/depois do possível envio, consulta pós-aceite falha, cancelamento durante ferramenta, evento antigo, reinício e retomada por ID. Garantir ausência de repetição automática e avanço prematuro da fila.

No Electron: selecionar motores, trocar conversa/matéria em momento permitido, restaurar anexos/rascunho/fila, histórico, exportação, diálogo e aviso de login. Exercitar Pi como regressão. Confirmar que novos caminhos Claude não iniciam processos Pi nem importam suas credenciais/extensões.

Rodar, em `desk/`, os testes direcionados, `npm run check`, `npm run verify:bend`, `npm test` e os cenários Electron pertinentes. Consultar os comandos disponíveis no checkout; não supor que existe um teste Claude antes de criá-lo. Acrescentar hunts específicos somente quando contribuírem para falhas reais da integração.

Simulação confirma a lógica da Mesa, não a compatibilidade real com o serviço Claude, as condições de assinatura ou o reconhecimento visual.

### Depois: binário real e conta do usuário

Reconferir executável, auth e regras atuais; login realizado pelo usuário no Claude Code original. Iniciar uma conversa nova de teste com conteúdo escolhido pelo usuário, medir o fluxo no próprio app e registrar separadamente:

1. Pergunta textual e contexto da matéria.
2. Imagem artificial com conteúdo verificável e depois captura real do Xournal++.
3. Página de PDF com referência identificável.
4. Pedido de ferramenta/permissão controlado, aprovação e recusa.
5. Cancelamento e retomada após fechar/reabrir o app.
6. Queda/reconexão controlada sem repetir o prompt incerto.
7. Auth da assinatura observada e variação de uso no fluxo oficial, quando disponível. Campo de custo no stream não prova faturamento.

Nenhuma compra é feita pelo agente. A preparação não exige assinatura, mas também não garante que bastará assinar para concluir a fase 4.

## 10. Implementação com subagentes no T3

Preferência obrigatória informada pelo usuário: **OpenCode + DeepSeek V4.1 Flash, com esforço max em todas as tarefas e rodadas de revisão**. Reconsultar `orchestrator_capabilities` ao iniciar, usando IDs vivos; não substituir o modelo nem reduzir o esforço silenciosamente.

Configuração confirmada em 5 de outubro:

```json
{
  "target": {
    "providerInstanceId": "opencode",
    "model": "opencode-go/deepseek-v4.1-flash",
    "options": [{ "id": "variant", "value": "max" }]
  },
  "mode": "async"
}
```

Esse trecho é parte dos argumentos de `delegate_task`, não uma chamada completa. Cada tarefa inclui `task`, título, papel e `clientRequestId` único, estável em retries. Reter `taskId`; usar `task_status` para resultado necessário durante o trabalho e `task_cancel` quando preciso. Uma nova rodada de revisão usa nova delegação com contexto completo e novo ID; não enviar outra rodada para o `childThreadId`.

### Divisão proposta

| Tarefa | Responsabilidade | Limite de escrita |
| --- | --- | --- |
| A — transporte Claude | Ponte, tradução de eventos e testes de protocolo | Novos módulos Claude e testes próprios |
| B — identidade/persistência | Registro de conversa, histórico e compatibilidade Pi | Módulos de persistência delimitados após contrato congelado |
| C — interface/integração | Configuração, capacidades, IPC, diálogos e diário | Arquivos UI/host atribuídos, depois dos contratos A/B |
| D — revisão | Conferir entregas, casos de falha e regressões | Leitura/testes; relatar problemas sem editar áreas de outros agentes |

Fase 0 e definição do contrato vêm antes dos trabalhos dependentes. A/B só podem executar em paralelo depois de interfaces acordadas e propriedade de arquivos definida. C integra em seguida; o agente principal coordena arquivos compartilhados como `main.cjs`, núcleo, lockfile e os gates. A revisão D pode ser atribuída a outro subagente do mesmo modelo; cada rodada recebe achados, respostas e objeções ainda abertas.

Os subagentes herdam o workspace do thread T3. Não presumir que `cd` ou criar um worktree no prompt muda essa vinculação. Este thread está no vault e a implementação mora em `Code/learning-canvas`; fornecer caminho absoluto e exigir leitura de `AGENTS.md`. Se for usado worktree isolado, estabelecer primeiro a vinculação do thread principal pelo mecanismo próprio do T3.

Cada briefing deve dizer: escopo e arquivos, contrato aceito, origem e estado das evidências, comandos de validação, preservação de sessões/defaults/materiais e proibição de Claude via Pi/proxy/token. Não entregar segredos ou transcripts pessoais aos subagentes. Relato de um agente é evidência relatada; o principal inspeciona diff e resultados antes de anunciar conclusão.

Falha de autenticação/quota/modelo do OpenCode: guardar o resultado e expor o bloqueio, sem mudar provedor/modelo por conta própria. Catálogo disponível não garante execução. Não iniciar threads comuns como substituto de tarefas delegadas.

## 11. Encerramento e entrega

O handoff de cada etapa lista o que foi inspecionado, simulado, executado com Claude real e validado no Electron/bundle, além de lacunas. Nenhum trabalho em app/release está concluído só porque o código ou um comando existe.

Desativar a opção experimental ou voltar a criar conversas Pi deve preservar os dados Claude para futura retomada. Não fazer reset/clean, apagar sessões, alterar defaults aprovados ou fechar apps do usuário para recuperar um teste.

Este plano autoriza organizar a implementação futura conforme o pedido, mas não inclui compra de assinatura, atualização automática do Claude Code, alteração de configuração global, instalação do bundle ou publicação. A próxima tarefa técnica é a **fase 0: prova de transporte e contrato do adaptador Claude**.

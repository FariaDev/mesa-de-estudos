# Mesa + Claude: comparação com T3 Code

Inspeção em 5 de outubro de 2026 do repositório público `pingdotgg/t3code`, commit `1604ccc9d79f5270fb8e14d60664184bf142c4cb`. Checkout de pesquisa em `/tmp/mesa-t3code-research-20261005`, sem instalar dependências nem executar o T3. Código da Mesa inspecionado no checkout local. Nenhuma alteração de implementação, aplicativo instalado, login ou inferência nesta rodada.

## Conclusão

Usar o T3 como referência técnica compensa. A arquitetura fundamental já coincide: SDK oficial controlando Claude Code, consulta persistente com entrada assíncrona, identidade nativa explícita e eventos normalizados pelo adaptador. Recomenda-se portar comportamentos selecionados e seus cenários de teste, mantendo as restrições de arquivos, ferramentas e entrega da Mesa.

O T3 é MIT, copyright 2026 T3 Tools Inc. Sua licença permite copiar/adaptar sob suas condições; se houver cópia de código ou porções substanciais, preservar o aviso de copyright e a licença. Nenhum código do T3 foi copiado nesta rodada.

## Evidência inspecionada

Todos os caminhos T3 abaixo são relativos ao commit indicado.

| Tema | T3 Code | Mesa / decisão |
| --- | --- | --- |
| Transporte | `apps/server/src/orchestration-v2/Adapters/ClaudeAdapterV2.ts:610`: `query({prompt, options})`, fila convertida em AsyncIterable | `desk/agents/claude-adapter.cjs:996`: mesma base com MessageQueue |
| Identidade | Adaptador T3:843 escolhe `sessionId` para criar e `resume` para retomar | Mesa:1063 faz a mesma escolha, com ID persistido e imutável |
| Binário | Adaptador T3:904 passa `pathToClaudeCodeExecutable`; `provider/Drivers/ClaudeExecutable.ts` trata launchers Windows | Mesa usa binário original resolvido e versão pareada estritamente; manter o pin durante o experimento |
| Login | `docs/user/providers-claude.md` usa configuração/login do CLI; `provider/Drivers/ClaudeHome.ts` usa CLAUDE_CONFIG_DIR, preservando HOME/keychain | Mesa não implementa login nem copia tokens; preservar esse limite |
| Cancelamento | Adaptador T3:700 chama `queryRuntime.interrupt()` | Mesa:615 usa interrupt e espera conclusão confiável |
| Modelos/esforço | `apps/server/src/claudeModelOptions.ts` compila opções por capacidades; adaptador passa model/effort e oferece setModel | Mesa desabilita esses controles nesta versão. Portar depois de testar o transporte autenticado e conferir compatibilidade do SDK pinado |
| Perguntas | Adaptador T3:6634 responde AskUserQuestion por callback, updatedInput e signal | Mesa nega explicitamente esse recurso. Bom candidato posterior, com UI/identidade/cancelamento próprios |
| Imagens/arquivos | Adaptador T3:1262 envia imagem base64; arquivos entram como caminhos e a consulta concede additionalDirectories | Mesa envia imagem base64 e limita leituras aos arquivos selecionados. Não copiar concessão ampla de diretórios |
| Saúde/catálogo | `provider/Layers/ClaudeProvider.ts` inicia SDK sem prompt, desliga hooks/MCP e consulta initializationResult; uso vem de API explicitamente experimental | Mesa usa version/auth status sem iniciar sessão. Não substituir por probe periódico nesta fase |
| Testes | `ClaudeAdapterV2.test.ts` e fixtures de replay cobrem limites, retomada, múltiplos turnos, erros, perguntas e cancelamento | Inspecionados, não executados. Portar os cenários relevantes sem material pessoal |

## Correção prioritária encontrada: limite de assinatura

No T3, `ClaudeAdapterV2.ts:5438` trata `message.type === 'rate_limit_event'`. Distingue limite rejeitado, aviso, liberação e overage; guarda tipo/reset e informa a pausa sem declarar o turno encerrado.

Na Mesa, `_handleMessage` ignora esse tipo de evento. O tratamento existente em `_handleSystem` espera `subtype === 'rate_limit_event'`, sob `type: 'system'`. O próprio SDK instalado `@anthropic-ai/claude-agent-sdk@0.3.246`, `sdk.d.ts:4610`, declara `SDKRateLimitEvent` como evento de primeiro nível.

Reprodução local com instância desconectada, UUIDs e evento artificiais, sem carregar o SDK ou iniciar processos/rede:

```json
{"officialShape":[],"legacySystemShape":[{"type":"warning","code":"CLAUDE_RATE_LIMITED"}]}
```

Impacto confirmado: aviso nativo de limite pode ser descartado; usuário pode ver o agente ocupado sem saber que aguarda reset. Não foi demonstrado envio duplicado, quebra da fila ou banimento. Correção proposta: reconhecer o tipo nativo, mostrar reset quando disponível, distinguir aviso/overage de bloqueio e manter o turno/fila aguardando conclusão ou cancelamento. Testar rejeição, liberação, repetição, outra sessão e cancelamento. Não atualizar o SDK apenas para copiar o T3 (que declara `^0.3.276`).

## Assinatura e autorização do fornecedor

O README e a documentação do T3 afirmam suporte a assinaturas e login via CLI. Isso evidencia a intenção e implementação do projeto; não prova autorização específica da Anthropic nem garante ausência de bloqueio para outra aplicação.

A documentação oficial consultada hoje mantém a restrição de oferecer login/limites claude.ai em produtos de terceiros sem aprovação prévia. O alcance dessa regra sobre um experimento estritamente pessoal não foi determinado nesta inspeção. Licença MIT do T3 não substitui condições da Anthropic. Não houve teste autenticado nesta rodada.

## Fontes

- [Adaptador no commit inspecionado](https://github.com/pingdotgg/t3code/blob/1604ccc9d79f5270fb8e14d60664184bf142c4cb/apps/server/src/orchestration-v2/Adapters/ClaudeAdapterV2.ts)
- [Configuração Claude no T3](https://github.com/pingdotgg/t3code/blob/1604ccc9d79f5270fb8e14d60664184bf142c4cb/docs/user/providers-claude.md)
- [Licença](https://github.com/pingdotgg/t3code/blob/1604ccc9d79f5270fb8e14d60664184bf142c4cb/LICENSE)
- [SDK oficial: autenticação e condições](https://code.claude.com/docs/en/agent-sdk/overview)

Próxima etapa recomendada: corrigir o tratamento do limite nativo e acrescentar os testes correspondentes antes de sincronizar o aplicativo instalado; depois validar o transporte com a conta do usuário. Modelos/esforço e perguntas ficam para uma rodada separada.

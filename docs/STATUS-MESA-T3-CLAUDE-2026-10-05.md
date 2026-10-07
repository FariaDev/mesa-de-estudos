# Mesa + Claude: adaptação da integração T3

5 de outubro de 2026. Implementação integrada no código; testes automáticos abaixo passaram. Última revisão independente concluída, sem bloqueadores P0/P1 novos. A conta real e o aplicativo instalado não foram usados na validação.

## Resultado da rodada

- Catálogo nativo, escolha de modelo/esforço por conversa, retorno ao padrão nativo e restauração sem alterar identidade de sessão.
- Troca atômica com persistência após sucesso, rollback e bloqueio durante turno, permissão, configuração ou entrega incerta.
- Perguntas estruturadas com seleção única/múltipla, texto livre, validação, Cancelar/Escape e proteção contra respostas vencidas.
- Limites nativos por janela, retry com metadados e avisos de fallback, sem limpar busy ou avançar a fila indevidamente.
- Resultado sem eco de UUID liquidado apenas com aceite comprovado e ausência de evidência estrangeira/degradação.
- Cancelamento aceito com fim nativo observado encerra sem falsa incerteza; próxima consulta retoma o mesmo ID. A fila cancelada fica guardada.
- Incerteza persistida é hidratada no serviço e adaptador; bloqueia envio e controles depois de reabrir, sem reenvio automático.
- Cache limitado por bytes UTF-8, com poda que evita reserializar imagens repetidamente. Histórico nativo paginado e exportação preservados.

Pi permanece padrão e usa seu transporte próprio. Mesa e Xournal++ continuam janelas separadas. `chat/`, dados pessoais, materiais de curso e bundle instalado foram preservados.

## Referência e compatibilidade

Referência: `pingdotgg/t3code`, commit `1604ccc9d79f5270fb8e14d60664184bf142c4cb`, checkout temporário `/tmp/mesa-t3code-research-20261005`. Adaptação conceitual, sem cópia literal/substancial de código nas entregas desta rodada; referência MIT © 2026 T3 Tools Inc.

A Mesa mantém SDK `0.3.246` e Claude Code pareado `2.1.246`. APIs conferidas nos tipos locais pinados; fixtures do T3 representam comportamento, não paridade de versões. Contrato em [CLAUDE-TRANSPORT-EXPERIMENTAL.md](CLAUDE-TRANSPORT-EXPERIMENTAL.md).

## Validação executada pelo principal

| Verificação | Resultado |
| --- | --- |
| `npm test` | 656/656 passaram; pré-portão de sintaxe, build, provas e paridade passou |
| Sintaxe no pré-portão | 175 arquivos válidos |
| `npm run verify:bend` | 66 artefatos reproduzíveis, nenhum byte mudou, provas verdes |
| `npm run test:claude-ui` | Quatro harnesses Electron passaram em sequência |
| Claude geral | Texto/imagem artificiais, streaming sem duplicação, permissões, fila, cancelamento, reabertura, histórico/exportação e zero Pi |
| Claude controles | Catálogo sem prompt; troca combinada modelo/max; patch inválido atômico; padrão nativo; busy; restauração; identidade e zero Pi |
| Claude ciclo de vida | No-echo; perguntas única/múltipla/texto/Cancelar; retry529/fallback; duas janelas de limite; falhas recuperáveis; interrupt-exit e resume exato |
| Claude recuperação | Incerteza persistida bloqueia controles/envio; corrupção preservada; nova conversa; exportação de 501 linhas nativas; zero Pi |
| `node tests/ui-smoke.mjs` | Passou: Pi artificial, UI geral, flags, abas, PDF/GeoGebra, chaos/timeout, diálogos, fila e retomada |
| Revisão independente final | Sem bloqueadores P0/P1 novos; 223 testes focados e duas sondas comportamentais verdes |
| `git diff --check` / `git status --short chat` | Sem erros de whitespace; `chat/` sem alterações |

SDK, login, respostas, imagens e cursos dos harnesses são artificiais; runtimes temporários. Nenhuma inferência autenticada, atualização de CLI/SDK, instalação/sincronização, commit, push ou release foi executada. O app instalado usa sua própria cópia do código e pode continuar sendo usado durante o trabalho.

Logs da rodada: `/tmp/mesa-t3-final-pure-tests-20261005.log`, `/tmp/mesa-t3-final-electron-20261005.log` e `/tmp/mesa-t3-final-pi-electron-20261005.log`.

## Delegação e revisões

Todos os agentes desta rodada: T3/OpenCode, `opencode-go/deepseek-v4.1-flash`, `variant=max`, `runtimeMode=full-access`, `interactionMode=default`. Autorização do usuário para código/testes necessários; credenciais, sessões pessoais e materiais de curso excluídos.

Prefixo dos taskIds: `node:delegated-task:command%3Amcp%3A697fdaa1-ae1e-41b5-83d9-d85ddde4692b%3Adelegate-task%3A`.

| Sufixo | Entrega | Estado |
| --- | --- | --- |
| `mesa-t3-20261005-transport-r1` | Eventos de limite, perguntas, TTL e códigos nativos | Concluído |
| `mesa-t3-20261005-controls-r1` | Catálogo e validação puros | Concluído |
| `mesa-t3-20261005-lifecycle-research-r1` | Auditoria; falhas de no-echo/cancel-exit reproduzidas | Concluído |
| `mesa-t3-20261005-question-ui-r1` | Primeira interface de perguntas/limites | Concluído |
| `mesa-t3-20261005-native-controls-r2` | Query, controles, rollback e transição RESUMED | Concluído |
| `mesa-t3-20261005-lifecycle-policy-r2` | Política pura de resultados, query-end, falhas e retries | Concluído |
| `mesa-t3-20261005-host-review-r2` | Achados H1–H6; correções integradas no host/testes | Concluído |
| `mesa-t3-20261005-question-ui-hardening-r2` | Cancelar vazio, chaves especiais, múltiplas janelas e erros recuperáveis | Concluído |
| `mesa-t3-20261005-lifecycle-integration-r3` | Política ligada ao adaptador, incerteza hidratada e respostas seguras | Concluído |
| `mesa-t3-20261005-final-review-r4` | Revisão independente da integração final | Concluído; 223 testes focados e duas sondas verdes |

Relatórios detalhados em `docs/reviews/mesa-t3-*-20261005.md`. Propriedade dos arquivos foi dividida; principal integrou serviço/host/estado, persistência, núcleo, fixtures e validação.

## Limites e próximo passo

Ainda não se comprovou o funcionamento com a assinatura do usuário: resposta e imagem/Xournal++, catálogo/troca de modelo/esforço, permissão/cancelamento, retomada e limites reais. O próximo passo é uma rodada autenticada controlada com o Claude Code original quando houver login disponível.

Compactação manual, steer, forks/agentes em segundo plano e diálogo `resume_return` continuam fora deste experimento. Fallback mostra aviso e metadados; a remoção do texto parcial retratado está adiada, então ele pode permanecer visível junto ao aviso. Não houve teste ou alteração do confinamento adicional do CLI.


A revisão final está em [mesa-t3-final-review-20261005.md](reviews/mesa-t3-final-review-20261005.md). Hashes do código rechecados pelo principal: todos correspondem ao snapshot auditado. Os portões completos do principal já passaram; o parecer do agente não os reivindica como executados por ele.

Observações não bloqueantes registradas para próximas rodadas: controle nativo que estoura prazo pode continuar em voo (rollback depende da ordenação do canal do SDK, sem leitura de volta); reconectar a mesma instância de adaptador durante uma inicialização antiga não é suportado pelo host; mapas auxiliares têm tetos, mas nem todos são zerados no close; faixa de limite pode levar cerca de um segundo para atualizar após liberação; mensagem única acima de 12 MiB pode ficar sem cache local, com sessão nativa preservada. Esses limites não foram apresentados como validação em conta real.

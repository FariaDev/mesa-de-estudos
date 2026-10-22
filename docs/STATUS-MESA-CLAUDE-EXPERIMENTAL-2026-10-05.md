# Mesa + Claude Code — execução experimental

Implementação local autorizada em 5 de outubro de 2026. Subagentes T3/OpenCode com `opencode-go/deepseek-v4.1-flash`, `variant=max`, receberam somente código e testes necessários, excluindo credenciais, sessões pessoais e materiais de curso.

## Estado

Candidata experimental concluída no código, com revisões independentes e validação com dados artificiais. Não houve inferência autenticada. O aplicativo instalado não foi substituído.

Cada conversa guarda seu motor. O Pi continua como padrão; Claude usa o SDK oficial diretamente com seu binário original. Descritores Claude têm ID nativo explícito, workspace isolado, cache para exibição offline e estados de entrega persistidos. Incerteza segura o envio; não há fallback para Pi, reenvio automático ambíguo, login dentro da Mesa ou cópia de tokens.

## Validação executada pelo principal

| Verificação | Resultado e alcance |
| --- | --- |
| `npm test` | 525/525 passaram no snapshot final, incluindo o portão do núcleo |
| `npm run check` | Sintaxe passou em 164 arquivos |
| `npm run verify:bend` | 66 artefatos reproduzíveis, nenhuma diferença de bytes, provas verdes |
| `npm run test:claude-ui` | Passou no Electron com SDK, matéria e runtime artificiais |
| `tests/claude-host-recovery.mjs` | Passou: envio interrompido fica incerto, arquivo corrompido preservado, nova conversa possível, 501 entradas nativas artificiais exportadas sem duplicação |
| `tests/session-switch.mjs` | Passou com Pi artificial |
| `tests/ui-smoke.mjs` | Passou novamente após C2 e os ajustes finais dos diálogos/rótulos; exit 0 |
| `git diff --check` | Passou; `chat/` sem alterações |

O smoke Claude cobre: seleção do motor da próxima conversa, texto e imagem sem bolha duplicada, deltas fragmentados, permissões permitir/negar/cancelar e pedidos vencidos, fila que espera permissão e conclusão do turno, erro do SDK simulado segurando a fila, cancelamento/incerteza sem retry automático, retomada com fila segurada, exportação pela API de histórico paginada, cache visível com falha de versão/login ou ausência de binário, zero processos Pi nesses fluxos Claude e retorno à conversa Pi original preservada byte a byte. Todas essas inferências/históricos são do SDK simulado.

Correções durante a verificação: iterador do adaptador não perde o segundo envio enquanto o SDK espera (três turnos testados na mesma consulta); stream/final correlacionados pelo ID da mensagem; fechamento atrasado de permissão cancelada não afeta o diálogo seguinte; rótulos de resposta seguem o motor. Sequência de enqueue antes do modal e espera da remoção animada da faixa tornaram o smoke determinístico. O fake-Pi antigo persiste só perguntas; a resposta artificial emitida foi adicionada explicitamente ao JSONL da fixture para provar o retorno com histórico de resposta/LaTeX.

## Transporte nativo estrutural

SDK oficial `@anthropic-ai/claude-agent-sdk@0.3.246`, com pin exato. Binário original selecionado explicitamente: `~/.local/share/claude/versions/2.1.246`.

Probe SDK real em diretório temporário, com `--bare`, sem persistência e endpoint local indisponível. Não usa a conta do usuário nem faz inferência. Observado:

```json
{"type":"init","version":"2.1.246","authSource":"none"}
{"type":"replay","matched":true,"isReplay":true}
{"type":"result","isError":true,"totalCost":0,"reason":"api_error"}
```

Comprova spawn do binário original, framing e replay correlacionado. Não comprova resposta autenticada, reconhecimento de imagem/PDF ou uso da assinatura.

`npm run doctor:claude` encontrou o binário 2.1.246: `loggedIn:false`, `authMethod:none`, `apiProvider:firstParty`, sem conflito/aviso. Não houve login, atualização do Claude Code, install-app, commit, push ou release. Electron local foi restaurado pelo instalador oficial/cache somente para os testes.

## Revisões e limites conhecidos

Relatórios em `docs/reviews/mesa-claude-integration-20261005-r1.md`, `mesa-claude-host-20261005-r2.md`, `mesa-claude-ui-20261005-r{1,2}.md` e `mesa-claude-ui-final-20261005-r3.md`. Host r2 e interface r3: sem novo bloqueador; 90 testes puros reexecutados pelo revisor do host. Correções posteriores preservam o cache recente diante de prévia nativa incompleta e limitam o cache em memória a 5.000 mensagens/12 MiB.

Aceite final do principal: ID nativo imutável também na API de atualização, antes/depois da primeira entrega, decidido por `sameNativeIdentity` no núcleo Bend com leis/provas. Teste garante recusa de redirecionamento sem alterar os bytes nem outros campos do patch. Mensagem de erro diferencia registro indisponível de conversa de outra matéria. Lacunas de prova `[claude:multi]` e `[claude:error]` foram cobertas no Electron; a paginação além de 200 entradas é provada pelo teste de 501 entradas artificiais. Após esses ajustes, 525/525 testes, sintaxe, Bend e smoke Claude passaram novamente. Os pareceres descrevem seus snapshots anteriores; estes resultados posteriores são do principal.

A prévia nativa tem teto de 200 entradas/8 MiB, com aviso de limite. Exportação consulta exclusivamente o ID da conversa pela API oficial, em páginas de 200 entradas (offset após filtro interno do SDK); acima de 32 MiB/10.000 entradas recusa antes de gravar arquivo parcial. Escritas do descritor ainda regravam o documento inteiro: 27–41 ms medidos pelo revisor com 11,9 MiB, melhoria futura de desempenho.

`desk.pinnedExtensions` descartado pelo schema é um problema pré-existente identificado pelo revisor e registrado para rodada própria; defaults e configuração pessoal não foram alterados para corrigi-lo. AskUserQuestion estruturada, seleção de modelo/esforço, compactação manual, bilhetes Conversa, quiz/GeoGebra via agente e medidor de contexto Claude ficam indisponíveis nesta versão; o caderno manual e as referências locais continuam.

## Etapa autenticada pendente

Depois da assinatura, o usuário faz login no Claude Code original. Validar então texto, imagem artificial/captura Xournal++, referência PDF, permissão real, cancelamento e retomada de sessão nativa, além de confirmar autenticação por assinatura e ausência de API paga. Os testes artificiais e o probe estrutural não substituem essa etapa. Não há garantia de comportamento real ou de limites de assinatura antes dessa validação.

Para executar a candidata do código: fechar a Mesa instalada, entrar em `desk/`, usar `npm start` e selecionar **Claude Code (experimental)** junto de **Nova conversa**. O app instalado permanece separado desta candidata.

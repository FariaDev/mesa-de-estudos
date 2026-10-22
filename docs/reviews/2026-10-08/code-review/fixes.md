Correções da revisão — 08/10/2026

Os 12 itens de `review.md` foram tratados no checkout da Mesa. Base das correções: `d8a06b1` (a integração posterior à revisão original). A correção de remapeamento de materiais já estava nessa integração; sua regressão passou novamente. As demais correções foram aplicadas nesta rodada.

| Item | Resultado |
|---|---|
| 1. Conversas de outras matérias no pacote | Leitura do schema real de `desk.json`, compatibilidade com o legado e dono único por caminho absoluto. Conversa sem dono, com dono ambíguo ou de outra matéria fica fora do pacote. |
| 2. Material restaurado sem remap na config externa | Decisão de remapeamento independente de mudanças nos stores; regressões de config externa, origem ausente e remap explícito passaram. |
| 3. Automático impedido por manutenção | Atividade real persistida em `meta.activeAt`; batimentos sem tempo ativo, índice e logs não renovam a inatividade. Consulta prévia não adquire lock nem persiste. Um ciclo devido não regrava artificialmente o estado da janela antes da checagem. |
| 4. Push involuntário | `integrate`/`commitSnapshot` fazem somente commit local. O botão de envio é explícito. Na CLI, `--remoto` chama a operação de push explicitamente. |
| 5. Git bloqueando Electron | `asyncApi` executa Git em worker; status, commit, envio e recuperação são aguardados pelos serviços. Teste com Git real confirma que os timers do processo principal continuam funcionando. |
| 6. Automático sem Git | Manual e automático usam a mesma etapa de commit local. Falha de Git mantém o snapshot e aparece no status. |
| 7. Chat vazio após restaurar | Estado de conexão atualizado, conversa carregada e tutor reconectado quando disponível. Falha de conexão fica visível sem desfazer uma restauração já aplicada. E2E verifica histórico e estado conectado. |
| 8. Desfazer em registro órfão | Token opaco do host restaura o registro original no mesmo escopo e prazo. Referência indisponível continua indisponível; criar anotação com caminho não autorizado continua recusado. |
| 9. Livre no filtro de outra matéria | Resultados Livre têm dono `mesa-free`; escopos de notas `free:` são associados a esse dono na filtragem. Conversas sem dono entram somente sem seleção explícita. Regressão cobre também cache. |
| 10. Texto do intervalo Bom | Texto corrigido para crescimento de 2,5×, lei ajustada e artefato regenerado. |
| 11. Corrida no cache de build | Build em staging exclusivo; diretório completo publicado por rename. Não remove o cache de outro processo. Regressão com dois processos simultâneos e terceiro importador passou. |
| 12. Capturas sobrescrevendo evidências | Helper grava por padrão em `tests/artifacts` com diretório exclusivo. `MESA_REVIEW_SHOTS=1` ou um caminho explícito habilita publicação de evidências. Cinco scripts apontados na revisão adotaram o helper. |

Validação

- Suíte final: **1.096/1.096**, sem falhas ou skips (`fixes-tests.log`).
- `verify:bend`: 78 artefatos reproduzíveis; provas verdes, toolchain pinada (`fixes-bend.log`). O primeiro rebuild atualizou o artefato da mensagem corrigida; a execução seguinte não mudou bytes.
- Build, provas e seis verificadores de paridade executados pelo portão da primeira suíte completa; a suíte final reutilizou o cache desse portão.
- Sintaxe: 290 arquivos (`fixes-syntax.log`).
- Electron: fluxo de backup/restauração/exportação/importação com histórico recarregado; interface de busca, retomada, notas, revisão e backup passou (`fixes-backup-e2e.log`, `fixes-study-ui.log`).
- CodeRabbit: rodada final concluiu com **0 issues** em 30 arquivos (`fixes-coderabbit-final.ndjson`). Conferência de bytes confirmou que o código final é o código revisado.
- Git em Electron real: commit local e leitura de status pelo worker/IPC passaram; o fluxo completo de restauração também passou com Git habilitado (`fixes-electron-git.log`).
- `git diff --check`: sem erros.

Limites: dados sintéticos, tutor e seletores nativos simulados, Git local sem rede. Sem teste em Windows ou provedor real. Não houve commit, push, release, instalação, alteração dos defaults pessoais ou dos materiais do usuário.

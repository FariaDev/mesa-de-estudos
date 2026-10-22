# Mesa — validação das melhorias após 0.5.0

Data: 07/10/2026. Branch: `codex/mesa-backup-study-tools`. Implementação local; sem commit, push, release ou atualização da instalação pessoal.

## Entrega

- Barra visível com busca, Revisar hoje, anotações, estatísticas, backup e compartilhamento; diálogos com margens e verificação em 900×650.
- Conversas com título, assunto, favoritos e filtros. Retomada preserva rascunho, material e layout por conversa. Conversas antigas não expiram em sete dias; o teste inclui uma conversa de um ano.
- Tutor prepara conteúdo para a prévia editável de PDF dentro de uma matéria. O usuário revisa e salva; PDFs entram na biblioteca. No Livre, é possível copiar um PDF para uma matéria existente, preservando o original.
- Busca local entre conversas, chats laterais, notas, Caderno, Livre e materiais. Resolução verifica o destino autorizado antes de navegar; índices parciais são informados.
- Anotações associadas ao material/página, sem alterar o PDF. Caderno com agenda de revisão e avaliações. Referências indisponíveis mantêm o texto e mostram aviso.
- Estatísticas locais de tempo ativo, sessões, perguntas aceitas e tokens informados pelo provedor. Pausa, ociosidade, suspensão e tempo com app fechado não contam. Ausência de dados de tokens aparece como indisponível.
- Backup local versionado, prévia de restauração, recuperação de interrupção e Git opcional. Restauração pode usar cópias dos materiais e restaurar configurações pessoais por opção explícita. Campos desconhecidos da configuração são preservados.
- Exportação/importação de matéria com materiais, notas, Caderno e conversas. Anotações são reancoradas ao destino; referências não resolvidas preservam o texto. Conversa Claude importada mantém o contexto e não anuncia retomada nativa da sessão de outra máquina.

## Correções finais

Foram corrigidos navegação da busca para PDFs do Livre, erros de chat lateral corrompido, visibilidade de referências ausentes no Caderno, portabilidade das anotações, configuração externa ao runtime, caminhos de materiais restaurados e preservação de preferências extras.

Métricas usam IDs estáveis, evitam contagem duplicada de eventos repetidos e aguardam a informação de uso antes de marcar tokens ausentes. O histórico Claude distingue o prefixo importado do histórico nativo: uma pergunta nova igual a uma antiga continua visível, inclusive após reabrir.

## Evidência executada

Comandos abaixo foram executados em `desk/`.

| Verificação | Resultado |
| --- | --- |
| `MESA_GATE_CACHE=0 npm test` | Build, provas e paridade aprovados; 991 testes passaram nessa rodada anterior às últimas correções de histórico. |
| `npm test` — rodada final | 993/993 passaram; sintaxe de 268 arquivos; portão reutilizado após verificar a identidade do conteúdo relevante. |
| `npm run verify:bend` | 74 artefatos reproduzíveis, nenhum byte mudou; provas verdes. |
| `node tests/run-claude-ui.mjs` | Quatro fluxos Electron passaram: interface, controles, ciclo de vida e recuperação. SDK/CLI simulados. |
| `node tests/course-pdf-ui.mjs` | Prévia persistida, impressão real do PDF com conteúdo revisado, Livre → matéria, original preservado e 900×650. Tutor simulado. |
| `node tests/chat-library-ui.mjs` | Conversa antiga, rótulos, favoritos, filtros, retomada, rascunhos separados, reabertura e 900×650. Pi simulado. |
| `node tests/study-features-ui.mjs` | Barra, notas, busca entre matérias, retomada, revisão, métricas, backup e diálogos. Pi simulado. |
| `node tests/study-backup-e2e.mjs` | userData temporário normal, sem `LEARNING_DESK_RUNTIME`: backup real, prévia, restauração pela UI, configuração com extras preservada, original intacto, exportação/importação e notas/Caderno/conversas acessíveis. |
| Testes focados de histórico/integração/conversas | 30/30 passaram após a correção do prefixo importado. |

O checkout também contém trabalho concorrente em renderização de PDF e empacotamento. Foi preservado e entra na suíte global; não é atribuído a esta entrega.

## Capturas

Capturas da interface Electron real com materiais e conversas sintéticos; não são mockups.

- [Conversas](chat-library-ui/01-conversas.png)
- [Prévia de PDF na matéria](course-pdf-ui/01-previa-na-materia.png)
- [Adicionar PDF do Livre à matéria](course-pdf-ui/02-adicionar-a-materia.png)
- [Ferramentas visíveis](study-tools-ui/01-ferramentas.png)
- [Anotações](study-tools-ui/02-anotacoes.png)
- [Busca](study-tools-ui/03-busca.png)
- [Revisar hoje](study-tools-ui/04-revisar-hoje.png)
- [Estatísticas](study-tools-ui/05-estatisticas.png)
- [Backup](backup-e2e/01-backup.png)
- [Prévia da restauração](backup-e2e/02-previa-restauracao.png)

## Limites

Não houve teste com provedor autenticado, credenciais reais, remoto Git real ou Windows. Seletores nativos dos testes de backup foram simulados. Os testes não alteraram runtime ou materiais pessoais.

Tempo histórico não é estimado retroativamente. Tokens dependem do que o provedor reporta; sem ID/timestamp, eventos idênticos têm limites de deduplicação. A busca tem tetos e sinaliza resultados parciais. PDFs pelo tutor usam Markdown/LaTeX do app e não reproduzem exatamente a tipografia de uma lista de referência.

Pacotes de matéria não transportam os rótulos da biblioteca de conversas; backups completos os preservam. Materiais de outra máquina podem ser usados pelas cópias restauradas. Uma pasta Git escolhida para backup é um espelho do snapshot e deve ser dedicada a essa função.

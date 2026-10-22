# UI interativa, PDF e timeline na Mesa

Implementação local autorizada em 2026-10-08, baseada no
[plano aprovado](PLANO-UI-INTERATIVA-PDF-TIMELINE-2026-10-08.md).
Status: implementação local concluída e revisões de fechamento aceitas em
2026-10-09. O app instalado não foi atualizado.

## Atividades para aprender

O tutor principal pode publicar uma atividade em HTML/CSS/JavaScript na própria
conversa, tanto no Livre quanto numa matéria. A atividade aceita interações
locais, gráficos, animação e simulação. Os exemplos de MRUV, funções com
parâmetros e probabilidade ajudam a escrever atividades; não limitam o formato.

O card mostra título, objetivo, descrição textual e os controles Abrir,
Ampliar, Parar, Reiniciar e Levar ao tutor. Ampliar conserva o mesmo iframe.
Levar ao tutor acrescenta a tentativa ao rascunho já existente; o aluno revisa
e envia. Publicar a atividade não equivale a avaliar a resposta do aluno.

Uma atividade recém-publicada abre na posição de sua chamada na conversa.
Histórico reaberto mostra o card sem executar scripts; Abrir restaura o estado
salvo da versão correspondente. Estado e tentativa entram no backup local.

O runtime é offline e isolado em origem própria, sem preload da Mesa. KaTeX
opcional usa o pacote local. O limite de conteúdo é 64 KiB, os valores salvos
16 KiB e a tentativa 4 KiB. O envelope de persistência comporta os dois campos.
Código executável vai no campo `js`; scripts inseridos no campo `html` são
removidos. Uma regeneração com `activityId` cria uma versão imutável e conserva
a anterior, incluindo seu estado.
A documentação da API e exemplos está em
[exemplos de atividade](../desk/src/activities/exemplos.md).

## Material em PDF

O tutor prepara o rascunho editável; o template organiza título, headings,
fórmulas e tabelas. Ver PDF mostra os bytes da impressão real antes de salvar.
Editar o rascunho invalida essa prévia. Salvar imprime o conteúdo atual.

O template compartilhado usa A4, tipografia serif de 11 pt e margens de 18/16/20 mm.
Matemática é tokenizada fora de código e escapes. Erros de sintaxe ou overflow
que comprometa a leitura impedem salvar e mostram diagnóstico; o rascunho
continua disponível para corrigir. Não é necessário instalar um compilador TeX.

## Conversa em ordem

Falas, pensamento apresentado pelo provedor, ferramentas e atividades ficam
intercalados na ordem dos eventos. Declaração de ferramenta reserva sua posição;
resultado tardio atualiza essa posição, mesmo depois de outra fala. A projeção
do histórico usa a mesma ordem, sem executar atividades antigas automaticamente.

O Pi atual entrega o final parcial antes de encerrar o turno. A identidade do
host acompanha essas fronteiras e impede que ferramentas encerradas atualizem
um turno novo. Um host que viole essa ordem e envie deltas anônimos antigos
depois de abrir outra execução não oferece identidade suficiente para atribuí-los;
a Mesa não usa igualdade de textos para apagar falas.

## Validação final e limites

Testes usam apenas materiais e sessões sintéticos. Main/preload/protocolo,
Electron, impressão, persistência, ponte HTTP e transporte MCP local são reais;
as respostas Pi/Claude são simuladas. Nenhum modelo real foi chamado, e o app
instalado do usuário não foi atualizado ou aberto por esta implementação.

Registro de integração e resultados:
[progresso](reviews/2026-10-08/root-integration-progress.md).
Referências OpenUI e T3 nightly:
[consulta](reviews/2026-10-08/interactive-ui-reference-openui-t3.md).

| Verificação | Resultado |
| --- | --- |
| Suíte geral final `npm test` | 1.201 testes passaram; zero falhas e skips |
| Sintaxe | 333 arquivos aprovados |
| Portão Bend | Build, provas e seis verificadores de paridade executados; a última rodada reutilizou o mesmo conteúdo aprovado |
| Integração Pi e Claude | Main/preload, ponte/SDK/MCP, runtime e conversa intercalada reais; respostas sintéticas |
| Isolamento de atividades | 41 vetores, 175 verificações aprovadas; positivos de UDP válidos e zero UDP/HTTP nos artefatos testados |
| Watchdog | 27 verificações aprovadas, incluindo falhas de enumeração e recuperação do processo compartilhado |
| PDF v3 | Prévia de bytes reais, cancelamento/edição durante desenho e inspeção visual de seis páginas longas mais uma fórmula larga |

As revisões independentes fecharam os achados concretos:
[UI interativa](reviews/2026-10-08/activity-code-closing-review.md),
[PDF](reviews/2026-10-08/pdf-code-residual-review.md) e
[timeline](reviews/2026-10-08/timeline-code-closing-review.md).

O isolamento inline foi medido no Electron 44.2/Chromium 152/macOS atual; precisa
ser revalidado ao atualizar o Chromium. Windows/Linux e inferência de modelos
reais não foram exercitados. Se atividades compartilham um processo travado,
o watchdog só o encerra com todos os frames comprovadamente travados; os cards
afetados podem exigir Reabrir/Reiniciar. A recusa por enumeração incompleta é
conservadora. A timeline aceita o contrato do Pi atual, com o limite de deltas
anônimos fora de ordem descrito acima.

A implementação foi consolidada em commit local na
[revisão de 2026-10-09](reviews/2026-10-09/REVIEW-E-COMMITS.md), que também
corrigiu a concorrência entre gravação de atividades e outras mutações.
Não houve push, instalação ou publicação. Materiais pessoais, sessões do
usuário, defaults do autor e o app instalado foram preservados.

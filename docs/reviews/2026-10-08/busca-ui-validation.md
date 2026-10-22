# Busca nos estudos — interface simplificada

O diálogo deixa de usar checkboxes. A busca digitada é o foco; dois seletores nativos escolhem Matéria e Conteúdo, começando em Todas as matérias e Todos os conteúdos. Limpar filtros restaura o escopo geral e mantém a consulta. A seleção de matéria continua necessária para buscar texto de PDF; a autorização dos arquivos permanece no host.

Os resultados mostram a matéria em vez do nome interno do arquivo de conversa. A dica de PDF aparece quando relevante. Os textos de busca vazia/parcial foram atualizados no núcleo, com leis e provas. Solicitações antigas são invalidadas mesmo quando a consulta seguinte está vazia ou sem fontes.

Validação executada em `desk/`:

- `npm test`: 1.073 testes passaram, build/provas e seis verificadores de paridade aprovados. Inclui alterações concorrentes do checkout.
- `node --test tests/study-ui.test.mjs tests/study-search.test.mjs`: 28/28 passaram na rodada focada inicial; os testes de interface também estão na suíte final.
- `node tests/study-features-ui.mjs`: busca entre matérias, retomada de conversa, notas/revisão, mudança de filtros, limpar sem perder a consulta e janela 900×650 passaram. Pi simulado e dados sintéticos.

Capturas do diálogo real:

- [Busca geral](../2026-10-07/study-tools-ui/03-busca-detalhe.png)
- [Busca filtrada](../2026-10-07/study-tools-ui/03-busca-filtrada.png)

Sem publicação, instalação, mudanças em defaults do autor ou materiais pessoais. Presets de integração com múltiplas fontes/matérias continuam representados como seleção personalizada; a interface normal escolhe uma matéria/conteúdo ou todos.

# Mesa experimental para Codex

Plugin separado do app Mesa. As instruções da raiz continuam aplicáveis.

- Preserve `desk/`, `core/`, `claude-mod/`, `visual-check/`, o app instalado e todas as configurações e sessões pessoais.
- Use PDFs sintéticos nos testes; não leia nem envie materiais de curso para agentes de implementação.
- Configure as raízes autorizadas e executáveis na inicialização do servidor. Chamadas MCP não ampliam esse acesso.
- Captura somente após pedido explícito de conferência, exclusivamente da janela escolhida do Xournal++; nunca tela inteira ou imagem anterior como fallback.
- Resultados de imagem MCP entram na conversa do modelo. Não apresentar isso como uma prévia exclusivamente local.
- Sem inferência, autenticação, instalação global, carregamento do plugin ou reinício do app nos testes de código.
- APIs, manifests e instruções de instalação devem ter fonte oficial. Diferencie protocolo MCP testado, renderização Poppler real, captura simulada e teste pendente no app.

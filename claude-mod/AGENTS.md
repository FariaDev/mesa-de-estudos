# Protótipo Mesa no Claude Desktop

Produto experimental separado: mod na aba Code do Claude Desktop. Preserve `desk/`, `core/`, o bundle instalado, a sessão aberta e todas as configurações pessoais.

- Instruções raiz continuam aplicáveis. Materiais de curso são somente leitura e não entram em fixtures, logs de revisão ou delegações.
- APIs de mods devem corresponder às fontes oficiais e aos tipos gerados pela versão real. Não inventar DOM, webview ou anexos de imagem via metadados.
- Navegação, calculadora e `/mesa` não iniciam chamadas ao modelo. Captura e pedido de análise exigem ações explícitas separadas.
- O helper executa apenas processos conhecidos com lista de argumentos, sem shell. Só captura a janela específica do Xournal++; nunca a tela inteira.
- UI do mod importa apenas arquivos dentro do próprio plugin. Não alterar aprovação de ferramentas, credenciais, provedor ou configurações globais.
- Testes usam materiais sintéticos e engines simulados. Diferencie verificação Node/Poppler, carregamento real do mod no Desktop e inferência autenticada.
- Não atualizar, instalar ou carregar o plugin no app do usuário como parte dos testes de código.

# Mesa de Estudos — mod experimental

Protótipo de uma mesa de apoio ao estudo na aba **Code** do Claude Desktop. O Xournal++ continua como superfície de escrita. A Mesa Electron atual continua sendo um produto separado.

Versão **0.1.1-experimental**, com melhorias implementadas e revisadas localmente. A raiz confirmou **159/159 testes passando**, sem falhas nem testes pulados, após as correções desta rodada. A revisão independente dos controles não encontrou defeitos; a revisão do host teve seus quatro achados corrigidos e cobertos por regressões. O plugin ainda não foi carregado no Desktop nem validado com uma conta Claude autenticada.

## Experiência proposta

`/mesa` abre um painel com matéria, questão ativa, documento/página, calculadora e retomada. A página PDF é convertida localmente pelo Poppler em SVG para prévia e PNG para leitura pelo Claude. Capturar o Xournal++ e pedir análise são ações explícitas separadas.

O pedido de análise referencia a imagem local para a ferramenta nativa `Read`; metadados de `attachments` não são usados como se fossem bytes de imagem. O plugin conserva as permissões normais do Claude.

Esta primeira versão mostra uma página por vez. Leitura contínua, busca no PDF, layout equivalente ao Electron e captura real ainda precisam de validação.

O primeiro PDF ocupa o slot principal; o segundo ocupa o secundário. Com ambos ocupados, carregar um terceiro substitui o secundário e avisa qual documento saiu. **Fechar PDF** remove o documento ativo do painel, sem apagar o arquivo. Matéria, questão, notas, caminhos e página ativa são retomados pelo armazenamento próprio do mod; prévias e capturas não entram nesse armazenamento. Após a retomada, use **Recarregar página** para gerar a prévia do documento ativo: abrir o painel ou trocar de aba conserva apenas os metadados, sem iniciar processos ou pedidos ao modelo. Fechar ou recarregar durante uma operação em andamento é recusado com aviso; tente novamente quando ela terminar. Um estado incompatível é preservado até a ação explícita de substituição.

## Requisitos e verificações

- Node.js 22.19+ e Poppler (`pdfinfo`, `pdftocairo`).
- Para mods no terminal: Claude Code 2.1.287+. O diagnóstico `doctor:cli` verifica o CLI disponível no momento da execução.
- Para mods no Desktop: Claude Code interno 2.1.286+. Verifique `/status` na aba Code; a versão do CLI externo não estabelece a versão do Desktop.
- Captura macOS: helper próprio `native/windows`, compilado explicitamente a partir de `native/windows.swift`, e permissão de Gravação de Tela para o processo que realmente fizer a captura. A permissão concedida à Mesa não comprova a permissão do Claude.

```sh
cd claude-mod/mesa-study
npm run doctor             # requisitos locais para o Desktop
npm run doctor:cli         # inclui a versão exigida do CLI
npm test
```

O doctor apenas inspeciona requisitos locais; nunca abre uma sessão, executa o helper de janelas, compila, altera login, atualiza o Claude ou chama um modelo. Código de saída 2 indica requisito local pendente. Um CLI antigo ou ausente não bloqueia o diagnóstico para Desktop; a versão interna do Desktop, login e carregamento real continuam desconhecidos. Saída 0 não comprova uso no Desktop.

Para preparar **somente a captura**, em macOS com as Command Line Tools da Apple disponíveis:

```sh
npm run build:helper
```

Esse comando compila o helper dentro da pasta do plugin; não o executa nem instala o plugin. Recusa um `native/windows` já existente, sem sobrescrever. A compilação não acontece automaticamente na abertura, no diagnóstico ou na captura. PDFs e calculadora não dependem desse binário. O botão **Capturar Xournal++** gera a imagem; **Pedir análise da captura** é a ação separada que envia o pedido ao Claude.

Os testes do painel e da captura usam um engine simulado. Oito testes do helper e um da ponte executam Poppler/CLI reais com PDFs sintéticos; dois dos testes do helper também usam qpdf para verificar PDFs protegidos. Esse resultado não comprova carregamento, renderização ou captura no Desktop.

Para um ensaio futuro no CLI compatível, a [documentação oficial](https://code.claude.com/docs/en/plugins/create#load-a-plugin-for-one-session) permite carregar a pasta só naquela sessão:

```sh
claude --plugin-dir "$(pwd)" # dentro de claude-mod/mesa-study
```

Esse comando não foi executado. Ele testa o CLI e não configura o Desktop. O primeiro ensaio no Desktop deve confirmar sua versão interna, os tipos gerados e a execução do helper antes de depender da prévia ou captura.

## Limites do protótipo

- Os arquivos da matéria são somente leitura e só são escolhidos explicitamente.
- SVGs têm um limite de 131.072 caracteres por elemento no host dos mods. Uma página sintética de 55 linhas ultrapassou esse teto; página inteira dentro do painel não é garantida. O helper preserva o PNG com aviso de prévia indisponível, e o painel mantém o pedido de análise disponível.
- Vários recortes podem recompor páginas de texto simples, conforme um experimento separado com Poppler e um navegador. Essa alternativa não foi implementada neste plugin nem validada no renderizador do Desktop; páginas escaneadas e vetores densos continuam podendo ultrapassar o limite em cada recorte.
- Páginas/capturas são arquivos locais privados em cache separado, sem publicação.
- A captura usa um caminho fixo dentro do plugin e não depende mais de `visual-check/` fora dele. O binário é específico da plataforma/arquitetura onde for compilado; ainda não há distribuição de binários nem ensaio de instalação no Desktop.
- A integração não lê configurações, sessões ou credenciais da Mesa instalada.

## Fontes da API

- [Mods overview](https://code.claude.com/docs/en/plugins/mods/overview)
- [Interface](https://code.claude.com/docs/en/plugins/mods/interface)
- [API](https://code.claude.com/docs/en/plugins/mods/api)
- [Reference](https://code.claude.com/docs/en/plugins/mods/reference)
- [Tipos públicos](https://github.com/anthropics/claude-code/blob/main/mods/types/claude-code.d.ts)

A API deve ser conferida contra os tipos gerados pela versão que carregar o plugin. A documentação atual não substitui esse teste real.

O tipo público consultado é anterior à documentação atual e marca `$.process` como "CLI only". A execução do helper a partir de um mod no Desktop ainda precisa ser comprovada; painel e calculadora devem continuar úteis mesmo quando esse recurso falhar.

As medições e a diferença entre documentação, testes locais e validação no Desktop estão em [pesquisa inicial](../../docs/reviews/mesa-mod-api-20261005.md) e [pesquisa complementar](../../docs/reviews/mesa-mod-api-followup-20261005.md).

O [registro original](../../docs/STATUS-MESA-CLAUDE-MOD-2026-10-05.md) descreve a base de 2026-10-05. As melhorias e a validação local desta versão estão no [registro de 2026-10-07](../../docs/STATUS-MESA-CLAUDE-MOD-2026-10-07.md).

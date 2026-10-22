# Mesa no Claude Desktop — melhorias locais de 2026-10-07

Versão: `0.1.1-experimental`. Implementação e revisão locais concluídas. Nenhuma instalação ou carregamento no Claude Desktop nesta rodada.

## Mudanças

- Recarregar explicitamente a página atual após retomar metadados ou alternar documentos.
- Fechar o PDF ativo sem apagar o arquivo, mantendo a correspondência de documentos, prévias e página.
- Avisar quando um terceiro PDF substitui o segundo leitor.
- Conferir documento e página da prévia antes de enviar um pedido de análise.
- Nomear a ação de captura como **Capturar Xournal++**; análise continua sendo um segundo gesto explícito.
- Helper de janelas dentro do plugin, em `native/windows`, com fonte Swift incluída e `ownerPID` para revalidação.
- Build explícito, sem sobrescrever alvo existente, recusando `native/` com symlink e limpando staging após falha.
- Diagnóstico com alvos Desktop e CLI, separando dependências locais de versão/login/carregamento desconhecidos.
- Mensagens acionáveis para helper ausente ou inválido; timeout, ferramenta ausente e ferramenta não executável são distinguidos.

## Revisão e testes

Agentes: Command Code via `pi-mesa-dev`, modelo `commandcode/deepseek/deepseek-v4.1-flash`, `thinking=max`, full-access. Os dois agentes OpenCode inicialmente lançados foram interrompidos após a correção do usuário; nenhum ficou com execução pendente.

A revisão independente do host apontou quatro problemas: escape por symlink de `native/`, staging deixado após falha de chmod, campos/mensagens de diagnóstico imprecisos e erro genérico de helper inválido. Os quatro foram corrigidos com regressões em fixtures sintéticas. A raiz inspecionou as correções e executou `npm test`: **159 testes, 159 passaram, 0 falhas, 0 pulados**. Log: `/tmp/mesa-mod-tests-root-20261007-final.log`.

A revisão independente dos controles não encontrou defeitos. Seus testes adicionais de corridas e conferência de prompts foram simulados; a raiz acrescentou uma regressão que fecha o primeiro PDF e mantém a prévia e a análise do segundo sem recarregar. Os quatro erros de build vistos pelo revisor da UI durante a edição concorrente eram de normalização de caminhos e não se reproduziram na suíte final após as correções do host.

A suíte usa engines/processos simulados para UI e captura, e Poppler/qpdf/CLI reais em PDFs sintéticos. Não comprova renderização nativa no Desktop. O build usa publicação por hard link sem sobrescrita; as checagens de caminhos não são uma prova contra troca hostil concorrente de diretórios.

O diagnóstico real para Desktop encontrou Node/Poppler locais disponíveis. O CLI externo 2.1.246 é anterior ao suporte a mods, mas isso não determina a versão interna do Desktop. O helper local ainda está ausente porque não foi compilado.

## Preparação e validação restante

Em `claude-mod/mesa-study`:

```sh
npm run doctor
npm run doctor:cli
npm run build:helper -- --help
```

`npm run build:helper` compila o helper macOS; é uma ação explícita futura, não executada nesta rodada. Não instala ou carrega o plugin. PDFs e calculadora independem dele.

Continuam pendentes: compilação real do Swift, listagem real de janelas, captura/TCC, carregamento do plugin na aba Code do Desktop, versão interna compatível, disponibilidade de `$.process.run`, renderização e análise autenticada das imagens. O diagnóstico deixa essas condições como desconhecidas e não declara o plugin pronto para uso real.

Nenhuma configuração global, credencial, sessão, material de curso, app instalado ou código de `desk/`, `chat/`, `core/`, `codex-plugin/` ou `visual-check/` foi alterado.

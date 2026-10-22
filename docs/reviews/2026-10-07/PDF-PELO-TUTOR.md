# PDF pelo tutor: revisão antes de salvar

O tutor principal da aba Livre escreve o título e o conteúdo completo e chama
a ferramenta nativa da Mesa. A prévia editável abre preenchida; o usuário
revisa e confirma **Salvar PDF e abrir**. O PDF só é produzido após essa ação.
O resultado da ferramenta informa conteúdo preparado, sem declarar um arquivo
já salvo.

O conteúdo preparado fica no `workspace.json` da própria sessão. Fechar o
diálogo ou recarregar a Mesa mantém o botão **Revisar e salvar PDF** disponível.
Salvar conclui o rascunho correspondente, sem apagar uma preparação posterior.
O rascunho do chat e os anexos existentes não entram no pedido do atalho.

**PDF pelo tutor**, **Abrir PDF** e **Criar matéria** aparecem na aba Livre e
nos cartões iniciais. **Montar PDF** mantém a edição manual disponível. O chat
lateral pode ser aberto sem PDF; **Girar** tem rótulo visível. Os rodapés dos
diálogos têm margens próprias e o corpo rola sem empurrar os botões para fora.

## Validação local

- `MESA_GATE_CACHE=0 npm test`: 766 testes passaram, com build, provas Bend,
  paridade e sintaxe no portão completo. Log: [tutor-pdf-gate.log](tutor-pdf-gate.log).
- `node tests/native-tutor-pdf.mjs`: o SDK Pi instalado carregou a extensão e
  executou `mesa_criar_pdf` pela ponte HTTP real, sem chamada de modelo.
- `tests/tutor-materials.test.mjs`: transporte HTTP, escopo, revogação,
  cancelamento e encerramento durante inicialização; SDK oficial Claude
  anunciou e executou `criar_pdf` via MCP e recusou um servidor antigo.
- `node tests/tutor-pdf-ui.mjs`: conversa Pi simulada, host/renderer reais.
  A prévia recebeu o conteúdo completo, não havia PDF antes da revisão,
  recarregar preservou a preparação, a edição do usuário apareceu no PDF real,
  o rascunho do chat foi preservado e a preparação concluída saiu da barra.
  Rodapés conferidos em 1500×960 e 900×650; nenhum erro do renderer.
- `node tests/bundle-payload-ui.mjs`: payload do instalador em pasta temporária
  iniciou, incluiu a extensão Pi, resolveu o servidor PDF do SDK Claude e zod
  dentro do payload e imprimiu um PDF real.
- `git diff --check`: passou.

As capturas e o [PDF de demonstração](<tutor-pdf-ui/Teorema de Pitágoras.pdf>)
usam conteúdo sintético. Não houve inferência autenticada, atualização do app
instalado ou publicação. A [galeria](tutor-pdf-ui/gallery.html) usa apenas as
capturas do fluxo final, com revisão antes de salvar.

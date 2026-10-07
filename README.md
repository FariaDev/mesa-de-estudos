# Mesa de Estudos

App local (Electron) de apoio ao estudo: dois PDFs independentes, calculadora numérica e Pi na mesma janela. A escrita continua no [Xournal++](https://xournalpp.github.io/).

```
Mesa de Estudos                         Xournal++
  enunciado + formulário (PDF)            escrita à mão
  calculadora local                       tentativa
  chat com o Pi
```

## Requisitos

- Node 22.19+ (exigência do Pi)
- [Pi](https://github.com/earendil-works/pi) **0.99.1+** (MCP e Codemode nativos; o `npm run setup` tenta instalar)
- PDFs da matéria numa pasta qualquer

## Começar

```sh
cd desk
npm ci
npm run setup
npm run doctor
npm start
```

Na primeira abertura: pasta de dados + pelo menos uma matéria (nome e pasta de PDFs). O Pi pede as credenciais do provedor na primeira conexão; elas ficam no Pi, não neste app.

`npm run doctor` confere Pi, políticas, fontes, extensão visual e persistência sem abrir o app.

Instruções para um agente configurar o computador: [`desk/SETUP.md`](desk/SETUP.md).

## O que entra / o que não entra

- **Entra:** PDFs, calculadora, conversa com o Pi, configurações de pastas e nomes.
- **macOS:** botão Conferir Xournal++ (captura a janela do Xournal++ e anexa à mensagem; você escreve e envia quando quiser).
- **Windows:** PDFs, calculadora, Pi e Conferir Xournal++ (captura a janela do Xournal++ pelo PowerShell do sistema; Ctrl+V cola prints também).
- **Não entra:** canvas de tinta, edição de PDF, telemetria, conta na nuvem.

## Configurações

**Mesa → Configurações** (⌘ , / Ctrl+,): pastas, matérias, executáveis, nome da mesa e recursos visíveis (Encerrar por hoje/retomada, Lista/questão e rascunho `.xopp`, calculadora, Xournal++, Conferir e botão de referências). Lista/questão e rascunho são controlados juntos; desativar preserva os dados salvos e deixa esse contexto fora dos próximos envios.

Em **Layout dos leitores**, escolha um ou dois leitores, seus nomes e os termos usados para escolher o PDF inicial. **Aparência** oferece tema Sistema, Claro ou Escuro. As mudanças entram ao salvar. Ver também [`AGENTS.md`](AGENTS.md) e [`desk/config.example.json`](desk/config.example.json). O default do repositório permanece o da mesa do autor.

As abas **Formulário** e **Chat lateral** mantêm a área de apoio fácil de reabrir. O lateral tem conversa e rascunho próprios, usa o mesmo motor da conversa principal e recebe um contexto inicial com PDFs, páginas, questão e trechos recentes do principal. **Atualizar contexto do principal** renova esse contexto; **Levar ao chat principal** só acrescenta texto ao rascunho principal. Atualizações disponíveis ficam indicadas no cabeçalho, com acesso ao Sobre.

A aba **Livre** reúne estudo avulso sem criar matéria: conversas salvas com PDFs opcionais, geração de PDF após revisar Markdown/LaTeX e **Criar matéria** para levar conversa e materiais a uma nova aba. O original dos PDFs permanece intacto. O botão **Girar** do leitor muda a orientação em passos de 90°, com restauração por leitor e documento. Veja o [uso e os dados locais](desk/README.md).

O app irmão **Conversa** (`chat/`) substitui o ChatGPT web no dia a dia: só chat, busca e histórico, sem matéria nem pasta de trabalho. Ver [`chat/README.md`](chat/README.md).

## Desenvolvimento

```sh
cd desk
npm test
node tests/ui-smoke.mjs
```

No Mac, se `Mesa de Estudos.app` já existir ao lado de `desk/`:

```sh
npm run install-app
```

## Créditos

- **Lucas Faria** — autor

Licença [MIT](LICENSE).

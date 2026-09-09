# Mesa de Estudos

App local (Electron) de apoio ao estudo: dois PDFs independentes, calculadora numérica e Pi na mesma janela. A escrita continua no [Xournal++](https://xournalpp.github.io/).

```
Mesa de Estudos                         Xournal++
  enunciado + formulário (PDF)            escrita à mão
  calculadora local                       tentativa
  chat com o Pi
```

## Requisitos

- Node 20+
- [Pi](https://github.com/badlogic/pi-mono) (o `npm run setup` tenta instalar)
- PDFs da matéria numa pasta qualquer

## Começar

```sh
cd desk
npm ci
npm run setup
npm start
```

Na primeira abertura: pasta de dados + pelo menos uma matéria (nome e pasta de PDFs). O Pi pede as credenciais do provedor na primeira conexão; elas ficam no Pi, não neste app.

Instruções para um agente configurar o computador: [`desk/SETUP.md`](desk/SETUP.md).

## O que entra / o que não entra

- **Entra:** PDFs, calculadora, conversa com o Pi, configurações de pastas e nomes.
- **macOS:** botão Conferir Xournal++ (captura da janela visível, só quando você pede).
- **Windows:** PDFs, calculadora e Pi. Conferir Xournal++ não está disponível.
- **Não entra:** canvas de tinta, edição de PDF, telemetria, conta na nuvem.

## Configurações

**Mesa → Configurações** (⌘ ,): pasta de dados, nomes das matérias, pastas de PDF, caminho do `pi`.

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

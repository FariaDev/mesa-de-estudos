# Instalação da Mesa de Estudos

Instruções para um agente (ou para você) deixar a mesa rodando num computador novo, inclusive Windows.

A Mesa é um app Electron local: dois leitores de PDF, calculadora e Pi na mesma janela. O Xournal++ continua separado. Não precisa do vault Obsidian original.

## Requisitos

1. Node 20 ou mais novo.
2. Uma pasta com os PDFs da matéria (enunciados, formulário, o que for).

Não peça Homebrew nem o vault Obsidian de outra pessoa.

## Passos

No diretório `desk/`:

```sh
npm ci
npm run setup
npm start
```

`npm run setup` instala as dependências se faltarem, tenta colocar o Pi localmente (`@earendil-works/pi-coding-agent`, com fallback para `@mariozechner/pi-coding-agent`) e copia um `TUTOR.md` / `LEARNER.md` mínimos para `desk/.runtime/starter`.

Na primeira abertura:

1. Escolha a pasta de dados (ou deixe em branco e use a padrão).
2. Adicione pelo menos uma matéria: **nome** + **pasta de PDFs**.
3. Se o Pi não foi detectado, use **Detectar** ou indique o executável.
4. Salve. A mesa conecta ao Pi; as credenciais do provedor são pedidas pelo próprio Pi e ficam nele, não na Mesa.

Depois disso, **Mesa → Configurações** (⌘ ,) altera pastas, nomes das matérias e o caminho do Pi.

## Windows

PDFs, calculadora e o chat com o Pi funcionam. **Conferir Xournal++** não está disponível (a captura da janela é só macOS).

## macOS (opcional)

Se `Mesa de Estudos.app` já existir ao lado de `desk/`:

```sh
npm run install-app
```

Isso só atualiza o `.app` existente; não cria um instalador novo.

## Se o Pi não conectar

- Rode `npm run setup` de novo.
- Confira o caminho em Configurações.
- A primeira conexão pede login/API key do provedor configurado no Pi.

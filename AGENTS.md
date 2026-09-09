# Mesa de Estudos — instruções para agentes

Produto: mesa de referências local (Electron) ao lado do Xournal++. Código em `desk/` (app) e `visual-check/` (captura macOS).

## Leitura

1. [`README.md`](README.md)
2. [`desk/SETUP.md`](desk/SETUP.md)
3. [`desk/README.md`](desk/README.md)
4. [`visual-check/README.md`](visual-check/README.md) se for mexer em Conferir Xournal++

## Regras

- Dois apps: Mesa + Xournal++. Não implementar canvas de tinta dentro da Mesa.
- Fale com o usuário em português, salvo pedido contrário.
- Não altere PDFs nem materiais de curso.
- Runtime da mesa: `desk/.runtime/` (não versionar).
- Não publique sessões JSONL, credenciais do Pi, capturas de tela com material de curso, nem o bundle `Mesa de Estudos.app`.
- Conferir Xournal++ é só macOS (`visual-check/` + `screencapture`).

## Setup num computador novo

```sh
cd desk
npm ci
npm run setup
npm start
```

Depois: Configurações → nome da matéria + pasta de PDFs. O Pi autentica o provedor na primeira conexão.

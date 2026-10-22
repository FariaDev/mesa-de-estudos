# Release e updater

Fluxo de publicação e comportamento real do updater por clique. Vem do
`AGENTS.md`, onde ficava inteiro (#43). Consulte antes de publicar uma versão
ou de mexer em `desk/updater.cjs`, `desk/update-host.cjs` ou
`desk/scripts/update-cli.mjs`.

## Release (fluxo do updater por clique)

O updater da Mesa (Sobre → Atualizar e reiniciar) só funciona a partir da
v0.4.0 — a primeira versão que o contém. Para publicar `vX.Y.Z`:

1. snapshot no repositório público `FariaDev/mesa-de-estudos` e push na `main` dele.
   O snapshot não tem `chat/`: o app Conversa foi aposentado na #50 e saiu do
   `main`, e o `verify:bend` só gera `desk/src/generated`, então a árvore pública
   fecha o portão sem `--no-verify` por causa do app irmão (o `--no-verify`
   segue sendo só a saída de emergência);
2. tag `vX.Y.Z` no público;
3. `gh release create vX.Y.Z --notes "…"` — o corpo da Release é o "o que mudou" mostrado no app.

**Antes do passo 1, confira a faixa testada do Claude Code** (#51). A Mesa usa
sempre o Claude Code que a pessoa instalou e não leva binário de reserva: ela
aceita uma faixa, lida de `desk/src/tested-versions.json` — de `claudeMinimum`
até a série (`major.minor`) do `claude` testado. Mais nova na série conecta e o
Sobre avisa; série nova recusa. O release confere a faixa, não uma versão exata:

- os portões (`npm test`, `npm run ui`, `npm run test:claude-ui` e, no macOS,
  `npm run test:packaged`, que monta o `.app` numa pasta temporária) passam com
  a tabela que vai sair;
- subir o `claude` testado (por exemplo, depois de atualizar o SDK) é trocar o
  número na tabela e rodar os portões; ele continua sendo a referência da série;
- subir o `claudeMinimum` só com motivo de protocolo (o que o SDK passou a
  exigir do CLI), registrado no relatório do ticket;
- uma série nova (`2.2.x`) só entra depois de revisar o protocolo do SDK
  (changelog do SDK e do Claude Code, `sdk.d.ts`) e trocar mínimo e testada
  juntos — a regra mora em `core/claudeversion.bend`.

Quem prefere terminal (ou recuperação) usa `npm run update` em `desk/`:
checa, aplica (git/bundle/zip), roda `npm ci` só se o lock mudou, re-sincroniza
o bundle no macOS e reabre. Comportamento real, por modo:

- **zip** (instalação sem git): baixa a tag anunciada, valida a versão dentro
  do zip ANTES de copiar e substitui só o que o manifesto da instalação
  gerencia (`desk/.update-manifest.json`) — órfão gerenciado sai, arquivo
  local fica. `--versao X.Y.Z` seleciona versão aqui.
- **Instalação antiga com `chat/` no disco** (#50): o updater nunca apaga nem
  toca a pasta, em nenhum modo. No zip, `chat/` nunca esteve na lista gerenciada
  e uma entrada de manifesto que aponte para lá é recusada com aviso no log
  (`tests/updateflow.test.mjs`). No git, o `git pull` remove os arquivos
  rastreados de `chat/`, mas o que o git ignora (`chat/node_modules`,
  `chat/.runtime`, sessões) fica onde está; quem quiser a pasta de volta usa a
  tag local `conversa-final`.
- **git/bundle** (clone): `git pull --ff-only` na branch de
  DESENVOLVIMENTO — não baixa a tag; `--versao` não seleciona versão
  (recusado com explicação) e a versão final é lida do `package.json`
  (divergência da tag anunciada é aviso no log, nunca "vX no lugar").
- Clone com **trabalho local** (arquivo rastreado modificado) é recusado antes
  de qualquer mutação — commit/stash e rode de novo. Nada é destruído.

Falhou = rollback automático: instantâneo dos arquivos gerenciados (nunca da
raiz toda), `git reset --hard` para a cabeça anterior (só com o clone limpo)
e `npm ci` de recuperação quando as dependências foram mexidas; a versão
antiga reabre com o motivo em `.runtime/desk.log`. Se a própria recuperação
falhar, o **backup é preservado** (caminho no log) e o Sobre mostra
"recuperação incompleta". A atualização tem lock compartilhado entre
Sobre/Atualizar Pi/CLI e handshake do worker (o app só fecha depois de o
worker confirmar que subiu; sem Node do sistema, aborta com o app de pé).

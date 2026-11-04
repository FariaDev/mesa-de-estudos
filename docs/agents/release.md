# Release e updater

Fluxo de publicação e comportamento real do updater por clique. Vem do
`AGENTS.md`, onde ficava inteiro (#43). Consulte antes de publicar uma versão
ou de mexer em `desk/updater.cjs`, `desk/update-host.cjs` ou
`desk/scripts/update-cli.mjs`.

## Release (fluxo do updater por clique)

O updater da Mesa (Sobre → Atualizar e reiniciar) só funciona a partir da
v0.4.0 — a primeira versão que o contém. Desde a #80 ele só aplica release
assinada: a raiz de confiança é um par Ed25519 do autor. A chave **pública**
fica commitada em `desk/update-signing-key.pub` (PEM SPKI); a **privada** mora
fora do repositório, nunca é commitada nem impressa. Enquanto a pública for o
marcador `PLACEHOLDER`, o app recusa toda atualização com o motivo.

O updater confere o manifesto assinado (`mesa-manifest-vX.Y.Z.json` +
`.sig` em base64) com `{version, commit, zipSha256, zipBytes}`:

- **zip**: baixa o zip **publicado na Release** (`mesa-estudos-X.Y.Z.zip`, bytes
  estáveis, gerado por `git archive`), confere `zipBytes` e SHA-256 contra o
  manifesto e só então aplica;
- **git/bundle**: confere que `git rev-parse vX.Y.Z^{commit}` é o `commit` do
  manifesto e, depois do pull, exige `HEAD` nesse mesmo commit — branch à
  frente da tag tem código não assinado e é recusada;
- todo download tem teto (manifesto 64 KB, assinatura 8 KB, zip 64 MB) e o
  stream é cancelado ao passar dele. Sem manifesto, assinatura inválida ou
  hash/commit diferente, nada é aplicado — o rollback normal continua valendo.

### Uma vez: gerar o par de chaves

Na cópia do repositório, com a árvore limpa:

```sh
cd desk
npm run update:keygen -- --private-key ~/mesa-update-signing.pem
```

- a privada é gravada no caminho informado (fora do repositório, modo 0600);
  **guarde um backup** e nunca a copie para dentro do repositório;
- a pública é escrita em `desk/update-signing-key.pub`; commite esse arquivo e
  publique antes da primeira Release assinada;
- `keygen` recusa sobrescrever chave existente sem `--force` — trocar a chave
  obriga todo mundo a reinstalar, então não use `--force` por engano;
- instalações por zip anteriores à versão que conhece `.pub` não recebem a
  chave pelo updater antigo: atualize por git ou reinstale antes de depender do
  update assinado.

### Cada release `vX.Y.Z`

1. snapshot no repositório público `FariaDev/mesa-de-estudos` e push na `main` dele.
   Ficam fora do snapshot os caminhos de [`snapshot-fora.txt`](snapshot-fora.txt);
   confira que o resultado não tem caminho pessoal, chave nem material de curso.
   O snapshot não tem `chat/`: o app Conversa foi aposentado na #50 e saiu do
   `main`, e o `verify:bend` só gera `desk/src/generated`, então a árvore pública
   fecha o portão sem `--no-verify` por causa do app irmão (o `--no-verify`
   segue sendo só a saída de emergência);
2. tag `vX.Y.Z` no público (a chave pública já tem de estar commitada nela);
3. monte e assine os assets, na raiz dessa cópia:

   ```sh
   cd desk
   npm run update:sign -- vX.Y.Z --private-key ~/mesa-update-signing.pem --out ../release-vX.Y.Z
   npm run update:release:verify -- vX.Y.Z --dir ../release-vX.Y.Z
   ```

   O `sign` recusa se a pública ainda for `PLACEHOLDER` ou se a privada não
   corresponder a ela. Ele gera `mesa-estudos-X.Y.Z.zip`,
   `mesa-manifest-vX.Y.Z.json` e `mesa-manifest-vX.Y.Z.sig`;
4. crie a Release e anexe **os três** assets:

   ```sh
   cd ..
   gh release create vX.Y.Z --notes "…"
   gh release upload vX.Y.Z release-vX.Y.Z/mesa-estudos-X.Y.Z.zip \
     release-vX.Y.Z/mesa-manifest-vX.Y.Z.json release-vX.Y.Z/mesa-manifest-vX.Y.Z.sig
   ```

   O corpo da Release é o "o que mudou" mostrado no app. Reenvio usa
   `--clobber`, mas o manifesto tem de ser reassinado se o zip mudar.

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

- **zip** (instalação sem git): baixa o zip **assinado da Release**, confere
  `zipBytes`/SHA-256 contra o manifesto e valida a versão dentro do zip ANTES
  de copiar; substitui só o que o manifesto da instalação gerencia
  (`desk/.update-manifest.json`) — órfão gerenciado sai, arquivo local fica.
  `--versao X.Y.Z` seleciona versão aqui.
- **Instalação antiga com `chat/` no disco** (#50): o updater nunca apaga nem
  toca a pasta, em nenhum modo. No zip, `chat/` nunca esteve na lista gerenciada
  e uma entrada de manifesto que aponte para lá é recusada com aviso no log
  (`tests/updateflow.test.mjs`). No git, o avanço da branch remove os arquivos
  rastreados de `chat/`, mas o que o git ignora (`chat/node_modules`,
  `chat/.runtime`, sessões) fica onde está; quem quiser a pasta de volta usa a
  tag local `conversa-final`.
- **git/bundle** (clone): confere o commit da tag `vX.Y.Z` contra o manifesto
  assinado e avança o clone só até esse commit com `git merge --ff-only`
  (commits do `main` depois da tag não entram; clone já à frente da tag é
  recusado); `--versao` não seleciona versão (recusado com
  explicação) e a versão final é lida do `package.json` (divergência da tag
  anunciada é aviso no log, nunca "vX no lugar").
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

## Novidades da versão

Depois de atualizar, a Mesa abre uma janela com as novidades (`desk/src/release-notes.mjs`,
pintada por `desk/src/release-notes-ui.mjs`; reabre em ⚙ → Novidades). Antes de publicar uma
versão com novidade, acrescente a entrada em `RELEASE_NOTES` com o número **exato** do
`desk/package.json` e os textos em `pt-BR.json` e `en.json`. Versão sem entrada não abre janela.
A entrada `1.1.0` é a mudança do Pi para o OpenCode: a release que a publica precisa ser a 1.1.0.

# Estudo: backup, versões e compartilhar (domínio `desk/src/study-data`)

Módulos de backup/restauração, pacote portátil de matéria e destino Git
opcional. Nenhum deles edita o shell do app (`main.cjs`, `preload.cjs`,
`index.html`, `style.css`, `src/main.mjs`): são módulos de domínio + um painel
de UI independente + testes próprios. O pai integra a IPC.

## Arquivos

| Arquivo | Papel |
|---|---|
| `desk/src/study-data/zipkit.cjs` | Zip (leitura+escrita) só com builtins: CRC conferido, limites de zip bomb, `..`/absoluto/symlink e nome repetido recusados antes de escrever. Não mexe no updater. |
| `desk/src/study-data/backup.cjs` | Snapshot/versão com manifesto e SHA-256, status, listagem, retenção, agendador automático, prévia de restauração, staging + diário + rollback, recuperação de queda e relocação de caminhos do runtime. |
| `desk/src/study-data/packages.cjs` | Arquivo portátil `.mesa-materia` (zip + manifesto): exportar matéria (inclui notas de página) e importar criando destino NOVO com id novo, referências remapeadas e descritor Claude VÁLIDO de transcrição. |
| `desk/src/study-data/git-backup.cjs` | Destino Git opcional (repositório próprio, separado do app): commit de snapshot válido, push sem force, bundle, recuperação, runner com prazo/teto de saída e destino vazio/conferido por realpath. |
| `desk/src/study-data/backup-services.cjs` | Adapter para o host (`createBackupServices`): resolve runtime/matérias, lê a config, injeta a allowlist externa do host, recusa destino dentro/ao redor do app ou runtime e concentra os IPCs. |
| `desk/src/backup-panel.mjs` | Painel de UI autônomo (`initBackupPanel`) que injeta CSS próprio e `<dialog>` acessível; nada no shell é tocado. |
| `desk/scripts/study-backup.mjs` | CLI headless (status/backup/list/verify/restore/prune) para rodar com o app fechado. |
| `desk/tests/study-backup*.test.mjs`, `study-packages.test.mjs`, `study-git-backup.test.mjs` | Provas focadas com fixtures sintéticas (runtime de mentira, repositórios git locais, zip montado à mão). |

## Layout do destino de backup

```
<destino>/
  snapshots/<snapshotId>/manifest.json   manifesto: entradas + sha256 + política
  snapshots/<snapshotId>/data/…          os arquivos, caminho relativo preservado
  snapshots/<snapshotId>/excluded.json   o que ficou fora e por quê (+ warnings)
  ledger.json                            último backup, último erro, resultado do push
  auto.json                              estado do agendador automático
  mesa-backup.json                       configuração (destino, auto, idle, keep, git…)
```

`<snapshotId>` = `snap-YYYYMMDDTHHMMSSmmmZ-<6 hex>`. O diretório de destino nunca
fica dentro do runtime e o backup recusa (por construção) `electron/`, `*.log`,
`update.json`, `.review-draft-*`, `node_modules`, `.git`, `.backup/` e nomes de
credencial — com relatório de exclusão, nada some calado. A negativa é só
credencial/cache: pasta do usuário com nome comum (`backups/`, `downloads/`,
`plugins/`, `history.jsonl`) ENTRA, e rascunhos persistidos
(`pdf-drafts.json`, `pdf-notes.json`, o `draft` do `desk.json`) também.

## Contrato de `backup.cjs` (CommonJS, `require`)

```js
const backup = require('./src/study-data/backup.cjs');
await backup.backupNow({runtime, root, deskDir?, materials?, external?, binaries?, reason?, label?, keep?, log?})
// → {snapshotId, path, created, entries, bytes, excluded, skippedBinary, warnings, ms, pruned}
backup.list(root)                       // [{snapshotId, created, bytes, entries, valid, reason}]
await backup.verifySnapshot(dir, {strict})   // {ok, errors, missing, mismatched, extra, checked, bytes, manifest}
backup.readStatus(root)                 // {available, lastBackupAt, lastSnapshotId, lastError, last, auto, gitError}
backup.readConfig(root) / backup.writeConfig(root, patch)   // root = DIRETÓRIO
backup.readConfigFile(file) / backup.writeConfigFile(file, patch)   // arquivo exato
backup.resolveSettings(root, {env, settings, destination, configFile})
backup.shouldAutoBackup({runtime, root, settings, now, activityAt})  // {due, why, nextAt?}
await backup.runAutoBackup({runtime, root, ...materials/external, settings, now, activityAt})
await backup.prepareRestore({runtime, root, snapshotId})   // prévia {planId, entries, bytes, replaced, created, external, excluded, binariesIncluded, warnings, relocation}
await backup.applyRestore({runtime, planId})               // aplica; falha = rollback automático
backup.cancelRestore({runtime, planId})                    // descarta a prévia (nada escrito)
backup.rollbackRestore({runtime, planId})                  // devolve o pré-restore (idempotente)
backup.recoverRestore({runtime})                           // queda no meio: reverte diários sem finished
backup.prune({root, keep, keepIds})
backup.runtimeExclusion(rel, kind)      // motivo da exclusão (ou null) — política pura
```

`materials` é `[{id, name, path}]` (as pastas de PDF da matéria). `external` é a
allowlist `[{path, ref, resume}]` — sessões nativas entram só por ela, com
referência portátil; o manifesto marca `resume: 'transcript-only'` quando a
retomada nativa não é garantida. Referência repetida é ignorada com aviso e
link simbólico externo não é seguido.

### Restauração de outro caminho de runtime (relocação)

O manifesto guarda `runtime.path`. Quando a restauração vai para OUTRO caminho
(outra máquina, pasta nova), `prepareRestore` reescreve os caminhos absolutos
que apontavam para o runtime antigo nos arquivos de estado do próprio runtime
(`desk.json`, `free/<id>/workspace.json`, `config.json` no modo de pasta única,
`mesa-backup.json`, `chat-library.json`, `pdf-drafts.json`). É o que mantém
sessões, `sessionLayouts`, o workspace Livre e a identidade do
`chat-library.json`/`pdf-drafts.json` (matéria + caminho RELATIVO) válidos
depois da mudança. O plano devolve `relocation: {from, to, files, stale}`, avisa
quantos caminhos absolutos continuam sem existir nesta máquina (pasta de
matéria de outra máquina não é inventada) e, no mesmo caminho, nada é reescrito
(restauração byte a byte preservada). `planId` é validado por regex:
`cancelRestore`/`rollbackRestore` com id forjado não removem nada.

**Limitação honesta:** entradas de material e de allowlist externa são
restauradas sob o runtime (`courses/<matéria>/…`, `external/<ref>`), não na
pasta original de outra máquina — o backup é um arquivo de arquivos, e a
prévia diz o que ficou fora.

## Contrato de `packages.cjs`

```js
const pkg = require('./src/study-data/packages.cjs');
pkg.buildPackage({runtime, course:{id,name}, materialsDir, learningDir, include:{review,bookmarks,resume,annotations,conversations}, now, appVersion})
// → {buffer, manifest}   (o host grava o buffer onde o usuário escolher)
pkg.openPackage(buffer, {limits})            // valida tudo (zip+manifesto+hash+rota) e devolve buffers
pkg.planDestination({root, name})            // {dir, name, renamed} sem sobrescrever
pkg.writePackageFile({root, name, buffer})   // grava com `wx`: arquivo existente ganha sufixo, nunca é sobrescrito
pkg.previewImport({buffer, destination})     // contagens, conversas, avisos (zero escrita)
pkg.importPackage({buffer, destination, courseId})
// → {imported, destination, courseId, materialsDir, learningDir, storeDir, conversationsDir, files, record}
```

O destino da importação é sempre um diretório novo com `materiais/`, `estudo/`,
`mesa/` e `conversas/`; o host registra a matéria apontando `path` para
`materialsDir`. O `config.json` exportado dentro do pacote é apenas dado — nunca
é aplicado. Os stores exportados são `review.json`, `bookmarks.json`,
`resume.json` e `pdf-notes.json` (anotações); o remap troca caminho e id da
matéria em cada um. O manifesto valida `kind` e exige
`archivePath === payload/<kind>/<rel>`: rota inconsistente não vira escrita.

Conversa Claude NÃO é reaproveitada como sessão nativa: o import gera um
descritor NOVO e válido pelo próprio `conversations.cjs` (id e arquivo uuid
novos, `nativeSessionId` uuid novo, `nativeEstablished:false`, `delivery`
removido, `importedFrom` guarda a origem) — `previewImport` e o registro marcam
`resume:'exported-transcript'` e `nativeResume:false`. JSONL do Pi é preservado
para retomada quando o provedor existir do outro lado. O import de um pacote
também não sobrescreve diretório criado por corrida: só remove o que ESTA
importação criou.

## Contrato de `git-backup.cjs`

```js
const gitBackup = require('./src/study-data/git-backup.cjs');
gitBackup.gitAvailable()                     // {available, version, error}
gitBackup.sanitizeRemote(url)                // tira credencial embutida (nunca grava segredo)
const git = gitBackup.api({root, deskDir, repoRoot, runtime, backupRoot});
git.ensureRoot()                             // recusa app/runtime, pasta não vazia e arranjo das versões
git.integrate({snapshotDir, manifest})        // commit local; envio é sempre explícito
git.commitSnapshot({snapshotDir, manifest, remote})      // idem, sem mexer no ledger de integração
git.push({remote, branch})                   // sem --force, sem pull, sem merge
git.bundle({out}) / git.status() / git.recover() / git.setRemote(url)
```

No Electron, `gitBackup.asyncApi(options)` executa `status`, `integrate`,
`setRemote`, `push` e `recover` em workers. Os serviços `status`, `gitStatus`,
`gitPush` e `gitRecover` devolvem Promises. Backup manual e automático passam
pela mesma etapa de commit local; `gitPush` é a ação explícita de envio.

A inatividade usa os arquivos de estudo e `study-stats.json.meta.activeAt`.
Batimentos sem tempo ativo, logs e o índice de busca não renovam esse carimbo.
O agendador consulta `autoDue()` antes de adquirir o lock; a consulta não
persiste o estado da janela.


Layout: `<destino>/.mesa-git/` (bare + `core.worktree`), `.gitignore`
versionado que exclui `.mesa-git/`, `mesas/`, `ledger.json` e o diretório de
versões quando ele mora dentro da árvore. Push rejeitado (non-fast-forward) fica
no ledger e o commit local continua válido; nenhuma credencial é guardada.

O runner padrão usa **prazo (120 s) e teto de saída (64 MiB)** em todo comando
git: host de rede sem resposta não trava o main e `ls-files` grande não vira
falha falsa. `ensureRoot` só inicializa pasta VAZIA (ou com o que o backup já
gere: `ledger.json`, `auto.json`, `mesa-backup.json`, `.gitignore` e a pasta de
versões como filha direta) — o primeiro commit espelha a árvore e apagaria
arquivo alheio. Destino dentro/ao redor do runtime ou do repo do app é recusado
por realpath, symlink incluso. A pasta de versões pode ficar como filha direta
do repositório Git; em qualquer arranjo mais fundo, o commit a apagaria e o
módulo recusa antes de tocar em disco.

## Adapter `desk/src/study-data/backup-services.cjs`

```js
const {createBackupServices} = require('./src/study-data/backup-services.cjs');
const backupServices = createBackupServices({
  runtime: () => runtime,          // string atual do runtime da Mesa
  deskDir,                          // para a versão no manifesto
  repoRoot: path.join(deskDir, '..'),
  settingsFile: path.join(runtime, 'mesa-backup.json'), // ARQUIVO de config
  backupRoot: () => backupSettings().destination,
  gitRoot: () => backupSettings().gitRoot,
  courses: () => allCourses(),      // o host decide QUAIS matérias entram
  external: () => nativeSessions(), // allowlist do host: [{path, ref, resume}]
  log: appendLog,
});
backupServices.status() / configure(patch) / run({reason,label}) / auto()
backupServices.listVersions() / verify(id) / previewRestore(id) / applyRestore(planId)
backupServices.cancelRestore(planId) / rollbackRestore(planId) / recover()
backupServices.exportCourse({directory, courseId, conversations})
backupServices.previewImport({file, directory, name}) / importCourse({…})
backupServices.gitStatus() / gitPush() / gitRecover()
backupServices.guardDestination(pasta) / guardGitRoot(pasta)   // para o diálogo nativo
backupServices.materials() / externalSources() / settingsPath() / courseFor(id)
```

O adapter grava a configuração no ARQUIVO `settingsFile` (o host passa
`<runtime>/mesa-backup.json`; `backup.readConfig(runtime())` lê o mesmo arquivo)
— ele não toca o `config.json` do usuário.

Regras do adapter:

- `external` é callback do HOST: sessões nativas entram só pelo que ele listar
  (sem varredura de `~/.pi`/`~/.claude`), com referência portátil e
  `resume:'transcript-only'` quando não há retomada garantida.
- `materialsOf` resolve realpath e só aceita diretório que não cai dentro do
  runtime (matéria com link para o runtime não duplica o backup).
- `studyDirOf` usa `<runtime>/learning/Courses/<id>` — o mesmo layout de
  `main.cjs#prepareCourse`/`search.cjs`; o NOME nunca vira caminho.
- `guardDestination`/`guardGitRoot` comparam realpath (symlink incluso) em AMBAS
  as direções contra runtime, repositório do app, pasta de versões e pasta do
  Git, e recusam git = pasta de versões, git dentro das versões e versões mais
  fundo que filha direta do git.
- `exportCourse` com `courseId` desconhecido é ERRO; a gravação é exclusiva
  (`writePackageFile`), então corrida/arquivo existente ganha sufixo e nunca
  sobrescreve.
- Falha do git nunca derruba o backup local: fica em `status().gitError` e o
  `ledger.json` continua válido.

## Painel `desk/src/backup-panel.mjs`

```js
import {initBackupPanel} from './backup-panel.mjs';
const painel = initBackupPanel(document, {
  status, listar, escolherPasta, curso, obterConfig, definirConfig,
  rodar, verificar, previaRestauracao, aplicarRestauracao, cancelarRestauracao,
  exportar, escolherArquivo, importar, abrirPasta,
}, {alvo: document.body, confirmar, aoImportar});
await painel.abrirBackup();      // ou abrir('backup'|'restaurar'|'compartilhar')
painel.fechar(); painel.atualizar(); painel.destroy();
```

## IPC proposta (o pai registra no `main.cjs`/`preload.cjs`)

Regra: **o renderer nunca autoriza caminho**. `backup-pick-folder` e
`share-pick-file` abrem o diálogo nativo; o main valida (`backup.runtimeExclusion`,
`zipkit.assertSafePath`), confina a escrita ao destino escolhido e só então usa os
módulos. Canais e retornos:

| Canal | Entrada | Retorno |
|---|---|---|
| `backup-status` | — | `{available, destination, settings, last, auto, lastError}` |
| `backup-list` | — | `backup.list(root)` |
| `backup-pick-folder` | — | caminho escolhido (nativo) |
| `backup-config` | `{destination, auto, intervalHours, idleMinutes, keep, git, gitRoot, gitRemote}` | config gravada |
| `backup-run` | `{reason, label}` | resultado de `backupNow` (+ `git.integrate` quando configurado) |
| `backup-verify` | `snapshotId` | `verifySnapshot(..., {strict})` |
| `backup-restore-preview` | `snapshotId` | plano da prévia |
| `backup-restore-apply` | `planId` | `applyRestore` |
| `backup-restore-cancel` | `planId` | `cancelRestore` |
| `share-export-course` | `{directory, conversations}` | `{file, bytes, features, counts}` |
| `share-pick-file` | — | caminho do `.mesa-materia` (nativo) |
| `share-import-course` | `{file, directory}` | resultado de `importar` (matéria nova) |
| `backup-active-course` | — | `{id, name, path}` da matéria ativa |
| `open-folder` | `{path}` | abre no Finder/Explorer |
| `backup-auto-tick` (opcional) | — | `backupServices.auto()` em intervalo curto; o timer é do root |
| `backup-git-push` | — | `backupServices.gitPush()` |
| `share-import-preview` | `{file, directory, name}` | `previewImport` (confirmação antes de criar) |

## CLI

```sh
cd desk
node scripts/study-backup.mjs status  --runtime <runtime> --dest <destino>
node scripts/study-backup.mjs backup  --runtime <runtime> --dest <destino> [--sem-pdfs] [--git <dir>] [--remoto <url>]
node scripts/study-backup.mjs list    --dest <destino>
node scripts/study-backup.mjs verify  --dest <destino> [--id snap-…]
node scripts/study-backup.mjs restore --runtime <runtime> --dest <destino> --id snap-… --sim
node scripts/study-backup.mjs prune   --dest <destino> [--guardar N]
```

### Exemplo de registro no `main.cjs` (o pai cola e ajusta)

```js
const {createBackupServices} = require('./src/study-data/backup-services.cjs');
const backupServices = createBackupServices({
  runtime: () => runtime,
  deskDir,
  repoRoot: path.join(deskDir, '..'),
  settingsFile: path.join(path.dirname(runtime), 'mesa-backup.json'),
  backupRoot: () => (config.backup && config.backup.destination) || '',
  gitRoot: () => (config.backup && config.backup.gitRoot) || '',
  courses: () => courses,
  log: appendLog,
});

ipcMain.handle('backup-status', () => backupServices.status());
ipcMain.handle('backup-list', () => backupServices.listVersions());
ipcMain.handle('backup-pick-folder', async () => {
  const picked = await dialog.showOpenDialog(win, {properties: ['openDirectory', 'createDirectory']});
  return picked.canceled ? null : picked.filePaths[0];
});
ipcMain.handle('backup-config', (_e, patch) => backupServices.configure(isPlainObject(patch) ? patch : {}));
ipcMain.handle('backup-run', async (_e, payload) => {
  await assertIdle('Pare a resposta antes de fazer backup.');
  return backupServices.run({reason: payload?.reason === 'auto' ? 'auto' : 'manual', label: String(payload?.label || '')});
});
ipcMain.handle('backup-verify', (_e, payload) => backupServices.verify(String(payload?.snapshotId || '')));
ipcMain.handle('backup-restore-preview', async (_e, payload) => {
  await assertIdle('Pare a resposta antes de restaurar.');
  return backupServices.previewRestore(String(payload?.snapshotId || ''));
});
ipcMain.handle('backup-restore-apply', async (_e, payload) => {
  await assertIdle('Pare a resposta antes de restaurar.');
  const result = await backupServices.applyRestore(String(payload?.planId || ''));
  /* Recarrega o estado/lista de conversas depois de mexer nos arquivos. */
  state = readStateFromDisk();
  return {...result, ...initialData()};
});
ipcMain.handle('backup-restore-cancel', (_e, payload) => backupServices.cancelRestore(String(payload?.planId || '')));
ipcMain.handle('backup-active-course', () => backupServices.courseFor(courseId) || {id: courseId, name: '', path: ''});
ipcMain.handle('share-pick-file', async () => {
  const picked = await dialog.showOpenDialog(win, {filters: [{name: 'Matéria da Mesa', extensions: ['mesa-materia']}], properties: ['openFile']});
  return picked.canceled ? null : picked.filePaths[0];
});
ipcMain.handle('share-export-course', async (_e, payload) => backupServices.exportCourse({
  directory: String(payload?.directory || ''), courseId, conversations: payload?.conversations === true,
}));
ipcMain.handle('share-import-course', async (_e, payload) => {
  const result = backupServices.importCourse({file: String(payload?.file || ''), directory: String(payload?.directory || ''), name: String(payload?.name || '')});
  const next = {...result.course};           // {id, name, path: materialsDir}
  courses.push(next); persist();             // registra a matéria nova
  return result;
});
/* Agendador: o root chama em intervalo curto; a decisão é do módulo. */
setInterval(() => backupServices.auto().catch(() => {}), 5 * 60 * 1000);
```

## Testes

```sh
cd desk
node --test tests/study-backup.test.mjs tests/study-packages.test.mjs tests/study-git-backup.test.mjs tests/study-backup-cli.test.mjs tests/study-backup-panel.test.mjs
```

Fixtures sintéticas em `tests/study-backup-fixtures.mjs` (nenhum material real,
nenhuma credencial, nenhuma sessão do usuário). Os testes de git usam
repositórios locais de verdade e se pulam se o binário `git` não existir; o
runner é exercitado com um `git` de mentira só para provar prazo/teto de saída.

## Limitações conhecidas (honestas)

- Material e origem externa voltam para DENTRO do runtime
  (`courses/<matéria>/…`, `external/<ref>`), não para a pasta original de outra
  máquina; o plano de restauração lista o que ficou fora e avisa os caminhos
  absolutos que não existem aqui.
- Rótulos do `chat-library.json` e rascunhos do `pdf-drafts.json` sobrevivem a
  backup/restauração/relocação (chave = matéria + caminho relativo). O arquivo
  `.mesa-materia` ainda NÃO carrega esses rótulos: a importação cria conversa
  nova (id/arquivo novos) sem os rótulos antigos, por desenho.
- `config.json` do usuário só entra no backup quando ele mora no runtime
  (modo `LEARNING_DESK_RUNTIME`); fora disso o backup não toca a configuração
  pessoal.
- `buildPackage` lê material/stores em memória: um pacote muito grande depende
  do teto de 512 MiB da caminhada de arquivos.

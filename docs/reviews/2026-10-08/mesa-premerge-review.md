# Revisão antes do merge — Mesa, 8 de outubro de 2026

## Escopo

Integração local das otimizações Electron/PDF, melhorias de leitura e qualidade
de vida e ferramentas de estudo previamente autorizadas, sobre main
`4a10aa2c0b60c8f5d688db7228da1c0f5fe3bead`. Snapshot isolado dos arquivos de
`core/`, `desk/` e dos dois relatórios da implementação. Experimentos em
`claude-mod/`, `codex-plugin/`, outros documentos, bundles e dados pessoais
ficaram fora do commit.

Três revisores Pi Mesa Dev / Command Code / DeepSeek V4.1 Flash, thinking=max,
full-access: PDF/bundle, QoL/Desfazer e integração/backup. Uma tarefa corrigiu
os achados de backup; a segunda rodada de QoL/Claude revisou as correções e
concluiu que não restava bloqueio para merge. Integração e revisão final dos
diffs feitas pelo agente principal.

## Achados corrigidos

| Problema | Correção e regressão |
|---|---|
| Esc fechava popovers antes da decisão e também abortava o tutor | Decisão capturada antes dos listeners bubble; Electron com turno retido confirma que referências fecham e o turno continua |
| Layout pessoal ausente da paleta após reiniciar | Carrega presets no boot; Electron confirma disponibilidade antes de abrir Configurações |
| Enter de composição IME executava ação | Guards de composição no teclado/paleta; Enter sintético não abre a ação |
| Layout salvo com pdfSplit=1e308 impedia o boot | Limita antes de multiplicar; host e renderer rejeitam medidas vazias e tipos inválidos; teste de init com desk.json corrompido |
| Falha de disco consumia o token de Desfazer, agenda falhava silenciosamente | check/commit após gravação e agenda; falhas ENOSPC permitem retry sem duplicatas e preservam histórico/metadados |
| Callback antigo do Desfazer podia fechar um aviso novo | Compara identidade da requisição antes do timeout; regressão de callback atrasado |
| Resposta atrasada de drop contaminava o leitor/biblioteca da matéria nova | Captura curso/conversa/painel/versão; hunt com IPC atrasado e troca real de matéria |
| Prefixo importado Claude ficava desatualizado ao limitar o cache | Serviço rastreia a fronteira e sincroniza adaptador/descritor; 5.000 importadas, leituras repetidas e duas mensagens nativas sem duplicação |
| Matérias com nomes iguais sobrescreviam material no snapshot | Partições próprias na colisão, incluindo courses/ do runtime; ambas preservadas e restauradas |
| Remap não atualizava configuração externa sem referências nos stores | Resultado expressa a decisão de remap; testes de origem viva/ausente e configuração externa |
| CLI permitia destino de backup sobreposto ao runtime | Guarda no domínio antes de criar pasta/ledger, nos dois sentidos e por realpath; inclui raiz do volume e symlinks |

## Validação

- Suíte completa: **1.088 testes, zero falhas/skip**.
- Regressões finais de backup/CLI/restauração: **42/42**; a guarda da raiz
  do volume foi conferida sem permitir escrita fora das fixtures.
- `npm run verify:bend`: **78 artefatos reproduzíveis**, provas verdes.
- `npm run check`: sintaxe aprovada em **289 arquivos**.
- Electron real com runtime/Pi/PDFs sintéticos: `qol-actions-ui`,
  `hunt-qol-undo`, `hunt-qol-ipc`, `hunt-pdf-qol` e
  `hunt-pdf-drop-scope` passaram.
- SDK oficial no payload e CLI externo sintético: `bundle-runtime-sdk`
  passou, sem login/inferência. CLI opcional redundante permanece omitido.
- `git diff --check` aprovado.

A rodada anterior à revisão também verificou retenção/races de canvas,
UI geral e instalação assinada; ver os relatórios de otimização e QoL.
Esta etapa valida e integra o código-fonte; não recompila/substitui o bundle
instalado nem publica release.

## Limites e observações não bloqueantes

- O leitor de matéria ainda lê o PDF inteiro por IPC, sem teto próprio de
  tamanho. É uma limitação preexistente de open-pdf/read-pdf; corrigido o
  comentário que prometia validação de tamanho no drop. Não foi imposto um
  limite arbitrário que recusasse documentos antes aceitos.
- View/layout global por usuário é o desenho atual. Presets não contêm
  documentos, conversas, rascunhos nem configuração de provedor.
- Testes no macOS, com dados sintéticos; sem validação em Windows ou
  inferência autenticada.
- Main do vault já contém a branch da worktree: merge retornou
  Already up to date. Arquivos pessoais/unrelated dirty no vault preservados.
- Merge solicitado é local. Sem push, PR ou release.

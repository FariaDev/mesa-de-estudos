# Mesa no Codex — personalização e retomada opcionais

Data: 2026-10-07; fechamento 2026-10-08. Fonte e instalada 0.2.2-experimental,
habilitada. Perfis/checkpoint opcionais desligados na instalação padrão.

O usuário pediu melhorias após esclarecer que o plugin usa o próprio Codex,
sem Pi dentro do app. A implementação mantém esse contrato: skill de tutoria,
ferramentas MCP locais e contexto da conversa sob o Codex. Pi é apenas o
runtime dos agentes de desenvolvimento.

## Trabalho autorizado

- Pi Mesa Dev / Command Code / DeepSeek V4.1 Flash / thinking=max / full-access.
- Implementação servidor r1: concluída, perfis explícitos e checkpoint opt-in.
- Skill r1: concluída, workflow de perfis/retomada/fonte atual.
- Revisão independente r2: concluída; achados F1–F5 registrados em
  docs/reviews/mesa-codex-context-review-20261007.md. Correção r3 concluída;
  revisão independente final r4 concluída no mesmo provider/runtime/modelo.
  F1–F5 resolvidos, sem novo bloqueador no servidor; relatório em
  docs/reviews/mesa-codex-context-fixes-review-20261007.md.
- Nenhuma leitura de perfis pessoais, PDFs de curso, autenticação ou sessões.
- Desk/Core/Chat/Claude Mod/Visual Check preservados; nenhuma instalação do app,
  captura real ou inferência nos testes.

## Comportamento implementado

--tutor-file e --learner-file (ou envs equivalentes) fixam os únicos arquivos
regulares UTF-8 de perfil que o servidor lê, até 64KiB cada. mesa_status
informa disponibilidade sem corpo; mesa_context devolve textos e proveniência.
O tutor aplica preferências dentro do pedido atual, sem substituir políticas
ou expandir ferramentas/acesso. Nenhum perfil é descoberto por varredura.

--state-file (MESA_STUDY_STATE_FILE) é opcional, filho direto .json do cache
privado. Sem configuração, nenhuma persistência é adicionada. O checkpoint
atômico 0600 guarda somente referência PDF/página/nota/data; nada de imagens,
captura, histórico ou credenciais. Após reiniciar, vira resumeCandidate, sem
carregar context.page/capture. Retomada exige pedido explícito e novo render
pelas raízes atuais. A skill preserva a nota do candidato antes do render.
Um arquivo é um espaço de estudo configurado; sem isolamento por thread e a
última gravação vence. Falha de persistência reporta saved:false sem transformar
um render bem-sucedido em falha.

O root corrigiu também o status assíncrono de ajuda: o tipo do pedido fica
fixado no envio mesmo quando a prévia muda antes da confirmação. Teste de
regressão cobre as duas direções página/captura; 43 testes de UI passando.

## Validação local antes da revisão final

Suíte após as correções r3, conferida pelo root: 172/172, zero falhas/skips,
6,91s; mais 13 regressões de perfis, confinamento, leitura limitada, cache e nota.
A rodada anterior tinha 159 testes. Contagem de paridade reduziu um
porque a comparação de comportamento com origem mutável tornou-se opt-in;
todos os arquivos da cópia fixada continuam protegidos por SHA256, inclusive
capture.mjs ajustado. Nenhum host foi re-snapshotado. A origem Claude mudou em
paralelo; MESA_VERIFY_SNAPSHOT_ORIGIN=1 mantém a comparação de migração explícita.

Staging de teste configurado exclusivamente com perfis sintéticos:
codex-plugin/.local-smoke/mesa-context-check-20261007-7jka4c7m/plugin.
SDK/stdio/Poppler reais confirmaram: status sem textos dos perfis, mesa_context
com perfis escolhidos, página 2 persistida, anotação preservada após encerrar e
reiniciar o processo; active page e capture nulos; checkpoint somente referências
com modo0600. Edição do perfil escolhido foi relida. Nenhum modelo ou captura
real. Não é validação dentro do app Codex.

A revisão encontrou F1 (candidato resolve caminho cru em vez do realpath),
F2 (leitura integral de perfil/checkpoint antes do teto e corrida de identidade),
F3 (candidato contradiz diagnóstico de cache não privado), F4 (render pós-restart
podia perder nota), F5 (códigos de erro ausentes na documentação). A gravação
atômica e o render de PDF continuaram seguros nas reproduções; ainda assim,
a versão nova não será instalada antes de corrigir/revisar os achados.
Correção r3 resolveu F1–F5: candidato confinado lexicalmente e por realpath antes
da classificação; leitura por descritor limitada a teto+1, O_NOFOLLOW onde
disponível e revalidação de identidade/canônico; candidato bloqueado em cache
inseguro; nota preservada somente para o mesmo documento/página após reiniciar;
códigos STATE_CACHE* documentados. Node portátil não fecha toda corrida global
de filesystem; o contrato descreve as verificações efetivas.

Novo staging pós-r3, somente perfis sintéticos:
codex-plugin/.local-smoke/mesa-context-final-check-20261007-jdokmqit/plugin.
SDK/stdio/Poppler reais confirmaram de novo status sem corpos, perfil explícito
relido após edição, checkpoint 0600 com chaves permitidas, processo novo com
página/captura ativas nulas, nota preservada ao renderizar a mesma página e
não herdada ao renderizar outra. Nenhuma inferência ou captura.
A revisão r4 confirmou as correções por reproduções próprias e 172/172 testes
antes das mudanças concorrentes de UI. A edição citada como “root” no relatório
é o agente de implementação UI r1, autorizado depois do início da revisão.
Essas falhas transitórias de testes durante a edição não são um resultado final.
A instalação aguarda fechamento/validação/revisão da UI nova; a validação humana
no Codex continua pendente. Ver STATUS-MESA-CODEX-UI-POLISH-2026-10-07.md.

Candidato de instalação com perfis e persistência desligados por padrão:
codex-plugin/.local-smoke/mesa-context-final-install-20261007-1jdjyqsc/plugin.
SDK/stdio/Poppler reais: versão 0.2.2, sete ferramentas, template somente em
mesa_open, recurso HTML completo (65.468 bytes, SHA256
0f0cd3b4031670dc0ce3292ef3c13053a2aa1e093db72601c2670b4adf37664b),
PNG completo da página sintética (17.420 bytes), PDF preservado. Nenhuma
captura ou inferência. Plugin instalado conferido pelo CLI: ainda 0.2.1,
habilitado, sem alteração da configuração pessoal nesta rodada.

## Fechamento — 2026-10-08

Revisão de contexto r4 aprovada; UI r1 seguida de revisão r2 e correções A–E
revisadas/aprovadas em r3. Suíte final 179/179; SDK/Poppler real no launcher
instalado confirmou versão 0.2.2, sete ferramentas, recurso HTML íntegro e PNG
da página sintética. Nenhuma inferência/captura ou importação de perfil pessoal.
Instalação e evidências completas em STATUS-MESA-CODEX-UI-POLISH-2026-10-07.md.
Um processo novo não restaura página/captura automaticamente; o checkpoint só
existe quando configurado. A implementação está instalada; validação humana
dentro do Codex e ativação opcional com perfis escolhidos continuam pendentes.

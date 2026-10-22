# Mesa v0.4.7 — publicação e instalação

- Review final CodeRabbit: 0 issues, 15 arquivos (diff completo e versão).
- PR #2 mesa-e-conversa integrada: 9b84ddd40fe1f05d59dd4ac8f92f627dc5ff48e6.
- PR #2 mesa-de-estudos integrada: 5354d89765e48df798339094086962eed1e68e1e.
- Release estável: https://github.com/FariaDev/mesa-de-estudos/releases/tag/v0.4.7.
- Updater oficial executado com --sem-reabrir: instalado 0.4.7, sucesso.
- Bundle/package.json/Info.plist em 0.4.7; codesign --deep --strict aprovado.
- Configuração e 27 sessões conferidas por SHA-256: nenhuma alteração.
- Backup temporário do bundle anterior: /private/tmp/mesa-v0.4.6-before-v047.app.

Validação desta publicação: Mesa 432 aprovados; público 418 aprovados/14
ignorados; verify:bend 64/36 artefatos e provas verdes. Na rodada de código,
Conversa 340 aprovados, smokes Mesa/Conversa e hunt-queue aprovados.
Revisão anterior de transporte: falhas simuladas. Sem execução Windows/Linux,
sem benchmark CPU/RAM. Não há CI configurada nos repositórios.

Durable permanece adiado. Não foram atualizados o pacote do Pi, credenciais,
servidores MCP ou defaults da Mesa. O updater de fato aplicou a Release pelo
modo git e sincronizou o bundle local; não se trata apenas de código publicado.

Smoke completo instalado: APP PASSED. Hunt-queue instalado: aprovado.
Configuração e 27 sessões novamente conferidas após os testes: idênticas.
App reaberto após validação, sem enviar mensagem na sessão do usuário.

# Mesa — implementação autorizada após 0.5.0

Branch: `codex/mesa-backup-study-tools`. Preservar runtime e instalação pessoal.

Escopo aprovado: backup local com versões e restauração; destino Git opcional; busca geral; Caderno com Revisar hoje e agenda de revisões; notas associadas ao material/página sem modificar PDF; compartilhar/importar matéria; estatísticas locais de tempo ativo, dúvidas e tokens. Polimento e testes de fluxos existentes.

O usuário esclareceu que a antiga referência a sete dias provavelmente era sobre notas do Obsidian. Não confundir janela semanal de uso do Claude, TTL de permissões ou cache com retenção de conversas. Auditoria de histórico ainda deve preservar estudos antigos.

## Execução delegada

Provider `pi-mesa-dev`, modelo `commandcode/deepseek/deepseek-v4.1-flash`, opção `thinking=max`, runtime `full-access`. Agentes compartilham checkout com arquivos de domínio separados. Integração de main/preload/shell/build/proofs centralizada no pai.

```json
{
  "backup": "node:delegated-task:command%3Amcp%3A0790ae8d-3125-4283-9515-cecba2b7909b%3Adelegate-task%3Amesa06-backup-commandcode-r1",
  "search": "node:delegated-task:command%3Amcp%3A0790ae8d-3125-4283-9515-cecba2b7909b%3Adelegate-task%3Amesa06-search-notes-commandcode-r1",
  "stats": "node:delegated-task:command%3Amcp%3A0790ae8d-3125-4283-9515-cecba2b7909b%3Adelegate-task%3Amesa06-stats-review-commandcode-r1"
}
```

## Aceitação

- Backup sintético capturado, restaurado em destino isolado e verificado byte a byte; falha/rede/conflito Git preservam cópia local. Restaurar mostra prévia e usa confirmação no app.
- Compartilhar/importar não inclui credenciais ou caminhos executáveis e cria matéria independente com referências remapeadas.
- Busca encontra conversa/revisão/nota/material e navega ao destino correto, respeitando autorização dos arquivos.
- Agenda preserva registros antigos, usa IDs estáveis e registra avaliações sem enviar mensagem automaticamente.
- Tempo observado não inclui idle/suspensão; contagens de dúvidas só incluem aceite; tokens têm origem e indisponibilidade explícitas.
- Novos acessos permanecem visíveis numa barra de ferramentas com margens e temas atuais; diálogos funcionam em 900x650.
- Núcleos/provas, testes de domínio e Electron passam; distinguir fake-Pi/SDK simulado de provedor autenticado e plataforma real.

Estado atual: implementação e revisão concluídas. Rodada final: 993 testes sem falhas; build/provas/paridade aprovados e 74 artefatos reproduzíveis. Fluxos Electron de conversas, PDFs, ferramentas e backup/restauração/importação passaram com dados sintéticos e provedores simulados. Evidências e limites em [relatório de validação](reviews/2026-10-07/mesa-study-tools-validation.md). Sem commit, push, release ou instalação nesta etapa.

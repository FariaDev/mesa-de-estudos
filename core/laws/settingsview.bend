import Base
import ../msg.bend as M
import ../settingsview.bend as S
import ../view.bend as V

# ---------------------------------------------------------------------------
# Contrato das Configurações com seções na lateral (ticket #20). Prefixo
# `settings_`.
#
# O que as leis fixam:
#   - as cinco seções, na ordem da spec, e que a primeira (Matérias) é a que o
#     diálogo abre; seção desconhecida volta para ela;
#   - a lateral: um botão por seção, só a corrente com `aria-current`;
#   - a validação das matérias: linha em branco é ignorada, nome sem pasta é um
#     erro na pasta, nome repetido é um erro no nome, e o diálogo leva à seção
#     do primeiro erro;
#   - o aviso de erro é um `role="alert"` com o id que o campo aponta.
#
# As leis fecham em valores concretos: `String.trim`/`String.eq` de variável
# livre não reduzem, então cada caso é uma linha real de formulário.
# ---------------------------------------------------------------------------

def row(id: String, name: String, path: String) -> S.SettingsRow:
  S.SettingsRow{id, name, path}

# ---------- seções ----------

law settings_primeira_secao_e_materias:
  {S.firstSection() == "materias" : String}

law settings_cinco_secoes_na_ordem_da_spec:
  {S.sectionIds() == ["materias", "leitores", "mesa", "avisos", "pastas"] : List<&2, String>}

law settings_rotulo_materias:
  {S.sectionLabel("materias") == M.msg("settings.sec.courses") : String}

law settings_rotulo_leitores:
  {S.sectionLabel("leitores") == M.msg("settings.sec.readers") : String}

law settings_rotulo_recursos:
  {S.sectionLabel("mesa") == M.msg("settings.sec.features") : String}

law settings_rotulo_aparencia:
  {S.sectionLabel("avisos") == M.msg("settings.sec.appearance") : String}

law settings_rotulo_pastas:
  {S.sectionLabel("pastas") == M.msg("settings.sec.folders") : String}

# Seção que o núcleo não conhece vale a primeira: nunca um diálogo sem painel.
law settings_secao_valida_fica:
  {S.activeSection("pastas") == "pastas" : String}

law settings_secao_desconhecida_vale_materias:
  {S.activeSection("layout") == "materias" : String}

law settings_secao_vazia_vale_materias:
  {S.activeSection("") == "materias" : String}

# As setas percorrem a lateral e fecham o ciclo nas pontas.
law settings_proxima_avanca:
  {S.nextSection("leitores") == "mesa" : String}

law settings_proxima_fecha_o_ciclo:
  {S.nextSection("pastas") == "materias" : String}

law settings_anterior_recua:
  {S.prevSection("avisos") == "mesa" : String}

law settings_anterior_fecha_o_ciclo:
  {S.prevSection("materias") == "pastas" : String}

# ---------- lateral ----------

# Só a seção corrente leva `aria-current`.
law settings_nav_corrente_marcada:
  {V.attrGet(V.attrsOf(S.navButton("mesa", "mesa")), "aria-current") == Some{"page"} : Maybe<&2, String>}

law settings_nav_outra_nao_marcada:
  {V.attrGet(V.attrsOf(S.navButton("mesa", "avisos")), "aria-current") == None{} : Maybe<&2, String>}

law settings_nav_botao_diz_a_secao:
  {V.attrGet(V.attrsOf(S.navButton("materias", "pastas")), "data-sec") == Some{"pastas"} : Maybe<&2, String>}

law settings_nav_botao_aponta_o_painel:
  {V.attrGet(V.attrsOf(S.navButton("materias", "pastas")), "aria-controls") == Some{"settings-sec-pastas"} : Maybe<&2, String>}

law settings_nav_botao_chama_handler:
  {V.attrGet(V.attrsOf(S.navButton("materias", "pastas")), "on:click") == Some{"SelectSection"} : Maybe<&2, String>}

law settings_nav_botao_texto:
  {V.kidsOf(S.navButton("materias", "mesa")) == [V.viewText(M.msg("settings.sec.features"))] : List<&2, V.ViewNode>}

# A lateral inteira: cinco botões, na ordem, com a corrente marcada.
law settings_nav_cinco_botoes:
  {S.navChildren("leitores") == [
    S.navButton("leitores", "materias"),
    S.navButton("leitores", "leitores"),
    S.navButton("leitores", "mesa"),
    S.navButton("leitores", "avisos"),
    S.navButton("leitores", "pastas")
  ] : List<&2, V.ViewNode>}

# Seção desconhecida: a lateral marca Matérias.
law settings_nav_desconhecida_marca_materias:
  {S.navChildren("nada") == S.navChildren("materias") : List<&2, V.ViewNode>}

law settings_dica_do_rodape:
  {S.footerHint("materias") == M.msg("settings.hint.save") : String}

law settings_dica_do_rodape_vale_para_as_seccoes_de_formulario:
  {S.footerHint("leitores") == S.footerHint("materias") : String}

# Pastas e programas: os caminhos esperam o Salvar, mas o programa de escrita
# do Conferir vale na hora — o aviso diz as duas coisas.
law settings_dica_do_rodape_pastas_separa_caminhos_do_programa:
  {S.footerHint("pastas") == M.msg("settings.hint.paths") : String}

# Aparência e avisos aplica na hora: o rodapé não diz "depois de salvar".
law settings_dica_do_rodape_aparencia_vale_na_hora:
  {S.footerHint("avisos") == M.msg("settings.hint.live") : String}

# Seção desconhecida cai em Matérias, e o aviso acompanha.
law settings_dica_do_rodape_desconhecida:
  {S.footerHint("nada") == S.footerHint("materias") : String}

law settings_dica_do_rodape_no:
  {S.footerHintNode("avisos") == V.viewText(S.footerHint("avisos")) : V.ViewNode}

# ---------- salvar com o tutor respondendo (#42) ----------

# Respondendo e com mudança pendente: o rodapé diz que dá para salvar depois,
# em qualquer seção, e o Salvar fica desligado.
law config_rodape_respondendo:
  {S.footerHintFor("materias", True{}, True{}) == M.msg("settings.hint.busy") : String}

law config_rodape_respondendo_em_avisos:
  {S.footerHintFor("avisos", True{}, True{}) == S.busyHint() : String}

law config_salvar_travado:
  {S.saveBlocked(True{}, True{}) == True{} : Bool}

# Sem mudança pendente, nada trava (Salvar só fecha), mesmo respondendo.
law config_salvar_sem_mudanca_livre:
  for busy: Bool
  {S.saveBlocked(busy, False{}) == False{} : Bool}

# Tutor livre: nada trava e o rodapé é o da seção.
law config_salvar_livre:
  for dirty: Bool
  {S.saveBlocked(False{}, dirty) == False{} : Bool}

law config_rodape_livre_e_o_da_secao:
  {S.footerHintFor("pastas", False{}, True{}) == S.footerHint("pastas") : String}

law config_rodape_respondendo_sem_mudanca:
  {S.footerHintFor("avisos", True{}, False{}) == M.msg("settings.hint.live") : String}

# ---------- validação das matérias ----------

law settings_sem_linhas_sem_erro:
  {S.settingsIssues(Nil{}) == Nil{} : List<&2, S.SettingsIssue>}

# Linha em branco (a que a lista vazia mostra) é ignorada, como sempre foi.
law settings_linha_em_branco_ignorada:
  {S.settingsIssues([row("", "", "")]) == Nil{} : List<&2, S.SettingsIssue>}

law settings_linha_so_espacos_ignorada:
  {S.settingsIssues([row("", "  ", "\t ")]) == Nil{} : List<&2, S.SettingsIssue>}

law settings_linha_completa_sem_erro:
  {S.settingsIssues([row("calc", "Cálculo", "/pdfs/calc")]) == Nil{} : List<&2, S.SettingsIssue>}

# Nome sem pasta deixa de ser descartado em silêncio: é um erro na pasta.
law settings_nome_sem_pasta_erra_na_pasta:
  {S.settingsIssues([row("", "Física", "")])
    == [S.SettingsIssue{"materias", 0n, "path", M.msg("settings.error.folder")}]
    : List<&2, S.SettingsIssue>}

# Pasta sem nome segue valendo: o nome cai para o último segmento da pasta.
law settings_pasta_sem_nome_vale:
  {S.settingsIssues([row("", "", "/pdfs/Fisica")]) == Nil{} : List<&2, S.SettingsIssue>}

# O erro cai na linha certa.
law settings_erro_na_segunda_linha:
  {S.settingsIssues([row("calc", "Cálculo", "/pdfs/calc"), row("", "Física", "")])
    == [S.SettingsIssue{"materias", 1n, "path", M.msg("settings.error.folder")}]
    : List<&2, S.SettingsIssue>}

# Nome repetido: a segunda linha leva o erro, no campo do nome.
law settings_nome_repetido_erra_no_nome:
  {S.settingsIssues([row("", "Cálculo", "/pdfs/a"), row("", "Cálculo", "/pdfs/b")])
    == [S.SettingsIssue{"materias", 1n, "name", M.msg("settings.error.duplicate")}]
    : List<&2, S.SettingsIssue>}

# O id guardado vence o nome: renomear uma matéria não a duplica.
law settings_id_guardado_nao_duplica:
  {S.settingsIssues([row("calc", "Cálculo I", "/pdfs/a"), row("calc2", "Cálculo", "/pdfs/b")])
    == Nil{} : List<&2, S.SettingsIssue>}

# Duas pastas com o mesmo último segmento e sem nome geram o mesmo id.
law settings_pasta_repetida_sem_nome_erra:
  {S.settingsIssues([row("", "", "/a/Fisica"), row("", "", "/b/Fisica")])
    == [S.SettingsIssue{"materias", 1n, "name", M.msg("settings.error.duplicate")}]
    : List<&2, S.SettingsIssue>}

# Uma linha dá no máximo um erro, e a linha com erro de pasta não entra na
# conta dos repetidos.
law settings_linha_sem_pasta_nao_acusa_a_seguinte:
  {S.settingsIssues([row("", "Física", ""), row("", "Física", "/pdfs/f")])
    == [S.SettingsIssue{"materias", 0n, "path", M.msg("settings.error.folder")}]
    : List<&2, S.SettingsIssue>}

law settings_dois_erros_na_ordem_das_linhas:
  {S.settingsIssues([row("", "A", ""), row("", "B", "/b"), row("", "B", "/c"), row("", "C", "")])
    == [
      S.SettingsIssue{"materias", 0n, "path", M.msg("settings.error.folder")},
      S.SettingsIssue{"materias", 2n, "name", M.msg("settings.error.duplicate")},
      S.SettingsIssue{"materias", 3n, "path", M.msg("settings.error.folder")}
    ] : List<&2, S.SettingsIssue>}

# ---------- para onde o diálogo leva ----------

law settings_sem_erro_nao_leva_a_lugar_nenhum:
  {S.issueSection(Nil{}) == "" : String}

law settings_erro_leva_a_secao_do_erro:
  {S.issueSection(S.settingsIssues([row("", "Física", "")])) == "materias" : String}

# ---------- aviso ao lado do campo ----------

law settings_aviso_tem_role_alert:
  {V.attrGet(V.attrsOf(S.errorNode("row-0-path", "Falta a pasta.")), "role") == Some{"alert"} : Maybe<&2, String>}

law settings_aviso_tem_o_id_que_o_campo_aponta:
  {V.attrGet(V.attrsOf(S.errorNode("row-0-path", "Falta a pasta.")), "id") == Some{"settings-error-row-0-path"} : Maybe<&2, String>}

law settings_aviso_diz_a_mensagem:
  {V.kidsOf(S.errorNode("row-0-path", "Falta a pasta.")) == [V.viewText("Falta a pasta.")] : List<&2, V.ViewNode>}

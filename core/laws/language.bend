import Base
import ../language.bend as L

# ---------------------------------------------------------------------------
# Contrato do idioma da interface e do tutor (#41). Prefixo `language_`.
#
#   - interface: o valor guardado ("pt-BR" ou "en") vence; sem ele, `pt*` do
#     sistema abre em português e qualquer outro em inglês;
#   - tutor: "follow" (padrão), "pt-BR" ou "en"; valor desconhecido volta a
#     "follow";
#   - o locale do sistema entra como texto: ler o sistema é do host.
# ---------------------------------------------------------------------------

law language_sistema_pt_br:
  {L.fromSystem("pt-BR") == "pt-BR" : String}

law language_sistema_pt_portugal:
  {L.fromSystem("pt-PT") == "pt-BR" : String}

law language_sistema_pt_simples:
  {L.fromSystem("pt") == "pt-BR" : String}

law language_sistema_pt_com_sublinhado:
  {L.fromSystem("pt_BR") == "pt-BR" : String}

law language_sistema_en_us:
  {L.fromSystem("en-US") == "en" : String}

law language_sistema_outro_idioma_vira_ingles:
  {L.fromSystem("ja") == "en" : String}

law language_sistema_vazio_vira_ingles:
  {L.fromSystem("") == "en" : String}

# A escolha guardada vence o sistema, nos dois sentidos.
law language_escolha_en_vence_sistema_pt:
  {L.resolveUi("en", "pt-BR") == "en" : String}

law language_escolha_pt_vence_sistema_en:
  {L.resolveUi("pt-BR", "en-US") == "pt-BR" : String}

law language_sem_escolha_segue_o_sistema:
  {L.resolveUi("", "pt-BR") == "pt-BR" : String}

law language_sem_escolha_sistema_en:
  {L.resolveUi("", "en-GB") == "en" : String}

# Valor guardado desconhecido (arquivo editado à mão) é como não ter escolhido.
law language_guardado_desconhecido_segue_o_sistema:
  {L.resolveUi("fr", "pt-BR") == "pt-BR" : String}

law language_guardado_desconhecido_sistema_en:
  {L.resolveUi("pt", "en-US") == "en" : String}

law language_tutor_padrao_acompanha:
  {L.tutor("") == "follow" : String}

law language_tutor_guardados_validos:
  {[L.tutor("follow"), L.tutor("pt-BR"), L.tutor("en")] == ["follow", "pt-BR", "en"] : List<&2, String>}

law language_tutor_desconhecido_acompanha:
  {L.tutor("de") == "follow" : String}

# A ordem do seletor do tutor: acompanhar primeiro (é o padrão).
law language_tutor_opcoes:
  {L.tutorChoices() == ["follow", "pt-BR", "en"] : List<&2, String>}

law language_interface_opcoes:
  {L.uiChoices() == ["pt-BR", "en"] : List<&2, String>}

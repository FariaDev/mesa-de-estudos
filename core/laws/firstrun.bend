import Base
import ../firstrun.bend as F

# ---------------------------------------------------------------------------
# Contrato da primeira abertura (tickets #21 e #64). Prefixo `firstrun_`.
#
# Desde a #64 só a invariante de domínio fica no núcleo (ADR 0001):
#
#   - qual primeira abertura vale; quem tem matéria nunca a vê;
#   - nome E pasta de PDFs são o que cria a matéria; em branco (só espaços)
#     conta como ausente;
#   - o id da matéria é o do formulário das Configurações: o nome aparado, ou a
#     pasta quando o nome está em branco;
#   - criar na primeira abertura "empty" não regrava a pasta de dados.
#
# As leis fecham em valores concretos (`String.trim` de variável livre não
# reduz).
# ---------------------------------------------------------------------------

law firstrun_entrada_sem_configuracao:
  {F.entry(True{}, False{}) == "setup" : String}

# Pasta de dados válida e nenhuma matéria: a mesma tela, sem pedir os dados.
law firstrun_entrada_sem_materia_com_dados:
  {F.entry(False{}, False{}) == "empty" : String}

law firstrun_entrada_com_materia_nunca:
  {F.entry(False{}, True{}) == "" : String}

# O host nunca diz "sem configuração" havendo matéria; se dissesse, a matéria
# ainda vence.
law firstrun_entrada_com_materia_vence:
  {F.entry(True{}, True{}) == "" : String}

law firstrun_falta_tudo:
  {F.missing("", "") == "both" : String}

law firstrun_falta_tudo_so_espaco:
  {F.missing("   ", "  ") == "both" : String}

law firstrun_falta_a_pasta:
  {F.missing("Cálculo I", "") == "folder" : String}

law firstrun_falta_o_nome:
  {F.missing("", "/pdfs/calculo") == "name" : String}

law firstrun_falta_o_nome_so_espaco:
  {F.missing("  ", "/pdfs/calculo") == "name" : String}

law firstrun_nada_falta:
  {F.missing("Cálculo I", "/pdfs/calculo") == "" : String}

law firstrun_cria_com_nome_e_pasta:
  {F.canCreate("Cálculo I", "/pdfs/calculo") == True{} : Bool}

law firstrun_nao_cria_sem_pasta:
  {F.canCreate("Cálculo I", "") == False{} : Bool}

law firstrun_nao_cria_sem_nome:
  {F.canCreate("", "/pdfs/calculo") == False{} : Bool}

law firstrun_nao_cria_sem_nada:
  {F.canCreate("  ", "  ") == False{} : Bool}

law firstrun_id_e_o_nome:
  {F.courseId("Cálculo I", "/pdfs/calculo") == "Cálculo I" : String}

law firstrun_id_apara_o_nome:
  {F.courseId("  Cálculo I  ", "/pdfs/calculo") == "Cálculo I" : String}

law firstrun_id_sem_nome_e_a_pasta:
  {F.courseId("", "/pdfs/Física") == "Física" : String}

law firstrun_id_sem_nome_pasta_do_windows:
  {F.courseId("  ", "C:\\pdfs\\Física") == "Física" : String}

# Criar a matéria na folha "empty" não confirma nem regrava a pasta de dados.
law firstrun_vazia_nao_regrava_os_dados:
  {F.dataToConfirm("empty", "/dados") == "" : String}

law firstrun_setup_confirma_os_dados:
  {F.dataToConfirm("setup", "/dados") == "/dados" : String}

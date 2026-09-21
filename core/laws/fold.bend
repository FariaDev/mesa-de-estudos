import Base
import ../fold.bend as F

# ---------------------------------------------------------------------------
# Leis: nomes (dobra de acentos pt-BR + caixa, como nameMatches de hoje).
# ---------------------------------------------------------------------------

# "Formul" acha "Formulário de M03.pdf" (o acento fica depois do trecho).
law nome_formulario:
  {F.matchesAny("Formulário de M03.pdf", ["Formul"]) == True{} : Bool}

# Agulha acentuada acha nome acentuado.
law nome_calculo_acentuado:
  {F.matchesAny("Cálculo I", ["cálculo"]) == True{} : Bool}

# Agulha sem acento NÃO acha um acento dentro do trecho casado: é o
# comportamento exato do NFD de hoje (`"Cálculo I".normalize("NFD")` guarda a
# marca combinante, então o "calculo" contíguo não existe).
law nome_calculo_sem_acento:
  {F.matchesAny("Cálculo I", ["calculo"]) == False{} : Bool}

# Agulha vazia não casa (o host ignora trechos vazios).
law nome_agulha_vazia:
  {F.matchesAny("Cálculo I", [""]) == False{} : Bool}

# Caixa não importa.
law nome_caixa:
  {F.matchesAny("limites.pdf", ["LIMITES"]) == True{} : Bool}

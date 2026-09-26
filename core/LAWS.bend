# As leis deste projeto moram em `laws/<módulo>.bend` (uma por módulo) e as
# provas em `proofs/<módulo>.bend`. O portão é `bend PROOF.bend` (ou
# `npm run test:proof` no app), que importa todas as provas.
#
#   laws/wheel.bend     — decisão da roda do trackpad
#   laws/worklog.bend   — contrato do diário do turno
#
# Este arquivo é só o índice humano; nada de código aqui. Não é exaustivo: a
# lista completa é `ls core/laws/` (45 módulos hoje). O que entra aqui é a
# garantia que vale ler antes de mexer — e, principalmente, onde ela não
# alcança.

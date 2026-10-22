# Origem de `lib/calculator.mjs`

Cópia **byte a byte** de `desk/calculator.mjs` do repositório `learning-canvas`
(Mesa de Estudos). O arquivo original **não foi modificado** por este mod.

- origem: `desk/calculator.mjs`
- sha256 (dos dois arquivos): `2c9123b1ff687aaf16e693d3218308549eeef12fc33ac60f0ba8ce5226ca15a2`
- copiado em: 2026-10-05

Regras desta cópia:

- não editar `lib/calculator.mjs` sem antes atualizar o original em `desk/`
  (o parser é compartilhado; qualquer correção deve nascer lá);
- a cópia existe porque o mod só pode importar arquivos dentro do próprio
  plugin, e o parser não usa `eval` (seguro para o ambiente de hooks);
- para conferir a paridade: `cmp desk/calculator.mjs claude-mod/mesa-study/lib/calculator.mjs`.

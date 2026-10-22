import {doctorChecks,doctorText} from '../doctor-checks.mjs';

/* As checagens moram em `doctor-checks.mjs` (#62): o "Relatar um problema"
   reaproveita a mesma fonte. Aqui só se imprime e se sai com 1 quando algo falha. */
const {rows}=doctorChecks();
console.log(doctorText(rows));
if(rows.some(r=>!r.ok))process.exitCode=1;

// @ts-check
'use strict';

/* Hora de início do dono do ledger do `opencode serve` (revisão A1/B1/S2, F2).

   O `ps`/CIM pode falhar na subida do serve e antes o ledger ficava com
   `ownerStartTime` vazio; com o pid do dono reaproveitado, a recolha tratava o
   processo novo como "Mesa viva" para sempre. Aqui a hora sai do próprio
   relógio (`Date.now() - process.uptime()`), sem depender do `ps`.

   POSIX: formatada como `ps -o lstart` no locale C e hora local, que é o que
   `readProcessInfo` devolve. Windows: em FileTime UTC (100 ns desde 1601), que
   é o formato do CIM. A comparação tem de conviver com o erro REAL do `ps`,
   não só com a resolução de 1 s (ver `START_TIME_TOLERANCE_MS`).

   A âncora do fallback é medida UMA vez, no carregamento deste módulo, e não
   na gravação do ledger (F14). O main requer `tutor-engine-host` na subida e
   ele requer `opencode-process`, que requer este módulo: a medida acontece no
   boot, antes de qualquer suspensão possível. `Date.now()` conta o tempo de
   suspensão do sistema; `process.uptime()` (`uv_hrtime`) no Linux usa
   `CLOCK_MONOTONIC`, que NÃO conta (`man 2 clock_gettime`: "does not count
   time that the system is suspended"). Refazer a conta horas depois, com o
   note já suspenso, deslocava a hora do dono pelo tempo dormido: a recolha
   lia a Mesa viva como morta e matava o serve dela. No macOS o libuv atual
   usa `mach_continuous_time` (conta a suspensão), mas a âncora no boot também
   cobre versões com `mach_absolute_time` (que não conta). */

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/* FileTime conta unidades de 100 ns desde 1601; o CIM devolve nessa unidade. */
const WINDOWS_EPOCH_OFFSET_MS = 11644473600000;
/* Folga entre a hora GRAVADA (que pode vir do fallback sem `ps`) e a hora LIDA
   (que normalmente vem do `ps lstart`), não a mera resolução de 1 s.

   Medido numa máquina real, com o MESMO processo vivo: o `ps lstart` fica 2 s
   atrás do fallback porque o `btime` do `/proc/stat` é truncado ao segundo e a
   exibição trunca de novo (piso de até 1 s em cada etapa); o fallback arredonda
   para o segundo mais próximo (±0,5 s). Pior caso ~2,5 s. Com a folga antiga
   de 1,5 s a recolha lia a Mesa dona viva como morta e matava o serve dela.

   3 s cobre os 2,5 s com 0,5 s de margem. O custo é a janela de reuso de pid:
   um pid reciclado só passaria por "dona viva" se o processo novo tivesse
   começado a menos de 3 s do início GRAVADO do dono. Para um ledger de minutos
   ou horas atrás isso é impossível; para um ledger recém-gravado a janela é
   minúscula, e o erro cai para o lado seguro (deixar de recolher, nunca matar
   a dona). Comparar `ps` com `ps` não fecha o caso do F8: é justamente a
   gravação que veio do fallback quando o `ps` falhou. */
const START_TIME_TOLERANCE_MS = 3000;

/* Hora de parede da partida do processo, medida uma vez no boot (ver o
   comentário do topo). `bootStartMs` explícito nos testes simula a suspensão;
   `now`/`uptime` explícitos mantêm o cálculo antigo para quem injeta o
   relógio. */
const BOOT_START_MS = Date.now() - process.uptime() * 1000;

/** @param {number} ms @returns {string} */
function formatLstart(ms) {
  const date = new Date(ms);
  const day = String(date.getDate()).padStart(2, ' ');
  const time = [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map((part) => String(part).padStart(2, '0')).join(':');
  return `${DAY_NAMES[date.getDay()]} ${MONTH_NAMES[date.getMonth()]} ${day} ${time} ${date.getFullYear()}`;
}

/**
 * Hora de início deste processo sem consultar `ps`/CIM. O ledger nunca fica
 * com `ownerStartTime` vazio por uma falha de leitura: a âncora medida no
 * boot (`BOOT_START_MS`) é arredondada ao segundo e formatada como o `ps -o
 * lstart` (locale C, hora local) no POSIX, ou como FileTime UTC no Windows.
 * @param {{now?: number, uptime?: number, platform?: NodeJS.Platform, bootStartMs?: number}} [options]
 * @returns {string}
 * @example processStartTime({now: 0, uptime: 0, platform: 'win32'}) // '116444736000000000'
 */
function processStartTime({now, uptime, platform = process.platform, bootStartMs} = {}) {
  /* `bootStartMs` (a âncora do boot) vence; sem ele, `now`/`uptime` explícitos
     usam o cálculo antigo (testes e injeção de relógio) e, sem nada, vale a
     medida feita no carregamento do módulo. */
  const startMs = bootStartMs ?? (now === undefined && uptime === undefined
    ? BOOT_START_MS
    : (now ?? Date.now()) - (uptime ?? process.uptime()) * 1000);
  /* FileTime em Number perde só microssegundos (a divisão por 10000 volta aos
     milissegundos), bem dentro da folga de 1 s da comparação. */
  if (platform === 'win32') return String(Math.round((startMs + WINDOWS_EPOCH_OFFSET_MS) * 10000));
  return formatLstart(Math.round(startMs / 1000) * 1000);
}

/** @param {unknown} value @returns {number|null} */
function startTimeMs(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return null;
  if (/^\d{15,}$/.test(text)) {
    const fileTime = Number(text);
    return Number.isFinite(fileTime) ? fileTime / 10000 - WINDOWS_EPOCH_OFFSET_MS : null;
  }
  const parsed = Date.parse(text.replace(/\s+/g, ' '));
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * As duas provas de hora são do mesmo processo? A string exata vale; fora
 * disso, a diferença tolerada cobre o erro medido do `ps` contra o fallback
 * (até ~2,5 s), não só a resolução de 1 s.
 * @param {unknown} left @param {unknown} right @returns {boolean}
 * @example startTimesMatch('Wed Nov  4 15:00:00 2026', 'Wed Nov  4 15:00:02 2026') // true
 */
function startTimesMatch(left, right) {
  if (left === right) return true;
  const leftMs = startTimeMs(left);
  const rightMs = startTimeMs(right);
  return leftMs !== null && rightMs !== null && Math.abs(leftMs - rightMs) <= START_TIME_TOLERANCE_MS;
}

module.exports = {processStartTime, startTimesMatch};

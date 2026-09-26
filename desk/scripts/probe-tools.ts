/* Sonda do perfil: carrega a sessão de verdade, imprime o que foi registrado
 * (ferramenta + origem) e o conjunto ativo, e sai. Não fala com o modelo.
 *
 * O print é agendado sem `await` de propósito: bloquear o handler deixaria os
 * outros `session_start` (o portão do browser, o do context-mode) por rodar e a
 * leitura sairia de um estado intermediário — foi exatamente o que aconteceu na
 * primeira medição.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const delay = Number(process.env.PROBE_DELAY_MS || "1500");

export default function probe(pi: ExtensionAPI) {
	pi.on("session_start", async () => {
		setTimeout(() => {
			let tools: Array<{ name: string; source: unknown }> = [];
			try {
				tools = pi.getAllTools().map((t: any) => ({
					name: t.name,
					source: t.sourceInfo?.path ?? t.sourceInfo?.source ?? t.sourceInfo ?? null,
				}));
			} catch (error) {
				tools = [{ name: `ERR ${String(error)}`, source: null }];
			}
			process.stderr.write(`PROBE ${JSON.stringify({
				cwd: process.cwd(),
				activeTools: pi.getActiveTools(),
				tools,
			})}\n`);
			process.exit(0);
		}, delay);
	});
}

// Extensão geogebra carregada dos templates da Mesa. A implementação vive no
// repositório (geogebra/index.ts); o wrapper resolve o caminho real porque o
// jiti do Pi importa pelo caminho virtual do symlink learning/.pi.
import { realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = realpathSync(fileURLToPath(import.meta.url));
const target = pathToFileURL(resolve(dirname(here), '../../../../geogebra/index.ts')).href;
const mod = await import(target);
export default mod.default;

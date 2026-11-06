// @ts-check
/* Controles de leitura das Configurações (#106/#107): tamanho e largura do
   texto do chat e o tom da página escura do PDF. O markup mora aqui, e não no
   `index.html` legado (que só pode encolher), e entra antes do primeiro
   `setUiLanguage` para nascer traduzido. Quem aplica é `settings-appearance.mjs`. */

const READING_CONTROLS = `
<label><span data-i18n="settings.readingSize">Tamanho do texto do chat</span>
 <select id="reading-size">
  <option value="small" data-i18n="settings.readingSize.small">Pequeno</option>
  <option value="normal" data-i18n="settings.readingSize.normal">Normal</option>
  <option value="large" data-i18n="settings.readingSize.large">Grande</option>
  <option value="larger" data-i18n="settings.readingSize.larger">Maior</option>
 </select>
</label>
<label><span data-i18n="settings.readingWidth">Largura da coluna de leitura</span>
 <select id="reading-width">
  <option value="narrow" data-i18n="settings.readingWidth.narrow">Estreita</option>
  <option value="normal" data-i18n="settings.readingWidth.normal">Normal</option>
  <option value="wide" data-i18n="settings.readingWidth.wide">Larga</option>
 </select>
</label>
<label><span data-i18n="settings.pdfDark">Página escura do PDF</span>
 <select id="pdf-dark" aria-describedby="pdf-dark-note">
  <option value="invert" data-i18n="settings.pdfDark.invert">Inverter (padrão)</option>
  <option value="soft" data-i18n="settings.pdfDark.soft">Suave</option>
 </select>
</label>
<p class="fine" id="pdf-dark-note" data-i18n="settings.pdfDark.note">Só a exibição muda; o PDF nunca é alterado.</p>`;

/**
 * Insere os três controles de leitura logo depois da Densidade, uma vez só.
 * @param {Document} [doc]
 * @returns {boolean} true quando o markup entrou agora
 * @example mountReadingSettings()
 */
export function mountReadingSettings(doc = document) {
  const section = doc.querySelector('#settings-sec-avisos');
  const density = section?.querySelector('#density-mode')?.closest('label');
  if (!section || !density || section.querySelector('#reading-size')) return false;
  density.insertAdjacentHTML('afterend', READING_CONTROLS);
  return true;
}

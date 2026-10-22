/* Editor visual do `desk.panels` (Configurações → Leitores de PDF).

   O casco `#cfg-layout` é do host; aqui ficam o DOM e a leitura dos campos.
   O contrato (dono UI):
     mountLayoutSettings(container) — monta UMA vez, devolve o container;
     fillLayoutSettings(desk)       — reflete o desk NORMALIZADO;
     readLayoutSettings(existingDesk) — cópia do desk com `panels` lidos,
     sem mutar a original. Nada aqui toca disco/config: quem salva é o fluxo
     atual (Salvar → save-config → normalizeDesk no main).

   Regras que valem lembrar:
   - 1 ou 2 leitores: no vaivém 2→1→2 DENTRO da mesma abertura o 2º fieldset
     só é ESCONDIDO, nunca destruído — é assim que os ajustes não salvos do
     segundo sobrevivem (quem preserva é o handler do radio, não o fill);
   - `fillLayoutSettings` SEMPRE reconstrói os dois leitores a partir do desk
     recebido: sem `panels[1]` salvo, o 2º volta vazio (placeholder + nota de
     herança), nunca com sobra de edição cancelada ou de outra config;
   - `prefer` é um input por termo: uma prefer salva com vírgula
     ("Lista, parte 1") continua UM termo (nada de parsing por vírgula);
   - campo vazio passa vazio no read: o `normalizeDesk` herda o default do
     slot (label/prefer/toggle) e a UI diz isso em cada nota, sem prometer
     um vazio que o backend não suporta. */

import {t, LANGUAGE_EVENT} from './ui-text.mjs';
import {invalidValue} from './error-detail.mjs';

/* Os padrões abaixo são os valores que o `normalizeDesk` herda (`config.cjs`):
   aparecem como dado, no idioma do config, e não passam pelo catálogo. */
const DEFAULTS = [
 {label:'Enunciado',prefer:['Limites'],toggle:''},
 {label:'Formulário & apoio',prefer:['Formul'],toggle:'Formulário'},
];
const MAX_PANELS = DEFAULTS.length;
const RADIO_NAME = 'cfg-layout-count';

/* Estado do mount: um editor por vez (o host monta uma vez). */
let mounted = null;

const isObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value) => (value == null ? '' : String(value));

function requireMount(){
 if(!mounted)throw new Error('layout-settings: chame mountLayoutSettings(container) antes de fill/read');
 return mounted;
}

function make(doc, tag, attrs, kids){
 const el = doc.createElement(tag);
 if(attrs)for(const name of Object.keys(attrs)){
  const value = attrs[name];
  if(value == null || value === false)continue;
  if(name === 'value'){el.value = text(value);continue;}
  if(name === 'checked'){el.checked = !!value;continue;}
  if(name === 'hidden'){el.hidden = !!value;continue;}
  el.setAttribute(name, String(value));
 }
 if(kids)for(const kid of kids)el.append(kid);
 return el;
}

function textNode(doc, value){
 return doc.createTextNode(value);
}

function legend(doc, label){
 const el = make(doc, 'legend', {}, [textNode(doc, label)]);
 el.setAttribute('style', 'font-size:12px;font-weight:600;color:var(--muted);padding:0 4px');
 return el;
}

function emptyState(container, doc){
 return {
  container,
  doc,
  root:null,
  count:[null, null],
  panel:[null, null],
  label:[null, null],
  preferList:[null, null],
  rows:[[], []],
  toggle:null,
  previewPane:[null, null],
  previewLabel:[null, null],
  previewPrefer:[null, null],
  previewToggle:null,
  serial:[0, 0],
 };
}

/* ---------- prefer: um input por termo (vírgula não separa) ---------- */

function preferRow(m, i, value){
 const doc = m.doc;
 const n = i + 1;
 const serial = m.serial[i]++;
 const input = make(doc, 'input', {
  type:'text',
  id:`cfg-layout-prefer-${n}-${serial}`,
  class:'cfg-layout-prefer-input',
  value:text(value),
  placeholder:t('settings.layout.example', {term:DEFAULTS[i].prefer[0]}),
  'aria-label':t('settings.layout.termAria', {term:serial + 1, reader:n}),
 });
 const remove = make(doc, 'button', {
  type:'button',
  id:`cfg-layout-prefer-remove-${n}-${serial}`,
  class:'cfg-layout-prefer-remove',
  title:t('settings.layout.removeTitle'),
  'aria-label':t('settings.layout.removeAria', {term:serial + 1, reader:n}),
 }, [textNode(doc, '×')]);
 const row = make(doc, 'div', {class:'path-row cfg-layout-prefer-row'}, [input, remove]);
 remove.addEventListener('click', () => {
  row.remove?.();
  const at = m.rows[i].indexOf(input);
  if(at >= 0)m.rows[i].splice(at, 1);
  updatePreview();
 });
 m.preferList[i].append(row);
 m.rows[i].push(input);
 return input;
}

function setPrefer(m, i, terms){
 m.preferList[i].replaceChildren();
 m.rows[i] = [];
 m.serial[i] = 0;
 const list = Array.isArray(terms) ? terms : [];
 if(!list.length){preferRow(m, i, '');return;}
 for(const term of list)preferRow(m, i, term);
}

/* ---------- fieldsets ---------- */

function countFieldset(m){
 const doc = m.doc;
 const radios = [1, 2].map((n) => make(doc, 'input', {
  type:'radio',
  id:`cfg-layout-count-${n}`,
  name:RADIO_NAME,
  value:String(n),
  checked:n === 1,
 }));
 const labels = [1, 2].map((n) => make(doc, 'label', {class:'set-check', for:`cfg-layout-count-${n}`}, [
  radios[n - 1],
  make(doc, 'span', {}, [textNode(doc, t(n === 1 ? 'settings.layout.single' : 'settings.layout.double'))]),
 ]));
 m.count = radios;
 for(const radio of radios)radio.addEventListener('change', () => {
  applyCount();
  updatePreview();
 });
 return make(doc, 'fieldset', {class:'set-sec cfg-layout-readers'}, [
  legend(doc, t('settings.layout.legend')),
  ...labels,
  make(doc, 'p', {class:'fine'}, [
   textNode(doc, t('settings.layout.countNote')),
  ]),
 ]);
}

function panelFieldset(m, i){
 const doc = m.doc;
 const n = i + 1;
 const labelInput = make(doc, 'input', {
  type:'text',
  id:`cfg-layout-label-${n}`,
  class:'cfg-layout-label',
  placeholder:DEFAULTS[i].label,
 });
 const preferTitleId = `cfg-layout-prefer-title-${n}`;
 const preferList = make(doc, 'div', {class:'cfg-layout-prefer-list', id:`cfg-layout-prefer-list-${n}`});
 const add = make(doc, 'button', {
  type:'button',
  id:`cfg-layout-prefer-add-${n}`,
  class:'cfg-layout-prefer-add',
 }, [textNode(doc, t('settings.layout.addTerm'))]);
 add.addEventListener('click', () => {
  preferRow(m, i, '');
  updatePreview();
 });
 const kids = [
  legend(doc, t('settings.layout.reader', {n})),
  make(doc, 'label', {for:`cfg-layout-label-${n}`}, [textNode(doc, t('settings.layout.nameLabel'))]),
  labelInput,
  make(doc, 'p', {class:'fine', id:`cfg-layout-note-${n}`}, [
   textNode(doc, t('settings.layout.inheritNote', {default:DEFAULTS[i].label})),
  ]),
  make(doc, 'div', {class:'cfg-layout-prefer', role:'group', 'aria-labelledby':preferTitleId}, [
   make(doc, 'span', {class:'cfg-layout-prefer-title', id:preferTitleId}, [textNode(doc, t('settings.layout.termsTitle'))]),
   preferList,
   add,
   make(doc, 'p', {class:'fine', id:`cfg-layout-prefer-hint-${n}`}, [
    textNode(doc, t('settings.layout.termsHint', {default:DEFAULTS[i].prefer[0]})),
   ]),
  ]),
 ];
 if(i === 1){
  const toggleInput = make(doc, 'input', {
   type:'text',
   id:'cfg-layout-toggle-2',
   class:'cfg-layout-toggle',
   placeholder:DEFAULTS[1].toggle,
  });
  m.toggle = toggleInput;
  kids.push(
   make(doc, 'label', {for:'cfg-layout-toggle-2'}, [textNode(doc, t('settings.layout.toggleLabel'))]),
   toggleInput,
   make(doc, 'p', {class:'fine', id:'cfg-layout-toggle-hint'}, [
    textNode(doc, t('settings.layout.inheritNote', {default:DEFAULTS[1].toggle})),
   ])
  );
 }
 const fieldset = make(doc, 'fieldset', {
  class:'set-sec cfg-layout-panel',
  id:`cfg-layout-panel-${n}`,
 }, kids);
 m.panel[i] = fieldset;
 m.label[i] = labelInput;
 m.preferList[i] = preferList;
 return fieldset;
}

/* ---------- prévia ---------- */

function previewPane(m, i){
 const doc = m.doc;
 const n = i + 1;
 const label = make(doc, 'strong', {id:`cfg-layout-preview-label-${n}`});
 const prefer = make(doc, 'small', {class:'cfg-layout-preview-prefer', id:`cfg-layout-preview-prefer-${n}`});
 const pane = make(doc, 'div', {class:'cfg-layout-preview-pane', id:`cfg-layout-preview-pane-${n}`}, [label, prefer]);
 pane.setAttribute('style', 'flex:1;min-width:0;border:1px solid var(--border);border-radius:6px;padding:6px 8px;display:flex;flex-direction:column;gap:2px');
 m.previewPane[i] = pane;
 m.previewLabel[i] = label;
 m.previewPrefer[i] = prefer;
 if(i === 1){
  const chip = make(doc, 'span', {class:'cfg-layout-preview-toggle', id:'cfg-layout-preview-toggle'});
  chip.setAttribute('style', 'align-self:flex-start;border:1px solid var(--border);border-radius:4px;padding:0 6px;font-size:11px;color:var(--muted)');
  pane.append(chip);
  m.previewToggle = chip;
 }
 return pane;
}

function previewBox(m){
 const box = make(m.doc, 'div', {
  class:'cfg-layout-preview',
  id:'cfg-layout-preview',
  'aria-hidden':'true',
 }, [previewPane(m, 0), previewPane(m, 1)]);
 box.setAttribute('style', 'display:flex;gap:6px;margin:0 0 8px');
 return box;
}

/* ---------- estado visual ---------- */

/* O 2º painel só ESCONDE no 2→1: os valores digitados continuam no DOM e
   voltam no 1→2. Vale DENTRO da mesma abertura; reabrir as Configurações
   chama fill de novo, e aí o slot 2 é reconstruído do desk recebido. */
function applyCount(){
 const m = requireMount();
 const two = !!m.count[1]?.checked;
 m.panel[1].hidden = !two;
 m.previewPane[1].hidden = !two;
}

function updatePreview(){
 if(!mounted)return;
 const m = mounted;
 const two = !!m.count[1]?.checked;
 for(let i = 0;i < MAX_PANELS;i++){
  const on = i === 0 || two;
  m.previewPane[i].hidden = !on;
  if(!on)continue;
  m.previewLabel[i].textContent = text(m.label[i]?.value).trim() || DEFAULTS[i].label;
  const term = m.rows[i].map((input) => text(input.value).trim()).find(Boolean);
  m.previewPrefer[i].textContent = term || t('settings.layout.previewDefault', {term:DEFAULTS[i].prefer[0]});
 }
 if(m.previewToggle)m.previewToggle.textContent = text(m.toggle?.value).trim() || DEFAULTS[1].toggle;
}

/* ---------- contrato do host ---------- */

export function mountLayoutSettings(container){
 if(!container || typeof container.appendChild !== 'function')throw new TypeError(invalidValue('mountLayoutSettings(container)', container, 'elemento com appendChild'));
 if(mounted && mounted.container === container)return container;
 const doc = container.ownerDocument || globalThis.document;
 if(!doc || typeof doc.createElement !== 'function')throw new Error('mountLayoutSettings: documento indisponível');
 mounted?.root?.remove?.();
 const m = emptyState(container, doc);
 mounted = m;
 m.root = make(doc, 'div', {class:'cfg-layout'}, [
  countFieldset(m),
  panelFieldset(m, 0),
  panelFieldset(m, 1),
  previewBox(m),
 ]);
 container.appendChild(m.root);
 setPrefer(m, 0, []);
 setPrefer(m, 1, []);
 container.addEventListener('input', updatePreview);
 applyCount();
 updatePreview();
 return container;
}

/* Trocar o idioma refaz o editor no idioma novo, levando junto o que já foi
   digitado (a mesma ideia do 2→1→2: o não salvo não se perde). */
function relabelLayoutSettings(){
 if(!mounted)return;
 const m = mounted;
 const typed = {
  two:!!m.count[1]?.checked,
  labels:m.label.map((input) => input.value),
  prefer:m.rows.map((inputs) => inputs.map((input) => input.value)),
  toggle:m.toggle.value,
 };
 mounted = null;
 m.root.remove?.();
 mountLayoutSettings(m.container);
 const next = mounted;
 next.count[0].checked = !typed.two;
 next.count[1].checked = typed.two;
 for(let i = 0;i < MAX_PANELS;i++){
  next.label[i].value = typed.labels[i];
  setPrefer(next, i, typed.prefer[i]);
 }
 next.toggle.value = typed.toggle;
 applyCount();
 updatePreview();
}
globalThis.window?.addEventListener?.(LANGUAGE_EVENT, relabelLayoutSettings);

export function fillLayoutSettings(desk){
 const m = requireMount();
 const panels = Array.isArray(desk?.panels) ? desk.panels : [];
 m.count[0].checked = panels.length <= 1;
 m.count[1].checked = panels.length > 1;
 /* Reconstrói os DOIS leitores do zero. A preservação do não salvo no
    2→1→2 é do `applyCount` dentro da abertura; reabrir (ou trocar a fonte
    da config) chama fill de novo e deve limpar o que ficou para trás.
    Sem `panels[1]`, o slot 2 volta vazio: placeholder + nota dizem o default
    que o `normalizeDesk` herda, e o read passa vazio. */
 for(let i = 0;i < MAX_PANELS;i++){
  const saved = isObject(panels[i]) ? panels[i] : {};
  m.label[i].value = text(saved.label);
  setPrefer(m, i, Array.isArray(saved.prefer) ? saved.prefer : []);
 }
 m.toggle.value = text((isObject(panels[1]) ? panels[1] : {}).toggle);
 applyCount();
 updatePreview();
}

export function readLayoutSettings(existingDesk){
 const m = requireMount();
 const base = isObject(existingDesk) ? existingDesk : {};
 const basePanels = Array.isArray(base.panels) ? base.panels : [];
 const panels = [readPanel(m, 0, basePanels[0])];
 if(m.count[1]?.checked)panels.push(readPanel(m, 1, basePanels[1]));
 return {...base, panels};
}

function readPanel(m, i, basePanel){
 const panel = isObject(basePanel) ? {...basePanel} : {};
 panel.label = text(m.label[i].value).trim();
 panel.prefer = m.rows[i].map((input) => text(input.value).trim()).filter(Boolean);
 if(i === 1)panel.toggle = text(m.toggle.value).trim();
 else if(panel.toggle === undefined)panel.toggle = '';
 return panel;
}

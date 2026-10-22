import guideCore from './generated/guideview.core.js';
import {renderChildren,applyIcons} from './view-host.mjs';
import {icon} from '../icons.mjs';
import {t,text} from './ui-text.mjs';
import {createMascote} from './mascote.mjs';

/* Guia da Mesa (`#help-dialog`): o aplicador do núcleo `core/guideview.bend`.
   A ordem das seções e o "Próximo"/"Anterior" são do núcleo; aqui só se
   mostra uma seção por vez, se acha o que casa com a busca (texto do DOM, sem
   acento) e se leva o foco ao título da seção nova. O corpo das seções mora
   no HTML.

   Desde a #64 (docs/design/setup-guia-r1/Guia.dc.html) a busca não filtra a
   lateral: mostra numa lista só os tópicos que casam, de todas as seções, cada
   um com a seção de onde veio (o botão leva até ela). A lateral ganha ícones e
   o trio ∫ Σ ∇ (`mascote.mjs`): a ∫ lê quando há resultado e o ∇ pensa quando
   não há. */

const $ = (selector) => document.querySelector(selector);
const Nil = {$: 'Nil'};
const bendList = (xs) => xs.reduceRight((tail, head) => ({$: 'Con', head, tail}), Nil);

/* Sem acento e sem caixa: "calculo" acha "Cálculo". */
const fold = (value) => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/* Ícone de cada seção na lateral (traço de 24px, como o protótipo). */
const SECTION_ICONS = {
  comecar: 'M5 21V4m0 0h11l-2 4 2 4H5',
  tutor: 'M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z',
  leitores: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5',
  lateral: 'M3 5h18v14H3zM14 5v14',
  revisao: 'M4 7h12v13H4zM8 4h12v13',
  calc: 'M6 3h12v18H6zM9 7h6M9 12h.01M12 12h.01M15 12h.01M9 16h.01M12 16h.01M15 16h.01',
  atalhos: 'M3 7h18v10H3zM7 11h.01M11 11h.01M15 11h.01M8 14h8',
};

const state = {section: 'comecar', query: '', bound: false, trio: [], emptyMascote: null};

const root = () => $('#help-dialog');
const sections = () => [...root().querySelectorAll('section[data-section]')];
const visibleUnits = (section) => [...section.querySelectorAll('[data-search]')].filter((unit) => !unit.hidden);

/* O que casa com a busca, na ordem do guia. Seção cujo nome, título ou frase
   de abertura casa entra inteira; senão só as unidades que casam. */
function hitsOf(query) {
  const hits = [];
  for (const section of sections()) {
    const id = section.dataset.section;
    const own = fold([guideCore.guideLabel(id), guideCore.guideTitle(id), guideCore.guideLead(id)].map(text).join(' '));
    const units = visibleUnits(section);
    const matching = own.includes(query) ? units : units.filter((unit) => fold(unit.textContent).includes(query));
    for (const unit of matching) hits.push({id, unit});
  }
  return hits;
}

/* Cada achado vira uma linha da lista de leitura: título à esquerda (com a
   seção de onde veio), texto à direita. Cartão de passo e linha de atalho
   viram o mesmo formato. */
function titleAndBody(unit) {
  if (unit.matches('.guide-topic')) return [unit.querySelector('h4'), unit.querySelector('p')];
  if (unit.matches('.guide-card')) return [unit.querySelector('strong'), unit.lastElementChild];
  return [unit.querySelector('span[data-i18n]'), unit.querySelector('.guide-combo')];
}

function hitRow({id, unit}) {
  const [title, body] = titleAndBody(unit);
  const row = document.createElement('section');
  row.className = 'guide-topic guide-hit';
  const heading = document.createElement('h4');
  heading.textContent = title?.textContent.trim() || '';
  const from = document.createElement('button');
  from.type = 'button';
  from.className = 'guide-hit-section';
  from.dataset.section = id;
  from.textContent = text(guideCore.guideLabel(id));
  from.addEventListener('click', () => {
    state.query = '';
    $('#guide-search').value = '';
    go(id);
  });
  const copy = document.createElement('p');
  if (body) copy.append(...[...body.cloneNode(true).childNodes]);
  for (const el of copy.querySelectorAll('[id]')) el.removeAttribute('id');
  row.append(heading, from, copy);
  return row;
}

function paintNavIcons() {
  for (const item of root().querySelectorAll('.guide-nav-item')) {
    const path = SECTION_ICONS[item.dataset.section];
    if (!path || item.querySelector('svg')) continue;
    item.insertAdjacentHTML('afterbegin', `<svg class="guide-nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`);
  }
}

function paintSection(current) {
  for (const section of sections()) section.hidden = section.dataset.section !== current;
  $('#guide-section-title').textContent = text(guideCore.guideTitle(current));
  $('#guide-lead').textContent = text(guideCore.guideLead(current));
  $('#guide-crumb').textContent = t('guide.crumb', {section: text(guideCore.guideLabel(current))});
}

function paintSearch(hits, query) {
  for (const section of sections()) section.hidden = true;
  $('#guide-section-title').textContent = t('guide.searchTitle', {query});
  $('#guide-lead').textContent = hits.length ? t('guide.hits', {count: hits.length}) : '';
  $('#guide-crumb').textContent = t('guide.crumbSearch');
  $('#guide-results').replaceChildren(...hits.map(hitRow));
}

export function paintGuide() {
  const dialog = root();
  if (!dialog) return;
  const query = fold(state.query);
  const all = guideCore.guideVisible(bendList(sections().map((section) => section.dataset.section)));
  const current = guideCore.guideCurrent(all, state.section);
  state.section = current;
  const hits = query ? hitsOf(query) : [];
  renderChildren($('#guide-nav'), guideCore.guideNavNodes(all, query ? '' : current), guideHandlers);
  paintNavIcons();
  renderChildren($('#guide-foot'), query ? [] : guideCore.guideFoot(all, current), guideHandlers);
  if (query) paintSearch(hits, state.query.trim());
  else paintSection(current);
  const none = !!query && hits.length === 0;
  $('#guide-results').hidden = !query || none;
  $('#guide-empty').hidden = !none;
  $('#guide-lead').hidden = !$('#guide-lead').textContent;
  dialog.dataset.guideSection = query ? 'busca' : current;
  paintTrio(!!query && !none, none);
}

/* A ∫ lê junto quando a busca acha; o ∇ pensa quando não acha. */
function paintTrio(reading, none) {
  const [integral, , nabla] = state.trio;
  integral?.set({reading});
  nabla?.set({mood: none ? 'pensando' : 'normal'});
}

/* Vai para uma seção: o foco segue o título (leitor de tela e teclado
   continuam de onde a leitura começa) e a página volta ao topo. */
function go(id) {
  state.section = id;
  paintGuide();
  $('#guide-scroll').scrollTop = 0;
  $('#guide-section-title').focus({preventScroll: true});
}

const guideHandlers = {
  GuidePick: (event) => {
    const id = event.currentTarget?.dataset?.section;
    if (!id) return;
    if (state.query) {
      state.query = '';
      $('#guide-search').value = '';
    }
    go(id);
  },
};

/* As mascotes do guia são decorativas: nem acenam nem cochilam. O trio fica
   pequeno no topo da lateral; o ∇ grande só aparece na busca vazia. */
function mountMascotes() {
  state.trio = ['integral', 'sigma', 'nabla'].map((personagem) => createMascote({personagem, tamanho: 40, interativa: false}));
  $('#guide-mascote').replaceChildren(...state.trio.map((mascote) => mascote.el));
  state.emptyMascote = createMascote({personagem: 'nabla', humor: 'pensando', tamanho: 120, interativa: false});
  $('#guide-empty-mascote').replaceChildren(state.emptyMascote.el);
  root().addEventListener('mousemove', (event) => { for (const mascote of state.trio) mascote.lookAt(event); });
  root().addEventListener('mouseleave', () => { for (const mascote of state.trio) mascote.look(0, 0); });
}

function bind() {
  if (state.bound) return;
  state.bound = true;
  if ($('#guide-mascote')) mountMascotes();
  applyIcons(root().querySelector('.guide-search'), icon);
  $('#guide-search').addEventListener('input', (event) => {
    state.query = event.target.value;
    paintGuide();
  });
  /* Enter na busca não envia o formulário do diálogo. */
  $('#guide-search').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') event.preventDefault();
  });
}

/* A abertura limpa a busca e mantém a seção em que a leitura parou. */
export function openGuide() {
  if (!root()) return;
  bind();
  state.query = '';
  $('#guide-search').value = '';
  paintGuide();
}

/* Troca de idioma (#41): o corpo do guia é refeito pelo `data-i18n`; a lateral, o título e a busca são daqui. */
export function relabelGuide() {
  if (root()) paintGuide();
}

export function guideSection() {
  return state.section;
}

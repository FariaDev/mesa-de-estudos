import {
  modelList, modelId, optionSpecs, normalizeOptions, columnChoices, columnsLabel, spaceLabel, SPACE_CHOICES, MAX_OPTION_TEXT,
} from './materials/model.mjs';
import {t, text as translated} from './ui-text.mjs';

/* Seletor de modelo e opções do diálogo "Montar PDF" (ticket #39). Só desenha
   e devolve fatos: que modelos existem, que opções cada um tem, quais valores
   de colunas vale e os rótulos já vêm do núcleo (`materials/model.mjs`). Trocar
   de cartão ou de opção chama `onChange` — o diálogo repinta a prévia sem
   perguntar nada ao tutor. */

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

/* Miniaturas da folha de cada modelo: traços, não texto — a mesma família
   visual (cabeçalho com filete, rodapé com filete). */
const THUMBS = {
  lista: '<rect x="4" y="5" width="22" height="1" /><rect x="14" y="8" width="12" height="2" /><rect x="4" y="13" width="3" height="1.4" /><rect x="9" y="13" width="17" height="1" /><rect x="9" y="17" width="7" height="1" /><rect x="18" y="17" width="7" height="1" /><rect x="9" y="20" width="7" height="1" /><rect x="18" y="20" width="7" height="1" /><rect x="4" y="25" width="3" height="1.4" /><rect x="9" y="25" width="17" height="1" /><rect x="9" y="29" width="7" height="1" /><rect x="18" y="29" width="7" height="1" /><rect x="4" y="38" width="22" height="1" />',
  apostila: '<rect x="4" y="5" width="22" height="1" /><rect x="8" y="9" width="14" height="2" /><rect x="6" y="14" width="20" height="1" /><rect x="4" y="17" width="22" height="1" /><rect x="4" y="20" width="22" height="1" /><rect x="10" y="24" width="10" height="1.4" /><rect x="22" y="24" width="4" height="1" /><rect x="6" y="28" width="20" height="1" /><rect x="4" y="31" width="22" height="1" /><rect x="4" y="38" width="22" height="1" />',
  resumo: '<rect x="4" y="5" width="22" height="1" /><rect x="6" y="9" width="18" height="2" /><rect x="4" y="14" width="22" height="1" /><rect x="4" y="19" width="22" height="8" fill="none" stroke="currentColor" stroke-width=".8" /><rect x="7" y="22" width="14" height="1" /><rect x="4" y="30" width="10" height="1" /><rect x="16" y="30" width="10" height="1" /><rect x="4" y="33" width="10" height="1" /><rect x="16" y="33" width="10" height="1" />',
  simulado: '<rect x="4" y="5" width="22" height="7" fill="none" stroke="currentColor" stroke-width=".8" /><rect x="6" y="8" width="8" height="1" /><rect x="4" y="16" width="14" height="1.4" /><rect x="22" y="16" width="4" height="1" /><rect x="4" y="20" width="22" height="9" fill="none" stroke="currentColor" stroke-width=".8" /><rect x="4" y="33" width="14" height="1.4" /><rect x="4" y="37" width="22" height="1" />',
  formulario: '<rect x="8" y="5" width="14" height="2" /><rect x="4" y="11" width="22" height="1" /><rect x="4" y="15" width="10" height="1" /><rect x="16" y="15" width="10" height="1" /><rect x="4" y="19" width="10" height="1" /><rect x="16" y="19" width="10" height="1" /><rect x="4" y="25" width="22" height="1" /><rect x="4" y="29" width="10" height="1" /><rect x="16" y="29" width="10" height="1" /><rect x="4" y="33" width="10" height="1" /><rect x="16" y="33" width="10" height="1" />',
  livre: '<rect x="8" y="7" width="14" height="2" /><rect x="4" y="13" width="22" height="1" /><rect x="4" y="17" width="22" height="1" /><rect x="4" y="21" width="22" height="1" /><rect x="4" y="25" width="16" height="1" /><rect x="4" y="31" width="22" height="1" />',
};

function thumbnail(id) {
  const holder = el('span', 'pdf-model-thumb');
  holder.setAttribute('aria-hidden', 'true');
  holder.innerHTML = `<svg viewBox="0 0 30 42" focusable="false"><rect class="pdf-model-sheet" x=".5" y=".5" width="29" height="41" rx="2" fill="none" /><g fill="currentColor">${THUMBS[id] || THUMBS.livre}</g></svg>`;
  return holder;
}

export function createModelPanel({strip, optionsBox, onChange}) {
  let model = 'livre';
  const kept = new Map();
  let autoCount = 0;
  const cards = new Map();

  const autoLabel = () => (autoCount > 0 ? columnsLabel('auto', autoCount) : 'Auto');

  const currentOptions = () => normalizeOptions(model, kept.get(model));

  const emit = (kind) => onChange?.({kind, model, options: currentOptions()});

  function paintCards() {
    for (const [id, card] of cards) {
      const on = id === model;
      card.setAttribute('aria-checked', String(on));
      card.tabIndex = on ? 0 : -1;
    }
  }

  function select(id, {silent = false, focus = false} = {}) {
    const next = modelId(id);
    if (next === model && !silent) return;
    model = next;
    paintCards();
    paintOptions();
    if (focus) cards.get(model)?.focus();
    if (!silent) emit('model');
  }

  function buildStrip() {
    strip.replaceChildren();
    strip.setAttribute('role', 'radiogroup');
    for (const entry of modelList()) {
      const card = el('button', 'pdf-model-card');
      card.type = 'button';
      card.dataset.model = entry.id;
      card.setAttribute('role', 'radio');
      card.setAttribute('aria-checked', 'false');
      card.title = `${translated(entry.label)} — ${translated(entry.blurb)}`;
      const text = el('span', 'pdf-model-text');
      text.append(el('span', 'pdf-model-name', translated(entry.label)), el('span', 'pdf-model-blurb', translated(entry.blurb)));
      card.append(thumbnail(entry.id), text);
      card.addEventListener('click', () => select(entry.id));
      cards.set(entry.id, card);
      strip.append(card);
    }
    strip.addEventListener('keydown', (event) => {
      const keys = {ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1};
      if (!(event.key in keys)) return;
      event.preventDefault();
      const ids = [...cards.keys()];
      const at = ids.indexOf(model);
      select(ids[(at + keys[event.key] + ids.length) % ids.length], {focus: true});
    });
  }

  function setOption(key, value) {
    kept.set(model, {...currentOptions(), [key]: value});
    paintOptions();
    emit('option');
  }

  function segmented(label, values, current, labelOf, key) {
    const row = el('div', 'pdf-opt');
    const caption = el('span', 'pdf-opt-label', label);
    const group = el('div', 'pdf-seg');
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', label);
    for (const value of values) {
      const button = el('button', '', labelOf(value));
      button.type = 'button';
      button.dataset.value = value;
      button.setAttribute('aria-pressed', String(value === current));
      button.addEventListener('click', () => setOption(key, value));
      group.append(button);
    }
    row.append(caption, group);
    return row;
  }

  function paintOptions() {
    optionsBox.replaceChildren();
    const {specs} = optionSpecs(model);
    const options = currentOptions();
    optionsBox.dataset.model = model;
    if (!specs.length) {
      optionsBox.append(el('p', 'fine', t('material.noOptions')));
      return;
    }
    for (const spec of specs) {
      if (spec.kind === 'columns') {
        optionsBox.append(segmented(translated(spec.label), columnChoices(model), options[spec.key], (value) => (
          value === 'auto' ? autoLabel() : value
        ), spec.key));
      } else if (spec.kind === 'space') {
        optionsBox.append(segmented(translated(spec.label), SPACE_CHOICES, options[spec.key], (value) => translated(spaceLabel(value)), spec.key));
      } else if (spec.kind === 'flag') {
        const label = el('label', 'pdf-opt pdf-opt-flag');
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = options[spec.key] === true;
        input.dataset.key = spec.key;
        input.addEventListener('change', () => setOption(spec.key, input.checked));
        label.append(input, el('span', '', translated(spec.label)));
        optionsBox.append(label);
      } else {
        const label = el('label', 'pdf-opt pdf-opt-text');
        const input = document.createElement('input');
        input.type = 'text';
        input.maxLength = MAX_OPTION_TEXT;
        input.value = options[spec.key] || '';
        input.dataset.key = spec.key;
        input.addEventListener('input', () => {
          kept.set(model, {...currentOptions(), [spec.key]: input.value});
          emit('option');
        });
        label.append(el('span', 'pdf-opt-label', translated(spec.label)), input);
        optionsBox.append(label);
      }
    }
  }

  buildStrip();
  paintCards();
  paintOptions();

  return {
    /* Chamado ao abrir o diálogo: define o modelo e as opções sem avisar. */
    set(id, options) {
      kept.clear();
      const next = modelId(id);
      kept.set(next, normalizeOptions(next, options));
      autoCount = 0;
      select(next, {silent: true});
    },
    get() {
      return {model, options: currentOptions()};
    },
    /* Colunas que o "Auto" achou na última medição (o rótulo vira "Auto · 3"). */
    setAuto(count) {
      const next = Math.max(0, Math.trunc(Number(count) || 0));
      if (next === autoCount) return;
      autoCount = next;
      const button = optionsBox.querySelector('.pdf-seg button[data-value="auto"]');
      if (button) button.textContent = autoLabel();
    },
  };
}

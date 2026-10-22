// @ts-check
/* A marcação da primeira abertura em tela cheia (#64). Mora aqui, e não no
   index.html, porque o index.html tem teto de linhas que só cai
   (tests/file-size.test.mjs). O `main.mjs` monta isto antes do primeiro
   `setUiLanguage`, então os `data-i18n` são traduzidos como o resto do HTML
   estático; a pintura do que muda é do `setup-view.mjs`. */

const SETUP_MARKUP = `
  <div class="setup-bar">
    <span class="setup-brand"><img class="brand-icon" src="assets/app-icon/mesa-blue.svg" alt="">Mesa de Estudos</span>
    <nav class="setup-bar-actions" aria-label="Idioma e ajuda" data-i18n-attr="aria-label=setup.barAria">
      <!-- Idioma (#41): "Português · English", nos dois idiomas de propósito — quem não lê o idioma de agora ainda acha o seu. -->
      <div id="first-run-language" class="first-run-language" role="group" aria-label="Idioma / Language"><button type="button" data-language="pt-BR" aria-pressed="true">Português</button><span aria-hidden="true">·</span><button type="button" data-language="en" aria-pressed="false">English</button></div>
      <span class="setup-bar-sep" aria-hidden="true"></span>
      <button type="button" id="setup-free" class="setup-quiet" title="Abre a aba Livre, sem criar matéria agora" data-i18n="setup.free" data-i18n-attr="title=setup.freeTitle">Estudar sem matéria</button>
      <button type="button" id="first-run-help" class="first-run-help" data-i18n="firstrun.helpLabel">Como a Mesa funciona</button>
    </nav>
  </div>
  <div class="setup-stage" id="setup-stage">
    <div class="setup-mascot">
      <p class="setup-speech" id="setup-speech" aria-live="polite"></p>
      <div class="setup-mascote" id="setup-mascote"></div>
    </div>
    <section class="setup-card" id="setup-card">
      <ol class="setup-trail" id="setup-trail" aria-label="Passos" data-i18n-attr="aria-label=setup.trailAria"></ol>

      <div class="setup-step" data-step="welcome">
        <h1 data-i18n="setup.welcome.title">Boas-vindas à Mesa de Estudos.</h1>
        <p class="setup-lead" data-i18n="guide.lead.comecar">A Mesa mostra o material e o tutor. A resolução fica com você: no Xournal++, em outro programa de escrita ou no caderno de papel.</p>
        <p class="setup-lead" data-i18n="setup.welcome.time">São dois minutos: um passeio rápido pela Mesa e três itens para montar a sua primeira matéria.</p>
        <div class="setup-language">
          <span class="setup-label" data-i18n="setup.language.title">Idioma da Mesa</span>
          <div id="setup-language" role="radiogroup" aria-label="Idioma / Language">
            <button type="button" role="radio" data-language="pt-BR" aria-checked="true"><strong>Português</strong><span data-i18n="setup.language.ptNote">do Brasil</span></button>
            <button type="button" role="radio" data-language="en" aria-checked="false"><strong>English</strong><span data-i18n="setup.language.enNote">dá para trocar depois</span></button>
          </div>
        </div>
        <!-- Cor de acento (#70): vale na hora, como nas Configurações. -->
        <div id="setup-accent" class="setup-accent" role="radiogroup" aria-label="Cor de acento" data-i18n-attr="aria-label=settings.accent">
          <span class="setup-label" data-i18n="settings.accent">Cor de acento</span>
          <div class="accent-options"></div>
        </div>
        <div class="setup-cards setup-cards-3">
          <div><strong data-i18n="setup.promise.material.title">Material</strong><span data-i18n="setup.promise.material.body">Seus PDFs abertos de onde estão, sem copiar.</span></div>
          <div><strong data-i18n="setup.promise.writing.title">Escrita</strong><span data-i18n="setup.promise.writing.body">No programa que você já usa, ou no papel.</span></div>
          <div><strong data-i18n="setup.promise.tutor.title">Tutor</strong><span data-i18n="setup.promise.tutor.body">Roda no seu computador e lê os seus PDFs.</span></div>
        </div>
      </div>

      <div class="setup-step" data-step="tour">
        <div class="setup-demo" aria-hidden="true">
          <div class="demo-desk">
            <div class="demo-region demo-top" data-region="top">
              <span class="demo-tab demo-tab-on" data-i18n="setup.demo.course">Cálculo I</span>
              <span class="demo-tab" data-i18n="free.tab">Livre</span>
              <span class="demo-tab">GeoGebra</span>
              <span class="demo-fill"></span>
              <span class="demo-menu"><span data-i18n="chrome.study">Estudar</span> ▾</span>
              <span class="demo-dot"></span>
            </div>
            <div class="demo-body">
              <div class="demo-region demo-readers" data-region="readers">
                <div class="demo-reader"><span class="demo-reader-name" data-i18n="setup.demo.statement">Enunciado</span><div class="demo-page"><span class="demo-page-title" data-i18n="setup.demo.sheet">Lista 2 — Limites</span><i style="width:90%"></i><i style="width:75%"></i><i style="width:85%"></i><span class="demo-formula">lim (x²−1)/(x−1)</span><i style="width:70%"></i><i style="width:80%"></i></div></div>
                <div class="demo-reader"><span class="demo-reader-name" data-i18n="setup.demo.formulas">Formulário</span><div class="demo-page"><span class="demo-page-title" data-i18n="setup.demo.formulas">Formulário</span><i style="width:90%"></i><i style="width:75%"></i><i style="width:85%"></i><span class="demo-formula">a²−b² = (a+b)(a−b)</span><i style="width:70%"></i><i style="width:80%"></i></div></div>
              </div>
              <div class="demo-region demo-tutor" data-region="tutor">
                <span class="demo-tutor-head" data-i18n="setup.demo.tutor">Tutor · Sonnet · médio</span>
                <span class="demo-ask" data-i18n="setup.demo.ask">Travei no item b.</span>
                <span class="demo-answer" data-i18n-html="setup.demo.answer">Olhe a p. 3 do <em>Limites.pdf</em>: o limite lateral…</span>
                <span class="demo-fill"></span>
                <div class="demo-composer"><span data-i18n="setup.demo.composer">Escreva ao tutor…</span><div><span class="demo-chip" data-i18n="setup.demo.check">Conferir Xournal++</span><span class="demo-chip" data-i18n="setup.demo.photo">Foto</span></div></div>
              </div>
            </div>
          </div>
          <div class="demo-region demo-writer" data-region="writer">
            <span class="demo-writer-bar"><i></i><i></i><i></i>&nbsp;<span data-i18n="setup.demo.writer">Xournal++ ou outro</span></span>
            <svg viewBox="0 0 170 210" aria-hidden="true"><text x="14" y="34">b) lim (x²−1)/(x−1)</text><text x="22" y="62">= lim (x+1)(x−1)</text><path d="M30 68h96" stroke="#1a1033" stroke-width="1.2"/><text x="70" y="86">x−1</text><text x="22" y="116">= 2  ?</text><path class="demo-ink" d="M18 128q20-6 40 0t40 0" fill="none" stroke-width="2" stroke-linecap="round" opacity=".7"/><path d="M120 150l22 -34" stroke="#e8862a" stroke-width="6" stroke-linecap="round"/><path d="M120 150l-2 5" stroke="#1a1033" stroke-width="2.5" stroke-linecap="round"/></svg>
          </div>
        </div>
        <div class="setup-tour-head"><span class="setup-tour-num" id="setup-tour-num">1</span><h1 id="setup-tour-title"></h1></div>
        <p class="setup-tour-text" id="setup-tour-text"></p>
        <ul class="setup-tour-extras" id="setup-tour-extras"></ul>
      </div>

      <div class="setup-step" data-step="name">
        <span class="setup-kicker" data-i18n="setup.kicker.name">Lista 0 · item 1 de 3</span>
        <h1 data-i18n="setup.name.title">Dê um nome à matéria.</h1>
        <p class="setup-lead setup-lead-sm" data-i18n="setup.name.lead">Cada matéria é uma aba no topo da Mesa, com os PDFs, as sessões com o tutor e o caderno de revisão dela. Dá para criar outras depois, com ⌘ T.</p>
        <label for="first-run-name" class="setup-label" data-i18n="firstrun.nameLabel">Nome da matéria</label>
        <input id="first-run-name" type="text" maxlength="120" autocomplete="off" spellcheck="false" placeholder="Nome da matéria, ex.: Cálculo I" data-i18n-attr="placeholder=firstrun.namePlaceholder">
        <div class="setup-examples" id="setup-examples">
          <span data-i18n="setup.name.examples">Exemplos:</span>
          <button type="button" data-i18n="setup.name.example1">Cálculo I</button>
          <button type="button" data-i18n="setup.name.example2">Física II</button>
          <button type="button" data-i18n="setup.name.example3">Álgebra Linear</button>
          <button type="button" data-i18n="setup.name.example4">Química Geral</button>
        </div>
      </div>

      <div class="setup-step" data-step="folder">
        <span class="setup-kicker" data-i18n="setup.kicker.folder">Lista 0 · item 2 de 3</span>
        <h1 id="setup-folder-title"></h1>
        <p class="setup-lead setup-lead-sm" data-i18n="setup.folder.lead">Diga onde estão os PDFs dela, ou arraste os arquivos para o quadro abaixo. Vale soltar em qualquer ponto desta tela. A Mesa abre os arquivos de onde eles estão, sem copiar.</p>
        <button type="button" id="first-run-pick" class="setup-drop">
          <span class="setup-drop-icon" data-icon="download" aria-hidden="true"></span>
          <strong id="setup-drop-title"></strong>
          <small id="setup-drop-help"></small>
        </button>
        <div class="setup-chosen" id="setup-chosen" hidden>
          <span id="setup-chosen-folder"></span>
          <small id="setup-chosen-files"></small>
          <button type="button" id="setup-folder-remove" class="setup-link setup-folder-remove" data-i18n="setup.folder.remove">Tirar esta pasta</button>
        </div>
        <p class="setup-elsewhere" id="setup-elsewhere" role="status" hidden></p>
      </div>

      <div class="setup-step" data-step="tutor">
        <span class="setup-kicker" data-i18n="setup.kicker.tutor">Lista 0 · item 3 de 3 · opcional</span>
        <h1 id="setup-tutor-title"></h1>
        <p class="setup-lead setup-lead-sm" id="setup-tutor-text"></p>
        <div class="setup-tutor-off" id="setup-tutor-off">
          <span class="setup-pi" id="setup-pi"></span>
          <div class="setup-tutor-actions" id="setup-tutor-actions"></div>
        </div>
        <div class="setup-cards setup-cards-2">
          <div><strong data-i18n="setup.tutor.card1.title">Chama sozinho</strong><span data-i18n="setup.tutor.card1.body">A Mesa conecta o tutor ao abrir e ao trocar de matéria.</span></div>
          <div><strong data-i18n="setup.tutor.card2.title">Vê o que você vê</strong><span data-i18n="setup.tutor.card2.body">A matéria, a questão ativa, o rascunho .xopp e os PDFs abertos com a página.</span></div>
          <div><strong data-i18n="setup.tutor.card3.title">Nada sai sozinho</strong><span data-i18n="setup.tutor.card3.body">Capturas e fotos vão para a bandeja; só seguem quando você envia.</span></div>
          <div><strong data-i18n="setup.tutor.card4.title">Modelo e esforço</strong><span data-i18n="setup.tutor.card4.body">Ficam no cabeçalho do tutor, por exemplo Sonnet · médio.</span></div>
        </div>
      </div>

      <div class="setup-step" data-step="ready">
        <span class="setup-kicker" data-i18n="setup.kicker.ready">Lista 0 · feita</span>
        <h1 id="setup-ready-title"></h1>
        <dl class="setup-summary" id="setup-summary"></dl>
        <p class="setup-data" id="setup-data"></p>
        <div class="setup-shortcuts">
          <span class="setup-label" data-i18n="setup.shortcuts">Para ter à mão</span>
          <div>
            <span class="setup-shortcut"><kbd>⌘</kbd><kbd>/</kbd><span data-i18n="guide.title">Guia da Mesa</span></span>
            <span class="setup-shortcut"><kbd>⌘</kbd><kbd>K</kbd><span data-i18n="guide.atalhos.row.command-palette">Busca de comandos</span></span>
            <span class="setup-shortcut"><kbd>⌘</kbd><kbd>⇧</kbd><kbd>C</kbd><span data-i18n="guide.atalhos.row.check">Anexar a captura do Xournal++</span></span>
            <span class="setup-shortcut"><kbd>⌘</kbd><kbd>T</kbd><span data-i18n="guide.atalhos.row.new-course">Nova matéria (Configurações)</span></span>
          </div>
        </div>
      </div>

      <div class="setup-foot">
        <button type="button" id="setup-back" data-i18n="setup.back">Voltar</button>
        <div class="setup-dots" id="setup-dots" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
        <span class="setup-hint" id="setup-hint"></span>
        <button type="button" id="setup-skip-tour" class="setup-quiet" data-i18n="setup.skipTour">Pular a explicação</button>
        <button type="button" id="setup-next" class="primary"></button>
      </div>
    </section>
  </div>
`;

/**
 * Põe os passos dentro de `#setup` (a casca vazia do index.html). Idempotente.
 * @param {Document} [doc]
 * @example mountSetupMarkup() // #setup ganha a barra, o palco do trio e o cartão
 */
export function mountSetupMarkup(doc = document) {
  const setup = doc.querySelector('#setup');
  if (!setup || setup.childElementCount) return;
  setup.innerHTML = SETUP_MARKUP;
}

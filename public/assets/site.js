(() => {
  const menuButton = document.querySelector('.menu-button');
  const primaryNav = document.querySelector('#primary-nav');

  if (menuButton && primaryNav) {
    menuButton.addEventListener('click', () => {
      const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
      menuButton.setAttribute('aria-expanded', String(!isOpen));
      primaryNav.dataset.open = String(!isOpen);
    });

    primaryNav.addEventListener('click', (event) => {
      if (event.target instanceof HTMLAnchorElement) {
        menuButton.setAttribute('aria-expanded', 'false');
        primaryNav.dataset.open = 'false';
      }
    });
  }

  const cards = [...document.querySelectorAll('[data-guide-card]')];
  const search = document.querySelector('#guide-search');
  const modelFilter = document.querySelector('#model-filter');
  const topicFilter = document.querySelector('#topic-filter');
  const clearButton = document.querySelector('#clear-filters');
  const count = document.querySelector('#guide-count');
  const emptyState = document.querySelector('#empty-state');

  if (!cards.length || !(search instanceof HTMLInputElement)) return;
  if (!(modelFilter instanceof HTMLSelectElement) || !(topicFilter instanceof HTMLSelectElement)) return;

  const normalize = (value) => value.trim().toLocaleLowerCase('en-US');
  // 2026-11-26: the library is grouped by model; a group (and its jump link) hides when none of its guides match.
  // Every word of the query must appear, so "display xt2515" and "xt2515 display" both work.
  const groups = [...document.querySelectorAll('[data-model-group]')];
  const jumps = [...document.querySelectorAll('[data-jump]')];
  // A guide's search text is its model group's text (name, XT code) plus its own topic text.
  const groupOf = (card) => card.closest('[data-model-group]');
  const modelOf = (card) => card.getAttribute('data-model') || groupOf(card)?.getAttribute('data-model-group') || '';
  const searchText = new Map(cards.map((card) => [card, `${groupOf(card)?.getAttribute('data-search') || ''} ${card.getAttribute('data-search') || ''}`]));
  const cardModel = new Map(cards.map((card) => [card, modelOf(card)]));

  const update = () => {
    const query = normalize(search.value);
    const words = query.split(/\s+/).filter(Boolean);
    const model = modelFilter.value;
    const topic = topicFilter.value;
    let visible = 0;
    const shown = new Set();

    for (const card of cards) {
      const searchable = searchText.get(card);
      const matchesQuery = words.every((word) => searchable.includes(word));
      const matchesModel = !model || cardModel.get(card) === model;
      const matchesTopic = !topic || card.getAttribute('data-topic') === topic;
      const matches = matchesQuery && matchesModel && matchesTopic;
      if (card.hidden === matches) card.hidden = !matches;
      if (matches) {
        visible += 1;
        shown.add(cardModel.get(card));
      }
    }
    for (const group of groups) {
      const hide = !shown.has(group.getAttribute('data-model-group'));
      if (group.hidden !== hide) group.hidden = hide;
    }
    for (const jump of jumps) {
      const hide = !shown.has(jump.getAttribute('data-jump'));
      if (jump.hidden !== hide) jump.hidden = hide;
    }

    if (count) {
      count.textContent = visible === cards.length
        ? `Showing all ${cards.length} guides`
        : `Showing ${visible} of ${cards.length} guides`;
    }
    if (emptyState) emptyState.hidden = visible !== 0;

    const url = new URL(window.location.href);
    if (query) url.searchParams.set('q', search.value.trim());
    else url.searchParams.delete('q');
    if (model) url.searchParams.set('model', model);
    else url.searchParams.delete('model');
    if (topic) url.searchParams.set('topic', topic);
    else url.searchParams.delete('topic');
    window.history.replaceState({}, '', url);
  };

  const params = new URLSearchParams(window.location.search);
  search.value = params.get('q') || '';
  if ([...modelFilter.options].some((option) => option.value === params.get('model'))) {
    modelFilter.value = params.get('model') || '';
  }
  if ([...topicFilter.options].some((option) => option.value === params.get('topic'))) {
    topicFilter.value = params.get('topic') || '';
  }

  search.addEventListener('input', update);
  modelFilter.addEventListener('change', update);
  topicFilter.addEventListener('change', update);
  clearButton?.addEventListener('click', () => {
    search.value = '';
    modelFilter.value = '';
    topicFilter.value = '';
    update();
    search.focus();
  });

  update();
})();

// XT code lookup (2026-11-09): filters the model table on /xt-code/. The table works without JavaScript.
(() => {
  const input = document.querySelector('#xt-search');
  const rows = [...document.querySelectorAll('[data-xt-row]')];
  const count = document.querySelector('#xt-count');
  const empty = document.querySelector('#xt-empty');
  if (!(input instanceof HTMLInputElement) || !rows.length) return;
  const normalize = (value) => {
    const compact = value.trim().toLowerCase().replace(/\s+/g, '');
    return /^xt\d{4}/.test(compact) ? compact.slice(0, 6) : compact;
  };
  const update = () => {
    const query = normalize(input.value);
    let visible = 0;
    for (const row of rows) {
      const matches = !query || (row.getAttribute('data-search') || '').includes(query);
      row.hidden = !matches;
      if (matches) visible += 1;
    }
    if (count) count.textContent = visible === rows.length ? `Showing all ${rows.length} model records` : `Showing ${visible} of ${rows.length} model records`;
    if (empty) empty.hidden = visible !== 0;
  };
  const params = new URLSearchParams(window.location.search);
  if (params.get('xt')) input.value = params.get('xt');
  input.addEventListener('input', update);
  update();
})();

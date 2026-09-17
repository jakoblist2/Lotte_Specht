(() => {
  const $ = (id) => document.getElementById(id);
  const el = (tag, text, className) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node; };

  function card(item) {
    const article = el('article', undefined, 'presskit-card');
    const preview = el('div', undefined, 'presskit-preview');
    const img = el('img'); img.src = item.src; img.alt = item.title; img.loading = 'lazy';
    preview.append(img);
    article.append(preview, el('h3', item.title));
    if (item.credit) article.append(el('p', item.credit));
    const link = el('a', 'Herunterladen ↓');
    link.href = item.src; link.download = '';
    article.append(link);
    return article;
  }

  function render(id, items) {
    const root = $(id);
    root.replaceChildren();
    if (!items.length) { root.append(el('div', 'Aktuell nichts hinterlegt.', 'empty-state')); return; }
    items.forEach(item => root.append(card(item)));
  }

  async function init() {
    let items = [];
    try { items = await (await fetch('/api/presskit')).json(); } catch {}
    if (!Array.isArray(items)) items = [];
    render('presskit-logos', items.filter(item => item.category === 'logo'));
    render('presskit-fotos', items.filter(item => item.category === 'foto'));
  }
  init();
})();

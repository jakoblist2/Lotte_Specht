(() => {
  const $ = (id) => document.getElementById(id);
  const el = (tag, text, className) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node; };
  const FRANKFURT_BOUNDS = { latMin: 50.03, latMax: 50.18, lngMin: 8.55, lngMax: 8.80 };

  function renderMatches(items) {
    const list = $('matches-list');
    let activeFilter = 'alle';
    function draw() {
      list.replaceChildren();
      const now = Date.now();
      const visible = items
        .filter(item => activeFilter === 'alle' || item.gender === activeFilter)
        .filter(item => !item.date || new Date(item.date).getTime() > now - 3 * 60 * 60 * 1000)
        .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      if (!visible.length) { list.append(el('div', 'Aktuell sind keine Spiele eingetragen.', 'empty-state')); return; }
      visible.forEach(item => {
        const card = el('article', undefined, 'match-card');
        card.append(el('time', item.date ? new Date(item.date).toLocaleString('de-DE', {dateStyle: 'medium', timeStyle: 'short'}) : 'Termin folgt'));
        const league = el('span', item.gender === 'frauen' ? 'Frauen-Bundesliga' : 'Männer-Bundesliga', 'match-league');
        card.append(league);
        card.append(el('h3', item.team_home + ' – ' + item.team_away));
        const meta = [item.competition, item.broadcaster].filter(Boolean).join(' · ');
        if (meta) card.append(el('p', meta));
        if (item.notes) card.append(el('p', item.notes));
        list.append(card);
      });
    }
    document.querySelectorAll('.filter-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        activeFilter = chip.dataset.filter;
        document.querySelectorAll('.filter-chip').forEach(c => c.setAttribute('aria-pressed', String(c === chip)));
        draw();
      });
    });
    draw();
  }

  function renderVenueList(venues) {
    const list = $('venue-list');
    list.replaceChildren();
    if (!venues.length) { list.append(el('div', 'Noch keine Orte eingetragen.', 'empty-state')); return; }
    venues.forEach((venue, index) => {
      const card = el('article', undefined, 'venue-card');
      card.id = 'venue-' + venue.id;
      const heading = el('h3'); heading.append(el('span', String(index + 1), 'venue-index'), document.createTextNode(' ' + venue.name));
      card.append(heading);
      if (venue.address) card.append(el('p', venue.address));
      if (venue.womensFootball) card.append(el('p', 'Zeigt regelmäßig Frauenfußball', 'venue-tag'));
      if (venue.notes) card.append(el('p', venue.notes));
      if (venue.url) { const link = el('a', 'Mehr erfahren ↗'); link.href = venue.url; link.target = '_blank'; link.rel = 'noopener'; card.append(link); }
      const mapsLink = el('a', 'In Google Maps öffnen ↗');
      mapsLink.href = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(venue.lat + ',' + venue.lng);
      mapsLink.target = '_blank'; mapsLink.rel = 'noopener';
      card.append(mapsLink);
      list.append(card);
    });
  }

  function project(venue) {
    const x = ((venue.lng - FRANKFURT_BOUNDS.lngMin) / (FRANKFURT_BOUNDS.lngMax - FRANKFURT_BOUNDS.lngMin)) * 100;
    const y = 100 - ((venue.lat - FRANKFURT_BOUNDS.latMin) / (FRANKFURT_BOUNDS.latMax - FRANKFURT_BOUNDS.latMin)) * 100;
    return { x: Math.min(96, Math.max(4, x)), y: Math.min(94, Math.max(6, y)) };
  }

  function renderOfflineMap(root, venues) {
    root.replaceChildren();
    root.classList.add('venue-map-offline');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('aria-hidden', 'true');
    const river = document.createElementNS(svg.namespaceURI, 'path');
    river.setAttribute('d', 'M -5 62 C 25 55, 45 68, 65 58 S 95 45, 108 50');
    river.setAttribute('class', 'venue-map-river');
    svg.append(river);
    root.append(svg);
    const label = el('p', root.dataset.fallbackLabel || 'Schematische Karte', 'venue-map-caption');
    root.append(label);
    venues.forEach((venue, index) => {
      const { x, y } = project(venue);
      const pin = el('button', String(index + 1), 'venue-pin');
      pin.type = 'button';
      pin.style.left = x + '%'; pin.style.top = y + '%';
      pin.title = venue.name;
      pin.addEventListener('click', () => document.getElementById('venue-' + venue.id)?.scrollIntoView({behavior: 'smooth', block: 'center'}));
      root.append(pin);
    });
  }

  function loadLeaflet() {
    return new Promise((resolve, reject) => {
      if (window.L) { resolve(window.L); return; }
      const css = document.createElement('link');
      css.rel = 'stylesheet'; css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.append(css);
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => resolve(window.L);
      script.onerror = () => reject(new Error('Leaflet nicht verfügbar'));
      document.head.append(script);
      window.setTimeout(() => reject(new Error('Zeitüberschreitung beim Laden der Karte')), 4000);
    });
  }

  async function renderMap(venues) {
    const root = $('venue-map');
    if (!venues.length) { renderOfflineMap(root, venues); return; }
    try {
      const L = await loadLeaflet();
      root.replaceChildren();
      const map = L.map(root, {scrollWheelZoom: false}).setView([50.1109, 8.6821], 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap-Mitwirkende', maxZoom: 18
      }).addTo(map);
      venues.forEach((venue, index) => {
        L.circleMarker([venue.lat, venue.lng], {radius: 9, color: '#e3062c', fillColor: '#e3062c', fillOpacity: 1, weight: 2})
          .addTo(map)
          .bindPopup('<strong>' + (index + 1) + '. ' + venue.name.replace(/</g, '&lt;') + '</strong>' + (venue.address ? '<br>' + venue.address.replace(/</g, '&lt;') : ''));
      });
    } catch {
      renderOfflineMap(root, venues);
    }
  }

  async function init() {
    let matches = [], venues = [];
    try { matches = await (await fetch('/api/matches')).json(); } catch {}
    try { venues = await (await fetch('/api/venues')).json(); } catch {}
    renderMatches(Array.isArray(matches) ? matches : []);
    renderVenueList(Array.isArray(venues) ? venues : []);
    renderMap(Array.isArray(venues) ? venues : []);
  }
  init();
})();

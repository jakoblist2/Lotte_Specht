(() => {
  const $ = (id) => document.getElementById(id);
  const el = (tag, text, className) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node; };
  const FRANKFURT_BOUNDS = { latMin: 50.03, latMax: 50.18, lngMin: 8.55, lngMax: 8.80 };

  function renderMatches(items) {
    const list = $('matches-list');
    const calendarRoot = $('match-calendar');
    const dayStrip = $('match-day-strip');
    const monthLabel = $('match-month-label');
    let activeFilter = 'alle';
    let activeView = 'list';
    let activeDay = null;
    const now = Date.now();
    const upcoming = items.filter(i => i.date && new Date(i.date).getTime() > now).sort((a, b) => a.date.localeCompare(b.date));
    const startRef = upcoming.length ? new Date(upcoming[0].date) : new Date();
    let monthCursor = new Date(startRef.getFullYear(), startRef.getMonth(), 1);

    const dateKey = (y, m, d) => y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    const itemDay = (item) => item.date ? item.date.slice(0, 10) : null;
    const formatMatchDate = (date) => date.includes('T')
      ? new Date(date).toLocaleString('de-DE', {dateStyle: 'medium', timeStyle: 'short'})
      : new Date(date + 'T00:00').toLocaleDateString('de-DE', {dateStyle: 'medium'}) + ', Uhrzeit folgt';

    function drawList() {
      list.replaceChildren();
      const visible = items
        .filter(item => activeFilter === 'alle' || item.gender === activeFilter)
        .filter(item => activeView === 'calendar' || !item.date || new Date(item.date).getTime() > now - 3 * 60 * 60 * 1000)
        .filter(item => !activeDay || itemDay(item) === activeDay)
        .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      if (!visible.length) { list.append(el('div', activeDay ? 'An diesem Tag ist kein Spiel eingetragen.' : 'Aktuell sind keine Spiele eingetragen.', 'empty-state')); return; }
      visible.forEach(item => {
        const card = el('article', undefined, 'match-card');
        card.append(el('time', item.date ? formatMatchDate(item.date) : 'Termin folgt'));
        const league = el('span', item.gender === 'frauen' ? 'Frauen-Bundesliga' : 'Männer-Bundesliga', 'match-league');
        card.append(league);
        card.append(el('h3', item.team_home + ' – ' + item.team_away));
        const meta = [item.competition, item.broadcaster].filter(Boolean).join(' · ');
        if (meta) card.append(el('p', meta));
        if (item.notes) card.append(el('p', item.notes));
        list.append(card);
      });
    }

    function drawDayStrip() {
      dayStrip.replaceChildren();
      monthLabel.textContent = monthCursor.toLocaleDateString('de-DE', {month: 'long', year: 'numeric'});
      const byDay = new Map();
      items.forEach(item => {
        if (activeFilter !== 'alle' && item.gender !== activeFilter) return;
        const day = itemDay(item);
        if (!day) return;
        if (!byDay.has(day)) byDay.set(day, []);
        byDay.get(day).push(item);
      });
      const daysInMonth = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0).getDate();
      const today = new Date();
      const todayKey = dateKey(today.getFullYear(), today.getMonth(), today.getDate());
      let activeCell = null;
      for (let day = 1; day <= daysInMonth; day += 1) {
        const key = dateKey(monthCursor.getFullYear(), monthCursor.getMonth(), day);
        const hasMatch = byDay.has(key);
        const cellDate = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), day);
        const cell = el('button', undefined, 'match-day' + (key === todayKey ? ' match-day-today' : '') + (key === activeDay ? ' match-day-active' : '') + (hasMatch ? ' match-day-has-match' : ''));
        cell.type = 'button';
        cell.setAttribute('aria-pressed', String(key === activeDay));
        cell.append(el('span', cellDate.toLocaleDateString('de-DE', {weekday: 'short'}), 'match-day-weekday'));
        cell.append(el('span', String(day), 'match-day-num'));
        if (hasMatch) cell.append(el('span', '', 'match-day-dot'));
        cell.addEventListener('click', () => {
          activeDay = activeDay === key ? null : key;
          drawDayStrip();
          drawList();
        });
        if (key === activeDay) activeCell = cell;
        dayStrip.append(cell);
      }
      if (activeCell) activeCell.scrollIntoView({behavior: 'smooth', inline: 'center', block: 'nearest'});
    }

    function setView(view) {
      activeView = view;
      document.querySelectorAll('.spielplan-view-toggle .filter-chip').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
      calendarRoot.hidden = view !== 'calendar';
      if (view !== 'calendar') activeDay = null;
      drawDayStrip();
      drawList();
    }

    document.querySelectorAll('.spielplan-filter > .filter-chip[data-filter]').forEach(chip => {
      chip.addEventListener('click', () => {
        activeFilter = chip.dataset.filter;
        document.querySelectorAll('.spielplan-filter > .filter-chip[data-filter]').forEach(c => c.setAttribute('aria-pressed', String(c === chip)));
        drawDayStrip();
        drawList();
      });
    });
    document.querySelectorAll('.spielplan-view-toggle .filter-chip').forEach(btn => btn.addEventListener('click', () => setView(btn.dataset.view)));
    $('match-month-prev').addEventListener('click', () => { monthCursor.setMonth(monthCursor.getMonth() - 1); drawDayStrip(); });
    $('match-month-next').addEventListener('click', () => { monthCursor.setMonth(monthCursor.getMonth() + 1); drawDayStrip(); });

    drawDayStrip();
    drawList();
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

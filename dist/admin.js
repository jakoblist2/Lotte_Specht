(() => {
  const $ = (id) => document.getElementById(id);
  const area = document.body.dataset.area;
  let csrf = '', dirty = false, currentPage, mediaTarget;
  const status = (message) => { $('status').textContent = message; };
  async function api(path, data) {
    const response = await fetch(path, data === undefined ? {} : {method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(data)});
    if (!(response.headers.get('content-type') || '').includes('application/json')) throw new Error('Bitte den Redaktionsserver starten: python3 server/cms.py. Anschließend http://127.0.0.1:8766/login.html öffnen.');
    const result = await response.json();
    if (!response.ok) {
      if (response.status === 401 && area !== 'login') location.href = 'login.html';
      throw new Error(result.error || 'Die Anfrage konnte nicht gespeichert werden.');
    }
    return result;
  }
  function action(fn) { return async (event) => { if (event) event.preventDefault(); try { await fn(event); } catch(error) { status(error.message); } }; }
  function el(tag, text, className) { const node=document.createElement(tag); if(text!==undefined)node.textContent=text;if(className)node.className=className;return node; }
  function button(text, fn, className='secondary') { const node=el('button',text,className);node.type='button';node.addEventListener('click',action(fn));return node; }
  function markDirty() { dirty=true; if($('page-state'))$('page-state').textContent='Ungespeichert'; }
  window.addEventListener('beforeunload',(event)=>{if(dirty){event.preventDefault();event.returnValue='';}});
  document.querySelectorAll('[data-close]').forEach(node=>node.addEventListener('click',()=>node.closest('dialog').close()));
  document.querySelectorAll('.admin-sidebar nav a').forEach(node=>{if(node.getAttribute('href')===area+'.html')node.setAttribute('aria-current','page');});
  async function login(session) {
    if(session.authenticated){location.replace('studio.html');return;}
    const setup=session.setup;
    $('login-form').hidden=false;
    $('login-title').textContent=setup?'Team-Zugang einrichten':'Anmelden';
    $('login-submit').textContent=setup?'Zugang einrichten →':'Anmelden →';
    $('confirm-label').hidden=!setup;
    $('login-form').elements.password.minLength=setup?12:1;
    $('login-form').elements.password.autocomplete=setup?'new-password':'current-password';
    if(setup)status('Lege ein gemeinsames Team-Passwort mit mindestens 12 Zeichen fest. Dieser Zugang gilt für die lokale Redaktion.');
    $('login-form').addEventListener('submit',action(async()=>{
      const form=$('login-form');const password=form.elements.password.value;
      if(setup && password!==form.elements.confirm.value)throw new Error('Die Passwörter stimmen nicht überein.');
      $('login-submit').disabled=true;
      try {await api(setup?'/api/setup':'/api/login',{password});location.href='studio.html';} finally {$('login-submit').disabled=false;}
    }));
  }
  const corePages=new Set();
  async function listPages(selected) {
    const pages=await api('/api/pages');$('page-select').replaceChildren();corePages.clear();
    pages.forEach(page=>{const option=el('option',page.title.split(' — ')[0]+(page.draft?' · Entwurf':''));option.value=page.name;$('page-select').append(option);if(page.core)corePages.add(page.name);});
    if(selected)$('page-select').value=selected;
  }
  async function loadPage(name) {
    currentPage=await api('/api/page?page='+encodeURIComponent(name));
    $('page-title').value=currentPage.title;$('page-fields').replaceChildren();
    currentPage.fields.forEach(field=>{
      if(field.kind==='text'){
        const label=el('label',field.label==='P'?'Text':field.label.startsWith('H')?'Überschrift '+field.label.slice(1):field.label);
        const input=el('textarea');input.value=field.value;input.rows=field.label==='P'?4:2;
        input.addEventListener('input',()=>{field.value=input.value;markDirty();});label.append(input);$('page-fields').append(label);
      }else{
        const box=el('div',undefined,'image-field');const image=el('img');image.src=field.value;image.alt=field.alt;
        const choose=button('Bild ersetzen',async()=>{mediaTarget={field,image};await showMedia();});
        const label=el('label','Bildbeschreibung');const alt=el('input');alt.value=field.alt;
        alt.addEventListener('input',()=>{field.alt=alt.value;image.alt=alt.value;markDirty();});label.append(alt);
        box.append(image,choose,label);$('page-fields').append(box);
      }
    });
    $('page-preview').src='/api/preview?page='+encodeURIComponent(name)+'#inhalt';
    $('open-public').href=name;$('page-state').textContent='Gespeichert';dirty=false;
    if($('delete-page'))$('delete-page').hidden=corePages.has(name);
    const history=await api('/api/history?page='+encodeURIComponent(name));$('page-history').replaceChildren();
    if(!history.length)$('page-history').append(el('p','Noch keine vorherige Veröffentlichung.','muted'));
    history.forEach((version,index)=>$('page-history').append(button(version.updated || 'Ausgangsversion',async()=>{
      if(dirty&&!confirm('Ungespeicherte Änderungen verwerfen?'))return;
      await api('/api/restore',{name,index});await loadPage(name);status('Version als Entwurf wiederhergestellt. Zum Übernehmen veröffentlichen.');
    })));
  }
  async function savePage() {
    currentPage.title=$('page-title').value;
    await api('/api/save',currentPage);dirty=false;
    $('page-state').textContent='Entwurf gespeichert';
    $('page-preview').src='/api/preview?page='+encodeURIComponent(currentPage.name)+'&v='+Date.now()+'#inhalt';
    await listPages(currentPage.name);status('Entwurf gespeichert. Die veröffentlichte Seite bleibt unverändert.');
  }
  async function showMedia() {
    const assets=await api('/api/media');$('media-grid').replaceChildren();
    assets.forEach(asset=>{
      const item=button('',()=>{mediaTarget.field.value=asset.src;mediaTarget.image.src=asset.src;markDirty();$('media-dialog').close();});
      const img=el('img');img.src=asset.src;img.alt='';img.loading='lazy';item.append(img,el('span',asset.name));$('media-grid').append(item);
    });
    if(!$('media-dialog').open)$('media-dialog').showModal();
  }
  async function editor() {
    await listPages();await loadPage($('page-select').value);
    $('page-title').addEventListener('input',markDirty);
    $('page-select').addEventListener('change',action(async()=>{
      const target=$('page-select').value;
      if(dirty&&!confirm('Ungespeicherte Änderungen verwerfen?')){$('page-select').value=currentPage.name;return;}
      await loadPage(target);status('');
    }));
    $('save-page').addEventListener('click',action(savePage));
    $('publish-page').addEventListener('click',action(async()=>{
      if(!confirm('Diese Seite jetzt auf der lokalen Website veröffentlichen?'))return;
      await savePage();await api('/api/publish',{name:currentPage.name});await listPages(currentPage.name);await loadPage(currentPage.name);status('Veröffentlicht. Die aktuelle Seite ist jetzt auf der Website sichtbar.');
    }));
    let slugEdited=false;
    const slugify=(text)=>text.toLocaleLowerCase('de').replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60);
    $('new-page').addEventListener('click',()=>{slugEdited=false;$('new-page-form').reset();$('new-page-dialog').showModal();});
    $('new-page-form').elements.title.addEventListener('input',(event)=>{if(!slugEdited)$('new-page-form').elements.slug.value=slugify(event.target.value);});
    $('new-page-form').elements.slug.addEventListener('input',()=>{slugEdited=true;});
    $('new-page-form').addEventListener('submit',action(async()=>{
      if(dirty&&!confirm('Ungespeicherte Änderungen verwerfen?'))return;
      const values=Object.fromEntries(new FormData($('new-page-form')));
      const page=await api('/api/new-page',values);$('new-page-dialog').close();$('new-page-form').reset();await listPages(page.name);await loadPage(page.name);status('Neue Seite als Entwurf angelegt.');
    }));
    $('delete-page').addEventListener('click',action(async()=>{
      if(!confirm('Seite „'+currentPage.title.split(' — ')[0]+'“ endgültig löschen? Das kann nicht rückgängig gemacht werden.'))return;
      await api('/api/delete-page',{name:currentPage.name});dirty=false;await listPages();await loadPage($('page-select').value);status('Seite gelöscht.');
    }));
    $('preview-mobile').addEventListener('click',()=>$('page-preview').classList.add('mobile'));
    $('preview-desktop').addEventListener('click',()=>$('page-preview').classList.remove('mobile'));
    bindMediaUpload();
  }
  function bindMediaUpload() {
    $('media-upload').addEventListener('change',action(async()=>{
      const file=$('media-upload').files[0];if(!file)return;
      if(file.size>8*1024*1024)throw new Error('Bitte ein Bild unter 8 MB wählen.');
      const encoded=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=()=>reject(new Error('Bild konnte nicht gelesen werden.'));reader.readAsDataURL(file);});
      await api('/api/upload',{data:encoded});$('media-upload').value='';await showMedia();status('Bild hochgeladen. Wähle es aus und ergänze die Bildbeschreibung.');
    }));
  }
  async function mountCollection({path, formId, listId, searchId, fields, sortKey, matchesTerm, card, onEdit}) {
    let items = await api(path);
    const form = $(formId);
    function draw() {
      const term = $(searchId).value.toLocaleLowerCase('de');
      $(listId).replaceChildren();
      const visible = items.filter(item => matchesTerm(item, term)).sort((a, b) => String(a[sortKey] || '').localeCompare(String(b[sortKey] || '')));
      if (!visible.length) $(listId).append(el('p', items.length ? 'Keine passenden Einträge.' : 'Noch keine Einträge. Lege links den ersten an.', 'empty-state'));
      visible.forEach(item => {
        const article = card(item);
        const actions = el('div', undefined, 'dialog-actions');
        actions.append(button('Bearbeiten', () => {
          if (dirty && !confirm('Ungespeicherte Änderungen verwerfen?')) return;
          fields.forEach(key => { const target = form.elements[key]; if (!target) return; if (target.type === 'checkbox') target.checked = !!item[key]; else target.value = item[key] ?? ''; });
          if (onEdit) onEdit(item);
          dirty = false; const first = form.elements[fields[1]]; if (first) first.focus();
        }), button('Entfernen', async () => {
          if (!confirm('Eintrag entfernen?')) return;
          const updated = items.filter(x => x.id !== item.id);
          await api(path, {items: updated}); items = updated; draw(); status('Eintrag entfernt.');
        }, 'text-button'));
        article.append(actions); $(listId).append(article);
      });
    }
    form.addEventListener('input', () => { dirty = true; });
    form.addEventListener('reset', () => { dirty = false; });
    form.addEventListener('submit', action(async () => {
      const raw = Object.fromEntries(new FormData(form));
      fields.forEach(key => { const target = form.elements[key]; if (target && target.type === 'checkbox') raw[key] = target.checked; });
      raw.id = raw.id || crypto.randomUUID();
      const updated = items.filter(x => x.id !== raw.id).concat(raw);
      await api(path, {items: updated}); items = updated; form.reset(); dirty = false; draw(); status('Eintrag gespeichert.');
    }));
    $(searchId).addEventListener('input', draw);
    draw();
  }
  async function pressKit() {
    const form = $('presskit-form');
    const preview = $('presskit-preview');
    bindMediaUpload();
    $('presskit-choose').addEventListener('click', action(async () => {
      mediaTarget = {field: form.elements.src, image: preview};
      preview.hidden = false;
      await showMedia();
    }));
    form.addEventListener('submit', (event) => {
      if (!form.elements.src.value) {
        event.preventDefault(); event.stopImmediatePropagation();
        status('Bitte zuerst eine Datei wählen.');
      }
    });
    form.addEventListener('reset', () => { preview.hidden = true; preview.src = ''; });
    await mountCollection({
      path: '/api/presskit', formId: 'presskit-form', listId: 'presskit-list', searchId: 'presskit-search',
      fields: ['id', 'category', 'title', 'src', 'credit'],
      sortKey: 'title',
      matchesTerm: (item, term) => [item.title, item.credit].join(' ').toLocaleLowerCase('de').includes(term),
      onEdit: (item) => { preview.src = item.src; preview.hidden = false; },
      card: (item) => {
        const article = el('article', undefined, 'collection-item');
        const thumb = el('img'); thumb.src = item.src; thumb.alt = ''; thumb.style.maxHeight = '90px'; thumb.style.marginBottom = '12px'; thumb.style.background = 'white';
        article.append(thumb, el('h2', item.title), el('p', item.category === 'logo' ? 'Logo' : 'Foto'));
        if (item.credit) article.append(el('p', item.credit));
        return article;
      }
    });
  }
  async function spielplan() {
    await mountCollection({
      path: '/api/matches', formId: 'match-form', listId: 'match-list', searchId: 'match-search',
      fields: ['id', 'gender', 'competition', 'team_home', 'team_away', 'date', 'broadcaster', 'notes'],
      sortKey: 'date',
      matchesTerm: (item, term) => [item.team_home, item.team_away, item.competition, item.notes].join(' ').toLocaleLowerCase('de').includes(term),
      card: (item) => {
        const article = el('article', undefined, 'collection-item');
        article.append(el('time', item.date ? new Date(item.date).toLocaleString('de-DE', {dateStyle: 'medium', timeStyle: 'short'}) : 'Ohne Datum'));
        article.append(el('h2', item.team_home + ' – ' + item.team_away));
        const meta = [item.gender === 'frauen' ? 'Frauen' : 'Männer', item.competition, item.broadcaster].filter(Boolean).join(' · ');
        if (meta) article.append(el('p', meta));
        if (item.notes) article.append(el('p', item.notes));
        return article;
      }
    });
    await mountCollection({
      path: '/api/venues', formId: 'venue-form', listId: 'venue-list', searchId: 'venue-search',
      fields: ['id', 'name', 'address', 'lat', 'lng', 'womensFootball', 'notes', 'url'],
      sortKey: 'name',
      matchesTerm: (item, term) => [item.name, item.address, item.notes].join(' ').toLocaleLowerCase('de').includes(term),
      card: (item) => {
        const article = el('article', undefined, 'collection-item');
        article.append(el('h2', item.name));
        if (item.address) article.append(el('p', item.address));
        article.append(el('p', item.womensFootball ? 'Zeigt Frauenfußball' : 'Öffentliches Public Viewing'));
        if (item.notes) article.append(el('p', item.notes));
        if (item.url) { const link = el('a', 'Link öffnen ↗'); link.href = item.url; link.target = '_blank'; link.rel = 'noopener'; article.append(link); }
        return article;
      }
    });
    $('locate-venue').addEventListener('click', action(async () => {
      const form = $('venue-form'); const address = form.elements.address.value.trim();
      if (!address) throw new Error('Bitte zuerst eine Adresse eingeben.');
      let response;
      try { response = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(address + ', Frankfurt am Main')); }
      catch { throw new Error('Keine Internetverbindung. Bitte Koordinaten von Hand eintragen.'); }
      const results = await response.json();
      if (!results.length) throw new Error('Adresse nicht gefunden. Bitte Koordinaten von Hand eintragen.');
      form.elements.lat.value = results[0].lat; form.elements.lng.value = results[0].lon;
      status('Koordinaten gefunden.');
    }));
  }
  async function collection() {
    const path='/api/calendar';let items=await api(path);const form=$('collection-form');
    function draw() {
      const term=$('collection-search').value.toLocaleLowerCase('de');$('collection-list').replaceChildren();
      const visible=items.filter(item=>(item.title+' '+item.notes).toLocaleLowerCase('de').includes(term)).sort((a,b)=>a.date.localeCompare(b.date));
      if(!visible.length)$('collection-list').append(el('p',items.length?'Keine passenden Einträge.':'Noch keine Einträge. Lege links den ersten an.','empty-state'));
      visible.forEach(item=>{
        const card=el('article',undefined,'collection-item');
        const time=el('time',item.date?new Date(item.date).toLocaleString('de-DE',area==='kalender'?{dateStyle:'medium',timeStyle:'short'}:{dateStyle:'medium'}):'Ohne Datum');
        card.append(time,el('h2',item.title),el('p',item.notes));
        if(item.url){if(/^https?:\/\//.test(item.url)){const link=el('a','Material / Link öffnen ↗');link.href=item.url;link.target='_blank';link.rel='noopener';card.append(link);}else card.append(el('p',item.url));}
        const actions=el('div',undefined,'dialog-actions');
        actions.append(button('Bearbeiten',()=>{if(dirty&&!confirm('Ungespeicherte Änderungen verwerfen?'))return;for(const key of ['id','title','date','notes','url'])form.elements[key].value=item[key]||'';dirty=false;form.elements.title.focus();}),button('Entfernen',async()=>{
          if(!confirm('Eintrag entfernen?'))return;
          const updated=items.filter(x=>x.id!==item.id);await api(path,{items:updated});items=updated;draw();status('Eintrag entfernt.');
        },'text-button'));card.append(actions);$('collection-list').append(card);
      });
    }
    form.addEventListener('input',()=>{dirty=true;});form.addEventListener('reset',()=>{dirty=false;});
    form.addEventListener('submit',action(async()=>{
      const item=Object.fromEntries(new FormData(form));item.id=item.id||crypto.randomUUID();
      const updated=items.filter(x=>x.id!==item.id).concat(item);await api(path,{items:updated});items=updated;form.reset();dirty=false;draw();status('Eintrag gespeichert.');
    }));
    $('collection-search').addEventListener('input',draw);draw();
  }
  action(async()=>{
    if(location.protocol==='file:')throw new Error('Für den Login und das Speichern bitte den Redaktionsserver starten: python3 server/cms.py. Danach http://127.0.0.1:8766/login.html öffnen.');
    const session=await api('/api/session');csrf=session.csrf||'';
    if(area==='login'){await login(session);return;}
    if(!session.authenticated){location.replace('login.html');return;}
    $('workspace').hidden=false;
    $('logout').addEventListener('click',action(async()=>{if(dirty&&!confirm('Ungespeicherte Änderungen verwerfen und abmelden?'))return;await api('/api/logout',{});dirty=false;location.href='login.html';}));
    if(area==='website')await editor();
    if(area==='kalender')await collection();
    if(area==='presse-material')await pressKit();
    if(area==='spielplan')await spielplan();
  })();
})();

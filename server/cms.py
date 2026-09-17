"""Local editorial server. Run: python3 server/cms.py (binds only to loopback)."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlsplit, parse_qs, unquote
from http.cookies import SimpleCookie
import base64, contextlib, hashlib, hmac, html, io, json, mimetypes, os, re, secrets, sqlite3, time

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / 'dist'
DATA = Path(os.environ.get('LOTTE_CMS_DATA', str(ROOT / '.cms')))
DATA.mkdir(exist_ok=True)
DB = DATA / 'editor.sqlite3'
PUBLIC = ['index.html','lotte-specht.html','wir.html','was-wir-tun.html','efc.html','wo-laeuft.html','presse.html','kontakt.html']
INTERNAL = ['styleguide.html','spielplan.html','presse-material.html']
PUBLIC_GET = {'/api/matches','/api/venues','/api/presskit'}
MEDIA_EXCLUDED_DIRS = {'film-sequence','intro-sequence','scroll-sequence'}
# Ships as the starting content for the public press kit; editable/replaceable via presse-material.html.
# Only applies until someone actually saves there — real edits are stored in the database and take over.
DEFAULT_PRESSKIT = [
    {'id':'logo-quer','category':'logo','title':'Vereinslogo (quer)','src':'assets/presskit/logo-quer.png','credit':''},
    {'id':'logo-rund','category':'logo','title':'Vereinslogo (rund)','src':'assets/presskit/logo-rund.png','credit':''},
    {'id':'illu-specht','category':'logo','title':'Illustration „Lotte Specht“','src':'assets/presskit/lotte-specht-illustration.svg','credit':'Illustration: Lotte Specht e.V.'},
    {'id':'illu-schiesst','category':'logo','title':'Illustration „Lotte schießt“','src':'assets/presskit/lotte-schiesst-illustration.svg','credit':'Illustration: Lotte Specht e.V.'},
    {'id':'illu-schiesst-ohne-typo','category':'logo','title':'Illustration „Lotte schießt“ (ohne Schriftzug)','src':'assets/presskit/lotte-schiesst-ohne-typo.svg','credit':'Illustration: Lotte Specht e.V.'},
    {'id':'illu-original','category':'logo','title':'Original-Zeichnung „Schuss“','src':'assets/presskit/lotte-originalzeichnung-schuss.svg','credit':'Illustration: Lotte Specht e.V.'},
    {'id':'foto-team','category':'foto','title':'Teamfoto (Platzhalter)','src':'assets/10-city-team.jpg','credit':'Platzhalter – wird durch echtes Foto ersetzt'},
    {'id':'foto-training','category':'foto','title':'Training (Platzhalter)','src':'assets/07-gallus-start.jpg','credit':'Platzhalter – wird durch echtes Foto ersetzt'},
    {'id':'foto-stadion','category':'foto','title':'Im Stadion (Platzhalter)','src':'assets/11-tunnel.jpg','credit':'Platzhalter – wird durch echtes Foto ersetzt'},
]
SESSIONS = {}
ATTEMPTS = {}
# Dev convenience only: LOTTE_CMS_OPEN=1 skips the login while building the site.
# Unset (or leave unset) before going live so the real login/session flow applies again.
OPEN_MODE = os.environ.get('LOTTE_CMS_OPEN') == '1'
DEV_SESSION = {'expires': time.time() + 10**10, 'csrf': 'dev-mode'} if OPEN_MODE else None

@contextlib.contextmanager
def db():
    con = sqlite3.connect(DB)
    con.execute('CREATE TABLE IF NOT EXISTS docs (key TEXT PRIMARY KEY, value TEXT NOT NULL)')
    try:
        yield con
        con.commit()
    except Exception:
        con.rollback()
        raise
    finally:
        con.close()

def get(key, fallback=None):
    with db() as c: row = c.execute('SELECT value FROM docs WHERE key=?',(key,)).fetchone()
    return json.loads(row[0]) if row else fallback

def put(key, value):
    with db() as c: c.execute('INSERT OR REPLACE INTO docs VALUES (?,?)',(key,json.dumps(value,ensure_ascii=False)))

def base_page(name):
    if name in PUBLIC: return (DIST/name).read_text()
    return get('template:'+name)

FIELD = re.compile(r'<(h[1-3]|p|figcaption)\b([^>]*)>(.*?)</\1>',re.S|re.I)
IMG = re.compile(r'<img\b[^>]*>',re.I)

def attrs(tag):
    return dict(re.findall(r'([\w-]+)=[\"\']([^\"\']*)[\"\']',tag))

def model(name):
    source = base_page(name)
    if source is None: raise ValueError('Seite nicht gefunden.')
    main = re.search(r'<main\b[^>]*>(.*?)</main>',source,re.S).group(1)
    fields = []
    for i,m in enumerate(FIELD.finditer(main)):
        # Preserve links and complex components: edit plain text and line breaks only.
        if re.search(r'<(?!br\s*/?>)',m[3],re.I): continue
        text = html.unescape(re.sub(r'<br\s*/?>','\n',m[3],flags=re.I)).strip()
        if not text: continue
        fields.append({'id':f't{i}','kind':'text','label':m[1].upper(),'value':text})
    for i,m in enumerate(IMG.finditer(main)):
        a=attrs(m[0])
        if a.get('id') in ('sequence-frame','intro-frame'): continue
        fields.append({'id':f'i{i}','kind':'image','label':a.get('alt') or 'Bild','value':a.get('src',''),'alt':a.get('alt','')})
    title=html.unescape(re.search(r'<title>(.*?)</title>',source,re.S)[1])
    return {'name':name,'title':title,'fields':fields}

def page_doc(name, draft=False):
    return get(('draft:' if draft else 'published:')+name) or get('published:'+name) or model(name)

def render_page(name, draft=False):
    source=base_page(name)
    data=page_doc(name,draft)
    fields={f['id']:f for f in data['fields']}
    source=re.sub(r'<title>.*?</title>',lambda _: '<title>'+html.escape(data['title'])+'</title>',source,flags=re.S)
    main=re.search(r'<main\b[^>]*>(.*?)</main>',source,re.S)
    text=main[1]
    count=[-1]
    def replace_text(m):
        count[0]+=1; f=fields.get('t'+str(count[0]))
        if not f: return m[0]
        return '<'+m[1]+m[2]+'>'+html.escape(f['value']).replace('\n','<br />')+'</'+m[1]+'>'
    text=FIELD.sub(replace_text,text)
    count[0]=-1
    def replace_image(m):
        count[0]+=1; f=fields.get('i'+str(count[0]))
        if not f: return m[0]
        tag=m[0]
        for key,value in [('src',f['value']),('alt',f.get('alt',''))]:
            safe=html.escape(value,quote=True)
            if re.search(r'\b'+key+r'=[\"\']',tag): tag=re.sub(r'\b'+key+r'=[\"\'][^\"\']*[\"\']',lambda _:key+'="'+safe+'"',tag)
            else: tag=tag[:-1]+' '+key+'="'+safe+'">'
        return tag
    text=IMG.sub(replace_image,text)
    source=source[:main.start(1)]+text+source[main.end(1):]
    # Published new pages become discoverable in the public navigation.
    links=''.join('<a href="'+n+'">'+html.escape(page_doc(n)['title'].split(' — ')[0])+'</a>' for n in get('pages',[]) if get('published:'+n))
    source=source.replace('<div class="menu-internal">',links+'<div class="menu-internal">')
    return source

def valid_doc(name, data):
    original=model(name)
    if not isinstance(data.get('title'),str) or not 1<=len(data['title'].strip())<=180: raise ValueError('Bitte einen Seitentitel eingeben (max. 180 Zeichen).')
    incoming={f['id']:f for f in data.get('fields',[])}
    for f in original['fields']:
        value=incoming.get(f['id'],{}).get('value')
        if not isinstance(value,str) or len(value)>20000: raise ValueError('Ungültiger Inhalt.')
        if f['kind']=='image':
            if not re.fullmatch(r'assets/[\w/.-]+',value) or '..' in value: raise ValueError('Bitte ein Bild aus der Mediathek wählen.')
            if not (DIST/value).is_file(): raise ValueError('Bild nicht gefunden.')
            f['alt']=str(incoming[f['id']].get('alt',''))[:500]
            if not f['alt'].strip(): raise ValueError('Bitte eine Bildbeschreibung ergänzen.')
        f['value']=value
    original['title']=data['title'].strip()
    original['updated']=time.strftime('%Y-%m-%d %H:%M')
    return original

class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*a,**kw): super().__init__(*a,directory=str(DIST),**kw)
    def log_message(self,format,*args): pass
    def end_headers(self):
        self.send_header('X-Content-Type-Options','nosniff')
        self.send_header('X-Frame-Options','SAMEORIGIN')
        self.send_header('Referrer-Policy','same-origin')
        self.send_header('Cache-Control','no-store')
        super().end_headers()
    def respond(self,data,status=200,ctype='application/json; charset=utf-8',cookie=None):
        body=json.dumps(data,ensure_ascii=False).encode() if isinstance(data,(dict,list)) else data.encode() if isinstance(data,str) else data
        self.send_response(status);self.send_header('Content-Type',ctype);self.send_header('Content-Length',str(len(body)))
        if cookie:self.send_header('Set-Cookie',cookie)
        self.end_headers();self.wfile.write(body)
    def session(self):
        try:
            c=SimpleCookie(self.headers.get('Cookie',''));token=c['lotte_session'].value
            item=SESSIONS.get(token)
            if item and item['expires']>time.time():return item
        except (KeyError,ValueError):pass
        return DEV_SESSION
    def allowed_host(self):
        return self.headers.get('Host') in ('127.0.0.1:'+str(self.server.server_port),'localhost:'+str(self.server.server_port))
    def do_GET(self):
        if not self.allowed_host():return self.respond({'error':'Ungültiger Host.'},403)
        path=unquote(urlsplit(self.path).path);query=parse_qs(urlsplit(self.path).query)
        if path=='/api/session':return self.respond({'authenticated':bool(self.session()),'setup':not bool(get('admin')),'csrf':self.session()['csrf'] if self.session() else None})
        if path.startswith('/api/'):
            if path not in PUBLIC_GET and not self.session():return self.respond({'error':'Bitte anmelden.'},401)
            try:
                name=query.get('page',['index.html'])[0]
                if path=='/api/pages':return self.respond([{'name':n,'title':page_doc(n,True)['title'],'draft':bool(get('draft:'+n)),'published':n in PUBLIC or bool(get('published:'+n)),'core':n in PUBLIC} for n in PUBLIC+get('pages',[])])
                if path=='/api/page':return self.respond(page_doc(name,True))
                if path=='/api/preview':return self.respond(render_page(name,True).replace('<head>', '<head><base href="/">', 1),ctype='text/html; charset=utf-8')
                if path=='/api/history':return self.respond(get('history:'+name,[]))
                if path=='/api/media':return self.respond([{'src':str(p.relative_to(DIST)),'name':p.name} for p in (DIST/'assets').rglob('*') if p.is_file() and p.suffix.lower() in ('.jpg','.png','.webp','.svg') and MEDIA_EXCLUDED_DIRS.isdisjoint(p.relative_to(DIST).parts)])
                if path=='/api/presskit':return self.respond(get(path,DEFAULT_PRESSKIT))
                if path in ('/api/calendar','/api/matches','/api/venues'):return self.respond(get(path,[]))
                return self.respond({'error':'Nicht gefunden.'},404)
            except (ValueError,TypeError,AttributeError):return self.respond({'error':'Seite nicht gefunden.'},404)
        name=path.lstrip('/') or 'index.html'
        if name in INTERNAL + ['studio.html','website.html','kalender.html'] and not self.session():
            self.send_response(302);self.send_header('Location','/login.html');self.end_headers();return
        if name in PUBLIC or name in get('pages',[]):
            if name not in PUBLIC and not get('published:'+name):return self.respond('Nicht veröffentlicht',404,'text/plain')
            return self.respond(render_page(name),ctype='text/html; charset=utf-8')
        # No directory listings or access outside the distribution.
        target=(DIST/name).resolve()
        if not target.is_relative_to(DIST.resolve()) or not target.is_file():return self.respond('Nicht gefunden',404,'text/plain')
        return super().do_GET()
    def do_POST(self):
        if not self.allowed_host():return self.respond({'error':'Ungültiger Host.'},403)
        origin=self.headers.get('Origin')
        if origin and origin!='http://'+self.headers.get('Host',''):return self.respond({'error':'Ungültiger Ursprung.'},403)
        if self.headers.get('Content-Type','').split(';')[0]!='application/json':return self.respond({'error':'JSON erforderlich.'},415)
        try:
            size=int(self.headers.get('Content-Length','0'))
            if size>12000000:raise ValueError('Datei zu groß. Maximal 8 MB.')
            data=json.loads(self.rfile.read(size)); path=urlsplit(self.path).path
            if path in ('/api/setup','/api/login'):
                failures=ATTEMPTS.get(self.client_address[0],[])
                failures=[t for t in failures if t>time.time()-300]
                if len(failures)>=10:return self.respond({'error':'Bitte in fünf Minuten erneut versuchen.'},429)
                password=str(data.get('password',''));admin=get('admin')
                if path=='/api/setup':
                    if admin:raise ValueError('Zugang bereits eingerichtet.')
                    if len(password)<12:raise ValueError('Bitte mindestens 12 Zeichen verwenden.')
                    salt=secrets.token_hex(16);digest=hashlib.scrypt(password.encode(),salt=salt.encode(),n=16384,r=8,p=1).hex()
                    put('admin',{'salt':salt,'hash':digest})
                else:
                    digest=hashlib.scrypt(password.encode(),salt=(admin or {}).get('salt','invalid').encode(),n=16384,r=8,p=1).hex()
                    if not admin or not hmac.compare_digest(digest,admin['hash']):
                        ATTEMPTS[self.client_address[0]]=failures+[time.time()]
                        return self.respond({'error':'Passwort nicht korrekt.'},401)
                token=secrets.token_urlsafe(32);csrf=secrets.token_urlsafe(32)
                SESSIONS[token]={'expires':time.time()+8*3600,'csrf':csrf}
                return self.respond({'ok':True,'csrf':csrf},cookie='lotte_session='+token+'; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800')
            session=self.session()
            if not session:return self.respond({'error':'Bitte anmelden.'},401)
            if not hmac.compare_digest(self.headers.get('X-CSRF-Token',''),session['csrf']):return self.respond({'error':'Bitte neu anmelden.'},403)
            if path=='/api/logout':
                c=SimpleCookie(self.headers.get('Cookie',''));SESSIONS.pop(c['lotte_session'].value,None)
                return self.respond({'ok':True},cookie='lotte_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0')
            name=data.get('name','')
            if path=='/api/save':
                put('draft:'+name,valid_doc(name,data));return self.respond({'ok':True})
            if path=='/api/publish':
                draft=get('draft:'+name)
                if not draft:raise ValueError('Bitte zuerst einen Entwurf speichern.')
                history=get('history:'+name,[]);history.insert(0,page_doc(name));put('history:'+name,history[:20]);put('published:'+name,valid_doc(name,draft))
                with db() as c:c.execute('DELETE FROM docs WHERE key=?',('draft:'+name,))
                return self.respond({'ok':True})
            if path=='/api/restore':
                history=get('history:'+name,[]);index=int(data['index'])
                if index<0 or index>=len(history):raise ValueError('Version fehlt.')
                put('draft:'+name,history[index]);return self.respond({'ok':True})
            if path=='/api/new-page':
                slug=data.get('slug','')
                if not re.fullmatch('[a-z][a-z0-9-]{1,60}',slug):raise ValueError('Adresse: 2–61 Zeichen, Kleinbuchstaben, Zahlen und Bindestriche.')
                name=slug+'.html'
                if (DIST/name).exists() or base_page(name):raise ValueError('Diese Adresse existiert bereits.')
                title=str(data.get('title','')).strip()
                if not title or len(title)>180:raise ValueError('Bitte einen Titel eingeben.')
                source=(DIST/'wir.html').read_text()
                source=re.sub(r'<main\b.*?</main>',lambda _: '<main class="page-main"><section class="page-hero"><div class="page-hero-copy"><p class="page-kicker">Lotte Specht e.V.</p><h1>'+html.escape(title)+'</h1><p>Hier entsteht eine neue Seite.</p></div><div class="page-hero-media"><img src="assets/logo.png" alt="Lotte Specht e.V." /></div></section><section class="guide-section"><h2>Mehr erfahren</h2><p>Ergänze hier die Inhalte.</p></section></main>',source,flags=re.S)
                source=re.sub(r'<title>.*?</title>',lambda _: '<title>'+html.escape(title)+'</title>',source,flags=re.S)
                source=source.replace(' aria-current="page"','')
                put('template:'+name,source);put('pages',get('pages',[])+[name]);put('draft:'+name,model(name));return self.respond({'name':name})
            if path=='/api/delete-page':
                name=data.get('name','')
                if name not in get('pages',[]):raise ValueError('Diese Seite kann nicht gelöscht werden.')
                put('pages',[n for n in get('pages',[]) if n!=name])
                with db() as c:
                    for key in ('template:'+name,'draft:'+name,'published:'+name,'history:'+name):
                        c.execute('DELETE FROM docs WHERE key=?',(key,))
                return self.respond({'ok':True})
            if path=='/api/upload':
                try:
                    from PIL import Image
                except ImportError:raise ValueError('Bildupload benötigt das Python-Paket „Pillow“. Bitte einmal „pip3 install Pillow“ ausführen und den Server neu starten.')
                raw=base64.b64decode(data['data'],validate=True)
                if len(raw)>8*1024*1024:raise ValueError('Bild zu groß. Maximal 8 MB.')
                image=Image.open(io.BytesIO(raw));image.verify()
                image=Image.open(io.BytesIO(raw));image.thumbnail((2400,2400))
                folder=DIST/'assets'/'uploads';folder.mkdir(exist_ok=True)
                filename=secrets.token_hex(12)+'.webp';image.convert('RGB').save(folder/filename,'WEBP',quality=88)
                return self.respond({'src':'assets/uploads/'+filename})
            if path=='/api/calendar':
                items=data.get('items')
                if not isinstance(items,list) or len(items)>500:raise ValueError('Ungültige Einträge.')
                clean=[]
                for item in items:
                    if not str(item.get('title','')).strip():raise ValueError('Ein Titel fehlt.')
                    clean.append({k:str(item.get(k,''))[:10000] for k in ('id','title','date','notes','url')})
                put(path,clean);return self.respond({'ok':True})
            if path=='/api/presskit':
                items=data.get('items')
                if not isinstance(items,list) or len(items)>200:raise ValueError('Ungültige Einträge.')
                clean=[]
                for item in items:
                    if item.get('category') not in ('logo','foto'):raise ValueError('Bitte Logo oder Foto wählen.')
                    if not str(item.get('title','')).strip():raise ValueError('Bitte einen Titel eingeben.')
                    src=str(item.get('src',''))
                    if not re.fullmatch(r'assets/[\w/.-]+',src) or '..' in src:raise ValueError('Bitte eine Datei aus der Mediathek wählen.')
                    if not (DIST/src).is_file():raise ValueError('Datei nicht gefunden.')
                    clean.append({'id':str(item.get('id',''))[:200],'category':item['category'],'title':str(item.get('title',''))[:200],'src':src,'credit':str(item.get('credit',''))[:500]})
                put(path,clean);return self.respond({'ok':True})
            if path=='/api/matches':
                items=data.get('items')
                if not isinstance(items,list) or len(items)>500:raise ValueError('Ungültige Einträge.')
                clean=[]
                for item in items:
                    if item.get('gender') not in ('frauen','maenner'):raise ValueError('Bitte Frauen- oder Männer-Bundesliga wählen.')
                    if not str(item.get('team_home','')).strip() or not str(item.get('team_away','')).strip():raise ValueError('Bitte beide Teams eintragen.')
                    if not str(item.get('date','')).strip():raise ValueError('Bitte Datum und Uhrzeit angeben.')
                    clean.append({k:str(item.get(k,''))[:200] for k in ('id','gender','competition','team_home','team_away','date','broadcaster','notes')})
                put(path,clean);return self.respond({'ok':True})
            if path=='/api/venues':
                items=data.get('items')
                if not isinstance(items,list) or len(items)>500:raise ValueError('Ungültige Einträge.')
                clean=[]
                for item in items:
                    if not str(item.get('name','')).strip():raise ValueError('Bitte einen Namen eintragen.')
                    try:
                        lat=float(item.get('lat'));lng=float(item.get('lng'))
                    except (TypeError,ValueError):raise ValueError('Bitte gültige Koordinaten eintragen.')
                    if not -90<=lat<=90 or not -180<=lng<=180:raise ValueError('Koordinaten außerhalb des gültigen Bereichs.')
                    clean.append({'id':str(item.get('id',''))[:200],'name':str(item.get('name',''))[:200],'address':str(item.get('address',''))[:300],'lat':lat,'lng':lng,'womensFootball':bool(item.get('womensFootball')),'notes':str(item.get('notes',''))[:2000],'url':str(item.get('url',''))[:500]})
                put(path,clean);return self.respond({'ok':True})
            return self.respond({'error':'Nicht gefunden.'},404)
        except (ValueError,KeyError,TypeError,IndexError,OSError) as error:return self.respond({'error':str(error) or 'Eingabe prüfen.'},400)

if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser();parser.add_argument('--port',type=int,default=8766);args=parser.parse_args()
    server=ThreadingHTTPServer(('127.0.0.1',args.port),Handler)
    print(f'Lotte Specht: http://127.0.0.1:{args.port} — Login unter /login.html',flush=True)
    server.serve_forever()

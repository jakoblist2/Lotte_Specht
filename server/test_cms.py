"""Integration checks on an isolated temporary database and distribution."""
import base64, importlib.util, io, json, os, shutil, tempfile, threading, unittest
from pathlib import Path
from urllib.request import build_opener, HTTPCookieProcessor, Request, urlopen
from urllib.error import HTTPError
from http.cookiejar import CookieJar

class EditorFlow(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.temp=tempfile.TemporaryDirectory();os.environ['LOTTE_CMS_DATA']=cls.temp.name
  spec=importlib.util.spec_from_file_location('cms',Path(__file__).with_name('cms.py'));cls.cms=importlib.util.module_from_spec(spec);spec.loader.exec_module(cls.cms)
  dest=Path(cls.temp.name)/'dist';dest.mkdir();source=cls.cms.DIST
  for p in source.glob('*.html'):shutil.copy2(p,dest/p.name)
  (dest/'assets').mkdir()
  for p in (source/'assets').rglob('*'):
   if p.is_file() and p.suffix.lower() in ('.png','.jpg','.webp','.svg') and 'sequence' not in str(p):
    target=dest/'assets'/p.relative_to(source/'assets');target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,target)
  cls.cms.DIST=dest
  cls.server=cls.cms.ThreadingHTTPServer(('127.0.0.1',0),cls.cms.Handler)
  threading.Thread(target=cls.server.serve_forever,daemon=True).start();cls.base='http://127.0.0.1:'+str(cls.server.server_port)
 @classmethod
 def tearDownClass(cls):cls.server.shutdown();cls.server.server_close();cls.temp.cleanup()
 def test_editor_lifecycle(self):
  client=build_opener(HTTPCookieProcessor(CookieJar()));csrf=''
  def call(path,data=None,token=True,opener=client):
   headers={'Content-Type':'application/json'}
   if token:headers['X-CSRF-Token']=csrf
   req=Request(self.base+path,data=None if data is None else json.dumps(data).encode(),headers=headers)
   try:
    response=opener.open(req);raw=response.read();return response.status,json.loads(raw) if 'application/json' in response.headers.get('Content-Type','') else raw.decode()
   except HTTPError as e:return e.code,json.loads(e.read())
  self.assertEqual(call('/api/pages')[0],401)
  self.assertTrue(call('/api/session')[1]['setup'])
  code,result=call('/api/setup',{'password':'temporary-test-password'});self.assertEqual(code,200);csrf=result['csrf']
  self.assertEqual(call('/api/setup',{'password':'replacement-password'})[0],400)
  self.assertEqual(call('/api/save',{},False)[0],403)
  self.assertEqual(len(call('/api/pages')[1]),len(self.cms.PUBLIC))
  for name in self.cms.PUBLIC:
   code,doc=call('/api/page?page='+name);self.assertEqual(code,200);self.assertGreater(len(doc['fields']),0)
   self.assertEqual(call('/api/save',doc)[0],200,name)
  _,page=call('/api/page?page=wir.html');old_title=page['title'];page['title']='Redaktion Test';field=next(f for f in page['fields'] if f['kind']=='text');field['value']='<script>alert(1)</script>\nNeue Zeile'
  self.assertEqual(call('/api/save',page)[0],200)
  self.assertNotIn('<title>Redaktion Test</title>',call('/wir.html')[1])
  preview=call('/api/preview?page=wir.html')[1];self.assertIn('<base href="/">',preview);self.assertIn('&lt;script&gt;',preview);self.assertIn('<title>Redaktion Test</title>',preview)
  self.assertEqual(call('/api/publish',{'name':'wir.html'})[0],200)
  self.assertIn('<title>Redaktion Test</title>',call('/wir.html')[1])
  self.assertEqual(call('/api/history?page=wir.html')[1][0]['title'],old_title)
  self.assertEqual(call('/api/restore',{'name':'wir.html','index':0})[0],200)
  self.assertEqual(call('/api/page?page=wir.html')[1]['title'],old_title)
  self.assertEqual(call('/api/new-page',{'title':'Projekt','slug':'projekt-test'})[0],200)
  self.assertEqual(call('/api/publish',{'name':'projekt-test.html'})[0],200)
  self.assertIn('href="projekt-test.html"',call('/index.html')[1])
  self.assertEqual(call('/api/new-page',{'title':'X','slug':'../escape'})[0],400)
  self.assertEqual(call('/api/delete-page',{'name':'wir.html'})[0],400)
  self.assertEqual(call('/api/delete-page',{'name':'projekt-test.html'})[0],200)
  self.assertNotIn('href="projekt-test.html"',call('/index.html')[1])
  self.assertEqual(call('/api/page?page=projekt-test.html')[0],404)
  item={'id':'1','title':'Testtermin','date':'2026-10-01','notes':'Notiz','url':''}
  self.assertEqual(call('/api/calendar',{'items':[item]})[0],200);self.assertEqual(call('/api/calendar')[1],[item])
  logo={'id':'p1','category':'logo','title':'Logo quer','src':'assets/presskit/logo-quer.png','credit':''}
  self.assertEqual(call('/api/presskit',{'items':[logo]})[0],200)
  self.assertEqual(json.loads(urlopen(self.base+'/api/presskit').read()),[logo])
  self.assertEqual(call('/api/presskit',{'items':[{'category':'logo','title':'X','src':'../escape.png'}]})[0],400)
  self.assertEqual(call('/api/presskit',{'items':[{'category':'sonstiges','title':'X','src':'assets/logo.png'}]})[0],400)
  match={'id':'m1','gender':'frauen','competition':'Bundesliga','team_home':'Eintracht Frankfurt','team_away':'FC Bayern','date':'2026-10-04T15:30','broadcaster':'MagentaSport','notes':''}
  self.assertEqual(call('/api/matches',{'items':[match]})[0],200)
  self.assertEqual(json.loads(urlopen(self.base+'/api/matches').read()),[match])
  self.assertEqual(call('/api/matches',{'items':[{'gender':'x','team_home':'A','team_away':'B','date':'2026-01-01'}]})[0],400)
  venue={'id':'v1','name':'Fankneipe Test','address':'Frankfurt am Main','lat':50.11,'lng':8.68,'womensFootball':True,'notes':'','url':''}
  self.assertEqual(call('/api/venues',{'items':[venue]})[0],200)
  self.assertEqual(json.loads(urlopen(self.base+'/api/venues').read()),[venue])
  self.assertEqual(call('/api/venues',{'items':[{'name':'Ohne Koordinaten'}]})[0],400)
  from PIL import Image
  img=io.BytesIO();Image.new('RGB',(10,10),'red').save(img,'PNG')
  code,asset=call('/api/upload',{'data':base64.b64encode(img.getvalue()).decode()});self.assertEqual(code,200)
  self.assertTrue((self.cms.DIST/asset['src']).exists())
  self.assertEqual(call('/api/upload',{'data':base64.b64encode(b'not an image').decode()})[0],400)
  self.assertEqual(call('/api/logout',{})[0],200);self.assertEqual(call('/api/page?page=wir.html')[0],401)
  self.assertIn('Hinter den',call('/styleguide.html')[1])
  self.assertEqual(call('/api/login',{'password':'wrong'})[0],401)
  self.assertEqual(call('/api/login',{'password':'temporary-test-password'})[0],200)
  print('Verified auth, CSRF, all page models, drafts, preview, publishing, history, new/delete pages, calendar, press kit, matches, venues, upload validation and protected internal pages.')

class OpenMode(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.temp=tempfile.TemporaryDirectory();os.environ['LOTTE_CMS_DATA']=cls.temp.name;os.environ['LOTTE_CMS_OPEN']='1'
  spec=importlib.util.spec_from_file_location('cms_open',Path(__file__).with_name('cms.py'));cls.cms=importlib.util.module_from_spec(spec);spec.loader.exec_module(cls.cms)
  dest=Path(cls.temp.name)/'dist';dest.mkdir();source=cls.cms.DIST
  for p in source.glob('*.html'):shutil.copy2(p,dest/p.name)
  (dest/'assets').mkdir()
  for p in (source/'assets').rglob('*'):
   if p.is_file() and p.suffix.lower() in ('.png','.jpg','.webp','.svg') and 'sequence' not in str(p):
    target=dest/'assets'/p.relative_to(source/'assets');target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,target)
  cls.cms.DIST=dest
  cls.server=cls.cms.ThreadingHTTPServer(('127.0.0.1',0),cls.cms.Handler)
  threading.Thread(target=cls.server.serve_forever,daemon=True).start();cls.base='http://127.0.0.1:'+str(cls.server.server_port)
 @classmethod
 def tearDownClass(cls):cls.server.shutdown();cls.server.server_close();cls.temp.cleanup();del os.environ['LOTTE_CMS_OPEN']
 def test_dev_bypass_skips_login(self):
  session=json.loads(urlopen(self.base+'/api/session').read());self.assertTrue(session['authenticated'])
  status=urlopen(self.base+'/styleguide.html').status;self.assertEqual(status,200)
  doc=json.loads(urlopen(self.base+'/api/page?page=wir.html').read())
  req=Request(self.base+'/api/save',data=json.dumps(doc).encode(),headers={'Content-Type':'application/json','X-CSRF-Token':session['csrf']})
  self.assertEqual(urlopen(req).status,200)
  print('Verified LOTTE_CMS_OPEN grants access without a login step.')

if __name__=='__main__':unittest.main()

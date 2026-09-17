"""Exports the current published public site as static files for Cloudflare Pages.

Run: python3 server/export_static.py
Reads the same local database the CMS uses (server/cms.py), so it always reflects
whatever is currently published. Writes to <project root>/site/ (safe to delete and
re-run any time — it's a build artifact, not a source of truth).
"""
import json, re, shutil
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).parent))
import cms

ROOT = cms.ROOT
SITE = ROOT / 'site'
SHARED_ASSETS = ['styles.css', 'menu.js', 'app.js', 'wo-laeuft.js', 'presse-public.js']

INTERNAL_LINK = re.compile(r'<div class="menu-internal">.*?</div>', re.S)
STYLEGUIDE_LINK = re.compile(r'<a href="styleguide\.html">Styleguide</a>\s*(?:·\s*)?')

def strip_internal_links(html):
    html = INTERNAL_LINK.sub('', html)
    html = STYLEGUIDE_LINK.sub('', html)
    return html

def main():
    if SITE.exists():
        shutil.rmtree(SITE)
    SITE.mkdir()

    for name in cms.PUBLIC:
        html = cms.render_page(name)
        (SITE / name).write_text(strip_internal_links(html), encoding='utf-8')

    for name in SHARED_ASSETS:
        source = cms.DIST / name
        if source.is_file():
            shutil.copy2(source, SITE / name)

    shutil.copytree(cms.DIST / 'assets', SITE / 'assets')

    api_dir = SITE / 'api'
    api_dir.mkdir()
    (api_dir / 'matches').write_text(json.dumps(cms.get('/api/matches', []), ensure_ascii=False), encoding='utf-8')
    (api_dir / 'venues').write_text(json.dumps(cms.get('/api/venues', []), ensure_ascii=False), encoding='utf-8')
    (api_dir / 'presskit').write_text(json.dumps(cms.get('/api/presskit', cms.DEFAULT_PRESSKIT), ensure_ascii=False), encoding='utf-8')
    (SITE / '_headers').write_text(
        '/api/*\n  Content-Type: application/json\n  Cache-Control: no-store\n',
        encoding='utf-8',
    )

    print(f'Exportiert nach {SITE} ({len(cms.PUBLIC)} Seiten, {sum(1 for _ in (SITE/"assets").rglob("*") if _.is_file())} Asset-Dateien).')

if __name__ == '__main__':
    main()

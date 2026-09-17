"""Regenerates dist/media-manifest.json and dist/pages-manifest.json for the Cloudflare
Functions backend, which cannot list files on disk the way the local server does — and cannot
reliably check "does this file exist" via fetch, because Cloudflare Pages serves index.html
with a 200 status for any unmatched path (its default single-page-app-style fallback).

Run whenever files are added directly to dist/ or dist/assets: python3 server/generate_media_manifest.py
"""
import json
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).parent))
import cms

def main():
    media = [
        {'src': str(p.relative_to(cms.DIST)), 'name': p.name}
        for p in sorted((cms.DIST / 'assets').rglob('*'))
        if p.is_file() and p.suffix.lower() in ('.jpg', '.png', '.webp', '.svg')
        and cms.MEDIA_EXCLUDED_DIRS.isdisjoint(p.relative_to(cms.DIST).parts)
        and 'uploads' not in p.relative_to(cms.DIST).parts
    ]
    (cms.DIST / 'media-manifest.json').write_text(json.dumps(media, ensure_ascii=False), encoding='utf-8')

    pages = sorted(p.name for p in cms.DIST.iterdir() if p.is_file() and p.suffix in ('.html', '.js', '.css', '.json'))
    (cms.DIST / 'pages-manifest.json').write_text(json.dumps(pages, ensure_ascii=False), encoding='utf-8')

    print(f'media-manifest.json: {len(media)} Dateien. pages-manifest.json: {len(pages)} Dateien.')

if __name__ == '__main__':
    main()

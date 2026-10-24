"""Serve the local production PWA with SPA fallback (development only)."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1] / 'dist' / 'web' / 'browser'

class SpaHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        path = urlsplit(self.path).path
        if not Path(self.translate_path(path)).is_file() and '.' not in path.rsplit('/', 1)[-1]:
            self.path = '/index.html'
        super().do_GET()

    def end_headers(self):
        if self.path.split('?', 1)[0] in ('/sw.js', '/precache.js', '/index.html'):
            self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

if __name__ == '__main__':
    if not (ROOT / 'precache.js').exists():
        raise SystemExit('Run npm run build:local first.')
    print('Local PWA: http://localhost:8080', flush=True)
    ThreadingHTTPServer(('127.0.0.1', 8080), partial(SpaHandler, directory=str(ROOT))).serve_forever()

# TEST-ONLY (App Store screenshots): on 127.0.0.1:8799, POST appends an app event to $SINK_FILE; GET /taken?n=<name>
# answers "1" once $SHOT_DIR/$SHOT_LABEL-<name>.png exists, so the app holds each screen until its screenshot is saved.
import os
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlsplit, parse_qs
F = os.environ['SINK_FILE']; D = os.environ['SHOT_DIR']; L = os.environ['SHOT_LABEL']
class H(BaseHTTPRequestHandler):
    def _head(self, code):
        self.send_response(code); self.send_header('Access-Control-Allow-Origin', '*'); self.send_header('Access-Control-Allow-Headers', '*')
    def do_POST(self):
        n = int(self.headers.get('Content-Length') or 0); body = self.rfile.read(n).decode('utf-8', 'replace')
        with open(F, 'a', encoding='utf-8') as f: f.write(body.replace('\n', ' ') + '\n'); f.flush()
        self._head(204); self.end_headers()
    def do_GET(self):
        n = (parse_qs(urlsplit(self.path).query).get('n') or [''])[0]
        ok = bool(n) and os.path.isfile(os.path.join(D, f'{L}-{n}.png'))
        self._head(200); self.send_header('Content-Type', 'text/plain'); self.end_headers(); self.wfile.write(b'1' if ok else b'0')
    def do_OPTIONS(self):
        self._head(204); self.end_headers()
    def log_message(self, *a): pass
HTTPServer(('127.0.0.1', 8799), H).serve_forever()

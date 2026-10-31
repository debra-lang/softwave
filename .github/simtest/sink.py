# TEST-ONLY: receives the in-app test events (POST text) on 127.0.0.1:8799 and appends each to $SINK_FILE at once.
import os
from http.server import BaseHTTPRequestHandler, HTTPServer
F = os.environ.get('SINK_FILE', 'events.txt')
class H(BaseHTTPRequestHandler):
    def do_POST(self):
        n = int(self.headers.get('Content-Length') or 0); body = self.rfile.read(n).decode('utf-8', 'replace')
        with open(F, 'a', encoding='utf-8') as f: f.write(body.replace('\n', ' ') + '\n'); f.flush()
        self.send_response(204); self.send_header('Access-Control-Allow-Origin', '*'); self.end_headers()
    def do_OPTIONS(self):
        self.send_response(204); self.send_header('Access-Control-Allow-Origin', '*'); self.send_header('Access-Control-Allow-Headers', '*'); self.end_headers()
    def log_message(self, *a): pass
HTTPServer(('127.0.0.1', 8799), H).serve_forever()

# TEST-ONLY: writes one run's settings (JSON) into an injected test script. Usage: cfg.py <script> '<json>'
import json, re, sys
p, c = sys.argv[1:3]; json.loads(c)
h = open(p).read()
h2 = re.sub(r"/\*CFG\*/.*?/\*END\*/", lambda m: c, h, count=1, flags=re.S)
assert c in h2
open(p, "w").write(h2)

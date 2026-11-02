# TEST-ONLY: writes one run's settings into the injected soak.js. Usage: soak-cfg.py <soak.js> <sound> <minutes> <mode>
import json, re, sys
p, s, m, md = sys.argv[1:5]
h = open(p).read()
c = json.dumps({"sound": s, "minutes": int(m), "mode": md})
h2 = re.sub(r"/\*CFG\*/.*?/\*END\*/", c, h, count=1, flags=re.S)
assert h2 != h
open(p, "w").write(h2)

# TEST-ONLY. Summarises simulator logs: every B61TEST check per runtime and the 1.0 -> 1.1 data comparison.
# Usage: python3 summarize.py <out dir> <label> [<label> ...]   (exit 1 if anything failed or is missing)
import json, os, re, sys
out, labels = sys.argv[1], sys.argv[2:]
bad = False
lines = []


def grab(path, tag):
    ev = path[:-4] + '.events'
    src = [p for p in (ev, path) if os.path.exists(p) and os.path.getsize(p) > 0][:1]
    if not src:
        return []
    res = []
    for ln in open(src[0], encoding='utf-8', errors='replace'):
        i = ln.find(tag + ' ')
        if i >= 0:
            res.append(ln[i + len(tag) + 1:].strip())
    return res


def first_json(items, prefix):
    for it in items:
        if it.startswith(prefix + ' '):
            try:
                return json.loads(it[len(prefix) + 1:])
            except Exception:
                return None
    return None


for L in labels:
    lines.append(f'### {L}')
    for mode in ('fresh', 'upgrade'):
        t = grab(f'{out}/{L}-{mode}.log', 'B61TEST')
        env = first_json(t, 'env')
        done = first_json(t, 'done')
        fails = [json.loads(x[5:]) for x in t if x.startswith('FAIL ')]
        passes = [x for x in t if x.startswith('PASS ')]
        if env and mode == 'fresh':
            lines.append(f"- iOS {env.get('ios')} · :has() {env.get('has')} · color-mix() {env.get('colorMix')}")
        if not done:
            bad = True
            lines.append(f'- **{mode}: no result (app did not finish the checks)**')
            continue
        ok = done['failed'] == 0
        bad |= not ok
        lines.append(f"- {mode}: {done['passed']} passed, {done['failed']} failed" + ('' if ok else ' — ' + '; '.join(f"{f['name']}: {json.dumps(f['info'])[:200]}" for f in fails)))
        if mode == 'fresh':
            lines.append('  - ' + '\n  - '.join(json.loads(p[5:])['name'] for p in passes))
    seed = grab(f'{out}/{L}-seed61.log', 'B60SEED')
    dump = first_json(seed, 'dump')
    ui = first_json(seed, 'ui')
    pre = first_json(grab(f'{out}/{L}-upgrade.log', 'B61TEST'), 'pre')
    if not dump or not pre:
        bad = True
        lines.append('- **upgrade data comparison: missing 1.0 dump or 1.1 snapshot**')
    else:
        same = dump == pre['data']
        bad |= not same
        lines.append(f"- Build 61 showed its data before the upgrade: {json.dumps(ui)}")
        lines.append(f"- storage after replacing Build 61 with Build 62, before any 1.1 code ran: {'identical to what Build 61 held' if same else 'DIFFERENT'} ({len(dump)} keys)")
        if not same:
            diff = sorted(set(dump) ^ set(pre['data'])) + sorted(k for k in dump if k in pre['data'] and dump[k] != pre['data'][k])
            lines.append('  - differing keys: ' + ', '.join(diff))
text = '\n'.join(lines)
print(text)
open(f'{out}/summary.md', 'w').write(text + '\n')
if os.environ.get('GITHUB_STEP_SUMMARY'):
    open(os.environ['GITHUB_STEP_SUMMARY'], 'a').write(text + '\n')
sys.exit(1 if bad else 0)

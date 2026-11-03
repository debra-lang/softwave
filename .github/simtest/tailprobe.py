# TEST-ONLY lldb probe: reads the tail time WebKit holds for each filter scanned while nothing is firing, so what it lists is what WebKit retained.
# Reads the value straight from memory at the offset the accessor loads it from, without stepping the audio thread.
# Usage inside lldb: command script import tailprobe.py ; tailprobe <max hits> <max seconds>
import collections, re, struct, threading, time, lldb

def probe(debugger, command, result, internal):
    maxhits, maxsec = [int(x) for x in command.split()]
    debugger.SetAsync(False)
    target = debugger.GetSelectedTarget(); process = target.GetProcess()
    bp = target.BreakpointCreateByName('WebCore::BiquadDSPKernel::tailTime() const')
    if bp.GetNumLocations() == 0: bp = target.BreakpointCreateByRegex('BiquadDSPKernel::tailTime')
    print('TAILPROBE locations', bp.GetNumLocations(), flush=True)
    addr = bp.GetLocationAtIndex(0).GetAddress()
    ins = target.ReadInstructions(addr, 4)
    text = [i.GetMnemonic(target) + ' ' + i.GetOperands(target) for i in ins]
    print('TAILPROBE accessor', text, flush=True)
    off = None
    for t in text:
        m = re.match(r'ldr\s+d0,\s*\[x0(?:,\s*#(0x[0-9a-f]+|\d+))?\]', t)
        if m: off = int(m.group(1) or '0', 0); break
    seen = {}; hits = 0; first = None; wrapped = None; start = time.time(); done = threading.Event()
    def watchdog():
        if not done.wait(maxsec): process.SendAsyncInterrupt()
    threading.Thread(target=watchdog, daemon=True).start()
    err = lldb.SBError()
    while hits < maxhits and time.time() - start < maxsec:
        process.Continue()
        th = next((t for t in process if t.GetStopReason() == lldb.eStopReasonBreakpoint), None)
        if th is None: break
        this = th.GetFrameAtIndex(0).FindRegister('x0').GetValueAsUnsigned()
        val = 'unknown'
        if off is not None:
            raw = process.ReadMemory(this + off, 8, err)
            if err.Success(): val = struct.unpack('<d', raw)[0]; val = 'inf' if val == float('inf') else round(val, 3)
        if first is None: first = this
        elif this == first and wrapped is None: wrapped = len(seen)
        seen[this] = val; hits += 1
        if hits <= 40 or hits % 200 == 0: print('TAILPROBE hit', hits, hex(this), val, round(time.time() - start, 1), flush=True)
    done.set(); bp.SetEnabled(False)
    print('TAILPROBE hits', hits, 'distinct', len(seen), 'scan wrapped after', wrapped, 'seconds', round(time.time() - start))
    print('TAILPROBE values', collections.Counter(seen.values()).most_common(12), flush=True)

def __lldb_init_module(debugger, internal):
    debugger.HandleCommand('command script add -f tailprobe.probe tailprobe')

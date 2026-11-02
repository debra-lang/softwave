# TEST-ONLY lldb probe: reads the tail time WebKit holds for each filter scanned while nothing is firing, so what it lists is what WebKit retained.
# Usage inside lldb: command script import tailprobe.py ; tailprobe <max hits> <max seconds>
import collections, threading, time, lldb

def probe(debugger, command, result, internal):
    maxhits, maxsec = [int(x) for x in command.split()]
    debugger.SetAsync(False)
    target = debugger.GetSelectedTarget(); process = target.GetProcess()
    bp = target.BreakpointCreateByName('WebCore::BiquadDSPKernel::tailTime() const')
    if bp.GetNumLocations() == 0: bp = target.BreakpointCreateByRegex('BiquadDSPKernel::tailTime')
    print('TAILPROBE locations', bp.GetNumLocations(), 'state', process.GetState(), flush=True)
    seen = {}; hits = 0; first = None; wrapped = None; start = time.time(); done = threading.Event()
    def watchdog():
        if not done.wait(maxsec): process.SendAsyncInterrupt()
    threading.Thread(target=watchdog, daemon=True).start()
    while hits < maxhits and time.time() - start < maxsec:
        process.Continue()
        th = next((t for t in process if t.GetStopReason() == lldb.eStopReasonBreakpoint), None)
        if th is None: break
        this = th.GetFrameAtIndex(0).FindRegister('x0').GetValueAsUnsigned()
        th.StepOut()
        val = th.GetFrameAtIndex(0).FindRegister('d0').GetValue()
        if first is None: first = this
        elif this == first and wrapped is None: wrapped = len(seen)
        seen[this] = val; hits += 1
    done.set(); bp.SetEnabled(False)
    print('TAILPROBE hits', hits, 'distinct', len(seen), 'scan wrapped after', wrapped, 'seconds', round(time.time() - start))
    print('TAILPROBE values', collections.Counter(seen.values()).most_common(12), flush=True)

def __lldb_init_module(debugger, internal):
    debugger.HandleCommand('command script add -f tailprobe.probe tailprobe')

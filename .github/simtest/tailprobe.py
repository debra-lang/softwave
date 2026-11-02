# TEST-ONLY lldb probe: reads the tail time WebKit holds for each filter scanned while nothing is firing, so what it lists is what WebKit retained.
# Usage inside lldb: command script import tailprobe.py ; tailprobe <max hits> <max seconds>
import collections, time, lldb

def probe(debugger, command, result, internal):
    maxhits, maxsec = [int(x) for x in command.split()]
    target = debugger.GetSelectedTarget(); process = target.GetProcess()
    bp = target.BreakpointCreateByName('WebCore::BiquadDSPKernel::tailTime() const')
    if bp.GetNumLocations() == 0: bp = target.BreakpointCreateByRegex('BiquadDSPKernel::tailTime')
    print('TAILPROBE locations', bp.GetNumLocations())
    debugger.SetAsync(True)
    listener = debugger.GetListener(); seen = {}; hits = 0; first = None; wrapped = None; start = time.time(); end = start + maxsec
    process.Continue()
    while time.time() < end and hits < maxhits:
        ev = lldb.SBEvent()
        if not listener.WaitForEvent(1, ev): continue
        if not lldb.SBProcess.EventIsProcessEvent(ev) or lldb.SBProcess.GetStateFromEvent(ev) != lldb.eStateStopped: continue
        th = next((t for t in process if t.GetStopReason() == lldb.eStopReasonBreakpoint), None)
        if th is None:
            process.Continue(); continue
        this = th.GetFrameAtIndex(0).FindRegister('x0').GetValueAsUnsigned()
        debugger.SetAsync(False); th.StepOut(); debugger.SetAsync(True)
        val = th.GetFrameAtIndex(0).FindRegister('d0').GetValue()
        if first is None: first = this
        elif this == first and wrapped is None: wrapped = len(seen)
        seen[this] = val; hits += 1
        process.Continue()
    debugger.SetAsync(False)
    bp.SetEnabled(False)
    if process.GetState() == lldb.eStateRunning: process.Stop()
    print('TAILPROBE hits', hits, 'distinct', len(seen), 'scan wrapped after', wrapped, 'seconds', round(time.time() - start))
    print('TAILPROBE values', collections.Counter(seen.values()).most_common(12))

def __lldb_init_module(debugger, internal):
    debugger.HandleCommand('command script add -f tailprobe.probe tailprobe')

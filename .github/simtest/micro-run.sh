#!/bin/bash
# TEST-ONLY. Runs the retention experiment in one simulator app, samples CPU and memory every 10 s and probes retained filters with lldb during the idle phase.
# Usage: micro-run.sh <label> <app dir> <out dir> <cfg json> <total seconds>
set -u
L=$1; APP=$2; OUT=$3; CFGJ=$4; TOTAL=$5; mkdir -p "$OUT"; APPID=com.findmyquietsound.app; D="$(cd "$(dirname "$0")" && pwd)"
python3 "$D/cfg.py" "$APP/App.app/public/micro.js" "$CFGJ"
SINK_FILE="$OUT/$L.events" python3 "$D/sink.py" & SINKPID=$!; trap "kill $SINKPID 2>/dev/null" EXIT; sleep 1
RT=$(xcrun simctl list runtimes -j | python3 -c "import json,sys; r=[x for x in json.load(sys.stdin)['runtimes'] if x['platform']=='iOS' and x['isAvailable']]; print(sorted(r,key=lambda x:[int(p) for p in x['version'].split('.')])[-1]['identifier'])")
DT=$(xcrun simctl list devicetypes | grep -oE 'iPhone 1[67]( Pro)?' | grep -v Pro | sort -V | tail -1)
echo "$L: runtime $RT device $DT cfg $CFGJ"
U=$(xcrun simctl create "micro-$L" "$DT" "$RT") || { echo "RESULT $L device-create-failed"; exit 0; }
xcrun simctl boot "$U"; xcrun simctl bootstatus "$U" -b >/dev/null 2>&1; xcrun simctl install "$U" "$APP/App.app"
script -q -F "$OUT/$L.log" xcrun simctl launch --console-pty --terminate-running-process "$U" "$APPID" >/dev/null 2>&1 &
PID=$!; START=$SECONDS; TO=$((TOTAL + 300)); DID=0; PS_AT=""
while [ $((SECONDS - START)) -lt "$TO" ]; do
  sleep 10; t=$((SECONDS - START))
  ps -axo pid=,pcpu=,rss=,command= | awk -v t="$t" '/grep|awk/ {next} /com.apple.WebKit.WebContent/ {print t,"WebContent",$1,$2,$3} /com.apple.WebKit.GPU/ {print t,"GPU",$1,$2,$3}' >> "$OUT/$L-ps.txt"
  echo "$t $(uptime | sed 's/.*load/load/')" >> "$OUT/$L-host.txt"
  W=$(pgrep -f com.apple.WebKit.WebContent | head -1)
  # Once the pump has stopped and CPU has been read for a while, ask lldb what the retained filters hold.
  if [ "$DID" = 0 ] && grep -aq '"tag":"pumpstopped"' "$OUT/$L.events" 2>/dev/null; then
    [ -z "$PS_AT" ] && PS_AT=$t
    if [ $((t - PS_AT)) -ge 120 ] && [ -n "$W" ]; then
      DID=1; sample "$W" 5 -file "$OUT/$L-sample-idle.txt" >/dev/null 2>&1
      ( lldb -p "$W" --batch -o "command script import $D/tailprobe.py" -o "tailprobe 4000 90" -o "process detach" > "$OUT/$L-lldb.txt" 2>&1 ) & LP=$!
      for i in $(seq 1 30); do sleep 5; kill -0 "$LP" 2>/dev/null || break; done; kill "$LP" 2>/dev/null
    fi
  fi
  grep -aq 'MICRO {"tag":"done"' "$OUT/$L.events" 2>/dev/null && break
done
kill "$PID" 2>/dev/null; wait "$PID" 2>/dev/null
xcrun simctl terminate "$U" "$APPID" >/dev/null 2>&1; xcrun simctl shutdown "$U"; xcrun simctl delete "$U"
echo "RESULT $L finished, $(wc -l < "$OUT/$L.events") events"; grep -a TAILPROBE "$OUT/$L-lldb.txt" 2>/dev/null
exit 0

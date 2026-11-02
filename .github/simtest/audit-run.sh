#!/bin/bash
# TEST-ONLY. Runs the audio audit in one simulator app until it reports done. Also samples CPU and memory of the app and WebKit
# processes from the host every 30 s. Usage: audit-run.sh <label> <app dir> <out dir> <timeout seconds>
set -u
L=$1; APP=$2; OUT=$3; TO=$4; mkdir -p "$OUT"; APPID=com.findmyquietsound.app
system_profiler SPAudioDataType 2>/dev/null | head -30 > "$OUT/$L-host-audio.txt"
SINK_FILE="$OUT/$L.events" python3 "$(dirname "$0")/sink.py" & SINKPID=$!; trap "kill $SINKPID 2>/dev/null" EXIT; sleep 1
RT=$(xcrun simctl list runtimes -j | python3 -c "import json,sys; r=[x for x in json.load(sys.stdin)['runtimes'] if x['platform']=='iOS' and x['isAvailable']]; print(sorted(r,key=lambda x:[int(p) for p in x['version'].split('.')])[-1]['identifier'])")
DT=$(xcrun simctl list devicetypes | grep -oE 'iPhone 1[67]( Pro)?' | grep -v Pro | sort -V | tail -1)
echo "$L: runtime $RT device $DT"
U=$(xcrun simctl create "audit-$L" "$DT" "$RT") || { echo "RESULT $L device-create-failed"; exit 0; }
xcrun simctl boot "$U"; xcrun simctl bootstatus "$U" -b >/dev/null 2>&1
xcrun simctl install "$U" "$APP/App.app"
/usr/libexec/PlistBuddy -c 'Print CFBundleShortVersionString' -c 'Print CFBundleVersion' "$APP/App.app/Info.plist" | tr '\n' ' '; echo
script -q -F "$OUT/$L.log" xcrun simctl launch --console-pty --terminate-running-process "$U" "$APPID" >/dev/null 2>&1 &
PID=$!; t=0
while [ "$t" -lt "$TO" ]; do
  sleep 30; t=$((t + 30))
  ps -axo pcpu=,rss=,comm= | grep -E 'WebContent|GPU|/App$' | grep -v grep | awk -v t="$t" '{n=$3; sub(/.*\//,"",n); print t, n, $1, $2}' >> "$OUT/$L-ps.txt"
  grep -aq 'AUDIT {"tag":"done"' "$OUT/$L.events" 2>/dev/null && break
  [ $((t % 600)) -eq 0 ] && echo "$L t=$t $(wc -l < "$OUT/$L.events" 2>/dev/null) events"
done
[ "$t" -ge "$TO" ] && echo "$L: TIMEOUT after ${TO}s"
kill "$PID" 2>/dev/null; wait "$PID" 2>/dev/null
xcrun simctl terminate "$U" "$APPID" >/dev/null 2>&1; xcrun simctl shutdown "$U"; xcrun simctl delete "$U"
echo "RESULT $L finished, $(wc -l < "$OUT/$L.events") events"

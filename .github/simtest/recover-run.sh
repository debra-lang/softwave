#!/bin/bash
# TEST-ONLY. Runs the recovery check in one simulator app and breaks the audio system when the page asks.
# Usage: recover-run.sh <label> <app dir> <out dir> <mode: gpukill, cakill, castop>
set -u
L=$1; APP=$2; OUT=$3; MODE=$4; TO=480; mkdir -p "$OUT"; APPID=com.findmyquietsound.app
python3 "$(dirname "$0")/soak-cfg.py" "$APP/App.app/public/recover.js" rain 2 "$MODE"
SINK_FILE="$OUT/$L.events" python3 "$(dirname "$0")/sink.py" & SINKPID=$!; trap "kill $SINKPID 2>/dev/null; sudo killall -CONT coreaudiod 2>/dev/null" EXIT; sleep 1
RT=$(xcrun simctl list runtimes -j | python3 -c "import json,sys; r=[x for x in json.load(sys.stdin)['runtimes'] if x['platform']=='iOS' and x['isAvailable']]; print(sorted(r,key=lambda x:[int(p) for p in x['version'].split('.')])[-1]['identifier'])")
DT=$(xcrun simctl list devicetypes | grep -oE 'iPhone 1[67]( Pro)?' | grep -v Pro | sort -V | tail -1)
U=$(xcrun simctl create "rec-$L" "$DT" "$RT") || { echo "RESULT $L device-create-failed"; exit 0; }
xcrun simctl boot "$U"; xcrun simctl bootstatus "$U" -b >/dev/null 2>&1
xcrun simctl install "$U" "$APP/App.app"
touch "$OUT/$L.events"
script -q -F "$OUT/$L.log" xcrun simctl launch --console-pty --terminate-running-process "$U" "$APPID" >/dev/null 2>&1 &
PID=$!; START=$SECONDS; DONE=0
while [ $((SECONDS - START)) -lt "$TO" ]; do
  sleep 1
  N=$(grep -ac '"tag":"breakreq"' "$OUT/$L.events")
  if [ "$N" -gt "$DONE" ]; then
    DONE=$N; t=$((SECONDS - START))
    case "$MODE" in
      gpukill) G=$(pgrep -f com.apple.WebKit.GPU); echo "$t kill GPU process: ${G:-none}" >> "$OUT/$L-actions.txt"; [ -n "$G" ] && kill -9 $G ;;
      cakill) echo "$t kill coreaudiod" >> "$OUT/$L-actions.txt"; sudo killall -9 coreaudiod ;;
      castop) echo "$t freeze coreaudiod" >> "$OUT/$L-actions.txt"; sudo killall -STOP coreaudiod ;;
    esac
  fi
  if [ "$MODE" = castop ] && grep -aq '"tag":"releasereq"' "$OUT/$L.events" && [ ! -f "$OUT/.released-$L" ]; then
    touch "$OUT/.released-$L"; echo "$((SECONDS - START)) release coreaudiod" >> "$OUT/$L-actions.txt"; sudo killall -CONT coreaudiod
  fi
  grep -aq '"tag":"done"' "$OUT/$L.events" && break
done
[ $((SECONDS - START)) -ge "$TO" ] && echo "$L: TIMEOUT after ${TO}s"
sudo killall -CONT coreaudiod 2>/dev/null
kill "$PID" 2>/dev/null; wait "$PID" 2>/dev/null
mkdir -p "$OUT/crash"; cp ~/Library/Logs/DiagnosticReports/*WebContent* ~/Library/Logs/DiagnosticReports/*WebKit* "$OUT/crash/" 2>/dev/null
xcrun simctl terminate "$U" "$APPID" >/dev/null 2>&1; xcrun simctl shutdown "$U"; xcrun simctl delete "$U"
echo "RESULT $L finished, $(wc -l < "$OUT/$L.events") events"

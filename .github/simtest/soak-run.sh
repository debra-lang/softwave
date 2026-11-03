#!/bin/bash
# TEST-ONLY. Runs the controlled soak in one simulator app and samples the host every 30 s: CPU and memory of the app, WebKit and audio
# processes, host load, busiest processes; plus call-stack samples of the WebKit process early, midway and late.
# Usage: soak-run.sh <label> <app dir> <out dir> <timeout seconds> <sound> <minutes> <mode>
set -u
L=$1; APP=$2; OUT=$3; TO=$4; SOUND=$5; MIN=$6; MODE=$7; mkdir -p "$OUT"; APPID=com.findmyquietsound.app
python3 "$(dirname "$0")/soak-cfg.py" "$APP/App.app/public/soak.js" "$SOUND" "$MIN" "$MODE"
SINK_FILE="$OUT/$L.events" python3 "$(dirname "$0")/sink.py" & SINKPID=$!; trap "kill $SINKPID 2>/dev/null" EXIT; sleep 1
RT=$(xcrun simctl list runtimes -j | python3 -c "import json,sys; r=[x for x in json.load(sys.stdin)['runtimes'] if x['platform']=='iOS' and x['isAvailable']]; print(sorted(r,key=lambda x:[int(p) for p in x['version'].split('.')])[-1]['identifier'])")
DT=$(xcrun simctl list devicetypes | grep -oE 'iPhone 1[67]( Pro)?' | grep -v Pro | sort -V | tail -1)
echo "$L: runtime $RT device $DT sound $SOUND minutes $MIN mode $MODE"
U=$(xcrun simctl create "soak-$L" "$DT" "$RT") || { echo "RESULT $L device-create-failed"; exit 0; }
xcrun simctl boot "$U"; xcrun simctl bootstatus "$U" -b >/dev/null 2>&1
xcrun simctl install "$U" "$APP/App.app"
script -q -F "$OUT/$L.log" xcrun simctl launch --console-pty --terminate-running-process "$U" "$APPID" >/dev/null 2>&1 &
PID=$!; START=$SECONDS; S1=0; S2=0; S3=0; CAUGHT=0
while [ $((SECONDS - START)) -lt "$TO" ]; do
  sleep 30; t=$((SECONDS - START))
  ps -axo pid=,pcpu=,rss=,command= | awk -v t="$t" '/grep|awk/ {next} /com.apple.WebKit.WebContent/ {print t,"WebContent",$1,$2,$3} /com.apple.WebKit.GPU/ {print t,"GPU",$1,$2,$3} /App.app\/App/ {print t,"App",$1,$2,$3} /coreaudiod/ {print t,"coreaudiod",$1,$2,$3}' >> "$OUT/$L-ps.txt"
  echo "$t $(uptime | sed 's/.*load/load/') | $(ps -axo pcpu=,comm= | sort -rn | head -4 | awk '{n=$2; sub(/.*\//,"",n); printf "%s:%s ",n,$1}')" >> "$OUT/$L-host.txt"
  W=$(pgrep -f com.apple.WebKit.WebContent | head -1)
  if [ -n "$W" ]; then
    if [ "$S1" = 0 ] && [ "$t" -ge 180 ]; then S1=1; sample "$W" 5 -file "$OUT/$L-sample-early.txt" >/dev/null 2>&1; fi
    if [ "$S2" = 0 ] && [ "$t" -ge $((MIN * 30)) ]; then S2=1; sample "$W" 5 -file "$OUT/$L-sample-mid.txt" >/dev/null 2>&1; fi
    if [ "$S3" = 0 ] && [ "$t" -ge $((MIN * 60 - 60)) ]; then S3=1; sample "$W" 5 -file "$OUT/$L-sample-late.txt" >/dev/null 2>&1; fi
  fi
  # If the page started a second time the WebKit process was lost: keep the reason.
  if [ "$CAUGHT" = 0 ] && [ "$(grep -ac '"tag":"start"' "$OUT/$L.events" 2>/dev/null)" -gt 1 ]; then
    CAUGHT=1; echo "$L: WebKit process lost, about $t s" >> "$OUT/$L-lost.txt"
    xcrun simctl spawn "$U" log show --last 5m --style compact --predicate 'eventMessage CONTAINS[c] "terminat" OR eventMessage CONTAINS[c] "jetsam" OR eventMessage CONTAINS[c] "crash" OR eventMessage CONTAINS[c] "memory limit" OR eventMessage CONTAINS[c] "exceeded" OR process CONTAINS "ReportCrash"' 2>&1 | tail -400 >> "$OUT/$L-lost.txt"
  fi
  grep -aq 'SOAK {"tag":"done"' "$OUT/$L.events" 2>/dev/null && break
done
[ $((SECONDS - START)) -ge "$TO" ] && echo "$L: TIMEOUT after ${TO}s"
kill "$PID" 2>/dev/null; wait "$PID" 2>/dev/null
mkdir -p "$OUT/crash"; cp ~/Library/Logs/DiagnosticReports/*WebContent* ~/Library/Logs/DiagnosticReports/*WebKit* "$OUT/crash/" 2>/dev/null
xcrun simctl terminate "$U" "$APPID" >/dev/null 2>&1; xcrun simctl shutdown "$U"; xcrun simctl delete "$U"
echo "RESULT $L finished, $(wc -l < "$OUT/$L.events") events"

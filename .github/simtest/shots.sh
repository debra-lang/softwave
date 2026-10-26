#!/bin/bash
# TEST-ONLY (App Store screenshots). Installs the Build 89 release app (with shots.js injected) on one simulator,
# dark appearance and a clean status bar, and saves a screenshot each time the app prints "B89SHOT <name>"; the app
# holds that screen until shotsink.py reports the file saved.
# Usage: shots.sh <label> <device type name> <runtime identifier> <App.app> <out dir>
set -u
L=$1; DT=$2; RT=$3; APP=$4; OUT=$5; mkdir -p "$OUT"
APPID=com.findmyquietsound.app
SINK_FILE="$OUT/.events-$L" SHOT_DIR="$OUT" SHOT_LABEL="$L" python3 "$(dirname "$0")/shotsink.py" & SINKPID=$!; trap "kill $SINKPID 2>/dev/null" EXIT; sleep 1
U=$(xcrun simctl create "shots-$L" "$DT" "$RT") || { echo "RESULT $L device-create-failed"; exit 1; }
xcrun simctl boot "$U"; xcrun simctl bootstatus "$U" -b >/dev/null 2>&1
xcrun simctl ui "$U" appearance dark
bar() { xcrun simctl status_bar "$U" override --time "$(date +%-H:%M)" --dataNetwork wifi --wifiMode active --wifiBars 3 \
  --cellularMode active --cellularBars 4 --batteryState charged --batteryLevel 100 >/dev/null 2>&1; }
bar; echo "$L: $(xcrun simctl list devices | grep "$U" | head -1)"
xcrun simctl install "$U" "$APP"
log="$OUT/$L.log"; : > "$OUT/.events-$L"
script -q -F "$log" xcrun simctl launch --console-pty --terminate-running-process "$U" "$APPID" >/dev/null 2>&1 &
pid=$!; t=0
while [ $t -lt 1500 ]; do
  sleep 1; t=$((t + 1))
  for name in $(cat "$OUT/.events-$L" "$log" 2>/dev/null | grep -ao 'B89SHOT [a-z0-9-]*' | awk '{print $2}' | grep -v '^done$' | sort -u); do
    if [ ! -f "$OUT/$L-$name.png" ]; then s0=$SECONDS; bar; s1=$SECONDS; xcrun simctl io "$U" screenshot "$OUT/.tmp-$L.png" >/dev/null 2>&1 && mv "$OUT/.tmp-$L.png" "$OUT/$L-$name.png" && echo "$L: $name (seen at loop ${t}s; bar $((s1-s0))s, shot $((SECONDS-s1))s)"; fi
  done
  cat "$OUT/.events-$L" "$log" 2>/dev/null | grep -aq 'B89SHOT done' && break
done
[ $t -ge 1500 ] && echo "$L: TIMEOUT"
cat "$OUT/.events-$L" "$log" 2>/dev/null | grep -a 'B89NOTE' | sort -u
kill "$pid" 2>/dev/null; xcrun simctl shutdown "$U"; xcrun simctl delete "$U"
echo "RESULT $L $(ls "$OUT"/$L-*.png 2>/dev/null | wc -l | tr -d ' ') screenshots"

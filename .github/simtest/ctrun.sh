#!/bin/bash
# TEST-ONLY. Runs the Custom-timer diagnostic (custtimer.js injected) on one simulator runtime for each app given.
# Usage: ctrun.sh <label> <device type name> <runtime identifier> <dir with <app>/App.app> <out dir> <app labels...>
set -u
L=$1; DT=$2; RT=$3; APPS=$4; OUT=$5; shift 5; mkdir -p "$OUT"
APPID=com.findmyquietsound.app
SINK_FILE="$OUT/.events" python3 "$(dirname "$0")/sink.py" & SINKPID=$!; trap "kill $SINKPID 2>/dev/null" EXIT; sleep 1
newdev() { local u; u=$(xcrun simctl create "ct-$L-$1" "$DT" "$RT") || return 1; xcrun simctl boot "$u"; xcrun simctl bootstatus "$u" -b >/dev/null 2>&1; echo "$u"; }
run_app() {
  local U=$1 tag=$2 marker=$3 to=$4 t=0
  local log="$OUT/$L-$tag.log" ev="$OUT/$L-$tag.events"
  : > "$OUT/.events"
  script -q -F "$log" xcrun simctl launch --console-pty --terminate-running-process "$U" "$APPID" >/dev/null 2>&1 &
  local pid=$!
  while [ $t -lt "$to" ]; do
    sleep 1; t=$((t + 1)); cp "$OUT/.events" "$ev" 2>/dev/null
    for name in $(cat "$ev" "$log" 2>/dev/null | grep -ao 'CTSHOT [a-z0-9-]*' | awk '{print $2}' | sort -u); do
      [ -f "$OUT/$L-$tag-$name.png" ] || xcrun simctl io "$U" screenshot "$OUT/$L-$tag-$name.png" >/dev/null 2>&1
    done
    cat "$ev" "$log" 2>/dev/null | grep -aq "$marker" && break
  done
  [ $t -ge "$to" ] && echo "$L/$tag: TIMEOUT after ${to}s"
  sleep 3; cp "$OUT/.events" "$ev" 2>/dev/null; kill "$pid" 2>/dev/null; wait "$pid" 2>/dev/null
}
for app in "$@"; do
  U=$(newdev "$app") || { echo "RESULT $L $app device-create-failed"; continue; }
  echo "$L/$app: $(xcrun simctl list devices | grep "$U" | head -1)"
  xcrun simctl install "$U" "$APPS/$app/App.app"
  run_app "$U" "$app" 'CT done' 240
  echo "===== $L/$app diagnostic lines ====="
  cat "$OUT/$L-$app.events" "$OUT/$L-$app.log" 2>/dev/null | grep -a '^CT ' | sort -u -t' ' -k2,2n | grep -aE 'CT [0-9]+ (env|phase|sample:|form|summary|fatal|error|intro|keyboardPlugin|focusin|focusout|Keyboard:|ctx:|element:|call:(pauseAll|playAll|stopAll|_keepAlive|resume|setTimer|clearTimer)|visualViewport|window:|visibility)' | cut -c1-900
  xcrun simctl terminate "$U" "$APPID" >/dev/null 2>&1; xcrun simctl shutdown "$U"; xcrun simctl delete "$U"
done
echo "RESULT $L finished"

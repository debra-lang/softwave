#!/bin/bash
# TEST-ONLY. Runs Build 61 (and the 1.0 → 1.1 upgrade) on one simulator runtime.
# Usage: simrun.sh <label> <device type name> <runtime identifier> <dir with b60.app b61.app> <out dir>
set -u
L=$1; DT=$2; RT=$3; APPS=$4; OUT=$5; mkdir -p "$OUT"
APPID=com.findmyquietsound.app

newdev() { local u; u=$(xcrun simctl create "t-$L-$1" "$DT" "$RT") || return 1; xcrun simctl boot "$u"; xcrun simctl bootstatus "$u" -b >/dev/null 2>&1; echo "$u"; }

# run the app with its console attached; answer screenshot (B61SHOT) and background (B61BG) requests; stop at the marker
run_app() {
  local U=$1 tag=$2 marker=$3 to=$4 t=0
  local log="$OUT/$L-$tag.log"
  xcrun simctl launch --console --terminate-running-process "$U" "$APPID" > "$log" 2>&1 &
  local pid=$!
  while [ $t -lt "$to" ]; do
    sleep 1; t=$((t + 1))
    for name in $(grep -o 'B61SHOT [a-z0-9-]*' "$log" | awk '{print $2}'); do
      [ -f "$OUT/$L-$name.png" ] || xcrun simctl io "$U" screenshot "$OUT/$L-$name.png" >/dev/null 2>&1
    done
    if grep -q 'B61BG' "$log" && [ ! -f "$OUT/.bg-$L-$tag" ]; then
      touch "$OUT/.bg-$L-$tag"; echo "$L/$tag: app to background (Settings) for 20 s"
      xcrun simctl launch "$U" com.apple.Preferences >/dev/null 2>&1; sleep 20
      xcrun simctl io "$U" screenshot "$OUT/$L-background-settings.png" >/dev/null 2>&1
      xcrun simctl launch "$U" "$APPID" >/dev/null 2>&1
    fi
    grep -Eq "$marker" "$log" && break
  done
  [ $t -ge "$to" ] && echo "$L/$tag: TIMEOUT after ${to}s"
  sleep 3; kill "$pid" 2>/dev/null; wait "$pid" 2>/dev/null
}

# 1. fresh install of Build 61
U=$(newdev fresh) || { echo "RESULT $L device-create-failed"; exit 0; }
echo "$L: $(xcrun simctl list devices | grep "$U" | head -1)"
xcrun simctl install "$U" "$APPS/b61/App.app"
run_app "$U" fresh 'B61TEST done' 480
xcrun simctl terminate "$U" "$APPID" >/dev/null 2>&1; xcrun simctl shutdown "$U"; xcrun simctl delete "$U"

# 2. upgrade: App Store 1.0 (Build 60) with saved data, then Build 61 installed over it
U=$(newdev upgrade) || { echo "RESULT $L device-create-failed"; exit 0; }
xcrun simctl install "$U" "$APPS/b60/App.app"
run_app "$U" seed60 'B60SEED done' 120
sleep 15                                   # let WebKit write localStorage to disk before the app stops
xcrun simctl terminate "$U" "$APPID" >/dev/null 2>&1; sleep 3
xcrun simctl install "$U" "$APPS/b61/App.app"   # same bundle id: replaces the binary, keeps the data container
xcrun simctl get_app_container "$U" "$APPID" >/dev/null 2>&1 && echo "$L: Build 61 installed over 1.0"
run_app "$U" upgrade 'B61TEST done' 240
xcrun simctl terminate "$U" "$APPID" >/dev/null 2>&1; xcrun simctl shutdown "$U"; xcrun simctl delete "$U"
echo "RESULT $L finished"

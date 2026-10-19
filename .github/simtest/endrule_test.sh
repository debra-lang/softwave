#!/bin/bash
# TEST-ONLY: compiles SoftwaveSpeechPlugin.endRule (cut from the shipped source) with the cases in endrule_cases.swift.
set -eo pipefail
SRC=native/ios/App/App/SoftwaveSpeechPlugin.swift
T=$(mktemp -d)
{ echo 'import Foundation'; echo 'enum SoftwaveSpeechPlugin {'; sed -n '/static func endRule(/,/^    }$/p' "$SRC"; echo '}'; cat .github/simtest/endrule_cases.swift; } > "$T/t.swift"
grep -c 'static func endRule' "$T/t.swift" | grep -q '^1$' || { echo 'endRule not found in the plugin source'; exit 1; }
grep -o 'pauseSeconds: TimeInterval = [0-9.]*\|quietSeconds: TimeInterval = [0-9.]*\|hardStableSeconds: TimeInterval = [0-9.]*\|minSpeechSeconds: TimeInterval = [0-9.]*' "$SRC"
swiftc -o "$T/t" "$T/t.swift"
"$T/t"

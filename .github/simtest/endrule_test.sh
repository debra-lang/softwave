#!/bin/bash
# TEST-ONLY: compiles SoftwaveSpeechPlugin.endRule and pickTranscript (cut from the shipped source) with the cases in
# endrule_cases.swift and pick_cases.swift.
set -eo pipefail
SRC=native/ios/App/App/SoftwaveSpeechPlugin.swift
T=$(mktemp -d)
{ echo 'import Foundation'; echo 'enum SoftwaveSpeechPlugin {';
  sed -n '/static func endRule(/,/^    }$/p' "$SRC";
  sed -n '/static func pickTranscript(/,/^    }$/p' "$SRC";
  sed -n '/static func lettersOnly(/p' "$SRC";
  sed -n '/static func editDistance(/,/^    }$/p' "$SRC";
  echo '}'; cat .github/simtest/endrule_cases.swift .github/simtest/pick_cases.swift; } > "$T/t.swift"
for f in endRule pickTranscript lettersOnly editDistance; do grep -c "static func $f" "$T/t.swift" | grep -q '^1$' || { echo "$f not found in the plugin source"; exit 1; }; done
grep -o 'pauseSeconds: TimeInterval = [0-9.]*\|quietSeconds: TimeInterval = [0-9.]*\|hardStableSeconds: TimeInterval = [0-9.]*\|minSpeechSeconds: TimeInterval = [0-9.]*' "$SRC"
swiftc -o "$T/t" "$T/t.swift"
"$T/t"

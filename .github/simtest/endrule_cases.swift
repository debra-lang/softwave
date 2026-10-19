// TEST-ONLY cases for the finalisation rule, with the plugin's constants: pause 1.4 s, quiet 0.8 s, hard 3.4 s.
let P = 1.4, Q = 0.8, H = 3.4
var fails = 0
func t(_ name: String, stable: Double, quiet: Double, _ want: String?) {
    let got = SoftwaveSpeechPlugin.endRule(stable: stable, quiet: quiet, pause: P, quietFor: Q, hard: H)
    let ok = got == want
    print((ok ? "PASS  " : "FAIL  ") + name + "  (stable \(stable) s, quiet \(quiet) s → \(got ?? "keep listening"), expected \(want ?? "keep listening"))")
    if !ok { fails += 1 }
}
// Build 76 device log, session 1: "play" at 2.1 s, "rain" at 2.7 s, voice stopped ≈2.1 s; at 4.1 s stable 1.4 and quiet 2.0 → end
t("transcript stable 1.4 s and the microphone quiet 0.8 s: end the audio", stable: 1.4, quiet: 0.8, "pause")
t("transcript stable 2.0 s, quiet 2.0 s: end", stable: 2.0, quiet: 2.0, "pause")
t("still speaking (quiet 0.2 s) although the transcript has not changed for 1.5 s — Apple's second word not yet delivered: keep listening", stable: 1.5, quiet: 0.2, nil)
t("word just arrived (stable 0.3 s) after a long quiet 2.0 s: keep listening (the clock restarts on every change)", stable: 0.3, quiet: 2.0, nil)
t("stable 1.3 s, quiet 1.0 s: not yet", stable: 1.3, quiet: 1.0, nil)
t("stable 1.4 s, quiet 0.7 s: not yet", stable: 1.4, quiet: 0.7, nil)
t("noisy room: never quiet, transcript stable 3.4 s: end anyway", stable: 3.4, quiet: 0.1, "noisy")
t("noisy room: stable 3.3 s: keep listening", stable: 3.3, quiet: 0.1, nil)
t("nothing yet", stable: 0, quiet: 0, nil)
// "play … pink" with a 1.0 s pause between the words while Apple has shown only "play": the microphone was voiced 1.0 s ago
// at most — the second word's sound keeps the session open until the room is quiet again
t("pause between words 1.0 s, second word being spoken (quiet 0.0): keep listening", stable: 1.6, quiet: 0.0, nil)
t("second word spoken, Apple late: quiet 0.8 s but transcript only stable 0.9 s since Apple's update: keep listening", stable: 0.9, quiet: 0.8, nil)
print(fails == 0 ? "ALL RULE CASES PASS" : "\(fails) RULE CASE(S) FAILED")
exit(fails == 0 ? 0 : 1)

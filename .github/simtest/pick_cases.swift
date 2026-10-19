// TEST-ONLY cases for the alternative-transcript rule (Build 78). `sounds` = the page's single-word sound names.
let SOUNDS = ["white", "pink", "brown", "static", "hiss", "rain", "storm", "rainstorm", "drizzle", "ocean", "waves", "sea", "beach", "seaside", "lapping", "lake", "shore", "stream", "river", "creek", "brook", "waterfall", "forest", "woods", "birds", "jungle", "leaves", "leaf", "crickets", "cricket", "insects", "bugs", "cicadas", "cicada", "night", "nighttime", "wind", "breeze", "fan", "fireplace", "fire", "campfire", "bonfire"]
func p(_ name: String, best: String, alts: [String], _ want: String, _ wantAlt: Bool) {
    let got = SoftwaveSpeechPlugin.pickTranscript(best: best, alternatives: alts, sounds: SOUNDS)
    let ok = got.text == want && got.alternative == wantAlt
    print((ok ? "PASS  " : "FAIL  ") + name + "  (best \"\(best)\" → \"\(got.text)\" alt \(got.alternative); expected \"\(want)\" alt \(wantAlt))")
    if !ok { fails += 1 }
}
// the Build 77 device case: Apple's music vocabulary
p("artist spelling: \"play P!nk\" with the alternative \"play pink\" → the alternative", best: "play P!nk", alts: ["play P!nk", "play pink"], "play pink", true)
p("artist spelling, alternative capitalised: \"Play P!nk\" / \"Play Pink\" → the alternative (case kept as Apple wrote it)", best: "Play P!nk", alts: ["Play P!nk", "Play Pink"], "Play Pink", true)
p("three words: \"play P!nk noise\" / \"play pink noise\" → the alternative", best: "play P!nk noise", alts: ["play pink noise"], "play pink noise", true)
// the best transcript already names a sound: never replaced, even if an alternative names another
p("best already names a sound (\"play rain\"): kept although an alternative says \"play pink\"", best: "play rain", alts: ["play pink"], "play rain", false)
p("best names a sound in a longer sentence: kept", best: "add a little ocean please", alts: ["add a little pink please"], "add a little ocean please", false)
// unrelated speech is never promoted
p("unrelated: \"call mum\" with alternative \"play rain\" (two words differ) → kept", best: "call mum", alts: ["play rain"], "call mum", false)
p("one word differs but the words are not alike: \"play music\" / \"play rain\" (distance 5) → kept", best: "play music", alts: ["play rain"], "play music", false)
p("one word differs, alike, but the alternative word is not a sound: \"play punk\" / \"play pink\"? — alternative word pink IS a sound: taken (distance 1)", best: "play punk", alts: ["play pink"], "play pink", true)
p("alternative word is a command, not a sound: \"pleh\" / \"play\" → kept", best: "pleh", alts: ["play"], "pleh", false)
p("different word counts: \"play\" / \"play pink\" → kept", best: "play", alts: ["play pink"], "play", false)
p("short sound name (fan, 3 letters) never swapped in: \"play fun\" / \"play fan\" → kept (4-letter minimum)", best: "play fun", alts: ["play fan"], "play fun", false)
p("no alternatives → kept", best: "play P!nk", alts: [], "play P!nk", false)
p("alternatives identical to the best → kept", best: "play P!nk", alts: ["play P!nk", "Play P!nk"], "play P!nk", false)
let emptyList = SoftwaveSpeechPlugin.pickTranscript(best: "play P!nk", alternatives: ["play pink"], sounds: [])
let eok = emptyList.text == "play P!nk" && emptyList.alternative == false
print((eok ? "PASS  " : "FAIL  ") + "empty sound list → kept (best \"play P!nk\" → \"\(emptyList.text)\" alt \(emptyList.alternative))"); if !eok { fails += 1 }
p("single word: \"P!nk\" / \"pink\" → the alternative", best: "P!nk", alts: ["pink"], "pink", true)
p("single word, unrelated: \"okay\" / \"rain\" (distance 4) → kept", best: "okay", alts: ["rain"], "okay", false)
p("first matching alternative wins in Apple's order: \"play P!nk\" / [\"play pine\", \"play pink\"] → pine is not a sound, pink is", best: "play P!nk", alts: ["play pine", "play pink"], "play pink", true)
// the helper functions
let lo = SoftwaveSpeechPlugin.lettersOnly("P!nk,") == "Pnk"; print((lo ? "PASS  " : "FAIL  ") + "lettersOnly strips punctuation"); if !lo { fails += 1 }
let ed = SoftwaveSpeechPlugin.editDistance("pnk", "pink") == 1 && SoftwaveSpeechPlugin.editDistance("music", "rain") == 4 && SoftwaveSpeechPlugin.editDistance("", "ab") == 2 && SoftwaveSpeechPlugin.editDistance("pink", "pink") == 0
print((ed ? "PASS  " : "FAIL  ") + "editDistance: pnk→pink 1, music→rain 4, empty→ab 2, same 0"); if !ed { fails += 1 }
print(fails == 0 ? "ALL RULE CASES PASS" : "\(fails) RULE CASE(S) FAILED")
exit(fails == 0 ? 0 : 1)

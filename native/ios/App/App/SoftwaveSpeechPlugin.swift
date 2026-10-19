import Foundation
import AVFoundation
import Speech
import Capacitor
import UIKit

// Ask microphone, iPhone app: Apple speech recognition run by the host process, so the audio session is OURS to restore.
// WebKit's own recogniser leaves the microphone in the audio route for the life of the process once it has been used
// (Build 73/74 diagnostics, October 2026), and a record-capable route plays the speaker through iOS's voice processing
// (hiss, a level that drifts on its own, breaks on volume changes). Here one short session captures the request, and
// every way a session can end — final result, error, cancel, the 12 s guard, a new tap — runs the same `finish`, which
// stops capture and puts the session back to exactly the configuration AppDelegate sets at launch:
// .playback, mode .default, [.mixWithOthers], active. The capture itself keeps .mixWithOthers so that activating the
// host session never interrupts WebKit's playback (the Build 69 lesson), and .defaultToSpeaker so the output never
// moves to the earpiece. Nothing here touches the sound engine; the page ducks the sound before start() and restores
// it after the promise settles.
//
// Stage 2 (Build 75 device log: capture ran, the session was restored, but no text ever came back). Apple's recognizer
// delivers a final transcript only when the audio is ended or after a long silence, so: partial results are on, the
// transcript's progress is watched, and once it has stopped changing for `pauseSeconds` the audio is ended so Apple
// finalises; a natural pause mid-sentence resumes the clock as soon as the next word arrives. The guard returns the
// text heard so far rather than failing. Every buffer's level is measured (RMS, "voiced" frames) and reported with
// the session's state events, so the log shows whether speech actually reached the recognizer.
// Stage 3 (Build 76 device log: recognition works, but a two-word request can lose its first or second word). The
// audio is ended only when the transcript has been stable for `pauseSeconds` AND the microphone has been below the
// speech level for `quietSeconds` — a word still being spoken, even one Apple has not yet reported, keeps the session
// open; a noisy room (level never quiet) falls back to a longer transcript-only rule. The page passes the sound names
// and command words as contextual strings so the recognizer favours them ("pink" over "ping").
// Build 78 (Build 77 device log: "play pink" was captured and finalised correctly, but the best transcript named no
// sound — Apple's music vocabulary writes the artist "P!nk"). Apple returns several candidate transcriptions; when the
// best one names no known sound, an alternative is used only under a strict rule (`pickTranscript`): the same number
// of words, exactly one word different, that word a known single-word sound name, and the replaced word's letters
// within two edits of it. Unrelated speech is never promoted to a request.
// Privacy: the audio goes only to Apple's recogniser; the page receives the text; events carry counts and levels,
// never words (the vocabulary count is reported, not the words; "alternative" says whether the rule fired).
@objc(SoftwaveSpeechPlugin)
public class SoftwaveSpeechPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SoftwaveSpeechPlugin"
    public let jsName = "SoftwaveSpeech"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "available", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "checkPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise)
    ]

    private var recognizer: SFSpeechRecognizer?
    private var engine: AVAudioEngine?
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var pending: CAPPluginCall?
    private var guardTimer: Timer?
    private var watchTimer: Timer?
    private var active = false
    private var sessionId = 0
    private var sessionConfigured = false   // true once begin() has switched the session to capture; finish() restores only then
    private var sounds: [String] = []       // single-word sound names from the page (Build 78: alternative-transcript rule)
    private var alternativeUsed = false     // an alternative transcript was chosen in this session (reported as a flag only)

    // transcript progress and finalisation
    private var lastText = ""
    private var lastChangeAt = Date()
    private var startedAt = Date()
    private var audioEnded = false
    private var audioEndedAt = Date()
    private let guardSeconds: TimeInterval = 12       // no usable transcript at all
    private let pauseSeconds: TimeInterval = 1.4      // transcript unchanged this long after speech → end the audio
    private let finalWaitSeconds: TimeInterval = 2.5  // Apple's final after endAudio; else the last partial stands
    private let minSpeechSeconds: TimeInterval = 1.0  // never finalise in the first second

    // audio-level telemetry (updated on the main queue from the tap)
    private var buffers = 0
    private var voicedBuffers = 0
    private var peakRms: Float = 0
    private var lastLevelReportAt = Date()
    private var inputFormatDesc = ""
    private let voicedRms: Float = 0.015              // speech level: Build 76 device log floors were 0.002–0.0073 with the ducked sound, speech 0.12–0.24
    // finalisation also waits for the microphone to go quiet
    private var lastVoicedAt: Date? = nil
    private let quietSeconds: TimeInterval = 0.8      // microphone below the speech level this long (after a stable transcript) before the audio is ended
    private let hardStableSeconds: TimeInterval = 3.4 // transcript unchanged this long → end the audio even if the room never goes quiet

    // ---- availability and permissions ----
    @objc func available(_ call: CAPPluginCall) {
        let rec = SFSpeechRecognizer()
        let input = AVAudioSession.sharedInstance().isInputAvailable
        call.resolve(["available": (rec?.isAvailable ?? false) && input, "recognizer": rec != nil, "input": input,
                      "onDevice": rec?.supportsOnDeviceRecognition ?? false])
    }

    private func speechStatus() -> String {
        switch SFSpeechRecognizer.authorizationStatus() {
        case .authorized: return "granted"
        case .denied, .restricted: return "denied"
        default: return "prompt"
        }
    }
    private func micStatus() -> String {
        switch AVAudioSession.sharedInstance().recordPermission {
        case .granted: return "granted"
        case .denied: return "denied"
        default: return "prompt"
        }
    }
    @objc override public func checkPermissions(_ call: CAPPluginCall) {
        call.resolve(["speechRecognition": speechStatus(), "microphone": micStatus()])
    }
    @objc override public func requestPermissions(_ call: CAPPluginCall) {
        SFSpeechRecognizer.requestAuthorization { _ in
            AVAudioSession.sharedInstance().requestRecordPermission { _ in
                DispatchQueue.main.async { call.resolve(["speechRecognition": self.speechStatus(), "microphone": self.micStatus()]) }
            }
        }
    }

    // ---- one session ----
    @objc func start(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            // a tap while a session is still winding down: that session ends as "aborted" first
            if self.active { self.finish(reason: "aborted", text: nil) }
            let language = call.getString("language") ?? "en"
            // contextual strings: the page's sound names and command words (short phrases only, at most 100)
            let vocabulary = Array(((call.getArray("vocabulary", String.self) ?? []).filter { !$0.isEmpty && $0.count <= 40 }).prefix(100))
            self.sounds = Array(((call.getArray("sounds", String.self) ?? []).map { $0.lowercased() }.filter { !$0.isEmpty && $0.count <= 40 && !$0.contains(" ") }).prefix(100))
            self.alternativeUsed = false
            call.keepAlive = true
            self.pending = call
            self.active = true
            self.sessionId += 1
            self.lastText = ""; self.audioEnded = false; self.startedAt = Date(); self.lastChangeAt = Date(); self.sessionConfigured = false
            self.buffers = 0; self.voicedBuffers = 0; self.peakRms = 0; self.lastLevelReportAt = Date(); self.inputFormatDesc = ""; self.lastVoicedAt = nil
            self.emit("starting", [:])
            self.authorize { ok in
                guard ok else { self.finish(reason: "not-allowed", text: nil); return }
                self.begin(language: language, vocabulary: vocabulary)
            }
        }
    }

    private func authorize(_ done: @escaping (Bool) -> Void) {
        let proceedMic = {
            switch AVAudioSession.sharedInstance().recordPermission {
            case .granted: done(true)
            case .denied: done(false)
            default: AVAudioSession.sharedInstance().requestRecordPermission { granted in DispatchQueue.main.async { done(granted) } }
            }
        }
        switch SFSpeechRecognizer.authorizationStatus() {
        case .authorized: proceedMic()
        case .denied, .restricted: done(false)
        default: SFSpeechRecognizer.requestAuthorization { status in DispatchQueue.main.async { status == .authorized ? proceedMic() : done(false) } }
        }
    }

    private func audioInfo() -> [String: Any] {
        return ["buffers": buffers, "voiced": voicedBuffers, "peakRms": Double(round(peakRms * 10000) / 10000), "format": inputFormatDesc,
                "chars": lastText.count, "seconds": Double(round(Date().timeIntervalSince(startedAt) * 10) / 10),
                "quiet": lastVoicedAt.map { Double(round(Date().timeIntervalSince($0) * 10) / 10) } ?? -1]   // seconds since the last speech-level buffer; -1 = none yet
    }
    private func emit(_ status: String, _ extra: [String: Any]) {
        var d: [String: Any] = ["status": status]
        for (k, v) in audioInfo() { d[k] = v }
        for (k, v) in extra { d[k] = v }
        notifyListeners("listeningState", data: d)
    }

    private func begin(language: String, vocabulary: [String]) {
        guard active else { return }
        let rec = SFSpeechRecognizer(locale: Locale(identifier: language)) ?? SFSpeechRecognizer()
        guard let recognizer = rec, recognizer.isAvailable else { finish(reason: "unavailable", text: nil); return }
        self.recognizer = recognizer
        let session = AVAudioSession.sharedInstance()
        do {
            // capture configuration: mixable (never interrupts WebKit's playback session), speaker kept as the output
            try session.setCategory(.playAndRecord, mode: .default, options: [.mixWithOthers, .defaultToSpeaker, .allowBluetooth])
            sessionConfigured = true
            try session.setActive(true)
        } catch {
            finish(reason: "audio-capture", text: nil); return
        }
        let engine = AVAudioEngine()
        let input = engine.inputNode
        let format = input.outputFormat(forBus: 0)
        guard format.sampleRate > 0, format.channelCount > 0 else { finish(reason: "audio-capture", text: nil); return }   // no usable input (simulator)
        inputFormatDesc = "\(Int(format.sampleRate)) Hz × \(format.channelCount)"
        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        if #available(iOS 16.0, *) { request.addsPunctuation = false }
        if !vocabulary.isEmpty { request.contextualStrings = vocabulary }
        self.engine = engine
        self.request = request
        let mySession = sessionId
        self.task = recognizer.recognitionTask(with: request) { [weak self] result, error in
            DispatchQueue.main.async {
                guard let self = self, self.active, self.sessionId == mySession else { return }
                if let r = result {
                    let pick = SoftwaveSpeechPlugin.pickTranscript(best: r.bestTranscription.formattedString, alternatives: r.transcriptions.map { $0.formattedString }, sounds: self.sounds)
                    let text = pick.text
                    if pick.alternative { self.alternativeUsed = true }
                    if r.isFinal { self.finish(reason: "result", text: text.isEmpty ? self.lastText : text); return }
                    if text != self.lastText { self.lastText = text; self.lastChangeAt = Date(); self.emit("partial", [:]) }
                    return
                }
                if let e = error as NSError? {
                    // after we ended the audio, Apple sometimes reports the end as an error: the text heard stands
                    if self.audioEnded && !self.lastText.isEmpty { self.finish(reason: "result", text: self.lastText); return }
                    // kAFAssistantErrorDomain 1110 "No speech detected", 203 "Retry", 216/1700 when dictation is disabled or denied
                    let code = e.code
                    let reason = (code == 1110 || code == 203) ? "no-speech" : ((code == 216 || code == 1700) ? "not-allowed" : "network")
                    self.finish(reason: reason, text: nil, detail: ["errorDomain": e.domain, "errorCode": code])
                }
            }
        }
        input.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
            request.append(buffer)
            // level of this buffer (RMS over channel 0): proves speech-level audio reached the recognizer
            var rms: Float = 0
            if let ch = buffer.floatChannelData, buffer.frameLength > 0 {
                let n = Int(buffer.frameLength); var sum: Float = 0
                for i in 0..<n { let v = ch[0][i]; sum += v * v }
                rms = (sum / Float(n)).squareRoot()
            }
            DispatchQueue.main.async {
                guard let self = self, self.active, self.sessionId == mySession else { return }
                self.buffers += 1; if rms > self.voicedRms { self.voicedBuffers += 1; self.lastVoicedAt = Date() }; if rms > self.peakRms { self.peakRms = rms }
                if Date().timeIntervalSince(self.lastLevelReportAt) >= 1.0 { self.lastLevelReportAt = Date(); self.emit("level", ["rms": Double(round(rms * 10000) / 10000)]) }
            }
        }
        engine.prepare()
        do { try engine.start() } catch { finish(reason: "audio-capture", text: nil); return }
        startedAt = Date(); lastChangeAt = Date()
        emit("started", ["engineRunning": engine.isRunning, "vocabulary": vocabulary.count])
        // Build 79: a short haptic tap at the moment capture actually starts — the same moment the page's button begins
        // to pulse — so the ready moment is felt as well as seen (a word spoken before this moment is lost). No-op on
        // devices without a haptic engine (and on the simulator).
        let haptic = UIImpactFeedbackGenerator(style: .medium)
        haptic.prepare(); haptic.impactOccurred()
        guardTimer?.invalidate()
        guardTimer = Timer.scheduledTimer(withTimeInterval: guardSeconds, repeats: false) { [weak self] _ in
            DispatchQueue.main.async {
                guard let self = self, self.active else { return }
                // the guard keeps whatever was heard; only an empty transcript is a failure
                if !self.lastText.isEmpty { self.finish(reason: "result", text: self.lastText, detail: ["by": "guard"]) }
                else { self.finish(reason: "no-speech", text: nil, detail: ["by": "guard"]) }
            }
        }
        // finalisation watch: end the audio once speech has settled; wait briefly for Apple's final, else keep the partial
        watchTimer?.invalidate()
        watchTimer = Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { [weak self] _ in
            DispatchQueue.main.async {
                guard let self = self, self.active else { return }
                let now = Date()
                if self.audioEnded {
                    if now.timeIntervalSince(self.audioEndedAt) >= self.finalWaitSeconds { self.finish(reason: "result", text: self.lastText, detail: ["by": "finalWait"]) }
                    return
                }
                if !self.lastText.isEmpty, now.timeIntervalSince(self.startedAt) >= self.minSpeechSeconds {
                    let stable = now.timeIntervalSince(self.lastChangeAt)
                    let quiet = self.lastVoicedAt.map { now.timeIntervalSince($0) } ?? stable   // no speech-level buffer at all: the transcript rule alone
                    if let by = SoftwaveSpeechPlugin.endRule(stable: stable, quiet: quiet, pause: self.pauseSeconds, quietFor: self.quietSeconds, hard: self.hardStableSeconds) {
                        self.audioEnded = true; self.audioEndedAt = now
                        self.request?.endAudio()
                        self.emit("ending", ["by": by, "stable": Double(round(stable * 10) / 10), "quietFor": Double(round(quiet * 10) / 10)])
                    }
                }
            }
        }
    }

    // Build 78: choose between Apple's candidate transcriptions. Pure, so it can be tested on its own. The best transcript
    // stands whenever it already names a sound, or when no alternative is the same utterance with exactly one word
    // different, that word a known single-word sound name of 4+ letters, and the replaced word's letters within two edits
    // of it ("play P!nk" → "play pink"; "call mum" never becomes "play rain").
    static func pickTranscript(best: String, alternatives: [String], sounds: [String]) -> (text: String, alternative: Bool) {
        guard !sounds.isEmpty, !best.isEmpty else { return (best, false) }
        let soundSet = Set(sounds.map { $0.lowercased() })
        let bestWords = best.lowercased().split(separator: " ").map(String.init)
        if bestWords.contains(where: { soundSet.contains(lettersOnly($0)) }) { return (best, false) }
        for alt in alternatives where alt.lowercased() != best.lowercased() {
            let words = alt.lowercased().split(separator: " ").map(String.init)
            guard words.count == bestWords.count else { continue }
            var differing: [Int] = []
            for i in 0..<words.count where words[i] != bestWords[i] { differing.append(i) }
            guard differing.count == 1 else { continue }
            let i = differing[0]
            let altWord = lettersOnly(words[i]), bestWord = lettersOnly(bestWords[i])
            guard altWord == words[i], altWord.count >= 4, soundSet.contains(altWord), editDistance(bestWord, altWord) <= 2 else { continue }
            return (alt, true)
        }
        return (best, false)
    }
    static func lettersOnly(_ s: String) -> String { return String(s.unicodeScalars.filter { CharacterSet.letters.contains($0) }) }
    static func editDistance(_ a: String, _ b: String) -> Int {
        let x = Array(a), y = Array(b)
        if x.isEmpty { return y.count }; if y.isEmpty { return x.count }
        var prev = Array(0...y.count), cur = [Int](repeating: 0, count: y.count + 1)
        for i in 1...x.count {
            cur[0] = i
            for j in 1...y.count { cur[j] = min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x[i - 1] == y[j - 1] ? 0 : 1)) }
            swap(&prev, &cur)
        }
        return prev[y.count]
    }

    // The finalisation rule, kept pure so it can be tested on its own: "pause" when the transcript has been stable for
    // `pause` seconds and the microphone quiet for `quietFor` seconds; "noisy" when the transcript has been stable for
    // `hard` seconds whatever the microphone says; nil = keep listening.
    static func endRule(stable: TimeInterval, quiet: TimeInterval, pause: TimeInterval, quietFor: TimeInterval, hard: TimeInterval) -> String? {
        if stable >= pause && quiet >= quietFor { return "pause" }
        if stable >= hard { return "noisy" }
        return nil
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if self.active { self.finish(reason: "aborted", text: nil) }
            call.resolve()
        }
    }

    // Every end runs here, once: capture stops, the session returns to the launch configuration, the page is told.
    private func finish(reason: String, text: String?, detail: [String: Any] = [:]) {
        guard active else { return }
        active = false
        let sessionConfiguredBefore = sessionConfigured
        guardTimer?.invalidate(); guardTimer = nil
        watchTimer?.invalidate(); watchTimer = nil
        if let engine = engine {
            if engine.isRunning { engine.stop() }
            engine.inputNode.removeTap(onBus: 0)
        }
        if !audioEnded { request?.endAudio() }
        task?.cancel()
        engine = nil; request = nil; task = nil; recognizer = nil
        let session = AVAudioSession.sharedInstance()
        var restored = true
        // A session that never reached capture (permission prompt still up, recognizer unavailable) left the audio session
        // untouched: touching it here would be an activation WebKit's playback does not need.
        if sessionConfigured {
            do {
                try session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
                try session.setActive(true)
            } catch { restored = false }
            sessionConfigured = false
        }
        var d: [String: Any] = ["reason": reason, "restored": restored, "configured": sessionConfiguredBefore, "alternative": alternativeUsed, "category": session.category.rawValue,
                                "inputs": session.currentRoute.inputs.map { $0.portType.rawValue },
                                "outputs": session.currentRoute.outputs.map { $0.portType.rawValue }]
        for (k, v) in detail { d[k] = v }
        emit("stopped", d)
        if let call = pending {
            pending = nil
            if reason == "result" { call.resolve(["text": text ?? ""]) } else { call.reject(reason, reason) }
            bridge?.releaseCall(call)
        }
    }
}

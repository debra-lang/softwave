import Foundation
import AVFoundation
import Speech
import Capacitor

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
// Privacy: the audio goes only to Apple's recogniser; the page receives the text; events carry counts and levels,
// never words.
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
    private let voicedRms: Float = 0.01

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
            call.keepAlive = true
            self.pending = call
            self.active = true
            self.sessionId += 1
            self.lastText = ""; self.audioEnded = false; self.startedAt = Date(); self.lastChangeAt = Date(); self.sessionConfigured = false
            self.buffers = 0; self.voicedBuffers = 0; self.peakRms = 0; self.lastLevelReportAt = Date(); self.inputFormatDesc = ""
            self.emit("starting", [:])
            self.authorize { ok in
                guard ok else { self.finish(reason: "not-allowed", text: nil); return }
                self.begin(language: language)
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
                "chars": lastText.count, "seconds": Double(round(Date().timeIntervalSince(startedAt) * 10) / 10)]
    }
    private func emit(_ status: String, _ extra: [String: Any]) {
        var d: [String: Any] = ["status": status]
        for (k, v) in audioInfo() { d[k] = v }
        for (k, v) in extra { d[k] = v }
        notifyListeners("listeningState", data: d)
    }

    private func begin(language: String) {
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
        self.engine = engine
        self.request = request
        let mySession = sessionId
        self.task = recognizer.recognitionTask(with: request) { [weak self] result, error in
            DispatchQueue.main.async {
                guard let self = self, self.active, self.sessionId == mySession else { return }
                if let r = result {
                    let text = r.bestTranscription.formattedString
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
                self.buffers += 1; if rms > self.voicedRms { self.voicedBuffers += 1 }; if rms > self.peakRms { self.peakRms = rms }
                if Date().timeIntervalSince(self.lastLevelReportAt) >= 1.0 { self.lastLevelReportAt = Date(); self.emit("level", ["rms": Double(round(rms * 10000) / 10000)]) }
            }
        }
        engine.prepare()
        do { try engine.start() } catch { finish(reason: "audio-capture", text: nil); return }
        startedAt = Date(); lastChangeAt = Date()
        emit("started", ["engineRunning": engine.isRunning])
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
                if !self.lastText.isEmpty, now.timeIntervalSince(self.startedAt) >= self.minSpeechSeconds, now.timeIntervalSince(self.lastChangeAt) >= self.pauseSeconds {
                    self.audioEnded = true; self.audioEndedAt = now
                    self.request?.endAudio()
                    self.emit("ending", [:])
                }
            }
        }
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
        var d: [String: Any] = ["reason": reason, "restored": restored, "configured": sessionConfiguredBefore, "category": session.category.rawValue,
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

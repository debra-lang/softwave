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
// it after the promise settles. Privacy: the audio goes only to Apple's recogniser; the page receives the text.
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
    private var active = false
    private let guardSeconds: TimeInterval = 12

    // ---- availability and permissions ----
    @objc func available(_ call: CAPPluginCall) {
        let rec = SFSpeechRecognizer()
        let input = AVAudioSession.sharedInstance().isInputAvailable
        call.resolve(["available": (rec?.isAvailable ?? false) && input, "recognizer": rec != nil, "input": input])
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
    @objc func checkPermissions(_ call: CAPPluginCall) {
        call.resolve(["speechRecognition": speechStatus(), "microphone": micStatus()])
    }
    @objc func requestPermissions(_ call: CAPPluginCall) {
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
            self.notifyListeners("listeningState", data: ["status": "starting"])
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

    private func begin(language: String) {
        guard active else { return }
        let rec = SFSpeechRecognizer(locale: Locale(identifier: language)) ?? SFSpeechRecognizer()
        guard let recognizer = rec, recognizer.isAvailable else { finish(reason: "unavailable", text: nil); return }
        self.recognizer = recognizer
        let session = AVAudioSession.sharedInstance()
        do {
            // capture configuration: mixable (never interrupts WebKit's playback session), speaker kept as the output
            try session.setCategory(.playAndRecord, mode: .default, options: [.mixWithOthers, .defaultToSpeaker, .allowBluetooth])
            try session.setActive(true)
        } catch {
            finish(reason: "audio-capture", text: nil); return
        }
        let engine = AVAudioEngine()
        let input = engine.inputNode
        let format = input.outputFormat(forBus: 0)
        guard format.sampleRate > 0, format.channelCount > 0 else { finish(reason: "audio-capture", text: nil); return }   // no usable input (simulator)
        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = false
        if #available(iOS 16.0, *) { request.addsPunctuation = false }
        self.engine = engine
        self.request = request
        self.task = recognizer.recognitionTask(with: request) { [weak self] result, error in
            DispatchQueue.main.async {
                guard let self = self, self.active else { return }
                if let r = result, r.isFinal { self.finish(reason: "result", text: r.bestTranscription.formattedString); return }
                if let e = error as NSError? {
                    // kAFAssistantErrorDomain 1110 "No speech detected", 203 "Retry", 216/1700 when dictation is disabled or denied
                    let code = e.code
                    let reason = (code == 1110 || code == 203) ? "no-speech" : ((code == 216 || code == 1700) ? "not-allowed" : "network")
                    self.finish(reason: reason, text: nil)
                }
            }
        }
        input.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in request.append(buffer) }
        engine.prepare()
        do { try engine.start() } catch { finish(reason: "audio-capture", text: nil); return }
        notifyListeners("listeningState", data: ["status": "started"])
        guardTimer?.invalidate()
        guardTimer = Timer.scheduledTimer(withTimeInterval: guardSeconds, repeats: false) { [weak self] _ in
            DispatchQueue.main.async { self?.request?.endAudio(); self?.finish(reason: "no-speech", text: nil) }
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if self.active { self.finish(reason: "aborted", text: nil) }
            call.resolve()
        }
    }

    // Every end runs here, once: capture stops, the session returns to the launch configuration, the page is told.
    private func finish(reason: String, text: String?) {
        guard active else { return }
        active = false
        guardTimer?.invalidate(); guardTimer = nil
        if let engine = engine {
            if engine.isRunning { engine.stop() }
            engine.inputNode.removeTap(onBus: 0)
        }
        request?.endAudio()
        task?.cancel()
        engine = nil; request = nil; task = nil; recognizer = nil
        let session = AVAudioSession.sharedInstance()
        var restored = true
        do {
            try session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
            try session.setActive(true)
        } catch { restored = false }
        notifyListeners("listeningState", data: ["status": "stopped", "reason": reason, "restored": restored,
                                                 "category": session.category.rawValue, "inputs": session.currentRoute.inputs.map { $0.portType.rawValue },
                                                 "outputs": session.currentRoute.outputs.map { $0.portType.rawValue }])
        if let call = pending {
            pending = nil
            if reason == "result" { call.resolve(["text": text ?? ""]) } else { call.reject(reason, reason) }
            bridge?.releaseCall(call)
        }
    }
}

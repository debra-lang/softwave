import UIKit
import AVFoundation
import WebKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Sound-therapy app: audio must play with the silent switch on, keep playing in
        // the background (UIBackgroundModes audio), and duck nothing — it IS the content.
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [])
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            print("AVAudioSession setup failed: \(error)")
        }
        // After a call/Siri/alarm ends, reclaim the audio session so playback can resume.
        NotificationCenter.default.addObserver(forName: AVAudioSession.interruptionNotification,
                                               object: nil, queue: .main) { note in
            guard let info = note.userInfo,
                  let typeRaw = info[AVAudioSessionInterruptionTypeKey] as? UInt,
                  let type = AVAudioSession.InterruptionType(rawValue: typeRaw), type == .ended else { return }
            try? AVAudioSession.sharedInstance().setActive(true)
        }
        diagStart()   // DIAGNOSTIC BUILD 67: observation only (see below)
        return true
    }

    // ---- DIAGNOSTIC BUILD 67 (branch ios-66-diag only). Observation only: forwards audio-session interruptions, route
    // changes, media-services resets, secondary-audio hints, keyboard notifications and a 2 s session snapshot to the
    // page (window.__swDiagNative), where diag.js records them next to the web-layer events. Never calls setCategory,
    // setActive or anything that changes playback. The existing session handling above is unchanged.
    private var diagQueue: [String] = []
    private var diagTimer: Timer?
    private func diagWebView() -> WKWebView? {
        for scene in UIApplication.shared.connectedScenes {
            guard let ws = scene as? UIWindowScene else { continue }
            for w in ws.windows { if let v = (w.rootViewController as? CAPBridgeViewController)?.webView { return v } }
        }
        return nil
    }
    private func diagSessionState() -> [String: Any] {
        let s = AVAudioSession.sharedInstance()
        return ["category": s.category.rawValue, "mode": s.mode.rawValue, "options": s.categoryOptions.rawValue,
                "otherAudio": s.isOtherAudioPlaying, "secondaryHint": s.secondaryAudioShouldBeSilencedHint,
                "outputs": s.currentRoute.outputs.map { $0.portType.rawValue }, "inputs": s.currentRoute.inputs.map { $0.portType.rawValue },
                "volume": Double(s.outputVolume), "sampleRate": s.sampleRate, "ioBuffer": s.ioBufferDuration, "outLatency": s.outputLatency]
    }
    private func diagLog(_ type: String, _ extra: [String: Any] = [:]) {
        var o = diagSessionState(); for (k, v) in extra { o[k] = v }
        o["type"] = type; o["t"] = Int(Date().timeIntervalSince1970 * 1000)
        guard let d = try? JSONSerialization.data(withJSONObject: o), let js = String(data: d, encoding: .utf8) else { return }
        diagQueue.append(js); diagFlush()
    }
    private func diagFlush() {
        // Lines are delivered in order and kept until the page confirms it has the receiver (diag.js defines it as
        // the first script), so lines from before the page loaded — the launch line, an early interruption — are not lost.
        guard let wv = diagWebView(), !diagQueue.isEmpty else { return }
        let js = diagQueue[0]
        wv.evaluateJavaScript("(function(){ if (!window.__swDiagNative) return false; window.__swDiagNative(" + js + "); return true; })()") { [weak self] result, _ in
            guard let self = self else { return }
            if let ok = result as? Bool, ok, !self.diagQueue.isEmpty, self.diagQueue[0] == js { self.diagQueue.removeFirst(); if self.diagQueue.count > 400 { self.diagQueue.removeFirst(self.diagQueue.count - 400) }; self.diagFlush() }
        }
    }
    private func diagStart() {
        let nc = NotificationCenter.default, q = OperationQueue.main
        nc.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: q) { [weak self] n in
            var e: [String: Any] = [:]
            if let v = n.userInfo?[AVAudioSessionInterruptionTypeKey] as? NSNumber { e["interruptionType"] = v.intValue == 1 ? "began" : "ended" }
            if let v = n.userInfo?[AVAudioSessionInterruptionOptionKey] as? NSNumber { e["shouldResume"] = (v.uintValue & AVAudioSession.InterruptionOptions.shouldResume.rawValue) != 0 }
            if let v = n.userInfo?[AVAudioSessionInterruptionReasonKey] as? NSNumber { e["interruptionReason"] = v.intValue }
            self?.diagLog("interruption", e)
        }
        nc.addObserver(forName: AVAudioSession.routeChangeNotification, object: nil, queue: q) { [weak self] n in
            var e: [String: Any] = [:]
            if let v = n.userInfo?[AVAudioSessionRouteChangeReasonKey] as? NSNumber { e["routeChangeReason"] = v.intValue }
            if let prev = n.userInfo?[AVAudioSessionRouteChangePreviousRouteKey] as? AVAudioSessionRouteDescription { e["previousOutputs"] = prev.outputs.map { $0.portType.rawValue } }
            self?.diagLog("routeChange", e)
        }
        nc.addObserver(forName: AVAudioSession.mediaServicesWereResetNotification, object: nil, queue: q) { [weak self] _ in self?.diagLog("mediaServicesReset") }
        nc.addObserver(forName: AVAudioSession.silenceSecondaryAudioHintNotification, object: nil, queue: q) { [weak self] n in
            var e: [String: Any] = [:]
            if let v = n.userInfo?[AVAudioSessionSilenceSecondaryAudioHintTypeKey] as? NSNumber { e["hintType"] = v.intValue == 1 ? "begin" : "end" }
            self?.diagLog("silenceSecondaryAudioHint", e)
        }
        let kb: [(Notification.Name, String)] = [(UIResponder.keyboardWillShowNotification, "keyboardWillShow"), (UIResponder.keyboardDidShowNotification, "keyboardDidShow"),
                                                 (UIResponder.keyboardWillHideNotification, "keyboardWillHide"), (UIResponder.keyboardDidHideNotification, "keyboardDidHide")]
        for (name, label) in kb {
            nc.addObserver(forName: name, object: nil, queue: q) { [weak self] n in
                var e: [String: Any] = [:]
                if let f = (n.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? NSValue)?.cgRectValue { e["keyboardHeight"] = Double(f.height) }
                self?.diagLog(label, e)
            }
        }
        nc.addObserver(forName: UIApplication.willResignActiveNotification, object: nil, queue: q) { [weak self] _ in self?.diagLog("appWillResignActive") }
        nc.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: q) { [weak self] _ in self?.diagLog("appDidBecomeActive") }
        diagTimer = Timer.scheduledTimer(withTimeInterval: 2.0, repeats: true) { [weak self] _ in self?.diagLog("snapshot") }
        diagLog("diagStart")
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Reclaim the audio session whenever we come back to the foreground.
        try? AVAudioSession.sharedInstance().setActive(true)
        // The informational pages are real page navigations inside the web view —
        // give users the standard iOS edge-swipe to go back (idempotent to re-set).
        for scene in UIApplication.shared.connectedScenes {
            guard let ws = scene as? UIWindowScene else { continue }
            for w in ws.windows {
                (w.rootViewController as? CAPBridgeViewController)?.webView?.allowsBackForwardNavigationGestures = true
            }
        }
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration",
                                          sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}

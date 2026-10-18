import UIKit
import Capacitor

// The app's bridge view controller: registers the app-local plugins (Capacitor 8: local plugins are registered here,
// when the bridge has loaded, rather than through a Swift package).
class SoftwaveViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(SoftwaveSpeechPlugin())
    }
}

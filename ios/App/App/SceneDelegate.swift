import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = RootViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

/// The bridge with the app's own plugins registered.
class RootViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(AppIconPlugin())
    }
}

/// The home-screen icon follows the app theme (설정 → 디스플레이): 말차 is the
/// primary icon, 바나나 and 초코 are the alternate icon sets in Assets.xcassets
/// (ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES). iOS shows its own
/// "icon changed" alert, so it's only asked when the icon really changes.
@objc(AppIconPlugin)
public class AppIconPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AppIconPlugin"
    public let jsName = "AppIcon"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "set", returnType: CAPPluginReturnPromise)
    ]

    @objc func set(_ call: CAPPluginCall) {
        let name = call.getString("name") ?? "matcha"
        let target: String? = name == "banana" ? "AppIcon-Banana" : name == "choco" ? "AppIcon-Choco" : name == "strawberry" ? "AppIcon-Strawberry" : nil
        DispatchQueue.main.async {
            let app = UIApplication.shared
            guard app.supportsAlternateIcons, app.alternateIconName != target else {
                call.resolve()
                return
            }
            app.setAlternateIconName(target) { _ in call.resolve() }
        }
    }
}

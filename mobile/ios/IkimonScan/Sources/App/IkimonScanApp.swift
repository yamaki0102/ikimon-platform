import SwiftUI

@main
struct IkimonScanApp: App {
    @StateObject private var sessionManager = ScanSessionManager()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(sessionManager)
        }
    }
}

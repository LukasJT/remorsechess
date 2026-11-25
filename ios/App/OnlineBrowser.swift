import SafariServices
import SwiftUI
import WebKit

@MainActor
final class OnlineBrowser: NSObject, ObservableObject, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate {
    static let home = URL(string: "https://remorsechess.com/")!
    @Published private(set) var loading = false
    @Published private(set) var failure: String?
    @Published private(set) var canGoBack = false

    private var requestedURL = OnlineBrowser.home
    private weak var host: UIViewController?
    private var backObservation: NSKeyValueObservation?
    private var loadingObservation: NSKeyValueObservation?
    private var activeDownload: WKDownload?
    private var exportDirectory: URL?
    private var exportURL: URL?

    private(set) lazy var webView: WKWebView = {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.allowsInlineMediaPlayback = true
        configuration.applicationNameForUserAgent = "RemorseChess-iOS"
        configuration.userContentController.addUserScript(Self.lobbyClockDefault)
        let view = WKWebView(frame: .zero, configuration: configuration)
        view.navigationDelegate = self
        view.uiDelegate = self
        view.allowsBackForwardNavigationGestures = true
        view.underPageBackgroundColor = UIColor(Palette.background)
        view.scrollView.keyboardDismissMode = .interactive
        backObservation = view.observe(\.canGoBack, options: [.new]) { [weak self] _, _ in
            Task { @MainActor [weak self] in
                guard let self else { return }
                canGoBack = webView.canGoBack
            }
        }
        loadingObservation = view.observe(\.isLoading, options: [.new]) { [weak self] _, _ in
            Task { @MainActor [weak self] in
                guard let self else { return }
                loading = webView.isLoading
            }
        }
        return view
    }()

    // Apply the app default once through the site's own control so the queue uses the selected clock.
    private static let lobbyClockDefault = WKUserScript(
        source: """
        (() => {
            if (location.origin !== "https://remorsechess.com") return;
            const app = document.getElementById("app");
            if (!app) return;

            const selector = 'button[data-do="quick-clock"][aria-controls="clock-groups"]';
            const observer = new MutationObserver(applyDefault);

            function applyDefault() {
                const toggle = app.querySelector(selector);
                if (!toggle || toggle.disabled) return;
                observer.disconnect();

                if (toggle.getAttribute("aria-pressed") === "true") {
                    toggle.click();
                    if (document.activeElement?.matches(selector)) document.activeElement.blur();
                }
            }

            observer.observe(app, { childList: true });
            applyDefault();
        })();
        """,
        injectionTime: .atDocumentEnd,
        forMainFrameOnly: true,
        in: .defaultClient
    )

    static func siteURL(_ url: URL) -> URL? {
        guard var parts = URLComponents(url: url, resolvingAgainstBaseURL: false),
              parts.scheme?.lowercased() == "https",
              ["remorsechess.com", "www.remorsechess.com"].contains(parts.host?.lowercased() ?? ""),
              parts.user == nil, parts.password == nil, parts.port == nil || parts.port == 443 else { return nil }
        parts.host = "remorsechess.com"
        parts.port = nil
        return parts.url
    }

    func attach(to controller: UIViewController) {
        host = controller
    }

    func loadIfNeeded() {
        if webView.url == nil && !loading && failure == nil { open(requestedURL) }
    }

    func open(_ url: URL) {
        guard let url = Self.siteURL(url) else { return }
        let destination = documentURL(for: url)
        requestedURL = destination
        failure = nil
        webView.load(URLRequest(url: destination))
    }

    func openPage(_ fragment: String) {
        var page = URLComponents(url: Self.home, resolvingAgainstBaseURL: false)
        page?.fragment = fragment
        if let url = page?.url { open(url) }
    }

    private func documentURL(for url: URL) -> URL {
        guard var parts = URLComponents(url: url, resolvingAgainstBaseURL: false),
              parts.fragment?.hasPrefix("email=") == true else { return url }

        // The website reads the email fragment only at startup. Changing the query starts a new document.
        let current = webView.url.flatMap { URLComponents(url: $0, resolvingAgainstBaseURL: false) }
        let previousMarker = current?.queryItems?.first { $0.name == "ios-email" }?.value
        var items = (parts.queryItems ?? []).filter { $0.name != "ios-email" }
        items.append(URLQueryItem(name: "ios-email", value: previousMarker == "1" ? "2" : "1"))
        parts.queryItems = items
        return parts.url ?? url
    }

    func retry() {
        if failure == nil && webView.url != nil {
            webView.reload()
        } else {
            open(requestedURL)
        }
    }

    func goBack() { webView.goBack() }

    func openPasskeyBrowser(at url: URL? = nil) {
        let destination = (url ?? webView.url).flatMap(Self.siteURL) ?? Self.home
        guard let host, host.presentedViewController == nil else { return }
        let browser = SFSafariViewController(url: destination)
        browser.preferredBarTintColor = UIColor(Palette.panel)
        browser.preferredControlTintColor = UIColor(Palette.pink)
        browser.overrideUserInterfaceStyle = .dark
        browser.dismissButtonStyle = .done
        browser.modalPresentationStyle = .fullScreen
        host.present(browser, animated: true)
    }

    func webView(_ view: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if action.shouldPerformDownload {
            decisionHandler(.download)
            return
        }
        guard let url = action.request.url else {
            decisionHandler(.cancel)
            return
        }
        if action.targetFrame?.isMainFrame == false {
            decisionHandler(.allow)
        } else if Self.siteURL(url) != nil {
            if action.targetFrame?.isMainFrame == true { requestedURL = url }
            decisionHandler(.allow)
        } else {
            decisionHandler(.cancel)
            if action.navigationType == .linkActivated { openExternal(url) }
        }
    }

    func webView(_ view: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        guard let url = action.request.url else { return nil }
        if Self.siteURL(url) != nil {
            view.load(action.request)
        } else if action.navigationType == .linkActivated {
            openExternal(url)
        }
        return nil
    }

    private func openExternal(_ url: URL) {
        if ["https", "http", "mailto", "tel"].contains(url.scheme?.lowercased() ?? "") {
            UIApplication.shared.open(url)
        }
    }

    func webView(_ view: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        loading = true
        failure = nil
    }

    func webView(_ view: WKWebView, didFinish navigation: WKNavigation!) {
        loading = false
        canGoBack = view.canGoBack
        if let url = view.url, Self.siteURL(url) != nil { requestedURL = url }
    }

    func webView(_ view: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        handleFailure(error)
    }

    func webView(_ view: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        handleFailure(error)
    }

    func webViewWebContentProcessDidTerminate(_ view: WKWebView) {
        loading = false
        failure = "The online page closed. Reload to reconnect."
    }

    private func handleFailure(_ error: Error) {
        guard (error as NSError).code != NSURLErrorCancelled else { return }
        loading = false
        failure = "Couldn’t reach Remorse Chess. Check your connection and try again."
    }

    func webView(_ view: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
        download.delegate = self
    }

    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse,
                  suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        guard exportDirectory == nil else { completionHandler(nil); return }
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        do {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: false)
            let name = URL(fileURLWithPath: suggestedFilename).lastPathComponent
            let destination = directory.appendingPathComponent(name.isEmpty ? "remorse-game.json" : name)
            activeDownload = download
            exportDirectory = directory
            exportURL = destination
            completionHandler(destination)
        } catch {
            completionHandler(nil)
        }
    }

    func downloadDidFinish(_ download: WKDownload) {
        guard download === activeDownload else { return }
        guard let url = exportURL, let host, host.presentedViewController == nil else {
            removeExport()
            return
        }
        let share = UIActivityViewController(activityItems: [url], applicationActivities: nil)
        share.popoverPresentationController?.sourceView = host.view
        share.popoverPresentationController?.sourceRect = CGRect(
            x: host.view.bounds.midX, y: host.view.bounds.midY, width: 1, height: 1
        )
        share.completionWithItemsHandler = { [weak self] _, _, _, _ in self?.removeExport() }
        host.present(share, animated: true)
    }

    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        if download === activeDownload { removeExport() }
    }

    private func removeExport() {
        if let exportDirectory { try? FileManager.default.removeItem(at: exportDirectory) }
        activeDownload = nil
        exportDirectory = nil
        exportURL = nil
    }
}

struct OnlineWebView: UIViewControllerRepresentable {
    let browser: OnlineBrowser

    func makeUIViewController(context: Context) -> UIViewController {
        let controller = UIViewController()
        controller.view = browser.webView
        browser.attach(to: controller)
        return controller
    }

    func updateUIViewController(_ controller: UIViewController, context: Context) {}
}

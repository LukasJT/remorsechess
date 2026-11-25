import SwiftUI

@main
struct RemorseChessApp: App {
    var body: some Scene {
        WindowGroup {
            RemorseChessRoot()
                .preferredColorScheme(.dark)
        }
    }
}

private struct RemorseChessRoot: View {
    @AppStorage("remorse.offline-selected") private var offline = false
    @StateObject private var browser = OnlineBrowser()
    @State private var hasOpenedOnline = false
    @State private var localGame: GameModel?
    @State private var showLink = false
    @State private var link = ""
    @State private var pendingPasskeyLink: URL?

    var body: some View {
        ZStack {
            if !offline || hasOpenedOnline {
                onlineScreen
                    .opacity(offline ? 0 : 1)
                    .allowsHitTesting(!offline)
                    .accessibilityHidden(offline)
            }
            if offline {
                if let localGame {
                    GameView(model: localGame)
                } else {
                    ContentUnavailableView("Offline play could not start", systemImage: "exclamationmark.triangle")
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Palette.background.ignoresSafeArea())
        .safeAreaInset(edge: .bottom, spacing: 0) { navigation }
        .task(id: offline) {
            if offline, localGame == nil { localGame = try? GameModel() }
            if !offline {
                hasOpenedOnline = true
                browser.loadIfNeeded()
            }
        }
        .onOpenURL { url in
            guard let destination = OnlineBrowser.siteURL(url) else { return }
            offline = false
            browser.open(destination)
        }
        .sheet(isPresented: $showLink, onDismiss: {
            if let pendingPasskeyLink {
                self.pendingPasskeyLink = nil
                browser.openPasskeyBrowser(at: pendingPasskeyLink)
            }
            link = ""
        }) {
            linkSheet
        }
    }

    private var onlineScreen: some View {
        OnlineWebView(browser: browser)
            .overlay(alignment: .top) {
                if browser.loading {
                    ProgressView()
                        .tint(Palette.pink)
                        .padding(9)
                        .background(Palette.deep, in: Capsule())
                        .padding(.top, 8)
                        .allowsHitTesting(false)
                }
            }
            .overlay {
                if let failure = browser.failure {
                    ContentUnavailableView {
                        Label("Online unavailable", systemImage: "wifi.slash")
                    } description: {
                        Text(failure)
                    } actions: {
                        Button("Try again", action: browser.retry).buttonStyle(.borderedProminent)
                        Button("Play offline") { offline = true }.buttonStyle(.bordered)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Palette.background)
                    .tint(Palette.pink)
                }
            }
    }

    private var navigation: some View {
        HStack(spacing: 8) {
            tab("Online", icon: "globe", isOffline: false)
            tab("Offline", icon: "cpu", isOffline: true)

            if !offline {
                Menu {
                    Button("Open game or email link", systemImage: "link") { showLink = true }
                    Button("Online with a passkey", systemImage: "person.badge.key") { browser.openPasskeyBrowser() }
                    Button("Back", systemImage: "chevron.backward", action: browser.goBack)
                        .disabled(!browser.canGoBack)
                    Button("Reload", systemImage: "arrow.clockwise", action: browser.retry)
                } label: {
                    Image(systemName: "ellipsis")
                        .frame(width: 47, height: 44)
                        .background(Palette.raised, in: .rect(cornerRadius: 6))
                }
                .accessibilityLabel("Online options")
            }
        }
        .font(WebsiteFont.bold(15))
        .foregroundStyle(Palette.text)
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(Palette.deep)
        .overlay(alignment: .top) { Rectangle().fill(Palette.line).frame(height: 1) }
    }

    private func tab(_ title: String, icon: String, isOffline: Bool) -> some View {
        let selected = offline == isOffline
        return Button {
            offline = isOffline
        } label: {
            Label(title, systemImage: icon)
                .frame(maxWidth: .infinity, minHeight: 44)
                .foregroundStyle(selected ? Palette.text : Palette.muted)
                .background(selected ? Palette.selectedTab : Palette.raised, in: .rect(cornerRadius: 6))
                .overlay { RoundedRectangle(cornerRadius: 6).strokeBorder(selected ? Palette.pink : Palette.line) }
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }

    private var linkSheet: some View {
        let url = URL(string: link.trimmingCharacters(in: .whitespacesAndNewlines)).flatMap(OnlineBrowser.siteURL)
        return NavigationStack {
            Form {
                Section {
                    TextField("Remorse Chess link", text: $link)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .keyboardType(.URL)
                        .textContentType(.URL)
                } footer: {
                    Text("Paste a game invitation or an email sign-in link from remorsechess.com.")
                }
                Section {
                    Button("Open in Online") {
                        guard let url else { return }
                        browser.open(url)
                        showLink = false
                    }
                    Button("Open in passkey browser") {
                        pendingPasskeyLink = url
                        showLink = false
                    }
                }
                .disabled(url == nil)
            }
            .navigationTitle("Open link")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { showLink = false }
                }
            }
        }
        .tint(Palette.pink)
    }
}

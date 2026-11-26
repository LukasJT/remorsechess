import SwiftUI

enum Palette {
    static let background = color(0x191827)
    static let glow = color(0x35283f)
    static let panel = color(0x28243c)
    static let raised = color(0x342a47)
    static let deep = color(0x1c192d)
    static let line = color(0x655472)
    static let text = color(0xfbecdf)
    static let muted = color(0xcbbbd6)
    static let gold = color(0xf3c98b)
    static let pink = color(0xf3bad4)
    static let lavender = color(0xd6bdf0)
    static let darkInk = color(0x34213e)
    static let selectedTab = color(0x503950)
    static let mint = color(0xb6d8be)
    static let lightSquare = color(0xe0cde4)
    static let darkSquare = color(0x89749f)
    static let puzzleLight = color(0xd3b38a)
    static let puzzleDark = color(0x866372)
    static let boardFrame = color(0x5e476e)
    static let boardEdge = color(0xb295bd)
    static let selection = color(0xfff4bc)

    static func color(_ hex: UInt32) -> Color {
        Color(red: Double((hex >> 16) & 255) / 255,
              green: Double((hex >> 8) & 255) / 255,
              blue: Double(hex & 255) / 255)
    }
}

enum WebsiteFont {
    static func regular(_ size: CGFloat, relativeTo style: Font.TextStyle = .body) -> Font {
        .custom("ChakraPetch-Regular", size: size, relativeTo: style)
    }

    static func semibold(_ size: CGFloat, relativeTo style: Font.TextStyle = .subheadline) -> Font {
        .custom("ChakraPetch-SemiBold", size: size, relativeTo: style)
    }

    static func bold(_ size: CGFloat, relativeTo style: Font.TextStyle = .headline) -> Font {
        .custom("ChakraPetch-Bold", size: size, relativeTo: style)
    }

    static func mono(_ size: CGFloat) -> Font {
        .custom("IBMPlexMono-SemiBold", size: size, relativeTo: .caption)
    }
}

struct GameView: View {
    @Bindable var model: GameModel
    @State private var sheet: Sheet?
    @State private var draft = GameOptions()

    private enum Sheet: String, Identifiable {
        case setup, moves, rules, puzzles
        var id: Self { self }
    }

    var body: some View {
        GeometryReader { viewport in
            ScrollView {
                gameLayout(in: viewport.size)
                    .padding(.horizontal, 17)
                    .padding(.top, 8)
                    .padding(.bottom, 14)
                    .frame(maxWidth: .infinity)
            }
        }
        .background {
            RadialGradient(colors: [Palette.glow, Palette.background],
                           center: .init(x: 0.68, y: 0), startRadius: 10, endRadius: 520)
                .ignoresSafeArea()
        }
        .font(WebsiteFont.regular(17))
        .foregroundStyle(Palette.text)
        .tint(Palette.pink)
        .task { model.resumeBot() }
        .sheet(item: $sheet) { item in
            NavigationStack {
                Group {
                    switch item {
                    case .setup: setup
                    case .moves: moves
                    case .rules: rules
                    case .puzzles: puzzleList
                    }
                }
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Done") { sheet = nil }
                    }
                }
            }
            .font(WebsiteFont.regular(17))
            .toolbarBackground(Palette.panel, for: .navigationBar)
            .toolbarBackground(.visible, for: .navigationBar)
            .tint(Palette.pink)
        }
        .confirmationDialog("Choose an action", isPresented: Binding(
            get: { !model.choices.isEmpty },
            set: { if !$0 { model.cancelChoice() } }
        ), titleVisibility: .visible, presenting: model.choices) { choices in
            ForEach(choices, id: \.self) { choice in
                Button(choice.title) { model.confirm(choice) }
            }
        }
        .alert("Remorse Chess", isPresented: Binding(
            get: { model.error != nil },
            set: { if !$0 { model.error = nil } }
        )) {
            Button("OK", role: .cancel) { model.error = nil }
        } message: {
            Text(model.error ?? "")
        }
        .sensoryFeedback(.impact(flexibility: .soft), trigger: model.history.count) {
            old, new in new > old && model.history.last?.roll != nil
        }
    }

    @ViewBuilder
    private func gameLayout(in size: CGSize) -> some View {
        if size.width >= 650 && size.height < size.width * 0.88 {
            let boardWidth = min(480, size.height - 24, size.width * 0.54)
            HStack(alignment: .top, spacing: 20) {
                BoardView(model: model)
                    .frame(width: max(0, boardWidth))
                VStack(spacing: 11) {
                    matchHeading
                    matchControls
                }
                .frame(maxWidth: .infinity)
            }
            .frame(maxWidth: 940)
        } else {
            let controlsHeight: CGFloat = model.mode == .puzzle ? 315 : 295
            let boardWidth = size.height < 700 ? max(200, size.height - controlsHeight) : 510
            VStack(spacing: 11) {
                matchHeading
                BoardView(model: model)
                    .frame(maxWidth: boardWidth)
                matchControls
            }
            .frame(maxWidth: 510)
        }
    }

    @ViewBuilder
    private var matchHeading: some View {
        header
        modePicker
        if model.mode == .puzzle { puzzleBrief }
        status
    }

    @ViewBuilder
    private var matchControls: some View {
        if model.mode == .game { capturePanel }
        controls
        if model.mode == .game { lastMove }
    }

    private var header: some View {
        HStack(spacing: 11) {
            if let horse = Self.brandHorse {
                Image(uiImage: horse)
                    .resizable()
                    .scaledToFit()
                    .frame(width: 37, height: 42)
                    .shadow(color: Palette.deep, radius: 0, x: 2, y: 3)
                    .accessibilityHidden(true)
            }

            HStack(spacing: 5) {
                Text("REMORSE")
                Text("CHESS").foregroundStyle(Palette.lavender)
            }
            .font(WebsiteFont.bold(25, relativeTo: .title2))
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Remorse Chess")
            .accessibilityAddTraits(.isHeader)
            .minimumScaleFactor(0.58)
            .lineLimit(1)

            Spacer(minLength: 5)

            Menu {
                Button("How to play", systemImage: "book") { sheet = .rules }
            } label: {
                Image(systemName: "ellipsis")
                    .font(.system(size: 20, weight: .semibold))
                    .frame(width: 46, height: 46)
                    .background(Palette.raised, in: .rect(cornerRadius: 6))
                    .overlay { RoundedRectangle(cornerRadius: 6).strokeBorder(Palette.line) }
            }
            .accessibilityLabel("More options")
        }
    }

    private static let brandHorse: UIImage? = {
        Bundle.main.url(forResource: "horse", withExtension: "png", subdirectory: "Brand")
            .flatMap { UIImage(contentsOfFile: $0.path) }
    }()

    private var modePicker: some View {
        HStack(spacing: 5) {
            modeButton("Play", icon: "checkerboard.rectangle", mode: .game)
            modeButton("Puzzles", icon: "puzzlepiece", mode: .puzzle)
        }
        .padding(4)
        .background(Palette.deep, in: .rect(cornerRadius: 7))
        .overlay { RoundedRectangle(cornerRadius: 7).strokeBorder(Palette.line) }
    }

    private func modeButton(_ title: String, icon: String, mode: GameModel.Mode) -> some View {
        let active = model.mode == mode
        return Button {
            model.switchMode(to: mode)
        } label: {
            Label(title, systemImage: icon)
                .font(WebsiteFont.bold(16))
                .frame(maxWidth: .infinity, minHeight: 44)
                .foregroundStyle(active ? Palette.text : Palette.muted)
                .background(active ? Palette.selectedTab : Palette.raised, in: .rect(cornerRadius: 5))
                .overlay { RoundedRectangle(cornerRadius: 5).strokeBorder(active ? Palette.pink : Palette.line) }
                .overlay(alignment: .bottom) {
                    if active {
                        Capsule().fill(Palette.pink).frame(height: 2).padding(.horizontal, 4)
                    }
                }
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(active ? .isSelected : [])
    }

    private var puzzleBrief: some View {
        HStack(alignment: .center, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(model.practice.lesson.title)
                    .font(WebsiteFont.bold(21, relativeTo: .title3))
                    .accessibilityAddTraits(.isHeader)
                Text(model.practice.lesson.goal)
                    .font(WebsiteFont.regular(16, relativeTo: .subheadline))
                    .foregroundStyle(Palette.muted)
            }
            Spacer(minLength: 0)
            die(model.practice.lesson.face)
                .accessibilityLabel("Puzzle capture roll \(model.practice.lesson.face)")
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 4)
    }

    private var status: some View {
        HStack(spacing: 10) {
            Circle()
                .fill(model.position.side == .white ? Palette.text : Palette.darkInk)
                .overlay { Circle().strokeBorder(Palette.muted, lineWidth: 1) }
                .frame(width: 12, height: 12)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 3) {
                Text(statusTitle).font(WebsiteFont.bold(18)).accessibilityIdentifier("turn-status")
                if let statusDetail {
                    Text(statusDetail).font(WebsiteFont.regular(14, relativeTo: .footnote)).foregroundStyle(Palette.muted)
                }
            }

            Spacer(minLength: 4)

            if model.thinking {
                ProgressView().controlSize(.small)
            } else if model.mode == .game {
                Text("TURN \((model.position.turn + 1) / 2)")
                    .font(WebsiteFont.mono(11))
                    .tracking(1.2)
                    .foregroundStyle(Palette.darkInk)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Palette.lavender, in: .rect(cornerRadius: 4))
                    .fixedSize()
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 11)
        .frame(minHeight: 49)
        .background(Palette.panel, in: .rect(cornerRadius: 6))
        .overlay(alignment: .leading) {
            RoundedRectangle(cornerRadius: 2).fill(Palette.pink)
                .frame(width: 3).padding(.vertical, 2)
        }
        .overlay { RoundedRectangle(cornerRadius: 6).strokeBorder(Palette.pink.opacity(0.7)) }
    }

    private var statusTitle: String {
        if model.mode == .puzzle, model.practice.complete { return "Puzzle solved" }
        if let result = model.position.result {
            return result.winner.map { "\($0.title) wins" } ?? "Draw"
        }
        if model.thinking { return "Computer thinking" }
        if model.position.bonus != nil { return "\(model.position.side.title) has a bonus move" }
        return "\(model.position.side.title) to move"
    }

    private var statusDetail: String? {
        if let feedback = model.feedback { return feedback }
        if model.mode == .puzzle && model.practice.complete { return nil }
        if let result = model.position.result { return result.reason }
        if model.position.bonus != nil { return "Move the highlighted piece again." }
        if model.position.check { return "In check" }
        if model.mode == .game {
            return model.match.options.opponent == .local
                ? "Pass & play · Untimed"
                : "\(model.match.options.difficulty.title) · You play \(model.match.options.human.title)"
        }
        return nil
    }

    private var capturePanel: some View {
        let capture = model.history.last { $0.capture != nil }
        return HStack(spacing: 12) {
            die(capture?.captureState?.originalRoll)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 3) {
                Text(capture.map { $0.roll == nil ? "Last capture" : "Rolled \($0.roll ?? 0)" } ?? "First capture rolls the die")
                    .font(WebsiteFont.bold(16))
                Text(capture?.captureState?.mood.title ?? "Each piece rolls once per game.")
                    .font(WebsiteFont.regular(14, relativeTo: .footnote))
                    .foregroundStyle(Palette.muted)
            }

            Spacer(minLength: 4)
            if let capture {
                Text(capture.text)
                    .font(WebsiteFont.mono(12))
                    .foregroundStyle(Palette.gold)
                    .lineLimit(1)
            } else {
                Button {
                    sheet = .rules
                } label: {
                    Image(systemName: "info.circle").frame(width: 44, height: 44)
                }
                .buttonStyle(.plain)
                .foregroundStyle(Palette.gold)
                .accessibilityLabel("Capture rules")
            }
        }
        .padding(.horizontal, 13)
        .padding(.vertical, 9)
        .frame(minHeight: 61)
        .background(Palette.panel, in: .rect(cornerRadius: 7))
        .overlay { RoundedRectangle(cornerRadius: 7).strokeBorder(Palette.line) }
        .compositingGroup()
        .shadow(color: Palette.deep, radius: 0, y: 3)
    }

    private func die(_ face: Int?) -> some View {
        let patterns = [[], [4], [0, 8], [0, 4, 8], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]]
        let pips = patterns[face ?? 5]
        return Grid(horizontalSpacing: 3, verticalSpacing: 3) {
            ForEach(0..<3) { row in
                GridRow {
                    ForEach(0..<3) { column in
                        Circle().fill(pips.contains(row * 3 + column) ? Palette.gold : .clear)
                            .frame(width: 4, height: 4)
                    }
                }
            }
        }
        .frame(width: 37, height: 37)
        .background(Palette.deep, in: .rect(cornerRadius: 2))
        .overlay { RoundedRectangle(cornerRadius: 2).strokeBorder(Palette.gold, lineWidth: 2.5) }
        .compositingGroup()
        .shadow(color: Palette.deep, radius: 0, x: 1, y: 2)
    }

    private var controls: some View {
        HStack(spacing: 8) {
            if model.mode == .game {
                control("New game", icon: "plus", prominent: true) {
                    draft = model.match.options
                    sheet = .setup
                }
                control("Moves", icon: "list.bullet") { sheet = .moves }
                control("Flip", icon: "arrow.up.arrow.down") { model.flip() }
            } else {
                control("Browse", icon: "list.bullet", prominent: true) { sheet = .puzzles }
                control("Hint", icon: "lightbulb") { model.revealHint() }.disabled(model.practice.complete)
                control("Reset", icon: "arrow.counterclockwise") { model.openPuzzle(model.practice.lesson.id) }
            }
        }
    }

    private func control(_ label: String, icon: String, prominent: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Label(label, systemImage: icon)
                .font(WebsiteFont.semibold(16))
                .lineLimit(1)
                .minimumScaleFactor(0.8)
                .frame(maxWidth: .infinity, minHeight: 45)
                .foregroundStyle(prominent ? Palette.darkInk : Palette.text)
                .background {
                    RoundedRectangle(cornerRadius: 6).fill(
                        LinearGradient(colors: prominent ? [Palette.color(0xfad0e2), Palette.color(0xedacc8)]
                                       : [Palette.raised, Palette.raised],
                                       startPoint: .top, endPoint: .bottom)
                    )
                }
                .overlay { RoundedRectangle(cornerRadius: 6).strokeBorder(prominent ? Palette.color(0xffdeeb) : Palette.line) }
                .compositingGroup()
                .shadow(color: Palette.deep, radius: 0, y: 2)
        }
        .buttonStyle(.borderedAction)
    }

    @ViewBuilder private var lastMove: some View {
        if let event = model.history.last {
            let removed = event.vanished.map { "\($0.side.title) \($0.kind.title.lowercased())" }
            HStack {
                Label(event.text, systemImage: "arrow.turn.down.right")
                    .font(WebsiteFont.mono(12))
                Spacer()
                if !removed.isEmpty {
                    Text("Lost to remorse · \(removed.joined(separator: ", "))")
                        .font(WebsiteFont.regular(12, relativeTo: .caption))
                }
            }
            .foregroundStyle(Palette.muted)
            .padding(.horizontal, 4)
        }
    }

    private var setup: some View {
        Form {
            Picker("Opponent", selection: $draft.opponent) {
                ForEach(Opponent.allCases) { Text($0.title).tag($0) }
            }
            if draft.opponent == .bot {
                Picker("Difficulty", selection: $draft.difficulty) {
                    ForEach(Difficulty.allCases) { Text($0.title).tag($0) }
                }
                Picker("Your side", selection: $draft.human) {
                    ForEach(Side.allCases) { Text($0.title).tag($0) }
                }
            }
            Section {
                Button("Start untimed game") {
                    model.start(draft)
                    sheet = nil
                }
                .fontWeight(.semibold)
            } footer: {
                if !model.match.history.isEmpty && model.match.position.result == nil {
                    Text("Starting a new game replaces the saved match.")
                }
            }
        }
        .scrollContentBackground(.hidden)
        .background(Palette.deep)
        .navigationTitle("New game")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var moves: some View {
        List {
            if model.history.isEmpty {
                ContentUnavailableView("No moves yet", systemImage: "list.bullet")
            } else {
                ForEach(Array(model.history.enumerated()), id: \.offset) { _, event in
                    VStack(alignment: .leading, spacing: 5) {
                        Text("\(event.side.title) · \(event.text)").font(WebsiteFont.mono(16))
                        if let roll = event.roll, let state = event.captureState {
                            Text("Rolled \(roll) · \(state.mood.title)").foregroundStyle(.secondary)
                        }
                        if !event.vanished.isEmpty {
                            Text("Lost to remorse · " + event.vanished.map {
                                "\($0.side.title) \($0.kind.title.lowercased())"
                            }.joined(separator: ", "))
                            .foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
        .scrollContentBackground(.hidden)
        .background(Palette.deep)
        .navigationTitle("Moves")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var puzzleList: some View {
        List {
            if let daily = model.puzzles.first(where: { $0.id == model.dailyID }) {
                Section("Daily puzzle") { puzzleRow(daily) }
            }
            Section("Practice · \(model.solved.count) of \(model.puzzles.count) solved") {
                ForEach(model.puzzles) { puzzleRow($0) }
            }
        }
        .scrollContentBackground(.hidden)
        .background(Palette.deep)
        .navigationTitle("Puzzles")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func puzzleRow(_ puzzle: PuzzleSummary) -> some View {
        Button {
            model.openPuzzle(puzzle.id)
            sheet = nil
        } label: {
            HStack {
                Text(puzzle.displayTitle).foregroundStyle(Palette.text)
                Spacer()
                if model.solved.contains(puzzle.id) {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(Palette.mint)
                        .accessibilityLabel("Solved")
                }
            }
        }
    }

    private var rules: some View {
        List {
            Section("The first capture") {
                Text("Each piece rolls once, on its first capture. Promoting or absolving a piece preserves its roll.")
                rule("1 · Devastated", "The piece is frozen. A friendly bishop has the owner’s next three turns to absolve it before it disappears.")
                rule("2–3 · Guilt-ridden", "The piece can move, but cannot capture until absolved.")
                rule("4–5 · Unaffected", "The piece moves and captures normally.")
                rule("6 · Psychopath", "If the piece captures on its first action, it must move again when a legal move exists. On its third capture it gains bloodlust, allowing only captures, including friendly pieces.")
            }
            Section("Absolution and victory") {
                rule("Absolve a piece", "Select a friendly bishop next to a devastated or guilt-ridden piece, including diagonally. Tap the marked piece and choose Absolve. This spends the turn.")
                rule("Win the game", "Checkmate wins. A legal bonus move can also capture the opposing king to win immediately. Losing your own king to remorse loses the game.")
            }
        }
        .scrollContentBackground(.hidden)
        .background(Palette.deep)
        .navigationTitle("How to play")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func rule(_ title: String, _ detail: String) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(title).fontWeight(.semibold)
            Text(detail).foregroundStyle(.secondary)
        }
        .padding(.vertical, 3)
    }
}

private struct ActionButtonStyle: ButtonStyle {
    @Environment(\.isEnabled) private var enabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .opacity(enabled ? (configuration.isPressed ? 0.72 : 1) : 0.45)
    }
}

private extension ButtonStyle where Self == ActionButtonStyle {
    static var borderedAction: Self { .init() }
}

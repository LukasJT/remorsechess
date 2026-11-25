import Foundation
import Observation

enum Opponent: String, Codable, CaseIterable, Identifiable {
    case local, bot

    var id: Self { self }
    var title: String { self == .local ? "Pass & play" : "Computer" }
}

struct GameOptions: Codable {
    var opponent: Opponent = .bot
    var difficulty: Difficulty = .tactical
    var human: Side = .white
}

@MainActor @Observable
final class GameModel {
    enum Mode { case game, puzzle }

    struct Match: Codable {
        var options: GameOptions
        var position: Position
        var history: [MoveEvent] = []
    }

    struct Practice {
        let lesson: Puzzle
        var position: Position
        var history: [MoveEvent] = []
        var hint = false

        var complete: Bool { history.count == lesson.line.count }
        var expectedMove: String? { complete ? nil : lesson.line[history.count] }
    }

    private static let matchKey = "remorse.local-match.v1"
    private static let solvedKey = "remorse.solved-puzzles.v1"
    private let engine: Engine
    private(set) var match: Match
    private(set) var practice: Practice
    private(set) var solved: Set<Int>
    let puzzles: [PuzzleSummary]
    private(set) var mode: Mode = .game
    private(set) var selected: Int?
    private(set) var choices: [Action] = []
    private(set) var flipped = false
    private(set) var thinking = false
    private(set) var feedback: String?
    var error: String?
    @ObservationIgnored private var botTask: Task<Void, Never>?

    init() throws {
        let engine = try Engine()
        self.engine = engine
        puzzles = try engine.puzzles()
        let defaults = UserDefaults.standard
        if let data = defaults.data(forKey: Self.matchKey),
           let saved = try? JSONDecoder().decode(Match.self, from: data) {
            match = saved
        } else {
            match = try Match(options: .init(), position: engine.initial())
        }
        let daily = try engine.puzzle(id: Self.dailyPuzzle(count: puzzles.count))
        practice = Practice(lesson: daily, position: daily.position)
        solved = Set(defaults.array(forKey: Self.solvedKey) as? [Int] ?? [])
        orientAndSelect()
    }

    var position: Position { mode == .game ? match.position : practice.position }
    var history: [MoveEvent] { mode == .game ? match.history : practice.history }
    var pieces: [Int: Piece] { Dictionary(uniqueKeysWithValues: position.pieces.map { ($0.square, $0) }) }
    var selectedActions: [Action] { position.actions.filter { $0.from == selected && $0.from != nil } }
    var hintSquare: String? { practice.hint ? practice.expectedMove.map { String($0.prefix(2)) } : nil }
    var canPlay: Bool { position.result == nil && !isBotTurn && !(mode == .puzzle && practice.complete) }
    var isBotTurn: Bool {
        mode == .game && match.options.opponent == .bot && match.position.result == nil
            && match.position.side != match.options.human
    }
    var dailyID: Int { Self.dailyPuzzle(count: puzzles.count) }

    private static func dailyPuzzle(count: Int) -> Int {
        let utcDay = Int(Date().timeIntervalSince1970 / 86_400)
        return (utcDay * 17) % count
    }

    func switchMode(to next: Mode) {
        guard mode != next else { return }
        stopBot()
        mode = next
        orientAndSelect()
        resumeBot()
    }

    func start(_ options: GameOptions) {
        do {
            let position = try engine.initial()
            stopBot()
            match = Match(options: options, position: position)
            mode = .game
            save()
            orientAndSelect()
            resumeBot()
        } catch { self.error = error.localizedDescription }
    }

    func openPuzzle(_ id: Int) {
        do {
            let lesson = try engine.puzzle(id: id)
            practice = Practice(lesson: lesson, position: lesson.position)
            orientAndSelect()
        } catch { self.error = error.localizedDescription }
    }

    func revealHint() {
        guard !practice.complete else { return }
        practice.hint = true
        feedback = "Try the highlighted piece."
    }

    func flip() { flipped.toggle() }

    func tap(_ square: Int) {
        guard canPlay else { return }
        feedback = nil
        let options = selectedActions.filter { $0.to == square }
        if options.count == 1, let choice = options.first {
            if choice.type == .absolve { choices = options }
            else { apply(choice) }
        } else if !options.isEmpty {
            choices = options
        } else if position.bonus == nil {
            selected = selected != square && pieces[square]?.side == position.side ? square : nil
        }
    }

    func confirm(_ action: Action) {
        guard choices.contains(action) else { return }
        choices = []
        apply(action)
    }

    func cancelChoice() { choices = [] }

    private func apply(_ action: Action) {
        if mode == .puzzle {
            guard let from = action.from, let to = action.to,
                  squareName(from) + squareName(to) == practice.expectedMove else {
                selected = bonusSquare
                feedback = "Try another move."
                return
            }
        }

        do {
            let face = mode == .puzzle ? practice.lesson.face : Int.random(in: 1...6)
            guard let move = try engine.play(action, in: position, face: face) else {
                feedback = "That move is no longer available."
                return
            }
            if mode == .game {
                match.position = move.position
                match.history.append(move.event)
                save()
            } else {
                practice.position = move.position
                practice.history.append(move.event)
                practice.hint = false
                if practice.complete {
                    solved.insert(practice.lesson.id)
                    UserDefaults.standard.set(solved.sorted(), forKey: Self.solvedKey)
                }
            }
            selected = bonusSquare
            feedback = nil
            resumeBot()
        } catch { self.error = error.localizedDescription }
    }

    func resumeBot() {
        guard isBotTurn, botTask == nil else { return }
        let snapshot = match.position.snapshot
        let difficulty = match.options.difficulty
        thinking = true
        botTask = Task { [weak self] in
            let search = Task.detached(priority: .userInitiated) {
                try Engine().botMove(snapshot: snapshot, difficulty: difficulty)
            }
            let result = await search.result
            guard !Task.isCancelled, let self else { return }
            botTask = nil
            thinking = false
            guard isBotTurn, match.position.snapshot == snapshot else { return }
            switch result {
            case .success(let action):
                if let action { apply(action) }
                else { error = "The computer could not find a move." }
            case .failure(let failure): error = failure.localizedDescription
            }
        }
    }

    private func stopBot() {
        botTask?.cancel()
        botTask = nil
        thinking = false
    }

    private var bonusSquare: Int? { position.pieces.first { $0.id == position.bonus }?.square }

    private func orientAndSelect() {
        flipped = mode == .puzzle ? practice.lesson.position.side == .black
            : match.options.opponent == .bot && match.options.human == .black
        selected = bonusSquare
        choices = []
        feedback = nil
    }

    private func save() {
        if let data = try? JSONEncoder().encode(match) {
            UserDefaults.standard.set(data, forKey: Self.matchKey)
        }
    }
}

import Foundation
import JavaScriptCore

enum Side: String, Codable, CaseIterable, Identifiable {
    case white, black

    var id: Self { self }
    var title: String { rawValue.capitalized }
    var opposite: Self { self == .white ? .black : .white }
}

enum Kind: String, Codable, Identifiable {
    case pawn = "p", knight = "n", bishop = "b", rook = "r", queen = "q", king = "k"

    var id: Self { self }
    var title: String {
        switch self {
        case .pawn: "Pawn"
        case .knight: "Knight"
        case .bishop: "Bishop"
        case .rook: "Rook"
        case .queen: "Queen"
        case .king: "King"
        }
    }
}

enum Mood: String, Codable {
    case normal, devastated, guilty, bloodlust
    case berserker = "psychopath"

    var title: String {
        switch self {
        case .normal: "Unaffected"
        case .devastated: "Devastated"
        case .guilty: "Guilt-ridden"
        case .berserker: "Berserker"
        case .bloodlust: "Bloodlust"
        }
    }

    var symbol: String {
        switch self {
        case .normal: ""
        case .devastated: "!"
        case .guilty: "×"
        case .berserker: "+"
        case .bloodlust: "▲"
        }
    }
}

struct Piece: Codable, Identifiable {
    let id: Int
    let side: Side
    let kind: Kind
    let square: Int
    let mood: Mood
    let roll: Int
    let rescue: Int
}

struct Action: Codable, Hashable {
    enum MoveType: String, Codable { case move, absolve, end }

    let type: MoveType
    let from: Int?
    let to: Int?
    let promotion: Kind?

    var title: String {
        if let promotion { return "Promote to \(promotion.title)" }
        switch type {
        case .move: return "Move"
        case .absolve: return "Absolve"
        case .end: return "End turn"
        }
    }
}

struct Position: Codable {
    struct Outcome: Codable {
        let winner: Side?
        let reason: String
    }

    let snapshot: String
    let pieces: [Piece]
    let side: Side
    let turn: Int
    let bonus: Int?
    let check: Bool
    let result: Outcome?
    let actions: [Action]
}

struct MoveEvent: Codable {
    struct CaptureState: Codable {
        let mood: Mood
        let originalRoll: Int
        let kills: Int
    }

    let side: Side
    let turn: Int
    let action: Action
    let text: String
    let roll: Int?
    let capture: Piece?
    let captureState: CaptureState?
    let vanished: [Piece]
}

struct PlayedMove: Decodable {
    let position: Position
    let event: MoveEvent
}

struct PuzzleSummary: Decodable, Identifiable {
    let id: Int
    let title: String
    let variation: Int
    var displayTitle: String { variation == 1 ? title : "\(title) · Variation \(variation)" }
}

struct Puzzle: Decodable {
    let id: Int
    let title: String
    let goal: String
    let face: Int
    let line: [String]
    let position: Position
}

enum Difficulty: String, Codable, CaseIterable, Identifiable {
    case rookie, tactical, expert

    var id: Self { self }
    var title: String {
        switch self {
        case .rookie: "Rookie"
        case .tactical: "Tactician"
        case .expert: "Grandmaster"
        }
    }
}

func squareName(_ square: Int) -> String {
    let files = Array("abcdefgh")
    return "\(files[square % 8])\(square / 8 + 1)"
}

final class Engine {
    private enum EngineError: LocalizedError {
        case missingBundle, invalidResponse(String)

        var errorDescription: String? {
            switch self {
            case .missingBundle: "The bundled game engine could not be loaded."
            case .invalidResponse(let detail): "Game engine error. \(detail)"
            }
        }
    }

    private struct Empty: Encodable {}
    private struct PuzzleInput: Encodable { let id: Int }
    private struct MoveInput: Encodable {
        let snapshot: String
        let action: Action
        let face: Int
    }
    private struct BotInput: Encodable {
        let snapshot: String
        let difficulty: Difficulty
    }

    private let context: JSContext
    private let bridge: JSValue

    init() throws {
        guard let url = Bundle.main.url(forResource: "RemorseEngine", withExtension: "js"),
              let context = JSContext() else { throw EngineError.missingBundle }
        context.evaluateScript(try String(contentsOf: url, encoding: .utf8), withSourceURL: url)
        guard let bridge = context.objectForKeyedSubscript("RemorseEngine"), !bridge.isUndefined else {
            throw EngineError.invalidResponse(context.exception?.toString() ?? "The bridge is unavailable.")
        }
        self.context = context
        self.bridge = bridge
    }

    func initial() throws -> Position {
        try request("initial", Empty())
    }

    func puzzles() throws -> [PuzzleSummary] {
        try request("puzzles", Empty())
    }

    func puzzle(id: Int) throws -> Puzzle {
        try request("puzzle", PuzzleInput(id: id))
    }

    func play(_ action: Action, in position: Position, face: Int) throws -> PlayedMove? {
        try request("play", MoveInput(snapshot: position.snapshot, action: action, face: face))
    }

    func botMove(snapshot: String, difficulty: Difficulty) throws -> Action? {
        try request("bot", BotInput(snapshot: snapshot, difficulty: difficulty))
    }

    private func request<Input: Encodable, Output: Decodable>(_ command: String, _ input: Input) throws -> Output {
        let payload = String(decoding: try JSONEncoder().encode(input), as: UTF8.self)
        context.exception = nil
        let response = bridge.invokeMethod("request", withArguments: [command, payload])
        if let exception = context.exception {
            throw EngineError.invalidResponse(exception.toString())
        }
        guard let response, response.isString else {
            throw EngineError.invalidResponse("Empty response to \(command).")
        }
        return try JSONDecoder().decode(Output.self, from: Data(response.toString().utf8))
    }
}

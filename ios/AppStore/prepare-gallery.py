"""Set up repeatable scenes in a disposable simulator checkout."""
from pathlib import Path


def replace_once(path, before, after):
    source = path.read_text(encoding="utf-8")
    if source.count(before) != 1:
        raise ValueError(f"Expected exactly one scene anchor in {path}")
    path.write_text(source.replace(before, after, 1), encoding="utf-8")


root = Path("ios/App/RemorseChessApp.swift")
model = Path("ios/App/GameModel.swift")
replace_once(root, 'private var offline = false', 'private var offline = true')
replace_once(root, 'if offline, localGame == nil { localGame = try? GameModel() }', '''
            if offline, localGame == nil {
                localGame = try? GameModel()
                localGame?.setUpGalleryScene(ProcessInfo.processInfo.environment["REMORSE_GALLERY_SCENE"])
            }''')
replace_once(model, 'practice.lesson.face : Int.random(in: 1...6)', '''
                practice.lesson.face : (ProcessInfo.processInfo.environment["REMORSE_GALLERY_SCENE"] == "capture" ? 6 : Int.random(in: 1...6))''')
with model.open("a", encoding="utf-8") as file:
    file.write('''

extension GameModel {
    func setUpGalleryScene(_ scene: String?) {
        switch scene {
        case "beginner":
            start(.init(opponent: .bot, difficulty: .rookie))
            tap(12)
            precondition(selectedActions.contains { $0.to == 28 }, "Rookie game did not start with legal moves")
        case "capture":
            start(.init(opponent: .local))
            for square in [12, 28, 51, 35, 28, 35] { tap(square) }
            precondition(match.history.last?.roll == 6 && position.bonus != nil, "The first capture did not apply the die roll")
            let restored = try? GameModel()
            precondition(restored?.position.snapshot == position.snapshot, "The game did not restore after saving")
        case "friends":
            start(.init(opponent: .local))
            for square in [12, 28, 52, 36, 6, 21, 57, 42, 5, 33, 48] { tap(square) }
            precondition(match.history.count == 5 && position.side == .black, "Pass and play did not alternate turns")
        case "puzzle":
            switchMode(to: .puzzle)
            openPuzzle(dailyID)
            revealHint()
            precondition(practice.lesson.id == dailyID && hintSquare != nil, "The daily puzzle or hint did not load")
        default:
            break
        }
    }
}
''')

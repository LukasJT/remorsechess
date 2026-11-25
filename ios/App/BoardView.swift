import SwiftUI

struct BoardView: View {
    let model: GameModel

    var body: some View {
        let pieces = model.pieces
        let targets = Dictionary(grouping: model.selectedActions, by: \.to)
        let previous = model.history.last?.action
        let isPuzzle = model.mode == .puzzle
        let hint = isPuzzle ? model.hintSquare : nil
        let checkedKing = model.position.check
            ? model.position.pieces.first { $0.kind == .king && $0.side == model.position.side }?.square : nil

        GeometryReader { geometry in
            let cell = geometry.size.width / 8
            VStack(spacing: 0) {
                ForEach(0..<8) { row in
                    HStack(spacing: 0) {
                        ForEach(0..<8) { column in
                            let square = model.flipped ? row * 8 + 7 - column : (7 - row) * 8 + column
                            let name = squareName(square)
                            let piece = pieces[square]
                            let actions = targets[square] ?? []
                            let absolves = actions.contains { $0.type == .absolve }
                            let moves = actions.contains { $0.type == .move }
                            let light = (row + column).isMultiple(of: 2)

                            Button {
                                model.tap(square)
                            } label: {
                                tile(
                                    name: name, piece: piece, light: light, column: column, row: row,
                                    selected: model.selected == square, hinted: hint == name,
                                    last: previous?.from == square || previous?.to == square,
                                    checked: checkedKing == square, isPuzzle: isPuzzle,
                                    moves: moves, absolves: absolves, size: cell
                                )
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel(squareLabel(name, piece: piece))
                            .accessibilityHint(absolves ? "Absolution available" : moves ? "Legal destination" : "")
                            .accessibilityAddTraits(model.selected == square ? .isSelected : [])
                            .accessibilityIdentifier("square-\(name)")
                        }
                    }
                }
            }
        }
        .aspectRatio(1, contentMode: .fit)
        .padding(5)
        .background(Palette.boardFrame, in: .rect(cornerRadius: 5))
        .overlay { RoundedRectangle(cornerRadius: 5).strokeBorder(Palette.boardEdge) }
        .compositingGroup()
        .shadow(color: Palette.deep, radius: 0, y: 4)
        .shadow(color: Palette.deep.opacity(0.45), radius: 10, y: 8)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Chessboard")
    }

    private func tile(
        name: String, piece: Piece?, light: Bool, column: Int, row: Int,
        selected: Bool, hinted: Bool, last: Bool, checked: Bool, isPuzzle: Bool,
        moves: Bool, absolves: Bool, size: CGFloat
    ) -> some View {
        let squareColor = isPuzzle
            ? (light ? Palette.puzzleLight : Palette.puzzleDark)
            : (light ? Palette.lightSquare : Palette.darkSquare)
        return ZStack {
            checked ? Palette.color(0xc15f77) : squareColor
            if !isPuzzle {
                BoardHatching()
                    .stroke(Palette.color(0x48305b).opacity(0.10), lineWidth: 0.8)
                    .clipped()
            }
            if last {
                Rectangle().strokeBorder(Palette.gold.opacity(0.64), lineWidth: 2.5)
            }
            if selected || hinted {
                Rectangle().strokeBorder(selected ? Palette.selection : Palette.mint, lineWidth: 3.5)
            }

            if let piece {
                PieceArt.image(side: piece.side, kind: piece.kind)
                    .resizable()
                    .interpolation(.high)
                    .scaledToFit()
                    .frame(width: size * 0.86, height: size * 0.86)
                    .shadow(color: Palette.deep.opacity(0.43), radius: 0, x: 1, y: 2)
                    .opacity(piece.mood == .devastated ? 0.68 : 1)
                if piece.mood != .normal {
                    Text(piece.rescue > 0 ? "\(piece.rescue)" : piece.mood.symbol)
                        .font(.custom("IBMPlexMono-SemiBold", fixedSize: size * 0.22))
                        .foregroundStyle(Palette.text)
                        .frame(width: size * 0.32, height: size * 0.32)
                        .background(moodColor(piece.mood), in: .rect(cornerRadius: 3))
                        .overlay { RoundedRectangle(cornerRadius: 3).strokeBorder(Palette.text.opacity(0.8)) }
                        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
                        .padding(2)
                }
            }
            if moves && piece == nil {
                Circle().fill(Palette.darkInk.opacity(0.65)).frame(width: size * 0.22)
            }
            if absolves || (moves && piece != nil) {
                Circle()
                    .strokeBorder(absolves ? Palette.mint : Palette.darkInk, lineWidth: 2.5)
                    .padding(2)
            }

            if column == 0 {
                coordinate(String(name.suffix(1)), light: light, size: size)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
                    .padding(3)
            }
            if row == 7 {
                coordinate(String(name.prefix(1)), light: light, size: size)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomTrailing)
                    .padding(3)
            }
        }
        .frame(width: size, height: size)
        .contentShape(Rectangle())
    }

    private func coordinate(_ value: String, light: Bool, size: CGFloat) -> some View {
        Text(value)
            .font(.custom("IBMPlexMono-SemiBold", fixedSize: size * 0.19))
            .foregroundStyle(light ? Palette.darkInk : Palette.text)
    }

    private func moodColor(_ mood: Mood) -> Color {
        switch mood {
        case .devastated: Palette.color(0x613846)
        case .guilty: Palette.color(0x543c8a)
        case .psychopath, .bloodlust: Palette.color(0x98283a)
        case .normal: Palette.deep
        }
    }

    private func squareLabel(_ name: String, piece: Piece?) -> String {
        guard let piece else { return "\(name), empty" }
        var label = "\(name), \(piece.side.title) \(piece.kind.title.lowercased())"
        if piece.mood != .normal { label += ", \(piece.mood.title)" }
        if piece.rescue > 0 { label += ", \(piece.rescue) turns to absolve" }
        return label
    }
}


private struct BoardHatching: Shape {
    func path(in rect: CGRect) -> Path {
        let run = rect.height * 0.625
        var path = Path()
        for x in stride(from: -run, through: rect.width, by: 5.9) {
            path.move(to: CGPoint(x: x, y: rect.maxY))
            path.addLine(to: CGPoint(x: x + run, y: rect.minY))
        }
        return path
    }
}

enum PieceArt {
    private static let images: [String: UIImage] = {
        let urls = Bundle.main.urls(forResourcesWithExtension: "png", subdirectory: "Pieces") ?? []
        return Dictionary(uniqueKeysWithValues: urls.compactMap { url in
            guard let image = UIImage(contentsOfFile: url.path) else { return nil }
            return (url.deletingPathExtension().lastPathComponent, image)
        })
    }()

    static func image(side: Side, kind: Kind) -> Image {
        let name = "\(side.rawValue)-\(kind.rawValue)"
        if let image = images[name] { return Image(uiImage: image) }
        return Image(systemName: "questionmark")
    }
}

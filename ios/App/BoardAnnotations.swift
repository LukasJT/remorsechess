import SwiftUI
import UIKit.UIGestureRecognizerSubclass

struct BoardMark: Equatable {
    enum Ink: Equatable {
        case red, yellow, blue, green

        var color: Color {
            switch self {
            case .red: Palette.color(0xed536d)
            case .yellow: Palette.color(0xffca55)
            case .blue: Palette.color(0x51afe8)
            case .green: Palette.color(0x60ca88)
            }
        }
    }

    let from: Int
    let to: Int
    let ink: Ink

    init(from: Int, to: Int, modifiers: UIKeyModifierFlags = []) {
        self.from = from
        self.to = to
        if modifiers.contains(.shift) { ink = .green }
        else if modifiers.contains(.alternate) { ink = .blue }
        else if modifiers.contains(.control) { ink = from == to ? .yellow : .red }
        else { ink = from == to ? .red : .yellow }
    }
}

struct BoardAnnotationLayer: View {
    let marks: [BoardMark]
    let flipped: Bool

    var body: some View {
        Canvas { context, size in
            let cell = size.width / 8
            for mark in marks where mark.from != mark.to {
                let from = center(of: mark.from, cell: cell)
                let to = center(of: mark.to, cell: cell)
                let dx = to.x - from.x
                let dy = to.y - from.y
                let knight = abs(mark.to % 8 - mark.from % 8) * abs(mark.to / 8 - mark.from / 8) == 2
                let bend = knight ? (abs(dx) > abs(dy) ? CGPoint(x: to.x, y: from.y) : CGPoint(x: from.x, y: to.y)) : from
                let length = hypot(to.x - bend.x, to.y - bend.y)
                let ux = (to.x - bend.x) / length
                let uy = (to.y - bend.y) / length
                let tip = CGPoint(x: to.x + ux * cell * 0.18, y: to.y + uy * cell * 0.18)
                let base = CGPoint(x: tip.x - ux * cell * 0.46, y: tip.y - uy * cell * 0.46)
                let spread = cell * 0.26

                var shaft = Path()
                shaft.move(to: from)
                if knight { shaft.addLine(to: bend) }
                shaft.addLine(to: base)

                var head = Path()
                head.move(to: tip)
                head.addLine(to: CGPoint(x: base.x - uy * spread, y: base.y + ux * spread))
                head.addLine(to: CGPoint(x: base.x + uy * spread, y: base.y - ux * spread))
                head.closeSubpath()

                context.drawLayer { layer in
                    layer.opacity = 0.83
                    layer.stroke(shaft, with: .color(mark.ink.color),
                                 style: StrokeStyle(lineWidth: cell * 0.19, lineCap: .round, lineJoin: .round))
                    layer.fill(head, with: .color(mark.ink.color))
                }
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }

    private func center(of square: Int, cell: CGFloat) -> CGPoint {
        let column = flipped ? 7 - square % 8 : square % 8
        let row = flipped ? square / 8 : 7 - square / 8
        return CGPoint(x: (CGFloat(column) + 0.5) * cell, y: (CGFloat(row) + 0.5) * cell)
    }
}

struct SecondaryBoardInput: UIViewRepresentable {
    var onDraw: (CGPoint, CGPoint, UIKeyModifierFlags) -> Void

    func makeUIView(context: Context) -> InputView { InputView() }

    func updateUIView(_ view: InputView, context: Context) {
        view.onDraw = onDraw
    }

    static func dismantleUIView(_ view: InputView, coordinator: Void) {
        view.detach()
    }

    final class InputView: UIView {
        var onDraw: ((CGPoint, CGPoint, UIKeyModifierFlags) -> Void)?
        private let recognizer = SecondaryGesture()
        private weak var attachedWindow: UIWindow?

        override init(frame: CGRect) {
            super.init(frame: frame)
            isUserInteractionEnabled = false
            recognizer.board = self
            recognizer.allowedTouchTypes = [NSNumber(value: UITouch.TouchType.indirectPointer.rawValue)]
            recognizer.cancelsTouchesInView = false
        }

        required init?(coder: NSCoder) { nil }

        override func didMoveToWindow() {
            super.didMoveToWindow()
            detach()
            window?.addGestureRecognizer(recognizer)
            attachedWindow = window
        }

        func detach() {
            attachedWindow?.removeGestureRecognizer(recognizer)
            attachedWindow = nil
        }
    }

    private final class SecondaryGesture: UIGestureRecognizer {
        weak var board: InputView?
        private var start: CGPoint?
        private var modifiers: UIKeyModifierFlags = []

        override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent) {
            guard event.buttonMask.contains(.secondary), touches.count == 1,
                  let board, let touch = touches.first else {
                state = .failed
                return
            }
            let point = touch.location(in: board)
            guard board.bounds.contains(point) else { state = .failed; return }
            start = point
            modifiers = event.modifierFlags
        }

        override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent) {
            guard let board, let start, let touch = touches.first else { state = .failed; return }
            let end = touch.location(in: board)
            guard board.bounds.contains(end) else { state = .failed; return }
            board.onDraw?(start, end, modifiers)
            state = .recognized
        }

        override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent) {
            state = .failed
        }

        override func reset() {
            super.reset()
            start = nil
            modifiers = []
        }
    }
}

import { chooseMove, type Difficulty } from './bot.ts'
import { puzzleAt, puzzleCount } from './puzzle-book.ts'
import { initial, inCheck, legal, play, type Action, type Game } from './rules.ts'

function position(game: Game) {
  return {
    snapshot: JSON.stringify(game),
    pieces: game.pieces,
    side: game.side,
    turn: game.turn,
    bonus: game.bonus,
    check: !game.result && inCheck(game, game.side),
    result: game.result,
    actions: legal(game),
  }
}

function puzzle(id: number) {
  const { title, goal, face, line, game } = puzzleAt(id)
  return { id, title, goal, face, line, position: position(game) }
}

const puzzles = Array.from({ length: puzzleCount }, (_, id) => {
  const { title } = puzzleAt(id)
  return { id, title, variation: Math.floor(id / (puzzleCount / 4)) + 1 }
})

export function request(command: string, payload: string) {
  const input = JSON.parse(payload)
  let result: unknown
  switch (command) {
    case 'initial':
      result = position(initial())
      break
    case 'puzzles':
      result = puzzles
      break
    case 'puzzle':
      result = puzzle(input.id)
      break
    case 'play': {
      const game: Game = JSON.parse(input.snapshot)
      const action: Action = input.action
      const move = play(game, action, () => input.face)
      result = move ? { position: position(move.game), event: move.event } : null
      break
    }
    case 'bot': {
      const game: Game = JSON.parse(input.snapshot)
      result = chooseMove(game, input.difficulty as Difficulty) ?? null
      break
    }
    default:
      throw new Error('Unknown engine command: ' + command)
  }
  return JSON.stringify(result)
}

export type Side = 'white' | 'black'
export type Kind = 'p' | 'n' | 'b' | 'r' | 'q' | 'k'
export type Mood = 'normal' | 'devastated' | 'guilty' | 'psychopath' | 'bloodlust'
export type Piece = { id: number; side: Side; kind: Kind; square: number; mood: Mood; roll: number; kills: number; rescue: number; moved: boolean }
export type Action = { type: 'move'; from: number; to: number; promotion?: Kind } | { type: 'absolve'; from: number; to: number } | { type: 'end' }
export type Result = { winner: Side | null; reason: string }
export type Ep = { pawn: number; square: number; target: number }
export type Game = { rulesVersion: 1; pieces: Piece[]; side: Side; bonus: number | null; turn: number; ep: Ep | null; nextEp: Ep | null; quiet: number; irreversible: boolean; seen: Record<string, number>; result: Result | null }
export type Event = { turn: number; side: Side; action: Action; text: string; roll?: number; mood?: Mood; capture?: Piece; captureState?: {mood:Mood; originalRoll:number; kills:number}; vanished: Piece[] }
export const opposite = (side: Side): Side => side === 'white' ? 'black' : 'white'
export const file = (square: number) => square % 8
export const rank = (square: number) => Math.floor(square / 8)
export const name = (square: number) => 'abcdefgh'[file(square)] + (rank(square) + 1)
export const at = (game: Game, square: number) => game.pieces.find(p => p.square === square)
export const moodNames: Record<Mood, string> = { normal:'Unaffected', devastated:'Devastated', guilty:'Guilt-ridden', psychopath:'Psychopath', bloodlust:'Bloodlust' }
const canCapture = (p: Piece) => p.mood !== 'devastated' && p.mood !== 'guilty'
const promotions: Kind[] = ['q', 'r', 'b', 'n']

export function initial(): Game {
  const game: Game = { rulesVersion: 1, pieces: [], side: 'white', bonus: null, turn: 1, ep: null, nextEp: null, quiet: 0, irreversible: false, seen: {}, result: null }
  const back: Kind[] = ['r','n','b','q','k','b','n','r']
  for (const side of ['white', 'black'] as const) {
    for (let column = 0; column < 8; column++) {
      for (const [kind, row] of [[back[column], side === 'white' ? 0 : 7], ['p', side === 'white' ? 1 : 6]] as [Kind, number][]) {
        game.pieces.push({ id: game.pieces.length, side, kind, square: row * 8 + column, mood: 'normal', roll: 0, kills: 0, rescue: 0, moved: false })
      }
    }
  }
  game.seen[key(game)] = 1
  return game
}

function geometry(game: Game, p: Piece, to: number, capture: boolean): boolean {
  const dx = file(to) - file(p.square), dy = rank(to) - rank(p.square)
  const x = Math.abs(dx), y = Math.abs(dy)
  if (!x && !y) return false
  switch (p.kind) {
    case 'k': return x <= 1 && y <= 1
    case 'n': return x * y === 2
    case 'p': {
      const step = p.side === 'white' ? 1 : -1
      if (capture) return x === 1 && dy === step
      return !x && (dy === step || (dy === 2 * step && !p.moved && rank(p.square) === (step === 1 ? 1 : 6) && !at(game, p.square + step * 8)))
    }
    case 'b': if (x !== y) return false; break
    case 'r': if (x && y) return false; break
    case 'q': if (x && y && x !== y) return false; break
  }
  const stride = Math.sign(dx) + 8 * Math.sign(dy)
  for (let square = p.square + stride; square !== to; square += stride) if (at(game, square)) return false
  return true
}

function attacked(game: Game, square: number, by: Side): boolean {
  return game.pieces.some(p => p.side === by && (p.kind === 'k' || canCapture(p)) && geometry(game, p, square, true))
}
export function inCheck(game: Game, side: Side): boolean {
  const king = game.pieces.find(p => p.side === side && p.kind === 'k')
  return !king || attacked(game, king.square, opposite(side))
}

function victim(game: Game, p: Piece, to: number): Piece | undefined {
  const occupant = at(game, to)
  if (occupant) return occupant
  if (p.kind !== 'p' || game.ep?.target !== to || !geometry(game, p, to, true)) return
  return game.pieces.find(v => v.kind === 'p' && v.side !== p.side && v.id === game.ep?.pawn && v.square === game.ep.square)
}

function castle(game: Game, king: Piece, to: number): Piece | undefined {
  const start = king.side === 'white' ? 4 : 60
  const offset = to - start
  if (king.kind !== 'k' || king.square !== start || king.moved || Math.abs(offset) !== 2 || game.bonus !== null || inCheck(game, king.side)) return
  const rook = at(game, start + (offset > 0 ? 3 : -4))
  if (!rook || rook.kind !== 'r' || rook.side !== king.side || rook.moved || ['devastated','bloodlust'].includes(rook.mood)) return
  const step = Math.sign(offset)
  for (let square = start + step; square !== rook.square; square += step) if (at(game, square)) return
  const intermediate = { ...game, pieces: game.pieces.map(p => p.id === king.id ? { ...p, square: start + step } : p) }
  if (!inCheck(intermediate, king.side)) return rook
}

function applyBoard(game: Game, action: Exclude<Action, { type:'end' }>, p: Piece, taken?: Piece, rook?: Piece): Game {
  const pieces = game.pieces.filter(piece => piece.id !== taken?.id).map(piece => {
    if (action.type === 'absolve' && piece.square === action.to) return { ...piece, mood: 'normal' as const, rescue: 0 }
    if (action.type === 'move' && piece.id === p.id) return { ...piece, square: action.to, moved: true, kind: action.promotion ?? piece.kind }
    if (rook && piece.id === rook.id) return { ...piece, square: (action.to + action.from) / 2, moved: true }
    return piece
  })
  return { ...game, pieces }
}

function preview(game: Game, action: Action): { next: Game; actor?: Piece; taken?: Piece } | undefined {
  if (game.result) return
  if (action.type === 'end') return game.bonus !== null ? { next: game } : undefined
  if (!Number.isInteger(action.from) || !Number.isInteger(action.to) || action.to < 0 || action.to > 63) return
  const p = at(game, action.from)
  if (!p || p.side !== game.side || p.mood === 'devastated' || (game.bonus !== null && p.id !== game.bonus)) return
  let taken: Piece | undefined, rook: Piece | undefined
  if (action.type === 'absolve') {
    const target = at(game, action.to)
    if (game.bonus !== null || p.kind !== 'b' || p.mood === 'bloodlust' || !target || target.side !== p.side || target.id === p.id ||
      !['guilty','devastated'].includes(target.mood) || Math.abs(rank(p.square)-rank(target.square)) > 1 || Math.abs(file(p.square)-file(target.square)) > 1) return
  } else {
    taken = victim(game, p, action.to)
    if (taken?.kind === 'k' || (taken && (!canCapture(p) || (taken.side === p.side && p.mood !== 'bloodlust'))) || (!taken && p.mood === 'bloodlust')) return
    if (!taken && p.kind === 'k' && Math.abs(action.from - action.to) === 2) {
      rook = castle(game, p, action.to)
      if (!rook) return
    } else if (!geometry(game, p, action.to, Boolean(taken))) return
    const promotes = p.kind === 'p' && rank(action.to) === (p.side === 'white' ? 7 : 0)
    if (promotes ? !promotions.includes(action.promotion as Kind) : action.promotion !== undefined) return
  }
  const next = applyBoard(game, action, p, taken, rook)
  if (!inCheck(next, game.side)) return { next, actor: p, taken }
}

export function legal(game: Game, only?: number): Action[] {
  if (game.result) return []
  const actions: Action[] = []
  if (game.bonus !== null && only === undefined) actions.push({ type: 'end' })
  for (const p of game.pieces) {
    if (p.side !== game.side || (only !== undefined && p.square !== only) || (game.bonus !== null && game.bonus !== p.id)) continue
    for (let to = 0; to < 64; to++) {
      const kinds = p.kind === 'p' && [0,7].includes(rank(to)) ? promotions : [undefined]
      for (const promotion of kinds) {
        const action: Action = promotion ? { type:'move', from:p.square, to, promotion } : { type:'move', from:p.square, to }
        if (preview(game, action)) actions.push(action)
      }
      if (p.kind === 'b') {
        const action: Action = { type:'absolve', from:p.square, to }
        if (preview(game, action)) actions.push(action)
      }
    }
  }
  return actions
}

function key(game: Game): string {
  const rights = [4,60].map(square => {
    const king = at(game, square)
    return king?.kind === 'k' && !king.moved ? [square-4,square+3].map(r => {
      const rook = at(game, r)
      return rook?.kind === 'r' && rook.side === king.side && !rook.moved ? 1 : 0
    }).join('') : '00'
  }).join('')
  const ep = game.ep
  const epKey = ep && game.pieces.some(p => p.side === game.side && p.kind === 'p' && !at(game, ep.target) && preview(game, { type:'move', from:p.square, to:ep.target })) ? ep.target : '-'
  const board = game.pieces.slice().sort((a,b) => a.square-b.square).map(p =>
    [p.square,p.side[0],p.kind,p.mood,Number(Boolean(p.roll)),p.mood === 'psychopath' ? p.kills : 0,p.rescue,
      p.kind === 'p' && rank(p.square) === (p.side === 'white' ? 1 : 6) ? Number(p.moved) : 0].join('/')
  )
  return [game.side, rights, epKey, ...board].join('|')
}

export function rollDie(): number {
  const value = new Uint8Array(1)
  do crypto.getRandomValues(value); while (value[0] >= 252)
  return value[0] % 6 + 1
}

export function play(game: Game, action: Action, die: () => number = rollDie): { game: Game; event: Event } | undefined {
  const validated = preview(game, action)
  if (!validated) return
  const { actor, taken } = validated
  const next = { ...validated.next }
  const event: Event = { turn:game.turn, side:game.side, action, text:'Bonus declined', vanished:[] }
  let newlyDevastated: number | undefined
  if (action.type === 'absolve') {
    event.text = 'B' + name(action.from) + ' absolves ' + name(action.to)
    next.irreversible = true
  }
  if (action.type === 'move' && actor) {
    event.text = (actor.kind === 'p' ? '' : actor.kind.toUpperCase()) + name(action.from) + (taken ? '×' : '–') + name(action.to) + (action.promotion ? '=' + action.promotion.toUpperCase() : '')
    next.irreversible ||= actor.kind === 'p' || Boolean(taken)
    if (actor.kind === 'p' && Math.abs(action.to-action.from) === 16) {
      next.nextEp = { pawn:actor.id, square:action.to, target:(action.from+action.to)/2 }
    } else if (actor.id === next.nextEp?.pawn) next.nextEp = null
    if (taken) {
      event.capture = taken
      const moved = { ...next.pieces.find(p => p.id === actor.id)! }
      moved.kills++
      if (!moved.roll) {
        const roll = die()
        if (!Number.isInteger(roll) || roll < 1 || roll > 6) throw new Error('Invalid die result')
        moved.roll = event.roll = roll
        moved.mood = roll === 1 ? 'devastated' : roll < 4 ? 'guilty' : roll === 6 ? 'psychopath' : 'normal'
        if (roll === 1) { moved.rescue = 3; newlyDevastated = moved.id }
        event.mood = moved.mood
      }
      if (moved.mood === 'psychopath' && moved.kills >= 3) {
        moved.mood = 'bloodlust'
        event.mood = moved.mood
      }
      event.captureState = {mood:moved.mood,originalRoll:moved.roll,kills:moved.kills}
      next.pieces = next.pieces.map(p => p.id === moved.id ? moved : p)
      if (game.bonus === null && (moved.mood === 'psychopath' || moved.mood === 'bloodlust')) {
        next.bonus = moved.id
        if (legal(next, moved.square).length) return { game:next, event }
      }
    }
  }
  next.bonus = null
  next.pieces = next.pieces.flatMap(p => {
    if (p.side !== game.side || p.mood !== 'devastated' || p.id === newlyDevastated) return [p]
    if (p.rescue > 1) return [{ ...p, rescue:p.rescue-1 }]
    event.vanished.push(p)
    return []
  })
  if (event.vanished.some(p => p.kind === 'k')) next.result = { winner:opposite(game.side), reason:'King lost to remorse' }
  else if (inCheck(next, game.side)) next.result = { winner:opposite(game.side), reason:'King exposed by remorse' }
  next.side = opposite(game.side)
  next.turn++
  next.ep = next.nextEp
  next.nextEp = null
  next.quiet = next.irreversible || event.vanished.length ? 0 : next.quiet+1
  next.irreversible = false
  if (!next.result) {
    const check = inCheck(next,next.side)
    if (!legal(next).length) next.result = check ? { winner:game.side,reason:'Checkmate' } : { winner:null,reason:'Stalemate' }
    else if (next.pieces.length === 2 && next.pieces.every(p => p.kind === 'k' && p.mood !== 'devastated')) next.result = { winner:null,reason:'Bare kings' }
    else {
      const position = key(next)
      next.seen = { ...next.seen, [position]:(next.seen[position] ?? 0)+1 }
      if (next.seen[position] >= 3) next.result = { winner:null,reason:'Threefold repetition' }
      else if (next.quiet >= 100) next.result = { winner:null,reason:'50-move rule' }
    }
    if (check) event.text += next.result?.reason === 'Checkmate' ? '#' : '+'
  }
  return { game:next, event }
}

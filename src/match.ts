import { initial, opposite, play, type Game, type Action, type Event, type Result, type Side } from './rules.ts'
export type Control = { seconds: number; increment: number; days?:number }
export type SearchClock = Control | 'any'
export type DailyGame = { id:string; days:number; opponent?:string; waiting:boolean; turn:boolean; deadline?:number }
export type DailyLobby = { games:DailyGame[]; queued:number|null }
export const quickClock:Control={seconds:180,increment:0}
export function compatibleClock(a:SearchClock,b:SearchClock):Control|null {
  if(a==='any'&&b==='any')return quickClock
  if(a==='any'||b==='any'){
    const fixed=a==='any'?b as Control:a
    return presets.some(p=>p.seconds>0&&p.seconds===fixed.seconds&&p.increment===fixed.increment)?fixed:null
  }
  return a.seconds===b.seconds&&a.increment===b.increment?a:null
}
export type Entry = { action?: Action; event?: Event; result?: Result; clock: Record<Side, number>; start: number }
export type Match = { game: Game; clock: Record<Side, number>; start: number; control: Control; version: number; log: Entry[]; offer: Side | null }
export type Command = Action | { type:'resign' | 'offer' | 'accept' | 'decline' }
export const presets: Control[] = [[60,0],[60,1],[120,1],[180,0],[180,2],[300,0],[300,5],[600,0],[900,10],[1800,0],[3600,0],[0,0],[30,0]].map(([seconds,increment]) => ({seconds,increment}))
export const dailyDays=[1,2,3,5,7,10,14] as const
export const dailyControl=(days:number):Control=>({seconds:days*86_400,increment:0,days})
export function makeMatch(control: Control, start = 0): Match {
  return { game:initial(), clock:{white:control.seconds*1000,black:control.seconds*1000}, start, control, version:0, log:[], offer:null }
}
export function remaining(m: Match, side: Side, now: number) {
  return Math.max(0, m.clock[side] - (m.start && !m.game.result && side === m.game.side ? Math.max(0,now-m.start) : 0))
}
export function end(m: Match, result: Result, now: number): Match {
  const clock = { white:remaining(m,'white',now), black:remaining(m,'black',now) }
  return { ...m, game:{...m.game,result}, clock, start:0, offer:null, version:m.version+1, log:[...m.log,{result,clock,start:0}] }
}
export function expire(m: Match, now: number): Match {
  if (!m.control.seconds || !m.start || m.game.result || remaining(m,m.game.side,now)) return m
  const winner = opposite(m.game.side)
  const bareKings = m.game.pieces.length === 2 && m.game.pieces.every(p => p.kind === 'k' && p.mood !== 'devastated')
  return end(m,{winner:bareKings ? null : winner, reason:'Time expired'},now)
}
export function command(m: Match, side: Side, action: Command, now: number, die?: () => number): Match | undefined {
  if (m.game.result || !m.start) return
  const timed = expire(m,now)
  if (timed !== m) return timed
  if (action.type === 'resign') return end(m,{winner:opposite(side),reason:'Resignation'},now)
  if (action.type === 'offer') return !m.offer ? {...m,offer:side,version:m.version+1} : undefined
  if (action.type === 'accept') return m.offer === opposite(side) ? end(m,{winner:null,reason:'Draw agreed'},now) : undefined
  if (action.type === 'decline') return m.offer === opposite(side) ? {...m,offer:null,version:m.version+1} : undefined
  if (m.game.side !== side || !['move','absolve','end'].includes(action.type)) return
  const step = play(m.game,action as Action,die)
  if (!step) return
  const clock = {...m.clock}
  clock[side] = remaining(m,side,now)
  if (step.game.side !== side){
    if(m.control.days)clock[side]=m.control.seconds*1000
    else if(m.control.seconds)clock[side]+=m.control.increment*1000
  }
  const start = step.game.result ? 0 : now
  return {...m,...{game:step.game,clock,start},offer:m.offer === opposite(side) ? null : m.offer,version:m.version+1,
    log:[...m.log,{action:action as Action,event:step.event,result:step.game.result ?? undefined,clock,start}]}
}

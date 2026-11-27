import {initial,legal,name,play,type Game} from './rules.ts'

export const openings=[
  ['italian-game','Italian Game','C50','e2e4 e7e5 g1f3 b8c6 f1c4','White aims at f7 while Black develops and prepares to castle. Before opening the center, check whether a nearby bishop can rescue the piece that captures.'],
  ['ruy-lopez','Ruy López','C60','e2e4 e7e5 g1f3 b8c6 f1b5','White pressures the defender of e5. Black can ask the bishop to move with a6. Trading on c6 spends the bishop’s first roll and can remove a useful rescue route.'],
  ['scotch-game','Scotch Game','C44','e2e4 e7e5 g1f3 b8c6 d2d4','White challenges the center immediately. Black can take on d4. Compare the risk of recapturing with a developed knight versus letting tension remain.'],
  ['four-knights-game','Four Knights Game','C47','e2e4 e7e5 g1f3 b8c6 b1c3 g8f6','Both sides develop their knights before trading. Use the extra time to decide which bishop will have access to the central squares.'],
  ['vienna-game','Vienna Game','C25','e2e4 e7e5 b1c3','White defends e4 and keeps the f-pawn free. Black can develop with Nf6. Before committing to f4, think through which side would control the turn after a capture rolls a six.'],
  ['kings-gambit','King’s Gambit','C30','e2e4 e7e5 f2f4','White offers a pawn to disrupt Black’s center. If Black accepts, the capturing pawn might freeze, stop capturing, or gain an immediate follow-up. Keep king safety in view before pursuing compensation.'],
  ['sicilian-defense','Sicilian Defense','B20','e2e4 c7c5','Black challenges d4 with a flank pawn. White can prepare d4 with Nf3. In an open Sicilian, evaluate the early c-pawn trade across all roll outcomes.'],
  ['french-defense','French Defense','C00','e2e4 e7e6','Black prepares d5 and invites a locked center. White can take space with d4. A bishop blocked behind the pawn chain may struggle to reach a distressed piece.'],
  ['caro-kann-defense','Caro-Kann Defense','B10','e2e4 c7c6','Black prepares d5 while leaving the light-squared bishop free. White can occupy the center. Compare where that bishop can develop after an exchange on d5.'],
  ['scandinavian-defense','Scandinavian Defense','B01','e2e4 d7d5 e4d5','After 1.e4 d5 2.exd5, Black can reply Qxd5 on rolls 1–5. On a 6, White must move the pawn again. Its only bonus move is d6.'],
  ['pirc-defense','Pirc Defense','B07','e2e4 d7d6 d2d4 g8f6 b1c3 g7g6','Black prepares Bg7 and lets White build a center. Watch the distance between the fianchettoed bishop and any piece likely to capture first.'],
  ['queens-gambit-accepted','Queen’s Gambit Accepted','D20','d2d4 d7d5 c2c4 d5c4','Black takes the offered c-pawn. White can develop and plan recovery. Black’s roll determines whether that pawn can immediately keep moving or needs bishop support.'],
  ['queens-gambit-declined','Queen’s Gambit Declined','D30','d2d4 d7d5 c2c4 e7e6','Black supports d5 with e6. White keeps pressure on the center. Delaying the exchange buys time for both sides to place their bishops.'],
  ['slav-defense','Slav Defense','D10','d2d4 d7d5 c2c4 c7c6','Black backs up d5 while keeping the light-squared bishop’s diagonal open. White can develop before choosing whether to exchange. Plan a rescue square before committing a pawn to c4 or d5.'],
  ['london-system','London System','D02','d2d4 d7d5 g1f3 g8f6 c1f4','White develops the bishop outside its pawn chain. Black can challenge the center with c5. Check whether Bf4 gives you a rescue route near the eventual pawn exchanges.'],
  ['kings-indian-defense','King’s Indian Defense','E60','d2d4 g8f6 c2c4 g7g6','Black prepares pressure from g7 while White claims space. Before launching a pawn break, count how many moves a bishop would need to help a stranded attacker.'],
  ['nimzo-indian-defense','Nimzo-Indian Defense','E20','d2d4 g8f6 c2c4 e7e6 b1c3 f8b4','Black pins the c3 knight and contests e4. Taking on c3 can damage White’s pawn structure. It can also cost Black a bishop that could have handled future rescues.'],
  ['english-opening','English Opening','A10','c2c4','White contests d5 without committing either central pawn. Black can answer with e5 or c5. Try both and see which side gets bishop support near the first likely trade.'],
  ['reti-opening','Réti Opening','A09','g1f3 d7d5 c2c4','White challenges d5 and keeps several transpositions available. Black can advance, defend, or take. Follow the chosen branch by its complete Remorse state after a capture.'],
] as const

export function replayStudy(line:string,face:number):Game {
  let game=initial()
  for(const move of line.split(' ').filter(Boolean)){
    const action=legal(game).find(a=>a.type==='move'&&name(a.from)+name(a.to)===move)
    if(!action)throw Error('Illegal opening action '+move)
    game=play(game,action,()=>face)!.game
  }
  return game
}

function quietPosition(game:Game){
  if(game.bonus!==null||game.pieces.some(piece=>piece.roll))return
  const squares=game.pieces.map(p=>[p.side,p.kind,p.square,
    ((p.kind==='k'||p.kind==='r'||p.kind==='p')&&p.moved)?1:0].join(',')).sort()
  return [game.side,game.ep?.target??'-',squares.join('|')].join('/')
}
const knownPositions=new Map(openings.flatMap(opening=>{
  const key=quietPosition(replayStudy(opening[3],4))
  return key?[[key,opening] as const]:[]
}))
export function matchingOpening(game:Game){
  const key=quietPosition(game)
  return key?knownPositions.get(key):undefined
}

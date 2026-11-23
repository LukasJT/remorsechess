import {test} from 'node:test'
import assert from 'node:assert/strict'
import {initial,legal,play,at,type Game,type Piece,type Action} from '../src/rules.ts'
import {dailyControl,makeMatch,command,expire} from '../src/match.ts'
import {botRating, settledBotRatingLimit, defaultRating, updateBotRating, updateRating, pool} from '../src/rating.ts'

const move=(from:number,to:number):Action=>({type:'move',from,to})
function fixture(pieces:Partial<Piece>[]):Game {
  const positions:Partial<Piece>[]=[{side:'white',kind:'k',square:4},{side:'black',kind:'k',square:60},...pieces]
  return {...initial(),seen:{},pieces:positions.map((p,id)=>({id,side:'white',kind:'p',square:10,mood:'normal',roll:0,kills:0,rescue:0,moved:true,...p}))}
}
const apply=(g:Game,a:Action,roll?:number)=>{const step=play(g,a,()=>{assert.ok(roll);return roll});assert.ok(step);return step}
test('standard start and turn legality',()=>{
  const g=initial()
  assert.equal(legal(g).length,20)
  assert.equal(play(g,move(52,36)),undefined)
  assert.equal(apply(g,move(12,28)).game.side,'black')
})
const capturePosition=()=>fixture([{kind:'n',square:10},{kind:'b',square:18},{side:'black',square:27},{side:'black',square:48}])
test('all die faces and immediate bonus on the first six',()=>{
  for(const [i,mood] of ['devastated','guilty','guilty','normal','normal','psychopath'].entries()){
    const {game,event}=apply(capturePosition(),move(10,27),i+1)
    assert.equal(event.roll,i+1)
    assert.equal(at(game,27)?.mood,mood)
    assert.equal(game.bonus!==null,i===5)
    if(i===5){
      const options=legal(game)
      assert.ok(options.length)
      assert.ok(options.every(a=>a.type==='move'&&a.from===27))
      assert.equal(play(game,{type:'end'}),undefined)
    }
  }
})
test('saved games still replay optional bonuses under their original rules',()=>{
  for(const rulesVersion of [1,2] as const){
    const game=apply({...capturePosition(),rulesVersion},move(10,27),6).game
    assert.ok(legal(game).some(action=>action.type==='end'))
    const step=apply(game,{type:'end'})
    assert.equal(step.event.text,'Bonus declined')
    assert.equal(step.game.side,'black')
  }
})
test('the turn passes immediately when the bonus piece has no legal move',()=>{
  const blockedPawn=fixture([{square:18},{side:'black',square:27},{square:35}])
  const blocked=apply(blockedPawn,move(18,27),6).game
  assert.equal(at(blocked,27)?.mood,'psychopath')
  assert.equal(blocked.bonus,null)
  assert.equal(blocked.side,'black')

  const bloodlust=fixture([{kind:'n',square:10,kills:2,roll:6,mood:'psychopath'},{side:'black',square:27}])
  const stranded=apply(bloodlust,move(10,27)).game
  assert.equal(at(stranded,27)?.mood,'bloodlust')
  assert.equal(stranded.bonus,null)
  assert.equal(stranded.side,'black')
})
test('absolution cures a piece without restoring a roll',()=>{
  const first=apply(capturePosition(),move(10,27),1).game
  assert.equal(at(first,27)?.rescue,3)
  const black=apply(first,move(48,40)).game
  assert.equal(at(black,27)?.rescue,3)
  const cure=apply(black,{type:'absolve',from:18,to:27}).game
  assert.equal(at(cure,27)?.mood,'normal')
  assert.equal(at(cure,27)?.roll,1)
  const next={...cure,side:'white' as const,pieces:[...cure.pieces,{...cure.pieces.at(-1)!,id:99,square:44}]}
  const recapture=apply(next,move(27,44))
  assert.equal(recapture.event.roll,undefined)
  assert.equal(at(recapture.game,44)?.kills,2)
})
test('devastation expires after exactly three subsequent owner turns',()=>{
  let state=apply(capturePosition(),move(10,27),1).game
  for(const [i,[b,w]] of [[move(60,61),move(4,5)],[move(61,60),move(5,4)],[move(60,61),move(4,5)]].entries()){
    state=apply(state,b).game
    assert.equal(at(state,27)?.rescue,3-i)
    const next=apply(state,w)
    state=next.game
    if(i===2)assert.equal(next.event.vanished[0]?.square,27)
  }
  assert.equal(at(state,27),undefined)
})
test('third capture immediately demands a capture on the bonus move',()=>{
  const state=fixture([{kind:'n',square:10,kills:2,roll:6,mood:'psychopath'},{side:'black',square:27},{square:44}])
  const next=apply(state,move(10,27)).game
  assert.equal(at(next,27)?.mood,'bloodlust')
  assert.equal(play(next,{type:'end'}),undefined)
  assert.equal(play(next,move(27,33)),undefined)
  const bonus=apply(next,move(27,44))
  assert.equal(bonus.event.capture?.side,'white')
  assert.equal(bonus.game.bonus,null)
  assert.equal(bonus.game.side,'black')
})
test('bonus uses the same clock and earns increment once',()=>{
  const match={...makeMatch({seconds:60,increment:2},1000),game:capturePosition()}
  const first=command(match,'white',move(10,27),2000,()=>6)!
  assert.equal(first.clock.white,59000)
  assert.equal(first.game.side,'white')
  assert.equal(command(first,'white',{type:'end'},2500),undefined)
  const second=command(first,'white',move(27,44),3000)!
  assert.equal(second.clock.white,60000)
  assert.equal(second.game.side,'black')
  assert.equal(expire(first,61000).game.result?.winner,'black')
})
test('Daily clocks reset per turn and a bonus does not extend the deadline',()=>{
  const clock=3*86_400_000
  const match={...makeMatch(dailyControl(3),1000),game:capturePosition()}
  const bonus=command(match,'white',move(10,27),2000,()=>6)!
  assert.equal(bonus.game.side,'white')
  assert.equal(bonus.start+bonus.clock.white,1000+clock)
  const completed=command(bonus,'white',move(27,44),5000)!
  assert.equal(completed.game.side,'black')
  assert.equal(completed.clock.white,clock)
  assert.equal(completed.start+completed.clock.black,5000+clock)
  assert.equal(expire(completed,5000+clock).game.result?.winner,'white')
})
test('castling, en passant and promotion preserve the chess rules',()=>{
  const castle=fixture([{kind:'r',square:7,moved:false}])
  castle.pieces[0].moved=false
  assert.equal(at(apply(castle,move(4,6)).game,5)?.kind,'r')
  const en=fixture([{square:36},{side:'black',square:35}])
  en.ep={pawn:3,square:35,target:43}
  const ep=apply(en,move(36,43),3)
  assert.equal(at(ep.game,35),undefined)
  assert.equal(at(ep.game,43)?.mood,'guilty')
  const promote=fixture([{square:48,roll:4,kills:1},{side:'black',square:57,kind:'r'}])
  const p=apply(promote,{type:'move',from:48,to:57,promotion:'n'})
  assert.equal(at(p.game,57)?.kind,'n')
  assert.equal(at(p.game,57)?.roll,4)
})
test('Glicko-2 updates both players from their previous ratings',()=>{
  const first=defaultRating(), now=Date.now()
  assert.ok(updateRating(first,first,1,now).rating>first.rating)
  assert.ok(updateRating(first,first,0,now).rating<first.rating)
  assert.equal(updateRating(first,first,0.5,now).rating,1500)
  assert.equal(pool(120,1),'Bullet')
  assert.equal(pool(180,0),'Blitz')
  assert.equal(pool(600,0),'Rapid')
})

test('early ranked results move ratings more than established results',()=>{
  const now=Date.now()
  const start=defaultRating()
  let experienced=start
  for(let games=0;games<20;games++)experienced=updateRating(experienced,botRating,0.5,now)
  const early=updateRating(start,botRating,1,now).rating-start.rating
  const late=updateRating(experienced,botRating,1,now).rating-experienced.rating
  assert.ok(early>100)
  assert.ok(late<25)
})

test('bot placements use opponent strength, count ten results, and reduce uncertainty',()=>{
  const now=Date.now()
  const start=defaultRating()
  const stronger={...botRating,rating:1750}
  assert.ok(updateBotRating(start,stronger,0.5,now).rating>updateBotRating(start,botRating,0.5,now).rating)
  for(const score of [0,0.5,1]){
    let player=start
    for(let game=1;game<=11;game++){
      const previous=player
      player=updateBotRating(player,botRating,score,now+game)
      assert.equal(player.botGames,game)
      assert.equal(player.games,0)
      assert.equal(player.updated,now+game)
      assert.ok(player.rd<previous.rd)
      if(game===11)assert.ok(Math.abs(player.rating-previous.rating)<=settledBotRatingLimit)
    }
  }
})

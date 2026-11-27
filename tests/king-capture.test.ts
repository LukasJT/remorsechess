import {test} from 'node:test'
import assert from 'node:assert/strict'
import {at,inCheck,initial,legal,opposite,play,type Action,type Piece,type Side} from '../src/rules.ts'
import {command, makeMatch} from '../src/match.ts'
import {chooseMove} from '../src/bot.ts'

function setup(side:Side){
  const light=side==='white', square=(n:number)=>light?n:63-n
  const piece=(id:number,team:Side,kind:Piece['kind'],position:number):Piece=>
    ({id,side:team,kind,square:square(position),mood:'normal',roll:0,kills:0,rescue:0,moved:true})
  const pieces=[
    piece(0,side,'k',4),piece(1,opposite(side),'k',56),
    piece(2,side,'r',9),piece(3,opposite(side),'p',8),piece(4,side,'b',20),
  ]
  const game={...initial(),side,pieces}
  const first:Action={type:'move',from:square(9),to:square(8)}
  const capture:Action={type:'move',from:square(8),to:square(56)}
  return {game,first,capture,square}
}

for(const side of ['black','white'] as const){
  test(side+' can win by taking the checked king on the same piece’s bonus move',()=>{
    const {game,first,capture,square}=setup(side)
    const match={...makeMatch({seconds:60,increment:0},1000),game}
    const bonus=command(match,side,first,1250,()=>6)!
    assert.equal(bonus.game.bonus,2)
    assert.equal(inCheck(bonus.game,opposite(side)),true)
    assert.deepEqual(chooseMove(bonus.game,'expert'),capture)
    const result=command(bonus,side,capture,1500,()=>{throw Error('A bonus capture must not reroll')})!
    assert.deepEqual(result.game.result,{winner:side,reason:'King captured on bonus move'})
    assert.equal(result.start,0)
    assert.equal(at(result.game,square(56))?.side,side)
    assert.equal(result.log.at(-1)?.event?.capture?.kind,'k')
    assert.equal(result.game.bonus,null)
    assert.deepEqual(legal(result.game),[])
  })
}
test('king captures are unavailable on a normal move, to another piece, or under rules v1',()=>{
  const {game,first,capture}=setup('black')
  const bonus=play(game,first,()=>6)!.game
  assert.ok(legal(bonus).some(move=>JSON.stringify(move)===JSON.stringify(capture)))
  assert.equal(play({...bonus,bonus:null},capture),undefined)
  assert.equal(play({...bonus,bonus:4},capture),undefined)
  assert.equal(play({...bonus,rulesVersion:1},capture),undefined)
})
test('the king capture still respects blockages and friendly king protection',()=>{
  const {game,first,capture,square}=setup('white')
  const bonus=play(game,first,()=>6)!.game
  const blocker={...at(bonus,square(20))!,square:square(32)}
  assert.equal(play({...bonus,pieces:[...bonus.pieces.filter(p=>p.id!==blocker.id),blocker]},capture),undefined)
  const king=at(bonus,square(56))!
  const ownKingTarget={...bonus,pieces:bonus.pieces.filter(p=>p.id!==0).map(p=>p.id===king.id?{...p,side:bonus.side}:p.id===2?{...p,mood:'bloodlust' as const}:p)}
  assert.equal(play(ownKingTarget,capture),undefined)
})
test('a pinned bonus piece cannot take a king if it would expose its own king',()=>{
  const game=setup('white').game
  const pieces:Piece[]=[
    {...game.pieces[0],square:0},{...game.pieces[1],square:15},
    {...game.pieces[2],square:8,mood:'psychopath',roll:6,kills:1},
    {...game.pieces[3],kind:'r',square:56},
  ]
  const pinned={...game,pieces,bonus:2}
  assert.equal(inCheck(pinned,'black'),true)
  assert.equal(play(pinned,{type:'move',from:8,to:15}),undefined)
})

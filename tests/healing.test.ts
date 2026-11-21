import {test} from 'node:test'
import assert from 'node:assert/strict'
import {at,initial,legal,play,type Game,type Piece,type Side} from '../src/rules.ts'
import {command,makeMatch} from '../src/match.ts'

function position(from:number,to:number,side:Side,mood:Piece['mood']):Game{
  const pieces:Piece[]=[
    {id:0,side:'white',kind:'k',square:4,mood:'normal',roll:0,kills:0,rescue:0,moved:true},
    {id:1,side:'black',kind:'k',square:60,mood:'normal',roll:0,kills:0,rescue:0,moved:true},
    {id:2,side,kind:'b',square:from,mood:'normal',roll:0,kills:0,rescue:0,moved:true},
    {id:3,side,kind:'n',square:to,mood,roll:mood==='guilty'?2:1,kills:1,rescue:mood==='devastated'?1:0,moved:true},
  ]
  return {...initial(),side,pieces,seen:{}}
}
test('either color can heal both conditions from any neighboring square, including corners',()=>{
  for(const side of ['white','black'] as const){
    for(const mood of ['guilty','devastated'] as const){
      for(const from of [18,19,20,26,28,34,35,36]){
        const game=position(from,27,side,mood)
        const action={type:'absolve',from,to:27} as const
        assert.ok(legal(game,from).some(a=>a.type==='absolve'&&a.to===27),side+' '+mood+' from '+from)
        const result=command({...makeMatch({seconds:0,increment:0},1000),game},side,action,1250)!
        assert.equal(result.game.side,side==='white'?'black':'white')
        assert.equal(at(result.game,from)?.kind,'b')
        assert.deepEqual([at(result.game,27)?.mood,at(result.game,27)?.rescue,at(result.game,27)?.roll],
          ['normal',0,mood==='guilty'?2:1])
        assert.equal(result.log.at(-1)?.event?.vanished.length,0)
      }
    }
  }
})
test('healing cannot wrap across an edge or reach an enemy piece',()=>{
  const wrap=position(23,24,'white','guilty')
  assert.equal(play(wrap,{type:'absolve',from:23,to:24}),undefined)
  const adjacent=position(18,27,'white','devastated')
  const enemy={...adjacent,pieces:adjacent.pieces.map(p=>p.id===3?{...p,side:'black' as const}:p)}
  assert.equal(play(enemy,{type:'absolve',from:18,to:27}),undefined)
})

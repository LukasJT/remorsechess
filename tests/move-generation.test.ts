import {test} from 'node:test'
import assert from 'node:assert/strict'
import {initial,legal,play,rank,type Action,type Game,type Kind} from '../src/rules.ts'

function exhaustive(game:Game):Action[]{
  const actions:Action[]=[]
  if(game.bonus!==null)actions.push({type:'end'})
  for(const p of game.pieces){
    if(p.side!==game.side)continue
    for(let to=0;to<64;to++){
      const choices:(Kind|undefined)[]=p.kind==='p'&&[0,7].includes(rank(to))?['q','r','b','n']:[undefined]
      for(const promotion of choices)actions.push(promotion?{type:'move',from:p.square,to,promotion}:{type:'move',from:p.square,to})
      if(p.kind==='b')actions.push({type:'absolve',from:p.square,to})
    }
  }
  return actions.filter(action=>Boolean(play(game,action,()=>4)))
}
test('optimized move generation agrees with exhaustive validation through seeded play',()=>{
  let game=initial(),seed=86123
  const rand=(n:number)=>{
    seed=(Math.imul(seed,1664525)+1013904223)>>>0
    return seed%n
  }
  const normalized=(actions:Action[])=>actions.map(action=>JSON.stringify(action)).sort()
  for(let turn=0;turn<80&&!game.result;turn++){
    const options=legal(game)
    if(turn%4===0||game.bonus!==null)assert.deepEqual(normalized(options),normalized(exhaustive(game)),'turn '+turn)
    const action=options[rand(options.length)]
    if(!action)break
    game=play(game,action,()=>1+rand(6))!.game
  }
})

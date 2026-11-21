import {parentPort,workerData} from 'node:worker_threads'
import {initial,legal,play,captureTarget,at} from '../src/rules.ts'
import {features,prior,valueOf} from '../src/bot-features.ts'

function random(seed){
  return ()=>{
    seed=(Math.imul(seed,1664525)+1013904223)>>>0
    return seed/0x100000000
  }
}
const rollFrom=(rng)=>1+Math.floor(6*rng())
function teacher(game,noise,rng){
  const side=game.side
  const actions=legal(game).map(action=>{
    const capture=captureTarget(game,action)
    const first=capture&&action.type==='move'&&!at(game,action.from)?.roll
    const faces=first?[[1,1/6],[2,2/6],[4,2/6],[6,1/6]]:[[4,1]]
    let score=0
    for(const [face,p] of faces){
      const next=play(game,action,()=>face).game
      let value=valueOf(next,side,prior)
      if(next.bonus!==null&&next.side===side){
        const wins=legal(next).some(move=>captureTarget(next,move)?.kind==='k')
        if(wins)value=25_000
      }
      score+=p*value
    }
    return {action,score:score+(rng()-.5)*noise}
  })
  actions.sort((a,b)=>b.score-a.score)
  return actions[0]?.action
}
const batch=[]
for(let n=0;n<workerData.games;n++){
  const seed=(n*workerData.workers+workerData.index+1)*1009+workerData.seed
  const dice=random(seed),policy=random(seed^0x47e21)
  let game=initial(), ply=0
  const rows=[]
  for(;ply<workerData.plies&&!game.result;ply++){
    const action=teacher(game,ply<10?90:55,policy)
    if(!action)break
    if(ply>=8&&ply%3===2)rows.push({x:[...features(game)],ply})
    game=play(game,action,()=>rollFrom(dice)).game
  }
  const result=game.result?.winner==='white'?1:game.result?.winner==='black'?0:.5
  const cutoff=!game.result
  const terminal=valueOf(game,'white',prior)
  for(const row of rows){
    const staticScore=row.x.reduce((total,value,i)=>total+value*prior[i],0)
    const baseline=1/(1+Math.exp(-staticScore/470))
    const final=cutoff?1/(1+Math.exp(-terminal/570)):result
    const influence=(cutoff?.46:.83)*Math.exp(-(ply-row.ply)/130)
    row.y=baseline*(1-influence)+influence*final
  }
  batch.push({result,cutoff,rows})
}
parentPort.postMessage(batch)

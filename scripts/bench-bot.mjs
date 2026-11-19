import {availableParallelism} from 'node:os'
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads'
import {initial,legal,play} from '../src/rules.ts'
import {chooseMove,baselineWeights,difficulties} from '../src/bot.ts'
import {trainedWeights} from '../src/bot-model.ts'

function random(seed){
  return ()=>{
    seed=(Math.imul(seed,1664525)+1013904223)>>>0
    return seed/0x100000000
  }
}
if(isMainThread){
  const [opponent='prior',count='24',level='tactical']=process.argv.slice(2)
  const games=Number(count)
  if(!Number.isInteger(games)||games<2||games%2||!Object.hasOwn(difficulties,level))throw Error('Supply an even game count and valid level')
  const threads=Math.max(1,Math.min(6,availableParallelism()-1,games))
  const jobs=Array.from({length:threads},(_,index)=>new Promise((resolve,reject)=>{
    const worker=new Worker(new URL(import.meta.url),{workerData:{opponent,level,start:index,count:games,threads}})
    worker.once('message',resolve);worker.once('error',reject)
  }))
  const results=(await Promise.all(jobs)).flat()
  console.log(JSON.stringify({
    level,games,opponent,wins:results.filter(r=>r.result==='win').length,
    losses:results.filter(r=>r.result==='loss').length,draws:results.filter(r=>r.result==='draw').length,
    capped:results.filter(r=>r.cap).length,
    averageMoveMs:Math.round(results.reduce((sum,r)=>sum+r.elapsed,0)/results.reduce((sum,r)=>sum+r.actions,0)),
  }))
}else{
  // Compare with untrained weights, another difficulty, or a bot loaded from a module.
  const {opponent,level,start,count,threads}=workerData
  const knownLevel=Object.hasOwn(difficulties,opponent)
  const old=opponent==='prior'||knownLevel?null:(await import(new URL(opponent,import.meta.url).href)).chooseMove
  const other=opponent==='prior'?(game,rng)=>chooseMove(game,level,rng,baselineWeights):
    knownLevel?(game,rng)=>chooseMove(game,opponent,rng):
    (game,rng)=>old(game,level,rng)
  const results=[]
  for(let i=start;i<count;i+=threads){
    const rng=random(918373+Math.floor(i/2)*1291)
    const playAs=i%2===0?'white':'black'
    let game=initial(), elapsed=0, actions=0
    for(let ply=0;ply<128&&!game.result;ply++){
      const ours=game.side===playAs
      const moves=legal(game)
      const started=performance.now()
      const action=ply<4?moves[Math.floor(rng()*moves.length)]:ours?chooseMove(game,level,rng,trainedWeights):other(game,rng)
      if(ours&&ply>=4){elapsed+=performance.now()-started;actions++}
      if(!action)break
      const face=1+Math.floor(rng()*6)
      game=play(game,action,()=>face).game
    }
    const result=game.result?.winner===playAs?'win':game.result?.winner?'loss':'draw'
    results.push({result,cap:!game.result,elapsed,actions})
  }
  parentPort.postMessage(results)
}

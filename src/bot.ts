import {at,file,inCheck,legal,play,rank,type Action,type Game,type Side} from './rules.ts'

export const difficulties={
  rookie:{name:'Rookie',description:'Looks one move ahead and sometimes slips.',depth:1,width:1,nodes:240},
  tactical:{name:'Tactician',description:'Checks likely replies and plans rescues.',depth:2,width:4,nodes:550},
  expert:{name:'Grandmaster',description:'Searches deeper with more replies and bonus moves.',depth:3,width:7,nodes:1250},
} as const
export type Difficulty=keyof typeof difficulties
export type Weights={guilt:number;rescue:number;psychopath:number;bloodlust:number}
export const weights:Weights={guilt:.76,rescue:.24,psychopath:.45,bloodlust:.68}
const material={p:100,n:320,b:335,r:510,q:940,k:0}
const outcomes=[[1,1],[2,2],[4,2],[6,1]] as const

function evaluate(game:Game, side:Side, params:Weights):number {
  if(game.result)return game.result.winner===null?0:game.result.winner===side?19000:-19000
  let score=game.bonus===null?0:(game.side===side?55:-55)
  for(const piece of game.pieces){
    const direction=piece.side===side?1:-1
    const center=7-Math.abs(3.5-file(piece.square))-Math.abs(3.5-rank(piece.square))
    const progress=piece.side==='white'?rank(piece.square):7-rank(piece.square)
    const help=game.pieces.some(b=>b.kind==='b'&&b.id!==piece.id&&b.side===piece.side&&b.mood!=='devastated'&&b.mood!=='bloodlust'&&
      Math.abs(file(piece.square)-file(b.square))<=1&&Math.abs(rank(piece.square)-rank(b.square))<=1)
    if(piece.kind==='k'){
      if(piece.rescue)score-=direction*(help?340:1000/piece.rescue)
      if(inCheck(game,piece.side))score-=direction*28
      if(piece.moved&&(file(piece.square)===6||file(piece.square)===2))score+=direction*21
      continue
    }
    const factor=piece.mood==='devastated'?(help?params.rescue+.22:params.rescue*(piece.rescue+1)/4):
      piece.mood==='guilty'?params.guilt+(help?.09:0):
      piece.mood==='psychopath'?1+params.psychopath-(piece.kills-1)*.075:
      piece.mood==='bloodlust'?params.bloodlust:1
    const position=piece.kind==='p'?progress*6+center*3:piece.kind==='n'||piece.kind==='b'?center*8+(piece.moved?12:0):center*2
    score+=direction*(material[piece.kind]*factor+position*(piece.rescue?0:1))
  }
  return score
}

function branches(game:Game,action:Action){
  const capture=action.type==='move'&&Boolean(at(game,action.to)||
    (at(game,action.from)?.kind==='p'&&game.ep?.target===action.to&&file(action.from)!==file(action.to)))
  if(capture&&action.type==='move'&&!at(game,action.from)?.roll)return outcomes.map(([face,count])=>({face,weight:count/6}))
  return [{face:4,weight:1}]
}

export function chooseMove(game:Game,difficulty:Difficulty,random:()=>number=Math.random,params:Weights=weights):Action|undefined {
  const policy=difficulties[difficulty]
  const perspective=game.side
  let used=0
  function evaluateActions(position:Game,actions:Action[]){
    return actions.map(action=>{
      const states=branches(position,action).flatMap(({face,weight})=>{
        used++
        const result=play(position,action,()=>face)
        return result?[{game:result.game,weight}]:[]
      })
      return {action,states,score:states.reduce((sum,row)=>sum+row.weight*evaluate(row.game,perspective,params),0)}
    }).sort((a,b)=>(position.side===perspective?1:-1)*(b.score-a.score))
  }
  function search(position:Game,depth:number):number {
    if(position.result||used>=policy.nodes||(depth<=0&&position.bonus===null))return evaluate(position,perspective,params)
    const actions=evaluateActions(position,legal(position))
    if(!actions.length)return evaluate(position,perspective,params)
    let best=position.side===perspective?-Infinity:Infinity
    for(const row of actions.slice(0,position.bonus!==null?Math.max(2,policy.width):policy.width)){
      const score=used>=policy.nodes?row.score:row.states.reduce((sum,next)=>sum+next.weight*search(next.game,depth-(position.side!==next.game.side?1:0)),0)
      best=position.side===perspective?Math.max(best,score):Math.min(best,score)
    }
    return best
  }
  const candidates=evaluateActions(game,legal(game))
  if(!candidates.length)return
  if(difficulty==='rookie'){
    if(random()<.3)return candidates[Math.floor(random()*Math.min(5,candidates.length))].action
    return candidates[0].action
  }
  // Give every shortlisted root move an equal budget so move order does not buy extra search.
  const shortlist=candidates.slice(0,policy.width+3)
  const budget=Math.max(50,Math.floor((policy.nodes-used)/shortlist.length))
  let best=shortlist[0],bestScore=-Infinity
  for(const row of shortlist){
    const baseline=used
    used=Math.max(0,policy.nodes-budget)
    const score=row.states.reduce((sum,next)=>sum+next.weight*search(next.game,policy.depth-(next.game.side!==game.side?1:0)),0)
    used=baseline
    if(score>bestScore){best=row;bestScore=score}
  }
  return best.action
}

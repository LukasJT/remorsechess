import {at,captureTarget,file,inCheck,legal,play,rank,type Action,type Game,type Side} from './rules.ts'
import {prior,valueOf} from './bot-features.ts'
import {trainedWeights} from './bot-model.ts'

import {difficulties,type Difficulty} from './bot-levels.ts'
export {difficulties,type Difficulty} from './bot-levels.ts'

type Chance={game:Game;weight:number}
type Line={action:Action;states:Chance[];value:number}
const outcomes=[[1,1],[2,2],[4,2],[6,1]] as const
const material={p:100,n:320,b:335,r:510,q:950,k:25_000}
const win=25_000

function statically(game:Game,side:Side,weights:readonly number[]){
  if(game.bonus!==null&&game.rulesVersion>=2&&inCheck(game,game.side==='white'?'black':'white')){
    const kingCapture=legal(game).some(action=>captureTarget(game,action)?.kind==='k')
    if(kingCapture)return game.side===side?win:-win
  }
  return valueOf(game,side,weights)
}
function order(game:Game,action:Action){
  if(action.type==='end')return 0
  if(action.type==='absolve'){
    const p=at(game,action.to)!
    return p.kind==='k'?2500:material[p.kind]*(p.rescue===1?.65:.16)
  }
  const victim=captureTarget(game,action)
  const actor=at(game,action.from)!
  let score=action.promotion?650:0
  if(victim)score+=(victim.side===game.side?-1:1)*material[victim.kind]-.12*material[actor.kind]
  if(!victim){
    const center=(square:number)=>7-Math.abs(file(square)-3.5)-Math.abs(rank(square)-3.5)
    const delta=center(action.to)-center(action.from)
    if(actor.kind==='p')score+=8+delta*10
    if(actor.kind==='n'||actor.kind==='b')score+=delta*7+(actor.moved?0:16)
    if(actor.kind==='k'&&Math.abs(action.from-action.to)===2)score+=60
  }
  return score
}

export function chooseMove(game:Game,difficulty:Difficulty,random:()=>number=Math.random,weights:readonly number[]=trainedWeights):Action|undefined{
  const policy=difficulties[difficulty]
  const side=game.side
  const options=legal(game)
  if(options.length<=1)return options[0]
  const king=options.find(action=>captureTarget(game,action)?.kind==='k')
  if(king)return king
  let nodes=0
  let limit=Infinity
  function line(position:Game,action:Action):Line {
    const target=captureTarget(position,action)
    const canRoll=target&&action.type==='move'&&!at(position,action.from)?.roll
    const faces=canRoll?outcomes:[[4,6] as const]
    const states=faces.map(([face,multiplicity])=>{
      nodes++
      const next=play(position,action,()=>face)!.game
      return {game:next,weight:multiplicity/6}
    })
    const value=states.reduce((sum,state)=>sum+state.weight*statically(state.game,side,weights),0)
    return {action,states,value}
  }
  const chooseBest=(max:boolean,a:number,b:number)=>max?Math.max(a,b):Math.min(a,b)
  function recurse(position:Game,depth:number,extension:number):number {
    if(position.result||nodes>=limit)return statically(position,side,weights)
    const max=position.side===side, check=inCheck(position,position.side), bonus=position.bonus!==null
    const quiet=depth<=0&&!bonus&&!check
    if(depth<=0&&extension<=0&&!bonus)return statically(position,side,weights)
    let actions=legal(position)
    if(quiet)actions=actions.filter(a=>Boolean(captureTarget(position,a))||(a.type==='move'&&Boolean(a.promotion)))
    if(!actions.length)return statically(position,side,weights)
    const terminal=actions.find(a=>captureTarget(position,a)?.kind==='k')
    if(terminal)return max?win:-win
    const width=quiet?Math.max(2,policy.beam-2):policy.beam
    const ordered=actions.map(a=>({a,value:order(position,a)})).sort((a,b)=>b.value-a.value)
    const lines=ordered.slice(0,bonus||check?Math.max(width*2,10):width*2+1).map(row=>line(position,row.a))
    lines.sort((a,b)=>(max?1:-1)*(b.value-a.value))
    let best=quiet?statically(position,side,weights):max?-Infinity:Infinity
    const shortlist=lines.slice(0,width)
    for(const [i,candidate] of shortlist.entries()){
      if(nodes>=limit){best=chooseBest(max,best,candidate.value);continue}
      const enclosingLimit=limit
      const budget=Math.max(0,Math.floor((limit-nodes)/(shortlist.length-i)))
      const value=candidate.states.reduce((sum,state)=>{
        limit=Math.min(enclosingLimit,nodes+Math.ceil(budget/candidate.states.length))
        const spent=state.game.side!==position.side?1:0
        const childDepth=depth-spent
        const nextExtension=depth<=0&&!bonus?extension-1:extension
        return sum+state.weight*recurse(state.game,childDepth,nextExtension)
      },0)
      limit=enclosingLimit
      best=chooseBest(max,best,value)
    }
    return best
  }
  const roots=options.map(action=>line(game,action)).sort((a,b)=>b.value-a.value)
  const viable=roots.filter(row=>row.value>-win)
  if(!viable.length)return roots[0].action
  const finalWidth=policy.roots
  let selected=viable.slice(0,Math.max(finalWidth,10))
  // Screen every shortlisted move for immediate recaptures before deepening the most promising lines.
  const extend=policy.depth>=2?1:0
  for(let depth=1;depth<=policy.depth;depth++){
    const remaining=Math.max(0,policy.budget-nodes)
    const share=Math.max(42,Math.floor(remaining/(selected.length*(policy.depth-depth+1))))
    selected=selected.map(row=>{
      limit=nodes+share
      const value=row.states.reduce((sum,state)=>{
        const spent=state.game.side!==side?1:0
        const childDepth=depth-spent
        return sum+state.weight*recurse(state.game,childDepth,depth===1||depth===policy.depth?extend:0)
      },0)
      return {...row,value}
    }).sort((a,b)=>b.value-a.value)
    if(depth<policy.depth)selected=selected.slice(0,Math.max(policy.beam+2,Math.ceil(selected.length*.68)))
  }
  if(policy.mistake&&selected.length>1&&random()<policy.mistake){
    const alternatives=selected.filter(row=>row.value>=selected[0].value-90).slice(0,4)
    return alternatives[Math.floor(random()*alternatives.length)].action
  }
  return selected[0].action
}
export const baselineWeights=prior

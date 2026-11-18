import {initial,play,opposite} from '../src/rules.ts'
import {chooseMove} from '../src/bot.ts'

function rng(seed){
  return ()=>{
    seed=(Math.imul(seed,1664525)+1013904223)>>>0
    return seed/0x100000000
  }
}
const variants=[
  {name:'Prior weights',values:{guilt:.69,rescue:.32,psychopath:.32,bloodlust:.62}},
  {name:'Bishop rescue',values:{guilt:.7,rescue:.45,psychopath:.27,bloodlust:.59}},
  {name:'Aggressive capture',values:{guilt:.76,rescue:.24,psychopath:.45,bloodlust:.68}},
]
const score=Object.fromEntries(variants.map(v=>[v.name,{win:0,draw:0,loss:0}]))
let games=0
for(let i=0;i<variants.length;i++)for(let j=i+1;j<variants.length;j++)for(let gameNo=0;gameNo<6;gameNo++){
  const players=gameNo%2?[variants[j],variants[i]]:[variants[i],variants[j]]
  const random=rng(2671+Math.floor(gameNo/2)*7891)
  let game=initial()
  for(let ply=0;ply<140&&!game.result;ply++){
    const agent=players[game.side==='white'?0:1]
    const action=chooseMove(game,'rookie',random,agent.values)
    if(!action)break
    game=play(game,action,()=>1+Math.floor(random()*6)).game
  }
  games++
  if(game.result?.winner){
    score[players[game.result.winner==='white'?0:1].name].win++
    score[players[opposite(game.result.winner)==='white'?0:1].name].loss++
  }else for(const p of players)score[p.name].draw++
}
console.log(JSON.stringify({games,score},null,2))

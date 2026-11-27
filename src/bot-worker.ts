import {chooseMove,type Difficulty} from './bot.ts'
import type {Game} from './rules.ts'
addEventListener('message',(event:MessageEvent<{game:Game;difficulty:Difficulty}>)=>{
  postMessage(chooseMove(event.data.game,event.data.difficulty))
})

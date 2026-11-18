import {test} from 'node:test'
import assert from 'node:assert/strict'
import {chooseMove} from '../src/bot.ts'
import {initial,legal,play,type Game,type Piece} from '../src/rules.ts'

function position(pieces:Partial<Piece>[],side:Game['side']='white'):Game{
  const all:Partial<Piece>[]=[{side:'white',kind:'k',square:4},{side:'black',kind:'k',square:60},...pieces]
  return {...initial(),side,seen:{},pieces:all.map((p,id)=>({id,side:'white',kind:'p',square:10,mood:'normal',roll:0,kills:0,rescue:0,moved:true,...p}))}
}
test('the expert rescues its immobilized queen on the final turn',()=>{
  const g=position([{kind:'q',square:18,mood:'devastated',roll:1,kills:1,rescue:1},{kind:'b',square:19},{side:'black',square:49}])
  assert.deepEqual(chooseMove(g,'expert'),{type:'absolve',from:19,to:18})
})
test('the bot understands optional bonus moves and avoids a friendly sacrifice',()=>{
  const g=position([{kind:'n',square:27,mood:'bloodlust',roll:6,kills:3},{kind:'q',square:44},{side:'black',square:49}])
  g.bonus=2
  const action=chooseMove(g,'expert')
  assert.deepEqual(action,{type:'end'})
  assert.ok(legal(g).some(a=>a.type==='move'&&a.to===44))
})
test('a repeat capture reports the current mood and original die without rolling again',()=>{
  const g=position([{kind:'n',square:10,mood:'psychopath',roll:6,kills:2},{side:'black',square:27},{side:'black',square:44}])
  const step=play(g,{type:'move',from:10,to:27},()=>{throw Error('Unexpected reroll')})
  assert.deepEqual(step?.event.captureState,{mood:'bloodlust',originalRoll:6,kills:3})
  assert.equal(step?.event.roll,undefined)
})

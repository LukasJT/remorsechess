import type {Match} from './match.ts'
const first=['moss','riley','quiet','night','maple','jamie','silver','alex','river','noah','hazel','pixel','ember','luna','coffee','blue']
const last=['rook','tempo','skates','fern','orbit','paw','notes','atlas','onfilm','fox','waves','knight','byte','rush','toast','plays']
const pick=(words:string[])=>words[Math.floor(Math.random()*words.length)]
export function queueHandle(){
  return pick(first)+pick(last)+(Math.random()<.55?String(Math.floor(Math.random()*1000)):'')
}
export function thinkTime(m:Match,available:number,random=Math.random){
  const scale=m.game.bonus!==null?.35:m.game.turn<=8?.65:m.game.pieces.length<=12?2:3.5
  const tempo=Math.min(2.5,Math.sqrt((m.control.seconds||180)/180))
  const varied=scale*tempo*(.45+random()**2*2.4)*1000
  return Math.round(Math.max(30,Math.min(varied,available*.07,12000)))
}

// A log-normal delay gives Daily replies a long right tail.
export function dailyThinkTime(m:Match){
  const random=(salt:number)=>{
    const n=Math.sin(m.start*.000013+m.version*.782+salt)*10000
    return Math.max(.000001,n-Math.floor(n))
  }
  const normal=Math.sqrt(-2*Math.log(random(1)))*Math.cos(2*Math.PI*random(2))
  const median=2*60*60_000*Math.sqrt(m.control.days??1)
  const available=m.clock[m.game.side]
  const delay=m.game.bonus!==null?median*.06:median*Math.exp(.95*normal)
  return Math.round(Math.min(available*.8,Math.max(2*60_000,delay)))
}

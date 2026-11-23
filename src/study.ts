import {matchingOpening,openings,replayStudy} from './openings.ts'
import {at,captureTarget,legal,moodNames,name,play,type Action,type Game,type Side} from './rules.ts'
import {difficulties,type Difficulty} from './bot-levels.ts'
import './study.css'

const foot=document.querySelector<HTMLInputElement>('#opening-search')
foot?.addEventListener('input',()=>{
  for(const row of document.querySelectorAll<HTMLElement>('#opening-list li')){
    row.hidden=!row.textContent.toLowerCase().includes(foot.value.trim().toLowerCase())
  }
})

const root=document.querySelector<HTMLElement>('[data-study]')
const opening=openings.find(([slug])=>slug===root?.dataset.study)
if(root&&opening)study(root,opening[3])

function study(root:HTMLElement,line:string){
  const moves=line.split(' ')
  let face=4, index=0, flipped=false, selected:number|null=null
  let difficulty:Difficulty='tactical'
  let human:Side|null=null, agent:Worker|null=null
  let positions=[replayStudy('',face)], notes=['Starting position']
  const glyphs={white:{p:'♙',n:'♘',b:'♗',r:'♖',q:'♕',k:'♔'},black:{p:'♟',n:'♞',b:'♝',r:'♜',q:'♛',k:'♚'}}
  const position=()=>positions.at(-1)!
  function main(next:number){
    agent?.terminate();agent=null;human=null
    index=Math.max(0,Math.min(moves.length,next))
    positions=Array.from({length:index+1},(_,i)=>replayStudy(moves.slice(0,i).join(' '),face))
    notes=['Starting position',...moves.slice(0,index).map(move=>move.slice(0,2)+'–'+move.slice(2))]
    selected=null
    draw()
  }
  function step(action:Action){
    const next=play(position(),action,human?undefined:()=>face)
    if(!next)return
    positions.push(next.game)
    notes.push(next.event.text+(next.event.roll?' · Roll '+next.event.roll:''))
    selected=null
    draw()
    respond()
  }
  function respond(){
    const game=position()
    if(!human||game.side===human||game.result||agent)return
    const worker=new Worker(new URL('./bot-worker.ts',import.meta.url),{type:'module'})
    agent=worker
    worker.onmessage=(event:MessageEvent<Action|undefined>)=>{
      worker.terminate()
      if(agent!==worker)return
      agent=null
      if(position()===game&&event.data)step(event.data)
    }
    worker.onerror=()=>{
      worker.terminate()
      if(agent===worker){agent=null;const status=root.querySelector('[role=status]');if(status)status.textContent='The practice bot could not move. Reset to keep studying.'}
    }
    worker.postMessage({game,difficulty})
  }
  function draw(){
    const active=document.activeElement
    const focus=active instanceof HTMLButtonElement&&root.contains(active)?active.dataset.control:undefined
    const game=position()
    const opening=matchingOpening(game)
    const actions=legal(game)
    const options=actions.filter(a=>a.type!=='end'&&a.from===selected)
    const board=Array.from({length:64},(_,i)=>{
      const square=flipped?7-(i%8)+Math.floor(i/8)*8:i%8+(7-Math.floor(i/8))*8
      const piece=at(game,square)
      const description=name(square)+(piece?' '+piece.side+' '+piece.kind+(piece.roll?' '+moodNames[piece.mood]:''):'')
      return '<button type="button" data-square="'+square+'" class="'+((i%8+Math.floor(i/8))%2?'dark':'light')+'" aria-label="'+description+'" aria-pressed="'+(selected===square)+'" '+(options.some(a=>a.type!=='end'&&a.to===square)?'data-target':'')+'>'+(piece?glyphs[piece.side][piece.kind]:'')+'</button>'
    })
    const continuations=actions.filter(a=>a.type!=='end'&&(game.bonus!==null||captureTarget(game,a))).slice(0,12)
    root.innerHTML='<div class="study-board" role="group" aria-label="Chessboard">'+board.join('')+'</div>'+
      '<p role="status">'+(game.result?(game.result.winner?game.result.winner+' wins':'Draw')+' · '+game.result.reason:game.side+' to move'+(game.bonus!==null?' · Mandatory bonus move':'')+(human?' · Unrated practice':''))+'</p>'+
      (opening&&opening[0]!==root.dataset.study?'<p>Transposes to <a href="/openings/'+opening[0]+'/">'+opening[1]+'</a></p>':'')+
      '<div class="study-controls"><button data-control="back">Back</button><button data-control="next" '+(human||index===moves.length?'disabled':'')+'>Next book move</button><button data-control="flip">Flip</button><button data-control="reset">Reset</button>'+
      '<label>Study die <select id="study-die" '+(human?'disabled':'')+'>'+[1,2,3,4,5,6].map(n=>'<option '+(n===face?'selected':'')+'>'+n+'</option>').join('')+'</select></label></div>'+
      '<div class="study-controls"><label>Practice level <select id="study-level">'+(['rookie','tactical','expert'] as const).map(level=>'<option value="'+level+'" '+(level===difficulty?'selected':'')+'>'+difficulties[level].name+'</option>').join('')+'</select></label><button data-control="practice-white">Play from here as White</button><button data-control="practice-black">Play from here as Black</button></div>'+
      (!human&&continuations.length?'<div class="study-controls"><strong>Try a continuation</strong>'+continuations.map(a=>'<button data-action="'+actions.indexOf(a)+'">'+(a.type==='end'?'End turn':name(a.from)+'–'+name(a.to))+'</button>').join('')+'</div>':'')+
      '<details><summary>Moves and events</summary><ol>'+notes.slice(1).map(note=>'<li>'+note+'</li>').join('')+'</ol></details>'
    if(focus)root.querySelector<HTMLButtonElement>('[data-control="'+focus+'"]:not(:disabled)')?.focus()
  }
  root.addEventListener('change',event=>{
    if(!(event.target instanceof HTMLSelectElement))return
    if(event.target.id==='study-die'){face=Number(event.target.value);main(index)}
    if(event.target.id==='study-level'&&Object.hasOwn(difficulties,event.target.value))difficulty=event.target.value as Difficulty
  })
  root.addEventListener('click',event=>{
    const element=(event.target as HTMLElement).closest<HTMLButtonElement>('button')
    if(!element)return
    const {control,square,action}=element.dataset
    const game:Game=position()
    if(control==='reset'){main(0);return}
    if(control==='flip'){flipped=!flipped;draw();return}
    if(control==='back'){
      if(human){main(index);return}
      if(positions.length>index+1){positions.pop();notes.pop();selected=null;draw()}
      else main(index-1)
      return
    }
    if(control==='next'){main(index+1);return}
    if(control==='practice-white'||control==='practice-black'){
      agent?.terminate();agent=null
      human=control==='practice-white'?'white':'black';flipped=human==='black';selected=null;draw();respond();return
    }
    if(game.result||human&&human!==game.side)return
    if(action!==undefined){const choice=legal(game)[Number(action)];if(choice)step(choice);return}
    if(square===undefined)return
    const target=Number(square)
    const choices=legal(game).filter(a=>a.type!=='end'&&a.from===selected&&a.to===target)
    if(choices.length){
      if(choices.length===1){step(choices[0]);return}
      const picker=document.createElement('div');picker.className='study-controls'
      for(const choice of choices){
        const button=document.createElement('button')
        button.textContent=choice.type==='absolve'?'Absolve':choice.type==='move'&&choice.promotion?'Promote to '+choice.promotion:'Move'
        button.onclick=()=>step(choice)
        picker.appendChild(button)
      }
      root.appendChild(picker);picker.querySelector('button')?.focus();return
    }
    selected=at(game,target)?.side===game.side?target:null
    draw()
    root.querySelector<HTMLButtonElement>('[data-square="'+target+'"]')?.focus()
  })
  main(0)
}

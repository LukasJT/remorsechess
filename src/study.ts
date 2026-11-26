import {matchingOpening,openings,replayStudy} from './openings.ts'
import {at,captureTarget,legal,moodNames,name,play,type Action,type Game,type Side} from './rules.ts'
import {difficulties,type Difficulty} from './bot-levels.ts'
import {engravedPiece} from './piece-art.ts'
import {retroIcon} from './site-navigation.ts'
import './study.css'

const search=document.querySelector<HTMLInputElement>('#opening-search')
const empty=document.querySelector<HTMLElement>('#opening-empty')
search?.addEventListener('input',()=>{
  const query=search.value.trim().toLowerCase()
  let matches=0
  for(const group of document.querySelectorAll<HTMLElement>('.opening-group')){
    const rows=[...group.querySelectorAll('li')]
    for(const row of rows)row.hidden=!row.textContent.toLowerCase().includes(query)
    const shown=rows.filter(row=>!row.hidden).length
    group.hidden=shown===0
    matches+=shown
  }
  if(empty)empty.hidden=matches>0
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
    const dieFocused=active?.id==='study-die'
    const logOpen=Boolean(root.querySelector('details[open]'))
    const game=position()
    const opening=matchingOpening(game)
    const actions=legal(game)
    const options=actions.filter(a=>a.type!=='end'&&a.from===selected)
    const board=Array.from({length:64},(_,i)=>{
      const square=flipped?7-(i%8)+Math.floor(i/8)*8:i%8+(7-Math.floor(i/8))*8
      const piece=at(game,square)
      const coordinate=name(square)
      const description=coordinate+(piece?' '+piece.side+' '+piece.kind+(piece.roll?' '+moodNames[piece.mood]:''):'')
      const edges=(i%8===0?'<span class="study-rank" aria-hidden="true">'+coordinate[1]+'</span>':'')+
        (i>=56?'<span class="study-file" aria-hidden="true">'+coordinate[0]+'</span>':'')
      return '<button type="button" data-square="'+square+'" class="'+((i%8+Math.floor(i/8))%2?'dark':'light')+'" aria-label="'+description+'" aria-pressed="'+(selected===square)+'" '+(options.some(a=>a.type!=='end'&&a.to===square)?'data-target':'')+'>'+(piece?engravedPiece(piece.kind,piece.side):'')+edges+'</button>'
    })
    const continuations=actions.filter(a=>a.type!=='end'&&(game.bonus!==null||captureTarget(game,a))).slice(0,12)
    const outcome=game.result?.winner==='white'?'White':game.result?.winner==='black'?'Black':''
    const turn=game.side==='white'?'White':'Black'
    const turnStatus=game.result?(outcome?outcome+' wins':'Draw')+' · '+game.result.reason:
      turn+' to move'+(game.bonus!==null?' · Mandatory bonus move':'')+(human?' · Unrated practice':'')
    const choice=(side:Side,label:string)=>'<button data-control="practice-'+side+'">'+engravedPiece('k',side)+'<span>Play as '+label+'</span></button>'
    root.innerHTML='<div class="study-board" role="group" aria-label="Chessboard">'+board.join('')+'</div><div class="study-console">'+
      '<header class="study-console-head"><h2>'+retroIcon('openings')+' Analysis board</h2><p role="status">'+turnStatus+'</p>'+
      (opening&&opening[0]!==root.dataset.study?'<p>Transposes to <a href="/openings/'+opening[0]+'/">'+opening[1]+'</a></p>':'')+'</header>'+
      '<section class="study-section"><div class="study-section-heading"><h3>Book playback</h3><span>'+index+' / '+moves.length+'</span></div>'+
      '<div class="study-command-row"><button data-control="back">‹ Back</button><button class="study-next" data-control="next" '+(human||index===moves.length?'disabled':'')+'>Next move ›</button></div>'+
      '<div class="study-command-row"><button data-control="flip">⇅ Flip board</button><button data-control="reset">↺ Reset position</button></div></section>'+
      '<section class="study-section study-die-section"><label for="study-die">'+retroIcon('dice')+' Study die</label><select id="study-die" '+(human?'disabled':'')+'>'+
      [1,2,3,4,5,6].map(n=>'<option '+(n===face?'selected':'')+'>'+n+'</option>').join('')+'</select>'+
      (!human&&continuations.length?'<div class="study-continuations"><h3>Try a continuation</h3><div>'+continuations.map(a=>
        '<button data-action="'+actions.indexOf(a)+'">'+(a.type==='end'?'End turn':name(a.from)+'–'+name(a.to))+'</button>').join('')+'</div></div>':'')+'</section>'+
      '<section class="study-section"><h3>Practice vs bot</h3><label class="study-level" for="study-level"><span>Level</span><select id="study-level">'+
      (['rookie','tactical','expert'] as const).map(level=>'<option value="'+level+'" '+(level===difficulty?'selected':'')+'>'+difficulties[level].name+'</option>').join('')+
      '</select></label><div class="study-command-row">'+choice('white','White')+choice('black','Black')+'</div></section>'+
      '<details class="study-events"'+(logOpen?' open':'')+'><summary>Moves and events</summary>'+
      (notes.length>1?'<ol>'+notes.slice(1).map(note=>'<li>'+note+'</li>').join('')+'</ol>':'<p>No moves yet.</p>')+'</details></div>'
    for(const ply of document.querySelectorAll<HTMLElement>('[data-book-ply]')){
      if(Number(ply.dataset.bookPly)===index)ply.setAttribute('aria-current','step')
      else ply.removeAttribute('aria-current')
    }
    if(dieFocused)root.querySelector<HTMLElement>('#study-die')?.focus({preventScroll:true})
    if(focus)root.querySelector<HTMLButtonElement>('[data-control="'+focus+'"]:not(:disabled)')?.focus({preventScroll:true})
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
      root.querySelector('.study-console')?.appendChild(picker);picker.querySelector('button')?.focus();return
    }
    selected=at(game,target)?.side===game.side?target:null
    draw()
    root.querySelector<HTMLButtonElement>('[data-square="'+target+'"]')?.focus()
  })
  main(0)
}

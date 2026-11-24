import {puzzleAt,puzzleCount} from './puzzle-book.ts'
import {at,legal,name,play} from './rules.ts'
import {engravedPiece} from './piece-art.ts'
const rolls=['','Devastated','Guilt-ridden','Guilt-ridden','Unaffected','Unaffected','Psychopath']
type Score={rating:number;done:Record<string,boolean>}
export async function openPuzzles(modal:(html:string)=>void,user:string|undefined,api:<T>(path:string,data?:unknown)=>Promise<T>,featuredId?:number,workspace?:HTMLElement){
  const day=Math.floor(Date.now()/86400000)
  const key='remorse-puzzles-v1/'+(user??'guest')
  const read=():Score=>{
    try{return JSON.parse(localStorage.getItem(key)??'{"rating":800,"done":{}}')}
    catch{return {rating:800,done:{}}}
  }
  let score=featuredId!==undefined?{rating:800,done:{}}:user?await api<Score>('puzzle-score'):read()
  let pending=false
  let id=featuredId??(day*17)%puzzleCount
  let lesson=puzzleAt(id),game=lesson.game,selected:number|null=null,step=0
  let mode:'daily'|'rated'|'practice'=featuredId===undefined?'daily':'practice'
  let hint=false
  let previousMove:number[]=[]
  let movesPlayed:string[]=[]
  let delta:number|null=null
  const dailyId=id
  const choices=Array.from({length:puzzleCount},(_,id)=>({id,...puzzleAt(id)}))
  function nextRated(){
    return choices.filter(p=>!('practice/'+p.id in score.done)).sort((a,b)=>Math.abs(a.strength-score.rating)-Math.abs(b.strength-score.rating))[0]?.id
  }
  function load(next:number){
    id=next;lesson=puzzleAt(id);game=lesson.game;selected=null;step=0
    message='';hint=false;previousMove=[];movesPlayed=[];delta=null
    render()
  }
  let message=''
  const attempt=()=>mode==='daily'?'daily/'+day:'practice/'+id
  const record=async(won:boolean,moves:string[])=>{
    if(featuredId!==undefined||mode==='practice')return
    const state=score,token=attempt()
    if(token in state.done)return
    const before=state.rating
    if(user){
      score=await api<Score>('puzzle-score',{id,token,moves})
      delta=score.rating-before
      return
    }
    const expected=1/(1+10**((lesson.strength-state.rating)/400))
    state.rating=Math.max(100,Math.round(state.rating+48*(Number(won)-expected)))
    state.done[token]=won;delta=state.rating-before
    try{localStorage.setItem(key,JSON.stringify(state))}catch{}
  }
  const render=()=>{
    const root=workspace??document
    const focused=(document.activeElement as HTMLElement|null)?.dataset.square
    const finished=step===lesson.line.length
    const actions=selected===null?[]:legal(game,selected)
    let squares=''
    for(let i=0;i<64;i++){
      const sq=lesson.game.side==='white'?((7-(i>>3))*8+i%8):((i>>3)*8+7-i%8)
      const p=at(game,sq)
      const target=actions.some(a=>a.type!=='end'&&a.to===sq)
      squares+='<button type="button" data-square="'+sq+'" class="'+(i%2===(i>>3)%2?'light':'dark')+(sq===selected?' chosen':'')+(target?' target':'')+(previousMove.includes(sq)?' last-move':'')+(hint&&name(sq)===lesson.line[step]?.slice(0,2)?' hint':'')+'" aria-label="'+name(sq)+(p?' '+p.side+' '+p.kind:'')+'"><span class="piece '+(p?.side??'')+'">'+(p?engravedPiece(p.kind,p.side):'')+'</span>'+(p?.roll?'<b class="puzzle-piece-state" title="'+p.mood+'">'+(p.rescue||{devastated:'!',guilty:'×',psychopath:'+',bloodlust:'▲',normal:'·'}[p.mood])+'</b>':'')+'<small>'+name(sq)+'</small></button>'
    }
    const boardMarkup='<div class="puzzle-board" aria-label="Puzzle chessboard">'+squares+'</div>'
    const prompt=message||(game.side==='white'?'White':'Black')+' to move.'
    if(workspace){
      const modeButtons=(['daily','rated','practice'] as const).map(tab=>'<button type="button" data-mode="'+tab+'" aria-pressed="'+(mode===tab)+'">'+tab[0].toUpperCase()+tab.slice(1)+'</button>').join('')
      const browse=mode==='practice'?'<label for="practice-choice">Choose a position</label><select id="practice-choice">'+choices.map(p=>'<option value="'+p.id+'" '+(id===p.id?'selected':'')+'>'+p.title+(p.id>=puzzleCount/4?' · Variation '+(1+Math.floor(p.id/(puzzleCount/4))):'')+'</option>').join('')+'</select>':''
      const exhausted=mode==='rated'&&nextRated()===undefined
      workspace.innerHTML='<nav class="puzzle-modes" aria-label="Puzzle mode">'+modeButtons+'</nav>'+
        '<section class="puzzle-instructions"><div><h2>'+lesson.title+'</h2><p>'+lesson.goal+'</p></div>'+'<div class="puzzle-roll"><span class="puzzle-die" aria-hidden="true">'+lesson.face+'</span><div><span>'+(game.pieces.some(p=>p.roll===lesson.face&&!lesson.game.pieces.some(start=>start.id===p.id&&start.roll===p.roll))?'Rolled':'Next capture')+'</span><strong>'+rolls[lesson.face]+'</strong></div></div>'+'</section>'+
        '<div class="puzzle-table">'+boardMarkup+'</div>'+
        '<aside class="puzzle-controls"><div class="puzzle-meter"><span>Your puzzle rating</span><strong>'+score.rating+'</strong>'+(delta===null?'':' <b>'+(delta>0?'+':'')+delta+'</b>')+'</div>'+
        '<p class="puzzle-feedback" role="status">'+prompt+'</p>'+
        '<h3>Moves</h3>'+(movesPlayed.length?'<ol class="puzzle-moves">'+movesPlayed.map(move=>'<li>'+move+'</li>').join('')+'</ol>':'<p class="puzzle-muted">No moves played</p>')+
        browse+(exhausted?'<p>All rated puzzles attempted. You can replay them in Practice.</p>':'')+
        '<div class="puzzle-actions">'+(mode==='rated'&&!exhausted?'<button type="button" data-next-puzzle>Next rated puzzle</button>':'')+
        (mode==='practice'&&!finished?'<button type="button" data-hint>Hint</button>':'')+
        '<button type="button" data-reset>Reset board</button><a href="/?practice-puzzle='+id+'">Play this position vs bot</a></div></aside>'
      workspace.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach(button=>button.onclick=()=>{
        if(pending)return
        const next=button.dataset.mode as typeof mode
        if(next===mode)return
        mode=next;load(next==='daily'?dailyId:next==='rated'?nextRated()??id:id)
      })
      const picker=workspace.querySelector('#practice-choice')
      if(picker instanceof HTMLSelectElement)picker.onchange=()=>{if(!pending)load(Number(picker.value))}
      workspace.querySelector<HTMLButtonElement>('[data-reset]')!.onclick=()=>{if(!pending)load(id)}
      const hintButton=workspace.querySelector<HTMLButtonElement>('[data-hint]')
      if(hintButton)hintButton.onclick=()=>{hint=true;message='Try the highlighted piece.';render()}
    }else{
      modal(boardMarkup+'<p role="status">'+prompt+'</p><button data-next-puzzle>Reset puzzle</button>')
    }
    const board=root.querySelector<HTMLElement>('.puzzle-board')!
    if(focused!==undefined)board.querySelector<HTMLElement>('[data-square="'+focused+'"]')?.focus({preventScroll:true})
    board.onclick=e=>{
      const button=(e.target as Element).closest<HTMLButtonElement>('[data-square]')
      if(button)void selectSquare(Number(button.dataset.square))
    }
    let dragged:number|null=null
    board.querySelectorAll<HTMLButtonElement>('[data-square]').forEach(button=>{
      const sq=Number(button.dataset.square)
      button.draggable=at(game,sq)?.side===game.side&&!finished
    })
    board.ondragstart=e=>{
      const button=(e.target as Element).closest<HTMLButtonElement>('[data-square]')
      if(button?.draggable&&!pending){dragged=Number(button.dataset.square);e.dataTransfer?.setData('text/plain',String(dragged))}
    }
    board.ondragover=e=>{if(dragged!==null)e.preventDefault()}
    board.ondrop=e=>{
      e.preventDefault()
      const button=(e.target as Element).closest<HTMLButtonElement>('[data-square]')
      if(dragged!==null&&button){selected=dragged;void selectSquare(Number(button.dataset.square))}
      dragged=null
    }
    board.ondragend=()=>{dragged=null}
    async function selectSquare(sq:number){
      if(pending||finished)return
      const action=selected===null?undefined:legal(game,selected).find(a=>a.type!=='end'&&a.to===sq)
      if(action&&action.type!=='end'){
        const code=name(selected!)+name(sq)
        pending=true
        try{
        const moves=[...lesson.line.slice(0,step),code]
        if(code!==lesson.line[step]){await record(false,moves);message='Try another move.'}
        else{
          if(step+1===lesson.line.length)await record(true,moves)
          const result=play(game,action,()=>lesson.face)!
          game=result.game;step++
          previousMove=[action.from,action.to]
          movesPlayed.push(result.event.text)
          hint=false
          message=step===lesson.line.length?'Solved.':'Play the bonus move.'

        }
        }catch{message='Could not save this attempt. Try again.'}finally{pending=false}
        if(!board.isConnected)return
        selected=null
      }else selected=at(game,sq)?.side===game.side?sq:null
      render()
    }
    const nextButton=root.querySelector<HTMLElement>('[data-next-puzzle]')
    if(nextButton)nextButton.onclick=()=>{
      if(!pending)load(workspace?nextRated()??id:id)
    }

  }
  render()
}

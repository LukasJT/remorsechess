import './style.css'
import {at,file,rank,name,legal,initial,play,moodNames,inCheck,opposite,type Action,type Side,type Kind} from './rules.ts'
import {command,makeMatch,expire,remaining,presets,type Match,type Control,type Command} from './match.ts'
import {pool,deviation,type Rating} from './rating.ts'
import {difficulties,type Difficulty} from './bot.ts'
import type {PublicKeyCredentialCreationOptionsJSON,PublicKeyCredentialRequestOptionsJSON} from '@simplewebauthn/browser'
const root=document.querySelector<HTMLElement>('#app')!
const $=<T extends HTMLElement=HTMLElement>(s:string)=>document.querySelector<T>(s)
const safe=(x:unknown)=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
const labels={p:'Pawn',n:'Knight',b:'Bishop',r:'Rook',q:'Queen',k:'King'}
const pixels={
  p:['   ###   ','  #####  ','  #####  ','   ###   ','   ###   ','  #####  ','  #####  ',' ####### ','#########'],
  n:['  ###    ',' ######  ','###### # ','### #### ','##   ####','    #####','  #######',' ####### ','#########'],
  b:['    #    ','   ###   ','  ### #  ',' ####### ','  #####  ','   ###   ','   ###   ',' ####### ','#########'],
  r:['## # # ##','#########',' ####### ','  #####  ','  #####  ','  #####  ','  #####  ',' ####### ','#########'],
  q:['#   #   #','## ### ##','#########',' ####### ','  #####  ','   ###   ','  #####  ',' ####### ','#########'],
  k:['    #    ','   ###   ','    #    ',' ## # ## ','#########',' ####### ','  #####  ',' ####### ','#########'],
}
const sprites=new Map<string,string>()
function art(kind:Kind,side:Side){
  if(prefs.pieces==='classic')return {p:'♟',n:'♞',b:'♝',r:'♜',q:'♛',k:'♚'}[kind]
  const key=kind+side
  if(!sprites.has(key)){
    const canvas=document.createElement('canvas')
    canvas.width=22;canvas.height=23
    const context=canvas.getContext('2d')!
    for(const outline of [true,false]){
      pixels[kind].forEach((row,y)=>[...row].forEach((mark,x)=>{
        if(mark!=='#')return
        context.fillStyle=outline?(side==='white'?'#674735':'#1f1423'):side==='white'?(y<5?'#ffe6a8':'#ecb96f'):(y<5?'#614960':'#3e2c43')
        context.fillRect(x*2+(outline?1:2),y*2+(outline?1:2),outline?4:2,outline?4:2)
      }))
    }
    sprites.set(key,canvas.toDataURL())
  }
  return '<img draggable="false" alt="" src="'+sprites.get(key)+'">'
}
const dice=['⚀','⚁','⚂','⚃','⚄','⚅']
const cap=(s:Side)=>s==='white'?'White':'Black'
const grid=Array.from({length:64},(_,i)=>(7-Math.floor(i/8))*8+i%8)
const rules='<p>Every piece rolls once, on its first capture.</p><dl><dt>1 · Devastated</dt><dd>Frozen. A friendly bishop must absolve it within its owner’s next three turns.</dd><dt>2–3 · Guilt-ridden</dt><dd>Can move but cannot capture until absolved.</dd><dt>4–5 · Unaffected</dt><dd>Moves and captures normally.</dd><dt>6 · Psychopath</dt><dd>After capturing, move the same piece again or end the turn. At three captures, bloodlust makes it capture only, even friendly pieces.</dd></dl><p>A bishop must already be adjacent, including diagonally, and spend a turn using Absolve. An absolved piece never rolls again. Kings cannot be captured.</p>'
const defaults={volume:35,yells:true,diceSound:true,blood:'low',shake:false,flash:false,motion:matchMedia('(prefers-reduced-motion: reduce)').matches,crt:false,coords:true,hints:true,autoFlip:false,confirm:true,speed:'normal',theme:'parchment',diceMotion:true,drag:true,last:true,pieces:'classic',uiSound:true,ads:false,moodMotion:true}
let prefs={...defaults};try{prefs={...prefs,...JSON.parse(localStorage.getItem('remorse-settings')??'{}')}}catch{}
type Snapshot={room:{white?:string;black?:string;open:boolean;rated:boolean;ratings?:Partial<Record<Side,Rating>>};seat:Side|null;match:Match;now:number}
type Session={name:string;account:boolean;signIn:boolean;passkeys:boolean}
let session:Session|null=null
let mode='home', m:Match|null=null, selected:number|null=null, absolve=false, flipped=false, tab='Moves', status=''
let id='', info:Snapshot['room']|null=null, seat:Side|null=null, offset=0, socket:WebSocket|null=null, busy=false
let difficulty:Difficulty='tactical'
let human:Side='white'
let botAgent:Worker|null=null
let lessonTimer=0
let choice=3, queue:({rated:boolean}&Control)|null=null, queueTimer=0, generation=0, rated=false
let names={white:'White',black:'Black'}
let past:Match[]=[], future:Match[]=[], review:number|null=null, seed=initial(), lesson=0, promotion:Action[]=[]
let audio:AudioContext|undefined, soundVersion=-1, drag:number|null=null, focus=4
const bannerHost=document.createElement('div')
bannerHost.className='sponsor-slot'
document.body.appendChild(bannerHost)
function renderSponsor(){
  const width=document.documentElement.clientWidth
  const format=width>=765?'desktop':width>=346?'mobile':'hidden'
  const state=mode!=='home'?'hidden':prefs.ads?format:'opt-in'
  if(bannerHost.dataset.state===state)return
  bannerHost.dataset.state=state
  if(state==='hidden'){bannerHost.replaceChildren();return}
  if(state==='opt-in'){
    bannerHost.innerHTML='<aside class="advert"><span>SPONSOR</span>'+button('show-ads','Show sponsor banner','link')+'</aside>'
    bannerHost.querySelector('button')?.addEventListener('click',()=>{prefs.ads=true;savePrefs();renderSponsor()})
    return
  }
  bannerHost.innerHTML='<aside class="advert banner '+state+'"><span>ADVERTISEMENT</span><iframe title="Sponsor banner" loading="lazy" sandbox="allow-scripts allow-popups" referrerpolicy="strict-origin-when-cross-origin" src="/banner/'+state+'"></iframe></aside>'
}
window.addEventListener('resize',renderSponsor)
async function api<T>(path:string,data?:unknown):Promise<T>{
  const r=await fetch('/api/'+path,data===undefined?{}:{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)})
  if(r.status===204)return undefined as T
  const x=await r.json().catch(()=>({error:'Server unavailable'}))
  if(!r.ok)throw Error((x as {error?:string}).error??'Request failed')
  return x as T
}
let sessionPromise:Promise<Session>|null=null
async function login(){
  if(session)return session
  sessionPromise??=api<Session>('session').finally(()=>{sessionPromise=null})
  const value=await sessionPromise
  session=value
  if(value.account){
    const remote=await api<Partial<typeof defaults>>('settings').catch(()=>null)
    if(remote){
      for(const key of Object.keys(defaults) as (keyof typeof defaults)[]){
        if(key!=='ads'&&typeof remote[key]===typeof defaults[key])prefs={...prefs,[key]:remote[key]}
      }
      try{localStorage.setItem('remorse-settings',JSON.stringify(prefs))}catch{}
    }
  }
  return value
}
const button=(action:string,text:string,cls='')=>'<button class="'+cls+'" data-do="'+action+'">'+text+'</button>'
const today=()=>Date.now()+(mode==='online'?offset:0)
const clockLabel=(c:Control)=>c.seconds?(c.seconds%60===0?c.seconds/60:Math.floor(c.seconds/60)+':'+String(c.seconds%60).padStart(2,'0'))+'+'+c.increment:'∞'
function clocks(indices:number[]){
  return indices.map(i=>'<button data-control="'+i+'" aria-pressed="'+(choice===i)+'"><b>'+clockLabel(presets[i])+'</b><small>'+(presets[i].seconds?pool(presets[i].seconds,presets[i].increment):'Untimed')+'</small></button>').join('')
}
function home(){
  return '<main class="home"><section class="hero"><span class="eyebrow">A CHESS VARIANT</span><h1>REMORSE<br><em>CHESS</em></h1><p class="sub">Every capture has consequences.</p><p>Roll a die on each piece’s first capture. Your knight might freeze with guilt. Your queen might start eating her own team.</p>'+button('tutorial','▶ Try the tutorial','link')+'</section><section class="panel launch"><h2>♜ PLAY</h2><div class="pad"><h3>Time control</h3><div class="clocks">'+clocks([0,2,3,4,5,7,8,9])+'</div>'+button('more','More clocks & custom','link')+(session?.account?'<label class="rated"><input id="rated" type="checkbox" '+(rated?'checked':'')+'> Rated game</label>':session?.passkeys?button('sign-in','Sign in for ranked play','link ranked-link'):'')+button(queue?'cancel':'queue',queue?'Cancel search':'Find online match','primary full')+'<div class="alt">'+button('friend','Play a friend')+button('local','Same computer')+button('bot','Practice vs bot')+button('watch','Watch games')+'</div><p role="status" id="status">'+safe(status)+'</p></div></section><section class="outcomes">'+[['⚀','DEVASTATED','Frozen until absolved'],['⚁ ⚂','GUILT-RIDDEN','Can’t capture'],['⚃ ⚄','UNAFFECTED','Business as usual'],['⚅','PSYCHOPATH','Capture. Move again.']].map(([d,h,p])=>'<article><span>'+d+'</span><div><b>'+h+'</b><small>'+p+'</small></div></article>').join('')+'</section></main>'
}
let reviewCache:{source:Match;index:number;view:Match}|null=null
function view(){
  if(review===null)return m!
  if(reviewCache?.source===m && reviewCache.index===review)return reviewCache.view
  let game=seed
  for(const entry of m!.log.slice(0,review)){
    if(entry.action)game=play(game,entry.action,()=>entry.event?.roll??4)?.game??game
    if(entry.result)game={...game,result:entry.result}
  }
  const entry=m!.log[review-1]
  const snapshot={...m!,game,start:0,clock:entry?.clock??makeMatch(m!.control).clock,log:m!.log.slice(0,review)}
  reviewCache={source:m!,index:review,view:snapshot}
  return snapshot
}
const canAct=()=>Boolean(m?.start&&!m.game.result&&!busy&&review===null&&(mode!=='tutorial'||m.game.side==='white'||lesson===3)&&(mode==='online'?seat===m.game.side:mode!=='bot'||m.game.side===human))
function player(side:Side,v:Match){
  const who=mode==='online'?info?.[side]??'Open seat':mode==='bot'&&side!==human?difficulties[difficulty].name+' Bot':names[side]
  const rating=mode==='online'?info?.ratings?.[side]:undefined
  const displayRating=rating?' · '+Math.round(rating.rating)+(deviation(rating,Date.now())>110?'?':''):''
  return '<div class="player '+(side===v.game.side&&!v.game.result?'turn':'')+'"><span class="icon '+side+'">♚</span><div><b>'+safe(who)+displayRating+'</b><small>'+cap(side)+(seat===side?' · You':'')+'</small></div><time id="clock-'+side+'">—</time></div>'
}
function game(){
  if(!m)return '<main class="panel waiting"><p id="status" role="status">'+safe(status||'Opening room…')+'</p>'+button('home','Back to lobby')+'</main>'
  const v=view(),g=v.game,upper=flipped?'white':'black'
  const events=v.log.flatMap(e=>e.event?[e.event]:[]), last=events.at(-1), rolled=events.filter(e=>e.roll).at(-1)
  const latestCapture=events.findLast(event=>Boolean(event.capture))
  const resultMood=latestCapture?.captureState?.mood??latestCapture?.mood
  const face=latestCapture?.captureState?.originalRoll??latestCapture?.roll??rolled?.roll??5
  const reused=Boolean(latestCapture&&!latestCapture.roll)
  const moodLine=latestCapture?(resultMood?moodNames[resultMood]:'Capture recorded'):'One roll per piece'
  const tray='<div class="die-row"><span id="die" aria-hidden="true">'+dice[face-1]+'</span><div><b id="dice-label">'+(latestCapture?(reused?'Original roll '+face+' · No reroll':'Rolled '+face):'Awaiting a capture')+'</b><small id="mood-line">'+moodLine+'</small></div></div>'
  const p=selected===null?undefined:at(g,selected)
  const actions=p?legal(g,p.square):[]
  const board=(flipped?grid.slice().reverse():grid).map((sq,i)=>{
    const man=at(g,sq),target=prefs.hints&&actions.some(a=>a.type===(absolve?'absolve':'move')&&a.to===sq)
    const previous=prefs.last&&last?.action.type!=='end'&&[last?.action.from,last?.action.to].includes(sq)
    const classes=[(file(sq)+rank(sq))%2?'light':'dark',selected===sq?'selected':'',target?(man?'target take':'target'):'',previous?'last':'',man?.kind==='k'&&inCheck(g,man.side)?'check':''].join(' ')
    return '<button tabindex="'+(sq===focus?0:-1)+'" aria-label="'+name(sq)+' '+(man?man.side+' '+labels[man.kind]+(man.roll?', '+moodNames[man.mood]:''):'empty')+'" class="sq '+classes+'" data-square="'+sq+'">'+(prefs.coords&&i%8===0?'<span class="rank">'+(rank(sq)+1)+'</span>':'')+(prefs.coords&&i>=56?'<span class="file">'+'abcdefgh'[file(sq)]+'</span>':'')+(man?'<span draggable="'+prefs.drag+'" class="piece '+man.side+' '+man.mood+'">'+art(man.kind,man.side)+(man.roll?'<b class="badge '+man.mood+'">'+(man.rescue||{normal:'·',devastated:'!',guilty:'×',psychopath:'+',bloodlust:'▲'}[man.mood])+'</b>':'')+'</span>':'')+'</button>'
  }).join('')
  const headline=g.result?(g.result.winner?cap(g.result.winner)+' wins':'Draw')+' · '+g.result.reason:!v.start&&review===null?'Waiting for an opponent':g.bonus!==null?cap(g.side)+' · Bonus move':cap(g.side)+' to move'
  const history=v.log.map(e=>{
    const x=e.event
    if(!x)return e.result?'<li>'+safe(e.result.reason)+'</li>':''
    const annotations=[x.roll?'🎲 '+x.roll+' · '+moodNames[x.mood!]:x.mood==='bloodlust'?'Bloodlust activated':'',x.capture?.side===x.side?'Friendly capture':'',...x.vanished.map(p=>name(p.square)+' lost to remorse')].filter(Boolean)
    return tab==='Events'&&!annotations.length&&x.action.type!=='absolve'?'':'<li><span>'+x.turn+' '+(x.side==='white'?'○':'●')+'</span><div><b>'+safe(x.text)+'</b>'+annotations.map(a=>'<small>'+safe(a)+'</small>').join('')+'</div></li>'
  }).join('')
  return '<main class="game"><section><div class="crumb">'+button('home','← Lobby')+'<b>'+safe(mode==='online'?(info?.rated?'RATED ONLINE':'CASUAL ONLINE'):mode==='local'?'SAME COMPUTER':mode==='bot'?difficulties[difficulty].name.toUpperCase()+' BOT':'TRAINING')+'</b>'+button('flip','⇅ Flip')+'</div>'+player(upper,v)+'<div class="board '+prefs.theme+'" role="group" aria-label="Chessboard">'+board+'<div id="particles"></div></div>'+player(opposite(upper),v)+'<div class="action-bar"><strong aria-live="polite">'+safe(headline)+'</strong>'+(review===null&&!g.result&&g.bonus!==null&&(mode==='online'?seat===g.side:mode!=='bot'||g.side===human)?button('end','End turn','primary'):'')+(actions.some(a=>a.type==='absolve')?button('absolve',absolve?'Cancel absolution':'✧ Absolve',absolve?'primary':''):'')+'</div>'+(mode==='online'&&info?.open?button(seat?'share':'join',seat?'Copy invite link':'Join game','primary'):'')+(m.offer&&!m.game.result&&(mode!=='online'||seat&&seat!==m.offer)?'<div>Draw offered '+button('accept','Accept')+button('decline','Decline')+'</div>':'')+'<p id="status" role="status">'+safe(status)+'</p></section><aside><section class="panel"><h2>◆ DICE TRAY</h2>'+tray+''+(p?'<div class="inspector"><b>'+cap(p.side)+' '+labels[p.kind]+' · '+name(p.square)+'</b><small>'+(p.roll?moodNames[p.mood]+' · Rolled '+p.roll:'Hasn’t rolled')+' · '+p.kills+' captures</small></div>':'')+g.pieces.filter(p=>p.rescue).map(p=>'<div class="rescue">'+cap(p.side)+' '+labels[p.kind]+' '+name(p.square)+' · '+(p.rescue===1?'Last chance':p.rescue+' turns left')+'</div>').join('')+'</section><section class="panel details"><div class="tabs">'+['Moves','Events','Rules'].map(t=>'<button data-tab="'+t+'" aria-pressed="'+(t===tab)+'">'+t+'</button>').join('')+'</div><div id="log">'+(tab==='Rules'?rules:history?'<ol>'+history+'</ol>':'<p>No entries yet.</p>')+'</div>'+(m.log.length?'<div class="review">'+button('first','⏮')+button('prev','◀')+'<span>'+(review??'Latest')+'</span>'+button('next','▶')+button('live','⏭')+'</div>':'')+'</section><div class="tools">'+(mode==='local'?button('undo','Undo')+button('redo','Redo')+button('names','Player names'):'')+(!g.result&&v.start&&(mode!=='online'||seat)?button('offer','Offer draw')+button('resign','Resign'):'')+(mode==='online'?button('share','Share'):button('restart','Restart'))+(g.result&&mode==='online'&&seat?button('rematch','Rematch'):'')+(session?.account&&mode==='online'&&seat&&!info?.open?button('conduct','Report or block'):'')+(m.log.length?button('export','Export'):'')+'</div></aside></main>'
}
function render(){
  const focused=document.activeElement instanceof HTMLElement&&document.activeElement.matches('[data-square]')
  const settingsOpen=$<HTMLDialogElement>('#modal')?.open&&$('#modal')?.dataset.kind==='settings'
  root.innerHTML='<header><a href="/" class="logo" data-do="home">☠ REMORSE<span>CHESS</span></a><nav>'+button('rules','Rules')+button('leaders','Ratings')+button('settings','⚙ Settings')+(session?.account?button('profile',safe(session.name)):session?.passkeys?button('sign-in','Sign in'):session?.signIn?'<a href="/api/auth/start">Sign in</a>':'')+'</nav></header>'+(mode==='home'?home():mode==='account'?'<main class="panel account" id="account">Loading…</main>':game())+'<footer>REMORSE CHESS '+button('about','About & privacy')+' <a href="https://github.com/LukasJT/remorsechess/issues">Feedback</a></footer><dialog id="modal"></dialog>'
  renderSponsor()
  document.body.classList.toggle('crt',prefs.crt)
  document.body.classList.toggle('reduced',prefs.motion||prefs.speed==='off')
  if(focused)$('[data-square="'+focus+'"]')?.focus({preventScroll:true})
  if(settingsOpen)settings()
  tick()
}
function tell(s:string){status=s;const el=$('#status');if(el)el.textContent=s}
function tick(){
  if(!m||['home','account'].includes(mode))return
  if(mode!=='online'&&review===null){const next=expire(m,Date.now());if(next!==m){m=next;render();return}}
  const v=view()
  for(const side of ['white','black'] as const){
    const node=$('#clock-'+side)
    if(!node)continue
    const s=Math.ceil(remaining(v,side,today())/1000)
    node.textContent=v.control.seconds?Math.floor(s/60)+':'+String(s%60).padStart(2,'0'):'∞'
    node.classList.toggle('low',Boolean(v.control.seconds&&s<15))
  }
}
setInterval(tick,250)
function modal(html:string,kind=''){
  const d=$<HTMLDialogElement>('#modal')!
  d.dataset.kind=kind
  d.innerHTML='<form method="dialog" class="close"><button aria-label="Close">×</button></form>'+html
  if(!d.open)d.showModal()
}
function settings(){
  const checks=Object.entries({yells:'Capture yells',diceSound:'Dice sounds',uiSound:'Move sounds',diceMotion:'Dice animation',moodMotion:'Piece mood animation',ads:'Sponsor banner',last:'Last move highlight',drag:'Drag pieces',shake:'Screen shake',flash:'Impact flash',motion:'Reduced motion',crt:'Scanlines',coords:'Coordinates',hints:'Move hints',autoFlip:'Auto-flip local board',confirm:'Confirm friendly captures'})
    .map(([key,label])=>'<label><input type="checkbox" data-pref="'+key+'" '+(prefs[key as keyof typeof prefs]?'checked':'')+'>'+label+'</label>').join('')
  const selects=Object.entries({blood:['off','low','full'],speed:['off','fast','normal'],theme:['parchment','slate'],pieces:['pixel','classic']}).map(([key,opts])=>'<label>'+key+' <select data-pref="'+key+'">'+opts.map(v=>'<option '+(v===prefs[key as keyof typeof prefs]?'selected':'')+'>'+v+'</option>').join('')+'</select></label>').join('')
  modal('<h2>Settings</h2><div class="settings"><label>Volume <input data-pref="volume" type="range" min="0" max="100" value="'+prefs.volume+'"></label>'+button('quiet','Quiet mode')+checks+selects+'</div>','settings')
}
let prefsTimer=0
function savePrefs(){
  try{localStorage.setItem('remorse-settings',JSON.stringify(prefs))}catch{}
  if(session?.account){
    clearTimeout(prefsTimer)
    prefsTimer=window.setTimeout(()=>void api('settings',prefs).catch(()=>{}),400)
  }
}
function clocksDialog(){
  modal('<h2>Time controls</h2><div class="clocks">'+clocks(presets.map((_,i)=>i))+'</div><form id="custom"><h3>Custom clock</h3><div class="settings"><label>Minutes<input type="number" name="minutes" value="5" min="0" max="360" required></label><label>Seconds<input type="number" name="seconds" value="0" min="0" max="59" required></label><label>Increment<input type="number" name="increment" value="2" min="0" max="180" required></label></div><button class="primary">Use custom clock</button></form>')
}
function closeRoom(){
  id=''
  botAgent?.terminate();botAgent=null;clearTimeout(lessonTimer)
  if(socket){socket.onclose=null;socket.close();socket=null}
}
function goHome(){
  closeRoom();void cancel();mode='home';m=null;status='';review=null
  history.replaceState({},'','/');render()
}
function local(kind:string,control=presets[choice]){
  closeRoom();void cancel();history.replaceState({},'','/')
  mode=kind;m=makeMatch(kind==='tutorial'?{seconds:0,increment:0}:control,Date.now())
  seat=null;selected=null;absolve=false;review=null;flipped=kind==='bot'&&human==='black';past=[];future=[];tab='Moves';status='';soundVersion=-1;focus=4
  if(kind==='tutorial'){
    const positions=[['white','k',4],['white','b',18],['white','n',10],['black','k',60],['black','p',27],['black','p',48]] as const
    const full=initial()
    m.game.pieces=positions.map(([side,kind,square],i)=>({...full.pieces[i],side,kind,square,moved:true}))
    m.game.seen={}
    lesson=0;status='Capture the pawn on d4 with the knight on c2.'
  }
  seed=m.game
  render()
  if(kind==='bot')bot()
}
let pulling=false
async function sync(){
  if(pulling||!id)return
  const room=id;pulling=true
  try{const data=await api<Snapshot>('room/'+room);if(id===room)apply(data)}
  catch(e){if(id===room)tell((e as Error).message)}
  finally{pulling=false}
}
function apply(data:Snapshot){
  if(m&&data.match.version<m.version)return
  const first=!m
  const previousLog=m?.log.length??0
  const changed=first||m?.version!==data.match.version||seat!==data.seat
  if(changed)m=data.match
  offset=data.now-Date.now();info=data.room;seat=data.seat
  if(first){flipped=seat==='black';soundVersion=data.match.version}
  if(changed){status='';render();if(!first&&review===null&&data.match.log.length>previousLog)effects(data.match);const node=$('#log');if(node&&review===null)node.scrollTop=node.scrollHeight}
}
function wire(room:string){
  if(id!==room)return
  socket=new WebSocket((location.protocol==='https:'?'wss:':'ws:')+'//'+location.host+'/api/room/'+room+'/ws')
  socket.onopen=()=>{if(id===room){tell('');void sync()}}
  socket.onmessage=()=>void sync()
  socket.onclose=()=>{if(id===room){tell('Reconnecting…');window.setTimeout(()=>wire(room),2600)}}
}
async function online(room:string){
  closeRoom();mode='online';id=room;m=null;selected=null;absolve=false;review=null;seed=initial();seat=null;info=null;tab='Moves';status='';focus=4
  history.replaceState({},'','/?game='+room)
  render();await login();if(id===room){await sync();wire(room)}
}
// The poll also covers updates committed while a fetch was in flight.
setInterval(()=>{if(id)void sync()},2400)
async function search(){
  await login()
  if(queue)return
  const c=presets[choice]
  if(!c.seconds){tell('Choose a timed control for matchmaking.');return}
  const ticket={...c,rated}
  const current=++generation
  queue=ticket;status='Looking for an opponent…';render()
  const poll=async()=>{
    try{
      const found=await api<{id?:string}>('queue',ticket)
      if(current!==generation)return
      if(found.id){queue=null;await online(found.id)}
      else queueTimer=window.setTimeout(poll,1500)
    }catch(e){if(current===generation){queue=null;status=(e as Error).message;render()}}
  }
  await poll()
}
async function cancel(){
  const ticket=queue
  queue=null;generation++;clearTimeout(queueTimer)
  if(ticket){await api('queue',{...ticket,cancel:true}).catch(()=>{});if(mode==='home'){status='';render()}}
}
function effects(match:Match){
  if(match.version<=soundVersion)return
  soundVersion=match.version
  const e=match.log.at(-1)?.event
  if(!e)return
  function tone(hz:number,down:number,duration:number,delay:number,wave:OscillatorType){
    if(!audio||audio.state!=='running'||!prefs.volume)return
    const time=audio.currentTime+delay, oscillator=audio.createOscillator(), gain=audio.createGain()
    oscillator.type=wave;oscillator.frequency.setValueAtTime(hz,time);oscillator.frequency.exponentialRampToValueAtTime(down,time+duration)
    gain.gain.setValueAtTime(.12*prefs.volume/100,time);gain.gain.exponentialRampToValueAtTime(.001,time+duration)
    oscillator.connect(gain).connect(audio.destination);oscillator.start(time);oscillator.stop(time+duration)
  }
  if(prefs.uiSound&&!e.capture)tone(200,85,.08,0,'triangle')
  if(e.capture&&prefs.yells){tone(520,95,.26,0,'sawtooth');tone(770,210,.22,0,'triangle')}
  if(e.capture&&prefs.diceSound)for(let i=0;i<3;i++)tone(300+i*90,100,.05,i*.055,'square')
  if(prefs.motion||prefs.speed==='off'||e.action.type==='end')return
  const duration=prefs.speed==='fast'?145:350
  const tile=$('[data-square="'+e.action.to+'"]')
  tile?.querySelector('.piece')?.animate([{transform:'translateY(-10%) scale(1.12)'},{transform:'none'}],{duration})
  if(e.capture){
    const state=e.captureState
    const landed=at(match.game,e.action.to)
    const mood=state?.mood??e.mood??landed?.mood??'normal'
    const reel=$('#die')
    const result=$('#mood-line')
    const spinDuration=prefs.speed==='fast'?245:590
    const face=state?.originalRoll??e.roll??landed?.roll
    if(reel&&prefs.diceMotion){
      const final=reel.textContent??(face?dice[face-1]:'—')
      const strip=document.createElement('span')
      strip.className='dice-strip'
      for(const glyph of [2,4,1,5,3,0].map(index=>dice[index])){
        const frame=document.createElement('span');frame.textContent=glyph;strip.appendChild(frame)
      }
      reel.replaceChildren(strip)
      reel.classList.add('rolling')
      $('#dice-label')?.classList.add('awaiting')
      if(result)result.classList.add('awaiting')
      const frames=strip.animate([{transform:'translateY(0)'},{transform:'translateY(-83.33%)'}],{duration:spinDuration,easing:'steps(5,end)'})
      reel.animate([{transform:'rotate(-25deg) scale(.8)'},{transform:'rotate(20deg) scale(1.08)'},{transform:'rotate(-12deg)'},{transform:'none'}],{duration:spinDuration})
      void frames.finished.then(()=>{
        if(!reel.isConnected)return
        reel.textContent=final
        reel.classList.remove('rolling')
        $('#dice-label')?.classList.remove('awaiting')
        result?.classList.remove('awaiting')
      },()=>{})
    }
    if(tile&&prefs.moodMotion){
      const flare=document.createElement('span')
      flare.className='mood-flare '+mood
      flare.textContent={normal:'Unaffected',devastated:'Devastated',guilty:'Guilt-ridden',psychopath:'Psychopath',bloodlust:'Bloodlust'}[mood]
      flare.setAttribute('aria-hidden','true')
      tile.appendChild(flare)
      const delay=prefs.diceMotion?spinDuration:0
      const squiggle={
        devastated:[{transform:'translateY(-8%)'},{transform:'translateY(12%) scale(.96,.72)'},{transform:'none'}],
        guilty:[{transform:'rotate(-9deg)'},{transform:'rotate(9deg)'},{transform:'none'}],
        normal:[{transform:'scale(.95)'},{transform:'scale(1.12)'},{transform:'none'}],
        psychopath:[{transform:'rotate(-8deg) scale(1.12)'},{transform:'rotate(7deg) scale(1.22)'},{transform:'none'}],
        bloodlust:[{transform:'scale(.92)'},{transform:'scale(1.26)'},{transform:'none'}],
      }
      tile.querySelector('.piece')?.animate(squiggle[mood],{delay,duration:540})
      const reveal=flare.animate([{opacity:0,transform:'translate(-50%, 9px)'},{opacity:1,transform:'translate(-50%, -3px)',offset:.2},{opacity:1,transform:'translate(-50%, -8px)',offset:.73},{opacity:0,transform:'translate(-50%, -15px)'}],{delay,duration:1300,fill:'both'})
      void reveal.finished.then(()=>flare.remove(),()=>flare.remove())
    }
  }
  if(e.action.type==='absolve')tile?.animate([{filter:'brightness(1.7)'},{filter:'none'}],{duration})
  if(!e.capture)return
  if(prefs.shake) $('.board')?.animate([{transform:'translateX(-3px)'},{transform:'translateX(3px)'},{transform:'none'}],{duration})
  if(prefs.flash)tile?.animate([{filter:'brightness(1.4)'},{filter:'none'}],{duration:160})
  const layer=$('#particles'), rect=tile?.getBoundingClientRect(), origin=layer?.getBoundingClientRect()
  if(!layer||!rect||!origin||prefs.blood==='off')return
  for(let i=0;i<(prefs.blood==='full'?20:8);i++){
    const pixel=document.createElement('i')
    pixel.style.left=(rect.x-origin.x+rect.width/2)+'px';pixel.style.top=(rect.y-origin.y+rect.height/2)+'px'
    layer.appendChild(pixel)
    void pixel.animate([{opacity:1},{transform:'translate('+((Math.random()-.5)*104)+'px,'+((Math.random()-.4)*100)+'px)',opacity:0}],{duration:duration+160}).finished.then(()=>pixel.remove(),()=>pixel.remove())
  }
}
function offlineStep(side:Side,action:Command,roll?:()=>number){
  if(!m)return false
  const next=command(m,side,action,Date.now(),roll)
  if(!next){tell('That action is unavailable.');return false}
  past.push(m);future=[];m=next
  if(mode==='local'&&prefs.autoFlip)flipped=m.game.side==='black'
  status='';render();effects(next);return true
}
function bot(){
  if(mode!=='bot'||!m||m.game.side===human||m.game.result)return
  const current=m
  botAgent?.terminate()
  const worker=new Worker(new URL('./bot-worker.ts',import.meta.url),{type:'module'})
  botAgent=worker
  const commit=(action:Action|undefined)=>{
    worker.terminate()
    if(botAgent===worker)botAgent=null
    if(mode!=='bot'||m!==current||!action)return
    window.setTimeout(()=>{
      if(mode!=='bot'||m!==current||!action)return
      offlineStep(current.game.side,action)
      bot()
    },230)
  }
  worker.onmessage=(event:MessageEvent<Action|undefined>)=>commit(event.data)
  worker.onerror=()=>commit(legal(current.game)[0])
  worker.postMessage({game:current.game,difficulty})
}
function botSetup(){
  modal('<h2>Practice against a bot</h2><form id="bot-form"><fieldset><legend>Difficulty</legend>'+
    Object.entries(difficulties).map(([key,value])=>'<label class="bot-choice"><input type="radio" name="difficulty" value="'+key+'" '+(key===difficulty?'checked':'')+'><span><b>'+value.name+'</b><small>'+value.description+'</small></span></label>').join('')+
    '</fieldset><label>Play as <select name="color"><option value="white">White</option><option value="black">Black</option><option value="random">Random</option></select></label> <button class="primary">Start game</button></form>')
}
function signIn(){
  modal('<h2>Ranked account</h2><p>Use a passkey from your device or password manager. Keep it synced so you can sign in again.</p>'+
    '<form id="passkey-register"><label>Player name <input name="handle" autocomplete="nickname" required minlength="3" maxlength="20" pattern="[A-Za-z0-9_\\-]{3,20}"></label> <button class="primary">Create account</button></form>'+
    button('passkey-login','Sign in with a passkey')+'<p class="auth-status" role="status" id="auth-status"></p>')
}
async function passkey(action:'register'|'login',name?:string){
  const statusNode=$('#auth-status')
  if(!statusNode||statusNode.dataset.busy)return
  statusNode.dataset.busy='true'
  statusNode.textContent='Waiting for your passkey…'
  try{
    const {startRegistration,startAuthentication}=await import('@simplewebauthn/browser')
    const response=action==='register'
      ?await startRegistration({optionsJSON:await api<PublicKeyCredentialCreationOptionsJSON>('auth/passkey/start',{action,name})})
      :await startAuthentication({optionsJSON:await api<PublicKeyCredentialRequestOptionsJSON>('auth/passkey/start',{action})})
    await api('auth/passkey/finish',{action,response})
    session=null
    await login()
    $<HTMLDialogElement>('#modal')?.close()
    if(mode==='home'){rated=true;status='Ranked play is unlocked.'}
    render()
  }catch(e){statusNode.textContent=e instanceof Error?e.message:'Passkey sign-in failed.'}
  finally{delete statusNode.dataset.busy}
}
async function send(action:Command){
  if(!m||review!==null||busy)return
  selected=null;absolve=false
  if(mode==='online'){
    const room=id;busy=true
    try{
      const data=await api<Snapshot>('room/'+room+'/command',{action,version:m.version,id:crypto.randomUUID()})
      busy=false
      if(id===room)apply(data)
    }
    catch(e){if(id===room){tell((e as Error).message);void sync()}}
    finally{busy=false}
    return
  }
  if(mode==='tutorial'&&lesson<3){
    if(lesson===0&&(action.type!=='move'||action.from!==10||action.to!==27)){tell('Capture the pawn on d4 with the knight on c2.');return}
    if(lesson===1&&(action.type!=='absolve'||action.from!==18||action.to!==27)){tell('Select the bishop on c3, choose Absolve, then select d4.');return}
  }
  const side=action.type==='accept'||action.type==='decline'?opposite(m.offer??m.game.side):m.game.side
  if(!offlineStep(side,action,mode==='tutorial'?()=>1:undefined))return
  if(mode==='bot')bot()
  if(mode==='tutorial'){
    if(lesson===0){
      lesson=1
      tell('Your knight rolled 1 and is devastated.')
      lessonTimer=window.setTimeout(()=>{
        if(mode!=='tutorial'||lesson!==1)return
        offlineStep('black',{type:'move',from:48,to:40})
        tell('Select the bishop on c3, choose Absolve, then select d4.')
      },prefs.motion||prefs.speed==='off'?250:2000)
    }
    else if(lesson===1){lesson=3;modal('<h2>Absolution complete</h2><p>The knight can move and capture again. Its first roll still counts, so it will never roll again.</p>'+button('local','Play a full game','primary'))}
  }
}
function confirmAction(action:Action){
  const p=action.type==='move'&&m&&at(m.game,action.to)
  if(p&&p.side===m?.game.side&&prefs.confirm){
    modal('<h2>Capture your own '+labels[p.kind].toLowerCase()+'?</h2><p>This is a bloodlust capture.</p><button class="primary" id="confirm">Capture</button>')
    $('#confirm')!.onclick=()=>{$<HTMLDialogElement>('#modal')?.close();void send(action)}
  }else void send(action)
}
function square(sq:number){
  if(!m||!canAct())return
  const options=selected===null?[]:legal(m.game,selected).filter(a=>a.type!=='end'&&a.type===(absolve?'absolve':'move')&&a.to===sq)
  if(options.length>1){
    promotion=options
    modal('<h2>Promote pawn</h2><div class="tools">'+options.map((a,i)=>'<button data-promotion="'+i+'">'+labels[(a as {promotion:Kind}).promotion]+'</button>').join('')+'</div>')
  }else if(options.length)confirmAction(options[0])
  else{
    const p=at(m.game,sq)
    if(selected!==null&&p?.side!==m.game.side&&!options.length){tell('That destination is unavailable.');return}
    selected=p&&selected!==sq?sq:null;absolve=false;render()
  }
}
async function account(which:string){
  closeRoom();void cancel();await login();mode='account';render()
  if(which==='watch'){
    const games=await api<{id:string;white:string;black:string;control:Control;rated:boolean}[]>('watch')
    const node=$('#account')
    if(node)node.innerHTML='<h1>Watch live games</h1>'+(games.length?'<ul>'+games.map(g=>'<li><a href="/?game='+safe(g.id)+'">'+safe(g.white)+' vs '+safe(g.black)+'</a> · '+clockLabel(g.control)+(g.rated?' · Rated':'')+'</li>').join('')+'</ul>':'<p>No public games are in progress.</p>')
  }else if(which==='leaders'){
    const records=await api<Record<string,{name:string;rating:number}[]>>('leaders')
    const node=$('#account');if(node)node.innerHTML='<h1>Leaderboard</h1>'+Object.entries(records).map(([group,rows])=>'<h2>'+safe(group)+'</h2>'+(rows.length?'<ol>'+rows.map(p=>'<li>'+safe(p.name)+' · '+p.rating+'</li>').join('')+'</ol>':'<p>No established ratings yet.</p>')).join('')
  }else{
    const p=await api<{user:{name:string};ratings:Record<string,Rating>;history:{id:string;pool:string;result:string;delta?:number}[]}>('profile')
    const node=$('#account');if(node)node.innerHTML='<h1>'+safe(p.user.name)+'</h1>'+['Bullet','Blitz','Rapid'].map(key=>'<p>'+key+' <b>'+Math.round(p.ratings[key]?.rating??1500)+(p.ratings[key]&&deviation(p.ratings[key],Date.now())<=110?'':'?')+'</b></p>').join('')+'<h2>Game history</h2>'+(p.history.length?'<ul>'+p.history.map(g=>'<li><a href="/?game='+safe(g.id)+'">'+safe(g.pool)+' · '+safe(g.result)+(g.delta===undefined?'':' · '+(g.delta>=0?'+':'')+g.delta)+'</a></li>').join('')+'</ul>':'<p>No completed games yet.</p>')+button('logout','Sign out')
  }
}
async function handle(action:string){
  switch(action){
    case 'home':goHome();return
    case 'rules':modal('<h2>How to play</h2>'+rules+button('tutorial','Try the tutorial','primary'));return
    case 'about':modal('<h2>About & privacy</h2><p>Remorse Chess uses cookies to keep your online seat. Game links can be viewed by anyone with the link. Ranked accounts store your player name, passkey public key, rating and game history. When enabled, the sponsor banner is provided by Adsterra and connects to its ad network.</p><p>The board uses chess symbols and original pixel sprites. Game sounds are synthesized.</p><a href="https://github.com/LukasJT/remorsechess">Source & feedback</a>');return
    case 'settings':settings();return
    case 'quiet':prefs={...prefs,volume:0,blood:'off',shake:false,flash:false,motion:true};savePrefs();render();return
    case 'more':clocksDialog();return
    case 'watch':case 'leaders':case 'profile':await account(action);return
    case 'logout':await api('auth/logout',{});location.assign('/');return
    case 'local':case 'tutorial':local(action);return
    case 'bot':botSetup();return
    case 'sign-in':signIn();return
    case 'passkey-login':await passkey('login');return
    case 'restart':local(mode,m?.control);return
    case 'queue':await search();return
    case 'cancel':await cancel();return
    case 'friend':{
      await login();const result=await api<{id:string}>('rooms',mode==='online'&&m?m.control:presets[choice]);await online(result.id);return
    }
    case 'conduct':
      modal('<h2>Report or block your opponent</h2><form id="report"><label>Reason <select name="reason"><option value="cheating">Suspected cheating</option><option value="harassment">Harassment</option><option value="stalling">Stalling</option><option value="other">Other</option></select></label> <button class="primary">Send report</button></form><p></p>'+button('block','Block in matchmaking'))
      return
    case 'block':
      await api('room/'+id+'/block',{})
      $<HTMLDialogElement>('#modal')?.close()
      tell('This account will no longer appear in your matchmaking.')
      return
    case 'rematch':{
      const result=await api<{id:string}>('room/'+id+'/rematch',{})
      await online(result.id)
      tell('Copy the game link and send it to your opponent.')
      return
    }
    case 'names':modal('<h2>Local player names</h2><form id="names"><div class="settings"><label>White <input name="white" maxlength="30" value="'+safe(names.white)+'"></label><label>Black <input name="black" maxlength="30" value="'+safe(names.black)+'"></label></div><button class="primary">Save names</button></form>');return
    case 'join':{const room=id;const data=await api<Snapshot>('room/'+room+'/join',{});if(id===room){flipped=data.seat==='black';apply(data)}return}
    case 'share':{
      const link=location.origin+'/?game='+id
      if(navigator.clipboard){await navigator.clipboard.writeText(link);tell('Game link copied.')}
      else modal('<h2>Share game</h2><input aria-label="Game link" readonly value="'+safe(link)+'">')
      return
    }
    case 'flip':flipped=!flipped;break
    case 'absolve':absolve=!absolve;status=absolve?'Choose a neighboring piece to absolve.':'';break
    case 'resign':modal('<h2>Resign this game?</h2><button class="primary" id="confirm">Resign</button>');$('#confirm')!.onclick=()=>{$<HTMLDialogElement>('#modal')?.close();void send({type:'resign'})};return
    case 'end':case 'offer':case 'accept':case 'decline':await send({type:action});return
    case 'undo':if(m&&past.length){future.push(m);m={...past.pop()!,start:Date.now()};review=null;selected=null}break
    case 'redo':if(m&&future.length){past.push(m);const next=future.pop()!;m={...next,start:next.game.result?0:Date.now()};review=null;selected=null}break
    case 'first':review=0;selected=null;break
    case 'prev':review=Math.max(0,(review??m!.log.length)-1);selected=null;break
    case 'next':review=Math.min(m!.log.length,(review??m!.log.length)+1);selected=null;break
    case 'live':review=null;selected=null;break
    case 'export':{
      const data=JSON.stringify({format:'remorse-chess-v1',initial:seed,control:m?.control,events:m?.log},null,2)
      const href=URL.createObjectURL(new Blob([data],{type:'application/json'})), a=document.createElement('a')
      a.href=href;a.download='remorse-'+(id||Date.now())+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(href),1000);return
    }
  }
  render()
}
function unlockAudio(){
  if(prefs.volume&&typeof AudioContext!=='undefined'){audio??=new AudioContext();void audio.resume().catch(()=>{})}
}
root.addEventListener('click',event=>{
  const el=(event.target as HTMLElement).closest<HTMLElement>('[data-do],[data-square],[data-control],[data-tab],[data-promotion]')
  if(!el)return
  unlockAudio()
  if(el.dataset.do){event.preventDefault();void handle(el.dataset.do).catch(e=>{tell(e.message);if(!$('#status'))modal('<h2>Something went wrong</h2><p>'+safe(e.message)+'</p>')})}
  else if(el.dataset.square!==undefined){focus=Number(el.dataset.square);square(focus)}
  else if(el.dataset.control!==undefined){choice=Number(el.dataset.control);render()}
  else if(el.dataset.tab){tab=el.dataset.tab;render()}
  else if(el.dataset.promotion!==undefined){$<HTMLDialogElement>('#modal')?.close();confirmAction(promotion[Number(el.dataset.promotion)])}
})
root.addEventListener('change',event=>{
  const el=event.target as HTMLInputElement|HTMLSelectElement
  if(el.id==='rated'){rated=(el as HTMLInputElement).checked;return}
  const key=el.dataset.pref
  if(!key)return
  prefs={...prefs,[key]:el instanceof HTMLInputElement&&el.type==='checkbox'?el.checked:key==='volume'?Number(el.value):el.value};savePrefs();render()
})
root.addEventListener('submit',event=>{
  const form=event.target as HTMLFormElement
  if(form.id==='passkey-register'){
    event.preventDefault()
    void passkey('register',String(new FormData(form).get('handle')??''))
    return
  }
  if(form.id==='bot-form'){
    event.preventDefault()
    const data=new FormData(form)
    const value=data.get('difficulty')
    if(typeof value!=='string'||!(value in difficulties))return
    difficulty=value as Difficulty
    const color=data.get('color')
    human=color==='random'?(Math.random()<.5?'white':'black'):color==='black'?'black':'white'
    local('bot')
    return
  }
  if(form.id==='report'){
    event.preventDefault()
    const reason=new FormData(form).get('reason')
    void api('room/'+id+'/report',{reason}).then(()=>{$<HTMLDialogElement>('#modal')?.close();tell('Report submitted.')}).catch(e=>modal('<h2>Report unavailable</h2><p>'+safe(e.message)+'</p>'))
    return
  }
  if(form.id==='names'){
    event.preventDefault()
    const input=new FormData(form)
    names={white:String(input.get('white')).trim()||'White',black:String(input.get('black')).trim()||'Black'}
    render()
    return
  }
  if(form.id!=='custom')return
  event.preventDefault()
  const data=new FormData(form),seconds=Number(data.get('minutes'))*60+Number(data.get('seconds')),increment=Number(data.get('increment'))
  if(seconds>21600||(!seconds&&increment)){form.reportValidity();return}
  presets.push({seconds,increment});choice=presets.length-1;status='Custom clock selected · '+clockLabel(presets[choice]);render()
})
root.addEventListener('keydown',event=>{
  const el=event.target as HTMLElement
  if(el.dataset.square===undefined)return
  const order=flipped?grid.slice().reverse():grid, i=order.indexOf(Number(el.dataset.square))
  const delta=({ArrowUp:-8,ArrowDown:8,ArrowLeft:-1,ArrowRight:1} as Record<string,number>)[event.key]
  if(!delta)return
  event.preventDefault()
  if((delta===1&&i%8===7)||(delta===-1&&i%8===0)||order[i+delta]===undefined)return
  el.tabIndex=-1;focus=order[i+delta]
  const next=$('[data-square="'+focus+'"]')!;next.tabIndex=0;next.focus()
})
root.addEventListener('dragstart',event=>{
  const sq=(event.target as HTMLElement).closest<HTMLElement>('[data-square]')
  if(!prefs.drag||!canAct()||!sq||at(m!.game,Number(sq.dataset.square))?.side!==m!.game.side){event.preventDefault();return}
  draggedStart(Number(sq.dataset.square),event)
})
function draggedStart(square:number,event:DragEvent){drag=square;event.dataTransfer?.setData('text/plain',String(square))}
root.addEventListener('dragover',event=>{if(drag!==null)event.preventDefault()})
root.addEventListener('drop',event=>{
  const sq=(event.target as HTMLElement).closest<HTMLElement>('[data-square]')
  if(drag===null||!sq)return
  event.preventDefault();selected=drag;drag=null;absolve=false;square(Number(sq.dataset.square))
})
root.addEventListener('dragend',()=>{drag=null})
const route=()=>{
  const gameId=new URLSearchParams(location.search).get('game')
  if(gameId&&/^[a-f0-9]{32}$/.test(gameId))void online(gameId).catch(e=>tell(e.message))
  else goHome()
}
window.addEventListener('popstate',route)
route()
void login().then(()=>{if(mode==='home'&&!queue&&!$<HTMLDialogElement>('#modal')?.open)render()}).catch(()=>{})

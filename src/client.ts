import './style.css'
import {homeGuide} from './home-guide.ts'
import {at,file,rank,name,legal,initial,play,moodNames,inCheck,opposite,bonusIsRequired,CURRENT_RULES,type Action,type Side,type Kind,type Piece,type RulesVersion} from './rules.ts'
import {command,dailyDays,makeMatch,expire,remaining,presets,type Match,type Control,type Command,type DailyLobby} from './match.ts'
import {pool,deviation,type Rating} from './rating.ts'
import {difficulties,type Difficulty} from './bot-levels.ts'
import {avatarSize,maxAvatarBytes,validHandle,type FriendAction,type FriendList,type PlayerCard,type ProfileEdit} from './social.ts'
import {escapeHTML as safe,friendsGroups,friendsView,playerDialog,playerResults,profileEditor,profileView,type ProfilePage} from './social-view.ts'
import type {AdminUsers} from './admin.ts'
import type {PublicKeyCredentialCreationOptionsJSON,PublicKeyCredentialRequestOptionsJSON} from '@simplewebauthn/browser'
const root=document.querySelector<HTMLElement>('#app')!
const $=<T extends HTMLElement=HTMLElement>(s:string)=>document.querySelector<T>(s)
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
function classicPawn(side:Side){
  const key='classic-pawn-'+side
  if(!sprites.has(key)){
    const canvas=document.createElement('canvas')
    canvas.width=128;canvas.height=128
    const context=canvas.getContext('2d')!
    context.scale(2,2)
    const outline=new Path2D('M24 23 C14 13 21 4 32 4 C43 4 50 13 40 23 L43 25 Q46 29 42 33 L39 34 C39 41 44 47 51 50 Q55 52 55 56 L55 59 L9 59 L9 56 Q9 52 13 50 C20 47 25 41 25 34 L22 33 Q18 29 21 25 Z')
    const fill=context.createLinearGradient(22,8,40,60)
    fill.addColorStop(0,side==='white'?'#fff5d3':'#644d67')
    fill.addColorStop(1,side==='white'?'#e9bd81':'#332239')
    context.lineJoin='round'
    context.lineWidth=3
    context.strokeStyle='#251925'
    context.fillStyle=fill
    context.fill(outline)
    context.stroke(outline)
    context.lineWidth=1.55
    context.lineCap='round'
    context.strokeStyle=side==='white'?'#fff7df':'#9c7a99'
    context.stroke(new Path2D('M25 13 Q27 8 33 8 M23 29 H41 M14 54 H50'))
    sprites.set(key,canvas.toDataURL())
  }
  return '<img class="classic-pawn" draggable="false" alt="" src="'+sprites.get(key)+'">'
}
function art(kind:Kind,side:Side){
  if(prefs.pieces==='classic'){
    if(kind==='p')return classicPawn(side)
    return {n:'♞',b:'♝',r:'♜',q:'♛',k:'♚'}[kind]
  }
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
function rulesText(version:RulesVersion=CURRENT_RULES){
  const bonus=bonusIsRequired(version)
    ?'After capturing on the first move, the same piece must move again if it has a legal move. Otherwise, the turn ends automatically.'
    :'After capturing on the first move, move the same piece again or select End turn.'
  return (version===1?'<p>This match uses the original rules. Kings cannot be captured.</p>':'')+
    '<p>Every piece rolls once, on its first capture.</p><dl><dt>1 · Devastated</dt><dd>Frozen. A friendly bishop must absolve it within its owner’s next three turns.</dd><dt>2–3 · Guilt-ridden</dt><dd>Can move but cannot capture until absolved.</dd><dt>4–5 · Unaffected</dt><dd>Moves and captures normally.</dd><dt>6 · Psychopath</dt><dd>'+bonus+
    ' At three captures, bloodlust makes it capture only, even friendly pieces.</dd></dl><p>Select a friendly bishop in any of the eight squares around a guilt-ridden or devastated piece, including the corners. Tap a piece with a green circle and choose Absolve. Absolution uses one turn. An absolved piece never rolls again.'+
    (version===1?'':' A piece on its bonus move can capture the opposing king if it can legally reach it. That wins the game immediately. Otherwise, checkmate wins as usual.')+'</p>'
}
const defaults={volume:35,yells:true,diceSound:true,blood:'low',shake:false,flash:false,motion:matchMedia('(prefers-reduced-motion: reduce)').matches,crt:false,coords:true,hints:true,autoFlip:false,confirm:true,speed:'normal',theme:'parchment',diceMotion:true,drag:true,last:true,pieces:'classic',uiSound:true,ads:true,moodMotion:true}
let prefs={...defaults};try{prefs={...prefs,...JSON.parse(localStorage.getItem('remorse-settings')??'{}')}}catch{}
type Snapshot={room:{white?:string;black?:string;whiteAccount?:boolean;blackAccount?:boolean;open:boolean;rated:boolean;bot?:Side;control:Control;ratings?:Partial<Record<Side,Rating>>};seat:Side|null;match:Match;now:number}
type Session={name:string;account:boolean;signIn:boolean;passkeys:boolean;emailReady:boolean;emailLinked:boolean;admin:boolean}
type SearchTicket=Control&{rated:boolean;flexible:boolean;searchId:string}
let session:Session|null=null
let mode='home', m:Match|null=null, selected:number|null=null, absolve=false, flipped=false, tab='Moves', status=''
let accountTab='', myProfile:ProfilePage|null=null, friendsVersion=0, lastFriends=''
let id='', info:Snapshot['room']|null=null, seat:Side|null=null, offset=0, socket:WebSocket|null=null, busy=false
let difficulty:Difficulty='tactical'
let quickBot=false
const botLevel=():Difficulty=>quickBot?'rookie':difficulty
let human:Side='white'
let botAgent:Worker|null=null
let lessonTimer=0
let resultTimer=0
let choice=3, flexible=true, queue:SearchTicket|null=null, queueTimer=0, generation=0, rated=false
let playTab:'live'|'daily'='live'
let dailyChoice:number=3
let dailyLobby:DailyLobby|null=null, dailyBusy=false, dailyLoading=false, dailyMessage=''
let presence:WebSocket|null=null, presenceTimer=0
let names={white:'White',black:'Black'}
let past:Match[]=[], future:Match[]=[], review:number|null=null, seed=initial(), lesson=0, promotion:Action[]=[]
let audio:AudioContext|undefined, soundVersion=-1, drag:number|null=null, focus=4
const sponsorRails=document.createElement('div')
sponsorRails.className='sponsor-rails'
const sponsorBottom=document.createElement('div')
sponsorBottom.className='sponsor-bottom'
const sponsorOrigin='https://remorse-chess-banners.lukastadros06.workers.dev'
document.body.appendChild(sponsorRails)
document.body.appendChild(sponsorBottom)
function sponsorFrame(format:string,title:string){
  return '<aside class="sponsor"><span>Advertisement</span><iframe title="'+title+'" loading="lazy" sandbox="allow-scripts allow-popups allow-same-origin" referrerpolicy="origin" src="'+sponsorOrigin+'/banner/'+format+'"></iframe></aside>'
}
function renderSponsor(){
  if(location.hostname!=='remorsechess.com')return
  const width=document.documentElement.clientWidth
  const inMatch=Boolean(m&&(mode==='online'||mode==='local'||mode==='bot'))
  const rails=prefs.ads&&inMatch&&width>=1260&&!matchMedia('(max-height: 540px)').matches
  const bottom=prefs.ads&&(mode==='home'||inMatch)?width>=752?'desktop':width>=320?'mobile':'':''
  document.body.classList.toggle('match-sponsors',rails)
  if(rails!==sponsorRails.hasChildNodes()){
    sponsorRails.innerHTML=rails?sponsorFrame('match-left','Left banner ad')+sponsorFrame('match-right','Right banner ad'):''
  }
  if(sponsorBottom.dataset.format!==bottom){
    sponsorBottom.dataset.format=bottom
    sponsorBottom.innerHTML=bottom?sponsorFrame(bottom,'Bottom banner ad'):''
  }
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
  if(value!==session)connectPresence()
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
const button=(action:string,text:string,cls='',disabled=false)=>'<button class="'+cls+'" data-do="'+action+'"'+(disabled?' disabled':'')+'>'+text+'</button>'
const today=()=>Date.now()+(mode==='online'?offset:0)
const daysLabel=(days:number)=>days+(days===1?' day':' days')
const clockLabel=(c:Control)=>c.days?daysLabel(c.days)+' / turn':c.seconds?(c.seconds%60===0?c.seconds/60:Math.floor(c.seconds/60)+':'+String(c.seconds%60).padStart(2,'0'))+'+'+c.increment:'∞'
function clocks(indices:number[],showPool=true){
  return indices.map(i=>'<button data-control="'+i+'" aria-pressed="'+(!flexible&&choice===i)+'" '+(queue?'disabled':'')+'><b>'+clockLabel(presets[i])+'</b>'+
    (showPool?'<small>'+(presets[i].seconds?pool(presets[i].seconds,presets[i].increment):'Untimed')+'</small>':'')+'</button>').join('')
}
const liveGroups=[['Bullet',[12,0,1,2]],['Blitz',[3,4,5,6]],['Rapid',[7,8,9,10]]] as const
const activityClock=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',weekday:'short',hour:'numeric',minute:'numeric',hourCycle:'h23'})
const hourlyActivity=[62,49,47,42,39,44,54,68,93,115,134,155,180,202,217,241,266,292,318,337,344,311,235,134]
const activityNumber=new Intl.NumberFormat()
function activityLabel(now=new Date()){
  const parts=activityClock.formatToParts(now)
  const part=(type:string)=>parts.find(entry=>entry.type===type)?.value
  const hour=Number(part('hour')), minute=Number(part('minute'))
  const start=hourlyActivity[hour], next=hourlyActivity[(hour+1)%24]
  const base=start+(next-start)*minute/60
  const weekend=part('weekday')==='Sat'||part('weekday')==='Sun'
  const weekendBoost=weekend?2.35*Math.max(0,base-50):0
  const variation=Math.sin(Math.floor(now.getTime()/300000))*Math.min(12,base*0.06)
  return 'Online: '+activityNumber.format(Math.round(base+weekendBoost+variation))
}
function connectPresence(){
  clearTimeout(presenceTimer)
  presence?.close()
  const ws=new WebSocket((location.protocol==='https:'?'wss:':'ws:')+'//'+location.host+'/api/presence')
  presence=ws
  ws.onclose=()=>{
    if(presence!==ws)return
    presence=null
    presenceTimer=window.setTimeout(connectPresence,navigator.onLine?5000:15000)
  }
}
function livePanel(){
  return '<div class="queue-preference"><button data-do="quick-clock" aria-controls="clock-groups" aria-pressed="'+flexible+'" '+(queue?'disabled':'')+'>Any popular clock</button>'+
    (flexible&&!queue?'<small class="clock-toggle-hint">Tap again to choose a fixed clock.</small>':'')+'</div>'+
    '<div id="clock-groups" class="clock-groups'+(flexible?' flexible-clock':'')+'">'+liveGroups.map(([label,indices])=>'<section><h3>'+label+'</h3><div class="clocks">'+clocks([...indices],false)+'</div></section>').join('')+'</div>'+
    button('more','Custom clock & untimed','link')+
    (!flexible&&(choice===11||choice>=13)?'<small>Selected: '+(presets[choice].seconds?clockLabel(presets[choice]):'Untimed')+'</small>':'')+
    (session?.account?'<label class="rated"><input id="rated" type="checkbox" '+(rated?'checked':'')+' '+(queue?'disabled':'')+'> Ranked</label>':session?.passkeys?button('sign-in','Sign in for ranked play','link ranked-link'):'')+
    button(queue?'cancel':'queue',queue?'Cancel search':rated?'Find ranked match':flexible?'Quick match':'Find match','primary full')+
    '<div class="alt">'+button('friend','Play a friend')+button('local','Same computer')+button('bot','Practice vs bot')+button('watch','Watch games')+'</div><p role="status" id="status">'+safe(status)+'</p>'
}
function dailyList(){
  if(!session?.account)return ''
  const games=dailyLobby?.games??[]
  return (dailyLobby?.queued?'<div class="daily-queued"><span>Waiting for a match · '+daysLabel(dailyLobby.queued)+' / turn</span>'+button('daily-cancel','Cancel search','link')+'</div>':'')+
    '<h3>Your Daily games</h3>'+(games.length?'<ul class="daily-games">'+games.map(game=>'<li><a href="/?game='+game.id+'"><b>'+safe(game.opponent??'Friend invitation')+'</b><small>'+
      daysLabel(game.days)+' / turn · '+(game.waiting?'Waiting for a friend':game.turn?'Your turn':'Opponent’s turn')+'</small></a></li>').join('')+'</ul>':
      '<p>'+(dailyLobby?'No active Daily games.':dailyMessage?'':'Loading…')+'</p>')
}
function dailyPanel(){
  return '<h3>Days per turn</h3><div class="clocks daily-clocks">'+dailyDays.map(days=>'<button data-days="'+days+'" aria-pressed="'+(dailyChoice===days)+'" '+(dailyBusy?'disabled':'')+'><b>'+daysLabel(days)+'</b></button>').join('')+'</div>'+
    '<p class="daily-help">Your clock resets after each complete turn. A bonus move shares the same deadline.</p>'+
    (session?.account?'<div class="alt">'+button('daily-find','Find a random opponent','primary',dailyBusy)+button('daily-invite','Invite a friend','',dailyBusy)+'</div>':button('sign-in','Sign in to play Daily','primary full'))+
    '<p id="daily-status" role="status">'+safe(dailyMessage)+'</p><div id="daily-list">'+dailyList()+'</div>'
}
function home(){
  const hero='<section class="hero"><span class="eyebrow">A CHESS VARIANT</span><h1>REMORSE<br><em>CHESS</em></h1><p class="sub">Every capture has consequences.</p><p>Roll a die on each piece’s first capture. Your knight might freeze with guilt. Your queen might start eating her own team.</p>'+
    '<a class="link hero-rules" href="#how-to-play">How to play ↓</a>'+button('tutorial','▶ Try the tutorial','link')+'</section>'
  const play='<section class="panel launch"><h2>♜ PLAY <span id="online-count">'+activityLabel()+'</span></h2><div class="pad">'+
    '<div class="play-tabs" role="group" aria-label="Play mode"><button data-do="live-tab" aria-pressed="'+(playTab==='live')+'">Live</button><button data-do="daily-tab" aria-pressed="'+(playTab==='daily')+'">Daily</button></div>'+
    (playTab==='daily'?dailyPanel():livePanel())+'</div></section>'
  const outcomes=[['⚀','DEVASTATED','Frozen until absolved'],['⚁ ⚂','GUILT-RIDDEN','Can’t capture'],['⚃ ⚄','UNAFFECTED','Business as usual'],['⚅','PSYCHOPATH','Capture. Move again.']].map(([d,h,p])=>'<article><span>'+d+'</span><div><b>'+h+'</b><small>'+p+'</small></div></article>').join('')
  return '<main class="home">'+hero+play+'<section class="outcomes">'+outcomes+'</section>'+homeGuide+'</main>'
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
  const who=mode==='online'?(info?.bot===side?'Opponent':info?.[side]??'Open seat'):
    mode==='bot'&&side!==human?(quickBot?'Opponent':difficulties[botLevel()].name+' Bot'):names[side]
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
  const tray='<div class="die-row" data-roll><span id="die" data-die aria-hidden="true">'+dice[face-1]+'</span><div><b data-roll-label>'+(latestCapture?(reused?'Original roll '+face+' · No reroll':'Rolled '+face):'Awaiting a capture')+'</b><small data-mood-line>'+moodLine+'</small></div></div>'
  const compactRoll='<div class="mobile-roll" data-roll aria-hidden="true"><span data-die>'+dice[face-1]+'</span><span data-mood-line>'+(latestCapture?moodLine:'No captures')+'</span></div>'
  const p=selected===null?undefined:at(g,selected)
  const actions=p?legal(g,p.square):[]
  const mouseDrag=prefs.drag&&matchMedia('(any-pointer: fine)').matches
  const board=(flipped?grid.slice().reverse():grid).map((sq,i)=>{
    const man=at(g,sq),target=prefs.hints&&actions.some(a=>a.type===(absolve?'absolve':'move')&&a.to===sq)
    const healer=canAct()&&actions.some(a=>a.type==='absolve'&&a.to===sq)
    const previous=prefs.last&&last?.action.type!=='end'&&[last?.action.from,last?.action.to].includes(sq)
    const classes=[(file(sq)+rank(sq))%2?'light':'dark',selected===sq?'selected':'',target&&!healer?(man?'target take':'target'):'',healer?'heal-target':'',previous?'last':'',man?.kind==='k'&&inCheck(g,man.side)?'check':''].join(' ')
    return '<button tabindex="'+(sq===focus?0:-1)+'" aria-label="'+name(sq)+' '+(man?man.side+' '+labels[man.kind]+(man.roll?', '+moodNames[man.mood]:'')+(healer?', can heal':''):'empty')+'" class="sq '+classes+'" data-square="'+sq+'">'+(prefs.coords&&i%8===0?'<span class="rank">'+(rank(sq)+1)+'</span>':'')+(prefs.coords&&i>=56?'<span class="file">'+'abcdefgh'[file(sq)]+'</span>':'')+(man?'<span draggable="'+mouseDrag+'" class="piece '+man.side+' '+man.mood+'">'+art(man.kind,man.side)+(man.roll?'<b class="badge '+man.mood+'">'+(man.rescue||{normal:'·',devastated:'!',guilty:'×',psychopath:'+',bloodlust:'▲'}[man.mood])+'</b>':'')+'</span>':'')+'</button>'
  }).join('')
  const canTakeKing=g.bonus!==null&&legal(g).some(action=>action.type==='move'&&at(g,action.to)?.kind==='k')
  const mandatoryBonus=bonusIsRequired(g.rulesVersion)
  const bonusPiece=g.bonus===null?undefined:g.pieces.find(p=>p.id===g.bonus)
  const prompt=canAct()?(mandatoryBonus&&bonusPiece?'Move the '+labels[bonusPiece.kind].toLowerCase()+' on '+name(bonusPiece.square)+' again.':
    actions.some(a=>a.type==='absolve')?'Tap a green circle to absolve that piece.':''):''
  const headline=g.result?(g.result.winner?cap(g.result.winner)+' wins':'Draw')+' · '+g.result.reason:!v.start&&review===null?'Waiting for an opponent':bonusPiece?cap(g.side)+' · '+(canTakeKing?'King capture available':mandatoryBonus?'Bonus move required':'Bonus move'):cap(g.side)+' to move'
  const history=v.log.map(e=>{
    const x=e.event
    if(!x)return e.result?'<li>'+safe(e.result.reason)+'</li>':''
    const annotations=[x.roll?'🎲 '+x.roll+' · '+moodNames[x.mood!]:x.mood==='bloodlust'?'Bloodlust activated':'',x.capture?.side===x.side?'Friendly capture':'',...x.vanished.map(p=>cap(p.side)+' '+labels[p.kind].toLowerCase()+' on '+name(p.square)+' self-captured')].filter(Boolean)
    return tab==='Events'&&!annotations.length&&x.action.type!=='absolve'?'':'<li><span>'+x.turn+' '+(x.side==='white'?'○':'●')+'</span><div><b>'+safe(x.text)+'</b>'+annotations.map(a=>'<small>'+safe(a)+'</small>').join('')+'</div></li>'
  }).join('')
  const other=seat&&opposite(seat)
  const opponent=mode==='online'&&session?.account&&!info?.bot&&other&&info?.[other+'Account' as 'whiteAccount'|'blackAccount']?info[other]:null
  return '<main class="game"><section class="game-board-area"><div class="crumb">'+(mode==='online'&&info?.control.days?button('daily-tab','← Daily'):button('home','← Lobby'))+'<b>'+safe(mode==='online'?(info?.control.days?('DAILY · '+clockLabel(info.control).toUpperCase()):info?.rated?'RATED ONLINE':info?.bot?'RANKED QUEUE · UNRATED':'CASUAL ONLINE'):mode==='local'?'SAME COMPUTER':mode==='bot'?(quickBot?'QUICK PLAY':difficulties[difficulty].name.toUpperCase()+' BOT'):'TRAINING')+'</b>'+button('flip','⇅ Flip')+'</div>'+player(upper,v)+'<div class="board '+prefs.theme+'" role="group" aria-label="Chessboard">'+board+'<div id="particles"></div></div>'+player(opposite(upper),v)+'<div class="action-bar"><strong aria-live="polite">'+safe(headline)+'</strong>'+compactRoll+(g.result?button('result','Result'):'')+(canAct()&&bonusPiece&&!mandatoryBonus?button('end','End turn','primary'):'')+(canAct()&&actions.some(a=>a.type==='absolve')?button('absolve',absolve?'Cancel':'✧ Absolve',absolve?'primary':''):'')+'</div>'+(mode==='online'&&info?.open?button(seat?'share':'join',seat?'Copy invite link':'Join game','primary'):'')+(m.offer&&!m.game.result&&(mode!=='online'||seat&&seat!==m.offer)?'<div>Draw offered '+button('accept','Accept')+button('decline','Decline')+'</div>':'')+'<p id="status" role="status">'+safe(status||prompt)+'</p><button class="game-jump" data-do="game-details" aria-controls="match-details">Moves &amp; details</button></section><aside id="match-details"><button class="board-jump" data-do="game-board">Back to board</button><section class="panel"><h2>◆ DICE TRAY</h2>'+tray+''+(p?'<div class="inspector"><b>'+cap(p.side)+' '+labels[p.kind]+' · '+name(p.square)+'</b><small>'+(p.roll?moodNames[p.mood]+' · Rolled '+p.roll:'Hasn’t rolled')+' · '+p.kills+' captures</small></div>':'')+g.pieces.filter(p=>p.rescue).map(p=>'<div class="rescue">'+cap(p.side)+' '+labels[p.kind]+' '+name(p.square)+' · '+(p.rescue===1?'Last chance':p.rescue+' turns left')+'</div>').join('')+'</section><section class="panel details"><div class="tabs">'+['Moves','Events','Rules'].map(t=>'<button data-tab="'+t+'" aria-pressed="'+(t===tab)+'">'+t+'</button>').join('')+'</div><div id="log" data-tab="'+tab+'">'+(tab==='Rules'?rulesText(g.rulesVersion):history?'<ol>'+history+'</ol>':'<p>No entries yet.</p>')+'</div>'+(m.log.length?'<div class="review">'+button('first','⏮')+button('prev','◀')+'<span>'+(review??'Latest')+'</span>'+button('next','▶')+button('live','⏭')+'</div>':'')+'</section><div class="tools">'+(mode==='local'?button('undo','Undo')+button('redo','Redo')+button('names','Player names'):'')+(!g.result&&v.start&&(mode!=='online'||seat)?(info?.bot&&mode==='online'?'':button('offer','Offer draw'))+button('resign','Resign'):'')+(mode==='online'?button('share','Share'):button('restart','Restart'))+(g.result&&mode==='online'&&seat?(info?.control.days?button('daily-tab','Daily games'):info?.bot?button('queue-again','Find another ranked match'):button('rematch','Rematch')):'')+(session?.account&&mode==='online'&&seat&&!info?.open&&!info?.bot?button('conduct','Report or block'):'')+(opponent?button('opponent-profile','Player profile'):'')+(m.log.length?button('export','Export'):'')+'</div></aside></main>'
}
function render(){
  const accountView=$('#account')
  const focused=document.activeElement instanceof HTMLElement&&document.activeElement.matches('[data-square]')
  const settingsDialog=$<HTMLDialogElement>('#modal')
  const settingsOpen=settingsDialog?.open&&settingsDialog.dataset.kind==='settings'
  const settingsScroll=settingsOpen?settingsDialog.scrollTop:0
  const setting=settingsOpen?document.activeElement?.getAttribute('data-pref'):null
  const oldLog=$('#log')
  const logScroll=oldLog?.dataset.tab===tab&&oldLog.clientHeight?
    {top:oldLog.scrollTop,atEnd:oldLog.scrollHeight-oldLog.scrollTop-oldLog.clientHeight<24}:null
  root.innerHTML='<header><a href="/" class="logo" data-do="home">☠ REMORSE<span>CHESS</span></a><nav>'+button('rules','Rules')+button('leaders','Ratings')+button('settings','⚙ Settings')+button('friends','Friends')+(session?.account?button('profile','Profile'):session?.passkeys?button('sign-in','Sign in'):session?.signIn?'<a href="/api/auth/start">Sign in</a>':'')+'</nav></header>'+(mode==='home'?home():mode==='account'?'<main class="panel account'+(['friends','profile','admin'].includes(accountTab)?' social-account':'')+'" id="account" data-page="'+safe(accountTab)+'">Loading…</main>':game())+'<footer>REMORSE CHESS '+button('about','About & privacy')+' <a href="https://github.com/LukasJT/remorsechess/issues">Feedback</a></footer><dialog id="modal"></dialog>'
  renderSponsor()
  if(mode==='account'&&accountView?.dataset.page===accountTab)$('#account')?.replaceWith(accountView)
  document.body.classList.toggle('crt',prefs.crt)
  document.body.classList.toggle('reduced',prefs.motion||prefs.speed==='off')
  document.body.classList.toggle('match-open',mode!=='home'&&mode!=='account')
  if(focused)$('[data-square="'+focus+'"]')?.focus({preventScroll:true})
  if(settingsOpen){
    settings()
    if(setting)$('[data-pref="'+setting+'"]')?.focus({preventScroll:true})
    $('#modal')!.scrollTop=settingsScroll
  }
  const log=$('#log')
  if(log&&tab!=='Rules')log.scrollTop=logScroll&&!logScroll.atEnd?logScroll.top:log.scrollHeight
  tick()
  if(mode==='home'&&playTab==='daily'&&!dailyLobby)void refreshDaily()
}
function tell(s:string){status=s;const el=$('#status');if(el)el.textContent=s}
function tick(){
  if(!m||['home','account'].includes(mode))return
  if(mode!=='online'&&review===null){const next=expire(m,Date.now());if(next!==m){m=next;render();scheduleResult(next);return}}
  const v=view()
  for(const side of ['white','black'] as const){
    const node=$('#clock-'+side)
    if(!node)continue
    const s=Math.ceil(remaining(v,side,today())/1000)
    const minutes=Math.floor(s/60)+':'+String(s%60).padStart(2,'0')
    node.textContent=v.control.days&&s>=86400?Math.floor(s/86400)+'d '+Math.floor(s%86400/3600)+'h':
      v.control.days&&s>=3600?Math.floor(s/3600)+'h '+Math.floor(s%3600/60)+'m':v.control.seconds?minutes:'∞'
    node.classList.toggle('low',Boolean(v.control.seconds&&s<15))
  }
}
setInterval(tick,250)
function modal(html:string,kind=''){
  const d=$<HTMLDialogElement>('#modal')!
  d.dataset.kind=kind
  d.removeAttribute('aria-labelledby')
  d.innerHTML='<form method="dialog" class="close"><button aria-label="Close">×</button></form>'+html
  if(!d.open)d.showModal()
}
function showResult(celebrate=false){
  if(!m?.game.result||mode==='home'||mode==='account')return
  const {winner,reason}=m.game.result
  const perspective=mode==='bot'?human:mode==='online'?seat:null
  const outcome=!winner?'draw':perspective&&winner!==perspective?'loss':'win'
  const title=!winner?'Draw':perspective?winner===perspective?'You win':'You lose':cap(winner)+' wins'
  const score=!winner?'½ – ½':winner==='white'?'1 – 0':'0 – 1'
  const winnerText=winner&&perspective?'<span class="result-winner">'+cap(winner)+' wins</span>':''
  const again=mode==='online'?(seat?info?.control.days?button('daily-tab','Daily games','primary'):info?.bot?button('queue-again','Find another ranked match','primary'):button('rematch','Rematch','primary'):''):button('restart','Play again','primary')
  const victory=outcome==='win'&&celebrate&&!prefs.motion&&prefs.speed!=='off'
  modal('<section class="result-content '+outcome+(victory?' victory-celebrate '+(prefs.speed==='fast'?'victory-fast':''):'')+'" aria-labelledby="result-title">'+
    '<div class="result-emblem" aria-hidden="true"><span class="result-symbol">'+(outcome==='win'?'♛':outcome==='loss'?'♚':'½')+'</span></div>'+
    '<h2 id="result-title">'+title+'</h2><p class="result-reason">'+safe(reason)+(info?.bot&&!info.rated&&mode==='online'?' · Unrated game':'')+'</p>'+
    '<p class="result-score" aria-label="White–Black score">'+score+winnerText+'</p>'+
    '<div class="result-actions">'+again+(m.log.length?button('review-result','Review game'):'')+
    button('home','Back to lobby','link')+'</div></section>','result')
  $('#modal')?.setAttribute('aria-labelledby','result-title')
  if(victory) addVictoryBurst()
}
function addVictoryBurst(){
  const emblem=$('.result-emblem')
  if(!emblem)return
  const burst=document.createElement('span')
  burst.className='victory-burst'
  for(let i=0;i<18;i++){
    const spark=document.createElement('i')
    const angle=(i/18)*Math.PI*2
    const distance=63+(i%3)*13
    spark.style.setProperty('--x',Math.round(Math.cos(angle)*distance)+'px')
    spark.style.setProperty('--y',Math.round(Math.sin(angle)*distance)+'px')
    spark.style.setProperty('--spin',(i%2?1:-1)*(90+i*15)+'deg')
    spark.style.setProperty('--spark',['#ffe6a2','#f4b970','#f5d06e','#ff826f'][i%4])
    burst.appendChild(spark)
  }
  emblem.appendChild(burst)
}
function scheduleResult(match:Match,delay=0,celebrate=true){
  if(!match.game.result||review!==null)return
  clearTimeout(resultTimer)
  resultTimer=window.setTimeout(()=>{
    if(m===match&&review===null)showResult(celebrate)
  },delay)
}
function settings(){
  const checks=Object.entries({yells:'Capture yells',diceSound:'Dice sounds',uiSound:'Move sounds',diceMotion:'Dice animation',moodMotion:'Piece mood animation',ads:'Sponsor banners',last:'Last move highlight',drag:'Drag pieces',shake:'Screen shake',flash:'Impact flash',motion:'Reduced motion',crt:'Scanlines',coords:'Coordinates',hints:'Move hints',autoFlip:'Auto-flip local board',confirm:'Confirm friendly captures'})
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
  modal('<h2>Custom clock &amp; untimed</h2><div class="clocks">'+clocks([11,...presets.map((_,i)=>i).slice(13)])+'</div><form id="custom"><h3>Custom clock</h3><div class="settings"><label>Minutes<input type="number" name="minutes" value="5" min="0" max="360" required></label><label>Seconds<input type="number" name="seconds" value="0" min="0" max="59" required></label><label>Increment<input type="number" name="increment" value="2" min="0" max="180" required></label></div><button class="primary">Use custom clock</button></form>')
}
function closeRoom(){
  id=''
  clearTimeout(resultTimer)
  botAgent?.terminate();botAgent=null;clearTimeout(lessonTimer)
  if(socket){socket.onclose=null;socket.close();socket=null}
}
function goHome(keepGuide=false){
  closeRoom();void cancel();mode='home';playTab='live';m=null;status='';review=null
  history.replaceState({},'',keepGuide?'/#how-to-play':'/');render()
  if(!keepGuide)window.scrollTo(0,0)
}
function local(kind:string,control=presets[choice],fromQuickPlay=false){
  closeRoom();void cancel();history.replaceState({},'','/')
  quickBot=fromQuickPlay
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
  window.scrollTo(0,0)
  if(kind==='bot')bot()
}
let pulling='',lastSync=0
async function sync(){
  if(!id||pulling===id)return
  const room=id;pulling=room;lastSync=Date.now()
  try{const data=await api<Snapshot>('room/'+room);if(id===room)apply(data)}
  catch(e){if(id===room)tell((e as Error).message)}
  finally{if(pulling===room)pulling=''}
}
function apply(data:Snapshot){
  if(m&&data.match.version<m.version)return
  const first=!m
  const hadResult=Boolean(m?.game.result)
  const previousLog=m?.log.length??0
  const changed=first||m?.version!==data.match.version||seat!==data.seat
  if(changed)m=data.match
  offset=data.now-Date.now();info=data.room;seat=data.seat
  if(first){flipped=seat==='black';soundVersion=data.match.version;seed=initial(data.match.game.rulesVersion)}
  if(changed){
    status='';render()
    const delay=!first&&review===null&&data.match.log.length>previousLog?effects(data.match):0
    if(!hadResult)scheduleResult(data.match,delay,!first)
  }
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
  render();window.scrollTo(0,0);await login();if(id===room){await sync();wire(room)}
}
// The poll also covers updates committed while a fetch was in flight.
setInterval(()=>{if(id&&(!info?.control.days||(!document.hidden&&Date.now()-lastSync>=15_000)))void sync()},2400)
async function refreshDaily(){
  if(!session?.account||dailyLoading||dailyBusy)return
  dailyLoading=true
  try{
    dailyLobby=await api<DailyLobby>('daily')
    const list=$('#daily-list')
    if(list)list.innerHTML=dailyList()
  }catch(e){
    if(!dailyLobby){
      dailyMessage=(e as Error).message
      $('#daily-status')?.replaceChildren(dailyMessage)
      const list=$('#daily-list')
      if(list)list.innerHTML=dailyList()
    }
  }finally{dailyLoading=false}
}
async function openDaily(){
  if(mode!=='home')goHome()
  else void cancel()
  playTab='daily';dailyMessage=''
  history.replaceState({},'','/#daily')
  render()
  await login()
  if(mode==='home'&&playTab==='daily'){render();await refreshDaily()}
}
async function dailyAction(action:'find'|'invite'|'cancel'){
  if(dailyBusy||mode!=='home'||playTab!=='daily')return
  if(!(await login()).account){signIn();return}
  dailyBusy=true;dailyMessage='';render()
  try{
    const response=await api<{id?:string;queued?:number}>('daily',{action,days:dailyChoice,requestId:crypto.randomUUID()})
    if(mode!=='home'||playTab!=='daily')return
    if(response.id){await online(response.id);return}
    dailyMessage=response.queued?'You can leave this page while the search continues.':''
  }catch(e){dailyMessage=(e as Error).message}
  finally{
    dailyBusy=false
    if(mode==='home'&&playTab==='daily'){render();await refreshDaily()}
  }
}
setInterval(()=>{if(mode==='home'&&playTab==='daily'&&!document.hidden)void refreshDaily()},15_000)
async function search(){
  await login()
  if(queue||mode!=='home')return
  const c=presets[choice]
  if(!flexible&&!c.seconds){tell('Choose a timed control for matchmaking.');return}
  const ticket={...c,rated,flexible,searchId:crypto.randomUUID()}
  const current=++generation
  queue=ticket
  const label=(ticket.rated?'Ranked':'Casual')+' · '+(ticket.flexible?'Any popular clock':clockLabel(ticket))
  const started=Date.now()
  let failures=0
  status='Searching '+label+'…'
  render()
  const poll=async()=>{
    if(queue!==ticket||current!==generation)return
    clearTimeout(queueTimer)
    try{
      const found=await api<{id?:string;bot?:Control;cancelled?:boolean}>('queue',{...ticket,acceptBot:ticket.rated})
      if(current!==generation||queue!==ticket)return
      if(found.id){queue=null;await online(found.id)}
      else if(found.bot){
        queue=null
        human=Math.random()<.5?'white':'black'
        local('bot',found.bot,true)
      }
      else if(found.cancelled){queue=null;status='Search cancelled.';render()}
      else {
        failures=0
        const seconds=Math.floor((Date.now()-started)/1000)
        tell('Searching '+label+' · '+seconds+'s')
        clearTimeout(queueTimer)
        queueTimer=window.setTimeout(poll,2100)
      }
    }catch(e){
      if(current!==generation||queue!==ticket)return
      if(++failures<=3){tell('Reconnecting to '+label+'…');queueTimer=window.setTimeout(poll,3000);return}
      queue=null;status=(e as Error).message;render()
    }
  }
  await poll()
}
async function cancel(){
  const ticket=queue
  queue=null;generation++;clearTimeout(queueTimer)
  if(ticket){await api('queue',{...ticket,cancel:true}).catch(()=>{});if(mode==='home'){status='';render()}}
}
function animateVanished(pieces:readonly Piece[]):number{
  if(!pieces.length||prefs.motion||prefs.speed==='off')return 0
  const duration=prefs.speed==='fast'?320:620
  for(const piece of pieces){
    const tile=$('[data-square="'+piece.square+'"]')
    if(!tile)continue
    const marker=document.createElement('span')
    marker.className='self-capture'
    marker.setAttribute('aria-hidden','true')
    marker.innerHTML='<span class="piece '+piece.side+'">'+art(piece.kind,piece.side)+'</span>'
    tile.appendChild(marker)
    const collapse=marker.animate([
      {transform:'translateX(0) scale(1)',opacity:1},
      {transform:'translateX(-5%) rotate(-5deg) scale(1.03)',opacity:1,offset:.19},
      {transform:'translateX(5%) rotate(5deg) scale(1.03)',opacity:1,offset:.34},
      {transform:'translateY(22%) scale(.70,.40)',opacity:.72,offset:.60},
      {transform:'translateY(35%) scale(.12,.07)',opacity:0},
    ],{duration,easing:'ease-in-out',fill:'forwards'})
    void collapse.finished.then(()=>marker.remove(),()=>marker.remove())
    for(const [dx,dy] of [[-26,-18],[-16,-29],[0,-32],[15,-26],[26,-17],[11,8],[-12,8]]){
      const dust=document.createElement('i')
      dust.className='remorse-ash'
      dust.setAttribute('aria-hidden','true')
      tile.appendChild(dust)
      const scatter=dust.animate([{transform:'translate(-50%,-50%) scale(1)',opacity:.86},
        {transform:'translate(calc(-50% + '+dx+'px),calc(-50% + '+dy+'px)) scale(.22)',opacity:0}],
        {delay:duration*.4,duration:duration*.58,fill:'both',easing:'ease-out'})
      void scatter.finished.then(()=>dust.remove(),()=>dust.remove())
    }
  }
  return duration+35
}
function rollDice(duration:number){
  for(const tray of document.querySelectorAll('[data-roll]')){
    const reel=tray.querySelector<HTMLElement>('[data-die]')
    if(!reel?.getClientRects().length)continue
    const labels=tray.querySelectorAll('[data-roll-label],[data-mood-line]')
    const final=reel.textContent
    const strip=document.createElement('span')
    strip.className='dice-strip'
    for(const index of [2,4,1,5,3,0]){
      const frame=document.createElement('span')
      frame.textContent=dice[index]
      strip.appendChild(frame)
    }
    reel.replaceChildren(strip)
    labels.forEach(label=>label.classList.add('awaiting'))
    const frames=strip.animate([{transform:'translateY(0)'},{transform:'translateY(-83.33%)'}],{duration,easing:'steps(5,end)'})
    reel.animate([{transform:'rotate(-25deg) scale(.8)'},{transform:'rotate(20deg) scale(1.08)'},{transform:'rotate(-12deg)'},{transform:'none'}],{duration})
    void frames.finished.then(()=>{
      if(!reel.isConnected)return
      reel.textContent=final
      labels.forEach(label=>label.classList.remove('awaiting'))
    },()=>{})
  }
}
function effects(match:Match):number{
  if(match.version<=soundVersion)return 0
  soundVersion=match.version
  const e=match.log.at(-1)?.event
  if(!e)return 0
  const vanishedDelay=animateVanished(e.vanished)
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
  if(e.vanished.length&&prefs.uiSound)tone(165,48,.30,.10,'triangle')
  if(prefs.motion||prefs.speed==='off'||e.action.type==='end')return vanishedDelay
  const duration=prefs.speed==='fast'?145:350
  const tile=$('[data-square="'+e.action.to+'"]')
  tile?.querySelector('.piece')?.animate([{transform:'translateY(-10%) scale(1.12)'},{transform:'none'}],{duration})
  if(e.capture){
    const state=e.captureState
    const landed=at(match.game,e.action.to)
    const mood=state?.mood??e.mood??landed?.mood??'normal'
    const spinDuration=prefs.speed==='fast'?245:590
    if(prefs.diceMotion)rollDice(spinDuration)
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
  if(!e.capture)return vanishedDelay
  const delay=Math.max(vanishedDelay,prefs.diceMotion?(prefs.speed==='fast'?265:610):duration)
  if(prefs.shake) $('.board')?.animate([{transform:'translateX(-3px)'},{transform:'translateX(3px)'},{transform:'none'}],{duration})
  if(prefs.flash)tile?.animate([{filter:'brightness(1.4)'},{filter:'none'}],{duration:160})
  const layer=$('#particles'), rect=tile?.getBoundingClientRect(), origin=layer?.getBoundingClientRect()
  if(!layer||!rect||!origin||prefs.blood==='off')return delay
  for(let i=0;i<(prefs.blood==='full'?20:8);i++){
    const pixel=document.createElement('i')
    pixel.style.left=(rect.x-origin.x+rect.width/2)+'px';pixel.style.top=(rect.y-origin.y+rect.height/2)+'px'
    layer.appendChild(pixel)
    void pixel.animate([{opacity:1},{transform:'translate('+((Math.random()-.5)*104)+'px,'+((Math.random()-.4)*100)+'px)',opacity:0}],{duration:duration+160}).finished.then(()=>pixel.remove(),()=>pixel.remove())
  }
  return delay
}
function offlineStep(side:Side,action:Command,roll?:()=>number){
  if(!m)return false
  const next=command(m,side,action,Date.now(),roll)
  if(!next){tell('That action is unavailable.');return false}
  past.push(m);future=[];m=next
  if(mode==='local'&&prefs.autoFlip)flipped=m.game.side==='black'
  status='';render();scheduleResult(next,effects(next));return true
}
function bot(){
  if(mode!=='bot'||!m||m.game.side===human||m.game.result)return
  const current=m
  const level=botLevel()
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
  worker.onerror=()=>{
    worker.terminate()
    if(botAgent!==worker||mode!=='bot'||m!==current)return
    botAgent=null
    void import('./bot.ts').then(({chooseMove})=>{
      if(mode==='bot'&&m===current)commit(chooseMove(current.game,level))
    }).catch(()=>tell('The bot could not choose a move. Try restarting the game.'))
  }
  worker.postMessage({game:current.game,difficulty:level})
}
function botSetup(){
  modal('<h2>Practice against a bot</h2><form id="bot-form"><fieldset><legend>Difficulty</legend>'+
    Object.entries(difficulties).filter(([key])=>key!=='ranked').map(([key,value])=>'<label class="bot-choice"><input type="radio" name="difficulty" value="'+key+'" '+(key===difficulty?'checked':'')+'><span><b>'+value.name+'</b><small>'+value.description+'</small></span></label>').join('')+
    '</fieldset><label>Play as <select name="color"><option value="white">White</option><option value="black">Black</option><option value="random">Random</option></select></label> <button class="primary">Start game</button></form>')
}
function signIn(){
  modal('<h2>Sign in or create an account</h2>'+
    (session?.emailReady?emailForm(false)+'<h3>Use a passkey instead</h3>':'<p>Use a passkey from your device or password manager. Keep it synced so you can sign in again.</p>')+
    '<form id="passkey-register"><label>Player name <input name="handle" autocomplete="nickname" required minlength="3" maxlength="20" pattern="[A-Za-z0-9_\\-]{3,20}"></label> <button class="primary">Create account</button></form>'+
    button('passkey-login','Sign in with a passkey')+'<p class="auth-status" role="status" id="auth-status"></p>')
}
let emailCode=''
function emailForm(link:boolean){
  return '<form id="email-start" data-link="'+link+'"><label>Email address <input type="email" name="email" autocomplete="email" maxlength="254" required></label> <button class="primary">Email me a sign-in link</button><p id="email-status" role="status"></p></form>'
}
function linkEmail(){
  modal('<h2>Add email sign-in</h2><p>Use your email to sign back into this account and keep your rating. Open the verification link on any device.</p>'+emailForm(true))
}
async function sendEmailLink(form:HTMLFormElement){
  const statusNode=form.querySelector<HTMLElement>('#email-status')!
  const submit=form.querySelector<HTMLButtonElement>('button')!
  if(submit.disabled)return
  submit.disabled=true
  statusNode.textContent='Sending your link…'
  try{
    const email=String(new FormData(form).get('email')??'')
    await api('auth/email/start',{email,link:form.dataset.link==='true'})
    statusNode.textContent='Check '+email+' for a link. It expires in 15 minutes.'
  }catch(e){statusNode.textContent=e instanceof Error?e.message:'Couldn’t send the link.'}
  finally{submit.disabled=false}
}
async function emailRedeem(){
  modal('<h2>Continue with email</h2><p id="email-status" role="status">Checking your link…</p>')
  const pending=$('#email-status')
  if(!pending)return
  try{
    await login()
    const details=await api<{kind:'sign-in'|'link';accountName?:string;switchRequired?:boolean}>('auth/email/inspect',{code:emailCode})
    if(!pending.isConnected||!$<HTMLDialogElement>('#modal')?.open)return
    if(details.kind==='link'){
      const name=safe(details.accountName)
      const text=details.switchRequired
        ?'<p>This link is for <b>'+name+'</b>. Sign out of the current account and reopen this email link to continue.</p>'
        :'<p>Add this email to <b>'+name+'</b> and sign in on this device. Continue only if this is your Remorse Chess account.</p>'
      modal('<h2>Verify your email</h2>'+text+
        (details.switchRequired?'':button('email-confirm','Verify and sign in','primary'))+'<p id="email-status" role="status"></p>')
    }else modal('<h2>Continue with email</h2><p>Continue to sign in or choose a player name for your new account.</p>'+
      button('email-confirm','Continue','primary')+'<p id="email-status" role="status"></p>')
  }catch(e){pending.textContent=e instanceof Error?e.message:'Couldn’t open the link.'}
}
async function finishEmail(name?:string){
  const statusNode=$('#email-status')
  if(!statusNode||statusNode.dataset.busy)return
  statusNode.dataset.busy='1'
  statusNode.textContent='Checking your link…'
  try{
    await login()
    const result=await api<{ok?:boolean;needsName?:boolean}>('auth/email/finish',{code:emailCode,name})
    if(result.needsName){
      modal('<h2>Choose a player name</h2><form id="email-finish"><label>Player name <input name="handle" autocomplete="nickname" required minlength="3" maxlength="20"></label> <button class="primary">Create account</button><p id="email-status" role="status"></p></form>')
      return
    }
    emailCode=''
    session=null
    await login()
    rated=false
    status='Signed in. Select Ranked when you want a rated game.'
    $<HTMLDialogElement>('#modal')?.close()
    render()
  }catch(e){statusNode.textContent=e instanceof Error?e.message:'Couldn’t use the link.'}
  finally{delete statusNode.dataset.busy}
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
    if(mode==='home'){rated=false;status='Ranked play is unlocked. Select Ranked to search for a rated game.'}
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
    if(lesson===1&&(action.type!=='absolve'||action.from!==18||action.to!==27)){tell('Select the bishop on c3, tap the green circle on d4, then choose Absolve.');return}
  }
  const side=mode==='bot'&&action.type==='resign'?human:action.type==='accept'||action.type==='decline'?opposite(m.offer??m.game.side):m.game.side
  if(!offlineStep(side,action,mode==='tutorial'?()=>1:undefined))return
  if(mode==='bot')bot()
  if(mode==='tutorial'){
    if(lesson===0){
      lesson=1
      tell('Your knight rolled 1 and is devastated.')
      lessonTimer=window.setTimeout(()=>{
        if(mode!=='tutorial'||lesson!==1)return
        offlineStep('black',{type:'move',from:48,to:40})
        tell('Select the bishop on c3, tap the green circle on d4, then choose Absolve.')
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
  const choices=selected===null?[]:legal(m.game,selected).filter(a=>a.type!=='end'&&a.to===sq)
  const heal=choices.find(a=>a.type==='absolve')
  if(heal){
    const kind=labels[at(m.game,sq)!.kind].toLowerCase()
    modal('<h2>Absolve the '+kind+' on '+name(sq)+'?</h2><p>The bishop stays in place and uses this turn to heal the piece.</p>'+
      '<div class="tools"><button class="primary" id="confirm-heal">Absolve</button><button id="select-heal-target">Select piece instead</button></div>')
    $('#confirm-heal')!.onclick=()=>{$<HTMLDialogElement>('#modal')?.close();void send(heal)}
    $('#select-heal-target')!.onclick=()=>{$<HTMLDialogElement>('#modal')?.close();selected=sq;absolve=false;render()}
    return
  }
  if(absolve){tell('Tap a green circle to absolve that piece.');return}
  const options=choices.filter(a=>a.type==='move')
  if(options.length>1){
    promotion=options
    modal('<h2>Promote pawn</h2><div class="tools">'+options.map((a,i)=>'<button data-promotion="'+i+'">'+labels[(a as {promotion:Kind}).promotion]+'</button>').join('')+'</div>')
  }else if(options.length)confirmAction(options[0])
  else{
    const p=at(m.game,sq)
    if(selected!==null&&p?.side!==m.game.side&&!options.length){tell('That destination is unavailable.');return}
    selected=p?.side===m.game.side&&selected!==sq?sq:null;absolve=false;render()
  }
}
async function account(which:string){
  const user=await login()
  if(!user.account&&['profile','friends','admin'].includes(which)){
    if(!$('#modal'))render()
    signIn()
    return
  }
  closeRoom();void cancel();mode='account';accountTab=which;myProfile=null;lastFriends='';render();window.scrollTo(0,0)
  const node=$('#account')!
  history.replaceState({},'', ['profile','friends','admin'].includes(which)?'/#'+which:'/')
  if(which==='watch'){
    const games=await api<{id:string;white:string;black:string;control:Control;rated:boolean}[]>('watch')
    if(node.isConnected)node.innerHTML='<h1>Watch live games</h1>'+(games.length?'<ul>'+games.map(g=>'<li><a href="/?game='+safe(g.id)+'">'+safe(g.white)+' vs '+safe(g.black)+'</a> · '+clockLabel(g.control)+(g.rated?' · Rated':'')+'</li>').join('')+'</ul>':'<p>No public games are in progress.</p>')
  }else if(which==='leaders'){
    const records=await api<Record<string,{name:string;rating:number}[]>>('leaders')
    if(node.isConnected)node.innerHTML='<h1>Leaderboard</h1>'+Object.entries(records).map(([group,rows])=>'<h2>'+safe(group)+'</h2>'+(rows.length?'<ol>'+rows.map(p=>'<li>'+safe(p.name)+' · '+p.rating+'</li>').join('')+'</ol>':'<p>No established ratings yet.</p>')).join('')
  }else if(which==='friends'){
    const list=await api<FriendList>('friends')
    if(node.isConnected){lastFriends=JSON.stringify(list);node.innerHTML=friendsView(list)}
  }else if(which==='admin'){
    node.innerHTML='<h1>Users</h1>'
    if(!user.admin){
      node.insertAdjacentHTML('beforeend','<p>Administrator access is required.</p>')
      return
    }
    node.insertAdjacentHTML('afterbegin','<nav class="social-nav" aria-label="Account"><a href="/#profile" data-do="profile">Profile</a><a href="/#admin" aria-current="page">Users</a></nav>')
    node.insertAdjacentHTML('beforeend','<form id="admin-search" class="friend-search"><label for="admin-query">Find by username</label><div><input id="admin-query" name="query" type="search" autocomplete="off" maxlength="39" placeholder="Username starts with"><button class="primary">Search</button></div></form><p id="admin-status" role="status"></p><ul class="admin-users"></ul><button id="admin-more" data-do="admin-more" hidden>Load more users</button>')
    await loadAdminUsers(node)
  }else{
    const profile=await api<ProfilePage>('profile')
    if(node.isConnected){
      myProfile=profile
      node.innerHTML=profileView(profile,user.emailReady&&!user.emailLinked,user.admin)
    }
  }
}
const signUpMethods={passkey:'Passkey',email:'Email',github:'GitHub'}
const signUpDate=new Intl.DateTimeFormat(undefined,{dateStyle:'medium'})
async function loadAdminUsers(node:HTMLElement,query='',after=''){
  if(node.dataset.loading)return
  const notice=node.querySelector<HTMLElement>('#admin-status')!
  const list=node.querySelector<HTMLElement>('.admin-users')!
  const more=node.querySelector<HTMLButtonElement>('#admin-more')!
  const search=node.querySelector<HTMLButtonElement>('#admin-search button')!
  node.dataset.loading='true'
  search.disabled=more.disabled=true
  notice.textContent='Loading users…'
  try{
    const params=new URLSearchParams({q:query,after})
    const page=await api<AdminUsers>('admin/users?'+params)
    if(!node.isConnected)return
    const rows=page.users.map(user=>{
      const date=user.createdAt===undefined?'Date unavailable':signUpDate.format(user.createdAt)
      return '<li><div><b>@'+safe(user.handle)+'</b>'+(user.displayName?'<small>'+safe(user.displayName)+'</small>':'')+'</div>'+
        '<div>'+signUpMethods[user.registeredWith]+(user.registeredWith!=='email'&&user.emailLinked?' · Email linked':'')+'<small>'+safe(date)+'</small></div></li>'
    }).join('')
    if(!after)list.replaceChildren()
    list.insertAdjacentHTML('beforeend',rows)
    more.dataset.query=query
    more.dataset.cursor=page.next??''
    more.hidden=!page.next
    const shown=list.childElementCount
    notice.textContent=shown?shown+(shown===1?' user shown':' users shown'):query?'No matching users.':'No registered users yet.'
  }catch(e){notice.textContent=(e as Error).message}
  finally{
    delete node.dataset.loading
    search.disabled=more.disabled=false
  }
}
async function preparePhoto(file:File){
  if(file.size>16_000_000||!['image/jpeg','image/png','image/webp'].includes(file.type))
    throw Error('Choose a JPG, PNG, or WebP smaller than 16 MB.')
  const url=URL.createObjectURL(file)
  try{
    const image=new Image()
    image.src=url
    await image.decode().catch(()=>{throw Error('That picture could not be opened.')})
    const canvas=document.createElement('canvas')
    canvas.width=canvas.height=avatarSize
    const context=canvas.getContext('2d')!
    const width=image.naturalWidth,height=image.naturalHeight,size=Math.min(width,height)
    context.fillStyle='#2d212a'
    context.fillRect(0,0,avatarSize,avatarSize)
    context.drawImage(image,(width-size)/2,(height-size)/2,size,size,0,0,avatarSize,avatarSize)
    return canvas.toDataURL('image/jpeg',.78).split(',')[1]
  }finally{URL.revokeObjectURL(url)}
}
async function saveProfile(form:HTMLFormElement){
  const submit=form.querySelector('button')!
  const message=form.querySelector('#profile-edit-status')!
  if(submit.disabled)return
  submit.disabled=true;message.textContent='Saving…'
  try{
    const fields=new FormData(form)
    const file=fields.get('photo')
    const edit:ProfileEdit={displayName:String(fields.get('displayName')??''),country:String(fields.get('country')??''),bio:String(fields.get('bio')??'')}
    if(file instanceof File&&file.size){
      edit.photo=await preparePhoto(file)
      if(!edit.photo||edit.photo.length>Math.ceil(maxAvatarBytes/3)*4)throw Error('Choose a smaller profile picture.')
    }else if(fields.has('removePhoto'))edit.photo=null
    const saved=await api<ProfilePage>('profile',edit)
    if(!form.isConnected)return
    $<HTMLDialogElement>('#modal')?.close()
    if(mode==='account'&&accountTab==='profile'){
      myProfile=saved
      $('#account')!.innerHTML=profileView(saved,Boolean(session?.emailReady&&!session.emailLinked),session?.admin)+'<p role="status">Profile saved.</p>'
    }
  }catch(e){message.textContent=(e as Error).message}
  finally{submit.disabled=false}
}
async function refreshFriends(){
  const node=$('#friend-groups')
  if(!node)return
  const version=++friendsVersion
  const list=await api<FriendList>('friends')
  const serialized=JSON.stringify(list)
  if(node.isConnected&&version===friendsVersion&&serialized!==lastFriends){
    lastFriends=serialized
    const focused=document.activeElement as HTMLElement|null
    const handle=node.contains(focused)?focused?.dataset.handle:undefined
    const action=focused?.dataset.friendAction
    node.innerHTML=friendsGroups(list)
    if(handle&&action)node.querySelector<HTMLElement>('[data-handle="'+handle+'"][data-friend-action="'+action+'"]')?.focus({preventScroll:true})
  }
}
setInterval(()=>{if(mode==='account'&&accountTab==='friends'&&!document.hidden)void refreshFriends().catch(()=>{})},15_000)
async function findPlayers(form:HTMLFormElement){
  const query=String(new FormData(form).get('query')??'').trim()
  const node=$('#people-results')
  const message=$('#friends-status')
  const submit=form.querySelector('button')!
  if(!node||!message||submit.disabled)return
  if(!validHandle(query)){message.textContent='Enter at least three characters of a username.';return}
  submit.disabled=true;message.textContent='Searching…'
  try{
    const cards=await api<PlayerCard[]>('players?q='+encodeURIComponent(query))
    if(node.isConnected){node.innerHTML=playerResults(cards);message.textContent=''}
  }catch(e){message.textContent=(e as Error).message}
  finally{submit.disabled=false}
}
async function openPlayer(handle:string){
  showPlayer(await api<PlayerCard>('player/'+encodeURIComponent(handle)))
}
function showPlayer(card:PlayerCard){
  modal(playerDialog(card),'player')
  $('#modal')?.setAttribute('aria-labelledby','player-title')
}
async function friendAction(button:HTMLButtonElement){
  const handle=button.dataset.handle
  const action=button.dataset.friendAction as FriendAction
  const inDialog=Boolean(button.closest('dialog'))
  const selector=inDialog?'#player-action-status':'#friends-status'
  if(!handle||button.disabled)return
  button.disabled=true
  try{
    await api('friends',{handle,action})
    if(inDialog&&button.isConnected)await openPlayer(handle)
    if(mode==='account'&&accountTab==='friends'){
      await refreshFriends()
      const form=$<HTMLFormElement>('#friend-search')
      if(form&&$('#people-results')?.childElementCount)await findPlayers(form)
    }
    const messages={add:'Friend request sent.',accept:'Friend added.',decline:'Request declined.',cancel:'Request cancelled.',remove:'Friend removed.'}
    $(selector)?.replaceChildren(messages[action])
  }catch(e){$(selector)?.replaceChildren((e as Error).message)}
  finally{button.disabled=false}
}
async function handle(action:string){
  switch(action){
    case 'home':goHome();return
    case 'live-tab':playTab='live';history.replaceState({},'','/');render();return
    case 'daily-tab':await openDaily();return
    case 'daily-find':await dailyAction('find');return
    case 'daily-invite':await dailyAction('invite');return
    case 'daily-cancel':await dailyAction('cancel');return
    case 'rules':modal('<h2>How to play</h2>'+rulesText(mode==='home'||mode==='account'?undefined:m?.game.rulesVersion)+button('tutorial','Try the tutorial','primary'));return
    case 'about':modal('<h2>About & privacy</h2><p>Remorse Chess uses cookies to keep your online seat. Game links can be viewed by anyone with the link. Ranked accounts store your player name, passkey public key or verified email record, rating and game history. Signed-in players can see your profile details, and accepted friends can see when you are online. When enabled, the sponsor banner is provided by Adsterra and connects to its ad network.</p><p>The board uses chess symbols and original pixel sprites. Game sounds are synthesized.</p><a href="https://github.com/LukasJT/remorsechess">Source & feedback</a>');return
    case 'settings':settings();return
    case 'quiet':prefs={...prefs,volume:0,blood:'off',shake:false,flash:false,motion:true};savePrefs();render();return
    case 'more':if(!queue)clocksDialog();return
    case 'quick-clock':if(!queue){flexible=!flexible;render();$('[data-do="quick-clock"]')?.focus({preventScroll:true})}return
    case 'watch':case 'leaders':case 'profile':case 'friends':case 'admin':await account(action);return
    case 'admin-more':{
      const node=$('#account'),more=$('#admin-more')
      if(node&&more?.dataset.cursor)await loadAdminUsers(node,more.dataset.query,more.dataset.cursor)
      return
    }
    case 'edit-profile':if(myProfile)modal(profileEditor(myProfile),'profile-edit');return
    case 'opponent-profile':if(id)showPlayer(await api<PlayerCard>('room/'+id+'/player'));return
    case 'logout':await api('auth/logout',{});location.assign('/');return
    case 'local':case 'tutorial':local(action);return
    case 'bot':botSetup();return
    case 'sign-in':signIn();return
    case 'email-confirm':await finishEmail();return
    case 'link-email':linkEmail();return
    case 'passkey-login':await passkey('login');return
    case 'restart':local(mode,m?.control,quickBot);return
    case 'result':showResult();return
    case 'review-result':
      review=Math.max(0,(m?.log.length??1)-1);selected=null;absolve=false;tab='Moves';render();return
    case 'queue':await search();return
    case 'game-details':$('#match-details')?.scrollIntoView({block:'start'});return
    case 'game-board':$('.game-board-area')?.scrollIntoView({block:'start'});return
    case 'queue-again':goHome();rated=true;await search();return
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
    case 'join':{if(info?.control.days&&!session?.account){signIn();return}const room=id;const data=await api<Snapshot>('room/'+room+'/join',{});if(id===room){flipped=data.seat==='black';apply(data)}return}
    case 'share':{
      const link=location.origin+'/?game='+id
      if(navigator.clipboard){await navigator.clipboard.writeText(link);tell('Game link copied.')}
      else modal('<h2>Share game</h2><input aria-label="Game link" readonly value="'+safe(link)+'">')
      return
    }
    case 'flip':flipped=!flipped;break
    case 'absolve':absolve=!absolve;status=absolve?'Tap a green circle to absolve that piece.':'';break
    case 'resign':modal('<h2>Resign this game?</h2><button class="primary" id="confirm">Resign</button>');$('#confirm')!.onclick=()=>{$<HTMLDialogElement>('#modal')?.close();void send({type:'resign'})};return
    case 'end':case 'offer':case 'accept':case 'decline':await send({type:action});return
    case 'undo':if(m&&past.length){clearTimeout(resultTimer);future.push(m);m={...past.pop()!,start:Date.now()};review=null;selected=null}break
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
  const el=(event.target as HTMLElement).closest<HTMLElement>('[data-do],[data-square],[data-control],[data-days],[data-tab],[data-promotion],[data-player],[data-friend-action]')
  if(!el)return
  unlockAudio()
  if(el.dataset.friendAction){void friendAction(el as HTMLButtonElement);return}
  if(el.dataset.player){void openPlayer(el.dataset.player).catch(e=>modal('<h2>Player profile</h2><p>'+safe(e.message)+'</p>'));return}
  if(el.dataset.do){event.preventDefault();void handle(el.dataset.do).catch(e=>{tell(e.message);if(!$('#status'))modal('<h2>Something went wrong</h2><p>'+safe(e.message)+'</p>')})}
  else if(el.dataset.square!==undefined){focus=Number(el.dataset.square);square(focus)}
  else if(el.dataset.control!==undefined){if(!queue){choice=Number(el.dataset.control);flexible=false;render()}}
  else if(el.dataset.days!==undefined){if(!dailyBusy){dailyChoice=Number(el.dataset.days);render()}}
  else if(el.dataset.tab){tab=el.dataset.tab;render()}
  else if(el.dataset.promotion!==undefined){$<HTMLDialogElement>('#modal')?.close();confirmAction(promotion[Number(el.dataset.promotion)])}
})
root.addEventListener('change',event=>{
  const el=event.target as HTMLInputElement|HTMLSelectElement
  if(el.id==='rated'){rated=(el as HTMLInputElement).checked;render();$('#rated')?.focus({preventScroll:true});return}
  const key=el.dataset.pref
  if(!key)return
  prefs={...prefs,[key]:el instanceof HTMLInputElement&&el.type==='checkbox'?el.checked:key==='volume'?Number(el.value):el.value};savePrefs();render()
})
root.addEventListener('submit',event=>{
  const form=event.target as HTMLFormElement
  if(form.id==='profile-edit'){event.preventDefault();void saveProfile(form);return}
  if(form.id==='friend-search'){event.preventDefault();void findPlayers(form);return}
  if(form.id==='admin-search'){
    event.preventDefault()
    void loadAdminUsers($('#account')!,String(new FormData(form).get('query')??'').trim())
    return
  }
  if(form.id==='email-start'){
    event.preventDefault()
    void sendEmailLink(form)
    return
  }
  if(form.id==='email-finish'){
    event.preventDefault()
    void finishEmail(String(new FormData(form).get('handle')??''))
    return
  }
  if(form.id==='passkey-register'){
    event.preventDefault()
    void passkey('register',String(new FormData(form).get('handle')??''))
    return
  }
  if(form.id==='bot-form'){
    event.preventDefault()
    const data=new FormData(form)
    const value=data.get('difficulty')
    if(typeof value!=='string'||value==='ranked'||!Object.hasOwn(difficulties,value))return
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
  presets.push({seconds,increment});choice=presets.length-1;flexible=false;status='Custom clock selected · '+clockLabel(presets[choice]);render()
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
  const page=location.hash.slice(1)
  if(gameId&&/^[a-f0-9]{32}$/.test(gameId))void online(gameId).catch(e=>tell(e.message))
  else if(page==='profile'||page==='friends'||page==='admin')void account(page).catch(e=>$('#account')?.replaceChildren(e.message))
  else if(location.hash==='#daily')void openDaily().catch(e=>$('#daily-status')?.replaceChildren(e.message))
  else if(mode!=='home'||!root.hasChildNodes()){
    const guide=location.hash==='#how-to-play'
    goHome(guide)
    if(guide)requestAnimationFrame(()=>$('#how-to-play')?.scrollIntoView())
  }
}
window.addEventListener('popstate',route)
const link=new URLSearchParams(location.hash.slice(1)).get('email')
route()
if(link&&/^[a-f0-9]{64}$/.test(link)){
  emailCode=link
  history.replaceState({},'',location.pathname+location.search)
  void emailRedeem()
}
void login().then(()=>{if(mode==='home'&&!queue&&!$<HTMLDialogElement>('#modal')?.open)render()}).catch(()=>{})
window.setInterval(()=>{
  const count=$('#online-count')
  if(count)count.textContent=activityLabel()
},30000)

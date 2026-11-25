import {maxScientistElo,scientistBots,scientistPortrait,type ScientistBot} from './scientist-bots.ts'
import {puzzleAt,puzzleCount} from './puzzle-book.ts'
import {queueHandle,thinkTime} from './queue-opponent.ts'
import {ratingDistribution,referenceCounts,referenceDate,referenceSource,type LivePool} from './rating-reference.ts'
import './style.css'
import './after-hours.css'
import {engravedPiece} from './piece-art.ts'
import {replayStudy} from './openings.ts'
import {homeGuide} from './home-guide.ts'
import {at,file,rank,name,legal,initial,play,moodNames,inCheck,opposite,bonusIsRequired,CURRENT_RULES,type Game,type Action,type Side,type Kind,type Piece,type RulesVersion} from './rules.ts'
import {command,dailyDays,makeMatch,end,expire,remaining,presets,type Match,type Control,type Command,type DailyLobby} from './match.ts'
import {pool,countedGames,establishedRating,ratingDelta,type Rating,type RatingImpact,type RatingEvent} from './rating.ts'
import {difficulties,type Difficulty} from './bot-levels.ts'
import {avatarSize,maxAvatarBytes,validHandle,validPlayerNumber,type FriendAction,type FriendList,type PlayerCard,type ProfileEdit} from './social.ts'
import {flag,escapeHTML as safe,friendsGroups,friendsView,playerDialog,playerResults,profileEditor,profileView,type ProfilePage} from './social-view.ts'
import {minPasswordLength} from './email.ts'
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
function art(kind:Kind,side:Side){
  if(prefs.pieces==='classic')return engravedPiece(kind,side)
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
type Snapshot={room:{white?:string;black?:string;whiteAccount?:boolean;blackAccount?:boolean;open:boolean;rated:boolean;bot?:Side;control:Control;ratingPool?:string|null;countries?:Partial<Record<Side,string>>;nameplates?:Partial<Record<Side,number|null>>};seat:Side|null;match:Match;now:number;ratingImpact?:RatingImpact}
type Session={name:string;account:boolean;signIn:boolean;passkeys:boolean;emailReady:boolean;emailLinked:boolean;passwordReady:boolean;admin:boolean}
type SearchTicket=Control&{rated:boolean;flexible:boolean;searchId:string}
let session:Session|null=null
let mode='home', m:Match|null=null, selected:number|null=null, absolve=false, flipped=false, tab='Moves', status=''
let accountTab='', myProfile:ProfilePage|null=null, friendsVersion=0, lastFriends=''
let id='', info:Snapshot['room']|null=null, seat:Side|null=null, offset=0, socket:WebSocket|null=null, busy=false
let ratingImpact:RatingImpact|undefined
let practiceRating:number|null=null
let difficulty:Difficulty='tactical'
let quickName=''
let quickCountry=''
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
  const tallEnough=!matchMedia('(max-height: 540px)').matches
  const rails=prefs.ads&&inMatch&&width>=1260&&tallEnough
  const homeRail=prefs.ads&&mode==='home'&&width>=1360&&tallEnough
  const railLayout=rails?'match':homeRail?'home':''
  const bottom=prefs.ads&&(mode==='home'||inMatch)?width>=752?'desktop':width>=320?'mobile':'':''
  document.body.classList.toggle('match-sponsors',rails)
  document.body.classList.toggle('home-sponsors',homeRail)
  if(sponsorRails.dataset.layout!==railLayout){
    sponsorRails.dataset.layout=railLayout
    sponsorRails.innerHTML=(rails?sponsorFrame('match-left','Left banner ad'):'')+
      (railLayout?sponsorFrame('match-right','Right banner ad'):'')
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
const liveGroups=[['Bullet',[12,0,1,2],'bullet'],['Blitz',[3,4,5,6],'blitz'],['Rapid',[7,8,9,10],'clock']] as const
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
    '<div id="clock-groups" class="clock-groups'+(flexible?' flexible-clock':'')+'">'+liveGroups.map(([label,indices,icon])=>'<section><h3>'+navIcon(icon)+label+'</h3><div class="clocks">'+clocks([...indices],false)+'</div></section>').join('')+'</div>'+
    button('more','Custom clock & untimed','link')+
    (!flexible&&(choice===11||choice>=13)?'<small>Selected: '+(presets[choice].seconds?clockLabel(presets[choice]):'Untimed')+'</small>':'')+
    (session?.account?'<label class="rated"><input id="rated" type="checkbox" '+(rated?'checked':'')+' '+(queue?'disabled':'')+'> Ranked</label>':session?.passkeys?button('sign-in','Sign in for ranked play','link ranked-link'):'')+
    button(queue?'cancel':'queue',queue?'Cancel search':rated?'Find ranked match':flexible?'Quick match':'Find match','primary full')+
    '<div class="alt launch-actions">'+button('friend','<span>'+navIcon('friends')+'</span>Play a friend')+button('local','<span>'+navIcon('openings')+'</span>Same computer')+button('bot','<span>'+navIcon('bot')+'</span>Practice vs bot')+button('watch','<span>'+navIcon('watch')+'</span>Watch games')+'</div><p role="status" id="status">'+safe(status)+'</p>'
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
const landingPosition=replayStudy('e2e4 e7e5 b1c3 b8c6 g1f3 d7d5',4)
function landingBoard(){
  const tiles=grid.map((sq,i)=>{
    const piece=at(landingPosition,sq)
    const accent=sq===18?' selected':sq===35?' landing-capture':''
    return '<span class="sq '+((file(sq)+rank(sq))%2?'light':'dark')+accent+'">'+
      (prefs.coords&&i%8===0?'<span class="rank">'+(rank(sq)+1)+'</span>':'')+
      (prefs.coords&&i>=56?'<span class="file">'+'abcdefgh'[file(sq)]+'</span>':'')+
      (piece?'<span class="piece '+piece.side+'">'+art(piece.kind,piece.side)+'</span>':'')+'</span>'
  }).join('')
  return '<section class="landing-position" aria-labelledby="landing-position-title"><div class="landing-position-head"><h2 id="landing-position-title">First capture</h2><span>White to move</span></div>'+
    '<div class="board '+prefs.theme+'" role="img" aria-label="The white knight on c3 can capture the black pawn on d5.">'+tiles+'</div>'+
    '<p class="landing-position-note">'+navIcon('dice')+'<span><b>c3 to d5</b> · This capture would trigger the knight’s first roll.</span></p></section>'
}
function home(){
  const hero='<section class="hero"><div class="hero-copy"><h1>Remorse <em>Chess</em></h1><p class="sub">Every capture has consequences.</p><p>Remorse Chess is the chess variant <a href="/history/">from TikTok</a> where each piece rolls a die after its first capture. A piece can freeze, lose the ability to capture, or earn a second move. Play online here or <a href="/rules/">learn the rules</a>.</p>'+
    '<div class="hero-actions"><a class="link hero-rules" href="#how-to-play">How to play</a>'+button('tutorial',navIcon('play')+' Try the tutorial','link')+'</div></div>'+
    '<div class="hero-art" aria-hidden="true"><img src="/after-hours/horse.webp" width="668" height="712" alt="" fetchpriority="high"></div></section>'
  const play='<section class="panel launch"><h2><span>'+navIcon('rook')+' Play</span><span id="online-count">'+activityLabel()+'</span></h2><div class="pad">'+
    '<div class="play-tabs" role="group" aria-label="Play mode"><button data-do="live-tab" aria-pressed="'+(playTab==='live')+'">'+navIcon('blitz')+'Live</button><button data-do="daily-tab" aria-pressed="'+(playTab==='daily')+'">'+navIcon('daily')+'Daily</button></div>'+
    (canResume()?button('resume-game','Resume game','primary full'):'')+(playTab==='daily'?dailyPanel():livePanel())+'</div></section>'
  const outcomes=[['⚀','DEVASTATED','Frozen until absolved'],['⚁ ⚂','GUILT-RIDDEN','Can’t capture'],['⚃ ⚄','UNAFFECTED','Business as usual'],['⚅','PSYCHOPATH','Capture. Move again.']].map(([d,h,p])=>'<article><span>'+d+'</span><div><b>'+h+'</b><small>'+p+'</small></div></article>').join('')
  return '<main class="home">'+hero+play+landingBoard()+'<section class="outcomes">'+outcomes+'</section>'+homeGuide+'</main>'
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
const canAct=()=>Boolean(mode!=='bot-exhibition'&&m?.start&&!m.game.result&&!busy&&review===null&&(mode!=='tutorial'||m.game.side==='white'||lesson===3)&&(mode==='online'?seat===m.game.side:mode!=='bot'||m.game.side===human))
function player(side:Side,v:Match){
  const scientist=mode==='bot-exhibition'?exhibition?.[side]:mode==='bot'&&side!==human?playingScientist:undefined
  const who=scientist?.name??(mode==='online'?(info?.[side]??'Open seat'):
    mode==='bot'&&side!==human?(quickBot?quickName:practicePuzzle===undefined?(playingScientist?.name??'Bot '+selectedBotElo):'Practice bot'):names[side])
  const rating=mode==='online'?info?.nameplates?.[side]:side===human?practiceRating:null
  const ratedName=mode==='online'?Boolean(info?.[side]):mode==='bot'&&!quickBot&&side===human
  const displayRating=ratedName?' <span '+(mode==='bot'?'data-practice-rating ':'')+'title="'+safe((info?.ratingPool??(mode==='bot'&&v.control.seconds?pool(v.control.seconds,v.control.increment):'This game'))+(rating==null?' · No established rating':' rating'))+'">('+(rating??'?')+')</span>':''
  const privateSeat=mode==='online'?info?.bot===side:mode==='bot'&&quickBot&&side!==human
  const country=mode==='online'?info?.countries?.[side]:mode==='bot'&&side===human?quickCountry:''
  const handle=privateSeat?button('private-profile',safe(who)):safe(who)
  return '<div class="player '+(side===v.game.side&&!v.game.result?'turn':'')+'">'+(scientist?'<span class="scientist-match-avatar">'+scientistPortrait(scientist)+'</span>':'<span class="icon '+side+'">♚</span>')+'<div><b>'+flag(country??'')+handle+displayRating+'</b><small>'+cap(side)+(seat===side?' · You':'')+(scientist?' · '+scientist.elo+' Elo':'')+'</small></div><time id="clock-'+side+'">—</time></div>'
}
function ratingPreview({win,draw,loss,placement,projected}:RatingImpact){
  const outcomes=[['Win',win],['Draw',draw],['Loss',loss]] as const
  return '<section class="rating-impact" aria-labelledby="rating-impact-title"><h2 id="rating-impact-title">'+'Rating change'+' <small>Estimate</small></h2><dl>'+
    outcomes.map(([label,delta],index)=>'<div><dt>'+label+'</dt><dd class="'+(delta>0?'gain':delta<0?'loss':'')+'">'+
      (projected?.[index]??(delta>0?'+'+delta:delta<0?'−'+Math.abs(delta):'0'))+'</dd></div>').join('')+'</dl></section>'
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
  const preview=mode==='online'&&seat&&info?.rated&&review===null&&!g.result&&ratingImpact?ratingPreview(ratingImpact):''
  return '<main class="game"><section class="game-board-area"><div class="crumb">'+(mode==='online'&&info?.control.days?button('daily-tab','← Daily'):mode==='bot'&&practicePuzzle!==undefined?'<a href="/puzzles/">← Puzzles</a>':mode==='bot'&&!quickBot?button('bot','← Opponents'):mode==='bot-exhibition'?button('admin','← Admin'):button('home','← Lobby'))+'<b>'+safe(mode==='online'?(info?.control.days?('DAILY · '+clockLabel(info.control).toUpperCase()):info?.rated?'RATED ONLINE':info?.bot?'RANKED QUEUE · UNRATED':'CASUAL ONLINE'):mode==='local'?'SAME COMPUTER':mode==='bot'?(quickBot?'QUICK PLAY':practicePuzzle===undefined?'BOT '+selectedBotElo:'PUZZLE PRACTICE'):mode==='bot-exhibition'?'BOT VS BOT · EXHIBITION':'TRAINING')+'</b>'+button('flip','⇅ Flip')+'</div>'+player(upper,v)+'<div class="board '+prefs.theme+'" role="group" aria-label="Chessboard">'+board+'<div id="particles"></div></div>'+player(opposite(upper),v)+'<div class="action-bar"><strong aria-live="polite">'+safe(headline)+'</strong>'+compactRoll+(g.result?button('result','Result'):'')+(canAct()&&bonusPiece&&!mandatoryBonus?button('end','End turn','primary'):'')+(canAct()&&actions.some(a=>a.type==='absolve')?button('absolve',absolve?'Cancel':'✧ Absolve',absolve?'primary':''):'')+'</div>'+(mode==='online'&&info?.open?button(seat?'share':'join',seat?'Copy invite link':'Join game','primary'):'')+(m.offer&&!m.game.result&&(mode!=='online'||seat&&seat!==m.offer)?'<div>Draw offered '+button('accept','Accept')+button('decline','Decline')+'</div>':'')+'<p id="status" role="status">'+safe(status||prompt)+'</p>'+preview+'<button class="game-jump" data-do="game-details" aria-controls="match-details">Moves &amp; details</button></section><aside id="match-details"><button class="board-jump" data-do="game-board">Back to board</button><section class="panel"><h2>◆ DICE TRAY</h2>'+tray+''+(p?'<div class="inspector"><b>'+cap(p.side)+' '+labels[p.kind]+' · '+name(p.square)+'</b><small>'+(p.roll?moodNames[p.mood]+' · Rolled '+p.roll:'Hasn’t rolled')+' · '+p.kills+' captures</small></div>':'')+g.pieces.filter(p=>p.rescue).map(p=>'<div class="rescue">'+cap(p.side)+' '+labels[p.kind]+' '+name(p.square)+' · '+(p.rescue===1?'Last chance':p.rescue+' turns left')+'</div>').join('')+'</section><section class="panel details"><div class="tabs">'+['Moves','Events','Rules'].map(t=>'<button data-tab="'+t+'" aria-pressed="'+(t===tab)+'">'+t+'</button>').join('')+'</div><div id="log" data-tab="'+tab+'">'+(tab==='Rules'?rulesText(g.rulesVersion):history?'<ol>'+history+'</ol>':'<p>No entries yet.</p>')+'</div>'+(m.log.length?'<div class="review">'+button('first','⏮')+button('prev','◀')+'<span>'+(review??'Latest')+'</span>'+button('next','▶')+button('live','⏭')+'</div>':'')+'</section><div class="tools">'+(mode==='local'?button('undo','Undo')+button('redo','Redo')+button('names','Player names'):'')+(mode!=='bot-exhibition'&&!g.result&&v.start&&(mode!=='online'||seat)?(info?.bot&&mode==='online'?'':button('offer','Offer draw'))+button('resign','Resign'):'')+(mode==='online'?button('share','Share'):button('restart','Restart'))+(g.result&&mode==='online'&&seat?(info?.control.days?button('daily-tab','Daily games'):info?.bot?button('queue-again','Find another ranked match'):button('rematch','Rematch')):'')+(session?.account&&mode==='online'&&seat&&!info?.open&&!info?.bot?button('conduct','Report or block'):'')+(opponent?button('opponent-profile','Player profile'):'')+(m.log.length?button('export','Export'):'')+'</div></aside></main>'
}
const navIcons={
  play:'<path d="m9 5 11 7-11 7z"/>',
  daily:'<rect x="4" y="6" width="16" height="14" rx="1"/><path d="M8 3v6m8-6v6M4 11h16"/>',
  bot:'<rect x="5" y="8" width="14" height="12" rx="2"/><path d="M12 4v4m-4 5h1m6 0h1m-7 4h6"/>',
  watch:'<path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2"/>',
  openings:'<rect x="4" y="4" width="16" height="16"/><path d="M12 4v16M4 12h16"/>',
  study:'<path d="M12 19c-2-2-5-3-9-2V5c4-1 7 0 9 2 2-2 5-3 9-2v12c-4-1-7 0-9 2zm0-12v12"/>',
  rules:'<path d="M6 3h9l4 4v14H6zm9 0v5h4M9 12h7m-7 4h7"/>',
  ratings:'<path d="M4 4v16h16M8 15l4-4 3 2 5-6"/>',
  friends:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2m2-15a3 3 0 0 1 0 6m0 3a5 5 0 0 1 4 4v2"/>',
  profile:'<circle cx="12" cy="8" r="4"/><path d="M5 21v-1a7 7 0 0 1 14 0v1"/>',
  settings:'<path d="M5 6h14M5 12h14M5 18h14M9 4v4m6 2v4m-5 2v4"/>',
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  rook:'<path d="M5 3h3v4h2V3h4v4h2V3h3v6l-3 2v5l2 2v3H6v-3l2-2v-5L5 9zM8 11h8M6 18h12"/>',
  bullet:'<path d="M10 13c0-4 5-8 10-9-1 5-5 10-9 10Zm0 0-3 4m1-5-4 4m7-1-3 5"/>',
  blitz:'<path d="m14 2-9 12h6l-1 8 9-12h-6z"/>',
  clock:'<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M10 2h4m4 4 2-2"/>',
  dice:'<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 8h.01m8 0h.01m-4 4h.01m-4 4h.01m8 0h.01" stroke-width="3"/>',
  puzzles:'<path d="M4 4h6v2a2 2 0 1 0 4 0V4h6v6h-2a2 2 0 0 0 0 4h2v6h-6v-2a2 2 0 0 0-4 0v2H4v-6h2a2 2 0 0 0 0-4H4z"/>',
}
const navIcon=(key:keyof typeof navIcons)=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+navIcons[key]+'</svg>'
function siteNavigation(){
  const current=mode==='home'?(playTab==='daily'?'daily-tab':'home'):mode==='account'?accountTab:mode==='bot-picker'?'bot':''
  const item=(icon:keyof typeof navIcons,label:string,action?:string,href?:string)=>{
    const active=action!==undefined&&current===action?' aria-current="page"':''
    const content=navIcon(icon)+'<span>'+label+'</span>'
    if(href)return '<a href="'+href+'"'+(action?' data-do="'+action+'"':'')+active+'>'+content+'</a>'
    return '<button type="button" data-do="'+action+'"'+active+'>'+content+'</button>'
  }
  return '<nav id="site-nav" aria-label="Main navigation"><div class="site-nav-group" role="group" aria-label="Play">'+
    item('play','Play','home','/')+item('daily','Daily games','daily-tab','/#daily')+item('bot','Practice vs bot','bot','/#bots')+
    item('watch','Watch','watch','/#watch')+'</div><div class="site-nav-group" role="group" aria-label="Learn">'+
    item('puzzles','Puzzles',undefined,'/puzzles/')+item('openings','Openings',undefined,'/openings/')+item('study','Study',undefined,'/study/')+item('rules','Rules',undefined,'/rules/')+
    '</div><div class="site-nav-group" role="group" aria-label="Community and account">'+item('ratings','Ratings','leaders','/#leaders')+
    (session?.account?item('ratings','Rating history','stats','/#stats'):'')+item('friends','Friends','friends','/#friends')+
    (session?.account?item('profile','Profile','profile','/#profile'):session?.passkeys?item('profile','Sign in','sign-in'):
      session?.signIn?item('profile','Sign in',undefined,'/api/auth/start'):'')+
    (session?.admin?item('profile','Admin','admin','/#admin'):'')+item('settings','Settings','settings')+'</div></nav>'
}
function setSiteMenu(open:boolean){
  $('#site-menu')?.setAttribute('aria-expanded',String(open))
  $('#app')?.classList.toggle('site-menu-open',open)
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
  root.innerHTML='<header class="site-bar"><button type="button" id="site-menu" data-do="site-menu" aria-controls="site-nav" aria-expanded="false">'+
    navIcon('menu')+'<span>Menu</span></button><a href="/" class="logo" data-do="home"><img src="/after-hours/horse-icon.webp" width="44" height="47" alt=""><b>Remorse <span>Chess</span></b></a></header>'+
    siteNavigation()+(mode==='home'?home():mode==='bot-picker'?botPicker():mode==='account'?'<main class="panel account'+(['friends','profile','admin'].includes(accountTab)?' social-account':'')+
    '" id="account" data-page="'+safe(accountTab)+'">Loading…</main>':game())+
    '<footer>REMORSE CHESS '+button('about','About & privacy')+' <a href="https://github.com/LukasJT/remorsechess/issues">Feedback</a></footer><dialog id="modal"></dialog>'
  setSiteMenu(false)
  renderSponsor()
  if(mode==='account'&&accountView?.dataset.page===accountTab)$('#account')?.replaceWith(accountView)
  document.body.classList.toggle('crt',prefs.crt)
  document.body.classList.toggle('reduced',prefs.motion||prefs.speed==='off')
  document.body.classList.toggle('match-open',mode!=='home'&&mode!=='account'&&mode!=='bot-picker')
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
  if(!m)return
  if(activeKind()!=='online'&&review===null){
    const next=expire(m,Date.now())
    if(next!==m){m=next;rememberBot();if(!parked){render();scheduleResult(next)};return}
  }
  if(parked||mode==='home'||mode==='account'||mode==='bot-picker')return
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
  const cancelled=reason==='Game cancelled'
  const title=cancelled?'Game cancelled':!winner?'Draw':mode==='bot-exhibition'&&exhibition?safe(exhibition[winner].label)+' wins':perspective?winner===perspective?'You win':'You lose':cap(winner)+' wins'
  const score=cancelled?'—':!winner?'½ – ½':winner==='white'?'1 – 0':'0 – 1'
  const winnerText=winner&&perspective?'<span class="result-winner">'+cap(winner)+' wins</span>':''
  const again=mode==='online'?(seat?info?.control.days?button('daily-tab','Daily games','primary'):info?.bot?button('queue-again','Find another ranked match','primary'):button('rematch','Rematch','primary'):''):button('restart','Play again','primary')
  const victory=outcome==='win'&&celebrate&&!prefs.motion&&prefs.speed!=='off'
  modal('<section class="result-content '+outcome+(victory?' victory-celebrate '+(prefs.speed==='fast'?'victory-fast':''):'')+'" aria-labelledby="result-title">'+
    '<div class="result-emblem" aria-hidden="true"><span class="result-symbol">'+(outcome==='win'?'♛':outcome==='loss'?'♚':'½')+'</span></div>'+
    '<h2 id="result-title">'+title+'</h2><p class="result-reason">'+safe(reason)+(info?.bot&&!info.rated&&mode==='online'?' · Unrated game':'')+'</p>'+
    '<p class="result-score" aria-label="White–Black score">'+score+winnerText+'</p>'+
    (mode==='online'&&info?.rated&&seat&&!cancelled?'<p data-settled-rating role="status">Saving rating…</p>':'')+
    '<div class="result-actions">'+again+(m.log.length?button('review-result','Review game'):'')+
    button('home','Back to lobby','link')+'</div></section>','result')
  $('#modal')?.setAttribute('aria-labelledby','result-title')
  if(victory) addVictoryBurst()
  const line=$('[data-settled-rating]')
  if(line&&id)void showSettledRating(id,line)
}
async function showSettledRating(game:string,line:Element){
  for(let attempt=0;attempt<8&&line.isConnected;attempt++){
    try{
      const event=await api<RatingEvent|null>('rating-result?game='+game)
      if(event){
        const delta=ratingDelta(event.before,event.after)
        const value=Math.round(event.after.rating)
        line.textContent=event.pool+' rating '+value+' ('+(delta>0?'+':'')+delta+')'
        line.insertAdjacentHTML('afterend',button('stats','Rating history'))
        return
      }
    }catch{break}
    await new Promise(resolve=>window.setTimeout(resolve,350*(attempt+1)))
  }
  if(line.isConnected)line.textContent='Open Rating history to see the settled result.'
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
type ResumableBot={match:Match;seed:Game;human:Side;quick:boolean;name:string;difficulty:Difficulty;elo:number;anchors:number[];puzzleId?:number;scientistId?:string;seenAt:number;leftAt?:number}
let parked:''|'online'|'bot'|'local'=''
const activeKind=()=>parked||mode
const savedRoom='remorse-live-room'
const savedBot='remorse-live-bot'
const hasPlayed=(match?:Match|null)=>Boolean(match?.log.some(entry=>entry.event))
function stored<T>(key:string):T|null{
  try{return JSON.parse(localStorage.getItem(key)??'null') as T|null}catch{return null}
}
function remember(key:string,value:unknown){
  try{if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,JSON.stringify(value))}catch{}
}
function rememberBot(leaving=false){
  if(activeKind()!=='bot'||!m)return
  if(!hasPlayed(m)){remember(savedBot,null);return}
  const data:ResumableBot={match:m,seed,human,quick:quickBot,name:quickName,difficulty,elo:selectedBotElo,anchors:botAnchors,puzzleId:practicePuzzle,scientistId:playingScientist?.id,seenAt:Date.now(),leftAt:leaving?Date.now():undefined}
  remember(savedBot,data)
}
function canResume(){
  return Boolean(parked&&m||stored<string>(savedRoom)||hasPlayed(stored<ResumableBot>(savedBot)?.match))
}
function parkGame(){
  if(!parked&&m&&!m.game.result&&hasPlayed(m)&&((mode==='online'&&seat&&!info?.control.days)||mode==='bot'||mode==='local')){
    parked=mode
    review=null;selected=null;clearTimeout(resultTimer)
  }else if(!parked){
    if(mode==='online'&&id&&!info?.control.days&&!hasPlayed(m)){
      const room=id
      if(stored<string>(savedRoom)===room)remember(savedRoom,null)
      void api<{resumable:boolean}>('room/'+room+'/cancel-unplayed',{}).then(result=>{
        // A move can arrive between the last snapshot and the cancellation request.
        if(result.resumable&&!stored<string>(savedRoom)){
          remember(savedRoom,room)
          if(mode==='home')render()
        }
      }).catch(()=>{})
    }
    if(mode==='bot')remember(savedBot,null)
    if(mode==='online'&&m?.game.result&&stored<string>(savedRoom)===id)remember(savedRoom,null)
    closeRoom();m=null
  }
}
async function resumeGame(){
  if(parked&&m){
    mode=parked;parked='';status='';review=null
    if(mode==='online')history.replaceState({},'','/?game='+id)
    render();tick();scheduleResult(m,0,false);window.scrollTo(0,0)
    if(mode==='online')void sync()
    return
  }
  const room=stored<string>(savedRoom)
  if(room&&/^[a-f0-9]{32}$/.test(room)){
    await login()
    const result=await api<{resumable:boolean}>('room/'+room+'/resume-status')
    if(result.resumable){await online(room);return}
    if(stored<string>(savedRoom)===room)remember(savedRoom,null)
    render()
  }
  const data=stored<ResumableBot>(savedBot)
  if(!data||!hasPlayed(data.match))return
  closeRoom();mode='bot';id='';info=null;seat=null;status='';selected=null;review=null;absolve=false;past=[];future=[];tab='Moves'
  m=data.match;seed=data.seed;human=data.human;quickBot=data.quick;quickName=data.name;difficulty=data.difficulty;selectedBotElo=data.elo;botAnchors=data.anchors;practicePuzzle=data.puzzleId
  playingScientist=scientistBots.find(bot=>bot.id===(data.scientistId==='rutherford'?'newton':data.scientistId))
  flipped=human==='black';soundVersion=m.version
  const now=Date.now()
  const disconnect=(data.leftAt??data.seenAt)+60_000
  if(!m.game.result&&m.game.side!==human){
    const {chooseMove}=await import('./bot.ts')
    for(let moves=0;moves<2&&!m.game.result&&m.game.side!==human;moves++){
      const due=Math.max(data.seenAt,m.start+(quickBot?thinkTime(m,remaining(m,m.game.side,m.start),()=>.5):230))
      if(due>Math.min(disconnect,now))break
      const step=chooseMove(m.game,botLevel())
      if(!step)break
      m=command(m,m.game.side,step,due)??m
    }
  }
  m=expire(m,Math.min(now,disconnect))
  if(!m.game.result&&now>=disconnect)m=end(m,{winner:opposite(human),reason:'Disconnected'},disconnect)
  history.replaceState({},'','/')
  rememberBot();render();scheduleResult(m,0,false);window.scrollTo(0,0);bot()
}
window.addEventListener('pagehide',()=>{
  if(queue){
    const ticket=queue
    queue=null;generation++;clearTimeout(queueTimer)
    navigator.sendBeacon('/api/queue',new Blob([JSON.stringify({...ticket,cancel:true})],{type:'application/json'}))
  }
  rememberBot(true)
  if(mode==='online'&&id&&!info?.control.days&&!hasPlayed(m)){
    navigator.sendBeacon('/api/room/'+id+'/cancel-unplayed',new Blob(['{}'],{type:'application/json'}))
  }
})
window.addEventListener('pageshow',event=>{
  if(!event.persisted)return
  if(activeKind()==='bot'){tick();rememberBot()}
  if(mode==='home'&&!queue){status='';render()}
})
setInterval(()=>{if(activeKind()==='bot'&&m&&!m.game.result)rememberBot()},5000)
function closeRoom(){
  parked=''
  id=''
  clearTimeout(resultTimer)
  botAgent?.terminate();botAgent=null;clearTimeout(lessonTimer)
  if(socket){socket.onclose=null;socket.close();socket=null}
}
function goHome(keepGuide=false){
  parkGame();void cancel();mode='home';playTab='live';status='';review=null
  history.replaceState({},'',keepGuide?'/#how-to-play':'/');render()
  if(!keepGuide)window.scrollTo(0,0)
}
let practicePuzzle:number|undefined
function local(kind:string,control=presets[choice],fromQuickPlay=false,puzzleId?:number,scientist?:ScientistBot){
  playingScientist=scientist
  practicePuzzle=puzzleId
  closeRoom();void cancel();history.replaceState({},'','/')
  if(puzzleId!==undefined)practiceRating=null
  quickBot=fromQuickPlay
  if(kind==='bot'){
    quickName=queueHandle()
    quickCountry=''
    const name=quickName
    if(session?.account)void api<ProfilePage>('profile').then(p=>{if(mode==='bot'&&quickName===name){quickCountry=p.details.country;render()}}).catch(()=>{})
  }
  mode=kind;m=makeMatch(kind==='tutorial'?{seconds:0,increment:0}:control,Date.now())
  if(puzzleId!==undefined){
    m.game=puzzleAt(puzzleId).game
    human=m.game.side
    difficulty='tactical'
    history.replaceState({},'','/?practice-puzzle='+puzzleId)
  }
  seat=null;selected=null;absolve=false;review=null;flipped=kind==='bot'&&human==='black';past=[];future=[];tab='Moves';status='';soundVersion=-1;focus=4
  if(kind==='tutorial'){
    const positions=[['white','k',4],['white','b',18],['white','n',10],['black','k',60],['black','p',27],['black','p',48]] as const
    const full=initial()
    m.game.pieces=positions.map(([side,kind,square],i)=>({...full.pieces[i],side,kind,square,moved:true}))
    m.game.seen={}
    lesson=0;status='Capture the pawn on d4 with the knight on c2.'
  }
  seed=m.game
  rememberBot()
  render()
  window.scrollTo(0,0)
  if(kind==='bot'||kind==='bot-exhibition')bot()
}
let pulling='',lastSync=0
async function sync(){
  if(!id||pulling===id)return
  const room=id;pulling=room;lastSync=Date.now()
  try{const data=await api<Snapshot>('room/'+room);if(id===room)apply(data)}
  catch(e){if(id===room&&!parked)tell((e as Error).message)}
  finally{if(pulling===room)pulling=''}
}
function apply(data:Snapshot){
  if(m&&data.match.version<m.version)return
  const first=!m
  const hadResult=Boolean(m?.game.result)
  const previousLog=m?.log.length??0
  const changed=first||m?.version!==data.match.version||seat!==data.seat
  if(changed)m=data.match
  offset=data.now-Date.now();info=data.room;seat=data.seat;ratingImpact=data.ratingImpact
  if(first){flipped=seat==='black';soundVersion=data.match.version;seed=initial(data.match.game.rulesVersion)}
  if(seat&&!data.room.control.days){
    if(hasPlayed(data.match)&&(!data.match.game.result||stored<string>(savedRoom)===id))remember(savedRoom,id)
    else if(!hasPlayed(data.match)&&stored<string>(savedRoom)===id)remember(savedRoom,null)
  }
  if(changed&&!parked){
    status='';render()
    const delay=!first&&review===null&&data.match.log.length>previousLog?effects(data.match):0
    if(!hadResult)scheduleResult(data.match,delay,!first)
  }
}
function wire(room:string){
  if(id!==room)return
  socket=new WebSocket((location.protocol==='https:'?'wss:':'ws:')+'//'+location.host+'/api/room/'+room+'/ws')
  socket.onopen=()=>{if(id===room){if(!parked)tell('');void sync()}}
  socket.onmessage=()=>void sync()
  socket.onclose=()=>{if(id===room){if(!parked)tell('Reconnecting…');window.setTimeout(()=>wire(room),2600)}}
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
  const knownRoll=practicePuzzle!==undefined&&mode==='bot'&&side===human&&!m.log.some(entry=>entry.event?.side===human&&entry.event.roll)
    ?puzzleAt(practicePuzzle).face:undefined
  const next=command(m,side,action,Date.now(),roll??(knownRoll===undefined?undefined:()=>knownRoll))
  if(!next){tell('That action is unavailable.');return false}
  if(mode!=='bot-exhibition')past.push(m)
  future=[];m=next
  if(mode==='local'&&prefs.autoFlip)flipped=m.game.side==='black'
  rememberBot()
  if(!parked){status='';render();scheduleResult(next,effects(next))}
  return true
}
function bot(){
  const automatic=activeKind()==='bot-exhibition'
  if(!m||m.game.result||(!automatic&&(activeKind()!=='bot'||m.game.side===human)))return
  if(automatic&&(!session?.admin||!exhibition))return
  const current=m
  const currentKind=activeKind()
  const isCurrent=()=>activeKind()===currentKind&&m===current
  const elo=automatic?exhibition![current.game.side].elo:selectedBotElo
  const anchors=automatic?[300,900,maxScientistElo]:botAnchors
  const delay=automatic?600:quickBot?thinkTime(current,remaining(current,current.game.side,today())):230
  let level=botLevel()
  if(automatic||!quickBot&&practicePuzzle===undefined){
    const upper=anchors.findIndex(anchor=>anchor>=elo)
    const lower=anchors[upper-1]??100
    const fraction=(elo-lower)/(anchors[upper]-lower)
    if(Math.random()<fraction)level=practiceLevels[upper]
    else if(upper>0)level=practiceLevels[upper-1]
    else{
      const moves=legal(current.game)
      const action=moves[Math.floor(Math.random()*moves.length)]
      window.setTimeout(()=>{
        if(isCurrent()&&action){offlineStep(current.game.side,action);bot()}
      },delay)
      return
    }
  }
  botAgent?.terminate()
  const worker=new Worker(new URL('./bot-worker.ts',import.meta.url),{type:'module'})
  botAgent=worker
  const commit=(action:Action|undefined)=>{
    worker.terminate()
    if(botAgent===worker)botAgent=null
    if(!isCurrent()||!action)return
    window.setTimeout(()=>{
      if(!isCurrent()||!action)return
      offlineStep(current.game.side,action)
      bot()
    },delay)
  }
  worker.onmessage=(event:MessageEvent<Action|undefined>)=>commit(event.data)
  worker.onerror=()=>{
    worker.terminate()
    if(botAgent!==worker||!isCurrent())return
    botAgent=null
    void import('./bot.ts').then(({chooseMove})=>{
      if(isCurrent())commit(chooseMove(current.game,level))
    }).catch(()=>tell('The bot could not choose a move. Try restarting the game.'))
  }
  worker.postMessage({game:current.game,difficulty:level})
}
const practiceLevels=['rookie','tactical','expert'] as const
let selectedBotElo=900
let botAnchors=[300,900,1400]
const practiceClocks=[presets[0],presets[3],presets[7],{seconds:0,increment:0}]
let playingScientist:ScientistBot|undefined
let exhibition:Record<Side,ScientistBot>|undefined
let pickedScientist:ScientistBot|undefined=scientistBots.find(bot=>bot.id==='newton')
let pickerClock=3
let pickerColor:Side|'random'='white'
let pickerElo=900

function openBotPicker(){
  parkGame()
  void cancel()
  mode='bot-picker'
  history.replaceState({},'','/#bots')
  render()
  window.scrollTo(0,0)
}

function botPicker(){
  const position=initial()
  const board=(pickerColor==='black'?grid.slice().reverse():grid).map(sq=>{
    const piece=at(position,sq)
    return '<span class="sq '+((file(sq)+rank(sq))%2?'light':'dark')+'">'+
      (piece?'<span class="piece '+piece.side+'">'+art(piece.kind,piece.side)+'</span>':'')+'</span>'
  }).join('')
  const picked=pickedScientist
  const selected='<div class="scientist-selection">'+(picked?scientistPortrait(picked):'')+
    '<div><h2>'+safe(picked?.name??'Custom engine')+'</h2><p>'+ (picked?.elo??pickerElo) +' Elo</p></div></div>'
  const roster=scientistBots.map(bot=>{
    const locked=bot.elo>maxScientistElo
    return '<button type="button" class="scientist-card" data-scientist="'+bot.id+'" aria-pressed="'+(picked===bot)+'" '+
      (locked?'disabled title="Not available yet" ':'')+'aria-label="'+safe(bot.name)+', '+bot.elo+' Elo'+(locked?', unavailable':'')+'">'+
      scientistPortrait(bot)+'<span>'+safe(bot.label)+'</span><small>'+bot.elo+(locked?' · Locked':'')+'</small></button>'
  }).join('')
  const colors=['white','black','random'] as const
  return '<main class="bot-lab"><section class="bot-lab-board"><h1>Practice vs bot</h1><div class="board '+prefs.theme+'" role="img" aria-label="Chess starting position">'+board+'</div></section>'+
    '<section class="bot-lab-roster" aria-labelledby="bot-roster-title"><h2 id="bot-roster-title">Choose an opponent</h2>'+selected+
    '<div class="scientist-grid" aria-label="Scientist opponents">'+roster+'</div>'+
    '<form id="bot-form"><div class="bot-lab-options"><label>Clock <select name="clock">'+
    practiceClocks.map((control,i)=>'<option value="'+i+'" '+(i===pickerClock?'selected':'')+'>'+clockLabel(control)+'</option>').join('')+
    '</select></label><label>Play as <select name="color">'+colors.map(color=>'<option value="'+color+'" '+(color===pickerColor?'selected':'')+'>'+ (color==='random'?'Random':cap(color))+'</option>').join('')+
    '</select></label></div>'+
    (picked?'<button type="button" class="link" data-scientist="engine">Custom engine</button>':'<label class="bot-lab-range">Engine rating <input name="level" type="range" min="100" max="'+maxScientistElo+'" step="50" value="'+pickerElo+'"></label>')+
    '<button class="primary full">'+(canResume()?'Resume current game':'Play '+(picked?.label??'custom engine'))+'</button></form></section></main>'
}
function signIn(){
  modal('<h2>Sign in</h2>'+
    (session?.passwordReady?'<form id="password-login" class="auth-form">'+authEmailField()+
      '<label>Password <input type="password" name="password" autocomplete="current-password" maxlength="256" required></label> '+
      '<button class="primary">Sign in</button><p id="email-status" role="status"></p></form>':'')+
    '<div class="tools">'+
    (session?.emailReady?button('email-sign-in','Email me a sign-in link')+button('email-reset','Forgot or need a password?'):'')+
    (session?.passkeys?button('passkey-login','Sign in with a passkey'):'')+
    '</div><p class="auth-status" role="status" id="auth-status"></p><h3>Create an account</h3><div class="tools">'+
    (session?.emailReady?button('email-signup','Sign up with email'):'')+
    (session?.passkeys?button('passkey-signup','Sign up with a passkey'):'')+'</div>')
}
let emailCode=''
type EmailFlow='sign-in'|'signup'|'reset'|'link'
function authEmailField(email=''){
  return '<label>Email address <input type="email" name="email" autocomplete="username" maxlength="254" value="'+safe(email)+'" required></label> '
}
function emailForm(flow:EmailFlow,label:string,email=''){
  return '<form id="email-start" class="auth-form" data-flow="'+flow+'">'+authEmailField(email)+
    '<button class="primary">'+label+'</button><p id="email-status" role="status"></p></form>'
}
function emailDialog(flow:Exclude<EmailFlow,'link'>){
  const email=$<HTMLInputElement>('#password-login input[name="email"]')?.value
  const details={
    'sign-in':['Sign in with an email link','Open the link on any device to sign in.','Send sign-in link'],
    signup:['Sign up with email','Verify your email first, then choose a player name and password.','Send verification link'],
    reset:['Set or reset your password','We’ll email a link to choose a password for your existing account.','Send password link'],
  }[flow]
  modal('<h2>'+details[0]+'</h2><p>'+details[1]+'</p>'+emailForm(flow,details[2],email)+
    (session?.account?'':button('sign-in','Back to sign in','link')))
}
function passkeySignup(){
  modal('<h2>Sign up with a passkey</h2><p>Use a passkey from your device or password manager.</p>'+
    '<form id="passkey-register" class="auth-form"><label>Player name <input name="handle" autocomplete="nickname" required minlength="3" maxlength="20" pattern="[A-Za-z0-9_\\-]{3,20}"></label> <button class="primary">Create account</button></form>'+
    '<p class="auth-status" role="status" id="auth-status"></p>'+button('sign-in','Back to sign in','link'))
}
function linkEmail(){
  modal('<h2>Add email sign-in</h2><p>Use your email to sign back into this account and keep your rating. Open the verification link on any device.</p>'+emailForm('link','Send verification link'))
}
async function sendEmailLink(form:HTMLFormElement){
  const statusNode=form.querySelector<HTMLElement>('#email-status')!
  const submit=form.querySelector<HTMLButtonElement>('button')!
  if(submit.disabled)return
  submit.disabled=true
  statusNode.textContent='Sending your link…'
  try{
    const email=String(new FormData(form).get('email')??'')
    const flow=form.dataset.flow as EmailFlow
    await api('auth/email/start',{email,link:flow==='link',purpose:flow==='link'?undefined:flow})
    statusNode.textContent=flow==='reset'||flow==='sign-in'
      ?'If '+email+' is registered, check your inbox for a link. It expires in 15 minutes.'
      :'Check '+email+' for a link. It expires in 15 minutes.'
  }catch(e){statusNode.textContent=e instanceof Error?e.message:'Couldn’t send the link.'}
  finally{submit.disabled=false}
}
async function emailRedeem(){
  modal('<h2>Continue with email</h2><p id="email-status" role="status">Checking your link…</p>')
  const pending=$('#email-status')
  if(!pending)return
  try{
    await login()
    const details=await api<{kind:EmailFlow;accountName?:string;switchRequired?:boolean}>('auth/email/inspect',{code:emailCode})
    if(!pending.isConnected||!$<HTMLDialogElement>('#modal')?.open)return
    if(details.kind==='link'){
      const name=safe(details.accountName)
      const text=details.switchRequired
        ?'<p>This link is for <b>'+name+'</b>. Sign out of the current account and reopen this email link to continue.</p>'
        :'<p>Add this email to <b>'+name+'</b> and sign in on this device. Continue only if this is your Remorse Chess account.</p>'
      modal('<h2>Verify your email</h2>'+text+
        (details.switchRequired?'':button('email-confirm','Verify and sign in','primary'))+'<p id="email-status" role="status"></p>')
    }else if(details.switchRequired){
      modal('<h2>Switch accounts</h2><p>Sign out of the current account and reopen the email link to continue.</p>'+button('logout','Sign out'))
    }else if(details.kind==='signup'||details.kind==='reset'){
      emailPasswordForm(details.kind)
    }else modal('<h2>Sign in with email</h2>'+button('email-confirm','Sign in','primary')+'<p id="email-status" role="status"></p>')
  }catch(e){pending.textContent=e instanceof Error?e.message:'Couldn’t open the link.'}
}
function emailPasswordForm(flow:'signup'|'reset'){
  const signup=flow==='signup'
  modal('<h2>'+(signup?'Finish creating your account':'Choose a new password')+'</h2><form id="email-finish" class="auth-form">'+
    (signup?'<label>Player name <input name="handle" autocomplete="nickname" required minlength="3" maxlength="20" pattern="[A-Za-z0-9_\\-]{3,20}"></label>':'')+
    '<label>Password <input type="password" name="password" autocomplete="new-password" required minlength="'+minPasswordLength+'" maxlength="256" aria-describedby="password-length"></label>'+
    '<p id="password-length">Use at least '+minPasswordLength+' characters.</p>'+
    '<button class="primary">'+(signup?'Create account':'Save password and sign in')+'</button><p id="email-status" role="status"></p></form>')
}
async function completeEmailSignIn(){
  emailCode=''
  session=null
  await login()
  rated=false
  status='Signed in. Select Ranked when you want a rated game.'
  $<HTMLDialogElement>('#modal')?.close()
  render()
}
async function passwordSignIn(form:HTMLFormElement){
  const statusNode=form.querySelector<HTMLElement>('#email-status')!
  const submit=form.querySelector<HTMLButtonElement>('button')!
  if(submit.disabled)return
  submit.disabled=true
  statusNode.textContent='Signing in…'
  try{
    const data=new FormData(form)
    await login()
    await api('auth/email/password',{email:data.get('email'),password:data.get('password')})
    await completeEmailSignIn()
  }catch(e){statusNode.textContent=e instanceof Error?e.message:'Couldn’t sign in.'}
  finally{submit.disabled=false}
}
async function finishEmail(name?:string,password?:string){
  const statusNode=$('#email-status')
  if(!statusNode||statusNode.dataset.busy)return
  statusNode.dataset.busy='1'
  statusNode.textContent='Checking your link…'
  try{
    await login()
    const result=await api<{ok?:boolean;needsName?:boolean}>('auth/email/finish',{code:emailCode,name,password})
    if(result.needsName){
      emailPasswordForm('signup')
      return
    }
    await completeEmailSignIn()
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
  if(!m||mode==='bot-exhibition'||review!==null||busy)return
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
async function openDistribution(node:HTMLElement){
  node.innerHTML='<h1>Rating distribution</h1><form class="tools"><label>Pool <select name="pool"><option>Bullet</option><option selected>Blitz</option><option>Rapid</option><option>Daily</option></select></label>'+
    '<label>Population <select name="source"><option value="local">Remorse players</option><option value="reference">Historical Chess.com reference</option></select></label></form><div data-distribution></div>'
  const form=node.querySelector('form')!
  const output=node.querySelector<HTMLElement>('[data-distribution]')!
  let request=0
  const refresh=async()=>{
    const version=++request
    const fields=new FormData(form)
    const group=String(fields.get('pool'))
    const reference=fields.get('source')==='reference'
    output.textContent='Loading distribution…'
    try{
      if(reference&&!Object.hasOwn(referenceCounts,group)){
        output.textContent='The historical reference has no Daily pool.'
        return
      }
      const snapshot=reference?{first:100,counts:referenceCounts[group as LivePool],time:0}:
        await api<{first:number;counts:number[];time:number}>('rating-distribution?pool='+group)
      if(version!==request||!node.isConnected)return
      const {first,counts,time}=snapshot
      const total=counts.reduce((n,value)=>n+value,0)
      const desc=reference?referenceDate+' leaderboard transcription. Rating labels are source buckets.':
        'Established accounts with rating activity in the last 90 days · '+new Date(time).toLocaleDateString()
      output.innerHTML='<p>'+safe(desc)+'</p><p>'+total.toLocaleString()+' players</p>'
      if(reference)output.insertAdjacentHTML('beforeend','<p><a href="'+referenceSource+'">Source counts</a></p>')
      if(!total){output.insertAdjacentHTML('beforeend','<p>No established ratings in this pool yet.</p>');return}
      const rows=ratingDistribution(counts,first,100)
      const peak=Math.max(...counts)
      const width=475/rows.length
      const axis=reference?'Rating bucket':'Rating range'
      output.insertAdjacentHTML('beforeend',
        '<svg class="rating-chart" viewBox="0 0 575 155" role="img" aria-label="Player count bars and cumulative rating percentile. See the table for exact bucket totals.">'+
        '<text x="5" y="16" fill="currentColor">'+peak.toLocaleString()+'</text><text x="527" y="16" fill="currentColor">100%</text>'+
        rows.map(({count},i)=>'<rect x="'+(50+width*i)+'" y="'+(130-count*113/peak)+'" width="'+(width*.8)+'" height="'+(count*113/peak)+'" fill="#b87977"/>').join('')+
        '<polyline fill="none" stroke="currentColor" stroke-width="2" points="'+rows.map(({percentile},i)=>(50+width*(i+.5))+','+(130-113*percentile/100)).join(' ')+'"/>'+
        '<text x="50" y="150" fill="currentColor">'+first+'</text><text x="490" y="150" fill="currentColor">'+rows.at(-1)!.rating+'</text></svg>'+
        '<details class="ratings-table"><summary>View rating buckets</summary><table><thead><tr><th>'+axis+'</th><th>Players</th><th>Cumulative</th></tr></thead><tbody>'+
        rows.map(row=>'<tr><td>'+row.rating+(reference?'':'–'+(row.rating+99))+'</td><td>'+row.count.toLocaleString()+'</td><td>'+row.percentile.toFixed(1)+'%</td></tr>').join('')+
        '</tbody></table></details>')
    }catch{if(version===request)output.textContent='Distribution is unavailable. Try again.'}
  }
  form.onchange=()=>void refresh()
  await refresh()
}
async function openRatingStats(node:HTMLElement){
  node.innerHTML='<h1>Rating history</h1><form class="tools"><label>Pool <select name="pool"><option>Bullet</option><option selected>Blitz</option><option>Rapid</option><option>Daily</option></select></label>'+
    '<label>Period <select name="period"><option value="7">7 days</option><option value="30">30 days</option><option value="90" selected>90 days</option><option value="365">1 year</option><option value="0">All time</option></select></label></form><div data-rating-stats></div>'
  const form=node.querySelector('form')!
  const output=node.querySelector<HTMLElement>('[data-rating-stats]')!
  let request=0
  const refresh=async()=>{
    const version=++request
    const fields=new FormData(form)
    const group=String(fields.get('pool'))
    const days=Number(fields.get('period'))
    const since=days?Date.now()-days*86400_000:0
    output.textContent='Loading ratings…'
    try{
      const events:RatingEvent[]=[]
      let before:string|null=null
      let current:Rating|undefined
      let baseline:{rating:Rating;recorded:number}|undefined
      do{
        const page:{rating?:Rating;baseline?:{rating:Rating;recorded:number};events:RatingEvent[];next:string|null}=await api('rating-history?pool='+group+(before?'&before='+before:''))
        if(version!==request||!node.isConnected)return
        current??=page.rating
        baseline??=page.baseline
        events.push(...page.events.filter(event=>event.time>=since))
        before=page.events.some(event=>event.time<since)?null:page.next
      }while(before)
      const count=countedGames(current)
      const title=establishedRating(current)??(count?'Predicted rating '+Math.round(current!.rating):'Unranked')
      output.innerHTML='<h2>'+title+'</h2>'
      if((baseline&&baseline.recorded>=since)||(!events.length&&current&&count)){
        const prior=baseline?.rating??current!
        output.insertAdjacentHTML('beforeend','<p>Earlier results carried forward · '+countedGames(prior)+' games at '+Math.round(prior.rating)+'. Detailed history begins with the new rating system.</p>')
      }
      if(!events.length){output.insertAdjacentHTML('beforeend','<p>No recorded rating changes in this period.</p>');return}
      const ordered=events.slice().reverse()
      const values=ordered.map(event=>Math.round(event.after.rating))
      const low=Math.min(...values)-20, high=Math.max(...values)+20
      const earliest=ordered[0].time, latest=ordered.at(-1)!.time
      const point=(value:number,i:number)=>[45+(values.length===1?257:515*(ordered[i].time-earliest)/Math.max(1,latest-earliest)),110-(value-low)*90/(high-low)]
      const plotted=values.map(point)

      const line=(points:number[][],dashed=false)=>'<polyline fill="none" stroke="currentColor" stroke-width="2" '+(dashed?'stroke-dasharray="5 5" ':'')+'points="'+points.map(p=>p.join(',')).join(' ')+'"/>'

      const total=events.reduce((n,e)=>n+e.score,0)
      const net=Math.round(ordered.at(-1)!.after.rating)-Math.round(ordered[0].before.rating)
      const average=Math.round(events.reduce((total,e)=>total+e.opponent,0)/events.length)
      const wins=events.filter(e=>e.score===1).length, draws=2*(total-wins)
      const bestWin=events.filter(e=>e.score===1).sort((a,b)=>b.opponent-a.opponent)[0]
      const peak=events.reduce<RatingEvent|undefined>((best,e)=>!best||e.after.rating>best.after.rating?e:best,undefined)
      output.insertAdjacentHTML('beforeend','<p>'+events.length+' games · '+wins+' wins · '+draws+' draws · '+(events.length-wins-draws)+' losses'+' · Net '+(net>0?'+':'')+net+' · Avg. opponent '+average+(bestWin?' · Best win '+Math.round(bestWin.opponent):'')+(peak?' · Peak '+Math.round(peak.after.rating)+' on '+new Date(peak.time).toLocaleDateString():'')+'</p>'+
        '<svg class="rating-chart" viewBox="0 0 575 125" role="img" aria-label="Rating history. The table gives exact values."><text x="4" y="25" fill="currentColor">'+high+'</text><text x="4" y="112" fill="currentColor">'+low+'</text>'+
        line(plotted)+
        (values.length===1?'<circle cx="'+plotted[0][0]+'" cy="'+plotted[0][1]+'" r="3" fill="currentColor"/>':'')+
        '</svg><div class="ratings-table"><table><thead><tr><th>Game</th><th>Result</th><th>Rating</th><th>Change</th></tr></thead><tbody>'+
        events.map(e=>'<tr><td><a href="/?game='+safe(e.id)+'">'+new Date(e.time).toLocaleDateString()+'</a></td><td>'+(e.score===1?'Win':e.score===0?'Loss':'Draw')+'</td><td>'+Math.round(e.after.rating)+'</td><td>'+ratingDelta(e.before,e.after)+'</td></tr>').join('')+
        '</tbody></table></div>')
    }catch{if(version===request)output.textContent='Rating history is unavailable. Try again.'}
  }
  form.onchange=()=>void refresh()
  await refresh()
}
async function account(which:string){
  const user=await login()
  if(!user.account&&['profile','friends','admin','stats'].includes(which)){
    if(!$('#modal'))render()
    signIn()
    return
  }
  parkGame();void cancel();mode='account';accountTab=which;myProfile=null;lastFriends='';render();window.scrollTo(0,0)
  const node=$('#account')!
  history.replaceState({},'', ['profile','friends','admin','stats','watch','leaders','distribution'].includes(which)?'/#'+which:'/')
  if(which==='watch'){
    const games=await api<{id:string;white:string;black:string;control:Control;rated:boolean}[]>('watch')
    if(node.isConnected)node.innerHTML='<h1>Watch live games</h1>'+
      (games.length?'<ul class="watch-list">'+games.map(g=>'<li><a href="/?game='+safe(g.id)+'"><span class="watch-match">'+safe(g.white)+' vs '+safe(g.black)+'</span><small>'+clockLabel(g.control)+(g.rated?' · Rated':'')+'</small></a></li>').join('')+'</ul>':'<p>No public games are in progress.</p>')+
      (user.account?'<p class="watch-archive">Find your completed ranked games in <a href="/#stats">Rating history</a>.</p>':'')
  }else if(which==='distribution'){
    await openDistribution(node)
  }else if(which==='stats'){
    await openRatingStats(node)
  }else if(which==='leaders'){
    const records=await api<Record<string,{name:string;rating:number}[]>>('leaders')
    if(node.isConnected)node.innerHTML='<h1>Leaderboard</h1>'+button('distribution','Rating distribution')+button('stats','My rating history')+Object.entries(records).map(([group,rows])=>'<h2>'+safe(group)+'</h2>'+(rows.length?'<ol>'+rows.map(p=>'<li>'+safe(p.name)+' · '+p.rating+'</li>').join('')+'</ol>':'<p>No established ratings yet.</p>')).join('')
  }else if(which==='friends'){
    const list=await api<FriendList>('friends')
    if(node.isConnected){lastFriends=JSON.stringify(list);node.innerHTML=friendsView(list)}
  }else if(which==='admin'){
    node.innerHTML='<h1>Admin · Users</h1>'
    if(!user.admin){
      node.insertAdjacentHTML('beforeend','<p>Administrator access is required.</p>')
      return
    }
    node.insertAdjacentHTML('afterbegin','<nav class="social-nav" aria-label="Account"><a href="/#profile" data-do="profile">Profile</a><a href="/#admin" aria-current="page">Users</a></nav>')
    node.insertAdjacentHTML('beforeend','<section class="admin-internal" hidden><h2>Owner &amp; friends</h2><ul class="admin-users"></ul></section><form id="admin-search" class="friend-search"><label for="admin-query">Find by username</label><div><input id="admin-query" name="query" type="search" autocomplete="off" maxlength="39" placeholder="Username starts with"><button class="primary">Search</button></div></form><p id="admin-status" role="status"></p><ul id="admin-players" class="admin-users" aria-label="Players"></ul><button id="admin-more" data-do="admin-more" hidden>Load more users</button>')
    const options=(preferred:string)=>scientistBots.filter(bot=>bot.elo<=maxScientistElo).map(bot=>
      '<option value="'+bot.id+'" '+(bot.id===preferred?'selected':'')+'>'+safe(bot.name)+' · '+bot.elo+' Elo</option>'
    ).join('')
    node.insertAdjacentHTML('beforeend','<section class="admin-exhibition"><h2>Bot vs Bot</h2><form id="admin-bot-game"><div class="bot-lab-options"><label>White <select name="white">'+options('einstein')+'</select></label>'+
      '<label>Black <select name="black">'+options('newton')+'</select></label><label>Clock <select name="clock">'+
      practiceClocks.map((control,i)=>'<option value="'+i+'" '+(i===3?'selected':'')+'>'+clockLabel(control)+'</option>').join('')+
      '</select></label></div><button class="primary">Watch match</button><p role="status" id="exhibition-status"></p></form></section>')
    await loadAdminUsers(node)
  }else{
    const profile=await api<ProfilePage>('profile')
    if(node.isConnected){
      myProfile=profile
      node.innerHTML=profileView(profile,user.emailReady&&!user.emailLinked,user.admin,user.emailReady&&user.emailLinked)
    }
  }
}
const signUpMethods={passkey:'Passkey',email:'Email',github:'GitHub'}
const signUpDate=new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'})
async function loadAdminUsers(node:HTMLElement,query='',after=''){
  if(node.dataset.loading)return
  const notice=node.querySelector<HTMLElement>('#admin-status')!
  const list=node.querySelector<HTMLElement>('#admin-players')!
  const more=node.querySelector<HTMLButtonElement>('#admin-more')!
  const search=node.querySelector<HTMLButtonElement>('#admin-search button')!
  node.dataset.loading='true'
  search.disabled=more.disabled=true
  notice.textContent='Loading users…'
  try{
    const params=new URLSearchParams({q:query,after})
    const page=await api<AdminUsers>('admin/users?'+params)
    if(!node.isConnected)return
    const row=(user:AdminUsers['users'][number])=>{
      const date=user.createdAt===undefined?'Signup date unavailable':signUpDate.format(user.createdAt)
      return '<li><div><b>@'+safe(user.handle)+'</b>'+(user.admin?' <small>Admin</small>':'')+(user.playerNumber===undefined?'':'<small class="profile-number">#'+user.playerNumber+'</small>')+(user.displayName?'<small>'+safe(user.displayName)+'</small>':'')+(user.country?'<small>'+flag(user.country)+'</small>':'')+'</div>'+
        '<div>'+signUpMethods[user.registeredWith]+(user.registeredWith!=='email'&&user.emailLinked?' · Email linked':'')+'<small>'+safe(date)+'</small></div>'+
        '<div><b>'+user.gamesPlayed.toLocaleString()+(user.totalIsMinimum?'+':'')+'</b> online games<small>'+user.ratedGames.toLocaleString()+' rated</small></div></li>'
    }
    if(!after){
      list.replaceChildren()
      const internal=node.querySelector<HTMLElement>('.admin-internal')!
      internal.querySelector('ul')!.innerHTML=page.internal.map(row).join('')
      internal.hidden=page.internal.length===0
    }
    list.insertAdjacentHTML('beforeend',page.users.map(row).join(''))
    more.dataset.query=query
    more.dataset.cursor=page.next??''
    more.hidden=!page.next
    const shown=list.childElementCount
    notice.textContent=shown?shown+(shown===1?' player shown':' players shown'):query?'No matching users.':'No registered users yet.'
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
      $('#account')!.innerHTML=profileView(saved,Boolean(session?.emailReady&&!session.emailLinked),session?.admin,Boolean(session?.emailReady&&session.emailLinked))+'<p role="status">Profile saved.</p>'
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
  if(!validHandle(query)&&!validPlayerNumber(query)){message.textContent='Enter a username or an ID like #12.';return}
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
    case 'home':if((mode==='home'||mode==='account'||mode==='bot-picker')&&canResume())await resumeGame();else goHome();return
    case 'resume-game':await resumeGame();return
    case 'live-tab':playTab='live';history.replaceState({},'','/');render();return
    case 'daily-tab':await openDaily();return
    case 'daily-find':await dailyAction('find');return
    case 'daily-invite':await dailyAction('invite');return
    case 'daily-cancel':await dailyAction('cancel');return
    case 'rules':modal('<h2>How to play</h2>'+rulesText(mode==='home'||mode==='account'?undefined:m?.game.rulesVersion)+button('tutorial','Try the tutorial','primary'));return
    case 'about':modal('<h2>About & privacy</h2><p>Remorse Chess uses cookies to keep your online seat. Game links can be viewed by anyone with the link. Ranked accounts store your player name, passkey public key or verified email record, rating and game history. Signed-in players can see your profile details, and accepted friends can see when you are online. When enabled, the sponsor banner is provided by Adsterra and connects to its ad network.</p><p>The board uses engraved chess pieces and original pixel sprites. Game sounds are synthesized.</p><a href="https://github.com/LukasJT/remorsechess">Source & feedback</a>');return
    case 'settings':settings();return
    case 'quiet':prefs={...prefs,volume:0,blood:'off',shake:false,flash:false,motion:true};savePrefs();render();return
    case 'more':if(!queue)clocksDialog();return
    case 'quick-clock':if(!queue){flexible=!flexible;render();$('[data-do="quick-clock"]')?.focus({preventScroll:true})}return
    case 'distribution':case 'stats':case 'watch':case 'leaders':case 'profile':case 'friends':case 'admin':await account(action);return
    case 'admin-more':{
      const node=$('#account'),more=$('#admin-more')
      if(node&&more?.dataset.cursor)await loadAdminUsers(node,more.dataset.query,more.dataset.cursor)
      return
    }
    case 'edit-profile':if(myProfile)modal(profileEditor(myProfile),'profile-edit');return
    case 'private-profile':modal('<h2>This profile is private.</h2>');return
    case 'opponent-profile':if(id)showPlayer(await api<PlayerCard>('room/'+id+'/player'));return
    case 'logout':await api('auth/logout',{});location.assign('/');return
    case 'local':case 'tutorial':if(canResume())await resumeGame();else local(action);return
    case 'bot':openBotPicker();return
    case 'sign-in':signIn();return
    case 'email-sign-in':emailDialog('sign-in');return
    case 'email-signup':emailDialog('signup');return
    case 'email-reset':emailDialog('reset');return
    case 'email-confirm':await finishEmail();return
    case 'link-email':linkEmail();return
    case 'passkey-login':await passkey('login');return
    case 'passkey-signup':passkeySignup();return
    case 'restart':local(mode,m?.control,quickBot,mode==='bot'?practicePuzzle:undefined,playingScientist);return
    case 'result':showResult();return
    case 'review-result':
      review=Math.max(0,(m?.log.length??1)-1);selected=null;absolve=false;tab='Moves';render();return
    case 'queue':if(canResume())await resumeGame();else await search();return
    case 'game-details':$('#match-details')?.scrollIntoView({block:'start'});return
    case 'game-board':$('.game-board-area')?.scrollIntoView({block:'start'});return
    case 'queue-again':goHome();rated=true;await search();return
    case 'cancel':await cancel();return
    case 'friend':{
      if(canResume()){await resumeGame();return}
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
root.addEventListener('change',event=>{
  const field=event.target
  if(!(field instanceof HTMLSelectElement)||field.form?.id!=='bot-form')return
  if(field.name==='clock')pickerClock=Number(field.value)
  if(field.name==='color'){
    pickerColor=field.value as typeof pickerColor
    render()
    document.querySelector<HTMLElement>('#bot-form [name=color]')?.focus()
  }
})
root.addEventListener('input',event=>{
  const field=event.target
  if(field instanceof HTMLInputElement&&field.form?.id==='bot-form'&&field.name==='level'){
    pickerElo=field.valueAsNumber
    $('.scientist-selection p')!.textContent=pickerElo+' Elo'
  }
})
root.addEventListener('click',event=>{
  const tile=(event.target as Element).closest<HTMLButtonElement>('[data-scientist]')
  if(!tile||tile.disabled)return
  const id=tile.dataset.scientist
  pickedScientist=scientistBots.find(bot=>bot.id===id&&bot.elo<=maxScientistElo)
  render()
  if(pickedScientist)root.querySelector<HTMLElement>('[data-scientist="'+id+'"]')?.focus({preventScroll:true})
  else root.querySelector<HTMLElement>('#bot-form [name=level]')?.focus()
})
root.addEventListener('click',event=>{
  const el=(event.target as HTMLElement).closest<HTMLElement>('[data-do],[data-square],[data-control],[data-days],[data-tab],[data-promotion],[data-player],[data-friend-action]')
  if(!el)return
  if(el.dataset.do==='site-menu'){
    setSiteMenu(el.getAttribute('aria-expanded')!=='true')
    return
  }
  if(el.closest('#site-nav')&&root.classList.contains('site-menu-open')){
    setSiteMenu(false)
    $('#site-menu')?.focus()
  }
  if(el instanceof HTMLAnchorElement&&(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey))return
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
root.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&root.classList.contains('site-menu-open')){
    setSiteMenu(false)
    $('#site-menu')?.focus()
  }
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
  if(form.id==='password-login'){
    event.preventDefault()
    void passwordSignIn(form)
    return
  }
  if(form.id==='email-finish'){
    event.preventDefault()
    const data=new FormData(form)
    const name=data.get('handle')
    void finishEmail(typeof name==='string'?name:undefined,String(data.get('password')??''))
    return
  }
  if(form.id==='passkey-register'){
    event.preventDefault()
    void passkey('register',String(new FormData(form).get('handle')??''))
    return
  }
  if(form.id==='admin-bot-game'){
    event.preventDefault()
    if(!session?.admin)return
    if(canResume()){$('#exhibition-status')!.textContent='Finish your current game before starting an exhibition.';return}
    const data=new FormData(form)
    const white=scientistBots.find(bot=>bot.id===data.get('white')&&bot.elo<=maxScientistElo)
    const black=scientistBots.find(bot=>bot.id===data.get('black')&&bot.elo<=maxScientistElo)
    const control=practiceClocks[Number(data.get('clock'))]
    if(!white||!black||!control)return
    exhibition={white,black}
    local('bot-exhibition',control)
    return
  }
  if(form.id==='bot-form'){
    event.preventDefault()
    if(canResume()){void resumeGame();return}
    const data=new FormData(form)
    const control=practiceClocks[Number(data.get('clock'))]
    if(!control)return
    botAnchors=[300,900,maxScientistElo]
    selectedBotElo=pickedScientist?.elo??pickerElo
    difficulty=practiceLevels[botAnchors.findIndex(anchor=>anchor>=selectedBotElo)]
    const color=data.get('color')
    human=color==='random'?(Math.random()<.5?'white':'black'):color==='black'?'black':'white'
    practiceRating=null
    local('bot',control,false,undefined,pickedScientist)
    if(session?.account&&control.seconds){
      void api<ProfilePage>('profile').then(profile=>{
        if(mode==='bot'&&!quickBot&&m?.control===control){
          practiceRating=establishedRating(profile.ratings[pool(control.seconds,control.increment)])
          const label=$('[data-practice-rating]')
          if(label){label.textContent='('+ (practiceRating??'?') +')';label.setAttribute('title',practiceRating==null?'No established rating':pool(control.seconds,control.increment)+' rating')}
        }
      }).catch(()=>{})
    }
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
  const puzzleId=new URLSearchParams(location.search).get('practice-puzzle')
  const page=location.hash.slice(1)
  if(gameId&&/^[a-f0-9]{32}$/.test(gameId))void online(gameId).catch(e=>tell(e.message))
  else if(puzzleId!==null&&/^\d+$/.test(puzzleId)&&Number(puzzleId)<puzzleCount)local('bot',{seconds:0,increment:0},false,Number(puzzleId))
  else if(page==='bots')openBotPicker()
  else if(['profile','friends','admin','stats','watch','leaders','distribution'].includes(page))void account(page).catch(e=>$('#account')?.replaceChildren(e.message))
  else if(location.hash==='#daily')void openDaily().catch(e=>$('#daily-status')?.replaceChildren(e.message))
  else if(mode!=='home'||!root.hasChildNodes()){
    const guide=location.hash==='#how-to-play'
    goHome(guide)
    if(guide)requestAnimationFrame(()=>$('#how-to-play')?.scrollIntoView())
  }
}
window.addEventListener('popstate',route)
const link=new URLSearchParams(location.hash.slice(1)).get('email')
if(link&&/^[a-f0-9]{64}$/.test(link)){
  emailCode=link
  history.replaceState({},'',location.pathname+location.search)
  render()
  void emailRedeem()
}else route()
void login().then(async()=>{
  const room=stored<string>(savedRoom)
  if(mode==='home'&&room&&/^[a-f0-9]{32}$/.test(room)){
    const check=await api<{resumable:boolean}>('room/'+room+'/resume-status').catch(()=>null)
    if(check&&!check.resumable&&stored<string>(savedRoom)===room)remember(savedRoom,null)
  }
  if(mode==='home'&&!queue&&!$<HTMLDialogElement>('#modal')?.open)render()
}).catch(()=>{})
window.setInterval(()=>{
  const count=$('#online-count')
  if(count)count.textContent=activityLabel()
},30000)

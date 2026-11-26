import {puzzleAt,puzzleCount} from './puzzle-book.ts'
import {dailyThinkTime,queueHandle,thinkTime} from './queue-opponent.ts'
import { DurableObject } from 'cloudflare:workers'
import { command, compatibleClock, dailyControl, dailyDays, end, expire, makeMatch, quickClock, remaining, type Command, type Control, type DailyGame, type DailyLobby, type Entry, type Match, type SearchClock } from './match.ts'
import { botRating, dailyRatedBotGames, countedGames, establishedRating, placementPrior, pool, ratingDelta, updateBotRating, updateRating, type Rating, type RatingImpact, type RatingEvent } from './rating.ts'
import { CURRENT_RULES,type Side } from './rules.ts'
import { chooseMove } from './bot.ts'
import { accountName, authentication, canUsePasskeys, registration, verifyExisting, verifyNew, type Ceremony, type Passkey } from './passkeys.ts'
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server'
import { digest, minPasswordLength, normalizeEmail, sendSignIn, type EmailPurpose, type EmailRequest } from './email.ts'
import { hashPassword, matchesPassword, validPassword, type PasswordRecord } from './password.ts'
import { emptyDetails,maxProfileBody,parseProfileEdit,validHandle,validPlayerNumber,type FriendAction,type FriendList,type FriendStatus,type PlayerCard,type ProfileDetails,type ProfileEdit } from './social.ts'
import type { AdminUser, AdminUsers } from './admin.ts'

type Limit = {limit(input:{key:string}):Promise<{success:boolean}>}
interface Env { EMAIL_LIMIT:Limit; GAME_LIMIT:Limit; WRITE_LIMIT:Limit; ASSETS:Fetcher; ROOMS:DurableObjectNamespace<Room>; LOBBY:DurableObjectNamespace<Lobby>; GITHUB_CLIENT_ID?:string; GITHUB_CLIENT_SECRET?:string; RESEND_API_KEY?:string; ADMIN_EMAIL?:string }
type Identity = { id:string; name:string; account:boolean }
const qaHandles=new Set(['qa-a-0823ec19','qa-a-09ee2116','qa-b-0823ec19','qa-b-09ee2116'])
const privateHandles=new Set(['test','natalie','lukas','evan'])
const isQaAccount=(id:string,name:string)=>id.startsWith('passkey:')&&qaHandles.has(name.toLowerCase())
const excludeFromPlayerCount=(id:string,name:string)=>isQaAccount(id,name)||(!id.startsWith('guest:')&&privateHandles.has(name.toLowerCase()))
type Seats = Partial<Record<Side,Identity>>
type RoomInfo = { id:string; control:Control; seats:Seats; rated:boolean; created:number; open:boolean; ratings?:Partial<Record<Side,Rating>>; invited?:string; bot?:Side; queueSearch?:string; queueSearches?:Partial<Record<Side,string>>; ratingModel?:1 }
type Ticket = { owner:Identity; id:string; expires:number; clock:SearchClock; created:number; searchId?:string; cancelled?:boolean; bot?:Control }
type DailyTicket = { owner:Identity; id:string; days:number; created:number; requestId:string; matched?:boolean }
type PublicGame = { id:string; white:string; black:string; control:Control; rated:boolean }
type Profile = { gameTotal?:{count:number;minimum:boolean}; user:Identity; ratings:Record<string,Rating>; history:{id:string; result:string; pool:string; delta?:number}[] }
type FriendLink={handle:string;status:FriendStatus}
function completedGames(profile:Profile|undefined){
  const ratedGames=Object.values(profile?.ratings??{}).reduce((sum,rating)=>sum+countedGames(rating),0)
  if(profile?.gameTotal)return {...profile.gameTotal,ratedGames}
  const history=profile?.history??[]
  const unrated=new Set(history.filter(game=>game.delta===undefined).map(game=>game.id)).size
  const ratedInHistory=new Set(history.filter(game=>game.delta!==undefined).map(game=>game.id)).size
  return {count:unrated+Math.max(ratedGames,ratedInHistory),minimum:history.length>=100||ratedGames>ratedInHistory,ratedGames}
}
const testAdminSignupCutoff=Date.parse('2026-11-24T16:22:00Z')
type Final = { room:RoomInfo; reason:string; winner:Side|null; rules?:number }
const json = (value:unknown,status=200) => Response.json(value,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}})
const problem = (error:string,status=400) => json({error},status)
const token = () => crypto.randomUUID().replaceAll('-','')
const cookie = (req:Request,name:string) => req.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1)
const setCookie = (req:Request,name:string,value:string,maxAge:number) => name+'='+value+'; Path=/; HttpOnly; SameSite=Lax; Max-Age='+maxAge+(new URL(req.url).protocol==='https:'?'; Secure':'')
const lobby = (env:Env) => env.LOBBY.getByName('global-v1')
const room = (env:Env,id:string) => env.ROOMS.getByName(id)
const oppositeSeat=(s:Side):Side=>s==='white'?'black':'white'
const liveSearchLease=12_000
const botWait=(rated:boolean)=>rated?20_000:8_000
const botUsageKey=(player:string)=>'rated-bot/'+player
const dailyBotWait=5*60_000
const dailyFallbackPrefix='daily-fallback/'
const dailyLifetime=14*86_400_000
const dailyRoomKey=(player:string,id:string)=>'daily-room/'+player+'/'+id
const friendKey=(player:string,other:string)=>'friend/'+player+'/'+other
const blockedKeys=(player:string,other:string)=>['block/'+player+'/'+other,'block/'+other+'/'+player]
const detailsKey=(player:string)=>'profile-details/'+player
const photoKey=(player:string)=>'profile-photo/'+player
const createdKey=(player:string)=>'account-created/'+player
const emailOwnerKey=(player:string)=>'email-owner/'+player
const seatOf = (info:RoomInfo,player:Identity):Side|null => info.seats.white?.id===player.id?'white':info.seats.black?.id===player.id?'black':null
const ratingPool=(control:Control)=>control.days?'Daily':control.seconds?pool(control.seconds,control.increment):null
const ratedSnapshot=(rating?:Rating)=>rating??placementPrior()
const historyKey=(player:string,group:string)=>'rating-event/'+player+'/'+group+'/'
const ratingAfter=(info:RoomInfo,player:Rating,opponent:Rating,score:number,now:number)=>
  info.bot?updateBotRating(player,opponent,score,now):updateRating(player,opponent,score,now)
function estimateRatingImpact(info:RoomInfo,seat:Side):RatingImpact|undefined{
  const player=info.ratings?.[seat],opponent=info.ratings?.[oppositeSeat(seat)]
  if(!info.rated||!player||!opponent||seat===info.bot)return
  const change=(score:number)=>ratingDelta(player,ratingAfter(info,player,opponent,score,info.created))
  return {win:change(1),draw:change(0.5),loss:change(0)}
}
function parseControl(raw:Partial<Control>): Control|null {
  const {seconds,increment}=raw
  return typeof seconds==='number' && typeof increment==='number' && Number.isInteger(seconds) && Number.isInteger(increment) &&
    seconds>=0 && seconds<=21600 && increment>=0 && increment<=180 && (seconds>0 || increment===0) ? {seconds,increment} : null
}
function parseAction(raw:unknown):Command|null {
  if (!raw || typeof raw!=='object' || !('type' in raw)) return null
  const a=raw as Record<string,unknown>
  if (['end','resign','offer','accept','decline'].includes(String(a.type))) return {type:a.type} as Command
  if ((a.type!=='move' && a.type!=='absolve') || !Number.isInteger(a.from) || !Number.isInteger(a.to)) return null
  if (a.type==='absolve') return {type:'absolve',from:Number(a.from),to:Number(a.to)}
  if(a.promotion!==undefined && !['q','r','b','n'].includes(String(a.promotion))) return null
  return {type:'move',from:Number(a.from),to:Number(a.to),promotion:a.promotion} as Command
}

export class Room extends DurableObject<Env> {
  async opponentAccount(player:string){
    const info=await this.ctx.storage.get<RoomInfo>('room')
    if(!info||info.bot)return
    const other=info.seats.white?.id===player?info.seats.black:info.seats.black?.id===player?info.seats.white:undefined
    if(other?.account)return other
  }
  async isOpenFor(playerID:string){
    const info=await this.ctx.storage.get<RoomInfo>('room')
    const match=await this.ctx.storage.get<Match>('match')
    return Boolean(info&&match&&!expire(match,Date.now()).game.result&&Object.values(info.seats).some(p=>p.id===playerID))
  }
  async initialize(info:RoomInfo) {
    await this.ctx.blockConcurrencyWhile(async()=>{
      if(await this.ctx.storage.get('room')) return
      const match=makeMatch(info.control,(!info.bot||info.control.days)&&info.seats.black&&info.seats.white?Date.now():0)
      await this.ctx.storage.put({room:info,match})
      await this.schedule(info,match)
    })
  }
  async cancelUnplayedQueue(player:Identity,searchId:string){
    return this.ctx.blockConcurrencyWhile(async()=>{
      const info=await this.ctx.storage.get<RoomInfo>('room')
      const match=await this.ctx.storage.get<Match>('match')
      if(!info||!match||match.game.result||info.control.days)return false
      const seat=seatOf(info,player)
      if(!seat||(info.queueSearches?.[seat]??(info.bot?info.queueSearch:undefined))!==searchId)return false
      if((await this.ctx.storage.list<Entry>({prefix:'event/',limit:1})).size)return false
      await this.save({...info,open:false},end(match,{winner:null,reason:'Game cancelled'},Date.now()))
      return true
    })
  }
  async dailyGame(player:string):Promise<DailyGame|undefined>{
    const info=await this.ctx.storage.get<RoomInfo>('room')
    const match=await this.ctx.storage.get<Match>('match')
    if(!info?.control.days||!match||expire(match,Date.now()).game.result)return
    const side=info.seats.white?.id===player?'white':info.seats.black?.id===player?'black':null
    if(!side||(!match.start&&info.created+dailyLifetime<=Date.now()))return
    return {id:info.id,days:info.control.days,opponent:info.seats[oppositeSeat(side)]?.name,
      waiting:!match.start,turn:Boolean(match.start&&match.game.side===side),
      deadline:match.start?match.start+match.clock[match.game.side]:undefined}
  }
  private async snapshot(player?:Identity) {
    const info=await this.ctx.storage.get<RoomInfo>('room')
    const match=await this.ctx.storage.get<Match>('match')
    if(!info || !match) return
    const {seats,invited,queueSearch,queueSearches,ratings,ratingModel,...visible}=info
    const group=ratingPool(info.control)
    const nameplates:Partial<Record<Side,number|null>>={}
    const casualKey='nameplates/'+(seats.white?.id??'-')+'/'+(seats.black?.id??'-')
    const cached=!ratings&&group?await this.ctx.storage.get<typeof nameplates>(casualKey):undefined
    if(!cached){
      for(const side of ['white','black'] as const){
        const owner=seats[side]
        if(owner)nameplates[side]=side===info.bot?Math.round(ratings?.[side]?.rating??botRating.rating):
          establishedRating(ratings?.[side]??(group&&owner.account?(await lobby(this.env).profile(owner)).ratings[group]:undefined))
      }
      if(!ratings&&group&&seats.white&&seats.black)await this.ctx.storage.put(casualKey,nameplates)
    }
    const countryKey='countries/'+casualKey
    let countries=await this.ctx.storage.get<Partial<Record<Side,string>>>(countryKey)
    if(!countries){
      countries={}
      for(const side of ['white','black'] as const){
        const owner=seats[side]
        if(owner?.account)countries[side]=(await lobby(this.env).profilePage(owner)).details.country
      }
      await this.ctx.storage.put(countryKey,countries)
    }
    const log=[...(await this.ctx.storage.list<Entry>({prefix:'event/'})).values()]
    const seat=player?seatOf(info,player):null
    const ratingImpact=seat&&match.start&&!match.game.result?estimateRatingImpact(info,seat):undefined
    return {room:{...visible,countries,nameplates:cached??nameplates,ratingPool:group,white:seats.white?.name,black:seats.black?.name,
      whiteAccount:seats.white?.account,blackAccount:seats.black?.account},seat,ratingImpact,
      match:{...match,game:{...match.game,seen:{}},log},now:Date.now()}
  }
  private clockDeadline(m:Match){
    return m.start+(m.control.seconds?m.clock[m.game.side]:24*60*60_000)
  }
  private botDeadline(m:Match){
    return m.start+(m.control.days?dailyThinkTime(m):thinkTime(m,m.clock[m.game.side],()=>((m.start%997)/997)))
  }
  private nextAlarm(info:RoomInfo,m:Match,disconnects:Partial<Record<Side,number>>={}){
    if(m.game.result)return Date.now()+250
    if(!m.start)return info.created+(info.control.days?dailyLifetime:30*60_000)
    const bot=info.bot===m.game.side?this.botDeadline(m):Infinity
    return Math.min(this.clockDeadline(m),bot,disconnects.white??Infinity,disconnects.black??Infinity)
  }
  private async deadlines(){
    return await this.ctx.storage.get<Partial<Record<Side,number>>>('disconnect-deadlines')??{}
  }
  private async schedule(info:RoomInfo,m:Match){
    await this.ctx.storage.setAlarm(this.nextAlarm(info,m,await this.deadlines()))
  }
  private async expired(m:Match,now:number){
    if(!m.start||m.game.result)return m
    const disconnected=await this.deadlines()
    const white=disconnected.white??Infinity,black=disconnected.black??Infinity
    const deadline=Math.min(white,black)
    if(deadline<=now&&deadline<this.clockDeadline(m))
      return end(m,{winner:white===black?null:white<black?'black':'white',reason:'Disconnected'},deadline)
    return expire(m,now)
  }
  async webSocketClose(ws:WebSocket){
    const side=this.ctx.getTags(ws)[0] as Side|undefined
    if(ws.readyState!==WebSocket.CLOSED)ws.close()
    if(side!=='white'&&side!=='black')return
    await this.ctx.blockConcurrencyWhile(async()=>{
      if(this.ctx.getWebSockets(side).some(other=>other!==ws&&other.readyState===WebSocket.OPEN))return
      const info=await this.ctx.storage.get<RoomInfo>('room')
      const match=await this.ctx.storage.get<Match>('match')
      if(!info||!match?.start||match.game.result||info.control.days)return
      const deadlines=await this.deadlines()
      deadlines[side]??=Date.now()+60_000
      await this.ctx.storage.put('disconnect-deadlines',deadlines)
      await this.schedule(info,match)
    })
  }
  async webSocketError(ws:WebSocket){await this.webSocketClose(ws)}
  private async save(info:RoomInfo,match:Match,receipt?:{seat:Side;ids:string[]}) {
    const newEvent=match.log.at(-1)
    const stored={...match,log:[]}
    await this.ctx.storage.transaction(async txn=>{
      await txn.put({room:info,match:stored})
      if(receipt) await txn.put('commands/'+receipt.seat,receipt.ids)
      if(newEvent) await txn.put('event/'+String(match.version).padStart(8,'0'),newEvent)
      if(match.game.result) await txn.put<Final>('pending',{room:info,...match.game.result,rules:match.game.rulesVersion})
      await txn.setAlarm(this.nextAlarm(info,match,await txn.get<Partial<Record<Side,number>>>('disconnect-deadlines')))
    })
    const update=JSON.stringify({version:match.version})
    for(const ws of this.ctx.getWebSockets()) {
      try { ws.send(update) } catch { ws.close(1011,'Reconnect') }
    }
  }
  async fetch(req:Request) {
    const player=JSON.parse(req.headers.get('x-remorse-player') ?? 'null') as Identity|null
    if(!player) return problem('Session required',401)
    const action=new URL(req.url).pathname.split('/').at(-1)
    const data=req.method==='POST'?await req.json<Record<string,unknown>>():{}
    return this.ctx.blockConcurrencyWhile(async()=>{
      const info=await this.ctx.storage.get<RoomInfo>('room')
      let match=await this.ctx.storage.get<Match>('match')
      if(!info||!match)return action==='resume-status'||action==='cancel-unplayed'?json({resumable:false}):problem('Room not found',404)
      const seat=seatOf(info,player)
      if(action==='resume-status'||action==='cancel-unplayed'){
        if(!seat||info.control.days)return json({resumable:false})
        const first=[...(await this.ctx.storage.list<Entry>({prefix:'event/',limit:1})).values()][0]
        if(first?.event)return json({resumable:true})
        if(action==='cancel-unplayed'&&!match.game.result){
          await this.save({...info,open:false},end(match,{winner:null,reason:'Game cancelled'},Date.now()))
        }
        return json({resumable:false})
      }
      if(info.control.days&&!match.start&&!match.game.result&&info.created+dailyLifetime<=Date.now())
        return problem('This Daily invitation expired',410)
      const timed=await this.expired(match,Date.now())
      if(timed!==match){ await this.save(info,timed); match=timed }
      if(action==='snapshot'&&info.bot&&seat&&!match.start&&!match.game.result){
        match={...match,start:Date.now(),version:match.version+1}
        await this.save(info,match)
      }
      if(action==='ws' && req.headers.get('Upgrade')?.toLowerCase()==='websocket'){
        if(this.ctx.getWebSockets().length>=100) return problem('Spectator limit reached',503)
        const pair=new WebSocketPair()
        const liveSeat=seat&&seat!==info.bot&&!info.control.days?seat:null
        this.ctx.acceptWebSocket(pair[1],liveSeat?[liveSeat]:[])
        if(liveSeat&&!match.game.result){
          const deadlines=await this.deadlines()
          if(deadlines[liveSeat]){
            delete deadlines[liveSeat]
            await this.ctx.storage.put('disconnect-deadlines',deadlines)
            await this.schedule(info,match)
          }
        }
        pair[1].send(JSON.stringify({version:match.version}))
        return new Response(null,{status:101,webSocket:pair[0]})
      }
      if(action==='join' && req.method==='POST'){
        if(info.control.days&&!player.account)return problem('Sign in to join this Daily game',401)
        if(!seat && info.open && (!info.seats.black || !info.seats.white) && !match.start && (!info.invited || info.invited===player.id)){
          info.seats[info.seats.white?'black':'white']=player
          info.open=false
          await this.save(info,{...match,start:Date.now(),version:match.version+1})
        } else if(!seat) return problem('Both seats are taken',409)
      } else if(action==='report' && req.method==='POST'){
        if(info.bot)return problem('This opponent is a bot',409)
        const other=seat&&info.seats[oppositeSeat(seat)]
        if(!player.account||!other) return problem('A signed-in player can report an opponent',403)
        const reason=data.reason
        if(!['cheating','harassment','stalling','other'].includes(String(reason))) return problem('Choose a report reason')
        const reportKey='report/'+player.id
        if(!await this.ctx.storage.get(reportKey)){
          const reference=token()
          await this.ctx.storage.put(reportKey,{reference,from:player.id,against:other.id,reason,created:Date.now()})
          console.warn('Player report received',{room:info.id,reference,category:reason})
        }
        return json({reported:true})
      } else if(action==='block' && req.method==='POST'){
        if(info.bot)return problem('This opponent is a bot',409)
        const other=seat&&info.seats[oppositeSeat(seat)]
        if(!player.account||!other?.account) return problem('Both players must have accounts',403)
        await lobby(this.env).block(player.id,other.id)
        return json({blocked:true})
      } else if(action==='rematch' && req.method==='POST'){
        if(info.bot || info.control.days || !seat || !match.game.result || !info.seats.white || !info.seats.black) return problem('Rematch is unavailable',409)
        const existing=await this.ctx.storage.get<string>('rematch')
        if(existing) return json({id:existing})
        const nextId=token()
        const other=info.seats[oppositeSeat(seat)]!
        const nextSeats:Seats=seat==='black'?{white:player}:{black:player}
        await room(this.env,nextId).initialize({id:nextId,control:info.control,seats:nextSeats,rated:false,created:Date.now(),open:true,invited:other.id})
        await this.ctx.storage.put('rematch',nextId)
        return json({id:nextId})
      } else if(action==='command' && req.method==='POST'){
        if(!seat) return problem('Spectators cannot play moves',403)
        const id=data.id
        if(typeof id!=='string' || !/^[a-f0-9-]{36}$/.test(id)) return problem('Invalid command ID')
        const last=await this.ctx.storage.get<string[]>('commands/'+seat) ?? []
        if(last.includes(id)) return json(await this.snapshot(player))
        if(data.version!==match.version) return problem('Position changed. Sync and retry.',409)
        const parsed=parseAction(data.action)
        if(info.bot&&parsed&&['offer','accept','decline'].includes(parsed.type))return problem('Draw offers are unavailable against a bot',422)
        const next=parsed && command(match,seat,parsed,Date.now())
        if(!next) return problem('That action is unavailable',422)
        await this.save(info,next,{seat,ids:[...last.slice(-63),id]})
      }
      return json(await this.snapshot(player))
    })
  }
  webSocketMessage(ws:WebSocket) { ws.close(1008,'Receive-only connection') }
  async alarm(){
    let final:Final|undefined
    await this.ctx.blockConcurrencyWhile(async()=>{
      const info=await this.ctx.storage.get<RoomInfo>('room')
      const match=await this.ctx.storage.get<Match>('match')
      if(!info || !match) return
      if(!match.start && !match.game.result){
        await this.ctx.storage.deleteAll()
        return
      }
      if(!match.game.result){
        const timed=await this.expired(match,Date.now())
        if(timed!==match) await this.save(info,timed)
        else if(info.bot===match.game.side&&Date.now()>=this.botDeadline(match)){
          const time=remaining(match,info.bot,Date.now())
          const action=chooseMove(match.game,time<500?'rookie':time<2500?'tactical':'ranked')
          const moved=action&&command(match,info.bot,action,Date.now())
          if(!moved)throw Error('Ranked bot could not play in an active position')
          await this.save(info,moved)
        }
        else if(!match.control.seconds&&Date.now()>=this.clockDeadline(match)) await this.save(info,{...match,game:{...match.game,result:{winner:null,reason:'Inactive room expired'}},start:0,version:match.version+1})
        else await this.schedule(info,match)
      }
      final=await this.ctx.storage.get<Final>('pending')
    })
    if(final){
      await lobby(this.env).finish(final)
      await this.ctx.storage.delete('pending')
    }
  }
}

export class Lobby extends DurableObject<Env> {
  async fetch(req:Request){
    const identity=req.headers.get('x-remorse-presence')
    if(!identity||req.headers.get('upgrade')?.toLowerCase()!=='websocket')return problem('WebSocket required',426)
    const pair=new WebSocketPair()
    const tags=req.headers.get('x-remorse-exclude-count')==='1'?[identity,'exclude-count']:[identity]
    this.ctx.acceptWebSocket(pair[1],tags)
    pair[1].send(JSON.stringify({online:this.onlinePlayers()}))
    await this.schedulePresence()
    return new Response(null,{status:101,webSocket:pair[0]})
  }
  private presenceSockets(){
    return this.ctx.getWebSockets().filter(socket=>socket.readyState===WebSocket.OPEN)
  }
  private onlinePlayers(sockets=this.presenceSockets()){
    return new Set(sockets.map(socket=>this.ctx.getTags(socket)).filter(tags=>!tags.includes('exclude-count')).map(tags=>tags[0])).size
  }
  private async schedulePresence(){
    if(await this.ctx.storage.getAlarm()===null)await this.ctx.storage.setAlarm(Date.now()+1000)
  }
  async alarm(){
    const sockets=this.presenceSockets()
    const update=JSON.stringify({online:this.onlinePlayers(sockets)})
    for(const socket of sockets){
      try{socket.send(update)}catch{socket.close(1011,'Reconnect')}
    }
    const pending=await this.ctx.storage.list<{player:string;requestId:string;due:number}>({prefix:dailyFallbackPrefix,limit:30})
    for(const [key,entry] of pending){
      if(entry.due>Date.now()){await this.scheduleDailyFallback(entry.due);break}
      const ticket=await this.ctx.storage.get<DailyTicket>('daily-search/'+entry.player)
      if(ticket&&!ticket.matched&&ticket.requestId===entry.requestId&&ticket.created+dailyLifetime>Date.now())
        await this.dailySearch(ticket.owner,ticket.days,ticket.requestId,false,true)
      await this.ctx.storage.delete(key)
    }
    const next=[...(await this.ctx.storage.list<{due:number}>({prefix:dailyFallbackPrefix,limit:1})).values()][0]
    if(next)await this.scheduleDailyFallback(next.due)
  }
  private async scheduleDailyFallback(due:number){
    const current=await this.ctx.storage.getAlarm()
    if(current===null||current<=Date.now()||due<current)
      await this.ctx.storage.setAlarm(Math.max(Date.now()+100,due))
  }
  webSocketMessage(ws:WebSocket){ws.close(1008,'Receive-only connection')}
  async webSocketClose(ws:WebSocket){
    if(ws.readyState!==WebSocket.CLOSED)ws.close()
    await this.schedulePresence()
  }
  async webSocketError(ws:WebSocket){await this.webSocketClose(ws)}
  async registerDaily(player:string,id:string){
    await this.ctx.storage.put(dailyRoomKey(player,id),id)
  }
  async daily(player:string):Promise<DailyLobby>{
    let request=await this.ctx.storage.get<DailyTicket>('daily-search/'+player)
    if(request&&!request.matched&&request.created+dailyBotWait<=Date.now()&&request.created+dailyLifetime>Date.now()){
      await this.dailySearch(request.owner,request.days,request.requestId,false,true)
      request=await this.ctx.storage.get<DailyTicket>('daily-search/'+player)
    }
    const keys=[...(await this.ctx.storage.list<string>({prefix:'daily-room/'+player+'/'})).values()]
    const games:DailyGame[]=[]
    const expired:string[]=[]
    for(let i=0;i<keys.length;i+=5){
      const batch=keys.slice(i,i+5)
      const states=await Promise.all(batch.map(id=>room(this.env,id).dailyGame(player)))
      states.forEach((game,j)=>{if(game)games.push(game);else expired.push(dailyRoomKey(player,batch[j]))})
    }
    for(let i=0;i<expired.length;i+=128)await this.ctx.storage.delete(expired.slice(i,i+128))
    games.sort((a,b)=>Number(b.turn)-Number(a.turn)||(a.deadline??Infinity)-(b.deadline??Infinity))
    return {games,queued:request&&!request.matched&&request.created+dailyLifetime>Date.now()?request.days:null}
  }
  async dailyInvite(player:Identity,days:number){
    const id=token()
    await room(this.env,id).initialize({id,control:dailyControl(days),seats:{white:player},rated:false,created:Date.now(),open:true})
    await this.registerDaily(player.id,id)
    return {id}
  }
  async dailySearch(player:Identity,days:number,requestId:string,cancel=false,fallback=false){
    return this.ctx.blockConcurrencyWhile(async()=>{
      const prefix='daily-search/'
      const key=prefix+player.id
      if(cancel){await this.ctx.storage.delete(key);return {}}
      const now=Date.now()
      const mine=await this.ctx.storage.get<DailyTicket>(key)
      if(mine?.matched&&mine.requestId===requestId)return {id:mine.id}
      if(fallback&&(!mine||mine.requestId!==requestId||mine.created+dailyLifetime<=now))return {}
      const queue=await this.ctx.storage.list<DailyTicket>({prefix})
      const expired:string[]=[]
      const candidates:[string,DailyTicket][]=[]
      for(const [other,ticket] of queue){
        if(ticket.created+dailyLifetime<=now)expired.push(other)
        else if(other!==key&&!ticket.matched&&ticket.days===days)candidates.push([other,ticket])
      }
      for(let i=0;i<expired.length;i+=128)await this.ctx.storage.delete(expired.slice(i,i+128))
      candidates.sort((a,b)=>a[1].created-b[1].created)
      for(const [other,opponent] of candidates){
        const blocked=await this.ctx.storage.get(['block/'+player.id+'/'+opponent.owner.id,'block/'+opponent.owner.id+'/'+player.id])
        if(blocked.size)continue
        const id=opponent.id
        const seats=Math.random()<.5?{white:player,black:opponent.owner}:{white:opponent.owner,black:player}
        await room(this.env,id).initialize({id,control:dailyControl(days),seats,rated:false,created:now,open:false})
        await this.ctx.storage.transaction(async txn=>{
          await txn.put<DailyTicket>(key,{owner:player,id,days,created:now,requestId,matched:true})
          await txn.put<DailyTicket>(other,{...opponent,created:now,matched:true})
          await txn.put(dailyRoomKey(player.id,id),id)
          await txn.put(dailyRoomKey(opponent.owner.id,id),id)
        })
        return {id}
      }
      const same=mine&&!mine.matched&&mine.days===days&&mine.created+dailyLifetime>now
      const ticket:DailyTicket={owner:player,id:same?mine.id:token(),days,created:same?mine.created:now,requestId}
      const due=ticket.created+dailyBotWait
      if(due<=now){
        const side:Side=Math.random()<.5?'white':'black'
        const bot=oppositeSeat(side)
        const seats:Seats={[side]:player,[bot]:{id:'daily-bot',name:queueHandle(),account:false}}
        await room(this.env,ticket.id).initialize({id:ticket.id,control:dailyControl(days),seats,rated:false,created:now,open:false,bot})
        await this.ctx.storage.put({[key]:{...ticket,matched:true},[dailyRoomKey(player.id,ticket.id)]:ticket.id})
        return {id:ticket.id}
      }
      await this.ctx.storage.put({[key]:ticket,[dailyFallbackPrefix+String(due)+'/'+player.id+'/'+requestId]:{player:player.id,requestId,due}})
      await this.scheduleDailyFallback(due)
      return {queued:days}
    })
  }
  async session(id:string) {
    const entry=await this.ctx.storage.get<{user:Identity;expires:number;passwordSalt?:string}>('session/'+id)
    if(!entry || entry.expires<=Date.now()) return
    if(entry.passwordSalt){
      const password=await this.ctx.storage.get<PasswordRecord>('password/'+entry.user.id)
      if(password?.salt!==entry.passwordSalt)return
    }
    return entry.user
  }
  private async assignPlayerNumber(txn:DurableObjectTransaction,id:string,handle?:string){
    const key='player-number/'+id
    const assigned=await txn.get<number>(key)
    if(assigned!==undefined)return assigned
    const counter='player-number-sequence'
    let last=await txn.get<number>(counter)
    if(last===undefined){
      const accounts=new Map<string,{handle:string;created:number}>()
      let startAfter:string|undefined
      for(;;){
        const handles=await txn.list<string>({prefix:'handle/',startAfter,limit:100})
        if(!handles.size)break
        const dates=await txn.get<number>([...new Set(handles.values())].map(createdKey))
        for(const [handle,owner] of handles){
          startAfter=handle
          if(!accounts.has(owner)&&!isQaAccount(owner,handle.slice(7)))
            accounts.set(owner,{handle,created:dates.get(createdKey(owner))??0})
        }
        if(handles.size<100)break
      }
      const ordered=[...accounts].sort(([,a],[,b])=>a.created-b.created||a.handle.localeCompare(b.handle))
      for(let offset=0;offset<ordered.length;offset+=100){
        await txn.put(Object.fromEntries(ordered.slice(offset,offset+100).map(([owner],index)=>['player-number/'+owner,offset+index+1])))
      }
      last=ordered.length
      await txn.put(counter,last)
      const existing=await txn.get<number>(key)
      if(existing!==undefined)return existing
    }
    const number=last+1
    await txn.put({[key]:number,[counter]:number})
    if(handle)await txn.put('number-handle/'+number,handle.toLowerCase())
    return number
  }
  private async prioritizeFoundingPlayers(){
    const marker='player-number-founder-order'
    if(await this.ctx.storage.get(marker))return
    await this.ctx.storage.transaction(async txn=>{
      if(await txn.get(marker))return
      const handles=['lukas','test','natalie','evan'].map(name=>'handle/'+name)
      const accounts=await txn.get<string>(handles)
      const founders=handles.map(handle=>accounts.get(handle))
      if(founders.some(id=>!id)||new Set(founders).size!==handles.length)return
      const keys=founders.map(id=>'player-number/'+id)
      const former=[]
      for(const id of founders)former.push(await this.assignPlayerNumber(txn,id!))
      const available=former.filter(number=>number>keys.length).sort((a,b)=>a-b)
      const displaced:Array<[string,number]>=[]
      let startAfter:string|undefined
      while(displaced.length<available.length){
        const batch=await txn.list<number>({prefix:'player-number/',startAfter,limit:100})
        for(const [key,number] of batch){
          startAfter=key
          if(number<=keys.length&&!keys.includes(key))displaced.push([key,number])
        }
        if(batch.size<100)break
      }
      if(displaced.length!==available.length)throw Error('Could not reconcile the first player numbers')
      displaced.sort((a,b)=>a[1]-b[1])
      await txn.put(Object.fromEntries([...keys.map((key,i)=>[key,i+1]),...displaced.map(([key],i)=>[key,available[i]])]))
      await txn.put(marker,true)
    })
  }
  private async playerNumber(id:string,handle:string){
    if(isQaAccount(id,handle))return undefined
    await this.prioritizeFoundingPlayers()
    return await this.ctx.storage.get<number>('player-number/'+id) ??
      await this.ctx.storage.transaction(txn=>this.assignPlayerNumber(txn,id,handle))
  }
  async signIn(id:string,user:Identity){
    await this.ctx.storage.put('session/'+id,{user,expires:Date.now()+7*86400_000})
    await this.socialHandle(user)
  }
  async startCeremony(guest:string,ceremony:Ceremony){
    await this.ctx.storage.put('ceremony/'+guest,ceremony)
  }
  async takeCeremony(guest:string){
    return this.ctx.storage.transaction(async txn=>{
      const key='ceremony/'+guest
      const entry=await txn.get<Ceremony>(key)
      if(entry)await txn.delete(key)
      return entry&&entry.expires>Date.now()?entry:null
    })
  }
  async passkey(id:string){return await this.ctx.storage.get<Passkey>('passkey/'+id)}
  async addPasskey(record:Passkey,sessionID:string){
    return this.ctx.storage.transaction(async txn=>{
      const handle='handle/'+record.user.name.toLowerCase()
      const key='passkey/'+record.credential.id
      if(await txn.get(handle)||await txn.get(key))return false
      if(!isQaAccount(record.user.id,record.user.name))await this.assignPlayerNumber(txn,record.user.id,record.user.name)
      await txn.put(handle,record.user.id)
      await txn.put(key,record)
      await txn.put(createdKey(record.user.id),Date.now())
      await txn.put('session/'+sessionID,{user:record.user,expires:Date.now()+7*86400_000})
      return true
    })
  }
  async authenticatePasskey(id:string,previous:number,counter:number,sessionID:string){
    return this.ctx.storage.transaction(async txn=>{
      const key='passkey/'+id
      const record=await txn.get<Passkey>(key)
      if(!record||record.credential.counter!==previous)return false
      if(counter!==previous)await txn.put(key,{...record,credential:{...record.credential,counter}})
      await txn.put('session/'+sessionID,{user:record.user,expires:Date.now()+7*86400_000})
      return true
    })
  }
  async reserveEmail(request:EmailRequest){
    return this.ctx.storage.transaction(async txn=>{
      if((request.purpose==='reset'||request.purpose==='sign-in')&&!await txn.get('email-account/'+request.mailbox))
        return 'unknown'
      const now=Date.now()
      const mailbox='mailbox/'+request.mailbox
      const previous=await txn.get<{hash:string;sent:number}>(mailbox)
      if(previous&&now-previous.sent<60_000)return 'cooldown'
      const day=new Date(now).toISOString().slice(0,10)
      const count=await txn.get<{day:string;count:number}>('email-quota')
      const sent=count?.day===day?count.count:0
      if(sent>=90)return 'quota'
      if(previous)await txn.delete('email-link/'+previous.hash)
      await txn.put(mailbox,{hash:request.hash,sent:now})
      await txn.put('email-quota',{day,count:sent+1})
      await txn.put('email-link/'+request.hash,request)
      return 'ready'
    })
  }
  async discardEmail(hash:string,mailbox:string){
    await this.ctx.storage.transaction(async txn=>{
      if((await txn.get<{hash:string}>('mailbox/'+mailbox))?.hash===hash)await txn.delete('mailbox/'+mailbox)
      await txn.delete('email-link/'+hash)
    })
  }
  async inspectEmail(hash:string,viewer:Identity|undefined){
    const link=await this.ctx.storage.get<EmailRequest>('email-link/'+hash)
    if(!link||link.expires<=Date.now())return {expired:true}
    if(!link.owner){
      const user=await this.ctx.storage.get<Identity>('email-account/'+link.mailbox)
      return {kind:link.purpose==='reset'?'reset':user?'sign-in':'signup',
        switchRequired:Boolean(viewer&&viewer.id!==user?.id)}
    }
    const ownerName=link.ownerName??(viewer?.id===link.owner?viewer.name:undefined)
    if(!ownerName)return {legacy:true}
    return {kind:'link',accountName:ownerName,switchRequired:Boolean(viewer&&viewer.id!==link.owner)}
  }
  async authenticatePassword(mailbox:string,password:string,sessionID:string){
    const index='email-account/'+mailbox
    const user=await this.ctx.storage.get<Identity>(index)
    const key='password/'+user?.id
    const record=user?await this.ctx.storage.get<PasswordRecord>(key):undefined
    if(!await matchesPassword(password,record)||!user||!record)return false
    return this.ctx.storage.transaction(async txn=>{
      if((await txn.get<Identity>(index))?.id!==user.id||
        (await txn.get<PasswordRecord>(key))?.salt!==record.salt)return false
      await txn.put('session/'+sessionID,{user,passwordSalt:record.salt,expires:Date.now()+7*86400_000})
      return true
    })
  }
  async redeemEmail(hash:string,handle:string|null,password:string|undefined,owner:Identity|undefined,sessionID:string){
    const key='email-link/'+hash
    const pending=await this.ctx.storage.get<EmailRequest>(key)
    if(!pending||pending.expires<=Date.now())return 'expired'
    const index='email-account/'+pending.mailbox
    const existing=await this.ctx.storage.get<Identity>(index)
    const needsPassword=pending.purpose==='reset'||(!pending.owner&&!existing&&pending.purpose!=='sign-in')
    const credential=needsPassword&&password?await hashPassword(password):undefined
    return this.ctx.storage.transaction(async txn=>{
      const link=await txn.get<EmailRequest>(key)
      if(!link||link.expires<=Date.now()){if(link)await txn.delete(key);return 'expired'}
      let user=await txn.get<Identity>(index)
      if(link.owner){
        // A linking request comes from a signed-in account. The emailed token then proves mailbox access.
        if(owner&&owner.id!==link.owner)return 'sign-out'
        const target=owner??(link.ownerName?{id:link.owner,name:link.ownerName,account:true}:undefined)
        if(!target)return 'legacy'
        if(user&&user.id!==target.id)return 'linked'
        user=target
      }else if(owner&&owner.id!==user?.id)return 'sign-out'
      if(!user&&(link.purpose==='reset'||link.purpose==='sign-in'))return 'expired'
      const setPassword=!user||link.purpose==='reset'
      if(!user){
        if(!handle)return 'name'
        if(!credential)return 'password'
        const handleKey='handle/'+handle.toLowerCase()
        if(await txn.get(handleKey))return 'taken'
        user={id:'email:'+token(),name:handle,account:true}
        await this.assignPlayerNumber(txn,user.id,handle)
        await txn.put(handleKey,user.id)
        await txn.put(createdKey(user.id),Date.now())
      }
      if(setPassword){
        if(!credential)return 'password'
        await txn.put('password/'+user.id,credential)
      }
      await txn.put(index,user)
      await txn.put(emailOwnerKey(user.id),true)
      await txn.put('session/'+sessionID,{user,passwordSalt:setPassword?credential?.salt:undefined,expires:Date.now()+7*86400_000})
      await txn.delete(key)
      return 'ok'
    })
  }
  async hasEmail(user:string){
    return Boolean(await this.ctx.storage.get(emailOwnerKey(user)))
  }
  private async adminAccountIds(){
    const email=normalizeEmail(this.env.ADMIN_EMAIL)
    const [owner,test,swagwayboy]=await Promise.all([
      email?this.ctx.storage.get<Identity>('email-account/'+await digest(email)):undefined,
      this.ctx.storage.get<string>('handle/test'),
      this.ctx.storage.get<string>('handle/swagwayboy'),
    ])
    const [testCreated,swagwayNumber]=await Promise.all([
      test?this.ctx.storage.get<number>(createdKey(test)):undefined,
      swagwayboy?this.ctx.storage.get<number>('player-number/'+swagwayboy):undefined,
    ])
    // Require the verified account's player number as well as the handle.
    return new Set([
      owner?.id,
      testCreated!==undefined&&testCreated<=testAdminSignupCutoff?test:undefined,
      swagwayNumber===23?swagwayboy:undefined,
    ])
  }
  async isAdmin(user:string){
    return (await this.adminAccountIds()).has(user)
  }
  async adminUsers(viewer:string,prefix:string,after:string):Promise<AdminUsers|null>{
    const admins=await this.adminAccountIds()
    if(!admins.has(viewer))return null
    await this.prioritizeFoundingPlayers()
    const pageSize=28
    const indexed=await this.ctx.storage.list<string>({
      prefix:'handle/'+prefix,startAfter:after?'handle/'+after:undefined,limit:pageSize+qaHandles.size+privateHandles.size+1,
    })
    const visible=[...indexed].filter(([key,id])=>!excludeFromPlayerCount(id,key.slice('handle/'.length)))
    const publicEntries=visible.slice(0,pageSize)
    const internalEntries=after?[]:[...await this.ctx.storage.get<string>([...privateHandles].map(handle=>'handle/'+handle))]
    const entries=[...publicEntries,...internalEntries]
    if(!entries.length)return {users:[],internal:[]}
    const metadata=await this.ctx.storage.get<number|boolean|ProfileDetails|Profile>(
      entries.flatMap(([,id])=>[createdKey(id),emailOwnerKey(id),detailsKey(id),'profile/'+id]),
    )
    const numbers=await this.ctx.storage.get<number>(entries.map(([,id])=>'player-number/'+id))
    const users=entries.map(([key,id]):AdminUser=>{
      const profile=metadata.get(detailsKey(id)) as ProfileDetails|undefined
      const created=metadata.get(createdKey(id))
      const saved=metadata.get('profile/'+id) as Profile|undefined
      const games=completedGames(saved?this.normalizeProfile(saved):undefined)
      return {
        handle:key.slice('handle/'.length),
        playerNumber:numbers.get('player-number/'+id),
        admin:admins.has(id),
        displayName:profile?.displayName||undefined,
        country:profile?.country||undefined,
        gamesPlayed:games.count,
        totalIsMinimum:games.minimum,
        ratedGames:games.ratedGames,
        registeredWith:id.startsWith('passkey:')?'passkey':id.startsWith('email:')?'email':'github',
        emailLinked:metadata.get(emailOwnerKey(id))===true,
        createdAt:typeof created==='number'?created:undefined,
      }
    })
    return {users:users.slice(0,publicEntries.length),internal:users.slice(publicEntries.length).sort((a,b)=>(a.playerNumber??Infinity)-(b.playerNumber??Infinity)),
      next:visible.length>pageSize?users[pageSize-1].handle:undefined}
  }
  async logout(id:string){ await this.ctx.storage.delete('session/'+id) }
  private normalizeProfile(profile:Profile):Profile{
    for(const [group,rating] of Object.entries(profile.ratings)){
      if(rating.botGames!==undefined)continue
      const recorded=new Set(profile.history.filter(row=>row.pool===group&&row.delta!==undefined).map(row=>row.id)).size
      profile.ratings[group]={...rating,botGames:Math.max(0,recorded-rating.games)}
    }
    return profile
  }
  async profile(user:Identity):Promise<Profile>{
    return this.normalizeProfile(await this.ctx.storage.get<Profile>('profile/'+user.id) ?? {user,ratings:{},history:[]})
  }
  async socialHandle(user:Identity){
    const preferred=user.name.toLowerCase()
    if(await this.ctx.storage.get('handle/'+preferred)===user.id)return preferred
    return this.ctx.storage.transaction(async txn=>{
      const key='social-handle/'+user.id
      const assigned=await txn.get<string>(key)
      if(assigned)return assigned
      let handle=validHandle(preferred)?preferred:'player-'+token().slice(0,8)
      while(await txn.get('handle/'+handle))handle='player-'+token().slice(0,12)
      await this.assignPlayerNumber(txn,user.id,handle)
      await txn.put('handle/'+handle,user.id)
      await txn.put(key,handle)
      return handle
    })
  }
  async profilePage(user:Identity){
    const [profile,handle,details]=await Promise.all([
      this.profile(user),this.socialHandle(user),this.ctx.storage.get<ProfileDetails>(detailsKey(user.id)),
    ])
    return {...profile,handle,playerNumber:await this.playerNumber(user.id,handle),details:details??emptyDetails}
  }
  async updateProfile(user:Identity,edit:ProfileEdit){
    await this.ctx.storage.transaction(async txn=>{
      const previous=await txn.get<ProfileDetails>(detailsKey(user.id))
      const {photo,...details}=edit
      let avatar=previous?.avatar
      if(photo===null){await txn.delete(photoKey(user.id));avatar=undefined}
      else if(photo){await txn.put(photoKey(user.id),photo);avatar=token()}
      await txn.put<ProfileDetails>(detailsKey(user.id),{...details,avatar})
    })
    return this.profilePage(user)
  }
  async playerCard(viewer:string,handle:string):Promise<PlayerCard|undefined>{
    const id=await this.ctx.storage.get<string>('handle/'+handle)
    if(!id||id===viewer||(await this.ctx.storage.get(blockedKeys(viewer,id))).size)return
    const [details,link,playerNumber]=await Promise.all([
      this.ctx.storage.get<ProfileDetails>(detailsKey(id)),this.ctx.storage.get<FriendLink>(friendKey(viewer,id)),this.playerNumber(id,handle),
    ])
    return {...(details??emptyDetails),handle,playerNumber,status:link?.status,
      online:link?.status==='friend'?this.ctx.getWebSockets(id).some(s=>s.readyState===WebSocket.OPEN):undefined}
  }
  async findPlayerByNumber(viewer:string,number:number){
    await this.prioritizeFoundingPlayers()
    const ready='player-number-lookup-ready'
    if(!await this.ctx.storage.get(ready)){
      await this.ctx.storage.transaction(async txn=>{
        if(await txn.get(ready))return
        let startAfter:string|undefined
        for(;;){
          const handles=await txn.list<string>({prefix:'handle/',startAfter,limit:100})
          if(!handles.size)break
          const numbers=await txn.get<number>([...new Set(handles.values())].map(id=>'player-number/'+id))
          const index:Record<string,string>={}
          for(const [key,id] of handles){
            startAfter=key
            const assigned=numbers.get('player-number/'+id)
            if(assigned!==undefined)index['number-handle/'+assigned]=key.slice('handle/'.length)
          }
          if(Object.keys(index).length)await txn.put(index)
          if(handles.size<100)break
        }
        await txn.put(ready,true)
      })
    }
    const handle=await this.ctx.storage.get<string>('number-handle/'+number)
    const card=handle&&await this.playerCard(viewer,handle)
    return card&&card.playerNumber===number?[card]:[]
  }
  async findPlayers(viewer:string,prefix:string){
    const matches=await this.ctx.storage.list<string>({prefix:'handle/'+prefix,limit:12})
    const cards=await Promise.all([...matches.keys()].map(key=>this.playerCard(viewer,key.slice(7))))
    return cards.filter(card=>card!==undefined)
  }
  async avatar(viewer:string,handle:string){
    const id=await this.ctx.storage.get<string>('handle/'+handle)
    if(!id||(id!==viewer&&(await this.ctx.storage.get(blockedKeys(viewer,id))).size))return
    return this.ctx.storage.get<string>(photoKey(id))
  }
  async friends(user:string):Promise<FriendList>{
    const entries=await this.ctx.storage.list<FriendLink>({prefix:'friend/'+user+'/'})
    const groups:FriendList={friends:[],incoming:[],outgoing:[]}
    const ids=[...entries.keys()].map(key=>key.slice(('friend/'+user+'/').length))
    const online=new Set(this.presenceSockets().map(socket=>this.ctx.getTags(socket)[0]))
    for(let i=0;i<ids.length;i+=100){
      const batch=ids.slice(i,i+100)
      const details=await this.ctx.storage.get<ProfileDetails>(batch.map(detailsKey))
      for(const id of batch){
        const link=entries.get(friendKey(user,id))!
        const card={...(details.get(detailsKey(id))??emptyDetails),handle:link.handle,status:link.status}
        if(link.status==='friend')groups.friends.push({...card,online:online.has(id)})
        else groups[link.status].push(card)
      }
    }
    groups.friends.sort((a,b)=>Number(b.online)-Number(a.online)||a.handle.localeCompare(b.handle))
    return groups
  }
  async changeFriend(user:Identity,handle:string,action:FriendAction){
    const myHandle=await this.socialHandle(user)
    return this.ctx.storage.transaction(async txn=>{
      const other=await txn.get<string>('handle/'+handle)
      if(!other||other===user.id||(await txn.get(blockedKeys(user.id,other))).size)return 'missing'
      const left=friendKey(user.id,other),right=friendKey(other,user.id)
      const link=await txn.get<FriendLink>(left)
      if(action==='add'){
        if(link)return 'ok'
        await txn.put<FriendLink>(left,{handle,status:'outgoing'})
        await txn.put<FriendLink>(right,{handle:myHandle,status:'incoming'})
      }else if(action==='accept'){
        if(link?.status==='friend')return 'ok'
        if(link?.status!=='incoming')return 'changed'
        await txn.put<FriendLink>(left,{handle,status:'friend'})
        await txn.put<FriendLink>(right,{handle:myHandle,status:'friend'})
      }else{
        if(!link)return 'ok'
        const expected=action==='decline'?'incoming':action==='cancel'?'outgoing':'friend'
        if(link.status!==expected)return 'changed'
        await txn.delete([left,right])
      }
      return 'ok'
    })
  }
  async block(who:string,other:string){
    await this.ctx.storage.transaction(async txn=>{
      await txn.put('block/'+who+'/'+other,true)
      await txn.delete([friendKey(who,other),friendKey(other,who)])
    })
  }
  async puzzleScore(user:string,attempt?:{id:number;token:string;moves:string[]}){
    return this.ctx.storage.transaction(async txn=>{
      const key='puzzle-score/'+user
      const state=await txn.get<{rating:number;done:Record<string,boolean>}>(key)??{rating:800,done:{}}
      if(!attempt||attempt.token in state.done)return state
      const puzzle=puzzleAt(attempt.id)
      const won=puzzle.line.length===attempt.moves.length&&puzzle.line.every((m,i)=>m===attempt.moves[i])
      if(!won&&attempt.moves.every((m,i)=>m===puzzle.line[i]))return state
      const expected=1/(1+10**((puzzle.strength-state.rating)/400))
      state.rating=Math.max(100,Math.round(state.rating+48*(Number(won)-expected)))
      state.done[attempt.token]=won
      await txn.put(key,state)
      return state
    })
  }
  async settings(user:string,input?:Record<string,unknown>) {
    if(input) await this.ctx.storage.put('settings/'+user,input)
    return await this.ctx.storage.get('settings/'+user) ?? {}
  }
  async watch() {
    return [...(await this.ctx.storage.list<PublicGame>({prefix:'watch/',limit:40})).values()]
  }
  async distribution(group:string){
    const cacheKey='distribution/v3/'+group
    const cached=await this.ctx.storage.get<{time:number;counts:number[];first:number}>(cacheKey)
    const now=Date.now()
    if(cached&&now-cached.time<3_600_000)return cached
    const counts=new Map<number,number>()
    let startAfter:string|undefined
    for(;;){
      const batch=await this.ctx.storage.list<Profile>({prefix:'profile/',startAfter,limit:200})
      for(const [key,raw] of batch){
        startAfter=key
        if(excludeFromPlayerCount(raw.user.id,raw.user.name))continue
        const rating=this.normalizeProfile(raw).ratings[group]
        if(!rating||establishedRating(rating)===null||now-rating.updated>90*86_400_000)continue
        const bucket=Math.floor(Math.round(rating.rating)/100)*100
        counts.set(bucket,(counts.get(bucket)??0)+1)
      }
      if(batch.size<200)break
    }
    const first=counts.size?Math.min(...counts.keys()):0
    const last=counts.size?Math.max(...counts.keys()):0
    const result={time:now,first,counts:Array.from({length:(last-first)/100+1},(_,i)=>counts.get(first+i*100)??0)}
    await this.ctx.storage.put(cacheKey,result)
    return result
  }
  async leaders(){
    const records=[...(await this.ctx.storage.list<Profile>({prefix:'profile/',limit:1000+qaHandles.size})).values()].filter(p=>!isQaAccount(p.user.id,p.user.name)).slice(0,1000).map(p=>this.normalizeProfile(p))
    return Object.fromEntries(['Bullet','Blitz','Rapid'].map(group=>[group,records.filter(p=>establishedRating(p.ratings[group])!==null).sort((a,b)=>b.ratings[group].rating-a.ratings[group].rating).slice(0,20).map(p=>({name:p.user.name,rating:Math.round(p.ratings[group].rating)}))]))
  }
  async search(player:Identity,clock:SearchClock,rated:boolean,cancel=false,searchId?:string,acceptBot=false){
    return this.ctx.blockConcurrencyWhile(async()=>{
      const activeKey='active/'+player.id
      const active=await this.ctx.storage.get<string>(activeKey)
      if(active){
        const match=room(this.env,active)
        const dropped=cancel&&searchId?await match.cancelUnplayedQueue(player,searchId):false
        if(!dropped&&await match.isOpenFor(player.id))return {id:active}
        await this.ctx.storage.delete(activeKey)
      }
      const now=Date.now()
      const directory='search/'+(rated?'rated/':'casual/')
      const myKey=directory+player.id
      const mine=await this.ctx.storage.get<Ticket>(myKey)
      if(cancel){
        if(mine && mine.searchId!==searchId)return {}
        if(searchId){
          await this.ctx.storage.put<Ticket>(myKey,{owner:player,id:mine?.id??token(),clock,created:now,expires:now+90_000,searchId,cancelled:true})
        }else await this.ctx.storage.delete(myKey)
        return {}
      }
      const same=mine&&mine.expires>now&&mine.searchId===searchId&&compatibleClock(clock,mine.clock)!==null&&
        (clock==='any')===(mine.clock==='any')
      if(mine?.cancelled&&mine.searchId===searchId&&mine.expires>now)return {cancelled:true}
      if(same && mine.bot)return {bot:mine.bot}
      await this.ctx.storage.delete('search/'+(rated?'casual/':'rated/')+player.id)
      const entries=await this.ctx.storage.list<Ticket>({prefix:directory})
      const stale:string[]=[]
      const eligible:{key:string;ticket:Ticket;control:Control}[]=[]
      for(const [key,ticket] of entries){
        if(ticket.expires<=now){stale.push(key);continue}
        if(key===myKey||ticket.cancelled||ticket.bot)continue
        const control=compatibleClock(clock,ticket.clock)
        if(control)eligible.push({key,ticket,control})
      }
      if(stale.length)for(let i=0;i<stale.length;i+=128)await this.ctx.storage.delete(stale.slice(i,i+128))
      eligible.sort((a,b)=>a.ticket.created-b.ticket.created)
      let pair:typeof eligible[number]|undefined
      for(const entry of eligible){
        const opponent=entry.ticket.owner.id
        const records=await this.ctx.storage.get([
          'active/'+opponent,'block/'+player.id+'/'+opponent,'block/'+opponent+'/'+player.id,
        ])
        if(records.size===0){pair=entry;break}
      }
      if(!pair){
        const created=same?mine.created:now
        const botIn=searchId?Math.max(0,botWait(rated)-(now-created)):undefined
        const ticketId=same?mine.id:token()
        const control=clock==='any'?quickClock:clock
        if(rated&&acceptBot&&botIn===0){
          const bot= Math.random()<.5?'white':'black'
          const side=oppositeSeat(bot)
          const day=Math.floor(now/86_400_000)
          const usageKey=botUsageKey(player.id)
          const usage=await this.ctx.storage.get<{day:number;count:number}>(usageKey)
          const count=usage?.day===day?usage.count:0
          const counts=control.seconds>=60&&count<dailyRatedBotGames
          const seats:Seats={[side]:player,[bot]:{id:'ranked-bot',name:queueHandle(),account:false}}
          const rating=ratedSnapshot((await this.profile(player)).ratings[pool(control.seconds,control.increment)])
          await room(this.env,ticketId).initialize({id:ticketId,seats,rated:counts,ratings:{[side]:rating,[bot]:botRating},control,created:now,open:false,bot,queueSearch:searchId,ratingModel:1})
          await this.ctx.storage.transaction(async txn=>{
            await txn.delete(myKey)
            await txn.put(activeKey,ticketId)
            if(counts)await txn.put(usageKey,{day,count:count+1})
          })
          return {id:ticketId}
        }
        const bot=!rated&&botIn===0?control:undefined
        await this.ctx.storage.put<Ticket>(myKey,{owner:player,id:ticketId,clock,created,expires:now+liveSearchLease,searchId,bot})
        return bot?{bot}:{queued:true,rated,flexible:clock==='any',botIn}
      }
      const {ticket:opponent,control}=pair
      const id=opponent.id
      const opponentKey=pair.key
      const seats=Math.random()<0.5 ? {white:opponent.owner,black:player} : {white:player,black:opponent.owner}
      const group=pool(control.seconds,control.increment)
      const ratings:RoomInfo['ratings']=rated?{
        white:ratedSnapshot((await this.profile(seats.white)).ratings[group]),
        black:ratedSnapshot((await this.profile(seats.black)).ratings[group]),
      }:undefined
      const queueSearches:Partial<Record<Side,string>>=seats.white.id===player.id
        ?{white:searchId,black:opponent.searchId}:{white:opponent.searchId,black:searchId}
      await room(this.env,id).initialize({id,seats,rated,ratings,control,created:now,open:false,ratingModel:1,queueSearches})
      await this.ctx.storage.transaction(async txn=>{
        await txn.delete([myKey,opponentKey])
        await txn.put<PublicGame>('watch/'+id,{id,white:seats.white.name,black:seats.black.name,control,rated})
        await txn.put(activeKey,id)
        await txn.put('active/'+opponent.owner.id,id)
      })
      return {id}
    })
  }
  async finish(final:Final){
    await this.ctx.storage.transaction(async txn=>{
      if(await txn.get('result/'+final.room.id)) return
      await txn.delete('watch/'+final.room.id)
      const players=[final.room.seats.white,final.room.seats.black]
      if(final.reason==='Game cancelled'){
        for(const player of players){
          if(!player||player.id==='ranked-bot')continue
          if(await txn.get('active/'+player.id)===final.room.id)await txn.delete('active/'+player.id)
          if(final.room.bot&&final.room.rated){
            const key=botUsageKey(player.id)
            const usage=await txn.get<{day:number;count:number}>(key)
            if(usage?.day===Math.floor(final.room.created/86_400_000)&&usage.count>0)
              await txn.put(key,{...usage,count:usage.count-1})
          }
        }
        await txn.put('result/'+final.room.id,{...final,applied:Date.now()})
        return
      }
      const accounts = await Promise.all(players.map(async player=>player?.account?this.profileIn(txn,player):null))
      const group=final.room.control.days?'Daily':pool(final.room.control.seconds,final.room.control.increment)
      const now=Date.now()
      const starts=accounts.map((p,i)=>p?.ratings[group]??final.room.ratings?.[i===0?'white':'black']??placementPrior())
      const rated=final.reason!=='Inactive room expired' && final.room.rated && Boolean(final.room.bot || (accounts[0] && accounts[1]))
      for(let i=0;i<2;i++){
        const player=players[i], profile=accounts[i]
        if(!player) continue
        if(await txn.get('active/'+player.id)===final.room.id) await txn.delete('active/'+player.id)
        if(final.room.control.days)await txn.delete(dailyRoomKey(player.id,final.room.id))
        if(!profile) continue
        const total=completedGames(profile)
        profile.gameTotal={count:total.count+1,minimum:total.minimum}
        const score=final.winner===null?0.5:final.winner===(i===0?'white':'black')?1:0
        const old=starts[i]
        const color=i===0?'white':'black'
        const opponent=final.room.bot?final.room.ratings?.[final.room.bot]??botRating:
          final.room.ratings?.[oppositeSeat(color)]??starts[1-i]
        const next=rated?ratingAfter(final.room,old,opponent,score,now):old
        if(rated){
          const prefix=historyKey(player.id,group)
          if(countedGames(old)>0&&!(await txn.list({prefix,limit:1})).size)
            await txn.put('rating-baseline/'+player.id+'/'+group,{rating:old,recorded:now})
          profile.ratings[group]=next
          const event:RatingEvent={id:final.room.id,time:now,sequence:countedGames(next),pool:group,
            color,bot:Boolean(final.room.bot),score,opponent:opponent.rating,opponentRD:opponent.rd,
            before:old,after:next,rules:final.rules,model:1}
          await txn.put(prefix+String(event.sequence).padStart(12,'0'),event)
          await txn.put('rating-result/'+player.id+'/'+event.id,event)
        }
        profile.history=[{id:final.room.id,result:score===1?'Win':score===0?'Loss':'Draw',pool:group,delta:rated?ratingDelta(old,next):undefined},...profile.history].slice(0,100)
        await txn.put('profile/'+player.id,profile)
      }
      await txn.put('result/'+final.room.id,{...final,starts,applied:now})
    })
  }
  private async profileIn(txn:DurableObjectTransaction,user:Identity):Promise<Profile>{
    return this.normalizeProfile(await txn.get<Profile>('profile/'+user.id) ?? {user,ratings:{},history:[]})
  }
  async ratingHistory(player:string,group:string,before:string|null){
    const prefix=historyKey(player,group)
    const rows=await this.ctx.storage.list<RatingEvent>({prefix,end:before?prefix+before:undefined,reverse:true,limit:101})
    const records=[...rows.values()]
    const page=records.slice(0,100)
    const profile=await this.ctx.storage.get<Profile>('profile/'+player)
    return {rating:profile?this.normalizeProfile(profile).ratings[group]:undefined,
      baseline:await this.ctx.storage.get<{rating:Rating;recorded:number}>('rating-baseline/'+player+'/'+group),events:page,next:records.length>100?String(page.at(-1)!.sequence).padStart(12,'0'):null}
  }
  async ratingResult(player:string,id:string){
    return await this.ctx.storage.get<RatingEvent>('rating-result/'+player+'/'+id)??null
  }

}

export default {
  async fetch(req:Request,env:Env):Promise<Response>{
    const url=new URL(req.url)
    if(url.hostname==='www.remorsechess.com' || (url.hostname==='remorsechess.com' && url.protocol==='http:')){
      url.hostname='remorsechess.com'
      url.protocol='https:'
      return Response.redirect(url.href,308)
    }
    if(!url.pathname.startsWith('/api/')){
      const asset=await env.ASSETS.fetch(req)
      if(url.pathname!=='/' || !url.searchParams.has('game')) return asset
      const matchPage=new Response(asset.body,asset)
      matchPage.headers.set('X-Robots-Tag','noindex')
      return matchPage
    }
    const endpoint=url.pathname.slice(5)
    if(endpoint==='api' || endpoint.length>120) return problem('Not found',404)
    const ip=req.headers.get('CF-Connecting-IP')
    if(ip && endpoint!=='health'){
      const heavy=endpoint==='rooms'||endpoint==='session'||endpoint.startsWith('auth/')||
        (['daily','profile','friends'].includes(endpoint)&&req.method==='POST')
      const binding=heavy?env.WRITE_LIMIT:env.GAME_LIMIT
      const sessionKey=cookie(req,'remorse_account') ?? cookie(req,'remorse_guest')
      const key=!heavy && sessionKey && /^[a-f0-9]{32}$/.test(sessionKey) ? sessionKey : ip
      if(!(await binding.limit({key})).success)return problem('Too many requests. Try again in a minute.',429)
    }
    if(req.method==='POST' && req.headers.get('origin')!==url.origin) return problem('Invalid origin',403)
    if(req.headers.get('upgrade') && req.headers.get('origin')!==url.origin) return problem('Invalid origin',403)
    if(endpoint==='health') return json({ok:true,rulesVersion:CURRENT_RULES})
    const accountId=cookie(req,'remorse_account')
    const guestId=cookie(req,'remorse_guest')
    const guestValid=guestId && /^[a-f0-9]{32}$/.test(guestId)
    const profile=accountId && /^[a-f0-9]{32}$/.test(accountId) ? await lobby(env).session(accountId) : undefined
    const signIn=Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET)
    if(endpoint==='auth/start' && signIn){
      const state=token()
      const authorize=new URL('https://github.com/login/oauth/authorize')
      authorize.search=new URLSearchParams({client_id:env.GITHUB_CLIENT_ID!,state,redirect_uri:url.origin+'/api/auth/callback'}).toString()
      return new Response(null,{status:302,headers:{location:authorize.href,'set-cookie':setCookie(req,'remorse_oauth',state,600)}})
    }
    if(endpoint==='auth/callback' && signIn){
      const state=cookie(req,'remorse_oauth')
      const code=url.searchParams.get('code')
      if(!state || url.searchParams.get('state')!==state || !code) return problem('Sign-in expired',403)
      const exchange=await fetch('https://github.com/login/oauth/access_token',{method:'POST',headers:{accept:'application/json','content-type':'application/json'},body:JSON.stringify({client_id:env.GITHUB_CLIENT_ID,client_secret:env.GITHUB_CLIENT_SECRET,code,redirect_uri:url.origin+'/api/auth/callback'})})
      const auth=await exchange.json<{access_token?:string}>()
      if(!auth.access_token) return problem('GitHub sign-in failed',401)
      const response=await fetch('https://api.github.com/user',{headers:{authorization:'Bearer '+auth.access_token,'user-agent':'RemorseChess',accept:'application/vnd.github+json'}})
      const git=await response.json<{id?:number;login?:string}>()
      if(!response.ok || !git.id || !git.login) return problem('GitHub sign-in failed',401)
      const id=token()
      await lobby(env).signIn(id,{id:'github:'+git.id,name:git.login,account:true})
      const headers=new Headers({location:'/'})
      headers.append('set-cookie',setCookie(req,'remorse_account',id,86400*7))
      headers.append('set-cookie',setCookie(req,'remorse_oauth','',0))
      return new Response(null,{status:303,headers})
    }
    if(endpoint==='auth/logout' && req.method==='POST'){
      if(accountId && profile) await lobby(env).logout(accountId)
      return new Response(null,{status:204,headers:{'set-cookie':setCookie(req,'remorse_account','',0)}})
    }
    const guest=guestValid?guestId:token()
    const player=profile ?? {id:'guest:'+guest,name:'Guest '+guest.slice(0,5).toUpperCase(),account:false}
    const passkeys=canUsePasskeys(url)
    if(endpoint.startsWith('auth/passkey/')&&req.method==='POST'){
      if(!passkeys||!guestValid)return problem('Passkey sign-in is unavailable here',403)
      if(profile)return problem('Already signed in',409)
      const store=lobby(env)
      if(Number(req.headers.get('content-length')??0)>24_000)return problem('Request is too large',413)
      const text=await req.text()
      if(text.length>24_000)return problem('Request is too large',413)
      const input=await new Response(text).json<Record<string,unknown>>().catch(()=>null)
      if(!input || typeof input!=='object')return problem('Invalid sign-in request')
      if(endpoint==='auth/passkey/start'){
        const expires=Date.now()+120_000
        if(input.action==='register'){
          const name=accountName(input.name)
          if(!name)return problem('Use 3–20 letters, numbers, underscores or hyphens.')
          const userId=token()
          const options=await registration(url.hostname,name,userId)
          await store.startCeremony(guest,{action:'register',challenge:options.challenge,name,userId,expires})
          return json(options)
        }
        if(input.action==='login'){
          const options=await authentication(url.hostname)
          await store.startCeremony(guest,{action:'login',challenge:options.challenge,expires})
          return json(options)
        }
        return problem('Unknown passkey operation')
      }
      if(endpoint==='auth/passkey/finish'){
        const ceremony=await store.takeCeremony(guest)
        if(!ceremony || ceremony.action!==input.action)return problem('Sign-in expired. Start again.',403)
        const response=input.response
        if(!response||typeof response!=='object'||!('id' in response)||typeof response.id!=='string'||!/^[-_A-Za-z0-9]{1,1400}$/.test(response.id))return problem('Invalid passkey')
        const sessionID=token()
        try{
          if(ceremony.action==='register'){
            const record=await verifyNew(url,ceremony,response as RegistrationResponseJSON)
            if(!record)return problem('Could not verify your passkey',403)
            if(!await store.addPasskey(record,sessionID))return problem('That player name is already in use. Choose another.',409)
          }else{
            const record=await store.passkey(response.id)
            if(!record)return problem('No Remorse Chess account matches this passkey',403)
            const counter=await verifyExisting(url,ceremony,response as AuthenticationResponseJSON,record)
            if(counter===null||!await store.authenticatePasskey(response.id,record.credential.counter,counter,sessionID))return problem('Could not verify your passkey',403)
          }
        }catch{return problem('Could not verify your passkey. Try again.',403)}
        const reply=json({ok:true})
        reply.headers.append('set-cookie',setCookie(req,'remorse_account',sessionID,86400*7))
        return reply
      }
      return problem('Not found',404)
    }
    const passwordReady=url.hostname==='remorsechess.com'
    const emailReady=Boolean(env.RESEND_API_KEY&&passwordReady)
    if(endpoint.startsWith('auth/email/')&&req.method==='POST'){
      const passwordLogin=endpoint==='auth/email/password'
      if(!(passwordLogin?passwordReady:emailReady)||!guestValid)return problem('Email sign-in is unavailable here',503)
      if(Number(req.headers.get('content-length')??0)>4096)return problem('Request is too large',413)
      const input=await req.json<Record<string,unknown>>().catch(()=>null)
      if(!input||typeof input!=='object')return problem('Invalid request')
      const store=lobby(env)
      if(passwordLogin){
        if(profile)return problem('Sign out before signing in to a different account.',409)
        const email=normalizeEmail(input.email)
        const password=input.password
        if(!email||!validPassword(password))return problem('Email or password is incorrect.',401)
        const mailbox=await digest(email)
        const limits=[env.EMAIL_LIMIT.limit({key:'password-mailbox/'+mailbox})]
        if(ip)limits.push(env.EMAIL_LIMIT.limit({key:'password-ip/'+ip}))
        if((await Promise.all(limits)).some(result=>!result.success))
          return problem('Too many password attempts. Wait a minute or use an email link.',429)
        const sessionID=token()
        if(!await store.authenticatePassword(mailbox,password,sessionID))
          return problem('Email or password is incorrect.',401)
        const response=json({ok:true})
        response.headers.append('set-cookie',setCookie(req,'remorse_account',sessionID,86400*7))
        return response
      }
      if(endpoint==='auth/email/start'){
        const email=normalizeEmail(input.email)
        if(!email)return problem('Enter a valid email address.')
        const linking=input.link===true
        const purpose:EmailPurpose|undefined=input.purpose==='signup'||input.purpose==='reset'||input.purpose==='sign-in'?input.purpose:undefined
        if((linking&&!profile)||(!linking&&profile&&purpose!=='reset')||(linking&&purpose))
          return problem('Sign in to link an email, or sign out to use a different account.',409)
        if(ip&&!(await env.EMAIL_LIMIT.limit({key:ip})).success)return problem('Too many sign-in emails. Wait a minute and try again.',429)
        const code=token()+token()
        const hash=await digest(code)
        const mailbox=await digest(email)
        const account=linking?profile:undefined
        const reserved=await store.reserveEmail({hash,mailbox,purpose,owner:account?.id,ownerName:account?.name,expires:Date.now()+900_000})
        if(reserved==='unknown'||(reserved==='cooldown'&&(purpose==='reset'||purpose==='sign-in')))return json({ok:true})
        if(reserved==='cooldown')return problem('Wait one minute before requesting a new link.',429)
        if(reserved==='quota')return problem('Email sign-in is at its daily limit. Try again tomorrow.',429)
        const target=url.origin+'/#email='+code
        const sent=await sendSignIn(env.RESEND_API_KEY!,email,target,hash,purpose,account?.name).catch(()=>null)
        if(!sent?.ok){
          console.warn('Sign-in email could not be accepted',{status:sent?.status??0})
          await store.discardEmail(hash,mailbox)
          return problem('We couldn’t send the email. Try again in a moment.',502)
        }
        return json({ok:true})
      }
      if(endpoint==='auth/email/inspect'||endpoint==='auth/email/finish'){
        const code=input.code
        if(typeof code!=='string'||!/^([a-f0-9]{64})$/.test(code))return problem('This sign-in link is invalid.',400)
        const hash=await digest(code)
        if(endpoint==='auth/email/inspect'){
          const details=await store.inspectEmail(hash,profile)
          if(details.expired)return problem('This sign-in link expired or was already used. Request a new link.',403)
          if(details.legacy)return problem('Request a new link to verify your email on another device.',403)
          return json(details)
        }
        const handle=accountName(input.name)
        if(input.name!==undefined&&!handle)return problem('Use 3–20 letters, numbers, underscores or hyphens.')
        const password=input.password
        if(password!==undefined&&!validPassword(password))return problem('Use a password of at least '+minPasswordLength+' characters.')
        const sessionID=token()
        const outcome=await store.redeemEmail(hash,handle,typeof password==='string'?password:undefined,profile,sessionID)
        if(outcome==='name')return json({needsName:true})
        if(outcome==='password')return problem('Choose a password to continue.')
        if(outcome==='taken')return problem('That player name is already in use.',409)
        if(outcome==='legacy')return problem('Request a new link to verify your email on another device.',403)
        if(outcome==='linked')return problem('This email is attached to another account.',409)
        if(outcome==='sign-out')return problem('Sign out of the current account before using this link.',409)
        if(outcome!=='ok')return problem('This sign-in link expired or was already used.',403)
        const response=json({ok:true})
        response.headers.append('set-cookie',setCookie(req,'remorse_account',sessionID,86400*7))
        return response
      }
      return problem('Not found',404)
    }
    if(endpoint==='session'){
      const [emailLinked,admin]=profile
        ?await Promise.all([lobby(env).hasEmail(profile.id),lobby(env).isAdmin(profile.id)])
        :[false,false]
      const resp=json({name:player.name,account:player.account,signIn,passkeys,emailReady,emailLinked,passwordReady,admin})
      if(!guestValid) resp.headers.append('set-cookie',setCookie(req,'remorse_guest',guest,86400*30))
      return resp
    }
    if(endpoint==='admin/users'&&req.method==='GET'){
      if(!profile)return problem('Sign in to view the user directory',401)
      const prefix=(url.searchParams.get('q')??'').trim().toLowerCase()
      const after=url.searchParams.get('after')??''
      if(!/^[a-z0-9_-]{0,39}$/.test(prefix)||(after&&(!validHandle(after)||!after.startsWith(prefix))))
        return problem('Enter a valid username prefix')
      const page=await lobby(env).adminUsers(profile.id,prefix,after)
      return page?json(page):problem('Administrator access is required',403)
    }
    if(!profile && !guestValid) return problem('Start a guest session first',401)
    if(endpoint==='puzzle-score'&&player.account){
      if(req.method==='GET')return json(await lobby(env).puzzleScore(player.id))
      if(req.method==='POST'){
        const body=await req.json<{id:number;token:string;moves:string[]}>()
        const day=Math.floor(Date.now()/86400000)
        if(!body||!Number.isInteger(body.id)||body.id<0||body.id>=puzzleCount||!Array.isArray(body.moves)||
          !body.moves.length||body.moves.length>2||!body.moves.every(m=>typeof m==='string'&&/^[a-h][1-8][a-h][1-8]$/.test(m))||
          !(body.token==='practice/'+body.id||[day,day-1].some(d=>body.token==='daily/'+d&&body.id===(d*17)%puzzleCount)))return problem('Invalid puzzle attempt',400)
        return json(await lobby(env).puzzleScore(player.id,body))
      }
    }
    if(endpoint==='settings' && (req.method==='GET'||req.method==='POST')){
      if(!player.account)return problem('Sign in to sync settings',401)
      if(req.method==='GET')return json(await lobby(env).settings(player.id))
      const text=await req.text()
      if(text.length>2000)return problem('Settings are too large',413)
      const input=await new Response(text).json<Record<string,unknown>>().catch(()=>null)
      if(!input || typeof input!=='object' || Array.isArray(input))return problem('Invalid settings')
      return json(await lobby(env).settings(player.id,input))
    }
    if(endpoint==='profile'&&(req.method==='GET'||req.method==='POST')){
      if(!player.account)return problem('Sign in to manage your profile',401)
      if(req.method==='GET')return json(await lobby(env).profilePage(player))
      if(Number(req.headers.get('content-length')??0)>maxProfileBody)return problem('Profile photo is too large',413)
      const text=await req.text()
      if(text.length>maxProfileBody)return problem('Profile photo is too large',413)
      const edit=parseProfileEdit(await new Response(text).json().catch(()=>null))
      if(!edit)return problem('Check your display name, country, bio, and photo')
      return json(await lobby(env).updateProfile(player,edit))
    }
    if(endpoint==='friends'&&(req.method==='GET'||req.method==='POST')){
      if(!player.account)return problem('Sign in to manage friends',401)
      if(req.method==='GET')return json(await lobby(env).friends(player.id))
      const input=await req.json<{handle?:string;action?:FriendAction}>().catch(()=>null)
      if(!validHandle(input?.handle)||!input.action||!['add','accept','decline','cancel','remove'].includes(input.action))
        return problem('Choose a valid player and friend action')
      const result=await lobby(env).changeFriend(player,input.handle.toLowerCase(),input.action)
      return result==='ok'?json({ok:true}):result==='changed'?problem('This request changed. Refresh your friends list.',409):problem('Player not found',404)
    }
    if(req.method==='GET'&&(endpoint==='players'||endpoint.startsWith('player/')||endpoint.startsWith('avatar/'))){
      if(!player.account)return problem('Sign in to view player profiles',401)
      const handle=endpoint==='players'?url.searchParams.get('q')?.trim():endpoint.split('/')[1]
      if(endpoint==='players'&&handle?.startsWith('#')){
        if(!validPlayerNumber(handle))return problem('Enter a player ID like #12.')
        return json(await lobby(env).findPlayerByNumber(player.id,Number(handle.slice(1))))
      }
      if(!validHandle(handle))return problem('Enter at least three characters of a player’s username')
      const normalized=handle.toLowerCase()
      if(endpoint==='players')return json(await lobby(env).findPlayers(player.id,normalized))
      if(endpoint.startsWith('avatar/')){
        const photo=await lobby(env).avatar(player.id,normalized)
        if(!photo)return problem('Photo not found',404)
        return new Response(Uint8Array.from(atob(photo),byte=>byte.charCodeAt(0)),{headers:{
          'content-type':'image/jpeg','x-content-type-options':'nosniff','cache-control':'private, max-age=300',
        }})
      }
      const card=await lobby(env).playerCard(player.id,normalized)
      return card?json(card):problem('Player not found',404)
    }
    if(endpoint==='rating-distribution'&&req.method==='GET'){
      const group=url.searchParams.get('pool')??'Blitz'
      if(!['Bullet','Blitz','Rapid','Daily'].includes(group))return problem('Invalid rating pool')
      return json(await lobby(env).distribution(group))
    }
    if(endpoint==='rating-history'&&req.method==='GET'){
      if(!profile)return problem('Sign in to view rating history',401)
      const group=url.searchParams.get('pool')??'Blitz'
      const before=url.searchParams.get('before')
      if(!['Bullet','Blitz','Rapid','Daily'].includes(group)||(before&&!/^\d{12}$/.test(before)))return problem('Invalid rating history request')
      return json(await lobby(env).ratingHistory(profile.id,group,before))
    }
    if(endpoint==='rating-result'&&req.method==='GET'){
      const game=url.searchParams.get('game')
      if(!profile||!game||!(/^[a-f0-9]{32}$/).test(game))return problem('Invalid rating result request')
      return json(await lobby(env).ratingResult(profile.id,game))
    }
    if(endpoint==='watch' && req.method==='GET') return json(await lobby(env).watch())
    if(endpoint==='leaders' && req.method==='GET') return json(await lobby(env).leaders())
    if(endpoint==='presence'&&req.method==='GET'){
      if(req.headers.get('upgrade')?.toLowerCase()!=='websocket')return problem('WebSocket required',426)
      const headers=new Headers(req.headers)
      headers.set('x-remorse-presence',player.id)
      headers.set('x-remorse-exclude-count',excludeFromPlayerCount(player.id,player.name)?'1':'0')
      return lobby(env).fetch(new Request(req,{headers}))
    }
    if(endpoint==='daily'){
      if(!player.account)return problem('Sign in to play Daily games',401)
      if(req.method==='GET')return json(await lobby(env).daily(player.id))
      if(req.method!=='POST')return problem('Method not allowed',405)
      const input=await req.json<{action?:string;days?:number;requestId?:string}>().catch(()=>null)
      if(input?.action==='cancel')return json(await lobby(env).dailySearch(player,0,'',true))
      const days=input?.days
      if(typeof days!=='number'||!dailyDays.some(value=>value===days))return problem('Choose days per turn')
      if(input?.action==='invite')return json(await lobby(env).dailyInvite(player,days),201)
      if(input?.action==='find'&&typeof input.requestId==='string'&&/^[a-f0-9-]{36}$/.test(input.requestId))
        return json(await lobby(env).dailySearch(player,days,input.requestId))
      return problem('Invalid Daily game action')
    }
    if((endpoint==='rooms' || endpoint==='queue') && req.method==='POST'){
      const body=await req.json<Partial<Control>&{rated?:boolean;cancel?:boolean;flexible?:boolean;searchId?:string;acceptBot?:boolean}>().catch(()=>null)
      const control=body&&parseControl(body)
      if(!control) return problem('Choose a valid time control')
      const rated=body?.rated===true
      if(endpoint==='queue'){
        if(!control.seconds && body?.flexible!==true) return problem('Matchmaking requires a timed game')
        if(rated && !player.account) return problem('Sign in for ranked play',401)
        const searchId=body?.searchId
        if(searchId!==undefined&&(typeof searchId!=='string'||!/^[a-f0-9-]{36}$/.test(searchId)))return problem('Invalid search ID')
        return json(await lobby(env).search(player,body?.flexible===true?'any':control,rated,body?.cancel===true,searchId,body?.acceptBot===true))
      }
      const id=token()
      await room(env,id).initialize({id,control,seats:{white:player},rated:false,created:Date.now(),open:true})
      return json({id},201)
    }
    const parts=/^room\/([a-f0-9]{32})(?:\/(join|command|rematch|report|block|ws|player|resume-status|cancel-unplayed))?$/.exec(endpoint)
    if(parts){
      const action=parts[2] ?? 'snapshot'
      if(!['GET','POST'].includes(req.method) || (req.method==='POST')!==['join','command','rematch','report','block','cancel-unplayed'].includes(action)) return problem('Method not allowed',405)
      if(action==='player'){
        if(!player.account)return problem('Sign in to view player profiles',401)
        const other=await room(env,parts[1]).opponentAccount(player.id)
        if(!other)return problem('Player not found',404)
        const store=lobby(env)
        const card=await store.playerCard(player.id,await store.socialHandle(other))
        return card?json(card):problem('Player not found',404)
      }
      const headers=new Headers(req.headers)
      headers.set('x-remorse-player',JSON.stringify(player))
      const length=Number(headers.get('content-length') ?? 0)
      if(length>4096) return problem('Action too large',413)
      let body:string|undefined
      if(req.method==='POST'){
        body=await req.text()
        if(body.length>4096) return problem('Action too large',413)
        try { JSON.parse(body) } catch { return problem('Invalid action') }
      }
      const response=await room(env,parts[1]).fetch(new Request(url.origin+'/'+action,{method:req.method,headers,body}))
      if(action==='join'&&response.ok&&player.account){
        const state=await response.clone().json<{seat:Side|null;room:{control:Control};match:Match}>()
        if(state.seat&&state.room.control.days&&!state.match.game.result)await lobby(env).registerDaily(player.id,parts[1])
      }
      return response
    }
    return problem('Not found',404)
  },
} satisfies ExportedHandler<Env>

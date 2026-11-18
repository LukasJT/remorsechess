import { DurableObject } from 'cloudflare:workers'
import { command, expire, makeMatch, remaining, type Command, type Control, type Entry, type Match } from './match.ts'
import { defaultRating, deviation, pool, updateRating, type Rating } from './rating.ts'
import { CURRENT_RULES,type Side } from './rules.ts'
import { accountName, authentication, canUsePasskeys, registration, verifyExisting, verifyNew, type Ceremony, type Passkey } from './passkeys.ts'
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server'
import { banner } from './ads.ts'

type Limit = {limit(input:{key:string}):Promise<{success:boolean}>}
interface Env { GAME_LIMIT:Limit; WRITE_LIMIT:Limit; ASSETS:Fetcher; ROOMS:DurableObjectNamespace<Room>; LOBBY:DurableObjectNamespace<Lobby>; GITHUB_CLIENT_ID?:string; GITHUB_CLIENT_SECRET?:string }
type Identity = { id:string; name:string; account:boolean }
type Seats = Partial<Record<Side,Identity>>
type RoomInfo = { id:string; control:Control; seats:Seats; rated:boolean; created:number; open:boolean; ratings?:Partial<Record<Side,Rating>>; invited?:string }
type Ticket = { owner:Identity; id:string; expires:number }
type PublicGame = { id:string; white:string; black:string; control:Control; rated:boolean }
type Profile = { user:Identity; ratings:Record<string,Rating>; history:{id:string; result:string; pool:string; delta?:number}[] }
type Final = { room:RoomInfo; reason:string; winner:Side|null }
const json = (value:unknown,status=200) => Response.json(value,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}})
const problem = (error:string,status=400) => json({error},status)
const token = () => crypto.randomUUID().replaceAll('-','')
const cookie = (req:Request,name:string) => req.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1)
const setCookie = (req:Request,name:string,value:string,maxAge:number) => name+'='+value+'; Path=/; HttpOnly; SameSite=Lax; Max-Age='+maxAge+(new URL(req.url).protocol==='https:'?'; Secure':'')
const lobby = (env:Env) => env.LOBBY.getByName('global-v1')
const room = (env:Env,id:string) => env.ROOMS.getByName(id)
const oppositeSeat=(s:Side):Side=>s==='white'?'black':'white'
const seatOf = (info:RoomInfo,player:Identity):Side|null => info.seats.white?.id===player.id?'white':info.seats.black?.id===player.id?'black':null
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
  async initialize(info:RoomInfo) {
    await this.ctx.blockConcurrencyWhile(async()=>{
      if(await this.ctx.storage.get('room')) return
      const match=makeMatch(info.control,info.seats.black && info.seats.white ? Date.now() : 0)
      await this.ctx.storage.put({room:info,match})
      await this.schedule(info,match)
    })
  }
  private async snapshot(player?:Identity) {
    const info=await this.ctx.storage.get<RoomInfo>('room')
    const match=await this.ctx.storage.get<Match>('match')
    if(!info || !match) return
    const {seats,invited,...visible}=info
    const log=[...(await this.ctx.storage.list<Entry>({prefix:'event/'})).values()]
    return {room:{...visible,white:seats.white?.name,black:seats.black?.name},seat:player?seatOf(info,player):undefined,
      match:{...match,game:{...match.game,seen:{}},log},now:Date.now()}
  }
  private async schedule(info:RoomInfo,m:Match){
    if(m.game.result) await this.ctx.storage.setAlarm(Date.now()+250)
    else if(!m.start) await this.ctx.storage.setAlarm(info.created+30*60_000)
    else if(m.control.seconds) await this.ctx.storage.setAlarm(m.start+m.clock[m.game.side])
    else await this.ctx.storage.setAlarm(m.start+24*60*60_000)
  }
  private async save(info:RoomInfo,match:Match,receipt?:{seat:Side;ids:string[]}) {
    const newEvent=match.log.at(-1)
    const stored={...match,log:[]}
    await this.ctx.storage.transaction(async txn=>{
      await txn.put({room:info,match:stored})
      if(receipt) await txn.put('commands/'+receipt.seat,receipt.ids)
      if(newEvent) await txn.put('event/'+String(match.version).padStart(8,'0'),newEvent)
      if(match.game.result) await txn.put<Final>('pending',{room:info,...match.game.result})
      const next=match.game.result ? Date.now()+250 : match.control.seconds ? match.start+match.clock[match.game.side] : match.start+24*60*60_000
      await txn.setAlarm(next)
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
      if(!info || !match) return problem('Room not found',404)
      const timed=expire(match,Date.now())
      if(timed!==match){ await this.save(info,timed); match=timed }
      const seat=seatOf(info,player)
      if(action==='ws' && req.headers.get('Upgrade')?.toLowerCase()==='websocket'){
        if(this.ctx.getWebSockets().length>=100) return problem('Spectator limit reached',503)
        const pair=new WebSocketPair()
        this.ctx.acceptWebSocket(pair[1])
        pair[1].send(JSON.stringify({version:match.version}))
        return new Response(null,{status:101,webSocket:pair[0]})
      }
      if(action==='join' && req.method==='POST'){
        if(!seat && info.open && (!info.seats.black || !info.seats.white) && !match.start && (!info.invited || info.invited===player.id)){
          info.seats[info.seats.white?'black':'white']=player
          info.open=false
          await this.save(info,{...match,start:Date.now(),version:match.version+1})
        } else if(!seat) return problem('Both seats are taken',409)
      } else if(action==='report' && req.method==='POST'){
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
        const other=seat&&info.seats[oppositeSeat(seat)]
        if(!player.account||!other?.account) return problem('Both players must have accounts',403)
        await lobby(this.env).block(player.id,other.id)
        return json({blocked:true})
      } else if(action==='rematch' && req.method==='POST'){
        if(!seat || !match.game.result || !info.seats.white || !info.seats.black) return problem('Rematch is unavailable',409)
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
        const timed=expire(match,Date.now())
        if(timed!==match) await this.save(info,timed)
        else if(!match.control.seconds) await this.save(info,{...match,game:{...match.game,result:{winner:null,reason:'Inactive room expired'}},start:0,version:match.version+1})
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
  async session(id:string) {
    const entry=await this.ctx.storage.get<{user:Identity;expires:number}>('session/'+id)
    if(!entry || entry.expires<=Date.now()) return
    return entry.user
  }
  async signIn(id:string,user:Identity){
    await this.ctx.storage.put('session/'+id,{user,expires:Date.now()+7*86400_000})
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
      await txn.put(handle,record.user.id)
      await txn.put(key,record)
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
  async logout(id:string){ await this.ctx.storage.delete('session/'+id) }
  async profile(user:Identity):Promise<Profile>{
    return await this.ctx.storage.get<Profile>('profile/'+user.id) ?? {user,ratings:{},history:[]}
  }
  async block(who:string,other:string){
    await this.ctx.storage.put('block/'+who+'/'+other,true)
  }
  async settings(user:string,input?:Record<string,unknown>) {
    if(input) await this.ctx.storage.put('settings/'+user,input)
    return await this.ctx.storage.get('settings/'+user) ?? {}
  }
  async watch() {
    return [...(await this.ctx.storage.list<PublicGame>({prefix:'watch/',limit:40})).values()]
  }
  async leaders(){
    const records=[...(await this.ctx.storage.list<Profile>({prefix:'profile/',limit:1000})).values()]
    return Object.fromEntries(['Bullet','Blitz','Rapid'].map(group=>[group,records.filter(p=>p.ratings[group] && deviation(p.ratings[group],Date.now())<=110).sort((a,b)=>b.ratings[group].rating-a.ratings[group].rating).slice(0,20).map(p=>({name:p.user.name,rating:Math.round(p.ratings[group].rating)}))]))
  }
  async search(player:Identity,control:Control,rated:boolean,cancel=false){
    return this.ctx.blockConcurrencyWhile(async()=>{
      const active=await this.ctx.storage.get<string>('active/'+player.id)
      if(active) return {id:active}
      const key='queue/'+(rated?'rated/':'casual/')+control.seconds+'/'+control.increment
      const now=Date.now()
      const queue=(await this.ctx.storage.get<Ticket[]>(key) ?? []).filter(t=>t.expires>now)
      const myQueue='ticket/'+player.id
      if(cancel) {
        await this.ctx.storage.put(key,queue.filter(t=>t.owner.id!==player.id))
        if(await this.ctx.storage.get(myQueue)===key) await this.ctx.storage.delete(myQueue)
        return {}
      }
      const eligible:Ticket[]=[]
      for(const ticket of queue) {
        if(ticket.owner.id===player.id || (await this.ctx.storage.get('ticket/'+ticket.owner.id)===key && !(await this.ctx.storage.get('active/'+ticket.owner.id)))) eligible.push(ticket)
      }
      const mine=eligible.find(t=>t.owner.id===player.id)
      let other:Ticket|undefined
      for(const ticket of eligible){
        if(ticket.owner.id===player.id)continue
        if(await this.ctx.storage.get('block/'+player.id+'/'+ticket.owner.id) || await this.ctx.storage.get('block/'+ticket.owner.id+'/'+player.id))continue
        other=ticket
        break
      }
      if(!other){
        if(!mine) eligible.push({owner:player,id:token(),expires:now+45_000})
        else mine.expires=now+45_000
        await this.ctx.storage.put({[key]:eligible,[myQueue]:key})
        return {queued:true}
      }
      const opponent=other
      const id=opponent.id
      const seats=Math.random()<0.5 ? {white:opponent.owner,black:player} : {white:player,black:opponent.owner}
      const group=pool(control.seconds,control.increment)
      const ratings:RoomInfo['ratings']=rated?{
        white:(await this.profile(seats.white)).ratings[group]??defaultRating(),
        black:(await this.profile(seats.black)).ratings[group]??defaultRating(),
      }:undefined
      await room(this.env,id).initialize({id,seats,rated,ratings,control,created:now,open:false})
      await this.ctx.storage.transaction(async txn=>{
        await txn.put(key,eligible.filter(t=>t.owner.id!==player.id && t.owner.id!==opponent.owner.id))
        await txn.delete([myQueue,'ticket/'+opponent.owner.id])
        await txn.put<PublicGame>('watch/'+id,{id,white:seats.white.name,black:seats.black.name,control,rated})
        await txn.put('active/'+player.id,id)
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
      const accounts = await Promise.all(players.map(async player=>player?.account?this.profileIn(txn,player):null))
      const group=pool(final.room.control.seconds,final.room.control.increment)
      const now=Date.now()
      const starts=accounts.map(p=>p?.ratings[group] ?? defaultRating())
      const rated=final.room.rated && Boolean(accounts[0] && accounts[1])
      for(let i=0;i<2;i++){
        const player=players[i], profile=accounts[i]
        if(!player) continue
        if(await txn.get('active/'+player.id)===final.room.id) await txn.delete('active/'+player.id)
        if(!profile) continue
        const score=final.winner===null?0.5:final.winner===(i===0?'white':'black')?1:0
        const old=starts[i]
        const next=rated?updateRating(old,starts[1-i],score,now):old
        if(rated) profile.ratings[group]=next
        profile.history=[{id:final.room.id,result:score===1?'Win':score===0?'Loss':'Draw',pool:group,delta:rated?Math.round(next.rating)-Math.round(old.rating):undefined},...profile.history].slice(0,100)
        await txn.put('profile/'+player.id,profile)
      }
      await txn.put('result/'+final.room.id,{...final,starts,applied:now})
    })
  }
  private async profileIn(txn:DurableObjectTransaction,user:Identity):Promise<Profile>{
    return await txn.get<Profile>('profile/'+user.id) ?? {user,ratings:{},history:[]}
  }
}

export default {
  async fetch(req:Request,env:Env):Promise<Response>{
    const url=new URL(req.url)
    if(url.hostname==='www.remorsechess.com'){
      url.hostname='remorsechess.com'
      return Response.redirect(url.href,301)
    }
    if(url.pathname.startsWith('/banner/'))return banner(url.pathname.slice(8))
    if(!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req)
    const endpoint=url.pathname.slice(5)
    if(endpoint==='api' || endpoint.length>120) return problem('Not found',404)
    const ip=req.headers.get('CF-Connecting-IP')
    if(ip && endpoint!=='health'){
      const heavy=endpoint==='rooms'||endpoint==='session'||endpoint.startsWith('auth/')
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
    if(endpoint==='session'){
      const resp=json({name:player.name,account:player.account,signIn,passkeys})
      if(!guestValid) resp.headers.append('set-cookie',setCookie(req,'remorse_guest',guest,86400*30))
      return resp
    }
    if(!profile && !guestValid) return problem('Start a guest session first',401)
    if(endpoint==='settings' && (req.method==='GET'||req.method==='POST')){
      if(!player.account)return problem('Sign in to sync settings',401)
      if(req.method==='GET')return json(await lobby(env).settings(player.id))
      const text=await req.text()
      if(text.length>2000)return problem('Settings are too large',413)
      const input=await new Response(text).json<Record<string,unknown>>().catch(()=>null)
      if(!input || typeof input!=='object' || Array.isArray(input))return problem('Invalid settings')
      return json(await lobby(env).settings(player.id,input))
    }
    if(endpoint==='profile' && req.method==='GET') return player.account?json(await lobby(env).profile(player)):problem('Sign in to view a profile',401)
    if(endpoint==='watch' && req.method==='GET') return json(await lobby(env).watch())
    if(endpoint==='leaders' && req.method==='GET') return json(await lobby(env).leaders())
    if((endpoint==='rooms' || endpoint==='queue') && req.method==='POST'){
      const body=await req.json<Partial<Control>&{rated?:boolean;cancel?:boolean}>().catch(()=>null)
      const control=body&&parseControl(body)
      if(!control) return problem('Choose a valid time control')
      const rated=body?.rated===true
      if(endpoint==='queue'){
        if(!control.seconds) return problem('Matchmaking requires a timed game')
        if(rated && !player.account) return problem('Sign in for ranked play',401)
        return json(await lobby(env).search(player,control,rated,body?.cancel===true))
      }
      const id=token()
      await room(env,id).initialize({id,control,seats:{white:player},rated:false,created:Date.now(),open:true})
      return json({id},201)
    }
    const parts=/^room\/([a-f0-9]{32})(?:\/(join|command|rematch|report|block|ws))?$/.exec(endpoint)
    if(parts){
      const action=parts[2] ?? 'snapshot'
      if(!['GET','POST'].includes(req.method) || (req.method==='POST')!==['join','command','rematch','report','block'].includes(action)) return problem('Method not allowed',405)
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
      return room(env,parts[1]).fetch(new Request(url.origin+'/'+action,{method:req.method,headers,body}))
    }
    return problem('Not found',404)
  },
} satisfies ExportedHandler<Env>

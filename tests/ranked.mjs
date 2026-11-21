// End-to-end test with an ephemeral software authenticator. No account secrets are saved.
import assert from 'node:assert/strict'
import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto'
import { encodeCBOR } from '@levischuck/tiny-cbor'
import { legal } from '../src/rules.ts'

const base=process.env.REMORSE_TEST_URL??'http://127.0.0.1:8787'
const hostname=new URL(base).hostname
const digest=value=>createHash('sha256').update(value).digest()
const b64=bytes=>Buffer.from(bytes).toString('base64url')
const clientData=(type,challenge)=>Buffer.from(JSON.stringify({type,challenge,origin:base,crossOrigin:false}))
function session(){
  const jar=new Map()
  const cookie=()=>[...jar].map(([k,v])=>k+'='+v).join('; ')
  const request=async(path,body,status=200)=>{
    const resp=await fetch(base+'/api/'+path,{
      method:body===undefined?'GET':'POST',
      headers:{cookie:cookie(),origin:base,'content-type':'application/json'},
      body:body===undefined?undefined:JSON.stringify(body),
    })
    for(const cookie of resp.headers.getSetCookie()){
      const [key,value]=cookie.split(';')[0].split('=')
      if(value)jar.set(key,value)
      else jar.delete(key)
    }
    const text=await resp.text()
    assert.equal(resp.status,status,text)
    return text?JSON.parse(text):undefined
  }
  request.cookie=cookie
  return request
}
async function register(client,name){
  assert.equal((await client('session')).passkeys,true)
  const challenge=await client('auth/passkey/start',{action:'register',name})
  const {privateKey,publicKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'})
  const {x,y}=publicKey.export({format:'jwk'})
  const credential=randomBytes(32)
  const cose=encodeCBOR(new Map([[1,2],[3,-7],[-1,1],[-2,Buffer.from(x,'base64url')],[-3,Buffer.from(y,'base64url')]]))
  const header=Buffer.alloc(23)
  header[0]=0x45
  header.writeUInt16BE(credential.length,21)
  const authData=Buffer.concat([digest(hostname),header,credential,cose])
  const response={
    id:b64(credential),rawId:b64(credential),type:'public-key',clientExtensionResults:{},
    response:{
      clientDataJSON:b64(clientData('webauthn.create',challenge.challenge)),
      attestationObject:b64(encodeCBOR(new Map([['fmt','none'],['attStmt',new Map()],['authData',authData]]))),
      transports:['internal'],
    },
  }
  assert.equal((await client('auth/passkey/finish',{action:'register',response})).ok,true)
  assert.equal((await client('session')).name,name)
  await client('auth/passkey/finish',{action:'register',response},409)
  return {privateKey,id:response.id,userHandle:challenge.user.id}
}
async function logBackIn(client,record){
  await client('auth/logout',{},204)
  assert.equal((await client('session')).account,false)
  const options=await client('auth/passkey/start',{action:'login'})
  const data=clientData('webauthn.get',options.challenge)
  const authData=Buffer.concat([digest(hostname),Buffer.from([0x05,0,0,0,0])])
  record.counter=(record.counter??0)+1
  authData.writeUInt32BE(record.counter,33)
  const signature=sign('sha256',Buffer.concat([authData,digest(data)]),record.privateKey)
  const response={id:record.id,rawId:record.id,type:'public-key',clientExtensionResults:{},
    response:{clientDataJSON:b64(data),authenticatorData:b64(authData),signature:b64(signature),userHandle:record.userHandle}}
  assert.equal((await client('auth/passkey/finish',{action:'login',response})).ok,true)
  assert.equal((await client('session')).account,true)
}
const a=session(),b=session()
const suffix=randomBytes(4).toString('hex')
const [key]=await Promise.all([register(a,'qa-a-'+suffix),register(b,'qa-b-'+suffix)])
await logBackIn(a,key)
const control={seconds:349,increment:2,rated:true}
assert.equal((await a('queue',control)).queued,true)
const {id}=await b('queue',control)
const room='room/'+id
const view=await a(room)
assert.equal(view.room.rated,true)
assert.equal(view.room.ratings.white.rating,1500)
const opponent=await b(room)
assert.notEqual(view.seat,opponent.seat)
await a(room+'/command',{id:crypto.randomUUID(),version:view.match.version,action:{type:'resign'}})
async function waitFor(check,description){
  for(let attempts=0;attempts<60;attempts++){
    const value=await check()
    if(value)return value
    await new Promise(resolve=>setTimeout(resolve,200))
  }
  throw Error(description)
}
const [left,right]=await waitFor(async()=>{
  const profiles=await Promise.all([a('profile'),b('profile')])
  if(profiles.every(p=>p.ratings.Blitz))return profiles
},'Ranked result never finalized')
assert.equal(left.ratings.Blitz.games,1);assert.equal(right.ratings.Blitz.games,1)
assert.ok(left.ratings.Blitz.rating<1500)
assert.ok(right.ratings.Blitz.rating>1500)
assert.equal(left.history[0].id,id)
assert.equal((await a('profile')).ratings.Blitz.games,1)
console.log('Ranked smoke passed: verified passkeys, sign-out/sign-in, rated pairing, and one rating update per account.')

const botTicket={seconds:351,increment:2,rated:true,searchId:crypto.randomUUID()}
const cancelledBotTicket={...botTicket,seconds:353,searchId:crypto.randomUUID()}
const early=await a('queue',{...botTicket,acceptBot:true})
assert.ok(early.botIn>0)
assert.equal(early.id,undefined)
assert.ok((await b('queue',{...cancelledBotTicket,acceptBot:true})).botIn>0)
await new Promise(resolve=>setTimeout(resolve,20_100))
const offered=await a('queue',botTicket)
assert.equal(offered.botIn,0)
assert.equal(offered.id,undefined)
const {id:botId}=await a('queue',{...botTicket,acceptBot:true})
assert.ok(botId)
assert.equal((await a('queue',{...botTicket,acceptBot:true})).id,botId)
const botRoom='room/'+botId
assert.equal((await b(botRoom)).match.start,0)
const {id:cancelledBotId}=await b('queue',{...cancelledBotTicket,acceptBot:true})
assert.ok(cancelledBotId)
assert.equal((await a('room/'+cancelledBotId)).match.start,0)
await b('queue',{...cancelledBotTicket,cancel:true})
await b('room/'+cancelledBotId,undefined,404)
assert.equal((await b('queue',cancelledBotTicket)).cancelled,true)
const human=await waitFor(async()=>{
  const state=await a(botRoom)
  if(state.match.game.side===state.seat)return state
},'The bot did not play as White')
assert.equal(human.room.rated,true)
assert.notEqual(human.seat,human.room.bot)
assert.equal(human.room[human.room.bot],'Opponent')
const action=legal(human.match.game).find(a=>a.type==='move')
assert.ok(action)
const played=await a(botRoom+'/command',{id:crypto.randomUUID(),version:human.match.version,action})
const answered=await waitFor(async()=>{
  const state=await a(botRoom)
  if(state.match.version>played.match.version&&state.match.game.side===state.seat)return state
},'The server bot did not answer the human move')
assert.equal(answered.match.log.at(-1).event.side,human.room.bot)
await a(botRoom+'/command',{id:crypto.randomUUID(),version:answered.match.version,action:{type:'resign'}})
const botResult=await waitFor(async()=>{
  const profile=await a('profile')
  if(profile.history[0]?.id===botId)return profile
},'Bot result never finalized')
assert.ok(botResult.history[0].delta<-12&&botResult.history[0].delta>=-34)
assert.equal(botResult.ratings.Blitz.games,left.ratings.Blitz.games)
assert.equal(botResult.ratings.Blitz.botGames,1)
assert.equal(botResult.ratings.Blitz.rd,left.ratings.Blitz.rd)
assert.equal((await b('profile')).ratings.Blitz.rating,right.ratings.Blitz.rating)
console.log('Ranked fallback smoke passed: delayed start, safe cancellation, server moves, and capped rating without changing human qualification.')

const guest=session()
await guest('session')
await guest('daily',undefined,401)
await a('daily',{action:'invite',days:4},400)
const {id:inviteId}=await a('daily',{action:'invite',days:10},201)
const inviteRoom='room/'+inviteId
assert.equal((await a('daily')).games[0].waiting,true)
await guest(inviteRoom+'/join',{},401)
const joined=await b(inviteRoom+'/join',{})
assert.equal(joined.match.control.days,10)
assert.equal(joined.match.clock.white,864_000_000)
assert.equal(joined.seat,'black')
assert.equal((await b('daily')).games[0].id,inviteId)
assert.equal((await a('daily')).games[0].turn,true)
const inviteMove=await a(inviteRoom+'/command',{id:crypto.randomUUID(),version:joined.match.version,action:{type:'move',from:12,to:28}})
assert.equal(inviteMove.match.clock.white,864_000_000)
assert.equal((await b('daily')).games[0].turn,true)
const dailyTicket={action:'find',days:3,requestId:crypto.randomUUID()}
assert.equal((await a('daily',dailyTicket)).queued,3)
assert.equal((await a('daily')).queued,3)
await logBackIn(a,key)
assert.equal((await a('daily')).queued,3)
const {id:pairedDaily}=await b('daily',{...dailyTicket,requestId:crypto.randomUUID()})
assert.ok(pairedDaily)
assert.equal((await a('daily',dailyTicket)).id,pairedDaily)
const dailyGames=await a('daily')
assert.equal(dailyGames.queued,null)
assert.deepEqual(new Set(dailyGames.games.map(g=>g.id)),new Set([inviteId,pairedDaily]))
const quickSearch={seconds:352,increment:7,rated:false,searchId:crypto.randomUUID()}
assert.equal((await a('queue',quickSearch)).queued,true)
await a('queue',{...quickSearch,cancel:true})
assert.equal((await a('daily',{...dailyTicket,days:2,requestId:crypto.randomUUID()})).queued,2)
await a('daily',{action:'cancel'})
assert.equal((await a('daily')).queued,null)
const dailyState=await a('room/'+pairedDaily)
await a('room/'+pairedDaily+'/command',{id:crypto.randomUUID(),version:dailyState.match.version,action:{type:'resign'}})
await waitFor(async()=>!(await a('daily')).games.some(game=>game.id===pairedDaily),'Completed Daily game remained active')
assert.equal((await waitFor(async()=>{const p=await a('profile');return p.history[0]?.id===pairedDaily?p:undefined},'Daily result was never saved')).history[0].pool,'Daily')
console.log('Daily smoke passed: account requirement, friend invites, per-turn clocks, persistent search, independent live queue, and saved history.')

await guest('friends',undefined,401)
const own=await a('profile')
const peer=await b('profile')
assert.equal(own.details.avatar,undefined)
const edit={displayName:'Test Knight',country:'CA',bio:'Testing profile and friend settings.'}
await a('profile',{...edit,country:'ZZ'},400)
await a('profile',{...edit,photo:'PHN2Zz4='},400)
const photo='/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCACgAKADASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFgEBAQEAAAAAAAAAAAAAAAAAAAEE/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8Al4CtAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/2Q=='
const saved=await a('profile',{...edit,photo})
assert.ok(saved.details.avatar)
assert.equal(saved.details.bio,edit.bio)
assert.equal((await b('players?q='+own.handle.toUpperCase()))[0].country,'CA')
assert.equal((await b(inviteRoom+'/player')).displayName,'Test Knight')
const picture=await fetch(base+'/api/avatar/'+own.handle,{headers:{cookie:b.cookie()}})
assert.equal(picture.headers.get('content-type'),'image/jpeg')
assert.equal(Buffer.from(await picture.arrayBuffer()).toString('base64'),photo)
await a('friends',{handle:own.handle,action:'add'},404)
await a('friends',{handle:peer.handle,action:'add'})
await a('friends',{handle:peer.handle,action:'add'})
assert.equal((await a('friends')).outgoing.length,1)
assert.equal((await b('friends')).incoming[0].handle,own.handle)
assert.equal((await b('player/'+own.handle)).online,undefined)
await a('friends',{handle:peer.handle,action:'accept'},409)
await b('friends',{handle:own.handle,action:'accept'})
const presenceSocket=new WebSocket(base.replace(/^http/,'ws')+'/api/presence',{headers:{cookie:a.cookie(),origin:base}})
await waitFor(async()=> (await b('friends')).friends.some(card=>card.handle===own.handle&&card.online),'Accepted friend did not appear online')
presenceSocket.close()
await waitFor(async()=> (await b('friends')).friends.some(card=>card.handle===own.handle&&card.online===false),'Friend stayed online after disconnect')
await a('profile',{...edit,photo:null})
assert.equal((await b('player/'+own.handle)).avatar,undefined)
await b(inviteRoom+'/block',{})
assert.equal((await a('friends')).friends.length,0)
assert.equal((await b('friends')).friends.length,0)
await a('friends',{handle:peer.handle,action:'add'},404)
console.log('Profile and friends smoke passed: validation, photo storage, search and opponent cards, request acceptance, real presence, privacy, and blocking.')

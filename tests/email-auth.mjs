import assert from 'node:assert/strict'
import { Miniflare, Response, convertV4MiniflareOptions } from 'miniflare'
import { digest } from '../src/email.ts'

const origin='https://remorsechess.com'
const mails=[]
const mf=new Miniflare(convertV4MiniflareOptions({workers:[{
  name:'auth-test',modules:true,scriptPath:process.argv[2]??'.wrangler/password-test/worker.js',
  compatibilityDate:'2025-04-01',compatibilityFlags:['nodejs_compat'],
  bindings:{RESEND_API_KEY:'local-test-key'},
  durableObjects:{ROOMS:{className:'Room',useSQLite:true},LOBBY:{className:'Lobby',useSQLite:true}},
  serviceBindings:{GAME_LIMIT:'limits',WRITE_LIMIT:'limits',EMAIL_LIMIT:'limits'},
  stripCfConnectingIp:true,
  outboundService:async request=>{
    assert.equal(request.url,'https://api.resend.com/emails')
    mails.push(await request.json())
    return Response.json({id:'local-test'})
  },
},{name:'limits',modules:true,script:'import {WorkerEntrypoint} from "cloudflare:workers"; export default class extends WorkerEntrypoint {limit(){return {success:true}}}'}]}))

function browser(session){
  const cookies=new Map(session?[['remorse_account',session]]:[])
  return async(path,data,status=200)=>{
    const response=await mf.dispatchFetch(origin+'/api/'+path,{
      method:data===undefined?'GET':'POST',
      headers:{origin,cookie:[...cookies].map(([k,v])=>k+'='+v).join('; '),'content-type':'application/json'},
      body:data===undefined?undefined:JSON.stringify(data),
    })
    for(const cookie of response.headers.getSetCookie()){
      const [key,value]=cookie.split(';')[0].split('=')
      if(value)cookies.set(key,value)
      else cookies.delete(key)
    }
    const body=await response.text()
    assert.equal(response.status,status,body)
    return body?JSON.parse(body):null
  }
}

try {
  const desktop=browser(), phone=browser(), passwordDevice=browser(), linkDevice=browser()
  for(const device of [desktop,phone,passwordDevice,linkDevice])assert.equal((await device('session')).account,false)
  const email='signup@example.com', password='startpass', replacement='resetpass'
  const start='auth/email/start', inspect='auth/email/inspect', finish='auth/email/finish', signIn='auth/email/password'
  const codeFor=mailbox=>mails.findLast(mail=>mail.to.includes(mailbox)).text.match(/#email=([a-f0-9]{64})/)[1]

  await desktop(start,{email,purpose:'signup'})
  const signup=codeFor(email)
  assert.equal((await phone(inspect,{code:signup})).kind,'signup')
  assert.equal((await phone('session')).account,false)
  await phone(finish,{code:signup,name:'EmailPlayer'},400)
  await phone(finish,{code:signup,name:'EmailPlayer',password:'eightchr'},400)
  await phone(finish,{code:signup,name:'EmailPlayer',password})
  const id=(await phone('profile')).user.id
  assert.equal((await phone('session')).emailLinked,true)
  await desktop(finish,{code:signup,name:'AnotherPlayer',password},403)
  await passwordDevice(signIn,{email,password:'a-long-wrong-password'},401)
  await passwordDevice(signIn,{email,password})
  assert.equal((await passwordDevice('profile')).user.id,id)

  const namespace=await mf.getDurableObjectNamespace('LOBBY','auth-test')
  const lobby=namespace.get(namespace.idFromName('global-v1'))
  // Reset the test mailbox cooldown without waiting a minute between flows.
  const clearCooldown=async mailbox=>lobby.discardEmail(await digest(codeFor(mailbox)),await digest(mailbox))
  await clearCooldown(email)
  await desktop(start,{email,purpose:'sign-in'})
  const link=codeFor(email)
  assert.equal((await linkDevice(inspect,{code:link})).kind,'sign-in')
  await linkDevice(finish,{code:link})
  assert.equal((await linkDevice('profile')).user.id,id)

  await clearCooldown(email)
  await desktop(start,{email,purpose:'reset'})
  assert.equal(mails.at(-1).subject,'Reset your Remorse Chess password')
  const reset=codeFor(email)
  assert.equal((await desktop(inspect,{code:reset})).kind,'reset')
  await desktop(finish,{code:reset},400)
  await desktop(finish,{code:reset,password:'eightchr'},400)
  await desktop(finish,{code:reset,password:replacement})
  assert.equal((await desktop('profile')).user.id,id)
  assert.equal((await passwordDevice('session')).account,false)
  await passwordDevice(signIn,{email,password},401)
  await passwordDevice(signIn,{email,password:replacement})
  await phone(finish,{code:reset,password},403)

  const sent=mails.length
  await phone(start,{email:'missing@example.com',purpose:'reset'})
  await phone(start,{email:'missing@example.com',purpose:'sign-in'})
  assert.equal(mails.length,sent)

  const legacy={id:'email:legacy',name:'LegacyPlayer',account:true}
  const legacyEmail='legacy@example.com'
  const legacySession='a'.repeat(32)
  await lobby.signIn(legacySession,legacy)
  const original=browser(legacySession), recovery=browser(), fresh=browser()
  for(const device of [original,recovery,fresh])await device('session')
  await original(start,{email:legacyEmail,link:true})
  await recovery(finish,{code:codeFor(legacyEmail)})
  assert.equal((await recovery('profile')).user.id,legacy.id)
  await fresh(signIn,{email:legacyEmail,password},401)
  await clearCooldown(legacyEmail)
  await original(start,{email:legacyEmail,purpose:'reset'})
  const setup=codeFor(legacyEmail)
  await fresh(finish,{code:setup,password})
  assert.equal((await fresh('profile')).user.id,legacy.id)
  await clearCooldown(email)
  await phone(start,{email,purpose:'signup'})
  const existingSignup=codeFor(email)
  assert.equal((await phone(inspect,{code:existingSignup})).kind,'sign-in')
  await fresh(finish,{code:existingSignup,name:'OtherPlayer',password},409)
  await phone(finish,{code:existingSignup,name:'OtherPlayer',password})
  assert.equal((await phone('profile')).user.id,id)
  const check=browser()
  await check('session')
  await check(signIn,{email,password:replacement})

  console.log('Email auth passed: signup, cross-device access, password sign-in, link sign-in, reset, and legacy accounts.')

  const waitFor=async (read,description)=>{
    for(let attempt=0;attempt<120;attempt++){
      const value=await read()
      if(value)return value
      await new Promise(resolve=>setTimeout(resolve,200))
    }
    throw Error(description)
  }
  const deleteAccount='auth/delete-account'
  const anonymous=browser()
  await anonymous('session')
  await anonymous(deleteAccount,{confirm:'DELETE'},401)
  await check(deleteAccount,{confirm:'delete'},400)

  const rival=await fresh('profile')
  const profile=await check('profile')
  await check('friends',{action:'add',handle:rival.handle})
  await fresh('friends',{action:'accept',handle:profile.handle})
  const clock={seconds:349,increment:2,rated:true}
  assert.equal((await check('queue',clock)).queued,true)
  const matchID=(await fresh('queue',clock)).id
  const room='room/'+matchID
  const initial=await check(room)
  const white=initial.seat==='white'?check:fresh
  const black=white===check?fresh:check
  const command=(player,version,action)=>player(room+'/command',{id:crypto.randomUUID(),version,action})
  const first=await command(white,initial.match.version,{type:'move',from:12,to:28})
  const response=await command(black,first.match.version,{type:'move',from:51,to:35})
  const capture=await command(white,response.match.version,{type:'move',from:28,to:35})
  assert.ok(capture.match.log.length>=3)
  await command(check,capture.match.version,{type:'resign'})
  const opponentBefore=await waitFor(async()=>{
    const account=await fresh('profile')
    return account.history[0]?.id===matchID?account:null
  },'Ranked game was never saved')
  assert.ok(opponentBefore.ratings.Blitz.games>0)
  const replayBefore=await anonymous(room)
  const ratingBefore=await fresh('rating-history?pool=Blitz')

  const deletion=await check(deleteAccount,{confirm:'DELETE'},202)
  assert.match(deletion.receipt,/^[a-f0-9]{32}$/)
  assert.equal((await check('session')).account,false)
  assert.equal((await phone('session')).account,false)
  await phone('profile',undefined,401)
  await phone(signIn,{email,password:replacement},401)
  await fresh('player/'+profile.handle,undefined,404)
  await waitFor(async()=>(await anonymous('account-deletion/'+deletion.receipt)).done,'Deletion receipt did not complete')

  const opponentAfter=await fresh('profile')
  assert.equal(opponentAfter.user.id,opponentBefore.user.id)
  assert.deepEqual(opponentAfter.ratings,opponentBefore.ratings)
  assert.deepEqual(opponentAfter.history,opponentBefore.history)
  assert.deepEqual(await fresh('rating-history?pool=Blitz'),ratingBefore)
  assert.ok(!(JSON.stringify(await fresh('friends'))).includes(profile.handle))
  const replayAfter=await anonymous(room)
  assert.deepEqual(replayAfter.match,replayBefore.match)
  assert.equal(replayAfter.room[initial.seat],'Deleted player')
  assert.notEqual(replayAfter.room[initial.seat==='white'?'black':'white'],'Deleted player')
  assert.ok(!JSON.stringify(replayAfter).includes(profile.handle))
  await desktop(start,{email,purpose:'signup'})
  const newSignup=codeFor(email)
  assert.equal((await desktop(inspect,{code:newSignup})).kind,'signup')
  await desktop(finish,{code:newSignup,name:'ReturningPlayer',password})
  assert.notEqual((await desktop('profile')).user.id,id)

  console.log('Account deletion passed: explicit confirmation, revocation, profile and friends removal, anonymized replays, and unaffected opponent ratings and history.')
}finally{
  await mf.dispose()
}

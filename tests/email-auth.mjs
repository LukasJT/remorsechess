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
  const control={seconds:180,increment:0,rated:true}
  assert.equal((await original('queue',control)).queued,true)
  const paired=await desktop('queue',control)
  assert.match(paired.id,/^[a-f0-9]{32}$/)
  const room='room/'+paired.id
  const {match}=await original(room)
  await original(room+'/command',{id:crypto.randomUUID(),version:match.version,action:{type:'resign'}})
  let prior
  for(let attempt=0;attempt<40;attempt++){
    prior=await original('profile')
    if(prior.history.some(game=>game.id===paired.id))break
    await new Promise(resolve=>setTimeout(resolve,250))
  }
  const priorHistory=await original('rating-history?pool=Blitz')
  assert.equal(prior.ratings.Blitz.games,1)
  assert.equal(priorHistory.events[0]?.id,paired.id)
  await original(start,{email:legacyEmail,link:true})
  await recovery(finish,{code:codeFor(legacyEmail)})
  assert.equal((await recovery('profile')).user.id,legacy.id)
  await fresh(signIn,{email:legacyEmail,password},401)
  await clearCooldown(legacyEmail)
  await original(start,{email:legacyEmail,purpose:'reset'})
  const setup=codeFor(legacyEmail)
  await fresh(finish,{code:setup,password})
  const existingProfile=await fresh('profile')
  assert.equal(existingProfile.user.id,legacy.id)
  assert.deepEqual(existingProfile.ratings,prior.ratings)
  assert.deepEqual(existingProfile.history,prior.history)
  assert.deepEqual(await fresh('rating-history?pool=Blitz'),priorHistory)
  assert.equal((await fresh(room)).match.game.result.reason,'Resignation')
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

  console.log('Email auth passed: signup, cross-device access, sign-in, reset, and legacy account ratings and game history.')
}finally{
  await mf.dispose()
}

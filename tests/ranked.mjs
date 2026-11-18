// End-to-end test with an ephemeral software authenticator. No account secrets are saved.
import assert from 'node:assert/strict'
import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto'
import { encodeCBOR } from '@levischuck/tiny-cbor'

const base=process.env.REMORSE_TEST_URL??'http://127.0.0.1:8787'
const hostname=new URL(base).hostname
const digest=value=>createHash('sha256').update(value).digest()
const b64=bytes=>Buffer.from(bytes).toString('base64url')
const clientData=(type,challenge)=>Buffer.from(JSON.stringify({type,challenge,origin:base,crossOrigin:false}))
function session(){
  const jar=new Map()
  return async(path,body,status=200)=>{
    const resp=await fetch(base+'/api/'+path,{
      method:body===undefined?'GET':'POST',
      headers:{cookie:[...jar].map(([k,v])=>k+'='+v).join('; '),origin:base,'content-type':'application/json'},
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
  const authData=Buffer.concat([digest(hostname),Buffer.from([0x05,0,0,0,1])])
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
for(let attempts=0;attempts<20;attempts++){
  const [left,right]=await Promise.all([a('profile'),b('profile')])
  if(left.ratings.Blitz && right.ratings.Blitz){
    assert.equal(left.ratings.Blitz.games,1);assert.equal(right.ratings.Blitz.games,1)
    assert.ok(left.ratings.Blitz.rating<1500)
    assert.ok(right.ratings.Blitz.rating>1500)
    assert.equal(left.history[0].id,id)
    const repeated=await a('profile')
    assert.equal(repeated.ratings.Blitz.games,1)
    console.log('Ranked smoke passed: verified passkeys, sign-out/sign-in, rated pairing, and one rating update per account.')
    process.exit(0)
  }
  await new Promise(resolve=>setTimeout(resolve,200))
}
throw Error('Ranked result never finalized')

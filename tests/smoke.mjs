import assert from 'node:assert/strict'
const origin=process.env.REMORSE_TEST_URL??'http://127.0.0.1:8787'
function browser(){
  let cookie=''
  const request=async(path,body,expected=200)=>{
    const res=await fetch(origin+'/api/'+path,{headers:{cookie,origin,'content-type':'application/json'},method:body===undefined?'GET':'POST',body:body===undefined?undefined:JSON.stringify(body)})
    const set=res.headers.get('set-cookie')
    if(set)cookie=set.split(';')[0]
    const data=await res.text()
    assert.equal(res.status,expected,data)
    return JSON.parse(data)
  }
  request.cookie=()=>cookie
  return request
}
const white=browser(),black=browser(),watch=browser()
const [w,b]=await Promise.all([white('session'),black('session'),watch('session')])
assert.notEqual(w.name,b.name)
const {id}=await white('rooms',{seconds:60,increment:1},201)
const room='room/'+id
assert.equal((await white(room)).seat,'white')
assert.equal((await black(room)).seat,null)
assert.equal((await black(room+'/join',{})).seat,'black')
assert.equal((await watch(room+'/join',{},409)).error,'Both seats are taken')
let version=(await white(room)).match.version
const ws=new WebSocket(origin.replace(/^http/,'ws')+'/api/'+room+'/ws',{headers:{cookie:white.cookie(),origin}})
function websocketVersion(){
  return new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(Error('No WebSocket update')),3000)
    ws.addEventListener('message',event=>{clearTimeout(timeout);resolve(JSON.parse(event.data).version)},{once:true})
    ws.addEventListener('error',()=>{clearTimeout(timeout);reject(Error('WebSocket connection failed'))},{once:true})
  })
}
assert.equal(await websocketVersion(),version)
const moveUpdate=websocketVersion()
const msg=(action)=>({version,id:crypto.randomUUID(),action})
const move=(from,to)=>({type:'move',from,to})
const commit=async(client,action)=>{
  const sent=msg(action)
  const response=await client(room+'/command',sent)
  version=response.match.version
  return {response,sent}
}
await watch(room+'/command',msg(move(12,28)),403)
const first=await commit(white,move(12,28))
assert.equal(await moveUpdate,version)
ws.close()
assert.equal((await white(room+'/command',first.sent)).match.version,version)
await black(room+'/command',{...msg(move(51,35)),version:0},409)
await commit(black,move(51,35))
const {response}=await commit(white,move(28,35))
const result=response.match.log.at(-1).event.roll
assert.ok(result>=1&&result<=6)
assert.equal((await watch(room)).match.log.at(-1).event.roll,result)
assert.equal((await white(room)).seat,'white')
await commit(black,{type:'resign'})
const final=await white(room)
assert.equal(final.match.game.result.winner,'white')
assert.equal(final.match.log.at(-1).result.reason,'Resignation')
const rematch=await black(room+'/rematch',{})
assert.equal((await black('room/'+rematch.id)).seat,'white')
await watch('room/'+rematch.id+'/join',{},409)
assert.equal((await white('room/'+rematch.id+'/join',{})).seat,'black')
const control={seconds:317,increment:3}
assert.equal((await white('queue',control)).queued,true)
const paired=await black('queue',control)
assert.ok(paired.id)
assert.equal((await white('queue',control)).id,paired.id)
const q=await white('room/'+paired.id)
assert.ok(q.seat)
assert.ok((await watch('watch')).some(game=>game.id===paired.id))
assert.equal(q.match.control.seconds,317)
const qOther=await black('room/'+paired.id)
await black('room/'+paired.id+'/command',{version:qOther.match.version,id:crypto.randomUUID(),action:{type:'resign'}})
const five={seconds:300,increment:0}
assert.equal((await white('queue',five)).queued,true)
const flexible=await black('queue',{seconds:180,increment:0,flexible:true})
assert.ok(flexible.id)
assert.equal((await white('queue',five)).id,flexible.id)
const flexibleGame=await white('room/'+flexible.id)
assert.equal(flexibleGame.match.control.seconds,300)
assert.equal(flexibleGame.room.rated,false)
await white('room/'+flexible.id+'/command',{version:flexibleGame.match.version,id:crypto.randomUUID(),action:{type:'resign'}})
const exact={seconds:302,increment:0}
assert.equal((await white('queue',exact)).queued,true)
assert.equal((await black('queue',{seconds:180,increment:0,flexible:true})).queued,true)
await white('queue',{...exact,cancel:true})
await black('queue',{seconds:180,increment:0,flexible:true,cancel:true})
const quick=await white('rooms',{seconds:1,increment:0},201)
await black('room/'+quick.id+'/join',{})
await new Promise(resolve=>setTimeout(resolve,1300))
assert.equal((await white('room/'+quick.id)).match.game.result?.reason,'Time expired')
console.log('Online smoke passed: independent seats, WebSocket updates, capture and roll replay, command deduplication, stale/spectator rejection, resignation, seat-swapped rematch, fixed and flexible matchmaking, cancel, and timeout.')

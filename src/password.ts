import { pbkdf2, randomBytes, timingSafeEqual } from 'node:crypto'
import { Buffer } from 'node:buffer'

export type PasswordRecord = {salt:string; hash:string; iterations:number}
const iterations=600_000
const dummy:PasswordRecord={salt:'0'.repeat(32),hash:'0'.repeat(64),iterations}

export function validPassword(password:unknown):password is string{
  return typeof password==='string'&&password.length<=256&&[...password].length>=15
}

function derive(password:string,{salt,iterations}:PasswordRecord){
  return new Promise<Buffer>((resolve,reject)=>{
    pbkdf2(password,Buffer.from(salt,'hex'),iterations,32,'sha256',(error,key)=>{
      if(error)reject(error)
      else resolve(key)
    })
  })
}

export async function hashPassword(password:string):Promise<PasswordRecord>{
  const record={salt:randomBytes(16).toString('hex'),hash:'',iterations}
  record.hash=(await derive(password,record)).toString('hex')
  return record
}

export async function matchesPassword(password:string,record?:PasswordRecord){
  const target=record??dummy
  const match=timingSafeEqual(await derive(password,target),Buffer.from(target.hash,'hex'))
  return Boolean(record)&&match
}

import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { Buffer } from 'node:buffer'

export type PasswordRecord = {salt:string; hash:string; algorithm:'scrypt-v1'}
const options={N:2**15,r:8,p:3,maxmem:48*1024*1024}
const dummy:PasswordRecord={salt:'0'.repeat(32),hash:'0'.repeat(64),algorithm:'scrypt-v1'}

export function validPassword(password:unknown):password is string{
  return typeof password==='string'&&password.length<=256&&[...password].length>=15
}

function derive(password:string,salt:string){
  return new Promise<Buffer>((resolve,reject)=>{
    scrypt(password,Buffer.from(salt,'hex'),32,options,(error,key)=>{
      if(error)reject(error)
      else resolve(key)
    })
  })
}

export async function hashPassword(password:string):Promise<PasswordRecord>{
  const salt=randomBytes(16).toString('hex')
  return {salt,hash:(await derive(password,salt)).toString('hex'),algorithm:'scrypt-v1'}
}

export async function matchesPassword(password:string,record?:PasswordRecord){
  const target=record?.algorithm==='scrypt-v1'?record:dummy
  const match=timingSafeEqual(await derive(password,target.salt),Buffer.from(target.hash,'hex'))
  return target!==dummy&&match
}

export type EmailRequest={hash:string;mailbox:string;expires:number;owner?:string}
export function normalizeEmail(input:unknown):string|null{
  if(typeof input!=='string')return null
  const email=input.trim().toLowerCase()
  const [local,domain,...rest]=email.split('@')
  if(email.length>254||rest.length||!local||local.length>64||!domain)return null
  if(!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local)||/^\.|\.\.|\.$/.test(local))return null
  if(!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(domain))return null
  return email
}
export async function digest(value:string){
  const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))
  return [...bytes].map(byte=>byte.toString(16).padStart(2,'0')).join('')
}
export async function sendSignIn(apiKey:string,email:string,link:string,idempotency:string,linking:boolean){
  return fetch('https://api.resend.com/emails',{
    method:'POST',signal:AbortSignal.timeout(12_000),
    headers:{authorization:'Bearer '+apiKey,'content-type':'application/json','idempotency-key':'remorse-auth/'+idempotency},
    body:JSON.stringify({
      from:'Remorse Chess <signin@auth.remorsechess.com>',to:[email],
      subject:linking?'Verify your Remorse Chess email':'Your Remorse Chess sign-in link',
      text:(linking?'Verify your email to add it to your existing Remorse Chess account.':'Open this link to sign in or create your Remorse Chess account.')+'\n\n'+link+'\n\nThe link expires in 15 minutes and can be used once. If you did not request it, ignore this message.',
    }),
  })
}

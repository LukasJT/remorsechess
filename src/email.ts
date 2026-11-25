export type EmailPurpose='sign-in'|'signup'|'reset'
export const minPasswordLength=9
export type EmailRequest={hash:string;mailbox:string;expires:number;owner?:string;ownerName?:string;purpose?:EmailPurpose}
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
export async function sendSignIn(apiKey:string,email:string,link:string,idempotency:string,purpose:EmailPurpose|undefined,accountName?:string){
  const subject=accountName?'Verify your Remorse Chess email':
    purpose==='reset'?'Reset your Remorse Chess password':
    purpose==='signup'?'Create your Remorse Chess account':'Your Remorse Chess sign-in link'
  const instructions=accountName?'Verify this email to sign in to the Remorse Chess account '+accountName+'. Continue only if this is your account.':
    purpose==='reset'?'Open this link to set a new password for your Remorse Chess account.':
    purpose==='signup'?'Open this link to verify your email and finish creating your account.':
    'Open this link to sign in to Remorse Chess.'
  return fetch('https://api.resend.com/emails',{
    method:'POST',signal:AbortSignal.timeout(12_000),
    headers:{authorization:'Bearer '+apiKey,'content-type':'application/json','idempotency-key':'remorse-auth/'+idempotency},
    body:JSON.stringify({
      from:'Remorse Chess <signin@auth.remorsechess.com>',to:[email],
      subject,
      text:instructions+' You can open the link on any device.\n\n'+link+'\n\nThe link expires in 15 minutes and can be used once. If you did not request it, ignore this message.',
    }),
  })
}

import {generateAuthenticationOptions,generateRegistrationOptions,verifyAuthenticationResponse,verifyRegistrationResponse,type AuthenticationResponseJSON,type RegistrationResponseJSON,type WebAuthnCredential} from '@simplewebauthn/server'

export type Ceremony={challenge:string;action:'register'|'login';name?:string;userId?:string;expires:number}
export type Passkey={credential:WebAuthnCredential;user:{id:string;name:string;account:true}}
export const accountName=(value:unknown)=>typeof value==='string'&&/^[a-zA-Z0-9_-]{3,20}$/.test(value)?value:null
export const canUsePasskeys=(url:URL)=>url.hostname==='remorsechess.com'||url.hostname==='localhost'||url.hostname==='127.0.0.1'

export async function registration(rpID:string,name:string,userId:string){
  return generateRegistrationOptions({
    rpName:'Remorse Chess',rpID,userName:name,userID:new TextEncoder().encode(userId),
    attestationType:'none',authenticatorSelection:{residentKey:'required',userVerification:'required'},
    supportedAlgorithmIDs:[-7,-257],
  })
}
export const authentication=(rpID:string)=>generateAuthenticationOptions({rpID,userVerification:'required'})
export async function verifyNew(url:URL,challenge:Ceremony,response:RegistrationResponseJSON):Promise<Passkey|null>{
  const result=await verifyRegistrationResponse({response,expectedChallenge:challenge.challenge,expectedOrigin:url.origin,expectedRPID:url.hostname,requireUserVerification:true,supportedAlgorithmIDs:[-7,-257]})
  if(!result.verified||!challenge.userId||!challenge.name)return null
  return {credential:result.registrationInfo.credential,user:{id:'passkey:'+challenge.userId,name:challenge.name,account:true}}
}
export async function verifyExisting(url:URL,challenge:Ceremony,response:AuthenticationResponseJSON,record:Passkey){
  if(response.response.userHandle){
    const expected=btoa(record.user.id.slice('passkey:'.length)).replace(/=+$/,'').replaceAll('+','-').replaceAll('/','_')
    if(response.response.userHandle!==expected)return null
  }
  const result=await verifyAuthenticationResponse({response,expectedChallenge:challenge.challenge,expectedOrigin:url.origin,expectedRPID:url.hostname,credential:record.credential,requireUserVerification:true})
  return result.verified?result.authenticationInfo.newCounter:null
}

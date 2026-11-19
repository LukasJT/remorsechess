export const countries=('AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ '+
  'CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR '+
  'GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP '+
  'KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ '+
  'NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ '+
  'TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW').split(' ')

export const maxBio=280
export const maxDisplayName=32
export const avatarSize=160
export const maxAvatarBytes=24_000
export const maxProfileBody=34_000

export type ProfileDetails={displayName:string;country:string;bio:string;avatar?:string}
export type ProfileEdit={displayName:string;country:string;bio:string;photo?:string|null}
export const emptyDetails:ProfileDetails={displayName:'',country:'',bio:''}

export type FriendStatus='incoming'|'outgoing'|'friend'
export type FriendAction='add'|'accept'|'decline'|'cancel'|'remove'
export type PlayerCard=ProfileDetails&{handle:string;status?:FriendStatus;online?:boolean}
export type FriendList={friends:PlayerCard[];incoming:PlayerCard[];outgoing:PlayerCard[]}

export const validHandle=(value:unknown):value is string=>typeof value==='string'&&/^[a-z0-9_-]{3,39}$/i.test(value)

function validPhoto(value:string){
  if(value.length>Math.ceil(maxAvatarBytes/3)*4||!/^[A-Za-z0-9+/]+={0,2}$/.test(value))return false
  try{
    const bytes=atob(value)
    if(bytes.length>maxAvatarBytes||!bytes.startsWith('\xff\xd8\xff')||!bytes.endsWith('\xff\xd9'))return false
    const word=(offset:number)=>bytes.charCodeAt(offset)*256+bytes.charCodeAt(offset+1)
    for(let offset=2;offset+4<bytes.length;){
      if(bytes.charCodeAt(offset++)!==0xff)return false
      while(bytes.charCodeAt(offset)===0xff)offset++
      const marker=bytes.charCodeAt(offset++)
      const length=word(offset)
      if(length<2||offset+length>bytes.length||marker===0xda||marker===0xd9)return false
      if(marker===0xc0||marker===0xc1||marker===0xc2)
        return length>=8&&word(offset+3)===avatarSize&&word(offset+5)===avatarSize
      offset+=length
    }
    return false
  }catch{return false}
}

export function parseProfileEdit(input:unknown):ProfileEdit|null{
  if(!input||typeof input!=='object'||Array.isArray(input))return null
  const {displayName,country,bio,photo}=input as Record<string,unknown>
  if(typeof displayName!=='string'||displayName.length>maxDisplayName||
    typeof bio!=='string'||bio.length>maxBio||typeof country!=='string'||
    (country!==''&&!countries.includes(country))||/\p{Cc}/u.test(displayName))return null
  if(photo!==undefined&&photo!==null&&(typeof photo!=='string'||!validPhoto(photo)))return null
  return {displayName:displayName.trim(),country,bio:bio.trim(),photo}
}

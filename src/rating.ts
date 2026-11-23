export type Rating = { rating:number; rd:number; volatility:number; games:number; updated:number; botGames?:number }
export type RatingImpact = { win:number; draw:number; loss:number; placement?:number; projected?: [number,number,number] }
export const defaultRating = (): Rating => ({rating:1500,rd:350,volatility:0.06,games:0,updated:0})
export const placementGames=10
export const countedGames=(r?:Rating)=>r ? r.games+(r.botGames??0) : 0
export const establishedRating=(r?:Rating)=>r&&countedGames(r)>=placementGames?Math.round(r.rating):null
const bounded=(rating:number)=>Math.max(100,Math.min(4000,rating))
export const placementPrior=():Rating=>({...defaultRating(),rating:600})
export type RatingEvent={id:string; time:number; sequence:number; pool:string; color:'white'|'black'; bot:boolean; score:number; opponent:number; opponentRD:number; before:Rating; after:Rating; rules?:number; model:1}
export const botRating:Rating={...defaultRating(),rd:90}
export const dailyRatedBotGames=3
export const settledBotRatingLimit=12

const scale = 173.7178
export const ratingDelta=(previous:Rating,next:Rating)=>Math.round(next.rating)-Math.round(previous.rating)
export function deviation(r:Rating, now:number) {
  const periods = r.updated ? Math.max(0,(now-r.updated)/86_400_000) : 0
  return Math.min(350,Math.hypot(r.rd, scale*r.volatility*Math.sqrt(periods)))
}
// Glickman's Glicko-2 single-result rating period, with daily inactivity inflation.
export function updateRating(p:Rating, opponent:Rating, score:number, now:number): Rating {
  const mu = (p.rating-1500)/scale
  const phi = deviation(p,now)/scale
  const opp = deviation(opponent,now)/scale
  const g = 1/Math.sqrt(1+3*opp*opp/Math.PI**2)
  const expected = 1/(1+Math.exp(-g*(mu-(opponent.rating-1500)/scale)))
  const variance = 1/(g*g*expected*(1-expected))
  const delta = variance*g*(score-expected)
  const a = Math.log(p.volatility**2)
  const tau = 0.5
  const f = (x:number) => {
    const e = Math.exp(x)
    return e*(delta**2-phi**2-variance-e)/(2*(phi**2+variance+e)**2) - (x-a)/(tau*tau)
  }
  let left=a, right=a-tau
  if (delta**2 > phi**2+variance) right=Math.log(delta**2-phi**2-variance)
  else while(f(right)<0) right-=tau
  for(let i=0;i<80 && Math.abs(right-left)>1e-7;i++){
    const middle=(left+right)/2
    if(f(left)*f(middle)<=0) right=middle
    else left=middle
  }
  const volatility=Math.exp((left+right)/4)
  const rd=1/Math.sqrt(1/(phi**2+volatility**2)+1/variance)
  return {...p,rating:bounded(1500+scale*(mu+rd**2*g*(score-expected))),rd:rd*scale,volatility,games:p.games+1,updated:now}
}
export function pool(seconds:number, increment:number) {
  const estimated=seconds+40*increment
  return estimated<180?'Bullet':estimated<600?'Blitz':'Rapid'
}
export function updateBotRating(p:Rating,opponent:Rating,score:number,now:number):Rating{
  const remaining=Math.max(0,placementGames-countedGames(p))
  const effective=remaining?p:{...p,rd:Math.min(deviation(p,now),110),updated:now}
  const candidate=updateRating(effective,opponent,score,now)
  const limit=remaining?130:settledBotRatingLimit
  const change=Math.max(-limit,Math.min(limit,candidate.rating-p.rating))
  return {...candidate,rating:bounded(p.rating+change),games:p.games,botGames:(p.botGames??0)+1}
}

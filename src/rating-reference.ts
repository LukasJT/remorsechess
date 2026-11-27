export const referenceDate='November 2023'
export const referenceSource='https://www.reddit.com/r/chess/comments/185zbsc/strength_comparison_between_lichess_and_chesscom/'
export const referenceCounts={
  Bullet:[493366,824660,995531,1031564,980373,842762,748335,565168,432683,347914,258471,198843,151409,114673,87906,66148,49067,35731,25443,19721,12583,8513,5647,3641,2271,1387,763,464,191,107,49,10,3],
  Blitz:[785099,1270841,1498682,1599681,1545694,1372253,1296455,1002793,802661,655561,509813,396868,303797,232510,178633,135285,100270,75517,51797,38672,24285,16152,10172,6330,3845,2121,1274,687,328,131,43,4,1],
  Rapid:[1461330,2561312,3249229,4022918,3931754,3604297,3386128,2777669,2139694,1683230,1266431,981197,683267,483887,341541,247377,166460,110442,69725,64766,25995,14011,6696,2635,813,242,118,23,7],
} as const
export type LivePool=keyof typeof referenceCounts
export function ratingDistribution(counts:readonly number[],first:number,step:number){
  const total=counts.reduce((sum,n)=>sum+n,0)
  let cumulative=0
  return counts.map((count,i)=>({rating:first+i*step,count,percentile: total ? 100*(cumulative+=count)/total : 0}))
}
export function referenceQuantile(group:LivePool,percentile:number){
  return ratingDistribution(referenceCounts[group],100,100).find(bucket=>bucket.percentile>=percentile)?.rating
}

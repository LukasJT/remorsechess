import { file,inCheck,rank,squares,type Game,type Kind,type Side } from './rules.ts'

export const prior=[
  100,315,335,505,935, // material
  -23,-60,38,-36,15,-9, // conditions, rescues and Berserker threshold
  5,5,13,29,12,8, // piece placement, development and pawn structure
  24,-85,-10,-26,9,39, // king safety, tempo and bonus phase
]
const unit:Record<Kind,number>={p:1,n:3.15,b:3.35,r:5.05,q:9.35,k:0}
const material:Record<Kind,number>={p:0,n:1,b:2,r:3,q:4,k:0}
const knightSteps=[[-1,-2],[1,-2],[-2,-1],[2,-1],[-2,1],[2,1],[-1,2],[1,2]]
export function features(game:Game):Float64Array{
  const vector=new Float64Array(prior.length)
  const board=squares(game)
  const pawns:{white:number[][];black:number[][]}={white:Array.from({length:8},()=>[]),black:Array.from({length:8},()=>[])}
  const bishops:{white:number[];black:number[]}={white:[],black:[]}
  for(const p of game.pieces){
    if(p.kind==='p')pawns[p.side][file(p.square)].push(p.side==='white'?rank(p.square):7-rank(p.square))
    if(p.kind==='b'&&p.mood!=='devastated'&&p.mood!=='bloodlust')bishops[p.side].push(p.square)
  }
  for(const p of game.pieces){
    const sign=p.side==='white'?1:-1
    const other=p.side==='white'?'black':'white'
    const x=file(p.square),y=rank(p.square)
    const advancement=p.side==='white'?y:7-y
    const center=3.5-Math.abs(x-3.5)+3.5-Math.abs(y-3.5)
    const value=unit[p.kind]
    const rescue=()=>bishops[p.side].some(s=>s!==p.square&&Math.abs(file(s)-x)<=1&&Math.abs(rank(s)-y)<=1)
    if(p.kind!=='k')vector[material[p.kind]]+=sign
    if(p.mood==='guilty'){vector[5]+=sign*value;if(rescue())vector[9]+=sign*value}
    if(p.mood==='devastated'){
      vector[6]+=sign*value*(1.15-.1*p.rescue)
      if(rescue())vector[9]+=sign*value
    }
    if(p.mood==='psychopath'){
      vector[7]+=sign*value
      if(p.kills>=2)vector[10]+=sign*value
    }
    if(p.mood==='bloodlust')vector[8]+=sign*value
    const usable=p.mood==='devastated'?0:p.mood==='bloodlust'?.3:1
    if(p.kind==='n'||p.kind==='b')vector[11]+=sign*usable*(center-2)
    if(p.kind==='p'){
      vector[12]+=sign*usable*advancement
      const enemyFiles=pawns[other].slice(Math.max(0,x-1),Math.min(8,x+2))
      if(advancement>=3&&enemyFiles.every(rows=>rows.every(row=>7-row<=advancement)))vector[14]+=sign*usable*(advancement-2)
      if(!pawns[p.side][x-1]?.length&&!pawns[p.side][x+1]?.length)vector[19]+=sign
    }
    if((p.kind==='n'||p.kind==='b')&&p.moved)vector[13]+=sign*usable
    if(p.kind==='r'&&!pawns[p.side][x].length)vector[15]+=sign*usable
    if(p.kind==='n'&&usable){
      for(const [dx,dy] of knightSteps){
        if(x+dx<0||x+dx>7||y+dy<0||y+dy>7)continue
        const target=board[(y+dy)*8+x+dx]
        if(!target||target.side!==p.side)vector[16]+=sign*usable
      }
    }
    if(p.kind==='k'){
      if(p.moved&&(x===2||x===6)&&advancement<=1)vector[17]+=sign
      if(p.rescue)vector[18]+=sign*(rescue()?2:12/p.rescue)
      if(inCheck(game,p.side))vector[20]+=sign*4
      if(game.pieces.length<12)vector[20]-=sign*center*.1
    }
  }
  vector[21]=game.side==='white'?1:-1
  vector[22]=game.bonus===null?0:vector[21]
  return vector
}
export function valueOf(game:Game,side:Side,weights:readonly number[]):number {
  if(game.result)return game.result.winner===null?0:game.result.winner===side?25_000:-25_000
  const values=features(game)
  let score=0
  for(let i=0;i<values.length;i++)score+=values[i]*weights[i]
  return side==='white'?score:-score
}

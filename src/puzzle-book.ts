import {initial,name,type Kind,type Game} from './rules.ts'

type Lesson=[string,string,number,number,string,string]
const lessons:Lesson[]=[
  ['Back rank relay','Capture the knight, then the rook.',6,1050,'B b1 n e4 r b7','b1e4 e4b7'],
  ['Royal fork','Capture the rook on the way to the king.',6,1400,'N d2 r e4 k f6','d2e4 e4f6'],
  ['Pass the torch','Take the bishop beside your own bishop so you can recover.',1,800,'P c4 b d5 p b5 B e6','c4d5'],
  ['Diagonal clearance','Capture the queen with check.',4,850,'B b2 q d4 k g7','b2d4'],
  ['The open rank','Take the knight and check the king along the file.',5,850,'R a4 n e4 k e8','a4e4'],
  ['Choose your trade','Take the queen with your least valuable attacker.',3,750,'P e4 R d1 q d5','e4d5'],
  ['Detour','Take the pawn before capturing the queen.',6,1200,'Q a2 p c4 q f4','a2c4 c4f4'],
  ['Double jump','Capture the bishop, then the rook.',6,1150,'N b1 b c3 r e4','b1c3 c3e4'],
  ['A safe freeze','Take the knight on a square next to your bishop.',1,900,'B b2 n e5 n c1 B f5','b2e5'],
  ['One last file','Capture the knight and finish on the king’s square.',6,1200,'R h3 n h6 k b6','h3h6 h6b6'],
  ['The volunteer','Take the queen in one turn.',6,900,'P e4 p d5 q c6','e4d5 d5c6'],
  ['Around the corner','Take the king on your bonus move.',6,1050,'R a2 p a5 k e5','a2a5 a5e5'],
  ['Fork with a follow-up','Win the queen in one turn.',6,1150,'N c3 p d5 q f6','c3d5 d5f6'],
  ['Switch diagonals','Take the king before Black can reply.',6,1250,'B c2 p f5 k c8','c2f5 f5c8'],
  ['Open file','Capture both enemy rooks this turn.',6,1000,'Q b2 r e5 r e7','b2e5 e5e7'],
  ['Safe landing','Take the rook and freeze beside your bishop.',1,750,'N c3 r d5 p b5 B e4','c3d5'],
  ['Under cover','Capture a knight where your bishop can absolve you.',2,850,'R d4 n a4 n d7 B c6','d4d7'],
  ['Last chance','Absolve the devastated queen before she disappears.',1,800,'B c3 Q d4 n e5','c3d4'],
  ['Crossed wires','Take the queen with a pawn, then take the rook.',6,950,'P e4 q f5 r g6','e4f5 f5g6'],
  ['The long way','Capture the bishop, then the queen in the same turn.',6,1350,'R b3 b b7 q f7','b3b7 b7f7'],
]
export const publicPuzzleIds={
  'the-volunteer':lessons.findIndex(([title])=>title==='The volunteer'),
  'last-chance':lessons.findIndex(([title])=>title==='Last chance'),
}
export const puzzleCount=lessons.length*4
export function puzzleAt(id:number){
  const [title,goal,face,strength,layout,line]=lessons[id%lessons.length]
  const variant=Math.floor(id/lessons.length)%4
  const flip=(sq:string)=>name((variant&1?7-(sq.charCodeAt(0)-97):sq.charCodeAt(0)-97)+8*(variant&2?8-Number(sq[1]):Number(sq[1])-1))
  const g:Game=initial()
  const tokens=('K h1 '+(layout.split(' ').includes('k')?'':'k h8 ')+layout).trim().split(/ +/)
  g.pieces=[];g.seen={};g.side=variant&2?'black':'white'
  for(let i=0;i<tokens.length;i+=2){
    const kind=tokens[i].toLowerCase() as Kind
    const side=tokens[i]===tokens[i].toUpperCase()?g.side:g.side==='white'?'black':'white'
    const sq=flip(tokens[i+1])
    const frozen=title==='Last chance'&&kind==='q'
    g.pieces.push({id:i,kind,side,square:sq.charCodeAt(0)-97+8*(Number(sq[1])-1),moved:true,roll:frozen?1:0,kills:frozen?1:0,rescue:frozen?1:0,mood:frozen?'devastated':'normal'})
  }
  return {title,goal:goal.replace('before Black can reply','before the opponent can reply'),face,strength,game:g,line:line.split(' ').map(m=>flip(m.slice(0,2))+flip(m.slice(2)))}
}

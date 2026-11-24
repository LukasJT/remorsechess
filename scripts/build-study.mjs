import {puzzleAt,publicPuzzleIds} from '../src/puzzle-book.ts'
import {at,name,legal,play} from '../src/rules.ts'
import {mkdir,readFile,writeFile} from 'node:fs/promises'
import {openings,replayStudy} from '../src/openings.ts'

const escape=text=>text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;')
const page=(title,description,route,content)=>`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)} | Remorse Chess</title><meta name="description" content="${escape(description)}"><link rel="canonical" href="https://remorsechess.com${route}"><link rel="icon" href="/favicon.png"><link rel="stylesheet" href="/guides.css"><link rel="stylesheet" href="/assets/study.css"></head><body><header class="site-header"><nav class="wrap nav-links" aria-label="Main navigation"><a href="/">Play</a> · <a href="/openings/">Openings</a> · <a href="/study/">Study</a> · <a href="/rules/">Rules</a> · <a href="/strategy/">Strategy</a></nav></header><main class="wrap"><h1>${escape(title)}</h1>${content}</main></body></html>`
const routes=[]
async function write(route,html){
  routes.push(route)
  await mkdir('dist'+route,{recursive:true})
  await writeFile('dist'+route+'index.html',html)
}
await write('/openings/',page('Remorse Chess opening explorer','Learn 19 familiar chess openings and explore where the Remorse Chess dice change the plan.','/openings/',`<p>Start with a familiar line, then study what changes when the first capture rolls a die.</p><p><label>Find an opening <input id="opening-search" type="search" autocomplete="off"></label></p><ul id="opening-list">${openings.map(([slug,title,eco])=>`<li><a href="/openings/${slug}/">${escape(title)}</a> · ${eco}</li>`).join('')}</ul><script type="module" src="/assets/study.js"></script>`))
for(const [slug,title,eco,line,description] of openings){
  for(const face of [1,2,3,4,5,6])replayStudy(line,face)
  const route='/openings/'+slug+'/'
  const squares=line.split(' ').map((m,i)=>(i%2?'':String(i/2+1)+'. ')+m.slice(0,2)+'–'+m.slice(2))
  await write(route,page(title+' in Remorse Chess',description,route,`<p><a href="/openings/">All openings</a> · ECO ${eco}</p><p>${escape(description)}</p><h2>Opening moves</h2><p>${squares.join(' ')}</p><section data-study="${slug}" aria-label="${escape(title)} interactive board"></section><p><a href="/study/">Variant exercises</a> · <a href="/openings/${slug==='scandinavian-defense'?'french-defense':'scandinavian-defense'}/">Related opening</a></p><p>Traditional names and ECO codes follow the <a href="https://github.com/lichess-org/chess-openings/tree/48a8c0e733facfdc9a3723fe882e51ec28014074">Lichess CC0 opening catalog</a>.</p><script type="module" src="/assets/study.js"></script>`))
}
await write('/study/',page('Study Remorse Chess','Explore bishop rescues, delayed trades and mandatory bonus turns through Remorse Chess opening exercises.','/study/',`<p>Use the <a href="/openings/">opening explorer</a> to step through a position, test dice outcomes and continue against a bot.</p><h2><a href="/study/styles/bishop-escort/">Bishop Escort</a></h2><p>In the <a href="/openings/italian-game/">Italian Game</a>, look for a bishop square adjacent to a likely first capturer. A diagonal neighbor counts even if the bishop cannot capture that square.</p><h2><a href="/study/styles/delayed-exchange/">Delayed Exchange</a></h2><p>In the <a href="/openings/queens-gambit-declined/">Queen’s Gambit Declined</a>, try keeping the exchange available until you can support the piece that takes. Compare the risk when the first-capture roll is a 1.</p><h2><a href="/study/styles/mandatory-bonus/">Bonus turns</a></h2><p>In the <a href="/openings/scandinavian-defense/">Scandinavian Defense</a>, select a six on the third action and find White’s mandatory continuation. Try a four next to see when Black can recapture immediately.</p>`))
const exercises=[
  ['bishop-escort','Bishop Escort','italian-game','Keep the bishop near the next exchange','Advance the Italian line to Bc4 and try Black’s Nf6. Identify a square adjacent to a new capture before you commit your attacking piece. A bishop may absolve from any of the eight neighboring squares. Check that moving the bishop there does not expose your king.'],
  ['delayed-exchange','Delayed Exchange','queens-gambit-declined','Leave a central capture available','Advance to the Queen’s Gambit Declined position. Compare developing a piece with exchanging on d5. In study mode set the die to 1 before cxd5 and see which bishop could reach the stranded pawn in time. Then repeat with a 4 and compare the same position after Black replies.'],
  ['mandatory-bonus','Mandatory Bonus Move','scandinavian-defense','Calculate the follow-up before taking','Advance the Scandinavian line through exd5 with the die set to 6. White must play d6. Branch on a 4 to restore Black’s immediate Qxd5 option. In a real game the six branch happens one time in six on the first capture.'],
]
for(const [slug,title,opening,lesson,description] of exercises){
  const route='/study/styles/'+slug+'/'
  await write(route,page(title,description,route,`<p><a href="/study/">All exercises</a></p><h2>${escape(lesson)}</h2><p>${escape(description)}</p><p><a href="/openings/${opening}/">Try it on the study board</a> · <a href="/rules/">Check the rules</a></p>`))
}
const featuredPuzzles=[
  {
    slug:'the-volunteer',title:'The Volunteer',
    question:'Can a pawn take two pieces in one turn in Remorse Chess?',
    description:'Roll a six and use a pawn’s mandatory bonus move to capture the black queen. Play The Volunteer puzzle.',
    answer:'Yes. In The Volunteer, White’s pawn on e4 captures the pawn on d5. The six makes it a psychopath. White must move that pawn again because it has a legal follow-up. From d5 it can capture the black queen on c6 before Black gets a turn.',
    rule:'/rules/#bonus',ruleLabel:'Read the bonus-move rule',
  },
  {
    slug:'last-chance',title:'Last Chance',
    question:'How can a bishop save a devastated queen?',
    description:'Use an adjacent bishop to save your devastated queen before her countdown expires.',
    answer:'Select the bishop on c3 and absolve the queen on d4. Diagonal neighbors count. Both pieces stay on their squares, the queen can move and capture again, and White’s turn ends. The die preview applies to a capture. Absolution spends a turn without rolling.',
    rule:'/rules/#absolution',ruleLabel:'Read the bishop absolution rule',
  },
]
const symbols={white:{p:'♙',n:'♘',b:'♗',r:'♖',q:'♕',k:'♔'},black:{p:'♟',n:'♞',b:'♝',r:'♜',q:'♛',k:'♚'}}
const pieceNames={p:'pawn',n:'knight',b:'bishop',r:'rook',q:'queen',k:'king'}
await write('/puzzles/',page('Remorse Chess puzzles','Play Remorse Chess tactics with the die result shown before your first capture.','/puzzles/',`<link rel="stylesheet" href="/public-puzzle.css"><section id="puzzle-workspace" aria-label="Puzzle workspace"><p>Know the next roll before you move. Try a pawn’s double capture or save a queen before she disappears.</p></section><section class="puzzle-library"><h2>Featured puzzles</h2><ul>${featuredPuzzles.map(p=>`<li><a href="/puzzles/${p.slug}/">${p.title}</a>. ${p.description}</li>`).join('')}</ul><p><a href="/rules/">Read the rules</a> · <a href="/">Play Remorse Chess</a></p></section><script type="module" src="/assets/puzzle.js"></script>`))
for(const p of featuredPuzzles){
  const id=publicPuzzleIds[p.slug]
  const puzzle=puzzleAt(id)
  let position=puzzle.game
  for(const move of puzzle.line){
    const action=legal(position).find(a=>a.type!=='end'&&name(a.from)+name(a.to)===move)
    position=play(position,action,()=>puzzle.face).game
  }
  const board=Array.from({length:64},(_,i)=>{
    const square=(7-(i>>3))*8+i%8
    const piece=at(puzzle.game,square)
    return `<span class="${(i%2)===(i>>3)%2?'light':'dark'}" aria-label="${name(square)}${piece?' '+piece.side+' '+pieceNames[piece.kind]:' empty'}">${piece?symbols[piece.side][piece.kind]:''}<small>${name(square)}</small></span>`
  }).join('')
  const route='/puzzles/'+p.slug+'/'
  await write(route,page(p.title,p.description,route,`<link rel="stylesheet" href="/public-puzzle.css"><p><a href="/puzzles/">All puzzles</a></p><p>White to move. ${escape(puzzle.goal)}</p><p><strong>Next capture roll: ${puzzle.face} · ${puzzle.face===6?'Psychopath':'Devastated'}</strong></p><button id="try-puzzle" hidden>Try this puzzle</button><section aria-label="Puzzle board" tabindex="-1" data-public-puzzle="${id}"><div class="puzzle-board" role="img" aria-label="Starting board. ${puzzle.game.pieces.map(piece=>piece.side+' '+pieceNames[piece.kind]+' on '+name(piece.square)).join(', ')}">${board}</div></section><h2>${p.question}</h2><p>${p.answer}</p><p><a href="${p.rule}">${p.ruleLabel}</a> · <a href="/">Play Remorse Chess</a></p><script type="module" src="/assets/puzzle.js"></script>`))
}
const sitemap=await readFile('dist/sitemap.xml','utf8')
const entries=routes.map(route=>`  <url><loc>https://remorsechess.com${route}</loc></url>`)
await writeFile('dist/sitemap.xml',sitemap.replace('</urlset>',[...entries,'</urlset>'].join(String.fromCharCode(10))))

import {puzzleAt,publicPuzzleIds} from '../src/puzzle-book.ts'
import {at,name,legal,play} from '../src/rules.ts'
import {mkdir,readFile,writeFile} from 'node:fs/promises'
import {openings,replayStudy} from '../src/openings.ts'
import {navIcon,staticSiteNavigation} from '../src/site-navigation.ts'
import {engravedPiece} from '../src/piece-art.ts'

const escape=text=>text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;')
const shellLinks='<link rel="stylesheet" href="/site-navigation.css"><link rel="stylesheet" href="/field-guide.css"><script type="module" src="/guide-nav.js"></script>'+
  '<noscript><style>@media(max-width:1079px){.guide-site #site-menu{display:none}.guide-site #site-nav{position:static;display:block;max-height:none}}</style></noscript>'
const crest=kind=>`<div class="guide-crest" aria-hidden="true">${engravedPiece(kind,'white')}</div>`
const emblem=icon=>`<span class="guide-emblem" aria-hidden="true">${navIcon(icon)}</span>`
const guideHero=(title,description,kind,actions='')=>`<header class="guide-hero"><div><h1>${escape(title)}</h1><p>${escape(description)}</p>${actions}</div>${crest(kind)}</header>`
const card=(title,description,href,icon)=>`<a class="guide-card" href="${href}">${emblem(icon)}<span><strong>${escape(title)}</strong><span>${escape(description)}</span></span><span aria-hidden="true">↗</span></a>`
const page=(title,description,route,content,{heading=title,intro=description,piece='n',actions=''}={})=>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#191827"><title>${escape(title)} | Remorse Chess</title><meta name="description" content="${escape(description)}"><link rel="canonical" href="https://remorsechess.com${route}"><link rel="icon" href="/favicon.png" type="image/png" sizes="96x96"><link rel="stylesheet" href="/guides.css"><link rel="stylesheet" href="/assets/study.css">${shellLinks}</head><body class="guide-site">${staticSiteNavigation(route)}<main class="wrap">${guideHero(heading,intro,piece,actions)}${content}</main></body></html>`
const routes=[]
async function write(route,html){
  routes.push(route)
  await mkdir('dist'+route,{recursive:true})
  await writeFile('dist'+route+'index.html',html)
}
const openingGroups=[
  ['King’s pawn','1. e4',line=>line.startsWith('e2e4')],
  ['Queen’s pawn','1. d4',line=>line.startsWith('d2d4')],
  ['Flank openings','1. c4 / Nf3',line=>!line.startsWith('e2e4')&&!line.startsWith('d2d4')],
]
const openingLibrary=openingGroups.map(([label,firstMove,matches],i)=>`<section class="opening-group" aria-labelledby="opening-group-${i}"><h3 id="opening-group-${i}"><span>${label}</span><code>${firstMove}</code></h3><ul>${openings.filter(([, , ,line])=>matches(line)).map(([slug,title,eco])=>`<li><a href="/openings/${slug}/"><span class="eco-code">${eco}</span><strong>${escape(title)}</strong><span class="line-arrow" aria-hidden="true">›</span></a></li>`).join('')}</ul></section>`).join('')
await write('/openings/',page('Remorse Chess opening explorer','Learn 19 familiar chess openings and explore where the Remorse Chess dice change the plan.','/openings/',`<section class="opening-directory" aria-labelledby="openings-title"><div class="directory-heading"><h2 id="openings-title">Opening library</h2><label for="opening-search"><span>Search openings</span><input id="opening-search" type="search" autocomplete="off" placeholder="Name or ECO code"></label></div><p id="opening-empty" role="status" hidden>No matching openings.</p><div id="opening-list">${openingLibrary}</div></section><script type="module" src="/assets/study.js"></script>`,{heading:'Opening explorer',piece:'n'}))
for(const [slug,title,eco,line,description] of openings){
  for(const face of [1,2,3,4,5,6])replayStudy(line,face)
  const route='/openings/'+slug+'/'
  const squares=line.split(' ').map((m,i)=>(i%2?'':String(i/2+1)+'. ')+m.slice(0,2)+'–'+m.slice(2))
  await write(route,page(title+' in Remorse Chess',description,route,`<section class="opening-line"><h2>Book line</h2><p>${squares.map((move,i)=>`<span data-book-ply="${i+1}">${escape(move)}</span>`).join('')}</p></section><section data-study="${slug}" aria-label="${escape(title)} interactive board"></section><div class="guide-links"><a href="/study/">Variant exercises</a><a href="/openings/${slug==='scandinavian-defense'?'french-defense':'scandinavian-defense'}/">Related opening</a></div><p class="guide-credit">Traditional names and ECO codes follow the <a href="https://github.com/lichess-org/chess-openings/tree/48a8c0e733facfdc9a3723fe882e51ec28014074">Lichess CC0 opening catalog</a>.</p><script type="module" src="/assets/study.js"></script>`,{heading:title,piece:'p',actions:`<div class="guide-links"><a href="/openings/">← All openings</a><span>ECO ${eco}</span></div>`}))
}
const exercises=[
  ['bishop-escort','Bishop Escort','italian-game','Keep the bishop near the next exchange','Advance the Italian line to Bc4 and try Black’s Nf6. Identify a square adjacent to a new capture before you commit your attacking piece. A bishop may absolve from any of the eight neighboring squares. Check that moving the bishop there does not expose your king.'],
  ['delayed-exchange','Delayed Exchange','queens-gambit-declined','Leave a central capture available','Advance to the Queen’s Gambit Declined position. Compare developing a piece with exchanging on d5. In study mode set the die to 1 before cxd5 and see which bishop could reach the stranded pawn in time. Then repeat with a 4 and compare the same position after Black replies.'],
  ['mandatory-bonus','Mandatory Bonus Move','scandinavian-defense','Calculate the follow-up before taking','Advance the Scandinavian line through exd5 with the die set to 6. White must play d6. Branch on a 4 to restore Black’s immediate Qxd5 option. In a real game the six branch happens one time in six on the first capture.'],
]
await write('/study/',page('Study Remorse Chess','Explore bishop rescues, delayed trades and mandatory bonus turns through Remorse Chess opening exercises.','/study/',`<section class="guide-section"><h2>Practice positions</h2><div class="guide-card-grid">${exercises.map(([slug,title,,lesson],i)=>card(title,lesson,'/study/styles/'+slug+'/',(['study','openings','dice'])[i])).join('')}</div></section><section class="guide-section"><h2>Learn the variant</h2><div class="guide-card-grid">${card('Openings','Step through a line, set the die, then play the position.','/openings/','openings')}${card('Rules','Look up every roll, bishop rescue, and bonus move.','/rules/','rules')}${card('Strategy','Work through three annotated positions.','/strategy/','rook')}${card('Puzzles','Solve tactics with the next roll on display.','/puzzles/','puzzles')}</div></section>`,{heading:'Study',piece:'b',actions:'<div class="guide-links"><a href="/openings/">Explore openings</a><a href="/">Play a game</a></div>'}))
for(const [slug,title,opening,lesson,description] of exercises){
  const route='/study/styles/'+slug+'/'
  await write(route,page(title,description,route,`<section class="guide-section"><h2>${escape(lesson)}</h2><p>${escape(description)}</p><div class="guide-links"><a href="/openings/${opening}/">Try it on the study board</a><a href="/rules/">Check the rules</a></div></section>`,{intro:lesson,piece:'b',actions:'<div class="guide-links"><a href="/study/">← All exercises</a></div>'}))
}
for(const [slug,piece] of [['rules','k'],['strategy','r'],['history','n']]){
  const route='/'+slug+'/'
  const html=await readFile('public'+route+'index.html','utf8')
  const illustrations={'♔':'k','♖':'r','♗':'b','♘':'n','♙':'p','♚':'k','♜':'r','♟':'p'}
  await writeFile('dist'+route+'index.html',html
    .replace('</head>',shellLinks+'</head>')
    .replace(/<body>[\s\S]*?<\/header>/,'<body class="guide-site">'+staticSiteNavigation(route))
    .replace('<div class="intro">','<div class="intro guide-hero guide-article-hero"><div>')
    .replace(/<\/div>\s*(<div class="guide-layout">)/,'</div>'+crest(piece)+'</div>$1')
    .replace(/(<th scope="row">)([1–6]+)(<\/th>)/g,'$1<span>$2</span>$3')
    .replace(/(<span class="(white|black)-piece"[^>]*>)([^<]+)(<\/span>)/g,(match,start,color,symbol,end)=>
      illustrations[symbol]?start+engravedPiece(illustrations[symbol],color)+end:match))
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
await write('/puzzles/',page('Remorse Chess puzzles','Play Remorse Chess tactics with the die result shown before your first capture.','/puzzles/',`<link rel="stylesheet" href="/public-puzzle.css"><section id="puzzle-workspace" aria-label="Puzzle workspace"><p>Know the next roll before you move. Try a pawn’s double capture or save a queen before she disappears.</p></section><section class="guide-section puzzle-library"><h2>Featured puzzles</h2><div class="guide-card-grid">${featuredPuzzles.map(p=>card(p.title,p.description,'/puzzles/'+p.slug+'/','puzzles')).join('')}</div></section><script type="module" src="/assets/puzzle.js"></script>`,{heading:'Puzzles',piece:'q'}))
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

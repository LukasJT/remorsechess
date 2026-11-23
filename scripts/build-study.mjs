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
const sitemap=await readFile('dist/sitemap.xml','utf8')
const entries=routes.map(route=>`  <url><loc>https://remorsechess.com${route}</loc></url>`)
await writeFile('dist/sitemap.xml',sitemap.replace('</urlset>',[...entries,'</urlset>'].join(String.fromCharCode(10))))

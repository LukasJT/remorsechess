import './board-annotations.js'
import {openPuzzles} from './puzzles.ts'

const host=document.querySelector<HTMLElement>('[data-public-puzzle]')
const start=document.querySelector<HTMLButtonElement>('#try-puzzle')
if(host&&start){
  start.hidden=false
  start.onclick=()=>{
    start.hidden=true
    void openPuzzles(html=>{host.innerHTML=html},undefined,()=>Promise.reject(new Error('Public puzzles are unrated')),Number(host.dataset.publicPuzzle))
    host.focus()
  }
}
const workspace=document.querySelector<HTMLElement>('#puzzle-workspace')
async function request<T>(path:string,data?:unknown):Promise<T>{
  const result=await fetch('/api/'+path,data===undefined?undefined:{
    method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data),
  })
  if(!result.ok)throw new Error('Puzzle service unavailable')
  return result.json()
}
if(workspace){
  void request<{name:string;account:boolean}>('session').catch(()=>null).then(session=>
    openPuzzles(()=>{},session?.account?session.name:undefined,request,undefined,workspace)
  ).catch(()=>{
    workspace.innerHTML='<p role="status">Could not load your puzzles. <a href="/puzzles/">Reload puzzles</a>.</p>'
  })
}

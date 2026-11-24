import type {Kind,Side} from './rules.ts'

export function engravedPiece(kind:Kind,side:Side){
  return '<img class="engraved-piece" src="/after-hours/'+side+'-'+kind+'.svg" alt="" draggable="false">'
}

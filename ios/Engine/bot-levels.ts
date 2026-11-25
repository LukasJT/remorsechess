export const difficulties={
  rookie:{name:'Rookie',description:'Looks ahead and occasionally misses a tactic.',depth:1,beam:3,roots:12,budget:900,mistake:.15},
  tactical:{name:'Tactician',description:'Searches replies, likely recaptures, and bishop rescues.',depth:2,beam:5,roots:15,budget:5200,mistake:0},
  expert:{name:'Grandmaster',description:'Searches more replies and extends forcing captures and bonus turns.',depth:3,beam:6,roots:18,budget:16_000,mistake:0},
  ranked:{name:'Ranked',description:'Searches wider and deeper, including forcing captures and bonus turns.',depth:4,beam:8,roots:24,budget:46_000,mistake:0},
} as const
export type Difficulty=keyof typeof difficulties

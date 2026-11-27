export const maxScientistElo=1400

export const scientistBots=[
  {id:'pascal', name:'Blaise Pascal', label:'Pascal', elo:100},
  {id:'plato', name:'Plato', label:'Plato', elo:200},
  {id:'socrates', name:'Socrates', label:'Socrates', elo:300},
  {id:'pythagoras', name:'Pythagoras', label:'Pythagoras', elo:400},
  {id:'darwin', name:'Charles Darwin', label:'Darwin', elo:500},
  {id:'archimedes', name:'Archimedes', label:'Archimedes', elo:600},
  {id:'lovelace', name:'Ada Lovelace', label:'Lovelace', elo:700},
  {id:'galileo', name:'Galileo Galilei', label:'Galileo', elo:800},
  {id:'tesla', name:'Nikola Tesla', label:'Tesla', elo:900},
  {id:'bohr', name:'Niels Bohr', label:'Bohr', elo:1000},
  {id:'newton', name:'Isaac Newton', label:'Newton', elo:1050},
  {id:'curie', name:'Marie Curie', label:'Curie', elo:1150},
  {id:'feynman', name:'Richard Feynman', label:'Feynman', elo:1250},
  {id:'hawking', name:'Stephen Hawking', label:'Hawking', elo:1350},
  {id:'einstein', name:'Albert Einstein', label:'Einstein', elo:1400},
  {id:'oppenheimer', name:'J. Robert Oppenheimer', label:'Oppenheimer', elo:1500},
  {id:'planck', name:'Max Planck', label:'Planck', elo:1600},
  {id:'heisenberg', name:'Werner Heisenberg', label:'Heisenberg', elo:1750},
  {id:'euler', name:'Leonhard Euler', label:'Euler', elo:1900},
] as const

export type ScientistBot=(typeof scientistBots)[number]

export function scientistPortrait(bot:ScientistBot){
  return '<img class="scientist-avatar" src="/scientists/'+bot.id+'.png" width="64" height="64" alt="">'
}

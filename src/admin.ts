export type AdminUser={
  handle:string
  playerNumber?:number
  admin?:boolean
  displayName?:string
  registeredWith:'passkey'|'email'|'github'
  emailLinked:boolean
  createdAt?:number
  gamesPlayed:number
  totalIsMinimum:boolean
  ratedGames:number
  country?:string
}

export type AdminUsers={users:AdminUser[];internal:AdminUser[];next?:string}

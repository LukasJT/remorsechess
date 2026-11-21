export type AdminUser={
  handle:string
  displayName?:string
  registeredWith:'passkey'|'email'|'github'
  emailLinked:boolean
  createdAt?:number
}

export type AdminUsers={users:AdminUser[];next?:string}

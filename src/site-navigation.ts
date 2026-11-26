const navIcons={
  play:'<path d="m9 5 11 7-11 7z"/>',
  daily:'<rect x="4" y="6" width="16" height="14" rx="1"/><path d="M8 3v6m8-6v6M4 11h16"/>',
  bot:'<rect x="5" y="8" width="14" height="12" rx="2"/><path d="M12 4v4m-4 5h1m6 0h1m-7 4h6"/>',
  watch:'<path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2"/>',
  openings:'<rect x="4" y="4" width="16" height="16"/><path d="M12 4v16M4 12h16"/>',
  study:'<path d="M12 19c-2-2-5-3-9-2V5c4-1 7 0 9 2 2-2 5-3 9-2v12c-4-1-7 0-9 2zm0-12v12"/>',
  rules:'<path d="M6 3h9l4 4v14H6zm9 0v5h4M9 12h7m-7 4h7"/>',
  ratings:'<path d="M4 4v16h16M8 15l4-4 3 2 5-6"/>',
  friends:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2m2-15a3 3 0 0 1 0 6m0 3a5 5 0 0 1 4 4v2"/>',
  profile:'<circle cx="12" cy="8" r="4"/><path d="M5 21v-1a7 7 0 0 1 14 0v1"/>',
  settings:'<path d="M5 6h14M5 12h14M5 18h14M9 4v4m6 2v4m-5 2v4"/>',
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  rook:'<path d="M5 3h3v4h2V3h4v4h2V3h3v6l-3 2v5l2 2v3H6v-3l2-2v-5L5 9zM8 11h8M6 18h12"/>',
  bullet:'<path d="M10 13c0-4 5-8 10-9-1 5-5 10-9 10Zm0 0-3 4m1-5-4 4m7-1-3 5"/>',
  blitz:'<path d="m14 2-9 12h6l-1 8 9-12h-6z"/>',
  clock:'<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M10 2h4m4 4 2-2"/>',
  dice:'<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 8h.01m8 0h.01m-4 4h.01m-4 4h.01m8 0h.01" stroke-width="3"/>',
  puzzles:'<path d="M4 4h6v2a2 2 0 1 0 4 0V4h6v6h-2a2 2 0 0 0 0 4h2v6h-6v-2a2 2 0 0 0-4 0v2H4v-6h2a2 2 0 0 0 0-4H4z"/>',
}
export const navIcon=(key:keyof typeof navIcons)=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+navIcons[key]+'</svg>'

export const sectionLinks = [
  [
    ['play','Play','/','home'],
    ['daily','Daily games','/#daily','daily-tab'],
    ['bot','Practice vs bot','/#bots','bot'],
    ['watch','Watch','/#watch','watch'],
  ],
  [
    ['puzzles','Puzzles','/puzzles/',''],
    ['openings','Openings','/openings/',''],
    ['study','Study','/study/',''],
    ['rules','Rules','/rules/',''],
    ['rook','Strategy','/strategy/',''],
  ],
] as const

export function navLink(icon:keyof typeof navIcons,label:string,href?:string,action?:string,active=false){
  const content='<span class="nav-emblem">'+navIcon(icon)+'</span><span>'+label+'</span>'
  const attributes=(action?' data-do="'+action+'"':'')+(active?' aria-current="page"':'')
  return href?'<a href="'+href+'"'+attributes+'>'+content+'</a>':'<button type="button"'+attributes+'>'+content+'</button>'
}

export function navGroup(label:string,items:string){
  return '<div class="site-nav-group" role="group" aria-label="'+label+'">'+items+'</div>'
}

export function siteHeader(interactive=false){
  const action=(name:string)=>interactive?' data-do="'+name+'"':''
  return '<header class="site-bar"><button type="button" id="site-menu"'+action('site-menu')+' aria-controls="site-nav" aria-expanded="false">'+
    navIcon('menu')+'<span>Menu</span></button><a href="/" class="logo"'+action('home')+'><img src="/after-hours/horse-icon.webp" width="44" height="47" alt=""><b>Remorse <span>Chess</span></b></a></header>'
}

export function staticSiteNavigation(path:string){
  const groups=sectionLinks.map((links,i)=>navGroup(i?'Learn':'Play',links.map(([icon,label,href])=>
    navLink(icon,label,href,undefined,href!=='/'&&path.startsWith(href))
  ).join(''))).join('')
  return siteHeader()+'<nav id="site-nav" aria-label="Main navigation">'+groups+
    navGroup('Community and account',navLink('ratings','Ratings','/#leaders')+navLink('ratings','Rating history','/#stats')+
      navLink('friends','Friends','/#friends')+navLink('profile','Profile','/#profile')+navLink('settings','Settings','/#settings'))+'</nav>'
}

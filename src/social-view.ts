import {countries,maxBio,maxDisplayName,type FriendList,type PlayerCard,type ProfileDetails} from './social.ts'
import {countedGames,establishedRating,type Rating} from './rating.ts'

export const escapeHTML=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!))
const s=escapeHTML
const countryNames=typeof Intl.DisplayNames==='function'?new Intl.DisplayNames(['en'],{type:'region'}):null
const countryName=(code:string)=>countryNames?.of(code)??code
const display=(card:PlayerCard)=>card.displayName||card.handle

export type ProfilePage={handle:string;user:{name:string};details:ProfileDetails;
  ratings:Record<string,Rating>;history:{id:string;pool:string;result:string;delta?:number}[]}

function flag(code:string){
  const index=countries.indexOf(code)
  if(index<0)return ''
  const left=(index%16)*100/15,top=Math.floor(index/16)*100/15
  return '<span class="profile-country"><span class="country-flag" aria-hidden="true" style="background-position:'+left+'% '+top+'%"></span>'+s(countryName(code))+'</span>'
}

function avatar(card:PlayerCard){
  const monogram=s([...display(card)][0]?.toUpperCase()||'?')
  return '<span class="profile-avatar" aria-hidden="true">'+monogram+
    (card.avatar?'<img src="/api/avatar/'+encodeURIComponent(card.handle)+'?v='+encodeURIComponent(card.avatar)+'" alt="" width="160" height="160" loading="lazy">':'')+'</span>'
}

function socialNav(current:'profile'|'friends',admin=false){
  return '<nav class="social-nav" aria-label="Account"><a data-do="profile" href="/#profile"'+(current==='profile'?' aria-current="page"':'')+'>Profile</a>'+
    '<a data-do="friends" href="/#friends"'+(current==='friends'?' aria-current="page"':'')+'>Friends</a>'+
    (admin?'<a data-do="admin" href="/#admin">Users</a>':'')+'</nav>'
}

export function profileView(profile:ProfilePage,linkEmail:boolean,admin=false){
  const card={handle:profile.handle,...profile.details}
  const ratings=['Bullet','Blitz','Rapid'].map(group=>{
    const rating=profile.ratings[group]
    return '<div><dt>'+group+'</dt><dd>'+(establishedRating(rating)??(countedGames(rating)+'/10'))+'</dd></div>'
  }).join('')
  const history=profile.history.map(game=>'<li><a href="/?game='+encodeURIComponent(game.id)+'">'+s(game.pool)+' · '+s(game.result)+
    (game.delta===undefined?'':' · '+(game.delta>=0?'+':'')+game.delta)+'</a></li>').join('')
  return socialNav('profile',admin)+'<div class="profile-summary">'+avatar(card)+'<div><h1>'+s(card.displayName||profile.user.name)+'</h1>'+
    '<p class="profile-handle">@'+s(card.handle)+'</p>'+flag(card.country)+'</div><button class="primary" data-do="edit-profile">Edit profile</button></div>'+
    (card.bio?'<p class="profile-bio">'+s(card.bio)+'</p>':'')+'<dl class="profile-ratings">'+ratings+'</dl><a href="/#stats" data-do="stats">Rating history</a>'+
    '<h2>Game history</h2>'+(history?'<ul class="profile-history">'+history+'</ul>':'<p>No completed games yet.</p>')+
    '<div class="tools profile-tools">'+(linkEmail?'<button data-do="link-email">Add email sign-in</button>':'')+'<button data-do="logout">Sign out</button></div>'
}

export function profileEditor(profile:ProfilePage){
  const card={handle:profile.handle,...profile.details}
  const options=countries.map(code=>({code,label:countryName(code)})).sort((a,b)=>a.label.localeCompare(b.label))
  return '<h2>Edit profile</h2><form id="profile-edit" class="profile-edit">'+
    '<p class="profile-disclosure">Signed-in players can see these details. Your username is @'+s(profile.handle)+'.</p>'+
    '<label>Display name<input name="displayName" maxlength="'+maxDisplayName+'" value="'+s(card.displayName)+'" autocomplete="nickname"></label>'+
    '<label>Country<select name="country"><option value="">Choose later</option>'+options.map(({code,label})=>
      '<option value="'+code+'"'+(card.country===code?' selected':'')+'>'+s(label)+'</option>').join('')+'</select></label>'+
    '<label>Bio<textarea name="bio" rows="4" maxlength="'+maxBio+'">'+s(card.bio)+'</textarea></label>'+
    '<div class="profile-photo-field">'+avatar(card)+'<div><label>Profile picture<input type="file" name="photo" accept="image/jpeg,image/png,image/webp"></label>'+
    (card.avatar?'<label class="remove-photo"><input type="checkbox" name="removePhoto"> Remove current picture</label>':'')+'</div></div>'+
    '<button class="primary">Save profile</button><p id="profile-edit-status" role="status"></p></form>'
}

function friendActions(card:PlayerCard){
  const action=(key:string,label:string,style='')=>'<button type="button" class="'+style+'" data-friend-action="'+key+'" data-handle="'+s(card.handle)+'">'+label+'</button>'
  switch(card.status){
    case 'incoming':return action('accept','Accept','primary')+action('decline','Decline')
    case 'outgoing':return '<small>Request sent</small>'+action('cancel','Cancel request')
    case 'friend':return action('remove','Remove friend')
    default:return action('add','Add friend','primary')
  }
}

function presence(card:PlayerCard){
  return card.status==='friend'?'<span class="friend-presence'+(card.online?' is-online':'')+'">'+(card.online?'Online':'Offline')+'</span>':''
}

function playerRow(card:PlayerCard){
  return '<li class="social-row">'+avatar(card)+'<div class="social-person"><button type="button" class="link player-link" data-player="'+s(card.handle)+'">'+s(display(card))+'</button>'+
    '<small>@'+s(card.handle)+'</small>'+flag(card.country)+presence(card)+'</div><div class="social-actions">'+friendActions(card)+'</div></li>'
}

const playerRows=(cards:PlayerCard[])=>'<ul class="social-list">'+cards.map(playerRow).join('')+'</ul>'

export function playerDialog(card:PlayerCard){
  return '<h2 id="player-title">'+s(display(card))+'</h2><div class="profile-summary public-profile">'+avatar(card)+
    '<div><p class="profile-handle">@'+s(card.handle)+'</p>'+flag(card.country)+presence(card)+'</div></div>'+
    (card.bio?'<p class="profile-bio">'+s(card.bio)+'</p>':'')+
    '<div class="social-actions">'+friendActions(card)+'</div><p id="player-action-status" role="status"></p>'
}

export function friendsGroups(list:FriendList){
  return (list.incoming.length?'<section><h2>Friend requests</h2>'+playerRows(list.incoming)+'</section>':'')+
    '<section><h2>Your friends <small>'+list.friends.filter(friend=>friend.online).length+' online</small></h2>'+
    (list.friends.length?playerRows(list.friends):'<p>No friends yet. Search for a player to send a request.</p>')+'</section>'+
    (list.outgoing.length?'<section><h2>Sent requests</h2>'+playerRows(list.outgoing)+'</section>':'')
}

export const playerResults=(cards:PlayerCard[])=>cards.length?playerRows(cards):'<p>No matching players found.</p>'

export function friendsView(list:FriendList){
  return socialNav('friends')+'<h1>Friends</h1>'+
    '<form id="friend-search" class="friend-search"><label for="friend-query">Find by username</label><div><input id="friend-query" name="query" type="search" autocomplete="off" minlength="3" maxlength="39" placeholder="Player username" required><button class="primary">Find players</button></div></form>'+
    '<p id="friends-status" role="status"></p><div id="people-results"></div><div id="friend-groups">'+friendsGroups(list)+'</div>'
}

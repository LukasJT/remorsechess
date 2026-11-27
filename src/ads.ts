const units={
  desktop:{key:'5bcfa664e6af6cf981d56f754bea9396',width:728,height:90},
  mobile:{key:'56c1e0e5d75ba44c14f8fe8d56807262',width:320,height:50},
  'match-left':{key:'b5af81059a8f352004dbb4f0f129c5b2',width:160,height:300},
  'match-right':{key:'f7e2f84901931682b6a72f13eeb2387a',width:160,height:600},
}
function banner(format:string):Response{
  if(!Object.hasOwn(units,format))return new Response('Unknown banner',{status:404})
  const unit=units[format as keyof typeof units]
  const html='<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Advertisement</title>'+
    '<style>html,body{padding:0;margin:0;overflow:hidden;background:transparent}iframe{display:block;border:0}</style><body>'+
    '<script>window.atOptions='+JSON.stringify({...unit,format:'iframe',params:{}})+'</script>'+
    '<script src="https://bauval.org/22/'+unit.key+'"></script></body></html>'
  return new Response(html,{headers:{
    'content-type':'text/html; charset=utf-8',
    'cache-control':'no-store',
    'x-robots-tag':'noindex',
    // Adsterra evaluates its creative script, writes into a child frame, and reads cookies.
    // This worker serves only banners on an origin outside the game domain.
    'content-security-policy':"default-src 'none'; script-src https: 'unsafe-inline' 'unsafe-eval'; style-src https: 'unsafe-inline'; frame-src https:; img-src https: data:; font-src https: data:; connect-src https:; frame-ancestors https://remorsechess.com; base-uri 'none'; form-action 'none'; sandbox allow-scripts allow-popups allow-same-origin",
    'referrer-policy':'strict-origin-when-cross-origin',
  }})
}

export default {
  fetch(req:Request){
    const match=/^\/banner\/([a-z-]+)$/.exec(new URL(req.url).pathname)
    return match?banner(match[1]):new Response('Not found',{status:404})
  },
}

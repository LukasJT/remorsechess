const units={
  desktop:{key:'5bcfa664e6af6cf981d56f754bea9396',width:728,height:90},
  mobile:{key:'56c1e0e5d75ba44c14f8fe8d56807262',width:320,height:50},
  'match-left':{key:'b5af81059a8f352004dbb4f0f129c5b2',width:160,height:300},
  'match-right':{key:'f7e2f84901931682b6a72f13eeb2387a',width:160,height:600},
}
export function banner(format:string):Response{
  if(!Object.hasOwn(units,format))return new Response('Unknown banner',{status:404})
  const unit=units[format as keyof typeof units]
  const nonce=crypto.randomUUID().replaceAll('-','')
  const html='<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Advertisement</title>'+
    '<style>html,body{padding:0;margin:0;overflow:hidden;background:transparent}iframe{display:block;border:0}</style><body>'+
    // Adsterra deletes this property after reading the placement options.
    '<script nonce="'+nonce+'">window.atOptions='+JSON.stringify({...unit,format:'iframe',params:{}})+'</script>'+
    '<script nonce="'+nonce+'" src="https://bauval.org/22/'+unit.key+'"></script></body></html>'
  return new Response(html,{headers:{
    'content-type':'text/html; charset=utf-8',
    'cache-control':'no-store',
    'x-robots-tag':'noindex',
    'content-security-policy':"default-src 'none'; script-src 'nonce-"+nonce+"' 'strict-dynamic'; style-src 'unsafe-inline'; frame-src https:; img-src https: data:; connect-src https:; frame-ancestors 'self'; base-uri 'none'; form-action 'none'; sandbox allow-scripts allow-popups",
    'referrer-policy':'strict-origin-when-cross-origin',
  }})
}

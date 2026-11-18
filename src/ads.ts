const units={
  desktop:{key:'5bcfa664e6af6cf981d56f754bea9396',width:728,height:90},
  mobile:{key:'56c1e0e5d75ba44c14f8fe8d56807262',width:320,height:50},
}
export function banner(format:string):Response{
  if(format!=='desktop'&&format!=='mobile')return new Response('Unknown banner',{status:404})
  const unit=units[format]
  const nonce=crypto.randomUUID().replaceAll('-','')
  const html='<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Advertisement</title>'+
    '<style nonce="'+nonce+'">html,body{padding:0;margin:0;overflow:hidden;background:transparent}iframe{display:block;border:0}</style><body>'+
    '<script nonce="'+nonce+'">var atOptions='+JSON.stringify({...unit,format:'iframe',params:{}})+'</script>'+
    '<script nonce="'+nonce+'" src="https://bauval.org/22/'+unit.key+'"></script></body></html>'
  return new Response(html,{headers:{
    'content-type':'text/html; charset=utf-8',
    'cache-control':'no-store',
    'content-security-policy':"default-src 'none'; script-src 'nonce-"+nonce+"' 'strict-dynamic'; style-src 'nonce-"+nonce+"'; frame-src https:; img-src https: data:; connect-src https:; frame-ancestors 'self'; base-uri 'none'; form-action 'none'; sandbox allow-scripts allow-popups",
    'referrer-policy':'strict-origin-when-cross-origin',
  }})
}

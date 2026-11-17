import { readFile, writeFile, rm } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
const name = 'wrangler.production.generated.json'
const config=JSON.parse(await readFile('wrangler.jsonc','utf8'))
config.routes=['remorsechess.com','www.remorsechess.com'].map(pattern=>({pattern,custom_domain:true}))
config.workers_dev=false
await writeFile(name,JSON.stringify(config,null,2),{flag:'wx'})
try {
  const result=spawnSync(process.execPath,['node_modules/wrangler/bin/wrangler.js','deploy','--config',name,...process.argv.slice(2)],{stdio:'inherit'})
  if(result.error)throw result.error
  process.exitCode=result.status??1
} finally {
  await rm(name)
}

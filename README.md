# Remorse Chess

An original chess variant. Every piece rolls a die the first time it captures. A capture can freeze the piece, leave it unable to capture, have no effect, or let it move twice.

## Run locally

Use Node.js 24.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:8787. Use two independent browser profiles for online play. Tabs in the same browser profile share a seat cookie. No external database or third-party account is needed for local play or casual development games.

```sh
npm run check
npm test
npm run build
node tests/smoke.mjs
```

Run the smoke test against an already running Worker. Set `REMORSE_TEST_URL` to test a different environment. The smoke test creates and finishes casual rooms.

## Rules and implementation

- [Remorse Chess v1](docs/rules.md)
- The pure rules engine lives in `src/rules.ts`. Use an injected die function to reproduce a capture.
- `src/match.ts` applies commands and clock deadlines. Online rooms use Cloudflare Durable Objects with persisted snapshots, repeatable die events, and WebSocket update signals.
- The server writes event history before it announces a new version. A client can recover by fetching that version after reconnecting.
- `src/rating.ts` implements Glicko-2 independently from the published algorithm. It starts each pool at 1500, uses one game per rating period, and inflates deviation for inactivity. This implementation has no color adjustment. [Algorithm specification](https://www.glicko.net/glicko/glicko2.pdf) · [Lichess rating reference](https://lichess.org/page/rating-systems)
- The playable client, pixel sprites, generated audio, and settings are in `src/client.ts`. Color and layout live in `src/style.css`.
- Account sessions, matchmaking, ratings, and game indexes are stored in the lobby's SQLite Durable Object. Individual game state lives in separate room objects. Deploy load testing is required before advertising a capacity target.

## Cloudflare deployment

Build and validate the Cloudflare bundle before publishing.

```sh
npm ci
npm run build
npx wrangler deploy --dry-run
```

To stage, use a separate Worker name, such as `npx wrangler deploy --name remorse-chess-staging`. This starts a separate storage namespace. Enable a staging hostname in the Cloudflare account as needed.

For production, verify you are in the Cloudflare account that owns `remorsechess.com`. After checking existing DNS records for conflicts, run:

```sh
npm run deploy
```

Alternatively deploy the Worker and attach both hostnames under **Workers & Pages → remorse-chess → Settings → Domains & Routes → Custom Domain**. Custom Domains can serve an otherwise empty zone. The Worker redirects www to the apex. The deploy script attaches both hostnames as Custom Domains.

Check `/api/health` over HTTPS. Confirm WebSocket updates and reconnect behavior across two browsers. Inspect the Worker logs for exceptions, close codes, and finalization failures. Keep the prior Worker version available for rollback. Roll back application code through Cloudflare Deployments and keep stored event formats forward compatible. Export critical data before shipping migrations. Reference: [Cloudflare custom domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/).

### Ranked accounts

Register a dedicated GitHub OAuth application with the callback `https://remorsechess.com/api/auth/callback`. Configure `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` as Worker secrets. For local sign-in, use a separate GitHub OAuth app with a localhost callback and put its keys in the ignored `.dev.vars` file. Without those settings, the site offers guest and local play. Account recovery is handled by GitHub. The accessible credits and privacy information is linked from the site footer.

### Banner placement

The ad slots ship with placeholders. Once a banner publisher and consent flow are configured, build with `VITE_BANNER_URL` pointing to a dedicated HTTPS banner page. The game renders it in a sandboxed iframe with reserved space. Rebuild the frontend after setting or removing the banner URL. No Supabase or Resend configuration is used.

## Launch status

Casual rooms, quick matchmaking, local play, tutorial, bot, and replay are covered by the playable implementation. Production rollout also requires Cloudflare account access and domain attachment. Verify configured OAuth and ranked results using two real test accounts. Publisher inventory and consent must be confirmed before enabling ads. Correspondence play and tournaments are separate milestones.

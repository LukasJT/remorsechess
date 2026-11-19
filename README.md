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
- Matchmaking prioritizes human opponents. Quick Play can fall back to a browser opponent after eight seconds. Ranked can fall back to a server-run opponent after 20 seconds. Ranked fallback clocks start when the player opens the match.
- Ranked bot games with a starting clock of at least 60 seconds can move a player's rating by up to 12 points per game. At most three count per UTC day across all pools. The bot uses a fixed 1500 reference and bot results do not lower rating deviation or count toward leaderboard eligibility. Human-vs-human games use the normal Glicko-2 update.
- Daily games are unrated human matches at 1, 2, 3, 5, 7, 10, or 14 days per turn. Sign in to keep ongoing games and a pending random search in your Daily list. Invitation links and unmatched requests last 14 days. Bonus moves share the current turn’s deadline.
- The lobby counts connected visitors through hibernating WebSockets. Multiple tabs using the same session count once. Queue bots have no presence connection.

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

Passkey registration and sign-in are available on the production apex and localhost. Users register a unique public handle and sign in with a device or password manager. A synced passkey is needed to carry the account to a new device. GitHub sign-in remains an optional legacy configuration, with its existing Worker secrets and callback. Email sign-in activates when the Worker holds a domain-scoped Resend sending key in the secret `RESEND_API_KEY`. Resend must verify `auth.remorsechess.com`, the sender domain. Existing players can add email sign-in from their profile without changing accounts. Email links can be opened on another device and ask for confirmation before signing in. Supabase is not used.

`node tests/ranked.mjs` verifies passkey registration and sign-in with ephemeral keys, a rated pairing, and exactly one rating update per player. It defaults to local development.

### Bots

Rookie, Tactician, and Grandmaster run on the player's device in a browser worker. The bot searches under the same rules as a human, including all die outcomes, bishop rescues, optional bonus moves, and captures that force a reply. No paid inference API or remote training service is used.

`node scripts/train-bot.mjs 512` fits a position evaluator on 512 seeded self-play games. It uses game-disjoint validation and stores the learned weights in `src/bot-model.ts`. In a separate 24-game Tactician comparison against the previous production bot, the new bot won 19, lost 3, and drew 2. One draw reached the move cap. Use `node scripts/bench-bot.mjs prior 24 tactical` to isolate the learned evaluator from the search changes, or pass a path to an earlier bot module to compare end to end.

### Banner placement

Adsterra banners are served in sandboxed iframes on isolated banner routes. Players can enable or disable them in Settings on each device. The lobby uses 728×90 on desktop and 320×50 on mobile. On wide screens, active matches can show 160×300 and 160×600 banners beside the game. The side banners leave the board and move log clear and are hidden on narrow screens and during the tutorial.

## Launch status

Casual rooms, quick matchmaking, local play, tutorial, bots, Daily correspondence, and replay are covered by the playable implementation. The Cloudflare production site uses the same rules and smoke-tested ranked flow. Tournaments are a separate milestone.

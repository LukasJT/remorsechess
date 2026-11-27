# Remorse Chess organic search plan

23 November 2026 · Six-week plan · Budget $0

The homepage already appears first for “remorse chess” in the owner’s search. Protect that entry point and grow the number of people who find a rule, try the position, and start playing. Use the verified domain property in Google Search Console to establish how often the site appears across devices and countries. The owner’s result is one observation.

## What is live

A public HTML crawl on 23 November found 28 URLs in the [production sitemap](https://remorsechess.com/sitemap.xml). All 28 returned HTTP 200, declared their own HTTPS URL as canonical, and could be reached from the homepage through HTML links. An invented path returned 404. These checks establish what a crawler can fetch. Use URL Inspection to verify what Google has actually indexed. [Google’s URL Inspection guide](https://support.google.com/webmasters/answer/9012289)

The library already has rules, strategy, history, 19 opening guides, and three study exercises. The original rules, strategy, and history pages link among themselves and to Play. Their static navigation omits Openings and Study. Most opening guides send the reader to the Scandinavian Defense as their related opening, regardless of the lesson. These are the first two editorial fixes. [Rules](https://remorsechess.com/rules/) · [Opening explorer](https://remorsechess.com/openings/) · [Study](https://remorsechess.com/study/)

## Which page should rank for which search?

The phrases below are editorial hypotheses. Check impressions in Search Console before investing in additional pages.

| Example search | Destination | What the visitor should be able to do |
| --- | --- | --- |
| remorse chess, play remorse chess online | [Play](https://remorsechess.com/) | Understand the first-capture die in one sentence and start a game on a phone. |
| remorse chess rules, what does a 6 do, can a bishop heal diagonally | [Rules](https://remorsechess.com/rules/) | Jump to the roll table or absolution example, then try the matching exercise. |
| remorse chess strategy, how to win after a bonus move | [Strategy](https://remorsechess.com/strategy/) | See a position, choose a continuation, and check why it works. |
| chess variant from TikTok where pieces feel guilty, who invented remorse chess | [History](https://remorsechess.com/history/) | Identify Bardelo Bardalini, open the original TikTok, and find the browser rules. |
| remorse chess openings, Scandinavian Defense in Remorse Chess | [Opening explorer](https://remorsechess.com/openings/) and its individual guides | Choose an opening and replay the first decision where the die changes play. |
| how to practice bishop rescues, remorse chess bonus move puzzle | [Study](https://remorsechess.com/study/) and its exercises | Attempt a specific decision, read the answer, and play from the position. |

## Week 1 · Measure discovery and connect the guides

1. In the verified Search Console domain property, save the latest complete 28-day Web Search totals for clicks, impressions, CTR and average position. Record the dates and available history. Split the homepage from guides, mobile from desktop, and brand-containing searches from other visible queries. Track the exact brand term separately. Short histories can use complete weeks until two 28-day periods are available. Some queries are anonymized, so group totals can differ from the site total. [Search Console Performance report](https://support.google.com/webmasters/answer/7576553)
2. Check the submitted sitemap’s last read and status. Inspect the homepage, rules, history, one opening, and one study exercise. Record Google’s selected canonical and index status. Expand inspection to sibling pages when a template has a problem. Keep the horse favicon URL stable and retain the homepage’s existing image-preview preference. [Google favicon guidelines](https://developers.google.com/search/docs/appearance/favicon-in-search)
3. Add Openings and Study to the static guide navigation. Link the absolution example directly to Bishop Escort and the two-move win directly to Mandatory Bonus Move. From each exercise, link back to the exact rule heading and the appropriate study board. Give links descriptive names such as “Practice a diagonal bishop rescue.” Check the links with JavaScript disabled and tap through them on a phone. [Google’s crawlable link guidance](https://developers.google.com/search/docs/crawling-indexing/links-crawlable)
4. On mobile, test the path from Google landing page to first move with banner ads enabled. Reserve space for the ads and diagrams so the board and Play button stay still when slow assets load. Use free PageSpeed Insights for diagnostics and Search Console field data when available. [Google’s Core Web Vitals guidance](https://developers.google.com/search/docs/appearance/core-web-vitals)

## Weeks 2–3 · Publish three lessons people can actually play

Start with these existing URLs. For each lesson, put the position, relevant die result, and explanation in the initial HTML. Follow them with the interactive board. Include a text move sequence for readers using small screens or screen readers. Replay the line using the current rules engine before publishing.

| Existing page | Editorial assignment | Acceptance check |
| --- | --- | --- |
| [Scandinavian Defense](https://remorsechess.com/openings/scandinavian-defense/) | Start with 1.e4 d5 2.exd5. Ask who moves next. Compare a 4, when Black can recapture with the queen, with a 6, when White must play d6. | The two branches are visible in the article and reproducible on the study board. |
| [Bishop Escort](https://remorsechess.com/study/styles/bishop-escort/) | Show a legal diagonal absolution from one of the eight neighboring squares. Then move the bishop one square too far away and explain the extra turn required to get adjacent. | The reader can distinguish moving beside the piece from spending the turn to absolve it. |
| [Delayed Exchange](https://remorsechess.com/study/styles/delayed-exchange/) | Use the Queen’s Gambit Declined position already on the site. Compare exchanging immediately with developing first. Show where a devastated pawn would stand and whether a bishop can reach it in time. | Both choices have a diagram, a legal continuation, and a link to play the opening. |

Replace the default related-opening link with one chosen for the actual decision in each line. Extend the three-lesson format first to openings that earn impressions or repeatedly come up in player questions. Credit any position taken from a public game. Describe a tactic as bot-discovered only if a reproducible self-play record supports the claim. [Google’s guidance on original, helpful content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content)

## Weeks 4–6 · Earn discovery and follow the evidence

- Prepare a shareable position from the Scandinavian lesson with a diagram, the question “Who moves next after a six?”, and a link directly to the playable answer. The owner can share it with the original creator or communities that welcome variant analysis. Keep creator credit and the original video link visible on the history page. Count referral visits separately from organic search.
- Review queries by landing page every week. If “can a bishop heal diagonally” earns impressions, make the answer and diagram easier to find on Rules. If a guide earns sustained impressions but few clicks, check its title against the actual query and compare CTR at similar positions and device mix. If it attracts readers who never try the exercise, test the placement and wording of the practice link.
- At week six, pick the next two lessons using observed queries, player questions and game starts. Create a new URL only for a distinct task with enough material for its own worked example. A close rewording of a rule belongs on the existing rules page.

## Scorecard and decision date

| Metric | Source and review | Decision |
| --- | --- | --- |
| Index status and chosen canonical across the five sample pages | URL Inspection in week one and after material fixes | Investigate template-wide exclusions before commissioning more guides. |
| Exact-brand clicks and CTR, plus guide clicks from other queries | Search Console weekly, with comparable 28-day periods as data accrues | Protect homepage discovery and identify the specific guides bringing in new audiences. |
| Organic landing sessions that reach a first legal move | If existing free measurement supports it, count once per session and group by first landing page. For study launches, count a move in a started practice game. | Compare Rules, Study and Openings. If measurement is unavailable, mark the metric unavailable until a free aggregate counter is implemented. Do not infer game starts from Search Console clicks or lobby counts. |
| Mobile organic performance and game-start rate | Review mobile separately at week six, showing counts alongside rates | Prioritize the device and landing page where the largest number of visitors drops out. |

At the week-six review, record what changed, which pages gained search clicks, which brought players into a game, and which two changes to keep testing. Use the existing Search Console account, free tools, and current hosting allowance. No paid tools, placements, or additional hosting are budgeted.

## AI search citation checks

Use a fresh search-enabled chat for each prompt. Record the engine, date, cited URLs and whether it linked to the playable site. Repeat monthly. In Search Console, inspect the homepage, Rules, History and the two puzzle pages. Record the selected canonical and indexing status. Check the Performance report for impressions and clicks on those pages.

The November 24, 2026 baseline below is from web search results. The three prompts were run separately before deployment. No Remorse Chess URL appeared in the returned results. An independent AI citation check is still pending.

| Prompt | Relevant result surfaced | Remorse Chess page to check |
| --- | --- | --- |
| Where can I play Remorse Chess? | [A browser implementation on another domain](https://chess-andremorseq17.upfling.site/) | Homepage |
| What’s the TikTok chess game where a bishop forgives pieces? | [Geeks Are Sexy coverage](https://www.geeksaresexy.net/2026/11/17/this-chess-game-has-murder-guilt-and-a-bishop-who-grants-absolution/) | History and Rules |
| How does a psychopath pawn work in Remorse Chess? | [Neatorama coverage of the guilt mechanic](https://www.neatorama.com/2026/11/16/Remorse-Chess-When-Your-Pieces-Feel-Guilty/) | Rules and The Volunteer |

Use https://remorsechess.com/puzzles/the-volunteer/ as the destination when sharing The Volunteer trailer.

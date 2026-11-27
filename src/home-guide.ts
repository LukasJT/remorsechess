const neighbors = Array.from({length:9}, (_, i) =>
  '<span>'+(i===4?'♞':'<i></i>')+'</span>',
).join('')

export const homeGuide = `
<section class="home-guide" id="how-to-play" aria-labelledby="how-to-play-title">
  <header class="guide-header">
    <div>
      <h2 id="how-to-play-title">How to play Remorse Chess</h2>
      <p>Start with normal chess. The first time each piece captures, its die roll changes what it can do. Each piece rolls just once, even if it’s healed or promoted.</p>
    </div>
    <div class="guide-links">
      <button class="primary" data-do="tutorial">Try the tutorial</button>
      <a href="/rules/">Read the full rules</a>
    </div>
  </header>

  <div class="guide-dice">
    <h3>What each roll means</h3>
    <dl>
      <div class="guide-roll devastated"><span aria-hidden="true">⚀</span><div><dt>1 · Devastated</dt><dd>That piece cannot move. Absolve it within your next three turns or it disappears at the end of the third. The capture turn and your opponent’s turns do not count.</dd></div></div>
      <div class="guide-roll guilty"><span aria-hidden="true">⚁ ⚂</span><div><dt>2–3 · Guilt-ridden</dt><dd>The piece can still move to empty squares, but it cannot capture until absolved.</dd></div></div>
      <div class="guide-roll unaffected"><span aria-hidden="true">⚃ ⚄</span><div><dt>4–5 · Unaffected</dt><dd>The piece keeps moving and capturing as usual. It has used its roll.</dd></div></div>
      <div class="guide-roll psychopath"><span aria-hidden="true">⚅</span><div><dt>6 · Berserker</dt><dd>After capturing on the first move of your turn, that same piece must move again if it has a legal move. Otherwise, the turn ends automatically.</dd></div></div>
    </dl>
  </div>

  <div class="guide-strategy">
    <section class="guide-heal" aria-labelledby="guide-heal-title">
      <div>
        <h3 id="guide-heal-title">How to absolve a piece</h3>
        <ol>
          <li>Get an eligible friendly bishop onto any of the eight squares around the affected piece. The corners count.</li>
          <li>On your turn, select the bishop. Pieces it can heal get a green circle.</li>
          <li>Tap a circled guilt-ridden or devastated piece, then choose <b>Absolve</b>. The bishop stays put, the piece is healed, and your turn ends.</li>
        </ol>
      </div>
      <figure class="guide-example">
        <div class="guide-board" aria-hidden="true">${neighbors}</div>
        <figcaption>A bishop can heal from any circled square.</figcaption>
      </figure>
      <p><strong>Last chance:</strong> You can still heal a devastated piece on the third turn. A devastated or bloodlust bishop can’t heal, and a bishop can’t heal itself.</p>
    </section>

    <section aria-labelledby="guide-bonus-title">
      <h3 id="guide-bonus-title">Bonus moves and bloodlust</h3>
      <p>The Berserker can take only one bonus move per turn, with the piece that earned it. Its first capture counts toward the three-capture total. On capture three, bloodlust starts immediately, even if there’s still a bonus move available.</p>
      <p>A bloodlust piece can move only by capturing. It can take one of your own pieces if the capture is otherwise legal, and pawns still capture diagonally. Your king is protected from friendly captures.</p>
    </section>

    <section aria-labelledby="guide-win-title">
      <h3 id="guide-win-title">How you win</h3>
      <p>Win by checkmating your opponent, or if they resign or run out of time. If the piece taking a bonus move can legally capture the checked enemy king, it can take the king and win immediately. A devastated king that disappears also loses the game.</p>
      <p>The clock keeps running through a bonus move. You get any clock increment once when your turn ends, including a turn spent absolving.</p>
    </section>
  </div>
  <p class="guide-play"><b>Ready to play?</b> Use <b>Quick match</b> for a casual game, <b>Play a friend</b> for an invite link, or <b>Practice vs bot</b> to try the rules on your own.</p>
  <p class="guide-credit">Try the <a href="/openings/">Opening explorer</a> · <a href="/study/">Study</a> · <a href="/strategy/">strategy guide</a> for three worked positions. Original variant by Bardelo Bardalini. <a href="/history/">Read the history and watch the original TikTok</a>.</p>
</section>
`

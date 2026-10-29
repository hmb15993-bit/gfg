# GasFireGames on Vercel

Files: `index.html` (the site), `game.html` and `games/` (the Games tab, about 45 MB total), `api/index.js` (backend), `package.json`.

## Deploy
1. Put this folder in a GitHub repo and import it at vercel.com/new (framework: Other), or run `vercel` in the folder.
2. In the Vercel project go to **Storage / Marketplace** and add **Upstash Redis**. It adds the database env vars for you.
3. In **Settings > Environment Variables** add:
   - `SESSION_SECRET`: any long random string (for example 40+ random characters)
   - `ADMIN_KEY`: a secret only you know
   - `ANTHROPIC_API_KEY`: your key from console.anthropic.com (powers the Verity and Mia bots)
4. Redeploy.
5. Open your .vercel.app site and register the username **HMB**. A "Admin key" box appears; enter your `ADMIN_KEY`. That account gets the **Admin** tab.

The name HMB is reserved: nobody can register it without the admin key. All other usernames are one account each (case-insensitive).

## Admin tab
Ban/unban accounts, give or take credits, edit or delete global chat messages, and read, edit or delete any DM. The login screen and Messages tab tell users that admins can view DMs.

## Known limits
- Games and the giveaway run in the browser, so a technical user could tamper with their own credits. Credits are play money. Admin changes sync to players within about 5 seconds.
- Live updates use polling (every 3 seconds, paused when the tab is hidden), which is fine for small groups.
- Images are resized in the browser and stored in Redis (max ~300 KB each).

- The Eaglercraft tab loads `game.html` in an iframe. It is an unofficial Minecraft-style client, so hosting it publicly could draw a takedown request; keep the site private or among friends if that worries you.

## New: bots, @mentions, profile pictures, calls
- **@mentions**: type `@` in global chat for an autocomplete list. Mentions are highlighted; if someone mentions you while you are on another tab you get a pop-up and a dot on the Chat tab.
- **Verity** (tsundere/yandere, funny) and **Mia** (smart helper) are chat bots. `@Verity` or `@Mia` anywhere in a global chat message makes them reply (both reply if you tag both). The names `Verity` and `Mia` are reserved so nobody can impersonate them. They need `ANTHROPIC_API_KEY`; without it the chat shows a "bots are not set up" notice.
  - Optional env vars: `VERITY_MODEL` (default `claude-haiku-5-5`), `MIA_MODEL` (default `claude-sonnet-5-5`), `BOT_DAILY_CAP` (default 1000 bot replies per day across the whole site). Each user is limited to 6 bot requests per minute.
- **Profile pictures**: Profile tab > Upload picture (square-cropped, stored like chat images). Shows in chat, friends, DMs and the member list; the letter badge is the fallback.
- **Calling**: friends can voice or video call (📞 / 🎥 on the Friends tab and in the Messages header). Needs HTTPS (Vercel is) and mic/camera permission. Signaling runs over the same API, so there are no extra services.
  - Calls use free Google STUN servers, which work for most home networks. For calls that fail on mobile data or strict networks, add a TURN server (free tiers at metered.ca or Cloudflare Calls) with env vars `TURN_URL` (comma-separated, e.g. `turn:global.relay.metered.ca:80,turns:global.relay.metered.ca:443`), `TURN_USER` and `TURN_PASS`.
  - Rings expire after 60 seconds, and unanswered calls end after 40 seconds.
- **Global Call** tab: one voice room for the whole site. Anyone signed in can join or leave at any time, and the call keeps running while you browse other tabs. It shows who is in the room, who is muted, and a green ring around whoever is talking. It is a peer-to-peer mesh, so it is capped at 8 people by default (`GCALL_MAX` env var; keep it small, since everyone sends audio to everyone). You can't be in a private call and the global call at the same time. The same STUN/TURN settings as private calls apply.
- **Challenges** tab: challenge any user (by username) to **chess** or a **blackjack duel**, optionally for credits, or play the **chess bot**.
  - Games are server-authoritative: the server validates every chess move, shuffles and holds the blackjack deck (your opponent's cards are never sent to your browser), and handles the wagers. Both wagers are held when the challenge is accepted and the winner receives the pot (draws and pushes refund both). Resign, draw offers and a "claim win" button (after 10 minutes of the opponent not moving) are included. Challenges expire after 10 minutes.
  - Blackjack duel: each player gets two private cards and takes turns to hit or stand. Closest to 21 without busting wins, and a natural blackjack beats any other 21. Rematch buttons are on finished games.
  - Chess bot: Easy, Medium and Hard. It runs in your browser in a background worker (`chess-worker.js`), so nothing is sent to a server and it costs nothing. Undo, flip board and resign are available.
  - You get a pop-up and a dot on the Challenges tab for new challenges, accepted challenges, and when it's your move. Friends also have a ♟ button to challenge them quickly.
  - New files: `chess-engine.js` (shared rules/bot, used by browser and server), `chess-worker.js`, `lib/games.js`. Keep them in the same places.
- Credits are now changed through a server-side `pay` operation instead of the browser overwriting the whole balance, so winnings from games that finish while you are elsewhere can't be lost.
- **Games** tab: a grid of all the games with search and category filters. Click a game to play it on its own page (Fullscreen, Reload and Open in new tab buttons, plus "All games" to go back). Games: BitLife, Cookie Clicker, Drift Boss, Geometry Dash, Hollow Knight, Minecraft (Eaglercraft), Pokemon Emerald, Portal 2D, Portal 64, Slope, Undertale.
  - **More games** menu (top bar) holds the casino: Giveaway, Plinko, Slots, Blackjack.
  - Hosted in this project: `game.html`, `games/slope.html`, `games/portal2d.html`, `games/portal64.html`, `games/hollowknight.html`, `games/undertale.html` (26 MB), `games/pokeemerald.html` and `games/bitlife/` (Unity WebGL build, shown as a portrait column).
  - Hosted by other sites and shown in a sandboxed frame: Drift Boss (GameDistribution), Cookie Clicker (shsgames.github.io) and Geometry Dash (coolmathsgames.github.io). Cookie Clicker and Geometry Dash have a **Backup version** button that switches to an alternate address. Pokemon Emerald also loads its emulator and ROM from jsDelivr. If one of these stops loading, the host is down.
  - To add a game, add a line to the `ARCADE` list near the end of `index.html` (id, name, url, hint, external 0/1, an unused slot (leave it as an empty string), two gradient colours, categories, optional backup url).
  - Deployment size is about 90 MB (mostly Slope, Undertale, Eaglercraft, and BitLife). If a Vercel CLI deploy complains about size, deploy from a Git repo instead.

## New: leaderboard, editable odds, animated Plinko and Blackjack
- **Leaderboard** tab: the top 25 accounts by credits with your own rank at the bottom (refreshes every 6 seconds). Banned accounts and admin accounts are not listed. To change that, edit the `op==='leaderboard'` block in `api/index.js` (the line with `u.banned||u.admin`).
- **Game odds** (Admin tab, top panel): edit the chance of every Plinko slot, the chance of each three-of-a-kind and of any 2-match in Slots, and a **player luck** slider for Blackjack (-50 to +50; above 0 gives players safer cards and makes the dealer bust more, below 0 does the opposite, 0 is a fair deck). The panel shows the average return to players for Plinko and Slots as you type. Odds are saved on the server (`odds` key in Redis) and every game re-reads them at most every 10 seconds. **Reset to default** restores the original odds. The Giveaway is not editable because its draw is calculated identically in every player's browser.
- **Plinko** now animates the ball bouncing from peg to peg with a trail, flashing pegs, a bouncing and glowing landing slot, floating win/loss text, a particle burst (bigger for big multipliers) and a screen shake on the top multiplier.
- **Blackjack** now deals cards that fly in from the deck, flips the dealer's hidden card, draws the dealer's cards one at a time, and plays win / blackjack / bust effects (glow, confetti, shaking cards, floating payout). People with "reduce motion" turned on get a calmer version.
- **Calls**: the call screen now shows how long it has been connecting, gives up with a clear message after 35 seconds instead of sitting there, and also reads the ICE connection state (older Safari never reports the normal one, which left calls on "Connecting…"). The server now hands out a free public TURN relay (Open Relay) as a fallback when you have not set `TURN_URL`. That relay is a shared best-effort service, so for calls that must work reliably on mobile data or strict networks, set your own `TURN_URL`, `TURN_USER` and `TURN_PASS` (see the Calling section above).
- Like the other games, the odds are applied in the browser, so a technical user could still tamper with their own results.
- **Colors** (Profile tab): pick the **page background** and the **area color** (boxes, top bar, buttons, inputs and borders are all derived from it), or tap a preset (Forest, Midnight, Purple, Crimson, Ocean, Graphite, Light). Text switches between light and dark automatically so light themes stay readable. Colors are saved on your account (`bg` and `pn` in your profile; the API validates them as `#rrggbb`), so they follow you to every device. **Reset colors** goes back to the default green.
- **Name**: the site is now called GasFireGames (browser tab, top bar, login box and the bots). Existing logins keep working.
- **GIFs** now work in chat (the camera button) and as profile pictures, and they keep animating. They are uploaded as they are instead of being flattened to one frame; the limit is about 500 KB per GIF. A profile-picture GIF that is not square is cropped to the middle. Normal photos still get resized as before.

## Update: chess look, GIFs, picture editor, Games tab

- **Chess board** now uses cream and green squares with outlined SVG pieces (drawn for this project, no external files), chess.com-style coordinates, highlights and move dots. Flip board and Undo were removed from the chess bot.
- **GIFs** work as profile pictures and in chat. GIFs under about 480 KB upload untouched. Bigger ones are shrunk in the browser (fewer frames and a smaller size, still animated) so they fit. This needs a browser with `ImageDecoder` (Chrome, Edge, recent Safari and Firefox); otherwise you will be asked to pick a smaller GIF.
- **Profile picture editor**: after choosing a picture you can drag to move it and zoom with a slider or mouse wheel, with live previews. **Resize / move** on the Profile tab re-opens the editor for your current picture. The position and zoom are stored as a suffix on the picture id (`<id>_<zoom%>_<x>_<y>`), which works for GIFs too. `api/index.js` accepts that form.
- **Games** tab tiles show just the game name (no emoji). Subway Surfers was removed.

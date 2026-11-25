# GasFireGames on Vercel

Files: `index.html` (the site), `game.html` and `games/` (the Games tab, about 4.3 GB total), `api/index.js` (backend), `package.json`.

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

## Update: Proxy tab
- **Proxy** tab: a search box and a shortcut dock styled after the reference page, with the GFG logo. Type a web address to open it, or any other text to search (Bing). The shortcut dock has YouTube, TikTok, Discord, X, Google, GeForce NOW, plus Games, AI, Music and Chat. The **pencil** button edits the dock: tap a shortcut to remove it, add your own (name + address), or Reset. Shortcuts are saved in the browser (`gfg_px_links`). Entries that start with `tab:` jump to a site tab instead of a web page (for example `tab:games`).
- Once a page is open you get Home, Back, Forward, Reload, an address bar and Fullscreen.
- **How it works:** `api/proxy.js` (new function, also listed in `vercel.json`) downloads the page on the server and rewrites its links, images, CSS and forms so they keep going through the proxy, and a small script injected into the page redirects `fetch`, XHR and dynamically added links too. Known ad hosts are dropped. No new environment variables: it uses the existing `SESSION_SECRET`.
- **Who can use it:** only signed-in members. The tab asks the API for a key (`op: pxtoken`, valid 2 hours) that is added to every proxy address. A banned user loses access when their key expires.
- **Safety:** proxied pages run in a frame with no `allow-same-origin`, and every proxied response also carries a `Content-Security-Policy: sandbox` header, so a proxied page cannot read your login token or any site storage even if someone opens a proxy address directly. The proxy refuses private, loopback and link-local addresses (checked again when connecting, so DNS tricks do not work) and will not proxy itself. It stores nothing: cookies from other sites are not kept.
- **Limits (it is a basic server-side proxy, not a full browser-in-the-browser):**
  - Simple and medium sites work. Big web apps (YouTube, Discord, TikTok, X, GeForce NOW, ChatGPT) often will not, because they depend on service workers, websockets, logins and scripts that change the page address by themselves. The dock icons are only shortcuts.
  - Sites you must log in to will not remember you.
  - Vercel limits each function call to about 30 seconds, so very large downloads and long video streams can cut off. Sending traffic through your own Vercel project also counts toward its usage.
  - For heavier sites you need a proxy that runs a long-lived server (Ultraviolet or Scramjet with a Wisp server) on a host other than Vercel, for example Render or Koyeb. That could be linked into this tab later.
- An "Open in new tab" button is deliberately not offered here: a proxied page opened as a normal tab would not be sandboxed by the tab itself (the CSP header would still protect it).

## Update: Rise of Fire (new version)
- `games/riseoffire.html` is now the newer Rise of Fire (technology tree with real years, resources, corruption, events, save/load, auto-conquer) plus these changes:
  - Every nation has a **gold star capital**. Capturing a capital halves the owner's gold (the captor takes it), weakens the owner's armies by 25% (strength and health) until they retake it, and stops them recruiting.
  - **Train troops** button: 5 levels, 12 seconds each, +15% health, speed and strength per level (stacking).
  - Late-game gold is nerfed: the year-based income multiplier grows at a third of the old rate after 1900 (3.8x in year 3000 instead of 7.5x).
- `games/rof-room.js` still provides online rooms through this site's API, and now also provides the **Save game** download.

## Update: v6 (Rise of Fire fixes, Movies removed)
- **Movies tab removed** for now (the `vMovies` code and tab entry are gone from `index.html`).
- **Proxy**: typed searches now go to Bing instead of DuckDuckGo (DuckDuckGo blocks requests that come from Vercel's servers).
- **Rise of Fire online**: the host no longer gets stuck on the start screen (the server never sends a player their own events, so the host now starts its own game locally as well as telling the guests).
- **Pause**: Pause button (or P / Esc) with Resume, Save game and Quit to menu. In online games only the host can pause, and guests see a "host paused" screen.
- **Corruption**: it now builds up at 40% of the old speed, and when a realm fractures only about 13% of your land breaks away (from random former nations, tiles nearest their old capital first) instead of everything you conquered. Gold lost in a fracture is 13% instead of 40%.

## Update: v7 (Velara games, Movies tab is back)
- **Movies tab** (new, between Games and Proxy): copied from the Velara site's movie tab and restyled to match this site. Search box, chips for Trending / Movies / TV shows / Top movies / Top TV, a poster grid with year and rating, and a Load more button. Click a title to watch it in a frame on the same page. TV shows have a season picker and an episode list.
  - Titles and posters come from TMDB; the video comes from the third-party player vidlink.pro (same as Velara). Both are outside this project, so if either goes down or blocks your network the tab will say so.
  - The TMDB key in `index.html` (`MV_KEY`) is the one Velara used. It is shared, so it could be rate limited or revoked. For a key of your own, get a free one at themoviedb.org (Settings > API) and replace `MV_KEY`.
  - The player frame has **Popup block: on** by default (the frame cannot open new windows, which stops most ads). If a title will not play, press the button to turn it off and the player reloads.
- **Games from Velara**: `games/1v1lol/` (1v1.LOL, about 49 MB, Unity WebGL) and `games/2048/` (2048). Velara only had these two games and neither was already here, so nothing was dropped as a duplicate. Both are in the Games tab, and `games.json` was regenerated (501 games).
  - Velara's site-wide script tags (`/js/all.min.js`, `js/googleAnalytics.js`) were removed from the two game pages because those files do not exist here. 1v1.LOL still loads its own ad scripts from other sites.
- Deployment size grew by about 49 MB. If a Vercel CLI deploy complains about size, deploy from a Git repo instead.

## Update: v8 (slower bots in Rise of Fire)
- Bots now recruit at a third of the old rate (`BOT_RECRUIT` near the top of the `tick` function in `games/riseoffire.html`, from .18 to .06 per month). It only changes how fast bots build troops, not their income, upgrades or how they march. Change that one number to tune it (for example .03 for even slower bots).

## Update: v9 (Movies tab fix)
- The Movies tab now gets titles and posters through a new server function, `api/movies.js` (also in `vercel.json`), instead of the browser calling themoviedb.org directly. That fixes the "nothing loads" case where a school or work network blocks themoviedb.org or image.tmdb.org. It uses the same sign-in key as the Proxy tab, only allows read-only TMDB lists, search and details, and falls back to the old direct way if the function is not deployed.
- **Recommended:** get a free TMDB API key (themoviedb.org > Settings > API) and add it in Vercel as the environment variable `TMDB_KEY`, then redeploy. Without it the shared key from Velara is used, and if that key has been revoked the tab now says so instead of staying empty.
- The video itself still comes from vidlink.pro and loads in your browser, so a network that blocks that site will still not play videos. The Movies tab shows an error message when lists fail to load.

## Update: v10 (icon sidebar)
- The tabs are now a slim **sidebar of icons** down the left (like the reference picture), in the site's green style. Hover an icon (or tap it on a phone, or tab to it with the keyboard) to see its name. On phones the same icons run along the bottom and scroll sideways.
- Top group: Chat, Games, More games (casino), Movies, Proxy, Challenges, Global Call. Bottom group: Messages, Friends, Leaderboard, Admin (admins only), Profile. Under them are your credits and the log out button. "GFG" at the top is the logo.
- The pink and green dots for new messages, mentions, challenges and a live global call now sit on the corner of the icon. The More games menu opens beside its icon.
- To change which icon is where, edit the two lists in `enter()` in `index.html` (search for `'chat','games','more'`); the icons themselves are in the `SBI` table.

## Update: v11 (your own TMDB key)
- The Movies tab now uses your own TMDB API key instead of Velara's (in `api/movies.js`, plus `MV_KEY` in `index.html` as a fallback if the function is not deployed). If you would rather keep the key out of the code, add it in Vercel as the environment variable `TMDB_KEY`; that overrides the built-in one.


## v12 changes

- **Rise of Fire income limit**: the gold a realm can make in one month is capped at 8,000 from 1800 to 1899 (and before 1800), then goes up by 500 every 100 years (1900: 8,500, 2000: 9,000, and so on). Applies to bots too. The total gold you can hold is not limited.
- **Movies**: titles and posters still come from themoviedb.org (through `api/movies.js`), but the video now plays from flixer.su (`https://flixer.su/watch/movie/<tmdb id>` and `https://flixer.su/watch/tv/<tmdb id>/<season>/<episode>`). If flixer.su refuses to load inside the frame, use the "Open in new tab" button.
- **Every tab fills the screen**: the 960px width limit on the page content is gone, and the chat and the movie player now grow to the height of the window.
- **Rise of Fire research limit**: a realm can make at most 300 research a month, going up by 30 every 5 years counted from 1800 (1805: 330, 1900: 900, 2000: 1,500). Applies to bots too; your total research is not limited.
- **Rise of Fire difficulty**: pick Easy, Normal, Hard or Ultra hard on the "Play with bots" screen (and on the online screen, where the host's choice is used). It is remembered in your browser and saved with saved games. Normal is how the game played before.
  - Easy: bots recruit half as often and earn 70% gold and research; you earn 125%.
  - Normal: no change.
  - Hard: bots recruit 1.7x as often and earn 130%.
  - Ultra hard: bots recruit 2.7x as often and earn 170%; you earn 85%.
  - The monthly gold and research limits still apply on top of this.
- **Proxy home**: removed the row of shortcut icons (and the edit button) under the search bar. Only the logo and search box are left.
- **Proxy search**: the search box on the proxy home now searches DuckDuckGo (its plain HTML version, html.duckduckgo.com) instead of Bing.
- **Rise of Fire: the Moon (secret)**: from the year 2400, with Space Colonization (level 10) and Space Program (level 5) both maxed out, click **Fit map** 10 times within one second. Nothing is shown if you don't meet the conditions. A **Moon** button then appears next to Fit map and opens a second map with six made-up alien countries (Selenite Dominion, Kingdom of Vael, Tycho Collective, Mare Imperium, Shackleton Hive, Free Marches of Orb).
  - Ship troops from your capital to the Moon (1 gold a troop, 6 months) and bring them home the same way ("go to the moon and back").
  - Settle open land for 60 gold and 5 troops, or click alien land next to your colonies to attack it (it declares war; they raid back now and then). Capturing an alien capital conquers the whole country (+300 gold, +100 research).
  - Each colony pays +3 gold and +0.25 research a month; the monthly gold and research limits still apply. Solo games only; the Moon is saved with saved games.
- **Moon aliens are advanced and very strong**: their defence and raids are 4 times as strong as the Ultra hard bots when you play on Normal (10.8x the base number), and it scales with the difficulty: Easy 5.4x, Normal 10.8x, Hard 18.4x, Ultra hard 29.2x. The Moon panel shows the current multiplier.

## New: GASNITE (battle royale)
- **GASNITE** is in the Games tab (`games/gasnite/`, about 0.5 MB, no build step). It is a battle royale with building: Solo, Duos, Trios and Squads, building or Zero Build, a map with towns and furnished houses, chests, bots, a locker of skins and a shop.
- **It uses your GasFireGames account.** Inside the Games tab you are signed in automatically (the sign-in box only pops up there if you somehow aren't signed in). Opened on its own (Open in new tab, or `/games/gasnite/`) there is no pop-up: you play right away, and the 👥 party button says "Sign in" if you want your account. Opened as a plain file on a computer, there is no login at all and progress is saved on that device.
- **Progress is saved on the server** (new file `lib/gasnite.js`, hooked into `api/index.js` like `lib/games.js` and `lib/rooms.js`), so your level, skins, G-Bucks and settings follow you to any device. The game keeps a copy in the browser and uploads it a few seconds after each change. If two devices disagree, the one with more progress (level, then XP) wins.
- **Friends are the site's friends.** GASNITE's friends screen (the 👥 party button at the top of the lobby) lists your GasFireGames friends with who is online, and you can send, accept, decline and cancel friend requests there. They show up in the site's Friends tab too, because they are the same requests.
- **Party:** invite up to 3 friends. In Duos, Trios and Squads your party friends drop in as your teammates with their own GASNITE skin and name. They are played by the game's AI: everyone still plays their own match, because real-time multiplayer needs a live game server, which Vercel functions can't run.
- Redis keys used: `gn:save:<user>` (the save), `gn:at:<user>` (when it was saved), `gn:prof:<user>` (skin, level, wins and kills shown to friends) and `gn:party:<user>`. No new environment variables.
- When GASNITE is played in its own tab, it keeps you "online" on the site (the member list shows *in GASNITE*).

## New: Alexx743's games and DDLC
- 49 games from the Alexx743 games site were added to the Games tab as entries in the `ARCADE` list in `index.html` (they run from other sites in a sandboxed frame, like Drift Boss). His Apps page (GitHub, Google, Roblox, Spotify, VS Code, YouTube, Windows 11, Neal.fun, Gartic Phone) and his image files were left out. Games gasfiregames already had (1v1.LOL, 2048, BitLife, Cookie Clicker, Drift Boss, Flappy Bird, Geometry Dash, Slope, Super Mario 64, Minecraft) were not added a second time.
- **Doki Doki Literature Club** (fan web port, Ren'Py) is hosted in `games/ddlc/` (about 240 MB). It works best in Chrome.

## New: MonkeyGG2 games
- **171 games from MonkeyGG2** (the `games` folder of monkeygg2.github.io) are now hosted in `games/` and listed in the Games tab, which now has 728 games. They are 90 game folders, 76 Flash games, OvO and OvO 2, and Eaglercraft 1.12.2, 1.5.2 and 1.8.8 (next to the Eaglercraft Ampler Launcher). Together they add about 3.8 GB.
  - The Flash games play through the Ruffle player in `games/flash/`, which is hosted here too: `/games/flash/index.html?game=bloons` loads `games/flash/files/bloons.swf`.
  - Games gasfiregames already had were not listed a second time: 1v1.LOL, Basket Random, Basketball Stars, BitLife, Boxing Random, Chrome Dino, Cookie Clicker, Crossy Road, Drift Boss, Drive Mad, Eggy Car, Flappy Bird, Idle Breakout, Mario, Monkey Mart, Retro Bowl, Run 3, Slope, Smash Karts, Soccer Random, Subway Surfers, Temple Run 2, Tunnel Rush and Volley Random. Their MonkeyGG2 folders were still copied (for example `games/1v1-lol/` and `games/cookie-clicker/`) but are hidden from the list. MonkeyGG2's 2048 was not copied, because `games/2048/` already has a different version.
- **New file `scripts/more-games.json`**, read by `scripts/gen-games.js` on every build:
  - `hide`: files or folders in `games/` to leave out of the Games tab: the duplicates above, and `flash`, which is only the player. Take a name out to list that game again.
  - `pages`: games inside a sub-folder, with their names (the Flash games, OvO and the Eaglercraft versions).
  - `cats`: a game's categories, used instead of the guessed ones (the guess puts most games that are not emulator games in "Retro"). The new games use the categories from the list in `index.html` (Action, Puzzle, Platformer, Idle and so on), plus two new ones: "Flash" and "Rhythm".
  - A JSON mistake in this file stops the build with an error message, so a typo can't quietly drop games from the site.
- Names for the new game folders were added to `scripts/names.json`. `games.json` was regenerated (674 entries; the Games tab skips the ones that are already in the `ARCADE` list).
- **Size:** the project is now about 4.3 GB and 15,700 files.
  - That is over Vercel's limits for CLI deploys on Hobby (15,000 files and 100 MB), so deploy from the GitHub repo.
  - GitHub refuses a push over 2 GB and any file over 100 MB. The biggest file here is 97 MB, so push the new games in a few smaller commits.
  - Vercel's Hobby plan includes 100 GB of data transfer a month, and some games load files of 50 to 97 MB, so heavy use could use it up.

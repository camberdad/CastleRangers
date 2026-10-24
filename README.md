# Castle Rangers

## Brief description of Castle Rangers

Castle Rangers is a browser-based castle-defense game. Aim and fire magical arrows, earn coins, upgrade your armory, and defend your keep through 300 rounds. Player profiles keep progress between updates, and the global leaderboard tracks scores, levels, arrows fired, cumulative kills, and active playtime.

### Latest update — V23

- Applies a detected game update automatically when returning to the title screen, with an animated progress bar and green completion checkmark.
- Adds a cache-busting version URL to the automatic update handoff so browsers load the new scripts and styles without requiring a manual refresh.

## Previous updates

- **V22 — Random map skies:** Randomly selects from 11 map palettes at the start of each round or replay, and avoids repeating the previous sky. Adds multiple sunsets plus dawn, violet dusk, aurora, moonlit, storm, and daylight skies.

- **V21 — Elite wave progression:** Starts with one elite on Round 6 and increases the number at five-round intervals, reaching five by Round 26. Elite-only waves continue through the later campaign, with broader enemy variety appearing in regular waves sooner.
- **V20 — Cumulative leaderboard stats:** Counts every enemy kill toward a per-player total, saves kills locally as they happen, and syncs kills and active playtime to the global board about every five seconds. Active playtime is saved locally each second.
- **V19 — Version badge placement:** Moves the small version label to the top-right corner.
- **V18 — Version badge:** Adds a small build number on screen.
- **V17 — Elite enemies and Lightning Shot:** Adds Cave Ogre, Stormcaller, Frost Giant, Ravager, and Necromancer. Replaces Hunter Arrow with Lightning Shot, which calls lightning onto up to five nearby enemies; existing ownership and upgrades carry over.
- **V16 — Armory and Gatling:** Sorts arrows by unlock round. Gatling Launcher unlocks at Round 75, deals less damage, and fires only while the cursor button is held.
- **V15 — Live leaderboard stats:** Uploads active-run stats and total playtime during gameplay while keeping one row and the best score per player.
- **V14 — Arrow unlocks:** Sets Glacial Nova to unlock at Round 22 and Sunder Maul at Round 28. Removes Shrapnel Case and refunds existing purchases.
- **V13 — Save backups:** Adds rolling backups for profiles, levels, coins, stars, arrow ownership, and upgrades.
- **V12 — Cache-safe updates:** Adds version checks and asset cache busting so new site builds can load without manually clearing browser cache.
- **V11 — Persistent account progress:** Keeps player level and stats across game updates.
- **V10 — Campaign and gameplay upgrades:** Extends the campaign to 300 rounds, improves animation and magical arrow effects, shows the current round beside score, adds purchasable weapon power levels, and adds a screen-shake toggle.
- **V9 — Playtime leaderboard stat:** Adds total time played to leaderboard entries and keeps it updating during active play.
- **V8 — Global leaderboard:** Fixes live score display and level reporting, keeps one leaderboard entry per player, and shows Arrows Fired.
- **V7 — Arrow effects:** Makes Glacial Nova stronger and gives Sunder Maul a damaging impact explosion.

## Play locally

Open `index.html` in any modern browser. The game is pure HTML, CSS, and JavaScript; it has no build step or package dependencies.

## Play online (GitHub Pages)

The project is published from the `main` branch of `camberdad/CastleRangers`. GitHub Pages serves `index.html` from the repository root.

## Controls

| Input | Action |
| --- | --- |
| Move mouse | Aim the bow |
| Click | Fire the equipped arrow |
| Hold cursor button | Sustained Gatling Launcher fire |
| `1`–`9`, `0`, `-`, `=`, `[`, `]` | Switch arrows in Armory order |
| `P` / `Esc` | Pause or resume |

## Project structure

- `index.html` — game entry point and markup
- `style.css` — game and interface styling
- `js/data.js` — arrow definitions, enemies, and 300-round campaign
- `js/audio.js` — sound effects
- `js/draw.js` — rendering
- `js/leaderboard.js` — local and global leaderboard sync
- `js/game.js` — game loop, combat, and interface
- `js/version-check.js` / `version.json` — version and update check

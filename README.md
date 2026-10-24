# Castle Rangers V15

V15 syncs live run stats and cumulative playtime about every 15 seconds, while preserving each player’s best score and one-row leaderboard entry.

A retro side-scrolling castle-defense shooter that runs entirely in the browser — no build step, no server, no dependencies. Defend your keep through 300 rounds against raiders, brutes, knights, orcs, trolls, and warlords while earning gold to unlock 18 arrow types.

## Play locally

Open `index.html` in any modern browser:

```text
double-click index.html
```

That's it. The game is pure HTML/CSS/JS.

> Tip: open `test/smoke.html` for an automated self-test of every arrow mechanic.

## Play online (GitHub Pages)

1. Create a new repository on GitHub (public or private with Pages enabled).
2. Push this folder's contents to the repository's default branch:

   ```bash
   git init
   git add .
   git commit -m "Castle Rangers"
   git branch -M main
   git remote add origin https://github.com/<you>/<repo>.git
   git push -u origin main
   ```

3. On GitHub, open **Settings → Pages**.
4. Under **Build and deployment**, set **Source** to `Deploy from a branch` and the branch to `main` / `root`.
5. Save. After a moment the game is live at:

   ```text
   https://<you>.github.io/<repo>/
   ```

All paths in the project are relative, so it works from the repository root or a sub-path with no configuration.

## Controls

| Input | Action |
| --- | --- |
| Move mouse | Aim the bow |
| Hold / release left mouse button | Draw and fire |
| `1`–`9`, `0`, `-`, `=`, `[`, `]` | Switch arrow (all 18) |
| `P` / `Esc` | Pause |

## Project structure

```text
index.html     entry point
style.css      all styling
js/data.js     18 arrow definitions, enemy stats, 300 campaign rounds, difficulty
js/audio.js    WebAudio sound effects
js/draw.js     rendering, world constants
js/game.js     game loop and every arrow mechanic
test/smoke.html headless self-test
```

## License

Free to use and modify for personal or commercial projects.


# Jack Games

A monorepo of simple, joyful games for kids, built **YouTube Playables first**.

## Principles

- **Playables first** – every game ships as a self-contained HTML5 bundle that meets the
  [YouTube Playables requirements](https://developers.google.com/youtube/gaming/playables).
- **Easy to play** – one-finger input, no reading required, no fail states.
- **Always feedback** – every action has a sound, and every completion gets a celebration
  (chime + sparkles for small wins, fanfare + confetti for big ones).

## Layout

```
packages/kit/        shared code for all games
  src/playables.ts   YouTube Playables SDK wrapper (falls back to localStorage outside YouTube)
  src/audio.ts       synthesized sound effects (no audio files)
  src/fx.ts          particle effects (sparkles, confetti)
games/coloring/      "Doodle & Color" – trace a picture, then color it in
games/dice-dungeon/  "Dice Dungeon" – color browser version of printables/dice-dungeon
games/punchline/     "Punchline Party" – family prompt-and-vote party game (web only, see below)
scripts/
  package-game.mjs   zips a game's dist/ for upload and checks Playables rules
```

## Commands

```sh
npm install
npm run dev:coloring                      # dev server (also reachable from a phone on your LAN)
npm run dev:dice-dungeon
npm run dev:last-fill                    # first-person Three.js gas station short
npm run package -w @jack-games/coloring   # typecheck + build + zip → games/coloring/release/
```

## Playables checklist (handled by the kit)

- SDK `<script src="https://www.youtube.com/game_api/v1">` loaded before game code
- `firstFrameReady()` after first draw, then `gameReady()` once interactive
- Pause/resume + audio-enabled callbacks honored
- Progress saved with `saveData`/`loadData`
- No external network requests; relative asset paths (`base: './'`)
- Works in portrait and landscape, touch and mouse

## Adding a game

1. Copy `games/coloring` to `games/<name>`, rename the package to `@jack-games/<name>`.
2. Use `@jack-games/kit` for SDK calls, sounds and effects.
3. `npm run package -w @jack-games/<name>` and upload the zip in YouTube Studio.

## Punchline Party (web multiplayer, not a Playable)

A phones-out family party game at https://jackbox.danbradbury.net. Unlike the kids' games it
needs a server and reading/typing, so it skips the Playables checks. It is a Cloudflare Worker
plus one Durable Object per room (`games/punchline/worker/`). Rules live in `worker/game.ts`
(tested by `npm test -w @jack-games/punchline`). Prompts are in `worker/prompts.ts`, each
flagged `familyFriendly`; the host picks the filter when creating the game or in the lobby.

- Create a game at the root, share `https://jackbox.danbradbury.net/ABCD` (or the 4-letter code).
- `npm run dev:punchline` builds and runs `wrangler dev` (rooms + static files on :8787).
- The `custom_domain` route in `wrangler.jsonc` needs `danbradbury.net` on the same Cloudflare
  account, and the deploy token needs zone permissions to attach it.

## Deploys

Each game deploys to its own Cloudflare Worker (name in `games/<game>/wrangler.jsonc`) from
GitHub Actions, **only on pushes to `main`** and **only when that game's files change**
(`games/<game>/**`, plus shared `packages/kit/**` and `tsconfig.base.json`). Changing one game
never redeploys another. Run a deploy by hand from the Actions tab (`workflow_dispatch`) or
locally with `npm run deploy:<game>`.

Needs the repo secret `CLOUDFLARE_API_TOKEN` (Workers Scripts: Edit).

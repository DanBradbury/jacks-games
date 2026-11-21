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
scripts/
  package-game.mjs   zips a game's dist/ for upload and checks Playables rules
```

## Commands

```sh
npm install
npm run dev:coloring                      # dev server (also reachable from a phone on your LAN)
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

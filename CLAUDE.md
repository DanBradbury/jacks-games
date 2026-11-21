# Jack Games

Monorepo of kids' games (npm workspaces, Vite + TypeScript, no framework). See README.md.

- Target YouTube Playables first: no external requests, no external fonts/CDNs, all assets bundled or generated in code. Go through `@jack-games/kit` `playables` for SDK calls, never `window.ytgame` directly.
- Games are for a young child: no text needed to play, no losing, large touch targets.
- Every interaction gets a sound (`Sfx` in kit); every completion gets a visible celebration (`Particles`).
- Verify with `npm run package -w @jack-games/<game>` (typecheck + build + Playables checks).

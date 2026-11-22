# Night Shift

First-person Three.js walkthrough of an industrial skybridge after hours. The side door halfway down the right wall opens into a janitor’s closet with a slop sink, brooms and cleaning supplies. A single cord-hung lamp lights the closet. The far doorway leads to a maintenance terminal, an analog power cabinet and cabled network racks.

## Play

From the repository root, run `npm ci` and `npm run dev -w @jack-games/night-shift`. Open the local URL and choose **Enter hallway** for free movement or **Play 30s tour** for the camera route.

Use WASD to walk, the mouse to look, Shift to run, F to toggle the camera filter, and Escape to return to the menu. Arrow keys also move and turn. On touchscreens, use the left pad to move and drag the scene to look.

## Video

[Download the finished 30-second bodycam tour](media/night-shift.mp4). The MP4 contains 1280 × 720 H.264 video at 30 fps and stereo AAC audio.

To make another take, select **Bodycam** or **Clean**, then **Record tour**. Keep the tab visible while it renders 900 frames. Export time depends on GPU speed. The browser downloads an MP4 or WebM according to encoder support. The controls stay outside the recorded image.

## Cloudflare

From the repository root, run `npm run deploy -w @jack-games/night-shift` with an authenticated Wrangler session. This builds the game and deploys the static assets to the Worker named `night-shift-hallway`. To build without deploying, run `npm run build -w @jack-games/night-shift`. The static site is in `games/night-shift/dist/`. The standalone video stays outside the game bundle.

## Production notes

Inspired by [Jav's The Hall](https://x.com/javpixel_art/status/2124209140700533065). Rack fronts use a locally bundled generated texture with modeled rails, plugs and patch leads. The scene uses locally constructed Three.js geometry, modeled foreground towers with generated photographic facade textures, and a generated distant skyline. Outdoor rain streaks, beads on the glass and drifting mist run on the same clock in free walk and video export. Audio uses original Web Audio synthesis for footsteps, ventilation, traffic and rain. Four recessed windows are staggered along the two walls. Glass-impact sounds follow the distance to the closest opening on each side. No audio or video from the reference is embedded.

Wall paint uses a 2K scan with mapped chips, plaster relief, a worn dado and damp staining near the floor. Concrete uses 1K scans. All surface scans are locally bundled CC0 diffuse, OpenGL normal and roughness maps from Poly Haven. [Red Brick Plaster Patch 02](https://polyhaven.com/a/red_brick_plaster_patch_02) · [Peeling Painted Wall](https://polyhaven.com/a/peeling_painted_wall) · [Cracked Concrete Wall](https://polyhaven.com/a/cracked_concrete_wall) · [Concrete Floor Damaged 01](https://polyhaven.com/a/concrete_floor_damaged_01).

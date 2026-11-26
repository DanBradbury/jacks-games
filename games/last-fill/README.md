# The Last Fill

A 48-second, guided first-person Three.js short. Push through the station doors, walk to the parked 1974 Corvette-inspired coupe, and pull its driver’s door open. From the driver’s seat, close the door and watch a saucer lift a cow beyond the windshield.

From the repository root, run `npm ci` and `npm run dev:last-fill` for development. To build and serve the production scene with Go, run `npm run serve -w @jack-games/last-fill` and open http://127.0.0.1:8080. The Go server uses the standard library. For a Playables ZIP, run `npm run package -w @jack-games/last-fill`.

Choose **Begin experience** or select a chapter. Drag the scene to look around. Playback controls support pausing, seeking, mute, fullscreen and returning to the title. Escape returns to the title. The film requires WebGL 2. Camera, door hinges, hand placement, sound cues, saucer and cow share a seekable timeline. The camera follows a stabilized path. A lightning strike illuminates the orchard at 00:30.4, followed by rolling thunder 0.86 seconds later.

## 60 FPS review video

With Google Chrome and FFmpeg installed, run `npm run render:film -w @jack-games/last-fill` from the repository root. The export samples all 2,880 frames of the guided camera path at 1920 × 1080 and mixes the stereo soundtrack on the same timeline. Open `games/last-fill/release/the-last-fill-1080p60.mp4` in a video player, or visit `/release/the-last-fill-1080p60.mp4` on the game’s Vite dev server.

## Assets

- The reference for pacing and atmosphere was Jav's [The Abduction](https://x.com/javpixel_art/status/2125403467942654008).
- HDR illumination and surface scans are bundled from Poly Haven under CC0. [Moonless Golf](https://polyhaven.com/a/moonless_golf), [Worn Asphalt](https://polyhaven.com/a/worn_asphalt), [Rocky Terrain 02](https://polyhaven.com/a/rocky_terrain_02), [Gravel Floor](https://polyhaven.com/a/gravel_floor), [Corrugated Iron 02](https://polyhaven.com/a/corrugated_iron_02), [Cracked Concrete Wall](https://polyhaven.com/a/cracked_concrete_wall), [Concrete Floor Damaged 01](https://polyhaven.com/a/concrete_floor_damaged_01).
- Hands use the generic hand meshes from [WebXR Input Profiles](https://github.com/immersive-web/webxr-input-profiles/tree/main/packages/assets/profiles/generic-hand). The MIT license accompanies the bundle.
- The title artwork, storm clouds, leaf spray, hand albedo, shop finishes, product labels, cow hide, pump details, and rally wheel textures are generated images. The store, doors, car, pumps, craft, cow and beam use local Three.js geometry.

## Sound recordings

The stereo location mix moves from refrigerator hum and rain against glass to shoes on wet pavement. Footsteps stop at the car, the latch catches, and the closed cabin muffles the storm. A separate thunder recording follows the flash. The saucer pass uses layered, pitch-shifted compressor recordings. Both cues pan with the camera. All source recordings are [CC0](https://creativecommons.org/publicdomain/zero/1.0/).

- Shop compressors by LEGIT Audio. [The Shop](https://opengameart.org/content/the-shop)
- Window rain by alxl and exterior rain by Kresiek The Furry. [Rain on Window Loop](https://opengameart.org/content/rain-on-window-loop) and [AMB Rain Loop 2](https://opengameart.org/content/amb-rain-loop-2)
- Indoor footfalls by GboxMikeFozzy and parking-lot footsteps by JohnsonBrandEditing. [Footsteps](https://opengameart.org/content/footsteps-0) and [Walking on pavement](https://freesound.org/people/JohnsonBrandEditing/sounds/244310/)
- Door hardware by Iwan Gabovitch (qubodup). [Door open, door close](https://opengameart.org/content/door-open-door-close)
- Thunder by cognito perceptu. [thunder crack 2](https://freesound.org/people/cognito%20perceptu/sounds/347854/)

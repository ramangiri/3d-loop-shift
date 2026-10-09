# Loop Shift · 3D Forest

A separate five-level browser-native 3D prototype inspired by the supplied forest-ring concept. Built with Three.js and Vite. This is real WebGL rendering, **not a compiled Unity build**. It does not replace the existing Loop Shift project.

## Space Run prototype

Open `/?mode=space` for the separate single-course Space Run prototype. The forest stays at `/` and each mode links to the other.

Space Run uses three continuous metallic lanes through floating ring platforms, with a stable close camera behind a glowing ball, neon red gates, cyan connectors, and procedural space scenery. Tap or Space shifts across the lanes and back; left/right arrows steer directly. Collect up to 18 coins, clear 18 gates, and reach the finish at 280 units. The course lasts about 35 seconds at full speed. No extra levels, powers, ads, or accounts are included.

`src/space-game.js` is the independent deterministic engine; `src/space-scene.js` is its Three.js presentation; `src/space-main.js` handles controls and lifecycle. `src/router.js` selects the requested mode. Forest mechanics are unchanged.

## Play the forest

Collect gold and avoid red blockers. Tap the playing field or the shift button, or press Space, to move one ring. Shifts go inward to the center, then outward again. Press P or Escape to pause. Leaving the tab automatically pauses. Complete one revolution to advance. The five levels use 2, 3, 3, 3 and 4 rings, with 52 obstacle gates in total.

- Fixed elevated camera, matching the forest concept
- Procedural 3D tracks, rocks, foliage, coins and ball
- Smooth radial shifts with physical collision timing
- Rolling, collection and completion effects; Calm effects respects reduced-motion preference
- Current-level retry, next level and replay controls
- No accounts, ads, network leaderboard or payment features

## Develop

Requires Node.js 22.12+ (tested with Node 24).

    npm ci
    npm run dev

    npm test
    npm run build
    npm run preview

## Render static deployment

Create a **new** static site connected to this repository. Build command: `npm ci && npm test && npm run build`. Publish directory: `dist`. Never reuse or replace the existing `loop-shift` service. The included `render.yaml` describes the new static deployment.

## Implementation

`src/game.js` contains deterministic gameplay independent of rendering. Simulation uses 120 Hz collision substeps and caps exceptionally long frames. `src/scene.js` contains the Three.js scene. `src/main.js` handles lifecycle, controls and accessible HTML overlays. Scores are per session; the only stored preference is Calm effects in browser local storage.

All scenic geometry is original procedural code. Three.js and Vite retain their respective open-source licenses. Browser requires WebGL 2; the page reports a readable fallback when unavailable.

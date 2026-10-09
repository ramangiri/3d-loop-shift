# Loop Shift · 3D Forest

A separate five-level browser-native 3D prototype inspired by the supplied forest-ring concept. Built with Three.js and Vite. This is real WebGL rendering, **not a compiled Unity build**. It does not replace the existing Loop Shift project.

## Play

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

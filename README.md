# Last Light

A silent drone flyover of the Hollywood Hills at sunset. The shot starts on the sign, already moving, and opens onto the city in the first few seconds. Then it rides the ridge, drops over the basin, and comes back around.

Everything in the frame is procedural: the hills, the letters, the streets, the haze. It is an original scene in the spirit of a last-light flyover, not a scan or a photogrammetry model of the landmark.

No audio. It is meant to play in a tab, on a phone, or on a muted screen.

## Watch it

```bash
npm install
npm run dev
```

Open the URL Vite prints. The flight starts on its own.

Production build:

```bash
npm run build
npm run preview
```

## Controls

| Action | How |
| --- | --- |
| Pause / play | Click the button, or press Space |
| Scrub | Drag the timeline. Arrow keys nudge it |
| Orbit | Click Orbit, then drag. Scroll to dolly. Press O |
| Back to the flight | Click Flying, or press Play |
| Full screen | Press F |

If the system asks for reduced motion, the film holds on the wide view and orbit is already on.

`?t=12` starts at 12 seconds. `?still=1` holds that frame.

## Deploy

This is a static Vite site. [Vercel](https://vercel.com) picks that up from `vercel.json`:

- Framework: Vite
- Build: `npm run build`
- Output: `dist`

No environment variables and no API keys.

## Stack

Vite, TypeScript, and Three.js. Terrain, sky, city, and letters are generated in the browser.

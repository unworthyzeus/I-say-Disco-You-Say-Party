# I Say Disco, You Say Party 🎨

Transform any photograph into the distinctive oil-painted, cel-shaded aesthetic of **Disco Elysium**.

## What It Does

A client-side image processing app that applies a multi-stage painterly filter:

1. **Bilateral pre-smoothing** — removes noise while preserving edges
2. **Kuwahara oil paint filter** — creates the signature impasto brushstroke look
3. **Directional brushstroke simulation** — smears colors along gradient perpendiculars
4. **Posterization / cel-shading** — quantizes colors into distinct tonal bands
5. **Disco Elysium palette remapping** — warm amber/ochre tones, desaturated midtones, teal shadows
6. **Sobel edge detection** — adds dark sepia outlines
7. **Canvas texture overlay** — procedural crosshatch + noise pattern
8. **Vignette** — moody dark corners

### Face Detection

Uses **face-api.js** (TinyFaceDetector) to detect faces. Face regions get smaller brush radius, warmer colors, and boosted saturation.

### All processing runs entirely in the browser — no images are uploaded anywhere.

## Tech Stack

- **Next.js** (App Router, TypeScript)
- **Tailwind CSS** (custom Disco Elysium dark theme)
- **face-api.js** for face detection
- **Canvas API** for all image processing

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy on Vercel

Connect this repo to Vercel for automatic deployments, or run `vercel` from the CLI.

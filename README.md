# I Say Disco, You Say Party

A browser-based image filter that transforms photographs into the distinctive oil-painted, cel-shaded art style of Disco Elysium. All processing runs entirely on the client -- no images are uploaded anywhere.

Live at: https://i-say-disco-you-say-party.vercel.app

---

## Filter Pipeline

The image passes through an 8-step processing pipeline, all implemented in pure Canvas API:

1. **Bilateral filter** -- Pre-smooths noise while preserving edges. Uses a larger radius inside detected face regions with a tighter color sigma, so skin noise is removed without blurring features like eyes and lips.

2. **Kuwahara oil paint filter** -- Divides each pixel's neighborhood into four quadrants and picks the one with lowest color variance. Produces the characteristic impasto / oil paint look. Brush radius is reduced inside face regions (60% of base) to retain facial detail while staying painterly.

3. **Directional brushstroke simulation** -- Calculates the local color gradient at each pixel and smears color along the perpendicular direction. Creates visible directional brush marks that follow the contours of the image.

4. **Posterization / cel-shading** -- Quantizes color channels into discrete levels. Face regions and skin-tone pixels receive 2 extra levels (up to 12 total) to avoid hard banding on large skin areas.

5. **Color palette remapping** -- Shifts the image into a Disco Elysium-inspired palette using hue-category-aware grading:
   - Skin: warm salmon mid-tones, golden amber highlights, teal/blue-green shadows
   - Greens: muted into sage/olive
   - Blues: slight teal shift
   - Yellows: enriched into gold
   - Purples: pushed toward dusty purple
   - Neutrals: subtle warm tint
   - Shadows globally receive a cool teal shift; highlights receive a warm golden shift
   - When detected faces cover more than 25% of the image (close-up portraits), skin color shifts are dampened to 78% strength to prevent blotchy colored patches.

6. **Sobel edge detection + dark outlines** -- Computes a grayscale edge map via Sobel operators. Edges are drawn as dark outlines with colors that adapt to the underlying pixel: warm areas get dark brown/sienna outlines, cool areas get dark teal outlines, neutral areas get dark sepia.

7. **Canvas texture overlay** -- Adds a procedural crosshatch and noise pattern to simulate painted canvas. Strength is user-adjustable.

8. **Vignette** -- Darkens corners and edges for a moody, focused composition.

---

## Face Detection

Uses face-api.js with the TinyFaceDetector model and 68-point face landmarks (tiny variant). Face regions influence multiple pipeline stages:

- Bilateral filter: wider radius, tighter color sigma
- Oil paint: reduced brush radius (keeps detail)
- Posterize: extra levels (smoother skin gradients)
- Color remap: face area ratio dampening for close-ups

Models are loaded from `/public/models/` (4 weight files, ~200KB total).

---

## Controls

All parameters are adjustable via sliders that appear when an image is loaded:

| Slider | Range | Default | Description |
|--------|-------|---------|-------------|
| Intensity | 0 -- 1 | 0.85 | Blend between original and filtered result |
| Brush Size | 2 -- 6 | 4 | Kuwahara filter radius |
| Cel-Shading | 4 -- 12 | 8 | Posterization levels |
| Edge Outlines | 0 -- 1 | 0.60 | Dark outline strength |
| Warmth | 0 -- 1 | 0.35 | Warm amber tint strength |
| Saturation | 0 -- 1 | 0.60 | Color saturation |
| Canvas Texture | 0 -- 1 | 0.30 | Canvas texture overlay strength |

A "Reset to defaults" link restores all values.

---

## Downloads

Two download options appear after processing:

- **Download Painting** -- Saves the filtered image as a PNG.
- **Download Comparison** -- Creates a side-by-side image (original labeled "ORIGINAL", filtered labeled "PAINTED") with a dark background, border frames, and a watermark bar at the bottom with the site URL.

On mobile, the download bar is sticky-positioned at the bottom of the screen.

---

## PWA Support

The app includes a Web App Manifest and appropriate meta tags for installation on mobile devices:

- Android: "Add to Home Screen" prompt or browser menu
- iOS: Share > Add to Home Screen

Icons are provided at 192x192 and 512x512 (PNG, maskable).

---

## Tech Stack

- Next.js 16 (App Router, TypeScript, Turbopack)
- Tailwind CSS 4
- face-api.js 0.22.2
- Canvas API (all image processing is client-side)
- Vercel for deployment

---

## UI Theme

The interface uses a custom dark theme inspired by Disco Elysium's bohemian aesthetic:

- Dark brown/sepia background tones
- Playfair Display for headings, EB Garamond for body text
- Gold diamond-shaped slider thumbs
- Warm amber accent colors
- Paint splatter decorations (CSS pseudo-elements)
- Handwritten-style quotes in the header

---

## Getting Started

```bash
npm install
npm run dev
```

Opens at http://localhost:3000.

Images can be loaded by:
- Clicking the upload area
- Dragging and dropping a file onto the page
- Pasting from clipboard (Ctrl+V)

---

## Deployment

The repo is configured for Vercel with `output: "standalone"` in next.config.ts and a vercel.json specifying the Next.js framework. Push to main to deploy automatically.

---

## Privacy

No server-side processing. No image uploads. All computation happens in the browser's Canvas API. Face detection runs locally via face-api.js. Nothing leaves the device.

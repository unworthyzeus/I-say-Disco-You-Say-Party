# I Say Disco, You Say Party

A browser-based media filter that transforms images and videos into the distinctive oil-painted, cel-shaded art style of Disco. All processing runs entirely on the client — no files are uploaded anywhere.

Live at: https://i-say-disco-you-say-party.vercel.app

---

## Filter Pipeline

Images pass through a multi-step processing pipeline implemented in pure Canvas 2D API. The pipeline is tuned for clean, flat cel-shaded regions with bold outlines — closer to the look of the actual game's character portraits.

1. **Bilateral filter** — Pre-smooths noise while preserving edges. Radius scales with the Detail slider (4px at low detail, 2px at high). Face regions get an extra pixel of radius plus a tighter color sigma to remove skin noise without blurring eyes/lips.

2. **Kuwahara oil paint filter** — Divides each pixel's neighborhood into four quadrants and picks the one with lowest color variance. At low detail settings, the brush radius is increased by 1 for even flatter regions. Face regions use 60% of the base radius.

3. **Directional brushstroke simulation** — Calculates the local color gradient and smears color along the perpendicular direction, creating visible directional brush marks that follow contours.

4. **Detail recovery** *(optional, Detail > 0.4)* — Extracts a high-pass layer from the original image (box blur subtraction) and blends it back at 50% of the Detail slider value. A noise threshold of 8 suppresses sensor noise; only prominent structural detail (edges, wrinkles, fabric folds) is recovered. Face regions receive 40% stronger recovery. At the typical default Detail of 0.1, this step is skipped entirely to keep cel-shading clean.

5. **Posterization / cel-shading** — Quantizes each color channel into discrete levels (default 5). Fewer levels produce harder, flatter color bands. Face regions and skin-tone pixels receive 2 extra levels to avoid harsh banding on large skin areas. When Detail is high (> 0.5), up to 4 extra levels are added.

6. **Cleanup pass** *(Detail < 0.5)* — A radius-1 box blur followed by a second posterize pass. This eliminates single-pixel color noise at posterization boundaries, producing cleaner flat regions.

7. **Color palette remapping** — Shifts the image into a Disco -inspired palette using HSL hue-category-aware grading:
   - Skin: warm salmon mid-tones, golden amber highlights, teal/blue-green shadows
   - Greens → sage/olive, Blues → teal shift, Yellows → gold, Purples → dusty purple
   - Shadows globally receive a cool teal shift; highlights receive a warm golden shift
   - Close-up portraits (detected faces > 25% of image area) dampen skin shifts to 78% to prevent blotchy patches

8. **Multi-scale edge detection + dark outlines** — Combines Sobel edge detection at the base scale with a Laplacian pass at 2× downscale for fine structural outlines (engaged when Detail > 0.2). Outline colors adapt to the underlying pixel: warm areas → dark brown/sienna, cool areas → dark teal, neutral → dark sepia.

9. **Canvas texture overlay** — Procedural sinusoidal weave pattern (horizontal + vertical threads at ~3-4px spacing) with low-frequency smooth undulation. No per-pixel random noise. Strength is user-adjustable (default 0.12).

10. **Vignette** — Darkens corners and edges for moody, focused composition.

A final intensity blend mixes the filtered result with the original image when intensity < 1.

---

## Palette System

Five hand-crafted Disco palettes are available, each containing both warm (rust, amber, ochre) and cool (teal, blue-grey, slate) entries for color variety:

- **Martinaise Dusk** — Deep blue-grey shadows, rust/sienna mids, teal mid-tones, pale amber highlights
- **Whirling-in-Rags** — Cool grey-blues, olive/brown mids, dusty rose, warm ivory highlights
- **Pale Cold** — Steel blue shadows, slate mids, mauve accents, champagne/warm cream highlights
- **Union Heat** — Deep teal-brown shadows, terracotta/rust mids, warm gold highlights
- **Tribunal Night** — Deep navy/charcoal, dark teal, muted burgundy accents, cool silver highlights

### Luminance-aware palette matching

When a palette is selected, each pixel is matched to the nearest palette color using a luminance-prioritized distance metric instead of plain RGB Euclidean distance:

- Luminance difference is weighted 3× stronger than chroma difference
- A warm/cool bias pushes shadows toward cooler palette entries and highlights toward warmer ones
- Pre-computed metadata (luminance + warmth per palette color) avoids per-pixel recomputation

---

## Style Presets

Eight presets provide quick starting points:

| Preset | Posterize | Brush | Edge | Texture | Detail | Character |
|--------|-----------|-------|------|---------|--------|-----------|
| Default | 5 | 5 | 0.70 | 0.12 | 0.10 | Balanced cel-shading |
| Cartoon Soft | 6 | 5 | 0.50 | 0.08 | 0.15 | Gentle, soft edges |
| Cartoon Bold | 4 | 6 | 0.85 | 0.06 | 0.05 | Hard flat cel, thick outlines |
| Noir Paint | 5 | 5 | 0.82 | 0.15 | 0.20 | Dark, high-contrast |
| Golden Hour | 6 | 5 | 0.60 | 0.10 | 0.20 | Warm, golden lighting |
| Muted Film | 7 | 4 | 0.50 | 0.10 | 0.30 | Subdued, filmic |
| Canvas Heavy | 5 | 5 | 0.65 | 0.30 | 0.15 | Visible canvas texture |
| Fine Detail | 8 | 3 | 0.65 | 0.15 | 0.80 | Preserves fine detail |

---

## Face Detection

Uses face-api.js with the TinyFaceDetector model and 68-point face landmarks (tiny variant). Face regions influence multiple pipeline stages:

- Bilateral filter: wider radius, tighter color sigma
- Oil paint: reduced brush radius (preserves detail)
- Posterize: extra levels (smoother skin gradients)
- Color remap: face area ratio dampening for close-ups
- Detail recovery: 40% stronger in face regions

Models are loaded from `/public/models/` (4 weight files, ~200KB total).

---

## Video Processing

Videos are processed frame-by-frame using an optimized fast renderer:

- Canvas is downscaled to 55% of original resolution for real-time playback
- Per-pixel operations are inlined (S-curve contrast, posterization, palette matching)
- No bilateral filter or brushstroke passes — uses direct color grading for speed
- Laplacian edge overlays are added when Detail > 0.3
- A soft-light haze pass adds atmosphere (skipped at very low texture settings)
- Exported as browser-generated WebM via MediaRecorder

---

## Controls

All parameters are adjustable via sliders:

| Slider | Range | Default | Description |
|--------|-------|---------|-------------|
| Intensity | 0 – 1 | 0.85 | Blend between original and filtered |
| Brush Size | 2 – 8 | 5 | Oil paint / brushstroke radius |
| Cel-Shading | 3 – 12 | 5 | Posterization levels (fewer = flatter) |
| Edge Outlines | 0 – 1 | 0.70 | Dark outline strength |
| Warmth | 0 – 1 | 0.35 | Warm amber tint strength |
| Saturation | 0 – 1 | 0.60 | Color saturation |
| Canvas Texture | 0 – 1 | 0.12 | Canvas weave overlay strength |
| Detail | 0 – 1 | 0.10 | Fine detail preservation (0 = flat cel, 1 = detailed) |

A palette dropdown selects a Disco  color palette. A "Reset to defaults" link restores all values.

---

## Downloads

For images:

- **Download Painting** — Saves the filtered image as PNG
- **Download Comparison** — Side-by-side image (original + painted) with labels, border frames, and a watermark bar

For videos:

- **Download Painted Video** — Exports as a browser-generated WebM file

On mobile, the download bar is sticky-positioned at the bottom of the screen.

---

## PWA Support

The app includes a Web App Manifest and meta tags for installation on mobile devices:

- Android: "Add to Home Screen" prompt or browser menu
- iOS: Share → Add to Home Screen

Icons are provided at 192×192 and 512×512 (PNG, maskable).

---

## Tech Stack

- Next.js 16 (App Router, TypeScript, Turbopack)
- Tailwind CSS 4
- face-api.js 0.22.2
- Canvas 2D API (all image processing is client-side)
- Vercel for deployment

---

## UI Theme

Custom dark theme inspired by Disco bohemian aesthetic:

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

Files can be loaded by:
- Clicking the upload area
- Dragging and dropping onto the page
- Pasting from clipboard (Ctrl+V)

Supported formats: JPG, PNG, WebP (images), MP4, WebM (video).

---

## Deployment

Configured for Vercel with `output: "standalone"` in next.config.ts and a vercel.json specifying the Next.js framework. Push to main to deploy automatically.

---

## Privacy

No server-side processing. No image uploads. All computation happens in the browser's Canvas API. Face detection runs locally via face-api.js. Nothing leaves the device.

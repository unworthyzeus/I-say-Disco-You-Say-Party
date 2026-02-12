/**
 * Disco Art Style Filter
 * 
 * Replicates the distinctive painterly oil-painting style of Disco:
 * - Heavy impasto brushstrokes (Kuwahara-like oil paint filter)
 * - Posterization / cel-shading (quantized color levels)
 * - Muted, desaturated palette with warm amber/ochre accents
 * - Dark painted outlines (Sobel edge detection)
 * - Canvas texture overlay
 * - Special face treatment (warmer tones, more detail)
 */

// ============================================================
// Color conversion utilities
// ============================================================

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255)
  ];
}

// ============================================================
// Face region data structure
// ============================================================

export interface FaceRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FilterOptions {
  intensity: number;            // 0-1, overall effect strength
  posterizeLevels: number;      // 4-12, color quantization levels
  edgeStrength: number;         // 0-1, dark outline strength
  brushSize: number;            // 2-6, oil paint brush radius
  warmth: number;               // 0-1, warm amber tint
  saturation: number;           // 0-1, color saturation
  textureStrength: number;      // 0-1, canvas texture overlay
  detailPreservation: number;   // 0-1, how much fine detail to preserve
  faceRegions: FaceRegion[];
}

export const DEFAULT_OPTIONS: FilterOptions = {
  intensity: 0.85,
  posterizeLevels: 5,
  edgeStrength: 0.7,
  brushSize: 5,
  warmth: 0.35,
  saturation: 0.60,
  textureStrength: 0.12,
  detailPreservation: 0.1,
  faceRegions: []
};

// ============================================================
// Step 1: Simplified Oil Paint / Kuwahara Filter
// ============================================================

function oilPaintFilter(
  src: ImageData,
  radius: number,
  width: number,
  height: number,
  faceRegions: FaceRegion[]
): ImageData {
  const dst = new ImageData(width, height);
  const sd = src.data;
  const dd = dst.data;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Moderate reduction in face regions — keep painterly feel
      let r = radius;
      for (const face of faceRegions) {
        if (x >= face.x && x <= face.x + face.width &&
          y >= face.y && y <= face.y + face.height) {
          r = Math.max(2, Math.floor(radius * 0.6));
          break;
        }
      }

      // Divide neighborhood into 4 quadrants, pick the one with lowest variance
      const quadrants = [
        { sx: -r, ex: 0, sy: -r, ey: 0 },  // top-left
        { sx: 0, ex: r, sy: -r, ey: 0 },   // top-right
        { sx: -r, ex: 0, sy: 0, ey: r },   // bottom-left
        { sx: 0, ex: r, sy: 0, ey: r },    // bottom-right
      ];

      let bestVar = Infinity;
      let bestR = 0, bestG = 0, bestB = 0;

      for (const q of quadrants) {
        let sumR = 0, sumG = 0, sumB = 0;
        let sumR2 = 0, sumG2 = 0, sumB2 = 0;
        let count = 0;

        for (let dy = q.sy; dy <= q.ey; dy++) {
          for (let dx = q.sx; dx <= q.ex; dx++) {
            const nx = Math.min(Math.max(x + dx, 0), width - 1);
            const ny = Math.min(Math.max(y + dy, 0), height - 1);
            const idx = (ny * width + nx) * 4;
            const pr = sd[idx], pg = sd[idx + 1], pb = sd[idx + 2];
            sumR += pr; sumG += pg; sumB += pb;
            sumR2 += pr * pr; sumG2 += pg * pg; sumB2 += pb * pb;
            count++;
          }
        }

        const avgR = sumR / count;
        const avgG = sumG / count;
        const avgB = sumB / count;
        const varR = sumR2 / count - avgR * avgR;
        const varG = sumG2 / count - avgG * avgG;
        const varB = sumB2 / count - avgB * avgB;
        const totalVar = varR + varG + varB;

        if (totalVar < bestVar) {
          bestVar = totalVar;
          bestR = avgR;
          bestG = avgG;
          bestB = avgB;
        }
      }

      const idx = (y * width + x) * 4;
      dd[idx] = bestR;
      dd[idx + 1] = bestG;
      dd[idx + 2] = bestB;
      dd[idx + 3] = sd[idx + 3];
    }
  }
  return dst;
}

// ============================================================
// Step 2: Posterization (Cel-shading)
// ============================================================

function posterize(
  src: ImageData,
  levels: number,
  faceRegions: FaceRegion[] = []
): ImageData {
  const dst = new ImageData(new Uint8ClampedArray(src.data), src.width, src.height);
  const d = dst.data;
  const w = src.width;
  const h = src.height;
  const step = 255 / (levels - 1);
  // Slightly more levels in face regions to reduce hard banding on skin
  const faceLevels = Math.min(levels + 2, 12);
  const faceStep = 255 / (faceLevels - 1);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;

      // Check if in face region
      let inFace = false;
      for (const face of faceRegions) {
        if (x >= face.x && x <= face.x + face.width &&
          y >= face.y && y <= face.y + face.height) {
          inFace = true;
          break;
        }
      }

      // Also detect skin-like pixels outside detected face boxes
      if (!inFace) {
        const r = d[idx], g = d[idx + 1], b = d[idx + 2];
        // Quick skin heuristic: R > G > B, warm hue, moderate lightness
        if (r > g && g > b && r - b > 30 && r > 80 && r < 240) {
          inFace = true;
        }
      }

      const s = inFace ? faceStep : step;
      d[idx] = Math.round(Math.round(d[idx] / s) * s);
      d[idx + 1] = Math.round(Math.round(d[idx + 1] / s) * s);
      d[idx + 2] = Math.round(Math.round(d[idx + 2] / s) * s);
    }
  }
  return dst;
}

// ============================================================
// Step 3: Edge Detection (Sobel) for dark outlines
// ============================================================

function sobelEdges(src: ImageData, width: number, height: number): Float32Array {
  const gray = new Float32Array(width * height);
  const sd = src.data;

  // Convert to grayscale
  for (let i = 0; i < gray.length; i++) {
    const idx = i * 4;
    gray[i] = 0.299 * sd[idx] + 0.587 * sd[idx + 1] + 0.114 * sd[idx + 2];
  }

  const edges = new Float32Array(width * height);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const tl = gray[(y - 1) * width + (x - 1)];
      const t = gray[(y - 1) * width + x];
      const tr = gray[(y - 1) * width + (x + 1)];
      const l = gray[y * width + (x - 1)];
      const r = gray[y * width + (x + 1)];
      const bl = gray[(y + 1) * width + (x - 1)];
      const b = gray[(y + 1) * width + x];
      const br = gray[(y + 1) * width + (x + 1)];

      const gx = -tl - 2 * l - bl + tr + 2 * r + br;
      const gy = -tl - 2 * t - tr + bl + 2 * b + br;
      edges[y * width + x] = Math.sqrt(gx * gx + gy * gy);
    }
  }

  // Normalize
  let max = 0;
  for (let i = 0; i < edges.length; i++) {
    if (edges[i] > max) max = edges[i];
  }
  if (max > 0) {
    for (let i = 0; i < edges.length; i++) {
      edges[i] /= max;
    }
  }

  return edges;
}

// ============================================================
// Step 4: Color Palette Remapping (Disco tones)
// ============================================================

// Hue categories for Disco color treatment
const enum HueCategory {
  SKIN_WARM,    // Skin tones, warm oranges/reds (hue 0-0.11 or 0.93-1.0)
  YELLOW_GOLD,  // Yellows, golds (0.11-0.17)
  GREEN,        // Greens (0.17-0.42)
  TEAL_CYAN,    // Teal/cyan (0.42-0.53)
  BLUE,         // Blues (0.53-0.7)
  PURPLE,       // Purples (0.7-0.83)
  MAGENTA_PINK, // Magentas/pinks (0.83-0.93)
  NEUTRAL,      // Very desaturated, no clear hue
}

function classifyHue(h: number, s: number): HueCategory {
  if (s < 0.08) return HueCategory.NEUTRAL;
  if (h < 0.11 || h >= 0.93) return HueCategory.SKIN_WARM;
  if (h < 0.17) return HueCategory.YELLOW_GOLD;
  if (h < 0.42) return HueCategory.GREEN;
  if (h < 0.53) return HueCategory.TEAL_CYAN;
  if (h < 0.70) return HueCategory.BLUE;
  if (h < 0.83) return HueCategory.PURPLE;
  return HueCategory.MAGENTA_PINK;
}

function isSkinTone(r: number, g: number, b: number, h: number, s: number, l: number): boolean {
  // Detect skin-like colors by multiple criteria
  if (l < 0.15 || l > 0.9) return false;
  if (s < 0.1) return false;
  // Skin hues: warm orange/red range
  const inSkinHue = (h < 0.11 || h > 0.93);
  if (!inSkinHue) return false;
  // RGB ratios typical of skin
  if (r < g || r < b) return false;
  if (r - g < 10) return false;
  return true;
}

// Lerp a hue value (handles wrapping around 0/1)
function lerpHue(from: number, to: number, t: number): number {
  // Find shortest path around the hue circle
  let diff = to - from;
  if (diff > 0.5) diff -= 1;
  if (diff < -0.5) diff += 1;
  return ((from + diff * t) % 1 + 1) % 1;
}

function remapColors(
  src: ImageData,
  warmth: number,
  saturationMod: number,
  faceRegions: FaceRegion[]
): ImageData {
  const dst = new ImageData(new Uint8ClampedArray(src.data), src.width, src.height);
  const d = dst.data;
  const w = src.width;
  const height = src.height;

  // Estimate face area ratio (how much of the image is face)
  let faceArea = 0;
  for (const face of faceRegions) {
    faceArea += face.width * face.height;
  }
  const faceAreaRatio = faceArea / (w * height);

  // Palette reference hues (in HSL 0-1 range):
  const HUE_AMBER = 0.07;        // Warm amber/ochre for skin highlights
  const HUE_SALMON = 0.03;       // Warm salmon for face mid-tones
  const HUE_TEAL = 0.49;         // Teal for shadows (signature DE look)
  const HUE_COOL_BLUE = 0.58;    // Cool blue for deep shadows
  const HUE_SAGE = 0.28;         // Sage green for muted greens
  const HUE_OLIVE = 0.22;        // Olive for dark greens
  const HUE_DUSTY_PURPLE = 0.76; // Dusty purple for accents
  const HUE_GOLDEN = 0.12;       // Golden for warm highlights
  const HUE_WARM_PINK = 0.97;    // Warm pink for bright accents

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const r = d[idx], g = d[idx + 1], b = d[idx + 2];

      let [h, s, l] = rgbToHsl(r, g, b);

      // Check if in face region
      let inFace = false;
      for (const face of faceRegions) {
        if (x >= face.x && x <= face.x + face.width &&
          y >= face.y && y <= face.y + face.height) {
          inFace = true;
          break;
        }
      }

      const skinLike = inFace || isSkinTone(r, g, b, h, s, l);
      const hueCategory = classifyHue(h, s);

      // When face area is large (close-up), slightly reduce color shift
      // to avoid blotchy patches, but keep the painterly character.
      const skinDampen = faceAreaRatio > 0.25 ? 0.78 : 1.0;

      // =====================================================
      // COLOR GRADING RULES
      // Key principle: warm lights, cool shadows, diverse hues
      // =====================================================

      if (skinLike) {
        // --- SKIN / FACE treatment ---
        // Warm amber in lights, cool teal in shadows (signature painterly look)
        const sw = warmth * skinDampen;
        if (l < 0.25) {
          // Deep skin shadows -> teal/blue-green
          h = lerpHue(h, HUE_TEAL, sw * 0.55);
          s = s * 0.55 + 0.12;
        } else if (l < 0.4) {
          // Skin shadows -> teal-to-warm transition
          const t = (l - 0.25) / 0.15;
          const targetH = lerpHue(HUE_TEAL, HUE_SALMON, t);
          h = lerpHue(h, targetH, sw * 0.48);
          s = Math.min(1, s * (0.7 + t * 0.4));
        } else if (l < 0.65) {
          // Skin mid-tones -> warm salmon/amber
          h = lerpHue(h, HUE_SALMON, sw * 0.42);
          s = Math.min(1, s * 1.08);
        } else if (l < 0.82) {
          // Skin highlights -> golden amber
          h = lerpHue(h, HUE_AMBER, sw * 0.38);
          s = Math.min(1, s * 0.9);
          l = Math.min(1, l * 1.03);
        } else {
          // Bright skin highlights -> warm white/pink
          h = lerpHue(h, HUE_WARM_PINK, sw * 0.2);
          s *= 0.3;
        }

      } else {
        // --- NON-SKIN treatment ---
        // Preserve original hue diversity but apply DE color grading

        // LUMINANCE-BASED TEMPERATURE (warm lights, cool shadows)
        if (l < 0.15) {
          // Very deep shadows -> dark teal/blue-green
          h = lerpHue(h, HUE_COOL_BLUE, warmth * 0.5);
          s = Math.min(1, s * 0.4 + 0.05);
        } else if (l < 0.3) {
          // Shadows -> cool teal shift
          h = lerpHue(h, HUE_TEAL, warmth * 0.35);
          s *= 0.65;
        } else if (l < 0.65) {
          // Mid-tones -> PRESERVE HUE, apply per-category treatment
          switch (hueCategory) {
            case HueCategory.SKIN_WARM:
              // Warm reds/oranges -> push toward ochre/burnt sienna
              h = lerpHue(h, HUE_AMBER, warmth * 0.3);
              s = Math.min(1, s * 1.1 * saturationMod + 0.05);
              break;
            case HueCategory.YELLOW_GOLD:
              // Yellows -> enhance into rich gold
              h = lerpHue(h, HUE_GOLDEN, warmth * 0.2);
              s = Math.min(1, s * 1.2 * saturationMod);
              break;
            case HueCategory.GREEN:
              // Greens -> mute into sage/olive (DE's muted environments)
              h = lerpHue(h, HUE_SAGE, warmth * 0.25);
              s = Math.min(1, s * 0.85 * saturationMod);
              break;
            case HueCategory.TEAL_CYAN:
              // Teals -> keep and enhance (DE loves teal)
              s = Math.min(1, s * 1.15 * saturationMod);
              break;
            case HueCategory.BLUE:
              // Blues -> preserve but slight teal shift (DE's blue-green palette)
              h = lerpHue(h, HUE_TEAL, warmth * 0.15);
              s = Math.min(1, s * 1.1 * saturationMod);
              break;
            case HueCategory.PURPLE:
              // Purples -> push toward dusty purple (DE accent color)
              h = lerpHue(h, HUE_DUSTY_PURPLE, warmth * 0.2);
              s = Math.min(1, s * 1.05 * saturationMod);
              break;
            case HueCategory.MAGENTA_PINK:
              // Pinks -> keep the warmth, slight desaturation
              s = Math.min(1, s * 0.9 * saturationMod);
              break;
            case HueCategory.NEUTRAL:
              // Neutral mid-tones -> slight warm tint
              h = lerpHue(h, HUE_AMBER, warmth * 0.15);
              s = Math.min(1, s + 0.05);
              break;
          }
        } else if (l < 0.82) {
          // Highlights -> warm golden shift
          switch (hueCategory) {
            case HueCategory.BLUE:
            case HueCategory.TEAL_CYAN:
              // Cool highlights stay cool but soften
              s *= 0.7 * saturationMod;
              break;
            case HueCategory.GREEN:
              // Green highlights -> warm sage
              h = lerpHue(h, HUE_GOLDEN, warmth * 0.2);
              s *= 0.75 * saturationMod;
              break;
            default:
              // Warm highlights -> golden
              h = lerpHue(h, HUE_GOLDEN, warmth * 0.35);
              s = Math.min(1, s * 0.8 * saturationMod);
              break;
          }
        } else {
          // Very bright -> warm white with slight color
          h = lerpHue(h, HUE_GOLDEN, warmth * 0.2);
          s *= 0.25;
        }
      }

      // Global subtle saturation modulation
      s *= (saturationMod * 0.4 + 0.6); // Scale saturationMod to avoid total desaturation

      // Clamp
      h = ((h % 1) + 1) % 1;
      s = Math.max(0, Math.min(1, s));
      l = Math.max(0, Math.min(1, l));

      const [nr, ng, nb] = hslToRgb(h, s, l);
      d[idx] = nr;
      d[idx + 1] = ng;
      d[idx + 2] = nb;
    }
  }

  return dst;
}

// ============================================================
// Step 4b: Color Bleeding / Cross-Region Color Influence
// ============================================================

function colorBleeding(
  src: ImageData,
  width: number,
  height: number,
  bleedRadius: number
): ImageData {
  const dst = new ImageData(new Uint8ClampedArray(src.data), width, height);
  const sd = src.data;
  const dd = dst.data;

  // Light color bleeding - average nearby pixels with weight toward different hues
  // This creates the painterly "color spill" effect between regions
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const cr = sd[idx], cg = sd[idx + 1], cb = sd[idx + 2];

      let sumR = cr * 4, sumG = cg * 4, sumB = cb * 4;
      let totalW = 4;

      // Sample sparse neighbors
      for (let dy = -bleedRadius; dy <= bleedRadius; dy += bleedRadius) {
        for (let dx = -bleedRadius; dx <= bleedRadius; dx += bleedRadius) {
          if (dx === 0 && dy === 0) continue;
          const nx = Math.min(Math.max(x + dx, 0), width - 1);
          const ny = Math.min(Math.max(y + dy, 0), height - 1);
          const ni = (ny * width + nx) * 4;
          const nr = sd[ni], ng = sd[ni + 1], nb = sd[ni + 2];

          // Weight by color difference (bleed more where colors differ)
          const colorDiff = Math.abs(nr - cr) + Math.abs(ng - cg) + Math.abs(nb - cb);
          const w = colorDiff > 30 ? 0.3 : 0.1; // Stronger bleed at color boundaries

          sumR += nr * w;
          sumG += ng * w;
          sumB += nb * w;
          totalW += w;
        }
      }

      dd[idx] = sumR / totalW;
      dd[idx + 1] = sumG / totalW;
      dd[idx + 2] = sumB / totalW;
      dd[idx + 3] = sd[idx + 3];
    }
  }

  return dst;
}

// ============================================================
// Step 5: Apply dark outlines from edge map
// ============================================================

function applyEdges(
  src: ImageData,
  edges: Float32Array,
  strength: number,
  width: number,
  height: number
): ImageData {
  const dst = new ImageData(new Uint8ClampedArray(src.data), width, height);
  const d = dst.data;

  // Disco uses dark colored outlines that vary:
  // - warm areas get dark brown/sienna outlines
  // - cool areas get dark teal outlines
  for (let i = 0; i < edges.length; i++) {
    const edgeVal = edges[i];
    if (edgeVal > 0.15) {
      const idx = i * 4;
      const alpha = Math.min(1, (edgeVal - 0.15) * 2.5) * strength;

      // Determine outline color based on underlying pixel warmth
      const pr = d[idx], pg = d[idx + 1], pb = d[idx + 2];
      const warmness = (pr - pb) / 255; // positive = warm, negative = cool

      let outR: number, outG: number, outB: number;
      if (warmness > 0.1) {
        // Warm area -> dark brown/sienna outlines
        outR = 45; outG = 28; outB = 18;
      } else if (warmness < -0.05) {
        // Cool area -> dark teal outlines
        outR = 18; outG = 35; outB = 38;
      } else {
        // Neutral -> dark sepia
        outR = 35; outG = 30; outB = 25;
      }

      d[idx] = d[idx] * (1 - alpha) + outR * alpha;
      d[idx + 1] = d[idx + 1] * (1 - alpha) + outG * alpha;
      d[idx + 2] = d[idx + 2] * (1 - alpha) + outB * alpha;
    }
  }

  return dst;
}

// ============================================================
// Step 6: Canvas Texture Overlay (procedural)
// ============================================================

function applyCanvasTexture(
  src: ImageData,
  strength: number
): ImageData {
  const dst = new ImageData(new Uint8ClampedArray(src.data), src.width, src.height);
  const d = dst.data;
  const w = src.width;
  const h = src.height;

  // Generate procedural canvas weave texture — smooth, low-frequency pattern
  // that mimics real canvas without per-pixel stippling
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;

      // Canvas weave: horizontal and vertical thread pattern (every 3-4px)
      const threadH = Math.sin(x * 1.05) * Math.sin(y * 0.35) * 8;
      const threadV = Math.sin(y * 1.05) * Math.sin(x * 0.35) * 8;
      const weave = (threadH + threadV) * 0.5;

      // Low-frequency noise (smooth undulation, not per-pixel)
      const noise1 = Math.sin(x * 0.08 + y * 0.06) * 6;
      const noise2 = Math.sin(x * 0.13 - y * 0.09 + 2.7) * 4;

      const textureVal = (weave + noise1 + noise2) * strength;

      d[idx] = Math.max(0, Math.min(255, d[idx] + textureVal));
      d[idx + 1] = Math.max(0, Math.min(255, d[idx + 1] + textureVal));
      d[idx + 2] = Math.max(0, Math.min(255, d[idx + 2] + textureVal));
    }
  }

  return dst;
}

// ============================================================
// Step 7: Brushstroke Simulation
// ============================================================

function simulateBrushstrokes(
  src: ImageData,
  width: number,
  height: number,
  brushSize: number
): ImageData {
  const dst = new ImageData(new Uint8ClampedArray(src.data), width, height);
  const sd = src.data;
  const dd = dst.data;

  // Simulate directional brushstrokes by smearing colors along gradients
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;

      // Calculate local gradient direction
      const idxL = (y * width + Math.max(0, x - 1)) * 4;
      const idxR = (y * width + Math.min(width - 1, x + 1)) * 4;
      const idxT = (Math.max(0, y - 1) * width + x) * 4;
      const idxB = (Math.min(height - 1, y + 1) * width + x) * 4;

      const gx = (sd[idxR] - sd[idxL]) + (sd[idxR + 1] - sd[idxL + 1]) + (sd[idxR + 2] - sd[idxL + 2]);
      const gy = (sd[idxB] - sd[idxT]) + (sd[idxB + 1] - sd[idxT + 1]) + (sd[idxB + 2] - sd[idxT + 2]);

      // Perpendicular to gradient (brushstroke direction)
      const mag = Math.sqrt(gx * gx + gy * gy) + 0.001;
      const dx = -gy / mag;
      const dy = gx / mag;

      // Average along brushstroke direction
      let sumR = 0, sumG = 0, sumB = 0, count = 0;
      for (let k = -brushSize; k <= brushSize; k++) {
        const nx = Math.round(x + dx * k * 0.5);
        const ny = Math.round(y + dy * k * 0.5);
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const ni = (ny * width + nx) * 4;
          sumR += sd[ni];
          sumG += sd[ni + 1];
          sumB += sd[ni + 2];
          count++;
        }
      }

      dd[idx] = sumR / count;
      dd[idx + 1] = sumG / count;
      dd[idx + 2] = sumB / count;
      dd[idx + 3] = sd[idx + 3];
    }
  }

  return dst;
}

// ============================================================
// Step 8: Vignette (Disco has moody dark edges)
// ============================================================

function applyVignette(src: ImageData, width: number, height: number, strength: number): ImageData {
  const dst = new ImageData(new Uint8ClampedArray(src.data), width, height);
  const d = dst.data;
  const cx = width / 2;
  const cy = height / 2;
  const maxDist = Math.sqrt(cx * cx + cy * cy);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy) / maxDist;
      const vignette = 1 - dist * dist * strength;
      d[idx] = Math.max(0, d[idx] * vignette);
      d[idx + 1] = Math.max(0, d[idx + 1] * vignette);
      d[idx + 2] = Math.max(0, d[idx + 2] * vignette);
    }
  }

  return dst;
}

// ============================================================
// Bilateral filter approximation for pre-smoothing
// ============================================================

function bilateralFilter(
  src: ImageData,
  width: number,
  height: number,
  radius: number,
  sigmaSpace: number,
  sigmaColor: number,
  faceRegions: FaceRegion[] = []
): ImageData {
  const dst = new ImageData(width, height);
  const sd = src.data;
  const dd = dst.data;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const cr = sd[idx], cg = sd[idx + 1], cb = sd[idx + 2];

      // Slightly wider smoothing in face regions to reduce noise before painting
      let r = radius;
      let sc = sigmaColor;
      for (const face of faceRegions) {
        if (x >= face.x && x <= face.x + face.width &&
          y >= face.y && y <= face.y + face.height) {
          r = radius + 1;    // Slightly wider spatial smoothing on faces
          sc = sigmaColor * 0.75; // Moderately tighter color gate
          break;
        }
      }

      let sumR = 0, sumG = 0, sumB = 0, sumW = 0;

      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const nx = Math.min(Math.max(x + dx, 0), width - 1);
          const ny = Math.min(Math.max(y + dy, 0), height - 1);
          const ni = (ny * width + nx) * 4;

          const nr = sd[ni], ng = sd[ni + 1], nb = sd[ni + 2];

          const spatialDist = dx * dx + dy * dy;
          const colorDist = (nr - cr) ** 2 + (ng - cg) ** 2 + (nb - cb) ** 2;

          const w = Math.exp(-spatialDist / (2 * sigmaSpace * sigmaSpace))
            * Math.exp(-colorDist / (2 * sc * sc));

          sumR += nr * w;
          sumG += ng * w;
          sumB += nb * w;
          sumW += w;
        }
      }

      dd[idx] = sumR / sumW;
      dd[idx + 1] = sumG / sumW;
      dd[idx + 2] = sumB / sumW;
      dd[idx + 3] = sd[idx + 3];
    }
  }
  return dst;
}

// ============================================================
// Step 9: Detail Recovery via High-Pass Blending
// Extracts fine detail from the original and blends it back
// into the painted result to preserve sharpness and texture.
// ============================================================

function extractHighPassDetail(
  original: ImageData,
  blurred: ImageData,
  width: number,
  height: number
): Float32Array {
  const od = original.data;
  const bd = blurred.data;
  // Store per-pixel luminance difference (high-frequency detail)
  const detail = new Float32Array(width * height);

  for (let i = 0; i < detail.length; i++) {
    const idx = i * 4;
    const origLum = 0.299 * od[idx] + 0.587 * od[idx + 1] + 0.114 * od[idx + 2];
    const blurLum = 0.299 * bd[idx] + 0.587 * bd[idx + 1] + 0.114 * bd[idx + 2];
    detail[i] = origLum - blurLum; // positive = brighter detail, negative = darker
  }

  return detail;
}

function boxBlur(src: ImageData, width: number, height: number, radius: number): ImageData {
  const dst = new ImageData(new Uint8ClampedArray(src.data), width, height);
  const sd = src.data;
  const dd = dst.data;
  const tmp = new Uint8ClampedArray(sd.length);

  // Horizontal pass
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sumR = 0, sumG = 0, sumB = 0, count = 0;
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = Math.min(Math.max(x + dx, 0), width - 1);
        const idx = (y * width + nx) * 4;
        sumR += sd[idx]; sumG += sd[idx + 1]; sumB += sd[idx + 2];
        count++;
      }
      const idx = (y * width + x) * 4;
      tmp[idx] = sumR / count;
      tmp[idx + 1] = sumG / count;
      tmp[idx + 2] = sumB / count;
      tmp[idx + 3] = sd[idx + 3];
    }
  }

  // Vertical pass
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sumR = 0, sumG = 0, sumB = 0, count = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        const ny = Math.min(Math.max(y + dy, 0), height - 1);
        const idx = (ny * width + x) * 4;
        sumR += tmp[idx]; sumG += tmp[idx + 1]; sumB += tmp[idx + 2];
        count++;
      }
      const idx = (y * width + x) * 4;
      dd[idx] = sumR / count;
      dd[idx + 1] = sumG / count;
      dd[idx + 2] = sumB / count;
      dd[idx + 3] = tmp[idx + 3];
    }
  }

  return dst;
}

function applyDetailRecovery(
  painted: ImageData,
  highPassDetail: Float32Array,
  width: number,
  height: number,
  strength: number,
  faceRegions: FaceRegion[]
): ImageData {
  const dst = new ImageData(new Uint8ClampedArray(painted.data), width, height);
  const d = dst.data;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      const idx = p * 4;
      const detail = highPassDetail[p];

      // Stronger detail recovery in face regions (preserve facial features)
      let localStrength = strength;
      for (const face of faceRegions) {
        if (x >= face.x && x <= face.x + face.width &&
          y >= face.y && y <= face.y + face.height) {
          localStrength = Math.min(1, strength * 1.4);
          break;
        }
      }

      // Apply detail with soft clamping to avoid noise amplification
      // Only recover prominent detail — suppress small variations (sensor noise)
      const absDetail = Math.abs(detail);
      const softDetail = absDetail > 8 ? detail * (1 - Math.exp(-absDetail / 30)) : detail * 0.1;
      const adjustment = softDetail * localStrength;

      d[idx] = Math.max(0, Math.min(255, d[idx] + adjustment));
      d[idx + 1] = Math.max(0, Math.min(255, d[idx + 1] + adjustment));
      d[idx + 2] = Math.max(0, Math.min(255, d[idx + 2] + adjustment));
    }
  }

  return dst;
}

// ============================================================
// Step 10: Multi-scale Edge Detection for finer detail outlines
// Combines Sobel at multiple scales for both bold contours and
// fine structural detail (hair, wrinkles, fabric folds, etc.)
// ============================================================

function multiScaleEdges(
  src: ImageData,
  width: number,
  height: number,
  detailLevel: number
): Float32Array {
  const gray = new Float32Array(width * height);
  const sd = src.data;

  for (let i = 0; i < gray.length; i++) {
    const idx = i * 4;
    gray[i] = 0.299 * sd[idx] + 0.587 * sd[idx + 1] + 0.114 * sd[idx + 2];
  }

  const edges = new Float32Array(width * height);

  // Standard Sobel (bold contours)
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const tl = gray[(y - 1) * width + (x - 1)];
      const t = gray[(y - 1) * width + x];
      const tr = gray[(y - 1) * width + (x + 1)];
      const l = gray[y * width + (x - 1)];
      const r = gray[y * width + (x + 1)];
      const bl = gray[(y + 1) * width + (x - 1)];
      const b = gray[(y + 1) * width + x];
      const br = gray[(y + 1) * width + (x + 1)];

      const gx = -tl - 2 * l - bl + tr + 2 * r + br;
      const gy = -tl - 2 * t - tr + bl + 2 * b + br;
      edges[y * width + x] = Math.sqrt(gx * gx + gy * gy);
    }
  }

  // Fine detail edges using Laplacian (second derivative — catches fine lines)
  if (detailLevel > 0.2) {
    const fineWeight = detailLevel * 0.6;
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const c = gray[y * width + x];
        const t = gray[(y - 1) * width + x];
        const b = gray[(y + 1) * width + x];
        const l = gray[y * width + (x - 1)];
        const r = gray[y * width + (x + 1)];
        const laplacian = Math.abs(t + b + l + r - 4 * c);
        edges[y * width + x] += laplacian * fineWeight;
      }
    }
  }

  // Normalize
  let max = 0;
  for (let i = 0; i < edges.length; i++) {
    if (edges[i] > max) max = edges[i];
  }
  if (max > 0) {
    for (let i = 0; i < edges.length; i++) {
      edges[i] /= max;
    }
  }

  return edges;
}

// ============================================================
// Main Processing Pipeline
// ============================================================

export type ProgressCallback = (step: string, progress: number) => void;

export async function applyDiscoFilter(
  canvas: HTMLCanvasElement,
  sourceImage: HTMLImageElement | HTMLCanvasElement,
  options: FilterOptions = DEFAULT_OPTIONS,
  onProgress?: ProgressCallback
): Promise<void> {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

  // Limit processing size for performance (max 1200px on longest side)
  const maxDim = 1200;
  let w = sourceImage.width || (sourceImage as HTMLCanvasElement).width;
  let h = sourceImage.height || (sourceImage as HTMLCanvasElement).height;

  if (w > maxDim || h > maxDim) {
    const scale = maxDim / Math.max(w, h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }

  canvas.width = w;
  canvas.height = h;
  ctx.drawImage(sourceImage, 0, 0, w, h);

  // Scale face regions
  const scaleX = w / (sourceImage.width || (sourceImage as HTMLCanvasElement).width);
  const scaleY = h / (sourceImage.height || (sourceImage as HTMLCanvasElement).height);
  const scaledFaces = options.faceRegions.map(f => ({
    x: Math.round(f.x * scaleX),
    y: Math.round(f.y * scaleY),
    width: Math.round(f.width * scaleX),
    height: Math.round(f.height * scaleY),
  }));

  let imageData = ctx.getImageData(0, 0, w, h);

  // Keep a copy of the original for detail recovery
  const originalImageData = new ImageData(new Uint8ClampedArray(imageData.data), w, h);

  const detail = options.detailPreservation;

  // Pipeline step 1: Pre-smooth with bilateral filter (lighter when detail is high)
  onProgress?.('Smoothing with bilateral filter...', 0.05);
  await yieldToMain();
  const bilateralRadius = detail > 0.6 ? 2 : detail > 0.3 ? 3 : 4;
  const bilateralSigmaColor = Math.max(20, 45 - detail * 25); // lower = smoother; higher detail = less smoothing
  imageData = bilateralFilter(imageData, w, h, bilateralRadius, 8, bilateralSigmaColor, scaledFaces);

  // Pipeline step 2: Oil paint / Kuwahara filter (smaller effective radius with high detail)
  onProgress?.('Applying oil paint effect...', 0.15);
  await yieldToMain();
  const effectiveBrushSize = detail > 0.5
    ? Math.max(2, options.brushSize - 1)
    : options.brushSize + (detail < 0.2 ? 1 : 0);
  imageData = oilPaintFilter(imageData, effectiveBrushSize, w, h, scaledFaces);

  // Pipeline step 3: Brushstroke simulation (gentler with high detail)
  onProgress?.('Simulating brushstrokes...', 0.30);
  await yieldToMain();
  const strokeSize = detail > 0.5
    ? Math.max(1, options.brushSize - 2)
    : Math.max(2, options.brushSize - 1);
  imageData = simulateBrushstrokes(imageData, w, h, strokeSize);

  // Pipeline step 3b: Detail recovery — blend back high-frequency detail from original
  // Only engage at higher detail settings to keep cel-shading clean
  if (detail > 0.4) {
    onProgress?.('Recovering fine details...', 0.40);
    await yieldToMain();
    const blurRadius = Math.max(3, Math.round(4 + (1 - detail) * 3));
    const blurredOriginal = boxBlur(originalImageData, w, h, blurRadius);
    const highPass = extractHighPassDetail(originalImageData, blurredOriginal, w, h);
    imageData = applyDetailRecovery(imageData, highPass, w, h, detail * 0.5, scaledFaces);
  }

  // Pipeline step 4: Posterize for cel-shading (more levels when detail is high)
  onProgress?.('Applying cel-shading...', 0.50);
  await yieldToMain();
  const effectiveLevels = detail > 0.5
    ? Math.min(12, options.posterizeLevels + Math.round(detail * 2))
    : options.posterizeLevels;
  imageData = posterize(imageData, effectiveLevels, scaledFaces);

  // Pipeline step 4b: Light cleanup pass — smooth single-pixel color noise
  // from posterization boundaries for cleaner flat regions
  if (detail < 0.5) {
    imageData = boxBlur(imageData, w, h, 1);
    imageData = posterize(imageData, effectiveLevels, scaledFaces);
  }

  // Pipeline step 5: Color remapping to Disco palette
  onProgress?.('Remapping to Disco palette...', 0.60);
  await yieldToMain();
  imageData = remapColors(imageData, options.warmth, options.saturation, scaledFaces);

  // Pipeline step 6: Edge detection + dark outlines (multi-scale when detail is high)
  onProgress?.('Detecting edges for outlines...', 0.72);
  await yieldToMain();
  const edges = detail > 0.2
    ? multiScaleEdges(imageData, w, h, detail)
    : sobelEdges(imageData, w, h);
  // Lower edge threshold when detail is high to reveal finer outlines
  const effectiveEdgeStrength = options.edgeStrength + detail * 0.15;
  imageData = applyEdges(imageData, edges, Math.min(1, effectiveEdgeStrength), w, h);

  // Pipeline step 7: Canvas texture overlay
  onProgress?.('Adding canvas texture...', 0.85);
  await yieldToMain();
  imageData = applyCanvasTexture(imageData, options.textureStrength);

  // Pipeline step 8: Vignette
  onProgress?.('Applying vignette...', 0.92);
  await yieldToMain();
  imageData = applyVignette(imageData, w, h, 0.4 * options.intensity);

  // Blend with original based on intensity
  if (options.intensity < 1) {
    const original = ctx.getImageData(0, 0, w, h);
    ctx.drawImage(sourceImage, 0, 0, w, h);
    const origData = ctx.getImageData(0, 0, w, h);
    const od = origData.data;
    const fd = imageData.data;
    const blend = options.intensity;
    for (let i = 0; i < fd.length; i += 4) {
      fd[i] = od[i] * (1 - blend) + fd[i] * blend;
      fd[i + 1] = od[i + 1] * (1 - blend) + fd[i + 1] * blend;
      fd[i + 2] = od[i + 2] * (1 - blend) + fd[i + 2] * blend;
    }
  }

  // Draw final result
  ctx.putImageData(imageData, 0, 0);
  onProgress?.('Done!', 1.0);
}

// Utility to yield to main thread (keep UI responsive)
function yieldToMain(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

/**
 * Disco Elysium Art Style Filter
 * 
 * Replicates the distinctive painterly oil-painting style of Disco Elysium:
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
  intensity: number;         // 0-1, overall effect strength
  posterizeLevels: number;   // 4-12, color quantization levels
  edgeStrength: number;      // 0-1, dark outline strength
  brushSize: number;         // 2-6, oil paint brush radius
  warmth: number;            // 0-1, warm amber tint
  saturation: number;        // 0-1, color saturation
  textureStrength: number;   // 0-1, canvas texture overlay
  faceRegions: FaceRegion[];
}

export const DEFAULT_OPTIONS: FilterOptions = {
  intensity: 0.85,
  posterizeLevels: 8,
  edgeStrength: 0.6,
  brushSize: 4,
  warmth: 0.35,
  saturation: 0.55,
  textureStrength: 0.3,
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
      // Use smaller radius in face regions for more detail
      let r = radius;
      for (const face of faceRegions) {
        if (x >= face.x && x <= face.x + face.width &&
          y >= face.y && y <= face.y + face.height) {
          r = Math.max(1, Math.floor(radius * 0.5));
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

function posterize(src: ImageData, levels: number): ImageData {
  const dst = new ImageData(new Uint8ClampedArray(src.data), src.width, src.height);
  const d = dst.data;
  const step = 255 / (levels - 1);

  for (let i = 0; i < d.length; i += 4) {
    d[i] = Math.round(Math.round(d[i] / step) * step);
    d[i + 1] = Math.round(Math.round(d[i + 1] / step) * step);
    d[i + 2] = Math.round(Math.round(d[i + 2] / step) * step);
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
// Step 4: Color Palette Remapping (Disco Elysium tones)
// ============================================================

function remapColors(
  src: ImageData,
  warmth: number,
  saturationMod: number,
  faceRegions: FaceRegion[]
): ImageData {
  const dst = new ImageData(new Uint8ClampedArray(src.data), src.width, src.height);
  const d = dst.data;
  const w = src.width;

  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      let r = d[idx], g = d[idx + 1], b = d[idx + 2];

      // Convert to HSL
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

      // Disco Elysium color grading:
      // - Overall desaturation with warm shift
      // - Faces get warmer, slightly more saturated treatment
      // - Shift blues toward teal, reds toward ochre/sienna

      // Desaturate
      s *= saturationMod;

      // Warm shift: push hue toward amber/ochre (h ~0.08-0.12)
      if (inFace) {
        // Warmer treatment for faces - more orange/amber
        h = h + (0.07 - h) * warmth * 0.4;
        s = Math.min(1, s * 1.15); // Slightly more saturated faces
        // Slight warm luminance boost
        l = Math.min(1, l * 1.05);
      } else {
        // General warm shift
        h = h + (0.09 - h) * warmth * 0.2;
      }

      // Add slight teal to shadows (Disco Elysium shadow tones)
      if (l < 0.3) {
        h = h + (0.5 - h) * 0.1; // Slight teal in shadows
        s = Math.min(1, s * 0.8);
      }

      // Boost warm highlights
      if (l > 0.7) {
        h = h + (0.1 - h) * warmth * 0.3; // Golden highlights
      }

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

  // Disco Elysium uses dark sepia/brown outlines, not pure black
  const outlineR = 35, outlineG = 25, outlineB = 20;

  for (let i = 0; i < edges.length; i++) {
    const edgeVal = edges[i];
    if (edgeVal > 0.15) { // Threshold
      const idx = i * 4;
      const alpha = Math.min(1, (edgeVal - 0.15) * 2.5) * strength;
      d[idx] = d[idx] * (1 - alpha) + outlineR * alpha;
      d[idx + 1] = d[idx + 1] * (1 - alpha) + outlineG * alpha;
      d[idx + 2] = d[idx + 2] * (1 - alpha) + outlineB * alpha;
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

  // Generate procedural canvas texture (crosshatch + noise pattern)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;

      // Crosshatch canvas pattern
      const crosshatch = ((x + y) % 3 === 0 ? -15 : 0) +
        ((x - y + 1000) % 4 === 0 ? -10 : 0);

      // Pseudo-random noise (deterministic based on position)
      const noise = (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
      const noiseVal = (noise - 0.5) * 30;

      // Combine
      const textureVal = (crosshatch + noiseVal) * strength;

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
// Step 8: Vignette (Disco Elysium has moody dark edges)
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
  sigmaColor: number
): ImageData {
  const dst = new ImageData(width, height);
  const sd = src.data;
  const dd = dst.data;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const cr = sd[idx], cg = sd[idx + 1], cb = sd[idx + 2];

      let sumR = 0, sumG = 0, sumB = 0, sumW = 0;

      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = Math.min(Math.max(x + dx, 0), width - 1);
          const ny = Math.min(Math.max(y + dy, 0), height - 1);
          const ni = (ny * width + nx) * 4;

          const nr = sd[ni], ng = sd[ni + 1], nb = sd[ni + 2];

          const spatialDist = dx * dx + dy * dy;
          const colorDist = (nr - cr) ** 2 + (ng - cg) ** 2 + (nb - cb) ** 2;

          const w = Math.exp(-spatialDist / (2 * sigmaSpace * sigmaSpace))
            * Math.exp(-colorDist / (2 * sigmaColor * sigmaColor));

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
// Main Processing Pipeline
// ============================================================

export type ProgressCallback = (step: string, progress: number) => void;

export async function applyDiscoElysiumFilter(
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

  // Pipeline step 1: Pre-smooth with bilateral filter
  onProgress?.('Smoothing with bilateral filter...', 0.05);
  await yieldToMain();
  imageData = bilateralFilter(imageData, w, h, 3, 10, 30);

  // Pipeline step 2: Oil paint / Kuwahara filter
  onProgress?.('Applying oil paint effect...', 0.15);
  await yieldToMain();
  imageData = oilPaintFilter(imageData, options.brushSize, w, h, scaledFaces);

  // Pipeline step 3: Brushstroke simulation
  onProgress?.('Simulating brushstrokes...', 0.35);
  await yieldToMain();
  imageData = simulateBrushstrokes(imageData, w, h, Math.max(2, options.brushSize - 1));

  // Pipeline step 4: Posterize for cel-shading
  onProgress?.('Applying cel-shading...', 0.50);
  await yieldToMain();
  imageData = posterize(imageData, options.posterizeLevels);

  // Pipeline step 5: Color remapping to Disco Elysium palette
  onProgress?.('Remapping to Disco Elysium palette...', 0.60);
  await yieldToMain();
  imageData = remapColors(imageData, options.warmth, options.saturation, scaledFaces);

  // Pipeline step 6: Edge detection + dark outlines
  onProgress?.('Detecting edges for outlines...', 0.72);
  await yieldToMain();
  const edges = sobelEdges(imageData, w, h);
  imageData = applyEdges(imageData, edges, options.edgeStrength, w, h);

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

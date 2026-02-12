"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  applyDiscoFilter,
  FilterOptions,
  DEFAULT_OPTIONS,
} from "@/lib/disco-filter";
import { loadFaceDetectionModels, detectFaces, isModelLoaded } from "@/lib/face-detection";

// Quotes from for flavor
const QUOTES = [
  "The world is like a puzzle — every piece covered in oil paint.",
  "In the pale, all things dissolve into impressions.",
  "Reality is just pigment drying on canvas.",
  "Every face tells a story painted in ochre and shadow.",
  "The brushstrokes of existence are never clean.",
  "Art is reality viewed through a temperament... and fourteen beers.",
  "What is a portrait but a confession with colours?",
];

type PresetValues = Omit<FilterOptions, "faceRegions">;

const STYLE_PRESETS: Array<{
  name: string;
  values: PresetValues;
}> = [
  {
    name: "Default",
    values: {
      intensity: 0.85,
      posterizeLevels: 5,
      edgeStrength: 0.7,
      brushSize: 5,
      warmth: 0.35,
      saturation: 0.6,
      textureStrength: 0.12,
      detailPreservation: 0.1,
    },
  },
  {
    name: "Cartoon Soft",
    values: {
      intensity: 0.78,
      posterizeLevels: 6,
      edgeStrength: 0.5,
      brushSize: 5,
      warmth: 0.32,
      saturation: 0.68,
      textureStrength: 0.08,
      detailPreservation: 0.15,
    },
  },
  {
    name: "Cartoon Bold",
    values: {
      intensity: 0.92,
      posterizeLevels: 4,
      edgeStrength: 0.85,
      brushSize: 6,
      warmth: 0.4,
      saturation: 0.72,
      textureStrength: 0.06,
      detailPreservation: 0.05,
    },
  },
  {
    name: "Noir Paint",
    values: {
      intensity: 0.9,
      posterizeLevels: 5,
      edgeStrength: 0.82,
      brushSize: 5,
      warmth: 0.18,
      saturation: 0.38,
      textureStrength: 0.15,
      detailPreservation: 0.2,
    },
  },
  {
    name: "Golden Hour",
    values: {
      intensity: 0.84,
      posterizeLevels: 6,
      edgeStrength: 0.6,
      brushSize: 5,
      warmth: 0.58,
      saturation: 0.66,
      textureStrength: 0.1,
      detailPreservation: 0.2,
    },
  },
  {
    name: "Muted Film",
    values: {
      intensity: 0.82,
      posterizeLevels: 7,
      edgeStrength: 0.5,
      brushSize: 4,
      warmth: 0.28,
      saturation: 0.46,
      textureStrength: 0.1,
      detailPreservation: 0.3,
    },
  },
  {
    name: "Canvas Heavy",
    values: {
      intensity: 0.88,
      posterizeLevels: 5,
      edgeStrength: 0.65,
      brushSize: 5,
      warmth: 0.38,
      saturation: 0.58,
      textureStrength: 0.3,
      detailPreservation: 0.15,
    },
  },
  {
    name: "Fine Detail",
    values: {
      intensity: 0.82,
      posterizeLevels: 8,
      edgeStrength: 0.65,
      brushSize: 3,
      warmth: 0.3,
      saturation: 0.55,
      textureStrength: 0.15,
      detailPreservation: 0.8,
    },
  },
];

const DE_PALETTES = {
  martinaiseDusk: {
    label: "Martinaise Dusk",
    colors: [
      "#0d1620", "#1a2b42", "#2b4265",  // deep blue-grey shadows
      "#6f4538", "#8b5040", "#a5654d",   // rust / burnt sienna mids
      "#3a5f6b", "#4d7a82",              // teal mid-tones
      "#c48c5e", "#dab07a",              // amber / ochre highlights
      "#7a6878",                          // dusty mauve accent
      "#e8d8c2",                          // warm cream
    ],
  },
  whirlingInRags: {
    label: "Whirling-in-Rags",
    colors: [
      "#161010", "#2a1a18", "#3f2820",   // dark warm browns
      "#1d2e3d", "#2d4456",              // cool blue-grey shadows
      "#7a4834", "#9c5e42", "#b8785a",   // warm copper / terracotta
      "#4a6474", "#5f7e8b",              // slate teal mids
      "#d4a472",                          // golden sand
      "#ecd6b8",                          // pale warm
    ],
  },
  paleCold: {
    label: "Pale Cold",
    colors: [
      "#111a28", "#1e3048", "#2f4a68",   // deep blue shadows
      "#4a3340", "#6b4454",              // muted plum / warm darks
      "#4d7090", "#6888a8",              // steel blue mids
      "#8a5e50", "#a47060",              // salmon / warm rose
      "#90a0af",                          // cool grey-blue
      "#c8a888",                          // warm tan accent
      "#e8e4dc",                          // pale cream highlight
    ],
  },
  unionHeat: {
    label: "Union Heat",
    colors: [
      "#1c1212", "#321a1c", "#4d2428",   // deep crimson-brown shadows
      "#1a2838", "#2a3e54",              // dark cool blue-grey
      "#7c3538", "#a04842", "#c06050",   // warm reds / terra cotta
      "#48687c", "#5c8098",              // blue-steel contrast
      "#d89058",                          // amber accent
      "#e8c890",                          // golden highlight
    ],
  },
  tribunalNight: {
    label: "Tribunal Night",
    colors: [
      "#0c1018", "#152030", "#1e3248",   // very dark blue
      "#3a2428", "#543838",              // deep warm maroon
      "#385870", "#4a7090",              // mid blue
      "#785050", "#906058",              // muted warm rose/brick
      "#6080a0",                          // slate blue highlight
      "#b89878",                          // warm sand accent
      "#c8c0b4",                          // neutral warm-grey
    ],
  },
} as const;

type PaletteKey = keyof typeof DE_PALETTES;
type PaletteSelection = "none" | "auto" | PaletteKey;
type ResolvedPaletteSelection = "none" | PaletteKey;

const hexToRgb = (hex: string): [number, number, number] => {
  const clean = hex.replace("#", "");
  const value = Number.parseInt(clean, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};

const PALETTE_RGB: Record<PaletteKey, Array<[number, number, number]>> = Object.fromEntries(
  Object.entries(DE_PALETTES).map(([key, palette]) => [key, palette.colors.map((color) => hexToRgb(color))])
) as Record<PaletteKey, Array<[number, number, number]>>;

// Pre-compute luminance and warm bias for each palette color
const PALETTE_META: Record<PaletteKey, Array<{ lum: number; warmth: number }>> = Object.fromEntries(
  Object.entries(PALETTE_RGB).map(([key, colors]) => [
    key,
    colors.map((c) => ({
      lum: 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2],
      warmth: c[0] - c[2], // positive = warm, negative = cool
    })),
  ])
) as Record<PaletteKey, Array<{ lum: number; warmth: number }>>;

// Luminance-aware palette matching.
// Matches brightness first, then biases shadows toward cool palette entries
// and highlights toward warm ones — the core Disco color split.
const findStyledPaletteColor = (
  r: number,
  g: number,
  b: number,
  palette: Array<[number, number, number]>,
  meta: Array<{ lum: number; warmth: number }>
) => {
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  const inputWarmth = r - b;
  // Shadows should lean cool, highlights should lean warm
  const lumNorm = lum / 255; // 0 = dark, 1 = bright
  // desiredWarmth: negative for shadows, positive for highlights
  const desiredWarmth = (lumNorm - 0.4) * 80;

  let nearest = palette[0];
  let bestDist = Number.POSITIVE_INFINITY;

  for (let i = 0; i < palette.length; i++) {
    const color = palette[i];
    const m = meta[i];

    // Luminance distance (most important — match brightness)
    const lumDiff = lum - m.lum;
    const lumDist = lumDiff * lumDiff * 3.0;

    // Chrominance distance (less weight)
    const dr = r - color[0];
    const dg = g - color[1];
    const db = b - color[2];
    const chromaDist = (dr * dr + dg * dg + db * db) * 0.4;

    // Warm/cool style bias: reward palette entries that match the desired
    // temperature for this luminance level
    const warmthDiff = m.warmth - desiredWarmth;
    const warmthPenalty = warmthDiff * warmthDiff * 0.08;

    const dist = lumDist + chromaDist + warmthPenalty;
    if (dist < bestDist) {
      bestDist = dist;
      nearest = color;
    }
  }

  return nearest;
};

// Simple RGB nearest for palette detection scoring (needs to be unbiased)
const findNearestPaletteColor = (r: number, g: number, b: number, palette: Array<[number, number, number]>) => {
  let nearest = palette[0];
  let bestDist = Number.POSITIVE_INFINITY;

  for (const color of palette) {
    const dr = r - color[0];
    const dg = g - color[1];
    const db = b - color[2];
    const dist = dr * dr + dg * dg + db * db;
    if (dist < bestDist) {
      bestDist = dist;
      nearest = color;
    }
  }

  return nearest;
};

const colorLuminance = (color: [number, number, number]) => 0.299 * color[0] + 0.587 * color[1] + 0.114 * color[2];

const choosePaletteColorStyled = (
  r: number,
  g: number,
  b: number,
  palette: Array<[number, number, number]>,
  meta: Array<{ lum: number; warmth: number }>,
  seed: number
) => {
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  const lumNorm = lum / 255;
  const desiredWarmth = (lumNorm - 0.4) * 80;

  // Find best two candidates
  let nearestIdx = 0, secondIdx = 0;
  let nearestDist = Number.POSITIVE_INFINITY;
  let secondDist = Number.POSITIVE_INFINITY;

  for (let i = 0; i < palette.length; i++) {
    const color = palette[i];
    const m = meta[i];

    const lumDiff = lum - m.lum;
    const lumD = lumDiff * lumDiff * 3.0;
    const dr = r - color[0];
    const dg = g - color[1];
    const db = b - color[2];
    const chromaD = (dr * dr + dg * dg + db * db) * 0.4;
    const warmDiff = m.warmth - desiredWarmth;
    const warmD = warmDiff * warmDiff * 0.08;
    const dist = lumD + chromaD + warmD;

    if (dist < nearestDist) {
      secondIdx = nearestIdx;
      secondDist = nearestDist;
      nearestIdx = i;
      nearestDist = dist;
    } else if (dist < secondDist) {
      secondIdx = i;
      secondDist = dist;
    }
  }

  if (nearestIdx === secondIdx) return palette[nearestIdx];

  // Dither between the two nearest to avoid hard banding
  const closeness = nearestDist / Math.max(1, secondDist);
  if (closeness > 0.88) return palette[nearestIdx];

  const pseudo = Math.abs(Math.sin(seed * 12.9898) * 43758.5453) % 1;
  const chanceSecond = Math.min(0.5, (0.88 - closeness) * 1.5);
  if (pseudo < chanceSecond) return palette[secondIdx];

  return palette[nearestIdx];
};

const detectPaletteFromImageData = (imageData: ImageData): PaletteKey => {
  const { data, width, height } = imageData;
  const sampleStep = Math.max(3, Math.round(Math.min(width, height) / 120));

  let bestPalette: PaletteKey = "martinaiseDusk";
  let bestScore = Number.POSITIVE_INFINITY;

  for (const key of Object.keys(DE_PALETTES) as PaletteKey[]) {
    const palette = PALETTE_RGB[key];
    let score = 0;
    let samples = 0;

    for (let y = 0; y < height; y += sampleStep) {
      for (let x = 0; x < width; x += sampleStep) {
        const i = (y * width + x) * 4;
        const a = data[i + 3];
        if (a < 16) continue;

        const nearest = findNearestPaletteColor(data[i], data[i + 1], data[i + 2], palette);
        const dr = data[i] - nearest[0];
        const dg = data[i + 1] - nearest[1];
        const db = data[i + 2] - nearest[2];
        score += dr * dr + dg * dg + db * db;
        samples++;
      }
    }

    const normalizedScore = samples > 0 ? score / samples : Number.POSITIVE_INFINITY;
    if (normalizedScore < bestScore) {
      bestScore = normalizedScore;
      bestPalette = key;
    }
  }

  return bestPalette;
};

const applyPaletteToImageData = (imageData: ImageData, paletteKey: PaletteKey) => {
  const palette = PALETTE_RGB[paletteKey];
  const meta = PALETTE_META[paletteKey];
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 8) continue;
    const styled = choosePaletteColorStyled(data[i], data[i + 1], data[i + 2], palette, meta, i + data[i] * 7 + data[i + 1] * 13 + data[i + 2] * 17);
    data[i] = styled[0];
    data[i + 1] = styled[1];
    data[i + 2] = styled[2];
  }
};

const createFaceSubjectMask = (width: number, height: number, faceRegions: FilterOptions["faceRegions"]) => {
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = width;
  maskCanvas.height = height;
  const maskCtx = maskCanvas.getContext("2d");
  if (!maskCtx) return maskCanvas;

  maskCtx.clearRect(0, 0, width, height);
  maskCtx.fillStyle = "rgba(0,0,0,0)";
  maskCtx.fillRect(0, 0, width, height);
  maskCtx.fillStyle = "rgba(255,255,255,1)";

  for (const face of faceRegions) {
    const cx = face.x + face.width * 0.5;
    const faceCy = face.y + face.height * 0.5;

    const headW = face.width * 1.7;
    const headH = face.height * 2.0;

    const torsoW = face.width * 4.0;
    const torsoH = face.height * 7.2;
    const torsoCy = face.y + face.height * 3.7;

    const shoulderW = face.width * 4.8;
    const shoulderH = face.height * 2.2;
    const shoulderCy = face.y + face.height * 2.2;

    maskCtx.beginPath();
    maskCtx.ellipse(cx, faceCy, headW * 0.5, headH * 0.5, 0, 0, Math.PI * 2);
    maskCtx.fill();

    maskCtx.beginPath();
    maskCtx.ellipse(cx, shoulderCy, shoulderW * 0.5, shoulderH * 0.5, 0, 0, Math.PI * 2);
    maskCtx.fill();

    maskCtx.beginPath();
    maskCtx.ellipse(cx, torsoCy, torsoW * 0.5, torsoH * 0.5, 0, 0, Math.PI * 2);
    maskCtx.fill();
  }

  const featheredCanvas = document.createElement("canvas");
  featheredCanvas.width = width;
  featheredCanvas.height = height;
  const featheredCtx = featheredCanvas.getContext("2d");
  if (!featheredCtx) return maskCanvas;

  featheredCtx.filter = "blur(16px)";
  featheredCtx.drawImage(maskCanvas, 0, 0);
  featheredCtx.filter = "none";
  return featheredCanvas;
};

type CompositeScratch = {
  abstractCanvas: HTMLCanvasElement;
  abstractCtx: CanvasRenderingContext2D;
  subjectCanvas: HTMLCanvasElement;
  subjectCtx: CanvasRenderingContext2D;
};

const createCompositeScratch = (width: number, height: number): CompositeScratch | null => {
  const abstractCanvas = document.createElement("canvas");
  abstractCanvas.width = width;
  abstractCanvas.height = height;
  const abstractCtx = abstractCanvas.getContext("2d");
  if (!abstractCtx) return null;

  const subjectCanvas = document.createElement("canvas");
  subjectCanvas.width = width;
  subjectCanvas.height = height;
  const subjectCtx = subjectCanvas.getContext("2d");
  if (!subjectCtx) return null;

  return { abstractCanvas, abstractCtx, subjectCanvas, subjectCtx };
};

const composeAbstractBackgroundWithSubject = (
  targetCanvas: HTMLCanvasElement,
  paintedCanvas: HTMLCanvasElement,
  maskCanvas: HTMLCanvasElement,
  scratch?: CompositeScratch
) => {
  const width = targetCanvas.width;
  const height = targetCanvas.height;
  const targetCtx = targetCanvas.getContext("2d");
  if (!targetCtx) return;

  const abstractCanvas = scratch?.abstractCanvas ?? document.createElement("canvas");
  if (abstractCanvas.width !== width || abstractCanvas.height !== height) {
    abstractCanvas.width = width;
    abstractCanvas.height = height;
  }
  const abstractCtx = scratch?.abstractCtx ?? abstractCanvas.getContext("2d");
  if (!abstractCtx) return;

  abstractCtx.clearRect(0, 0, width, height);

  abstractCtx.drawImage(paintedCanvas, 0, 0, width, height);
  abstractCtx.globalAlpha = 0.42;
  abstractCtx.filter = "blur(9px) saturate(110%) contrast(100%)";
  abstractCtx.drawImage(paintedCanvas, 0, 0, width, height);
  abstractCtx.globalAlpha = 1;
  abstractCtx.filter = "none";

  abstractCtx.save();
  abstractCtx.globalCompositeOperation = "soft-light";
  abstractCtx.globalAlpha = 0.1;
  const grad = abstractCtx.createRadialGradient(width * 0.5, height * 0.5, width * 0.12, width * 0.5, height * 0.5, width * 0.8);
  grad.addColorStop(0, "rgba(190,140,90,0.35)");
  grad.addColorStop(1, "rgba(38,56,80,0.45)");
  abstractCtx.fillStyle = grad;
  abstractCtx.fillRect(0, 0, width, height);
  abstractCtx.restore();

  const subjectCanvas = scratch?.subjectCanvas ?? document.createElement("canvas");
  if (subjectCanvas.width !== width || subjectCanvas.height !== height) {
    subjectCanvas.width = width;
    subjectCanvas.height = height;
  }
  const subjectCtx = scratch?.subjectCtx ?? subjectCanvas.getContext("2d");
  if (!subjectCtx) return;

  subjectCtx.clearRect(0, 0, width, height);

  subjectCtx.drawImage(paintedCanvas, 0, 0, width, height);
  subjectCtx.globalCompositeOperation = "destination-in";
  subjectCtx.drawImage(maskCanvas, 0, 0, width, height);
  subjectCtx.globalCompositeOperation = "source-over";

  targetCtx.clearRect(0, 0, width, height);
  targetCtx.drawImage(abstractCanvas, 0, 0, width, height);
  targetCtx.drawImage(subjectCanvas, 0, 0, width, height);
};

export default function Home() {
  const [sourceMedia, setSourceMedia] = useState<string | null>(null);
  const [sourceType, setSourceType] = useState<"image" | "video" | null>(null);
  const [processedVideoUrl, setProcessedVideoUrl] = useState<string | null>(null);
  const [processedVideoExt, setProcessedVideoExt] = useState<"mp4" | "webm">("webm");
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [processed, setProcessed] = useState(false);
  const [dragover, setDragover] = useState(false);
  const [faceCount, setFaceCount] = useState(0);
  const [modelsReady, setModelsReady] = useState(false);
  const [sourceLoaded, setSourceLoaded] = useState(false);
  const quote = QUOTES[0];
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [paletteMode, setPaletteMode] = useState<PaletteSelection>("auto");
  const [activePalette, setActivePalette] = useState<PaletteKey>("martinaiseDusk");

  const [options, setOptions] = useState<FilterOptions>({ ...DEFAULT_OPTIONS });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sourceCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sourceMediaRef = useRef<string | null>(null);
  const processedVideoUrlRef = useRef<string | null>(null);

  // Load face detection models on mount
  useEffect(() => {
    loadFaceDetectionModels().then(() => {
      setModelsReady(isModelLoaded());
    });
  }, []);

  useEffect(() => {
    sourceMediaRef.current = sourceMedia;
  }, [sourceMedia]);

  useEffect(() => {
    processedVideoUrlRef.current = processedVideoUrl;
  }, [processedVideoUrl]);

  useEffect(() => {
    return () => {
      const currentSourceMedia = sourceMediaRef.current;
      const currentProcessedVideoUrl = processedVideoUrlRef.current;

      if (currentSourceMedia?.startsWith("blob:")) URL.revokeObjectURL(currentSourceMedia);
      if (currentProcessedVideoUrl?.startsWith("blob:")) URL.revokeObjectURL(currentProcessedVideoUrl);
    };
  }, []);

  const resetOutput = useCallback(() => {
    setProcessed(false);
    setProgress(0);
    setProgressText("");
    setFaceCount(0);
    setSourceLoaded(false);
    if (processedVideoUrl?.startsWith("blob:")) URL.revokeObjectURL(processedVideoUrl);
    setProcessedVideoUrl(null);
  }, [processedVideoUrl]);

  const clearMedia = useCallback(() => {
    if (sourceMedia?.startsWith("blob:")) URL.revokeObjectURL(sourceMedia);
    if (processedVideoUrl?.startsWith("blob:")) URL.revokeObjectURL(processedVideoUrl);
    setSourceMedia(null);
    setSourceType(null);
    setProcessedVideoUrl(null);
    setProcessedVideoExt("webm");
    setProcessing(false);
    setShowAdvanced(false);
    setFaceCount(0);
    setSourceLoaded(false);
    setProgress(0);
    setProgressText("");
    setProcessed(false);
  }, [processedVideoUrl, sourceMedia]);

  const handleFile = useCallback((file: File) => {
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    if (!isImage && !isVideo) return;

    resetOutput();

    const nextUrl = URL.createObjectURL(file);
    setSourceType(isVideo ? "video" : "image");
    setSourceMedia((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return nextUrl;
    });
    setShowAdvanced(true);
  }, [resetOutput]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragover(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData.items;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) handleFile(file);
          break;
        }
      }
    },
    [handleFile]
  );

  const drawToSourceCanvas = useCallback((source: CanvasImageSource, width: number, height: number) => {
    if (!sourceCanvasRef.current) return;
    const sourceCtx = sourceCanvasRef.current.getContext("2d");
    if (!sourceCtx) return;
    sourceCanvasRef.current.width = width;
    sourceCanvasRef.current.height = height;
    sourceCtx.clearRect(0, 0, width, height);
    sourceCtx.drawImage(source, 0, 0, width, height);
  }, []);

  const resolvePaletteForSource = useCallback((sourceCanvas: HTMLCanvasElement): ResolvedPaletteSelection => {
    if (paletteMode === "none") {
      return "none";
    }

    if (paletteMode !== "auto") {
      setActivePalette(paletteMode);
      return paletteMode;
    }

    const sourceCtx = sourceCanvas.getContext("2d", { willReadFrequently: true });
    if (!sourceCtx) {
      setActivePalette("martinaiseDusk");
      return "martinaiseDusk";
    }

    const sourceImageData = sourceCtx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    const detected = detectPaletteFromImageData(sourceImageData);
    setActivePalette(detected);
    return detected;
  }, [paletteMode]);

  const applyPaletteToCanvas = useCallback((canvas: HTMLCanvasElement, paletteKey: ResolvedPaletteSelection) => {
    if (paletteKey === "none") return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    applyPaletteToImageData(imageData, paletteKey);
    ctx.putImageData(imageData, 0, 0);
  }, []);

  const processImage = useCallback(async () => {
    if (!sourceMedia || !canvasRef.current) return;

    setProcessing(true);
    setProgress(0);
    setProcessed(false);

    const img = new Image();
    img.onload = async () => {
      const maxDim = 1200;
      let w = img.width;
      let h = img.height;
      if (w > maxDim || h > maxDim) {
        const scale = maxDim / Math.max(w, h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }

      drawToSourceCanvas(img, w, h);
      const paletteKey: ResolvedPaletteSelection = sourceCanvasRef.current
        ? resolvePaletteForSource(sourceCanvasRef.current)
        : "martinaiseDusk";

      let faceRegions = options.faceRegions;
      if (modelsReady) {
        setProgressText("Detecting faces...");
        setProgress(0.02);
        try {
          faceRegions = await detectFaces(img);
          setFaceCount(faceRegions.length);
        } catch {
          faceRegions = [];
        }
      }

      try {
        await applyDiscoFilter(
          canvasRef.current!,
          img,
          { ...options, faceRegions },
          (step, p) => {
            setProgressText(step);
            setProgress(p);
          }
        );
        if (faceRegions.length > 0) {
          setProgressText("Compositing abstract background...");
          const mask = createFaceSubjectMask(canvasRef.current!.width, canvasRef.current!.height, faceRegions);
          composeAbstractBackgroundWithSubject(canvasRef.current!, canvasRef.current!, mask);
          setProgress(0.9);
        }

        if (paletteKey !== "none") {
          setProgressText(`Applying palette: ${DE_PALETTES[paletteKey].label}...`);
          setProgress(0.96);
          applyPaletteToCanvas(canvasRef.current!, paletteKey);
        } else {
          setProgressText("Skipping palette mapping (None)");
          setProgress(0.96);
        }
        setProcessed(true);
        setSourceLoaded(true);
      } catch (err) {
        console.error("Filter error:", err);
      }

      setProcessing(false);
    };
    img.onerror = () => {
      setProcessing(false);
    };
    img.src = sourceMedia;
  }, [applyPaletteToCanvas, drawToSourceCanvas, modelsReady, options, resolvePaletteForSource, sourceMedia]);

  const processVideo = useCallback(async () => {
    if (!sourceMedia) return;
    if (typeof MediaRecorder === "undefined") {
      setProgressText("This browser does not support video export.");
      return;
    }

    setProcessing(true);
    setProgress(0);
    setProcessed(false);
    setProgressText("Loading video...");
    setProgress(0.02);

    const setVideoProgress = (value: number, text?: string) => {
      const clamped = Math.max(0, Math.min(1, value));
      setProgress((prev) => Math.max(prev, clamped));
      if (text) setProgressText(text);
    };

    const video = document.createElement("video");
    video.src = sourceMedia;
    video.playsInline = true;
    video.preload = "auto";
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.defaultMuted = true;
    video.volume = 0;

    try {
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error("Could not load video"));
      });
    } catch {
      setProcessing(false);
      setProgressText("Could not load video.");
      return;
    }

    if (!video.videoWidth || !video.videoHeight) {
      setProcessing(false);
      return;
    }

    const maxDim = 1080;
    let width = video.videoWidth;
    let height = video.videoHeight;
    if (width > maxDim || height > maxDim) {
      const scale = maxDim / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    const frameCanvas = document.createElement("canvas");
    frameCanvas.width = width;
    frameCanvas.height = height;
    const frameCtx = frameCanvas.getContext("2d", { willReadFrequently: true });

    if (!frameCtx) {
      setProcessing(false);
      return;
    }

    if (video.readyState < 2) {
      let firstFrameReady = true;
      await new Promise<void>((resolve, reject) => {
        video.onloadeddata = () => resolve();
        video.onerror = () => reject(new Error("Could not read first video frame"));
      }).catch(() => {
        firstFrameReady = false;
      });

      if (!firstFrameReady) {
        setProcessing(false);
        setProgressText("Could not read video frames.");
        return;
      }
    }

    try {
      video.currentTime = 0;
    } catch {
      // Some browsers may restrict seeks before playback; continue with current frame.
    }

    frameCtx.drawImage(video, 0, 0, width, height);
    drawToSourceCanvas(frameCanvas, width, height);
    setVideoProgress(0.06);

    const paletteKey = resolvePaletteForSource(frameCanvas);
    const paletteColors = paletteKey === "none" ? null : PALETTE_RGB[paletteKey];
    const paletteMeta = paletteKey === "none" ? null : PALETTE_META[paletteKey];
    if (paletteKey === "none") {
      setVideoProgress(0.08, "Palette: None");
    } else {
      setVideoProgress(0.08, `Palette: ${DE_PALETTES[paletteKey].label}`);
    }

    let faceRegions = options.faceRegions;
    if (modelsReady) {
      setProgressText("Detecting faces on first frame...");
      try {
        faceRegions = await detectFaces(frameCanvas);
        setFaceCount(faceRegions.length);
      } catch {
        faceRegions = [];
      }
    }
    setVideoProgress(0.1);

    const faceMask = faceRegions.length > 0 ? createFaceSubjectMask(width, height, faceRegions) : null;

    const outputCanvas = canvasRef.current ?? document.createElement("canvas");
    outputCanvas.width = width;
    outputCanvas.height = height;
    const outputCtx = outputCanvas.getContext("2d", { willReadFrequently: true });
    if (!outputCtx) {
      setProcessing(false);
      return;
    }

    const smallCanvas = document.createElement("canvas");
    const smallScale = 0.55;
    smallCanvas.width = Math.max(64, Math.round(width * smallScale));
    smallCanvas.height = Math.max(64, Math.round(height * smallScale));
    const smallCtx = smallCanvas.getContext("2d");
    if (!smallCtx) {
      setProcessing(false);
      return;
    }

    const pixelCount = smallCanvas.width * smallCanvas.height;
    const luminance = new Float32Array(pixelCount);
    const compositeScratch = faceMask ? createCompositeScratch(width, height) : null;

    // Pre-compute all constants outside the render loop
    const detailP = options.detailPreservation;
    const blurAmount = Math.max(0, (0.15 + options.brushSize * 0.08) * (1 - detailP * 0.6));
    const blurFilter = blurAmount > 0.02 ? `blur(${blurAmount}px)` : "";
    const detailBoost = Math.round(detailP * 4);
    const levels = Math.max(9, Math.min(22, Math.round(options.posterizeLevels + 5 + detailBoost)));
    const step = 255 / (levels - 1);
    const satBoost = 0.82 + options.saturation * 0.22;
    const warm = 3 + options.warmth * 7;
    const cool = 2.4 + options.warmth * 6.4;
    const channelStep = Math.max(5, step * 0.48);
    const edgeThreshold = Math.max(40, (96 + (1 - options.edgeStrength) * 92) * (1 - detailP * 0.4));
    const edgeStrengthVal = 0.1 + options.edgeStrength * 0.24 + detailP * 0.08;
    const useLaplacian = detailP > 0.3;
    const laplacianWeight = detailP * 0.5;
    const softLightAlpha = (0.04 + options.textureStrength * 0.08) * (1 - detailP * 0.5);
    const softLightBlur = Math.max(0, (0.35 + options.brushSize * 0.12) * (1 - detailP * 0.5));
    const softLightFilter = softLightBlur > 0.02 ? `blur(${softLightBlur}px)` : "";

    const renderFastPaintedFrame = () => {
      const sw = smallCanvas.width;
      const sh = smallCanvas.height;

      smallCtx.clearRect(0, 0, sw, sh);
      if (blurFilter) {
        smallCtx.filter = blurFilter;
      }
      smallCtx.drawImage(video, 0, 0, sw, sh);
      smallCtx.filter = "none";

      const imageData = smallCtx.getImageData(0, 0, sw, sh);
      const data = imageData.data;

      for (let i = 0, p = 0; i < data.length; i += 4, p++) {
        let r = data[i];
        let g = data[i + 1];
        let b = data[i + 2];

        const l = 0.299 * r + 0.587 * g + 0.114 * b;

        if (l < 88) {
          r -= cool * 0.12;
          g += cool * 0.08;
          b += cool * 0.42;
        } else if (l > 172) {
          r += warm * 0.58;
          g += warm * 0.28;
          b -= warm * 0.1;
        } else {
          r += warm * 0.11;
          g += warm * 0.04;
          b += cool * 0.02;
        }

        const qLum = Math.round(l / step) * step;
        const lSafe = Math.max(1, l);
        const lumRatio = qLum / lSafe;
        r *= lumRatio;
        g *= lumRatio;
        b *= lumRatio;

        const mid = (r + g + b) / 3;
        r = mid + (r - mid) * satBoost;
        g = mid + (g - mid) * satBoost;
        b = mid + (b - mid) * satBoost;

        // Gentle S-curve contrast for painterly depth.
        // Inline S-curve (avoid function call overhead per pixel)
        let nr = Math.max(0, Math.min(255, r)) / 255;
        let ng = Math.max(0, Math.min(255, g)) / 255;
        let nb = Math.max(0, Math.min(255, b)) / 255;
        r = nr * nr * (3 - 2 * nr) * 255;
        g = ng * ng * (3 - 2 * ng) * 255;
        b = nb * nb * (3 - 2 * nb) * 255;
        r = Math.round(Math.round(Math.max(0, Math.min(255, r)) / channelStep) * channelStep);
        g = Math.round(Math.round(Math.max(0, Math.min(255, g)) / channelStep) * channelStep);
        b = Math.round(Math.round(Math.max(0, Math.min(255, b)) / channelStep) * channelStep);

        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        const film = Math.max(0, Math.min(1, lum / 255));
        const mapped = (film * (2.35 - film)) / 1.35;
        const ratio = mapped / Math.max(0.001, film);
        r = Math.max(0, Math.min(255, r * ratio));
        g = Math.max(0, Math.min(255, g * ratio));
        b = Math.max(0, Math.min(255, b * ratio));

        if (paletteColors && paletteMeta) {
          const nearest = findStyledPaletteColor(r, g, b, paletteColors, paletteMeta);
          data[i] = nearest[0];
          data[i + 1] = nearest[1];
          data[i + 2] = nearest[2];
          luminance[p] = 0.299 * nearest[0] + 0.587 * nearest[1] + 0.114 * nearest[2];
        } else {
          data[i] = Math.round(r);
          data[i + 1] = Math.round(g);
          data[i + 2] = Math.round(b);
          luminance[p] = 0.299 * r + 0.587 * g + 0.114 * b;
        }
      }

      for (let y = 1; y < sh - 1; y++) {
        for (let x = 1; x < sw - 1; x++) {
          const p = y * sw + x;
          const l00 = luminance[p - sw - 1];
          const l01 = luminance[p - sw];
          const l02 = luminance[p - sw + 1];
          const l10 = luminance[p - 1];
          const l12 = luminance[p + 1];
          const l20 = luminance[p + sw - 1];
          const l21 = luminance[p + sw];
          const l22 = luminance[p + sw + 1];

          const gx = -l00 + l02 - 2 * l10 + 2 * l12 - l20 + l22;
          const gy = -l00 - 2 * l01 - l02 + l20 + 2 * l21 + l22;
          let e = gx * gx + gy * gy; // skip sqrt, compare squared

          if (useLaplacian) {
            const c = luminance[p];
            const laplacian = Math.abs(l01 + l21 + l10 + l12 - 4 * c);
            e = Math.sqrt(e) + laplacian * laplacianWeight;
          } else {
            e = Math.sqrt(e);
          }

          if (e <= edgeThreshold) continue;

          const i = p * 4;
          const t = Math.min(1, (e - edgeThreshold) / 240) * edgeStrengthVal;

          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const warmEdge = r >= b;

          const edgeR = warmEdge ? 40 : 34;
          const edgeG = warmEdge ? 30 : 41;
          const edgeB = warmEdge ? 26 : 50;

          data[i] = Math.round(r * (1 - t) + edgeR * t);
          data[i + 1] = Math.round(g * (1 - t) + edgeG * t);
          data[i + 2] = Math.round(b * (1 - t) + edgeB * t);

          if (t > 0.42 && x + 1 < sw - 1) {
            const j = (p + 1) * 4;
            const nt = t * 0.16;
            data[j] = Math.round(data[j] * (1 - nt) + edgeR * nt);
            data[j + 1] = Math.round(data[j + 1] * (1 - nt) + edgeG * nt);
            data[j + 2] = Math.round(data[j + 2] * (1 - nt) + edgeB * nt);
          }
        }
      }

      smallCtx.putImageData(imageData, 0, 0);

      outputCtx.clearRect(0, 0, width, height);
      outputCtx.drawImage(video, 0, 0, width, height);
      outputCtx.save();
      outputCtx.globalAlpha = 0.8 + options.intensity * 0.1;
      outputCtx.imageSmoothingEnabled = true;
      outputCtx.drawImage(smallCanvas, 0, 0, sw, sh, 0, 0, width, height);
      outputCtx.restore();

      outputCtx.save();
      outputCtx.globalAlpha = 0.09 + options.textureStrength * 0.12;
      outputCtx.globalCompositeOperation = "overlay";
      outputCtx.fillStyle = "rgba(68,82,96,0.16)";
      outputCtx.fillRect(0, 0, width, height);
      outputCtx.restore();

      // Split-tone glaze: cool shadows + warm highlights, subtle but characteristic.
      outputCtx.save();
      outputCtx.globalCompositeOperation = "soft-light";
      outputCtx.globalAlpha = 0.07 + options.intensity * 0.08;
      outputCtx.fillStyle = "rgba(54,66,82,0.45)";
      outputCtx.fillRect(0, 0, width, height);
      outputCtx.restore();

      outputCtx.save();
      outputCtx.globalCompositeOperation = "overlay";
      outputCtx.globalAlpha = 0.06 + options.warmth * 0.1;
      outputCtx.fillStyle = "rgba(170,112,74,0.32)";
      outputCtx.fillRect(0, 0, width, height);
      outputCtx.restore();

      if (softLightAlpha > 0.01) {
        outputCtx.save();
        outputCtx.globalCompositeOperation = "soft-light";
        outputCtx.globalAlpha = softLightAlpha;
        if (softLightFilter) {
          outputCtx.filter = softLightFilter;
        }
        outputCtx.drawImage(smallCanvas, 0, 0, sw, sh, 0, 0, width, height);
        outputCtx.filter = "none";
        outputCtx.restore();
      }

      outputCtx.save();
      outputCtx.globalCompositeOperation = "source-over";
      const grad = outputCtx.createRadialGradient(
        width * 0.5,
        height * 0.5,
        Math.min(width, height) * 0.25,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.7
      );
      grad.addColorStop(0, "rgba(0,0,0,0)");
      grad.addColorStop(1, `rgba(8,6,5,${0.16 + options.intensity * 0.14})`);
      outputCtx.fillStyle = grad;
      outputCtx.fillRect(0, 0, width, height);
      outputCtx.restore();

      outputCtx.save();
      outputCtx.globalCompositeOperation = "overlay";
      outputCtx.globalAlpha = 0.08 + options.edgeStrength * 0.16;
      outputCtx.filter = "contrast(118%)";
      outputCtx.drawImage(smallCanvas, 0, 0, sw, sh, 0, 0, width, height);
      outputCtx.filter = "none";
      outputCtx.restore();

      if (faceMask) {
        composeAbstractBackgroundWithSubject(outputCanvas, outputCanvas, faceMask, compositeScratch ?? undefined);
      }
    };

    setProgressText("Painting first frame...");
    renderFastPaintedFrame();

    const capturableVideo = video as HTMLVideoElement & {
      captureStream?: () => MediaStream;
      mozCaptureStream?: () => MediaStream;
    };
    const sourceStream =
      (typeof capturableVideo.captureStream === "function" ? capturableVideo.captureStream() : undefined) ??
      (typeof capturableVideo.mozCaptureStream === "function" ? capturableVideo.mozCaptureStream() : undefined);

    const sourceFps = sourceStream?.getVideoTracks?.()?.[0]?.getSettings?.().frameRate;
    const targetFps = Math.max(24, Math.min(60, Math.round(sourceFps ?? 30)));
    const canvasStream = outputCanvas.captureStream(targetFps);
    const stream = new MediaStream();
    for (const track of canvasStream.getVideoTracks()) {
      stream.addTrack(track);
    }

    const audioTrack = sourceStream?.getAudioTracks?.()[0];
    if (audioTrack) {
      stream.addTrack(audioTrack);
    }

    const mimeCandidates = [
      "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
      "video/mp4;codecs=avc1",
      "video/mp4",
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
    ];
    const mimeType = mimeCandidates.find((candidate) => MediaRecorder.isTypeSupported(candidate));
    const targetBitrate = Math.max(8_000_000, Math.round(width * height * targetFps * 0.16));
    const mediaRecorder = new MediaRecorder(
      stream,
      mimeType
        ? { mimeType, videoBitsPerSecond: targetBitrate }
        : { videoBitsPerSecond: targetBitrate }
    );
    const chunks: Blob[] = [];

    const recordedBlobPromise = new Promise<Blob>((resolve) => {
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      mediaRecorder.onstop = () => resolve(new Blob(chunks, { type: mimeType ?? "video/webm" }));
    });

    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1;

    let stopped = false;
    let processingFrame = false;
    let lastFrameTime = -1;
    const frameInterval = 1 / targetFps;
    const paintStageStart = performance.now();

    const loop = () => {
      if (stopped || video.paused || video.ended || processingFrame) return;

      const nowTime = video.currentTime;
      if (lastFrameTime >= 0 && nowTime - lastFrameTime < frameInterval) return;

      processingFrame = true;
      try {
        renderFastPaintedFrame();
        lastFrameTime = nowTime;
        const timeRatio = Math.min(1, nowTime / duration);
        const elapsedMs = performance.now() - paintStageStart;
        const expectedMs = Math.max(1500, duration * 1000);
        const wallRatio = Math.min(1, elapsedMs / expectedMs);
        const ratio = Math.max(timeRatio, wallRatio * 0.92);
        setVideoProgress(0.1 + ratio * 0.8, `Painting video... ${Math.round(ratio * 100)}%`);
      } finally {
        processingFrame = false;
      }
    };

    const onTimeUpdate = () => {
      if (stopped) return;
      const ratio = Math.min(1, video.currentTime / duration);
      setVideoProgress(0.1 + ratio * 0.8);
    };
    video.addEventListener("timeupdate", onTimeUpdate);

    const rafLoop = () => {
      if (stopped || video.ended) return;
      loop();
      requestAnimationFrame(() => {
        rafLoop();
      });
    };

    mediaRecorder.start(250);

    const playbackStarted = await video.play().then(() => true).catch(() => false);
    if (!playbackStarted || video.paused) {
      if (mediaRecorder.state !== "inactive") mediaRecorder.stop();
      setProcessing(false);
      setProgressText("Could not play video for processing.");
      return;
    }

    rafLoop();

    await new Promise<void>((resolve) => {
      video.onended = () => resolve();
    });

    stopped = true;
    video.removeEventListener("timeupdate", onTimeUpdate);
    loop();
    video.pause();

    setVideoProgress(0.94, "Encoding painted video...");

    if (mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }

    const encodingTicker = setInterval(() => {
      setProgress((prev) => Math.min(0.99, prev + 0.003));
    }, 120);

    const paintedBlob = await recordedBlobPromise;
    clearInterval(encodingTicker);
    const extension = (mimeType ?? "video/webm").includes("mp4") ? "mp4" : "webm";
    const nextVideoUrl = URL.createObjectURL(paintedBlob);
    setProcessedVideoUrl((prev) => {
      if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
      return nextVideoUrl;
    });
    setProcessedVideoExt(extension);

    setSourceLoaded(true);
    setProcessed(true);
    setVideoProgress(1, audioTrack ? "Done!" : "Done! (video exported without audio track)");
    setProcessing(false);
  }, [drawToSourceCanvas, modelsReady, options, resolvePaletteForSource, sourceMedia]);

  const processMedia = useCallback(async () => {
    if (sourceType === "video") {
      await processVideo();
      return;
    }
    await processImage();
  }, [processImage, processVideo, sourceType]);

  const downloadResult = useCallback(() => {
    if (sourceType === "video" && processedVideoUrl) {
      const link = document.createElement("a");
      link.download = `painted-video.${processedVideoExt}`;
      link.href = processedVideoUrl;
      link.click();
      return;
    }

    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = "painted-image.png";
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  }, [processedVideoExt, processedVideoUrl, sourceType]);

  const downloadComparison = useCallback(() => {
    if (sourceType !== "image") return;
    if (!canvasRef.current || !sourceCanvasRef.current) return;
    const src = sourceCanvasRef.current;
    const dst = canvasRef.current;

    const padding = 20;
    const labelH = 36;
    const watermarkH = 40;
    const totalW = src.width + dst.width + padding * 3;
    const totalH = Math.max(src.height, dst.height) + padding * 2 + labelH + watermarkH;

    const comp = document.createElement("canvas");
    comp.width = totalW;
    comp.height = totalH;
    const ctx = comp.getContext("2d")!;

    // Background
    ctx.fillStyle = "#1a1611";
    ctx.fillRect(0, 0, totalW, totalH);

    // Labels
    ctx.font = "bold 16px 'Playfair Display', Georgia, serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#9a8b72";
    ctx.fillText("ORIGINAL", padding + src.width / 2, padding + 22);
    ctx.fillText("PAINTED", padding * 2 + src.width + dst.width / 2, padding + 22);

    // Images
    const imgY = padding + labelH;
    ctx.drawImage(src, padding, imgY);
    ctx.drawImage(dst, padding * 2 + src.width, imgY);

    // Frames around images
    ctx.strokeStyle = "#4d3e33";
    ctx.lineWidth = 2;
    ctx.strokeRect(padding, imgY, src.width, src.height);
    ctx.strokeRect(padding * 2 + src.width, imgY, dst.width, dst.height);

    // Watermark bar
    const wmY = totalH - watermarkH;
    ctx.fillStyle = "#2a2119";
    ctx.fillRect(0, wmY, totalW, watermarkH);
    ctx.font = "italic 14px 'EB Garamond', Georgia, serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#c49a4a";
    ctx.fillText("i-say-disco-you-say-party.vercel.app", totalW / 2, wmY + 26);

    const link = document.createElement("a");
    link.download = "disco-comparison.png";
    link.href = comp.toDataURL("image/png");
    link.click();
  }, [sourceType]);

  const updateOption = (key: keyof FilterOptions, value: number) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
  };

  const applyPreset = (preset: PresetValues) => {
    setOptions((prev) => ({ ...prev, ...preset }));
  };

  const detectPaletteNow = () => {
    if (!sourceCanvasRef.current) return;
    const sourceCtx = sourceCanvasRef.current.getContext("2d", { willReadFrequently: true });
    if (!sourceCtx) return;

    const sourceImageData = sourceCtx.getImageData(0, 0, sourceCanvasRef.current.width, sourceCanvasRef.current.height);
    const detected = detectPaletteFromImageData(sourceImageData);
    setPaletteMode("auto");
    setActivePalette(detected);
    setProgressText(`Detected palette: ${DE_PALETTES[detected].label}`);
  };

  return (
    <div
      className="min-h-screen relative"
      onPaste={handlePaste}
      tabIndex={0}
    >
      {/* Decorative paint splatters */}
      <div className="paint-splatter" style={{ top: '10%', left: '-5%', width: '300px', height: '300px', background: 'var(--de-accent-rust)' }} />
      <div className="paint-splatter" style={{ top: '60%', right: '-8%', width: '400px', height: '400px', background: 'var(--de-accent-teal)' }} />
      <div className="paint-splatter" style={{ bottom: '5%', left: '20%', width: '250px', height: '250px', background: 'var(--de-accent-ochre)' }} />

      {/* Header */}
      <header className="relative z-10 pt-12 pb-6 px-6 text-center">
        <div className="animate-fade-in">
          <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>
            <span style={{ color: 'var(--de-accent-gold)' }}>I Say Disco,</span>{" "}
            <span style={{ color: 'var(--de-text-bright)' }}>You Say Party</span>
          </h1>
          <div className="disco-divider mx-auto max-w-md my-4" />
          <p className="text-lg md:text-xl mt-2" style={{ color: 'var(--de-text-dim)', fontStyle: 'italic' }}>
            Transform your photographs into oil-painted reveries
          </p>
        </div>

        {/* Flavor quote */}
        <div className="animate-fade-in-delay max-w-lg mx-auto mt-6">
          <div className="thought-bubble text-sm">
            {quote}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className={`relative z-10 max-w-6xl mx-auto px-4 md:px-6 pb-16 ${processed ? "has-mobile-download-gap" : ""}`}>
        {/* Upload area */}
        {!sourceMedia && (
          <div className="animate-fade-in-delay-2 max-w-2xl mx-auto mt-8">
            <div
              className={`disco-dropzone p-16 text-center ${dragover ? "dragover" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDragover(true); }}
              onDragLeave={() => setDragover(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              
              {/* Paint palette icon */}
              <div className="mb-6">
                <svg width="80" height="80" viewBox="0 0 80 80" fill="none" className="mx-auto" style={{ opacity: 0.6 }}>
                  <ellipse cx="40" cy="40" rx="35" ry="30" stroke="var(--de-accent-ochre)" strokeWidth="2" fill="none"/>
                  <circle cx="25" cy="30" r="4" fill="var(--de-accent-rust)"/>
                  <circle cx="35" cy="22" r="4" fill="var(--de-accent-ochre)"/>
                  <circle cx="48" cy="24" r="4" fill="var(--de-accent-teal)"/>
                  <circle cx="55" cy="33" r="4" fill="var(--de-accent-sage)"/>
                  <circle cx="52" cy="45" r="3" fill="var(--de-accent-amber)"/>
                  <line x1="20" y1="55" x2="60" y2="15" stroke="var(--de-accent-ochre)" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>

              <p className="text-xl mb-2" style={{ color: 'var(--de-text-bright)', fontFamily: "'Playfair Display', serif" }}>
                Drop your image or video here
              </p>
              <p className="text-sm" style={{ color: 'var(--de-text-dim)' }}>
                or click to browse — you can also paste from clipboard
              </p>
              <p className="text-xs mt-4" style={{ color: 'var(--de-text-dim)', opacity: 0.6 }}>
                Supports JPG, PNG, WebP, MP4, WebM
              </p>
            </div>

            {modelsReady && (
              <p className="text-center text-xs mt-3" style={{ color: 'var(--de-accent-teal)' }}>
                ✦ Face detection models loaded — faces will receive special painterly treatment
              </p>
            )}
          </div>
        )}

        {/* Image loaded - workspace */}
        {sourceMedia && (
          <div className="animate-fade-in mt-6">
            {/* Controls bar */}
            <div className="disco-card p-5 mb-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    className="disco-btn text-sm"
                    onClick={processMedia}
                    disabled={processing}
                  >
                    {processing
                      ? "Painting..."
                      : processed
                        ? "Re-paint"
                        : sourceType === "video"
                          ? "Paint Video"
                          : "Paint It"}
                  </button>

                  <button
                    className="disco-btn-secondary text-sm"
                    onClick={clearMedia}
                  >
                    New File
                  </button>
                </div>

                <div className="flex items-center gap-4">
                  {faceCount > 0 && (
                    <span className="text-xs" style={{ color: 'var(--de-accent-teal)' }}>
                      ✦ {faceCount} face{faceCount > 1 ? "s" : ""} detected
                    </span>
                  )}
                  <button
                    className="text-xs underline cursor-pointer"
                    style={{ color: 'var(--de-text-dim)' }}
                    onClick={() => setShowAdvanced(!showAdvanced)}
                  >
                    {showAdvanced ? "Hide" : "Show"} Advanced
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              {processing && (
                <div className="mt-4">
                  <div className="disco-progress">
                    <div
                      className="disco-progress-bar"
                      style={{ width: `${progress * 100}%` }}
                    />
                  </div>
                  <p className="text-xs mt-2" style={{ color: 'var(--de-text-dim)', fontStyle: 'italic' }}>
                    {progressText}
                  </p>
                </div>
              )}

              {/* Advanced options */}
              {showAdvanced && (
                <div className="mt-5 pt-5" style={{ borderTop: '1px solid var(--de-surface-light)' }}>
                  <div className="mb-5">
                    <p className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--de-text-dim)', fontFamily: "'Playfair Display', serif" }}>
                      Presets
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {STYLE_PRESETS.map((preset) => (
                        <button
                          key={preset.name}
                          className="disco-btn-secondary text-xs"
                          onClick={() => applyPreset(preset.values)}
                          type="button"
                        >
                          {preset.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mb-5">
                    <p className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--de-text-dim)', fontFamily: "'Playfair Display', serif" }}>
                      Palette Detector
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={paletteMode}
                        onChange={(e) => {
                          const value = e.target.value as PaletteSelection;
                          setPaletteMode(value);
                          if (value !== "auto" && value !== "none") setActivePalette(value);
                        }}
                        className="text-xs"
                        style={{
                          background: 'var(--de-bg-warm)',
                          color: 'var(--de-text-bright)',
                          border: '1px solid var(--de-surface-light)',
                          padding: '8px 10px',
                          borderRadius: '2px',
                          minWidth: '190px'
                        }}
                      >
                        <option value="none">None (keep original color range)</option>
                        <option value="auto">Auto detect from source</option>
                        {(Object.keys(DE_PALETTES) as PaletteKey[]).map((key) => (
                          <option key={key} value={key}>{DE_PALETTES[key].label}</option>
                        ))}
                      </select>

                      <button
                        type="button"
                        className="disco-btn-secondary text-xs"
                        onClick={detectPaletteNow}
                      >
                        Detect now
                      </button>

                      <span className="text-xs" style={{ color: 'var(--de-accent-teal)' }}>
                        Active: {paletteMode === "none" ? "None" : DE_PALETTES[activePalette].label}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                    <SliderControl
                      label="Intensity"
                      value={options.intensity}
                      min={0} max={1} step={0.05}
                      onChange={(v) => updateOption("intensity", v)}
                    />
                    <SliderControl
                      label="Brush Size"
                      value={options.brushSize}
                      min={2} max={6} step={1}
                      onChange={(v) => updateOption("brushSize", v)}
                    />
                    <SliderControl
                      label="Cel-Shading"
                      value={options.posterizeLevels}
                      min={4} max={16} step={1}
                      onChange={(v) => updateOption("posterizeLevels", v)}
                    />
                    <SliderControl
                      label="Edge Outlines"
                      value={options.edgeStrength}
                      min={0} max={1} step={0.05}
                      onChange={(v) => updateOption("edgeStrength", v)}
                    />
                    <SliderControl
                      label="Detail"
                      value={options.detailPreservation}
                      min={0} max={1} step={0.05}
                      onChange={(v) => updateOption("detailPreservation", v)}
                    />
                    <SliderControl
                      label="Warmth"
                      value={options.warmth}
                      min={0} max={1} step={0.05}
                      onChange={(v) => updateOption("warmth", v)}
                    />
                    <SliderControl
                      label="Saturation"
                      value={options.saturation}
                      min={0} max={1} step={0.05}
                      onChange={(v) => updateOption("saturation", v)}
                    />
                    <SliderControl
                      label="Canvas Texture"
                      value={options.textureStrength}
                      min={0} max={0.6} step={0.05}
                      onChange={(v) => updateOption("textureStrength", v)}
                    />
                    <div className="flex items-end">
                      <button
                        className="text-xs underline"
                        style={{ color: 'var(--de-accent-ochre)' }}
                        onClick={() => setOptions({ ...DEFAULT_OPTIONS })}
                      >
                        Reset to defaults
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Image display */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Original */}
              <div>
                <h3 className="text-sm uppercase tracking-widest mb-3" style={{ color: 'var(--de-text-dim)', fontFamily: "'Playfair Display', serif" }}>
                  Original {sourceType === "video" ? "Video" : "Image"}
                </h3>
                <div className="image-frame">
                  {sourceType === "video" ? (
                    <video
                      src={sourceMedia}
                      controls
                      className="w-full h-auto block"
                    />
                  ) : (
                    <>
                      <canvas
                        ref={sourceCanvasRef}
                        className="w-full h-auto block"
                        style={{ display: sourceLoaded ? 'block' : 'none' }}
                      />
                      <img
                        src={sourceMedia}
                        alt="Original"
                        className="w-full h-auto block"
                        style={{ display: sourceLoaded ? 'none' : 'block' }}
                        onLoad={(e) => {
                          const img = e.currentTarget;
                          if (sourceCanvasRef.current) {
                            const ctx = sourceCanvasRef.current.getContext("2d")!;
                            const maxDim = 1200;
                            let w = img.naturalWidth;
                            let h = img.naturalHeight;
                            if (w > maxDim || h > maxDim) {
                              const scale = maxDim / Math.max(w, h);
                              w = Math.round(w * scale);
                              h = Math.round(h * scale);
                            }
                            sourceCanvasRef.current.width = w;
                            sourceCanvasRef.current.height = h;
                            ctx.drawImage(img, 0, 0, w, h);
                            setSourceLoaded(true);
                          }
                        }}
                      />
                    </>
                  )}
                </div>
              </div>

              {/* Result */}
              <div>
                <h3 className="text-sm uppercase tracking-widest mb-3" style={{ color: 'var(--de-text-dim)', fontFamily: "'Playfair Display', serif" }}>
                  {processed ? "Disco" : sourceType === "video" ? "Video Result" : "Result"}
                </h3>
                <div className="image-frame" style={{ minHeight: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {sourceType === "video" && processed && processedVideoUrl ? (
                    <video
                      src={processedVideoUrl}
                      controls
                      className="w-full h-auto block"
                    />
                  ) : (
                    <canvas
                      ref={canvasRef}
                      className="w-full h-auto block"
                      style={{ display: processed || processing ? 'block' : 'none' }}
                    />
                  )}
                  {!processed && !processing && (
                    <div className="p-12 text-center">
                      <p style={{ color: 'var(--de-text-dim)', fontStyle: 'italic', fontSize: '0.9rem' }}>
                        Press <strong style={{ color: 'var(--de-accent-ochre)' }}>
                          {sourceType === "video" ? "Paint Video" : "Paint It"}
                        </strong> to transform your {sourceType === "video" ? "video" : "image"}
                      </p>
                    </div>
                  )}
                  {processing && (
                    <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(26, 22, 17, 0.7)' }}>
                      <div className="text-center">
                        <div className="inline-block w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mb-3" style={{ borderColor: 'var(--de-accent-ochre)', borderTopColor: 'transparent' }} />
                        <p className="text-sm" style={{ color: 'var(--de-accent-ochre)', fontStyle: 'italic' }}>
                          The muse works in mysterious ways...
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Prominent download bar — visible on mobile */}
            {processed && (
              <div className="disco-download-bar mt-6">
                <div className={`grid ${sourceType === "video" ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"} gap-3`}>
                  <div className="disco-card p-4 flex items-center justify-center">
                    <button
                      className="disco-btn-download w-full"
                      onClick={downloadResult}
                    >
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="inline-block mr-2 -mt-0.5">
                        <path d="M10 3v10m0 0l-4-4m4 4l4-4M3 17h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      {sourceType === "video" ? "Download Painted Video" : "Download Painting"}
                    </button>
                  </div>
                  {sourceType === "image" && (
                    <div className="disco-card p-4 flex items-center justify-center">
                      <button
                        className="disco-btn-download-alt w-full"
                        onClick={downloadComparison}
                      >
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="inline-block mr-2 -mt-0.5">
                          <rect x="2" y="3" width="7" height="14" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                          <rect x="11" y="3" width="7" height="14" rx="1" stroke="currentColor" strokeWidth="1.5"/>
                          <path d="M5.5 17v1.5h9V17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                        Download Comparison
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer flavor text */}
        <footer className="mt-16 text-center">
          <div className="disco-divider mx-auto max-w-sm mb-6" />
          <p className="text-xs" style={{ color: 'var(--de-text-dim)', opacity: 0.5, fontStyle: 'italic' }}>
            &quot;Every pixel is a brushstroke. Every brushstroke, a small death.&quot;
          </p>
          <p className="text-xs mt-2" style={{ color: 'var(--de-text-dim)', opacity: 0.3 }}>
            No files are uploaded to any server. All processing happens in your browser.
          </p>
        </footer>
      </main>
    </div>
  );
}

// ============================
// Slider Component
// ============================

function SliderControl({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <label className="text-xs uppercase tracking-wider" style={{ color: 'var(--de-text-dim)', fontFamily: "'Playfair Display', serif" }}>
          {label}
        </label>
        <span className="text-xs tabular-nums" style={{ color: 'var(--de-accent-ochre)' }}>
          {typeof value === "number" ? (Number.isInteger(step) ? value : value.toFixed(2)) : value}
        </span>
      </div>
      <input
        type="range"
        className="disco-slider"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  );
}

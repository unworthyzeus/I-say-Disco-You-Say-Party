"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  applyDiscoElysiumFilter,
  FilterOptions,
  DEFAULT_OPTIONS,
} from "@/lib/disco-filter";
import { loadFaceDetectionModels, detectFaces, isModelLoaded } from "@/lib/face-detection";

// Quotes from Disco Elysium for flavor
const QUOTES = [
  "The world is like a puzzle — every piece covered in oil paint.",
  "In the pale, all things dissolve into impressions.",
  "Reality is just pigment drying on canvas.",
  "Every face tells a story painted in ochre and shadow.",
  "The brushstrokes of existence are never clean.",
  "Art is reality viewed through a temperament... and fourteen beers.",
  "What is a portrait but a confession with colours?",
];

export default function Home() {
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [processed, setProcessed] = useState(false);
  const [dragover, setDragover] = useState(false);
  const [faceCount, setFaceCount] = useState(0);
  const [modelsReady, setModelsReady] = useState(false);
  const [sourceLoaded, setSourceLoaded] = useState(false);
  const [quote, setQuote] = useState(QUOTES[0]);
  useEffect(() => {
    setQuote(QUOTES[Math.floor(Math.random() * QUOTES.length)]);
  }, []);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [options, setOptions] = useState<FilterOptions>({ ...DEFAULT_OPTIONS });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sourceCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Load face detection models on mount
  useEffect(() => {
    loadFaceDetectionModels().then(() => {
      setModelsReady(isModelLoaded());
    });
  }, []);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setSourceImage(e.target?.result as string);
      setProcessed(false);
      setSourceLoaded(false);
      setProgress(0);
      setProgressText("");
      setShowAdvanced(true);
    };
    reader.readAsDataURL(file);
  }, []);

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

  const processImage = useCallback(async () => {
    if (!sourceImage || !canvasRef.current) return;

    setProcessing(true);
    setProgress(0);
    setProcessed(false);

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = async () => {
      imgRef.current = img;

      // Draw original to source canvas for comparison
      if (sourceCanvasRef.current) {
        const sCtx = sourceCanvasRef.current.getContext("2d")!;
        const maxDim = 1200;
        let w = img.width, h = img.height;
        if (w > maxDim || h > maxDim) {
          const scale = maxDim / Math.max(w, h);
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }
        sourceCanvasRef.current.width = w;
        sourceCanvasRef.current.height = h;
        sCtx.drawImage(img, 0, 0, w, h);
      }

      // Detect faces
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

      // Apply the filter
      try {
        await applyDiscoElysiumFilter(
          canvasRef.current!,
          img,
          { ...options, faceRegions },
          (step, p) => {
            setProgressText(step);
            setProgress(p);
          }
        );
        setProcessed(true);
      } catch (err) {
        console.error("Filter error:", err);
      }

      setProcessing(false);
    };
    img.src = sourceImage;
  }, [sourceImage, options, modelsReady]);

  const downloadResult = useCallback(() => {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = "disco-elysium-portrait.png";
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  }, []);

  const downloadComparison = useCallback(() => {
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
    ctx.fillText("DISCO ELYSIUM", padding * 2 + src.width + dst.width / 2, padding + 22);

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
  }, []);

  const updateOption = (key: keyof FilterOptions, value: number) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
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
      <main className="relative z-10 max-w-6xl mx-auto px-4 md:px-6 pb-16">
        {/* Upload area */}
        {!sourceImage && (
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
                accept="image/*"
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
                Drop your image here
              </p>
              <p className="text-sm" style={{ color: 'var(--de-text-dim)' }}>
                or click to browse — you can also paste from clipboard
              </p>
              <p className="text-xs mt-4" style={{ color: 'var(--de-text-dim)', opacity: 0.6 }}>
                Supports JPG, PNG, WebP
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
        {sourceImage && (
          <div className="animate-fade-in mt-6">
            {/* Controls bar */}
            <div className="disco-card p-5 mb-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    className="disco-btn text-sm"
                    onClick={processImage}
                    disabled={processing}
                  >
                    {processing ? "Painting..." : processed ? "Re-paint" : "Paint It"}
                  </button>

                  <button
                    className="disco-btn-secondary text-sm"
                    onClick={() => {
                      setSourceImage(null);
                      setProcessed(false);
                      setProgress(0);
                      setFaceCount(0);
                    }}
                  >
                    New Image
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
                  Original
                </h3>
                <div className="image-frame">
                  <canvas
                    ref={sourceCanvasRef}
                    className="w-full h-auto block"
                    style={{ display: sourceLoaded ? 'block' : 'none' }}
                  />
                  {/* Hidden img to load into the canvas, then swap */}
                  <img
                    src={sourceImage}
                    alt="Original"
                    className="w-full h-auto block"
                    style={{ display: sourceLoaded ? 'none' : 'block' }}
                    onLoad={(e) => {
                      const img = e.currentTarget;
                      if (sourceCanvasRef.current) {
                        const ctx = sourceCanvasRef.current.getContext("2d")!;
                        const maxDim = 1200;
                        let w = img.naturalWidth, h = img.naturalHeight;
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
                </div>
              </div>

              {/* Result */}
              <div>
                <h3 className="text-sm uppercase tracking-widest mb-3" style={{ color: 'var(--de-text-dim)', fontFamily: "'Playfair Display', serif" }}>
                  {processed ? "Disco Elysium" : "Result"}
                </h3>
                <div className="image-frame" style={{ minHeight: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <canvas
                    ref={canvasRef}
                    className="w-full h-auto block"
                    style={{ display: processed || processing ? 'block' : 'none' }}
                  />
                  {!processed && !processing && (
                    <div className="p-12 text-center">
                      <p style={{ color: 'var(--de-text-dim)', fontStyle: 'italic', fontSize: '0.9rem' }}>
                        Press <strong style={{ color: 'var(--de-accent-ochre)' }}>&quot;Paint It&quot;</strong> to transform your image
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
                <div className="grid grid-cols-2 gap-3">
                  <div className="disco-card p-4 flex items-center justify-center">
                    <button
                      className="disco-btn-download w-full"
                      onClick={downloadResult}
                    >
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="inline-block mr-2 -mt-0.5">
                        <path d="M10 3v10m0 0l-4-4m4 4l4-4M3 17h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      Download Painting
                    </button>
                  </div>
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
            No images are uploaded to any server. All processing happens in your browser.
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

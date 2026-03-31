import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Pipette } from "lucide-react";
import {
  hexToRgb,
  rgbToHex,
  rgbToHsl,
  hslToRgb,
  relativeLuminance,
  contrastRatio,
  wcagLevel,
  wcagLevelLarge,
} from "@/lib/color-utils";

const TAILWIND_COLORS: Record<string, Record<string, string>> = {
  slate: { "50": "#f8fafc", "100": "#f1f5f9", "200": "#e2e8f0", "300": "#cbd5e1", "400": "#94a3b8", "500": "#64748b", "600": "#475569", "700": "#334155", "800": "#1e293b", "900": "#0f172a", "950": "#020617" },
  red: { "50": "#fef2f2", "100": "#fee2e2", "200": "#fecaca", "300": "#fca5a5", "400": "#f87171", "500": "#ef4444", "600": "#dc2626", "700": "#b91c1c", "800": "#991b1b", "900": "#7f1d1d", "950": "#450a0a" },
  orange: { "50": "#fff7ed", "100": "#ffedd5", "200": "#fed7aa", "300": "#fdba74", "400": "#fb923c", "500": "#f97316", "600": "#ea580c", "700": "#c2410c", "800": "#9a3412", "900": "#7c2d12", "950": "#431407" },
  amber: { "50": "#fffbeb", "100": "#fef3c7", "200": "#fde68a", "300": "#fcd34d", "400": "#fbbf24", "500": "#f59e0b", "600": "#d97706", "700": "#b45309", "800": "#92400e", "900": "#78350f", "950": "#451a03" },
  yellow: { "50": "#fefce8", "100": "#fef9c3", "200": "#fef08a", "300": "#fde047", "400": "#facc15", "500": "#eab308", "600": "#ca8a04", "700": "#a16207", "800": "#854d0e", "900": "#713f12", "950": "#422006" },
  green: { "50": "#f0fdf4", "100": "#dcfce7", "200": "#bbf7d0", "300": "#86efac", "400": "#4ade80", "500": "#22c55e", "600": "#16a34a", "700": "#15803d", "800": "#166534", "900": "#14532d", "950": "#052e16" },
  blue: { "50": "#eff6ff", "100": "#dbeafe", "200": "#bfdbfe", "300": "#93c5fd", "400": "#60a5fa", "500": "#3b82f6", "600": "#2563eb", "700": "#1d4ed8", "800": "#1e40af", "900": "#1e3a8a", "950": "#172554" },
  purple: { "50": "#faf5ff", "100": "#f3e8ff", "200": "#e9d5ff", "300": "#d8b4fe", "400": "#c084fc", "500": "#a855f7", "600": "#9333ea", "700": "#7e22ce", "800": "#6b21a8", "900": "#581c87", "950": "#3b0764" },
  pink: { "50": "#fdf2f8", "100": "#fce7f3", "200": "#fbcfe8", "300": "#f9a8d4", "400": "#f472b6", "500": "#ec4899", "600": "#db2777", "700": "#be185d", "800": "#9d174d", "900": "#831843", "950": "#500724" },
};

const SHADE_KEYS = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"];

const DEFAULT_COLOR = "#6366F1";

function useClipboard(timeout = 1200) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const copy = useCallback(
    (text: string, key: string) => {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopiedKey(null), timeout);
    },
    [timeout],
  );

  return { copiedKey, copy };
}

function CopyButton({ value, label, clipKey, copiedKey, onCopy }: {
  value: string;
  label: string;
  clipKey: string;
  copiedKey: string | null;
  onCopy: (text: string, key: string) => void;
}) {
  const isCopied = copiedKey === clipKey;
  return (
    <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
      <span className="shrink-0 text-xs font-medium text-muted-foreground w-20">{label}</span>
      <code className="flex-1 font-mono text-sm break-all">{value}</code>
      <button
        onClick={() => onCopy(value, clipKey)}
        className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        {isCopied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

export function ColorTool() {
  const [hex, setHex] = useState(DEFAULT_COLOR);
  const rgb = hexToRgb(hex) ?? { r: 0, g: 0, b: 0 };
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

  const [fgHex, setFgHex] = useState("#000000");
  const [bgHex, setBgHex] = useState("#FFFFFF");

  const { copiedKey, copy } = useClipboard();

  const updateFromHex = useCallback((value: string) => {
    const cleaned = value.startsWith("#") ? value : `#${value}`;
    setHex(cleaned.toUpperCase());
  }, []);

  const updateFromHsl = useCallback((h: number, s: number, l: number) => {
    const { r, g, b } = hslToRgb(h, s, l);
    setHex(rgbToHex(r, g, b));
  }, []);

  const handleEyeDropper = useCallback(async () => {
    try {
      const dropper = new (window as any).EyeDropper();
      const result = await dropper.open();
      updateFromHex(result.sRGBHex);
    } catch {
      // user cancelled or API unavailable
    }
  }, [updateFromHex]);

  const hasEyeDropper = typeof window !== "undefined" && "EyeDropper" in window;

  const hexDisplay = hex;
  const rgbDisplay = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
  const hslDisplay = `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
  const cssRgbDisplay = `${rgb.r}, ${rgb.g}, ${rgb.b}`;

  const fgRgb = hexToRgb(fgHex) ?? { r: 0, g: 0, b: 0 };
  const bgRgb = hexToRgb(bgHex) ?? { r: 255, g: 255, b: 255 };
  const fgLum = relativeLuminance(fgRgb.r, fgRgb.g, fgRgb.b);
  const bgLum = relativeLuminance(bgRgb.r, bgRgb.g, bgRgb.b);
  const ratio = contrastRatio(fgLum, bgLum);
  const normalLevel = wcagLevel(ratio);
  const largeLevel = wcagLevelLarge(ratio);

  const textColor = relativeLuminance(rgb.r, rgb.g, rgb.b) > 0.179 ? "#000000" : "#FFFFFF";

  return (
    <div className="flex h-full flex-col gap-4 p-6 overflow-y-auto">
      <h2 className="text-2xl font-bold tracking-tight">颜色工具</h2>

      {/* Color Input */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">颜色选择</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-start gap-4">
            <div
              className="h-28 w-28 shrink-0 rounded-xl border shadow-sm transition-colors flex items-center justify-center"
              style={{ backgroundColor: hex }}
            >
              <span className="font-mono text-xs font-semibold" style={{ color: textColor }}>
                {hexDisplay}
              </span>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-muted-foreground w-10">HEX</label>
                <input
                  type="text"
                  value={hex}
                  onChange={(e) => updateFromHex(e.target.value)}
                  className="h-9 w-32 rounded-md border border-input bg-transparent px-3 font-mono text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                  spellCheck={false}
                />
                <input
                  type="color"
                  value={hexToRgb(hex) ? hex : DEFAULT_COLOR}
                  onChange={(e) => updateFromHex(e.target.value)}
                  className="h-9 w-9 cursor-pointer rounded border border-input p-0.5"
                />
                {hasEyeDropper && (
                  <Button variant="outline" size="sm" onClick={handleEyeDropper}>
                    <Pipette className="mr-1.5 h-3.5 w-3.5" />
                    取色
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* HSL Sliders */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-3">
              <label className="w-20 text-sm text-muted-foreground">色相 (H)</label>
              <input
                type="range"
                min={0}
                max={360}
                value={hsl.h}
                onChange={(e) => updateFromHsl(Number(e.target.value), hsl.s, hsl.l)}
                className="flex-1 accent-primary"
                style={{
                  background: `linear-gradient(to right, hsl(0,${hsl.s}%,${hsl.l}%), hsl(60,${hsl.s}%,${hsl.l}%), hsl(120,${hsl.s}%,${hsl.l}%), hsl(180,${hsl.s}%,${hsl.l}%), hsl(240,${hsl.s}%,${hsl.l}%), hsl(300,${hsl.s}%,${hsl.l}%), hsl(360,${hsl.s}%,${hsl.l}%))`,
                  borderRadius: "9999px",
                  height: "8px",
                  WebkitAppearance: "none",
                }}
              />
              <span className="w-12 text-right font-mono text-sm">{hsl.h}°</span>
            </div>
            <div className="flex items-center gap-3">
              <label className="w-20 text-sm text-muted-foreground">饱和度 (S)</label>
              <input
                type="range"
                min={0}
                max={100}
                value={hsl.s}
                onChange={(e) => updateFromHsl(hsl.h, Number(e.target.value), hsl.l)}
                className="flex-1 accent-primary"
                style={{
                  background: `linear-gradient(to right, hsl(${hsl.h},0%,${hsl.l}%), hsl(${hsl.h},100%,${hsl.l}%))`,
                  borderRadius: "9999px",
                  height: "8px",
                  WebkitAppearance: "none",
                }}
              />
              <span className="w-12 text-right font-mono text-sm">{hsl.s}%</span>
            </div>
            <div className="flex items-center gap-3">
              <label className="w-20 text-sm text-muted-foreground">亮度 (L)</label>
              <input
                type="range"
                min={0}
                max={100}
                value={hsl.l}
                onChange={(e) => updateFromHsl(hsl.h, hsl.s, Number(e.target.value))}
                className="flex-1 accent-primary"
                style={{
                  background: `linear-gradient(to right, hsl(${hsl.h},${hsl.s}%,0%), hsl(${hsl.h},${hsl.s}%,50%), hsl(${hsl.h},${hsl.s}%,100%))`,
                  borderRadius: "9999px",
                  height: "8px",
                  WebkitAppearance: "none",
                }}
              />
              <span className="w-12 text-right font-mono text-sm">{hsl.l}%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Format Display */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">格式输出</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <CopyButton value={hexDisplay} label="HEX" clipKey="hex" copiedKey={copiedKey} onCopy={copy} />
          <CopyButton value={rgbDisplay} label="RGB" clipKey="rgb" copiedKey={copiedKey} onCopy={copy} />
          <CopyButton value={hslDisplay} label="HSL" clipKey="hsl" copiedKey={copiedKey} onCopy={copy} />
          <CopyButton value={cssRgbDisplay} label="CSS RGB" clipKey="cssrgb" copiedKey={copiedKey} onCopy={copy} />
        </CardContent>
      </Card>

      {/* Contrast Checker */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">对比度检查</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">前景色</label>
              <input
                type="color"
                value={fgHex}
                onChange={(e) => setFgHex(e.target.value.toUpperCase())}
                className="h-9 w-9 cursor-pointer rounded border border-input p-0.5"
              />
              <input
                type="text"
                value={fgHex}
                onChange={(e) => {
                  const v = e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`;
                  setFgHex(v.toUpperCase());
                }}
                className="h-9 w-28 rounded-md border border-input bg-transparent px-3 font-mono text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                spellCheck={false}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">背景色</label>
              <input
                type="color"
                value={bgHex}
                onChange={(e) => setBgHex(e.target.value.toUpperCase())}
                className="h-9 w-9 cursor-pointer rounded border border-input p-0.5"
              />
              <input
                type="text"
                value={bgHex}
                onChange={(e) => {
                  const v = e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`;
                  setBgHex(v.toUpperCase());
                }}
                className="h-9 w-28 rounded-md border border-input bg-transparent px-3 font-mono text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                spellCheck={false}
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => { setFgHex(hex); }}>
              使用当前颜色为前景
            </Button>
          </div>

          <div
            className="rounded-xl border p-6 text-center"
            style={{ backgroundColor: bgHex, color: fgHex }}
          >
            <p className="text-2xl font-bold">示例文本 AaBbCc</p>
            <p className="mt-1 text-sm">The quick brown fox jumps over the lazy dog.</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 rounded-lg bg-muted px-4 py-2">
              <span className="text-sm text-muted-foreground">对比度</span>
              <span className="font-mono text-lg font-bold">{ratio.toFixed(2)}:1</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-muted px-4 py-2">
              <span className="text-sm text-muted-foreground">正常文本</span>
              <Badge variant={normalLevel === "Fail" ? "destructive" : "default"}>
                {normalLevel}
              </Badge>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-muted px-4 py-2">
              <span className="text-sm text-muted-foreground">大号文本</span>
              <Badge variant={largeLevel === "Fail" ? "destructive" : "default"}>
                {largeLevel}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tailwind Colors */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Tailwind 调色板</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <div className="w-16" />
              {SHADE_KEYS.map((shade) => (
                <div key={shade} className="flex-1 text-center text-[10px] text-muted-foreground">
                  {shade}
                </div>
              ))}
            </div>
            {Object.entries(TAILWIND_COLORS).map(([name, shades]) => (
              <div key={name} className="flex items-center gap-1">
                <div className="w-16 text-xs font-medium text-muted-foreground capitalize">{name}</div>
                {SHADE_KEYS.map((shade) => {
                  const color = shades[shade];
                  return (
                    <button
                      key={shade}
                      onClick={() => updateFromHex(color)}
                      className="flex-1 aspect-square rounded transition-transform hover:scale-110 hover:ring-2 hover:ring-ring focus:outline-none focus:ring-2 focus:ring-ring"
                      style={{ backgroundColor: color }}
                      title={`${name}-${shade}: ${color}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, Check, Settings, Ruler, Table, Grid3X3 } from "lucide-react";

type UnitKey = "px" | "rem" | "em" | "vw" | "vh" | "percent";

interface UnitConfig {
  key: UnitKey;
  label: string;
  suffix: string;
  hint?: string;
}

const UNITS: UnitConfig[] = [
  { key: "px", label: "px", suffix: "px" },
  { key: "rem", label: "rem", suffix: "rem" },
  { key: "em", label: "em", suffix: "em" },
  { key: "vw", label: "vw", suffix: "vw", hint: "基于视口宽度" },
  { key: "vh", label: "vh", suffix: "vh", hint: "基于视口高度" },
  { key: "percent", label: "%", suffix: "%", hint: "基于父元素" },
];

const REFERENCE_TABLE = [
  { px: 12, rem: 0.75, pt: 9 },
  { px: 14, rem: 0.875, pt: 10.5 },
  { px: 16, rem: 1, pt: 12 },
  { px: 18, rem: 1.125, pt: 13.5 },
  { px: 20, rem: 1.25, pt: 15 },
  { px: 24, rem: 1.5, pt: 18 },
  { px: 28, rem: 1.75, pt: 21 },
  { px: 32, rem: 2, pt: 24 },
  { px: 36, rem: 2.25, pt: 27 },
  { px: 40, rem: 2.5, pt: 30 },
  { px: 48, rem: 3, pt: 36 },
  { px: 64, rem: 4, pt: 48 },
];

const TAILWIND_SPACING = [
  0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20,
  24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 72, 80, 96,
];

function round(v: number, decimals = 4): number {
  return Math.round(v * 10 ** decimals) / 10 ** decimals;
}

function toPx(
  value: number,
  unit: UnitKey,
  rootFontSize: number,
  viewportWidth: number,
  viewportHeight: number,
  parentSize: number,
): number {
  switch (unit) {
    case "px":
      return value;
    case "rem":
    case "em":
      return value * rootFontSize;
    case "vw":
      return (value / 100) * viewportWidth;
    case "vh":
      return (value / 100) * viewportHeight;
    case "percent":
      return (value / 100) * parentSize;
  }
}

function fromPx(
  px: number,
  unit: UnitKey,
  rootFontSize: number,
  viewportWidth: number,
  viewportHeight: number,
  parentSize: number,
): number {
  switch (unit) {
    case "px":
      return px;
    case "rem":
    case "em":
      return px / rootFontSize;
    case "vw":
      return (px / viewportWidth) * 100;
    case "vh":
      return (px / viewportHeight) * 100;
    case "percent":
      return (px / parentSize) * 100;
  }
}

function formatValue(v: number): string {
  if (!Number.isFinite(v)) return "—";
  return String(round(v));
}

export function CssUnitConverter() {
  const [rootFontSize, setRootFontSize] = useState(16);
  const [viewportWidth, setViewportWidth] = useState(1920);
  const [viewportHeight, setViewportHeight] = useState(1080);
  const [parentSize, setParentSize] = useState(100);

  const [values, setValues] = useState<Record<UnitKey, string>>({
    px: "",
    rem: "",
    em: "",
    vw: "",
    vh: "",
    percent: "",
  });

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const recalculate = useCallback(
    (sourceUnit: UnitKey, raw: string) => {
      const next: Record<UnitKey, string> = {
        px: "",
        rem: "",
        em: "",
        vw: "",
        vh: "",
        percent: "",
      };

      if (raw === "" || raw === "-" || raw === ".") {
        next[sourceUnit] = raw;
        setValues(next);
        return;
      }

      const num = parseFloat(raw);
      if (Number.isNaN(num)) {
        next[sourceUnit] = raw;
        setValues(next);
        return;
      }

      const px = toPx(num, sourceUnit, rootFontSize, viewportWidth, viewportHeight, parentSize);
      for (const u of UNITS) {
        if (u.key === sourceUnit) {
          next[u.key] = raw;
        } else {
          next[u.key] = formatValue(
            fromPx(px, u.key, rootFontSize, viewportWidth, viewportHeight, parentSize),
          );
        }
      }
      setValues(next);
    },
    [rootFontSize, viewportWidth, viewportHeight, parentSize],
  );

  const handleUnitInput = useCallback(
    (unit: UnitKey, raw: string) => {
      recalculate(unit, raw);
    },
    [recalculate],
  );

  const handleCopy = useCallback((text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1200);
    });
  }, []);

  const fillFromPx = useCallback(
    (px: number) => {
      recalculate("px", String(px));
    },
    [recalculate],
  );

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">CSS 单位转换</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            px / rem / em / vw / vh / % 互相转换
          </p>
        </div>

        {/* Base Settings */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Settings size={16} />
              基准设置
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <SettingField
                label="根字号 (px)"
                value={rootFontSize}
                onChange={setRootFontSize}
              />
              <SettingField
                label="视口宽度 (px)"
                value={viewportWidth}
                onChange={setViewportWidth}
              />
              <SettingField
                label="视口高度 (px)"
                value={viewportHeight}
                onChange={setViewportHeight}
              />
              <SettingField
                label="父元素尺寸 (px)"
                value={parentSize}
                onChange={setParentSize}
              />
            </div>
          </CardContent>
        </Card>

        {/* Converter */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Ruler size={16} />
              单位转换
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {UNITS.map((u) => {
                const val = values[u.key];
                const copyText = val && val !== "—" ? `${val}${u.suffix}` : "";
                const copyId = `unit-${u.key}`;
                return (
                  <div
                    key={u.key}
                    className="flex flex-col gap-1.5 rounded-lg border border-input p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        {u.label}
                      </span>
                      {u.hint && (
                        <span className="text-[10px] text-muted-foreground/60">
                          {u.hint}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={val}
                        onChange={(e) => handleUnitInput(u.key, e.target.value)}
                        placeholder="0"
                        className="min-w-0 flex-1 rounded-md border border-input bg-transparent px-2.5 py-1.5 font-mono text-sm outline-none placeholder:text-muted-foreground/40 focus:border-ring focus:ring-2 focus:ring-ring/50 dark:bg-input/30"
                        spellCheck={false}
                      />
                      <button
                        onClick={() => handleCopy(copyText, copyId)}
                        disabled={!copyText}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30"
                        title={`复制 ${copyText}`}
                      >
                        {copiedKey === copyId ? (
                          <Check size={14} className="text-green-500" />
                        ) : (
                          <Copy size={14} />
                        )}
                      </button>
                    </div>
                    {copiedKey === copyId && (
                      <span className="text-[10px] text-green-600 dark:text-green-400">
                        已复制
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Quick Reference Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Table size={16} />
              常用值速查
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-3 py-2 font-medium">px</th>
                    <th className="px-3 py-2 font-medium">rem</th>
                    <th className="px-3 py-2 font-medium">pt</th>
                  </tr>
                </thead>
                <tbody>
                  {REFERENCE_TABLE.map((row) => (
                    <tr
                      key={row.px}
                      className="cursor-pointer border-b border-border/50 transition-colors hover:bg-accent/50"
                      onClick={() => fillFromPx(row.px)}
                    >
                      <td className="px-3 py-1.5 font-mono">{row.px}</td>
                      <td className="px-3 py-1.5 font-mono">{row.rem}</td>
                      <td className="px-3 py-1.5 font-mono">{row.pt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              基于 {rootFontSize}px 根字号 · 点击行可填入转换器
            </p>
          </CardContent>
        </Card>

        {/* Tailwind Spacing Reference */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Grid3X3 size={16} />
              Tailwind Spacing 速查
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
              {TAILWIND_SPACING.map((s) => {
                const px = s * 4;
                const rem = round(px / rootFontSize);
                return (
                  <button
                    key={s}
                    onClick={() => fillFromPx(px)}
                    className="flex flex-col items-center gap-0.5 rounded-lg border border-border/60 p-2 text-center transition-colors hover:border-ring hover:bg-accent/50"
                  >
                    <span className="text-xs font-semibold">{s}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {px}px
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {rem}rem
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              1 spacing = 4px · 点击可填入转换器
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SettingField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const [raw, setRaw] = useState(String(value));

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      setRaw(v);
      const num = parseFloat(v);
      if (Number.isFinite(num) && num > 0) {
        onChange(num);
      }
    },
    [onChange],
  );

  const handleBlur = useCallback(() => {
    const num = parseFloat(raw);
    if (!Number.isFinite(num) || num <= 0) {
      setRaw(String(value));
    }
  }, [raw, value]);

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      <input
        type="text"
        inputMode="decimal"
        value={raw}
        onChange={handleChange}
        onBlur={handleBlur}
        className="rounded-md border border-input bg-transparent px-2.5 py-1.5 font-mono text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/50 dark:bg-input/30"
        spellCheck={false}
      />
    </div>
  );
}

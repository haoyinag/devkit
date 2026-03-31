import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Copy,
  Check,
  Binary,
  Calculator,
  ShieldCheck,
  RotateCcw,
} from "lucide-react";

type BaseKey = "bin" | "oct" | "dec" | "hex";

interface BaseConfig {
  key: BaseKey;
  label: string;
  prefix: string;
  radix: number;
  pattern: RegExp;
  placeholder: string;
}

const BASES: BaseConfig[] = [
  { key: "bin", label: "二进制 (2)", prefix: "0b", radix: 2, pattern: /^[01]*$/, placeholder: "1010" },
  { key: "oct", label: "八进制 (8)", prefix: "0o", radix: 8, pattern: /^[0-7]*$/, placeholder: "12" },
  { key: "dec", label: "十进制 (10)", prefix: "", radix: 10, pattern: /^[0-9]*$/, placeholder: "10" },
  { key: "hex", label: "十六进制 (16)", prefix: "0x", radix: 16, pattern: /^[0-9a-fA-F]*$/, placeholder: "A" },
];

const PERMISSION_PRESETS = [
  { value: "644", label: "文件默认" },
  { value: "755", label: "目录/脚本" },
  { value: "777", label: "完全开放" },
  { value: "600", label: "私有文件" },
  { value: "444", label: "只读" },
];

const PERM_LABELS = ["读取", "写入", "执行"] as const;
const PERM_CHARS = ["r", "w", "x"] as const;
const PERM_VALUES = [4, 2, 1] as const;
const GROUP_LABELS = ["所有者", "用户组", "其他人"] as const;

function bigIntToBase(value: bigint, radix: number): string {
  if (value === 0n) return "0";
  let result = "";
  let v = value;
  while (v > 0n) {
    const digit = Number(v % BigInt(radix));
    result = digit.toString(radix) + result;
    v = v / BigInt(radix);
  }
  return result;
}

export function NumberBaseTool() {
  const [baseValues, setBaseValues] = useState<Record<BaseKey, string>>({
    bin: "", oct: "", dec: "", hex: "",
  });
  const [baseError, setBaseError] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [bitA, setBitA] = useState("");
  const [bitB, setBitB] = useState("");

  const [permissions, setPermissions] = useState([
    [true, true, true],
    [true, false, true],
    [true, false, true],
  ]);
  const [chmodInput, setChmodInput] = useState("755");

  const handleCopy = useCallback((text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1200);
    });
  }, []);

  const convertBase = useCallback((source: BaseKey, raw: string) => {
    const next: Record<BaseKey, string> = { bin: "", oct: "", dec: "", hex: "" };
    setBaseError("");

    if (raw === "") {
      setBaseValues(next);
      return;
    }

    const config = BASES.find((b) => b.key === source)!;
    if (!config.pattern.test(raw)) {
      next[source] = raw;
      setBaseValues(next);
      setBaseError(`输入包含无效字符（${config.label}）`);
      return;
    }

    try {
      let value: bigint;
      if (source === "dec") {
        value = BigInt(raw);
      } else {
        value = BigInt(config.prefix + raw);
      }

      next.bin = bigIntToBase(value, 2);
      next.oct = bigIntToBase(value, 8);
      next.dec = value.toString(10);
      next.hex = bigIntToBase(value, 16).toUpperCase();
      next[source] = raw;
      setBaseValues(next);
    } catch {
      next[source] = raw;
      setBaseValues(next);
      setBaseError("无法解析输入值");
    }
  }, []);

  const resetBase = useCallback(() => {
    setBaseValues({ bin: "", oct: "", dec: "", hex: "" });
    setBaseError("");
  }, []);

  const parsedA = (() => {
    try { return bitA.trim() ? BigInt(bitA.trim()) : null; } catch { return null; }
  })();
  const parsedB = (() => {
    try { return bitB.trim() ? BigInt(bitB.trim()) : null; } catch { return null; }
  })();

  const bitResults = (() => {
    if (parsedA === null) return null;
    const a = parsedA;
    const b = parsedB ?? 0n;
    const hasB = parsedB !== null;
    return [
      { op: "A AND B", dec: hasB ? (a & b).toString() : "—", bin: hasB ? bigIntToBase(a & b, 2) : "—" },
      { op: "A OR B", dec: hasB ? (a | b).toString() : "—", bin: hasB ? bigIntToBase(a | b, 2) : "—" },
      { op: "A XOR B", dec: hasB ? (a ^ b).toString() : "—", bin: hasB ? bigIntToBase(a ^ b, 2) : "—" },
      { op: "NOT A", dec: (~a).toString(), bin: (~a).toString(2) },
    ];
  })();

  const getPermDigit = useCallback((group: boolean[]) => {
    return group.reduce((sum, on, i) => sum + (on ? PERM_VALUES[i] : 0), 0);
  }, []);

  const numericPerm = permissions.map(getPermDigit).join("");
  const symbolicPerm = permissions
    .map((g) => g.map((on, i) => (on ? PERM_CHARS[i] : "-")).join(""))
    .join("");

  const togglePerm = useCallback((groupIdx: number, permIdx: number) => {
    setPermissions((prev) => {
      const next = prev.map((g) => [...g]);
      next[groupIdx][permIdx] = !next[groupIdx][permIdx];
      setChmodInput(next.map((g) => g.reduce((s, on, i) => s + (on ? PERM_VALUES[i] : 0), 0)).join(""));
      return next;
    });
  }, []);

  const handleChmodInput = useCallback((raw: string) => {
    setChmodInput(raw);
    if (/^[0-7]{3}$/.test(raw)) {
      const next = raw.split("").map((ch) => {
        const n = parseInt(ch, 10);
        return [!!(n & 4), !!(n & 2), !!(n & 1)];
      });
      setPermissions(next);
    }
  }, []);

  const applyPreset = useCallback((value: string) => {
    handleChmodInput(value);
  }, [handleChmodInput]);

  const inputClass =
    "min-w-0 flex-1 rounded-md border border-input bg-transparent px-2.5 py-1.5 font-mono text-sm outline-none placeholder:text-muted-foreground/40 focus:border-ring focus:ring-2 focus:ring-ring/50 dark:bg-input/30";

  const copyBtnClass =
    "flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30";

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">进制转换</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            二 / 八 / 十 / 十六进制互转 · 位运算 · chmod 权限计算
          </p>
        </div>

        {/* Section 1: Base Converter */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-sm font-medium">
              <span className="flex items-center gap-2">
                <Binary size={16} />
                进制互转
              </span>
              <button onClick={resetBase} className={copyBtnClass} title="重置">
                <RotateCcw size={14} />
              </button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {BASES.map((b) => {
                const val = baseValues[b.key];
                const copyId = `base-${b.key}`;
                return (
                  <div
                    key={b.key}
                    className="flex flex-col gap-1.5 rounded-lg border border-input p-3"
                  >
                    <span className="text-xs font-medium text-muted-foreground">
                      {b.label}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={val}
                        onChange={(e) => convertBase(b.key, e.target.value)}
                        placeholder={b.placeholder}
                        className={inputClass}
                        spellCheck={false}
                      />
                      <button
                        onClick={() => handleCopy(val, copyId)}
                        disabled={!val}
                        className={copyBtnClass}
                        title="复制"
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
            {baseError && (
              <div className="mt-3">
                <Badge variant="destructive">{baseError}</Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 2: Bit Operations */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Calculator size={16} />
              位运算
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  A（十进制）
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={bitA}
                  onChange={(e) => setBitA(e.target.value)}
                  placeholder="255"
                  className={inputClass}
                  spellCheck={false}
                />
                {bitA.trim() && parsedA === null && (
                  <Badge variant="destructive">无效数值</Badge>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  B（十进制）
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={bitB}
                  onChange={(e) => setBitB(e.target.value)}
                  placeholder="15"
                  className={inputClass}
                  spellCheck={false}
                />
                {bitB.trim() && parsedB === null && (
                  <Badge variant="destructive">无效数值</Badge>
                )}
              </div>
            </div>

            {bitResults && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="px-3 py-2 font-medium">运算</th>
                      <th className="px-3 py-2 font-medium">十进制</th>
                      <th className="px-3 py-2 font-medium">二进制</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bitResults.map((r) => (
                      <tr key={r.op} className="border-b border-border/50">
                        <td className="px-3 py-1.5 font-medium">{r.op}</td>
                        <td className="px-3 py-1.5 font-mono">{r.dec}</td>
                        <td className="px-3 py-1.5 font-mono">{r.bin}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 3: chmod Permission Calculator */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <ShieldCheck size={16} />
              文件权限计算 (chmod)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Permission Checkboxes */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="px-3 py-2 font-medium">分组</th>
                      {PERM_LABELS.map((l) => (
                        <th key={l} className="px-3 py-2 text-center font-medium">
                          {l}
                        </th>
                      ))}
                      <th className="px-3 py-2 text-center font-medium">值</th>
                    </tr>
                  </thead>
                  <tbody>
                    {GROUP_LABELS.map((group, gi) => (
                      <tr key={group} className="border-b border-border/50">
                        <td className="px-3 py-2 font-medium">{group}</td>
                        {permissions[gi].map((on, pi) => (
                          <td key={pi} className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={on}
                              onChange={() => togglePerm(gi, pi)}
                              className="h-4 w-4 cursor-pointer rounded accent-primary"
                            />
                          </td>
                        ))}
                        <td className="px-3 py-2 text-center font-mono">
                          {getPermDigit(permissions[gi])}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Numeric Input & Results */}
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    数字权限
                  </span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={chmodInput}
                      onChange={(e) => handleChmodInput(e.target.value)}
                      placeholder="755"
                      maxLength={3}
                      className={inputClass}
                      spellCheck={false}
                    />
                    <button
                      onClick={() => handleCopy(numericPerm, "chmod-num")}
                      className={copyBtnClass}
                      title="复制"
                    >
                      {copiedKey === "chmod-num" ? (
                        <Check size={14} className="text-green-500" />
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>
                  </div>
                  {copiedKey === "chmod-num" && (
                    <span className="text-[10px] text-green-600 dark:text-green-400">
                      已复制
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    符号权限
                  </span>
                  <div className="flex items-center gap-1.5">
                    <div className="flex min-w-0 flex-1 items-center rounded-md border border-input bg-transparent px-2.5 py-1.5 font-mono text-sm dark:bg-input/30">
                      {symbolicPerm}
                    </div>
                    <button
                      onClick={() => handleCopy(symbolicPerm, "chmod-sym")}
                      className={copyBtnClass}
                      title="复制"
                    >
                      {copiedKey === "chmod-sym" ? (
                        <Check size={14} className="text-green-500" />
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>
                  </div>
                  {copiedKey === "chmod-sym" && (
                    <span className="text-[10px] text-green-600 dark:text-green-400">
                      已复制
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    命令
                  </span>
                  <div className="flex items-center gap-1.5">
                    <div className="flex min-w-0 flex-1 items-center rounded-md border border-input bg-transparent px-2.5 py-1.5 font-mono text-sm dark:bg-input/30">
                      chmod {numericPerm}
                    </div>
                    <button
                      onClick={() => handleCopy(`chmod ${numericPerm}`, "chmod-cmd")}
                      className={copyBtnClass}
                      title="复制"
                    >
                      {copiedKey === "chmod-cmd" ? (
                        <Check size={14} className="text-green-500" />
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>
                  </div>
                  {copiedKey === "chmod-cmd" && (
                    <span className="text-[10px] text-green-600 dark:text-green-400">
                      已复制
                    </span>
                  )}
                </div>
              </div>

              {/* Presets */}
              <div className="flex flex-wrap gap-2">
                {PERMISSION_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => applyPreset(p.value)}
                    className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                      numericPerm === p.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-ring hover:bg-accent"
                    }`}
                  >
                    <span className="font-mono">{p.value}</span>
                    <span className="ml-1.5 text-muted-foreground">{p.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

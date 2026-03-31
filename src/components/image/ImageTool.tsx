import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  Copy,
  Check,
  Download,
  ImageIcon,
  Trash2,
} from "lucide-react";

interface ImageData {
  file: File;
  dataUrl: string;
  width: number;
  height: number;
}

type ConvertedFormat = {
  format: string;
  mimeType: string;
  dataUrl: string;
  size: number;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function getBaseName(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot > 0 ? filename.slice(0, dot) : filename;
}

export function ImageTool() {
  const [imageData, setImageData] = useState<ImageData | null>(null);
  const [base64Url, setBase64Url] = useState("");
  const [jpegQuality, setJpegQuality] = useState(0.85);
  const [webpQuality, setWebpQuality] = useState(0.85);
  const [converted, setConverted] = useState<ConvertedFormat[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copyLabel, setCopyLabel] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const loadImage = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("请选择图片文件");
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        setImageData({ file, dataUrl, width: img.naturalWidth, height: img.naturalHeight });
        setBase64Url(dataUrl);
        setConverted([]);
      };
      img.onerror = () => setError("图片加载失败");
      img.src = dataUrl;
    };
    reader.onerror = () => setError("文件读取失败");
    reader.readAsDataURL(file);
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) loadImage(file);
    },
    [loadImage],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const file = e.dataTransfer.files[0];
      if (file) loadImage(file);
    },
    [loadImage],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            loadImage(file);
            break;
          }
        }
      }
    };
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [loadImage]);

  const convertImage = useCallback(() => {
    if (!imageData) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      const formats: { format: string; mimeType: string; quality?: number }[] = [
        { format: "PNG", mimeType: "image/png" },
        { format: "JPEG", mimeType: "image/jpeg", quality: jpegQuality },
        { format: "WebP", mimeType: "image/webp", quality: webpQuality },
      ];

      const results: ConvertedFormat[] = formats.map(({ format, mimeType, quality }) => {
        const dataUrl = quality !== undefined
          ? canvas.toDataURL(mimeType, quality)
          : canvas.toDataURL(mimeType);
        const base64 = dataUrl.split(",")[1] ?? "";
        const size = Math.ceil((base64.length * 3) / 4);
        return { format, mimeType, dataUrl, size };
      });

      setConverted(results);
    };
    img.src = imageData.dataUrl;
  }, [imageData, jpegQuality, webpQuality]);

  useEffect(() => {
    if (imageData) convertImage();
  }, [imageData, convertImage]);

  const handleCopy = useCallback((text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopyLabel(key);
      setTimeout(() => setCopyLabel(null), 1500);
    });
  }, []);

  const handleDownload = useCallback(
    (dataUrl: string, ext: string) => {
      if (!imageData) return;
      downloadDataUrl(dataUrl, `${getBaseName(imageData.file.name)}.${ext}`);
    },
    [imageData],
  );

  const handleClear = useCallback(() => {
    setImageData(null);
    setBase64Url("");
    setConverted([]);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  return (
    <div className="flex h-full flex-col overflow-y-auto p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">图片工具</h2>
        {imageData && (
          <Button variant="ghost" size="sm" onClick={handleClear} className="gap-1">
            <Trash2 size={14} />
            清空
          </Button>
        )}
      </div>

      {error && (
        <Badge variant="destructive" className="mb-4 w-fit">
          {error}
        </Badge>
      )}

      {!imageData ? (
        <div
          ref={dropRef}
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className="flex cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-muted-foreground/30 bg-muted/30 py-20 transition-colors hover:border-primary/50 hover:bg-muted/50"
        >
          <Upload size={40} className="text-muted-foreground" />
          <div className="text-center">
            <p className="text-sm font-medium">点击选择图片或拖拽到此处</p>
            <p className="mt-1 text-xs text-muted-foreground">
              支持 PNG、JPG、GIF、WebP、SVG、BMP、ICO，也可直接 Ctrl+V 粘贴
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Preview & Info */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <ImageIcon size={16} />
                图片预览
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-center rounded-lg bg-muted/30 p-4">
                <img
                  src={imageData.dataUrl}
                  alt={imageData.file.name}
                  className="max-h-[400px] rounded object-contain"
                />
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
                <div>
                  <span className="text-muted-foreground">文件名</span>
                  <p className="truncate font-medium" title={imageData.file.name}>
                    {imageData.file.name}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">格式</span>
                  <p className="font-medium">{imageData.file.type || "unknown"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">原始尺寸</span>
                  <p className="font-medium">
                    {imageData.width} × {imageData.height} px
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">文件大小</span>
                  <p className="font-medium">{formatFileSize(imageData.file.size)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Base64 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-sm font-medium">
                <span>Base64 Data URL</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {formatFileSize(base64Url.length)}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <textarea
                value={base64Url}
                readOnly
                className="block max-h-[200px] w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 font-mono text-xs outline-none dark:bg-input/30"
                rows={4}
                spellCheck={false}
              />
              <Button
                size="sm"
                variant="outline"
                className="gap-1"
                onClick={() => handleCopy(base64Url, "base64")}
              >
                {copyLabel === "base64" ? <Check size={14} /> : <Copy size={14} />}
                {copyLabel === "base64" ? "已复制" : "复制 Data URL"}
              </Button>
            </CardContent>
          </Card>

          {/* Format Conversion */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">格式转换</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">
                    JPEG 质量：{Math.round(jpegQuality * 100)}%
                  </label>
                  <input
                    type="range"
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={jpegQuality}
                    onChange={(e) => setJpegQuality(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">
                    WebP 质量：{Math.round(webpQuality * 100)}%
                  </label>
                  <input
                    type="range"
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={webpQuality}
                    onChange={(e) => setWebpQuality(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {converted.map((c) => (
                  <div
                    key={c.format}
                    className="flex items-center justify-between rounded-lg border border-input px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{c.format}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(c.size)}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() =>
                        handleDownload(c.dataUrl, c.format.toLowerCase())
                      }
                    >
                      <Download size={14} />
                      下载
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">快捷操作</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {converted.map((c) => (
                  <Button
                    key={`dl-${c.format}`}
                    size="sm"
                    variant="secondary"
                    className="gap-1"
                    onClick={() =>
                      handleDownload(c.dataUrl, c.format.toLowerCase())
                    }
                  >
                    <Download size={14} />
                    下载 {c.format}
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant="secondary"
                  className="gap-1"
                  onClick={() => handleCopy(base64Url, "quick-base64")}
                >
                  {copyLabel === "quick-base64" ? (
                    <Check size={14} />
                  ) : (
                    <Copy size={14} />
                  )}
                  {copyLabel === "quick-base64" ? "已复制" : "复制 Base64"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

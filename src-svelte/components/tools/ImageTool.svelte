<script lang="ts">
  interface ImageMeta {
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

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };
  const downloadDataUrl = (dataUrl: string, filename: string) => {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };
  const getBaseName = (filename: string) => {
    const dot = filename.lastIndexOf(".");
    return dot > 0 ? filename.slice(0, dot) : filename;
  };

  let imageData = $state<ImageMeta | null>(null);
  let jpegQuality = $state(0.85);
  let webpQuality = $state(0.85);
  let converted = $state<ConvertedFormat[]>([]);
  let error = $state<string | null>(null);
  let copyLabel = $state<string | null>(null);
  let fileInputRef = $state<HTMLInputElement | null>(null);
  let canvasRef = $state<HTMLCanvasElement | null>(null);

  const base64Url = $derived(imageData?.dataUrl ?? "");

  const loadImage = (file: File) => {
    if (!file.type.startsWith("image/")) {
      error = "请选择图片文件";
      return;
    }
    error = null;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        imageData = { file, dataUrl, width: img.naturalWidth, height: img.naturalHeight };
        converted = [];
      };
      img.onerror = () => (error = "图片加载失败");
      img.src = dataUrl;
    };
    reader.onerror = () => (error = "文件读取失败");
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) loadImage(file);
  };
  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer?.files?.[0];
    if (file) loadImage(file);
  };
  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  $effect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) loadImage(file);
          break;
        }
      }
    };
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  });

  $effect(() => {
    if (!imageData || !canvasRef) return;
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled || !canvasRef) return;
      canvasRef.width = img.naturalWidth;
      canvasRef.height = img.naturalHeight;
      const ctx = canvasRef.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, canvasRef.width, canvasRef.height);
      ctx.drawImage(img, 0, 0);
      const formats: { format: string; mimeType: string; quality?: number }[] = [
        { format: "PNG", mimeType: "image/png" },
        { format: "JPEG", mimeType: "image/jpeg", quality: jpegQuality },
        { format: "WebP", mimeType: "image/webp", quality: webpQuality },
      ];
      converted = formats.map(({ format, mimeType, quality }) => {
        const dataUrl = quality !== undefined ? canvasRef!.toDataURL(mimeType, quality) : canvasRef!.toDataURL(mimeType);
        const base64 = dataUrl.split(",")[1] ?? "";
        const size = Math.ceil((base64.length * 3) / 4);
        return { format, mimeType, dataUrl, size };
      });
    };
    img.src = imageData.dataUrl;
    return () => {
      cancelled = true;
    };
  });

  const handleCopy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    copyLabel = key;
    setTimeout(() => {
      if (copyLabel === key) copyLabel = null;
    }, 1500);
  };

  const handleDownload = (dataUrl: string, ext: string) => {
    if (!imageData) return;
    downloadDataUrl(dataUrl, `${getBaseName(imageData.file.name)}.${ext}`);
  };
  const handleClear = () => {
    imageData = null;
    converted = [];
    error = null;
    if (fileInputRef) fileInputRef.value = "";
  };
</script>

<div class="flex h-full flex-col overflow-y-auto p-5">
  <div class="mb-4 flex items-center justify-between">
    <h2 class="text-2xl font-bold tracking-tight">图片工具</h2>
    {#if imageData}
      <button class="btn" onclick={handleClear}>清空</button>
    {/if}
  </div>

  {#if error}
    <div class="mb-4 w-fit rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</div>
  {/if}

  {#if !imageData}
    <button
      type="button"
      onclick={() => fileInputRef?.click()}
      ondrop={handleDrop}
      ondragover={handleDragOver}
      class="flex cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-muted-foreground/30 bg-muted/30 py-20 transition-colors hover:border-primary/50 hover:bg-muted/50"
    >
      <div class="text-4xl text-muted-foreground">⬆</div>
      <div class="text-center">
        <p class="text-sm font-medium">点击选择图片或拖拽到此处</p>
        <p class="mt-1 text-xs text-muted-foreground">支持 PNG、JPG、GIF、WebP、SVG、BMP、ICO，也可直接 Ctrl+V 粘贴</p>
      </div>
    </button>
  {:else}
    <div class="space-y-4">
      <section class="card">
        <div class="border-b p-4 pb-2 text-sm font-medium">图片预览</div>
        <div class="space-y-4 p-4">
          <div class="flex justify-center rounded-lg bg-muted/30 p-4">
            <img src={imageData.dataUrl} alt={imageData.file.name} class="max-h-[400px] rounded object-contain" />
          </div>
          <div class="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            <div><span class="text-muted-foreground">文件名</span><p class="truncate font-medium" title={imageData.file.name}>{imageData.file.name}</p></div>
            <div><span class="text-muted-foreground">格式</span><p class="font-medium">{imageData.file.type || "unknown"}</p></div>
            <div><span class="text-muted-foreground">原始尺寸</span><p class="font-medium">{imageData.width} × {imageData.height} px</p></div>
            <div><span class="text-muted-foreground">文件大小</span><p class="font-medium">{formatFileSize(imageData.file.size)}</p></div>
          </div>
        </div>
      </section>

      <section class="card">
        <div class="border-b p-4 pb-2 text-sm font-medium">Base64 Data URL</div>
        <div class="space-y-2 p-4">
          <div class="text-xs text-muted-foreground">{formatFileSize(base64Url.length)}</div>
          <textarea value={base64Url} readonly class="input max-h-[200px] font-mono text-xs" rows="4" spellcheck="false"></textarea>
          <button class="btn" onclick={() => handleCopy(base64Url, "base64")}>{copyLabel === "base64" ? "已复制" : "复制 Data URL"}</button>
        </div>
      </section>

      <section class="card">
        <div class="border-b p-4 pb-2 text-sm font-medium">格式转换</div>
        <div class="space-y-4 p-4">
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="space-y-1.5">
              <div class="text-xs text-muted-foreground">JPEG 质量：{Math.round(jpegQuality * 100)}%</div>
              <input type="range" min="0.1" max="1" step="0.05" bind:value={jpegQuality} class="w-full accent-primary" />
            </div>
            <div class="space-y-1.5">
              <div class="text-xs text-muted-foreground">WebP 质量：{Math.round(webpQuality * 100)}%</div>
              <input type="range" min="0.1" max="1" step="0.05" bind:value={webpQuality} class="w-full accent-primary" />
            </div>
          </div>
          <div class="grid gap-3 sm:grid-cols-3">
            {#each converted as c}
              <div class="flex items-center justify-between rounded-lg border border-input px-4 py-3">
                <div><p class="text-sm font-medium">{c.format}</p><p class="text-xs text-muted-foreground">{formatFileSize(c.size)}</p></div>
                <button class="btn h-8 text-xs" onclick={() => handleDownload(c.dataUrl, c.format.toLowerCase())}>下载</button>
              </div>
            {/each}
          </div>
        </div>
      </section>

      <section class="card">
        <div class="border-b p-4 pb-2 text-sm font-medium">快捷操作</div>
        <div class="p-4">
          <div class="flex flex-wrap gap-2">
            {#each converted as c}
              <button class="btn h-8 text-xs" onclick={() => handleDownload(c.dataUrl, c.format.toLowerCase())}>下载 {c.format}</button>
            {/each}
            <button class="btn h-8 text-xs" onclick={() => handleCopy(base64Url, "quick-base64")}>{copyLabel === "quick-base64" ? "已复制" : "复制 Base64"}</button>
          </div>
        </div>
      </section>
    </div>
  {/if}

  <input bind:this={fileInputRef} type="file" accept="image/*" onchange={handleFileChange} class="hidden" />
  <canvas bind:this={canvasRef} class="hidden"></canvas>
</div>

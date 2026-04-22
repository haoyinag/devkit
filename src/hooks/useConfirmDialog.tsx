import { useCallback, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface ConfirmOptions {
  title: string;
  description?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
}

interface ConfirmState extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

/**
 * 应用内确认对话框，替代 `window.confirm()`。
 * 返回 `[confirm, ConfirmDialog]`：
 * - `confirm(opts)` 打开对话框并返回 `Promise<boolean>`
 * - `ConfirmDialog` 需渲染到组件树中
 */
export function useConfirmDialog(): [(opts: ConfirmOptions) => Promise<boolean>, ReactNode] {
  const [state, setState] = useState<ConfirmState | null>(null);
  const resolveRef = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setState({ ...opts, resolve });
    });
  }, []);

  const handleClose = useCallback((ok: boolean) => {
    resolveRef.current?.(ok);
    resolveRef.current = null;
    setState(null);
  }, []);

  const dialog = state ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => handleClose(false)}
        onKeyDown={(e) => e.key === "Escape" && handleClose(false)}
        role="presentation"
      />
      <div
        className="relative z-10 mx-4 w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby={state.description ? "confirm-desc" : undefined}
      >
        <h3 id="confirm-title" className="text-base font-semibold">
          {state.title}
        </h3>
        {state.description && (
          <div id="confirm-desc" className="mt-2 text-sm text-muted-foreground">
            {state.description}
          </div>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => handleClose(false)}>
            {state.cancelText ?? "取消"}
          </Button>
          <Button
            type="button"
            variant={state.variant ?? "default"}
            size="sm"
            onClick={() => handleClose(true)}
            autoFocus
          >
            {state.confirmText ?? "确认"}
          </Button>
        </div>
      </div>
    </div>
  ) : null;

  return [confirm, dialog];
}

import { useState, useCallback, useEffect, useRef } from "react";

/**
 * Manages clipboard copy with visual feedback that auto-resets.
 * Cleans up the timeout on unmount to avoid stale setState calls.
 */
export function useCopyFeedback(timeoutMs = 1200) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const copy = useCallback(
    (text: string, key = "default") => {
      navigator.clipboard.writeText(text).then(
        () => {
          setCopiedKey(key);
          clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => setCopiedKey(null), timeoutMs);
        },
        () => { /* clipboard write failed — ignore */ },
      );
    },
    [timeoutMs],
  );

  return { copiedKey, copy };
}

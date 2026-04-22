import { useState, useEffect } from "react";

export function useLocalStorageDebounced(
  key: string,
  defaultValue: string,
  debounceMs = 400,
) {
  const [value, setValue] = useState(() => {
    try {
      const s = localStorage.getItem(key);
      return s ?? defaultValue;
    } catch {
      return defaultValue;
    }
  });
  const [persistError, setPersistError] = useState<string | null>(null);

  useEffect(() => {
    setPersistError(null);
    const t = window.setTimeout(() => {
      try {
        localStorage.setItem(key, value);
      } catch (e) {
        if (e instanceof DOMException && e.name === "QuotaExceededError") {
          setPersistError("存储空间不足，请导出备份后删减内容。");
        } else {
          setPersistError("无法保存到本地存储。");
        }
      }
    }, debounceMs);
    return () => clearTimeout(t);
  }, [key, value, debounceMs]);

  return [value, setValue, persistError] as const;
}

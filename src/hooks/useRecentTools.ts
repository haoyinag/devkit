import { useState, useCallback } from "react";

const KEY = "devkit-recent-tools";
const MAX = 5;

export function useRecentTools() {
  const [recent, setRecent] = useState<string[]>(() => {
    try {
      const v = localStorage.getItem(KEY);
      return v ? JSON.parse(v) : [];
    } catch {
      return [];
    }
  });

  const recordUsage = useCallback((id: string) => {
    if (id === "home") return;
    setRecent((prev) => {
      const next = [id, ...prev.filter((x) => x !== id)].slice(0, MAX);
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { recent, recordUsage };
}

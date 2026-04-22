import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  theme: "light" | "dark";
  onToggle: () => void;
  iconOnly?: boolean;
}

export function ThemeToggle({ theme, onToggle, iconOnly }: ThemeToggleProps) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "flex items-center gap-2.5 rounded-lg border border-border/70 bg-background/80 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground",
        iconOnly ? "w-auto justify-center p-2" : "w-full",
      )}
      title={theme === "dark" ? "切换到亮色模式" : "切换到暗色模式"}
    >
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
      {!iconOnly && (theme === "dark" ? "亮色模式" : "暗色模式")}
    </button>
  );
}

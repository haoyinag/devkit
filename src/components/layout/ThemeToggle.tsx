import { Sun, Moon } from "lucide-react";

interface ThemeToggleProps {
  theme: "light" | "dark";
  onToggle: () => void;
  iconOnly?: boolean;
}

export function ThemeToggle({ theme, onToggle, iconOnly }: ThemeToggleProps) {
  return (
    <button
      onClick={onToggle}
      className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      title={theme === "dark" ? "切换到亮色模式" : "切换到暗色模式"}
    >
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
      {!iconOnly && (theme === "dark" ? "亮色模式" : "暗色模式")}
    </button>
  );
}

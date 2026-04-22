import { useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  dateStrToDatetimeLocalValue,
  datetimeLocalValueToCanonical,
  dateToMinuteCanonical,
} from "@/lib/time-utils";

const INPUT_CLASS =
  "h-8 min-h-8 min-w-0 flex-1 rounded-lg border border-input bg-transparent px-2.5 py-1 font-mono text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30";

export interface DateTimeMinuteInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  id?: string;
  "aria-label"?: string;
}

/**
 * 原生 `datetime-local`（`step=60` 精确到分）：右侧日历为浏览器自带控件；
 * 支持 Tab/方向键在各段间移动并键入数字，以及粘贴可解析的日期时间字符串。
 */
export function DateTimeMinuteInput({
  value,
  onChange,
  onKeyDown,
  id,
  "aria-label": ariaLabel,
}: DateTimeMinuteInputProps) {
  const dtValue = dateStrToDatetimeLocalValue(value);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      if (!v) {
        onChange("");
        return;
      }
      onChange(datetimeLocalValueToCanonical(v));
    },
    [onChange],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      const text = e.clipboardData.getData("text").trim();
      if (!text) return;
      const d = new Date(text);
      if (!isNaN(d.getTime())) {
        e.preventDefault();
        onChange(dateToMinuteCanonical(d));
      }
    },
    [onChange],
  );

  return (
    <input
      id={id}
      type="datetime-local"
      step={60}
      value={dtValue}
      onChange={handleChange}
      onPaste={handlePaste}
      onKeyDown={onKeyDown}
      spellCheck={false}
      title="可键盘输入、点击右侧日历图标选择，或粘贴如 2024-04-01 12:00:00"
      aria-label={ariaLabel ?? "日期时间（精确到分）"}
      className={cn(INPUT_CLASS)}
    />
  );
}

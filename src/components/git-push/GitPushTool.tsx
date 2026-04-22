import { Terminal } from "lucide-react";
import { GitWorkflowPanel } from "./GitWorkflowPanel";

export function GitPushTool() {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <Terminal size={20} className="text-muted-foreground" />
          <h2 className="text-lg font-semibold">Git 推送助手</h2>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <GitWorkflowPanel mode="push" />
      </div>
    </div>
  );
}

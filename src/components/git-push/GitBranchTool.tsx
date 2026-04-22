import { GitBranch } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GitWorkflowPanel } from "./GitWorkflowPanel";

export function GitBranchTool() {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <GitBranch size={20} className="text-muted-foreground" />
          <h2 className="text-lg font-semibold">Git 分支助手</h2>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <Card className="mb-4 overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">作用</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            专注分支管理：查看当前分支与远程同步状态、切换已有分支、创建并切换新分支。提交与推送请使用「Git 推送助手」。
          </CardContent>
        </Card>
        <GitWorkflowPanel mode="branch" />
      </div>
    </div>
  );
}

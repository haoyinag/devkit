import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  /** 切换 key 时自动重置（如 activePage） */
  resetKey?: string;
  onReset?: () => void;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  private handleRetry = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full items-center justify-center p-8">
          <div className="flex max-w-md flex-col items-center gap-4 text-center">
            <AlertTriangle size={40} className="text-destructive" />
            <h2 className="text-lg font-semibold">当前工具发生了意外错误</h2>
            <p className="text-sm text-muted-foreground">
              你可以尝试重新加载此工具，或切换到其它工具继续使用。
            </p>
            <pre className="max-h-32 w-full overflow-auto rounded-md bg-muted p-3 text-left font-mono text-xs text-destructive">
              {this.state.error.message}
            </pre>
            <Button onClick={this.handleRetry} variant="outline" className="gap-2">
              <RotateCcw size={14} />
              重新加载
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

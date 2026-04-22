export type TauriCommandErrorCode =
  | "invalid_input"
  | "repo_not_found"
  | "git_missing"
  | "detached_head"
  | "permission_denied"
  | "timeout"
  | "internal";

export interface TauriCommandError {
  code: TauriCommandErrorCode;
  message: string;
  details?: string;
}

export interface TauriCommandOk<T> {
  ok: true;
  data: T;
}

export interface TauriCommandErr {
  ok: false;
  error: TauriCommandError;
}

export type TauriCommandResult<T> = TauriCommandOk<T> | TauriCommandErr;

export function isTauriCommandOk<T>(result: TauriCommandResult<T>): result is TauriCommandOk<T> {
  return result.ok;
}

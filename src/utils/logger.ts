/**
 * @file 日志系统
 * @description Web / Tauri 前端统一日志：图标、时间戳、级别、Error/对象序列化、耗时等；仅在开发环境输出。
 * 简化入口：`devLog(...)` / `devLog.scope('模块')`；完整入口：`Logger.debug('模块', ...)`。
 */

const LogLevel = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    CRITICAL: 4,
} as const;

const LOG_LEVEL_CONFIG = {
    [LogLevel.DEBUG]: {
        name: 'DEBUG',
        icon: '🐛',
        consoleMethod: 'debug',
    },
    [LogLevel.INFO]: {
        name: 'INFO',
        icon: 'ℹ️',
        consoleMethod: 'info',
    },
    [LogLevel.WARN]: {
        name: 'WARN',
        icon: '⚠️',
        consoleMethod: 'warn',
    },
    [LogLevel.ERROR]: {
        name: 'ERROR',
        icon: '❌',
        consoleMethod: 'error',
    },
    [LogLevel.CRITICAL]: {
        name: 'CRITICAL',
        icon: '🚨',
        consoleMethod: 'error',
    },
} as const;

export interface LogConfig {
    maxLevel: number;
    enableTimestamp: boolean;
    enableFileInfo: boolean;
    enableIcons: boolean;
    enableErrorReporting: boolean;
}

const DEFAULT_CONFIG: LogConfig = {
    maxLevel: LogLevel.DEBUG,
    enableTimestamp: true,
    enableFileInfo: false,
    enableIcons: true,
    enableErrorReporting: true,
};

/** `devLog` / `devLog.scope()` 未指定模块名时的默认标签 */
const DEFAULT_DEV_SCOPE = 'app';

export class LoggerClass {
    private static instance: LoggerClass | null = null;
    private config: LogConfig = DEFAULT_CONFIG;
    private readonly isDev = import.meta.env.DEV;
    /** 生产环境仅输出 WARN 及以上 */
    private readonly prodMinLevel = LogLevel.WARN;

    private constructor() {}

    public static getInstance(): LoggerClass {
        if (!LoggerClass.instance) {
            LoggerClass.instance = new LoggerClass();
        }
        return LoggerClass.instance;
    }

    configure(config: Partial<LogConfig>): void {
        if (!this.isDev) return;
        this.config = { ...this.config, ...config };
    }

    getConfig(): LogConfig {
        return { ...this.config };
    }

    private getTimestamp(): string {
        if (!this.config.enableTimestamp) return '';
        return `[${new Date().toISOString()}]`;
    }

    private getFileInfo(): string {
        if (!this.config.enableFileInfo) return '';
        try {
            const stack = new Error().stack;
            if (stack) {
                const lines = stack.split('\n');
                for (let i = 3; i < lines.length; i++) {
                    const line = lines[i];
                    if (
                        line.includes('at ') &&
                        !line.includes('Logger.') &&
                        !line.includes('LoggerClass.') &&
                        !line.includes('devLog.') &&
                        !line.includes('createDevLogFacade')
                    ) {
                        const match = line.match(/\((.+):(\d+):(\d+)\)\s*$/);
                        if (match) {
                            const filePath = match[1];
                            const lineNum = match[2];
                            const normalized = filePath.replace(/\\/g, '/');
                            const fileName = normalized.split('/').pop() || filePath;
                            return `[${fileName}:${lineNum}]`;
                        }
                    }
                }
            }
        } catch {
            // ignore
        }
        return '';
    }

    private _serializeArg(arg: unknown): string {
        if (arg instanceof Error) {
            return `[Error: ${arg.message}]`;
        }

        if (typeof arg === 'object' && arg !== null) {
            try {
                return JSON.stringify(arg);
            } catch {
                return '[Object: 无法序列化]';
            }
        }

        return String(arg);
    }

    private _format(level: number, moduleName: string, ...args: unknown[]): string {
        const levelConfig = LOG_LEVEL_CONFIG[level as keyof typeof LOG_LEVEL_CONFIG];
        const timestamp = this.getTimestamp();
        const fileInfo = this.getFileInfo();

        let formattedMessage = '';

        if (this.config.enableIcons) {
            formattedMessage += levelConfig.icon + ' ';
        }

        if (timestamp) {
            formattedMessage += timestamp + ' ';
        }

        formattedMessage += `[${moduleName}] `;

        if (fileInfo) {
            formattedMessage += fileInfo + ' ';
        }

        formattedMessage += args.map((arg) => this._serializeArg(arg)).join(' ');

        return formattedMessage;
    }

    private _shouldLog(level: number): boolean {
        if (this.isDev) return level >= this.config.maxLevel;
        return level >= this.prodMinLevel;
    }

    private _outputToConsole(level: number, moduleName: string, ...args: unknown[]): void {
        if (!this._shouldLog(level)) return;

        const levelConfig = LOG_LEVEL_CONFIG[level as keyof typeof LOG_LEVEL_CONFIG];
        const formattedMessage = this._format(level, moduleName, ...args);

        switch (levelConfig.consoleMethod) {
            case 'debug':
                console.debug(formattedMessage);
                break;
            case 'info':
                console.info(formattedMessage);
                break;
            case 'warn':
                console.warn(formattedMessage);
                break;
            case 'error':
                console.error(formattedMessage);
                break;
            default:
                console.log(formattedMessage);
        }
    }

    private _reportToServer(..._args: unknown[]): void {
        if (!this.config.enableErrorReporting) return;
        try {
            // 可接入 Sentry 等
        } catch {
            // ignore
        }
    }

    debug(moduleName: string, ...args: unknown[]): void {
        this._outputToConsole(LogLevel.DEBUG, moduleName, ...args);
    }

    info(moduleName: string, ...args: unknown[]): void {
        this._outputToConsole(LogLevel.INFO, moduleName, ...args);
    }

    warn(moduleName: string, ...args: unknown[]): void {
        this._outputToConsole(LogLevel.WARN, moduleName, ...args);
    }

    error(moduleName: string, ...args: unknown[]): void {
        this._outputToConsole(LogLevel.ERROR, moduleName, ...args);
        if (this._shouldLog(LogLevel.ERROR)) this._reportToServer(...args);
    }

    critical(moduleName: string, ...args: unknown[]): void {
        this._outputToConsole(LogLevel.CRITICAL, moduleName, ...args);
        if (this._shouldLog(LogLevel.CRITICAL)) this._reportToServer(...args);
    }

    object(moduleName: string, obj: unknown, title: string = 'Object'): void {
        this.debug(moduleName, `${title}:`, obj);
    }

    array(moduleName: string, arr: unknown[], title: string = 'Array'): void {
        this.debug(moduleName, `${title}:`, arr);
    }

    time<T>(moduleName: string, fn: () => T, fnName: string = 'Function'): T {
        if (!this._shouldLog(LogLevel.DEBUG)) return fn();
        const startTime = performance.now();
        const result = fn();
        const duration = performance.now() - startTime;
        this.debug(moduleName, `⏱️ ${fnName} 执行时间: ${duration.toFixed(2)}ms`);
        return result;
    }

    async timeAsync<T>(
        moduleName: string,
        fn: () => Promise<T>,
        fnName: string = 'AsyncFunction',
    ): Promise<T> {
        if (!this._shouldLog(LogLevel.DEBUG)) return fn();
        const startTime = performance.now();
        const result = await fn();
        const duration = performance.now() - startTime;
        this.debug(moduleName, `⏱️ ${fnName} 执行时间: ${duration.toFixed(2)}ms`);
        return result;
    }
}

export const Logger = LoggerClass.getInstance();

/** 带模块名的便捷 API（由 `devLog.scope` 返回） */
export interface ScopedDevLog {
    debug: (...args: unknown[]) => void;
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
    critical: (...args: unknown[]) => void;
    object: (obj: unknown, title?: string) => void;
    array: (arr: unknown[], title?: string) => void;
    time: <T>(fn: () => T, fnName?: string) => T;
    timeAsync: <T>(fn: () => Promise<T>, fnName?: string) => Promise<T>;
}

/** 默认模块名下的快捷日志 + 分级方法与 `scope` */
export interface DevLog {
    (...args: unknown[]): void;
    debug: (...args: unknown[]) => void;
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
    critical: (...args: unknown[]) => void;
    object: (obj: unknown, title?: string) => void;
    array: (arr: unknown[], title?: string) => void;
    time: <T>(fn: () => T, fnName?: string) => T;
    timeAsync: <T>(fn: () => Promise<T>, fnName?: string) => Promise<T>;
    /** 绑定模块名，后续调用无需再写模块参数 */
    scope: (moduleName: string) => ScopedDevLog;
    /** 与 `Logger` 相同，完整 `debug(module, ...)` API */
    logger: LoggerClass;
}

function createScopedDevLog(logger: LoggerClass, moduleName: string): ScopedDevLog {
    return {
        debug: (...args: unknown[]) => logger.debug(moduleName, ...args),
        info: (...args: unknown[]) => logger.info(moduleName, ...args),
        warn: (...args: unknown[]) => logger.warn(moduleName, ...args),
        error: (...args: unknown[]) => logger.error(moduleName, ...args),
        critical: (...args: unknown[]) => logger.critical(moduleName, ...args),
        object: (obj: unknown, title?: string) => logger.object(moduleName, obj, title),
        array: (arr: unknown[], title?: string) => logger.array(moduleName, arr, title),
        time: <T>(fn: () => T, fnName?: string) => logger.time(moduleName, fn, fnName),
        timeAsync: <T>(fn: () => Promise<T>, fnName?: string) =>
            logger.timeAsync(moduleName, fn, fnName),
    };
}

function createDevLogFacade(logger: LoggerClass): DevLog {
    const S = DEFAULT_DEV_SCOPE;

    const main = (...args: unknown[]) => logger.debug(S, ...args);

    return Object.assign(main, {
        debug: (...args: unknown[]) => logger.debug(S, ...args),
        info: (...args: unknown[]) => logger.info(S, ...args),
        warn: (...args: unknown[]) => logger.warn(S, ...args),
        error: (...args: unknown[]) => logger.error(S, ...args),
        critical: (...args: unknown[]) => logger.critical(S, ...args),
        object: (obj: unknown, title = 'Object') => logger.object(S, obj, title),
        array: (arr: unknown[], title = 'Array') => logger.array(S, arr, title),
        time: <T>(fn: () => T, fnName = 'Function') => logger.time(S, fn, fnName),
        timeAsync: <T>(fn: () => Promise<T>, fnName = 'AsyncFunction') =>
            logger.timeAsync(S, fn, fnName),
        scope: (moduleName: string) => createScopedDevLog(logger, moduleName),
        logger,
    }) as DevLog;
}

export const $v = createDevLogFacade(Logger);

(globalThis as typeof globalThis & { $v: DevLog }).$v = $v;

export default Logger;

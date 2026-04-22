/// <reference types="vite/client" />

import type { DevLog } from './utils/logger';

declare global {
    interface Window {
        devLog: DevLog;
    }
}

export {};

export * from './types.js';
export * from './schemas.js';
export declare const APP_NAME = "DecentraIDE";
export declare const APP_VERSION = "0.1.0";
export interface HealthCheckResult {
    status: 'ok' | 'error';
    timestamp: number;
}
export declare function getHealthCheck(): HealthCheckResult;

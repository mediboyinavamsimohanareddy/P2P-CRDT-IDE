export * from './types.js';
export * from './schemas.js';
export const APP_NAME = 'DecentraIDE';
export const APP_VERSION = '0.1.0';
export function getHealthCheck() {
    return {
        status: 'ok',
        timestamp: Date.now(),
    };
}

export * from './types.js';
export * from './schemas.js';

export const APP_NAME = 'DecentraIDE';
export const APP_VERSION = '0.1.0';

export interface HealthCheckResult {
  status: 'ok' | 'error';
  timestamp: number;
}

export function getHealthCheck(): HealthCheckResult {
  return {
    status: 'ok',
    timestamp: Date.now(),
  };
}

import { describe, it, expect } from 'vitest';
import { getHealthCheck, APP_NAME } from './index.js';

describe('Shared package smoke test', () => {
  it('returns valid app name and health check', () => {
    expect(APP_NAME).toBe('DecentraIDE');
    const health = getHealthCheck();
    expect(health.status).toBe('ok');
    expect(health.timestamp).toBeGreaterThan(0);
  });
});

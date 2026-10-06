import { describe, it, expect } from 'vitest';
import { startDesktopApp } from './index.js';

describe('Desktop app smoke test', () => {
  it('starts app correctly', () => {
    const status = startDesktopApp();
    expect(status).toContain('DecentraIDE Desktop App started with status: ok');
  });
});

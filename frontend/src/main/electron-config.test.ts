import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Desktop Mode / Electron Configuration Regression Test', () => {
  it('frontend package.json main entry points to dist/main/electron.js', () => {
    const frontendPkgPath = resolve(process.cwd(), 'package.json');
    const frontendPkg = JSON.parse(readFileSync(frontendPkgPath, 'utf-8'));
    expect(frontendPkg.main).toBe('dist/main/electron.js');
  });

  it('electron.ts uses fileURLToPath for ESM __dirname compatibility', () => {
    const electronTsPath = resolve(process.cwd(), 'src/main/electron.ts');
    const electronTsContent = readFileSync(electronTsPath, 'utf-8');
    expect(electronTsContent).toContain('fileURLToPath(import.meta.url)');
    expect(electronTsContent).toContain('dirname(__filename)');
  });
});

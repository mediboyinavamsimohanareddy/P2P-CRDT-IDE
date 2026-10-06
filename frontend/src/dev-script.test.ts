import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('npm run dev configuration regression test', () => {
  it('root package.json has dev script with --workspaces and --if-present', () => {
    const rootPkgPath = resolve(process.cwd(), '../package.json');
    const rootPkg = JSON.parse(readFileSync(rootPkgPath, 'utf-8'));
    expect(rootPkg.scripts.dev).toBe('npm run dev --workspaces --if-present');
  });

  it('frontend and shared packages have dev scripts', () => {
    const frontendPkgPath = resolve(process.cwd(), 'package.json');
    const frontendPkg = JSON.parse(readFileSync(frontendPkgPath, 'utf-8'));

    const sharedPkgPath = resolve(process.cwd(), 'shared/package.json');
    const sharedPkg = JSON.parse(readFileSync(sharedPkgPath, 'utf-8'));

    expect(frontendPkg.scripts.dev).toBe('vite');
    expect(sharedPkg.scripts.dev).toBeDefined();
  });
});

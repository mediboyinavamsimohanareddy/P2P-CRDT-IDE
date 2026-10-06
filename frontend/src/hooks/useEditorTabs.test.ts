import { describe, it, expect } from 'vitest';
import { getLanguageFromPath } from './useEditorTabs';

describe('useEditorTabs utilities', () => {
  it('maps file extensions to Monaco language identifiers correctly', () => {
    expect(getLanguageFromPath('App.java')).toBe('java');
    expect(getLanguageFromPath('index.ts')).toBe('typescript');
    expect(getLanguageFromPath('App.tsx')).toBe('typescript');
    expect(getLanguageFromPath('server.js')).toBe('javascript');
    expect(getLanguageFromPath('package.json')).toBe('json');
    expect(getLanguageFromPath('pom.xml')).toBe('xml');
    expect(getLanguageFromPath('README.md')).toBe('markdown');
    expect(getLanguageFromPath('unknown.txt')).toBe('plaintext');
  });
});

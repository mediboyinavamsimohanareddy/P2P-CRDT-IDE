import { describe, it, expect, vi } from 'vitest';
import { GeminiExternalProvider } from './GeminiProvider';

describe('GeminiExternalProvider', () => {
  it('instantiates correctly with provided API key', async () => {
    const provider = new GeminiExternalProvider('mock-key');
    expect(provider.isLocal).toBe(false);
    expect(provider.name).toContain('Gemini');
  });

  it('handles completion requests cleanly', async () => {
    const provider = new GeminiExternalProvider('mock-key');
    const res = await provider.generateCompletion({
      prompt: 'Refactor password policy',
      task: 'refactor',
    });

    expect(res.model).toContain('gemini');
    expect(res.confidence).toBeGreaterThan(80);
  });
});

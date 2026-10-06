import { describe, it, expect } from 'vitest';
import { OllamaLocalProvider } from './AIProvider';

describe('OllamaLocalProvider', () => {
  it('generates local completion with Qwen2.5-Coder metadata', async () => {
    const provider = new OllamaLocalProvider();
    const res = await provider.generateCompletion({
      prompt: 'Write password validator',
      task: 'generate',
      language: 'java',
    });

    expect(res.isLocal).toBe(true);
    expect(res.model).toContain('qwen2.5-coder');
    expect(res.confidence).toBeGreaterThan(80);
    expect(res.result).toContain('Write password validator');
  });
});

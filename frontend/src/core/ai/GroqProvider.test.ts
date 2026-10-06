import { describe, it, expect } from 'vitest';
import { GroqProvider } from './GroqProvider';

describe('GroqProvider', () => {
  it('instantiates with user supplied key and llama-3.1-8b-instant model', async () => {
    const provider = new GroqProvider();
    expect(provider.id).toBe('groq');
    expect(provider.name).toContain('Llama 3.1 8B Instant');

    const result = await provider.generateCompletion({
      prompt: 'Merge LoginService password rules',
      task: 'refactor',
      language: 'java',
    });

    expect(result.model).toContain('llama-3.1-8b-instant');
    expect(result.confidence).toBeGreaterThan(90);
    expect(result.result).toContain('validatePassword');
  });
});

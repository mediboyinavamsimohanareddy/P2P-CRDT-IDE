import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OllamaLocalProvider } from './AIProvider';

describe('OllamaLocalProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('generates local completion with Groq model metadata when API responds', async () => {
    const mockResponse = {
      choices: [{ message: { content: 'public void test() { System.out.println("Hello Mistral"); }' } }],
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const provider = new OllamaLocalProvider();
    const res = await provider.generateCompletion({
      prompt: 'Write hello world method',
      task: 'generate',
      language: 'java',
    });

    expect(provider.id).toBe('ollama');
    expect(provider.name).toContain('Mistral:latest');
    expect(provider.isLocal).toBe(true);
    expect(res.model).toBe('llama-3.3-70b-versatile');
    expect(res.result).toContain('Hello Mistral');
    expect(res.confidence).toBe(95);
  });

  it('falls back gracefully to offline local response when API server is unreachable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Connection refused'));

    const provider = new OllamaLocalProvider();
    const res = await provider.generateCompletion({
      prompt: 'Write password validator',
      task: 'generate',
      language: 'java',
    });

    expect(res.model).toContain('llama-3.3-70b-versatile');
    expect(res.isLocal).toBe(true);
    expect(res.result).toContain('Write password validator');
  });
});

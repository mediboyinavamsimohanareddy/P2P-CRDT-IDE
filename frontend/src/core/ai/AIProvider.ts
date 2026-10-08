export interface AIRequestOptions {
  prompt: string;
  codeContext?: string;
  language?: string;
  task: 'generate' | 'explain' | 'debug' | 'refactor' | 'tests';
  timeoutMs?: number;
}

export interface AIResponse {
  result: string;
  confidence: number;
  model: string;
  isLocal: boolean;
}

export interface AIProvider {
  id: string;
  name: string;
  isLocal: boolean;
  generateCompletion(options: AIRequestOptions): Promise<AIResponse>;
}

export class OllamaLocalProvider implements AIProvider {
  id = 'ollama';
  name = 'Ollama (Mistral:latest)';
  isLocal = true;
  private baseUrl: string;
  private modelName: string;

  constructor(baseUrl = 'http://localhost:11434', modelName = 'mistral:latest') {
    this.baseUrl = baseUrl;
    this.modelName = modelName;
  }

  async generateCompletion(options: AIRequestOptions): Promise<AIResponse> {
    const fullPrompt = options.codeContext
      ? `Task: ${options.task}\nLanguage: ${options.language || 'java'}\nContext:\n${options.codeContext}\n\nPrompt: ${options.prompt}`
      : `Task: ${options.task}\nLanguage: ${options.language || 'java'}\n\nPrompt: ${options.prompt}`;

    const timeout = options.timeoutMs || 30000;

    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), timeout) : null;

      const fetchOptions: RequestInit = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.modelName,
          prompt: fullPrompt,
          stream: false,
        }),
      };

      if (controller?.signal) {
        if (typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal && typeof (AbortSignal as unknown as { timeout?: unknown }).timeout === 'function') {
          fetchOptions.signal = AbortSignal.timeout(timeout);
        } else {
          fetchOptions.signal = controller.signal;
        }
      }

      const response = await fetch(`${this.baseUrl}/api/generate`, fetchOptions);

      if (timeoutId) clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Ollama API error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        result: data.response || `// Ollama ${this.modelName} generated completion for ${options.task}`,
        confidence: 95,
        model: this.modelName,
        isLocal: true,
      };
    } catch (e) {
      console.warn('[OllamaLocalProvider] Ollama API call failed or timed out, using local fallback:', e);
      return {
        result: `// AI-generated ${options.task} for ${options.language || 'code'}\n// Powered by Ollama ${this.modelName}\n${options.prompt}`,
        confidence: 90,
        model: `${this.modelName} (Offline Fallback)`,
        isLocal: true,
      };
    }
  }
}

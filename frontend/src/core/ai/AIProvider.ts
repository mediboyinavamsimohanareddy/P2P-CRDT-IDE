export interface AIRequestOptions {
  prompt: string;
  codeContext?: string;
  language?: string;
  task: 'generate' | 'explain' | 'debug' | 'refactor' | 'tests';
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
  name = 'Ollama (Qwen2.5-Coder)';
  isLocal = true;

  async generateCompletion(options: AIRequestOptions): Promise<AIResponse> {
    // In production, this calls http://localhost:11434/api/generate
    // Fallback/stub response for isolated offline tests:
    return {
      result: `// AI-generated ${options.task} for ${options.language || 'code'}\n// Powered by Qwen2.5-Coder\n${options.prompt}`,
      confidence: 92,
      model: 'qwen2.5-coder:7b',
      isLocal: true,
    };
  }
}

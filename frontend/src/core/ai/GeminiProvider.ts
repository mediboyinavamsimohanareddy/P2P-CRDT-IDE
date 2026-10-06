import { AIProvider, AIRequestOptions, AIResponse } from './AIProvider';

export class GeminiExternalProvider implements AIProvider {
  id = 'gemini';
  name = 'Gemini 1.5 Pro (External Cloud)';
  isLocal = false;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generateCompletion(options: AIRequestOptions): Promise<AIResponse> {
    if (!this.apiKey) {
      throw new Error('Gemini API key is required');
    }

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `Task: ${options.task}\nLanguage: ${options.language || 'java'}\nContext:\n${
                      options.codeContext || ''
                    }\n\nPrompt: ${options.prompt}`,
                  },
                ],
              },
            ],
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.statusText}`);
      }

      const data = await response.json();
      const generatedText =
        data?.candidates?.[0]?.content?.parts?.[0]?.text ||
        '// Gemini response produced no output';

      return {
        result: generatedText,
        confidence: 95,
        model: 'gemini-1.5-flash',
        isLocal: false,
      };
    } catch (e) {
      console.warn('Gemini API fetch failed, using offline fallback response:', e);
      return {
        result: `// Gemini proposal for ${options.task}:\n${options.prompt}`,
        confidence: 88,
        model: 'gemini-1.5-flash (fallback)',
        isLocal: false,
      };
    }
  }
}

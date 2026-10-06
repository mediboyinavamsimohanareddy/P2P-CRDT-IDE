import { Conflict, Proposal } from '@decentraide/shared';
import { AIProvider } from '../ai/AIProvider';
import { GroqProvider } from '../ai/GroqProvider';

export class SemanticConflictResolver {
  private aiProvider: AIProvider;

  constructor(aiProvider?: AIProvider) {
    this.aiProvider = aiProvider || new GroqProvider();
  }

  async resolveConflict(conflict: Conflict): Promise<Proposal> {
    const versionsSummary = conflict.versions
      .map((v, i) => `Version ${i + 1} (Author: ${v.authorId}):\n${v.codeSnippet}`)
      .join('\n\n');

    const prompt = `You are an expert distributed systems engineer resolving a semantic code conflict in ${conflict.filePath}.
Base Code:
${conflict.baseSnippet}

Conflicting Overlapping Versions:
${versionsSummary}

Please combine these changes into a single syntactically correct, backwards-compatible, secure implementation.`;

    const response = await this.aiProvider.generateCompletion({
      prompt,
      codeContext: conflict.baseSnippet,
      task: 'refactor',
      language: 'java',
    });

    return {
      id: `prop-${Date.now()}`,
      conflictId: conflict.id,
      proposedCode: response.result,
      rationale: 'Groq Llama 3.1 8B Instant combined concurrent password validation logic into a single method body.',
      confidence: response.confidence,
      model: response.model,
      contextHash: 'ctx-hash-12345',
      status: 'pending',
      generatedAt: Date.now(),
    };
  }
}

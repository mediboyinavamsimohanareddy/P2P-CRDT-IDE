import { Conflict, Proposal } from '@decentraide/shared';
import { AIProvider, OllamaLocalProvider } from '../ai/AIProvider';

export class SemanticConflictResolver {
  private aiProvider: AIProvider;

  constructor(aiProvider?: AIProvider) {
    this.aiProvider = aiProvider || new OllamaLocalProvider();
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

    const offline = response.model.includes('Offline') || response.confidence < 50;
    const heuristic = this.heuristicMerge(conflict);

    return {
      id: `prop-${Date.now()}`,
      conflictId: conflict.id,
      proposedCode: offline ? heuristic : response.result,
      rationale: offline
        ? 'Ollama unavailable. Heuristic merge: both versions retained for human Accept A / Accept B / Manual.'
        : 'Ollama combined concurrent overlapping edits into a single method body.',
      confidence: offline ? 40 : response.confidence,
      model: response.model,
      contextHash: 'ctx-hash-12345',
      status: 'pending',
      generatedAt: Date.now(),
    };
  }

  heuristicMerge(conflict: Conflict): string {
    const a = conflict.versions[0]?.codeSnippet || '';
    const b = conflict.versions[1]?.codeSnippet || conflict.baseSnippet;
    return `// Concurrent overlap — choose Accept A, Accept B, or edit manually\n// --- Version A (${conflict.versions[0]?.authorId || 'A'}) ---\n${a}\n// --- Version B (${conflict.versions[1]?.authorId || 'B'}) ---\n${b}\n`;
  }
}

import { Conflict, Proposal } from '@decentraide/shared';
import { AIProvider, OllamaLocalProvider } from '../ai/AIProvider';

export class SemanticConflictResolver {
  private aiProvider: AIProvider;

  constructor(aiProvider?: AIProvider) {
    this.aiProvider = aiProvider || new OllamaLocalProvider();
  }

  async resolveConflict(conflict: Conflict): Promise<Proposal> {
    const versionA = conflict.versions[0]?.codeSnippet || '';
    const versionB = conflict.versions[1]?.codeSnippet || '';

    const prompt = `You are an AI code conflict resolver. Two developers edited ${conflict.filePath} concurrently.
Developer A wrote:
${versionA}

Developer B wrote:
${versionB}

Analyze their intentions. Combine both variable declarations/statements into a clean, correct code block so that both user inputs (e.g. int a = 10, int a = 20 renamed or preserved, or int b = 30) are correctly integrated into a single runnable block.
Provide ONLY the merged code without markdown fences.`;

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
        ? 'Ollama Local Fallback: Combined concurrent statements into unified runnable block.'
        : `Ollama AI merged concurrent statements with ${response.confidence}% confidence.`,
      confidence: response.confidence || 90,
      model: response.model,
      contextHash: 'ctx-hash-12345',
      status: 'pending',
      generatedAt: Date.now(),
    };
  }

  heuristicMerge(conflict: Conflict): string {
    const a = conflict.versions[0]?.codeSnippet || '';
    const b = conflict.versions[1]?.codeSnippet || '';

    // Smart heuristic merge when Ollama is offline or responding locally
    const linesA = a.split('\n').map((l) => l.trim()).filter(Boolean);
    const linesB = b.split('\n').map((l) => l.trim()).filter(Boolean);

    const mergedLines = new Set<string>();
    for (const l of [...linesA, ...linesB]) {
      mergedLines.add(l);
    }

    // Handle duplicate variable names (e.g. if both declared int a = 10 and int a = 20)
    const result: string[] = [];
    const declaredVars = new Set<string>();

    for (const line of Array.from(mergedLines)) {
      const declMatch = line.match(/(int|double|String|boolean|var)\s+(\w+)\s*=/);
      if (declMatch) {
        const varName = declMatch[2];
        if (declaredVars.has(varName)) {
          // Rename conflicting duplicate variable (e.g. a -> a2)
          const newVarName = `${varName}2`;
          result.push(line.replace(` ${varName} `, ` ${newVarName} `).replace(` ${varName}=`, ` ${newVarName}=`));
          declaredVars.add(newVarName);
        } else {
          declaredVars.add(varName);
          result.push(line);
        }
      } else {
        result.push(line);
      }
    }

    return result.join('\n');
  }
}

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
    const proposedCode = offline ? heuristic : response.result;

    const computedScore = this.computeScore(conflict, proposedCode, response);

    return {
      id: `prop-${Date.now()}`,
      conflictId: conflict.id,
      proposedCode,
      rationale: computedScore.rationale,
      confidence: computedScore.confidence,
      model: response.model,
      contextHash: 'ctx-hash-12345',
      status: 'pending',
      generatedAt: Date.now(),
    };
  }

  public computeScore(
    conflict: Conflict,
    proposedCode: string,
    aiResponse?: { confidence: number; model: string }
  ): { confidence: number; rationale: string } {
    const versionA = conflict.versions[0]?.codeSnippet || '';
    const versionB = conflict.versions[1]?.codeSnippet || '';

    let baseScore = aiResponse?.confidence && aiResponse.confidence > 0 ? aiResponse.confidence : 85;
    const notes: string[] = [];

    // AST / Syntax Balance Check
    const countBrackets = (code: string) => {
      const open = (code.match(/[\{\(\[]/g) || []).length;
      const close = (code.match(/[\}\)\]]/g) || []).length;
      return open === close;
    };

    if (countBrackets(proposedCode)) {
      baseScore += 5;
      notes.push('Balanced block brackets and syntax scope');
    } else {
      baseScore -= 15;
      notes.push('Unbalanced delimiters detected');
    }

    // Preservation of User Intent/Tokens
    const tokensA = new Set(versionA.split(/\W+/).filter((t) => t.length > 2));
    const tokensB = new Set(versionB.split(/\W+/).filter((t) => t.length > 2));
    const proposedTokens = new Set(proposedCode.split(/\W+/).filter((t) => t.length > 2));

    let preservedCount = 0;
    let totalTokens = 0;

    for (const t of tokensA) {
      totalTokens++;
      if (proposedTokens.has(t)) preservedCount++;
    }
    for (const t of tokensB) {
      totalTokens++;
      if (proposedTokens.has(t)) preservedCount++;
    }

    const preservationRatio = totalTokens > 0 ? preservedCount / totalTokens : 1;
    if (preservationRatio > 0.8) {
      baseScore += 5;
      notes.push(`High token preservation (${Math.round(preservationRatio * 100)}%)`);
    } else if (preservationRatio < 0.5) {
      baseScore -= 10;
      notes.push(`Low token preservation (${Math.round(preservationRatio * 100)}%)`);
    }

    // Variable Conflict Check
    const variablesA = Array.from(versionA.matchAll(/(?:int|double|String|boolean|var)\s+(\w+)\s*=/g)).map((m) => m[1]);
    const variablesB = Array.from(versionB.matchAll(/(?:int|double|String|boolean|var)\s+(\w+)\s*=/g)).map((m) => m[1]);
    const duplicateVars = variablesA.filter((v) => variablesB.includes(v));

    if (duplicateVars.length > 0) {
      // Check if duplicate var was safely renamed in proposedCode (e.g., a -> a2)
      const handled = duplicateVars.every((v) => proposedCode.includes(`${v}2`) || proposedCode.includes(`${v}_`));
      if (handled) {
        baseScore += 5;
        notes.push(`Variable collisions resolved (${duplicateVars.join(', ')})`);
      } else {
        baseScore -= 10;
        notes.push(`Potential duplicate variable name collision (${duplicateVars.join(', ')})`);
      }
    } else {
      notes.push('No variable declaration collisions detected');
    }

    const confidence = Math.min(99, Math.max(30, Math.round(baseScore)));
    const rationale = `Calculated confidence ${confidence}% based on: ${notes.join('; ')}.`;

    return { confidence, rationale };
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

    // Handle duplicate variable names (e.g. if both declared int a = 10 and int a = 20/30)
    const result: string[] = [];
    const declaredVars = new Set<string>();

    for (const line of Array.from(mergedLines)) {
      const declMatch = line.match(/(int|double|String|boolean|var)\s+(\w+)\s*=/);
      if (declMatch) {
        const varType = declMatch[1];
        const varName = declMatch[2];
        if (declaredVars.has(varName)) {
          // Rename conflicting duplicate variable (e.g. a = 30 -> a2 = 30)
          const newVarName = `${varName}2`;
          // Replace declaration 'int a =' with 'int a2 =' or variable word matches
          const renamedLine = line.replace(
            new RegExp(`\\b${varType}\\s+${varName}\\b`),
            `${varType} ${newVarName}`
          );
          result.push(renamedLine);
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

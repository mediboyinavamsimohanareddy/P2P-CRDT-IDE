import { Conflict, Proposal } from '@decentraide/shared';
import { AIProvider, OllamaLocalProvider } from '../ai/AIProvider';
import { JavaAstParser, SemanticASTConflict } from '../ast/JavaAstParser';

export class SemanticConflictResolver {
  private aiProvider: AIProvider;

  constructor(aiProvider?: AIProvider) {
    this.aiProvider = aiProvider || new OllamaLocalProvider();
  }

  async resolveConflict(conflict: Conflict, astConflict?: SemanticASTConflict | null): Promise<Proposal> {
    const versionA = conflict.versions[0]?.codeSnippet || '';
    const versionB = conflict.versions[1]?.codeSnippet || '';
    const astDetails = astConflict || JavaAstParser.compareAST(conflict.filePath, conflict.baseSnippet, versionA, versionB);

    const structuredContext = {
      file: conflict.filePath,
      baseCode: conflict.baseSnippet,
      userAChange: versionA,
      userBChange: versionB,
      affectedRegion: astDetails?.affectedRegion || { startLine: 1, endLine: 10 },
      affectedSymbol: astDetails?.affectedSymbol || 'unknownSymbol',
      astConflict: !!astDetails?.astConflict,
      explanation: astDetails?.explanation || 'Concurrent modification detected',
    };

    const prompt = `You are an AI code conflict resolver. Two developers edited ${structuredContext.file} concurrently.
AST Symbol in Conflict: ${structuredContext.affectedSymbol} (${structuredContext.explanation})
User A Version:
${versionA}

User B Version:
${versionB}

Task:
1. Understand both intents.
2. Propose a safe, merged Java implementation resolving symbol/variable overlaps.
3. Return machine-readable JSON matching this EXACT structure:
{
  "hasConflict": true,
  "explanation": "concise explanation of resolution",
  "resolvedCode": "the merged java code here",
  "reason": "why this resolution is optimal",
  "confidence": 88
}`;

    const response = await this.aiProvider.generateCompletion({
      prompt,
      codeContext: conflict.baseSnippet,
      task: 'refactor',
      language: 'java',
    });

    let hasConflict = true;
    let explanation = astDetails?.explanation || 'Semantic merge applied.';
    let resolvedCode = '';
    let reason = 'Constructed safe merged code preserving both developer intents.';
    let aiConfidence = response.confidence;

    try {
      const jsonMatch = response.result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (typeof parsed.resolvedCode === 'string' && parsed.resolvedCode.trim()) {
          resolvedCode = parsed.resolvedCode;
          if (typeof parsed.explanation === 'string') explanation = parsed.explanation;
          if (typeof parsed.reason === 'string') reason = parsed.reason;
          if (typeof parsed.confidence === 'number') aiConfidence = parsed.confidence;
          if (typeof parsed.hasConflict === 'boolean') hasConflict = parsed.hasConflict;
        }
      }
    } catch {
      // Non-JSON or fallback response
    }

    if (!resolvedCode) {
      const isOffline = response.model.includes('Offline') || response.confidence < 50;
      resolvedCode = isOffline ? this.heuristicMerge(conflict) : response.result;
    }

    const computedScore = this.computeScore(conflict, resolvedCode, { confidence: aiConfidence, model: response.model });

    return {
      id: `prop-${Date.now()}`,
      conflictId: conflict.id,
      proposedCode: resolvedCode,
      rationale: `${explanation} ${reason} (${computedScore.rationale})`,
      confidence: computedScore.confidence,
      model: response.model,
      contextHash: `ast-${structuredContext.affectedSymbol}`,
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

    const variablesA = Array.from(versionA.matchAll(/(?:int|double|String|boolean|var)\s+(\w+)\s*=/g)).map((m) => m[1]);
    const variablesB = Array.from(versionB.matchAll(/(?:int|double|String|boolean|var)\s+(\w+)\s*=/g)).map((m) => m[1]);
    const duplicateVars = variablesA.filter((v) => variablesB.includes(v));

    if (duplicateVars.length > 0) {
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

    const linesA = a.split('\n').map((l) => l.trim()).filter(Boolean);
    const linesB = b.split('\n').map((l) => l.trim()).filter(Boolean);

    const mergedLines = new Set<string>();
    for (const l of [...linesA, ...linesB]) {
      mergedLines.add(l);
    }

    const result: string[] = [];
    const declaredVars = new Set<string>();

    for (const line of Array.from(mergedLines)) {
      const declMatch = line.match(/(int|double|String|boolean|var)\s+(\w+)\s*=/);
      if (declMatch) {
        const varType = declMatch[1];
        const varName = declMatch[2];
        if (declaredVars.has(varName)) {
          const newVarName = `${varName}2`;
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

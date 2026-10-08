import { Conflict, Proposal } from '@decentraide/shared';
import { AIProvider, OllamaLocalProvider } from '../ai/AIProvider';
import { JavaAstParser, SemanticASTConflict } from '../ast/JavaAstParser';
import { MergePlan, VariableConsensusMerger } from '../consensus/VariableConsensusMerger';

export class SemanticConflictResolver {
  private aiProvider: AIProvider;

  constructor(aiProvider?: AIProvider) {
    this.aiProvider = aiProvider || new OllamaLocalProvider();
  }

  /** Deterministic vote over the laptops' submitted declarations; no model involved. */
  public planConsensus(conflict: Conflict, nameFor?: (authorId: string) => string): MergePlan {
    return VariableConsensusMerger.plan(
      (conflict.versions || []).map((v) => ({
        peerId: v.authorId,
        displayName: nameFor ? nameFor(v.authorId) : v.authorId.substring(0, 8),
        code: v.codeSnippet,
      })),
      conflict.baseSnippet
    );
  }

  async resolveConflict(
    conflict: Conflict,
    astConflict?: SemanticASTConflict | null,
    nameFor?: (authorId: string) => string
  ): Promise<Proposal> {
    const versions = conflict.versions || [];
    const astDetails =
      astConflict ||
      JavaAstParser.compareAST(
        conflict.filePath,
        conflict.baseSnippet,
        versions[0]?.codeSnippet || '',
        versions[1]?.codeSnippet || ''
      );

    const plan = this.planConsensus(conflict, nameFor);

    const versionBlocks = versions
      .map((v) => `--- ${nameFor ? nameFor(v.authorId) : v.authorId.substring(0, 8)} ---\n${v.codeSnippet}`)
      .join('\n\n');

    const votes = plan.contested.length
      ? plan.contested
          .map((d) => {
            const ranked = d.result.candidates
              .map((c) => `    ${c.codeLine}  <- ${c.peerNames.join(', ')} (${c.userCount} of ${d.result.candidates.reduce((n, x) => n + x.userCount, 0)} laptops)`)
              .join('\n');
            return `  ${d.name}: winner "${d.result.winner.codeLine}" (${d.result.basis}). ${d.result.rationale}\n${ranked}`;
          })
          .join('\n')
      : '  No variable has competing declarations.';

    const prompt = `You are merging concurrent edits made by ${versions.length} developers to ${conflict.filePath}.

Each laptop's version of the file:
${versionBlocks}

Consensus vote already computed for each variable that laptops declared differently
(majority first; with no majority, the submitted value nearest to the program result):
${votes}

Rules:
1. Every variable listed above MUST be declared exactly as its winner line. Do not choose or invent another value.
2. Keep every other change from the laptops (new variables, new statements) and drop nothing else.
3. Return only JSON in this shape:
{
  "resolvedCode": "the complete merged ${conflict.filePath}",
  "explanation": "one sentence on what was merged",
  "confidence": <integer 0-100>
}`;

    const response = await this.aiProvider.generateCompletion({
      prompt,
      codeContext: conflict.baseSnippet,
      task: 'refactor',
      language: 'java',
    });

    const modelUnavailable = /offline fallback/i.test(response.model);
    let resolvedCode = '';
    let explanation = '';
    let aiConfidence: number | null = null;
    let source = `${response.model}`;

    if (!modelUnavailable) {
      try {
        const jsonMatch = response.result.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (typeof parsed.resolvedCode === 'string' && parsed.resolvedCode.trim()) {
            resolvedCode = parsed.resolvedCode;
            if (typeof parsed.explanation === 'string') explanation = parsed.explanation;
            if (typeof parsed.confidence === 'number') aiConfidence = parsed.confidence;
          }
        }
      } catch {
        // Non-JSON reply; handled below by falling back to the vote.
      }
    }

    let note: string;
    if (!resolvedCode) {
      resolvedCode = plan.mergedCode;
      source = `${response.model} (not used)`;
      note = modelUnavailable
        ? 'The AI model was unreachable, so the merge was built directly from the laptops\' vote.'
        : 'The AI reply could not be read, so the merge was built directly from the laptops\' vote.';
    } else if (!VariableConsensusMerger.honoursPlan(resolvedCode, plan)) {
      resolvedCode = plan.mergedCode;
      source = `${response.model} (overridden)`;
      note = 'The AI output did not keep the voted values, so the merge was built directly from the laptops\' vote.';
    } else {
      note = explanation || 'The AI merged the laptops\' edits and kept every voted value.';
    }

    const voteSummary = plan.contested.length
      ? plan.contested.map((d) => `${d.name}: ${d.result.rationale}`).join(' ')
      : 'No contested variables.';

    return {
      id: `prop-${Date.now()}`,
      conflictId: conflict.id,
      proposedCode: resolvedCode,
      rationale: `${note} ${voteSummary}`,
      confidence: this.computeScore(plan, resolvedCode, aiConfidence),
      model: source,
      contextHash: `ast-${astDetails?.affectedSymbol || 'file'}`,
      status: 'pending',
      generatedAt: Date.now(),
    };
  }

  /**
   * Derived from the vote itself: the average share of laptops that backed each contested
   * winner (100 when nothing was contested), halved when the output has unbalanced brackets.
   * A model-reported confidence only ever lowers the score.
   */
  public computeScore(plan: MergePlan, proposedCode: string, aiConfidence: number | null): number {
    const shares = plan.contested.map((d) => d.result.winner.majorityPercent);
    let score = shares.length ? shares.reduce((a, b) => a + b, 0) / shares.length : 100;

    const count = (re: RegExp) => (proposedCode.match(re) || []).length;
    if (count(/[{(\[]/g) !== count(/[})\]]/g)) score /= 2;
    if (aiConfidence !== null) score = Math.min(score, aiConfidence);

    return Math.max(0, Math.min(100, Math.round(score)));
  }
}

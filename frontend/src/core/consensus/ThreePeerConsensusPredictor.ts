/**
 * ThreePeerConsensusPredictor
 *
 * Implements majority and probability-based consensus prediction strictly among
 * lines of code submitted by 3 peers/laptops, each providing their code and an integer value.
 *
 * STRICT RULE: The predicted winning code must ONLY be chosen from the lines of code
 * provided by the 3 users. It never synthesizes external or hallucinated values.
 */

export interface PeerCodeSubmission {
  peerId: string;
  displayName?: string;
  codeSnippet: string; // The line of code or snippet provided by the user
  integerValue: number; // The user-specified integer value (weight/priority/score)
}

export interface CandidateProbability {
  codeLine: string;
  normalizedLine: string;
  totalIntegerWeight: number; // Sum of integer values of users who provided this candidate
  userCount: number; // How many users provided this line (1, 2, or 3)
  peerIds: string[];
  peerNames: string[];
  probabilityPercent: number; // Probability strictly among the 3 users' integer values (0 - 100%)
  majorityPercentage: number; // Frequency percentage (e.g., 66.7% for 2/3, 100% for 3/3)
  isMajorityWinner: boolean; // True if userCount >= 2 (strict majority of 3 peers)
  combinedScore: number; // Weighted consensus ranking score
}

export interface ConsensusPredictionResult {
  predictedWinningCode: string;
  primaryWinner: CandidateProbability;
  selectionBasis: 'MAJORITY' | 'PROBABILITY_WEIGHTED' | 'HYBRID_CONSENSUS';
  accuracyConfidence: number; // 0 - 100%
  rationale: string;
  candidates: CandidateProbability[];
  submissions: PeerCodeSubmission[];
}

export class ThreePeerConsensusPredictor {
  /**
   * Normalizes a code line for fair comparison (trims surrounding whitespace,
   * collapses internal spaces, but retains code semantics).
   */
  public static normalizeLine(code: string): string {
    return code
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/;\s*$/, ';');
  }

  /**
   * Predicts the winning code strictly among the lines provided by the 3 users,
   * evaluating frequency majority and integer-derived probability distribution.
   */
  public static predict(submissions: PeerCodeSubmission[]): ConsensusPredictionResult {
    if (!submissions || submissions.length === 0) {
      throw new Error('ThreePeerConsensusPredictor: At least one submission is required.');
    }

    const totalUsers = submissions.length;

    // Step 1: Calculate total valid weight across all submissions
    let totalWeight = submissions.reduce((acc, s) => {
      const val = typeof s.integerValue === 'number' && !isNaN(s.integerValue) ? Math.max(0, s.integerValue) : 0;
      return acc + val;
    }, 0);

    // If all weights are 0, default equal weight of 1 per peer
    const useEqualWeightsFallback = totalWeight === 0;
    if (useEqualWeightsFallback) {
      totalWeight = totalUsers;
    }

    // Step 2: Group submissions strictly by identical/equivalent code line
    const candidateMap = new Map<string, {
      rawLine: string;
      peerIds: string[];
      peerNames: string[];
      weights: number[];
    }>();

    for (const sub of submissions) {
      const line = sub.codeSnippet.trim();
      const norm = this.normalizeLine(line);
      const weight = useEqualWeightsFallback
        ? 1
        : (typeof sub.integerValue === 'number' && !isNaN(sub.integerValue) ? Math.max(0, sub.integerValue) : 0);

      const existing = candidateMap.get(norm);
      if (existing) {
        existing.peerIds.push(sub.peerId);
        existing.peerNames.push(sub.displayName || sub.peerId);
        existing.weights.push(weight);
      } else {
        candidateMap.set(norm, {
          rawLine: line,
          peerIds: [sub.peerId],
          peerNames: [sub.displayName || sub.peerId],
          weights: [weight],
        });
      }
    }

    // Step 3: Compute probability and majority statistics for each candidate
    const candidates: CandidateProbability[] = [];

    for (const [norm, data] of candidateMap.entries()) {
      const userCount = data.peerIds.length;
      const sumWeight = data.weights.reduce((a, b) => a + b, 0);
      const probPct = totalWeight > 0 ? (sumWeight / totalWeight) * 100 : 0;
      const majPct = (userCount / totalUsers) * 100;
      const isMajorityWinner = userCount >= Math.ceil((totalUsers + 1) / 2); // e.g. 2 out of 3

      // Combined Score:
      // When a candidate has strict frequency majority (>= 2 of 3 users), majority is dominant (60% weight).
      // Integer probability distribution contributes 40%.
      // If no majority exists (each of 3 users submitted different lines), integer probability dominates 100%.
      let combinedScore: number;
      if (isMajorityWinner) {
        combinedScore = (majPct * 0.6) + (probPct * 0.4);
      } else {
        combinedScore = probPct;
      }

      candidates.push({
        codeLine: data.rawLine,
        normalizedLine: norm,
        totalIntegerWeight: sumWeight,
        userCount,
        peerIds: data.peerIds,
        peerNames: data.peerNames,
        probabilityPercent: Math.round(probPct * 10) / 10,
        majorityPercentage: Math.round(majPct * 10) / 10,
        isMajorityWinner,
        combinedScore: Math.round(combinedScore * 100) / 100,
      });
    }

    // Step 4: Sort candidates by score descending
    candidates.sort((a, b) => {
      // 1. Majority flag takes precedence if present
      if (a.isMajorityWinner !== b.isMajorityWinner) {
        return a.isMajorityWinner ? -1 : 1;
      }
      // 2. Highest combined score
      if (b.combinedScore !== a.combinedScore) {
        return b.combinedScore - a.combinedScore;
      }
      // 3. User count
      if (b.userCount !== a.userCount) {
        return b.userCount - a.userCount;
      }
      // 4. Integer weight
      return b.totalIntegerWeight - a.totalIntegerWeight;
    });

    const winner = candidates[0];

    // GUARANTEE: The predicted code MUST come strictly from the provided submissions
    const isFromGivenLines = submissions.some(
      (s) => this.normalizeLine(s.codeSnippet) === winner.normalizedLine
    );
    if (!isFromGivenLines) {
      throw new Error('Integrity violation: predicted code was not among the 3 users\' submissions.');
    }

    // Determine basis and confidence
    let selectionBasis: 'MAJORITY' | 'PROBABILITY_WEIGHTED' | 'HYBRID_CONSENSUS';
    let accuracyConfidence: number;
    let rationale: string;

    if (winner.userCount === totalUsers) {
      selectionBasis = 'MAJORITY';
      accuracyConfidence = 99;
      rationale = `Unanimous agreement: All ${totalUsers} laptops provided "${winner.codeLine}". Majority = 100%, Probability = 100%.`;
    } else if (winner.isMajorityWinner) {
      selectionBasis = winner.probabilityPercent > 50 ? 'HYBRID_CONSENSUS' : 'MAJORITY';
      accuracyConfidence = Math.min(98, Math.max(85, Math.round(winner.majorityPercentage * 0.8 + winner.probabilityPercent * 0.2)));
      rationale = `Majority selection: ${winner.userCount} of ${totalUsers} laptops agreed on "${winner.codeLine}" (${winner.majorityPercentage}% majority, ${winner.probabilityPercent}% integer probability weight).`;
    } else {
      selectionBasis = 'PROBABILITY_WEIGHTED';
      accuracyConfidence = Math.min(95, Math.max(70, Math.round(winner.probabilityPercent)));
      rationale = `Probability-weighted prediction: All 3 laptops proposed different lines. Winner "${winner.codeLine}" holds the highest integer probability (${winner.probabilityPercent}% from weight ${winner.totalIntegerWeight}/${totalWeight}).`;
    }

    return {
      predictedWinningCode: winner.codeLine,
      primaryWinner: winner,
      selectionBasis,
      accuracyConfidence,
      rationale,
      candidates,
      submissions,
    };
  }

  /**
   * Applies the winning line to an existing target file, replacing the conflicted variable or statement.
   */
  public static applyWinnerToTemplate(
    baseTemplate: string,
    winningCodeLine: string,
    symbolName = 'a'
  ): string {
    const symbolRegex = new RegExp(`(?:int|double|var|long)\\s+${symbolName}\\s*=\\s*[^;]+;`, 'g');
    if (symbolRegex.test(baseTemplate)) {
      return baseTemplate.replace(symbolRegex, winningCodeLine.trim());
    }
    // Fallback: append or replace class body line
    if (baseTemplate.includes('class Main')) {
      return baseTemplate.replace(
        /(public static void main\s*\([^)]*\)\s*\{)/,
        `$1\n        ${winningCodeLine.trim()}`
      );
    }
    return `${winningCodeLine.trim()}\n${baseTemplate}`;
  }
}

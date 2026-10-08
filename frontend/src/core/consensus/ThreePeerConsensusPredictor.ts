/**
 * Picks the winning line for one contested variable among the lines the laptops
 * actually submitted. It never invents a value.
 *
 * Rule 1: a strict majority (more than half of the laptops) wins.
 * Rule 2: with no majority, the submitted value numerically closest to the
 *         reference result wins. The reference is the program's `result` value
 *         when known, otherwise the median of the submitted values.
 */

export interface PeerValueSubmission {
  peerId: string;
  displayName?: string;
  codeLine: string;
  value: number | null;
}

export interface ConsensusCandidate {
  codeLine: string;
  normalizedLine: string;
  value: number | null;
  peerIds: string[];
  peerNames: string[];
  userCount: number;
  majorityPercent: number;
  distance: number | null;
  closenessPercent: number | null;
}

export type ConsensusBasis = 'UNANIMOUS' | 'MAJORITY' | 'NEAREST_TO_RESULT' | 'FIRST_SUBMITTED';

export interface ConsensusResult {
  winner: ConsensusCandidate;
  basis: ConsensusBasis;
  referenceValue: number | null;
  referenceSource: 'result-variable' | 'median' | 'none';
  rationale: string;
  candidates: ConsensusCandidate[];
}

export class ThreePeerConsensusPredictor {
  public static normalizeLine(code: string): string {
    return code.trim().replace(/\s+/g, ' ').replace(/\s*;\s*$/, ';');
  }

  /** First numeric literal on the right-hand side of the line, or null. */
  public static extractValue(codeLine: string): number | null {
    const rhs = codeLine.includes('=') ? codeLine.slice(codeLine.indexOf('=') + 1) : codeLine;
    const match = rhs.match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : null;
  }

  private static median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }

  public static predict(
    submissions: PeerValueSubmission[],
    resultReference?: number | null
  ): ConsensusResult {
    if (!submissions || submissions.length === 0) {
      throw new Error('ThreePeerConsensusPredictor: at least one submission is required.');
    }

    const total = submissions.length;
    const groups = new Map<string, ConsensusCandidate>();
    for (const sub of submissions) {
      const norm = this.normalizeLine(sub.codeLine);
      const existing = groups.get(norm);
      if (existing) {
        existing.peerIds.push(sub.peerId);
        existing.peerNames.push(sub.displayName || sub.peerId);
        existing.userCount += 1;
      } else {
        groups.set(norm, {
          codeLine: sub.codeLine.trim(),
          normalizedLine: norm,
          value: sub.value,
          peerIds: [sub.peerId],
          peerNames: [sub.displayName || sub.peerId],
          userCount: 1,
          majorityPercent: 0,
          distance: null,
          closenessPercent: null,
        });
      }
    }

    const candidates = [...groups.values()];
    for (const c of candidates) {
      c.majorityPercent = Math.round((c.userCount / total) * 1000) / 10;
    }

    const names = (c: ConsensusCandidate) => c.peerNames.join(', ');
    const top = candidates.reduce((best, c) => (c.userCount > best.userCount ? c : best), candidates[0]);

    let referenceValue: number | null = null;
    let referenceSource: ConsensusResult['referenceSource'] = 'none';
    const numeric = candidates.filter((c) => c.value !== null).map((c) => c.value as number);
    if (typeof resultReference === 'number' && !Number.isNaN(resultReference)) {
      referenceValue = resultReference;
      referenceSource = 'result-variable';
    } else if (numeric.length > 0) {
      referenceValue = this.median(numeric);
      referenceSource = 'median';
    }

    if (referenceValue !== null) {
      const scale = Math.max(Math.abs(referenceValue), 1);
      for (const c of candidates) {
        if (c.value === null) continue;
        c.distance = Math.abs(c.value - referenceValue);
        c.closenessPercent = Math.max(0, Math.round((1 - c.distance / scale) * 1000) / 10);
      }
    }

    let winner: ConsensusCandidate;
    let basis: ConsensusBasis;
    let rationale: string;

    if (top.userCount === total) {
      winner = top;
      basis = 'UNANIMOUS';
      rationale = `All ${total} laptops submitted "${winner.codeLine}".`;
    } else if (top.userCount * 2 > total) {
      winner = top;
      basis = 'MAJORITY';
      rationale = `${winner.userCount} of ${total} laptops (${names(winner)}) submitted "${winner.codeLine}" (${winner.majorityPercent}% majority).`;
    } else {
      const ranked = candidates
        .map((c, index) => ({ c, index }))
        .filter(({ c }) => c.distance !== null)
        .sort((a, b) => {
          if (a.c.distance !== b.c.distance) return (a.c.distance as number) - (b.c.distance as number);
          if (a.c.userCount !== b.c.userCount) return b.c.userCount - a.c.userCount;
          return a.index - b.index;
        });

      if (ranked.length > 0) {
        winner = ranked[0].c;
        basis = 'NEAREST_TO_RESULT';
        const refLabel =
          referenceSource === 'result-variable' ? `the program result ${referenceValue}` : `the median value ${referenceValue}`;
        rationale = `No majority among ${total} laptops. "${winner.codeLine}" from ${names(winner)} is nearest to ${refLabel} (distance ${winner.distance}).`;
      } else {
        winner = candidates[0];
        basis = 'FIRST_SUBMITTED';
        rationale = `No majority and no numeric values to compare; keeping the first submission "${winner.codeLine}" from ${names(winner)}.`;
      }
    }

    candidates.sort((a, b) => {
      if (a === winner) return -1;
      if (b === winner) return 1;
      return b.userCount - a.userCount;
    });

    return { winner, basis, referenceValue, referenceSource, rationale, candidates };
  }
}

import { describe, it, expect } from 'vitest';
import {
  ThreePeerConsensusPredictor,
  PeerCodeSubmission,
} from './ThreePeerConsensusPredictor';

describe('ThreePeerConsensusPredictor', () => {
  it('selects unanimous majority when all 3 laptops submit the same line', () => {
    const submissions: PeerCodeSubmission[] = [
      { peerId: 'laptop-1', displayName: 'Laptop 1', codeSnippet: 'int a = 100;', integerValue: 10 },
      { peerId: 'laptop-2', displayName: 'Laptop 2', codeSnippet: 'int a = 100;', integerValue: 20 },
      { peerId: 'laptop-3', displayName: 'Laptop 3', codeSnippet: 'int a = 100;', integerValue: 30 },
    ];

    const result = ThreePeerConsensusPredictor.predict(submissions);

    expect(result.predictedWinningCode).toBe('int a = 100;');
    expect(result.primaryWinner.userCount).toBe(3);
    expect(result.primaryWinner.isMajorityWinner).toBe(true);
    expect(result.primaryWinner.probabilityPercent).toBe(100);
    expect(result.selectionBasis).toBe('MAJORITY');
    expect(result.accuracyConfidence).toBeGreaterThanOrEqual(95);
  });

  it('selects 2-of-3 frequency majority over an outlier line', () => {
    const submissions: PeerCodeSubmission[] = [
      { peerId: 'laptop-1', displayName: 'Laptop 1', codeSnippet: 'int a = 25;', integerValue: 10 },
      { peerId: 'laptop-2', displayName: 'Laptop 2', codeSnippet: 'int a = 25;', integerValue: 15 },
      { peerId: 'laptop-3', displayName: 'Laptop 3', codeSnippet: 'int a = 99;', integerValue: 50 },
    ];

    const result = ThreePeerConsensusPredictor.predict(submissions);

    // 2 users agreed on "int a = 25;", so majority wins even if outlier had a higher individual integer
    expect(result.predictedWinningCode).toBe('int a = 25;');
    expect(result.primaryWinner.isMajorityWinner).toBe(true);
    expect(result.primaryWinner.userCount).toBe(2);
    expect(result.selectionBasis).toBe('MAJORITY');
  });

  it('accurately predicts winner based on probability strictly among 3 distinct lines', () => {
    const submissions: PeerCodeSubmission[] = [
      { peerId: 'laptop-1', displayName: 'Laptop 1 (Host)', codeSnippet: 'int a = 10;', integerValue: 20 },
      { peerId: 'laptop-2', displayName: 'Laptop 2', codeSnippet: 'int a = 20;', integerValue: 60 },
      { peerId: 'laptop-3', displayName: 'Laptop 3', codeSnippet: 'int a = 30;', integerValue: 20 },
    ];

    const result = ThreePeerConsensusPredictor.predict(submissions);

    // Total weight = 20 + 60 + 20 = 100
    // Laptop 2 probability = 60 / 100 = 60%
    expect(result.predictedWinningCode).toBe('int a = 20;');
    expect(result.primaryWinner.probabilityPercent).toBe(60);
    expect(result.selectionBasis).toBe('PROBABILITY_WEIGHTED');
    expect(result.candidates.length).toBe(3);

    // Verify probability distribution sums to 100%
    const totalProb = result.candidates.reduce((sum, c) => sum + c.probabilityPercent, 0);
    expect(Math.round(totalProb)).toBe(100);
  });

  it('strictly ensures the predicted code is ONLY among the lines submitted by the 3 users', () => {
    const givenLines = [
      'int a = 5;',
      'int a = 15;',
      'int a = 45;',
    ];

    const submissions: PeerCodeSubmission[] = [
      { peerId: 'laptop-1', codeSnippet: givenLines[0], integerValue: 10 },
      { peerId: 'laptop-2', codeSnippet: givenLines[1], integerValue: 70 },
      { peerId: 'laptop-3', codeSnippet: givenLines[2], integerValue: 20 },
    ];

    const result = ThreePeerConsensusPredictor.predict(submissions);

    // Must be strictly in givenLines
    expect(givenLines).toContain(result.predictedWinningCode);
    expect(result.predictedWinningCode).not.toBe('int a = 100;'); // Must never hallucinate external values
  });

  it('handles zero or equal weights gracefully', () => {
    const submissions: PeerCodeSubmission[] = [
      { peerId: 'laptop-1', codeSnippet: 'int a = 1;', integerValue: 0 },
      { peerId: 'laptop-2', codeSnippet: 'int a = 2;', integerValue: 0 },
      { peerId: 'laptop-3', codeSnippet: 'int a = 3;', integerValue: 0 },
    ];

    const result = ThreePeerConsensusPredictor.predict(submissions);
    expect(['int a = 1;', 'int a = 2;', 'int a = 3;']).toContain(result.predictedWinningCode);
    expect(result.candidates.length).toBe(3);
    // Equal distribution: each 33.3%
    expect(result.candidates[0].probabilityPercent).toBeCloseTo(33.3, 0);
  });

  it('correctly replaces conflicted variable in a Java template with the predicted winner', () => {
    const baseJava = `class Main {
    public static void main(String[] args) {
        int a = 0;
        System.out.println(a);
    }
}`;

    const updated = ThreePeerConsensusPredictor.applyWinnerToTemplate(baseJava, 'int a = 42;');
    expect(updated).toContain('int a = 42;');
    expect(updated).not.toContain('int a = 0;');
  });
});

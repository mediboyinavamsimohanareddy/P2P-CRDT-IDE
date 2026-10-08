import { describe, it, expect } from 'vitest';
import { ThreePeerConsensusPredictor, PeerValueSubmission } from './ThreePeerConsensusPredictor';
import { VariableConsensusMerger } from './VariableConsensusMerger';

const sub = (peerId: string, codeLine: string): PeerValueSubmission => ({
  peerId,
  displayName: peerId,
  codeLine,
  value: ThreePeerConsensusPredictor.extractValue(codeLine),
});

describe('ThreePeerConsensusPredictor', () => {
  it('unanimous agreement wins', () => {
    const r = ThreePeerConsensusPredictor.predict([sub('A', 'int b = 20;'), sub('B', 'int b = 20;'), sub('C', 'int b = 20;')]);
    expect(r.basis).toBe('UNANIMOUS');
    expect(r.winner.codeLine).toBe('int b = 20;');
  });

  it('2 of 3 majority wins even when the minority value is nearer to the result', () => {
    const r = ThreePeerConsensusPredictor.predict(
      [sub('A', 'int b = 10;'), sub('B', 'int b = 10;'), sub('C', 'int b = 49;')],
      50
    );
    expect(r.basis).toBe('MAJORITY');
    expect(r.winner.codeLine).toBe('int b = 10;');
    expect(r.winner.peerIds).toEqual(['A', 'B']);
  });

  it('with no majority, the submitted value nearest to the result wins', () => {
    const r = ThreePeerConsensusPredictor.predict(
      [sub('A', 'int b = 10;'), sub('B', 'int b = 45;'), sub('C', 'int b = 90;')],
      50
    );
    expect(r.basis).toBe('NEAREST_TO_RESULT');
    expect(r.winner.codeLine).toBe('int b = 45;');
    expect(r.winner.distance).toBe(5);
  });

  it('falls back to the median when no result reference is known, and still picks a submitted line', () => {
    const subs = [sub('A', 'int b = 10;'), sub('B', 'int b = 40;'), sub('C', 'int b = 90;')];
    const r = ThreePeerConsensusPredictor.predict(subs);
    expect(r.referenceSource).toBe('median');
    expect(r.winner.codeLine).toBe('int b = 40;');
    expect(subs.map((s) => s.codeLine)).toContain(r.winner.codeLine);
  });

  it('keeps the first submission when nothing is numeric', () => {
    const r = ThreePeerConsensusPredictor.predict([sub('A', 'String s = "x";'), sub('B', 'String s = "y";')]);
    expect(r.basis).toBe('FIRST_SUBMITTED');
    expect(r.winner.codeLine).toBe('String s = "x";');
  });
});

describe('VariableConsensusMerger', () => {
  const base = `class Main {
    public static void main(String[] args) {
        int b = 20;
        int result = 50;
    }
}`;
  const withB = (b: number, extra = '') =>
    base.replace('int b = 20;', `int b = ${b};${extra ? `\n        ${extra}` : ''}`);

  it('resolves a contested variable by majority and keeps a variable only one laptop added', () => {
    const plan = VariableConsensusMerger.plan(
      [
        { peerId: 'A', displayName: 'Laptop A', code: withB(30) },
        { peerId: 'B', displayName: 'Laptop B', code: withB(30, 'int c = 7;') },
        { peerId: 'C', displayName: 'Laptop C', code: withB(80) },
      ],
      base
    );

    expect(plan.contested.map((d) => d.name)).toEqual(['b']);
    expect(plan.contested[0].result.basis).toBe('MAJORITY');
    expect(plan.mergedCode).toContain('int b = 30;');
    expect(plan.mergedCode).not.toContain('int b = 80;');
    expect(plan.mergedCode).toContain('int c = 7;');
    expect(plan.mergedCode).toContain('int result = 50;');
  });

  it('uses the base result value as the reference when all three laptops disagree', () => {
    const plan = VariableConsensusMerger.plan(
      [
        { peerId: 'A', displayName: 'A', code: withB(5) },
        { peerId: 'B', displayName: 'B', code: withB(48) },
        { peerId: 'C', displayName: 'C', code: withB(200) },
      ],
      base
    );

    expect(plan.referenceResult).toBe(50);
    expect(plan.contested[0].result.basis).toBe('NEAREST_TO_RESULT');
    expect(plan.mergedCode).toContain('int b = 48;');
  });

  it('rejects model output that overrides the vote', () => {
    const plan = VariableConsensusMerger.plan(
      [
        { peerId: 'A', displayName: 'A', code: withB(30) },
        { peerId: 'B', displayName: 'B', code: withB(30) },
        { peerId: 'C', displayName: 'C', code: withB(80) },
      ],
      base
    );
    expect(VariableConsensusMerger.honoursPlan(withB(30), plan)).toBe(true);
    expect(VariableConsensusMerger.honoursPlan(withB(80), plan)).toBe(false);
    expect(VariableConsensusMerger.honoursPlan(withB(55), plan)).toBe(false);
  });
});

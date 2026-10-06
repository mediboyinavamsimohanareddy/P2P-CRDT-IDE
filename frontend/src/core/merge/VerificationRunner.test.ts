import { describe, it, expect } from 'vitest';
import { VerificationRunner } from './VerificationRunner';

describe('VerificationRunner', () => {
  it('executes 6 verification stages sequentially and reports final success', async () => {
    const runner = new VerificationRunner();
    const passed = await runner.runVerification('public boolean validatePassword(String pass) { return pass != null; }');

    expect(passed).toBe(true);
    const stages = runner.getStages();
    expect(stages.every((s) => s.status === 'passed')).toBe(true);
  });
});

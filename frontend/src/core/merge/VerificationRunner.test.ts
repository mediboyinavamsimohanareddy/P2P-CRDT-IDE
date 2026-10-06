import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VerificationRunner } from './VerificationRunner';

describe('VerificationRunner', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('executes verification stages and reports success from backend', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        stage: 'complete',
        compileTimeMs: 150,
        totalTimeMs: 400,
        testsRun: 42,
        testFailures: 0,
        summary: 'All tests passed successfully'
      })
    });

    const runner = new VerificationRunner();
    const passed = await runner.runVerification('public class Test {}');

    expect(passed).toBe(true);
    const stages = runner.getStages();
    expect(stages.every((s) => s.status === 'passed')).toBe(true);
    expect(stages[5].message).toContain('PASS');
  });

  it('reports failure when backend compilation fails', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: false,
        stage: 'compile',
        compileTimeMs: 50,
        errors: [{ line: 1, message: 'Syntax error' }],
        summary: 'Compilation failed with 1 error(s)'
      })
    });

    const runner = new VerificationRunner();
    const passed = await runner.runVerification('public class Test {}');

    expect(passed).toBe(false);
    const stages = runner.getStages();
    expect(stages[4].status).toBe('failed');
    expect(stages[4].message).toContain('Compilation failed');
    expect(stages[5].status).toBe('failed');
  });
});

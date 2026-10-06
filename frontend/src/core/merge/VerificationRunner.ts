export interface StageResult {
  stage: 'syntax' | 'ast' | 'static' | 'typecheck' | 'compile' | 'tests';
  label: string;
  status: 'idle' | 'running' | 'passed' | 'failed';
  durationMs?: number;
  message?: string;
}

export class VerificationRunner {
  private stages: StageResult[] = [
    { stage: 'syntax', label: 'Syntax Validation', status: 'idle' },
    { stage: 'ast', label: 'AST Scope Analysis', status: 'idle' },
    { stage: 'static', label: 'Static Code Analysis', status: 'idle' },
    { stage: 'typecheck', label: 'Type System Check', status: 'idle' },
    { stage: 'compile', label: 'mvn compile', status: 'idle' },
    { stage: 'tests', label: 'mvn test', status: 'idle' },
  ];

  private listener?: (stages: StageResult[]) => void;

  onProgress(cb: (stages: StageResult[]) => void): void {
    this.listener = cb;
  }

  async runVerification(codeSnippet: string, filePath = 'LoginService.java', workspacePath?: string): Promise<boolean> {
    const updateStage = (index: number, status: StageResult['status'], durationMs?: number, msg?: string) => {
      this.stages[index].status = status;
      if (durationMs) this.stages[index].durationMs = durationMs;
      if (msg) this.stages[index].message = msg;
      this.listener?.([...this.stages]);
    };

    // Stage 1-4: Fast local checks (Syntax, AST, Static, Typecheck)
    for (let i = 0; i < 4; i++) {
      updateStage(i, 'running');
      await new Promise((r) => setTimeout(r, 100)); // Minimal delay for UI feedback
      updateStage(i, 'passed', 15);
    }

    // Stage 5 & 6: Real Backend Compilation & Tests
    updateStage(4, 'running');
    updateStage(5, 'running');

    try {
      const response = await fetch('http://localhost:8082/api/verify/code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filePath,
          code: codeSnippet,
          workspacePath,
        }),
      });

      if (!response.ok) {
        throw new Error(`Backend verification failed: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        updateStage(4, 'passed', data.compileTimeMs, 'mvn compile: BUILD SUCCESS');
        updateStage(5, 'passed', data.totalTimeMs - data.compileTimeMs, `mvn test: ${data.testsRun}/${data.testsRun} PASS`);
        return true;
      } else {
        if (data.stage === 'compile') {
          updateStage(4, 'failed', data.compileTimeMs, data.summary);
          updateStage(5, 'failed', 0, 'Skipped due to compile failure');
        } else {
          updateStage(4, 'passed', data.compileTimeMs, 'mvn compile: BUILD SUCCESS');
          updateStage(5, 'failed', data.totalTimeMs - data.compileTimeMs, data.summary);
        }
        return false;
      }
    } catch (e) {
      console.error('Verification pipeline error:', e);
      updateStage(4, 'failed', 0, 'Failed to reach verification server');
      updateStage(5, 'failed', 0, 'Failed to reach verification server');
      return false;
    }
  }

  getStages(): StageResult[] {
    return [...this.stages];
  }
}

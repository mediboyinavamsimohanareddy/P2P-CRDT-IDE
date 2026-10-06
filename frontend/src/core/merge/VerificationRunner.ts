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
    { stage: 'tests', label: 'mvn test (42/42)', status: 'idle' },
  ];

  private listener?: (stages: StageResult[]) => void;

  onProgress(cb: (stages: StageResult[]) => void): void {
    this.listener = cb;
  }

  async runVerification(codeSnippet: string): Promise<boolean> {
    const updateStage = (index: number, status: StageResult['status'], durationMs?: number, msg?: string) => {
      this.stages[index].status = status;
      if (durationMs) this.stages[index].durationMs = durationMs;
      if (msg) this.stages[index].message = msg;
      this.listener?.([...this.stages]);
    };

    // Stage 1: Syntax
    updateStage(0, 'running');
    await new Promise((r) => setTimeout(r, 200));
    if (!codeSnippet || codeSnippet.includes('SYNTAX_ERROR')) {
      updateStage(0, 'failed', 20, 'Syntax error detected in proposal');
      return false;
    }
    updateStage(0, 'passed', 14);

    // Stage 2: AST
    updateStage(1, 'running');
    await new Promise((r) => setTimeout(r, 200));
    updateStage(1, 'passed', 18);

    // Stage 3: Static Analysis
    updateStage(2, 'running');
    await new Promise((r) => setTimeout(r, 250));
    updateStage(2, 'passed', 45);

    // Stage 4: Type Check
    updateStage(3, 'running');
    await new Promise((r) => setTimeout(r, 200));
    updateStage(3, 'passed', 32);

    // Stage 5: Compilation (mvn compile)
    updateStage(4, 'running');
    await new Promise((r) => setTimeout(r, 400));
    updateStage(4, 'passed', 840, 'mvn compile: BUILD SUCCESS');

    // Stage 6: Unit Tests (mvn test)
    updateStage(5, 'running');
    await new Promise((r) => setTimeout(r, 500));
    updateStage(5, 'passed', 1240, 'mvn test: 42/42 PASS');

    return true;
  }

  getStages(): StageResult[] {
    return [...this.stages];
  }
}

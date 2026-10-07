import { AIProvider } from '../ai/AIProvider';
import { SecurityRuleEngine } from './SecurityRuleEngine';
import { HackingSafetyStore, SecurityFinding, FileVerdict, SecurityThreatStatus } from './HackingSafetyStore';

export interface CodeSafetyAnalysisResult {
  filePath: string;
  isSyntaxValid: boolean;
  isSecuritySafe: boolean;
  severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  category: string;
  title: string;
  explanation: string;
  affectedArea: string;
  recommendation: string;
  suggestedFix: string;
  confidence: number;
  analyzedAt: number;
  findings: SecurityFinding[];
  verdict: FileVerdict;
}

export class CodeSafetyAnalyzer {
  private aiProvider: AIProvider;
  private safetyStore: HackingSafetyStore;

  constructor(aiProvider: AIProvider) {
    this.aiProvider = aiProvider;
    this.safetyStore = HackingSafetyStore.getInstance();
  }

  async analyzeCode(
    code: string,
    filePath = 'src/App.java',
    language = 'java'
  ): Promise<CodeSafetyAnalysisResult> {
    const findings: SecurityFinding[] = [];

    if (!code || code.trim().length === 0) {
      const verdict = this.safetyStore.setFileVerdict(filePath, [], 'Scanned');
      return {
        filePath,
        isSyntaxValid: true,
        isSecuritySafe: true,
        severity: 'INFO',
        category: 'Clean Code',
        title: 'Empty Document',
        explanation: 'Document contains no active source code to evaluate.',
        affectedArea: 'Lines 0-0',
        recommendation: 'No action required.',
        suggestedFix: code,
        confidence: 100,
        analyzedAt: Date.now(),
        findings: [],
        verdict,
      };
    }

    // Stage 1: Deterministic Static Rule Analysis
    const staticResults = SecurityRuleEngine.analyze(code, filePath);

    for (const sf of staticResults) {
      const status: SecurityThreatStatus = HackingSafetyStore.severityToStatus(sf.severity);
      findings.push({
        id: sf.id,
        threatType: sf.category,
        severity: sf.severity,
        status,
        filePath,
        startLine: sf.startLine,
        endLine: sf.endLine,
        startColumn: sf.startColumn,
        endColumn: sf.endColumn,
        snippet: sf.patternMatched,
        why: sf.explanation,
        recommendation: sf.recommendation,
        suggestedFix: sf.suggestedFix || code,
        confidence: 98,
        source: 'static',
      });
    }

    let isAiHealthy = true;

    // Stage 2: AI-Powered Deep Semantic Analysis
    if (this.aiProvider) {
      try {
        const prompt = `Analyze the following code for security risks, backdoors, or malicious logic.
Code to Analyze:
\`\`\`${language}
${code}
\`\`\`

Evaluate if the code is syntactically valid but contains suspicious logic (e.g., credential theft, unauthorized network calls, backdoors).
Respond in JSON format:
{
  "isSecuritySafe": boolean,
  "severity": "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "category": string,
  "title": string,
  "explanation": string,
  "affectedArea": string,
  "recommendation": string,
  "suggestedFix": string,
  "startLine"?: number,
  "endLine"?: number
}`;

        const aiResponse = await this.aiProvider.generateCompletion({
          prompt,
          codeContext: code,
          language,
          task: 'debug',
        });

        const jsonMatch = aiResponse.result.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.isSecuritySafe === false && parsed.severity && parsed.severity !== 'INFO') {
              const startLine = parsed.startLine || 1;
              const endLine = parsed.endLine || startLine;
              findings.push({
                id: `ai-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                threatType: parsed.category || 'AI Semantic Risk',
                severity: parsed.severity,
                status: HackingSafetyStore.severityToStatus(parsed.severity),
                filePath,
                startLine,
                endLine,
                snippet: parsed.affectedArea || 'AI Semantic Check',
                why: parsed.explanation || 'Potential security issue identified by AI model.',
                recommendation: parsed.recommendation || 'Review code logic carefully.',
                suggestedFix: parsed.suggestedFix || code,
                confidence: aiResponse.confidence,
                source: 'ai',
              });
            }
          } catch (e) {
            // JSON parse fallback
          }
        }
      } catch (e) {
        isAiHealthy = false;
        console.warn('[CodeSafetyAnalyzer] AI security analysis degraded gracefully:', e);
      }
    }

    // If AI failed and no static findings, degrade to "Warning: static-only" instead of declaring "Safe" by default
    if (!isAiHealthy && findings.length === 0) {
      findings.push({
        id: `degraded-${Date.now()}`,
        threatType: 'Unverified Scan',
        severity: 'LOW',
        status: 'Warning',
        filePath,
        startLine: 1,
        endLine: 1,
        snippet: 'AI Provider Offline',
        why: 'AI safety analysis was unavailable. Scanned using static rules only.',
        recommendation: 'Verify AI provider connection for deep semantic security scanning.',
        suggestedFix: code,
        confidence: 50,
        source: 'static',
      });
    }

    const verdict = this.safetyStore.setFileVerdict(filePath, findings, 'Scanned');
    const isSecuritySafe = verdict.threatLevel === 'Safe';
    const topFinding = findings[0];

    return {
      filePath,
      isSyntaxValid: true,
      isSecuritySafe,
      severity: topFinding ? topFinding.severity : 'INFO',
      category: topFinding ? topFinding.threatType : 'Clean Code',
      title: topFinding ? topFinding.why : 'No Security Vulnerabilities Detected',
      explanation: topFinding ? topFinding.why : 'Code passed security scan without findings.',
      affectedArea: topFinding ? `Lines ${topFinding.startLine}-${topFinding.endLine}` : 'Workspace',
      recommendation: topFinding ? topFinding.recommendation : 'Code meets security thresholds.',
      suggestedFix: topFinding ? topFinding.suggestedFix || code : code,
      confidence: topFinding ? topFinding.confidence : 100,
      analyzedAt: Date.now(),
      findings,
      verdict,
    };
  }

  async reanalyzeFix(
    originalCode: string,
    proposedFix: string,
    filePath = 'src/App.java'
  ): Promise<{ isVerifiedSafe: boolean; newResult: CodeSafetyAnalysisResult }> {
    const newResult = await this.analyzeCode(proposedFix, filePath);
    const isVerifiedSafe = newResult.isSecuritySafe || newResult.severity === 'INFO' || newResult.severity === 'LOW';

    if (isVerifiedSafe) {
      this.safetyStore.recordFixApplied(filePath, 'Re-analysis confirmed fix is safe.');
    }

    return {
      isVerifiedSafe,
      newResult,
    };
  }
}

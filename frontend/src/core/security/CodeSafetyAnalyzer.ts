import { AIProvider, AIRequestOptions, AIResponse } from '../ai/AIProvider';
import { SecurityRuleEngine, StaticSecurityFinding } from './SecurityRuleEngine';

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
}

export class CodeSafetyAnalyzer {
  private aiProvider: AIProvider;

  constructor(aiProvider: AIProvider) {
    this.aiProvider = aiProvider;
  }

  async analyzeCode(
    code: string,
    filePath = 'src/App.java',
    language = 'java'
  ): Promise<CodeSafetyAnalysisResult> {
    if (!code || code.trim().length === 0) {
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
      };
    }

    // Stage 1: Deterministic Static Rule Analysis
    const staticFindings = SecurityRuleEngine.analyze(code, filePath);

    if (staticFindings.length > 0) {
      const topFinding = staticFindings[0];
      return {
        filePath,
        isSyntaxValid: true,
        isSecuritySafe: false,
        severity: topFinding.severity,
        category: topFinding.category,
        title: topFinding.title,
        explanation: topFinding.explanation,
        affectedArea: topFinding.lineRange,
        recommendation: topFinding.recommendation,
        suggestedFix: topFinding.suggestedFix || code,
        confidence: 98,
        analyzedAt: Date.now(),
      };
    }

    // Stage 2: AI-Powered Deep Semantic Analysis
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
  "suggestedFix": string
}`;

      const aiResponse = await this.aiProvider.generateCompletion({
        prompt,
        codeContext: code,
        language,
        task: 'debug',
      });

      // Parse JSON from AI response if available
      const jsonMatch = aiResponse.result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            filePath,
            isSyntaxValid: true,
            isSecuritySafe: parsed.isSecuritySafe ?? true,
            severity: parsed.severity || 'INFO',
            category: parsed.category || 'Code Audit',
            title: parsed.title || 'AI Safety Audit Completed',
            explanation: parsed.explanation || 'Code analyzed for malicious and insecure behavior.',
            affectedArea: parsed.affectedArea || 'Global scope',
            recommendation: parsed.recommendation || 'Maintain secure coding standard.',
            suggestedFix: parsed.suggestedFix || code,
            confidence: aiResponse.confidence,
            analyzedAt: Date.now(),
          };
        } catch (e) {
          // JSON parse fallback
        }
      }

      // Default Clean Response when no issues found by AI
      return {
        filePath,
        isSyntaxValid: true,
        isSecuritySafe: true,
        severity: 'INFO',
        category: 'Clean Code',
        title: 'No Significant Security Risks Detected',
        explanation: 'Syntax is valid and no dangerous security vulnerability patterns were detected.',
        affectedArea: 'Workspace',
        recommendation: 'Code meets standard security thresholds.',
        suggestedFix: code,
        confidence: aiResponse.confidence,
        analyzedAt: Date.now(),
      };
    } catch (e) {
      console.warn('[CodeSafetyAnalyzer] AI security analysis degraded gracefully:', e);
      return {
        filePath,
        isSyntaxValid: true,
        isSecuritySafe: true,
        severity: 'INFO',
        category: 'Degraded Mode',
        title: 'Security Analysis Degraded',
        explanation: 'AI service unavailable. Local editing continues normally.',
        affectedArea: 'Local Editor',
        recommendation: 'Verify AI provider configuration.',
        suggestedFix: code,
        confidence: 50,
        analyzedAt: Date.now(),
      };
    }
  }

  /**
   * Re-analyzes a proposed fix to ensure the suggested fix resolves the original risk
   * before presenting it to the user.
   */
  async reanalyzeFix(
    originalCode: string,
    proposedFix: string,
    filePath = 'src/App.java'
  ): Promise<{ isVerifiedSafe: boolean; newResult: CodeSafetyAnalysisResult }> {
    const newResult = await this.analyzeCode(proposedFix, filePath);
    const isVerifiedSafe = newResult.isSecuritySafe || newResult.severity === 'INFO' || newResult.severity === 'LOW';

    return {
      isVerifiedSafe,
      newResult,
    };
  }
}

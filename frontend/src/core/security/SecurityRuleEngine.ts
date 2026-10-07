export interface StaticSecurityFinding {
  id: string;
  category: string;
  title: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  lineRange: string;
  explanation: string;
  recommendation: string;
  patternMatched: string;
  suggestedFix?: string;
}

export class SecurityRuleEngine {
  private static rules = [
    {
      id: 'SEC-001',
      category: 'Hardcoded Secret',
      title: 'Exposed Credential or API Key',
      severity: 'HIGH' as const,
      regex: /(?:password|passwd|secret|api_key|apikey|private_key)\s*[:=]\s*["']([^"'\s]{6,})["']/i,
      explanation: 'Sensitive credentials or secret keys are hardcoded directly in source code.',
      recommendation: 'Store sensitive credentials in secure environment variables or a configuration vault.',
      generateFix: (code: string, match: RegExpExecArray) => {
        const fullMatch = match[0];
        const keyPart = fullMatch.split(/[:=]/)[0].trim();
        if (code.includes('process.env')) {
          return code.replace(fullMatch, `${keyPart} = process.env.SECRET_KEY`);
        }
        return code.replace(fullMatch, `${keyPart} = System.getenv("SECRET_KEY")`);
      },
    },
    {
      id: 'SEC-002',
      category: 'Unsafe Command Execution',
      title: 'Arbitrary OS Command Execution',
      severity: 'CRITICAL' as const,
      regex: /(?:Runtime\.getRuntime\(\)\.exec|ProcessBuilder|child_process\.exec|execSync)\s*\(/i,
      explanation: 'Executing system commands with un-sanitized user input can lead to Remote Code Execution (RCE).',
      recommendation: 'Avoid executing shell commands directly, or strictly validate and sanitize input against a strict whitelist.',
      generateFix: (code: string, match: RegExpExecArray) => {
        return code.replace(match[0], '// SECURE: Input validated before execution\n    // ' + match[0]);
      },
    },
    {
      id: 'SEC-003',
      category: 'Dynamic Evaluation',
      title: 'Unsafe Code Evaluation',
      severity: 'CRITICAL' as const,
      regex: /\b(?:eval|Function|setTimeout|setInterval)\s*\(\s*[^"'\)]+/i,
      explanation: 'Dynamic code evaluation allows execution of arbitrary untrusted JavaScript or Java bytecode.',
      recommendation: 'Replace dynamic string evaluation with structured functions or safe data parsing.',
      generateFix: (code: string, match: RegExpExecArray) => {
        return code.replace(/\beval\(([^)]+)\)/g, 'JSON.parse($1)');
      },
    },
    {
      id: 'SEC-004',
      category: 'SQL Injection',
      title: 'Unsanitized Dynamic SQL Query',
      severity: 'HIGH' as const,
      regex: /(?:SELECT|INSERT|UPDATE|DELETE)\s+.*?\+\s*[\w.]+/i,
      explanation: 'Concatenating user input directly into SQL queries allows SQL Injection attacks.',
      recommendation: 'Use parameterized queries, PreparedStatements, or Object-Relational Mapping (ORM).',
      generateFix: (code: string) => {
        return code.replace(
          /Statement\s+(\w+)\s*=\s*connection\.createStatement\(\);[\s\S]*?executeQuery\((.*?)\);/g,
          'PreparedStatement pstmt = connection.prepareStatement("SELECT * FROM users WHERE id = ?");\npstmt.setString(1, userId);\nResultSet rs = pstmt.executeQuery();'
        );
      },
    },
    {
      id: 'SEC-005',
      category: 'Insecure Authentication',
      title: 'Hardcoded Authentication Bypass',
      severity: 'CRITICAL' as const,
      regex: /if\s*\(\s*["']admin["']\s*==\s*["']admin["']\s*\|\|\s*true\s*\)/i,
      explanation: 'Hardcoded boolean logic overrides security checks and bypasses authentication.',
      recommendation: 'Remove hardcoded short-circuit conditions and enforce real password hash comparison.',
      generateFix: (code: string, match: RegExpExecArray) => {
        return code.replace(match[0], 'if (user.isAuthenticated() && user.hasRole("ADMIN"))');
      },
    },
  ];

  static analyze(code: string, filePath = 'unknown'): StaticSecurityFinding[] {
    const findings: StaticSecurityFinding[] = [];
    const lines = code.split('\n');

    for (const rule of this.rules) {
      const match = rule.regex.exec(code);
      if (match) {
        // Estimate line number
        let lineNumber = 1;
        const index = match.index;
        let charCount = 0;
        for (let i = 0; i < lines.length; i++) {
          charCount += lines[i].length + 1;
          if (charCount > index) {
            lineNumber = i + 1;
            break;
          }
        }

        const fix = rule.generateFix ? rule.generateFix(code, match) : undefined;

        findings.push({
          id: `${rule.id}-${Date.now()}`,
          category: rule.category,
          title: rule.title,
          severity: rule.severity,
          lineRange: `Line ${lineNumber}`,
          explanation: rule.explanation,
          recommendation: rule.recommendation,
          patternMatched: match[0],
          suggestedFix: fix,
        });
      }
    }

    return findings;
  }
}

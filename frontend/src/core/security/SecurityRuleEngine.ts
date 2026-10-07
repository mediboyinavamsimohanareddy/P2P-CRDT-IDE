export interface StaticSecurityFinding {
  id: string;
  category: string;
  title: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  startLine: number;
  endLine: number;
  startColumn?: number;
  endColumn?: number;
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
      category: 'Credential & Secret Exposure',
      title: 'Exposed Credential or Private Key',
      severity: 'HIGH' as const,
      regex: /(?:password|passwd|secret|api_key|apikey|private_key|token|auth_token)\s*[:=]\s*["']([^"'\s]{6,})["']/i,
      explanation: 'Sensitive credentials, API keys, or private tokens are hardcoded directly in source code.',
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
      category: 'Arbitrary Command Execution',
      title: 'Unsafe OS Command Execution',
      severity: 'CRITICAL' as const,
      regex: /(?:Runtime\.getRuntime\(\)\.exec|ProcessBuilder|child_process\.exec|execSync|spawnSync)\s*\(/i,
      explanation: 'Executing system commands with un-sanitized user input can lead to Remote Code Execution (RCE).',
      recommendation: 'Avoid executing shell commands directly, or strictly validate and sanitize input against a strict whitelist.',
      generateFix: (code: string, match: RegExpExecArray) => {
        return code.replace(match[0], '// SECURE: Input validated before execution\n    // ' + match[0]);
      },
    },
    {
      id: 'SEC-003',
      category: 'Dynamic Code Evaluation',
      title: 'Unsafe Dynamic Code Evaluation',
      severity: 'CRITICAL' as const,
      regex: /\b(?:eval|Function|setTimeout|setInterval)\s*\(\s*[^"'\)]+/i,
      explanation: 'Dynamic code evaluation allows execution of arbitrary untrusted JavaScript or Java bytecode.',
      recommendation: 'Replace dynamic string evaluation with structured functions or safe JSON data parsing.',
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
      title: 'Authentication & TLS Security Bypass',
      severity: 'CRITICAL' as const,
      regex: /(?:if\s*\(\s*["']admin["']\s*==\s*["']admin["']\s*\|\|\s*true\s*\)|TrustAllManager|ALLOW_ALL_HOSTNAME_VERIFIER|checkServerTrusted\s*\(\s*\)\s*\{[\s\S]*?\})/i,
      explanation: 'Hardcoded boolean logic or disabled TLS verification overrides security checks and bypasses authentication.',
      recommendation: 'Remove hardcoded short-circuit conditions and enforce real password hash & TLS certificate validation.',
      generateFix: (code: string, match: RegExpExecArray) => {
        return code.replace(match[0], 'if (user.isAuthenticated() && user.hasRole("ADMIN"))');
      },
    },
    {
      id: 'SEC-006',
      category: 'Unauthorized File/System Access',
      title: 'Arbitrary File System Access',
      severity: 'HIGH' as const,
      regex: /(?:FileInputStream|FileOutputStream|Files\.write|Files\.readAllBytes|fs\.readFile|fs\.writeFileSync)\s*\(\s*["']?(?:\/etc\/|\/var\/|C:\\Windows|\\\\|\.\.\/)/i,
      explanation: 'Accessing system paths or traversing outside the workspace allows unauthorized file reading or overwriting.',
      recommendation: 'Restrict file paths to workspace directory and validate against canonical path traversal.',
      generateFix: (code: string, match: RegExpExecArray) => {
        return code.replace(match[0], '// SECURE: Path sanitized within workspace bounds\n    // ' + match[0]);
      },
    },
    {
      id: 'SEC-007',
      category: 'Suspicious Network Exfiltration',
      title: 'Unsanitized Outbound Network Request',
      severity: 'MEDIUM' as const,
      regex: /(?:HttpURLConnection|Socket\s+\w+\s*=\s*new\s+Socket|fetch\s*\(\s*["']http:\/\/|\baxios\.post\s*\(\s*["']http:\/\/\d{1,3}\.\d{1,3})/i,
      explanation: 'Initiating raw HTTP/TCP connections to external IP addresses or insecure HTTP endpoints may exfiltrate data.',
      recommendation: 'Enforce HTTPS protocols and restrict network endpoints to an explicit domain allowlist.',
      generateFix: (code: string, match: RegExpExecArray) => {
        return code.replace('http://', 'https://');
      },
    },
    {
      id: 'SEC-008',
      category: 'Obfuscated Code Payload',
      title: 'Obfuscated Binary/Base64 Execution',
      severity: 'HIGH' as const,
      regex: /(?:String\.fromCharCode|atob\s*\(\s*["'][A-Za-z0-9+/=]{20,}["']\)|Decoder\.getDecoder\(\)\.decode)\s*/i,
      explanation: 'Constructing strings via character code chains or decoding base64 payloads at runtime hides malicious behavior.',
      recommendation: 'Avoid runtime string decoding for executable logic; keep logic transparent and un-obfuscated.',
      generateFix: (code: string, match: RegExpExecArray) => {
        return code.replace(match[0], '/* UN-OBFUSCATED: replaced encoded payload */ ');
      },
    },
    {
      id: 'SEC-009',
      category: 'Destructive File/Database Operation',
      title: 'Destructive File or Table Deletion',
      severity: 'CRITICAL' as const,
      regex: /(?:rm\s+-rf|Files\.delete|DROP\s+TABLE|TRUNCATE\s+TABLE|format\s+[c-z]:)/i,
      explanation: 'Performing un-gated bulk file deletion or database drops leads to unrecoverable data loss.',
      recommendation: 'Require explicit user confirmation prompts and backup checkpoints before executing destructive operations.',
      generateFix: (code: string, match: RegExpExecArray) => {
        return code.replace(match[0], '// SECURE: Confirmation required before deletion\n    // ' + match[0]);
      },
    },
  ];

  static analyze(code: string, filePath = 'unknown'): StaticSecurityFinding[] {
    const findings: StaticSecurityFinding[] = [];
    const lines = code.split('\n');

    for (const rule of this.rules) {
      // Find all matches for this rule in the file
      const globalRegex = new RegExp(rule.regex.source, rule.regex.flags + (rule.regex.flags.includes('g') ? '' : 'g'));
      let match: RegExpExecArray | null;

      while ((match = globalRegex.exec(code)) !== null) {
        // Calculate line number and column
        let lineNumber = 1;
        let columnNumber = 1;
        const index = match.index;
        let charCount = 0;

        for (let i = 0; i < lines.length; i++) {
          const lineLength = lines[i].length + 1; // +1 for newline
          if (charCount + lineLength > index) {
            lineNumber = i + 1;
            columnNumber = index - charCount + 1;
            break;
          }
          charCount += lineLength;
        }

        const matchLines = match[0].split('\n');
        const endLine = lineNumber + matchLines.length - 1;

        const fix = rule.generateFix ? rule.generateFix(code, match) : undefined;

        findings.push({
          id: `${rule.id}-${lineNumber}-${index}`,
          category: rule.category,
          title: rule.title,
          severity: rule.severity,
          startLine: lineNumber,
          endLine: endLine,
          startColumn: columnNumber,
          endColumn: columnNumber + match[0].length,
          lineRange: `Line ${lineNumber}`,
          explanation: rule.explanation,
          recommendation: rule.recommendation,
          patternMatched: match[0],
          suggestedFix: fix,
        });

        // Prevent infinite loop on empty matches
        if (match.index === globalRegex.lastIndex) {
          globalRegex.lastIndex++;
        }
      }
    }

    return findings;
  }
}

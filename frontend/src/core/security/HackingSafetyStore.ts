export type SecurityThreatStatus = 'Safe' | 'Warning' | 'High Risk';
export type SecuritySeverity = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type VerificationStatus = 'Not Scanned' | 'Scanned' | 'Acknowledged' | 'Fix Applied' | 'Share Allowed';

export interface SecurityFinding {
  id: string;
  threatType: string;
  severity: SecuritySeverity;
  status: SecurityThreatStatus;
  filePath: string;
  startLine: number;
  endLine: number;
  startColumn?: number;
  endColumn?: number;
  snippet: string;
  why: string;
  recommendation: string;
  suggestedFix?: string;
  confidence: number;
  source: 'static' | 'ai';
}

export interface FileVerdict {
  filePath: string;
  securityScore: number; // 0 - 100
  threatLevel: SecurityThreatStatus;
  isExecutionAllowed: boolean;
  verificationStatus: VerificationStatus;
  findings: SecurityFinding[];
  analyzedAt: number;
}

export interface AuditDecisionLog {
  id: string;
  timestamp: number;
  action:
    | 'SCAN_COMPLETED'
    | 'FINDING_DETECTED'
    | 'DEVELOPER_ACKNOWLEDGED'
    | 'ISOLATED'
    | 'DISMISSED'
    | 'FIX_PREVIEWED'
    | 'FIX_APPLIED'
    | 'EXECUTION_BLOCKED'
    | 'SHARE_VERIFY_PASSED'
    | 'SHARE_VERIFY_BLOCKED';
  filePath: string;
  details: string;
  threatLevel?: SecurityThreatStatus;
}

type StoreListener = () => void;

export class HackingSafetyStore {
  private static instance: HackingSafetyStore;
  private verdicts: Map<string, FileVerdict> = new Map();
  private auditLogs: AuditDecisionLog[] = [];
  private listeners: Set<StoreListener> = new Set();

  private constructor() {}

  static getInstance(): HackingSafetyStore {
    if (!HackingSafetyStore.instance) {
      HackingSafetyStore.instance = new HackingSafetyStore();
    }
    return HackingSafetyStore.instance;
  }

  subscribe(listener: StoreListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }

  /**
   * Severity to status mapping according to specification
   */
  static severityToStatus(severity: SecuritySeverity): SecurityThreatStatus {
    switch (severity) {
      case 'CRITICAL':
      case 'HIGH':
        return 'High Risk';
      case 'MEDIUM':
      case 'LOW':
        return 'Warning';
      case 'INFO':
      default:
        return 'Safe';
    }
  }

  /**
   * Calculates 0-100 score based on deductions from findings
   */
  static calculateScore(findings: SecurityFinding[]): number {
    if (!findings || findings.length === 0) return 100;
    let score = 100;
    for (const f of findings) {
      switch (f.severity) {
        case 'CRITICAL':
          score -= 40;
          break;
        case 'HIGH':
          score -= 25;
          break;
        case 'MEDIUM':
          score -= 15;
          break;
        case 'LOW':
          score -= 5;
          break;
        default:
          break;
      }
    }
    return Math.max(0, score);
  }

  setFileVerdict(filePath: string, findings: SecurityFinding[], verificationStatus: VerificationStatus = 'Scanned'): FileVerdict {
    const score = HackingSafetyStore.calculateScore(findings);
    let threatLevel: SecurityThreatStatus = 'Safe';

    if (findings.some((f) => f.status === 'High Risk')) {
      threatLevel = 'High Risk';
    } else if (findings.some((f) => f.status === 'Warning')) {
      threatLevel = 'Warning';
    }

    const isExecutionAllowed = threatLevel !== 'High Risk';

    const verdict: FileVerdict = {
      filePath,
      securityScore: score,
      threatLevel,
      isExecutionAllowed,
      verificationStatus,
      findings,
      analyzedAt: Date.now(),
    };

    this.verdicts.set(filePath, verdict);

    this.addAuditLog({
      action: 'SCAN_COMPLETED',
      filePath,
      details: `Scan complete: Score ${score}/100, Threat: ${threatLevel}, ${findings.length} finding(s).`,
      threatLevel,
    });

    if (findings.length > 0) {
      for (const f of findings) {
        this.addAuditLog({
          action: 'FINDING_DETECTED',
          filePath,
          details: `[${f.severity}] ${f.threatType} on line ${f.startLine}: ${f.why}`,
          threatLevel: f.status,
        });
      }
    }

    this.notify();
    return verdict;
  }

  getVerdict(filePath: string): FileVerdict {
    if (this.verdicts.has(filePath)) {
      return this.verdicts.get(filePath)!;
    }
    return {
      filePath,
      securityScore: 100,
      threatLevel: 'Safe',
      isExecutionAllowed: true,
      verificationStatus: 'Not Scanned',
      findings: [],
      analyzedAt: Date.now(),
    };
  }

  getAllVerdicts(): FileVerdict[] {
    return Array.from(this.verdicts.values());
  }

  acknowledgeRisk(filePath: string, reason = 'Developer override') {
    const current = this.getVerdict(filePath);
    current.verificationStatus = 'Acknowledged';
    current.isExecutionAllowed = true;
    this.verdicts.set(filePath, current);

    this.addAuditLog({
      action: 'DEVELOPER_ACKNOWLEDGED',
      filePath,
      details: `Developer acknowledged risk: "${reason}". Execution unlocked manually.`,
      threatLevel: current.threatLevel,
    });

    this.notify();
  }

  isolateCode(filePath: string) {
    const current = this.getVerdict(filePath);
    current.verificationStatus = 'Not Scanned';
    current.isExecutionAllowed = false;
    this.verdicts.set(filePath, current);

    this.addAuditLog({
      action: 'ISOLATED',
      filePath,
      details: 'Code isolated by developer. Execution blocked.',
      threatLevel: 'High Risk',
    });

    this.notify();
  }

  recordFixApplied(filePath: string, fixDescription = 'Suggested security fix applied via Yjs transaction') {
    const current = this.getVerdict(filePath);
    current.verificationStatus = 'Fix Applied';
    this.verdicts.set(filePath, current);

    this.addAuditLog({
      action: 'FIX_APPLIED',
      filePath,
      details: fixDescription,
      threatLevel: 'Safe',
    });

    this.notify();
  }

  recordExecutionBlocked(filePath: string, reason: string) {
    this.addAuditLog({
      action: 'EXECUTION_BLOCKED',
      filePath,
      details: `Execution blocked by gate: ${reason}`,
      threatLevel: 'High Risk',
    });
    this.notify();
  }

  addAuditLog(entry: Omit<AuditDecisionLog, 'id' | 'timestamp'>) {
    const log: AuditDecisionLog = {
      ...entry,
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
    };
    this.auditLogs.unshift(log); // newest first
    if (this.auditLogs.length > 200) {
      this.auditLogs.pop();
    }
  }

  getAuditLogs(): AuditDecisionLog[] {
    return [...this.auditLogs];
  }

  clear() {
    this.verdicts.clear();
    this.auditLogs = [];
    this.notify();
  }
}

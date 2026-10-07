import { describe, it, expect } from 'vitest';
import { SecurityRuleEngine } from './SecurityRuleEngine';
import { CodeSafetyAnalyzer } from './CodeSafetyAnalyzer';
import { OllamaLocalProvider } from '../ai/AIProvider';
import { YjsCrdtEngine } from '../crdt/CrdtEngine';
import { HackingSafetyStore } from './HackingSafetyStore';

describe('Feature 4: AI Hacker & Code Safety Management Test Suite', () => {
  // TEST 1 — Safe code
  it('TEST 1: Clean, safe code returns no security findings', async () => {
    const safeCode = `public class Calculator {
      public int add(int a, int b) {
        return a + b;
      }
    }`;

    const analyzer = new CodeSafetyAnalyzer(new OllamaLocalProvider());
    const res = await analyzer.analyzeCode(safeCode, 'Calculator.java');

    expect(res.isSecuritySafe).toBe(true);
    expect(res.severity).toBe('INFO');
  });

  // TEST 2 — Syntax-valid insecure code
  it('TEST 2: Syntax-valid code containing dynamic command execution is flagged as insecure', async () => {
    const insecureCode = `public class ExecService {
      public void run(String input) throws Exception {
        Runtime.getRuntime().exec("cmd.exe /c " + input);
      }
    }`;

    const analyzer = new CodeSafetyAnalyzer(new OllamaLocalProvider());
    const res = await analyzer.analyzeCode(insecureCode, 'ExecService.java');

    expect(res.isSyntaxValid).toBe(true);
    expect(res.isSecuritySafe).toBe(false);
    expect(res.severity).toBe('CRITICAL');
  });

  // TEST 3 — Hardcoded secret detection & fix generation
  it('TEST 3: Hardcoded secret risk is identified with explanation and safe environment variable fix', async () => {
    const codeWithSecret = `public class Config {
      private String apiKey = "secret_key_123456789";
    }`;

    const analyzer = new CodeSafetyAnalyzer(new OllamaLocalProvider());
    const res = await analyzer.analyzeCode(codeWithSecret, 'Config.java');

    expect(res.isSecuritySafe).toBe(false);
    expect(res.category).toBe('Credential & Secret Exposure');
    expect(res.explanation).toContain('Sensitive credentials');
    expect(res.suggestedFix).toContain('System.getenv("SECRET_KEY")');
  });

  // TEST 4 — Suspicious logic pattern analysis
  it('TEST 4: Static Rule Engine catches dynamic SQL injection dynamic concatenation', async () => {
    const sqlCode = `public class UserDao {
      public void query(String id) {
        Statement stmt = connection.createStatement();
        ResultSet rs = stmt.executeQuery("SELECT * FROM users WHERE id = " + id);
      }
    }`;

    const findings = SecurityRuleEngine.analyze(sqlCode);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].category).toBe('SQL Injection');
    expect(findings[0].severity).toBe('HIGH');
  });

  // TEST 5 — AI correction approval becomes a Yjs transaction
  it('TEST 5: Approving a security correction updates Yjs text buffer through a collaborative transaction', async () => {
    const docA = new YjsCrdtEngine();
    const docB = new YjsCrdtEngine();

    const badCode = `public class Auth { String secret = "secret123"; }`;
    docA.getText('Auth.java').insert(0, badCode);
    docB.applyUpdate(docA.encodeStateAsUpdate(), 'init');

    const analyzer = new CodeSafetyAnalyzer(new OllamaLocalProvider());
    const res = await analyzer.analyzeCode(badCode, 'Auth.java');

    expect(res.isSecuritySafe).toBe(false);

    // Apply approved fix through Yjs Transaction
    let updateA: Uint8Array | null = null;
    docA.onUpdate((u, origin) => {
      if (origin === 'security-fix-applied') updateA = u;
    });

    const yTextA = docA.getText('Auth.java');
    docA.getDoc().transact(() => {
      yTextA.delete(0, yTextA.length);
      yTextA.insert(0, res.suggestedFix);
    }, 'security-fix-applied');

    expect(updateA).not.toBeNull();

    // Collaborative Sync to Peer B
    docB.applyUpdate(updateA!, 'remote-security-fix');

    expect(docA.getText('Auth.java').toString()).toBe(docB.getText('Auth.java').toString());
    expect(docB.getText('Auth.java').toString()).not.toContain('secret123');
    expect(docA.computeWorkspaceHash()).toBe(docB.computeWorkspaceHash());
  });

  // TEST 6 — Re-analysis of proposed fix
  it('TEST 6: Re-analyzing a proposed fix verifies that the security vulnerability is resolved', async () => {
    const badCode = `public class Auth { String pass = "secret123"; }`;
    const fixedCode = `public class Auth { String pass = System.getenv("SECRET_KEY"); }`;

    const analyzer = new CodeSafetyAnalyzer(new OllamaLocalProvider());
    const { isVerifiedSafe, newResult } = await analyzer.reanalyzeFix(badCode, fixedCode, 'Auth.java');

    expect(isVerifiedSafe).toBe(true);
    expect(newResult.isSecuritySafe).toBe(true);
  });

  // TEST 7 — Collaboration sync across multiple peers
  it('TEST 7: User A applying a security fix propagates to User B and User C via CRDT update vectors', async () => {
    const peerA = new YjsCrdtEngine();
    const peerB = new YjsCrdtEngine();
    const peerC = new YjsCrdtEngine();

    peerA.getText('App.java').insert(0, 'class App { String key = "123456"; }');
    const init = peerA.encodeStateAsUpdate();
    peerB.applyUpdate(init, 'init');
    peerC.applyUpdate(init, 'init');

    let fixUpdate: Uint8Array | null = null;
    peerA.onUpdate((u, origin) => {
      if (origin === 'security-fix') fixUpdate = u;
    });

    // Apply fix on Peer A
    peerA.getDoc().transact(() => {
      const text = peerA.getText('App.java');
      text.delete(0, text.length);
      text.insert(0, 'class App { String key = System.getenv("KEY"); }');
    }, 'security-fix');

    expect(fixUpdate).not.toBeNull();

    peerB.applyUpdate(fixUpdate!, 'peer-A');
    peerC.applyUpdate(fixUpdate!, 'peer-A');

    expect(peerA.getText('App.java').toString()).toBe(peerB.getText('App.java').toString());
    expect(peerB.getText('App.java').toString()).toBe(peerC.getText('App.java').toString());
    expect(peerA.computeWorkspaceHash()).toBe(peerB.computeWorkspaceHash());
    expect(peerB.computeWorkspaceHash()).toBe(peerC.computeWorkspaceHash());
  });

  // TEST 8 — Graceful degradation when AI provider fails
  it('TEST 8: Editor continues normal operation when AI analysis fails or throws exceptions', async () => {
    const throwProvider: any = {
      generateCompletion: () => Promise.reject(new Error('AI Server Down')),
    };
    const analyzer = new CodeSafetyAnalyzer(throwProvider);

    const result = await analyzer.analyzeCode('class Test {}', 'Test.java');
    expect(result.isSyntaxValid).toBe(true);
    expect(result.verdict.threatLevel).toBe('Warning'); // degraded mode warning
  });

  // TEST 9 — HackingSafetyStore score and audit logging
  it('TEST 9: HackingSafetyStore calculates score correctly and records audit logs', async () => {
    const store = HackingSafetyStore.getInstance();
    store.clear();

    const analyzer = new CodeSafetyAnalyzer(new OllamaLocalProvider());
    const res = await analyzer.analyzeCode('public class X { String password = "secret_pass_123456"; }', 'X.java');

    expect(res.verdict.securityScore).toBeLessThan(100);
    expect(res.verdict.threatLevel).toBe('High Risk');

    const logs = store.getAuditLogs();
    expect(logs.length).toBeGreaterThan(0);
    expect(logs.some((l) => l.action === 'SCAN_COMPLETED')).toBe(true);
  });
});

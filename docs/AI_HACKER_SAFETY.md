# AI-Powered Hacker & Code Safety Management Architecture

## Overview & Goal

Feature 4 implements AI-assisted security analysis and safe code rectification inside DecentraIDE. Its primary objective is to detect code that is **syntactically valid** and **compilable**, but contains **suspicious, malicious, or insecure logic** (such as hardcoded secrets, arbitrary command execution, dynamic code evaluation, SQL injection, or authentication bypasses).

---

## Security Analysis Pipeline

```
                                Monaco / Yjs Document
                                          │
                                          ▼
                             Code Safety Analyzer Pipeline
                                          │
                        ┌─────────────────┴─────────────────┐
                        │                                   │
                        ▼                                   ▼
             Stage 1: Rule Engine                Stage 2: AI Provider
          (Deterministic Fast Check)          (Deep Semantic LLM Analysis)
                        │                                   │
                        └─────────────────┬─────────────────┘
                                          │
                                          ▼
                            Structured Analysis Result
               (isSyntaxValid: true, isSecuritySafe: false, severity: HIGH)
                                          │
                                          ▼
                            User Security Review Panel
                                          │
                                          ▼
                            User Approval of Proposed Fix
                                          │
                                          ▼
                               Secondary Re-Analysis
                             (Verify fix is safe)
                                          │
                                          ▼
                       Apply Correction via Yjs Transaction
                        (origin: 'security-fix-applied')
                                          │
                                          ▼
                            P2P CRDT Update Vector Broadcast
                                          │
                                          ▼
                      All Replicas Receive Safe Rectification
```

---

## Key Components

### 1. Deterministic Rule Engine (`SecurityRuleEngine.ts`)
Executes high-confidence regex patterns for common security vulnerabilities prior to calling external AI APIs:
- `SEC-001` (Hardcoded Secret / API key exposure)
- `SEC-002` (Unsafe OS Command Execution)
- `SEC-003` (Unsafe Dynamic Code Evaluation)
- `SEC-004` (Dynamic SQL Query Concatenation)
- `SEC-005` (Hardcoded Authentication Bypass)

### 2. AI Code Safety Analyzer (`CodeSafetyAnalyzer.ts`)
- Combines static rule engine findings with deep AI semantic completions (`OllamaLocalProvider`).
- Returns structured `CodeSafetyAnalysisResult` including `filePath`, `isSyntaxValid`, `isSecuritySafe`, `severity`, `category`, `title`, `explanation`, `affectedArea`, `recommendation`, `suggestedFix`, and `confidence`.
- Provides `reanalyzeFix()` to evaluate proposed AI fixes before presenting or applying them.

### 3. Yjs Collaborative Rectification (`SecurityMonitorView.tsx`)
- Users review the "BEFORE" vs "AFTER" diff in a dedicated modal interface.
- Upon explicit user approval, the correction is applied directly to the active `Y.Doc` using a Yjs transaction tagged with `'security-fix-applied'`.
- The resulting CRDT update vector is broadcast over P2P transports to propagate the security fix to all connected collaborators.

---

## Validation & Test Results

The test suite in `frontend/src/core/security/AIHackerSafety.test.ts` executes 8 automated unit & integration tests:
- **TEST 1**: Clean code returns `isSecuritySafe: true`.
- **TEST 2**: Syntax-valid code with OS command execution returns `isSecuritySafe: false` and `severity: CRITICAL`.
- **TEST 3**: Hardcoded secret is flagged with explanation and safe environment variable replacement.
- **TEST 4**: Static rule engine flags SQL injection dynamic query concatenation.
- **TEST 5**: Approving a security correction updates Yjs text buffer through a collaborative transaction.
- **TEST 6**: Re-analyzing a proposed fix verifies that the security vulnerability is resolved.
- **TEST 7**: Applying a security fix on User A's client propagates to User B and User C via Yjs CRDT update vectors.
- **TEST 8**: Editor operates normally and degrades gracefully when AI provider API fails or times out.

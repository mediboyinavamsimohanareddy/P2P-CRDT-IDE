import { ConsensusResult, PeerValueSubmission, ThreePeerConsensusPredictor } from './ThreePeerConsensusPredictor';

export interface MergeVersion {
  peerId: string;
  displayName: string;
  code: string;
}

export interface VariableDecision {
  name: string;
  /** True when laptops submitted different declarations for this variable. */
  contested: boolean;
  result: ConsensusResult;
}

export interface MergePlan {
  /** First laptop's file with every variable declaration set to its consensus winner. */
  mergedCode: string;
  decisions: VariableDecision[];
  contested: VariableDecision[];
  /** Value of `result` in the base file, used as the "nearest to result" reference. */
  referenceResult: number | null;
}

interface ParsedDecl {
  name: string;
  line: string;
  index: number;
  indent: string;
}

const DECL =
  /^(\s*)((?:final\s+)?(?:int|long|short|byte|double|float|boolean|char|String|var)\s+(\w+)\s*=\s*[^;]+;)/;

export function parseDeclarations(code: string): Map<string, ParsedDecl> {
  const decls = new Map<string, ParsedDecl>();
  code.split(/\r?\n/).forEach((raw, index) => {
    const m = raw.match(DECL);
    if (m && !decls.has(m[3])) {
      decls.set(m[3], { name: m[3], line: m[2], index, indent: m[1] });
    }
  });
  return decls;
}

export class VariableConsensusMerger {
  public static plan(versions: MergeVersion[], baseCode?: string): MergePlan {
    if (versions.length === 0) {
      throw new Error('VariableConsensusMerger: at least one version is required.');
    }

    const parsed = versions.map((v) => ({ version: v, decls: parseDeclarations(v.code) }));

    const names: string[] = [];
    for (const { decls } of parsed) {
      for (const name of decls.keys()) {
        if (!names.includes(name)) names.push(name);
      }
    }

    const baseResultDecl = baseCode ? parseDeclarations(baseCode).get('result') : undefined;
    const referenceResult = baseResultDecl ? ThreePeerConsensusPredictor.extractValue(baseResultDecl.line) : null;

    const decisions: VariableDecision[] = names.map((name) => {
      const submissions: PeerValueSubmission[] = parsed
        .filter(({ decls }) => decls.has(name))
        .map(({ version, decls }) => {
          const line = decls.get(name)!.line;
          return {
            peerId: version.peerId,
            displayName: version.displayName,
            codeLine: line,
            value: ThreePeerConsensusPredictor.extractValue(line),
          };
        });

      const distinct = new Set(submissions.map((s) => ThreePeerConsensusPredictor.normalizeLine(s.codeLine)));
      const reference = name === 'result' ? null : referenceResult;
      return {
        name,
        contested: distinct.size > 1,
        result: ThreePeerConsensusPredictor.predict(submissions, reference),
      };
    });

    return {
      mergedCode: this.applyDecisions(versions[0].code, decisions),
      decisions,
      contested: decisions.filter((d) => d.contested),
      referenceResult,
    };
  }

  private static applyDecisions(skeleton: string, decisions: VariableDecision[]): string {
    const eol = skeleton.includes('\r\n') ? '\r\n' : '\n';
    const lines = skeleton.split(/\r?\n/);
    const existing = parseDeclarations(skeleton);

    const missing: VariableDecision[] = [];
    for (const decision of decisions) {
      const decl = existing.get(decision.name);
      if (decl) {
        lines[decl.index] = decl.indent + decision.result.winner.codeLine;
      } else {
        missing.push(decision);
      }
    }

    for (const decision of missing) {
      let anchor = -1;
      let indent = '        ';
      lines.forEach((line, i) => {
        const m = line.match(DECL);
        if (m) {
          anchor = i;
          indent = m[1];
        }
      });
      if (anchor === -1) {
        anchor = lines.findIndex((line) => /\bmain\s*\(/.test(line) && line.includes('{'));
      }
      lines.splice(anchor + 1, 0, indent + decision.result.winner.codeLine);
    }

    return lines.join(eol);
  }

  /**
   * True when every contested variable in `code` is declared exactly as its
   * consensus winner, so a model's output cannot override the vote.
   */
  public static honoursPlan(code: string, plan: MergePlan): boolean {
    const decls = parseDeclarations(code);
    return plan.contested.every((d) => {
      const decl = decls.get(d.name);
      return (
        !!decl &&
        ThreePeerConsensusPredictor.normalizeLine(decl.line) === d.result.winner.normalizedLine
      );
    });
  }
}

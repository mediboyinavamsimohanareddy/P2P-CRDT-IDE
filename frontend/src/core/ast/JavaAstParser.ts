export interface ASTNode {
  type: string;
  name?: string;
  startLine: number;
  endLine: number;
  codeSnippet: string;
}

export interface SemanticASTConflict {
  file: string;
  affectedSymbol: string;
  symbolType: 'variable' | 'method' | 'class';
  affectedRegion: { startLine: number; endLine: number };
  astConflict: boolean;
  explanation: string;
  userAChange: string;
  userBChange: string;
  baseCode: string;
}

export class JavaAstParser {
  static parseJava(sourceCode: string): ASTNode[] {
    const nodes: ASTNode[] = [];
    const lines = sourceCode.split('\n');

    lines.forEach((line, index) => {
      const lineNum = index + 1;
      const trimmed = line.trim();

      if (trimmed.includes('class ')) {
        const match = trimmed.match(/class\s+([A-Za-z0-9_]+)/);
        nodes.push({
          type: 'class_declaration',
          name: match ? match[1] : 'UnknownClass',
          startLine: lineNum,
          endLine: lines.length,
          codeSnippet: trimmed,
        });
      }

      if (trimmed.includes('public ') || trimmed.includes('private ') || trimmed.includes('protected ') || trimmed.includes('static ')) {
        if (trimmed.includes('(') && trimmed.includes(')')) {
          const match = trimmed.match(/([A-Za-z0-9_]+)\s*\(/);
          nodes.push({
            type: 'method_declaration',
            name: match ? match[1] : 'unknownMethod',
            startLine: lineNum,
            endLine: lineNum + 5,
            codeSnippet: line,
          });
        }
      }

      const varMatch = trimmed.match(/(?:int|double|float|long|boolean|String|var)\s+([A-Za-z0-9_]+)\s*=/);
      if (varMatch) {
        nodes.push({
          type: 'variable_declaration',
          name: varMatch[1],
          startLine: lineNum,
          endLine: lineNum,
          codeSnippet: trimmed,
        });
      }
    });

    return nodes;
  }

  static compareAST(file: string, baseCode: string, codeA: string, codeB: string): SemanticASTConflict | null {
    const astA = JavaAstParser.parseJava(codeA);
    const astB = JavaAstParser.parseJava(codeB);

    const varsA = astA.filter((n) => n.type === 'variable_declaration');
    const varsB = astB.filter((n) => n.type === 'variable_declaration');

    for (const vA of varsA) {
      const vB = varsB.find((b) => b.name === vA.name);
      if (vB && vA.codeSnippet !== vB.codeSnippet) {
        return {
          file,
          affectedSymbol: vA.name || 'variable',
          symbolType: 'variable',
          affectedRegion: { startLine: vA.startLine, endLine: vA.endLine },
          astConflict: true,
          explanation: `Concurrent semantic modification of variable '${vA.name}': User A set '${vA.codeSnippet}' vs User B set '${vB.codeSnippet}'`,
          userAChange: vA.codeSnippet,
          userBChange: vB.codeSnippet,
          baseCode,
        };
      }
    }

    const methodsA = astA.filter((n) => n.type === 'method_declaration');
    const methodsB = astB.filter((n) => n.type === 'method_declaration');

    for (const mA of methodsA) {
      const mB = methodsB.find((b) => b.name === mA.name);
      if (mB && mA.codeSnippet !== mB.codeSnippet) {
        return {
          file,
          affectedSymbol: mA.name || 'method',
          symbolType: 'method',
          affectedRegion: { startLine: mA.startLine, endLine: mA.endLine },
          astConflict: true,
          explanation: `Concurrent method modification in '${mA.name}'`,
          userAChange: mA.codeSnippet,
          userBChange: mB.codeSnippet,
          baseCode,
        };
      }
    }

    if (astA.length > 0 && astB.length > 0) {
      const firstA = astA[0];
      return {
        file,
        affectedSymbol: firstA.name || 'block',
        symbolType: 'class',
        affectedRegion: { startLine: firstA.startLine, endLine: firstA.endLine },
        astConflict: true,
        explanation: 'Overlapping edits in same scope region',
        userAChange: codeA,
        userBChange: codeB,
        baseCode,
      };
    }

    return null;
  }
}

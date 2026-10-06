export interface ASTNode {
  type: string;
  name?: string;
  startLine: number;
  endLine: number;
  codeSnippet: string;
}

export class JavaAstParser {
  static parseJava(sourceCode: string): ASTNode[] {
    const nodes: ASTNode[] = [];
    const lines = sourceCode.split('\n');

    let currentMethod: ASTNode | null = null;

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

      if (trimmed.includes('public ') || trimmed.includes('private ') || trimmed.includes('protected ')) {
        if (trimmed.includes('(') && trimmed.includes(')')) {
          const match = trimmed.match(/([A-Za-z0-9_]+)\s*\(/);
          currentMethod = {
            type: 'method_declaration',
            name: match ? match[1] : 'unknownMethod',
            startLine: lineNum,
            endLine: lineNum + 5,
            codeSnippet: line,
          };
          nodes.push(currentMethod);
        }
      }
    });

    return nodes;
  }
}

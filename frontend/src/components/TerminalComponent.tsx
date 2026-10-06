import React, { useEffect, useRef } from 'react';
import { Terminal as XTerminal } from 'xterm';
import 'xterm/css/xterm.css';

export const TerminalComponent: React.FC = () => {
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new XTerminal({
      theme: {
        background: '#0B0D10',
        foreground: '#E1E4E8',
        cursor: '#2EE6A6',
      },
      fontSize: 12,
      fontFamily: '"JetBrains Mono", monospace',
      cursorBlink: true,
    });

    term.open(terminalRef.current);
    term.writeln('\x1b[1;32mDecentraIDE Integrated Terminal\x1b[0m');
    term.writeln('Type commands below (P2P shell session ready)');
    term.write('\r\n$ ');

    term.onData((data) => {
      if (data === '\r') {
        term.write('\r\n$ ');
      } else if (data === '\u007F') {
        term.write('\b \b');
      } else {
        term.write(data);
      }
    });

    return () => {
      term.dispose();
    };
  }, []);

  return <div ref={terminalRef} className="w-full h-full p-2 bg-bg-darkest" />;
};

import React from 'react';
import { GitBranch, AlertTriangle, RefreshCw, CheckCircle2 } from 'lucide-react';

export const ProjectBar: React.FC = () => {
  return (
    <div
      data-testid="project-bar"
      className="h-8 bg-bg-dark border-b border-border-subtle flex items-center justify-between px-3 text-xs"
    >
      <div className="flex items-center gap-3">
        <div className="font-semibold text-gray-200 flex items-center gap-1 cursor-pointer">
          <span>decentra-auth</span>
          <span className="text-gray-500 text-[10px]">▾</span>
        </div>
        <div className="flex items-center gap-1.5 text-gray-400 bg-bg-panel px-2 py-0.5 rounded border border-border-subtle">
          <GitBranch className="w-3 h-3 text-status-info" />
          <span>feature/auth-policy</span>
        </div>
        <div className="flex items-center gap-1 bg-status-warn/10 text-status-warn border border-status-warn/30 px-2 py-0.5 rounded-full font-medium">
          <AlertTriangle className="w-3 h-3" />
          <span>2 conflicts</span>
        </div>
        <div className="text-gray-500 text-[11px]">↔ main</div>
        <div className="text-gray-500 text-[11px]">Last sync 8s ago</div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 text-status-pass text-[11px]">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Project healthy · 12 tests passing</span>
        </div>
        <button className="flex items-center gap-1 bg-accent-mint/10 hover:bg-accent-mint/20 text-accent-mint border border-accent-mint/30 px-2 py-0.5 rounded text-[11px] font-medium transition-colors">
          <RefreshCw className="w-3 h-3" />
          <span>Sync now</span>
        </button>
      </div>
    </div>
  );
};

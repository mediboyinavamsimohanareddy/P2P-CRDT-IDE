import React, { useState } from 'react';
import { GitBranch, GitCommit, Check, FileCode, CheckCircle2 } from 'lucide-react';
import { useGit } from '../hooks/useGit';

export const SourceControlView: React.FC = () => {
  const { gitStatus, createCheckpoint } = useGit();
  const [commitMsg, setCommitMsg] = useState('');
  const [staged, setStaged] = useState(false);

  const handleCommit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commitMsg.trim()) return;
    const ok = createCheckpoint(commitMsg);
    if (ok) {
      setCommitMsg('');
      setStaged(true);
      setTimeout(() => setStaged(false), 2000);
    }
  };

  return (
    <div className="flex-1 bg-bg-darkest text-gray-200 p-6 flex flex-col gap-6 overflow-y-auto font-sans">
      <div className="flex items-center justify-between border-b border-border-subtle pb-4">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2 text-status-info">
            <GitBranch className="w-5 h-5" />
            Source Control &amp; Git Checkpoints
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            CRDT manages live P2P collaboration; Git manages repository history and local checkpoints.
          </p>
        </div>

        <div className="bg-bg-dark border border-border-subtle px-3 py-1 rounded text-xs font-mono text-gray-300 flex items-center gap-1.5">
          <GitBranch className="w-3.5 h-3.5 text-status-info" />
          <span>Branch: {gitStatus.branch}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Commit Form */}
        <form onSubmit={handleCommit} className="bg-bg-dark border border-border-subtle rounded-lg p-4 flex flex-col gap-3">
          <span className="font-semibold text-xs text-gray-200">Create Local Git Checkpoint</span>
          <textarea
            value={commitMsg}
            onChange={(e) => setCommitMsg(e.target.value)}
            placeholder="Commit message (e.g. feat(auth): add regex password validation)"
            className="w-full h-24 bg-bg-darkest text-xs text-gray-200 p-2 rounded border border-border-subtle outline-none resize-none focus:border-accent-mint font-sans"
          />
          <button
            type="submit"
            className="bg-accent-mint hover:bg-accent-mintHover text-bg-darkest font-semibold py-1.5 px-3 rounded text-xs flex items-center justify-center gap-1.5 self-start"
          >
            <GitCommit className="w-4 h-4" />
            <span>Create Checkpoint</span>
          </button>
          {staged && (
            <span className="text-status-pass text-xs flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> Checkpoint created!
            </span>
          )}
        </form>

        {/* Changes List */}
        <div className="bg-bg-dark border border-border-subtle rounded-lg p-4 flex flex-col gap-3">
          <span className="font-semibold text-xs text-gray-200">Changed Workspace Files ({gitStatus.modifiedFiles.length})</span>
          <div className="flex flex-col gap-1.5 font-mono text-xs">
            {gitStatus.modifiedFiles.length === 0 ? (
              <div className="text-gray-500 italic py-2">No uncommitted changes in workspace</div>
            ) : (
              gitStatus.modifiedFiles.map((file) => (
                <div key={file} className="bg-bg-panel p-2 rounded border border-border-subtle flex items-center justify-between text-gray-300">
                  <span className="flex items-center gap-2">
                    <FileCode className="w-3.5 h-3.5 text-status-warn" />
                    {file}
                  </span>
                  <span className="text-[10px] text-status-warn font-bold">MODIFIED</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

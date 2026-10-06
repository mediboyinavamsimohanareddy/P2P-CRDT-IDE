import { useState, useCallback } from 'react';

export interface GitStatus {
  branch: string;
  modifiedFiles: string[];
  untrackedFiles: string[];
  ahead: number;
  behind: number;
}

export function useGit() {
  const [gitStatus, setGitStatus] = useState<GitStatus>({
    branch: 'feature/auth-policy',
    modifiedFiles: ['LoginService.java', 'UserRepository.java'],
    untrackedFiles: [],
    ahead: 2,
    behind: 0,
  });

  const createCheckpoint = useCallback((commitMsg: string) => {
    if (!commitMsg.trim()) return false;
    setGitStatus((prev) => ({
      ...prev,
      modifiedFiles: [],
      ahead: prev.ahead + 1,
    }));
    return true;
  }, []);

  return {
    gitStatus,
    createCheckpoint,
  };
}

import { CrdtEngine } from '../crdt/CrdtEngine';

export interface PeerStateHash {
  peerId: string;
  hash: string;
  timestamp: number;
}

export class ConvergenceVerifier {
  private engine: CrdtEngine;
  private localPeerId: string;
  private remoteHashes = new Map<string, PeerStateHash>();

  constructor(engine: CrdtEngine, localPeerId: string) {
    this.engine = engine;
    this.localPeerId = localPeerId;
  }

  getLocalHash(): string {
    return this.engine.computeWorkspaceHash();
  }

  recordRemoteHash(peerId: string, hash: string): void {
    this.remoteHashes.set(peerId, {
      peerId,
      hash,
      timestamp: Date.now(),
    });
  }

  getPeerHashes(): PeerStateHash[] {
    const local: PeerStateHash = {
      peerId: `${this.localPeerId} (You)`,
      hash: this.getLocalHash(),
      timestamp: Date.now(),
    };
    return [local, ...Array.from(this.remoteHashes.values())];
  }

  isConverged(): boolean {
    const localHash = this.getLocalHash();
    if (this.remoteHashes.size === 0) return true; // Single replica trivially converged

    for (const remote of this.remoteHashes.values()) {
      if (remote.hash !== localHash) {
        return false;
      }
    }
    return true;
  }
}

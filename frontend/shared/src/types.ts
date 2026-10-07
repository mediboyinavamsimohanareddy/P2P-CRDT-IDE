export type Role = 'Owner' | 'Developer' | 'Reviewer' | 'Observer';

export interface PeerIdentity {
  peerId: string; // Ed25519 public key fingerprint
  displayName: string;
  role: Role;
}

export interface Frame {
  v: number;
  type: 'crdt.update' | 'crdt.syncStep1' | 'crdt.syncStep2' | 'hash.announce' | 'presence' | 'ai.proposal' | 'membership';
  projectId: string;
  from: string; // peerId
  opId: string; // uuid-v7
  lamport: number;
  ts: number;
  payload: string; // base64 ciphertext
  sig: string; // ed25519 signature
}

export interface Op {
  id: string;
  type: 'insert' | 'update' | 'delete' | 'rename';
  path: string;
  content?: string;
  authorId: string;
  timestamp: number;
}

export interface SecurityEvent {
  id: string;
  timestamp: number;
  peerId: string;
  reason: 'Invalid signature' | 'Not a member' | 'Payload modified' | 'Duplicate operation' | 'Malformed payload' | 'Unauthorized operation';
  status: 'REJECTED' | 'verified';
  details?: string;
}

export interface ConflictVersion {
  authorId: string;
  opHash: string;
  codeSnippet: string;
  line: number;
  branchOrFeature?: string;
}

export interface Conflict {
  id: string;
  filePath: string;
  detectedAt: number;
  versions: ConflictVersion[];
  baseSnippet: string;
}

export interface Proposal {
  id: string;
  conflictId: string;
  proposedCode: string;
  rationale: string;
  confidence: number; // 0-100
  model: string;
  contextHash: string;
  status: 'pending' | 'accepted' | 'rejected';
  generatedAt: number;
}

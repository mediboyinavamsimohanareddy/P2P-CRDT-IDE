export type Role = 'Owner' | 'Developer' | 'Reviewer' | 'Observer';
export interface PeerIdentity {
    peerId: string;
    displayName: string;
    role: Role;
}
export interface Frame {
    v: number;
    type: 'crdt.update' | 'crdt.syncStep1' | 'crdt.syncStep2' | 'hash.announce' | 'presence' | 'ai.proposal' | 'membership';
    projectId: string;
    from: string;
    opId: string;
    lamport: number;
    ts: number;
    payload: string;
    sig: string;
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
    reason: 'Invalid signature' | 'Not a member' | 'Payload modified' | 'Duplicate operation' | 'Malformed payload';
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
    confidence: number;
    model: string;
    contextHash: string;
    status: 'pending' | 'accepted' | 'rejected';
    generatedAt: number;
}

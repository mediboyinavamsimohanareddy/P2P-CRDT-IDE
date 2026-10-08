import { z } from 'zod';
export const RoleSchema = z.enum(['Owner', 'Developer', 'Reviewer', 'Observer']);
export const PeerIdentitySchema = z.object({
    peerId: z.string().min(1),
    displayName: z.string().min(1),
    role: RoleSchema,
});
export const FrameSchema = z.object({
    v: z.literal(1),
    type: z.enum([
        'crdt.update',
        'crdt.syncStep1',
        'crdt.syncStep2',
        'hash.announce',
        'presence',
        'ai.proposal',
        'membership',
    ]),
    projectId: z.string().min(1),
    from: z.string().min(1),
    opId: z.string().uuid(),
    lamport: z.number().int().nonnegative(),
    ts: z.number().int().positive(),
    payload: z.string(), // base64
    sig: z.string(),
});
export const OpSchema = z.object({
    id: z.string().min(1),
    type: z.enum(['insert', 'update', 'delete', 'rename']),
    path: z.string().min(1),
    content: z.string().optional(),
    authorId: z.string().min(1),
    timestamp: z.number().int().positive(),
});
export const SecurityEventSchema = z.object({
    id: z.string().min(1),
    timestamp: z.number().int().positive(),
    peerId: z.string().min(1),
    reason: z.enum([
        'Invalid signature',
        'Not a member',
        'Payload modified',
        'Duplicate operation',
        'Malformed payload',
    ]),
    status: z.enum(['REJECTED', 'verified']),
    details: z.string().optional(),
});
export const ConflictVersionSchema = z.object({
    authorId: z.string().min(1),
    opHash: z.string().min(1),
    codeSnippet: z.string(),
    line: z.number().int().nonnegative(),
    branchOrFeature: z.string().optional(),
});
export const ConflictSchema = z.object({
    id: z.string().min(1),
    filePath: z.string().min(1),
    detectedAt: z.number().int().positive(),
    versions: z.array(ConflictVersionSchema).min(2),
    baseSnippet: z.string(),
});
export const ProposalSchema = z.object({
    id: z.string().min(1),
    conflictId: z.string().min(1),
    proposedCode: z.string(),
    rationale: z.string(),
    confidence: z.number().min(0).max(100),
    model: z.string().min(1),
    contextHash: z.string().min(1),
    status: z.enum(['pending', 'accepted', 'rejected']),
    generatedAt: z.number().int().positive(),
});

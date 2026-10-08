import { z } from 'zod';
export declare const RoleSchema: z.ZodEnum<["Owner", "Developer", "Reviewer", "Observer"]>;
export declare const PeerIdentitySchema: z.ZodObject<{
    peerId: z.ZodString;
    displayName: z.ZodString;
    role: z.ZodEnum<["Owner", "Developer", "Reviewer", "Observer"]>;
}, "strip", z.ZodTypeAny, {
    peerId: string;
    role: "Owner" | "Developer" | "Reviewer" | "Observer";
    displayName: string;
}, {
    peerId: string;
    role: "Owner" | "Developer" | "Reviewer" | "Observer";
    displayName: string;
}>;
export declare const FrameSchema: z.ZodObject<{
    v: z.ZodLiteral<1>;
    type: z.ZodEnum<["crdt.update", "crdt.syncStep1", "crdt.syncStep2", "hash.announce", "presence", "ai.proposal", "membership"]>;
    projectId: z.ZodString;
    from: z.ZodString;
    opId: z.ZodString;
    lamport: z.ZodNumber;
    ts: z.ZodNumber;
    payload: z.ZodString;
    sig: z.ZodString;
}, "strip", z.ZodTypeAny, {
    from: string;
    type: "crdt.update" | "crdt.syncStep1" | "crdt.syncStep2" | "hash.announce" | "presence" | "ai.proposal" | "membership";
    v: 1;
    projectId: string;
    opId: string;
    lamport: number;
    ts: number;
    payload: string;
    sig: string;
}, {
    from: string;
    type: "crdt.update" | "crdt.syncStep1" | "crdt.syncStep2" | "hash.announce" | "presence" | "ai.proposal" | "membership";
    v: 1;
    projectId: string;
    opId: string;
    lamport: number;
    ts: number;
    payload: string;
    sig: string;
}>;
export declare const OpSchema: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodEnum<["insert", "update", "delete", "rename"]>;
    path: z.ZodString;
    content: z.ZodOptional<z.ZodString>;
    authorId: z.ZodString;
    timestamp: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    type: "update" | "insert" | "delete" | "rename";
    id: string;
    path: string;
    authorId: string;
    timestamp: number;
    content?: string | undefined;
}, {
    type: "update" | "insert" | "delete" | "rename";
    id: string;
    path: string;
    authorId: string;
    timestamp: number;
    content?: string | undefined;
}>;
export declare const SecurityEventSchema: z.ZodObject<{
    id: z.ZodString;
    timestamp: z.ZodNumber;
    peerId: z.ZodString;
    reason: z.ZodEnum<["Invalid signature", "Not a member", "Payload modified", "Duplicate operation", "Malformed payload"]>;
    status: z.ZodEnum<["REJECTED", "verified"]>;
    details: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    peerId: string;
    id: string;
    status: "REJECTED" | "verified";
    timestamp: number;
    reason: "Invalid signature" | "Not a member" | "Payload modified" | "Duplicate operation" | "Malformed payload";
    details?: string | undefined;
}, {
    peerId: string;
    id: string;
    status: "REJECTED" | "verified";
    timestamp: number;
    reason: "Invalid signature" | "Not a member" | "Payload modified" | "Duplicate operation" | "Malformed payload";
    details?: string | undefined;
}>;
export declare const ConflictVersionSchema: z.ZodObject<{
    authorId: z.ZodString;
    opHash: z.ZodString;
    codeSnippet: z.ZodString;
    line: z.ZodNumber;
    branchOrFeature: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    authorId: string;
    opHash: string;
    codeSnippet: string;
    line: number;
    branchOrFeature?: string | undefined;
}, {
    authorId: string;
    opHash: string;
    codeSnippet: string;
    line: number;
    branchOrFeature?: string | undefined;
}>;
export declare const ConflictSchema: z.ZodObject<{
    id: z.ZodString;
    filePath: z.ZodString;
    detectedAt: z.ZodNumber;
    versions: z.ZodArray<z.ZodObject<{
        authorId: z.ZodString;
        opHash: z.ZodString;
        codeSnippet: z.ZodString;
        line: z.ZodNumber;
        branchOrFeature: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        authorId: string;
        opHash: string;
        codeSnippet: string;
        line: number;
        branchOrFeature?: string | undefined;
    }, {
        authorId: string;
        opHash: string;
        codeSnippet: string;
        line: number;
        branchOrFeature?: string | undefined;
    }>, "many">;
    baseSnippet: z.ZodString;
}, "strip", z.ZodTypeAny, {
    id: string;
    filePath: string;
    detectedAt: number;
    versions: {
        authorId: string;
        opHash: string;
        codeSnippet: string;
        line: number;
        branchOrFeature?: string | undefined;
    }[];
    baseSnippet: string;
}, {
    id: string;
    filePath: string;
    detectedAt: number;
    versions: {
        authorId: string;
        opHash: string;
        codeSnippet: string;
        line: number;
        branchOrFeature?: string | undefined;
    }[];
    baseSnippet: string;
}>;
export declare const ProposalSchema: z.ZodObject<{
    id: z.ZodString;
    conflictId: z.ZodString;
    proposedCode: z.ZodString;
    rationale: z.ZodString;
    confidence: z.ZodNumber;
    model: z.ZodString;
    contextHash: z.ZodString;
    status: z.ZodEnum<["pending", "accepted", "rejected"]>;
    generatedAt: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    id: string;
    status: "pending" | "accepted" | "rejected";
    conflictId: string;
    proposedCode: string;
    rationale: string;
    confidence: number;
    model: string;
    contextHash: string;
    generatedAt: number;
}, {
    id: string;
    status: "pending" | "accepted" | "rejected";
    conflictId: string;
    proposedCode: string;
    rationale: string;
    confidence: number;
    model: string;
    contextHash: string;
    generatedAt: number;
}>;

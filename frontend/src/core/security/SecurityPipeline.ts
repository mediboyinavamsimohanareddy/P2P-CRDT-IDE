import { Frame, SecurityEvent } from '@decentraide/shared';
import { FrameSchema } from '@decentraide/shared';
import { SecurityManager, SymmetricKey } from './SecurityManager';

export interface MembershipList {
  projectId: string;
  ownerPeerId: string;
  members: Map<string, { role: 'Owner' | 'Developer' | 'Reviewer' | 'Observer'; publicKeyPem: string }>;
  ownerSignature: string;
}

export class SecurityPipeline {
  private membership: MembershipList;
  private seenOpIds = new Set<string>();
  private projectKey: SymmetricKey;
  private onSecurityEvent?: (event: SecurityEvent) => void;

  constructor(
    membership: MembershipList,
    projectKey: SymmetricKey,
    onSecurityEvent?: (event: SecurityEvent) => void
  ) {
    this.membership = membership;
    this.projectKey = projectKey;
    this.onSecurityEvent = onSecurityEvent;
  }

  setProjectKey(key: SymmetricKey): void {
    this.projectKey = key;
  }

  addMember(peerId: string, publicKeyPem: string, role: 'Owner' | 'Developer' | 'Reviewer' | 'Observer' = 'Developer'): void {
    this.membership.members.set(peerId, { role, publicKeyPem });
  }

  getMembership(): MembershipList {
    return this.membership;
  }

  processIncomingFrame(rawFrame: unknown): {
    success: boolean;
    decryptedPayload?: string;
    reason?: string;
    type?: Frame['type'];
    from?: string;
  } {
    // Stage 1: Schema Check
    const parseResult = FrameSchema.safeParse(rawFrame);
    if (!parseResult.success) {
      this.emitEvent('Malformed payload', 'REJECTED', 'Frame schema validation failed');
      return { success: false, reason: 'Malformed payload' };
    }

    const frame: Frame = parseResult.data;

    // Stage 2: Replay / Duplicate Check
    if (this.seenOpIds.has(frame.opId)) {
      this.emitEvent('Duplicate operation', 'REJECTED', `Duplicate opId: ${frame.opId}`, frame.from);
      return { success: false, reason: 'Duplicate operation' };
    }

    // Stage 3: Membership & Role Check
    const member = this.membership.members.get(frame.from);
    if (!member) {
      this.emitEvent('Not a member', 'REJECTED', `Peer ${frame.from} not in project membership`, frame.from);
      return { success: false, reason: 'Not a member' };
    }
    if (member.role === 'Observer' && frame.type === 'crdt.update') {
      this.emitEvent('Unauthorized operation', 'REJECTED', `Observer ${frame.from} cannot write`, frame.from);
      return { success: false, reason: 'Unauthorized operation' };
    }

    // Stage 4: Signature Verification
    const isValidSig = SecurityManager.verifySignature(frame.payload, frame.sig, member.publicKeyPem);
    if (!isValidSig) {
      this.emitEvent('Invalid signature', 'REJECTED', 'Ed25519 signature verification failed', frame.from);
      return { success: false, reason: 'Invalid signature' };
    }

    // Stage 5: Decryption
    try {
      const payloadObj = JSON.parse(frame.payload);
      const decrypted = SecurityManager.decrypt(
        payloadObj.ciphertext,
        payloadObj.nonce,
        payloadObj.authTag,
        this.projectKey
      );

      this.seenOpIds.add(frame.opId);
      return { success: true, decryptedPayload: decrypted, type: frame.type, from: frame.from };
    } catch {
      this.emitEvent('Payload modified', 'REJECTED', 'Decryption or auth tag verification failed', frame.from);
      return { success: false, reason: 'Payload modified' };
    }
  }

  private emitEvent(
    reason: SecurityEvent['reason'],
    status: SecurityEvent['status'],
    details: string,
    peerId: string = 'unknown'
  ): void {
    const event: SecurityEvent = {
      id: `sec-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
      peerId,
      reason,
      status,
      details,
    };
    this.onSecurityEvent?.(event);
  }
}

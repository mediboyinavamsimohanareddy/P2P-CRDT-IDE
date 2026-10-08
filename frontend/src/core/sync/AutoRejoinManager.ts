import { SessionStatusStore } from './SessionStatusStore';
import { SignalingConfig } from './SignalingConfig';
import { joinRoom } from './roomApi';
import { LocalPersistenceManager, OfflineSessionDraft } from '../../services/LocalPersistenceManager';

export interface AutoRejoinConfig {
  maxRetries?: number;
  initialBackoffMs?: number;
  maxBackoffMs?: number;
}

export class AutoRejoinManager {
  private static instance: AutoRejoinManager;

  private isRejoining = false;
  private retryCount = 0;
  private maxRetries = 10;
  private initialBackoffMs = 1000;
  private maxBackoffMs = 16000;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private onlineListenerAttached = false;

  private onTriggerRejoin?: (session: { roomId: string; isHost: boolean; signalingHost?: string }) => Promise<void>;
  private onOfflineCodeRecovered?: (draft: OfflineSessionDraft) => void;

  public static getInstance(): AutoRejoinManager {
    if (!AutoRejoinManager.instance) {
      AutoRejoinManager.instance = new AutoRejoinManager();
    }
    return AutoRejoinManager.instance;
  }

  constructor(config?: AutoRejoinConfig) {
    if (config?.maxRetries !== undefined) this.maxRetries = config.maxRetries;
    if (config?.initialBackoffMs !== undefined) this.initialBackoffMs = config.initialBackoffMs;
    if (config?.maxBackoffMs !== undefined) this.maxBackoffMs = config.maxBackoffMs;

    this.attachWindowListeners();
  }

  public setTriggerRejoinHandler(
    handler: (session: { roomId: string; isHost: boolean; signalingHost?: string }) => Promise<void>
  ): void {
    this.onTriggerRejoin = handler;
  }

  public setOfflineCodeRecoveredHandler(
    handler: (draft: OfflineSessionDraft) => void
  ): void {
    this.onOfflineCodeRecovered = handler;
  }

  public attachWindowListeners(): void {
    if (typeof window === 'undefined' || this.onlineListenerAttached) return;

    window.addEventListener('online', () => {
      console.log('[AutoRejoinManager] Network online event detected - restoring session');
      this.handleNetworkRecovery();
    });

    window.addEventListener('offline', () => {
      console.log('[AutoRejoinManager] Network offline event detected - caching session to localStorage');
      this.handleNetworkLoss();
    });

    this.onlineListenerAttached = true;
  }

  public handleNetworkLoss(): void {
    const status = SessionStatusStore.getInstance().get();
    SessionStatusStore.getInstance().patch({
      phase: 'disconnected',
      converged: false,
    });

    // Mirror current state into DevTools-visible localStorage
    const persistence = new LocalPersistenceManager('.');
    const activeRoomId = status.roomId || persistence.getActiveRoomId() || '';
    const cachedCode = persistence.getCachedCode() || '';
    if (activeRoomId) {
      persistence.saveDevToolsOfflineDraft({
        roomId: activeRoomId,
        peerId: 'local-offline-user',
        code: cachedCode,
        filePath: 'Main.java',
        isHost: status.isHost,
        lastSavedAt: Date.now(),
        isOffline: true,
      });
    }
  }

  public handleNetworkRecovery(): void {
    if (this.isRejoining) return;
    this.resetRetryCount();
    this.scheduleRejoin(0);
  }

  public scheduleRejoin(delayMs?: number): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    if (this.retryCount >= this.maxRetries) {
      console.warn('[AutoRejoinManager] Max rejoin retries reached:', this.maxRetries);
      SessionStatusStore.getInstance().patch({ phase: 'disconnected' });
      this.isRejoining = false;
      return;
    }

    const backoff =
      delayMs !== undefined
        ? delayMs
        : Math.min(this.initialBackoffMs * Math.pow(2, this.retryCount), this.maxBackoffMs);

    this.isRejoining = true;
    SessionStatusStore.getInstance().patch({ phase: 'reconnecting' });

    this.retryTimer = setTimeout(() => {
      this.attemptRejoin();
    }, backoff);
  }

  public async attemptRejoin(): Promise<boolean> {
    if (!this.onTriggerRejoin) {
      this.isRejoining = false;
      return false;
    }

    this.retryCount++;
    SessionStatusStore.getInstance().patch({ phase: 'rejoining' });

    // Read stored room ID and draft from DevTools localStorage
    const persistence = new LocalPersistenceManager('.');
    const draft = persistence.getDevToolsOfflineDraft();
    const storedRoomId = draft?.roomId || SessionStatusStore.getInstance().get().roomId || persistence.getActiveRoomId() || '';

    try {
      // Trigger rejoin callback provided by CollaborationManager
      await this.onTriggerRejoin({
        roomId: storedRoomId,
        isHost: draft ? draft.isHost : SessionStatusStore.getInstance().get().isHost,
        signalingHost: SignalingConfig.getInstance().getHost() || undefined,
      });

      this.isRejoining = false;

      // If user had offline code in localStorage, forward it to the conflict detector
      if (draft && draft.code) {
        if (this.onOfflineCodeRecovered) {
          this.onOfflineCodeRecovered(draft);
        }
      }

      return true;
    } catch (e) {
      console.warn(`[AutoRejoinManager] Rejoin attempt ${this.retryCount} failed:`, e);
      SessionStatusStore.getInstance().patch({ phase: 'disconnected' });
      this.scheduleRejoin();
      return false;
    }
  }

  public resetRetryCount(): void {
    this.retryCount = 0;
    this.isRejoining = false;
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  public cancel(): void {
    this.resetRetryCount();
  }

  public getIsRejoining(): boolean {
    return this.isRejoining;
  }

  public getRetryCount(): number {
    return this.retryCount;
  }
}

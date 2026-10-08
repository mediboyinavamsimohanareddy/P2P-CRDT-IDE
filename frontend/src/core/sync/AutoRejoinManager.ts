import { SessionStatusStore } from './SessionStatusStore';
import { SignalingConfig } from './SignalingConfig';
import { joinRoom } from './roomApi';

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

  public attachWindowListeners(): void {
    if (typeof window === 'undefined' || this.onlineListenerAttached) return;

    window.addEventListener('online', () => {
      console.log('[AutoRejoinManager] Network online event detected');
      this.handleNetworkRecovery();
    });

    window.addEventListener('offline', () => {
      console.log('[AutoRejoinManager] Network offline event detected');
      this.handleNetworkLoss();
    });

    this.onlineListenerAttached = true;
  }

  public handleNetworkLoss(): void {
    SessionStatusStore.getInstance().patch({
      phase: 'disconnected',
      converged: false,
    });
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

    try {
      // Trigger rejoin callback provided by CollaborationManager
      await this.onTriggerRejoin({
        roomId: SessionStatusStore.getInstance().get().roomId || '',
        isHost: SessionStatusStore.getInstance().get().isHost,
        signalingHost: SignalingConfig.getInstance().getHost() || undefined,
      });

      this.isRejoining = false;
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

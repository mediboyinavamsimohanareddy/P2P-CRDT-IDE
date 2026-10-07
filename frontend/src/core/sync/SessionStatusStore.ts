export type SessionPhase =
  | 'idle'
  | 'signaling'
  | 'connecting'
  | 'connected'
  | 'verified'
  | 'ice-failed'
  | 'lan-relay'
  | 'local';

export interface SessionStatus {
  phase: SessionPhase;
  roomId: string | null;
  lanAddress: string | null;
  joinUrl: string | null;
  iceFailedReason: string | null;
  bluetoothNote: string;
  localHash: string | null;
  remoteHash: string | null;
  converged: boolean;
  isHost: boolean;
}

const DEFAULT: SessionStatus = {
  phase: 'idle',
  roomId: null,
  lanAddress: null,
  joinUrl: null,
  iceFailedReason: null,
  bluetoothNote: 'Bluetooth GATT cannot open a laptop-to-laptop socket; nearby path is Wi-Fi WebRTC.',
  localHash: null,
  remoteHash: null,
  converged: false,
  isHost: false,
};

export class SessionStatusStore {
  private static instance: SessionStatusStore;
  private status: SessionStatus = { ...DEFAULT };
  private listeners: Array<() => void> = [];

  static getInstance(): SessionStatusStore {
    if (!SessionStatusStore.instance) {
      SessionStatusStore.instance = new SessionStatusStore();
    }
    return SessionStatusStore.instance;
  }

  get(): SessionStatus {
    return { ...this.status };
  }

  patch(partial: Partial<SessionStatus>): void {
    this.status = { ...this.status, ...partial };
    this.listeners.forEach((l) => l());
  }

  reset(): void {
    this.status = { ...DEFAULT };
    this.listeners.forEach((l) => l());
  }

  subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }
}

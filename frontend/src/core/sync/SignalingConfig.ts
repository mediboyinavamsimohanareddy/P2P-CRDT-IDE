/**
 * Resolves HTTP and WebSocket URLs for the host laptop's Spring Boot signaling process.
 * Empty override = same origin (Vite proxy or host serving the UI on LAN).
 */
export class SignalingConfig {
  private static instance: SignalingConfig;
  private hostOverride: string | null = null;

  static getInstance(): SignalingConfig {
    if (!SignalingConfig.instance) {
      SignalingConfig.instance = new SignalingConfig();
    }
    return SignalingConfig.instance;
  }

  /**
   * @param host IP or host:port of the Spring Boot node, e.g. "192.168.1.14" or "192.168.1.14:8082"
   */
  setHost(host: string | null): void {
    if (!host || !host.trim()) {
      this.hostOverride = null;
      return;
    }
    let cleaned = host.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (!cleaned.includes(':')) {
      cleaned = `${cleaned}:8082`;
    }
    this.hostOverride = cleaned;
  }

  getHost(): string | null {
    return this.hostOverride;
  }

  apiUrl(path: string): string {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    if (this.hostOverride) {
      return `http://${this.hostOverride}${normalized}`;
    }
    return normalized;
  }

  signalingWsUrl(): string {
    if (this.hostOverride) {
      return `ws://${this.hostOverride}/ws/signaling`;
    }
    if (typeof window !== 'undefined' && window.location?.host) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${protocol}//${window.location.host}/ws/signaling`;
    }
    return 'ws://localhost:8082/ws/signaling';
  }

  lanRelayWsUrl(roomId: string): string {
    const encoded = encodeURIComponent(roomId.toUpperCase());
    if (this.hostOverride) {
      return `ws://${this.hostOverride}/ws/lan-relay?roomId=${encoded}`;
    }
    if (typeof window !== 'undefined' && window.location?.host) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${protocol}//${window.location.host}/ws/lan-relay?roomId=${encoded}`;
    }
    return `ws://localhost:8082/ws/lan-relay?roomId=${encoded}`;
  }
}

export async function fetchLanInfo(): Promise<{
  primaryAddress: string;
  addresses: string[];
  port: number;
  joinHint: string;
} | null> {
  try {
    const res = await fetch(SignalingConfig.getInstance().apiUrl('/api/runtime/lan-info'));
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.success) return null;
    return {
      primaryAddress: data.primaryAddress,
      addresses: data.addresses || [],
      port: data.port || 8082,
      joinHint: data.inviteHint || '',
    };
  } catch {
    return null;
  }
}

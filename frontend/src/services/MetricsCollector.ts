export interface SystemMetrics {
  peerCount: number;
  connectedPeers: number;
  offlinePeers: number;
  operationCount: number;
  receivedOps: number;
  pendingOps: number;
  duplicateOps: number;
  rejectedOps: number;
  syncLatencyMs: number;
  reconnectTimeMs: number;
  verificationTimeMs: number;
  buildDurationMs: number;
  testDurationMs: number;
}

export class MetricsCollector {
  private static instance: MetricsCollector;
  private metrics: SystemMetrics = {
    peerCount: 3,
    connectedPeers: 3,
    offlinePeers: 0,
    operationCount: 184,
    receivedOps: 142,
    pendingOps: 0,
    duplicateOps: 12,
    rejectedOps: 3,
    syncLatencyMs: 18,
    reconnectTimeMs: 420,
    verificationTimeMs: 1240,
    buildDurationMs: 840,
    testDurationMs: 2400,
  };

  private listeners: Array<() => void> = [];

  public static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  getMetrics(): SystemMetrics {
    return { ...this.metrics };
  }

  updateMetrics(partial: Partial<SystemMetrics>): void {
    this.metrics = { ...this.metrics, ...partial };
    this.listeners.forEach((l) => l());
  }

  subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }
}

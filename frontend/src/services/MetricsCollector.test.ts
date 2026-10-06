import { describe, it, expect } from 'vitest';
import { MetricsCollector } from './MetricsCollector';

describe('MetricsCollector', () => {
  it('collects and updates runtime system metrics cleanly', () => {
    const collector = MetricsCollector.getInstance();
    collector.updateMetrics({ pendingOps: 12, offlinePeers: 1 });

    const m = collector.getMetrics();
    expect(m.pendingOps).toBe(12);
    expect(m.offlinePeers).toBe(1);
  });
});

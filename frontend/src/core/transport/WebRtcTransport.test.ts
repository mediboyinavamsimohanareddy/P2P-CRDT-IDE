import { describe, it, expect } from 'vitest';
import { WebRtcTransport } from './WebRtcTransport';

describe('WebRtcTransport', () => {
  it('instantiates cleanly with local peer and room id', () => {
    const transport = new WebRtcTransport('peer-laptop-a', 'DB-72A91');
    expect(transport.id).toBe('webrtc');
    const stats = transport.stats();
    expect(stats.bytesIn).toBe(0);
    expect(stats.bytesOut).toBe(0);
  });
});

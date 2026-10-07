import React, { useState, useEffect } from 'react';
import { Wifi, ArrowDownUp, CheckCircle2, ShieldAlert } from 'lucide-react';
import { TransportManager } from '../core/transport/TransportManager';

export interface StatusBarProps {
  transportManager?: TransportManager;
}

export const StatusBar: React.FC<StatusBarProps> = ({ transportManager }) => {
  const [activeTransport, setActiveTransport] = useState<string>('WebRTC');
  const [stats, setStats] = useState({ rttMs: 18, bytesIn: 1024, bytesOut: 2048 });

  useEffect(() => {
    if (!transportManager) return;

    const updateState = () => {
      const type = transportManager.getActiveTransportType();
      if (type === 'webrtc') setActiveTransport('Online · WebRTC');
      else if (type === 'lan') setActiveTransport('Nearby · LAN / Wi-Fi');
      else if (type === 'bluetooth') setActiveTransport('Nearby · Web Bluetooth');
      else setActiveTransport('Offline · Local Mode');

      setStats(transportManager.getAggregateStats());
    };

    updateState();
    transportManager.onActiveTransportChanged(updateState);
    const interval = setInterval(updateState, 2000);

    return () => clearInterval(interval);
  }, [transportManager]);

  return (
    <div
      data-testid="status-bar"
      className="h-6 bg-accent-mint text-bg-darkest flex items-center justify-between px-3 text-[10px] font-medium select-none"
    >
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 cursor-pointer hover:bg-black/10 px-1.5 py-0.5 rounded">
          <Wifi className="w-3 h-3" />
          <span className="font-bold">{activeTransport}</span>
        </div>
        <div className="flex items-center gap-1.5 cursor-pointer hover:bg-black/10 px-1.5 py-0.5 rounded">
          <ArrowDownUp className="w-3 h-3" />
          <span>RTT {stats.rttMs} ms · ↑ {(stats.bytesOut / 1024).toFixed(1)} KB ↓ {(stats.bytesIn / 1024).toFixed(1)} KB</span>
        </div>
        <div className="flex items-center gap-1.5 cursor-pointer hover:bg-black/10 px-1.5 py-0.5 rounded">
          <CheckCircle2 className="w-3 h-3" />
          <span>Offline-ready · local-first</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <span className="cursor-pointer hover:bg-black/10 px-1.5 py-0.5 rounded">Java</span>
        <span className="cursor-pointer hover:bg-black/10 px-1.5 py-0.5 rounded">UTF-8</span>
        <span className="cursor-pointer hover:bg-black/10 px-1.5 py-0.5 rounded">Ln 4, Col 12</span>
        <span className="cursor-pointer hover:bg-black/10 px-1.5 py-0.5 rounded font-bold">Build passing</span>
        <span className="cursor-pointer hover:bg-black/10 px-1.5 py-0.5 rounded">DecentraIDE v0.1.0</span>
      </div>
    </div>
  );
};

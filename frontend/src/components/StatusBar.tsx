import React from 'react';
import { Wifi, ArrowDownUp, CheckCircle2 } from 'lucide-react';

export const StatusBar: React.FC = () => {
  return (
    <div
      data-testid="status-bar"
      className="h-6 bg-accent-mint text-bg-darkest flex items-center justify-between px-3 text-[10px] font-medium select-none"
    >
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 cursor-pointer hover:bg-black/10 px-1.5 py-0.5 rounded">
          <Wifi className="w-3 h-3" />
          <span>LAN / WebRTC</span>
        </div>
        <div className="flex items-center gap-1.5 cursor-pointer hover:bg-black/10 px-1.5 py-0.5 rounded">
          <ArrowDownUp className="w-3 h-3" />
          <span>RTT 24 ms · ↑ 12 KB/s ↓ 4 KB/s</span>
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

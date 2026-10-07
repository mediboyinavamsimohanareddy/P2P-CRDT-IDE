import React, { useState } from 'react';
import { Shield, AlertOctagon, CheckCircle2, UserCheck, Play, RefreshCw, XCircle } from 'lucide-react';
import { SecurityEvent } from '@decentraide/shared';

export const SecurityMonitorView: React.FC = () => {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [verifiedCount, setVerifiedCount] = useState<number>(0);

  return (
    <div className="flex-1 bg-bg-darkest text-gray-200 p-6 flex flex-col gap-6 overflow-y-auto font-sans">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-border-subtle pb-4">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2 text-status-pass">
            <Shield className="w-5 h-5" />
            Security &amp; Defense Monitor
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Real-time zero-trust security pipeline audit log and peer trust verification status.
          </p>
        </div>
      </div>

      {/* Counters Bar */}
      <div className="grid grid-cols-5 gap-3">
        <div className="bg-bg-dark border border-border-subtle p-3 rounded flex flex-col">
          <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Forged Ops</span>
          <span className="text-xl font-bold text-status-error font-mono">
            {events.filter((e) => e.reason === 'Invalid signature').length}
          </span>
        </div>
        <div className="bg-bg-dark border border-border-subtle p-3 rounded flex flex-col">
          <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Unauthorized</span>
          <span className="text-xl font-bold text-status-warn font-mono">
            {events.filter((e) => e.reason === 'Not a member').length}
          </span>
        </div>
        <div className="bg-bg-dark border border-border-subtle p-3 rounded flex flex-col">
          <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Duplicates Ignored</span>
          <span className="text-xl font-bold text-status-info font-mono">
            {events.filter((e) => e.reason === 'Duplicate operation').length}
          </span>
        </div>
        <div className="bg-bg-dark border border-border-subtle p-3 rounded flex flex-col">
          <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Total Verified</span>
          <span className="text-xl font-bold text-status-pass font-mono">{verifiedCount}</span>
        </div>
        <div className="bg-bg-dark border border-border-subtle p-3 rounded flex flex-col">
          <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">Total Rejected</span>
          <span className="text-xl font-bold text-status-error font-mono">{events.length}</span>
        </div>
      </div>

      {/* Events Table */}
      <div className="bg-bg-dark border border-border-subtle rounded-lg p-4 flex flex-col gap-3">
        <div className="text-xs font-semibold text-gray-200 border-b border-border-subtle pb-2 flex justify-between items-center">
          <span>Rejected Security Events Log</span>
          <span className="text-[10px] text-gray-500 font-mono">Live 5-Stage Pipeline Filter</span>
        </div>

        <div className="flex flex-col gap-2 overflow-y-auto max-h-96">
          {events.length === 0 ? (
            <div className="text-center text-gray-500 text-xs py-8 italic">
              No rejected security events. Zero-trust pipeline active.
            </div>
          ) : (
            events.map((evt) => (
              <div key={evt.id} className="bg-bg-panel p-2.5 rounded border border-border-subtle flex flex-col gap-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-status-error flex items-center gap-1.5">
                    <XCircle className="w-3.5 h-3.5" />
                    {evt.reason}
                  </span>
                  <span className="text-[10px] font-mono text-gray-500">
                    {new Date(evt.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className="text-[11px] text-gray-400 font-mono">
                  Peer: <span className="text-gray-200">{evt.peerId}</span>
                </div>
                <div className="text-[10px] text-gray-500">{evt.details}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

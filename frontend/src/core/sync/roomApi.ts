import { SignalingConfig } from './SignalingConfig';

export interface RoomApiResult {
  success: boolean;
  roomId?: string;
  error?: string;
  lanAddresses?: string[];
  primaryAddress?: string;
  joinUrl?: string;
  signalingPort?: number;
  hostPeerId?: string;
}

export async function createRoom(peerId: string, name = 'DecentraBank'): Promise<RoomApiResult> {
  const res = await fetch(SignalingConfig.getInstance().apiUrl('/api/rooms/create'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, peerId }),
  });
  if (!res.ok) {
    return { success: false, error: `Create room failed (${res.status})` };
  }
  return res.json();
}

export async function joinRoom(roomId: string, peerId: string): Promise<RoomApiResult> {
  const res = await fetch(SignalingConfig.getInstance().apiUrl('/api/rooms/join'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roomId: roomId.toUpperCase(), peerId }),
  });
  if (!res.ok) {
    return { success: false, error: `Join room failed (${res.status})` };
  }
  const data = (await res.json()) as RoomApiResult;
  if (!data.success) {
    return { success: false, error: data.error || 'Room ID not found' };
  }
  return data;
}

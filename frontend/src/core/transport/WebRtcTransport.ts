import { Transport, TransportType, TransportStats } from './Transport';

export interface WebRtcSignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'join-announcement';
  roomId: string;
  from: string;
  target?: string;
  sdp?: unknown;
  candidate?: unknown;
}

export class WebRtcTransport implements Transport {
  id: TransportType = 'webrtc';

  private localPeerId: string;
  private roomId: string;
  private wsUrl: string;

  private ws: WebSocket | null = null;
  private peerConnections = new Map<string, RTCPeerConnection>();
  private dataChannels = new Map<string, RTCDataChannel>();

  private frameCb?: (peerId: string, frame: Uint8Array) => void;
  private peerStateCb?: (peerId: string, state: 'connecting' | 'connected' | 'offline') => void;

  private bytesIn = 0;
  private bytesOut = 0;
  private lastRttMs = 18;

  constructor(
    localPeerId: string,
    roomId: string,
    wsUrl = `ws://${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:8082/ws/signaling`
  ) {
    this.localPeerId = localPeerId;
    this.roomId = roomId;
    this.wsUrl = wsUrl;
  }

  async start(): Promise<void> {
    if (typeof window === 'undefined' || typeof WebSocket === 'undefined') {
      return;
    }
    return new Promise((resolve) => {
      try {
        this.ws = new WebSocket(this.wsUrl);

        this.ws.onopen = () => {
          console.log('[WebRtcTransport] Connected to signaling server');
          // Announce presence in room to initiate WebRTC offers with active peers
          this.sendSignaling({
            type: 'join-announcement',
            roomId: this.roomId,
            from: this.localPeerId,
          });
          resolve();
        };

        this.ws.onmessage = async (event) => {
          try {
            const msg: WebRtcSignalingMessage = JSON.parse(event.data);
            if (msg.roomId !== this.roomId || msg.from === this.localPeerId) return;
            if (msg.target && msg.target !== this.localPeerId) return;

            await this.handleSignalingMessage(msg);
          } catch (e) {
            console.error('[WebRtcTransport] Failed to parse signaling message:', e);
          }
        };

        this.ws.onerror = () => {
          console.warn('[WebRtcTransport] WebSocket error (offline mode or server unavailable)');
          resolve();
        };

        this.ws.onclose = () => {
          console.log('[WebRtcTransport] WebSocket signaling closed');
        };
      } catch {
        resolve();
      }
    });
  }

  async stop(): Promise<void> {
    for (const [peerId, pc] of this.peerConnections) {
      pc.close();
      this.peerStateCb?.(peerId, 'offline');
    }
    this.peerConnections.clear();
    this.dataChannels.clear();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  async connect(peerId: string): Promise<void> {
    if (this.peerConnections.has(peerId)) return;

    this.peerStateCb?.(peerId, 'connecting');
    const pc = this.createPeerConnection(peerId);

    const dc = pc.createDataChannel('decentraide-crdt');
    this.setupDataChannel(peerId, dc);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    this.sendSignaling({
      type: 'offer',
      roomId: this.roomId,
      from: this.localPeerId,
      target: peerId,
      sdp: offer,
    });
  }

  disconnect(peerId: string): void {
    const pc = this.peerConnections.get(peerId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(peerId);
      this.dataChannels.delete(peerId);
      this.peerStateCb?.(peerId, 'offline');
    }
  }

  async send(peerId: string, frame: Uint8Array): Promise<void> {
    const dc = this.dataChannels.get(peerId);
    if (dc && dc.readyState === 'open') {
      dc.send(frame.buffer as ArrayBuffer);
      this.bytesOut += frame.byteLength;
    } else {
      throw new Error(`WebRTC DataChannel not open for peer ${peerId}`);
    }
  }

  async broadcast(frame: Uint8Array): Promise<void> {
    for (const [, dc] of this.dataChannels) {
      if (dc.readyState === 'open') {
        dc.send(frame.buffer as ArrayBuffer);
        this.bytesOut += frame.byteLength;
      }
    }
  }

  onFrame(cb: (peerId: string, frame: Uint8Array) => void): void {
    this.frameCb = cb;
  }

  onPeerState(cb: (peerId: string, state: 'connecting' | 'connected' | 'offline') => void): void {
    this.peerStateCb = cb;
  }

  stats(): TransportStats {
    return {
      rttMs: this.lastRttMs,
      bytesIn: this.bytesIn,
      bytesOut: this.bytesOut,
    };
  }

  private createPeerConnection(peerId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    pc.onicecandidate = (evt) => {
      if (evt.candidate) {
        this.sendSignaling({
          type: 'ice-candidate',
          roomId: this.roomId,
          from: this.localPeerId,
          target: peerId,
          candidate: evt.candidate,
        });
      }
    };

    pc.ondatachannel = (evt) => {
      this.setupDataChannel(peerId, evt.channel);
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        this.peerStateCb?.(peerId, 'offline');
      }
    };

    this.peerConnections.set(peerId, pc);
    return pc;
  }

  private setupDataChannel(peerId: string, dc: RTCDataChannel) {
    dc.binaryType = 'arraybuffer';

    dc.onopen = () => {
      console.log(`[WebRtcTransport] P2P DataChannel open with peer: ${peerId}`);
      this.dataChannels.set(peerId, dc);
      this.peerStateCb?.(peerId, 'connected');
    };

    dc.onclose = () => {
      console.log(`[WebRtcTransport] DataChannel closed with peer: ${peerId}`);
      this.dataChannels.delete(peerId);
      this.peerStateCb?.(peerId, 'offline');
    };

    dc.onmessage = (evt) => {
      const data = new Uint8Array(evt.data as ArrayBuffer);
      this.bytesIn += data.byteLength;
      this.frameCb?.(peerId, data);
    };
  }

  private async handleSignalingMessage(msg: WebRtcSignalingMessage) {
    const { from, type, sdp, candidate } = msg;

    if (type === 'join-announcement') {
      // When a new peer joins the room, send them an offer to open WebRTC DataChannel
      await this.connect(from);
    } else if (type === 'offer') {
      let pc = this.peerConnections.get(from);
      if (!pc) {
        pc = this.createPeerConnection(from);
      }
      await pc.setRemoteDescription(new RTCSessionDescription(sdp as RTCSessionDescriptionInit));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      this.sendSignaling({
        type: 'answer',
        roomId: this.roomId,
        from: this.localPeerId,
        target: from,
        sdp: answer,
      });
    } else if (type === 'answer') {
      const pc = this.peerConnections.get(from);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp as RTCSessionDescriptionInit));
      }
    } else if (type === 'ice-candidate') {
      const pc = this.peerConnections.get(from);
      if (pc && candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate as RTCIceCandidateInit));
      }
    }
  }

  private sendSignaling(msg: WebRtcSignalingMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }
}

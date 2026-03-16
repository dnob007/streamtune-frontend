import { WS_URL } from './api';
import type { LiveState, ChatMessage } from '../types';

type SyncHandler   = (state: LiveState) => void;
type ChatHandler   = (msg: ChatMessage) => void;
type SystemHandler = (body: string) => void;
type ViewerHandler = (count: number) => void;

class StreamTuneWS {
  private ws:        WebSocket | null = null;
  private slug:      string = '';
  private token:     string | null = null;
  private retries:   number = 0;
  private stopped:   boolean = false;
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  onSync:   SyncHandler   = () => {};
  onChat:   ChatHandler   = () => {};
  onSystem: SystemHandler = () => {};
  onViewer: ViewerHandler = () => {};

  connect(slug: string, token: string | null = null) {
    this.slug    = slug;
    this.token   = token;
    this.retries = 0;
    this.stopped = false;
    this._connect();
  }

  private _connect() {
    if (this.stopped) return;

    const url = this.token
      ? `${WS_URL}/${this.slug}?token=${this.token}`
      : `${WS_URL}/${this.slug}`;

    try {
      this.ws = new WebSocket(url);
    } catch { return; }

    this.ws.onopen = () => {
      this.retries = 0;
      this.pingTimer = setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'pong' }));
        }
      }, 5000);
    };

    this.ws.onmessage = ({ data }) => {
      try {
        const msg = JSON.parse(data);
        switch (msg.type) {
          case 'sync':
            this.onSync(msg as LiveState & { viewers?: number });
            if (typeof msg.viewers === 'number') this.onViewer(msg.viewers);
            break;
          case 'chat':   this.onChat(msg);          break;
          case 'system': this.onSystem(msg.body);   break;
          case 'reward':
            this.onSystem(`✦ ${msg.username} envio ${msg.amount} creditos`);
            break;
          case 'ping':
            this.ws?.send(JSON.stringify({ type: 'pong' }));
            break;
        }
      } catch {}
    };

    this.ws.onclose = () => {
      if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null; }
      if (!this.stopped && this.retries < 10) {
        const delay = Math.min(1000 * 2 ** this.retries, 15000);
        this.retries++;
        setTimeout(() => this._connect(), delay);
      }
    };

    this.ws.onerror = () => {};
  }

  sendChat(body: string) {
    if (this.ws?.readyState === WebSocket.OPEN)
      this.ws.send(JSON.stringify({ type: 'chat', body }));
  }

  sendReward(amount: number) {
    if (this.ws?.readyState === WebSocket.OPEN)
      this.ws.send(JSON.stringify({ type: 'reward', amount }));
  }

  disconnect() {
    this.stopped = true;
    if (this.pingTimer) { clearInterval(this.pingTimer); this.pingTimer = null; }
    this.ws?.close();
    this.ws = null;
  }
}

// Singleton global
export const wsClient = new StreamTuneWS();

import type { LiveState, ChatMessage } from '../types';

type SyncHandler   = (state: LiveState) => void;
type ChatHandler   = (msg: ChatMessage) => void;
type SystemHandler = (body: string) => void;
type ViewerHandler = (count: number) => void;

class StreamTuneWS {
  private ws:       WebSocket | null = null;
  private slug:     string = '';
  private token:    string | null = null;
  private retries:  number = 0;
  private maxRetry: number = 10;
  private pingTimer: ReturnType<typeof setInterval> | null = null;

  private onSync:   SyncHandler   = () => {};
  private onChat:   ChatHandler   = () => {};
  private onSystem: SystemHandler = () => {};
  private onViewer: ViewerHandler = () => {};

  connect(slug: string, token: string | null = null) {
    this.slug  = slug;
    this.token = token;
    this._connect();
  }

  private _connect() {
    const base = 'ws://localhost:3000/ws';
    const url  = this.token
      ? `${base}/${this.slug}?token=${this.token}`
      : `${base}/${this.slug}`;

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      console.log(`[WS] Conectado a canal: ${this.slug}`);
      this.retries = 0;
      // Heartbeat cada 5s
      this.pingTimer = setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({ type: 'pong' }));
        }
      }, 5000);
    };

    this.ws.onmessage = ({ data }) => {
      try {
        const msg = JSON.parse(data);
        if (msg.type === 'sync')   this.onSync({ ...msg });
        if (msg.type === 'chat')   this.onChat(msg);
        if (msg.type === 'system') this.onSystem(msg.body);
        if (msg.type === 'reward') this.onSystem(`✦ ${msg.username} envio ${msg.amount} creditos`);
        if (msg.type === 'sync' && msg.viewers !== undefined) this.onViewer(msg.viewers);
      } catch {}
    };

    this.ws.onclose = () => {
      if (this.pingTimer) clearInterval(this.pingTimer);
      if (this.retries < this.maxRetry) {
        const delay = Math.min(1000 * 2 ** this.retries, 15000);
        this.retries++;
        console.log(`[WS] Reconectando en ${delay}ms (intento ${this.retries})`);
        setTimeout(() => this._connect(), delay);
      }
    };

    this.ws.onerror = () => {};
  }

  sendChat(body: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'chat', body }));
    }
  }

  sendReward(amount: number) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'reward', amount }));
    }
  }

  disconnect() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.retries = this.maxRetry; // prevent reconnect
    this.ws?.close();
    this.ws = null;
  }

  on(event: 'sync',   handler: SyncHandler):   void;
  on(event: 'chat',   handler: ChatHandler):   void;
  on(event: 'system', handler: SystemHandler): void;
  on(event: 'viewer', handler: ViewerHandler): void;
  on(event: string, handler: any) {
    if (event === 'sync')   this.onSync   = handler;
    if (event === 'chat')   this.onChat   = handler;
    if (event === 'system') this.onSystem = handler;
    if (event === 'viewer') this.onViewer = handler;
  }
}

export const wsClient = new StreamTuneWS();

import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useChannelStore } from '../stores/channelStore';
import { useAuthStore } from '../stores/authStore';
import { wsClient } from '../services/websocket';
import type { ChatMessage, LiveState } from '../types';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

const CHAT_COLORS = [
  '#7c5cfc','#c45cfc','#5cf8c8','#ff9f43','#54a0ff',
  '#ff6b81','#1ecc7a','#ffd32a','#ff4757','#5352ed',
  '#ff6348','#2ed573','#eccc68','#a29bfe','#fd79a8',
];

const EMOJIS = ['😀','😂','🔥','❤️','👏','🎵','🎶','🎸','🎹','🎤',
                '😎','🤩','💯','🙌','✨','🎉','😍','🥳','💜','🎧'];

// Assign a consistent color per username
const userColors = new Map<string, string>();
function getColor(username: string): string {
  if (!userColors.has(username)) {
    userColors.set(username, CHAT_COLORS[userColors.size % CHAT_COLORS.length]);
  }
  return userColors.get(username)!;
}

interface ChatEntry extends ChatMessage { color: string; }

export default function Player() {
  const { slug } = useParams<{ slug: string }>();
  const {
    current: channel, liveState,
    fetchChannel, setLiveState, setViewers, clearCurrent,
  } = useChannelStore();
  const { user } = useAuthStore();

  const playerRef      = useRef<any>(null);
  const playerDivRef   = useRef<HTMLDivElement>(null);
  const currentYtId    = useRef('');
  const progTimer      = useRef<ReturnType<typeof setInterval> | null>(null);
  const liveStateRef   = useRef<LiveState | null>(null);
  const playerCreated  = useRef(false);
  const chatBottomRef  = useRef<HTMLDivElement>(null);
  const hideTimer      = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [messages,     setMessages]     = useState<ChatEntry[]>([]);
  const [chatInput,    setChatInput]    = useState('');
  const [progress,     setProgress]     = useState(0);
  const [frameNow,     setFrameNow]     = useState(0);
  const [totalDur,     setTotalDur]     = useState(0);
  const [ytReady,      setYtReady]      = useState(false);
  const [ytError,      setYtError]      = useState(false);
  const [volume,       setVolume]       = useState(80);
  const [muted,        setMuted]        = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showEmojis,   setShowEmojis]   = useState(false);
  const [viewerCount,  setViewerCount]  = useState(0);

  useEffect(() => { liveStateRef.current = liveState; }, [liveState]);

  // Auto-hide top controls (not chat) after 4s
  const resetHide = useCallback(() => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 4000);
  }, []);

  // ── Load YouTube IFrame API ────────────────────────────
  useEffect(() => {
    if (window.YT?.Player) { setYtReady(true); return; }
    if (!document.getElementById('yt-api')) {
      const s = document.createElement('script');
      s.id = 'yt-api'; s.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(s);
    }
    window.onYouTubeIframeAPIReady = () => setYtReady(true);
  }, []);

  // ── Fetch channel ──────────────────────────────────────
  useEffect(() => {
    if (!slug) return;
    clearCurrent();
    playerCreated.current = false;
    setYtError(false);
    currentYtId.current = '';
    if (playerRef.current) {
      try { playerRef.current.destroy(); } catch {}
      playerRef.current = null;
    }
    fetchChannel(slug);
    resetHide();
  }, [slug]);

  // ── WebSocket ──────────────────────────────────────────
  useEffect(() => {
    if (!slug) return;
    const token = localStorage.getItem('accessToken');

    wsClient.onSync = (state) => {
      setLiveState(state);
      setFrameNow(state.frameAt);
      setTotalDur(state.totalDuration);
      if (typeof state.viewers === 'number') {
        setViewerCount(state.viewers);
        setViewers(state.viewers);
      }

      // ── Auto-next video: when ytId changes, load new video ──
      if (playerRef.current && state.ytId) {
        try {
          if (state.ytId !== currentYtId.current) {
            // New video — load it at the correct frame
            currentYtId.current = state.ytId;
            playerRef.current.loadVideoById({
              videoId:      state.ytId,
              startSeconds: Math.floor(state.frameAt),
            });
          } else {
            // Same video — only seek if drift > 2 seconds
            const cur = playerRef.current.getCurrentTime?.() ?? 0;
            if (Math.abs(cur - state.frameAt) > 2) {
              playerRef.current.seekTo(state.frameAt, true);
            }
          }
        } catch {}
      }
    };

    wsClient.onChat = (msg) => {
      const color = getColor(msg.username);
      setMessages(prev => {
        const next = [...prev, { ...msg, color }];
        return next.slice(-50); // keep last 50
      });
    };

    wsClient.onSystem = (body) => {
      setMessages(prev => [...prev, {
        id: Date.now().toString(), userId: 'system',
        username: 'Sistema', body, type: 'system' as const,
        createdAt: new Date().toISOString(), color: '#c45cfc',
      }].slice(-50));
    };

    wsClient.onViewer = (n) => { setViewerCount(n); setViewers(n); };

    wsClient.connect(slug, token);
    return () => wsClient.disconnect();
  }, [slug]);

  // ── Create YouTube player ──────────────────────────────
  const createPlayer = useCallback(() => {
    if (!ytReady || playerCreated.current || !playerDivRef.current) return;
    const state = liveStateRef.current;
    if (!state?.ytId) return;

    playerCreated.current = true;
    currentYtId.current   = state.ytId;

    playerRef.current = new window.YT.Player(playerDivRef.current, {
      videoId: state.ytId,
      width: '100%', height: '100%',
      playerVars: {
        autoplay: 1, controls: 0, disablekb: 1,
        fs: 0, modestbranding: 1, rel: 0, iv_load_policy: 3,
        start: Math.floor(state.frameAt),
        origin: window.location.origin,
      },
      events: {
        onReady: (e: any) => {
          e.target.seekTo(liveStateRef.current?.frameAt ?? state.frameAt, true);
          e.target.setVolume(volume);
          if (muted) e.target.mute();
          e.target.playVideo();
          setYtError(false);
        },
        onStateChange: (e: any) => {
          // Keep playing — don't let viewer pause
          if (e.data === window.YT?.PlayerState?.PAUSED) {
            setTimeout(() => { try { e.target.playVideo(); } catch {} }, 300);
          }
          // Video ended (state 0) — server will send next ytId via sync
          // No action needed here — wsClient.onSync handles it
        },
        onError: () => setYtError(true),
      },
    });
  }, [ytReady, volume, muted]);

  useEffect(() => { createPlayer(); }, [createPlayer]);
  useEffect(() => {
    if (liveState?.ytId && ytReady && !playerCreated.current) createPlayer();
  }, [liveState?.ytId, ytReady, createPlayer]);

  // ── Progress bar ───────────────────────────────────────
  useEffect(() => {
    if (progTimer.current) clearInterval(progTimer.current);
    if (!totalDur) return;
    let f = frameNow;
    progTimer.current = setInterval(() => {
      f += 0.1;
      if (f >= totalDur) f = 0;
      setProgress((f / totalDur) * 100);
    }, 100);
    return () => { if (progTimer.current) clearInterval(progTimer.current); };
  }, [frameNow, totalDur]);

  // ── Auto-scroll chat ───────────────────────────────────
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleVolume = (v: number) => {
    setVolume(v);
    if (v > 0) { setMuted(false); playerRef.current?.unMute?.(); }
    playerRef.current?.setVolume?.(v);
  };

  const toggleMute = () => {
    if (muted) { playerRef.current?.unMute?.(); playerRef.current?.setVolume?.(volume); }
    else { playerRef.current?.mute?.(); }
    setMuted(!muted);
  };

  const sendChat = () => {
    if (!chatInput.trim() || !user) return;
    wsClient.sendChat(chatInput.trim().slice(0, 200));
    setChatInput('');
    setShowEmojis(false);
  };

  const fmt = (sec: number) => {
    const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (!channel) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-56px)]">
        <div className="text-center">
          <div className="text-5xl mb-4">📡</div>
          <p className="text-txt2">Cargando canal...</p>
        </div>
      </div>
    );
  }

  const isLive   = channel.status === 'live';
  const hasVideo = isLive && !!liveState?.ytId && !ytError;

  return (
    <div
      className="relative w-full bg-black select-none"
      style={{ height: 'calc(100vh - 56px)' }}
      onMouseMove={resetHide}
      onClick={() => setShowEmojis(false)}
    >

      {/* ── YouTube Player ── */}
      {hasVideo && (
        <div ref={playerDivRef} className="absolute inset-0 w-full h-full z-0" />
      )}

      {/* ── Fallback ── */}
      {!hasVideo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-0"
          style={{ background: `linear-gradient(135deg,${channel.accentColor}22,${channel.accentColor}55)` }}>
          <span className="text-8xl mb-4">{channel.icon}</span>
          <p className="text-txt2 text-lg">
            {!isLive ? 'Canal pausado' : ytError ? 'Video no disponible para embedding' : 'Conectando...'}
          </p>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          TOP BAR — channel info + viewers (auto-hide)
      ══════════════════════════════════════════════════ */}
      <div className={`absolute top-0 left-0 right-0 z-20 flex items-center justify-between
                       px-4 pt-4 pb-8 transition-opacity duration-500
                       ${showControls ? 'opacity-100' : 'opacity-0'}`}
           style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)' }}>

        {/* Channel logo + name */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg
                          bg-black/50 border border-white/20 flex-shrink-0">
            {channel.icon}
          </div>
          <div>
            <p className="text-white font-display font-bold text-sm leading-tight drop-shadow-lg">
              {channel.name}
            </p>
            <p className="text-white/50 text-[10px]">@{channel.owner?.username}</p>
          </div>
        </div>

        {/* Center: LIVE badge */}
        {isLive && (
          <div className="flex items-center gap-1.5 bg-live/90 text-white
                          text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse-dot" />
            En Vivo
          </div>
        )}

        {/* Viewers + Follow */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-sm
                          text-white text-xs px-2.5 py-1 rounded-full border border-white/10">
            <span className="w-1.5 h-1.5 rounded-full bg-live animate-pulse-dot" />
            <span>{viewerCount.toLocaleString()} viendo</span>
          </div>
          <button className="bg-black/50 backdrop-blur-sm border border-white/20 text-white
                             text-xs px-3 py-1 rounded-full hover:bg-white/20 transition-all">
            + Seguir
          </button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          RIGHT SIDE — Chat overlay (always visible)
      ══════════════════════════════════════════════════ */}
      <div className="absolute right-0 top-16 bottom-36 z-20 w-64 flex flex-col
                      justify-end px-3 pb-2 pointer-events-none overflow-hidden">
        <div className="flex flex-col gap-0.5">
          {messages.slice(-15).map(msg => (
            <div key={msg.id} className="flex gap-1 items-baseline">
              {msg.type !== 'system' ? (
                <>
                  <span className="text-[11px] font-bold flex-shrink-0 drop-shadow-lg"
                        style={{ color: msg.color, textShadow: '0 1px 4px rgba(0,0,0,1)' }}>
                    {msg.username}:
                  </span>
                  <span className="text-xs text-white leading-snug"
                        style={{ textShadow: '0 1px 4px rgba(0,0,0,1)' }}>
                    {msg.body}
                  </span>
                </>
              ) : (
                <span className="text-xs italic w-full text-center"
                      style={{ color: msg.color, textShadow: '0 1px 4px rgba(0,0,0,1)' }}>
                  {msg.body}
                </span>
              )}
            </div>
          ))}
          <div ref={chatBottomRef} />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          BOTTOM BAR — progress + next + chat (always visible)
      ══════════════════════════════════════════════════ */}
      <div className="absolute bottom-0 left-0 right-0 z-20"
           style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.85))' }}>

        {/* Now playing + next */}
        <div className="px-4 pt-2 pb-1 flex items-center gap-3">
          {liveState?.title && (
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="text-white/40 text-[10px] flex-shrink-0">♪</span>
              <span className="text-white text-xs font-medium truncate"
                    style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
                {liveState.title}
              </span>
            </div>
          )}
          {liveState?.nextVideo && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="text-white/40 text-[10px]">Siguiente:</span>
              <span className="text-white/70 text-[10px] max-w-[120px] truncate">
                {liveState.nextVideo}
              </span>
            </div>
          )}
        </div>

        {/* Progress bar — always visible when playing */}
        <div className="px-4 pb-1">
          <div className="h-0.5 bg-white/15 rounded-full relative cursor-pointer">
            <div className="absolute inset-y-0 left-0 rounded-full"
              style={{
                width: totalDur > 0 ? `${progress}%` : '0%',
                background: `linear-gradient(90deg, ${channel.accentColor}, #c45cfc)`,
                transition: 'width 0.1s linear',
              }} />
          </div>
          <div className="flex justify-between mt-0.5">
            <span className="text-[9px] text-white/30">
              {totalDur > 0 ? fmt((progress / 100) * totalDur) : '0:00'}
            </span>
            <span className="text-[9px] text-white/30 italic">Sincronizado</span>
            <span className="text-[9px] text-white/30">
              {totalDur > 0 ? fmt(totalDur) : '0:00'}
            </span>
          </div>
        </div>

        {/* Chat input row — always visible */}
        <div className="px-4 pb-3 flex items-center gap-2" onClick={e => e.stopPropagation()}>

          {/* Volume */}
          <button onClick={toggleMute}
            className="text-white/60 hover:text-white text-base flex-shrink-0">
            {muted || volume === 0 ? '🔇' : volume < 50 ? '🔉' : '🔊'}
          </button>
          <input type="range" min={0} max={100} value={muted ? 0 : volume}
            onChange={e => handleVolume(Number(e.target.value))}
            className="w-14 h-0.5 cursor-pointer flex-shrink-0"
            style={{ accentColor: channel.accentColor }} />

          <div className="flex-1" />

          {/* Chat */}
          {user ? (
            <div className="flex items-center gap-1.5 relative">
              {/* Emoji picker */}
              {showEmojis && (
                <div className="absolute bottom-9 right-0 bg-bg2/95 backdrop-blur
                                border border-white/10 rounded-xl p-2
                                grid grid-cols-5 gap-1 z-30 shadow-xl">
                  {EMOJIS.map(e => (
                    <button key={e} onClick={() => setChatInput(p => (p + e).slice(0, 200))}
                      className="text-xl hover:scale-125 transition-transform p-0.5">
                      {e}
                    </button>
                  ))}
                </div>
              )}

              <button onClick={() => setShowEmojis(v => !v)}
                className="text-white/60 hover:text-white text-xl flex-shrink-0">
                😊
              </button>

              <div className="flex items-center bg-black/60 backdrop-blur-sm
                              border border-white/20 rounded-full overflow-hidden">
                <input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value.slice(0, 200))}
                  onKeyDown={e => e.key === 'Enter' && sendChat()}
                  placeholder="Escribe un mensaje..."
                  maxLength={200}
                  className="bg-transparent text-white text-xs px-3 py-1.5 outline-none
                             placeholder-white/30 w-44"
                />
                <button onClick={sendChat}
                  className="text-white text-xs px-3 py-1.5 hover:bg-white/10
                             transition-colors flex-shrink-0 border-l border-white/10">
                  ↑
                </button>
              </div>

              <span className="text-white/25 text-[9px] flex-shrink-0 w-8 text-right">
                {chatInput.length}/200
              </span>
            </div>
          ) : (
            <Link to="/login"
              className="text-xs text-white/50 hover:text-white border border-white/15
                         px-3 py-1.5 rounded-full transition-colors">
              Inicia sesion para chatear
            </Link>
          )}
        </div>
      </div>

    </div>
  );
}

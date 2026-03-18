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

// Colores aleatorios para mensajes del chat
const CHAT_COLORS = [
  '#7c5cfc','#c45cfc','#5cf8c8','#ff9f43','#54a0ff',
  '#ff6b81','#1ecc7a','#ffd32a','#ff4757','#5352ed',
];

const EMOJIS = ['😀','😂','🔥','❤️','👏','🎵','🎶','🎸','🎹','🎤',
                '😎','🤩','💯','🙌','✨','🎉','😍','🥳','💜','🎧'];

function randomColor() {
  return CHAT_COLORS[Math.floor(Math.random() * CHAT_COLORS.length)];
}

interface ChatEntry extends ChatMessage {
  color: string;
}

export default function Player() {
  const { slug } = useParams<{ slug: string }>();
  const {
    current: channel, liveState, viewers,
    fetchChannel, setLiveState, setViewers, clearCurrent,
  } = useChannelStore();
  const { user } = useAuthStore();

  const playerRef       = useRef<any>(null);
  const playerDivRef    = useRef<HTMLDivElement>(null);
  const currentYtId     = useRef('');
  const progTimer       = useRef<ReturnType<typeof setInterval> | null>(null);
  const chatEndRef      = useRef<HTMLDivElement>(null);
  const liveStateRef    = useRef<LiveState | null>(null);
  const playerCreated   = useRef(false);

  const [messages,      setMessages]      = useState<ChatEntry[]>([]);
  const [chatInput,     setChatInput]     = useState('');
  const [progress,      setProgress]      = useState(0);
  const [frameNow,      setFrameNow]      = useState(0);
  const [totalDur,      setTotalDur]      = useState(0);
  const [ytReady,       setYtReady]       = useState(false);
  const [ytError,       setYtError]       = useState(false);
  const [volume,        setVolume]        = useState(80);
  const [muted,         setMuted]         = useState(false);
  const [showControls,  setShowControls]  = useState(true);
  const [showEmojis,    setShowEmojis]    = useState(false);
  const hideTimer       = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { liveStateRef.current = liveState; }, [liveState]);

  // ── Auto-hide controls after 3s of no mouse movement ──
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  // ── 1. Load YouTube IFrame API ─────────────────────────
  useEffect(() => {
    if (window.YT?.Player) { setYtReady(true); return; }
    if (!document.getElementById('yt-api-script')) {
      const s = document.createElement('script');
      s.id  = 'yt-api-script';
      s.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(s);
    }
    window.onYouTubeIframeAPIReady = () => setYtReady(true);
  }, []);

  // ── 2. Fetch channel ───────────────────────────────────
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
  }, [slug]);

  // ── 3. WebSocket ───────────────────────────────────────
  useEffect(() => {
    if (!slug) return;
    const token = localStorage.getItem('accessToken');

    wsClient.onSync = (state) => {
      setLiveState(state);
      setFrameNow(state.frameAt);
      setTotalDur(state.totalDuration);
      if (typeof state.viewers === 'number') setViewers(state.viewers);

      if (playerRef.current) {
        try {
          if (state.ytId !== currentYtId.current) {
            currentYtId.current = state.ytId;
            playerRef.current.loadVideoById({ videoId: state.ytId, startSeconds: state.frameAt });
          } else {
            const cur = playerRef.current.getCurrentTime?.() ?? 0;
            if (Math.abs(cur - state.frameAt) > 2) {
              playerRef.current.seekTo(state.frameAt, true);
            }
          }
        } catch {}
      }
    };

    wsClient.onChat = (msg) => {
      setMessages(prev => [...prev.slice(-50), { ...msg, color: randomColor() }]);
    };

    wsClient.onSystem = (body) => {
      setMessages(prev => [...prev, {
        id: Date.now().toString(), userId: 'system',
        username: 'Sistema', body, type: 'system',
        createdAt: new Date().toISOString(), color: '#c45cfc',
      }]);
    };

    wsClient.onViewer = setViewers;
    wsClient.connect(slug, token);
    return () => wsClient.disconnect();
  }, [slug]);

  // ── 4. Create YouTube player ───────────────────────────
  const createPlayer = useCallback(() => {
    if (!ytReady || playerCreated.current || !playerDivRef.current) return;
    const state = liveStateRef.current;
    if (!state?.ytId) return;

    playerCreated.current = true;
    currentYtId.current   = state.ytId;

    playerRef.current = new window.YT.Player(playerDivRef.current, {
      videoId: state.ytId,
      width:   '100%',
      height:  '100%',
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
          // When video ends (state 0), the server sync will load the next one automatically
          if (e.data === window.YT?.PlayerState?.PAUSED) {
            setTimeout(() => { try { e.target.playVideo(); } catch {} }, 300);
          }
        },
        onError: () => setYtError(true),
      },
    });
  }, [ytReady, volume, muted]);

  useEffect(() => { createPlayer(); }, [createPlayer]);

  useEffect(() => {
    if (liveState?.ytId && ytReady && !playerCreated.current) createPlayer();
  }, [liveState?.ytId, ytReady, createPlayer]);

  // ── 5. Progress bar ────────────────────────────────────
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

  // ── 6. Auto-scroll chat ────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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

  const addEmoji = (emoji: string) => {
    setChatInput(prev => (prev + emoji).slice(0, 200));
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
      className="relative w-full bg-black overflow-hidden"
      style={{ height: 'calc(100vh - 56px)' }}
      onMouseMove={resetHideTimer}
      onClick={() => setShowEmojis(false)}
    >

      {/* ── YouTube Player — fullscreen ── */}
      {hasVideo && (
        <div ref={playerDivRef} className="absolute inset-0 w-full h-full" />
      )}

      {/* ── Fallback cover ── */}
      {!hasVideo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ background: `linear-gradient(135deg,${channel.accentColor}22,${channel.accentColor}66)` }}>
          <span className="text-8xl mb-4">{channel.icon}</span>
          <p className="text-txt2 text-lg">
            {!isLive ? 'Canal pausado' : ytError ? 'Video no disponible' : 'Conectando...'}
          </p>
        </div>
      )}

      {/* ── TOP LEFT: Channel logo + name ── */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-xl
                        bg-black/50 backdrop-blur-sm border border-white/20">
          {channel.icon}
        </div>
        <div>
          <p className="text-white font-display font-bold text-base drop-shadow-lg leading-tight">
            {channel.name}
          </p>
          <p className="text-white/60 text-xs">@{channel.owner?.username}</p>
        </div>
      </div>

      {/* ── TOP RIGHT: Viewers + Follow ── */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-sm
                        text-white text-xs px-2.5 py-1.5 rounded-full border border-white/10">
          <span className="w-1.5 h-1.5 rounded-full bg-live animate-pulse-dot" />
          {viewers.toLocaleString()} viendo
        </div>
        <button className="bg-black/50 backdrop-blur-sm border border-white/20
                           text-white text-xs px-3 py-1.5 rounded-full
                           hover:bg-white/20 transition-all">
          + Seguir
        </button>
      </div>

      {/* ── LIVE badge ── */}
      {isLive && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
          <div className="flex items-center gap-1.5 bg-live text-white
                          text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse-dot" />
            En Vivo
          </div>
        </div>
      )}

      {/* ── OVERLAY CHAT — right side, transparent ── */}
      <div className="absolute right-4 z-20 flex flex-col gap-1 max-w-xs w-64"
           style={{ top: '80px', bottom: '120px', overflow: 'hidden' }}>
        <div className="flex flex-col-reverse gap-1 overflow-hidden h-full">
          {[...messages].reverse().slice(0, 15).map(msg => (
            <div key={msg.id} className="flex gap-1.5 items-start">
              {msg.type !== 'system' && (
                <span className="text-[10px] font-bold flex-shrink-0 mt-0.5"
                      style={{ color: msg.color, textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
                  {msg.username}:
                </span>
              )}
              <span className={`text-xs leading-snug drop-shadow-lg
                ${msg.type === 'system' ? 'italic' : ''}`}
                style={{
                  color: msg.type === 'system' ? '#c45cfc' : '#ffffff',
                  textShadow: '0 1px 4px rgba(0,0,0,0.9)',
                }}>
                {msg.body}
              </span>
            </div>
          ))}
        </div>
        <div ref={chatEndRef} />
      </div>

      {/* ── BOTTOM: Progress + Next + Chat input ── */}
      <div className={`absolute bottom-0 left-0 right-0 z-20 transition-opacity duration-500
                       ${showControls ? 'opacity-100' : 'opacity-0'}`}
           style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.85))' }}>

        {/* Next song */}
        {liveState?.nextVideo && (
          <div className="px-4 pb-1 flex items-center gap-2">
            <span className="text-white/50 text-xs">A continuacion:</span>
            <span className="text-white/80 text-xs font-medium">{liveState.nextVideo}</span>
          </div>
        )}

        {/* Progress bar */}
        {isLive && totalDur > 0 && (
          <div className="px-4 pb-2">
            <div className="h-0.5 bg-white/20 rounded-full relative mb-1">
              <div className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-100"
                style={{
                  width: `${progress}%`,
                  background: `linear-gradient(90deg, ${channel.accentColor}, #c45cfc)`,
                }} />
            </div>
            <div className="flex justify-between text-[10px] text-white/40">
              <span>{fmt((progress / 100) * totalDur)}</span>
              <span className="italic">Sincronizado</span>
              <span>{fmt(totalDur)}</span>
            </div>
          </div>
        )}

        {/* Chat input + volume */}
        <div className="px-4 pb-4 flex items-center gap-2">

          {/* Volume */}
          <button onClick={toggleMute}
            className="text-white/70 hover:text-white text-lg flex-shrink-0 w-6">
            {muted || volume === 0 ? '🔇' : volume < 50 ? '🔉' : '🔊'}
          </button>
          <input type="range" min={0} max={100} value={muted ? 0 : volume}
            onChange={e => handleVolume(Number(e.target.value))}
            className="w-16 h-1 accent-accent cursor-pointer flex-shrink-0" />

          {/* Spacer */}
          <div className="flex-1" />

          {/* Chat input */}
          {user ? (
            <div className="flex items-center gap-2 relative">
              {/* Emoji picker */}
              {showEmojis && (
                <div className="absolute bottom-10 right-0 bg-bg3/95 backdrop-blur-sm
                                border border-white/10 rounded-xl p-2 grid grid-cols-5 gap-1 z-30"
                     onClick={e => e.stopPropagation()}>
                  {EMOJIS.map(e => (
                    <button key={e} onClick={() => addEmoji(e)}
                      className="text-xl hover:scale-125 transition-transform p-0.5">
                      {e}
                    </button>
                  ))}
                </div>
              )}

              <button
                onClick={e => { e.stopPropagation(); setShowEmojis(v => !v); }}
                className="text-white/60 hover:text-white text-xl transition-colors">
                😊
              </button>

              <div className="flex items-center bg-black/50 backdrop-blur-sm
                              border border-white/20 rounded-full overflow-hidden">
                <input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value.slice(0, 200))}
                  onKeyDown={e => e.key === 'Enter' && sendChat()}
                  placeholder="Escribe un mensaje..."
                  maxLength={200}
                  className="bg-transparent text-white text-xs px-4 py-2 outline-none
                             placeholder-white/40 w-48"
                />
                <button onClick={sendChat}
                  className="bg-accent text-white text-xs px-3 py-2 hover:bg-accent/80
                             transition-colors flex-shrink-0">
                  ↑
                </button>
              </div>
              <span className="text-white/30 text-[10px] flex-shrink-0">
                {chatInput.length}/200
              </span>
            </div>
          ) : (
            <Link to="/login"
              className="text-xs text-white/60 hover:text-white border border-white/20
                         px-3 py-1.5 rounded-full transition-colors backdrop-blur-sm">
              Inicia sesion para chatear
            </Link>
          )}
        </div>
      </div>

    </div>
  );
}

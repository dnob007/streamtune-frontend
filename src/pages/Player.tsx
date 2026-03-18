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

export default function Player() {
  const { slug } = useParams<{ slug: string }>();
  const {
    current: channel, liveState, viewers,
    fetchChannel, setLiveState, setViewers, clearCurrent,
  } = useChannelStore();
  const { user } = useAuthStore();

  // Refs
  const playerRef     = useRef<any>(null);
  const playerDivRef  = useRef<HTMLDivElement>(null);
  const currentYtId   = useRef('');
  const progTimer     = useRef<ReturnType<typeof setInterval>>();
  const chatEndRef    = useRef<HTMLDivElement>(null);
  const liveStateRef  = useRef<LiveState | null>(null); // always current liveState

  // State
  const [messages,  setMessages]  = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [progress,  setProgress]  = useState(0);
  const [frameNow,  setFrameNow]  = useState(0);
  const [totalDur,  setTotalDur]  = useState(0);
  const [ytReady,   setYtReady]   = useState(false);
  const [playerCreated, setPlayerCreated] = useState(false);
  const [ytError,   setYtError]   = useState(false);
  const [volume,    setVolume]    = useState(80);
  const [muted,     setMuted]     = useState(false);

  // Keep liveStateRef in sync
  useEffect(() => { liveStateRef.current = liveState; }, [liveState]);

  // ── 1. Load YouTube IFrame API ─────────────────────────
  useEffect(() => {
    if (window.YT?.Player) { setYtReady(true); return; }
    if (document.getElementById('yt-api-script')) {
      window.onYouTubeIframeAPIReady = () => setYtReady(true);
      return;
    }
    const script = document.createElement('script');
    script.id  = 'yt-api-script';
    script.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(script);
    window.onYouTubeIframeAPIReady = () => setYtReady(true);
  }, []);

  // ── 2. Fetch channel data ──────────────────────────────
  useEffect(() => {
    if (!slug) return;
    clearCurrent?.();
    setPlayerCreated(false);
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

      // Sync player if already created
      if (playerRef.current) {
        try {
          if (state.ytId !== currentYtId.current) {
            currentYtId.current = state.ytId;
            playerRef.current.loadVideoById({ videoId: state.ytId, startSeconds: state.frameAt });
          } else {
            const current = playerRef.current.getCurrentTime?.() ?? 0;
            if (Math.abs(current - state.frameAt) > 2) {
              playerRef.current.seekTo(state.frameAt, true);
            }
          }
        } catch {}
      }
    };

    wsClient.onChat = (msg) =>
      setMessages(prev => [...prev.slice(-100), msg]);

    wsClient.onSystem = (body) =>
      setMessages(prev => [...prev, {
        id: Date.now().toString(), userId: 'system',
        username: 'Sistema', body, type: 'system', createdAt: new Date().toISOString(),
      }]);

    wsClient.onViewer = setViewers;

    wsClient.connect(slug, token);
    return () => { wsClient.disconnect(); };
  }, [slug]);

  // ── 4. Create YouTube player ───────────────────────────
  // Triggers when BOTH ytReady AND liveState.ytId are available
  const createPlayer = useCallback(() => {
    if (!ytReady) return;
    if (playerCreated) return;
    if (!playerDivRef.current) return;

    const state = liveStateRef.current;
    if (!state?.ytId) return;

    setPlayerCreated(true);
    currentYtId.current = state.ytId;

    playerRef.current = new window.YT.Player(playerDivRef.current, {
      videoId: state.ytId,
      width:   '100%',
      height:  '100%',
      playerVars: {
        autoplay:       1,
        controls:       0,
        disablekb:      1,
        fs:             0,
        modestbranding: 1,
        rel:            0,
        iv_load_policy: 3,
        start:          Math.floor(state.frameAt),
        origin:         window.location.origin,
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
          // Keep playing — viewers don't control playback
          if (e.data === window.YT?.PlayerState?.PAUSED) {
            setTimeout(() => { try { e.target.playVideo(); } catch {} }, 300);
          }
        },
        onError: () => setYtError(true),
      },
    });
  }, [ytReady, playerCreated, volume, muted]);

  // Try to create player whenever dependencies change
  useEffect(() => { createPlayer(); }, [createPlayer]);

  // Also try when liveState arrives (handles the case where WS fires before ytReady)
  useEffect(() => {
    if (liveState?.ytId && ytReady && !playerCreated) {
      createPlayer();
    }
  }, [liveState?.ytId, ytReady, playerCreated, createPlayer]);

  // ── 5. Progress bar animation ──────────────────────────
  useEffect(() => {
    clearInterval(progTimer.current);
    if (!totalDur) return;
    let f = frameNow;
    progTimer.current = setInterval(() => {
      f += 0.1;
      if (f >= totalDur) f = 0;
      setProgress((f / totalDur) * 100);
    }, 100);
    return () => clearInterval(progTimer.current);
  }, [frameNow, totalDur]);

  // ── 6. Auto-scroll chat ────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Helpers ────────────────────────────────────────────
  const handleVolume = (v: number) => {
    setVolume(v);
    if (v > 0) { setMuted(false); playerRef.current?.unMute?.(); }
    playerRef.current?.setVolume?.(v);
  };

  const toggleMute = () => {
    if (muted) { playerRef.current?.unMute?.(); playerRef.current?.setVolume?.(volume); }
    else       { playerRef.current?.mute?.(); }
    setMuted(!muted);
  };

  const sendChat = () => {
    if (!chatInput.trim() || !user) return;
    wsClient.sendChat(chatInput.trim());
    setChatInput('');
  };

  const fmt = (sec: number) => {
    const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // ── Render ─────────────────────────────────────────────
  if (!channel) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-5xl mb-4">📡</div>
          <p className="text-txt2">Cargando canal...</p>
        </div>
      </div>
    );
  }

  const isLive    = channel.status === 'live';
  const hasVideo  = isLive && !!liveState?.ytId;

  return (
    <div className="flex h-[calc(100vh-56px)]">

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">

        {/* Video stage */}
        <div className="relative bg-black w-full" style={{ aspectRatio: '16/9' }}>

          {/* YouTube player div — API replaces this with iframe */}
          {hasVideo && !ytError && (
            <div ref={playerDivRef} className="absolute inset-0 w-full h-full" />
          )}

          {/* Fallback cover */}
          {(!hasVideo || ytError) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center"
              style={{ background: `linear-gradient(135deg,${channel.accentColor}22,${channel.accentColor}55)` }}>
              <span className="text-7xl mb-3">{channel.icon}</span>
              <p className="text-txt2 text-sm">
                {!isLive ? 'Canal pausado'
                  : ytError ? 'Este video no permite reproduccion externa'
                  : 'Conectando...'}
              </p>
              {ytError && (
                <p className="text-xs text-txt3 mt-2 max-w-xs text-center px-4">
                  El propietario de este video tiene deshabilitado el embedding.
                  Prueba agregando otro video al canal.
                </p>
              )}
            </div>
          )}

          {/* Badges */}
          <div className="absolute top-3 left-3 flex gap-2 z-10 pointer-events-none">
            {isLive && (
              <div className="flex items-center gap-1.5 bg-live text-white
                              text-xs font-bold px-2.5 py-1 rounded-md uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse-dot" />
                En Vivo
              </div>
            )}
            {hasVideo && !ytError && (
              <div className="flex items-center gap-1.5 bg-online/80 text-white
                              text-xs font-bold px-2.5 py-1 rounded-md">
                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                SYNC
              </div>
            )}
          </div>

          {/* Viewers */}
          <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5
                          bg-black/60 text-white text-xs px-2.5 py-1 rounded-md pointer-events-none">
            <span className="w-1.5 h-1.5 rounded-full bg-live" />
            {viewers.toLocaleString()} viendo
          </div>

          {/* Volume */}
          {hasVideo && !ytError && (
            <div className="absolute bottom-3 right-3 z-10 flex items-center gap-2
                            bg-black/70 rounded-lg px-3 py-1.5">
              <button onClick={toggleMute} className="text-white text-sm w-5">
                {muted || volume === 0 ? '🔇' : volume < 50 ? '🔉' : '🔊'}
              </button>
              <input type="range" min={0} max={100} value={muted ? 0 : volume}
                onChange={e => handleVolume(Number(e.target.value))}
                className="w-20 h-1 accent-accent cursor-pointer" />
              <span className="text-white/60 text-xs w-6">{muted ? 0 : volume}</span>
            </div>
          )}

          {/* Title */}
          {hasVideo && liveState && (
            <div className="absolute bottom-12 left-4 z-10 pointer-events-none">
              <p className="text-white/60 text-xs mb-0.5 uppercase tracking-wider">
                Reproduciendo ahora
              </p>
              <h2 className="font-display font-bold text-white text-lg drop-shadow-lg">
                {liveState.title}
              </h2>
              {liveState.artist && (
                <p className="text-white/70 text-sm">{liveState.artist}</p>
              )}
            </div>
          )}
        </div>

        {/* Progress bar — shows whenever isLive and totalDur > 0 */}
        {isLive && totalDur > 0 && (
          <div className="bg-bg2 border-t border-white/5 px-5 py-2.5">
            <div className="h-0.5 bg-bg4 rounded-full mb-1.5 relative overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  width:      `${progress}%`,
                  background: `linear-gradient(90deg, ${channel.accentColor}, #c45cfc)`,
                  transition: 'width 0.1s linear',
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-txt3">
              <span>{fmt((progress / 100) * totalDur)}</span>
              <span className="text-[10px] italic text-txt3">
                Sincronizado — todos ven el mismo frame
              </span>
              <span>{fmt(totalDur)}</span>
            </div>
          </div>
        )}

        {/* Channel info */}
        <div className="p-5 border-b border-white/5">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-3xl">{channel.icon}</span>
            <div className="flex-1 min-w-0">
              <h1 className="font-display font-bold text-xl">{channel.name}</h1>
              <p className="text-xs text-txt3">
                @{channel.owner?.username} · {(channel.followerCount ?? 0).toLocaleString()} seguidores
              </p>
            </div>
            <button className="px-4 py-1.5 text-sm border border-white/10 rounded-lg
                               text-txt2 hover:border-accent hover:text-txt transition-all">
              + Seguir
            </button>
          </div>
          {channel.description && (
            <p className="text-sm text-txt2 mt-3 leading-relaxed">{channel.description}</p>
          )}
          <div className="flex gap-2 mt-3 flex-wrap">
            {channel.topics?.map(t => (
              <span key={t}
                className="text-xs bg-accent/10 border border-accent/20 text-accent
                           px-2.5 py-1 rounded-full">
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Next up */}
        {liveState?.nextVideo && (
          <div className="px-5 py-3 border-b border-white/5">
            <p className="text-xs text-txt3 uppercase tracking-wider mb-1">A continuacion</p>
            <p className="text-sm text-txt2">{liveState.nextVideo}</p>
          </div>
        )}
      </div>

      {/* ── Chat ── */}
      <div className="w-72 flex-shrink-0 bg-bg2 border-l border-white/5 flex flex-col">
        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
          <h3 className="font-display font-bold text-sm">Chat en Vivo</h3>
          <div className="flex items-center gap-1.5 text-xs text-txt2">
            <span className="w-1.5 h-1.5 rounded-full bg-live" />
            {viewers.toLocaleString()}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
          {messages.length === 0 && (
            <p className="text-center text-xs text-txt3 pt-8">Se el primero en escribir...</p>
          )}
          {messages.map(msg => (
            <div key={msg.id} className="flex gap-2">
              {msg.type !== 'system' && (
                <div className="w-5 h-5 rounded-full bg-accent flex-shrink-0
                                flex items-center justify-center text-[10px] font-bold text-white">
                  {msg.username[0]?.toUpperCase()}
                </div>
              )}
              <div className={msg.type === 'system' ? 'w-full' : ''}>
                {msg.type !== 'system' && (
                  <p className="text-[11px] font-medium text-accent mb-0.5">{msg.username}</p>
                )}
                <p className={`text-xs leading-relaxed
                  ${msg.type === 'system'
                    ? 'text-accent2 italic text-center py-1'
                    : 'text-txt2'}`}>
                  {msg.body}
                </p>
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        <div className="p-3 border-t border-white/5">
          {user ? (
            <>
              <div className="flex gap-2 mb-2">
                <input value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendChat()}
                  placeholder="Escribe algo..."
                  className="flex-1 bg-bg3 border border-white/10 rounded-lg px-3 py-2
                             text-xs text-txt placeholder-txt3 outline-none
                             focus:border-accent transition-colors"
                />
                <button onClick={sendChat}
                  className="bg-accent text-white w-8 h-8 rounded-lg flex items-center
                             justify-center text-base hover:bg-accent/80 transition-colors">
                  ↑
                </button>
              </div>
              <button
                className="w-full bg-accent2/10 border border-accent2/20 text-accent2
                           text-xs py-1.5 rounded-lg hover:bg-accent2/20 transition-colors">
                ✦ Enviar creditos al canal
              </button>
            </>
          ) : (
            <div className="text-center py-2">
              <p className="text-xs text-txt3 mb-2">Registrate para chatear</p>
              <Link to="/register" className="text-xs text-accent hover:underline">
                Crear cuenta gratis →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

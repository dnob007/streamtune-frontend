import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useChannelStore } from '../stores/channelStore';
import { useAuthStore } from '../stores/authStore';
import { wsClient } from '../services/websocket';
import type { LiveState } from '../types';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

const PALETTE = [
  '#7c5cfc','#c45cfc','#5cf8c8','#ff9f43','#54a0ff',
  '#ff6b81','#1ecc7a','#ffd32a','#ff4757','#5352ed',
  '#ff6348','#2ed573','#eccc68','#a29bfe','#fd79a8',
];
const colorMap = new Map<string, string>();
let colorIdx = 0;
function userColor(name: string) {
  if (!colorMap.has(name)) colorMap.set(name, PALETTE[colorIdx++ % PALETTE.length]);
  return colorMap.get(name)!;
}

const EMOJIS = ['😀','😂','🔥','❤️','👏','🎵','🎶','🎸','🎹','🎤',
                '😎','🤩','💯','🙌','✨','🎉','😍','🥳','💜','🎧'];

interface Msg {
  id: string; username: string; body: string;
  type: string; color: string;
}

export default function Player() {
  const { slug } = useParams<{ slug: string }>();
  const {
    current: channel, liveState,
    fetchChannel, setLiveState, setViewers, clearCurrent,
  } = useChannelStore();
  const { user } = useAuthStore();

  // YT player
  const iframeRef    = useRef<HTMLIFrameElement>(null);
  const playerRef    = useRef<any>(null);
  const playerReady  = useRef(false);
  const currentYtId  = useRef('');
  const lsRef        = useRef<LiveState | null>(null);

  // Progress
  const progRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [pct,    setPct]    = useState(0);
  const [curSec, setCurSec] = useState(0);
  const [durSec, setDurSec] = useState(0);

  // UI
  const [msgs,      setMsgs]      = useState<Msg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [ytReady,   setYtReady]   = useState(false);
  const [ytErr,     setYtErr]     = useState(false);
  const [vol,       setVol]       = useState(80);
  const [muted,     setMuted]     = useState(false);
  const [showTop,   setShowTop]   = useState(true);
  const [showEmoji, setShowEmoji] = useState(false);
  const [vc,        setVc]        = useState(0);
  const chatEndRef  = useRef<HTMLDivElement>(null);
  const hideRef     = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { lsRef.current = liveState; }, [liveState]);

  const resetHide = useCallback(() => {
    setShowTop(true);
    if (hideRef.current) clearTimeout(hideRef.current);
    hideRef.current = setTimeout(() => setShowTop(false), 4000);
  }, []);

  // ── 1. Load YT IFrame API ──────────────────────────────
  useEffect(() => {
    if (window.YT?.Player) { setYtReady(true); return; }
    if (!document.getElementById('yt-api')) {
      const s = document.createElement('script');
      s.id = 'yt-api'; s.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(s);
    }
    window.onYouTubeIframeAPIReady = () => setYtReady(true);
  }, []);

  // ── 2. Fetch channel ───────────────────────────────────
  useEffect(() => {
    if (!slug) return;
    clearCurrent();
    playerReady.current = false;
    currentYtId.current = '';
    setYtErr(false); setPct(0); setCurSec(0); setDurSec(0);
    try { playerRef.current?.destroy(); } catch {}
    playerRef.current = null;
    fetchChannel(slug);
    resetHide();
  }, [slug]);

  // ── 3. WebSocket ───────────────────────────────────────
  useEffect(() => {
    if (!slug) return;
    const token = localStorage.getItem('accessToken');

    wsClient.onSync = (state) => {
      setLiveState(state);
      if (typeof state.viewers === 'number') { setVc(state.viewers); setViewers(state.viewers); }

      // Update progress counters from server
      const dur = state.totalDuration || 0;
      const frame = state.frameAt || 0;
      setDurSec(dur);
      setCurSec(frame);
      if (dur > 0) setPct((frame / dur) * 100);

      // Auto-next: different ytId = new video
      if (playerRef.current && state.ytId) {
        if (state.ytId !== currentYtId.current) {
          currentYtId.current = state.ytId;
          try {
            playerRef.current.loadVideoById({
              videoId: state.ytId,
              startSeconds: Math.floor(frame),
            });
          } catch {}
        } else {
          try {
            const cur = playerRef.current.getCurrentTime?.() ?? 0;
            if (Math.abs(cur - frame) > 2) playerRef.current.seekTo(frame, true);
          } catch {}
        }
      }
    };

    wsClient.onChat = (msg) => {
      setMsgs(prev => [...prev.slice(-49), {
        id: msg.id, username: msg.username,
        body: msg.body, type: msg.type,
        color: userColor(msg.username),
      }]);
    };

    wsClient.onSystem = (body) => {
      setMsgs(prev => [...prev.slice(-49), {
        id: Date.now().toString(), username: 'Sistema',
        body, type: 'system', color: '#c45cfc',
      }]);
    };

    wsClient.onViewer = (n) => { setVc(n); setViewers(n); };
    wsClient.connect(slug, token);
    return () => wsClient.disconnect();
  }, [slug]);

  // ── 4. Create YT Player ────────────────────────────────
  const mkPlayer = useCallback(() => {
    if (!ytReady || playerReady.current || !iframeRef.current) return;
    const st = lsRef.current;
    if (!st?.ytId) return;
    playerReady.current = true;
    currentYtId.current = st.ytId;

    // YT Player replaces the div, not the iframe — use a div target
    const div = document.getElementById('yt-player-target');
    if (!div) return;

    playerRef.current = new window.YT.Player('yt-player-target', {
      videoId: st.ytId, width: '100%', height: '100%',
      playerVars: {
        autoplay:       1,
        controls:       0,   // hide all YT controls
        disablekb:      1,   // disable keyboard
        fs:             0,   // no fullscreen button
        modestbranding: 1,   // minimal branding
        rel:            0,   // no related videos
        iv_load_policy: 3,   // no annotations
        cc_load_policy: 0,   // no captions
        showinfo:       0,   // no title/uploader (legacy but helps)
        playsinline:    1,   // play inline on iOS
        start:          Math.floor(st.frameAt),
        origin:         window.location.origin,
        enablejsapi:    1,
      },
      events: {
        onReady: (e: any) => {
          e.target.seekTo(lsRef.current?.frameAt ?? st.frameAt, true);
          e.target.setVolume(vol);
          if (muted) e.target.mute();
          e.target.playVideo();
          setYtErr(false);
        },
        onStateChange: (e: any) => {
          // Keep playing — no user control over playback
          if (e.data === window.YT?.PlayerState?.PAUSED) {
            setTimeout(() => { try { e.target.playVideo(); } catch {} }, 200);
          }
          // Video ended — server sync will deliver next ytId automatically
          // via wsClient.onSync when ytId changes
        },
        onError: () => setYtErr(true),
      },
    });
  }, [ytReady, vol, muted]);

  useEffect(() => { mkPlayer(); }, [mkPlayer]);
  useEffect(() => {
    if (liveState?.ytId && ytReady && !playerReady.current) mkPlayer();
  }, [liveState?.ytId, ytReady, mkPlayer]);

  // ── 5. Local progress interpolation ───────────────────
  useEffect(() => {
    if (progRef.current) clearInterval(progRef.current);
    if (!durSec) return;
    let f = curSec;
    progRef.current = setInterval(() => {
      f = Math.min(f + 0.1, durSec);
      setPct((f / durSec) * 100);
    }, 100);
    return () => { if (progRef.current) clearInterval(progRef.current); };
  }, [curSec, durSec]);

  // ── 6. Auto-scroll chat ────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs]);

  const handleVol = (v: number) => {
    setVol(v);
    if (v > 0) { setMuted(false); playerRef.current?.unMute?.(); }
    playerRef.current?.setVolume?.(v);
  };
  const toggleMute = () => {
    if (muted) { playerRef.current?.unMute?.(); playerRef.current?.setVolume?.(vol); }
    else playerRef.current?.mute?.();
    setMuted(!muted);
  };
  const sendChat = () => {
    if (!chatInput.trim() || !user) return;
    wsClient.sendChat(chatInput.trim().slice(0, 200));
    setChatInput('');
    setShowEmoji(false);
  };
  const fmt = (s: number) => {
    const m = Math.floor(s / 60), ss = Math.floor(s % 60);
    return `${m}:${ss.toString().padStart(2, '0')}`;
  };

  if (!channel) return (
    <div className="flex items-center justify-center h-[calc(100vh-56px)]">
      <div className="text-center">
        <div className="text-5xl mb-3">📡</div>
        <p className="text-txt2">Cargando canal...</p>
      </div>
    </div>
  );

  const isLive   = channel.status === 'live';
  const hasVideo = isLive && !!liveState?.ytId && !ytErr;

  return (
    <div className="relative w-full bg-black overflow-hidden"
         style={{ height: 'calc(100vh - 56px)' }}
         onMouseMove={resetHide}>

      {/* ── YT Player container ── */}
      {hasVideo ? (
        <div id="yt-player-target"
             className="absolute inset-0 w-full h-full z-0"
             ref={iframeRef} />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ background:`linear-gradient(135deg,${channel.accentColor}22,${channel.accentColor}55)` }}>
          <span className="text-8xl mb-3">{channel.icon}</span>
          <p className="text-txt2 text-lg">
            {!isLive ? 'Canal pausado' : ytErr ? 'Video no disponible para embedding' : 'Conectando...'}
          </p>
        </div>
      )}

      {/*
        IMPORTANT: This transparent overlay sits ABOVE the YT iframe.
        It captures mouse events so our UI works, but passes clicks
        through to the iframe via pointer-events on child elements.
        The iframe itself is z-0, all our UI is z-10+.
      */}
      <div className="absolute inset-0 z-10"
           style={{ pointerEvents: 'none' }}>

        {/* ── TOP BAR (auto-hides) ── */}
        <div className={`absolute top-0 left-0 right-0 px-4 pt-3 pb-10 flex items-center
                         justify-between transition-opacity duration-500
                         ${showTop ? 'opacity-100' : 'opacity-0'}`}
             style={{
               background: 'linear-gradient(to bottom,rgba(0,0,0,0.8),transparent)',
               pointerEvents: 'auto',
             }}>
          {/* Channel */}
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-black/50 border border-white/20
                            flex items-center justify-center text-lg flex-shrink-0">
              {channel.icon}
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-tight"
                 style={{ textShadow:'0 1px 4px rgba(0,0,0,0.9)' }}>
                {channel.name}
              </p>
              <p className="text-white/50 text-[10px]">@{channel.owner?.username}</p>
            </div>
          </div>

          {/* LIVE */}
          {isLive && (
            <div className="flex items-center gap-1.5 bg-live/90 text-white
                            text-xs font-bold px-3 py-1 rounded-full uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse-dot" />
              En Vivo
            </div>
          )}

          {/* Viewers + Follow */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-black/60 text-white text-xs
                            px-2.5 py-1 rounded-full border border-white/10">
              <span className="w-1.5 h-1.5 rounded-full bg-live animate-pulse-dot" />
              {vc.toLocaleString()} viendo
            </div>
            <button className="bg-black/50 border border-white/20 text-white text-xs
                               px-3 py-1 rounded-full hover:bg-white/20 transition-all">
              + Seguir
            </button>
          </div>
        </div>

        {/* ── CHAT OVERLAY — right side, above input, top-to-bottom ── */}
        <div className="absolute right-0 w-72 flex flex-col gap-0"
             style={{ bottom: '115px', maxHeight: '45vh', overflow: 'hidden', pointerEvents: 'none' }}>
          {msgs.slice(-15).map(msg => (
            <div key={msg.id} className="px-3 py-1">
              {msg.type === 'system' ? (
                <p className="text-[11px] italic text-center"
                   style={{ color:'#c45cfc', textShadow:'0 1px 5px rgba(0,0,0,1)' }}>
                  {msg.body}
                </p>
              ) : (
                <div>
                  <p className="text-[11px] font-bold leading-tight"
                     style={{ color: msg.color, textShadow:'0 1px 5px rgba(0,0,0,1)' }}>
                    {msg.username}
                  </p>
                  <p className="text-[12px] text-white leading-snug"
                     style={{ textShadow:'0 1px 5px rgba(0,0,0,1)' }}>
                    {msg.body}
                  </p>
                </div>
              )}
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* ── BOTTOM BAR — always visible ── */}
        <div className="absolute bottom-0 left-0 right-0"
             style={{
               background: 'linear-gradient(transparent,rgba(0,0,0,0.9))',
               pointerEvents: 'auto',
             }}>

          {/* Now playing + next */}
          <div className="px-4 pt-2 pb-1 flex items-center gap-2 min-w-0">
            <span className="text-white/40 text-[10px] flex-shrink-0">♪</span>
            <span className="text-white text-xs font-medium truncate flex-1"
                  style={{ textShadow:'0 1px 4px rgba(0,0,0,0.8)' }}>
              {liveState?.title || channel.name}
            </span>
            {liveState?.nextVideo && (
              <span className="text-white/40 text-[10px] flex-shrink-0 truncate max-w-[140px]">
                ▸ {liveState.nextVideo}
              </span>
            )}
          </div>

          {/* Progress bar */}
          <div className="px-4 pb-1">
            <div className="relative h-1 bg-white/15 rounded-full overflow-hidden">
              <div className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  width: `${pct}%`,
                  background: `linear-gradient(90deg,${channel.accentColor},#c45cfc)`,
                  transition: 'width 0.1s linear',
                  minWidth: pct > 0.5 ? '4px' : '0',
                }} />
            </div>
            <div className="flex justify-between mt-0.5">
              <span className="text-[10px] text-white/50 tabular-nums">{fmt(curSec)}</span>
              <span className="text-[10px] text-white/25 italic">Sincronizado</span>
              <span className="text-[10px] text-white/50 tabular-nums">{fmt(durSec)}</span>
            </div>
          </div>

          {/* Chat input */}
          <div className="px-4 pb-3 flex items-center gap-2"
               onClick={e => e.stopPropagation()}>

            {/* Volume */}
            <button onClick={toggleMute}
              className="text-white/60 hover:text-white text-base w-5 flex-shrink-0">
              {muted || vol === 0 ? '🔇' : vol < 50 ? '🔉' : '🔊'}
            </button>
            <input type="range" min={0} max={100} value={muted ? 0 : vol}
              onChange={e => handleVol(Number(e.target.value))}
              className="w-16 flex-shrink-0 cursor-pointer"
              style={{ accentColor: channel.accentColor, height:'3px' }} />

            <div className="flex-1" />

            {user ? (
              <div className="flex items-center gap-1.5 relative">
                {showEmoji && (
                  <div className="absolute bottom-9 right-0 z-30 bg-bg2/95 backdrop-blur
                                  border border-white/10 rounded-xl p-2 grid grid-cols-5 gap-1 shadow-xl"
                       onClick={e => e.stopPropagation()}>
                    {EMOJIS.map(e => (
                      <button key={e}
                        onClick={() => setChatInput(p => (p+e).slice(0,200))}
                        className="text-xl hover:scale-125 transition-transform p-0.5">
                        {e}
                      </button>
                    ))}
                  </div>
                )}
                <button onClick={() => setShowEmoji(v => !v)}
                  className="text-white/60 hover:text-white text-xl flex-shrink-0">
                  😊
                </button>
                <div className="flex items-center bg-black/60 border border-white/20
                                rounded-full overflow-hidden">
                  <input value={chatInput} maxLength={200}
                    onChange={e => setChatInput(e.target.value.slice(0,200))}
                    onKeyDown={e => e.key === 'Enter' && sendChat()}
                    placeholder="Escribe un mensaje..."
                    className="bg-transparent text-white text-xs px-3 py-1.5 outline-none
                               placeholder-white/30 w-44" />
                  <button onClick={sendChat}
                    className="text-white/80 text-xs px-3 py-1.5 hover:bg-white/10
                               transition-colors border-l border-white/10 flex-shrink-0">
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
      </div>{/* end z-10 overlay */}
    </div>
  );
}

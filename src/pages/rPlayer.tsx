import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useChannelStore } from '../stores/channelStore';
import { useAuthStore } from '../stores/authStore';
import { wsClient } from '../services/websocket';
import type { ChatMessage } from '../types';

export default function Player() {
  const { slug } = useParams<{ slug: string }>();
  const { current: channel, liveState, viewers,
          fetchChannel, setLiveState, setViewers } = useChannelStore();
  const { user } = useAuthStore();

  const [messages,  setMessages]  = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [progress,  setProgress]  = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const progressTimer = useRef<ReturnType<typeof setInterval>>();

  // Load channel data
  useEffect(() => {
    if (slug) fetchChannel(slug);
  }, [slug]);

  // WebSocket
  useEffect(() => {
    if (!slug) return;
    const token = localStorage.getItem('accessToken');

    wsClient.on('sync', (state) => {
      setLiveState(state);
      if (state.viewers) setViewers(state.viewers);
    });

    wsClient.on('chat', (msg) => {
      setMessages(prev => [...prev.slice(-100), msg]);
    });

    wsClient.on('system', (body) => {
      setMessages(prev => [...prev, {
        id: Date.now().toString(), userId: 'system',
        username: 'Sistema', body, type: 'system', createdAt: new Date().toISOString(),
      }]);
    });

    wsClient.on('viewer', setViewers);
    wsClient.connect(slug, token);

    return () => wsClient.disconnect();
  }, [slug]);

  // Progress bar animation
  useEffect(() => {
    if (!liveState) return;
    clearInterval(progressTimer.current);
    let frame = liveState.frameAt;
    const total = liveState.totalDuration || 1;
    setProgress((frame / total) * 100);

    progressTimer.current = setInterval(() => {
      frame += 0.1;
      if (frame > total) frame = 0;
      setProgress((frame / total) * 100);
    }, 100);

    return () => clearInterval(progressTimer.current);
  }, [liveState?.ytId, liveState?.frameAt]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendChat = () => {
    if (!chatInput.trim() || !user) return;
    wsClient.sendChat(chatInput.trim());
    setChatInput('');
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (!channel) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-4xl mb-4">📡</div>
          <p className="text-txt2">Cargando canal...</p>
        </div>
      </div>
    );
  }

  const thumbnail = liveState?.ytId
    ? `https://img.youtube.com/vi/${liveState.ytId}/maxresdefault.jpg`
    : null;

  return (
    <div className="flex h-[calc(100vh-56px)]">

      {/* Main player */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">

        {/* Video */}
        <div className="relative bg-black aspect-video w-full overflow-hidden">
          {thumbnail ? (
            <img src={thumbnail} alt={liveState?.title}
              className="w-full h-full object-cover opacity-80"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          ) : (
            <div className="w-full h-full flex items-center justify-center"
                 style={{ background: `linear-gradient(135deg, ${channel.accentColor}33, ${channel.accentColor}66)` }}>
              <span className="text-8xl">{channel.icon}</span>
            </div>
          )}

          {/* Overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

          {/* Badges */}
          <div className="absolute top-3 left-3 flex gap-2">
            {channel.status === 'live' && (
              <div className="flex items-center gap-1.5 bg-live text-white text-xs
                              font-bold px-2.5 py-1 rounded-md uppercase tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse-dot" />
                En Vivo
              </div>
            )}
            <div className="flex items-center gap-1.5 bg-online/80 text-white
                            text-xs font-bold px-2.5 py-1 rounded-md">
              <span className="w-1.5 h-1.5 rounded-full bg-white" />
              SYNC
            </div>
          </div>

          {/* Viewers */}
          <div className="absolute top-3 right-3 flex items-center gap-1.5
                          bg-black/60 text-white text-xs px-2.5 py-1 rounded-md">
            <span className="w-1.5 h-1.5 rounded-full bg-live" />
            {viewers.toLocaleString()} viendo
          </div>

          {/* Title overlay */}
          <div className="absolute bottom-4 left-4">
            {channel.status === 'live' && liveState && (
              <>
                <p className="text-white/60 text-xs mb-1 uppercase tracking-wider">
                  Reproduciendo ahora
                </p>
                <h2 className="font-display font-bold text-white text-xl">
                  {liveState.title}
                </h2>
                {liveState.artist && (
                  <p className="text-white/70 text-sm">{liveState.artist}</p>
                )}
              </>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {liveState && (
          <div className="bg-bg2 border-t border-white/5 px-5 py-2">
            <div className="h-0.5 bg-bg4 rounded-full relative mb-1.5">
              <div className="h-full rounded-full transition-all duration-100"
                   style={{ width: `${progress}%`,
                            background: `linear-gradient(90deg, ${channel.accentColor}, #c45cfc)` }} />
            </div>
            <div className="flex justify-between text-xs text-txt3">
              <span>{formatTime((progress / 100) * (liveState.totalDuration || 0))}</span>
              <span className="text-[10px] text-txt3 italic">
                Sincronizado — todos ven el mismo frame
              </span>
              <span>{formatTime(liveState.totalDuration || 0)}</span>
            </div>
          </div>
        )}

        {/* Channel info */}
        <div className="p-5 border-b border-white/5">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{channel.icon}</span>
            <div className="flex-1">
              <h1 className="font-display font-bold text-xl">{channel.name}</h1>
              <p className="text-xs text-txt3">@{channel.owner?.username} · {channel.followerCount} seguidores</p>
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
              <span key={t} className="text-xs bg-accent/10 border border-accent/20
                                       text-accent px-2.5 py-1 rounded-full">
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

      {/* Chat sidebar */}
      <div className="w-72 flex-shrink-0 bg-bg2 border-l border-white/5 flex flex-col">

        <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
          <h3 className="font-display font-bold text-sm">Chat en Vivo</h3>
          <div className="flex items-center gap-1.5 text-xs text-txt2">
            <span className="w-1.5 h-1.5 rounded-full bg-live" />
            {viewers.toLocaleString()}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
          {messages.length === 0 && (
            <p className="text-center text-xs text-txt3 pt-8">
              Se el primero en escribir...
            </p>
          )}
          {messages.map((msg) => (
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

        {/* Input */}
        <div className="p-3 border-t border-white/5">
          {user ? (
            <>
              <div className="flex gap-2 mb-2">
                <input
                  value={chatInput}
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
                onClick={() => {/* open credits modal */}}
                className="w-full bg-accent2/10 border border-accent2/20 text-accent2
                           text-xs py-1.5 rounded-lg hover:bg-accent2/20 transition-colors">
                ✦ Enviar creditos al canal
              </button>
            </>
          ) : (
            <div className="text-center py-2">
              <p className="text-xs text-txt3 mb-2">Registrate para chatear</p>
              <Link to="/register"
                className="text-xs text-accent hover:underline">
                Crear cuenta gratis →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

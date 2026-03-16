import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { channelsApi, schedulesApi, videosApi } from '../services/api';
import type { Channel, ScheduleDay, Video } from '../types';

const DAYS = ['Dom', 'Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab'];

export default function Dashboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [channels,   setChannels]   = useState<Channel[]>([]);
  const [active,     setActive]     = useState<Channel | null>(null);
  const [schedule,   setSchedule]   = useState<ScheduleDay | null>(null);
  const [library,    setLibrary]    = useState<Video[]>([]);
  const [activeDay,  setActiveDay]  = useState(new Date().getDay());
  const [ytUrl,      setYtUrl]      = useState('');
  const [addMsg,     setAddMsg]     = useState('');
  const [adding,     setAdding]     = useState(false);
  const [statusMsg,  setStatusMsg]  = useState('');
  const [loadingCh,  setLoadingCh]  = useState(true);

  // Load only this user's channels
  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    loadMyChannels();
  }, [user]);

  // Load schedule + library when active channel or day changes
  useEffect(() => {
    if (!active) return;
    loadSchedule();
    loadLibrary();
  }, [active?.slug, activeDay]);

  const loadMyChannels = async () => {
    setLoadingCh(true);
    try {
      // Get all channels, filter by owner
      const { data } = await channelsApi.list();
      const mine: Channel[] = (data.channels ?? []).filter(
        (c: Channel) => (c as any).ownerId === user?.id
                     || c.owner?.username === user?.username
      );
      setChannels(mine);
      if (mine.length > 0) setActive(mine[0]);
    } catch {}
    setLoadingCh(false);
  };

  const loadSchedule = async () => {
    if (!active) return;
    try {
      const { data } = await schedulesApi.get(active.slug, activeDay);
      setSchedule(data);
    } catch { setSchedule(null); }
  };

  const loadLibrary = async () => {
    if (!active) return;
    try {
      const { data } = await videosApi.list(active.slug);
      // data is an array of videos belonging ONLY to this channel
      setLibrary(Array.isArray(data) ? data : []);
    } catch { setLibrary([]); }
  };

  const addYoutube = async () => {
    if (!active || !ytUrl.trim()) return;
    setAdding(true);
    setAddMsg('');
    try {
      await schedulesApi.addYoutube(active.slug, ytUrl.trim(), activeDay);
      setAddMsg('Video agregado correctamente');
      setYtUrl('');
      await loadLibrary();
      await loadSchedule();
    } catch (e: any) {
      setAddMsg(e.response?.data?.error ?? 'Error al agregar video');
    }
    setAdding(false);
    setTimeout(() => setAddMsg(''), 4000);
  };

  const removeFromSchedule = async (videoId: string) => {
    if (!active || !schedule) return;
    const newIds = (schedule.videos ?? [])
      .filter(v => v.id !== videoId)
      .map(v => v.id);
    try {
      await schedulesApi.save(active.slug, activeDay, {
        videoIds:    newIds,
        shuffle:     schedule.shuffle,
        loop:        schedule.loop,
        crossfadeSec:schedule.crossfadeSec,
      });
      await loadSchedule();
    } catch {}
  };

  const toggleStatus = async () => {
    if (!active) return;
    const next = active.status === 'live' ? 'paused' : 'live';
    try {
      await channelsApi.setStatus(active.slug, next);
      const updated = { ...active, status: next } as Channel;
      setActive(updated);
      setChannels(prev => prev.map(c => c.slug === active.slug ? updated : c));
      setStatusMsg(next === 'live' ? 'Canal EN VIVO' : 'Canal pausado');
      setTimeout(() => setStatusMsg(''), 3000);
    } catch {}
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  if (!user) return null;

  // No channels yet
  if (!loadingCh && channels.length === 0) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center">
        <div className="text-center bg-bg2 border border-white/5 rounded-2xl p-10 max-w-sm">
          <div className="text-5xl mb-4">📡</div>
          <h2 className="font-display font-bold text-xl mb-2">Sin canales todavia</h2>
          <p className="text-txt2 text-sm mb-6">
            Crea tu primer canal para empezar a transmitir musica en vivo.
          </p>
          <Link to="/create-channel"
            className="bg-accent text-white px-6 py-2.5 rounded-lg text-sm
                       font-medium hover:bg-accent/80 transition-colors inline-block">
            Crear Canal
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-56px)]">

      {/* Sidebar */}
      <div className="w-56 flex-shrink-0 bg-bg2 border-r border-white/5 flex flex-col">
        <div className="p-4 border-b border-white/5">
          <p className="text-xs text-txt3 uppercase tracking-wider mb-3">Mis Canales</p>
          {loadingCh ? (
            <div className="space-y-2">
              {[1,2].map(i => <div key={i} className="h-8 bg-bg3 rounded-lg animate-pulse" />)}
            </div>
          ) : (
            channels.map(ch => (
              <button key={ch.id} onClick={() => setActive(ch)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm
                            text-left transition-all mb-1
                            ${active?.slug === ch.slug
                              ? 'bg-accent/10 text-accent border border-accent/20'
                              : 'text-txt2 hover:text-txt hover:bg-bg3'}`}>
                <span>{ch.icon}</span>
                <span className="truncate flex-1">{ch.name}</span>
                {ch.status === 'live' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-live flex-shrink-0 animate-pulse-dot" />
                )}
              </button>
            ))
          )}
        </div>

        <div className="p-4">
          <p className="text-xs text-txt3 uppercase tracking-wider mb-3">Menu</p>
          {['Resumen', 'Programacion', 'Biblioteca', 'Creditos'].map(item => (
            <div key={item}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm
                         text-txt2 hover:text-txt hover:bg-bg3 cursor-pointer transition-all mb-0.5">
              {item}
            </div>
          ))}
        </div>
      </div>

      {/* Main */}
      {active && (
        <div className="flex-1 overflow-y-auto p-6">

          {/* Header */}
          <div className="flex items-center gap-4 mb-6 flex-wrap">
            <span className="text-3xl">{active.icon}</span>
            <div>
              <h1 className="font-display font-extrabold text-xl">{active.name}</h1>
              <p className="text-xs text-txt3">/{active.slug}</p>
            </div>
            <div className="ml-auto flex items-center gap-3 flex-wrap">
              {statusMsg && <span className="text-xs text-online">{statusMsg}</span>}
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full
                               text-xs font-bold border
                               ${active.status === 'live'
                                 ? 'bg-live/10 border-live/30 text-live'
                                 : 'bg-white/5 border-white/10 text-txt3'}`}>
                {active.status === 'live' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-live animate-pulse-dot" />
                )}
                {active.status === 'live' ? 'EN VIVO' : 'PAUSADO'}
              </div>
              <button onClick={toggleStatus}
                className="px-4 py-1.5 text-sm border border-white/10 rounded-lg
                           text-txt2 hover:border-accent hover:text-txt transition-all">
                {active.status === 'live' ? 'Pausar' : 'Ir en Vivo'}
              </button>
              <Link to={`/channel/${active.slug}`}
                className="px-4 py-1.5 text-sm bg-accent/10 border border-accent/20
                           text-accent rounded-lg hover:bg-accent/20 transition-all">
                Ver Canal →
              </Link>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: 'Seguidores', value: (active.followerCount ?? 0).toLocaleString() },
              { label: 'Plan',       value: active.plan.toUpperCase() },
              { label: 'Estado',     value: active.status },
            ].map(s => (
              <div key={s.label}
                className="bg-bg3 border border-white/5 rounded-xl p-4">
                <p className="text-xs text-txt3 uppercase tracking-wider mb-1">{s.label}</p>
                <p className="font-display font-bold text-xl">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Scheduler */}
          <div className="bg-bg2 border border-white/5 rounded-xl p-5 mb-4">
            <h2 className="font-display font-bold text-base mb-4">
              Programacion Diaria — {active.name}
            </h2>

            {/* Day tabs */}
            <div className="flex gap-1.5 mb-4 flex-wrap">
              {DAYS.map((d, i) => (
                <button key={d} onClick={() => setActiveDay(i)}
                  className={`px-3 py-1 rounded-lg text-xs border transition-all
                    ${activeDay === i
                      ? 'bg-accent border-accent text-white'
                      : 'border-white/10 text-txt3 hover:text-txt'}`}>
                  {d}
                  {i === new Date().getDay() && (
                    <span className="ml-1 text-[9px] text-online">hoy</span>
                  )}
                </button>
              ))}
            </div>

            {/* Add URL */}
            <div className="flex gap-2 mb-3">
              <input value={ytUrl} onChange={e => setYtUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addYoutube()}
                placeholder="https://youtube.com/watch?v=..."
                className="flex-1 bg-bg3 border border-white/10 rounded-lg px-3 py-2
                           text-sm text-txt placeholder-txt3 outline-none
                           focus:border-accent transition-colors"
              />
              <button onClick={addYoutube} disabled={adding || !ytUrl.trim()}
                className="bg-accent text-white px-4 py-2 rounded-lg text-sm
                           font-medium hover:bg-accent/80 transition-colors
                           disabled:opacity-40 disabled:cursor-not-allowed">
                {adding ? '...' : '+ Agregar'}
              </button>
            </div>

            {addMsg && (
              <p className={`text-xs mb-3 ${addMsg.includes('Error') ? 'text-live' : 'text-online'}`}>
                {addMsg}
              </p>
            )}

            {/* Schedule list */}
            {!schedule || !schedule.videos || schedule.videos.length === 0 ? (
              <div className="text-center py-10 text-txt3 text-sm border border-dashed
                              border-white/10 rounded-xl">
                <div className="text-3xl mb-2">🎵</div>
                Sin videos programados para {DAYS[activeDay]}.
                <br />Agrega un URL de YouTube arriba.
              </div>
            ) : (
              <div>
                <div className="grid grid-cols-[1fr_70px_90px] gap-3 px-3 py-1
                                text-xs text-txt3 uppercase tracking-wider
                                border-b border-white/5 mb-1">
                  <span>Video</span>
                  <span>Duracion</span>
                  <span>Estado</span>
                </div>
                {schedule.videos.map((v, i) => (
                  <div key={v.id}
                    className="grid grid-cols-[1fr_70px_90px] gap-3 items-center
                               px-3 py-2.5 rounded-lg hover:bg-bg3 transition-colors group">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-xs text-txt3 w-4 flex-shrink-0">{i + 1}</span>
                      {v.ytId && (
                        <img
                          src={`https://img.youtube.com/vi/${v.ytId}/default.jpg`}
                          alt=""
                          className="w-10 h-7 rounded object-cover flex-shrink-0"
                          onError={e => (e.target as HTMLImageElement).style.display = 'none'}
                        />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{v.title}</p>
                        {v.artist && <p className="text-xs text-txt3 truncate">{v.artist}</p>}
                      </div>
                    </div>
                    <span className="text-xs text-txt2">{fmt(v.durationSec)}</span>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-txt3">{v.source}</span>
                      <button onClick={() => removeFromSchedule(v.id)}
                        className="opacity-0 group-hover:opacity-100 text-xs text-live
                                   hover:text-live/70 transition-all px-1">
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
                {(schedule.totalDuration ?? 0) > 0 && (
                  <p className="text-xs text-txt3 text-right pt-2 pr-3 border-t border-white/5 mt-1">
                    Total: {Math.floor((schedule.totalDuration ?? 0) / 3600)}h{' '}
                    {Math.floor(((schedule.totalDuration ?? 0) % 3600) / 60)}m
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Library — only this channel's videos */}
          <div className="bg-bg2 border border-white/5 rounded-xl p-5">
            <h2 className="font-display font-bold text-base mb-4">
              Biblioteca de Videos — {active.name} ({library.length})
            </h2>
            {library.length === 0 ? (
              <p className="text-center py-6 text-txt3 text-sm">
                Sin videos. Agrega un URL de YouTube en la programacion.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {library.map(v => (
                  <div key={v.id}
                    className="flex items-center gap-2.5 p-2.5 bg-bg3 rounded-lg
                               hover:bg-bg4 transition-colors">
                    {v.ytId && (
                      <img
                        src={`https://img.youtube.com/vi/${v.ytId}/default.jpg`}
                        alt=""
                        className="w-14 h-9 rounded object-cover flex-shrink-0"
                        onError={e => (e.target as HTMLImageElement).style.display = 'none'}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{v.title}</p>
                      <p className="text-[10px] text-txt3">
                        {fmt(v.durationSec)} · {v.source}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}

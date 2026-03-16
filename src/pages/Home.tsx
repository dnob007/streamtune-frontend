import { useEffect, useState } from 'react';
import { useChannelStore } from '../stores/channelStore';
import ChannelCard from '../components/ChannelCard';

const TOPICS = ['Todos', 'Lo-Fi', '80s & 90s', 'Latin', 'Jazz',
                'Electronica', 'Rock', 'Cursos', 'Salsa', 'Pop'];

const FILTERS = [
  { label: 'Todos',     value: undefined },
  { label: 'En Vivo',   value: 'live'    },
  { label: 'Pausados',  value: 'paused'  },
];

export default function Home() {
  const { channels, isLoading, fetchChannels } = useChannelStore();
  const [topic,  setTopic]  = useState('Todos');
  const [status, setStatus] = useState<string | undefined>(undefined);

  useEffect(() => {
    fetchChannels(status ? { status } : {});
  }, [status]);

  const filtered = topic === 'Todos'
    ? channels
    : channels.filter(c => c.topics?.includes(topic));

  return (
    <div className="min-h-screen">

      {/* Hero */}
      <div className="text-center px-6 pt-14 pb-8">
        <div className="inline-flex items-center gap-2 bg-accent/10 border border-accent/30
                        rounded-full px-4 py-1.5 text-xs text-accent font-medium mb-6
                        uppercase tracking-widest">
          <span className="w-1.5 h-1.5 rounded-full bg-online animate-pulse-dot" />
          Transmitiendo en vivo ahora
        </div>
        <h1 className="font-display font-extrabold text-4xl md:text-5xl tracking-tight mb-4">
          Musica{' '}
          <span className="bg-gradient-to-r from-accent to-accent2 bg-clip-text text-transparent">
            en vivo,
          </span>
          <br />sin interrupciones
        </h1>
        <p className="text-txt2 text-base max-w-md mx-auto">
          Canales tematicos 24/7. Todos los espectadores ven
          el mismo video, en el mismo frame, en tiempo real.
        </p>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 px-6 mb-3">
        {FILTERS.map(f => (
          <button key={f.label}
            onClick={() => setStatus(f.value)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-all
              ${status === f.value
                ? 'bg-accent border-accent text-white'
                : 'border-white/10 text-txt3 hover:text-txt hover:border-white/20'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Topic filter */}
      <div className="flex gap-2 px-6 pb-4 overflow-x-auto scrollbar-none">
        {TOPICS.map(t => (
          <button key={t}
            onClick={() => setTopic(t)}
            className={`px-3 py-1 rounded-full text-xs whitespace-nowrap border transition-all
              ${topic === t
                ? 'bg-accent border-accent text-white'
                : 'border-white/10 text-txt3 hover:text-txt'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="px-6 pb-16">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-bg3 rounded-2xl overflow-hidden animate-pulse">
                <div className="aspect-video bg-bg4" />
                <div className="p-4 space-y-2">
                  <div className="h-3 bg-bg4 rounded w-1/3" />
                  <div className="h-4 bg-bg4 rounded w-2/3" />
                  <div className="h-3 bg-bg4 rounded w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 text-txt3">
            <div className="text-4xl mb-4">📡</div>
            <p className="text-lg font-display font-bold mb-2">Sin canales por ahora</p>
            <p className="text-sm">No hay canales con ese filtro actualmente.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(ch => (
              <ChannelCard key={ch.id} channel={ch} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

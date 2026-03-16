import { Link } from 'react-router-dom';
import type { Channel } from '../types';

interface Props { channel: Channel; }

export default function ChannelCard({ channel }: Props) {
  const isLive = channel.status === 'live';

  return (
    <Link to={`/channel/${channel.slug}`}
      className="group bg-bg3 border border-white/5 rounded-2xl overflow-hidden
                 hover:-translate-y-1 hover:border-white/10 transition-all duration-200
                 hover:shadow-[0_8px_32px_rgba(0,0,0,0.4)] block">

      {/* Thumbnail */}
      <div className="aspect-video flex items-center justify-center relative overflow-hidden"
           style={{ background: `linear-gradient(135deg, ${channel.accentColor}22, ${channel.accentColor}44)` }}>
        <span className="text-5xl z-10">{channel.icon}</span>

        {/* Status badge */}
        <div className={`absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2 py-1
                         rounded-md text-xs font-bold uppercase tracking-wide
                         ${isLive ? 'bg-live text-white' : 'bg-white/10 text-txt3'}`}>
          {isLive && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse-dot" />}
          {isLive ? 'En Vivo' : 'Pausado'}
        </div>

        {/* Viewer count */}
        {isLive && (channel.viewers ?? 0) > 0 && (
          <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5
                          bg-black/50 text-white text-xs px-2 py-1 rounded-md">
            <span className="w-1.5 h-1.5 rounded-full bg-live" />
            {(channel.viewers ?? 0).toLocaleString()}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="flex items-center gap-1.5 mb-1">
          {channel.topics.slice(0, 2).map(t => (
            <span key={t} className="text-[10px] font-medium text-accent uppercase tracking-wider">
              {t}
            </span>
          ))}
        </div>
        <h3 className="font-display font-bold text-txt text-base mb-1 leading-tight">
          {channel.name}
        </h3>
        <p className="text-xs text-txt2 leading-relaxed line-clamp-2 mb-3">
          {channel.description}
        </p>
        <div className="flex items-center justify-between">
          <span className="text-xs text-txt3">
            @{channel.owner?.username}
          </span>
          <span className="text-xs text-txt3">
            {(channel.followerCount ?? 0).toLocaleString()} seguidores
          </span>
        </div>
      </div>
    </Link>
  );
}

import { create } from 'zustand';
import type { Channel, LiveState } from '../types';
import { channelsApi } from '../services/api';

interface ChannelStore {
  channels:   Channel[];
  current:    Channel | null;
  liveState:  LiveState | null;
  viewers:    number;
  isLoading:  boolean;
  error:      string | null;

  fetchChannels: (params?: object) => Promise<void>;
  fetchChannel:  (slug: string)    => Promise<void>;
  setLiveState:  (s: LiveState)    => void;
  setViewers:    (n: number)       => void;
  clearCurrent:  ()                => void;
}

export const useChannelStore = create<ChannelStore>((set) => ({
  channels:  [],
  current:   null,
  liveState: null,
  viewers:   0,
  isLoading: false,
  error:     null,

  fetchChannels: async (params) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await channelsApi.list(params);
      set({ channels: data.channels ?? [], isLoading: false });
    } catch (e: any) {
      set({ error: e.response?.data?.error ?? 'Error al cargar canales', isLoading: false });
    }
  },

  fetchChannel: async (slug) => {
    // Reset liveState when changing channel
    set({ isLoading: true, error: null, liveState: null, viewers: 0 });
    try {
      const { data } = await channelsApi.get(slug);
      set({
        current:   data.channel,
        liveState: data.liveState ?? null,
        viewers:   data.viewers  ?? 0,
        isLoading: false,
      });
    } catch (e: any) {
      set({ error: e.response?.data?.error ?? 'Canal no encontrado', isLoading: false });
    }
  },

  setLiveState: (s) => set({ liveState: s }),
  setViewers:   (n) => set({ viewers: n }),
  clearCurrent: ()  => set({ current: null, liveState: null, viewers: 0 }),
}));

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types';
import { authApi } from '../services/api';

interface AuthStore {
  user:         User | null;
  accessToken:  string | null;
  refreshToken: string | null;
  isLoading:    boolean;
  error:        string | null;

  login:    (email: string, password: string) => Promise<void>;
  register: (data: object) => Promise<void>;
  logout:   () => void;
  loadMe:   () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user:         null,
      accessToken:  null,
      refreshToken: null,
      isLoading:    false,
      error:        null,

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const { data } = await authApi.login(email, password);
          localStorage.setItem('accessToken',  data.accessToken);
          localStorage.setItem('refreshToken', data.refreshToken);
          set({
            user:         data.user,
            accessToken:  data.accessToken,
            refreshToken: data.refreshToken,
            isLoading:    false,
          });
        } catch (err: any) {
          set({
            error:     err.response?.data?.error || 'Error al iniciar sesion',
            isLoading: false,
          });
        }
      },

      register: async (data) => {
        set({ isLoading: true, error: null });
        try {
          const { data: res } = await authApi.register(data);
          localStorage.setItem('accessToken',  res.accessToken);
          localStorage.setItem('refreshToken', res.refreshToken);
          set({
            user:         res.user,
            accessToken:  res.accessToken,
            refreshToken: res.refreshToken,
            isLoading:    false,
          });
        } catch (err: any) {
          set({
            error:     err.response?.data?.error || 'Error al registrarse',
            isLoading: false,
          });
        }
      },

      logout: () => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        set({ user: null, accessToken: null, refreshToken: null });
      },

      loadMe: async () => {
        const token = localStorage.getItem('accessToken');
        if (!token) return;
        try {
          const { data } = await authApi.me();
          set({ user: data });
        } catch {
          get().logout();
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name:    'streamtune-auth',
      partialize: (s) => ({
        accessToken:  s.accessToken,
        refreshToken: s.refreshToken,
        user:         s.user,
      }),
    }
  )
);

import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000/api',
  timeout: 10000,
});

// Attach token automatically to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

// ── Auth ────────────────────────────────────────────────
export const authApi = {
  login:    (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  register: (data: object) =>
    api.post('/auth/register', data),
  me:       () =>
    api.get('/auth/me'),
  refresh:  (refreshToken: string) =>
    api.post('/auth/refresh', { refreshToken }),
};

// ── Channels ────────────────────────────────────────────
export const channelsApi = {
  list:       (params?: object) => api.get('/channels', { params }),
  get:        (slug: string)    => api.get(`/channels/${slug}`),
  create:     (data: object)    => api.post('/channels', data),
  update:     (slug: string, data: object) => api.patch(`/channels/${slug}`, data),
  setStatus:  (slug: string, status: string) =>
    api.patch(`/channels/${slug}/status`, { status }),
  delete:     (slug: string)    => api.delete(`/channels/${slug}`),
};

// ── Schedules ───────────────────────────────────────────
export const schedulesApi = {
  get:        (slug: string, dow: number) =>
    api.get(`/schedules/${slug}/${dow}`),
  save:       (slug: string, dow: number, data: object) =>
    api.put(`/schedules/${slug}/${dow}`, data),
  addYoutube: (slug: string, url: string, dow?: number) =>
    api.post(`/schedules/${slug}/add-youtube`, { url, dow }),
  copyToWeek: (slug: string, sourceDow: number) =>
    api.post(`/schedules/${slug}/copy-to-week`, { sourceDow }),
};

// ── Videos ──────────────────────────────────────────────
export const videosApi = {
  list:   (slug: string) => api.get(`/videos/${slug}`),
  rename: (id: string, title: string) => api.patch(`/videos/${id}`, { title }),
  remove: (id: string)  => api.delete(`/videos/${id}`),
};

// ── Credits ─────────────────────────────────────────────
export const creditsApi = {
  packs:    ()                              => api.get('/credits/packs'),
  purchase: (packId: string)               => api.post('/credits/purchase', { packId }),
  reward:   (channelId: string, amount: number, message?: string) =>
    api.post('/credits/reward', { channelId, amount, message }),
  history:  ()                              => api.get('/credits/history'),
};

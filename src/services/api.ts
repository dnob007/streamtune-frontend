import axios from 'axios';

// En desarrollo: usa el mismo host que el navegador, puerto 3000
// En producción VPS: usa VITE_API_URL del archivo .env.production
const getApiUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  const host = window.location.hostname;
  return `http://${host}:3000/api`;
};

const getWsUrl = () => {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
  const host = window.location.hostname;
  return `ws://${host}:3000/ws`;
};

export const API_URL = getApiUrl();
export const WS_URL  = getWsUrl();

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

export const authApi = {
  login:    (email: string, password: string) => api.post('/auth/login', { email, password }),
  register: (data: object)                    => api.post('/auth/register', data),
  me:       ()                                => api.get('/auth/me'),
  refresh:  (token: string)                   => api.post('/auth/refresh', { refreshToken: token }),
};

export const channelsApi = {
  list:      (params?: object)                    => api.get('/channels', { params }),
  get:       (slug: string)                       => api.get(`/channels/${slug}`),
  create:    (data: object)                       => api.post('/channels', data),
  update:    (slug: string, data: object)         => api.patch(`/channels/${slug}`, data),
  setStatus: (slug: string, status: string)       => api.patch(`/channels/${slug}/status`, { status }),
  delete:    (slug: string)                       => api.delete(`/channels/${slug}`),
};

export const schedulesApi = {
  get:        (slug: string, dow: number)         => api.get(`/schedules/${slug}/${dow}`),
  save:       (slug: string, dow: number, d: any) => api.put(`/schedules/${slug}/${dow}`, d),
  addYoutube: (slug: string, url: string, dow?: number) =>
    api.post(`/schedules/${slug}/add-youtube`, { url, dow }),
  copyToWeek: (slug: string, sourceDow: number)   =>
    api.post(`/schedules/${slug}/copy-to-week`, { sourceDow }),
};

export const videosApi = {
  list:   (slug: string)                    => api.get(`/videos/${slug}`),
  rename: (id: string, title: string)       => api.patch(`/videos/${id}`, { title }),
  remove: (id: string)                      => api.delete(`/videos/${id}`),
};

export const creditsApi = {
  packs:    ()                                       => api.get('/credits/packs'),
  purchase: (packId: string)                         => api.post('/credits/purchase', { packId }),
  reward:   (channelId: string, amount: number, msg?: string) =>
    api.post('/credits/reward', { channelId, amount, message: msg }),
  history:  ()                                       => api.get('/credits/history'),
};

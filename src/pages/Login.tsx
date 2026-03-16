import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export default function Login() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading, error, user, clearError } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => { if (user) navigate('/'); }, [user]);
  useEffect(() => { clearError(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login(email, password);
  };

  return (
    <div className="min-h-[calc(100vh-56px)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">

        <div className="text-center mb-8">
          <h1 className="font-display font-extrabold text-2xl mb-2">Bienvenido de vuelta</h1>
          <p className="text-txt2 text-sm">Inicia sesion en StreamTune</p>
        </div>

        <div className="bg-bg2 border border-white/5 rounded-2xl p-6">
          <form onSubmit={handleSubmit} className="space-y-4">

            {error && (
              <div className="bg-live/10 border border-live/30 text-live
                              text-sm px-3 py-2 rounded-lg">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs text-txt3 mb-1.5 font-medium">
                Correo electronico
              </label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="tu@correo.com" required
                className="w-full bg-bg3 border border-white/10 rounded-lg px-3 py-2.5
                           text-sm text-txt placeholder-txt3 outline-none
                           focus:border-accent transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs text-txt3 mb-1.5 font-medium">
                Contrasena
              </label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Tu contrasena" required
                className="w-full bg-bg3 border border-white/10 rounded-lg px-3 py-2.5
                           text-sm text-txt placeholder-txt3 outline-none
                           focus:border-accent transition-colors"
              />
            </div>

            <button type="submit" disabled={isLoading}
              className="w-full bg-accent text-white font-medium py-2.5 rounded-lg
                         hover:bg-accent/80 transition-colors disabled:opacity-50
                         disabled:cursor-not-allowed text-sm mt-2">
              {isLoading ? 'Iniciando sesion...' : 'Iniciar Sesion'}
            </button>
          </form>

          {/* Quick test logins */}
          <div className="mt-4 pt-4 border-t border-white/5">
            <p className="text-[10px] text-txt3 text-center mb-2 uppercase tracking-wider">
              Usuarios de prueba
            </p>
            <div className="space-y-1.5">
              {[
                { label: 'Admin',   email: 'admin@streamtune.app',  pass: 'Admin1234!'   },
                { label: 'Creator', email: 'lofi@streamtune.app',   pass: 'Creator123!'  },
                { label: 'Viewer',  email: 'viewer@streamtune.app', pass: 'Viewer123!'   },
              ].map(u => (
                <button key={u.label}
                  onClick={() => { setEmail(u.email); setPassword(u.pass); }}
                  className="w-full text-left px-3 py-1.5 rounded-lg bg-bg3 hover:bg-bg4
                             transition-colors text-xs text-txt2 hover:text-txt">
                  <span className="text-accent font-medium">{u.label}</span>
                  {' — '}{u.email}
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-sm text-txt2 mt-4">
          No tienes cuenta?{' '}
          <Link to="/register" className="text-accent hover:underline">
            Registrate gratis
          </Link>
        </p>
      </div>
    </div>
  );
}

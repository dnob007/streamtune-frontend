import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export default function Navbar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between px-6 h-14
                    bg-bg/95 backdrop-blur border-b border-white/5">

      {/* Logo */}
      <Link to="/" className="font-display font-extrabold text-xl tracking-tight
                               bg-gradient-to-r from-accent to-accent2
                               bg-clip-text text-transparent">
        Stream<span className="text-accent3" style={{ WebkitTextFillColor: '#5cf8c8' }}>Tune</span>
      </Link>

      {/* Nav links */}
      <div className="flex gap-1">
        <Link to="/"
          className="px-3 py-1.5 rounded-lg text-sm text-txt2 hover:text-txt hover:bg-bg3 transition-all">
          Canales
        </Link>
        {user && (
          <Link to="/dashboard"
            className="px-3 py-1.5 rounded-lg text-sm text-txt2 hover:text-txt hover:bg-bg3 transition-all">
            Mi Canal
          </Link>
        )}
      </div>

      {/* Auth */}
      <div className="flex gap-2 items-center">
        {user ? (
          <div className="flex items-center gap-3">
            <span className="text-sm text-txt2">
              <span className="text-accent font-medium">{user.creditBalance}</span> cr
            </span>
            <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center
                            text-xs font-bold text-white">
              {user.username[0].toUpperCase()}
            </div>
            <button onClick={handleLogout}
              className="text-sm text-txt3 hover:text-txt transition-colors">
              Salir
            </button>
          </div>
        ) : (
          <>
            <Link to="/login"
              className="px-3 py-1.5 text-sm text-txt2 border border-white/10 rounded-lg
                         hover:border-accent hover:text-txt transition-all">
              Entrar
            </Link>
            <Link to="/register"
              className="px-3 py-1.5 text-sm font-medium bg-accent text-white rounded-lg
                         hover:bg-accent/80 transition-all">
              Registrarse
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}

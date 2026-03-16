import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import Navbar    from './components/Navbar';
import Home      from './pages/Home';
import Player    from './pages/Player';
import Login     from './pages/Login';
import Register  from './pages/Register';
import Dashboard from './pages/Dashboard';
import { useAuthStore } from './stores/authStore';

export default function App() {
  const { loadMe } = useAuthStore();

  useEffect(() => { loadMe(); }, []);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-bg text-txt">
        <Navbar />
        <Routes>
          <Route path="/"                element={<Home />}      />
          <Route path="/channel/:slug"   element={<Player />}    />
          <Route path="/login"           element={<Login />}     />
          <Route path="/register"        element={<Register />}  />
          <Route path="/dashboard"       element={<Dashboard />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

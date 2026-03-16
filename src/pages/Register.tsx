import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

const TOPICS = ['Lo-Fi','80s & 90s','Latin','Jazz','Electronica',
                'Rock','Cursos','Salsa','Pop','Hip-Hop','Reggae','Instrumental'];

export default function Register() {
  const [step,     setStep]     = useState(0);
  const [role,     setRole]     = useState<'viewer' | 'creator'>('viewer');
  const [form,     setForm]     = useState({
    username: '', email: '', password: '', displayName: '',
    country: 'MX', channelName: '', channelSlug: '', topics: [] as string[],
  });
  const { register, isLoading, error, user, clearError } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => { if (user) navigate('/'); }, [user]);
  useEffect(() => { clearError(); }, []);

  const update = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const toggleTopic = (t: string) => {
    setForm(f => ({
      ...f,
      topics: f.topics.includes(t)
        ? f.topics.filter(x => x !== t)
        : f.topics.length < 5 ? [...f.topics, t] : f.topics,
    }));
  };

  const handleSubmit = async () => {
    const payload: any = {
      username:    form.username,
      email:       form.email,
      password:    form.password,
      displayName: form.displayName || form.username,
      country:     form.country,
      role,
    };
    await register(payload);
  };

  const strengthScore = (p: string) => {
    let s = 0;
    if (p.length >= 8)          s++;
    if (/[A-Z]/.test(p))        s++;
    if (/[0-9]/.test(p))        s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  };
  const strColors = ['bg-live','bg-live','bg-warn','bg-online','bg-online'];
  const strLabels = ['Muy corta','Debil','Regular','Fuerte','Muy fuerte'];
  const sc = strengthScore(form.password);

  return (
    <div className="min-h-[calc(100vh-56px)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">

        <div className="text-center mb-8">
          <h1 className="font-display font-extrabold text-2xl mb-2">Unete a StreamTune</h1>
          <p className="text-txt2 text-sm">Tu plataforma de musica en vivo</p>
        </div>

        {/* Step indicators */}
        <div className="flex gap-1.5 mb-6">
          {[0, 1].map(i => (
            <div key={i} className={`h-1 flex-1 rounded-full transition-all
              ${i <= step ? 'bg-accent' : 'bg-bg3'}`} />
          ))}
        </div>

        <div className="bg-bg2 border border-white/5 rounded-2xl p-6">

          {error && (
            <div className="bg-live/10 border border-live/30 text-live
                            text-sm px-3 py-2 rounded-lg mb-4">
              {error}
            </div>
          )}

          {step === 0 && (
            <div className="space-y-4">
              <h2 className="font-display font-bold text-base mb-1">
                Como quieres usar StreamTune?
              </h2>

              {/* Role picker */}
              <div className="grid grid-cols-2 gap-3 mb-2">
                {([
                  { value: 'viewer',  icon: '🎧', label: 'Espectador',
                    desc: 'Ver, chatear y premiar canales' },
                  { value: 'creator', icon: '📡', label: 'Creador',
                    desc: 'Crea y administra tu canal' },
                ] as const).map(r => (
                  <button key={r.value} onClick={() => setRole(r.value)}
                    className={`border rounded-xl p-3 text-left transition-all
                      ${role === r.value
                        ? 'border-accent bg-accent/10'
                        : 'border-white/10 hover:border-white/20'}`}>
                    <div className="text-2xl mb-1">{r.icon}</div>
                    <div className="text-sm font-medium">{r.label}</div>
                    <div className="text-xs text-txt2 mt-0.5">{r.desc}</div>
                  </button>
                ))}
              </div>

              {/* Fields */}
              {[
                { key: 'username',    label: 'Nombre de usuario', placeholder: '@micanal',     type: 'text'     },
                { key: 'email',       label: 'Correo electronico', placeholder: 'tu@correo.com', type: 'email'  },
                { key: 'displayName', label: 'Nombre para mostrar', placeholder: 'Tu nombre',  type: 'text'     },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs text-txt3 mb-1.5 font-medium">{f.label}</label>
                  <input type={f.type} value={(form as any)[f.key]}
                    onChange={e => update(f.key,
                      f.key === 'username'
                        ? e.target.value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20)
                        : e.target.value)}
                    placeholder={f.placeholder}
                    className="w-full bg-bg3 border border-white/10 rounded-lg px-3 py-2.5
                               text-sm text-txt placeholder-txt3 outline-none
                               focus:border-accent transition-colors"
                  />
                </div>
              ))}

              {/* Password */}
              <div>
                <label className="block text-xs text-txt3 mb-1.5 font-medium">Contrasena</label>
                <input type="password" value={form.password}
                  onChange={e => update('password', e.target.value)}
                  placeholder="Minimo 8 caracteres"
                  className="w-full bg-bg3 border border-white/10 rounded-lg px-3 py-2.5
                             text-sm text-txt placeholder-txt3 outline-none
                             focus:border-accent transition-colors"
                />
                {form.password && (
                  <div className="mt-1.5">
                    <div className="flex gap-1 mb-1">
                      {[0,1,2,3].map(i => (
                        <div key={i} className={`h-0.5 flex-1 rounded-full
                          ${i < sc ? strColors[sc] : 'bg-bg4'}`} />
                      ))}
                    </div>
                    <p className="text-[10px] text-txt3">{strLabels[sc]}</p>
                  </div>
                )}
              </div>

              <button onClick={() => setStep(1)}
                disabled={!form.username || !form.email || !form.password}
                className="w-full bg-accent text-white font-medium py-2.5 rounded-lg
                           hover:bg-accent/80 transition-colors disabled:opacity-40
                           disabled:cursor-not-allowed text-sm mt-2">
                Siguiente →
              </button>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="font-display font-bold text-base mb-1">
                {role === 'creator' ? 'Configura tu canal' : 'Ultimos detalles'}
              </h2>

              <div>
                <label className="block text-xs text-txt3 mb-1.5 font-medium">Pais</label>
                <select value={form.country} onChange={e => update('country', e.target.value)}
                  className="w-full bg-bg3 border border-white/10 rounded-lg px-3 py-2.5
                             text-sm text-txt outline-none focus:border-accent transition-colors">
                  <option value="MX">Mexico</option>
                  <option value="CO">Colombia</option>
                  <option value="AR">Argentina</option>
                  <option value="ES">Espana</option>
                  <option value="CL">Chile</option>
                  <option value="PE">Peru</option>
                  <option value="US">Estados Unidos</option>
                  <option value="OT">Otro</option>
                </select>
              </div>

              {role === 'creator' && (
                <>
                  <div>
                    <label className="block text-xs text-txt3 mb-1.5 font-medium">
                      Categorias de tu canal (max 5)
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {TOPICS.map(t => (
                        <button key={t} onClick={() => toggleTopic(t)}
                          className={`border rounded-lg py-1.5 text-xs transition-all
                            ${form.topics.includes(t)
                              ? 'border-accent bg-accent/10 text-accent'
                              : 'border-white/10 text-txt3 hover:border-white/20'}`}>
                          {t}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-txt3 mt-1">
                      Seleccionados: {form.topics.length}/5
                    </p>
                  </div>
                </>
              )}

              <div className="flex gap-2 pt-2">
                <button onClick={() => setStep(0)}
                  className="flex-1 border border-white/10 text-txt2 py-2.5 rounded-lg
                             text-sm hover:border-white/20 transition-colors">
                  ← Atras
                </button>
                <button onClick={handleSubmit} disabled={isLoading}
                  className="flex-1 bg-accent text-white font-medium py-2.5 rounded-lg
                             hover:bg-accent/80 transition-colors disabled:opacity-50 text-sm">
                  {isLoading ? 'Creando cuenta...' : 'Crear Cuenta'}
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-sm text-txt2 mt-4">
          Ya tienes cuenta?{' '}
          <Link to="/login" className="text-accent hover:underline">Inicia sesion</Link>
        </p>
      </div>
    </div>
  );
}

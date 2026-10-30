/* Register.jsx */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import ConeLogo from '../../components/common/ConeLogo.jsx';

function PasswordStrength({ password }) {
  const checks = [password.length >= 8, /[A-Z]/.test(password), /[0-9]/.test(password), /[^A-Za-z0-9]/.test(password)];
  const score = checks.filter(Boolean).length;
  const colors = ['', '#ef4444', '#f59e0b', '#06b6d4', '#10b981'];
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  return password ? (
    <div style={{ marginTop: 6 }}>
      <div style={{ display:'flex', gap:3, marginBottom:3 }}>
        {[1,2,3,4].map(i => (
          <div key={i} style={{ flex:1, height:3, borderRadius:2, background: i <= score ? colors[score] : 'rgba(255,255,255,0.1)', transition:'background 300ms' }}/>
        ))}
      </div>
      <div style={{ fontSize:11, color: colors[score] }}>{labels[score]}</div>
    </div>
  ) : null;
}

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm]   = useState({ fullName:'', username:'', password:'', confirm:'' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.fullName.trim()) return setError('Full name is required');
    if (!/^[a-zA-Z0-9_-]{3,40}$/.test(form.username)) return setError('Username must be 3–40 letters, numbers, underscores or hyphens');
    if (form.password.length < 8) return setError('Password must be at least 8 characters');
    if (form.password !== form.confirm) return setError('Passwords do not match');
    setLoading(true);
    await new Promise(r => setTimeout(r, 400));
    const result = await register(form.fullName.trim(), form.username.trim(), form.password);
    setLoading(false);
    if (!result.ok) return setError(result.error);
    navigate('/dashboard');
  }

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg-primary)', display:'flex', alignItems:'center', justifyContent:'center', position:'relative', overflow:'hidden' }}>
      {/* Blobs */}
      <div className="blob-1" style={{ position:'absolute', width:500, height:500, borderRadius:'50%', background:'rgba(37,99,235,0.15)', filter:'blur(80px)', top:-100, left:-100, pointerEvents:'none' }}/>
      <div className="blob-2" style={{ position:'absolute', width:400, height:400, borderRadius:'50%', background:'rgba(6,182,212,0.1)', filter:'blur(80px)', bottom:-80, right:-80, pointerEvents:'none' }}/>

      <div className="glass-card" style={{ width:'100%', maxWidth:440, padding:'var(--space-xl)', position:'relative', zIndex:1 }}>
        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:'var(--space-lg)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
            <ConeLogo size={48} glow />
          </div>
          <div style={{ fontFamily:"'Inter',sans-serif", fontSize:24, fontWeight:800, letterSpacing: '0.04em', color: '#FFFFFF' }}>CONE</div>
          <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>Trade Real Markets. Risk Nothing.</div>
        </div>

        <div className="alert alert-warning" style={{ marginBottom:'var(--space-md)', fontSize:12 }}>
          🎁 You'll start with <strong>C 1,00,000</strong> CONE Coins — virtual currency, zero real risk.
        </div>

        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:'var(--space-md)' }}>
          <div className="input-group">
            <label className="input-label">Full Name</label>
            <input className="input" placeholder="Ravi Kumar" value={form.fullName} onChange={e => set('fullName', e.target.value)} required />
          </div>
          <div className="input-group">
            <label className="input-label">Username</label>
            <input className="input" placeholder="ravi_trader" value={form.username} onChange={e => set('username', e.target.value)} required />
            <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>3–20 chars, letters/numbers/underscore</div>
          </div>
          <div className="input-group">
            <label className="input-label">Password</label>
            <input className="input" type="password" placeholder="••••••••" value={form.password} onChange={e => set('password', e.target.value)} required />
            <PasswordStrength password={form.password} />
          </div>
          <div className="input-group">
            <label className="input-label">Confirm Password</label>
            <input className="input" type="password" placeholder="••••••••" value={form.confirm} onChange={e => set('confirm', e.target.value)} required />
          </div>

          {error && <div className="alert alert-danger" style={{ fontSize:12 }}>{error}</div>}

          <button className="btn btn-primary btn-full btn-lg" type="submit" disabled={loading} style={{ marginTop:4 }}>
            {loading ? (
              <span style={{ display:'flex', alignItems:'center', gap:8, justifyContent:'center' }}>
                <span className="spin" style={{ width:16, height:16, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', borderRadius:'50%', display:'inline-block' }}/>
                Creating Account...
              </span>
            ) : '🚀 Create Account & Start Trading'}
          </button>
        </form>

        <div style={{ textAlign:'center', marginTop:'var(--space-md)', fontSize:13, color:'var(--text-muted)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color:'var(--accent-primary)', fontWeight:600 }}>Sign In</Link>
        </div>
      </div>
    </div>
  );
}

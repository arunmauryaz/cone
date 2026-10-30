/* Login.jsx */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import ConeLogo from '../../components/common/ConeLogo.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error,   setError]     = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password) return setError('Please fill in all fields');
    setLoading(true);
    await new Promise(r => setTimeout(r, 300));
    const result = await login(username.trim(), password);
    setLoading(false);
    if (!result.ok) return setError(result.error);
    navigate('/dashboard');
  }

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg-primary)', display:'flex', alignItems:'center', justifyContent:'center', position:'relative', overflow:'hidden' }}>
      <div className="blob-1" style={{ position:'absolute', width:500, height:500, borderRadius:'50%', background:'rgba(37,99,235,0.15)', filter:'blur(80px)', top:-150, right:-100, pointerEvents:'none' }}/>
      <div className="blob-2" style={{ position:'absolute', width:400, height:400, borderRadius:'50%', background:'rgba(6,182,212,0.1)', filter:'blur(80px)', bottom:-100, left:-80, pointerEvents:'none' }}/>

      <div className="glass-card" style={{ width:'100%', maxWidth:400, padding:'var(--space-xl)', position:'relative', zIndex:1 }}>
        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:'var(--space-xl)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            <ConeLogo size={48} glow />
          </div>
          <div style={{ fontFamily:"'Inter',sans-serif", fontSize:24, fontWeight:800, letterSpacing: '0.04em', color: '#FFFFFF' }}>CONE</div>
          <div style={{ fontSize:13, color:'var(--text-muted)', marginTop:4 }}>Welcome back, trader</div>
        </div>

        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:'var(--space-md)' }}>
          <div className="input-group">
            <label className="input-label">Username</label>
            <input className="input" placeholder="Enter your username" value={username} onChange={e => setUsername(e.target.value)} autoFocus />
          </div>
          <div className="input-group">
            <label className="input-label">Password</label>
            <input className="input" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} />
          </div>

          {error && <div className="alert alert-danger" style={{ fontSize:12 }}>{error}</div>}

          <button className="btn btn-primary btn-full btn-lg" type="submit" disabled={loading} style={{ marginTop:4 }}>
            {loading ? (
              <span style={{ display:'flex', alignItems:'center', gap:8, justifyContent:'center' }}>
                <span className="spin" style={{ width:16, height:16, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'#fff', borderRadius:'50%', display:'inline-block' }}/>
                Signing In...
              </span>
            ) : 'Sign In →'}
          </button>
        </form>

        <div style={{ textAlign:'center', marginTop:'var(--space-lg)', fontSize:13, color:'var(--text-muted)' }}>
          New to CONE?{' '}
          <Link to="/register" style={{ color:'var(--accent-primary)', fontWeight:600 }}>Create Account</Link>
        </div>

        <div style={{ textAlign:'center', marginTop:'var(--space-sm)', fontSize:11, color:'var(--text-muted)' }}>
          Paper trading only · No real money involved
        </div>
      </div>
    </div>
  );
}

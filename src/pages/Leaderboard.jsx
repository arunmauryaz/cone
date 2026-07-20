/* Leaderboard.jsx */
import { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { usePortfolio } from '../context/PortfolioContext.jsx';
import { FAKE_TRADERS, ACHIEVEMENTS, STARTING_BALANCE, traderPortfolioValue } from '../utils/constants.js';
import { formatCurrency, formatPercent } from '../utils/formatting.js';
import { calcWinRate } from '../utils/calculations.js';

const PERIODS = ['Today','This Week','This Month','All Time'];

function Rank({ rank }) {
  if (rank === 1) return <span style={{ fontSize:20 }}>🥇</span>;
  if (rank === 2) return <span style={{ fontSize:20 }}>🥈</span>;
  if (rank === 3) return <span style={{ fontSize:20 }}>🥉</span>;
  return <span style={{ color:'var(--text-muted)', fontWeight:700, fontSize:14 }}>#{rank}</span>;
}

export default function Leaderboard() {
  const { user }   = useAuth();
  const { orders, totalPortfolioValue, achievements } = usePortfolio();
  const [period, setPeriod] = useState('All Time');

  const winRate = calcWinRate(orders.filter(o => o.status==='COMPLETE' && o.realizedPnL!=null));
  const tradeCount = orders.filter(o => o.status==='COMPLETE').length;

  // Build leaderboard entries
  const entries = useMemo(() => {
    const fakeEntries = FAKE_TRADERS.map((t, i) => {
      const seed  = t.seed + (period === 'Today' ? 0 : period === 'This Week' ? 1 : period === 'This Month' ? 2 : 3);
      const value = traderPortfolioValue(seed, i);
      const ret   = ((value - STARTING_BALANCE) / STARTING_BALANCE) * 100;
      const wins  = Math.floor((0.45 + (t.seed % 30) * 0.017) * 100);
      const trades = 10 + (t.seed % 90);
      return { username: t.username, avatar: t.avatar, value, ret, wins, trades, isYou: false };
    });

    const meEntry = {
      username: user?.username || 'You',
      avatar:   '#8b5cf6',
      value:    totalPortfolioValue,
      ret:      ((totalPortfolioValue - STARTING_BALANCE) / STARTING_BALANCE) * 100,
      wins:     Math.round(winRate),
      trades:   tradeCount,
      isYou:    true,
    };

    return [...fakeEntries, meEntry].sort((a, b) => b.value - a.value);
  }, [period, totalPortfolioValue, winRate, tradeCount, user]);

  const myRank = entries.findIndex(e => e.isYou) + 1;
  const unlockedAchievements = achievements || [];

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-md)' }}>
      {/* My rank card */}
      <div className="glass-card gradient glow" style={{ padding:'var(--space-lg)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'var(--space-md)', flexWrap:'wrap' }}>
          <div style={{ fontSize:48 }}>{myRank === 1 ? '🥇' : myRank <= 3 ? '🏆' : '📊'}</div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:12, color:'var(--text-muted)' }}>Your Rank</div>
            <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:32, fontWeight:800 }}>#{myRank}</div>
            <div style={{ fontSize:13, color:'var(--text-secondary)' }}>among {entries.length} traders</div>
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:12, color:'var(--text-muted)' }}>Portfolio</div>
            <div style={{ fontFamily:"'Space Grotesk',monospace", fontSize:20, fontWeight:700 }}>{formatCurrency(totalPortfolioValue)}</div>
            <div style={{ fontSize:13, color: totalPortfolioValue >= STARTING_BALANCE ? 'var(--color-buy)' : 'var(--color-sell)', fontWeight:600 }}>
              {formatPercent(((totalPortfolioValue - STARTING_BALANCE)/STARTING_BALANCE)*100)}
            </div>
          </div>
        </div>
      </div>

      {/* Period filter */}
      <div style={{ display:'flex', gap:2, background:'rgba(255,255,255,0.04)', borderRadius:'var(--radius-full)', padding:3, width:'fit-content' }}>
        {PERIODS.map(p => (
          <button key={p} className="pill" onClick={() => setPeriod(p)} style={{ background: period===p ? 'var(--gradient-primary)' : 'transparent', color: period===p ? '#fff' : 'var(--text-secondary)' }}>{p}</button>
        ))}
      </div>

      {/* Leaderboard table */}
      <div className="glass-card" style={{ padding:'var(--space-md)' }}>
        <div className="table-wrapper">
          <table className="data-table">
            <thead><tr><th>Rank</th><th>Trader</th><th className="col-right">Portfolio</th><th className="col-right">Return</th><th className="col-right">Win Rate</th><th className="col-right">Trades</th></tr></thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={e.username} style={{
                  outline: e.isYou ? '1px solid var(--accent-primary)' : 'none',
                  background: e.isYou ? 'rgba(139,92,246,0.08)' : 'transparent',
                  borderRadius: e.isYou ? 'var(--radius-sm)' : 0,
                }}>
                  <td style={{ width:60 }}><Rank rank={i+1}/></td>
                  <td>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <div style={{ width:28, height:28, borderRadius:'50%', background: e.avatar, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'#fff', flexShrink:0 }}>
                        {e.username.slice(0,2).toUpperCase()}
                      </div>
                      <span style={{ fontWeight: e.isYou ? 700 : 600, fontSize:13 }}>{e.username}</span>
                      {e.isYou && <span style={{ fontSize:10, background:'var(--accent-primary)', color:'#fff', borderRadius:'var(--radius-full)', padding:'1px 6px', fontWeight:700 }}>YOU</span>}
                    </div>
                  </td>
                  <td className="col-right" style={{ fontFamily:"'Space Grotesk',monospace", fontWeight:700 }}>{formatCurrency(e.value)}</td>
                  <td className="col-right" style={{ color: e.ret>=0?'var(--color-buy)':'var(--color-sell)', fontWeight:700 }}>{formatPercent(e.ret)}</td>
                  <td className="col-right" style={{ color:'var(--text-secondary)' }}>{e.wins}%</td>
                  <td className="col-right" style={{ color:'var(--text-muted)' }}>{e.trades}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Achievements */}
      <div className="glass-card" style={{ padding:'var(--space-md)' }}>
        <div className="section-title" style={{ marginBottom:'var(--space-md)' }}>Achievements</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:'var(--space-md)' }}>
          {Object.values(ACHIEVEMENTS).map(ach => {
            const unlocked = unlockedAchievements.includes(ach.id);
            return (
              <div key={ach.id} className="glass-card" style={{
                padding:'var(--space-md)', textAlign:'center',
                filter: unlocked ? 'none' : 'grayscale(1)',
                opacity: unlocked ? 1 : 0.5,
                transition:'all 200ms',
              }}>
                <div style={{ fontSize:32, marginBottom:6 }}>{ach.icon}</div>
                <div style={{ fontWeight:700, fontSize:13 }}>{ach.name}</div>
                <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4 }}>{ach.description}</div>
                {!unlocked && <div style={{ fontSize:10, marginTop:6, color:'var(--text-muted)' }}>🔒 Locked</div>}
                {unlocked  && <div style={{ fontSize:10, marginTop:6, color:'var(--color-buy)' }}>✓ Unlocked</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

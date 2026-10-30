/* Notifications.jsx */
import { useState } from 'react';
import { Bell, CheckCheck, Trash2, Info, AlertCircle, Trophy, ShoppingCart } from 'lucide-react';
import { usePortfolio } from '../context/PortfolioContext.jsx';
import { formatRelativeTime } from '../utils/formatting.js';

const TYPE_ICONS = {
  order:       ShoppingCart,
  alert:       AlertCircle,
  system:      Info,
  achievement: Trophy,
};
const TYPE_COLORS = {
  order:       'var(--accent-primary)',
  alert:       'var(--color-neutral)',
  system:      'var(--text-secondary)',
  achievement: '#f59e0b',
};

const TABS = ['All','Orders','Alerts','System','Achievements'];

export default function Notifications() {
  const { notifications, markRead, markAllRead, clearNotifications } = usePortfolio();
  const [filter, setFilter] = useState('All');

  const filtered = notifications.filter(n => {
    if (filter === 'All') return true;
    const tabType = filter.toLowerCase().replace('s','');
    return n.type?.startsWith(tabType);
  });

  function getType(n) {
    if (n.type?.startsWith('order'))       return 'order';
    if (n.type?.startsWith('alert'))       return 'alert';
    if (n.type?.startsWith('achievement')) return 'achievement';
    return 'system';
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-md)' }}>
      {/* Header */}
      <div className="glass-card" style={{ padding:'var(--space-md)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <Bell size={20}/>
          <span style={{ fontSize:18, fontWeight:700, fontFamily:"'Space Grotesk',sans-serif" }}>Notifications</span>
          {notifications.filter(n => !n.read).length > 0 && (
            <span style={{ background:'var(--color-sell)', color:'#fff', fontSize:11, fontWeight:700, borderRadius:'var(--radius-full)', padding:'2px 8px' }}>
              {notifications.filter(n => !n.read).length} new
            </span>
          )}
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-ghost btn-sm" onClick={markAllRead}><CheckCheck size={14}/> Mark All Read</button>
          <button className="btn btn-ghost btn-sm" onClick={clearNotifications}><Trash2 size={14}/> Clear All</button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="tab-bar glass-card" style={{ padding:'0 var(--space-md)' }}>
        {TABS.map(t => <button key={t} className={`tab-item${filter===t?' active':''}`} onClick={() => setFilter(t)}>{t}</button>)}
      </div>

      {/* Notification list */}
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {filtered.length > 0 ? filtered.map(n => {
          const type  = getType(n);
          const Icon  = TYPE_ICONS[type] || Info;
          const color = TYPE_COLORS[type];
          return (
            <div
              key={n.id}
              onClick={() => markRead(n.id)}
              className="glass-card hoverable"
              style={{
                padding:'var(--space-md)', display:'flex', alignItems:'flex-start', gap:'var(--space-md)', cursor:'pointer',
                borderLeft: !n.read ? `3px solid ${color}` : '3px solid transparent',
                opacity: n.read ? 0.7 : 1,
              }}
            >
              <div style={{ width:36, height:36, borderRadius:'var(--radius-full)', background:`${color}22`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <Icon size={18} style={{ color }}/>
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:600, fontSize:14 }}>{n.title}</div>
                <div style={{ fontSize:12, color:'var(--text-secondary)', marginTop:3 }}>{n.message}</div>
                <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:6 }}>{formatRelativeTime(n.timestamp)}</div>
              </div>
              {!n.read && <div style={{ width:8, height:8, borderRadius:'50%', background: color, flexShrink:0, marginTop:4 }}/>}
            </div>
          );
        }) : (
          <div className="glass-card" style={{ padding:'60px 0', textAlign:'center', color:'var(--text-muted)', display:'flex', flexDirection:'column', alignItems:'center', gap:12 }}>
            <Bell size={36} style={{ opacity:0.3 }}/>
            <div>No notifications</div>
          </div>
        )}
      </div>
    </div>
  );
}

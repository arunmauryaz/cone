import { NavLink } from 'react-router-dom';
import { LayoutDashboard, TrendingUp, ClipboardList, Layers, BookOpen, Wallet, BarChart2, Settings, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
const LINKS = [['/dashboard','Dashboard',LayoutDashboard],['/market','Market',TrendingUp],['/orders','Orders',ClipboardList],['/holdings','Holdings',BookOpen],['/positions','Positions',Layers],['/funds','Funds',Wallet],['/analytics','Analytics',BarChart2]];
export default function Sidebar({ collapsed, setCollapsed, mobileOpen, onClose }) {
  return <>
    {mobileOpen && <button className="navigation-backdrop" aria-label="Close navigation" onClick={onClose}/>}
    <aside className={`app-sidebar${collapsed ? ' is-collapsed' : ''}${mobileOpen ? ' is-open' : ''}`}>
      <NavLink to="/dashboard" className="app-brand" onClick={onClose} aria-label="CONE dashboard">{collapsed ? 'C' : 'CONE'}</NavLink>
      <nav aria-label="Main navigation">{LINKS.map(([to,label,Icon]) => <NavLink key={to} to={to} title={label} onClick={onClose} className={({isActive}) => `app-nav-link${isActive ? ' active' : ''}`}><Icon size={17}/><span>{label}</span></NavLink>)}</nav>
      <div className="sidebar-bottom"><NavLink to="/settings" title="Settings" onClick={onClose} className={({isActive}) => `app-nav-link${isActive ? ' active' : ''}`}><Settings size={17}/><span>Settings</span></NavLink><button className="app-nav-link collapse-navigation" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={() => setCollapsed(v => !v)}>{collapsed ? <PanelLeftOpen size={17}/> : <PanelLeftClose size={17}/>}<span>Collapse</span></button></div>
    </aside>
  </>;
}

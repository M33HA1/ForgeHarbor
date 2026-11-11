import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Anchor, ArrowUpRight, History, LogOut, ScanLine, ShieldCheck, UserRound } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function Header({ workspace = false }: { workspace?: boolean }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [leaving, setLeaving] = useState(false);
  const handleLogout = async () => {
    if (leaving) return;
    setLeaving(true);
    try { await logout(); } catch { /* Auth clears local state when revocation is unavailable. */ }
    finally { setLeaving(false); navigate('/login'); }
  };
  const brand = <Link to={workspace ? '/app/dashboard' : '/'} className="brand" aria-label="ForgeHarbor home">
    <span className="brand-icon"><Anchor size={21} aria-hidden="true" /></span>
    <span>ForgeHarbor<span className="brand-caption">Investigation workspace</span></span>
  </Link>;
  const links = [
    { to: '/app/dashboard', label: 'Dashboard', text: 'Analyze', icon: ScanLine },
    { to: '/app/history', label: 'History', text: 'Scan history', icon: History },
    { to: '/app/profile', label: 'Profile', text: 'Account & security', icon: ShieldCheck },
  ];
  if (workspace && user) return <header className="workspace-nav">
    {brand}
    <div className="nav-section-label">Workspace</div>
    <nav aria-label="Workspace navigation">{links.map(({ to, label, text, icon: Icon }) =>
      <NavLink key={to} to={to} aria-label={label} className={({isActive}) => `workspace-nav-link ${isActive ? 'is-active' : ''}`}>
        <Icon size={18} aria-hidden="true" /><span>{text}</span>
      </NavLink>)}
    </nav>
    <div className="nav-bottom">

      <div className="nav-account"><span className="account-avatar"><UserRound size={18} aria-hidden="true" /></span><span className="account-name">Your workspace<small title={user.email}>{user.email}</small></span>
        <button type="button" onClick={handleLogout} disabled={leaving} aria-label="Logout" title="Log out" className="icon-button"><LogOut size={17} aria-hidden="true" /></button>
      </div>
    </div>
  </header>;
  return <header className="public-header">{brand}<nav aria-label="Main navigation">
    {user ? <><Link className="secondary-button" to="/app/dashboard">Open workspace <ArrowUpRight size={16} /></Link><button className="quiet-button" aria-label="Logout" onClick={handleLogout} disabled={leaving}>Logout</button></> : <><Link className="quiet-button" to="/login">Login</Link><Link className="primary-button" to="/signup">Sign Up <ArrowUpRight size={15} /></Link></>}
  </nav></header>;
}

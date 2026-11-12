import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowUpRight, History, ScanLine, Search, ShieldCheck, X } from 'lucide-react';

const destinations = [
  { to: '/app/dashboard', name: 'Analyze', detail: 'Check a URL or upload a file', icon: ScanLine },
  { to: '/app/history', name: 'Scan history', detail: 'Find saved evidence and download reports', icon: History },
  { to: '/app/profile', name: 'Account & security', detail: 'Manage your authenticator and recovery settings', icon: ShieldCheck },
];

export default function WorkspaceShortcuts() {
  const navigate = useNavigate();
  const dialog = useRef<HTMLDialogElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const [query, setQuery] = useState('');
  const filtered = destinations.filter(item => `${item.name} ${item.detail}`.toLowerCase().includes(query.trim().toLowerCase()));
  const open = () => {
    if (dialog.current?.open) return;
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setQuery('');
    dialog.current?.showModal();
    search.current?.focus();
  };
  const close = () => dialog.current?.close();
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && !event.altKey) {
        event.preventDefault();
        if (dialog.current?.open) close(); else open();
      }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, []);
  return <div className="workspace-shortcuts">
    <button ref={trigger} type="button" onClick={open} className="shortcut-trigger" aria-label="Open workspace shortcuts" aria-haspopup="dialog" aria-keyshortcuts="Control+k Meta+k">
      <Search size={15} aria-hidden="true" /><span>Jump to…</span><kbd>Ctrl K</kbd>
    </button>
    <dialog ref={dialog} className="shortcut-dialog" aria-labelledby="shortcut-title" onClose={() => (previousFocus.current?.isConnected ? previousFocus.current : trigger.current)?.focus()} onClick={event => { if (event.target === event.currentTarget) close(); }} onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const elements = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), a[href]'));
      const first = elements[0], last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}>
      <div className="shortcut-heading"><h2 id="shortcut-title">Find a workspace page</h2><button type="button" className="icon-button" aria-label="Close workspace shortcuts" onClick={close}><X size={19} /></button></div>
      <div className="shortcut-search"><Search size={19} aria-hidden="true" /><input ref={search} aria-label="Find a workspace page" placeholder="Analyze, reports, security…" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => {
        if (event.key === 'ArrowDown') { event.preventDefault(); dialog.current?.querySelector<HTMLAnchorElement>('.shortcut-results a')?.focus(); }
        if (event.key === 'Enter' && filtered[0]) { event.preventDefault(); close(); navigate(filtered[0].to); }
      }} /></div>
      <nav aria-label="Workspace shortcuts" className="shortcut-results">{filtered.map(({to, name, detail, icon: Icon}) => <Link key={to} to={to} onClick={close}>
        <span className="shortcut-icon"><Icon size={20} aria-hidden="true" /></span><span><strong>{name}</strong><small>{detail}</small></span><ArrowUpRight size={17} aria-hidden="true" />
      </Link>)}</nav>
      {filtered.length === 0 && <p role="status" className="shortcut-empty">No matching pages. Try “reports” or “security”.</p>}
      <div className="shortcut-footer"><span>Search pages, not your scan data</span><span><kbd>Esc</kbd> to close</span></div>
    </dialog>
  </div>;
}

import { Anchor } from 'lucide-react';

export default function Footer({ workspace = false }: { workspace?: boolean }) {
  return <footer className={workspace ? 'workspace-footer' : 'public-footer'}>
    <span><Anchor size={14} aria-hidden="true" /> ForgeHarbor</span>
    <p>URL and file threat analysis</p>
  </footer>;
}

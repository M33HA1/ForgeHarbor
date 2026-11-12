import BrandMark from './BrandMark';

export default function Footer({ workspace = false }: { workspace?: boolean }) {
  return <footer className={workspace ? 'workspace-footer' : 'public-footer'}>
    <span><BrandMark size={22} /> ForgeHarbor</span>
    <p>URL and file threat analysis</p>
  </footer>;
}

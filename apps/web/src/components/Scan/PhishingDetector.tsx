import { Upload, Link } from 'lucide-react';
import type { ScanKind } from '../../types';

export default function PhishingDetector({activeTab,setActiveTab,disabled=false}: {
  activeTab: ScanKind; setActiveTab:(tab:ScanKind)=>void; disabled?:boolean;
}) {
  return <div className="analysis-tabs" role="group" aria-label="Analysis type"><div>
    <button type="button" disabled={disabled} aria-pressed={activeTab==='url'} onClick={()=>setActiveTab('url')}><Link size={16} aria-hidden="true" /><span>URL Analysis</span></button>
    <button type="button" disabled={disabled} aria-pressed={activeTab==='file'} onClick={()=>setActiveTab('file')}><Upload size={16} aria-hidden="true" /><span>File Analysis</span></button>
  </div></div>;
}

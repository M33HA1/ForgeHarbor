import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';

export default function CopyButton({ value, label }: { value: string; label: string }) {
  const [status, setStatus] = useState<'idle' | 'busy' | 'copied' | 'error'>('idle');
  useEffect(() => {
    if (status !== 'copied') return;
    const timer = window.setTimeout(() => setStatus('idle'), 3000);
    return () => window.clearTimeout(timer);
  }, [status]);
  const copy = async () => {
    setStatus('busy');
    try { await navigator.clipboard.writeText(value); setStatus('copied'); }
    catch { setStatus('error'); }
  };
  return <div className="copy-control">
    <button type="button" className="copy-button" onClick={copy} disabled={status === 'busy'} aria-label={label}>
      {status === 'copied' ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
      <span>{status === 'copied' ? 'Copied' : label}</span>
    </button>
    <span role="status" className={status === 'error' ? 'copy-error' : 'sr-only'}>{status === 'copied' ? 'Copied to clipboard.' : status === 'error' ? 'Copy unavailable. Select the value and copy it manually.' : ''}</span>
  </div>;
}

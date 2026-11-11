import { useEffect, useState, type FormEvent } from 'react';
import api from '../../services/api';
import { errorMessage, type MFAEnrollment, type MFAStatus } from '../../types';

export default function MFASettings() {
  const [status, setStatus] = useState<MFAStatus | null>(null);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [enrollment, setEnrollment] = useState<MFAEnrollment | null>(null);
  const [qr, setQR] = useState('');
  const [recovery, setRecovery] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    api.getMFAStatus().then(value => { if (active) setStatus(value); })
      .catch(err => { if (active) setError(errorMessage(err)); });
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setError(''); setMessage('');
    try {
      if (status?.enabled) {
        await api.disableMFA(password, code);
        setStatus(await api.getMFAStatus()); setMessage('Two-step verification turned off. Other sessions have been signed out.');
      } else if (enrollment) {
        const result = await api.enableMFA(enrollment.enrollment_token, code);
        setRecovery(result.recovery_codes); setEnrollment(null); setQR('');
        setStatus(await api.getMFAStatus());
      } else {
        const result = await api.setupMFA(password);
        const QRCode = (await import('qrcode')).default;
        const image = await QRCode.toDataURL(result.otpauth_uri, { width: 240, margin: 2 });
        setEnrollment(result); setQR(image);
      }
      setPassword(''); setCode('');
    } catch (err) { setError(errorMessage(err)); }
    finally { setBusy(false); }
  }
  const input = 'w-full rounded-xl border border-slate-300 bg-white p-3 text-slate-900';
  return <section className="rounded-2xl border border-slate-300 bg-white p-6 space-y-5" aria-labelledby="mfa-title">
    <div><h2 id="mfa-title" className="text-xl font-semibold text-slate-900">Two-step verification</h2>
      <p className="mt-2 text-slate-700">Protect your account with codes from an authenticator app.</p></div>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {message && <p role="status" className="text-emerald-700">{message}</p>}
    {!status && !error && <p role="status">Loading security settings…</p>}
    {recovery.length > 0 ? <div className="space-y-4">
      <h3 className="font-semibold text-slate-900">Save your recovery codes</h3>
      <p className="text-slate-700">These codes are shown once. Store them in a password manager. Each code can replace one authenticator code.</p>
      <ul aria-label="Recovery codes" className="grid gap-2 text-sm font-mono text-emerald-700 break-all">{recovery.map(value => <li key={value}>{value}</li>)}</ul>
      <button type="button" onClick={() => setRecovery([])} className="rounded-xl bg-emerald-600 px-5 py-3 text-slate-900">I have saved my recovery codes</button>
    </div> : status && <>
      <p className="text-slate-700">{status.enabled ? `Enabled · ${status.recovery_codes_remaining} recovery codes remaining` : 'Not enabled'}</p>
      {!status.available && <p className="text-amber-700">Security settings are temporarily unavailable. Try again later.</p>}
      {status.available && <form onSubmit={submit} className="space-y-4 max-w-lg">
        {enrollment ? <>
          <p className="text-slate-700">Scan this QR code with your authenticator, then enter its six-digit code within five minutes.</p>
          <img src={qr} width={240} height={240} alt="Authenticator enrollment QR code" />
          <p className="text-slate-700">Or enter this setup key manually:</p>
          <code className="block break-all text-emerald-700" aria-label="Authenticator setup key">{enrollment.secret}</code>
        </> : <label className="block text-slate-700">Current password
          <input className={input} type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required maxLength={256} /></label>}
        {(enrollment || status.enabled) && <label className="block text-slate-700">{status.enabled ? 'Authenticator or recovery code' : 'Authenticator code'}
          <input className={input} autoComplete="one-time-code" inputMode={status.enabled ? 'text' : 'numeric'} value={code} onChange={e => setCode(e.target.value)} required maxLength={64} /></label>}
        <button disabled={busy} className="rounded-xl bg-emerald-600 px-5 py-3 text-slate-900 disabled:opacity-50">{busy ? 'Verifying…' : status.enabled ? 'Turn off two-step verification' : enrollment ? 'Verify and enable' : 'Set up authenticator'}</button>
        {enrollment && <button type="button" disabled={busy} onClick={() => { setEnrollment(null); setQR(''); setCode(''); setError(''); }} className="ml-4 text-slate-700">Cancel setup</button>}
      </form>}
    </>}
  </section>;
}

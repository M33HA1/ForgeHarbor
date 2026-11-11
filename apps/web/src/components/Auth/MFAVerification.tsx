import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { errorMessage } from '../../types';

export default function MFAVerification({ challenge, onVerified, onCancel }: {
  challenge: string; onVerified: () => void; onCancel: () => void;
}) {
  const { verifyMFA } = useAuth();
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (busy) return; setBusy(true); setError('');
    try { await verifyMFA(challenge, code); setCode(''); onVerified(); }
    catch (error) { setError(errorMessage(error)); setCode(''); }
    finally { setBusy(false); }
  };
  return <div className="space-y-5">
    <p className="text-sm text-slate-700">{recovery ? 'Enter one of your saved recovery codes. Each code works once.' : 'Enter the six-digit code from your authenticator app.'} This request expires in five minutes.</p>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    <form onSubmit={submit} className="space-y-4">
      <label className="block text-sm text-slate-700" htmlFor="mfa-login-code">{recovery ? 'Recovery code' : 'Authenticator code'}</label>
      <input id="mfa-login-code" autoFocus autoComplete="one-time-code" inputMode={recovery ? 'text' : 'numeric'}
        pattern={recovery ? undefined : '[0-9]{6}'} maxLength={recovery ? 64 : 6} required value={code}
        onChange={event => setCode(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900 focus:ring-2 focus:ring-cyan-500" />
      <button disabled={busy} className="w-full rounded-lg bg-cyan-500 px-4 py-3 font-bold text-slate-950 disabled:opacity-50">{busy ? 'Verifying...' : 'Verify and sign in'}</button>
    </form>
    <button disabled={busy} type="button" className="block text-sm text-cyan-700" onClick={() => { setRecovery(!recovery); setCode(''); setError(''); }}>{recovery ? 'Use authenticator app' : 'Use a recovery code'}</button>
    <button disabled={busy} type="button" className="block text-sm text-slate-500" onClick={onCancel}>Back to login</button>
  </div>;
}

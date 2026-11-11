import { errorMessage } from '../types';
import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate, useLocation, Link } from "react-router-dom";
import MFAVerification from '../components/Auth/MFAVerification';
import AuthFrame from '../components/Auth/AuthFrame';

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [challenge, setChallenge] = useState<string | null>(null);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const result = await login(email, password);
      setPassword('');
      if ('mfa_required' in result) { setChallenge(result.challenge_token); return; }
      const from = location.state?.from;
      const destination = ["/app/dashboard", "/app/history", "/app/profile"].includes(from?.pathname)
        ? from.pathname + (from.search || "") + (from.hash || "") : "/app/dashboard";
      navigate(destination, { replace: true });
    } catch (err) {
      setError(errorMessage(err) || "Failed to log in. Please check your credentials.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthFrame>
      <div className="auth-card">
        <h2 className="text-3xl font-bold text-center text-slate-900 mb-8">{challenge ? 'Two-step verification' : 'Login'}</h2>
        {!challenge && <p className="auth-form-description">Sign in to access your scans and reports.</p>}
        {error && <p role="alert" className="text-red-700 text-center mb-4">{error}</p>}
        {challenge ? <MFAVerification challenge={challenge} onCancel={() => { setChallenge(null); setError(''); }} onVerified={() => {
          const from = location.state?.from;
          const destination = ["/app/dashboard", "/app/history", "/app/profile"].includes(from?.pathname)
            ? from.pathname + (from.search || '') + (from.hash || '') : '/app/dashboard';
          navigate(destination, { replace: true });
        }} /> : <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="login-email" className="text-sm font-medium text-slate-700 mb-2 block">Email</label>
            <input
              id="login-email"
              autoComplete="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full bg-white border border-slate-300 text-slate-900 rounded-lg p-3 focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
              required
            />
          </div>
          <div>
            <label htmlFor="login-password" className="text-sm font-medium text-slate-700 mb-2 block">Password</label>
            <input
              id="login-password"
              autoComplete="current-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-white border border-slate-300 text-slate-900 rounded-lg p-3 focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
              required
            />
          </div>
          <button
            disabled={submitting}
            type="submit"
            className="w-full bg-blue-700 text-slate-900 font-bold py-3 px-4 rounded-lg hover:opacity-90 transition-opacity"
          >
            {submitting ? 'Logging in...' : 'Login'}
          </button>
        </form>}
        <p className="text-center text-slate-500 mt-6">
          Don't have an account?{" "}
          <Link to="/signup" className="font-medium text-cyan-700 hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </AuthFrame>
  );
};

export default LoginPage;

import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from '../services/api';

const SignupPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => navigate("/login"), 2000);
    return () => clearTimeout(timer);
  }, [message, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting || message) return;
    const passwordLength = Array.from(password).length;
    if (passwordLength < 15 || passwordLength > 128) {
      setError("Use a password with 15 to 128 characters.");
      return;
    }
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      await api.signup(email, password);
      setMessage("Signup successful! Redirecting to login...");
    } catch (err) {
      setError(err.message || "Failed to sign up. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="rounded-3xl p-10 shadow-2xl backdrop-blur-lg border bg-slate-800/40 border-slate-700/50">
        <h2 className="text-3xl font-bold text-center text-white mb-8">Create an Account</h2>
        {error && <p role="alert" className="text-red-400 text-center mb-4">{error}</p>}
        {message && <p role="status" className="text-green-400 text-center mb-4">{message}</p>}
        <form onSubmit={handleSubmit} className="space-y-6">
           <div>
            <label htmlFor="signup-email" className="text-sm font-medium text-slate-300 mb-2 block">Email</label>
            <input
              id="signup-email"
              autoComplete="email"
              type="email"
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full bg-slate-900/50 border border-slate-700 text-white rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              required
            />
          </div>
          <div>
            <label htmlFor="signup-password" className="text-sm font-medium text-slate-300 mb-2 block">Password</label>
            <input
              id="signup-password"
              autoComplete="new-password"
              aria-describedby="signup-password-hint signup-password-privacy"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-900/50 border border-slate-700 text-white rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              required
            />
            <p id="signup-password-hint" className="mt-2 text-sm text-slate-400">Use 15 to 128 characters. Spaces and Unicode are welcome.</p>
            <p id="signup-password-privacy" className="mt-2 text-sm leading-relaxed text-slate-400">We check a partial hash against known breaches. Your password itself is never sent.</p>
          </div>
          <button
            disabled={submitting || Boolean(message)}
            type="submit"
            className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold py-3 px-4 rounded-lg hover:opacity-90 transition-opacity"
          >
            {submitting ? 'Signing up...' : 'Sign Up'}
          </button>
        </form>
         <p className="text-center text-slate-400 mt-6">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-cyan-400 hover:underline">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
};

export default SignupPage;

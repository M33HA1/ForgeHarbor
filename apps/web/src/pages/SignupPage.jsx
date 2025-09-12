import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from '../services/api';

const SignupPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      await api.signup(email, password);
      setMessage("Signup successful! Redirecting to login...");
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      setError(err.message || "Failed to sign up. Please try again.");
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="rounded-3xl p-10 shadow-2xl backdrop-blur-lg border bg-slate-800/40 border-slate-700/50">
        <h2 className="text-3xl font-bold text-center text-white mb-8">Create an Account</h2>
        {error && <p className="text-red-400 text-center mb-4">{error}</p>}
        {message && <p className="text-green-400 text-center mb-4">{message}</p>}
        <form onSubmit={handleSubmit} className="space-y-6">
           <div>
            <label className="text-sm font-medium text-slate-300 mb-2 block">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full bg-slate-900/50 border border-slate-700 text-white rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-300 mb-2 block">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-slate-900/50 border border-slate-700 text-white rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold py-3 px-4 rounded-lg hover:opacity-90 transition-opacity"
          >
            Sign Up
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
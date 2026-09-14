import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { BookMarked, Mail, Lock, LogIn, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { signIn, isCloudAuth } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/dashboard';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || 'Failed to sign in. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-md w-full sheet p-8">
        <div className="text-center mb-7">
          <div className="w-11 h-11 rounded-sm bg-brass flex items-center justify-center mx-auto mb-4">
            <BookMarked className="w-5 h-5 text-ink" />
          </div>
          <h2 className="font-display text-2xl font-semibold text-ink-text tracking-tight">
            Return to the desk
          </h2>
          <p className="text-sm text-ink-text/65 mt-1.5">
            Log in to continue consulting your documents
          </p>
          {isCloudAuth && (
            <span className="inline-block mt-3 index-label text-sage border-b border-sage/40">
              Secure Cloud Sign-In
            </span>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-sm bg-ink-text text-paper text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block index-label text-ink-text/60 mb-1.5">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-ink-text/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="field-paper pl-10 text-sm"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block index-label text-ink-text/60">Password</label>
              <a href="#forgot" className="text-xs text-brass-dim hover:underline">Forgot?</a>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-ink-text/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="field-paper pl-10 text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-brass w-full mt-2 py-2.5 px-4 text-sm flex items-center justify-center gap-2"
          >
            <LogIn className="w-4 h-4" />
            <span>{loading ? 'Logging In…' : 'Log In'}</span>
          </button>
        </form>

        <p className="text-xs text-center text-ink-text/65 mt-6">
          Don't have an account?{' '}
          <Link to="/register" className="text-brass-dim font-semibold hover:underline">
            Register for a card
          </Link>
        </p>
      </div>
    </div>
  );
}

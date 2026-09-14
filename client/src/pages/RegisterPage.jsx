import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookMarked, Mail, Lock, User, UserPlus, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { signUp, isCloudAuth } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signUp(email, password, name);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Failed to create account. Please try again.');
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
            Register for a card
          </h2>
          <p className="text-sm text-ink-text/65 mt-1.5">
            Open an account and start consulting your documents
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
            <label className="block index-label text-ink-text/60 mb-1.5">Full Name</label>
            <div className="relative">
              <User className="w-4 h-4 text-ink-text/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex Morgan"
                className="field-paper pl-10 text-sm"
              />
            </div>
          </div>

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
            <label className="block index-label text-ink-text/60 mb-1.5">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-ink-text/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="field-paper pl-10 text-sm"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="btn-brass w-full py-2.5 px-4 text-sm flex items-center justify-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              <span>{loading ? 'Creating Account…' : 'Register Now'}</span>
            </button>
          </div>
        </form>

        <p className="text-xs text-center text-ink-text/65 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-brass-dim font-semibold hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}

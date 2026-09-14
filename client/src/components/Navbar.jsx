import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BookMarked, LayoutDashboard, LogIn, UserPlus, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const getDisplayName = () => {
    if (!user) return '';
    if (user.user_metadata?.name) return user.user_metadata.name;
    if (user.name) return user.name;
    if (user.email) return user.email.split('@')[0];
    return 'User';
  };

  const displayName = getDisplayName();
  const inCatalog =
    location.pathname.startsWith('/dashboard') || location.pathname.startsWith('/document');

  return (
    <header className="sticky top-0 z-40 border-b border-brass/25 bg-ink-deep/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-sm bg-brass flex items-center justify-center group-hover:bg-brass-light transition-colors">
            <BookMarked className="w-[18px] h-[18px] text-ink" />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="font-display italic text-lg font-semibold tracking-tight text-parchment group-hover:text-brass-light transition-colors">
                SmartDocs
              </span>
              <span className="index-label text-brass border-b border-brass/40">AI</span>
            </div>
            <span className="text-[10px] text-parchment-dim hidden sm:block font-body">
              Intelligent Document RAG Assistant
            </span>
          </div>
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link
            to="/"
            className={`px-3 py-1.5 text-sm rounded-sm transition-colors font-body ${
              location.pathname === '/'
                ? 'text-brass-light border-b-2 border-brass'
                : 'text-parchment-dim hover:text-parchment'
            }`}
          >
            Home
          </Link>
          {user && (
            <Link
              to="/dashboard"
              className={`px-3 py-1.5 text-sm rounded-sm flex items-center gap-2 transition-colors font-body ${
                inCatalog
                  ? 'text-brass-light border-b-2 border-brass'
                  : 'text-parchment-dim hover:text-parchment'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Stacks</span>
            </Link>
          )}

          {/* Auth state */}
          <div className="flex items-center gap-2 pl-2 ml-1 border-l border-ink-line">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full border border-brass/50 bg-ink-soft flex items-center justify-center font-display font-semibold text-sm text-brass-light">
                    {displayName[0]?.toUpperCase() || 'U'}
                  </div>
                  <span className="text-xs text-parchment-dim hidden md:block font-mono">
                    {user.email}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  title="Log out"
                  className="p-1.5 rounded-sm text-parchment-dim hover:text-brass-light hover:bg-ink-soft transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : !isAuthPage ? (
              <>
                <Link
                  to="/login"
                  className="px-3 py-1.5 text-sm text-parchment-dim hover:text-parchment rounded-sm flex items-center gap-1.5 transition-colors font-body"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Log In</span>
                </Link>
                <Link
                  to="/register"
                  className="btn-brass px-3.5 py-1.5 text-sm flex items-center gap-1.5"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Get Started</span>
                </Link>
              </>
            ) : null}
          </div>
        </nav>
      </div>
    </header>
  );
}

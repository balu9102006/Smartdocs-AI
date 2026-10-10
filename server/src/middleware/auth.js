import { supabase, isSupabaseConfigured } from '../config/supabase.js';
import { config } from '../config/index.js';

export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.split(' ')[1]
      : null;

    if (isSupabaseConfigured && supabase) {
      if (!token) {
        return res.status(401).json({ error: 'Missing or malformed Authorization header' });
      }

      // Verify token with Supabase Auth
      const { data: { user }, error } = await supabase.auth.getUser(token);

      if (error || !user) {
        return res.status(401).json({ error: 'Invalid or expired session token' });
      }

      req.user = user;
      return next();
    }

    // Local / dev fallback mode is only allowed when explicitly enabled.
    // Without an explicit opt-in, fail closed instead of accepting a
    // client-supplied user id as a valid authenticated session.
    if (!config.auth.allowDevAuthFallback) {
      console.error('[Auth] Refusing unauthenticated dev fallback: auth is not configured.');
      return res.status(503).json({ error: 'Authentication is not configured. Set your Supabase environment variables or enable ALLOW_DEV_AUTH_FALLBACK for local testing.' });
    }

    const devUserId = req.headers['x-user-id'] || 'user-default-1';
    req.user = {
      id: devUserId,
      email: 'alex.developer@smartdocs.ai',
      role: 'authenticated'
    };

    next();
  } catch (err) {
    console.error('Authentication middleware error:', err);
    res.status(500).json({ error: 'Internal auth verification error' });
  }
};


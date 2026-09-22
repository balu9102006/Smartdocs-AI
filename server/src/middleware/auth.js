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

    // Local / Dev fallback mode. Server startup already refuses to run this
    // path in production (see server.js), but this check stays as a second
    // independent guard — trusting a client-supplied user id header with no
    // real auth must never be reachable outside local development.
    if (config.nodeEnv === 'production') {
      console.error('[Auth] Refusing unauthenticated dev fallback in production.');
      return res.status(500).json({ error: 'Server misconfiguration: authentication unavailable' });
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


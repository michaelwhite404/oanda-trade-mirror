import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { passport } from '../config/passport';
import { authService, OAuthProfile } from '../services/authService';
import { authenticate } from '../middleware/authMiddleware';
import { User } from '../db';

const SALT_ROUNDS = 12;

const router = Router();

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

// Frontend URL for redirects (dev server in development, same origin in production)
const FRONTEND_URL = process.env.FRONTEND_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5173');

// GET /api/auth/verify-invite/:token - Verify invite token
router.get('/verify-invite/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    const user = await User.findOne({
      inviteToken: token,
      registrationStatus: 'pending',
      isActive: true,
    });

    if (!user) {
      res.status(404).json({ error: 'Invalid or expired invite link' });
      return;
    }

    if (user.inviteExpiresAt && user.inviteExpiresAt < new Date()) {
      res.status(410).json({ error: 'Invite link has expired. Please request a new invite.' });
      return;
    }

    res.json({
      email: user.email,
      role: user.role,
    });
  } catch (error) {
    console.error('[Auth] Verify invite error:', error);
    res.status(500).json({ error: 'Failed to verify invite' });
  }
});

// POST /api/auth/complete-registration - Complete registration with username and password
router.post('/complete-registration', async (req: Request, res: Response) => {
  try {
    const { token, username, password } = req.body;

    if (!token || !username || !password) {
      res.status(400).json({ error: 'Token, username, and password are required' });
      return;
    }

    // Validate username
    if (username.length < 3 || username.length > 50) {
      res.status(400).json({ error: 'Username must be between 3 and 50 characters' });
      return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      res.status(400).json({ error: 'Username can only contain letters, numbers, underscores, and hyphens' });
      return;
    }

    // Validate password
    const passwordValidation = await authService.validatePassword(password);
    if (!passwordValidation.valid) {
      res.status(400).json({ error: passwordValidation.message });
      return;
    }

    // Find user by invite token
    const user = await User.findOne({
      inviteToken: token,
      registrationStatus: 'pending',
      isActive: true,
    });

    if (!user) {
      res.status(404).json({ error: 'Invalid or expired invite link' });
      return;
    }

    if (user.inviteExpiresAt && user.inviteExpiresAt < new Date()) {
      res.status(410).json({ error: 'Invite link has expired. Please request a new invite.' });
      return;
    }

    // Check if username already exists
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      res.status(409).json({ error: 'Username already taken' });
      return;
    }

    // Update user with username and password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    user.username = username;
    user.passwordHash = passwordHash;
    user.registrationStatus = 'active';
    user.inviteToken = null;
    user.inviteExpiresAt = null;
    await user.save();

    // Auto-login the user
    const { user: userResponse, tokens } = await authService.login(username, password);

    // Set cookies
    res.cookie('accessToken', tokens.accessToken, {
      ...COOKIE_OPTIONS,
      maxAge: 15 * 60 * 1000,
    });

    res.cookie('refreshToken', tokens.refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ user: userResponse });
  } catch (error) {
    console.error('[Auth] Complete registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/register - Create new user (first user or admin only)
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, email, password, role } = req.body;

    if (!username || !email || !password) {
      res.status(400).json({ error: 'Username, email, and password are required' });
      return;
    }

    // Check if this is the first user
    const userCount = await User.countDocuments();

    // If not first user, require admin authentication
    if (userCount > 0) {
      const token = req.cookies?.accessToken;
      if (!token) {
        res.status(401).json({ error: 'Only admins can create new users' });
        return;
      }

      try {
        const payload = authService.verifyAccessToken(token);
        if (payload.role !== 'admin') {
          res.status(403).json({ error: 'Only admins can create new users' });
          return;
        }
      } catch {
        res.status(401).json({ error: 'Invalid token' });
        return;
      }
    }

    // Validate password
    const passwordValidation = await authService.validatePassword(password);
    if (!passwordValidation.valid) {
      res.status(400).json({ error: passwordValidation.message });
      return;
    }

    // Check for existing user
    const existingUser = await User.findOne({
      $or: [{ username }, { email: email.toLowerCase() }],
    });
    if (existingUser) {
      res.status(409).json({ error: 'Username or email already exists' });
      return;
    }

    const user = await authService.register(username, email, password, role);

    res.status(201).json({
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
    });
  } catch (error) {
    console.error('[Auth] Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /api/auth/login - Login user
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }

    const { user, tokens } = await authService.login(username, password);

    // Set cookies
    res.cookie('accessToken', tokens.accessToken, {
      ...COOKIE_OPTIONS,
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie('refreshToken', tokens.refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({ user });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Invalid credentials' || error.message === 'Please sign in with Google') {
        res.status(401).json({ error: error.message });
        return;
      }
    }
    console.error('[Auth] Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/logout - Logout user
router.post('/logout', authenticate, async (req: Request, res: Response) => {
  try {
    await authService.logout(req.authUser!.userId);

    res.clearCookie('accessToken', COOKIE_OPTIONS);
    res.clearCookie('refreshToken', COOKIE_OPTIONS);

    res.json({ success: true });
  } catch (error) {
    console.error('[Auth] Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// POST /api/auth/refresh - Refresh access token
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      res.status(401).json({ error: 'Refresh token required' });
      return;
    }

    const tokens = await authService.refresh(refreshToken);

    res.cookie('accessToken', tokens.accessToken, {
      ...COOKIE_OPTIONS,
      maxAge: 15 * 60 * 1000,
    });

    res.cookie('refreshToken', tokens.refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid refresh token') {
      res.clearCookie('accessToken', COOKIE_OPTIONS);
      res.clearCookie('refreshToken', COOKIE_OPTIONS);
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }
    console.error('[Auth] Refresh error:', error);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

// GET /api/auth/me - Get current user
router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const user = await authService.getUser(req.authUser!.userId);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user });
  } catch (error) {
    console.error('[Auth] Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// GET /api/auth/google - Initiate Google OAuth
router.get('/google', passport.authenticate('google', { session: false }));

// GET /api/auth/google/callback - Google OAuth callback
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${FRONTEND_URL}/login?error=oauth_failed` }),
  async (req: Request, res: Response) => {
    try {
      const profile = req.user as OAuthProfile;

      if (!profile || !profile.email) {
        res.redirect(`${FRONTEND_URL}/login?error=oauth_failed`);
        return;
      }

      const { tokens } = await authService.oauthLogin(profile);

      // Set cookies
      res.cookie('accessToken', tokens.accessToken, {
        ...COOKIE_OPTIONS,
        maxAge: 15 * 60 * 1000,
      });

      res.cookie('refreshToken', tokens.refreshToken, {
        ...COOKIE_OPTIONS,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      // Redirect to frontend
      res.redirect(`${FRONTEND_URL}/`);
    } catch (error) {
      console.error('[Auth] Google OAuth error:', error);
      res.redirect(`${FRONTEND_URL}/login?error=oauth_failed`);
    }
  }
);

export default router;

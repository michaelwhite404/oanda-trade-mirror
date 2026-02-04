import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { passport } from '../config/passport';
import { authService, OAuthProfile } from '../services/authService';
import { authenticate } from '../middleware/authMiddleware';
import { User } from '../db';
import { emailService } from '../services/emailService';

const SALT_ROUNDS = 12;

const router = Router();

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

// Frontend URL for redirects (dev server in development, same origin in production)
const APP_URL = process.env.APP_URL || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5173');

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
    const metadata = {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip || req.socket.remoteAddress,
    };
    const { user: userResponse, tokens, sessionId } = await authService.login(username, password, metadata);

    // Set cookies
    res.cookie('accessToken', tokens.accessToken, {
      ...COOKIE_OPTIONS,
      maxAge: 15 * 60 * 1000,
    });

    res.cookie('refreshToken', tokens.refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.cookie('sessionId', sessionId, {
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

    const metadata = {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip || req.socket.remoteAddress,
    };

    const { user, tokens, sessionId } = await authService.login(username, password, metadata);

    // Set cookies
    res.cookie('accessToken', tokens.accessToken, {
      ...COOKIE_OPTIONS,
      maxAge: 15 * 60 * 1000, // 15 minutes
    });

    res.cookie('refreshToken', tokens.refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.cookie('sessionId', sessionId, {
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
    const sessionId = req.cookies?.sessionId;
    if (sessionId) {
      await authService.logout(sessionId);
    }

    res.clearCookie('accessToken', COOKIE_OPTIONS);
    res.clearCookie('refreshToken', COOKIE_OPTIONS);
    res.clearCookie('sessionId', COOKIE_OPTIONS);

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
    const sessionId = req.cookies?.sessionId;

    if (!refreshToken || !sessionId) {
      res.status(401).json({ error: 'Refresh token required' });
      return;
    }

    const { tokens, sessionId: newSessionId } = await authService.refresh(refreshToken, sessionId);

    res.cookie('accessToken', tokens.accessToken, {
      ...COOKIE_OPTIONS,
      maxAge: 15 * 60 * 1000,
    });

    res.cookie('refreshToken', tokens.refreshToken, {
      ...COOKIE_OPTIONS,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.cookie('sessionId', newSessionId, {
      ...COOKIE_OPTIONS,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid refresh token') {
      res.clearCookie('accessToken', COOKIE_OPTIONS);
      res.clearCookie('refreshToken', COOKIE_OPTIONS);
      res.clearCookie('sessionId', COOKIE_OPTIONS);
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

// PATCH /api/auth/profile - Update current user's profile
router.patch('/profile', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.authUser!.userId;
    const { username } = req.body;

    if (!username) {
      res.status(400).json({ error: 'Username is required' });
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

    // Check if username already exists (excluding current user)
    const existingUser = await User.findOne({ username, _id: { $ne: userId } });
    if (existingUser) {
      res.status(409).json({ error: 'Username is already taken' });
      return;
    }

    // Update user
    const user = await User.findByIdAndUpdate(
      userId,
      { username },
      { new: true }
    );

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        lastLoginAt: user.lastLoginAt,
        avatarUrl: user.avatarUrl,
        authProvider: user.authProvider,
      },
    });
  } catch (error) {
    console.error('[Auth] Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// POST /api/auth/set-password - Set password for users who don't have one (Google users)
router.post('/set-password', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.authUser!.userId;
    const { newPassword } = req.body;

    if (!newPassword) {
      res.status(400).json({ error: 'New password is required' });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Only allow if user doesn't have a password yet
    if (user.passwordHash) {
      res.status(400).json({ error: 'Password already set. Use change-password instead.' });
      return;
    }

    // Validate new password
    const passwordValidation = await authService.validatePassword(newPassword);
    if (!passwordValidation.valid) {
      res.status(400).json({ error: passwordValidation.message });
      return;
    }

    // Hash and save password
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    user.passwordHash = passwordHash;
    await user.save();

    res.json({ success: true, hasPassword: true });
  } catch (error) {
    console.error('[Auth] Set password error:', error);
    res.status(500).json({ error: 'Failed to set password' });
  }
});

// POST /api/auth/change-password - Change current user's password
router.post('/change-password', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.authUser!.userId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'Current password and new password are required' });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (!user.passwordHash) {
      res.status(400).json({ error: 'No password set. Use set-password instead.' });
      return;
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }

    // Validate new password
    const passwordValidation = await authService.validatePassword(newPassword);
    if (!passwordValidation.valid) {
      res.status(400).json({ error: passwordValidation.message });
      return;
    }

    // Hash and save new password
    const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    user.passwordHash = newPasswordHash;
    await user.save();

    res.json({ success: true });
  } catch (error) {
    console.error('[Auth] Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// POST /api/auth/forgot-password - Request password reset
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    // Find user by email
    const user = await User.findOne({
      email: email.toLowerCase(),
      isActive: true,
      registrationStatus: 'active',
    });

    // Always return success to prevent email enumeration
    if (!user) {
      console.log(`[Auth] Password reset requested for unknown email: ${email}`);
      res.json({ success: true });
      return;
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetPasswordExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Save token to user
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpiresAt = resetPasswordExpiresAt;
    await user.save();

    // Send email
    await emailService.sendPasswordReset({
      email: user.email,
      resetToken,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('[Auth] Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// GET /api/auth/verify-reset/:token - Verify reset token is valid
router.get('/verify-reset/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    const user = await User.findOne({
      resetPasswordToken: token,
      isActive: true,
    });

    if (!user) {
      res.status(404).json({ error: 'Invalid or expired reset link' });
      return;
    }

    if (user.resetPasswordExpiresAt && user.resetPasswordExpiresAt < new Date()) {
      res.status(410).json({ error: 'Reset link has expired. Please request a new one.' });
      return;
    }

    res.json({ valid: true, email: user.email });
  } catch (error) {
    console.error('[Auth] Verify reset token error:', error);
    res.status(500).json({ error: 'Failed to verify reset token' });
  }
});

// POST /api/auth/reset-password - Reset password with token
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      res.status(400).json({ error: 'Token and password are required' });
      return;
    }

    // Validate password
    const passwordValidation = await authService.validatePassword(password);
    if (!passwordValidation.valid) {
      res.status(400).json({ error: passwordValidation.message });
      return;
    }

    // Find user by reset token
    const user = await User.findOne({
      resetPasswordToken: token,
      isActive: true,
    });

    if (!user) {
      res.status(404).json({ error: 'Invalid or expired reset link' });
      return;
    }

    if (user.resetPasswordExpiresAt && user.resetPasswordExpiresAt < new Date()) {
      res.status(410).json({ error: 'Reset link has expired. Please request a new one.' });
      return;
    }

    // Hash and save new password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    user.passwordHash = passwordHash;
    user.resetPasswordToken = null;
    user.resetPasswordExpiresAt = null;

    // If user was using Google only, set authProvider to local since they now have a password
    if (user.authProvider === 'google') {
      user.authProvider = 'local';
    }

    await user.save();

    res.json({ success: true });
  } catch (error) {
    console.error('[Auth] Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// GET /api/auth/google - Initiate Google OAuth
router.get('/google', passport.authenticate('google', { session: false }));

// GET /api/auth/google/callback - Google OAuth callback
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${APP_URL}/login?error=oauth_failed` }),
  async (req: Request, res: Response) => {
    try {
      const profile = req.user as OAuthProfile;

      if (!profile || !profile.email) {
        res.redirect(`${APP_URL}/login?error=oauth_failed`);
        return;
      }

      const metadata = {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip || req.socket.remoteAddress,
      };

      const { tokens, sessionId } = await authService.oauthLogin(profile, metadata);

      // Set cookies
      res.cookie('accessToken', tokens.accessToken, {
        ...COOKIE_OPTIONS,
        maxAge: 15 * 60 * 1000,
      });

      res.cookie('refreshToken', tokens.refreshToken, {
        ...COOKIE_OPTIONS,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.cookie('sessionId', sessionId, {
        ...COOKIE_OPTIONS,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      // Redirect to frontend
      res.redirect(`${APP_URL}/`);
    } catch (error) {
      console.error('[Auth] Google OAuth error:', error);
      res.redirect(`${APP_URL}/login?error=oauth_failed`);
    }
  }
);

// GET /api/auth/sessions - Get all active sessions for current user
router.get('/sessions', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.authUser!.userId;
    const currentSessionId = req.cookies?.sessionId;

    const sessions = await authService.getSessions(userId, currentSessionId);

    res.json({ sessions });
  } catch (error) {
    console.error('[Auth] Get sessions error:', error);
    res.status(500).json({ error: 'Failed to get sessions' });
  }
});

// DELETE /api/auth/sessions/:id - Revoke a specific session
router.delete('/sessions/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.authUser!.userId;
    const sessionId = req.params.id;
    const currentSessionId = req.cookies?.sessionId;

    // Prevent revoking current session via this endpoint
    if (sessionId === currentSessionId) {
      res.status(400).json({ error: 'Cannot revoke current session. Use logout instead.' });
      return;
    }

    const deleted = await authService.revokeSession(userId, sessionId);

    if (!deleted) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[Auth] Revoke session error:', error);
    res.status(500).json({ error: 'Failed to revoke session' });
  }
});

// POST /api/auth/sessions/revoke-others - Revoke all sessions except current
router.post('/sessions/revoke-others', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.authUser!.userId;
    const currentSessionId = req.cookies?.sessionId;

    if (!currentSessionId) {
      res.status(400).json({ error: 'No current session found' });
      return;
    }

    const count = await authService.revokeAllOtherSessions(userId, currentSessionId);

    res.json({ success: true, revokedCount: count });
  } catch (error) {
    console.error('[Auth] Revoke other sessions error:', error);
    res.status(500).json({ error: 'Failed to revoke sessions' });
  }
});

export default router;

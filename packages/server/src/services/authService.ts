import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { User, UserDocument, Session } from '../db';
import { UserRole, AuthProvider } from '../types/models';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
const SALT_ROUNDS = 12;

export interface TokenPayload {
  userId: string;
  username: string;
  role: UserRole;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface UserResponse {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  lastLoginAt: Date | null;
  avatarUrl: string | null;
  authProvider: AuthProvider;
  hasPassword: boolean;
}

export interface OAuthProfile {
  provider: AuthProvider;
  providerId: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
}

export interface SessionMetadata {
  userAgent?: string;
  ipAddress?: string;
}

export interface SessionInfo {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  lastActiveAt: Date;
  createdAt: Date;
  isCurrent: boolean;
}

class AuthService {
  async register(
    username: string,
    email: string,
    password: string,
    role: UserRole = 'viewer'
  ): Promise<UserDocument> {
    // Check if this is the first user - make them admin
    const userCount = await User.countDocuments();
    const assignedRole = userCount === 0 ? 'admin' : role;

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const user = new User({
      username,
      email: email.toLowerCase(),
      passwordHash,
      role: assignedRole,
      isActive: true,
      authProvider: 'local',
    });

    await user.save();
    return user;
  }

  async oauthLogin(
    profile: OAuthProfile,
    metadata?: SessionMetadata
  ): Promise<{ user: UserResponse; tokens: AuthTokens; sessionId: string }> {
    // Check if this is the first user - make them admin
    const userCount = await User.countDocuments();
    const assignedRole = userCount === 0 ? 'admin' : 'viewer';

    // Find or create user
    let user = await User.findOne({
      $or: [
        { googleId: profile.providerId },
        { email: profile.email.toLowerCase() },
      ],
    });

    if (user) {
      // Update OAuth info if user exists but was created with different method
      if (profile.provider === 'google' && !user.googleId) {
        user.googleId = profile.providerId;
      }
      if (profile.avatarUrl) {
        user.avatarUrl = profile.avatarUrl;
      }
    } else {
      // Create new user
      const username = await this.generateUniqueUsername(profile.displayName);
      user = new User({
        username,
        email: profile.email.toLowerCase(),
        passwordHash: null,
        role: assignedRole,
        isActive: true,
        authProvider: profile.provider,
        googleId: profile.provider === 'google' ? profile.providerId : null,
        avatarUrl: profile.avatarUrl || null,
      });
    }

    const tokens = await this.generateTokens(user);

    // Create session with refresh token hash
    const refreshTokenHash = await bcrypt.hash(tokens.refreshToken, SALT_ROUNDS);
    const session = new Session({
      userId: user._id,
      refreshTokenHash,
      userAgent: metadata?.userAgent || null,
      ipAddress: metadata?.ipAddress || null,
      lastActiveAt: new Date(),
    });
    await session.save();

    user.lastLoginAt = new Date();
    await user.save();

    return {
      user: this.toUserResponse(user),
      tokens,
      sessionId: session._id.toString(),
    };
  }

  private async generateUniqueUsername(displayName: string): Promise<string> {
    // Convert display name to a valid username
    let baseUsername = displayName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 20);

    if (baseUsername.length < 3) {
      baseUsername = 'user';
    }

    let username = baseUsername;
    let counter = 1;

    while (await User.findOne({ username })) {
      username = `${baseUsername}${counter}`;
      counter++;
    }

    return username;
  }

  async login(
    username: string,
    password: string,
    metadata?: SessionMetadata
  ): Promise<{ user: UserResponse; tokens: AuthTokens; sessionId: string }> {
    const user = await User.findOne({
      $or: [{ username }, { email: username.toLowerCase() }],
      isActive: true,
    });

    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Check if user uses OAuth (no password)
    if (!user.passwordHash) {
      throw new Error('Please sign in with Google');
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    const tokens = await this.generateTokens(user);

    // Create session with refresh token hash
    const refreshTokenHash = await bcrypt.hash(tokens.refreshToken, SALT_ROUNDS);
    const session = new Session({
      userId: user._id,
      refreshTokenHash,
      userAgent: metadata?.userAgent || null,
      ipAddress: metadata?.ipAddress || null,
      lastActiveAt: new Date(),
    });
    await session.save();

    user.lastLoginAt = new Date();
    await user.save();

    return {
      user: this.toUserResponse(user),
      tokens,
      sessionId: session._id.toString(),
    };
  }

  async logout(sessionId: string): Promise<void> {
    await Session.findByIdAndDelete(sessionId);
  }

  async logoutAll(userId: string): Promise<void> {
    await Session.deleteMany({ userId: new Types.ObjectId(userId) });
  }

  async refresh(
    refreshToken: string,
    currentSessionId: string
  ): Promise<{ tokens: AuthTokens; sessionId: string }> {
    let payload: TokenPayload;
    try {
      payload = jwt.verify(refreshToken, JWT_SECRET) as TokenPayload;
    } catch {
      throw new Error('Invalid refresh token');
    }

    const user = await User.findById(payload.userId);
    if (!user || !user.isActive) {
      throw new Error('Invalid refresh token');
    }

    // Find the session
    const session = await Session.findById(currentSessionId);
    if (!session || session.userId.toString() !== payload.userId) {
      throw new Error('Invalid refresh token');
    }

    // Verify the refresh token matches this session
    const isValid = await bcrypt.compare(refreshToken, session.refreshTokenHash);
    if (!isValid) {
      throw new Error('Invalid refresh token');
    }

    // Generate new tokens (rotation)
    const tokens = await this.generateTokens(user);

    // Update session with new refresh token hash
    const newRefreshTokenHash = await bcrypt.hash(tokens.refreshToken, SALT_ROUNDS);
    session.refreshTokenHash = newRefreshTokenHash;
    session.lastActiveAt = new Date();
    await session.save();

    return { tokens, sessionId: session._id.toString() };
  }

  async getUser(userId: string): Promise<UserResponse | null> {
    const user = await User.findById(userId);
    if (!user || !user.isActive) {
      return null;
    }
    return this.toUserResponse(user);
  }

  async getSessions(userId: string, currentSessionId?: string): Promise<SessionInfo[]> {
    const sessions = await Session.find({ userId: new Types.ObjectId(userId) })
      .sort({ lastActiveAt: -1 });

    return sessions.map((session) => ({
      id: session._id.toString(),
      userAgent: session.userAgent,
      ipAddress: session.ipAddress,
      lastActiveAt: session.lastActiveAt,
      createdAt: session.createdAt!,
      isCurrent: session._id.toString() === currentSessionId,
    }));
  }

  async revokeSession(userId: string, sessionId: string): Promise<boolean> {
    const result = await Session.deleteOne({
      _id: new Types.ObjectId(sessionId),
      userId: new Types.ObjectId(userId),
    });
    return result.deletedCount > 0;
  }

  async revokeAllOtherSessions(userId: string, currentSessionId: string): Promise<number> {
    const result = await Session.deleteMany({
      userId: new Types.ObjectId(userId),
      _id: { $ne: new Types.ObjectId(currentSessionId) },
    });
    return result.deletedCount;
  }

  async validatePassword(password: string): Promise<{ valid: boolean; message?: string }> {
    if (password.length < 8) {
      return { valid: false, message: 'Password must be at least 8 characters' };
    }
    if (!/[A-Z]/.test(password)) {
      return { valid: false, message: 'Password must contain at least one uppercase letter' };
    }
    if (!/[a-z]/.test(password)) {
      return { valid: false, message: 'Password must contain at least one lowercase letter' };
    }
    if (!/[0-9]/.test(password)) {
      return { valid: false, message: 'Password must contain at least one number' };
    }
    return { valid: true };
  }

  verifyAccessToken(token: string): TokenPayload {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  }

  private async generateTokens(user: UserDocument): Promise<AuthTokens> {
    const payload: TokenPayload = {
      userId: user._id.toString(),
      username: user.username || user.email, // Fallback to email if username not set
      role: user.role,
    };

    const accessToken = jwt.sign(payload, JWT_SECRET, {
      expiresIn: ACCESS_TOKEN_EXPIRY,
    });

    const refreshToken = jwt.sign(payload, JWT_SECRET, {
      expiresIn: REFRESH_TOKEN_EXPIRY,
    });

    return { accessToken, refreshToken };
  }

  private toUserResponse(user: UserDocument): UserResponse {
    return {
      id: user._id.toString(),
      username: user.username || user.email, // Fallback to email if username not set
      email: user.email,
      role: user.role,
      lastLoginAt: user.lastLoginAt,
      avatarUrl: user.avatarUrl,
      authProvider: user.authProvider,
      hasPassword: !!user.passwordHash,
    };
  }
}

export const authService = new AuthService();

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { User, UserDocument } from '../db';
import { UserRole } from '../types/models';

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
    });

    await user.save();
    return user;
  }

  async login(
    username: string,
    password: string
  ): Promise<{ user: UserResponse; tokens: AuthTokens }> {
    const user = await User.findOne({
      $or: [{ username }, { email: username.toLowerCase() }],
      isActive: true,
    });

    if (!user) {
      throw new Error('Invalid credentials');
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    const tokens = await this.generateTokens(user);

    // Store refresh token hash
    const refreshTokenHash = await bcrypt.hash(tokens.refreshToken, SALT_ROUNDS);
    user.refreshTokenHash = refreshTokenHash;
    user.lastLoginAt = new Date();
    await user.save();

    return {
      user: this.toUserResponse(user),
      tokens,
    };
  }

  async logout(userId: string): Promise<void> {
    await User.findByIdAndUpdate(userId, { refreshTokenHash: null });
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    let payload: TokenPayload;
    try {
      payload = jwt.verify(refreshToken, JWT_SECRET) as TokenPayload;
    } catch {
      throw new Error('Invalid refresh token');
    }

    const user = await User.findById(payload.userId);
    if (!user || !user.isActive || !user.refreshTokenHash) {
      throw new Error('Invalid refresh token');
    }

    // Verify the refresh token matches
    const isValid = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!isValid) {
      throw new Error('Invalid refresh token');
    }

    // Generate new tokens (rotation)
    const tokens = await this.generateTokens(user);

    // Update stored refresh token hash
    const newRefreshTokenHash = await bcrypt.hash(tokens.refreshToken, SALT_ROUNDS);
    user.refreshTokenHash = newRefreshTokenHash;
    await user.save();

    return tokens;
  }

  async getUser(userId: string): Promise<UserResponse | null> {
    const user = await User.findById(userId);
    if (!user || !user.isActive) {
      return null;
    }
    return this.toUserResponse(user);
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
      username: user.username,
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
      username: user.username,
      email: user.email,
      role: user.role,
      lastLoginAt: user.lastLoginAt,
    };
  }
}

export const authService = new AuthService();

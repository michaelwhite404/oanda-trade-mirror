import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { authService, TokenPayload } from '../services/authService';
import { UserRole } from '../types/models';
import { ApiKey } from '../db/models/ApiKey';
import { User } from '../db/models/User';

declare global {
  namespace Express {
    interface Request {
      authUser?: TokenPayload;
      authMethod?: 'cookie' | 'apiKey';
    }
  }
}

async function authenticateWithApiKey(apiKey: string): Promise<TokenPayload | null> {
  // Find all active API keys and check against hash
  // We need to check the prefix first to narrow down candidates
  const keyPrefix = apiKey.substring(0, 12);

  const candidates = await ApiKey.find({
    keyPrefix,
    isActive: true,
  });

  for (const candidate of candidates) {
    // Check if expired
    if (candidate.expiresAt && candidate.expiresAt < new Date()) {
      continue;
    }

    // Verify the key hash
    const isValid = await bcrypt.compare(apiKey, candidate.keyHash);
    if (isValid) {
      // Update last used timestamp
      candidate.lastUsedAt = new Date();
      await candidate.save();

      // Get the user
      const user = await User.findById(candidate.userId);
      if (!user || !user.isActive || user.registrationStatus !== 'active') {
        return null;
      }

      return {
        userId: user._id.toString(),
        username: user.username || user.email,
        role: user.role,
      };
    }
  }

  return null;
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  // Check for API key in Authorization header first
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const apiKey = authHeader.substring(7);

    // Check if it looks like an API key (starts with otm_)
    if (apiKey.startsWith('otm_')) {
      authenticateWithApiKey(apiKey)
        .then((payload) => {
          if (payload) {
            req.authUser = payload;
            req.authMethod = 'apiKey';
            next();
          } else {
            res.status(401).json({ error: 'Invalid or expired API key' });
          }
        })
        .catch(() => {
          res.status(401).json({ error: 'Authentication failed' });
        });
      return;
    }
  }

  // Fall back to cookie-based authentication
  const token = req.cookies?.accessToken;

  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const payload = authService.verifyAccessToken(token);
    req.authUser = payload;
    req.authMethod = 'cookie';
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.authUser) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!roles.includes(req.authUser.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
}

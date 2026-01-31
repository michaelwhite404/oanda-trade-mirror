import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/api/auth/google/callback';

export function configurePassport(): void {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    console.warn('[Passport] Google OAuth not configured - missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
    return;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: CALLBACK_URL,
        scope: ['profile', 'email'],
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          // Pass the profile to the route handler
          const oauthProfile = {
            provider: 'google' as const,
            providerId: profile.id,
            email: profile.emails?.[0]?.value || '',
            displayName: profile.displayName || profile.emails?.[0]?.value?.split('@')[0] || 'user',
            avatarUrl: profile.photos?.[0]?.value,
          };
          done(null, oauthProfile);
        } catch (error) {
          done(error as Error);
        }
      }
    )
  );
}

export { passport };

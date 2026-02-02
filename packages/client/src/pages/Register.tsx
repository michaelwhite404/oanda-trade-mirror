import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { api } from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

type PageState = 'loading' | 'valid' | 'invalid' | 'expired' | 'success' | 'error';

export default function Register() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { refreshAuth } = useAuth();

  const [pageState, setPageState] = useState<PageState>('loading');
  const [inviteData, setInviteData] = useState<{ email: string; role: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    if (!token) {
      setPageState('invalid');
      setErrorMessage('No invite token provided');
      return;
    }

    async function verifyToken() {
      try {
        const data = await api.verifyInvite(token!);
        setInviteData(data);
        setPageState('valid');
      } catch (error) {
        const message = (error as Error).message;
        if (message.includes('expired')) {
          setPageState('expired');
          setErrorMessage(message);
        } else {
          setPageState('invalid');
          setErrorMessage(message);
        }
      }
    }

    verifyToken();
  }, [token]);

  const validateForm = (): string[] => {
    const errors: string[] = [];

    if (username.length < 3 || username.length > 50) {
      errors.push('Username must be between 3 and 50 characters');
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      errors.push('Username can only contain letters, numbers, underscores, and hyphens');
    }

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (password !== confirmPassword) {
      errors.push('Passwords do not match');
    }

    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors([]);

    const errors = validateForm();
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    setIsSubmitting(true);

    try {
      await api.completeRegistration({
        token: token!,
        username,
        password,
      });

      setPageState('success');

      // Refresh auth context and redirect after a short delay
      await refreshAuth();
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (error) {
      setValidationErrors([(error as Error).message]);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (pageState === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">Verifying invite...</p>
        </div>
      </div>
    );
  }

  if (pageState === 'invalid' || pageState === 'expired') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">
              {pageState === 'expired' ? 'Invite Expired' : 'Invalid Invite'}
            </h1>
            <p className="mt-2 text-muted-foreground">{errorMessage}</p>
          </div>
          <p className="text-sm text-muted-foreground">
            Please contact your administrator to request a new invite.
          </p>
          <Button asChild variant="outline">
            <Link to="/login">Go to Login</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (pageState === 'success') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
            <CheckCircle2 className="h-8 w-8 text-green-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Registration Complete!</h1>
            <p className="mt-2 text-muted-foreground">
              Welcome to OANDA Trade Mirror, @{username}!
            </p>
          </div>
          <p className="text-sm text-muted-foreground">Redirecting to dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Complete Registration</h1>
          <p className="mt-2 text-muted-foreground">
            Set up your account to get started
          </p>
        </div>

        {inviteData && (
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{inviteData.email}</p>
              </div>
              <Badge variant={inviteData.role === 'admin' ? 'default' : 'secondary'}>
                {inviteData.role}
              </Badge>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Choose a username"
              required
              autoComplete="username"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              3-50 characters, letters, numbers, underscores, hyphens only
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a password"
              required
              autoComplete="new-password"
            />
            <p className="text-xs text-muted-foreground">
              At least 8 characters with uppercase, lowercase, and a number
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              required
              autoComplete="new-password"
            />
          </div>

          {validationErrors.length > 0 && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
              <ul className="list-inside list-disc space-y-1 text-sm text-destructive">
                {validationErrors.map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating account...
              </>
            ) : (
              'Complete Registration'
            )}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link to="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

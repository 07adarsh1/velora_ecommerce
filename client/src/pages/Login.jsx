import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { authApi } from '../lib/api/endpoints';
import { useAuthStore } from '../lib/auth/tokenStore';
import { guestCart } from '../lib/cart/guestCart';
import { cartApi } from '../lib/api/endpoints';
import { AuthCard, AuthFooterLink } from '../components/layout/AuthCard';
import { Button, Input } from '../components/ui';

// Shared login/post-login plumbing for register + login.
export async function completeLogin(response, setSession, navigate) {
  setSession(response.data.accessToken, response.data.user);

  // Merge guest cart into the server cart after login (PRD §4.3).
  const guestItems = guestCart.load();
  if (guestItems.length > 0) {
    try {
      await cartApi.merge(guestItems);
      guestCart.clear();
    } catch {
      // non-fatal
    }
  }

  toast.success(`Welcome, ${response.data.user.name.split(' ')[0]}!`);
  navigate(response.data.user.role === 'admin' ? '/admin' : '/');
}

export default function Login() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await authApi.login({ email, password });
      await completeLogin(res, setSession, navigate);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard title="Log in" subtitle="Welcome back to ShelfLife.">
      <form onSubmit={onSubmit} className="space-y-4">
        <Input label="Email" name="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        <Input
          label="Password"
          name="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
        {error && (
          <p className="rounded-input bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" loading={loading} className="w-full" size="lg">
          Log in
        </Button>
      </form>
      <AuthFooterLink text="No account?" to="/register" label="Sign up" />
      <p className="mt-2 text-center text-sm">
        <a href="/forgot-password" className="text-ink-soft underline-offset-2 hover:text-ink hover:underline">
          Forgot your password?
        </a>
      </p>
    </AuthCard>
  );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../lib/api/endpoints';
import { AuthCard } from '../components/layout/AuthCard';
import { Button, Input } from '../components/ui';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [devToken, setDevToken] = useState(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authApi.forgotPassword(email);
      setSent(true);
      // Dev convenience only: without email infra the API returns the raw
      // token so the flow is completable locally (never in production).
      if (res.data?.resetToken) setDevToken(res.data.resetToken);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard title="Reset your password" subtitle="We'll send you a reset link.">
      {sent ? (
        <div>
          <p className="text-sm leading-relaxed text-ink-soft">
            If an account exists for <span className="font-medium text-ink">{email}</span>, a reset link is on its way.
          </p>
          {devToken && (
            <div className="mt-4 rounded-card border border-warn/30 bg-warn/10 p-4 text-sm">
              <p className="font-medium text-warn">Development mode</p>
              <p className="mt-1 text-ink-soft">Email delivery is not configured. Use the link below:</p>
              <Link to={`/reset-password?token=${devToken}`} className="mt-2 block break-all font-medium text-accent underline">
                /reset-password?token={devToken}
              </Link>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <Input label="Email" name="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button type="submit" loading={loading} className="w-full">
            Send reset link
          </Button>
        </form>
      )}
    </AuthCard>
  );
}

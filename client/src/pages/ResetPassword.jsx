import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authApi } from '../lib/api/endpoints';
import { AuthCard } from '../components/layout/AuthCard';
import { Button, Input } from '../components/ui';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authApi.resetPassword({ token, newPassword });
      toast.success('Password reset — log in with your new password');
      navigate('/login');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard title="Choose a new password">
      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="New password"
          name="newPassword"
          type="password"
          required
          minLength={8}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
        />
        {!token && (
          <p className="text-sm text-danger">
            Missing reset token — use the link from your email.{' '}
            <Link to="/forgot-password" className="underline">
              Request one
            </Link>
          </p>
        )}
        <Button type="submit" loading={loading} disabled={!token} className="w-full">
          Reset password
        </Button>
      </form>
    </AuthCard>
  );
}

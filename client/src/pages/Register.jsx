import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authApi } from '../lib/api/endpoints';
import { useAuthStore } from '../lib/auth/tokenStore';
import { AuthCard, AuthFooterLink } from '../components/layout/AuthCard';
import { Button, Input } from '../components/ui';
import { completeLogin } from './Login';

export default function Register() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setFieldErrors({});
    try {
      const res = await authApi.register(form);
      await completeLogin(res, setSession, navigate);
    } catch (err) {
      if (err.details?.length) {
        const map = {};
        for (const d of err.details) map[d.field.replace('body.', '')] = d.message;
        setFieldErrors(map);
      } else {
        toast.error(err.message || 'Registration failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard title="Create your account" subtitle="One account for cart, orders and reviews.">
      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Full name"
          name="name"
          required
          minLength={2}
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          error={fieldErrors.name}
          autoComplete="name"
        />
        <Input
          label="Email"
          name="email"
          type="email"
          required
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          error={fieldErrors.email}
          autoComplete="email"
        />
        <Input
          label="Password"
          name="password"
          type="password"
          required
          minLength={8}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          error={fieldErrors.password}
          autoComplete="new-password"
        />
        <p className="text-xs text-ink-soft">At least 8 characters, with a letter and a number.</p>
        <Button type="submit" loading={loading} className="w-full" size="lg">
          Sign up
        </Button>
      </form>
      <AuthFooterLink text="Already have an account?" to="/login" label="Log in" />
    </AuthCard>
  );
}

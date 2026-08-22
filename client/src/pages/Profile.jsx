import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { KeyRound, UserRound } from 'lucide-react';
import { authApi } from '../lib/api/endpoints';
import { useAuthStore } from '../lib/auth/tokenStore';
import { Button, Input } from '../components/ui';

export default function Profile() {
  const { user, setUser, clear } = useAuthStore();
  const queryClient = useQueryClient();
  const [name, setName] = useState(user?.name || '');
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' });

  const saveProfile = useMutation({
    mutationFn: () => authApi.updateProfile({ name }),
    onSuccess: (res) => {
      setUser(res.data);
      toast.success('Profile updated');
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Update failed'),
  });

  const changePassword = useMutation({
    mutationFn: () => authApi.changePassword(passwords),
    onSuccess: () => {
      toast.success('Password changed — please log in again');
      clear();
      queryClient.clear();
      window.location.href = '/login';
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Password change failed'),
  });

  if (!user) return null;

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <div>
        <p className="eyebrow">Your account</p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">Profile</h1>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          saveProfile.mutate();
        }}
        className="space-y-4 rounded-card border border-line bg-surface p-6"
      >
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <UserRound className="h-5 w-5 text-accent" aria-hidden="true" /> Personal info
        </h2>
        <Input label="Full name" name="name" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} />
        <Input label="Email" name="email" type="email" value={user.email} disabled />
        <p className="text-xs text-ink-soft">Role: {user.role}</p>
        <Button type="submit" loading={saveProfile.isPending}>
          Save changes
        </Button>
      </form>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          changePassword.mutate();
        }}
        className="space-y-4 rounded-card border border-line bg-surface p-6"
      >
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <KeyRound className="h-5 w-5 text-accent" aria-hidden="true" /> Change password
        </h2>
        <Input
          label="Current password"
          name="currentPassword"
          type="password"
          required
          value={passwords.currentPassword}
          onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
          autoComplete="current-password"
        />
        <Input
          label="New password"
          name="newPassword"
          type="password"
          required
          minLength={8}
          value={passwords.newPassword}
          onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
          autoComplete="new-password"
        />
        <Button type="submit" variant="secondary" loading={changePassword.isPending}>
          Change password
        </Button>
        <p className="text-xs text-ink-soft">Changing your password signs you out of all devices.</p>
      </form>
    </div>
  );
}

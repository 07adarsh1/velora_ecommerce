import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ShieldOff, ShieldCheck } from 'lucide-react';
import { adminApi } from '../../lib/api/endpoints';
import { Badge, Button, ErrorState, Input, Select, Skeleton } from '../../components/ui';
import { formatDate } from '../../lib/api/client';
import { useDebouncedValue } from '../../hooks/useCart';

const th = 'px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-ink-soft';

export default function AdminCustomers() {
  const queryClient = useQueryClient();
  const [searchBox, setSearchBox] = useState('');
  const search = useDebouncedValue(searchBox, 350);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'customers', search],
    queryFn: () => adminApi.users({ search: search || undefined }),
  });

  const setStatus = useMutation({
    mutationFn: ({ id, isActive }) => adminApi.setUserStatus(id, isActive),
    onSuccess: (res) => {
      toast.success(res.message || 'Updated');
      queryClient.invalidateQueries({ queryKey: ['admin', 'customers'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed'),
  });

  const setRole = useMutation({
    mutationFn: ({ id, role }) => adminApi.setUserRole(id, role),
    onSuccess: () => {
      toast.success('Role updated');
      queryClient.invalidateQueries({ queryKey: ['admin', 'customers'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed'),
  });

  if (error) return <ErrorState onRetry={refetch} />;
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-card" />
        ))}
      </div>
    );
  }

  const users = data?.data ?? [];

  return (
    <div>
      <div className="mb-6">
        <p className="eyebrow">People</p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">Customers</h1>
      </div>

      <div className="mb-4">
        <Input
          name="search"
          placeholder="Search name or email…"
          value={searchBox}
          onChange={(e) => setSearchBox(e.target.value)}
          className="!w-72"
          aria-label="Search customers"
        />
      </div>

      {users.length === 0 ? (
        <p className="rounded-card border border-dashed border-line bg-canvas p-10 text-center text-sm text-ink-soft">No customers found.</p>
      ) : (
        <div className="overflow-x-auto rounded-card border border-line bg-surface">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-line bg-canvas">
              <tr>
                <th className={th}>Customer</th>
                <th className={th}>Role</th>
                <th className={th}>Status</th>
                <th className={th}>Joined</th>
                <th className={`${th} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u._id} className="border-t border-line transition-colors hover:bg-canvas/60">
                  <td className="px-4 py-3">
                    <p className="font-medium text-ink">{u.name}</p>
                    <p className="text-xs text-ink-soft">{u.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Select
                      name={`role-${u._id}`}
                      value={u.role}
                      onChange={(e) => setRole.mutate({ id: u._id, role: e.target.value })}
                      className="!w-32"
                      aria-label={`Role for ${u.name}`}
                    >
                      <option value="customer">customer</option>
                      <option value="admin">admin</option>
                    </Select>
                  </td>
                  <td className="px-4 py-3">{u.isActive ? <Badge color="green">active</Badge> : <Badge color="red">disabled</Badge>}</td>
                  <td className="px-4 py-3 text-xs text-ink-soft">{formatDate(u.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant={u.isActive ? 'ghost' : 'secondary'}
                      size="sm"
                      loading={setStatus.isPending}
                      onClick={() => setStatus.mutate({ id: u._id, isActive: !u.isActive })}
                      className={u.isActive ? 'hover:!bg-danger/10 hover:!text-danger' : ''}
                    >
                      {u.isActive ? (
                        <>
                          <ShieldOff className="h-4 w-4" aria-hidden="true" /> Disable
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Enable
                        </>
                      )}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-ink-soft">Role changes to your own account are rejected by the API.</p>
    </div>
  );
}

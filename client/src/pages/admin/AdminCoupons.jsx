import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { TicketPercent, Trash2 } from 'lucide-react';
import { adminApi } from '../../lib/api/endpoints';
import { Badge, Button, Drawer, EmptyState, ErrorState, Input, Pagination, Select, Skeleton } from '../../components/ui';
import { formatDate, formatINR } from '../../lib/api/client';

const th = 'px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-ink-soft';

const EMPTY_COUPON = {
  code: '',
  type: 'percentage',
  value: '',
  minOrderValue: 0,
  expiresAt: '',
  usageLimit: '',
  usageLimitPerUser: 1,
  isActive: true,
};

export default function AdminCoupons() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null); // null | 'new' | coupon
  const [form, setForm] = useState(EMPTY_COUPON);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'coupons'],
    queryFn: () => adminApi.coupons(),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'coupons'] });

  const save = useMutation({
    mutationFn: () => {
      const body = {
        code: form.code,
        type: form.type,
        value: Number(form.value),
        minOrderValue: Number(form.minOrderValue || 0),
        expiresAt: new Date(form.expiresAt).toISOString(),
        usageLimit: form.usageLimit === '' ? null : Number(form.usageLimit),
        usageLimitPerUser: Number(form.usageLimitPerUser || 1),
        isActive: form.isActive,
      };
      return editing._id ? adminApi.updateCoupon(editing._id, body) : adminApi.createCoupon(body);
    },
    onSuccess: () => {
      toast.success(editing._id ? 'Coupon updated' : 'Coupon created');
      setEditing(null);
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Save failed'),
  });

  const toggleActive = useMutation({
    mutationFn: (coupon) => adminApi.updateCoupon(coupon._id, { isActive: !coupon.isActive }),
    onSuccess: () => {
      toast.success('Updated');
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed'),
  });

  const remove = useMutation({
    mutationFn: (id) => adminApi.deleteCoupon(id),
    onSuccess: () => {
      toast.success('Coupon deleted');
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed'),
  });

  const openNew = () => {
    setEditing('new');
    setForm(EMPTY_COUPON);
  };

  const openEdit = (coupon) => {
    setEditing(coupon);
    setForm({
      code: coupon.code,
      type: coupon.type,
      value: String(coupon.value),
      minOrderValue: coupon.minOrderValue,
      expiresAt: new Date(coupon.expiresAt).toISOString().slice(0, 10),
      usageLimit: coupon.usageLimit === null ? '' : String(coupon.usageLimit),
      usageLimitPerUser: coupon.usageLimitPerUser,
      isActive: coupon.isActive,
    });
  };

  if (error) return <ErrorState onRetry={refetch} />;
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-card" />
        ))}
      </div>
    );
  }

  const coupons = data?.data ?? [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="eyebrow">Promotions</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">Coupons</h1>
        </div>
        <Button onClick={openNew}>
          <TicketPercent className="h-4 w-4" aria-hidden="true" /> New coupon
        </Button>
      </div>

      {coupons.length === 0 ? (
        <EmptyState
          title="No coupons"
          description="Create a coupon customers can apply at checkout."
          action={<Button onClick={openNew}>New coupon</Button>}
        />
      ) : (
        <div className="overflow-x-auto rounded-card border border-line bg-surface">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="border-b border-line bg-canvas">
              <tr>
                <th className={th}>Code</th>
                <th className={th}>Discount</th>
                <th className={th}>Min order</th>
                <th className={th}>Usage</th>
                <th className={th}>Expires</th>
                <th className={th}>Status</th>
                <th className={`${th} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => (
                <tr key={c._id} className="border-t border-line transition-colors hover:bg-canvas/60">
                  <td className="px-4 py-3 font-mono font-semibold text-accent">{c.code}</td>
                  <td className="px-4 py-3">{c.type === 'percentage' ? `${c.value}%` : formatINR(c.value)}</td>
                  <td className="px-4 py-3">{c.minOrderValue > 0 ? formatINR(c.minOrderValue) : '—'}</td>
                  <td className="px-4 py-3 text-xs text-ink-soft">
                    {c.timesUsed}
                    {c.usageLimit !== null ? ` / ${c.usageLimit}` : ''} · {c.usageLimitPerUser}/user
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-soft">{formatDate(c.expiresAt)}</td>
                  <td className="px-4 py-3">{c.isActive ? <Badge color="green">active</Badge> : <Badge color="gray">inactive</Badge>}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => toggleActive.mutate(c)}>
                        {c.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => openEdit(c)}>
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => remove.mutate(c._id)}
                        aria-label={`Delete coupon ${c.code}`}
                        className="hover:!bg-danger/10 hover:!text-danger"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data?.pagination && <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onChange={() => {}} />}

      <Drawer open={editing !== null} onClose={() => setEditing(null)} title={editing === 'new' ? 'New coupon' : `Edit ${form.code}`}>
        {editing && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
            className="space-y-4"
          >
            <Input
              label="Code"
              name="code"
              required
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              disabled={editing !== 'new'}
            />
            <div className="grid grid-cols-2 gap-3">
              <Select label="Type" name="type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed amount (₹)</option>
              </Select>
              <Input
                label={form.type === 'percentage' ? 'Value (%)' : 'Value (₹)'}
                name="value"
                type="number"
                min={0}
                required
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Input label="Min order (₹)" name="minOrderValue" type="number" min={0} value={form.minOrderValue} onChange={(e) => setForm({ ...form, minOrderValue: e.target.value })} />
              <Input label="Total limit (blank = ∞)" name="usageLimit" type="number" min={1} value={form.usageLimit} onChange={(e) => setForm({ ...form, usageLimit: e.target.value })} />
              <Input label="Per-user limit" name="usageLimitPerUser" type="number" min={1} value={form.usageLimitPerUser} onChange={(e) => setForm({ ...form, usageLimitPerUser: e.target.value })} />
            </div>
            <Input label="Expires on" name="expiresAt" type="date" required value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
            <label className="flex items-center gap-2 text-sm text-ink-soft">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="h-4 w-4 rounded border-line"
              />
              Active
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" loading={save.isPending}>
                {editing === 'new' ? 'Create coupon' : 'Save changes'}
              </Button>
            </div>
          </form>
        )}
      </Drawer>
    </div>
  );
}

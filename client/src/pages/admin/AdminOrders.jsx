import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../lib/api/endpoints';
import { Badge, ErrorState, Input, Pagination, Select, Skeleton, ORDER_STATUS_COLORS } from '../../components/ui';
import { formatINR, formatDateTime } from '../../lib/api/client';
import { useDebouncedValue } from '../../hooks/useCart';

const STATUSES = ['PENDING_PAYMENT', 'PAYMENT_CONFIRMED', 'PAYMENT_FAILED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURN_REQUESTED', 'REFUNDED'];
const th = 'px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-ink-soft';

export default function AdminOrders() {
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get('status') || '';
  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';
  const searchInput = searchParams.get('search') || '';
  const page = Number(searchParams.get('page') || 1);

  const [searchBox, setSearchBox] = useState('');
  const search = useDebouncedValue(searchBox, 350);

  const setParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setSearchParams(next);
  };

  // Push the debounced search into the URL.
  const [lastDebounced, setLastDebounced] = useState(search);
  if (search !== lastDebounced) {
    setLastDebounced(search);
    setParam('search', search);
  }

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'orders', { status, from, to, searchInput, page }],
    queryFn: () => adminApi.orders({ status: status || undefined, from: from || undefined, to: to || undefined, search: searchInput || undefined, page }),
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

  const orders = data?.data ?? [];

  return (
    <div>
      <div className="mb-6">
        <p className="eyebrow">Fulfilment</p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">Orders</h1>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <Input
          name="search"
          placeholder="Search order # or customer…"
          value={searchBox}
          onChange={(e) => setSearchBox(e.target.value)}
          className="!w-64"
          aria-label="Search orders"
        />
        <Select name="status" value={status} onChange={(e) => setParam('status', e.target.value)} className="!w-44" aria-label="Status filter">
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replaceAll('_', ' ').toLowerCase()}
            </option>
          ))}
        </Select>
        <Input name="from" type="date" defaultValue={from} onBlur={(e) => setParam('from', e.target.value)} className="!w-40" aria-label="From date" />
        <Input name="to" type="date" defaultValue={to} onBlur={(e) => setParam('to', e.target.value)} className="!w-40" aria-label="To date" />
      </div>

      {orders.length === 0 ? (
        <p className="rounded-card border border-dashed border-line bg-canvas p-10 text-center text-sm text-ink-soft">No orders match these filters.</p>
      ) : (
        <div className="overflow-x-auto rounded-card border border-line bg-surface">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-line bg-canvas">
              <tr>
                <th className={th}>Order</th>
                <th className={th}>Customer</th>
                <th className={th}>Date</th>
                <th className={th}>Items</th>
                <th className={th}>Total</th>
                <th className={th}>Payment</th>
                <th className={th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o._id} className="border-t border-line transition-colors hover:bg-canvas/60">
                  <td className="px-4 py-3">
                    <Link to={`/admin/orders/${o._id}`} className="font-mono text-sm font-medium text-accent hover:underline">
                      {o.orderNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink">{typeof o.user === 'object' ? o.user.name : '—'}</td>
                  <td className="px-4 py-3 text-xs text-ink-soft">{formatDateTime(o.createdAt)}</td>
                  <td className="px-4 py-3">{o.items.reduce((s, i) => s + i.quantity, 0)}</td>
                  <td className="px-4 py-3 font-display font-semibold">{formatINR(o.pricing.total)}</td>
                  <td className="px-4 py-3">
                    <Badge color={o.paymentStatus === 'PAID' ? 'green' : o.paymentStatus === 'REFUNDED' ? 'gray' : o.paymentStatus === 'FAILED' ? 'red' : 'yellow'}>
                      {o.paymentStatus}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={ORDER_STATUS_COLORS[o.status]}>{o.status.replaceAll('_', ' ')}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data?.pagination && <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onChange={(p) => setParam('page', String(p))} />}
    </div>
  );
}

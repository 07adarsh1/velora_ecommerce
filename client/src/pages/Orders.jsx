import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Package } from 'lucide-react';
import { orderApi } from '../lib/api/endpoints';
import { Badge, Button, EmptyState, ErrorState, Pagination, Select, Skeleton, ORDER_STATUS_COLORS } from '../components/ui';
import { formatINR, formatDateTime } from '../lib/api/client';
import { cimg } from '../lib/utils/image';

const STATUSES = [
  'PENDING_PAYMENT',
  'PAYMENT_CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'RETURN_REQUESTED',
  'REFUNDED',
  'PAYMENT_FAILED',
];

export default function Orders() {
  const [searchParams, setSearchParams] = useSearchParams();
  const status = searchParams.get('status') || '';
  const page = Number(searchParams.get('page') || 1);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['orders', status, page],
    queryFn: () => orderApi.mine({ status: status || undefined, page }),
  });

  const setParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setSearchParams(next);
  };

  if (error) return <ErrorState onRetry={refetch} />;
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-card" />
        <Skeleton className="h-24 w-full rounded-card" />
        <Skeleton className="h-24 w-full rounded-card" />
      </div>
    );
  }

  const orders = data?.data ?? [];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Where things stand</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">Your orders</h1>
        </div>
        <Select name="status" value={status} onChange={(e) => setParam('status', e.target.value)} className="!w-48" aria-label="Filter by status">
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replaceAll('_', ' ').toLowerCase()}
            </option>
          ))}
        </Select>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No orders yet"
          description="When you place an order it will show up here with live status."
          action={
            <Link to="/products">
              <Button>Start shopping</Button>
            </Link>
          }
        />
      ) : (
        <ul className="space-y-4">
          {orders.map((order) => (
            <li key={order._id} className="rounded-card border border-line bg-surface p-5 transition-shadow hover:shadow-[0_8px_24px_rgba(28,27,26,0.06)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link to={`/orders/${order._id}`} className="font-mono text-sm font-medium text-accent hover:underline">
                    {order.orderNumber}
                  </Link>
                  <p className="mt-0.5 text-xs text-ink-soft">{formatDateTime(order.createdAt)}</p>
                </div>
                <Badge color={ORDER_STATUS_COLORS[order.status]}>{order.status.replaceAll('_', ' ')}</Badge>
              </div>

              <div className="mt-4 flex items-center justify-between gap-4">
                <div className="flex items-center">
                  <div className="flex -space-x-3">
                    {order.items.slice(0, 3).map((item, i) => (
                      <span key={i} className="block h-11 w-11 overflow-hidden rounded-card border-2 border-surface bg-line/40">
                        {item.image && <img src={cimg(item.image, { w: 120 })} alt="" className="h-full w-full object-cover" />}
                      </span>
                    ))}
                  </div>
                  <p className="ml-3 text-sm text-ink-soft">
                    {order.items.reduce((s, i) => s + i.quantity, 0)} item(s)
                    <span className="hidden sm:inline"> · {order.items[0]?.name}
                      {order.items.length > 1 ? ` +${order.items.length - 1} more` : ''}</span>
                  </p>
                </div>
                <p className="font-display text-lg font-semibold">{formatINR(order.pricing.total)}</p>
              </div>

              <div className="mt-4">
                <Link to={`/orders/${order._id}`}>
                  <Button variant="secondary" size="sm">
                    View details <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      {data?.pagination && (
        <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onChange={(p) => setParam('page', String(p))} />
      )}
    </div>
  );
}

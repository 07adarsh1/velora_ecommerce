import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../lib/api/endpoints';
import { Badge, ErrorState, Skeleton } from '../../components/ui';
import { formatINR, formatDate } from '../../lib/api/client';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid } from 'recharts';

// Warm-token chart styling shared by every recharts surface.
const AXIS = { stroke: '#E8E5E0', tick: { fill: '#6E6A65', fontSize: 12 } };
const TOOLTIP = {
  contentStyle: {
    background: '#FFFFFF',
    border: '1px solid #E8E5E0',
    borderRadius: 10,
    boxShadow: '0 8px 24px rgba(28,27,26,0.10)',
    fontSize: 13,
  },
};

function StatCard({ label, value, hint, tone = 'ink' }) {
  const tones = { ink: 'text-ink', good: 'text-success', warn: 'text-warn', bad: 'text-danger' };
  return (
    <div className="flex min-h-[104px] flex-col justify-between rounded-card border border-line bg-surface p-5">
      <p className="eyebrow">{label}</p>
      <div>
        <p className={`font-display text-3xl font-semibold tracking-tight ${tones[tone]}`}>{value}</p>
        {hint && <p className="mt-1 text-xs text-ink-soft">{hint}</p>}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { data: summary, isLoading, error, refetch } = useQuery({
    queryKey: ['analytics', 'summary'],
    queryFn: () => adminApi.analyticsSummary().then((r) => r.data),
  });

  const { data: trend } = useQuery({
    queryKey: ['analytics', 'trend'],
    queryFn: () => adminApi.salesTrend().then((r) => r.data),
  });

  const { data: topProducts } = useQuery({
    queryKey: ['analytics', 'top'],
    queryFn: () => adminApi.topProducts().then((r) => r.data),
  });

  const { data: byCategory } = useQuery({
    queryKey: ['analytics', 'category'],
    queryFn: () => adminApi.revenueByCategory().then((r) => r.data),
  });

  if (error) return <ErrorState onRetry={refetch} />;
  if (isLoading || !summary) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-[104px] w-full rounded-card" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow">Overview</p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">Dashboard</h1>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total revenue" value={formatINR(summary.totalRevenue)} hint={`${summary.paidOrders} paid orders`} tone="good" />
        <StatCard label="Total orders" value={summary.totalOrders} />
        <StatCard label="Customers" value={summary.totalCustomers} />
        <StatCard label="Products" value={summary.totalProducts} />
        <StatCard label="Pending orders" value={summary.pendingOrders} tone={summary.pendingOrders > 0 ? 'warn' : 'ink'} />
        <StatCard label="Processing" value={summary.processingOrders} />
        <StatCard label="Delivered" value={summary.deliveredOrders} tone="good" />
        <StatCard
          label="Low stock"
          value={summary.lowStockCount}
          hint={`below ${summary.lowStockThreshold} units`}
          tone={summary.lowStockCount > 0 ? 'bad' : 'good'}
        />
      </div>

      <section className="rounded-card border border-line bg-surface p-5" aria-label="Sales trend">
        <h2 className="mb-4 font-display text-lg font-semibold">Revenue — last 30 days</h2>
        {trend && trend.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trend.map((d) => ({ ...d, date: formatDate(d.date) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8E5E0" />
              <XAxis dataKey="date" tick={AXIS.tick} tickLine={{ stroke: '#E8E5E0' }} axisLine={{ stroke: '#E8E5E0' }} />
              <YAxis tick={AXIS.tick} tickLine={{ stroke: '#E8E5E0' }} axisLine={{ stroke: '#E8E5E0' }} />
              <Tooltip formatter={(value) => formatINR(value)} {...TOOLTIP} />
              <Line type="monotone" dataKey="revenue" stroke="#0F5C4C" strokeWidth={2} dot={false} activeDot={{ fill: '#0F5C4C' }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-10 text-center text-sm text-ink-soft">No paid orders in this range yet.</p>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-card border border-line bg-surface p-5" aria-label="Top products">
          <h2 className="mb-4 font-display text-lg font-semibold">Top products (units sold)</h2>
          {topProducts && topProducts.length > 0 ? (
            <ul className="space-y-2.5">
              {topProducts.map((p, i) => (
                <li key={p._id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent">
                      {i + 1}
                    </span>
                    <span className="truncate text-ink">{p.name}</span>
                  </span>
                  <span className="shrink-0 text-ink-soft">
                    {p.unitsSold} sold · {formatINR(p.revenue)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-sm text-ink-soft">No sales data yet.</p>
          )}
        </section>

        <section className="rounded-card border border-line bg-surface p-5" aria-label="Revenue by category">
          <h2 className="mb-4 font-display text-lg font-semibold">Revenue by category</h2>
          {byCategory && byCategory.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={byCategory} layout="vertical" margin={{ left: 20 }}>
                <XAxis type="number" tick={AXIS.tick} tickLine={{ stroke: '#E8E5E0' }} axisLine={{ stroke: '#E8E5E0' }} />
                <YAxis type="category" dataKey="category" tick={{ ...AXIS.tick, fontSize: 11 }} width={92} tickLine={{ stroke: '#E8E5E0' }} axisLine={{ stroke: '#E8E5E0' }} />
                <Tooltip formatter={(value) => formatINR(value)} {...TOOLTIP} cursor={{ fill: '#FAF9F7' }} />
                <Bar dataKey="revenue" fill="#B08D57" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-8 text-center text-sm text-ink-soft">No sales data yet.</p>
          )}
        </section>
      </div>

      {summary.failedPayments > 0 && (
        <p className="text-sm">
          <Badge color="red">{summary.failedPayments} failed payments</Badge>{' '}
          <span className="text-ink-soft">— visible in Orders with the PAYMENT FAILED filter.</span>
        </p>
      )}
    </div>
  );
}

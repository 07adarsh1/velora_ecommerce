import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { History } from 'lucide-react';
import { adminApi } from '../../lib/api/endpoints';
import { Badge, Button, ErrorState, Modal, Pagination, Skeleton } from '../../components/ui';
import { formatDateTime } from '../../lib/api/client';
import { cimg } from '../../lib/utils/image';

const th = 'px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-ink-soft';

function HistoryModal({ productId, name, onClose }) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'inventory-history', productId],
    queryFn: () => adminApi.inventoryHistory(productId),
    enabled: Boolean(productId),
  });

  const entries = data?.data ?? [];

  return (
    <Modal open onClose={onClose} title={`Inventory history — ${name}`} wide>
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : entries.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-soft">No stock movements recorded yet.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-[11px] uppercase tracking-wider text-ink-soft">
            <tr>
              <th className="py-2">When</th>
              <th className="py-2">Change</th>
              <th className="py-2">Reason</th>
              <th className="py-2">Variant</th>
              <th className="py-2 text-right">Stock after</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e._id || e.createdAt} className="border-t border-line">
                <td className="py-2 text-xs text-ink-soft">{formatDateTime(e.createdAt)}</td>
                <td className={`py-2 font-semibold tabular-nums ${e.change > 0 ? 'text-success' : 'text-danger'}`}>
                  {e.change > 0 ? `+${e.change}` : e.change}
                </td>
                <td className="py-2">
                  <Badge color={e.reason === 'order' ? 'blue' : e.reason === 'manual_adjustment' ? 'yellow' : 'gray'}>{e.reason}</Badge>
                </td>
                <td className="py-2 font-mono text-xs text-ink-soft">{e.variantSku || '—'}</td>
                <td className="py-2 text-right tabular-nums">{e.stockAfter}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Modal>
  );
}

export default function AdminInventory() {
  const [filter, setFilter] = useState(''); // '' | 'low' | 'out'
  const [page, setPage] = useState(1);
  const [historyFor, setHistoryFor] = useState(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'inventory', filter, page],
    queryFn: () =>
      adminApi.inventory({
        lowStock: filter === 'low' || undefined,
        outOfStock: filter === 'out' || undefined,
        page,
      }),
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

  const items = data?.data ?? [];
  const threshold = data?.message?.match(/\d+/)?.[0];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Stock levels</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">Inventory</h1>
        </div>
        <div className="flex gap-2">
          {[
            ['', 'All'],
            ['low', `Low stock${threshold ? ` (≤ ${threshold})` : ''}`],
            ['out', 'Out of stock'],
          ].map(([value, label]) => (
            <Button
              key={value}
              variant={filter === value ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => {
                setFilter(value);
                setPage(1);
              }}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <p className="rounded-card border border-dashed border-line bg-canvas p-10 text-center text-sm text-ink-soft">Nothing matches this filter.</p>
      ) : (
        <div className="overflow-x-auto rounded-card border border-line bg-surface">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-line bg-canvas">
              <tr>
                <th className={th}>Product</th>
                <th className={th}>Effective stock</th>
                <th className={th}>Variants</th>
                <th className={`${th} text-right`}>History</th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p._id} className="border-t border-line transition-colors hover:bg-canvas/60">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="h-10 w-10 shrink-0 overflow-hidden rounded-input bg-line/40">
                        {p.images?.[0] && <img src={cimg(p.images[0], { w: 120 })} alt="" loading="lazy" className="h-full w-full object-cover" />}
                      </span>
                      <p className="font-medium text-ink">{p.name}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        p.effectiveStock === 0
                          ? 'font-semibold text-danger'
                          : p.effectiveStock <= (threshold ? Number(threshold) : 5)
                            ? 'font-semibold text-warn'
                            : ''
                      }
                    >
                      {p.effectiveStock}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-soft">
                    {p.variants?.length > 0 ? p.variants.map((v) => `${v.sku}: ${v.stock}`).join(', ') : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => setHistoryFor(p)}>
                      <History className="h-4 w-4" aria-hidden="true" /> View log
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data?.pagination && <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onChange={setPage} />}

      {historyFor && <HistoryModal productId={historyFor._id} name={historyFor.name} onClose={() => setHistoryFor(null)} />}
    </div>
  );
}

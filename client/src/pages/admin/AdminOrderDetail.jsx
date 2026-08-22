import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { adminApi, orderApi, ORDER_TRANSITIONS } from '../../lib/api/endpoints';
import { Badge, Button, ErrorState, Input, Modal, Skeleton, ORDER_STATUS_COLORS } from '../../components/ui';
import { formatINR, formatDate, formatDateTime } from '../../lib/api/client';
import { cimg } from '../../lib/utils/image';

// Actions the admin can take — composed here so the UI only ever offers
// legal next steps (the API still enforces them).
function nextActions(order) {
  const actions = [];
  const allowed = ORDER_TRANSITIONS[order.status] || [];
  if (allowed.includes('PROCESSING')) actions.push({ label: 'Start processing', run: (api) => api.updateOrderStatus(order._id, 'PROCESSING') });
  if (order.status === 'PROCESSING') actions.push({ label: 'Add shipment & ship', kind: 'ship' });
  if (allowed.includes('CANCELLED')) actions.push({ label: 'Cancel order', kind: 'cancel' });
  if (order.status === 'RETURN_REQUESTED') {
    actions.push({ label: 'Approve return & refund', run: (api) => api.approveReturn(order._id) });
    actions.push({ label: 'Reject return', kind: 'rejectReturn' });
  }
  return actions;
}

export default function AdminOrderDetail() {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [shipOpen, setShipOpen] = useState(false);
  const [shipment, setShipment] = useState({ carrier: '', trackingNumber: '' });
  const [noteModal, setNoteModal] = useState(null); // 'cancel' | 'rejectReturn'
  const [note, setNote] = useState('');

  // Admins can view any order; orderApi.byId allows owner-or-admin.
  const orderQuery = useQuery({
    queryKey: ['order', id, 'admin'],
    queryFn: () => orderApi.byId(id),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['order', id] });
    queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
  };

  const runAction = useMutation({
    mutationFn: async (action) => {
      if (action.kind === 'ship') return adminApi.updateShipment(id, shipment);
      if (action.kind === 'cancel') return adminApi.updateOrderStatus(id, 'CANCELLED', note || 'Cancelled by admin');
      if (action.kind === 'rejectReturn') return adminApi.rejectReturn(id, note || undefined);
      return action.run(adminApi);
    },
    onSuccess: (_res, action) => {
      toast.success(action.successMessage || 'Done');
      setShipOpen(false);
      setNoteModal(null);
      setNote('');
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Action failed'),
  });

  if (orderQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-16 w-full rounded-card" />
        <Skeleton className="h-48 w-full rounded-card" />
        <Skeleton className="h-64 w-full rounded-card" />
      </div>
    );
  }
  if (orderQuery.error) return <ErrorState onRetry={orderQuery.refetch} />;

  const order = orderQuery.data?.data;
  if (!order) return <ErrorState message="Order not found" />;

  const actions = nextActions(order);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/admin/orders" className="text-sm text-ink-soft hover:text-accent">
            ← All orders
          </Link>
          <h1 className="mt-1 font-mono text-2xl font-bold tracking-tight">{order.orderNumber}</h1>
          <p className="mt-0.5 text-sm text-ink-soft">
            {typeof order.user === 'object' ? order.user.name : ''} · {formatDateTime(order.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge color={ORDER_STATUS_COLORS[order.status]}>{order.status.replaceAll('_', ' ')}</Badge>
          <Badge color={order.paymentStatus === 'PAID' ? 'green' : 'gray'}>{order.paymentStatus}</Badge>
        </div>
      </div>

      {actions.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-card border border-line bg-surface p-4">
          <span className="eyebrow mr-1">Actions</span>
          {actions.map((action) => (
            <Button
              key={action.label}
              size="sm"
              variant={action.label.includes('Cancel') || action.label.includes('Reject') ? 'danger' : 'primary'}
              loading={runAction.isPending}
              onClick={() => {
                if (action.kind === 'ship') return setShipOpen(true);
                if (action.kind === 'cancel' || action.kind === 'rejectReturn') return setNoteModal(action.kind);
                runAction.mutate(action);
              }}
            >
              {action.label}
            </Button>
          ))}
          <span className="ml-auto hidden text-xs text-ink-soft/70 sm:block">Only legal transitions for this state are offered.</span>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-card border border-line bg-surface p-5">
          <h2 className="mb-3 font-display text-lg font-semibold">Items</h2>
          <ul className="divide-y divide-line">
            {order.items.map((item, i) => (
              <li key={i} className="flex items-center gap-3 py-3">
                <span className="block h-12 w-12 shrink-0 overflow-hidden rounded-input bg-line/40">
                  {item.image && <img src={cimg(item.image, { w: 120 })} alt="" loading="lazy" className="h-full w-full object-cover" />}
                </span>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="truncate font-medium">{item.name}</p>
                  <p className="text-xs text-ink-soft">
                    {item.variantSku ? `${item.variantSku} · ` : ''}Qty {item.quantity} × {formatINR(item.unitPrice)}
                  </p>
                </div>
                <p className="font-display text-sm font-semibold">{formatINR(item.unitPrice * item.quantity)}</p>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
            <span className="text-sm font-medium">Total (incl. discounts, shipping, tax)</span>
            <span className="font-display text-lg font-semibold">{formatINR(order.pricing.total)}</span>
          </div>
          {order.coupon && (
            <p className="mt-1 text-xs text-success">
              Coupon {order.coupon.code} saved {formatINR(order.coupon.discountApplied)}
            </p>
          )}
        </section>

        <div className="space-y-6">
          <section className="rounded-card border border-line bg-surface p-5">
            <h2 className="mb-2 font-display text-lg font-semibold">Shipping</h2>
            <address className="text-sm not-italic leading-relaxed text-ink-soft">
              {order.shippingAddress.fullName}
              <br />
              {order.shippingAddress.line1}
              {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ''}
              <br />
              {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}
              <br />
              {order.shippingAddress.phone}
            </address>
            {order.shipment?.trackingNumber && (
              <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink-soft">
                {order.shipment.carrier} · <span className="rounded-full bg-canvas px-2.5 py-0.5 font-mono text-xs">{order.shipment.trackingNumber}</span>
                {order.shipment.shippedAt && <span className="text-ink-soft/70">(shipped {formatDate(order.shipment.shippedAt)})</span>}
              </p>
            )}
          </section>

          <section className="rounded-card border border-line bg-surface p-5">
            <h2 className="mb-4 font-display text-lg font-semibold">Timeline</h2>
            <ol className="relative space-y-5 border-l-2 border-line pl-5">
              {[...order.timeline].reverse().map((t, i) => (
                <li key={i} className="relative">
                  <span
                    className={`absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-surface ${i === 0 ? 'bg-accent' : 'bg-ink-soft/40'}`}
                    aria-hidden="true"
                  />
                  <p className="text-sm font-medium text-ink">{t.status.replaceAll('_', ' ')}</p>
                  {t.note && <p className="text-sm text-ink-soft">{t.note}</p>}
                  <p className="mt-0.5 text-xs text-ink-soft/70">{formatDateTime(t.at)}</p>
                </li>
              ))}
            </ol>
            {order.returnRequest && (
              <div className="mt-4 rounded-input bg-warn/10 p-3 text-sm">
                <p className="font-medium text-warn">Return request ({order.returnRequest.status})</p>
                <p className="text-ink-soft">{order.returnRequest.reason}</p>
              </div>
            )}
          </section>
        </div>
      </div>

      <Modal open={shipOpen} onClose={() => setShipOpen(false)} title="Ship this order">
        <div className="space-y-3">
          <Input label="Carrier" name="carrier" required value={shipment.carrier} onChange={(e) => setShipment({ ...shipment, carrier: e.target.value })} />
          <Input
            label="Tracking number"
            name="trackingNumber"
            required
            value={shipment.trackingNumber}
            onChange={(e) => setShipment({ ...shipment, trackingNumber: e.target.value })}
          />
          <p className="text-xs text-ink-soft">Saving shipment info moves the order to SHIPPED.</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShipOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={runAction.isPending}
              disabled={!shipment.carrier || !shipment.trackingNumber}
              onClick={() => runAction.mutate({ kind: 'ship' })}
            >
              Ship order
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={noteModal !== null}
        onClose={() => setNoteModal(null)}
        title={noteModal === 'cancel' ? 'Cancel this order?' : 'Reject this return?'}
      >
        <div className="space-y-3">
          <p className="text-sm text-ink-soft">
            {noteModal === 'cancel'
              ? 'Stock will be restored automatically if the order was paid.'
              : 'The order will return to DELIVERED.'}
          </p>
          <Input label="Note" name="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason (optional)" />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setNoteModal(null)}>
              Back
            </Button>
            <Button variant="danger" loading={runAction.isPending} onClick={() => runAction.mutate({ kind: noteModal })}>
              {noteModal === 'cancel' ? 'Cancel order' : 'Reject return'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

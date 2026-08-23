import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Check, RotateCcw, Truck, XCircle } from 'lucide-react';
import { orderApi, paymentApi } from '../lib/api/endpoints';
import { Badge, Button, ErrorState, Input, Modal, Skeleton, ORDER_STATUS_COLORS } from '../components/ui';
import { formatINR, formatDate, formatDateTime } from '../lib/api/client';
import { cimg } from '../lib/utils/image';

const TRACKER_STEPS = [
  { status: 'PENDING_PAYMENT', label: 'Placed' },
  { status: 'PAYMENT_CONFIRMED', label: 'Confirmed' },
  { status: 'PROCESSING', label: 'Processing' },
  { status: 'SHIPPED', label: 'Shipped' },
  { status: 'DELIVERED', label: 'Delivered' },
];

/** Horizontal progress rail — done/current/future states. */
function ProgressRail({ order }) {
  const currentIndex = TRACKER_STEPS.findIndex((s) => s.status === order.status);
  const linear = currentIndex !== -1; // terminal states (cancelled etc.) drop off the rail

  return (
    <ol className="flex items-start gap-1 text-xs" aria-label="Order progress">
      {TRACKER_STEPS.map((step, i) => {
        const reached = linear && i <= currentIndex;
        const current = linear && i === currentIndex;
        return (
          <li key={step.status} className="flex flex-1 flex-col items-center gap-1.5">
            <div className="flex w-full items-center" aria-hidden="true">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                  reached ? 'border-accent bg-accent text-white' : 'border-line bg-surface text-ink-soft/50'
                } ${current ? 'animate-pulse ring-4 ring-accent/20' : ''}`}
              >
                {reached && !current ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              {i < TRACKER_STEPS.length - 1 && (
                <span className={`h-0.5 flex-1 ${linear && i < currentIndex ? 'bg-accent' : 'bg-line'}`} />
              )}
            </div>
            <span className={`text-center ${reached ? 'font-medium text-ink' : 'text-ink-soft/60'}`}>{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

export default function OrderDetail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const justPaid = searchParams.get('paid') === '1';
  const queryClient = useQueryClient();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnReason, setReturnReason] = useState('');
  const [retrying, setRetrying] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['order', id],
    queryFn: () => orderApi.byId(id),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['order', id] });
    queryClient.invalidateQueries({ queryKey: ['orders'] });
    queryClient.invalidateQueries({ queryKey: ['cart'] });
  };

  const cancel = useMutation({
    mutationFn: () => orderApi.cancel(id, cancelReason || undefined),
    onSuccess: () => {
      toast.success('Order cancelled');
      setCancelOpen(false);
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not cancel'),
  });

  const requestReturn = useMutation({
    mutationFn: () => orderApi.requestReturn(id, returnReason),
    onSuccess: () => {
      toast.success('Return requested');
      setReturnOpen(false);
      invalidate();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not request return'),
  });

  // Re-pay a PENDING_PAYMENT order (same flow as checkout, mock or Razorpay).
  const retryPayment = async () => {
    setRetrying(true);
    try {
      const intentRes = await paymentApi.createOrder(id);
      const intent = intentRes.data;
      if (intent.gateway === 'mock') {
        const paid = await paymentApi.mockPay(intent.gatewayOrderId, true);
        await paymentApi.verify({
          orderId: id,
          gatewayOrderId: intent.gatewayOrderId,
          gatewayPaymentId: paid.data.gatewayPaymentId,
          signature: paid.data.signature,
        });
      } else {
        await new Promise((resolve, reject) => {
          const rzp = new window.Razorpay({
            key: intent.keyId,
            amount: intent.amount,
            currency: intent.currency,
            name: 'Velora',
            order_id: intent.gatewayOrderId,
            handler: async (response) => {
              try {
                await paymentApi.verify({
                  orderId: id,
                  gatewayOrderId: response.razorpay_order_id,
                  gatewayPaymentId: response.razorpay_payment_id,
                  signature: response.razorpay_signature,
                });
                resolve();
              } catch (err) {
                reject(err);
              }
            },
            modal: { ondismiss: () => reject(new Error('Payment cancelled')) },
          });
          rzp.open();
        });
      }
      toast.success('Payment confirmed');
      invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setRetrying(false);
    }
  };

  if (error) return <ErrorState onRetry={refetch} message={error instanceof Error ? error.message : undefined} />;
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-12 w-full rounded-card" />
        <Skeleton className="h-40 w-full rounded-card" />
        <Skeleton className="h-64 w-full rounded-card" />
      </div>
    );
  }

  const order = data?.data;
  if (!order) return <ErrorState message="Order not found" />;

  const cancellable = ['PENDING_PAYMENT', 'PAYMENT_CONFIRMED', 'PROCESSING'].includes(order.status);
  const returnable = order.status === 'DELIVERED';
  const canRetry = ['PENDING_PAYMENT', 'PAYMENT_FAILED'].includes(order.status);

  const banner =
    order.status === 'CANCELLED'
      ? { tone: 'border-danger/30 bg-danger/10 text-danger', icon: XCircle, text: order.cancelReason ? `Cancelled — ${order.cancelReason}` : 'Order cancelled' }
      : order.status === 'PAYMENT_FAILED'
        ? { tone: 'border-danger/30 bg-danger/10 text-danger', icon: XCircle, text: 'Payment failed — you can retry below' }
        : order.status === 'REFUNDED'
          ? { tone: 'border-line bg-canvas text-ink-soft', icon: RotateCcw, text: 'Refunded' }
          : null;

  const BannerIcon = banner?.icon;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/orders" className="text-sm text-ink-soft hover:text-accent">
            ← All orders
          </Link>
          <h1 className="mt-1 font-mono text-2xl font-bold tracking-tight">{order.orderNumber}</h1>
          <p className="mt-0.5 text-sm text-ink-soft">Placed {formatDateTime(order.createdAt)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge color={ORDER_STATUS_COLORS[order.status]}>{order.status.replaceAll('_', ' ')}</Badge>
          <Badge color={order.paymentStatus === 'PAID' ? 'green' : order.paymentStatus === 'REFUNDED' ? 'gray' : 'yellow'}>
            {order.paymentStatus}
          </Badge>
        </div>
      </div>

      {justPaid && (
        <div className="flex items-center gap-3 rounded-card border border-success/30 bg-success/10 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-success/20 text-success">
            <Check className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="font-display text-base font-semibold text-ink">Order confirmed</p>
            <p className="text-sm text-ink-soft">Your payment was verified — we're getting this ready.</p>
          </div>
        </div>
      )}

      {banner && BannerIcon && (
        <div className={`flex items-center gap-3 rounded-card border p-4 text-sm font-medium ${banner.tone}`} role="status">
          <BannerIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
          {banner.text}
        </div>
      )}

      <div className="rounded-card border border-line bg-surface p-6">
        <ProgressRail order={order} />
        {order.shipment?.trackingNumber && (
          <p className="mt-5 flex items-center gap-2 text-sm text-ink-soft">
            <Truck className="h-4 w-4 text-accent" aria-hidden="true" />
            {order.shipment.carrier} · tracking <span className="rounded-full bg-canvas px-2.5 py-0.5 font-mono text-xs">{order.shipment.trackingNumber}</span>
            {order.shipment.shippedAt && <span className="text-ink-soft/70">· shipped {formatDate(order.shipment.shippedAt)}</span>}
          </p>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-card border border-line bg-surface p-5" aria-label="Items">
          <h2 className="mb-3 font-display text-lg font-semibold">Items</h2>
          <ul className="divide-y divide-line">
            {order.items.map((item, i) => (
              <li key={i} className="flex items-center gap-3 py-3">
                <span className="block h-14 w-14 shrink-0 overflow-hidden rounded-card bg-line/40">
                  {item.image && <img src={cimg(item.image, { w: 120 })} alt={item.name} loading="lazy" className="h-full w-full object-cover" />}
                </span>
                <div className="flex-1 text-sm">
                  <p className="font-medium">{item.name}</p>
                  <p className="text-ink-soft">
                    {item.variantSku ? `${item.variantSku} · ` : ''}Qty {item.quantity}
                  </p>
                </div>
                <p className="font-display text-sm font-semibold">{formatINR(item.unitPrice * item.quantity)}</p>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-1.5 border-t border-line pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-ink-soft">Subtotal</dt>
              <dd>{formatINR(order.pricing.subtotal)}</dd>
            </div>
            {order.pricing.discount > 0 && (
              <div className="flex justify-between text-success">
                <dt>Coupon {order.coupon?.code}</dt>
                <dd>−{formatINR(order.pricing.discount)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-ink-soft">Shipping</dt>
              <dd>{formatINR(order.pricing.shipping)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-soft">Tax</dt>
              <dd>{formatINR(order.pricing.tax)}</dd>
            </div>
            <div className="flex items-baseline justify-between border-t border-line pt-2">
              <dt className="font-medium">Total</dt>
              <dd className="font-display text-xl font-semibold">{formatINR(order.pricing.total)}</dd>
            </div>
          </dl>
        </section>

        <div className="space-y-6">
          <section className="rounded-card border border-line bg-surface p-5" aria-label="Shipping address">
            <h2 className="mb-3 font-display text-lg font-semibold">Shipping to</h2>
            <address className="text-sm not-italic leading-relaxed text-ink-soft">
              <span className="font-medium text-ink">{order.shippingAddress.fullName}</span>
              <br />
              {order.shippingAddress.line1}
              {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ''}
              <br />
              {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}
              <br />
              {order.shippingAddress.country}
              <br />
              {order.shippingAddress.phone}
            </address>
          </section>

          <section className="rounded-card border border-line bg-surface p-5" aria-label="Order timeline">
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

      {(cancellable || returnable || canRetry) && (
        <div className="flex flex-wrap gap-3">
          {canRetry && (
            <Button size="lg" onClick={retryPayment} loading={retrying}>
              {order.status === 'PAYMENT_FAILED' ? 'Retry payment' : 'Pay now'}
            </Button>
          )}
          {cancellable && (
            <Button size="lg" variant="secondary" onClick={() => setCancelOpen(true)}>
              Cancel order
            </Button>
          )}
          {returnable && (
            <Button size="lg" variant="secondary" onClick={() => setReturnOpen(true)}>
              Request return
            </Button>
          )}
        </div>
      )}

      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel this order?">
        <p className="mb-4 text-sm leading-relaxed text-ink-soft">
          {order.status === 'PENDING_PAYMENT'
            ? 'The order has not been paid yet — nothing will be charged.'
            : 'Paid orders are refunded by our team after cancellation; stock returns to the shelf immediately.'}
        </p>
        <div className="mb-4">
          <label htmlFor="cancel-reason" className="mb-1 block text-sm font-medium text-ink">
            Reason (optional)
          </label>
          <textarea
            id="cancel-reason"
            className="block w-full rounded-input border border-line bg-surface px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            rows={2}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setCancelOpen(false)}>
            Keep order
          </Button>
          <Button variant="danger" loading={cancel.isPending} onClick={() => cancel.mutate()}>
            Cancel order
          </Button>
        </div>
      </Modal>

      <Modal open={returnOpen} onClose={() => setReturnOpen(false)} title="Request a return">
        <p className="mb-4 text-sm text-ink-soft">Tell us what went wrong and our team will review the request.</p>
        <div className="mb-4">
          <Input
            label="Reason for return"
            name="returnReason"
            required
            minLength={3}
            value={returnReason}
            onChange={(e) => setReturnReason(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setReturnOpen(false)}>
            Back
          </Button>
          <Button loading={requestReturn.isPending} disabled={returnReason.trim().length < 3} onClick={() => requestReturn.mutate()}>
            Submit request
          </Button>
        </div>
      </Modal>
    </div>
  );
}

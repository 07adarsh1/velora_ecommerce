import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Lock, Plus, ShieldCheck } from 'lucide-react';
import { addressApi, orderApi, paymentApi } from '../lib/api/endpoints';
import { useCart } from '../hooks/useCart';
import { Button, EmptyState, Input, Skeleton, Stepper } from '../components/ui';
import { formatINR } from '../lib/api/client';

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function AddressForm({ onSaved, onCancel }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'India',
  });

  const save = useMutation({
    mutationFn: () => addressApi.create({ ...form, isDefault: false }),
    onSuccess: () => {
      toast.success('Address saved');
      queryClient.invalidateQueries({ queryKey: ['addresses'] });
      onSaved();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not save address'),
  });

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
      className="space-y-3 rounded-card border border-accent/30 bg-surface p-5"
    >
      <h3 className="font-display text-base font-semibold">New shipping address</h3>
      <div className="grid grid-cols-2 gap-3">
        <Input label="Full name" name="fullName" required value={form.fullName} onChange={set('fullName')} autoComplete="name" />
        <Input label="Phone" name="phone" required value={form.phone} onChange={set('phone')} autoComplete="tel" />
      </div>
      <Input label="Address line 1" name="line1" required value={form.line1} onChange={set('line1')} autoComplete="address-line1" />
      <Input label="Address line 2 (optional)" name="line2" value={form.line2} onChange={set('line2')} autoComplete="address-line2" />
      <div className="grid grid-cols-3 gap-3">
        <Input label="City" name="city" required value={form.city} onChange={set('city')} />
        <Input label="State" name="state" required value={form.state} onChange={set('state')} />
        <Input label="PIN code" name="postalCode" required value={form.postalCode} onChange={set('postalCode')} autoComplete="postal-code" />
      </div>
      <Input label="Country" name="country" required value={form.country} onChange={set('country')} autoComplete="country-name" />
      <div className="flex gap-2 pt-1">
        <Button type="submit" loading={save.isPending}>
          Save address
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export default function Checkout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { cart, isLoading } = useCart();
  const [selectedAddress, setSelectedAddress] = useState(null);
  const [addingAddress, setAddingAddress] = useState(false);

  const { data: addresses } = useQuery({
    queryKey: ['addresses'],
    queryFn: () => addressApi.list().then((r) => r.data),
  });

  const effectiveAddressId =
    selectedAddress ?? (addresses && addresses.length > 0 ? (addresses.find((a) => a.isDefault) ?? addresses[0])._id : null);

  const placeOrder = useMutation({
    mutationFn: async () => {
      // 1. Create the PENDING_PAYMENT order — the server recomputes every
      //    rupee; the client never sends amounts (PRD §4.4).
      const orderRes = await orderApi.create({ addressId: effectiveAddressId });
      const order = orderRes.data;

      // 2. Create the gateway order/intent.
      const intentRes = await paymentApi.createOrder(order._id);
      const intent = intentRes.data;

      // 3. Run the gateway's checkout. MOCK mode simulates success and hands
      //    back a signed payload; production opens the Razorpay widget.
      if (intent.gateway === 'mock') {
        const paid = await paymentApi.mockPay(intent.gatewayOrderId, true);
        if (!paid.data.success) throw new Error('Payment failed (mock)');
        const verified = await paymentApi.verify({
          orderId: order._id,
          gatewayOrderId: intent.gatewayOrderId,
          gatewayPaymentId: paid.data.gatewayPaymentId,
          signature: paid.data.signature,
        });
        return verified.data;
      }

      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error('Could not load the payment gateway. Check your connection.');

      return new Promise((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: intent.keyId,
          amount: intent.amount,
          currency: intent.currency,
          name: 'Velora',
          description: `Order ${intent.orderNumber}`,
          order_id: intent.gatewayOrderId,
          handler: async (response) => {
            try {
              const verified = await paymentApi.verify({
                orderId: order._id,
                gatewayOrderId: response.razorpay_order_id,
                gatewayPaymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
              });
              resolve(verified.data);
            } catch (err) {
              reject(err);
            }
          },
          modal: {
            ondismiss: () => reject(new Error('Payment cancelled — your order is saved, retry from order history')),
          },
        });
        rzp.open();
      });
    },
    onSuccess: (order) => {
      toast.success(`Payment confirmed — order ${order.orderNumber}`);
      // The server cleared the cart as part of confirmation — refetch so the
      // navbar badge drops to zero immediately.
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      navigate(`/orders/${order._id}?paid=1`);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Checkout failed'),
  });

  if (isLoading) {
    return (
      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <Skeleton className="h-64 w-full rounded-card" />
        <Skeleton className="h-48 w-full rounded-card" />
      </div>
    );
  }

  const items = cart?.cart.items ?? [];
  if (items.length === 0) {
    return (
      <EmptyState
        title="Nothing to check out"
        description="Your cart is empty."
        action={
          <Link to="/products">
            <Button>Browse products</Button>
          </Link>
        }
      />
    );
  }

  const unavailable = items.filter((i) => i.unavailable);

  return (
    <div>
      <div className="mb-8">
        <p className="eyebrow">Secure checkout</p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">Checkout</h1>
        <div className="mt-5">
          <Stepper steps={['Address', 'Review', 'Payment']} current={2} />
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="space-y-8">
          {unavailable.length > 0 && (
            <div className="rounded-card border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
              Some items are no longer available.{' '}
              <Link to="/cart" className="font-medium underline">
                Review your cart
              </Link>{' '}
              before continuing.
            </div>
          )}

          <section aria-label="Shipping address">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">1 · Shipping address</h2>
              {!addingAddress && (
                <Button variant="ghost" size="sm" onClick={() => setAddingAddress(true)}>
                  <Plus className="h-4 w-4" aria-hidden="true" /> Add address
                </Button>
              )}
            </div>
            {addingAddress ? (
              <AddressForm onSaved={() => setAddingAddress(false)} onCancel={() => setAddingAddress(false)} />
            ) : addresses && addresses.length > 0 ? (
              <ul className="space-y-2">
                {addresses.map((a) => {
                  const selected = effectiveAddressId === a._id;
                  return (
                    <li key={a._id}>
                      <label
                        className={`relative flex cursor-pointer gap-3 overflow-hidden rounded-card border p-4 transition-colors ${
                          selected ? 'border-accent bg-accent-soft/40' : 'border-line bg-surface hover:border-ink-soft/40'
                        }`}
                      >
                        {selected && <span className="absolute inset-y-0 left-0 w-1 bg-accent" aria-hidden="true" />}
                        <input
                          type="radio"
                          name="address"
                          value={a._id}
                          checked={selected}
                          onChange={() => setSelectedAddress(a._id)}
                          className="mt-1"
                        />
                        <div className="text-sm">
                          <p className="font-medium">
                            {a.fullName} {a.isDefault && <span className="ml-1 text-xs text-accent">(default)</span>}
                          </p>
                          <p className="mt-0.5 text-ink-soft">
                            {a.line1}
                            {a.line2 ? `, ${a.line2}` : ''}, {a.city}, {a.state} {a.postalCode}, {a.country}
                          </p>
                          <p className="text-ink-soft/80">{a.phone}</p>
                        </div>
                      </label>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="rounded-card border border-dashed border-line bg-canvas p-6 text-center text-sm text-ink-soft">
                No saved addresses yet — add one to continue.
              </p>
            )}
          </section>

          <section aria-label="Order review">
            <h2 className="mb-3 font-display text-lg font-semibold">2 · Review items</h2>
            <ul className="divide-y divide-line rounded-card border border-line bg-surface">
              {items.map((i) => (
                <li key={`${i.product._id}-${i.variantSku ?? ''}`} className="flex items-center justify-between gap-4 p-4 text-sm">
                  <div>
                    <p className="font-medium">{i.product.name}</p>
                    <p className="text-ink-soft">
                      {i.variantSku ? `${i.variantSku} · ` : ''}Qty {i.quantity}
                    </p>
                  </div>
                  <p className="font-display text-base font-semibold">{formatINR(i.unitPrice * i.quantity)}</p>
                </li>
              ))}
            </ul>
          </section>

          <section aria-label="Payment">
            <h2 className="mb-2 font-display text-lg font-semibold">3 · Payment</h2>
            <p className="text-sm text-ink-soft">
              The amount you see is computed by the server from your current cart — it's exactly what you'll be charged.
            </p>
          </section>
        </div>

        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          {cart && (
            <div className="space-y-3 rounded-card border border-line bg-surface p-5">
              <h2 className="font-display text-lg font-semibold">Order summary</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-ink-soft">Subtotal</dt>
                  <dd>{formatINR(cart.pricing.subtotal)}</dd>
                </div>
                {cart.pricing.discount > 0 && (
                  <div className="flex justify-between text-success">
                    <dt>Coupon {cart.cart.appliedCoupon?.code}</dt>
                    <dd>−{formatINR(cart.pricing.discount)}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt className="text-ink-soft">Shipping</dt>
                  <dd>{formatINR(cart.pricing.shipping)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-ink-soft">Tax</dt>
                  <dd>{formatINR(cart.pricing.tax)}</dd>
                </div>
                <div className="flex items-baseline justify-between border-t border-line pt-3">
                  <dt className="font-medium">Total</dt>
                  <dd className="font-display text-2xl font-semibold">{formatINR(cart.pricing.total)}</dd>
                </div>
              </dl>

              <Button
                size="lg"
                className="w-full"
                disabled={!effectiveAddressId || unavailable.length > 0}
                loading={placeOrder.isPending}
                onClick={() => placeOrder.mutate()}
              >
                <Lock className="h-4 w-4" aria-hidden="true" />
                Pay {formatINR(cart.pricing.total)}
              </Button>

              <p className="flex items-center justify-center gap-1.5 text-center text-xs text-ink-soft">
                <ShieldCheck className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
                Signature-verified payments · sandbox / test mode
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

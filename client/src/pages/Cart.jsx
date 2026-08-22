import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { Button, EmptyState, Input, QtyStepper, Skeleton } from '../components/ui';
import { useCart } from '../hooks/useCart';
import { cartApi } from '../lib/api/endpoints';
import { guestCart } from '../lib/cart/guestCart';
import { formatINR } from '../lib/api/client';
import { cimg } from '../lib/utils/image';

function useCoupon() {
  const queryClient = useQueryClient();
  const [couponCode, setCouponCode] = useState('');

  const applyCoupon = useMutation({
    mutationFn: () => cartApi.applyCoupon(couponCode),
    onSuccess: (res) => {
      toast.success(`Coupon ${res.data.pricing.coupon?.code} applied`);
      queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Coupon could not be applied'),
  });

  const removeCoupon = useMutation({
    mutationFn: () => cartApi.removeCoupon(),
    onSuccess: () => {
      toast.success('Coupon removed');
      queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
  });

  return { applyCoupon, removeCoupon, couponCode, setCouponCode };
}

function CartItemRow({ item, updateQuantity, removeItem, busy }) {
  return (
    <li className="flex gap-4 rounded-card border border-line bg-surface p-4">
      <Link to={`/products/${item.product.slug}`} className="shrink-0">
        <span className="block h-24 w-24 overflow-hidden rounded-card bg-line/40">
          {item.product.image && (
            <img
              src={cimg(item.product.image, { w: 160 })}
              alt={item.product.name}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          )}
        </span>
      </Link>
      <div className="flex flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <Link to={`/products/${item.product.slug}`} className="text-sm font-medium text-ink hover:text-accent">
              {item.product.name}
            </Link>
            {item.variantSku && <p className="mt-0.5 font-mono text-xs text-ink-soft">{item.variantSku}</p>}
            {item.unavailable && (
              <p className="mt-1 flex items-center gap-1 text-xs font-medium text-danger">
                <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> No longer available
              </p>
            )}
            {!item.unavailable && !item.inStock && (
              <p className="mt-1 text-xs font-medium text-warn">Only {item.stock} left — reduce quantity</p>
            )}
          </div>
          <p className="shrink-0 font-display text-base font-semibold text-ink">
            {formatINR(item.unitPrice * item.quantity)}
          </p>
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-3">
          <QtyStepper
            value={item.quantity}
            min={1}
            max={item.stock || 1}
            disabled={item.unavailable || busy}
            onChange={(q) => updateQuantity.mutate({ productId: item.product._id, variantSku: item.variantSku, quantity: q })}
            label={`Quantity for ${item.product.name}`}
          />
          <p className="text-xs text-ink-soft">{formatINR(item.unitPrice)} each</p>
          <button
            onClick={() => removeItem.mutate({ productId: item.product._id, variantSku: item.variantSku })}
            className="ml-auto flex h-11 w-11 items-center justify-center rounded-full text-ink-soft/70 transition-colors hover:bg-danger/10 hover:text-danger"
            aria-label={`Remove ${item.product.name} from cart`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </li>
  );
}

export default function Cart() {
  const { cart, isLoading, isLoggedIn, updateQuantity, removeItem } = useCart();
  const { applyCoupon, removeCoupon, couponCode, setCouponCode } = useCoupon();

  if (isLoading && isLoggedIn) {
    return (
      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-card" />
          <Skeleton className="h-32 w-full rounded-card" />
        </div>
        <Skeleton className="h-64 w-full rounded-card" />
      </div>
    );
  }

  // ─── Guest cart (localStorage; merges at login) ─────────────────────────────
  if (!isLoggedIn) {
    const guestItems = guestCart.count();
    return (
      <div>
        <h1 className="mb-6 font-display text-3xl font-semibold tracking-tight">Your cart</h1>
        {guestItems === 0 ? (
          <EmptyState
            title="Your cart is empty"
            description="Browse the catalog and add something you love."
            action={
              <Link to="/products">
                <Button>Browse products</Button>
              </Link>
            }
          />
        ) : (
          <div className="rounded-card border border-line bg-surface p-6">
            <p className="text-sm text-ink-soft">
              {guestItems} item{guestItems === 1 ? '' : 's'} saved locally on this device.
            </p>
            <p className="mt-2 text-sm text-ink-soft">
              <Link to="/login" className="font-medium text-accent hover:text-accent-hover">
                Log in
              </Link>{' '}
              to see live prices and check out — your cart merges automatically.
            </p>
          </div>
        )}
      </div>
    );
  }

  const items = cart?.cart.items ?? [];
  const pricing = cart?.pricing;

  return (
    <div className="pb-24 lg:pb-0">
      <h1 className="mb-6 font-display text-3xl font-semibold tracking-tight">Your cart</h1>
      {items.length === 0 ? (
        <EmptyState
          title="Your cart is empty"
          description="Browse the catalog and add something you love."
          action={
            <Link to="/products">
              <Button>Browse products</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
          <ul className="space-y-4">
            {items.map((item) => (
              <CartItemRow
                key={`${item.product._id}-${item.variantSku ?? ''}`}
                item={item}
                updateQuantity={updateQuantity}
                removeItem={removeItem}
                busy={updateQuantity.isPending}
              />
            ))}
          </ul>

          <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            {pricing && (
              <div className="space-y-3 rounded-card border border-line bg-surface p-5">
                <h2 className="font-display text-lg font-semibold">Order summary</h2>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-ink-soft">Subtotal</dt>
                    <dd>{formatINR(pricing.subtotal)}</dd>
                  </div>
                  {pricing.discount > 0 && (
                    <div className="flex justify-between text-success">
                      <dt>Discount</dt>
                      <dd>−{formatINR(pricing.discount)}</dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-ink-soft">Shipping (flat rate)</dt>
                    <dd>{pricing.shipping === 0 ? 'Free' : formatINR(pricing.shipping)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-ink-soft">Tax (18% GST)</dt>
                    <dd>{formatINR(pricing.tax)}</dd>
                  </div>
                  <div className="flex items-baseline justify-between border-t border-line pt-3">
                    <dt className="font-medium">Total</dt>
                    <dd className="font-display text-xl font-semibold">{formatINR(pricing.total)}</dd>
                  </div>
                </dl>
                <p className="text-xs text-ink-soft/70">Totals are calculated server-side and may update if prices change.</p>
              </div>
            )}

            {cart?.cart.appliedCoupon ? (
              <div className="flex items-center justify-between rounded-card border border-line bg-surface p-4 text-sm">
                <span>
                  Coupon <span className="font-mono font-medium text-accent">{cart.cart.appliedCoupon.code}</span> applied
                </span>
                <button
                  onClick={() => removeCoupon.mutate()}
                  className="flex h-11 w-11 items-center justify-center rounded-full text-ink-soft/70 hover:bg-danger/10 hover:text-danger"
                  aria-label="Remove coupon"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (couponCode.trim()) applyCoupon.mutate();
                }}
                className="flex gap-2 rounded-card border border-line bg-surface p-4"
              >
                <Input
                  name="coupon"
                  placeholder="Coupon code"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  className="flex-1"
                  aria-label="Coupon code"
                />
                <Button type="submit" variant="secondary" loading={applyCoupon.isPending}>
                  Apply
                </Button>
              </form>
            )}

            <Link to="/checkout" className="hidden lg:block">
              <Button size="lg" className="w-full" disabled={items.some((i) => i.unavailable)}>
                Proceed to checkout
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Mobile sticky checkout bar */}
      {items.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur-md lg:hidden">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="eyebrow">Total</p>
              <p className="font-display text-lg font-semibold">{formatINR(pricing?.total ?? 0)}</p>
            </div>
            <Link to="/checkout">
              <Button size="lg" disabled={items.some((i) => i.unavailable)}>
                Checkout
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

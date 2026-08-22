import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Heart } from 'lucide-react';
import { wishlistApi } from '../lib/api/endpoints';
import { useAuthStore } from '../lib/auth/tokenStore';
import { Button, EmptyState, ErrorState, Price, Skeleton, Stars } from '../components/ui';
import { formatINR } from '../lib/api/client';
import { cimg } from '../lib/utils/image';

export default function Wishlist() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['wishlist'],
    queryFn: () => wishlistApi.get().then((r) => r.data),
    enabled: Boolean(user),
  });

  const moveToCart = useMutation({
    mutationFn: (productId) => wishlistApi.moveToCart(productId),
    onSuccess: () => {
      toast.success('Moved to cart');
      queryClient.invalidateQueries({ queryKey: ['wishlist'] });
      queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not move to cart'),
  });

  const remove = useMutation({
    mutationFn: (productId) => wishlistApi.remove(productId),
    onSuccess: () => {
      toast.success('Removed from wishlist');
      queryClient.invalidateQueries({ queryKey: ['wishlist'] });
    },
  });

  if (!user) {
    return (
      <EmptyState
        icon={Heart}
        title="Log in to use your wishlist"
        action={
          <Link to="/login">
            <Button>Log in</Button>
          </Link>
        }
      />
    );
  }

  if (error) return <ErrorState onRetry={refetch} />;
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-72 w-full rounded-card" />
        ))}
      </div>
    );
  }

  const products = data?.products ?? [];

  return (
    <div>
      <div className="mb-6">
        <p className="eyebrow">Saved for later</p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">Your wishlist</h1>
      </div>
      {products.length === 0 ? (
        <EmptyState
          icon={Heart}
          title="Your wishlist is empty"
          description="Tap the heart on any product to save it for later."
          action={
            <Link to="/products">
              <Button>Browse products</Button>
            </Link>
          }
        />
      ) : (
        <ul className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => {
            const price = Math.round(p.basePrice * (1 - p.discountPercent / 100));
            const inStock = p.variants?.length > 0 ? p.variants.some((v) => v.stock > 0) : p.stock > 0;
            return (
              <li
                key={p._id}
                className="group flex flex-col overflow-hidden rounded-card border border-line bg-surface transition-shadow hover:shadow-[0_12px_32px_rgba(28,27,26,0.08)]"
              >
                <Link to={`/products/${p.slug}`} className="block overflow-hidden bg-line/40">
                  {p.images?.[0] && (
                    <img
                      src={cimg(p.images[0], { w: 600 })}
                      alt={p.name}
                      loading="lazy"
                      className="aspect-[4/5] w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                    />
                  )}
                </Link>
                <div className="flex flex-1 flex-col gap-1 p-4">
                  <Link to={`/products/${p.slug}`} className="line-clamp-2 text-sm font-medium hover:text-accent">
                    {p.name}
                  </Link>
                  {p.numReviews > 0 && <Stars rating={p.averageRating} count={p.numReviews} />}
                  <Price
                    current={formatINR(price)}
                    original={p.discountPercent > 0 ? formatINR(p.basePrice) : undefined}
                    discountPercent={p.discountPercent}
                    className="mt-auto pt-1"
                  />
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      disabled={!inStock}
                      loading={moveToCart.isPending}
                      onClick={() => moveToCart.mutate(p._id)}
                    >
                      {inStock ? 'Move to cart' : 'Out of stock'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Remove ${p.name} from wishlist`}
                      onClick={() => remove.mutate(p._id)}
                    >
                      ✕
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

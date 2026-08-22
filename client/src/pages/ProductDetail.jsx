import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Heart, ShieldCheck, Truck } from 'lucide-react';
import { productApi, wishlistApi } from '../lib/api/endpoints';
import { useCart } from '../hooks/useCart';
import { useAuthStore } from '../lib/auth/tokenStore';
import {
  Badge,
  Button,
  Chip,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  Price,
  QtyStepper,
  SectionHeader,
  Select,
  Skeleton,
  Stars,
} from '../components/ui';
import { ProductCard } from '../components/product/ProductCard';
import { cimg } from '../lib/utils/image';
import { formatINR, formatDate } from '../lib/api/client';

function ReviewModal({ productId, onClose }) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const queryClient = useQueryClient();

  const submit = useMutation({
    mutationFn: () => productApi.createReview(productId, { rating, comment: comment || undefined }),
    onSuccess: () => {
      toast.success('Review posted');
      queryClient.invalidateQueries({ queryKey: ['reviews', productId] });
      queryClient.invalidateQueries({ queryKey: ['product'] });
      onClose();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Could not post review'),
  });

  return (
    <Modal open onClose={onClose} title="Write a review">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit.mutate();
        }}
        className="space-y-4"
      >
        <Select label="Rating" name="rating" value={rating} onChange={(e) => setRating(Number(e.target.value))}>
          {[5, 4, 3, 2, 1].map((r) => (
            <option key={r} value={r}>
              {'★'.repeat(r)} ({r})
            </option>
          ))}
        </Select>
        <div>
          <label htmlFor="review-comment" className="mb-1 block text-sm font-medium text-ink">
            Comment (optional)
          </label>
          <textarea
            id="review-comment"
            className="block w-full rounded-input border border-line bg-surface px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            rows={4}
            placeholder="Share your experience"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={submit.isPending}>
            Post review
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function ProductDetail() {
  const { slug } = useParams();
  const user = useAuthStore((s) => s.user);
  const { addToCart } = useCart();
  const queryClient = useQueryClient();
  const [selectedSku, setSelectedSku] = useState(null);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [reviewOpen, setReviewOpen] = useState(false);

  const { data: product, isLoading, error, refetch } = useQuery({
    queryKey: ['product', slug],
    queryFn: () => productApi.bySlug(slug).then((r) => r.data),
  });

  const productId = product?._id;

  const { data: related } = useQuery({
    queryKey: ['related', productId],
    queryFn: () => productApi.related(productId).then((r) => r.data),
    enabled: Boolean(productId),
  });

  // Pull enough reviews to draw an honest distribution at portfolio scale.
  const { data: reviewsData, isLoading: reviewsLoading } = useQuery({
    queryKey: ['reviews', productId],
    queryFn: () => productApi.reviews(productId, 1, 100),
    enabled: Boolean(productId),
  });

  const { data: wishlist } = useQuery({
    queryKey: ['wishlist'],
    queryFn: () => wishlistApi.get().then((r) => r.data),
    enabled: Boolean(user),
  });

  const toggleWishlist = useMutation({
    mutationFn: async () => {
      if (!productId) return;
      const inWishlist = wishlist?.products.some((p) => p._id === productId);
      if (inWishlist) return wishlistApi.remove(productId);
      return wishlistApi.add(productId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wishlist'] }),
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Wishlist update failed'),
  });

  if (error) return <ErrorState onRetry={refetch} message={error instanceof Error ? error.message : undefined} />;
  if (isLoading) {
    return (
      <div className="grid gap-10 lg:grid-cols-2">
        <Skeleton className="aspect-square w-full rounded-media" />
        <div className="space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-10 w-1/3" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }
  if (!product) return <EmptyState title="Product not found" />;

  const variant = product.variants.find((v) => v.sku === selectedSku) || null;
  const hasVariants = product.variants.length > 0;
  const effectiveBase = variant ? variant.price ?? product.basePrice : product.basePrice;
  const price = Math.round(effectiveBase * (1 - product.discountPercent / 100) * 100) / 100;
  const stock = hasVariants ? (variant ? variant.stock : Math.max(...product.variants.map((v) => v.stock))) : product.stock;
  const inWishlist = Boolean(user && wishlist?.products.some((p) => p._id === product._id));
  const category = typeof product.category === 'object' ? product.category : null;

  const handleAddToCart = () => {
    if (hasVariants && !variant) {
      toast.error('Choose an option first');
      return;
    }
    addToCart.mutate({ productId: product._id, variantSku: selectedSku, quantity, name: product.name });
  };

  const reviews = reviewsData?.data ?? [];
  const myReview = user ? reviews.find((r) => r.user._id === user._id) : undefined;
  const distribution = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
  }));
  const maxBar = Math.max(1, ...distribution.map((d) => d.count));

  return (
    <div className="space-y-16">
      <nav className="text-sm text-ink-soft" aria-label="Breadcrumb">
        <Link to="/products" className="hover:text-accent">
          Products
        </Link>
        {category && (
          <>
            {' / '}
            <Link to={`/products?category=${category.slug}`} className="hover:text-accent">
              {category.name}
            </Link>
          </>
        )}
        {' / '}
        <span className="text-ink">{product.name}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
        {/* Gallery */}
        <div className="space-y-3">
          <div key={selectedImage} className="page-fade overflow-hidden rounded-media border border-line bg-line/30">
            {product.images?.[selectedImage] ? (
              <img
                src={cimg(product.images[selectedImage], { w: 1000 })}
                alt={`${product.name} — image ${selectedImage + 1}`}
                fetchPriority="high"
                className="aspect-square w-full object-cover"
              />
            ) : (
              <div className="flex aspect-square items-center justify-center text-sm text-ink-soft">No image</div>
            )}
          </div>
          {product.images.length > 1 && (
            <div className="flex gap-2">
              {product.images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedImage(i)}
                  aria-label={`Show image ${i + 1}`}
                  aria-current={i === selectedImage}
                  className={`h-20 w-20 overflow-hidden rounded-card border transition-all ${
                    i === selectedImage ? 'border-accent ring-1 ring-accent' : 'border-line hover:border-ink-soft/40'
                  }`}
                >
                  <img src={cimg(img, { w: 160 })} alt="" loading="lazy" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Buy box */}
        <div className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <div>
            {product.brand && <p className="eyebrow">{product.brand}</p>}
            <h1 className="mt-2 font-display text-3xl font-semibold leading-tight tracking-tight text-ink">
              {product.name}
            </h1>
            <a href="#reviews" className="mt-2 inline-block">
              {product.numReviews > 0 ? (
                <Stars rating={product.averageRating} count={product.numReviews} />
              ) : (
                <span className="text-sm text-ink-soft/70">No reviews yet</span>
              )}
            </a>
          </div>

          <Price
            current={formatINR(price)}
            original={product.discountPercent > 0 ? formatINR(product.basePrice) : undefined}
            discountPercent={product.discountPercent}
            size="lg"
          />

          <p className={`text-sm font-medium ${stock > 0 ? 'text-success' : 'text-danger'}`}>
            {stock > 0 ? (stock <= 5 ? `Only ${stock} left in stock` : 'In stock') : 'Out of stock'}
          </p>

          {hasVariants && (
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-ink">
                Options <span className="text-ink-soft">(choose one)</span>
              </legend>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => {
                  const label = [v.attributes.color, v.attributes.size].filter(Boolean).join(' · ') || v.sku;
                  const selected = selectedSku === v.sku;
                  return (
                    <Chip
                      key={v.sku}
                      selected={selected}
                      disabled={v.stock === 0}
                      onClick={() => {
                        setSelectedSku(v.sku);
                        setQuantity(1);
                      }}
                      className={v.stock === 0 ? 'line-through' : ''}
                    >
                      {label}
                      {v.price != null && !selected && (
                        <span className="text-ink-soft/70">· {formatINR(Math.round(v.price * (1 - product.discountPercent / 100)))}</span>
                      )}
                    </Chip>
                  );
                })}
              </div>
            </fieldset>
          )}

          <div className="flex flex-wrap items-center gap-4">
            <QtyStepper
              value={quantity}
              min={1}
              max={Math.max(1, stock)}
              onChange={setQuantity}
              disabled={stock === 0 || (hasVariants && !variant)}
              label={`Quantity for ${product.name}`}
            />
            <span className="text-sm text-ink-soft">
              Subtotal <span className="font-medium text-ink">{formatINR(price * quantity)}</span>
            </span>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              size="lg"
              className="w-full sm:flex-1"
              onClick={handleAddToCart}
              disabled={stock === 0}
              loading={addToCart.isPending}
            >
              Add to cart
            </Button>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => {
                if (!user) {
                  toast.error('Log in to save items to your wishlist');
                  return;
                }
                toggleWishlist.mutate();
              }}
              loading={toggleWishlist.isPending}
              aria-pressed={inWishlist}
              className="w-full sm:w-auto"
            >
              <Heart className={`h-4 w-4 ${inWishlist ? 'fill-danger text-danger' : ''}`} aria-hidden="true" />
              {inWishlist ? 'Saved' : 'Wishlist'}
            </Button>
          </div>

          <div className="grid gap-3 rounded-card border border-line bg-surface p-4 text-sm text-ink-soft sm:grid-cols-2">
            <p className="flex items-center gap-2">
              <Truck className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" /> Flat-rate delivery, tracked end to end
            </p>
            <p className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" /> Signature-verified payments
            </p>
          </div>
        </div>
      </div>

      {/* Description */}
      <section aria-label="Description" className="max-w-2xl">
        <h2 className="font-display text-xl font-semibold tracking-tight">About this product</h2>
        <p className="mt-3 leading-relaxed text-ink-soft">{product.description}</p>
      </section>

      {/* Reviews */}
      <section id="reviews" aria-label="Reviews" className="scroll-mt-24 space-y-6">
        <SectionHeader
          eyebrow="Customer voices"
          title={`Reviews (${product.numReviews})`}
          action={
            user && !myReview ? (
              <Button variant="secondary" onClick={() => setReviewOpen(true)}>
                Write a review
              </Button>
            ) : !user ? (
              <Link to="/login" className="text-sm font-medium text-accent hover:text-accent-hover">
                Log in to review
              </Link>
            ) : (
              <Badge color="blue">You reviewed this product</Badge>
            )
          }
        />

        {product.numReviews > 0 && (
          <div className="flex flex-col gap-6 rounded-card border border-line bg-surface p-6 sm:flex-row sm:items-center sm:gap-10">
            <div className="shrink-0 text-center sm:text-left">
              <p className="font-display text-5xl font-semibold text-ink">{product.averageRating.toFixed(1)}</p>
              <Stars rating={product.averageRating} />
              <p className="mt-1 text-xs text-ink-soft">{product.numReviews} reviews</p>
            </div>
            <div className="flex-1 space-y-1.5">
              {distribution.map((d) => (
                <div key={d.star} className="flex items-center gap-3 text-xs text-ink-soft">
                  <span className="w-8 shrink-0 tabular-nums">{d.star}★</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-line">
                    <span
                      className="block h-full rounded-full bg-gold transition-[width] duration-500"
                      style={{ width: `${(d.count / maxBar) * 100}%` }}
                    />
                  </span>
                  <span className="w-6 shrink-0 text-right tabular-nums">{d.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {reviewsLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full rounded-card" />
            <Skeleton className="h-20 w-full rounded-card" />
          </div>
        ) : reviews.length === 0 ? (
          <EmptyState title="No reviews yet" description="Be the first to share your thoughts." />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {reviews.map((r) => (
              <li key={r._id} className="rounded-card border border-line bg-surface p-5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-ink">{r.user.name}</span>
                  <span className="text-xs text-ink-soft/70">{formatDate(r.createdAt)}</span>
                </div>
                <div className="mt-1.5">
                  <Stars rating={r.rating} />
                </div>
                {r.verifiedPurchase && (
                  <Badge color="green">
                    <span className="mr-1">✓</span> Verified purchase
                  </Badge>
                )}
                {r.comment && <p className="mt-2.5 text-sm leading-relaxed text-ink-soft">{r.comment}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Related */}
      {related && related.length > 0 && (
        <section aria-label="Related products">
          <SectionHeader eyebrow="Keep browsing" title="You may also like" />
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p._id} product={p} />
            ))}
          </div>
        </section>
      )}

      {reviewOpen && productId && <ReviewModal productId={productId} onClose={() => setReviewOpen(false)} />}
    </div>
  );
}
